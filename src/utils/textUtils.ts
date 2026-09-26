/**
 * Utility functions for HTML entity decoding and tag stripping
 */

export const decodeHtmlEntities = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&hellip;/gi, '…')
    .replace(/&ndash;/gi, '–')
    .replace(/&mdash;/gi, '—')
    .replace(/&#(\d+);/g, (_, dec) => {
      try { return String.fromCharCode(Number(dec)); } catch { return ''; }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      try { return String.fromCharCode(parseInt(hex, 16)); } catch { return ''; }
    });
};

export const stripHtml = (html: string): string => {
  if (!html) return '';
  const noTags = html.replace(/<[^>]*>/g, ' ');
  return decodeHtmlEntities(noTags).replace(/\s+/g, ' ').trim();
};

export const cleanCommentText = (str: string | null | undefined): string => {
  if (!str) return '';
  return String(str)
    .replace(/&amp;nbsp;/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ');
};

export const cleanNotificationText = (text: string | null | undefined): string => {
  if (!text) return '';
  let str = String(text);
  str = str.replace(/<[^>]*>/g, ' ');
  str = decodeHtmlEntities(str);
  str = decodeHtmlEntities(str);
  str = str.replace(/&nbsp;/gi, ' ');
  str = str.replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, ' ');
  return str.replace(/\s+/g, ' ').trim();
};

/**
 * Bulletproof currency formatter for Vietnamese Dong
 * Handles null, undefined, NaN, empty strings, scientific notation, strings with dots/commas
 */
export const formatCurrencyVN = (
  value: number | string | null | undefined,
  suffix: string = 'đ',
  fallback: string = '0đ'
): string => {
  if (value === null || value === undefined || value === '') return fallback;
  
  let num: number;
  if (typeof value === 'number') {
    num = value;
  } else {
    // Clean string by removing commas, currency symbols, and spaces
    const cleanStr = String(value).replace(/[^\d.-]/g, '');
    num = parseFloat(cleanStr);
  }

  if (isNaN(num)) return fallback;

  // Format with dot thousand separator
  const isNegative = num < 0;
  const absNum = Math.abs(Math.round(num));
  const formatted = absNum.toLocaleString('vi-VN');

  return `${isNegative ? '-' : ''}${formatted}${suffix ? ` ${suffix}`.trimEnd() : ''}`;
};

/**
 * Bulletproof number formatter
 */
export const formatNumberVN = (
  value: number | string | null | undefined,
  decimals: number = 0,
  fallback: string = '0'
): string => {
  if (value === null || value === undefined || value === '') return fallback;

  let num: number;
  if (typeof value === 'number') {
    num = value;
  } else {
    const cleanStr = String(value).replace(/[^\d.-]/g, '');
    num = parseFloat(cleanStr);
  }

  if (isNaN(num)) return fallback;

  return num.toLocaleString('vi-VN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

/**
 * Bulletproof JSON parser that never throws
 */
export const safeJsonParse = <T>(jsonString: string | null | undefined, fallback: T): T => {
  if (!jsonString || typeof jsonString !== 'string') return fallback;
  try {
    return JSON.parse(jsonString);
  } catch {
    return fallback;
  }
};

/**
 * Bulletproof LocalStorage wrapper with QuotaExceeded fallback protection
 */
export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('[safeLocalStorage] Storage write failed or quota exceeded:', e);
      return false;
    }
  },
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
  getJSON<T>(key: string, fallback: T): T {
    try {
      const val = localStorage.getItem(key);
      return safeJsonParse<T>(val, fallback);
    } catch {
      return fallback;
    }
  },
  setJSON(key: string, value: any): boolean {
    try {
      const str = JSON.stringify(value);
      return this.setItem(key, str);
    } catch {
      return false;
    }
  }
};



