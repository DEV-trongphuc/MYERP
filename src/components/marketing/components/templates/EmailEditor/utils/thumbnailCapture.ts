import { EmailBlock, EmailBodyStyle } from '../../../../types';
import { API_BASE_URL } from '../../../../utils/config';

const THUMB_WIDTH = 600;
const THUMB_HEIGHT = 375; // 16:10 aspect ratio matching TemplateCard
const SCALE = 1.5; // 900x562 crisp WebP output

const resolveImageUrl = (rawUrl?: string): string => {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    if (!trimmed || trimmed.startsWith('data:')) return trimmed;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    if (trimmed.startsWith('/')) {
        return `${window.location.origin}${trimmed}`;
    }
    return `${window.location.origin}/${trimmed.replace(/^\/+/, '')}`;
};

const loadImageSafe = (url: string, timeoutMs = 1500): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
        if (!url) {
            resolve(null);
            return;
        }
        const resolved = resolveImageUrl(url);
        let settled = false;
        const finish = (img: HTMLImageElement | null) => {
            if (!settled) {
                settled = true;
                resolve(img);
            }
        };

        const timer = setTimeout(() => finish(null), timeoutMs);

        const tryProxy = () => {
            if (resolved.startsWith('data:') || resolved.includes('proxy_img=')) {
                clearTimeout(timer);
                finish(null);
                return;
            }
            const proxyImg = new Image();
            proxyImg.crossOrigin = 'anonymous';
            proxyImg.onload = () => {
                clearTimeout(timer);
                finish(proxyImg);
            };
            proxyImg.onerror = () => {
                clearTimeout(timer);
                finish(null);
            };
            const base = (API_BASE_URL || '/api/automation').replace(/\/+$/, '');
            proxyImg.src = `${base}/templates?proxy_img=${encodeURIComponent(resolved)}`;
        };

        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            clearTimeout(timer);
            finish(img);
        };
        img.onerror = () => {
            tryProxy();
        };
        img.src = resolved;
    });
};

const stripTags = (html: string): string => {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<\/li>/gi, '\n');
    return (tmp.textContent || tmp.innerText || '').replace(/[ \t]+/g, ' ').trim();
};

const parsePx = (val: any, fallback: number): number => {
    if (typeof val === 'number' && !isNaN(val)) return val;
    if (typeof val === 'string') {
        const m = val.match(/-?\d+(\.\d+)?/);
        if (m) return parseFloat(m[0]);
    }
    return fallback;
};

const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) => {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
};

const wrapCanvasText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    maxLines = 6
): string[] => {
    const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(Boolean);
    const lines: string[] = [];

    for (const para of paragraphs) {
        const words = para.split(/\s+/);
        let current = '';
        for (const word of words) {
            const candidate = current ? `${current} ${word}` : word;
            if (ctx.measureText(candidate).width <= maxWidth) {
                current = candidate;
            } else {
                if (current) {
                    lines.push(current);
                    if (lines.length >= maxLines) return lines;
                }
                current = word;
            }
        }
        if (current) {
            lines.push(current);
            if (lines.length >= maxLines) return lines;
        }
    }
    return lines;
};

/**
 * Captures the top portion (600x375, 16:10 aspect ratio) of an Email Template
 * and returns a base64 WebP data URL (`data:image/webp;base64,...`).
 */
export async function captureEmailTopWebp(
    htmlContent: string,
    blocks?: EmailBlock[],
    bodyStyle?: EmailBodyStyle,
    templateName?: string
): Promise<string> {
    if (typeof document === 'undefined') return '';

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(THUMB_WIDTH * SCALE);
    canvas.height = Math.round(THUMB_HEIGHT * SCALE);
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.scale(SCALE, SCALE);

    const outerBg = bodyStyle?.backgroundColor || '#f1f5f9';
    const cardBg = bodyStyle?.contentBackgroundColor || '#ffffff';
    const fontFamily = (bodyStyle?.fontFamily || 'Inter, system-ui, -apple-system, sans-serif').replace(/['"]/g, '');
    const anyBody = (bodyStyle || {}) as any;

    // 1. Paint outer email background
    ctx.fillStyle = outerBg;
    ctx.fillRect(0, 0, THUMB_WIDTH, THUMB_HEIGHT);

    // 2. Paint email card surface
    const padX = 24;
    const cardX = padX;
    const cardW = THUMB_WIDTH - padX * 2;
    const topMargin = Math.min(16, Math.max(0, parsePx(anyBody.marginTop, 12)));

    ctx.save();
    ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = cardBg;
    drawRoundedRect(ctx, cardX, topMargin, cardW, THUMB_HEIGHT - topMargin + 20, parsePx(anyBody.borderRadius, 8));
    ctx.fill();
    ctx.restore();

    let cursorY = topMargin;

    const validBlocks = Array.isArray(blocks) && blocks.length > 0 && typeof blocks[0] === 'object'
        ? blocks
        : [];

    const renderBlockList = async (list: EmailBlock[], containerX: number, containerW: number) => {
        for (const block of list) {
            if (cursorY >= THUMB_HEIGHT - 6) break;
            if (!block || typeof block !== 'object') continue;

            const anyBlock = block as any;
            const bType = String(block.type || '');
            const st = (block.style || {}) as any;
            const pTop = Math.min(28, parsePx(st.paddingTop, bType === 'image' ? 0 : 8));
            const pBottom = Math.min(28, parsePx(st.paddingBottom, bType === 'image' ? 0 : 8));
            const pLeft = Math.min(36, parsePx(st.paddingLeft, bType === 'image' || bType === 'section' || bType === 'row' ? 0 : 18));
            const pRight = Math.min(36, parsePx(st.paddingRight, bType === 'image' || bType === 'section' || bType === 'row' ? 0 : 18));

            const bgCol = st.backgroundColor || st.contentBackgroundColor;
            if (bgCol && bgCol !== 'transparent' && bType !== 'button') {
                ctx.fillStyle = bgCol;
                ctx.fillRect(containerX, cursorY, containerW, Math.max(24, THUMB_HEIGHT - cursorY));
            }

            if (bType === 'section' || bType === 'fullwidth' || bType === 'column') {
                cursorY += pTop;
                const bgImageUrl = anyBlock.backgroundImage || st.backgroundImage;
                if (bgImageUrl) {
                    const bgImg = await loadImageSafe(String(bgImageUrl), 1200);
                    if (bgImg) {
                        const drawH = Math.min(180, THUMB_HEIGHT - cursorY);
                        ctx.drawImage(bgImg, containerX + pLeft, cursorY, containerW - pLeft - pRight, drawH);
                    }
                }
                if (Array.isArray(block.children) && block.children.length > 0) {
                    await renderBlockList(block.children, containerX + pLeft, containerW - pLeft - pRight);
                }
                cursorY += pBottom;
                continue;
            }

            if (bType === 'row' && Array.isArray(block.children) && block.children.length > 0) {
                const startY = cursorY + pTop;
                let maxColY = startY;
                const cols = block.children;
                const colCount = cols.length;
                const gap = colCount > 1 ? 10 : 0;
                const availW = containerW - pLeft - pRight - gap * (colCount - 1);
                let currentColX = containerX + pLeft;

                for (let c = 0; c < colCount; c++) {
                    cursorY = startY;
                    const colBlock = cols[c];
                    const pctMatch = String(colBlock?.style?.width || '').match(/(\d+(\.\d+)?)%/);
                    const colW = pctMatch && colCount > 1
                        ? (availW * parseFloat(pctMatch[1])) / 100
                        : availW / colCount;
                    await renderBlockList([colBlock], currentColX, colW);
                    currentColX += colW + gap;
                    if (cursorY > maxColY) maxColY = cursorY;
                }
                cursorY = maxColY + pBottom;
                continue;
            }

            if (bType === 'columns' && Array.isArray(anyBlock.columns) && anyBlock.columns.length > 0) {
                const startY = cursorY + pTop;
                let maxColY = startY;
                const colCount = anyBlock.columns.length;
                const gap = 10;
                const colW = (containerW - pLeft - pRight - gap * (colCount - 1)) / colCount;

                for (let c = 0; c < colCount; c++) {
                    cursorY = startY;
                    const colX = containerX + pLeft + c * (colW + gap);
                    await renderBlockList(anyBlock.columns[c] || [], colX, colW);
                    if (cursorY > maxColY) maxColY = cursorY;
                }
                cursorY = maxColY + pBottom;
                continue;
            }

            if (bType === 'image' || bType === 'hero') {
                const imgUrl = anyBlock.imageUrl || block.content || anyBlock.src || '';
                const img = await loadImageSafe(String(imgUrl), 1500);
                if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                    cursorY += pTop;
                    const availW = containerW - pLeft - pRight;
                    const ratio = img.naturalHeight / img.naturalWidth;
                    const rawH = availW * ratio;
                    const drawH = Math.min(rawH, Math.max(110, THUMB_HEIGHT - cursorY));
                    const drawX = containerX + pLeft;

                    ctx.save();
                    const radius = parsePx(st.borderRadius, 0);
                    if (radius > 0) {
                        drawRoundedRect(ctx, drawX, cursorY, availW, drawH, radius);
                        ctx.clip();
                    }
                    const srcH = Math.min(img.naturalHeight, (drawH / rawH) * img.naturalHeight);
                    ctx.drawImage(img, 0, 0, img.naturalWidth, srcH, drawX, cursorY, availW, drawH);
                    ctx.restore();

                    cursorY += drawH + pBottom;
                }
                continue;
            }

            if (bType === 'text' || bType === 'heading' || bType === 'header' || bType === 'quote') {
                const plain = stripTags(block.content || '');
                if (!plain) continue;
                cursorY += pTop;

                const isHeading = bType === 'header' || /<h[1-3]/i.test(block.content || '') || parsePx(st.fontSize, 14) >= 18;
                const fontSize = Math.min(22, Math.max(11, parsePx(st.fontSize, isHeading ? 18 : 13) * 0.88));
                const fontWeight = st.fontWeight || (isHeading ? '700' : '400');
                const color = st.color || (isHeading ? '#0f172a' : '#334155');
                const align = st.textAlign || 'left';

                ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
                ctx.fillStyle = color;
                ctx.textBaseline = 'top';

                const availW = Math.max(80, containerW - pLeft - pRight);
                const lines = wrapCanvasText(ctx, plain, availW, isHeading ? 3 : 5);
                const lineHeight = fontSize * 1.42;

                for (const line of lines) {
                    if (cursorY + fontSize > THUMB_HEIGHT - 4) break;
                    let tx = containerX + pLeft;
                    if (align === 'center') {
                        tx = containerX + pLeft + (availW - ctx.measureText(line).width) / 2;
                    } else if (align === 'right') {
                        tx = containerX + containerW - pRight - ctx.measureText(line).width;
                    }
                    ctx.fillText(line, tx, cursorY);
                    cursorY += lineHeight;
                }
                cursorY += pBottom;
                continue;
            }

            if (bType === 'button') {
                const label = stripTags(block.content || 'Xem chi tiết');
                if (!label) continue;
                cursorY += pTop;
                const btnBg = st.buttonColor || st.contentBackgroundColor || st.backgroundColor || '#BD1D2D';
                const btnColor = st.color || '#ffffff';
                const fontSize = 12;
                ctx.font = `700 ${fontSize}px ${fontFamily}`;
                const textW = ctx.measureText(label).width;
                const btnW = Math.min(containerW - pLeft - pRight, Math.max(110, textW + 36));
                const btnH = 32;
                const align = st.textAlign || 'center';
                let btnX = containerX + pLeft;
                if (align === 'center') {
                    btnX = containerX + (containerW - btnW) / 2;
                } else if (align === 'right') {
                    btnX = containerX + containerW - pRight - btnW;
                }

                ctx.fillStyle = btnBg;
                drawRoundedRect(ctx, btnX, cursorY, btnW, btnH, parsePx(st.borderRadius, 8));
                ctx.fill();

                ctx.fillStyle = btnColor;
                ctx.textBaseline = 'middle';
                ctx.fillText(label, btnX + (btnW - textW) / 2, cursorY + btnH / 2);
                cursorY += btnH + pBottom;
                continue;
            }

            if (bType === 'divider') {
                cursorY += pTop + 4;
                ctx.strokeStyle = st.dividerColor || st.borderColor || '#e2e8f0';
                ctx.lineWidth = Math.max(1, parsePx(st.dividerThickness || st.borderTopWidth, 1));
                ctx.beginPath();
                ctx.moveTo(containerX + pLeft, cursorY);
                ctx.lineTo(containerX + containerW - pRight, cursorY);
                ctx.stroke();
                cursorY += pBottom + 4;
                continue;
            }

            if (bType === 'spacer') {
                cursorY += Math.min(28, parsePx(st.height, 16));
                continue;
            }
        }
    };

    if (validBlocks.length > 0) {
        await renderBlockList(validBlocks, cardX, cardW);
    } else if (htmlContent) {
        // Fallback DOM parser for raw HTML templates
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        const imgs = Array.from(doc.querySelectorAll('img'))
            .map(el => el.getAttribute('src') || '')
            .filter(src => src && !src.includes('tracking') && !src.includes('pixel'));

        if (imgs.length > 0) {
            const firstImg = await loadImageSafe(imgs[0], 1500);
            if (firstImg && firstImg.naturalWidth > 0 && firstImg.naturalHeight > 0) {
                const ratio = firstImg.naturalHeight / firstImg.naturalWidth;
                const rawH = cardW * ratio;
                const drawH = Math.min(rawH, 210);
                const srcH = Math.min(firstImg.naturalHeight, (drawH / rawH) * firstImg.naturalHeight);
                ctx.drawImage(firstImg, 0, 0, firstImg.naturalWidth, srcH, cardX, cursorY, cardW, drawH);
                cursorY += drawH + 14;
            }
        }

        const textNodes = Array.from(doc.querySelectorAll('h1, h2, h3, p, td, div'))
            .map(el => (el.textContent || '').replace(/\s+/g, ' ').trim())
            .filter(t => t.length > 8);
        const uniqueTexts: string[] = [];
        for (const t of textNodes) {
            if (!uniqueTexts.some(u => u.includes(t) || t.includes(u))) {
                uniqueTexts.push(t);
            }
            if (uniqueTexts.length >= 4) break;
        }

        for (let i = 0; i < uniqueTexts.length; i++) {
            if (cursorY >= THUMB_HEIGHT - 12) break;
            const isFirst = i === 0;
            const fontSize = isFirst ? 15 : 12;
            ctx.font = `${isFirst ? '700' : '400'} ${fontSize}px ${fontFamily}`;
            ctx.fillStyle = isFirst ? '#0f172a' : '#475569';
            ctx.textBaseline = 'top';
            const lines = wrapCanvasText(ctx, uniqueTexts[i], cardW - 40, isFirst ? 2 : 3);
            for (const line of lines) {
                if (cursorY + fontSize > THUMB_HEIGHT - 8) break;
                ctx.fillText(line, cardX + 20, cursorY);
                cursorY += fontSize * 1.42;
            }
            cursorY += 8;
        }
    }

    // If template was completely empty, draw clean header placeholder with template name
    if (cursorY <= topMargin + 15 && templateName) {
        ctx.fillStyle = '#BD1D2D';
        ctx.fillRect(cardX, topMargin, cardW, 6);
        ctx.font = `700 16px ${fontFamily}`;
        ctx.fillStyle = '#0f172a';
        ctx.textBaseline = 'top';
        const lines = wrapCanvasText(ctx, templateName, cardW - 40, 2);
        let ty = topMargin + 28;
        for (const l of lines) {
            ctx.fillText(l, cardX + 20, ty);
            ty += 22;
        }
    }

    try {
        return canvas.toDataURL('image/webp', 0.84);
    } catch {
        return '';
    }
}
