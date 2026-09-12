/**
 * src/utils/fileDownloader.ts
 * Utility to download files with automatic WebP -> JPG format conversion.
 */

/**
 * Check if a file name or URL is a WebP image
 */
export function isWebpFile(fileNameOrUrl: string): boolean {
  if (!fileNameOrUrl) return false;
  const clean = fileNameOrUrl.split('?')[0].toLowerCase();
  return clean.endsWith('.webp') || clean.includes('.webp');
}

/**
 * Convert a WebP Blob to a high-quality JPG Blob using HTML5 Canvas
 */
export async function convertWebpBlobToJpgBlob(blob: Blob, quality = 0.92): Promise<Blob> {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(new Error('Image failed to load for canvas conversion: ' + e));
      img.src = objectUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context');

    // Fill with solid white background to avoid transparent WebP turning black in JPEG
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const jpgBlob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
    });

    if (!jpgBlob) throw new Error('Canvas toBlob failed');
    return jpgBlob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Convert an image URL to a JPG Blob using Image element + Canvas
 */
async function convertUrlToJpgBlob(url: string, quality = 0.92): Promise<Blob> {
  // Normalize local dev proxy if needed
  let fetchUrl = url;
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    if (url.includes('myerp.ideas.edu.vn/backend/')) {
      fetchUrl = url.replace(/https?:\/\/myerp\.ideas\.edu\.vn\/backend\//, '/backend/');
    }
  }

  // Attempt fetch first to get clean blob
  try {
    const response = await fetch(fetchUrl, { mode: 'cors' });
    if (response.ok) {
      const blob = await response.blob();
      return await convertWebpBlobToJpgBlob(blob, quality);
    }
  } catch (fetchErr) {
    console.warn('Fetch failed for image, falling back to direct Image loader:', fetchErr);
  }

  // Fallback: direct Image element loading
  const img = new Image();
  img.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = (e) => reject(e);
    img.src = fetchUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const jpgBlob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });

  if (!jpgBlob) throw new Error('Canvas conversion to JPG failed');
  return jpgBlob;
}

/**
 * Resolve relative or proxy URLs to absolute fetchable URLs
 */
function resolveFetchableUrl(url: string): string {
  let resolvedUrl = url;
  if (!resolvedUrl.startsWith('http://') && !resolvedUrl.startsWith('https://') && !resolvedUrl.startsWith('blob:')) {
    const apiBase = (import.meta.env.VITE_API_URL || '/backend').replace(/\/$/, '');
    const cleanPath = resolvedUrl.replace(/^\/?(backend\/)?/, '');
    resolvedUrl = `${apiBase}/${cleanPath}`;
  }

  // Normalize localhost dev proxy if needed
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    if (resolvedUrl.includes('myerp.ideas.edu.vn/backend/')) {
      resolvedUrl = resolvedUrl.replace(/https?:\/\/myerp\.ideas\.edu\.vn\/backend\//, '/backend/');
    }
  }
  return resolvedUrl;
}

/**
 * Robustly download any file preserving the exact original file name.
 * 1. Primary approach: fetch as Blob -> URL.createObjectURL -> a.download = originalFileName.
 *    Because Blob URLs originate from the current client domain, browsers strictly honor the download attribute!
 * 2. Fallback approach: server endpoint /api.php?action=download-file which sends RFC 5987/6266 Content-Disposition attachment headers.
 */
export async function downloadFileWithName(url: string, originalFileName: string): Promise<void> {
  if (!url) return;

  // Clean filename: remove file size suffix in parentheses like "(2.4 MB)" if captured by DOM parser
  let cleanName = (originalFileName || '').trim();
  cleanName = cleanName.replace(/\s*\(\s*[\d.]+\s*(?:KB|MB|GB|Bytes|B|b)\s*\)$/i, '').trim();

  // If filename is empty, extract from URL
  if (!cleanName) {
    cleanName = url.split('/').pop()?.split('?')[0] || 'tai-ve';
  }

  // Ensure file extension exists if URL has one
  const urlExt = url.split('?')[0].match(/\.([a-zA-Z0-9]+)$/)?.[1];
  const nameExt = cleanName.match(/\.([a-zA-Z0-9]+)$/)?.[1];
  if (!nameExt && urlExt) {
    cleanName = `${cleanName}.${urlExt}`;
  }

  // If it's a WebP image, convert to JPG
  if (isWebpFile(cleanName) || isWebpFile(url)) {
    return downloadFileWithWebpToJpg(url, cleanName);
  }

  const fetchUrl = resolveFetchableUrl(url);

  // Approach 1: Client-side Blob download (Guarantees client-assigned filename across all modern browsers)
  try {
    const res = await fetch(fetchUrl, { mode: 'cors' });
    if (res.ok) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = blobUrl;
      a.download = cleanName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
      return;
    }
  } catch (err) {
    console.warn('Blob fetch failed, falling back to server download-file endpoint:', err);
  }

  // Approach 2: Server-side attachment endpoint with Content-Disposition header
  const backendBase = (import.meta.env.VITE_API_URL || '/backend').replace(/\/$/, '');
  const downloadEndpoint = `${backendBase}/api.php?action=download-file&url=${encodeURIComponent(url)}&name=${encodeURIComponent(cleanName)}`;

  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = downloadEndpoint;
  a.download = cleanName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Download a file. If it's a WebP image, automatically convert to JPG and download as .jpg.
 * Otherwise, download directly with original format and preserved filename.
 */
export async function downloadFileWithWebpToJpg(url: string, originalFileName: string): Promise<void> {
  if (!url) return;

  const isWebp = isWebpFile(originalFileName) || isWebpFile(url);

  // If not WebP, delegate to downloadFileWithName to ensure original filename is always preserved
  if (!isWebp) {
    return downloadFileWithName(url, originalFileName);
  }

  // File is WebP -> Target JPG
  const jpgFileName = originalFileName.replace(/\.webp$/i, '.jpg');

  try {
    const jpgBlob = await convertUrlToJpgBlob(url, 0.92);
    const downloadUrl = URL.createObjectURL(jpgBlob);

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;
    a.download = jpgFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 15000);
  } catch (err) {
    console.error('Lỗi khi chuyển đổi WebP sang JPG:', err);
    // Fallback: download with .jpg extension or direct via downloadFileWithName
    return downloadFileWithName(url, jpgFileName);
  }
}

/**
 * Global click interceptor for comment attachment chips.
 * Ensures that clicking on any attachment chip in comments (both newly created and existing in database)
 * automatically downloads the file using its exact displayed name instead of the server's hashed filename.
 */
export function initAttachmentDownloadInterceptor(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__attachmentDownloadInterceptorInit) return;
  (window as any).__attachmentDownloadInterceptorInit = true;

  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Check if clicked element or parent is a comment attachment chip or has download file attribute
    const chip = target.closest<HTMLElement>('.comment-attachment-chip, a[data-file-url], a[data-file-name]');
    if (!chip) return;

    // Ignore if clicked on a delete/remove button inside the chip
    if (target.closest('button, .remove-chip, .btn-remove, [data-remove-attachment]')) return;

    const fileUrl = chip.getAttribute('data-file-url') || chip.getAttribute('href');
    if (!fileUrl || fileUrl === '#' || fileUrl.startsWith('javascript:')) return;

    // Prevent default browser navigation / random filename download
    e.preventDefault();
    e.stopPropagation();

    // Determine filename
    let fileName = chip.getAttribute('data-file-name') || chip.getAttribute('download') || '';
    if (!fileName || fileName === 'true') {
      // Extract from spans inside the chip (avoid icon or size in parens)
      const spans = Array.from(chip.querySelectorAll('span'));
      for (const span of spans) {
        const text = span.textContent?.trim() || '';
        if (text && !text.startsWith('(') && text.length > 2) {
          fileName = text;
          break;
        }
      }
    }

    if (!fileName) {
      const fullText = chip.textContent || '';
      fileName = fullText.replace(/\s*\(\s*[\d.]+\s*(?:KB|MB|GB|Bytes|B|b)\s*\)/i, '').trim();
    }

    downloadFileWithName(fileUrl, fileName);
  }, true); // Use capture phase so it runs before any default browser navigation!
}
