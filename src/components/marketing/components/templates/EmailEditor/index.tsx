
// components/templates/EmailEditor/index.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import TestEmailModal from '../../campaigns/TestEmailModal';
import { createPortal } from 'react-dom';
import { EmailBlock, EmailBodyStyle, EmailBlockType, EmailBlockStyle, Template, TemplateGroup } from '../../../types';
import EmailTopBar from './EmailTopBar';
import EmailToolbox from './EmailToolbox';
import EmailCanvas from './EmailCanvas';
import EmailProperties from './EmailProperties';
import EmailValidationPanel, { ValidationIssue } from './components/EmailValidationPanel';
import toast from 'react-hot-toast';
import Modal from '../../common/Modal';
import Input from '../../common/Input';
import Button from '../../common/Button';
import { Box, Save, Sparkles, Layers, SlidersHorizontal, X } from 'lucide-react';
const AIEmailGeneratorModal = React.lazy(() => import('./AIEmailGeneratorModal'));

// Import constants and utilities
import { DEFAULT_BODY_STYLE, DEFAULT_BLOCKS } from './constants/editorConstants';
import { compileHTML } from './utils/htmlCompiler';
import { captureEmailTopWebp } from './utils/thumbnailCapture';
import { createBlock, insertDeep, deleteBlockDeep, duplicateBlockDeep, ensureUniqueIds } from './utils/blockUtils'; // Import necessary block utils
import { API_BASE_URL } from '../../../utils/config';
import { api } from '../../../services/storageAdapter';
import { getMktPortalRoot } from '../../../utils/portalRoot';
import {
    type TemplateAccessConfig,
    type TemplateVisibilityMode,
    normalizeTemplateAccessConfig
} from '../TemplateAccessModal';

interface EmailEditorProps {
    template?: Template;
    groups: TemplateGroup[];
    onSave: (data: Partial<Template> & { visibility?: TemplateVisibilityMode; accessConfig?: TemplateAccessConfig }) => void;
    onCancel: () => void;
    customMergeTags?: { label: string; key: string }[];
    canSetShared?: boolean;
}

// ─── Validation helpers ───────────────────────────────────────────────────────

const SPAM_WORDS = [
    'miễn phí', '100%', 'cam kết', 'trúng thưởng', 'rút tiền', 'không rủi ro',
    'bí quyết', 'làm giàu', 'việc nhẹ', 'cơ hội cuối', 'chỉ hôm nay',
    'độc đắc', 'thu nhập thụ động', 'hoàn tiền', 'kết quả bất ngờ', 'đột phá',
    'chiến thắng', 'cơ hội vàng', 'tiền mặt', 'vốn 0 đồng'
];

/** Strip HTML tags and return plain text preview (max 40 chars) */
const stripHtml = (html: string): string => {
    return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().slice(0, 40) || '';
};

/** Normalize URL: remove mc_cta param so we can compare base URLs */
const normalizeUrl = (url: string): string => {
    try {
        const u = new URL(url);
        u.searchParams.delete('mc_cta');
        return u.toString();
    } catch {
        // relative URL — strip mc_cta manually
        return url.replace(/[?&]mc_cta=[^&]*/g, '').replace(/[?&]$/, '');
    }
};

/** Flat-collect all clickable blocks (button + image with url) */
const collectLinkBlocks = (blocks: EmailBlock[], out: { id: string; url: string; label: string }[] = []): typeof out => {
    for (const block of blocks) {
        const url = block.url?.trim();
        if (url && url !== '#' && (block.type === 'button' || block.type === 'image' || block.type === 'survey_card')) {
            out.push({
                id: block.id,
                url,
                label: block.type === 'button'
                    ? (stripHtml(block.content || '') || 'Nút')
                    : 'Hình ảnh',
            });
        }
        if (block.children?.length) collectLinkBlocks(block.children, out);
    }
    return out;
};

/** 
 * Returns true if the URL is empty, whitespace-only, or an anchor-only value.
 * Anchor-only: '#', '#section', '#domain.com' — these cannot be click-tracked 
 * because they only scroll within the same page (or go nowhere in email clients).
 * Valid: http(s)://, mailto:, tel:, or a root-relative path starting with '/'.
 */
const isInvalidUrl = (url: string | undefined | null): boolean => {
    if (!url || !url.trim()) return true;
    const u = url.trim();
    // Merge tags like {{unsubscribe_url}} are replaced at send time — always valid
    if (/^\{\{.+\}\}$/.test(u)) return false;
    // Pure hash anchor — invalid regardless of what follows the '#'
    if (u.startsWith('#')) return true;
    // Allowed protocols
    if (/^https?:\/\//i.test(u)) return false;
    if (/^mailto:/i.test(u)) return false;
    if (/^tel:/i.test(u)) return false;
    // Everything else (bare domain without protocol, plain text, etc.) is invalid
    return true;
};
/** Recursively scan all blocks and collect issues */
const scanBlocks = (blocks: EmailBlock[]): ValidationIssue[] => {
    const issues: ValidationIssue[] = [];

    const scan = (list: EmailBlock[]) => {
        for (const block of list) {
            // ── Mandatory Fallback Check for dynamic variables in URL ──
            const isVarInUrl = /(?:{{\s*([^{}%]+?)\s*}}|%7B%7B\s*([^{}%]+?)\s*%7D%7D)/i.test(block.url || '');
            if (isVarInUrl && (!block.fallbackUrl || !block.fallbackUrl.trim() || block.fallbackUrl === '#')) {
                issues.push({
                    blockId: block.id,
                    type: 'missing_fallback_url',
                    label: `Biến link "${block.url}" chưa có đường dẫn dự phòng (bắt buộc)`,
                    preview: stripHtml(block.content || '') || block.content?.slice(0, 40) || 'Nút / Link',
                });
            }

            if (block.type === 'button' || block.type === 'survey_card') {
                if (isInvalidUrl(block.url)) {
                    issues.push({
                        blockId: block.id,
                        type: 'button_no_link',
                        label: block.url?.startsWith('#')
                            ? `Nút có anchor URL "${block.url}" — không track được trong email`
                            : 'Nút bấm chưa có URL',
                        preview: stripHtml(block.content || '') || block.content?.slice(0, 40),
                    });
                }
            } else if (block.type === 'image') {
                // ── Mandatory Fallback Check for dynamic image src ──
                const isVarInSrc = /(?:{{\s*([^{}%]+?)\s*}}|%7B%7B\s*([^{}%]+?)\s*%7D%7D)/i.test(block.content || '');
                if (isVarInSrc && (!block.fallbackContent || !block.fallbackContent.trim())) {
                    issues.push({
                        blockId: block.id,
                        type: 'missing_fallback_image',
                        label: `Biến ảnh "${block.content}" chưa có ảnh dự phòng (bắt buộc)`,
                        preview: block.altText || 'Hình ảnh',
                    });
                }

                const noLink = isInvalidUrl(block.url);
                const noAlt = !block.altText || block.altText.trim() === '';
                if (noLink) {
                    issues.push({
                        blockId: block.id,
                        type: 'image_no_link',
                        label: block.url?.startsWith('#')
                            ? `Ảnh có anchor URL "${block.url}" — không track được trong email`
                            : 'Hình ảnh chưa có link click',
                        preview: block.content?.slice(0, 40),
                    });
                }
                if (noAlt) {
                    issues.push({
                        blockId: block.id,
                        type: 'image_no_alt',
                        label: 'Hình ảnh thiếu mô tả ALT',
                        preview: block.content?.slice(0, 40),
                    });
                }
            }

            // ── Scan inline <a href> links inside rich-text blocks ───────────
            if (block.type === 'text' || block.type === 'quote') {
                const html = block.content || '';
                // Extract every href="..." from the HTML string
                const hrefRegex = /href=["']([^"']+)["']/gi;
                let m: RegExpExecArray | null;
                while ((m = hrefRegex.exec(html)) !== null) {
                    const href = m[1];
                    if (isInvalidUrl(href)) {
                        const anchorText = (() => {
                            // Try to extract the visible text of the <a> tag containing this href
                            const aTagRegex = new RegExp(`href=["']${href.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([^<]*)<\\/a>`, 'i');
                            const match = html.match(aTagRegex);
                            return match ? stripHtml(match[1]).trim().slice(0, 30) : href.slice(0, 30);
                        })();
                        issues.push({
                            blockId: block.id,
                            type: 'button_no_link',   // reuse same type so panel groups & shows it
                            label: href.startsWith('#')
                                ? `Link văn bản "${anchorText}" dùng anchor "#" — không track được`
                                : `Link văn bản "${anchorText}" có URL không hợp lệ: "${href.slice(0, 40)}"`,
                            preview: stripHtml(html).slice(0, 40),
                        });
                    }
                }
            }

            // ── Scan for SPAM_WORDS ──────────────────────────────────────────
            if (block.type === 'text' || block.type === 'quote' || block.type === 'button') {
                const html = block.content || '';
                const textOnly = stripHtml(html).toLowerCase();
                const foundSpamWords = new Set<string>();
                SPAM_WORDS.forEach(word => {
                    if (textOnly.includes(word.toLowerCase())) {
                        foundSpamWords.add(word);
                    }
                });

                if (foundSpamWords.size > 0) {
                    issues.push({
                        blockId: block.id,
                        type: 'spam_words',
                        label: `Phát hiện ${foundSpamWords.size} cụm từ dễ vào thẻ Spam`,
                        preview: Array.from(foundSpamWords).join(', '),
                        spamWords: Array.from(foundSpamWords)
                    });
                }
            }

            if (block.children?.length) scan(block.children);
        }
    };
    scan(blocks);

    // ── Detect duplicate links ────────────────────────────────────────────────
    const allLinks = collectLinkBlocks(blocks);
    // Group by normalized base URL
    const byUrl = new Map<string, typeof allLinks>();
    for (const link of allLinks) {
        const key = normalizeUrl(link.url);
        if (!byUrl.has(key)) byUrl.set(key, []);
        byUrl.get(key)!.push(link);
    }
    // Emit one issue per duplicate group (keyed by the first blockId in the group)
    byUrl.forEach((group, normalizedUrl) => {
        if (group.length < 2) return;

        // Count occurrences of each FULL URL string within this group.
        // If all members of the group have unique full URL strings (because they have different tracking params),
        // then we don't consider them "identical" duplicates anymore.
        const fullUrlCounts = new Map<string, number>();
        group.forEach(link => {
            fullUrlCounts.set(link.url, (fullUrlCounts.get(link.url) || 0) + 1);
        });

        // Only flag blocks that share an EXACT full URL string with at least one other block in the group.
        const identicalMembers = group.filter(link => (fullUrlCounts.get(link.url) || 0) > 1);

        if (identicalMembers.length > 1) {
            identicalMembers.forEach(link => {
                issues.push({
                    blockId: link.id,
                    type: 'duplicate_link',
                    label: `${identicalMembers.length} phần tử có link giống hệt — cần phân biệt để tracking`,
                    preview: link.label,
                    currentUrl: normalizedUrl, // base URL for grouping in UI
                    duplicateGroupIds: identicalMembers.map(g => g.id),
                });
            });
        }
    });

    // ── [NEW] Unsubscribe link checks ─────────────────────────────────────────
    // Build a flat HTML string of all text/quote/footer blocks for scanning
    const collectAllHtml = (list: EmailBlock[]): string => {
        let html = '';
        for (const block of list) {
            if (block.type === 'text' || block.type === 'quote') {
                html += block.content || '';
            }
            // Also scan button URLs and image URLs for the merge tag
            if ((block.type === 'button' || block.type === 'image') && block.url) {
                html += block.url;
            }
            if (block.children?.length) html += collectAllHtml(block.children);
        }
        return html;
    };

    const allHtml = collectAllHtml(blocks);
    const hasUnsubscribeTag = /\{\{\s*unsubscribe_url\s*\}\}/i.test(allHtml);

    if (!hasUnsubscribeTag) {
        // No {{unsubscribe_url}} found anywhere in the email
        issues.unshift({
            blockId: '__email_root__',
            type: 'missing_unsubscribe',
            label: 'Email chưa có link hủy đăng ký {{unsubscribe_url}} — có thể bị đánh dấu spam',
            preview: 'Thêm Footer block hoặc thêm thủ công vào text block',
        });
    }

    // Scan for anchors whose visible text contains "unsubscribe" but href is NOT {{unsubscribe_url}}
    const wrongUnsubScan = (list: EmailBlock[]) => {
        for (const block of list) {
            if (block.type === 'text' || block.type === 'quote') {
                const html = block.content || '';
                // Match: <a href="...">...unsubscribe...</a> (case-insensitive on visible text)
                const aTagRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
                let m: RegExpExecArray | null;
                while ((m = aTagRegex.exec(html)) !== null) {
                    const href = m[1];
                    const visibleText = m[2];
                    if (/unsubscrib/i.test(visibleText)) {
                        // This anchor claims to be an unsubscribe link
                        const isCorrect = /^\{\{\s*unsubscribe_url\s*\}\}$/i.test(href.trim());
                        if (!isCorrect) {
                            issues.push({
                                blockId: block.id,
                                type: 'wrong_unsubscribe_url',
                                label: `Link “${visibleText.trim().slice(0, 30)}” gắn URL sai: “${href.slice(0, 50)}”`,
                                preview: 'Cần đổi thành {{unsubscribe_url}}',
                                badHref: href,
                            });
                        }
                    }
                }
            }
            if (block.children?.length) wrongUnsubScan(block.children);
        }
    };
    wrongUnsubScan(blocks);

    return issues;
};

/**
 * Append ?mc_cta=N to each block in the group sequentially.
 * - Preserves all existing query params
 * - Replaces existing mc_cta if already present
 * - Does NOT touch utm_* or other tracking params
 */
const applyCtaTracking = (currentUrl: string, index: number): string => {
    const label = `cta${index + 1}`;
    try {
        const u = new URL(currentUrl);
        u.searchParams.set('mc_cta', label);
        return u.toString();
    } catch {
        // Relative URL
        const base = currentUrl.replace(/[?&]mc_cta=[^&]*/g, '').replace(/&&/, '&').replace(/[?&]$/, '');
        const sep = base.includes('?') ? '&' : '?';
        return `${base}${sep}mc_cta=${label}`;
    }
};

// ─── Component ────────────────────────────────────────────────────────────────

const EmailEditor: React.FC<EmailEditorProps> = ({ template, groups, onSave, onCancel, customMergeTags = [], canSetShared = true }) => {
    const [isMobileOrTablet, setIsMobileOrTablet] = useState(() =>
        typeof window !== 'undefined' ? window.innerWidth < 1024 : false
    );
    useEffect(() => {
        const handleResize = () => setIsMobileOrTablet(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [isToolboxOpen, setIsToolboxOpen] = useState(false);
    const [isPropertiesOpen, setIsPropertiesOpen] = useState(false);
    const hasInitialBlockObjects = Boolean(
        template?.blocks && template.blocks.length > 0 && typeof template.blocks[0] === 'object'
    );
    const expectsBlocks = hasInitialBlockObjects || Boolean((template as any)?.hasBlocks) || (Array.isArray(template?.blocks) && template!.blocks.length > 0);
    const initialBlocksRef = useRef<EmailBlock[] | null>(null);
    if (!initialBlocksRef.current) {
        initialBlocksRef.current = hasInitialBlockObjects ? ensureUniqueIds(template!.blocks) : DEFAULT_BLOCKS;
    }
    const [editorMode, setEditorMode] = useState<'visual' | 'code'>(
        (template?.htmlContent && !expectsBlocks) ? 'code' : 'visual'
    );
    const [blocks, setBlocks] = useState<EmailBlock[]>(() => initialBlocksRef.current!);
    const latestBlocksRef = useRef<EmailBlock[]>(blocks);
    latestBlocksRef.current = blocks;
    const [bodyStyle, setBodyStyle] = useState<EmailBodyStyle>(template?.bodyStyle || DEFAULT_BODY_STYLE);
    const [name, setName] = useState(template?.name || 'Thiết kế mới');
    const [groupId, setGroupId] = useState(template?.groupId || '');
    const [accessConfig, setAccessConfig] = useState<TemplateAccessConfig>(() =>
        normalizeTemplateAccessConfig(template, canSetShared ? 'shared' : 'personal')
    );
    const [visibility, setVisibility] = useState<TemplateVisibilityMode>(() => accessConfig.visibility);

    const [customHtml, setCustomHtml] = useState(template?.htmlContent || '');
    const handleSetEditorMode = useCallback((newMode: 'visual' | 'code') => {
        if (newMode === 'code' && editorMode === 'visual') {
            setCustomHtml(compileHTML(latestBlocksRef.current, bodyStyle, name));
        }
        setEditorMode(newMode);
    }, [editorMode, bodyStyle, name]);
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [history, setHistory] = useState<EmailBlock[][]>(() => [initialBlocksRef.current!]);
    const [historyIndex, setHistoryIndex] = useState(0);
    // [UX] Track which history index was last saved to compute isDirty
    const [savedHistoryIndex, setSavedHistoryIndex] = useState(0);
    const [hasUncommittedChanges, setHasUncommittedChanges] = useState(false);
    const historyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isTestModalOpen, setIsTestModalOpen] = useState(false);
    const isDirty = historyIndex !== savedHistoryIndex || hasUncommittedChanges;

    // Sync real blocks or raw HTML if template opened instantaneously from lightweight thumbnail list and full payload arrives
    const syncedRealBlocksRef = useRef<boolean>(hasInitialBlockObjects || (!expectsBlocks && Boolean(template?.htmlContent)));
    useEffect(() => {
        const nowHasRealBlocks = Boolean(
            template?.blocks && template.blocks.length > 0 && typeof template.blocks[0] === 'object'
        );
        if (!syncedRealBlocksRef.current && historyIndex === 0 && !hasUncommittedChanges) {
            if (nowHasRealBlocks) {
                const unique = ensureUniqueIds(template!.blocks);
                syncedRealBlocksRef.current = true;
                latestBlocksRef.current = unique;
                setBlocks(unique);
                setHistory([unique]);
                setHistoryIndex(0);
                setSavedHistoryIndex(0);
                setEditorMode('visual');
                if (template?.bodyStyle) setBodyStyle(template.bodyStyle);
                if (template?.htmlContent) setCustomHtml(template.htmlContent);
            } else if (!expectsBlocks && template?.htmlContent) {
                syncedRealBlocksRef.current = true;
                setCustomHtml(template.htmlContent);
                setEditorMode('code');
                if (template?.bodyStyle) setBodyStyle(template.bodyStyle);
            }
        }
    }, [template, expectsBlocks, historyIndex, hasUncommittedChanges]);

    useEffect(() => {
        if (!template?.id || template.id.startsWith('sys_') || syncedRealBlocksRef.current) return;
        let cancelled = false;
        api.get<Template>(`templates/${template.id}`, { force: true })
            .then(res => {
                if (cancelled || syncedRealBlocksRef.current) return;
                if (res.success && res.data) {
                    const full = res.data;
                    const fullHasBlocks = Boolean(full.blocks && full.blocks.length > 0 && typeof full.blocks[0] === 'object');
                    if (fullHasBlocks) {
                        const unique = ensureUniqueIds(full.blocks);
                        syncedRealBlocksRef.current = true;
                        latestBlocksRef.current = unique;
                        setBlocks(unique);
                        setHistory([unique]);
                        setHistoryIndex(0);
                        setSavedHistoryIndex(0);
                        setEditorMode('visual');
                        if (full.bodyStyle) setBodyStyle(full.bodyStyle);
                        if (full.htmlContent) setCustomHtml(full.htmlContent);
                    } else if (full.htmlContent) {
                        syncedRealBlocksRef.current = true;
                        setCustomHtml(full.htmlContent);
                        setEditorMode('code');
                        if (full.bodyStyle) setBodyStyle(full.bodyStyle);
                    }
                }
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [template?.id]);

    const [savedSections, setSavedSections] = useState<{ id: string, name: string, data: EmailBlock }[]>([]);
    const [saveSectionModal, setSaveSectionModal] = useState<{ isOpen: boolean, block: EmailBlock | null, name: string }>({ isOpen: false, block: null, name: '' });

    // ── Validation state ──────────────────────────────────────────────────────
    const [showValidation, setShowValidation] = useState(false);
    const [validationIssues, setValidationIssues] = useState<ValidationIssue[] | undefined>(undefined);

    // ── AI Generator state ────────────────────────────────────────────────────
    const [showAIModal, setShowAIModal] = useState(false);
    const [isApplyingAI, setIsApplyingAI] = useState(false);

    const runValidation = useCallback(() => {
        const issues = scanBlocks(blocks);
        setValidationIssues(issues);

        if (issues.length === 0) {
            setShowValidation(false);
            toast.success('Email đã sẵn sàng! Không có vấn đề nào.', { icon: '✅', id: 'validation-toast' });
        } else {
            setShowValidation(true);
            toast(`Tìm thấy ${issues.length} vấn đề cần xem lại`, { icon: '⚠️', id: 'validation-toast' });
        }

        setSelectedBlockId(null);
    }, [blocks]);

    /** Silent scan: update badge count only, no panel open, no toast */
    const silentScan = useCallback(() => {
        setValidationIssues(scanBlocks(blocks));
    }, [blocks]);

    const handleFocusValidationBlock = useCallback((blockId: string) => {
        setSelectedBlockId(blockId);
        // Scroll into view after microtask
        setTimeout(() => {
            const el = document.getElementById(`block-${blockId}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
    }, []);


    useEffect(() => {
        const fetchSections = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/email_sections.php`);
                const data = await res.json();
                if (data.success && Array.isArray(data.data)) {
                    setSavedSections(data.data);
                } else {
                    const saved = localStorage.getItem('mailflow_saved_sections');
                    if (saved) {
                        try { setSavedSections(JSON.parse(saved)); } catch (e) { }
                    }
                }
            } catch (err) {
                console.error('Lỗi khi tải mẫu section từ DB:', err);
            }
        };
        fetchSections();

        // Prevent accidental tab close or reload while editing
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = ''; // Standard way to show browser's default warning dialog
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, []);

    // Auto-scan on mount to show badge immediately (silent, no panel)
    useEffect(() => {
        const timer = setTimeout(() => silentScan(), 300);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // only on mount



    const addToHistory = useCallback((newBlocks: EmailBlock[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newBlocks);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        if (historyDebounceRef.current) {
            clearTimeout(historyDebounceRef.current);
            historyDebounceRef.current = null;
        }
        setHasUncommittedChanges(false);
        setHistoryIndex(newHistory.length - 1);
        setBlocks(newBlocks);
    }, [history, historyIndex]);

    /**
     * Auto-fix duplicate links: append mc_cta=1, mc_cta=2... to each block in the group.
     * Pushes to undo history so it is reversible.
     */
    const handleAutoFixDuplicates = useCallback((groupIds: string[], _baseUrl: string) => {
        const applyDeep = (list: EmailBlock[], idxMap: Map<string, number>): EmailBlock[] => {
            return list.map(b => {
                if (idxMap.has(b.id) && b.url) {
                    const idx = idxMap.get(b.id)!;
                    return { ...b, url: applyCtaTracking(b.url, idx) };
                }
                if (b.children?.length) {
                    return { ...b, children: applyDeep(b.children, idxMap) };
                }
                return b;
            });
        };
        const idxMap = new Map(groupIds.map((id, i) => [id, i]));
        const newBlocks = applyDeep(blocks, idxMap);
        addToHistory(newBlocks);

        // Auto re-scan issues with the new blocks
        const newIssues = scanBlocks(newBlocks);
        setValidationIssues(newIssues);
        if (newIssues.length === 0) setShowValidation(false);

        toast.success(`Đã tự động gắn tracking (mc_cta) cho ${groupIds.length} liên kết trùng.`, { icon: '🔗' });
    }, [blocks, addToHistory]);

    /**
     * Auto-fix wrong unsubscribe URL: replace badHref with {{unsubscribe_url}} in the block's HTML content.
     * Also handles missing_unsubscribe case: if text "Unsubscribe" exists without an href, wraps it.
     */
    const handleAutoFixUnsubscribe = useCallback((blockId: string, badHref?: string) => {
        let changedAny = false;
        const fixDeep = (list: EmailBlock[]): EmailBlock[] => {
            return list.map(b => {
                let currentChanged = false;
                let bCopied = { ...b };
                if ((blockId === '__email_root__' || b.id === blockId) && (b.type === 'text' || b.type === 'quote')) {
                    let html = b.content || '';
                    const oldHtml = html;
                    if (badHref) {
                        const escaped = badHref.replace(/[.*+?^\$\{\}()|[\]\\\/]/g, '\\$&');
                        html = html.replace(
                            new RegExp(`href=["']${escaped}["']`, 'gi'),
                            'href="{{unsubscribe_url}}"'
                        );
                    } else {
                        html = html.replace(
                            /(?<!<a[^>]*>)(Unsubscribe|Hủy đăng ký)(?!<\/a>)/gi,
                            '<a href="{{unsubscribe_url}}" style="color:inherit; text-decoration:underline;">$1</a>'
                        );
                    }
                    if (html !== oldHtml) {
                        changedAny = true;
                        currentChanged = true;
                        bCopied.content = html;
                    }
                }
                if (b.children?.length) {
                    bCopied.children = fixDeep(b.children);
                }
                return bCopied;
            });
        };
        const newBlocks = fixDeep(blocks);
        if (changedAny || blockId !== '__email_root__') {
            addToHistory(newBlocks);
            const newIssues = scanBlocks(newBlocks);
            setValidationIssues(newIssues);
            
            const len1 = newIssues.filter(i => i.type !== 'missing_unsubscribe' && i.type !== 'wrong_unsubscribe_url').length;
            if (len1 === 0 && newIssues.length === 0) setShowValidation(false);
            
            if (changedAny && blockId === '__email_root__') {
                toast.success('Đã tự động gán link Unsubscribe thành công!', { icon: '✅' });
            } else {
                toast.success('Đã gắn {{unsubscribe_url}} thành công!', { icon: '✅' });
            }
        } else if (blockId === '__email_root__') {
            toast.error('Không tìm thấy từ khóa "Unsubscribe" hoặc "Hủy đăng ký" trong văn bản để tự gắn link. Vui lòng tự thêm khối Footer.');
        }
    }, [blocks, addToHistory]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            setBlocks(history[newIndex]);
            setSelectedBlockId(null);
        }
    }, [history, historyIndex]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            setBlocks(history[newIndex]);
        }
    }, [history, historyIndex]);

    const handleSaveData = useCallback(async () => {
        const currentBlocks = latestBlocksRef.current;
        const finalHtml = editorMode === 'code' ? customHtml : compileHTML(currentBlocks, bodyStyle, name);
        const effectiveVisibility: TemplateVisibilityMode = (!canSetShared && visibility === 'shared') ? 'personal' : visibility;
        const finalAccessConfig: TemplateAccessConfig = {
            ...accessConfig,
            visibility: effectiveVisibility,
        };
        if (historyDebounceRef.current) {
            clearTimeout(historyDebounceRef.current);
            historyDebounceRef.current = null;
        }
        setHasUncommittedChanges(false);
        setSavedHistoryIndex(historyIndex);

        let capturedThumb = '';
        try {
            capturedThumb = await Promise.race([
                captureEmailTopWebp(finalHtml, editorMode === 'code' ? [] : currentBlocks, bodyStyle, name),
                new Promise<string>(resolve => setTimeout(() => resolve(''), 800))
            ]);
        } catch {
            capturedThumb = '';
        }
        await onSave({
            name,
            groupId,
            visibility: effectiveVisibility,
            accessConfig: finalAccessConfig,
            blocks: (currentBlocks && currentBlocks.length > 0) ? currentBlocks : [],
            bodyStyle: {
                ...(bodyStyle || DEFAULT_BODY_STYLE),
                visibility: effectiveVisibility,
                accessConfig: finalAccessConfig,
            } as any,
            htmlContent: finalHtml,
            thumbnail: capturedThumb || template?.thumbnail || ''
        });
        setTimeout(() => silentScan(), 0);
    }, [editorMode, customHtml, bodyStyle, name, groupId, visibility, accessConfig, canSetShared, historyIndex, onSave, silentScan, template?.thumbnail]);

    // Keyboard Shortcuts: Ctrl+Z (Undo), Ctrl+Y/Ctrl+Shift+Z (Redo), Ctrl+S (Save)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey) {
                const key = e.key.toLowerCase();
                if (key === 'z') {
                    if (e.shiftKey) {
                        e.preventDefault();
                        handleRedo();
                    } else {
                        e.preventDefault();
                        handleUndo();
                    }
                } else if (key === 'y') {
                    e.preventDefault();
                    handleRedo();
                } else if (key === 's') {
                    e.preventDefault();
                    handleSaveData();
                    toast.success('Đã lưu!', { duration: 1500, icon: '💾' });
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo, handleSaveData]);


    const updateBlocks = (newBlocks: EmailBlock[], pushToHistory: boolean = true) => {
        latestBlocksRef.current = newBlocks;
        if (pushToHistory) {
            addToHistory(newBlocks);
        } else {
            setBlocks(newBlocks);
            setHasUncommittedChanges(true);
            if (historyDebounceRef.current) clearTimeout(historyDebounceRef.current);
            historyDebounceRef.current = setTimeout(() => {
                historyDebounceRef.current = null;
                setHistory(prev => {
                    const next = [...prev.slice(0, historyIndex + 1), newBlocks];
                    if (next.length > 50) next.shift();
                    setHistoryIndex(next.length - 1);
                    return next;
                });
                setHasUncommittedChanges(false);
            }, 600);
        }
        // Invalidate validation when blocks change
        if (validationIssues !== undefined) {
            setValidationIssues(undefined);
        }
    };

    const handleSaveSection = (block: EmailBlock) => {
        setSaveSectionModal({ isOpen: true, block, name: `Section ${savedSections.length + 1}` });
    };

    const confirmSaveSection = async () => {
        if (saveSectionModal.block && saveSectionModal.name) {
            const blockData = duplicateBlockDeep(saveSectionModal.block);
            const newSaved = {
                id: crypto.randomUUID(),
                name: saveSectionModal.name,
                data: blockData
            };
            
            const updatedList = [newSaved, ...savedSections];
            setSavedSections(updatedList);
            setSaveSectionModal({ isOpen: false, block: null, name: '' });
            
            try {
                const res = await fetch(`${API_BASE_URL}/email_sections.php`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newSaved)
                });
                const result = await res.json();
                if (result.success) {
                    toast.success('Đã lưu mẫu giao diện vào CSDL an toàn.');
                } else {
                    toast.error(result.error || 'Lỗi khi lưu DB, giao diện mới chỉ nằm trên trình duyệt.');
                }
            } catch (error) {
                toast.error('Lỗi kết nối máy chủ.');
            }
        }
    };

    const handleDeleteSavedSection = async (id: string) => {
        const updatedList = savedSections.filter(s => s.id !== id);
        setSavedSections(updatedList);
        
        try {
            const res = await fetch(`${API_BASE_URL}/email_sections.php?id=${id}`, {
                method: 'DELETE'
            });
            const result = await res.json();
            if (result.success) {
                toast.success('Đã xóa mẫu khỏi thư viện (Database).');
            } else {
                toast.error(result.error || 'Xóa thất bại trên CSDL.');
            }
        } catch (error) {
           toast.error('Lỗi khi xóa khỏi máy chủ.'); 
        }
    };

    const handleSendTest = async (email: string) => {
        try {
            const finalHtml = editorMode === 'code' ? customHtml : compileHTML(blocks, bodyStyle, name);

            const result = await api.post<any>('send_test_email', {
                email,
                subject: name,
                content: finalHtml
            });

            if (result.success) {
                toast.success(`Đã gửi email test đến ${email}`);
            } else {
                toast.error(result.message || result.error || 'Gửi thất bại');
            }
        } catch (error) {
            toast.error('Lỗi kết nối server');
            console.error('Send test error:', error);
        }
    };

    const renderEmailToolbox = () => (
        <EmailToolbox
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={(id) => {
                setSelectedBlockId(id);
                if (isMobileOrTablet) setIsToolboxOpen(false);
            }}
            savedSections={savedSections}
            onLoadTemplate={(tpl) => {
                updateBlocks(tpl);
                if (isMobileOrTablet) setIsToolboxOpen(false);
            }}
            onDeleteSavedSection={handleDeleteSavedSection}
            onDragStart={(e, type, layout) => {
                if (type === 'saved' && layout) {
                    e.dataTransfer.setData('type', 'saved');
                    e.dataTransfer.setData('payload', layout);
                } else {
                    e.dataTransfer.setData('type', type);
                    if (layout) e.dataTransfer.setData('layout', layout);
                }
                e.dataTransfer.effectAllowed = 'copyMove';
            }}
        />
    );

    const renderEmailProperties = () => (
        <EmailProperties
            selectedBlock={(function find(list: EmailBlock[]): EmailBlock | null {
                for (let b of list) {
                    if (b.id === selectedBlockId) return b;
                    if (b.children) {
                        const f = find(b.children);
                        if (f) return f;
                    }
                }
                return null;
            })(blocks)}
            bodyStyle={bodyStyle}
            deviceMode={viewMode}
            blocks={blocks}
            customMergeTags={customMergeTags}
            onUpdateBlock={(id, data) => {
                const updateDeep = (list: EmailBlock[]): EmailBlock[] => {
                    return list.map(b => {
                        if (b.id === id) {
                            const newStyle = { ...b.style, ...(data.style || {}) };
                            if (data.style?.mobile) { newStyle.mobile = { ...b.style.mobile, ...data.style.mobile }; }
                            return { ...b, ...data, style: newStyle };
                        }
                        if (b.children) return { ...b, children: updateDeep(b.children) };
                        return b;
                    });
                };
                updateBlocks(updateDeep(latestBlocksRef.current), false);
            }}
            onUpdateBodyStyle={setBodyStyle}
            onDeleteBlock={(id) => { updateBlocks(deleteBlockDeep(blocks, id)); setSelectedBlockId(null); }}
            onDuplicateBlock={(block) => {
                const newBlock = duplicateBlockDeep(block);
                const insertAfter = (list: EmailBlock[]): EmailBlock[] => {
                    const idx = list.findIndex(x => x.id === block.id);
                    if (idx !== -1) {
                        const copy = [...list];
                        copy.splice(idx + 1, 0, newBlock);
                        return copy;
                    }
                    return list.map(item => item.children ? { ...item, children: insertAfter(item.children) } : item);
                };
                updateBlocks(insertAfter(blocks));
                setSelectedBlockId(newBlock.id);
            }}
            onDeselect={() => setSelectedBlockId(null)}
        />
    );

    const editorContent = (
        <div className="fixed inset-0 z-[2147483630] bg-[#f1f5f9] flex flex-col animate-in zoom-in-[0.98] fade-in slide-in-from-bottom-4 duration-300 font-sans shadow-2xl" style={{ zIndex: 2147483630 }}>
            <EmailTopBar
                name={name} setName={setName}
                groupId={groupId} setGroupId={setGroupId}
                groups={groups}
                editorMode={editorMode} setEditorMode={handleSetEditorMode}
                viewMode={viewMode} setViewMode={setViewMode} canUndo={historyIndex > 0} canRedo={historyIndex < history.length - 1}
                onUndo={handleUndo} onRedo={handleRedo} onSave={handleSaveData} onCancel={onCancel}
                onPreview={() => { const win = window.open(); win?.document.write(editorMode === 'code' ? customHtml : compileHTML(blocks, bodyStyle, name, { isPreview: true })); }}
                onSendTest={(email) => handleSendTest(email)}
                onOpenTestModal={() => setIsTestModalOpen(true)}
                onOpenAIModal={() => setShowAIModal(true)}
                onValidate={runValidation}
                validationIssueCount={validationIssues?.length}
                showValidation={showValidation}
                isDirty={isDirty}
                visibility={visibility}
                setVisibility={setVisibility}
                accessConfig={accessConfig}
                setAccessConfig={setAccessConfig}
                canSetShared={canSetShared}
            />
            <div className="flex-1 flex overflow-hidden relative">
                {editorMode === 'visual' && !isMobileOrTablet && renderEmailToolbox()}

                {/* Canvas wrapper — button nằm sticky góc dưới phải canvas */}
                <div className="relative flex-1 flex overflow-hidden">
                    <EmailCanvas
                        mode={editorMode}
                        blocks={blocks}
                        bodyStyle={bodyStyle}
                        viewMode={viewMode}
                        customHtml={customHtml}
                        selectedBlockId={selectedBlockId}
                        onSelectBlock={(id) => {
                            setSelectedBlockId(id);
                            if (isMobileOrTablet && id) setIsPropertiesOpen(true);
                        }}
                        onUpdateBlocks={updateBlocks}
                        setCustomHtml={setCustomHtml}
                        onSaveSection={handleSaveSection}
                        customMergeTags={customMergeTags}
                    />
                    {/* Floating AI Button — góc dưới phải canvas */}
                    {editorMode === 'visual' && (
                        <button
                            type="button"
                            onClick={() => setShowAIModal(true)}
                            title="Thiết kế & Tinh chỉnh Email bằng AI"
                            className="group transition-all duration-200 hover:scale-105 active:scale-95 outline-none focus:outline-none"
                            style={{
                                position: 'absolute',
                                bottom: '24px',
                                right: '24px',
                                zIndex: 99,
                                width: '48px',
                                height: '48px',
                                borderRadius: '16px',
                                background: 'linear-gradient(135deg, #BD1D2D, #991B1B)',
                                boxShadow: '0 8px 24px rgba(189,29,45,0.35), 0 2px 6px rgba(0,0,0,0.12)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Sparkles className="w-5 h-5 text-white" />
                            {/* Tooltip */}
                            <span
                                className="absolute right-full mr-3 px-3 py-1.5 rounded-[10px] text-xs font-bold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 -translate-x-1 group-hover:translate-x-0"
                                style={{ background: '#0f172a', boxShadow: '0 4px 12px rgba(15,23,42,0.25)' }}
                            >
                                Tạo & Chỉnh sửa bằng AI
                            </span>
                        </button>
                    )}
                </div>

                {editorMode === 'visual' && showValidation && validationIssues !== undefined ? (
                    <EmailValidationPanel
                        issues={validationIssues}
                        onClose={() => setShowValidation(false)}
                        onFocusBlock={handleFocusValidationBlock}
                        onRerun={runValidation}
                        onAutoFixDuplicates={handleAutoFixDuplicates}
                        onAutoFixUnsubscribe={handleAutoFixUnsubscribe}
                    />
                ) : editorMode === 'visual' && !isMobileOrTablet ? (
                    renderEmailProperties()
                ) : null}

                {/* Mobile / Tablet Drawer: Left Toolbox */}
                {isMobileOrTablet && isToolboxOpen && (
                    <div className="fixed inset-0 z-[2147483620] flex" style={{ zIndex: 2147483620 }}>
                        <div
                            className="fixed inset-0 bg-black/40 backdrop-blur-xs drawer-backdrop"
                            onClick={() => setIsToolboxOpen(false)}
                        />
                        <div
                            className="relative z-10 w-[320px] max-w-[90vw] h-full bg-white shadow-2xl flex flex-col drawer-panel"
                            style={{ zIndex: 2147483625 }}
                        >
                            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 bg-slate-50">
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5 text-[#BD1D2D]" />
                                    Khối nội dung Email
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsToolboxOpen(false)}
                                    className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 border-none bg-transparent cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {renderEmailToolbox()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Mobile / Tablet Drawer: Right Properties */}
                {isMobileOrTablet && isPropertiesOpen && (
                    <div className="fixed inset-0 z-[2147483620] flex justify-end" style={{ zIndex: 2147483620 }}>
                        <div
                            className="fixed inset-0 bg-black/40 backdrop-blur-xs drawer-backdrop"
                            onClick={() => setIsPropertiesOpen(false)}
                        />
                        <div
                            className="relative z-10 w-[360px] max-w-[92vw] h-full bg-white shadow-2xl flex flex-col drawer-panel"
                            style={{ zIndex: 2147483625 }}
                        >
                            <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-200 bg-slate-50">
                                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#BD1D2D]" />
                                    Thuộc tính khối
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setIsPropertiesOpen(false)}
                                    className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-200 border-none bg-transparent cursor-pointer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {renderEmailProperties()}
                            </div>
                        </div>
                    </div>
                )}

                {/* Mobile Floating Bottom Action Dock */}
                {isMobileOrTablet && editorMode === 'visual' && (
                    <div
                        className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 text-white backdrop-blur-md shadow-2xl border border-white/10"
                        style={{ zIndex: 1000 }}
                    >
                        <button
                            type="button"
                            onClick={() => setIsToolboxOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white border-none cursor-pointer"
                        >
                            <Layers className="w-3.5 h-3.5 text-red-400" />
                            <span>Khối</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsPropertiesOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-white border-none cursor-pointer"
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                            <span>Thuộc tính</span>
                            {selectedBlockId && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                        </button>
                    </div>
                )}
            </div>


            {/* Samsung AI scan overlay */}
            {isApplyingAI && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 198, pointerEvents: 'none', overflow: 'hidden' }}>
                    <div style={{
                        position: 'absolute', inset: 0,
                        animation: 'aiFadeOut 0.9s ease forwards'
                    }} />
                    <div style={{
                        position: 'absolute', left: 0, right: 0, height: '140px',
                        background: 'linear-gradient(to bottom, transparent, rgba(251,191,36,0.3), rgba(251,191,36,0.1), transparent)',
                        animation: 'aiScanLine 0.85s cubic-bezier(0.25,0.46,0.45,0.94) forwards',
                        top: 0
                    }} />
                    <style>{`
                        @keyframes aiScanLine {
                            0%   { transform: translateY(-140px); opacity: 0; }
                            10%  { opacity: 1; }
                            90%  { opacity: 1; }
                            100% { transform: translateY(calc(100vh + 140px)); opacity: 0; }
                        }
                        @keyframes aiFadeOut {
                            0%   { background: rgba(255,255,255,0.12); }
                            50%  { background: rgba(255,255,255,0.06); }
                            100% { background: rgba(255,255,255,0); }
                        }
                    `}</style>
                </div>
            )}

            {saveSectionModal.isOpen && (
                <Modal
                    isOpen={saveSectionModal.isOpen}
                    onClose={() => setSaveSectionModal({ isOpen: false, block: null, name: '' })}
                    title="Lưu mẫu giao diện (Section)"
                    size="sm"
                    zIndex={2147483645}
                    footer={
                        <div className="flex justify-between w-full">
                            <Button variant="ghost" onClick={() => setSaveSectionModal({ isOpen: false, block: null, name: '' })}>Hủy</Button>
                            <Button onClick={confirmSaveSection} icon={Save} disabled={!saveSectionModal.name.trim()}>Lưu ngay</Button>
                        </div>
                    }
                >
                    <div className="space-y-6">
                        <div className="p-4 bg-[#BD1D2D]/5 border border-[#BD1D2D]/15 rounded-[14px] flex gap-4 items-center">
                            <div className="p-3 bg-white rounded-[14px] shadow-sm text-[#BD1D2D]">
                                <Box className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-900">Reusable Block</p>
                                <p className="text-[11px] text-slate-600 leading-tight mt-0.5">Lưu lại block này vào thư viện để tái sử dụng nhanh chóng cho các email khác.</p>
                            </div>
                        </div>
                        <Input
                            label="Tên gợi nhớ"
                            placeholder="VD: Header Logo, Footer Social..."
                            value={saveSectionModal.name}
                            onChange={(e) => setSaveSectionModal({ ...saveSectionModal, name: e.target.value })}
                            autoFocus
                        />
                    </div>
                </Modal>
            )}


            {/* AI Email Generator Modal */}
            <React.Suspense fallback={null}><AIEmailGeneratorModal
                isOpen={showAIModal}
                onClose={() => setShowAIModal(false)}
                onSaveSection={handleSaveSection}
                onApply={(newBlocks) => {
                    setShowAIModal(false);
                    // Samsung AI fade effect
                    setIsApplyingAI(true);
                    setTimeout(() => {
                        updateBlocks(ensureUniqueIds(newBlocks));
                        setSelectedBlockId(null);
                    }, 200);
                    setTimeout(() => {
                        setIsApplyingAI(false);
                        toast.success('🎉 Email AI đã được áp dụng!', { duration: 2500 });
                    }, 950);
                }}
                currentBlocks={blocks}
                bodyStyle={bodyStyle}
                templateName={name}
                emailId={template?.id}
            /></React.Suspense>

            <TestEmailModal
                isOpen={isTestModalOpen}
                onClose={() => setIsTestModalOpen(false)}
                campaignName={name}
                onSend={async (emails, senderEmail, senderName) => {
                    const finalHtml = editorMode === 'code' ? customHtml : compileHTML(blocks, bodyStyle, name);
                    const result = await api.post<any>('send_test_email', {
                        emails,
                        email: emails[0] || '',
                        subject: name,
                        htmlContent: finalHtml,
                        content: finalHtml,
                        sender_email: senderEmail || undefined,
                        from_email: senderEmail || undefined,
                        sender_name: senderName || undefined,
                        from_name: senderName || undefined,
                    });
                    if (result.success) {
                        toast.success(`Đã gửi email test đến ${emails.length} người nhận${senderEmail ? ` (từ ${senderEmail})` : ''}!`);
                        setIsTestModalOpen(false);
                    } else {
                        toast.error(result.message || result.error || 'Gửi thất bại');
                        throw new Error(result.message || result.error || 'Gửi thất bại');
                    }
                }}
            />

        </div>
    );

    return createPortal(editorContent, getMktPortalRoot());
};

export default EmailEditor;

