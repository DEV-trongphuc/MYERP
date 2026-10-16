
export const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const dm = 2;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const hexToHSL = (hex: string) => {
    let r = 0, g = 0, b = 0;
    const hx = hex.startsWith('#') ? hex : '#' + hex;
    if (hx.length === 4) {
        r = parseInt("0x" + hx[1] + hx[1]) / 255;
        g = parseInt("0x" + hx[2] + hx[2]) / 255;
        b = parseInt("0x" + hx[3] + hx[3]) / 255;
    } else if (hx.length === 7) {
        r = parseInt("0x" + hx[1] + hx[2]) / 255;
        g = parseInt("0x" + hx[3] + hx[4]) / 255;
        b = parseInt("0x" + hx[5] + hx[6]) / 255;
    }
    let cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin, h = 0, s = 0, l = 0;
    if (delta === 0) h = 0;
    else if (cmax === r) h = ((g - b) / delta) % 6;
    else if (cmax === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
    l = (cmax + cmin) / 2;
    s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
    s = +(s * 100).toFixed(1);
    l = +(l * 100).toFixed(1);
    return { h, s, l };
};

export const EXT_MAP: Record<string, string> = {
    'javascript': 'js', 'typescript': 'ts', 'python': 'py', 'react': 'tsx',
    'php': 'php', 'html': 'html', 'css': 'css', 'sql': 'sql', 'json': 'json',
    'typescriptreact': 'tsx', 'javascriptreact': 'jsx', 'markdown': 'md',
    'sh': 'sh', 'bash': 'sh',
    'js': 'js', 'ts': 'ts', 'py': 'py', 'java': 'java', 'c++': 'cpp', 'cpp': 'cpp',
    'c#': 'cs', 'cs': 'cs', 'c': 'c', 'xml': 'xml', 'yaml': 'yaml', 'yml': 'yaml',
    'md': 'md', 'shell': 'sh', 'powershell': 'ps1', 'ps1': 'ps1',
    'ruby': 'rb', 'rb': 'rb', 'go': 'go', 'rust': 'rs', 'rs': 'rs',
    'swift': 'swift', 'kotlin': 'kt', 'kt': 'kt', 'scala': 'scala', 'r': 'r',
    'perl': 'pl', 'pl': 'pl', 'lua': 'lua', 'dart': 'dart', 'objective-c': 'm',
    'visual basic': 'vb', 'vb': 'vb'
};

/**
 * Clean up malformed URLs that might contain Markdown artifacts
 * e.g. "https://domain.com/file.pdf](https://domain.com/file.pdf" -> "https://domain.com/file.pdf"
 */
export const sanitizeUrl = (url?: string): string => {
    if (!url) return '';
    // If it's a base64 or virtual URL, leave it alone
    if (url.startsWith('data:') || url.startsWith('virtual://') || url.startsWith('blob:')) return url;

    // Remove any trailing markdown garbage like "](https://...)" or ")"
    let clean = url;
    const mdSeparator = '](';
    if (clean.includes(mdSeparator)) {
        clean = clean.split(mdSeparator)[0];
    }
    // Remove trailing ')' or ']' if it looks like a markdown closing
    clean = clean.replace(/[\]\)]+$/, '');

    return clean;
};

/**
 * Check if a variable value is a valid URL or domain format (e.g. https://..., www...., ideas.edu.vn, domain.com/path)
 */
export const isLinkOrDomain = (val: any): boolean => {
    if (!val || typeof val !== 'string') return false;
    const str = val.trim();
    if (!str || /\s/.test(str)) return false;

    // Exclude emails
    if (str.includes('@') && !/^https?:\/\//i.test(str)) return false;

    // 1. Full URL with scheme (http://, https://)
    if (/^https?:\/\/[^\s<>"'`]+$/i.test(str)) return true;

    // 2. Starts with www.
    if (/^www\.[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,}(?::[0-9]+)?(?:\/[^\s<>"'`]*)?$/i.test(str)) return true;

    // 3. Domain pattern with valid TLD (e.g. ideas.edu.vn, domain.com, my-shop.vn/path)
    return /^[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*\.(?:[a-zA-Z]{2,63})(?::[0-9]+)?(?:\/[^\s<>"'`]*)?$/i.test(str);
};

/**
 * Normalize a domain or URL to have a valid https:// scheme if missing.
 */
export const normalizeUrl = (url: string): string => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:') || trimmed.startsWith('blob:') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:') || trimmed.startsWith('#')) {
        return trimmed;
    }
    return `https://${trimmed}`;
};

/**
 * Canonicalize variable keys for fuzzy matching (case/dash/underscore/Vietnamese-accent insensitive)
 * e.g. "Mã chứng chỉ", "cert_no", "certNo", "CERT_NO", "cert-no" -> "machungchi", "certno"
 */
export const canonicalizeVarKey = (key: string): string => {
    if (!key) return '';
    return key
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
};

export interface ExtractedVariables {
    all: string[];
    linkVars: string[];
    imageVars: string[];
    textVars: string[];
}

/**
 * Extract all merge tags from an HTML or text string, classifying them into image, link, and text variables.
 */
export const extractTemplateVariables = (html: string): ExtractedVariables => {
    if (!html || typeof html !== 'string') {
        return { all: [], linkVars: [], imageVars: [], textVars: [] };
    }

    const allSet = new Set<string>();
    const linkSet = new Set<string>();
    const imageSet = new Set<string>();
    const textSet = new Set<string>();

    const regex = /(?:{{\s*([^{}%]+?)\s*}}|%7B%7B\s*([^{}%]+?)\s*%7D%7D)/gi;
    let match;

    while ((match = regex.exec(html)) !== null) {
        const tag = (match[1] || match[2] || '').trim();
        if (!tag) continue;
        allSet.add(tag);

        const offset = match.index;
        const before = html.substring(Math.max(0, offset - 100), offset);
        const canon = canonicalizeVarKey(tag);

        // Check if inside src="..."
        const isInsideSrc = /src\s*=\s*["'][^"']*$/i.test(before) || /image|img|photo|picture|avatar|qr|banner|logo|cert_img|certimg/i.test(canon);
        // Check if inside href="..."
        const isInsideHref = /href\s*=\s*["'][^"']*$/i.test(before) || /link|url|website|domain|web|button|cert_link|certlink/i.test(canon);

        if (isInsideSrc) {
            imageSet.add(tag);
        } else if (isInsideHref) {
            linkSet.add(tag);
        } else {
            textSet.add(tag);
        }
    }

    return {
        all: Array.from(allSet),
        linkVars: Array.from(linkSet),
        imageVars: Array.from(imageSet),
        textVars: Array.from(textSet)
    };
};

/**
 * Replace merge tags (e.g. {{firstName}}, {{cert_no}}, {{cert_link}}, {{cert_img}}) in text/HTML,
 * with full support for:
 * 1. Custom fields from CSV/Excel (cert_no, cert_link, cert_img, etc.)
 * 2. Case-insensitive and canonical key normalization (certNo, CERT_NO, cert_no)
 * 3. Dynamic links in href / buttons (normalized into real clickable URLs)
 * 4. Dynamic images in img src (resolving to valid image URLs or configured fallback image)
 * 5. Configurable fallbacks via context.fallbacks or context.variable_fallbacks
 */
export const interpolateMergeTags = (
    text: string,
    subscriber: Record<string, any> = {},
    context: Record<string, any> = {}
): string => {
    if (!text || typeof text !== 'string') return '';

    const firstName = subscriber.firstName || subscriber.first_name || '';
    const lastName = subscriber.lastName || subscriber.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || subscriber.fullName || subscriber.full_name || subscriber.name || 'Bạn';
    const email = subscriber.email || '';
    const phone = subscriber.phoneNumber || subscriber.phone_number || subscriber.phone || '';
    const subscriberId = subscriber.subscriberId || subscriber.subscriber_id || subscriber.id || '';

    // Merge all custom attributes / fields from various possible properties
    const customAttrs: Record<string, any> = {
        ...(subscriber.customAttributes || {}),
        ...(subscriber.custom_attributes || {}),
        ...(subscriber.custom_fields || {}),
        ...(subscriber.customFields || {}),
        ...(subscriber.attributes || {}),
        ...(subscriber.metadata || {})
    };

    // Also collect top-level non-standard properties on subscriber (e.g. cert_no, cert_link imported from CSV)
    const STANDARD_PROP_KEYS = new Set([
        'id', 'firstName', 'first_name', 'lastName', 'last_name', 'fullName', 'full_name',
        'email', 'phone', 'phoneNumber', 'phone_number', 'company', 'companyName', 'company_name',
        'jobTitle', 'job_title', 'city', 'country', 'address', 'gender', 'birthday',
        'dateOfBirth', 'date_of_birth', 'tags', 'listIds', 'status', 'source', 'joinedAt', 'stats'
    ]);

    Object.keys(subscriber).forEach(key => {
        if (!STANDARD_PROP_KEYS.has(key) && typeof subscriber[key] !== 'function') {
            const val = subscriber[key];
            if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
                customAttrs[key] = val;
            } else if (Array.isArray(val) && val.every(i => typeof i === 'string' || typeof i === 'number')) {
                customAttrs[key] = val.join(', ');
            }
        }
    });

    const fallbacks = {
        ...(context.fallbacks || {}),
        ...(context.variable_fallbacks || {}),
        ...(context.config?.variable_fallbacks || {})
    };

    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();

    // Standard variable map
    const map: Record<string, any> = {
        first_name: firstName,
        firstName: firstName,
        last_name: lastName,
        lastName: lastName,
        full_name: fullName,
        fullName: fullName,
        customer_name: fullName,
        customerName: fullName,
        name: fullName,
        email: email,
        phone: phone,
        phoneNumber: phone,
        phone_number: phone,
        subscriber_id: subscriberId,
        subscriberId: subscriberId,
        contact_id: subscriberId,
        subscriber_id_short: String(subscriberId).substring(0, 10),
        contact_id_short: String(subscriberId).substring(0, 10),
        company: subscriber.companyName || subscriber.company_name || subscriber.company || '',
        company_name: subscriber.companyName || subscriber.company_name || '',
        companyName: subscriber.companyName || subscriber.company_name || '',
        job_title: subscriber.jobTitle || subscriber.job_title || '',
        jobTitle: subscriber.jobTitle || subscriber.job_title || '',
        city: subscriber.city || subscriber.last_city || '',
        country: subscriber.country || '',
        address: subscriber.address || subscriber.city || '',
        website: subscriber.website || '',
        url: subscriber.url || subscriber.website || '',
        gender: subscriber.gender || '',
        birthday: subscriber.dateOfBirth || subscriber.date_of_birth || subscriber.birthday || '',
        date_of_birth: subscriber.dateOfBirth || subscriber.date_of_birth || subscriber.birthday || '',
        year: y.toString(),
        date: `${d}/${m}/${y}`,
        current_date: `${d}/${m}/${y}`,
        today: `${d}/${m}/${y}`,
        today_ymd: `${y}-${m}-${d}`,
        today_dmy: `${d}-${m}-${y}`,
        time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        current_time: now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        unsubscribe_url: context.unsubscribe_url || context.unsubscribeLink || '#unsubscribe',
        unsubscribeLink: context.unsubscribe_url || context.unsubscribeLink || '#unsubscribe',
        campaign_name: context.campaign_name || context.campaignName || '',
        campaignName: context.campaign_name || context.campaignName || '',
        ...customAttrs,
        ...context
    };

    // Build canonical map for fuzzy matching (case/dash/underscore insensitive)
    const canonicalMap: Record<string, any> = {};
    Object.keys(map).forEach(k => {
        const cKey = canonicalizeVarKey(k);
        if (map[k] !== undefined && map[k] !== null && map[k] !== '') {
            canonicalMap[cKey] = map[k];
        }
    });

    const canonicalFallbacks: Record<string, any> = {};
    Object.keys(fallbacks).forEach(k => {
        canonicalFallbacks[canonicalizeVarKey(k)] = fallbacks[k];
    });

    const isHtml = /<[a-z][\s\S]*>/i.test(text);

    return text.replace(/(?:{{\s*([^{}%]+?)\s*}}|%7B%7B\s*([^{}%]+?)\s*%7D%7D)/gi, (match, tag1, tag2, offset) => {
        const rawTag = (tag1 || tag2 || '').trim();
        const tag = rawTag;
        const canon = canonicalizeVarKey(tag);

        // 1. Resolve raw value from map, canonicalMap, or fallbacks
        let val: any = undefined;

        if (tag in map && map[tag] !== undefined && map[tag] !== null && map[tag] !== '') {
            val = map[tag];
        } else if (canon in canonicalMap) {
            val = canonicalMap[canon];
        } else if (tag in fallbacks && fallbacks[tag]) {
            val = fallbacks[tag];
        } else if (canon in canonicalFallbacks && canonicalFallbacks[canon]) {
            val = canonicalFallbacks[canon];
        }

        const before = text.substring(0, offset);
        const lastOpen = before.lastIndexOf('<');
        const lastClose = before.lastIndexOf('>');
        const isInsideTag = lastOpen !== -1 && (lastClose === -1 || lastOpen > lastClose);
        
        // Inspect surrounding attribute if inside tag
        const tagBeforeAttr = isInsideTag ? before.substring(lastOpen) : '';
        const isInsideSrc = isInsideTag && /src\s*=\s*["'][^"']*$/i.test(tagBeforeAttr);
        const isInsideHref = isInsideTag && /href\s*=\s*["'][^"']*$/i.test(tagBeforeAttr);

        // 2. Handle missing / empty value
        if (val === undefined || val === null || val === '') {
            const after = text.substring(offset, offset + 300);
            const tagSurround = tagBeforeAttr + after;
            const tagClose = tagSurround.indexOf('>');
            const fullTagStr = tagClose !== -1 ? tagSurround.substring(0, tagClose + 1) : tagSurround;

            // Fallback for image src (prevent broken img box)
            if (isInsideSrc) {
                const matchSrc = fullTagStr.match(/data-fallback-src\s*=\s*["']([^"']+)["']/i);
                if (matchSrc) return normalizeUrl(matchSrc[1]);
                const fbImg = fallbacks[tag] || canonicalFallbacks[canon] || fallbacks.default_image || fallbacks.cert_img || 'https://placehold.co/600x400/f8fafc/94a3b8?text=Image';
                return normalizeUrl(String(fbImg));
            }
            // Fallback for link href
            if (isInsideHref) {
                const matchUrl = fullTagStr.match(/data-fallback-url\s*=\s*["']([^"']+)["']/i);
                if (matchUrl) return normalizeUrl(matchUrl[1]);
                const fbLink = fallbacks[tag] || canonicalFallbacks[canon] || fallbacks.default_link || fallbacks.cert_link || '#';
                return normalizeUrl(String(fbLink));
            }
            // Fallback for text
            const fbText = fallbacks[tag] || canonicalFallbacks[canon];
            return fbText !== undefined ? String(fbText) : '';
        }

        const strVal = String(val).trim();

        // 3. Handle Link / Domain / Image resolution
        if (isInsideSrc) {
            return normalizeUrl(strVal);
        }

        if (isInsideHref) {
            return normalizeUrl(strVal);
        }

        if (isLinkOrDomain(strVal)) {
            const normalized = normalizeUrl(strVal);

            // Inside existing <a> tag: <a href="...">{{var}}</a> -> return raw text
            const openMatches = before.match(/<a[\s>]/gi) || [];
            const closeMatches = before.match(/<\/a\s*>/gi) || [];
            if (openMatches.length > closeMatches.length) {
                return strVal;
            }

            // In HTML body text -> render as styled clickable anchor tag
            if (isHtml) {
                return `<a href="${normalized}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; word-break: break-all;">${strVal}</a>`;
            }

            // In Plain text
            return normalized;
        }

        return strVal;
    });
};


// Dual value declarations for verbatimModuleSyntax compatibility
export const ExtractedVariables: any = undefined;
