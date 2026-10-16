
import { Message } from '../types';

// Message render cache for performance
export const messageRenderCache = new Map<string, string>();

/**
 * Builds rich image HTML with loading state, actions overlay, etc.
 * Uses CSS classes for event delegation instead of inline onclick handlers.
 */
function buildImageHtml(alt: string, url: string, deletedGalleryImages: string[]): string {
    // Check if this image URL is actually a video or youtube link
    const isYoutube = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    const isVideo = url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i);
    const isFile = url.match(/\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)(\?.*)?$/i);

    if (isYoutube || isVideo || isFile) {
        return buildRichLinkHtml(url, alt);
    }

    if (deletedGalleryImages.includes(url)) {

        return `
        <div class="relative group/img my-8 w-full animate-in zoom-in-95 duration-700 flex flex-col items-center justify-center">
            <div class="relative overflow-hidden rounded-[32px] border border-slate-200 bg-slate-100 py-12 w-full flex flex-col items-center justify-center gap-3">
                <div class="p-3 bg-slate-200 text-slate-400 rounded-2xl">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                </div>
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Ảnh này đã bị xóa vĩnh viễn</span>
            </div>
        </div>`.replace(/\s+/g, ' ').trim();
    }

    // Encode URL for data attribute to handle special characters safely
    const encodedUrl = encodeURIComponent(url);

    const imgHtml = `
        <div class="ai-img-card relative group/img my-8 w-full animate-in zoom-in-95 duration-700 flex flex-col items-center justify-center" data-imgurl="${encodedUrl}">
            <div class="relative overflow-hidden rounded-[32px] border border-slate-200 dark:border-white/10 shadow-2xl shadow-blue-500/10 hover:shadow-blue-500/20 transition-all duration-700 w-full bg-slate-50 dark:bg-slate-900/50 min-h-[300px] flex items-center justify-center group-hover/img:border-brand group-hover/img:border-opacity-50 group-hover/img:scale-[1.01] group-hover/img:z-10 animate-pulse-slow">
                
                <!-- Loading State -->
                <div class="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 z-0 loading-placeholder transition-opacity duration-500">
                    <div class="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center mb-3">
                        <svg class="w-10 h-10 text-brand animate-spin" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4zm2 5.29a8 8 0 01-2-5.29H0c0 3.04 1.14 5.82 3 7.94l3-2.65z"></path>
                        </svg>
                    </div>
                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] animate-pulse">Generating Image...</span>
                </div>

                <img src="${url}" alt="${alt}" class="ai-img-preview relative z-10 block h-auto w-full max-h-[600px] object-contain cursor-zoom-in transition-all duration-1000 opacity-0 scale-95" 
                    onload="this.classList.remove('opacity-0', 'scale-95'); this.classList.add('opacity-100', 'scale-100'); var placeholder = this.parentElement.querySelector('.loading-placeholder'); if(placeholder) { placeholder.classList.add('opacity-0'); setTimeout(function() { if(placeholder && placeholder.parentNode) placeholder.remove(); }, 500); } this.parentElement.classList.remove('animate-pulse-slow');" 
                    loading="lazy" 
                    onerror="this.parentElement.innerHTML='<div class=&quot;p-8 text-center text-slate-400&quot;><svg class=&quot;w-12 h-12 mx-auto mb-2 opacity-20&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; viewBox=&quot;0 0 24 24&quot;><path d=&quot;M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z&quot; stroke-width=&quot;1.5&quot;></path></svg><span class=&quot;text-[10px] font-black uppercase tracking-widest&quot;>Image not found or Deleted</span></div>';" 
                />
                
                <!-- Toggle Button (handled via event delegation in MemoizedContent) -->
                <button class="ai-img-options-btn absolute top-4 right-4 z-40 p-2.5 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-all shadow-lg border border-white/10" title="Options">
                    <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/><circle cx="5" cy="12" r="1.5"/></svg>
                </button>
                
                <!-- Actions Overlay -->
                <div class="image-actions-overlay absolute inset-0 bg-black/40 opacity-0 transition-opacity duration-300 flex items-center justify-center gap-4 backdrop-blur-[2px] z-30 pointer-events-none">
                    <button class="ai-img-edit p-4 bg-brand rounded-2xl text-white hover:brightness-110 transition-all shadow-xl border border-white/20 flex items-center justify-center pointer-events-auto" title="Edit this Image">
                        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    </button>
                    <button class="ai-img-open p-4 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-white/30 transition-all shadow-xl border border-white/20 flex items-center justify-center pointer-events-auto" title="Open Original">
                        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                    </button>
                    <button class="ai-img-delete p-4 bg-red-500/80 backdrop-blur-md rounded-2xl text-white hover:bg-red-600 transition-all shadow-xl border border-white/20 flex items-center justify-center pointer-events-auto" title="Xóa vĩnh viễn">
                        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2M10 11v6M14 11v6"/></svg>
                    </button>
                    <a class="ai-img-download p-4 bg-white/20 backdrop-blur-md rounded-2xl text-white hover:bg-white/30 transition-all shadow-xl border border-white/20 flex items-center justify-center pointer-events-auto" href="${url}" target="_blank" download="${alt || 'ai-image'}.png" title="Download Image">
                        <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    </a>
                </div>
            </div>
            ${alt ? `<div class="mt-4 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-white/5">${alt}</div>` : ''}
        </div>
    `.replace(/\s+/g, ' ').trim();
    return imgHtml;
}

/**
 * Builds a rich link preview for YouTube, videos, images or files.
 */
function buildRichLinkHtml(url: string, label: string = ''): string {
    // Guard: If the URL is not a real http(s) URL (e.g. it's a placeholder), render as plain text
    if (!isValidUrl(url)) {
        return label
            ? `<strong class="font-bold text-slate-900 dark:text-white">${label}</strong>`
            : '';
    }
    const youtubeMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    const videoExt = url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i);
    const imgExt = url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i);
    const fileExt = url.match(/\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)(\?.*)?$/i);
    const socialMatch = url.match(/(facebook\.com|instagram\.com|tiktok\.com|linkedin\.com|twitter\.com|x\.com)/i);

    if (youtubeMatch) {
        const vidId = youtubeMatch[1];
        const thumb = `https://img.youtube.com/vi/${vidId}/maxresdefault.jpg`;
        const thumbFallback = `https://img.youtube.com/vi/${vidId}/hqdefault.jpg`;
        const thumbFallback2 = `https://img.youtube.com/vi/${vidId}/mqdefault.jpg`;

        return `
            <div class="my-6 rounded-[32px] overflow-hidden border border-slate-200 dark:border-white/10 no-underline relative bg-white dark:bg-slate-900 shadow-2xl hover:shadow-brand/20 transition-all duration-500 hover:scale-[1.01] group/yt">
                <a href="${url}" target="_blank" class="block relative w-full">
                    <div style="padding-top: 56.25%;"></div>
                    <img src="${thumb}" class="absolute top-0 left-0 w-full h-full object-cover" onerror="this.src='${thumbFallback}'; this.onerror=function(){this.src='${thumbFallback2}'}" />
                    <div class="absolute top-0 left-0 w-full h-full bg-black/20 flex items-center justify-center">
                        <div class="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center text-white shadow-2xl border-4 border-white group-hover/yt:scale-110 group-hover/yt:bg-red-500 transition-all duration-300">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        </div>
                    </div>
                </a>
                <div class="p-5 flex justify-between items-center bg-white dark:bg-slate-900 border-t border-slate-50 dark:border-white/5">
                    <div class="flex-1 min-w-0">
                        <div class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Xem video trên YouTube</div>
                        <div class="text-[15px] font-bold text-slate-900 dark:text-white truncate">${label || 'Bấm để phát ngay'}</div>
                    </div>
                    <div class="ml-4 p-2.5 rounded-full bg-slate-50 dark:bg-white/5 text-slate-300 dark:text-slate-600 group-hover/yt:text-brand transition-colors">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                    </div>
                </div>
            </div>
        `.replace(/\s+/g, ' ').trim();
    }

    if (videoExt) {
        return `
            <div class="my-6 rounded-[32px] overflow-hidden border border-slate-200 dark:border-white/10 shadow-2xl bg-black relative group/vid">
                <video controls playsinline preload="metadata" class="w-full block max-h-[500px]">
                    <source src="${url}" type="video/${videoExt[1].toLowerCase() === 'mov' ? 'mp4' : videoExt[1].toLowerCase()}">
                    Your browser does not support the video tag.
                </video>
            </div>
        `.replace(/\s+/g, ' ').trim();
    }

    if (imgExt) {
        // Use the existing rich image builder for image URLs too
        return buildImageHtml(label || 'Image Gallery', url, []);
    }

    if (fileExt) {
        const ext = fileExt[1].toUpperCase();
        const name = label || url.split('/').pop() || 'Untitled Document';

        // Fix for long filenames causing wrap issues: truncate if too long
        const displayName = name.length > 60 ? name.substring(0, 57) + '...' : name;

        // Compact Citation Check: If label is a number or contains "trang" and is short, render as inline badge
        const cleanLabel = (label || '').trim().replace(/[\[\]]/g, '');
        const isCitation = cleanLabel.match(/^\d+$/) ||
            cleanLabel.toLowerCase().includes('trang') ||
            cleanLabel.toLowerCase().includes('page');

        if (isCitation && cleanLabel.length < 15) {
            const displayLabel = cleanLabel.toLowerCase().includes('trang') || cleanLabel.toLowerCase().includes('page')
                ? cleanLabel : `Trang ${cleanLabel}`;
            return `<a href="${url}" target="_blank" class="mf-citation-text hover:bg-brand hover:text-white hover:border-brand transition-all duration-200" title="Xem tài liệu gốc">${displayLabel}</a>`;
        }

        return `
            <a href="${url}" target="_blank" class="flex items-center gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-[24px] no-underline my-6 transition-all duration-300 hover:scale-[1.01] hover:border-brand/40 shadow-xl group/file w-full max-w-full overflow-hidden">
                <div class="bg-slate-100 dark:bg-white/5 w-14 h-14 rounded-2xl flex items-center justify-center text-slate-400 dark:text-slate-500 flex-shrink-0 group-hover/file:bg-brand/10 group-hover/file:text-brand transition-colors duration-300">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-[14px] font-bold text-slate-800 dark:text-white truncate mb-1">${displayName}</div>
                    <div class="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <span class="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 font-mono">${ext}</span>
                        <span class="truncate">Bấm để xem tài liệu</span>
                    </div>
                </div>
                <div class="p-2.5 rounded-full bg-slate-50 dark:bg-white/5 text-slate-300 dark:text-slate-600 group-hover/file:text-brand transition-colors flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
            </a>
        `.replace(/\s+/g, ' ').trim();
    }

    if (socialMatch) {
        const platform = socialMatch[1].toLowerCase().split('.')[0];
        const iconColor = platform === 'facebook' ? 'text-blue-600' : platform === 'instagram' ? 'text-pink-600' : platform === 'tiktok' ? 'text-black dark:text-white' : platform === 'linkedin' ? 'text-blue-700' : 'text-slate-900 dark:text-white';

        let iconPath = `<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>`; // FB default
        if (platform === 'instagram') iconPath = `<rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>`;
        else if (platform === 'linkedin') iconPath = `<path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>`;
        else if (platform === 'tiktok' || platform === 'twitter' || platform === 'x') iconPath = `<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>`; // TikTok-ish

        return `
            <a href="${url}" target="_blank" class="flex items-center gap-4 p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl no-underline my-4 transition-all hover:bg-slate-100 dark:hover:bg-white/10 group/social">
                <div class="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center shadow-sm ${iconColor}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${iconPath}</svg>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate capitalize">${platform} Profile</div>
                    <div class="text-[10px] text-slate-400 dark:text-slate-500 truncate">${url}</div>
                </div>
                <div class="text-slate-300 group-hover/social:text-brand transition-colors">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
            </a>
        `.replace(/\s+/g, ' ').trim();
    }

    // Default standard link
    return `<a href="${url}" target="_blank" class="text-brand font-bold hover:underline underline-offset-4 decoration-2">${label || url}</a>`;
}

/**
 * Checks if a URL is a real, valid HTTP(S) URL.
 * Rejects placeholder strings that look like: URL_của_tài_liệu, #, javascript:, etc.
 */
function isValidUrl(url: string): boolean {
    if (!url) return false;
    const trimmed = url.trim();
    // Must start with http:// or https://
    if (!/^https?:\/\//i.test(trimmed)) return false;
    // Must not contain spaces (placeholder text often has spaces encoded or unencoded)
    if (/\s/.test(trimmed)) return false;
    // Must have at least a dot in the hostname
    try {
        const parsed = new URL(trimmed);
        return parsed.hostname.includes('.') && parsed.hostname.length > 3;
    } catch {
        return false;
    }
}

/**
 * Renders markdown content with support for code blocks, syntax highlighting, 
 * and custom image handling.
 * 
 * @param text The raw markdown text
 * @param messageId Optional ID for caching
 * @param deletedGalleryImages List of deleted image URLs to check against
 * @returns HTML string
 */
export const renderMarkdown = (
    text: string,
    messageId?: string,
    deletedGalleryImages: string[] = []
): string => {
    if (!text) return "";

    // Check cache first - HUGE performance gain
    if (messageId) {
        const cacheKey = `${messageId}_${text.length}_${text.substring(0, 20)}_${text.substring(text.length - 20)}`;
        const cached = messageRenderCache.get(cacheKey);
        if (cached) return cached;
    }

    let html = text.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m] || m));

    // 0. PROTECT FULLY CLOSED MARKDOWN LINKS AND IMAGES FROM MANGLE (Underscores/Stars in URLs)
    const imageBlocks: { alt: string, url: string }[] = [];
    const linkBlocks: { label: string, url: string }[] = [];

    // Protocol: Only convert FULLY CLOSED links/images into placeholders.
    // This prevents placeholders from being created for partial, streaming links (like "[text](url")
    // which would otherwise mangle the UI until the closing ")" arrives.

    // 0.1 Handle all fully closed Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, url) => {
        imageBlocks.push({ alt, url });
        return `[[IMGBLK-${imageBlocks.length - 1}]]`;
    });

    // 0.2 Handle all fully closed Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
        linkBlocks.push({ label, url });
        return `[[LNKBLK-${linkBlocks.length - 1}]]`;
    });

    // 1. PROCESS CODE BLOCKS FIRST (Before line processing or inline rules)
    // This prevents inline code (single backticks) from matching parts of the triple backtick blocks
    const codeBlocks: string[] = [];
    html = html.replace(/```(\w*)\n?([\s\S]*?)(?:```|$)/g, (match, lang, code) => {
        const language = lang || 'text';
        const cleanCode = code.trim();
        // Escape content for HTML attribute
        const safeContent = cleanCode.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
        const isUnclosed = !match.endsWith('```');
        const uniqueId = 'code-' + Math.random().toString(36).substr(2, 9);

        const blockHtml = `
            <div class="relative group/code my-6 rounded-2xl overflow-hidden bg-[#0F1117] border border-slate-800 shadow-2xl transition-all hover:border-brand hover:border-opacity-30 duration-300">
                <div class="flex items-center justify-between px-4 py-2.5 bg-[#161B22] border-b border-white/5">
                    <div class="flex items-center gap-2">
                        <div class="flex gap-1.5">
                            <div class="w-2.5 h-2.5 rounded-full bg-[#ff5f56]/80 shadow-inner"></div>
                            <div class="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]/80 shadow-inner"></div>
                            <div class="w-2.5 h-2.5 rounded-full bg-[#27c93f]/80 shadow-inner"></div>
                        </div>
                        <div class="h-4 w-px bg-white/10 mx-1"></div>
                        <span class="text-[10px] font-black font-mono text-slate-500 uppercase tracking-widest select-none">${language}</span>
                    </div>
                    <div class="flex items-center gap-1.5">
                        ${(language === 'html' || language === 'htm') ? `
                        <button onclick="window.__previewHtmlFromId('${uniqueId}')" class="p-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-all" title="Preview HTML Render">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        </button>` : ''}
                        <button onclick="window.__previewCodeFromId('${uniqueId}', '${language}')" class="p-1.5 text-slate-400 hover:text-brand hover:bg-white/5 rounded-lg transition-all" title="Maximize to Workspace">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                        </button>
                        <button onclick="window.__copyCodeFromId('${uniqueId}')" class="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-all" title="Copy Code">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2-2v1"></path></svg>
                        </button>
                    </div>
                </div>
                <div class="overflow-x-auto p-0 custom-scrollbar-dark bg-[#0D1117]">
                    <pre class="m-0 p-5 leading-relaxed"><code id="${uniqueId}" class="language-${language} font-mono text-[13px] text-[#E6EDF3]">${cleanCode}</code></pre>
                </div>
                ${isUnclosed ? '<div class="absolute bottom-0 inset-x-0 h-1 bg-brand bg-opacity-40 animate-pulse"></div>' : ''}
            </div>`;

        codeBlocks.push(blockHtml);
        return `[[CODEBLK-${codeBlocks.length - 1}]]`;
    });

    let inList = false;
    let listType: 'ul' | 'ol' | null = null;
    let listStack: ('ul' | 'ol')[] = [];
    const lines = html.split('\n');

    const processedLines = lines.map((line, index) => {
        let trimmed = line.trim();
        if (!trimmed) {
            return "";
        }

        // Blockquotes
        if (trimmed.startsWith('> ')) {
            return `<blockquote class="border-l-4 border-brand/30 bg-brand/5 px-4 py-2 my-4 rounded-r-xl italic opacity-90">${trimmed.substring(2)}</blockquote>`;
        }

        // Headers & HR
        if (trimmed.startsWith('### ')) return `<h3 class="text-base font-bold mt-8 mb-3 flex items-center gap-2">` +
            `<span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>${trimmed.substring(4)}</h3>`;
        if (trimmed.startsWith('## ')) return `<h2 class="text-xl font-bold mt-10 mb-4 border-b border-white/10 pb-3">${trimmed.substring(3)}</h2>`;
        if (trimmed.startsWith('# ')) return `<h1 class="text-3xl font-bold mt-12 mb-6">${trimmed.substring(2)}</h1>`;
        if (trimmed === '---' || trimmed === '***') return '<hr class="border-white/10 my-8" />';

        // Lists with Nesting Support (simple)
        const isUnordered = /^[\s\t]*[*+-]\s/.test(line);
        const isOrdered = /^[\s\t]*\d+\.\s/.test(line);

        if (isUnordered || isOrdered) {
            let res = "";
            const currentType = isUnordered ? 'ul' : 'ol';
            const indent = line.search(/\S/);

            // Logic for nesting
            if (!inList) {
                res += `<${currentType} class="my-4 space-y-2 list-outside">`;
                inList = true;
                listType = currentType;
                listStack.push(currentType);
            } else if (listType !== currentType) {
                // If the type changes, we check if it's an indentation or a flip
                if (indent > 0) {
                    // Nesting
                    res += `<${currentType} class="ml-4 my-2 space-y-1.5 list-outside">`;
                    listStack.push(currentType);
                    listType = currentType;
                } else {
                    // Flip same level
                    while (listStack.length > 0) res += `</${listStack.pop()}>`;
                    res += `<${currentType} class="my-4 space-y-2 list-outside">`;
                    listStack.push(currentType);
                    listType = currentType;
                }
            }

            const content = trimmed.replace(/^[*+-]\s|^\d+\.\s/, '');
            res += `<li class="${currentType === 'ul' ? 'list-disc' : 'list-decimal'} ml-6 pl-1 marker:text-slate-400">${content}</li>`;
            return res;
        } else if (inList) {
            inList = false;
            let res = "";
            while (listStack.length > 0) {
                res += `</${listStack.pop()}>`;
            }
            listType = null;
            return res + `\n${line}`;
        }

        if (trimmed.startsWith('|')) {
            // Simple Table Support
            const cells = trimmed.split('|').filter(c => c.trim().length > 0);
            if (trimmed.includes('---')) return ""; // Skip separator line
            const isHeader = index === 0 || lines[index - 1]?.includes('---');
            const cellTag = isHeader ? 'th' : 'td';
            return `<tr class="hover:bg-white/5 transition-colors">${cells.map(c => `<${cellTag} class="px-4 py-3 border-b border-white/5 ${isHeader ? 'font-bold text-slate-900 dark:text-white bg-slate-50/50 dark:bg-white/5' : ''}">${c.trim()}</${cellTag}>`).join('')}</tr>`;
        }

        // Block placeholders — never wrap in <p>
        if (/^\[\[(?:CODEBLK|IMGBLK)-\d+\]\]$/.test(trimmed)) {
            return trimmed;
        }

        // LNKBLK helper — is this link URL a rich card type?
        const isRichLnkBlk = (blkIdx: number): boolean => {
            const link = linkBlocks[blkIdx];
            if (!link) return false;
            return !!(
                link.url.match(/\.(mp4|webm|ogg|mov|jpg|jpeg|png|gif|webp|bmp|svg|pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)(\?.*)?$/i) ||
                link.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i) ||
                link.url.match(/(facebook\.com|instagram\.com|tiktok\.com|linkedin\.com|twitter\.com|x\.com)/i)
            );
        };

        // Standalone LNKBLK on its own line
        if (/^\[\[LNKBLK-\d+\]\]$/.test(trimmed)) {
            const idxMatch = trimmed.match(/\d+/);
            const blkIdx = idxMatch ? parseInt(idxMatch[0]) : -1;
            if (isRichLnkBlk(blkIdx)) return trimmed; // rich card → block, no <p>
            return `<p class="mb-4 leading-relaxed last:mb-0">${trimmed}</p>`;
        }

        // INLINE rich LNKBLK embedded in a text line (e.g. "...tài liệu này. [[LNKBLK-0]]")
        // If we leave it wrapped in <p>, the restored block-level <a> will be invalid HTML.
        // Fix: split the line into text-before <p> + block card + text-after <p>
        if (/\[\[LNKBLK-\d+\]\]/.test(trimmed)) {
            // Check if any of the embedded LNKBLKs is a rich card
            const hasRich = [...trimmed.matchAll(/\[\[LNKBLK-(\d+)\]\]/g)].some(m => isRichLnkBlk(parseInt(m[1])));
            if (hasRich) {
                // Split on every LNKBLK token, preserving both text segments and placeholders
                const parts = trimmed.split(/(\[\[LNKBLK-\d+\]\])/);
                return parts.map(part => {
                    const lnkMatch = part.match(/^\[\[LNKBLK-(\d+)\]\]$/);
                    if (lnkMatch) {
                        const blkIdx = parseInt(lnkMatch[1]);
                        return isRichLnkBlk(blkIdx)
                            ? part // rich → block, no p-wrap
                            : `<p class="mb-4 leading-relaxed last:mb-0">${part}</p>`;
                    }
                    const t = part.trim();
                    return t ? `<p class="mb-4 leading-relaxed last:mb-0">${t}</p>` : '';
                }).join('\n');
            }
        }

        return `<p class="mb-4 leading-relaxed last:mb-0">${line}</p>`;
    }).filter(line => line.trim() !== '<p class="mb-4 leading-relaxed last:mb-0"></p>');

    if (inList) {
        while (listStack.length > 0) {
            processedLines.push(`</${listStack.pop()}>`)
        }
    }

    // Final assembly with table wrapping and whitespace filtering
    html = processedLines.filter(l => l.trim().length > 0).join('\n');

    // Convert escaped <br> tags (common in AI-generated tables) back to real line breaks
    html = html.replace(/&lt;br\s*\/?&gt;/gi, '<br />');

    // Wrap consecutive <tr> tags in <table>, handling whitespace/newlines between them
    html = html.replace(/(<tr[\s\S]*?<\/tr>(\s*\n\s*)*)+/g, match => {
        // Remove the extra newlines between <tr> tags that we might have caught
        const cleanRows = match.replace(/<\/tr>(\s*\n\s*)*<tr/g, '</tr><tr');
        return `<div class="overflow-x-auto my-6 rounded-xl border border-white/10 shadow-sm"><table class="w-full text-left border-collapse">${cleanRows}</table></div>`;
    });

    // Inline formatting
    html = html
        // Inline images (ones that weren't on their own line and thus weren't extracted as placeholders)
        .replace(/!\[([^\]]*)\]\s*\(([^)]+)\)/g, (_match, alt, url) => {
            return buildImageHtml(alt, url, deletedGalleryImages);
        })
        .replace(/\*\*\*(.*?)\*\*\*/g, '<strong class="font-bold italic text-slate-900 dark:text-white">$1</strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-slate-900 dark:text-white">$1</strong>')
        // Single asterisk italic - must come AFTER bold to avoid conflict
        .replace(/\*([^*\n]+)\*/g, '<em class="italic opacity-90">$1</em>')
        .replace(/_([^_\n]+)_/g, '<em class="italic opacity-90">$1</em>')
        .replace(/`([^`]+)`/g, '<code class="bg-brand/10 text-brand px-1.5 py-0.5 rounded-lg text-[13px] font-mono border border-brand/20">$1</code>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, url) => {
            return buildRichLinkHtml(url, label);
        })
        // Plain URL & Domain autolinker - identifying http/https/www links and domains not already in a markdown link or HTML attribute
        .replace(/((?:^|[^\w"'>]))((?:https?:\/\/|www\.)[^\s<)\]]+|[a-zA-Z0-9][-a-zA-Z0-9]*\.(?:com|vn|edu\.vn|gov\.vn|net|org|io|co|info|biz|me|cc|xyz|app|dev|store|site|online|tech|club|shop|top|vip|pro|ai|cloud|space|fun|live|link|work|agency|digital|design|asia|tv|mobi)(?::[0-9]+)?(?:\/[^\s<)\]]*)?)/gi, (match, prefix, rawUrl) => {
            let urlPart = rawUrl;
            let trailing = "";
            const punct = ".,;:?!";
            while (urlPart.length > 0 && punct.indexOf(urlPart[urlPart.length - 1]) !== -1) {
                trailing = urlPart[urlPart.length - 1] + trailing;
                urlPart = urlPart.slice(0, -1);
            }
            const linkHref = urlPart.startsWith('http') ? urlPart : `https://${urlPart}`;

            // Check if it's a rich media link
            const isRich = linkHref.match(/\.(mp4|webm|ogg|mov|jpg|jpeg|png|gif|webp|bmp|svg|pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)(\?.*)?$/i) ||
                linkHref.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i) ||
                linkHref.match(/(facebook\.com|instagram\.com|tiktok\.com|linkedin\.com|twitter\.com|x\.com)/i);


            if (isRich) {
                return `${prefix}${buildRichLinkHtml(linkHref)}`;
            }

            return `${prefix}<a href="${linkHref}" target="_blank" class="text-brand font-bold hover:underline underline-offset-4 decoration-2">${urlPart}</a>${trailing}`;
        })
        .replace(/\n\n+/g, '\n\n');

    // 2. RESTORE IMAGE BLOCKS (Swapping placeholders back to rich image HTML)
    imageBlocks.forEach((imgData, i) => {
        html = html.replace(`[[IMGBLK-${i}]]`, buildImageHtml(imgData.alt, imgData.url, deletedGalleryImages));
    });

    // 3. RESTORE CODE BLOCKS (Swapping placeholders back to HTML)
    codeBlocks.forEach((block, i) => {
        html = html.replace(`[[CODEBLK-${i}]]`, block);
    });

    // 4. RESTORE LINK BLOCKS
    linkBlocks.forEach((linkData, i) => {
        html = html.replace(`[[LNKBLK-${i}]]`, buildRichLinkHtml(linkData.url, linkData.label));
    });

    // Cache the result for future renders
    if (messageId) {
        const cacheKey = `${messageId}_${text.length}_${text.substring(0, 20)}_${text.substring(text.length - 20)}`;
        messageRenderCache.set(cacheKey, html);
        // Limit cache size to prevent memory leaks
        if (messageRenderCache.size > 500) {
            const firstKey = messageRenderCache.keys().next().value;
            messageRenderCache.delete(firstKey);
        }
    }

    return html;
};
