/** Base URL của backend — tự động khớp theo origin trình duyệt (staging / production) */
export const API_BASE = (() => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return '/backend';
    }
    return `${window.location.origin}/backend`;
  }
  return import.meta.env.VITE_API_URL ?? '/backend';
})();

/** Tên / Title hệ thống ERP mặc định */
export const DEFAULT_SYSTEM_TITLE = 'MYERP';

/**
 * Hàm lấy tên / Title hệ thống động
 * Ưu tiên:
 * 1. Cấu hình tuỳ chỉnh trong localStorage (system_title hoặc system_name)
 * 2. Biến môi trường VITE_APP_TITLE
 * 3. Mặc định là 'MYERP'
 */
export const getSystemTitle = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('system_title') || localStorage.getItem('system_name');
    if (saved && saved.trim()) return saved.trim();
  }
  return import.meta.env.VITE_APP_TITLE || DEFAULT_SYSTEM_TITLE;
};

export const SYSTEM_TITLE = getSystemTitle();
