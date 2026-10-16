/**
 * Universal safe clipboard copier for MYERP
 * Works reliably across HTTPS, HTTP localhost/LAN, iframe, and legacy mobile browsers.
 * Returns true if text was successfully copied into the user's system clipboard.
 */
export async function copyTextSafely(text: string): Promise<boolean> {
  const clean = (text || '').trim();
  if (!clean) return false;

  // 1. Try modern Async Clipboard API in secure contexts (HTTPS / localhost)
  if (typeof window !== 'undefined' && window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(clean);
      return true;
    } catch (err) {
      // Permission denied or DOM not focused, fallback to legacy
    }
  }

  // 2. Resilient fallback using offscreen textarea and document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = clean;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      textArea.style.pointerEvents = 'none';

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, clean.length);

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (err) {
      return false;
    }
  }

  return false;
}
