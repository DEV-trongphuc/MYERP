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
