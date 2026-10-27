import * as React from 'react';
import { useEffect, useState, useMemo, useCallback, useRef, memo, lazy, Suspense } from 'react';
import { api } from '../../components/marketing/services/storageAdapter';
import { Template, TemplateGroup, EmailBlock } from '../../components/marketing/types';
import { logAction } from '../../components/marketing/services/historyService';
import {
    Edit3, Copy, Trash2, Plus, Layout, Eye, Sparkles, FolderOpen, Globe,
    FolderPlus, Check, X, AlertCircle, Image as ImageIcon, SearchX, User,
    Folder, ChevronDown, Search, Users, Lock, ShieldCheck
} from 'lucide-react';
import PageHero from '../../components/marketing/components/common/PageHero';
import Button from '../../components/marketing/components/common/Button';
import SearchBox from '../../components/marketing/components/common/SearchBox';
import Pagination from '../../components/marketing/components/common/Pagination';
// @ts-ignore: `compileHTML` is a named export from `htmlCompiler`
import { compileHTML } from '../../components/marketing/components/templates/EmailEditor/utils/htmlCompiler';
import { captureEmailTopWebp } from '../../components/marketing/components/templates/EmailEditor/utils/thumbnailCapture';
import { DEFAULT_BODY_STYLE } from '../../components/marketing/components/templates/EmailEditor/constants/editorConstants';
import { ensureUniqueIds } from '../../components/marketing/components/templates/EmailEditor/utils/blockUtils';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/marketing/components/common/ConfirmModal';
import Modal from '../../components/marketing/components/common/Modal';
import Input from '../../components/marketing/components/common/Input';
import Select from '../../components/marketing/components/common/Select';
import { SYSTEM_TEMPLATES } from '../../components/marketing/services/systemTemplates';
import { CardGridSkeleton } from '../../components/marketing/components/common/PageSkeleton';
import { useIsAdmin } from '../../components/marketing/hooks/useAuthUser';
import { usePermissionGuard } from '../../components/marketing/components/common/PermissionGuard';
import { Avatar } from '../../components/ui/Avatar';
import { useAuth } from '../../contexts/AuthContext';
import EmailEditor from '../../components/marketing/components/templates/EmailEditor/index';
import TemplateAccessModal, {
    type TemplateAccessConfig,
    type TemplateVisibilityMode,
    normalizeTemplateAccessConfig,
    canUserViewTemplate,
    canUserEditTemplate,
    isTemplateOwner,
    countAccessTargets,
    preloadAccessDirectory
} from '../../components/marketing/components/templates/TemplateAccessModal';

import AIEmailModal from '../../components/marketing/components/templates/EmailEditor/AIEmailGeneratorModal';
import ImageLibraryModal, { preloadImageLibrary } from '../../components/marketing/components/templates/EmailEditor/components/Properties/ImageLibraryModal';

// [PERF] Lazy-load secondary drawers
const EmailPreviewDrawer = lazy(() => import('../../components/marketing/components/flows/config/EmailPreviewDrawer'));

const PAGE_SIZE = 12;

type SortBy = 'newest' | 'name_asc' | 'name_desc';

const SORT_OPTIONS = [
    { value: 'newest', label: 'Mới cập nhật' },
    { value: 'name_asc', label: 'Tên A → Z' },
    { value: 'name_desc', label: 'Tên Z → A' },
];

// ─── Module-level In-Memory Caches for 0ms Instant Page & Editor Load ────────
let cachedUserTemplates: Template[] | null = null;
let cachedTemplateGroups: TemplateGroup[] | null = null;
let cachedMergeTags: { label: string; key: string }[] | null = null;
const fullTemplateBlocksCache = new Map<string, Template>();
const prefetchingTemplateIds = new Set<string>();
const compiledPreviewHtmlCache = new Map<string, string>();

export function invalidateEmailTemplatesMemoryCache(templateId?: string, updatedTemplate?: Template): void {
    if (templateId) {
        if (updatedTemplate && updatedTemplate.blocks && Array.isArray(updatedTemplate.blocks) && typeof updatedTemplate.blocks[0] === 'object') {
            fullTemplateBlocksCache.set(templateId, updatedTemplate);
        } else {
            fullTemplateBlocksCache.delete(templateId);
        }
        prefetchingTemplateIds.delete(templateId);
        for (const key of Array.from(compiledPreviewHtmlCache.keys())) {
            if (key.startsWith(`${templateId}::`)) {
                compiledPreviewHtmlCache.delete(key);
            }
        }
        if (cachedUserTemplates && updatedTemplate) {
            cachedUserTemplates = cachedUserTemplates.map(t => t.id === templateId ? { ...t, ...updatedTemplate } : t);
        } else {
            cachedUserTemplates = null;
        }
    } else {
        cachedUserTemplates = null;
        fullTemplateBlocksCache.clear();
        prefetchingTemplateIds.clear();
        compiledPreviewHtmlCache.clear();
    }
}

const fmtTemplateDate = (tpl: Template) => {
    if (tpl.id.startsWith('sys_')) return 'Mẫu hệ thống';
    const raw = tpl.created_at || tpl.createdAt || tpl.lastModified;
    if (!raw) return '';
    const d = new Date(raw);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const getTemplateVisibility = (tpl: Template): TemplateVisibilityMode => {
    if (tpl.id.startsWith('sys_')) return 'system';
    const rawVis = tpl.visibility || tpl.accessConfig?.visibility || (tpl.bodyStyle as any)?.visibility;
    if (rawVis === 'personal' || rawVis === 'custom' || rawVis === 'shared' || rawVis === 'system') {
        return rawVis;
    }
    return 'shared';
};

const buildFastPreviewDoc = (rawHtml: string): string => {
    if (!rawHtml) return '';
    // Strip scripts inside preview iframe so browser never spins up JS VMs for card thumbnails
    const clean = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;overflow:hidden;background:#ffffff;pointer-events:none;user-select:none;}::-webkit-scrollbar{display:none;}img{max-width:100%;content-visibility:auto;}</style></head><body>${clean}</body></html>`;
};

const VisualTemplate: React.FC<{ template: Template; index?: number }> = memo(({ template, index = 0 }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.42);
    const [readyToMountIframe, setReadyToMountIframe] = useState(index < 4);

    // [PERF] Memoize + module-cache compiled HTML document so it is computed at most once per template
    const srcDoc = useMemo(() => {
        if (!template) return '';
        const cacheKey = `${template.id}::${template.lastModified || ''}::${(template.htmlContent || '').length}`;
        const hit = compiledPreviewHtmlCache.get(cacheKey);
        if (hit !== undefined) return hit;

        let raw = template.htmlContent || '';
        if (!raw && template.blocks && template.blocks.length > 0 && typeof template.blocks[0] === 'object') {
            raw = compileHTML(template.blocks, template.bodyStyle, template.name);
        }
        const doc = raw ? buildFastPreviewDoc(raw) : '';
        if (doc) {
            if (compiledPreviewHtmlCache.size > 250) {
                const firstKey = compiledPreviewHtmlCache.keys().next().value;
                if (firstKey) compiledPreviewHtmlCache.delete(firstKey);
            }
            compiledPreviewHtmlCache.set(cacheKey, doc);
        }
        return doc;
    }, [template]);

    // [PERF] Stagger iframe mounting across animation frames so all 12 cards paint at 60fps with 0ms freeze
    useEffect(() => {
        if (readyToMountIframe) return;
        let rafId: number;
        const timer = setTimeout(() => {
            rafId = requestAnimationFrame(() => setReadyToMountIframe(true));
        }, Math.min(index * 18, 140));
        return () => {
            clearTimeout(timer);
            if (rafId) cancelAnimationFrame(rafId);
        };
    }, [index, readyToMountIframe]);

    // [PERF] Measure width once on mount + lightweight ResizeObserver
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const w = el.clientWidth;
        if (w > 0) setScale(w / 600);

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    setScale(entry.contentRect.width / 600);
                }
            }
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={containerRef}
            className="email-canvas-scope w-full h-full bg-white dark:bg-slate-900 relative overflow-hidden flex items-start justify-center"
        >
            {readyToMountIframe && srcDoc ? (
                <div
                    className="absolute top-0 left-0 origin-top-left"
                    style={{
                        width: '600px',
                        height: '1000px',
                        transform: `scale(${scale})`,
                        pointerEvents: 'none',
                        willChange: 'transform'
                    }}
                >
                    <iframe
                        srcDoc={srcDoc}
                        sandbox=""
                        className="w-full h-full border-none"
                        title={template.name || 'preview'}
                        loading="lazy"
                        scrolling="no"
                    />
                </div>
            ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[var(--color-bg)] p-4 text-[var(--color-text-muted)]">
                    <Layout className="w-7 h-7 mb-1.5 opacity-40" />
                    <span className="text-[11px] font-medium">Xem trước</span>
                </div>
            )}
        </div>
    );
});
VisualTemplate.displayName = 'VisualTemplate';

interface TemplateCardProps {
    template: Template;
    index: number;
    isSelected: boolean;
    canModify: boolean;
    isOwn: boolean;
    groupName: string;
    onToggleSelect: (id: string) => void;
    onPreview: (template: Template) => void;
    onEdit: (template: Template) => void;
    onDuplicate: (template: Template) => void;
    onDelete: (id: string) => void;
    onOpenAccessModal: (template: Template) => void;
    onPrefetch: (template: Template) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = memo(({
    template,
    index,
    isSelected,
    canModify,
    isOwn,
    groupName,
    onToggleSelect,
    onPreview,
    onEdit,
    onDuplicate,
    onDelete,
    onOpenAccessModal,
    onPrefetch
}) => {
    const isSystem = template.id.startsWith('sys_');
    const visibility = getTemplateVisibility(template);
    const creatorObj = (template as any).creator || (template.bodyStyle as any)?.creator;
    const creatorName = isSystem ? 'Hệ thống' : (creatorObj?.name || creatorObj?.full_name || 'Hệ thống');
    const creatorPic = creatorObj?.avatar_url || creatorObj?.picture || creatorObj?.avatar;
    const isEditorBlock = Boolean(
        (template as any).hasBlocks ||
        (template.blocks && template.blocks.length > 0)
    );
    const customTargetCount = countAccessTargets(template.accessConfig || (template.bodyStyle as any)?.accessConfig);
    const [thumbBroken, setThumbBroken] = useState(false);

    useEffect(() => {
        setThumbBroken(false);
    }, [template.thumbnail]);

    const hasValidThumb = Boolean(
        template.thumbnail &&
        !template.thumbnail.includes('placehold.co') &&
        !thumbBroken
    );

    return (
        <div
            className={`bg-[var(--color-surface)] rounded-[18px] border overflow-hidden group transition-all duration-200 flex flex-col h-[340px] relative shadow-[var(--shadow-xs)] hover:shadow-md ${
                isSelected
                    ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-light)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
            }`}
        >
            {/* Selection Checkbox (modifiable user templates only) */}
            {!isSystem && canModify && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(template.id); }}
                    className={`absolute top-3 left-3 z-20 w-7 h-7 rounded-[var(--radius-md)] border flex items-center justify-center transition-all outline-none focus:outline-none cursor-pointer ${
                        isSelected
                            ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white shadow-sm'
                            : 'bg-[var(--color-surface)]/95 border-[var(--color-border)] text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 hover:border-[var(--color-primary)]'
                    }`}
                    title={isSelected ? 'Bỏ chọn mẫu' : 'Chọn mẫu'}
                >
                    <Check className={`w-4 h-4 transition-transform ${isSelected ? 'scale-100' : 'scale-0'}`} />
                </button>
            )}

            {/* Fixed Aspect-Ratio Thumbnail Area */}
            <div
                className="relative aspect-[16/10] w-full bg-[var(--color-bg)] border-b border-[var(--color-border-light)] overflow-hidden cursor-pointer shrink-0"
                onClick={() => onPreview(template)}
            >
                <div className="w-full h-full bg-white dark:bg-slate-900 flex items-center justify-center group-hover:scale-[1.03] transition-transform duration-500 ease-out overflow-hidden relative">
                    {hasValidThumb ? (
                        <img
                            src={template.thumbnail}
                            alt={template.name}
                            className="w-full h-full object-cover object-top"
                            loading="lazy"
                            decoding="async"
                            onError={() => setThumbBroken(true)}
                        />
                    ) : (
                        <VisualTemplate template={template} index={index} />
                    )}
                </div>

                {/* Hover Overlay Actions */}
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2.5 p-3">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onPreview(template); }}
                        className="h-8 px-3.5 bg-white text-slate-900 rounded-[var(--radius-md)] font-semibold text-xs hover:bg-[var(--color-primary)] hover:text-white transition-colors shadow-sm inline-flex items-center gap-1.5 outline-none focus:outline-none cursor-pointer"
                    >
                        <Eye className="w-3.5 h-3.5" /> Xem chi tiết
                    </button>

                    {isSystem || !canModify ? (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDuplicate(template); }}
                            className="h-8 px-3.5 bg-[var(--color-primary)] text-white rounded-[var(--radius-md)] font-semibold text-xs hover:opacity-90 transition-opacity shadow-sm inline-flex items-center gap-1.5 outline-none focus:outline-none cursor-pointer"
                        >
                            <Copy className="w-3.5 h-3.5" /> {isSystem ? 'Sử dụng mẫu' : 'Nhân bản về Của tôi'}
                        </button>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onEdit(template); }}
                                className="w-8 h-8 bg-white text-[var(--color-text)] rounded-[var(--radius-md)] hover:bg-[var(--color-primary)] hover:text-white shadow-sm flex items-center justify-center transition-colors outline-none focus:outline-none cursor-pointer"
                                title="Chỉnh sửa"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onMouseEnter={() => preloadAccessDirectory()}
                                onClick={(e) => { e.stopPropagation(); onOpenAccessModal(template); }}
                                className="w-8 h-8 bg-white text-[var(--color-text)] rounded-[var(--radius-md)] hover:bg-[var(--color-primary)] hover:text-white shadow-sm flex items-center justify-center transition-colors outline-none focus:outline-none cursor-pointer"
                                title="Phân quyền & Chia sẻ"
                            >
                                <ShieldCheck className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDuplicate(template); }}
                                className="w-8 h-8 bg-white text-[var(--color-text)] rounded-[var(--radius-md)] hover:bg-[var(--color-primary)] hover:text-white shadow-sm flex items-center justify-center transition-colors outline-none focus:outline-none cursor-pointer"
                                title="Nhân bản"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDelete(template.id); }}
                                className="w-8 h-8 bg-white text-rose-600 rounded-[var(--radius-md)] hover:bg-rose-600 hover:text-white shadow-sm flex items-center justify-center transition-colors outline-none focus:outline-none cursor-pointer"
                                title="Xóa"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Top-Right Format & Clickable Visibility Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10 pointer-events-none">
                    {isSystem ? (
                        <span className="bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-semibold shadow-xs">
                            Mẫu chuẩn
                        </span>
                    ) : (
                        <button
                            type="button"
                            disabled={!canModify}
                            onMouseEnter={() => { if (canModify) preloadAccessDirectory(); }}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (canModify) onOpenAccessModal(template);
                            }}
                            title={canModify ? 'Bấm để thay đổi phân quyền & chia sẻ' : undefined}
                            className={`px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-semibold shadow-xs inline-flex items-center gap-1 outline-none focus:outline-none transition-transform ${
                                canModify ? 'pointer-events-auto cursor-pointer hover:scale-105' : ''
                            } ${
                                visibility === 'personal'
                                    ? 'bg-amber-500/95 text-white'
                                    : visibility === 'custom'
                                        ? 'bg-[var(--color-primary)]/95 text-white'
                                        : 'bg-emerald-600/95 text-white'
                            }`}
                        >
                            {visibility === 'personal' ? (
                                <><Lock className="w-2.5 h-2.5" /> Riêng tư</>
                            ) : visibility === 'custom' ? (
                                <><Users className="w-2.5 h-2.5" /> Giới hạn ({customTargetCount})</>
                            ) : (
                                <><Globe className="w-2.5 h-2.5" /> Dùng chung</>
                            )}
                        </button>
                    )}
                    {isOwn && !isSystem && visibility !== 'personal' && (
                        <span className="bg-amber-500/95 text-white px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-semibold shadow-xs inline-flex items-center gap-1">
                            <User className="w-2.5 h-2.5" /> Của tôi
                        </span>
                    )}
                    <span className="bg-[var(--color-surface)]/95 backdrop-blur px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-semibold text-[var(--color-text-secondary)] shadow-xs inline-flex items-center gap-1 border border-[var(--color-border)]">
                        {isEditorBlock ? (
                            <><Sparkles className="w-3 h-3 text-[var(--color-primary)]" /> Kéo thả</>
                        ) : (
                            <><Layout className="w-3 h-3 text-[var(--color-text-muted)]" /> HTML</>
                        )}
                    </span>
                </div>
            </div>

            {/* Info Area */}
            <div className="p-3.5 flex-1 flex flex-col justify-between bg-[var(--color-surface)] min-w-0">
                <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-bg)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)] inline-flex items-center gap-1 truncate max-w-full">
                            <FolderOpen className="w-3 h-3 text-[var(--color-text-muted)] shrink-0" />
                            <span className="truncate">{isSystem ? 'Hệ thống' : groupName}</span>
                        </span>
                    </div>
                    <h3
                        className="font-semibold text-[var(--color-text)] text-sm group-hover:text-[var(--color-primary)] transition-colors line-clamp-2 leading-snug"
                        title={template.name}
                    >
                        {template.name}
                    </h3>
                </div>

                <div className="pt-2.5 mt-auto border-t border-[var(--color-border-light)] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                            name={creatorName}
                            src={creatorPic}
                            size={24}
                        />
                        <span className="text-xs text-[var(--color-text-secondary)] font-medium truncate" title={creatorName}>
                            {creatorName}
                        </span>
                    </div>
                    <span className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap shrink-0">
                        {fmtTemplateDate(template)}
                    </span>
                </div>
            </div>
        </div>
    );
});
TemplateCard.displayName = 'TemplateCard';

const Templates: React.FC = () => {
    const { user: erpUser } = useAuth();
    const domationIsAdmin = useIsAdmin();
    const effectiveIsAdmin = useMemo(() => {
        if (domationIsAdmin) return true;
        const r = String(erpUser?.role || '').toLowerCase();
        return ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'marketing'].includes(r);
    }, [domationIsAdmin, erpUser?.role]);

    const { guard: adminGuard, PermModal: AdminPermModal } = usePermissionGuard(effectiveIsAdmin);

    const currentUserId = useMemo(() => Number(erpUser?.id || 0), [erpUser?.id]);
    const currentUserEmail = useMemo(() => String(erpUser?.email || ''), [erpUser?.email]);
    const currentUserName = useMemo(() => String(erpUser?.full_name || erpUser?.name || ''), [erpUser?.full_name, erpUser?.name]);

    const getCurrentCreatorInfo = useCallback(() => {
        if (erpUser) {
            return {
                id: erpUser.id,
                name: erpUser.full_name || erpUser.name || erpUser.username || 'Người dùng',
                email: erpUser.email || '',
                avatar_url: erpUser.avatar_url || erpUser.avatar || '',
                picture: erpUser.avatar_url || erpUser.avatar || '/imgs/ICON.png'
            };
        }
        try {
            const raw = JSON.parse(localStorage.getItem('Ideas_user') || localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}');
            if (raw && (raw.full_name || raw.name)) {
                return {
                    id: raw.id,
                    name: raw.full_name || raw.name,
                    email: raw.email || '',
                    avatar_url: raw.avatar_url || raw.avatar || raw.picture || '',
                    picture: raw.avatar_url || raw.avatar || raw.picture || '/imgs/ICON.png'
                };
            }
        } catch {
            // ignore
        }
        return { name: 'Hệ thống', picture: '/imgs/ICON.png' };
    }, [erpUser]);

    const canModifyTemplate = useCallback((tpl?: Template | null) => {
        if (!tpl) return true;
        if (tpl.id.startsWith('sys_')) return false;
        return canUserEditTemplate(tpl, erpUser, effectiveIsAdmin);
    }, [erpUser, effectiveIsAdmin]);

    // [PERF] Initialize directly from memory cache or domationApi peek cache so re-mounts are 0ms with no skeleton
    const [userTemplates, setUserTemplates] = useState<Template[]>(() => {
        if (cachedUserTemplates) return cachedUserTemplates;
        const peeked = api.peek<Template[]>('templates');
        if (peeked?.value?.success && Array.isArray(peeked.value.data)) {
            cachedUserTemplates = peeked.value.data;
            return peeked.value.data;
        }
        return [];
    });

    const [groups, setGroups] = useState<TemplateGroup[]>(() => {
        if (cachedTemplateGroups) return cachedTemplateGroups;
        const peeked = api.peek<TemplateGroup[]>('template_groups');
        if (peeked?.value?.success && Array.isArray(peeked.value.data)) {
            cachedTemplateGroups = peeked.value.data;
            return peeked.value.data;
        }
        return [];
    });

    const [loading, setLoading] = useState<boolean>(() => cachedUserTemplates === null);
    const [customMergeTags, setCustomMergeTags] = useState<{ label: string; key: string }[]>(() => cachedMergeTags || []);
    const [isImageLibraryOpen, setIsImageLibraryOpen] = useState(false);

    // Editor & AI Modal State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | undefined>(undefined);
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [aiModalMounted, setAiModalMounted] = useState(false);

    // Granular Access Modal State (opened from Card Grid)
    const [accessModalTarget, setAccessModalTarget] = useState<Template | null>(null);

    // Group State
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [editingGroup, setEditingGroup] = useState<TemplateGroup | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [isSavingGroup, setIsSavingGroup] = useState(false);

    // Preview State
    const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);

    // Filter & Sort State
    const [filterGroupId, setFilterGroupId] = useState('all');
    const [sortBy, setSortBy] = useState<SortBy>('newest');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [isFolderPopoverOpen, setIsFolderPopoverOpen] = useState(false);
    const [folderSearchTerm, setFolderSearchTerm] = useState('');
    const folderPopoverRef = useRef<HTMLDivElement>(null);

    // Close folder popover on outside click or escape
    useEffect(() => {
        if (!isFolderPopoverOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (folderPopoverRef.current && !folderPopoverRef.current.contains(e.target as Node)) {
                setIsFolderPopoverOpen(false);
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setIsFolderPopoverOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isFolderPopoverOpen]);

    // Confirm Delete & Bulk State
    const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; ids: string[]; type: 'template' | 'group' }>({
        isOpen: false,
        ids: [],
        type: 'template'
    });
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isMovingGroups, setIsMovingGroups] = useState(false);
    const [usageBlockModal, setUsageBlockModal] = useState<{ isOpen: boolean; errors: string[] }>({
        isOpen: false,
        errors: []
    });

    // Synchronous guards
    const savingTemplateRef = useRef(false);
    const duplicatingRef = useRef(false);
    const deletingRef = useRef(false);
    const isMountedRef = useRef(true);

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    }, []);

    const syncUserTemplates = useCallback((updater: Template[] | ((prev: Template[]) => Template[])) => {
        setUserTemplates(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            cachedUserTemplates = next;
            return next;
        });
    }, []);

    const fetchGroups = useCallback(async () => {
        try {
            const res = await api.get<TemplateGroup[]>('template_groups');
            if (res.success && Array.isArray(res.data)) {
                cachedTemplateGroups = res.data;
                if (isMountedRef.current) setGroups(res.data);
            }
        } catch (error) {
            console.error('Fetch groups error:', error);
        }
    }, []);

    const fetchUserTemplates = useCallback(async (forceSpinner = false) => {
        if (forceSpinner || cachedUserTemplates === null) {
            setLoading(true);
        }
        try {
            const res = await api.get<Template[]>('templates');
            if (res.success) {
                const list = Array.isArray(res.data) ? res.data : [];
                cachedUserTemplates = list;
                if (isMountedRef.current) setUserTemplates(list);
            } else if (isMountedRef.current && cachedUserTemplates === null) {
                showToast(res.message || 'Lỗi khi tải danh sách mẫu', 'error');
            }
        } catch (error) {
            console.error('Fetch templates error:', error);
            if (isMountedRef.current && cachedUserTemplates === null) {
                showToast('Không thể kết nối với máy chủ', 'error');
            }
        } finally {
            if (isMountedRef.current) setLoading(false);
        }
    }, [showToast]);

    // [PERF] Fast deduplicated initial fetch without AbortSignal cancellation in StrictMode
    useEffect(() => {
        isMountedRef.current = true;
        fetchUserTemplates(false);
        fetchGroups();

        // Defer secondary forms merge-tags fetch so it never competes with template list rendering
        const timer = setTimeout(() => {
            preloadImageLibrary();
            if (cachedMergeTags !== null) return;
            api.get<any[]>('forms').then(res => {
                if (res.success && Array.isArray(res.data)) {
                    const keyMap = new Map<string, string>();
                    res.data.forEach((form: any) => {
                        (form.fields || []).forEach((f: any) => {
                            if (f.isCustom && f.customKey) {
                                keyMap.set(f.customKey, f.label || f.customKey);
                            }
                        });
                    });
                    const tags = Array.from(keyMap.entries()).map(([key, label]) => ({ key, label }));
                    cachedMergeTags = tags;
                    if (isMountedRef.current) setCustomMergeTags(tags);
                }
            }).catch(() => {});
        }, 200);

        return () => {
            isMountedRef.current = false;
            clearTimeout(timer);
        };
    }, [fetchUserTemplates, fetchGroups]);

    // [PERF] Hover Prefetch: load full blocks into RAM when user hovers over a card so clicking Edit is 0ms
    const handlePrefetchTemplate = useCallback((tpl: Template) => {
        if (!tpl || !tpl.id || tpl.id.startsWith('sys_')) return;
        if (fullTemplateBlocksCache.has(tpl.id) || prefetchingTemplateIds.has(tpl.id)) return;
        if (tpl.blocks && tpl.blocks.length > 0 && typeof tpl.blocks[0] === 'object') {
            fullTemplateBlocksCache.set(tpl.id, tpl);
            return;
        }
        prefetchingTemplateIds.add(tpl.id);
        api.get<Template>(`templates/${tpl.id}`)
            .then(res => {
                if (res.success && res.data) {
                    fullTemplateBlocksCache.set(tpl.id, res.data);
                }
            })
            .catch(() => {})
            .finally(() => {
                prefetchingTemplateIds.delete(tpl.id);
            });
    }, []);

    const handleSaveTemplate = async (
        data: Partial<Template> & { visibility?: TemplateVisibilityMode; accessConfig?: TemplateAccessConfig },
        shouldExit: boolean = false
    ) => {
        if (savingTemplateRef.current) return;
        const isExisting = Boolean(editingTemplate && editingTemplate.id && !editingTemplate.id.startsWith('sys_'));
        if (isExisting && !canModifyTemplate(editingTemplate)) {
            adminGuard(() => {})();
            return;
        }
        savingTemplateRef.current = true;
        try {
            let res;
            const creatorInfo = getCurrentCreatorInfo();
            const rawVis = data.visibility || data.accessConfig?.visibility || (editingTemplate as any)?.visibility || (effectiveIsAdmin ? 'shared' : 'personal');
            const resolvedVisibility: TemplateVisibilityMode = (!effectiveIsAdmin && rawVis === 'shared') ? 'personal' : rawVis;
            const resolvedAccessConfig: TemplateAccessConfig = {
                ...(data.accessConfig || normalizeTemplateAccessConfig(editingTemplate, resolvedVisibility)),
                visibility: resolvedVisibility,
            };

            let resolvedThumb = data.thumbnail || '';
            if (!resolvedThumb || resolvedThumb.includes('placehold.co')) {
                try {
                    const htmlForThumb = data.htmlContent || editingTemplate?.htmlContent || '';
                    const blocksForThumb = (data.blocks || editingTemplate?.blocks || []) as EmailBlock[];
                    resolvedThumb = await captureEmailTopWebp(
                        htmlForThumb,
                        blocksForThumb,
                        (data.bodyStyle || editingTemplate?.bodyStyle || DEFAULT_BODY_STYLE) as any,
                        data.name || editingTemplate?.name || 'Mẫu Email'
                    );
                } catch {
                    resolvedThumb = editingTemplate?.thumbnail || '';
                }
            }

            if (isExisting && editingTemplate) {
                const existingCreator = (editingTemplate as any).creator || (editingTemplate.bodyStyle as any)?.creator || creatorInfo;
                const updatedBodyStyle = {
                    ...data.bodyStyle,
                    visibility: resolvedVisibility,
                    accessConfig: resolvedAccessConfig,
                    creator: existingCreator
                };
                res = await api.put(`templates/${editingTemplate.id}`, {
                    ...editingTemplate,
                    ...data,
                    thumbnail: resolvedThumb || editingTemplate.thumbnail || '',
                    visibility: resolvedVisibility,
                    accessConfig: resolvedAccessConfig,
                    creator: existingCreator,
                    bodyStyle: updatedBodyStyle,
                    lastModified: new Date().toISOString()
                } as any);
                if (res.success) {
                    showToast('Đã cập nhật mẫu email');
                    logAction('Cập nhật mẫu email', `Mẫu: ${data.name || editingTemplate.name}`);
                    const updatedTpl = {
                        ...editingTemplate,
                        ...data,
                        ...res.data,
                        thumbnail: (res.data as any)?.thumbnail || resolvedThumb || editingTemplate.thumbnail || '',
                        visibility: resolvedVisibility,
                        accessConfig: resolvedAccessConfig,
                        creator: existingCreator,
                        bodyStyle: updatedBodyStyle,
                        created_at: editingTemplate.created_at || (editingTemplate as any).createdAt || new Date().toISOString()
                    } as Template;
                    fullTemplateBlocksCache.set(editingTemplate.id, updatedTpl);
                    syncUserTemplates(prev => prev.map(t => t.id === editingTemplate.id ? updatedTpl : t));
                }
            } else {
                const updatedBodyStyle = {
                    ...data.bodyStyle,
                    visibility: resolvedVisibility,
                    accessConfig: resolvedAccessConfig,
                    creator: creatorInfo
                };
                res = await api.post('templates', {
                    ...data,
                    visibility: resolvedVisibility,
                    accessConfig: resolvedAccessConfig,
                    created_by: creatorInfo.id,
                    creator: creatorInfo,
                    bodyStyle: updatedBodyStyle,
                    category: data.category || 'promotional',
                    thumbnail: resolvedThumb || '',
                    lastModified: new Date().toISOString()
                } as any);
                if (res.success) {
                    showToast(resolvedVisibility === 'personal' ? 'Đã tạo mẫu email cá nhân mới' : 'Đã tạo mẫu email mới');
                    logAction('Tạo mẫu email mới', `Mẫu: ${data.name}`);
                    const newTemplateWithDate = {
                        ...res.data,
                        thumbnail: (res.data as any)?.thumbnail || resolvedThumb || '',
                        visibility: resolvedVisibility,
                        accessConfig: resolvedAccessConfig,
                        created_by: creatorInfo.id,
                        creator: creatorInfo,
                        bodyStyle: updatedBodyStyle,
                        created_at: new Date().toISOString(),
                        createdAt: new Date().toISOString()
                    } as Template;
                    if (newTemplateWithDate.id) {
                        fullTemplateBlocksCache.set(newTemplateWithDate.id, newTemplateWithDate);
                    }
                    setEditingTemplate(newTemplateWithDate);
                    syncUserTemplates(prev => [newTemplateWithDate, ...prev]);
                }
            }

            if (res && res.success) {
                if (shouldExit) {
                    setIsEditorOpen(false);
                    setEditingTemplate(undefined);
                    setCurrentPage(1);
                }
            } else if (res) {
                showToast(res.message || 'Lỗi khi lưu mẫu email', 'error');
            }
        } catch (error) {
            console.error('Save template error:', error);
            showToast('Không thể lưu mẫu email. Vui lòng thử lại.', 'error');
        } finally {
            savingTemplateRef.current = false;
        }
    };

    const handleQuickUpdateAccess = useCallback(async (nextConfig: TemplateAccessConfig) => {
        if (!accessModalTarget) return;
        const tplId = accessModalTarget.id;
        try {
            const res = await api.put(`templates/${tplId}`, {
                action: 'update_access',
                visibility: nextConfig.visibility,
                accessConfig: nextConfig,
            });
            if (res.success) {
                syncUserTemplates(prev => prev.map(t => {
                    if (t.id !== tplId) return t;
                    const updated = {
                        ...t,
                        visibility: nextConfig.visibility,
                        accessConfig: nextConfig,
                        bodyStyle: {
                            ...(t.bodyStyle || DEFAULT_BODY_STYLE),
                            visibility: nextConfig.visibility,
                            accessConfig: nextConfig,
                        } as any
                    };
                    if (fullTemplateBlocksCache.has(tplId)) {
                        const cached = fullTemplateBlocksCache.get(tplId)!;
                        fullTemplateBlocksCache.set(tplId, { ...cached, ...updated });
                    }
                    return updated;
                }));
                showToast('Đã cập nhật phân quyền & chia sẻ mẫu thiết kế');
            } else {
                showToast(res.message || 'Không thể cập nhật phân quyền', 'error');
            }
        } catch {
            showToast('Lỗi kết nối khi cập nhật phân quyền', 'error');
        }
    }, [accessModalTarget, syncUserTemplates, showToast]);

    const handleDelete = async (ids: string[], type: 'template' | 'group' = 'template') => {
        if (type === 'group') {
            if (!effectiveIsAdmin) {
                adminGuard(() => {})();
                return;
            }
        } else {
            const targetTemplates = userTemplates.filter(t => ids.includes(t.id));
            const hasUnauthorized = targetTemplates.some(t => !canModifyTemplate(t));
            if (hasUnauthorized) {
                adminGuard(() => {})();
                return;
            }
        }

        if (deletingRef.current) return;
        deletingRef.current = true;
        try {
            if (type === 'group') {
                const res = await api.delete(`template_groups/${ids[0]}`);
                if (res.success) {
                    const groupName = groups.find(g => g.id === ids[0])?.name || ids[0];
                    logAction('Xóa nhóm mẫu', `Đã xóa nhóm: ${groupName}`);
                    setGroups(prev => {
                        const next = prev.filter(g => g.id !== ids[0]);
                        cachedTemplateGroups = next;
                        return next;
                    });
                    if (filterGroupId === ids[0]) setFilterGroupId('all');
                    showToast('Đã xóa nhóm', 'info');
                    fetchUserTemplates(false);
                } else {
                    showToast(res.message || 'Lỗi khi xóa nhóm', 'error');
                }
            } else {
                const res = await api.delete('templates', { ids });
                if (res.success) {
                    const deletedNames = userTemplates.filter(t => ids.includes(t.id)).map(t => t.name).join(', ');
                    logAction('Xóa mẫu email', `Đã xóa: ${deletedNames || ids.join(', ')}`);
                    ids.forEach(id => fullTemplateBlocksCache.delete(id));
                    syncUserTemplates(prev => prev.filter(t => !ids.includes(t.id)));
                    setSelectedIds(prev => prev.filter(id => !ids.includes(id)));
                    showToast(res.message || 'Đã xóa mẫu email', 'info');
                } else {
                    const errors: string[] = (res.data as any)?.errors || [];
                    if (errors.length > 0) {
                        setUsageBlockModal({ isOpen: true, errors });
                    } else {
                        showToast(res.message || 'Lỗi khi xóa mẫu email', 'error');
                    }
                }
            }
        } catch (error) {
            console.error(`Delete ${type} error:`, error);
            showToast(`Không thể xóa ${type}`, 'error');
        } finally {
            deletingRef.current = false;
            setDeleteConfirm({ isOpen: false, ids: [], type: 'template' });
        }
    };

    const handleBulkMove = async (toGroupId: string) => {
        if (selectedIds.length === 0) return;
        const targetTemplates = userTemplates.filter(t => selectedIds.includes(t.id));
        if (targetTemplates.some(t => !canModifyTemplate(t))) {
            adminGuard(() => {})();
            return;
        }
        setIsMovingGroups(true);
        try {
            const res = await api.put('templates', {
                bulk_action: 'move_to_group',
                ids: selectedIds,
                group_id: toGroupId === 'null' ? null : toGroupId
            });
            if (res.success) {
                showToast(res.message || 'Đã cập nhật nhóm cho các mẫu đã chọn');
                const newGroupId = toGroupId === 'null' ? undefined : toGroupId;
                syncUserTemplates(prev => prev.map(t => selectedIds.includes(t.id) ? { ...t, groupId: newGroupId } : t));
                setSelectedIds([]);
            } else {
                showToast(res.message || 'Lỗi khi di chuyển mẫu', 'error');
            }
        } catch {
            showToast('Lỗi kết nối', 'error');
        } finally {
            setIsMovingGroups(false);
        }
    };

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }, []);

    const handleSelectAll = (filtered: Template[]) => {
        const selectableIds = filtered.filter(t => !t.id.startsWith('sys_') && canModifyTemplate(t)).map(t => t.id);
        if (selectableIds.length === 0) return;
        const allSelected = selectableIds.every(id => selectedIds.includes(id));
        if (allSelected) {
            setSelectedIds(prev => prev.filter(id => !selectableIds.includes(id)));
        } else {
            setSelectedIds(prev => Array.from(new Set([...prev, ...selectableIds])));
        }
    };

    const handleSaveGroup = adminGuard(async () => {
        if (!newGroupName.trim() || isSavingGroup) return;
        setIsSavingGroup(true);
        try {
            const res = editingGroup
                ? await api.put(`template_groups/${editingGroup.id}`, { name: newGroupName.trim() })
                : await api.post('template_groups', { name: newGroupName.trim() });

            if (res.success) {
                showToast(editingGroup ? 'Đã cập nhật nhóm' : 'Đã tạo nhóm mới');
                logAction(editingGroup ? 'Cập nhật nhóm mẫu' : 'Tạo nhóm mẫu mới', `Nhóm: ${newGroupName.trim()}`);
                fetchGroups();
                setIsGroupModalOpen(false);
                setEditingGroup(null);
                setNewGroupName('');
            } else {
                showToast(res.message || 'Lỗi khi lưu nhóm', 'error');
            }
        } catch {
            showToast('Lỗi kết nối', 'error');
        } finally {
            setIsSavingGroup(false);
        }
    }, 'tạo nhóm');

    // [PERF] Lazy Full-Email Load on Preview ("Xem chi tiết")
    const handleOpenPreview = useCallback(async (template: Template) => {
        const cachedFull = fullTemplateBlocksCache.get(template.id) || template;
        setPreviewTemplate(cachedFull);

        if (template.id.startsWith('sys_')) {
            return;
        }
        const hasFullData = Boolean(
            cachedFull.htmlContent ||
            (cachedFull.blocks && cachedFull.blocks.length > 0 && typeof cachedFull.blocks[0] === 'object')
        );
        if (hasFullData) {
            return;
        }

        try {
            const res = await api.get<Template>(`templates/${template.id}`);
            if (res.success && res.data) {
                fullTemplateBlocksCache.set(template.id, res.data);
                setPreviewTemplate(prev => (prev && prev.id === template.id ? res.data : prev));
            }
        } catch {
            // Keep preview open
        }
    }, []);

    // [PERF] Instant 0ms Editor Open — fetch full email only when clicking Edit!
    const handleStartEdit = useCallback(async (template: Template) => {
        if (!template.id.startsWith('sys_') && !canModifyTemplate(template)) {
            adminGuard(() => {})();
            return;
        }
        const cachedFull = fullTemplateBlocksCache.get(template.id) || template;
        setEditingTemplate(cachedFull);
        setIsEditorOpen(true);

        if (template.id.startsWith('sys_')) {
            return;
        }
        const hasRealBlocks = Boolean(
            cachedFull.blocks && cachedFull.blocks.length > 0 && typeof cachedFull.blocks[0] === 'object'
        );
        if (hasRealBlocks && cachedFull.htmlContent) {
            return;
        }

        // Fetch full blocks & htmlContent in background while editor is already mounted
        try {
            const res = await api.get<Template>(`templates/${template.id}`);
            if (res.success && res.data) {
                fullTemplateBlocksCache.set(template.id, res.data);
                setEditingTemplate(res.data);
            }
        } catch {
            // Editor already mounted with template HTML / fallback blocks
        }
    }, [canModifyTemplate, adminGuard]);

    const handleDuplicate = async (tpl: Template) => {
        if (duplicatingRef.current) return;
        duplicatingRef.current = true;
        try {
            let fullTpl = fullTemplateBlocksCache.get(tpl.id) || tpl;
            const hasFullData = Boolean(
                fullTpl.htmlContent &&
                ((! (fullTpl as any).hasBlocks) || (fullTpl.blocks && fullTpl.blocks.length > 0 && typeof fullTpl.blocks[0] === 'object'))
            );
            if (!tpl.id.startsWith('sys_') && !hasFullData) {
                const res = await api.get<Template>(`templates/${tpl.id}`);
                if (res.success && res.data) {
                    fullTpl = res.data;
                    fullTemplateBlocksCache.set(tpl.id, res.data);
                }
            }

            const baseName = fullTpl.name.replace(' (Copy)', '');
            const newName = `${baseName} (Copy)`;

            let htmlContent = fullTpl.htmlContent;
            if (!htmlContent && fullTpl.blocks && typeof fullTpl.blocks[0] === 'object') {
                htmlContent = compileHTML(fullTpl.blocks, fullTpl.bodyStyle, fullTpl.name);
            }

            const creatorInfo = getCurrentCreatorInfo();
            const targetVisibility: TemplateVisibilityMode = effectiveIsAdmin ? 'shared' : 'personal';
            const targetAccessConfig: TemplateAccessConfig = {
                visibility: targetVisibility,
                allowed_user_ids: [],
                allowed_team_ids: [],
                allowed_departments: [],
                permission: 'use',
            };

            const updatedBodyStyle = {
                ...fullTpl.bodyStyle,
                visibility: targetVisibility,
                accessConfig: targetAccessConfig,
                creator: creatorInfo
            };

            const newTpl = {
                name: newName,
                category: fullTpl.category,
                thumbnail: fullTpl.thumbnail,
                blocks: fullTpl.blocks,
                visibility: targetVisibility,
                accessConfig: targetAccessConfig,
                created_by: creatorInfo.id,
                creator: creatorInfo,
                bodyStyle: updatedBodyStyle,
                htmlContent
            };

            const res = await api.post('templates', newTpl as any);
            if (res.success) {
                const duplicatedWithDate = {
                    ...(res.data as any),
                    visibility: targetVisibility,
                    accessConfig: targetAccessConfig,
                    created_by: creatorInfo.id,
                    creator: creatorInfo,
                    bodyStyle: updatedBodyStyle,
                    created_at: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                } as Template;
                if (duplicatedWithDate.id) {
                    fullTemplateBlocksCache.set(duplicatedWithDate.id, duplicatedWithDate);
                }
                syncUserTemplates(prev => [duplicatedWithDate, ...prev]);
                setCurrentPage(1);
                showToast('Đã nhân bản mẫu thành công', 'success');
                logAction('Nhân bản mẫu email', `Nhân bản mẫu "${tpl.name}" thành "${newName}"`);
            } else {
                showToast(res.message || 'Lỗi khi nhân bản mẫu', 'error');
            }
        } catch (error) {
            console.error('Duplicate template error:', error);
            showToast('Không thể nhân bản mẫu email', 'error');
        } finally {
            duplicatingRef.current = false;
        }
    };

    const handleApplyAIGenerated = useCallback((newBlocks: EmailBlock[]) => {
        setIsAIModalOpen(false);
        const now = new Date().toISOString();
        const uniqueBlocks = ensureUniqueIds(newBlocks);
        setEditingTemplate({
            id: '',
            name: 'Mẫu thiết kế AI',
            category: 'promotional',
            thumbnail: '',
            blocks: uniqueBlocks,
            bodyStyle: DEFAULT_BODY_STYLE,
            htmlContent: compileHTML(uniqueBlocks, DEFAULT_BODY_STYLE, 'Mẫu thiết kế AI'),
            lastModified: now,
        });
        setIsEditorOpen(true);
    }, []);

    // ── Filtering & Sorting Logic ────────────────────────────────────────────
    const visibleUserTemplates = useMemo(() => {
        return userTemplates.filter(t => canUserViewTemplate(t, erpUser, effectiveIsAdmin));
    }, [userTemplates, erpUser, effectiveIsAdmin]);

    const allMergedTemplates = useMemo(
        () => [...visibleUserTemplates, ...SYSTEM_TEMPLATES],
        [visibleUserTemplates]
    );

    const isMyOwnTemplate = useCallback((tpl: Template) => {
        if (tpl.id.startsWith('sys_')) return false;
        if (isTemplateOwner(tpl, currentUserId, currentUserEmail, currentUserName)) return true;
        if (getTemplateVisibility(tpl) === 'personal' && canModifyTemplate(tpl) && !effectiveIsAdmin) return true;
        return false;
    }, [currentUserId, currentUserEmail, currentUserName, canModifyTemplate, effectiveIsAdmin]);

    const personalTemplatesCount = useMemo(() => {
        return visibleUserTemplates.filter(t => isMyOwnTemplate(t) || getTemplateVisibility(t) === 'personal').length;
    }, [visibleUserTemplates, isMyOwnTemplate]);

    const sharedTemplatesCount = useMemo(() => {
        return visibleUserTemplates.filter(t => !t.id.startsWith('sys_') && getTemplateVisibility(t) !== 'personal').length;
    }, [visibleUserTemplates]);

    const filteredTemplates = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        const list = allMergedTemplates.filter(t => {
            const isSys = t.id.startsWith('sys_');
            const vis = getTemplateVisibility(t);
            const matchesGroup =
                filterGroupId === 'all' ? true :
                filterGroupId === 'personal' ? (!isSys && (isMyOwnTemplate(t) || vis === 'personal')) :
                filterGroupId === 'shared' ? (!isSys && vis !== 'personal') :
                filterGroupId === 'system' ? isSys :
                t.groupId === filterGroupId;
            const matchesSearch = !q || (t.name || '').toLowerCase().includes(q);
            return matchesGroup && matchesSearch;
        });

        if (sortBy === 'name_asc') {
            return [...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
        }
        if (sortBy === 'name_desc') {
            return [...list].sort((a, b) => (b.name || '').localeCompare(a.name || '', 'vi'));
        }
        return [...list].sort((a, b) => {
            const aSys = a.id.startsWith('sys_') ? 1 : 0;
            const bSys = b.id.startsWith('sys_') ? 1 : 0;
            if (aSys !== bSys) return aSys - bSys;
            const aTime = Date.parse(String(a.lastModified || (a as any).updated_at || a.created_at || a.createdAt || '')) || 0;
            const bTime = Date.parse(String(b.lastModified || (b as any).updated_at || b.created_at || b.createdAt || '')) || 0;
            return bTime - aTime;
        });
    }, [allMergedTemplates, filterGroupId, debouncedSearch, sortBy, isMyOwnTemplate]);

    const totalPages = Math.max(1, Math.ceil(filteredTemplates.length / PAGE_SIZE));
    const paginatedTemplates = useMemo(() => {
        return filteredTemplates.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    }, [filteredTemplates, currentPage]);

    const handleFilterGroupChange = useCallback((id: string) => {
        setFilterGroupId(id);
        setCurrentPage(1);
    }, []);

    const handleDebouncedSearch = useCallback((val: string) => {
        setDebouncedSearch(val);
        setCurrentPage(1);
    }, []);

    const isFiltered = filterGroupId !== 'all' || Boolean(debouncedSearch.trim());
    const clearFilters = useCallback(() => {
        setFilterGroupId('all');
        setSearchTerm('');
        setDebouncedSearch('');
        setCurrentPage(1);
    }, []);

    const getGroupName = useCallback((groupId?: string) => {
        const group = groups.find(g => g.id === groupId);
        return group ? group.name : 'Chưa phân loại';
    }, [groups]);

    const previewHtml = useMemo(() => {
        if (!previewTemplate) return '';
        if (previewTemplate.htmlContent) return previewTemplate.htmlContent;
        if (previewTemplate.blocks && previewTemplate.blocks.length > 0 && typeof previewTemplate.blocks[0] === 'object') {
            return compileHTML(previewTemplate.blocks, previewTemplate.bodyStyle, previewTemplate.name);
        }
        return '';
    }, [previewTemplate]);

    const activeCustomFolder = useMemo(() => {
        if (['all', 'personal', 'shared', 'system'].includes(filterGroupId)) return null;
        return groups.find(g => g.id === filterGroupId) || null;
    }, [filterGroupId, groups]);

    const filteredGroups = useMemo(() => {
        if (!folderSearchTerm.trim()) return groups;
        const term = folderSearchTerm.trim().toLowerCase();
        return groups.filter(g => g.name.toLowerCase().includes(term));
    }, [groups, folderSearchTerm]);

    const currentFolderDisplay = useMemo(() => {
        if (filterGroupId === 'all') {
            return { name: 'Tất cả thư mục', count: allMergedTemplates.length };
        }
        if (filterGroupId === 'personal') {
            return { name: 'Của tôi', count: personalTemplatesCount };
        }
        if (filterGroupId === 'shared') {
            return { name: 'Dùng chung', count: sharedTemplatesCount };
        }
        if (filterGroupId === 'system') {
            return { name: 'Mẫu hệ thống', count: SYSTEM_TEMPLATES.length };
        }
        const g = groups.find(item => item.id === filterGroupId);
        if (g) {
            const count = allMergedTemplates.filter(t => t.groupId === g.id).length;
            return { name: g.name, count };
        }
        return { name: 'Chọn thư mục', count: allMergedTemplates.length };
    }, [filterGroupId, allMergedTemplates, personalTemplatesCount, sharedTemplatesCount, groups]);

    const pillClass = (active: boolean) =>
        `h-9 px-3 rounded-[var(--radius-md)] text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors border outline-none focus:outline-none cursor-pointer ${
            active
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-[var(--shadow-xs)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
        }`;

    return (
        <div className="w-full flex flex-col gap-5">
            {isEditorOpen ? (
                <EmailEditor
                    template={editingTemplate}
                    groups={groups}
                    onSave={(data) => handleSaveTemplate(data, false)}
                    onCancel={() => { setIsEditorOpen(false); setEditingTemplate(undefined); }}
                    customMergeTags={customMergeTags}
                    canSetShared={effectiveIsAdmin}
                />
            ) : (
                <>
                    <PageHero
                        title="Thư viện Mẫu Email & ZNS"
                        subtitle="Quản lý mẫu thiết kế Email và Zalo ZNS, phân nhóm thư mục và khởi tạo nội dung nhanh với AI."
                        actions={[
                            {
                                label: 'Thư viện Ảnh',
                                icon: ImageIcon,
                                onClick: () => setIsImageLibraryOpen(true),
                                primary: false
                            },
                            {
                                label: 'Tạo bằng AI',
                                icon: Sparkles,
                                onClick: () => { setAiModalMounted(true); setIsAIModalOpen(true); },
                                primary: false,
                                customClass: '!bg-rose-50 !text-[#BD1D2D] !border-rose-200/90 hover:!bg-[#BD1D2D] hover:!text-white hover:!border-[#BD1D2D] font-bold transition-all'
                            },
                            {
                                label: 'Thiết kế mới',
                                icon: Plus,
                                onClick: () => { setEditingTemplate(undefined); setIsEditorOpen(true); },
                                primary: true
                            }
                        ]}
                    />

                    {/* Main panel */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] shadow-[var(--shadow-xs)] relative">
                        {/* Single-row Toolbar: Core scope pills on left, Folder Modal + Sort + SearchBox on right */}
                        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-[var(--color-border)]">
                            <div className="flex items-center gap-1.5 max-w-full overflow-x-auto no-scrollbar">
                                <button
                                    type="button"
                                    onClick={() => handleFilterGroupChange('all')}
                                    className={pillClass(filterGroupId === 'all')}
                                >
                                    <Globe className="w-3.5 h-3.5 shrink-0" />
                                    <span>Tất cả</span>
                                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${filterGroupId === 'all' ? 'bg-white/20 text-white' : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]'}`}>
                                        {allMergedTemplates.length}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleFilterGroupChange('personal')}
                                    className={pillClass(filterGroupId === 'personal')}
                                >
                                    <User className="w-3.5 h-3.5 shrink-0" />
                                    <span>Của tôi</span>
                                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${filterGroupId === 'personal' ? 'bg-white/20 text-white' : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]'}`}>
                                        {personalTemplatesCount}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleFilterGroupChange('shared')}
                                    className={pillClass(filterGroupId === 'shared')}
                                >
                                    <Users className="w-3.5 h-3.5 shrink-0" />
                                    <span>Dùng chung</span>
                                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${filterGroupId === 'shared' ? 'bg-white/20 text-white' : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]'}`}>
                                        {sharedTemplatesCount}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => handleFilterGroupChange('system')}
                                    className={pillClass(filterGroupId === 'system')}
                                >
                                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                    <span>Hệ thống</span>
                                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${filterGroupId === 'system' ? 'bg-white/20 text-white' : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]'}`}>
                                        {SYSTEM_TEMPLATES.length}
                                    </span>
                                </button>

                                {/* Show active folder chip only when a folder was selected from the Folder Modal */}
                                {activeCustomFolder && (
                                    <div className="inline-flex items-center gap-1 h-9 pl-3 pr-2 rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 border border-[var(--color-primary)] text-[var(--color-primary)] text-[13px] font-semibold">
                                        <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate max-w-[140px]">{activeCustomFolder.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleFilterGroupChange('all')}
                                            className="ml-0.5 p-0.5 rounded hover:bg-[var(--color-primary)]/15 outline-none focus:outline-none cursor-pointer"
                                            title="Bỏ lọc thư mục"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="ml-auto flex flex-wrap items-center gap-2">
                                {/* Folder Modal / Popover containing ALL folders & group management */}
                                <div ref={folderPopoverRef} className="relative">
                                    <button
                                        type="button"
                                        onClick={() => setIsFolderPopoverOpen(prev => !prev)}
                                        className={`h-9 px-3 rounded-[var(--radius-md)] border text-xs font-semibold inline-flex items-center justify-between gap-2 min-w-[165px] max-w-[230px] transition-colors outline-none focus:outline-none cursor-pointer ${
                                            activeCustomFolder
                                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]'
                                                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:border-[var(--color-primary)]'
                                        }`}
                                        title={currentFolderDisplay.name}
                                    >
                                        <div className="flex items-center gap-1.5 truncate">
                                            <Folder className={`w-3.5 h-3.5 shrink-0 ${activeCustomFolder ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`} />
                                            <span className="truncate">{currentFolderDisplay.name}</span>
                                            <span className="text-[11px] text-[var(--color-text-muted)] font-normal shrink-0">
                                                ({currentFolderDisplay.count})
                                            </span>
                                        </div>
                                        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)] transition-transform duration-200 ${isFolderPopoverOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isFolderPopoverOpen && (
                                        <div className="absolute top-full mt-1.5 left-0 sm:left-auto sm:right-0 w-[560px] sm:w-[640px] max-w-[calc(100vw-2rem)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] shadow-2xl z-50 p-3.5 flex flex-col gap-3">
                                            {/* Header & Search */}
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="relative flex-1">
                                                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                                                    <input
                                                        type="text"
                                                        value={folderSearchTerm}
                                                        onChange={(e) => setFolderSearchTerm(e.target.value)}
                                                        placeholder="Tìm kiếm thư mục / nhóm mẫu..."
                                                        className="w-full h-9 pl-8.5 pr-8 text-xs rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                                                        autoFocus
                                                    />
                                                    {folderSearchTerm && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setFolderSearchTerm('')}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-0.5 outline-none focus:outline-none"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                                {effectiveIsAdmin && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setIsFolderPopoverOpen(false);
                                                            setEditingGroup(null);
                                                            setNewGroupName('');
                                                            setIsGroupModalOpen(true);
                                                        }}
                                                        className="h-9 px-3 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-90 transition-opacity shrink-0 outline-none focus:outline-none cursor-pointer"
                                                    >
                                                        <FolderPlus className="w-3.5 h-3.5" />
                                                        <span>+ Tạo thư mục</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Quick options row */}
                                            <div className="flex flex-wrap items-center gap-1.5 pb-2.5 border-b border-[var(--color-border)]">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleFilterGroupChange('all');
                                                        setIsFolderPopoverOpen(false);
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border outline-none focus:outline-none cursor-pointer ${
                                                        filterGroupId === 'all'
                                                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                                                            : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-transparent hover:border-[var(--color-border)] hover:text-[var(--color-text)]'
                                                    }`}
                                                >
                                                    <Globe className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Tất cả</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterGroupId === 'all' ? 'bg-white/20 text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'}`}>
                                                        {allMergedTemplates.length}
                                                    </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleFilterGroupChange('personal');
                                                        setIsFolderPopoverOpen(false);
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border outline-none focus:outline-none cursor-pointer ${
                                                        filterGroupId === 'personal'
                                                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                                                            : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-transparent hover:border-[var(--color-border)] hover:text-[var(--color-text)]'
                                                    }`}
                                                >
                                                    <User className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Của tôi</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterGroupId === 'personal' ? 'bg-white/20 text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'}`}>
                                                        {personalTemplatesCount}
                                                    </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleFilterGroupChange('shared');
                                                        setIsFolderPopoverOpen(false);
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border outline-none focus:outline-none cursor-pointer ${
                                                        filterGroupId === 'shared'
                                                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                                                            : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-transparent hover:border-[var(--color-border)] hover:text-[var(--color-text)]'
                                                    }`}
                                                >
                                                    <Users className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Dùng chung</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterGroupId === 'shared' ? 'bg-white/20 text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'}`}>
                                                        {sharedTemplatesCount}
                                                    </span>
                                                </button>

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        handleFilterGroupChange('system');
                                                        setIsFolderPopoverOpen(false);
                                                    }}
                                                    className={`px-2.5 py-1.5 rounded-[var(--radius-md)] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border outline-none focus:outline-none cursor-pointer ${
                                                        filterGroupId === 'system'
                                                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                                                            : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-transparent hover:border-[var(--color-border)] hover:text-[var(--color-text)]'
                                                    }`}
                                                >
                                                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                                    <span>Mẫu hệ thống</span>
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterGroupId === 'system' ? 'bg-white/20 text-white' : 'bg-[var(--color-surface)] text-[var(--color-text-muted)]'}`}>
                                                        {SYSTEM_TEMPLATES.length}
                                                    </span>
                                                </button>
                                            </div>

                                            {/* Main body: 3-column folder grid with inline Edit/Delete actions */}
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto p-0.5 custom-scrollbar">
                                                {filteredGroups.length === 0 ? (
                                                    <div className="col-span-3 py-6 text-center text-xs text-[var(--color-text-muted)]">
                                                        {folderSearchTerm ? 'Không tìm thấy thư mục phù hợp' : 'Chưa có thư mục nào'}
                                                    </div>
                                                ) : (
                                                    filteredGroups.map(group => {
                                                        const count = allMergedTemplates.filter(t => t.groupId === group.id).length;
                                                        const isSelected = filterGroupId === group.id;
                                                        return (
                                                            <div
                                                                key={group.id}
                                                                onClick={() => {
                                                                    handleFilterGroupChange(group.id);
                                                                    setIsFolderPopoverOpen(false);
                                                                }}
                                                                className={`group/fld h-11 px-2.5 rounded-[var(--radius-md)] border text-left text-xs font-medium flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                                                                    isSelected
                                                                        ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)] text-[var(--color-primary)] font-semibold shadow-xs'
                                                                        : 'bg-[var(--color-bg)] border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-surface)]'
                                                                }`}
                                                                title={group.name}
                                                            >
                                                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                    <Folder className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]'}`} />
                                                                    <span className="truncate">{group.name}</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    {effectiveIsAdmin && (
                                                                        <div className="hidden group-hover/fld:inline-flex items-center gap-0.5">
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setIsFolderPopoverOpen(false);
                                                                                    setEditingGroup(group);
                                                                                    setNewGroupName(group.name);
                                                                                    setIsGroupModalOpen(true);
                                                                                }}
                                                                                className="w-6 h-6 rounded inline-flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-white transition-colors outline-none focus:outline-none"
                                                                                title="Đổi tên thư mục"
                                                                            >
                                                                                <Edit3 className="w-3 h-3" />
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    setIsFolderPopoverOpen(false);
                                                                                    setDeleteConfirm({ isOpen: true, ids: [group.id], type: 'group' });
                                                                                }}
                                                                                className="w-6 h-6 rounded inline-flex items-center justify-center text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors outline-none focus:outline-none"
                                                                                title="Xóa thư mục"
                                                                            >
                                                                                <Trash2 className="w-3 h-3" />
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-normal ${
                                                                        isSelected
                                                                            ? 'bg-[var(--color-primary)] text-white'
                                                                            : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] border border-[var(--color-border)]'
                                                                    }`}>
                                                                        {count}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>

                                            {/* Footer */}
                                            <div className="pt-2 border-t border-[var(--color-border)] flex items-center justify-between text-xs">
                                                <span className="text-[11px] text-[var(--color-text-muted)]">
                                                    Tổng cộng {groups.length} thư mục phân nhóm
                                                </span>
                                                {filterGroupId !== 'all' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            handleFilterGroupChange('all');
                                                            setIsFolderPopoverOpen(false);
                                                        }}
                                                        className="text-[11px] font-semibold text-[var(--color-primary)] hover:underline outline-none focus:outline-none cursor-pointer"
                                                    >
                                                        Đặt lại: Tất cả thư mục
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="w-[145px]">
                                    <Select
                                        size="sm"
                                        value={sortBy}
                                        onChange={(v) => { setSortBy(v as SortBy); setCurrentPage(1); }}
                                        options={SORT_OPTIONS}
                                    />
                                </div>
                                <SearchBox
                                    value={searchTerm}
                                    onChange={setSearchTerm}
                                    onDebouncedChange={handleDebouncedSearch}
                                    debounceMs={250}
                                    placeholder="Tìm theo tên mẫu..."
                                    className="w-full sm:w-60"
                                />
                            </div>
                        </div>

                        {/* Body: Grid or EmptyState */}
                        {loading ? (
                            <div className="p-4">
                                <CardGridSkeleton cols={4} rows={2} height={180} />
                            </div>
                        ) : filteredTemplates.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center gap-2 px-6 py-14">
                                {isFiltered ? (
                                    <SearchX className="w-10 h-10 text-[var(--color-text-muted)]" strokeWidth={1.5} />
                                ) : (
                                    <Layout className="w-10 h-10 text-[var(--color-text-muted)]" strokeWidth={1.5} />
                                )}
                                <p className="text-sm font-semibold text-[var(--color-text)]">
                                    {isFiltered ? 'Không tìm thấy mẫu phù hợp' : 'Chưa có mẫu thiết kế nào'}
                                </p>
                                <p className="text-xs text-[var(--color-text-muted)] max-w-sm">
                                    {isFiltered
                                        ? 'Thử thay đổi danh mục, nhóm thư mục hoặc từ khóa tìm kiếm.'
                                        : 'Tạo mẫu thiết kế Email mới hoặc sử dụng AI để khởi tạo nhanh nội dung.'}
                                </p>
                                {isFiltered ? (
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="mt-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity outline-none focus:outline-none cursor-pointer"
                                    >
                                        Xóa bộ lọc
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => { setEditingTemplate(undefined); setIsEditorOpen(true); }}
                                        className="mt-2 h-9 px-4 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity outline-none focus:outline-none cursor-pointer"
                                    >
                                        <Plus className="w-4 h-4" /> Thiết kế mới
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {paginatedTemplates.map((template, idx) => (
                                    <TemplateCard
                                        key={template.id}
                                        template={template}
                                        index={idx}
                                        isSelected={selectedIds.includes(template.id)}
                                        canModify={canModifyTemplate(template)}
                                        isOwn={isMyOwnTemplate(template)}
                                        groupName={getGroupName(template.groupId)}
                                        onToggleSelect={toggleSelect}
                                        onPreview={handleOpenPreview}
                                        onEdit={handleStartEdit}
                                        onDuplicate={handleDuplicate}
                                        onDelete={(id) => setDeleteConfirm({ isOpen: true, ids: [id], type: 'template' })}
                                        onOpenAccessModal={setAccessModalTarget}
                                        onPrefetch={handlePrefetchTemplate}
                                    />
                                ))}
                            </div>
                        )}

                        <Pagination
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalCount={filteredTemplates.length}
                            itemsPerPage={PAGE_SIZE}
                            onPageChange={setCurrentPage}
                        />
                    </div>

                    {/* Bulk Action Bar */}
                    {selectedIds.length > 0 && (
                        <div className="fixed bottom-6 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 lg:w-auto z-50">
                            <div className="bg-slate-900/95 backdrop-blur-md border border-white/10 px-4 py-3 rounded-[18px] shadow-xl flex flex-wrap items-center gap-3 lg:min-w-[520px]">
                                <div className="flex items-center gap-2.5 pr-3 border-r border-white/10">
                                    <span className="w-7 h-7 bg-[var(--color-primary)] rounded-[var(--radius-md)] flex items-center justify-center font-bold text-white text-xs">
                                        {selectedIds.length}
                                    </span>
                                    <span className="text-white font-semibold text-xs">Đã chọn</span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedIds([])}
                                        className="text-rose-400 text-xs font-semibold hover:text-rose-300 ml-1 outline-none focus:outline-none cursor-pointer"
                                    >
                                        Bỏ chọn
                                    </button>
                                </div>

                                <div className="flex items-center gap-2 flex-1">
                                    <div className="w-48">
                                        <Select
                                            options={[
                                                { value: 'null', label: 'Chưa phân loại' },
                                                ...groups.map(g => ({ value: g.id, label: g.name }))
                                            ]}
                                            value=""
                                            onChange={(val) => handleBulkMove(val)}
                                            placeholder="Chuyển nhóm..."
                                            size="sm"
                                            searchable
                                            icon={FolderOpen}
                                            direction="top"
                                            disabled={isMovingGroups}
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setDeleteConfirm({ isOpen: true, ids: selectedIds, type: 'template' })}
                                        className="h-9 px-3 bg-rose-500/15 hover:bg-rose-600 text-rose-400 hover:text-white rounded-[var(--radius-md)] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border border-rose-500/30 whitespace-nowrap outline-none focus:outline-none cursor-pointer"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Xóa đã chọn
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleSelectAll(filteredTemplates)}
                                    className="inline-flex items-center gap-1.5 ml-auto text-white/70 hover:text-white text-xs font-semibold transition-colors outline-none focus:outline-none cursor-pointer"
                                >
                                    <Check className="w-3.5 h-3.5" /> Chọn tất cả
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Granular Access / Sharing Modal opened from TemplateCard */}
            <TemplateAccessModal
                isOpen={Boolean(accessModalTarget)}
                onClose={() => setAccessModalTarget(null)}
                templateName={accessModalTarget?.name}
                value={normalizeTemplateAccessConfig(accessModalTarget, effectiveIsAdmin ? 'shared' : 'personal')}
                canSetShared={effectiveIsAdmin}
                onSave={handleQuickUpdateAccess}
            />

            {/* Lazy-loaded Modals & Drawers */}
            <Suspense fallback={null}>
                {isImageLibraryOpen && (
                    <ImageLibraryModal
                        isOpen={isImageLibraryOpen}
                        onClose={() => setIsImageLibraryOpen(false)}
                    />
                )}
                {aiModalMounted && (
                    <AIEmailModal
                        isOpen={isAIModalOpen}
                        onClose={() => setIsAIModalOpen(false)}
                        onApply={handleApplyAIGenerated}
                        bodyStyle={DEFAULT_BODY_STYLE}
                        templateName="Mẫu thiết kế AI"
                    />
                )}
                {previewTemplate && (
                    <EmailPreviewDrawer
                        template={previewTemplate}
                        htmlContent={previewHtml}
                        isOpen={!!previewTemplate}
                        onClose={() => setPreviewTemplate(null)}
                        onEdit={() => {
                            if (!canModifyTemplate(previewTemplate)) {
                                adminGuard(() => { })();
                                return;
                            }
                            handleStartEdit(previewTemplate);
                            setPreviewTemplate(null);
                        }}
                        onDuplicate={() => {
                            handleDuplicate(previewTemplate);
                            setPreviewTemplate(null);
                        }}
                    />
                )}
            </Suspense>

            <ConfirmModal
                isOpen={deleteConfirm.isOpen}
                onClose={() => setDeleteConfirm({ isOpen: false, ids: [], type: 'template' })}
                onConfirm={async () => { if (deleteConfirm.ids.length > 0) await handleDelete(deleteConfirm.ids, deleteConfirm.type); }}
                title={deleteConfirm.type === 'template'
                    ? (deleteConfirm.ids.length > 1 ? `Xóa ${deleteConfirm.ids.length} mẫu đã chọn?` : 'Xóa mẫu email này?')
                    : 'Xóa nhóm mẫu này?'}
                message={deleteConfirm.type === 'template'
                    ? (deleteConfirm.ids.length > 1 ? 'Hành động này sẽ xóa vĩnh viễn các mẫu thiết kế đã chọn. Các mẫu đang được sử dụng sẽ không bị xóa.' : 'Hành động này sẽ xóa vĩnh viễn mẫu thiết kế. Bạn không thể khôi phục sau khi xóa.')
                    : "Hành động này sẽ xóa nhóm. Các mẫu email trong nhóm này sẽ trở về trạng thái 'Chưa phân loại' và KHÔNG bị xóa."}
                variant="danger"
            />

            {/* Group Modal */}
            <Modal
                isOpen={isGroupModalOpen}
                onClose={() => { setIsGroupModalOpen(false); setEditingGroup(null); setNewGroupName(''); }}
                title={editingGroup ? 'Chỉnh sửa thư mục' : 'Tạo thư mục mới'}
                size="sm"
                footer={
                    <div className="flex justify-between w-full">
                        <Button variant="ghost" onClick={() => { setIsGroupModalOpen(false); setEditingGroup(null); setNewGroupName(''); }}>Hủy</Button>
                        <Button onClick={handleSaveGroup} isLoading={isSavingGroup} disabled={!newGroupName.trim()}>
                            {editingGroup ? 'Cập nhật' : 'Tạo thư mục'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="Tên thư mục / nhóm mẫu"
                        placeholder="VD: Chào mừng, Khuyến mãi, ISTEC..."
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        autoFocus
                    />
                </div>
            </Modal>

            {/* Usage Block Modal */}
            <Modal
                isOpen={usageBlockModal.isOpen}
                onClose={() => setUsageBlockModal({ isOpen: false, errors: [] })}
                title="Không thể xóa mẫu email"
                size="sm"
                footer={
                    <div className="flex justify-end w-full">
                        <Button onClick={() => setUsageBlockModal({ isOpen: false, errors: [] })}>
                            Đã hiểu
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-100 rounded-[var(--radius-md)]">
                        <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-rose-700 font-medium">
                            Mẫu email đang được sử dụng. Vui lòng <strong>hủy kích hoạt (Pause/Archive)</strong> các Flow hoặc Campaign liên quan trước khi xóa.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Đang được dùng tại:</p>
                        {usageBlockModal.errors.map((err, i) => (
                            <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-[var(--radius-md)]">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800 font-medium">{err}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </Modal>

            {AdminPermModal}
        </div>
    );
};

export default Templates;
