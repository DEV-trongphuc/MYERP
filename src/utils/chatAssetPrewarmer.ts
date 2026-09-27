// Asset pre-warming utility for WorkChat
// Preloads stickers and frequently accessed avatars into browser image cache
// to eliminate visual blank flashes (0ms instantaneous image display)

const IDEAS_STICKER_COUNT = 16;
let hasPrewarmedStickers = false;
const prewarmedAvatars = new Set<string>();

/**
 * Pre-warm all Mascot stickers in background using idle callback or setTimeout
 */
export const prewarmChatStickers = (): void => {
  if (typeof window === 'undefined' || hasPrewarmedStickers) return;
  hasPrewarmedStickers = true;

  const runPrewarm = () => {
    for (let i = 1; i <= IDEAS_STICKER_COUNT; i++) {
      const img = new Image();
      img.src = `/stickers/ideas/ideas_${i}.webp`;
      if ('decode' in img) {
        img.decode().catch(() => {});
      }
    }
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(runPrewarm, { timeout: 2000 });
  } else {
    setTimeout(runPrewarm, 600);
  }
};

/**
 * Pre-warm a list of avatar URLs (e.g. recent conversation members)
 */
export const prewarmAvatars = (avatarUrls: (string | undefined | null)[]): void => {
  if (typeof window === 'undefined') return;

  const validUrls = avatarUrls.filter(
    (url): url is string => typeof url === 'string' && url.length > 5 && !prewarmedAvatars.has(url)
  );

  if (validUrls.length === 0) return;

  const runPrewarm = () => {
    // Only pre-warm up to 25 avatars per batch to preserve network bandwidth
    for (const url of validUrls.slice(0, 25)) {
      prewarmedAvatars.add(url);
      const img = new Image();
      img.src = url;
      if ('decode' in img) {
        img.decode().catch(() => {});
      }
    }
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(runPrewarm, { timeout: 3000 });
  } else {
    setTimeout(runPrewarm, 800);
  }
};
