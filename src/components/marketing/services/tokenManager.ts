/**
 * tokenManager.ts
 * Centralized access token + refresh token management for AI Space.
 *
 * Flow:
 *  1. Login  → backend trả về { access_token, refresh_token, expires_in }
 *  2. saveTokens() → lưu vào localStorage với timestamp hết hạn
 *  3. getValidAccessToken() → kiểm tra còn hạn chưa; nếu sắp hết (< 60s) tự động refresh
 *  4. clearTokens() → xóa khi logout
 */

const STORAGE_KEY_ACCESS = 'ai_space_access_token';
const STORAGE_KEY_REFRESH = 'ai_space_refresh_token';
const STORAGE_KEY_EXPIRY = 'ai_space_token_expiry'; // Unix ms

// How many seconds before expiry to proactively refresh (60 seconds buffer)
const REFRESH_BUFFER_SECONDS = 60;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenPair {
    access_token: string;
    refresh_token: string;
    expires_in: number; // seconds
}

// ─── Save / Clear ─────────────────────────────────────────────────────────────

/**
 * Persist the token pair received from a successful login / refresh response.
 */
export function saveTokens(tokens: TokenPair): void {
    const expiryMs = Date.now() + tokens.expires_in * 1000;
    localStorage.setItem(STORAGE_KEY_ACCESS, tokens.access_token);
    localStorage.setItem(STORAGE_KEY_REFRESH, tokens.refresh_token);
    localStorage.setItem(STORAGE_KEY_EXPIRY, String(expiryMs));
}

/**
 * Remove all stored tokens (called on logout).
 */
export function clearTokens(): void {
    localStorage.removeItem(STORAGE_KEY_ACCESS);
    localStorage.removeItem(STORAGE_KEY_REFRESH);
    localStorage.removeItem(STORAGE_KEY_EXPIRY);
}

/**
 * Read the raw access token from storage WITHOUT any validation.
 * Useful for initialising state on page load.
 */
export function getRawAccessToken(): string | null {
    return localStorage.getItem(STORAGE_KEY_ACCESS);
}

export function getRawRefreshToken(): string | null {
    return localStorage.getItem(STORAGE_KEY_REFRESH);
}

// ─── Token validity ───────────────────────────────────────────────────────────

function isAccessTokenValid(): boolean {
    const token = localStorage.getItem(STORAGE_KEY_ACCESS);
    const expiry = localStorage.getItem(STORAGE_KEY_EXPIRY);
    if (!token || !expiry) return false;
    const expiryMs = parseInt(expiry, 10);
    // Valid if more than REFRESH_BUFFER_SECONDS remain
    return Date.now() < expiryMs - REFRESH_BUFFER_SECONDS * 1000;
}

// ─── Refresh logic ────────────────────────────────────────────────────────────

// In-flight refresh promise to avoid duplicate refresh requests
let refreshPromise: Promise<string | null> | null = null;

/**
 * Use the stored refresh token to get a new access token from the backend.
 * Returns the new access token on success, or null on failure.
 */
async function refreshAccessToken(apiBaseUrl: string): Promise<string | null> {
    const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH);
    if (!refreshToken) return null;

    try {
        const res = await fetch(`${apiBaseUrl}/ai_org_auth.php?action=refresh_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!res.ok) {
            // Refresh token is invalid / expired (401/403) — only then force logout
            if (res.status === 401 || res.status === 403) {
                console.warn('[TokenManager] Refresh token invalid, clearing session.');
                clearTokens();
            } else {
                console.error(`[TokenManager] Refresh failed with status ${res.status}. Keeping tokens.`);
            }
            return null;
        }

        const data = await res.json();
        if (data.success && data.data?.access_token) {
            // Store the new access token (keep the same refresh token)
            const expiresIn = data.data.expires_in ?? 3600;
            localStorage.setItem(STORAGE_KEY_ACCESS, data.data.access_token);
            localStorage.setItem(STORAGE_KEY_EXPIRY, String(Date.now() + expiresIn * 1000));
            return data.data.access_token;
        }

        // Server said not ok (but with 200 OK) — check if we should clear
        if (data.message?.toLowerCase().includes('token')) {
            clearTokens();
        }
        return null;
    } catch (err) {
        console.error('[TokenManager] Refresh request failed (network error):', err);
        return null;
    }
}

// ─── Main public API ──────────────────────────────────────────────────────────

/**
 * Get a valid access token, auto-refreshing if needed.
 * Pass the same apiBaseUrl used by storageAdapter.ts.
 *
 * Returns the token string, or null if the user is not authenticated.
 */
export async function getValidAccessToken(apiBaseUrl: string): Promise<string | null> {
    if (isAccessTokenValid()) {
        return localStorage.getItem(STORAGE_KEY_ACCESS);
    }

    // Token expired or missing — try to refresh
    if (!refreshPromise) {
        refreshPromise = refreshAccessToken(apiBaseUrl).finally(() => {
            refreshPromise = null;
        });
    }

    return refreshPromise;
}

/**
 * Check whether the user has any non-expired tokens at all (quick check, no network request).
 */
export function hasStoredTokens(): boolean {
    const access = localStorage.getItem(STORAGE_KEY_ACCESS);
    const refresh = localStorage.getItem(STORAGE_KEY_REFRESH);
    return !!(access && refresh);
}

/**
 * Update only the access token (called after a successful refresh_token response).
 */
export function updateAccessToken(newToken: string, expiresIn = 3600): void {
    localStorage.setItem(STORAGE_KEY_ACCESS, newToken);
    localStorage.setItem(STORAGE_KEY_EXPIRY, String(Date.now() + expiresIn * 1000));
}

// Dual value declarations for verbatimModuleSyntax compatibility
export const TokenPair: any = undefined;
