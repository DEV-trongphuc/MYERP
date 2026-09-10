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
 * Download a file. If it's a WebP image, automatically convert to JPG and download as .jpg.
 * Otherwise, download directly with original format.
 */
export async function downloadFileWithWebpToJpg(url: string, originalFileName: string): Promise<void> {
  if (!url) return;

  const isWebp = isWebpFile(originalFileName) || isWebpFile(url);

  // If not WebP, perform direct standard download
  if (!isWebp) {
    const a = document.createElement('a');
    a.href = url;
    a.download = originalFileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  // File is WebP -> Target JPG
  const jpgFileName = originalFileName.replace(/\.webp$/i, '.jpg');

  try {
    const jpgBlob = await convertUrlToJpgBlob(url, 0.92);
    const downloadUrl = URL.createObjectURL(jpgBlob);

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = jpgFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    setTimeout(() => {
      URL.revokeObjectURL(downloadUrl);
    }, 10000);
  } catch (err) {
    console.error('Lỗi khi chuyển đổi WebP sang JPG:', err);
    // Fallback: download with .jpg extension or direct
    const a = document.createElement('a');
    a.href = url;
    a.download = jpgFileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
