import * as React from 'react';
import { useEffect, useState, useMemo, useCallback, useRef, memo, lazy, Suspense } from 'react';
import { api } from '../../components/marketing/services/storageAdapter';
import { Template, TemplateGroup, EmailBlock } from '../../components/marketing/types';
import { logAction } from '../../components/marketing/services/historyService';
import {
    Edit3, Copy, Trash2, Plus, Layout, Eye, Sparkles, FolderOpen, Globe,
    FolderPlus, Check, X, AlertCircle, Image as ImageIcon, SearchX, User
} from 'lucide-react';
import PageHero from '../../components/marketing/components/common/PageHero';
import Button from '../../components/marketing/components/common/Button';
import SearchBox from '../../components/marketing/components/common/SearchBox';
import Pagination from '../../components/marketing/components/common/Pagination';
// @ts-ignore: `compileHTML` is a named export from `htmlCompiler`
import { compileHTML } from '../../components/marketing/components/templates/EmailEditor/utils/htmlCompiler';
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

// [PERF] Lazy-load heavy editors and modals only when opened
const EmailEditor = lazy(() => import('../../components/marketing/components/templates/EmailEditor/index'));
const AIEmailModal = lazy(() => import('../../components/marketing/components/templates/EmailEditor/AIEmailGeneratorModal'));
const ImageLibraryModal = lazy(() => import('../../components/marketing/components/templates/EmailEditor/components/Properties/ImageLibraryModal'));
const EmailPreviewDrawer = lazy(() => import('../../components/marketing/components/flows/config/EmailPreviewDrawer'));

const PAGE_SIZE = 12;

type SortBy = 'newest' | 'name_asc' | 'name_desc';

const SORT_OPTIONS = [
    { value: 'newest', label: 'Mới cập nhật' },
    { value: 'name_asc', label: 'Tên A → Z' },
    { value: 'name_desc', label: 'Tên Z → A' },
];

const isAbort = (e: any) => e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED';

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

const VisualTemplate: React.FC<{ template: Template }> = memo(({ template }) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scale, setScale] = useState(0.4);
    const [isVisible, setIsVisible] = useState(false);

    // [PERF] Use precompiled htmlContent directly whenever available, avoiding heavy synchronous AST compilation
    const html = useMemo(() => {
        if (!template) return '';
        if (template.htmlContent) return template.htmlContent;
        if (template.blocks && template.blocks.length > 0 && typeof template.blocks[0] === 'object') {
            return compileHTML(template.blocks, template.bodyStyle, template.name);
        }
        return '';
    }, [template.htmlContent, template.blocks, template.bodyStyle, template.name]);

    // [PERF] ResizeObserver instead of adding window resize listener for every single card
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    setScale(entry.contentRect.width / 600);
                }
            }
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    // [PERF] IntersectionObserver: Only mount heavy <iframe> when card enters/nears viewport
    useEffect(() => {
        if (!containerRef.current) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { rootMargin: '300px' });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full bg-white dark:bg-slate-900 relative overflow-hidden flex items-start justify-center">
            {isVisible && html ? (
                <div
                    className="absolute top-0 left-0 origin-top-left"
                    style={{
                        width: '600px',
                        height: '1000px',
                        transform: `scale(${scale})`,
                        pointerEvents: 'none'
                    }}
                >
                    <iframe
                        srcDoc={`<html><head><style>body{margin:0;padding:0;overflow:hidden;background:white;}::-webkit-scrollbar{display:none;}</style></head><body>${html}</body></html>`}
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
    isSelected: boolean;
    groupName: string;
    onToggleSelect: (id: string) => void;
    onPreview: (template: Template) => void;
    onEdit: (template: Template) => void;
    onDuplicate: (template: Template) => void;
    onDelete: (id: string) => void;
}

const TemplateCard: React.FC<TemplateCardProps> = memo(({
    template,
    isSelected,
    groupName,
    onToggleSelect,
    onPreview,
    onEdit,
    onDuplicate,
    onDelete
}) => {
    const isSystem = template.id.startsWith('sys_');
    const creatorName = (template.bodyStyle as any)?.creator?.name || 'Hệ thống';
    const creatorPic = (template.bodyStyle as any)?.creator?.picture;
    const isEditorBlock = Boolean(template.blocks && template.blocks.length > 0);

    return (
        <div
            className={`bg-[var(--color-surface)] rounded-[var(--radius-lg)] border overflow-hidden group transition-all duration-200 flex flex-col h-[340px] relative shadow-[var(--shadow-xs)] hover:shadow-md ${
                isSelected
                    ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-light)]'
                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]'
            }`}
        >
            {/* Selection Checkbox (user templates only) */}
            {!isSystem && (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onToggleSelect(template.id); }}
                    className={`absolute top-3 left-3 z-20 w-7 h-7 rounded-[var(--radius-md)] border flex items-center justify-center transition-all ${
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
                    {template.thumbnail && !template.thumbnail.includes('placehold.co') ? (
                        <img src={template.thumbnail} alt={template.name} className="w-full h-full object-cover object-top" loading="lazy" />
                    ) : (
                        <VisualTemplate template={template} />
                    )}
                </div>

                {/* Hover Overlay Actions */}
                <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2.5 p-3">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onPreview(template); }}
                        className="h-8 px-3.5 bg-white text-slate-900 rounded-[var(--radius-md)] font-semibold text-xs hover:bg-[var(--color-primary)] hover:text-white transition-colors shadow-sm inline-flex items-center gap-1.5"
                    >
                        <Eye className="w-3.5 h-3.5" /> Xem chi tiết
                    </button>

                    {isSystem ? (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDuplicate(template); }}
                            className="h-8 px-3.5 bg-[var(--color-primary)] text-white rounded-[var(--radius-md)] font-semibold text-xs hover:opacity-90 transition-opacity shadow-sm inline-flex items-center gap-1.5"
                        >
                            <Copy className="w-3.5 h-3.5" /> Sử dụng mẫu
                        </button>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onEdit(template); }}
                                className="w-8 h-8 bg-white text-[var(--color-text)] rounded-[var(--radius-md)] hover:bg-[var(--color-primary)] hover:text-white shadow-sm flex items-center justify-center transition-colors"
                                title="Chỉnh sửa"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDuplicate(template); }}
                                className="w-8 h-8 bg-white text-[var(--color-text)] rounded-[var(--radius-md)] hover:bg-[var(--color-primary)] hover:text-white shadow-sm flex items-center justify-center transition-colors"
                                title="Nhân bản"
                            >
                                <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onDelete(template.id); }}
                                className="w-8 h-8 bg-white text-rose-600 rounded-[var(--radius-md)] hover:bg-rose-600 hover:text-white shadow-sm flex items-center justify-center transition-colors"
                                title="Xóa"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                {/* Top-Right Format Badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1.5 pointer-events-none">
                    {isSystem && (
                        <span className="bg-[var(--color-primary)] text-white px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-semibold shadow-xs">
                            Mẫu chuẩn
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
    const isAdmin = useIsAdmin();
    const { guard: adminGuard, PermModal: AdminPermModal } = usePermissionGuard(isAdmin);

    const [userTemplates, setUserTemplates] = useState<Template[]>([]);
    const [groups, setGroups] = useState<TemplateGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [customMergeTags, setCustomMergeTags] = useState<{ label: string; key: string }[]>([]);
    const [isImageLibraryOpen, setIsImageLibraryOpen] = useState(false);

    // Editor & AI Modal State
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Template | undefined>(undefined);
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [aiModalMounted, setAiModalMounted] = useState(false);

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

    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    }, []);

    const fetchGroups = useCallback(async (signal?: AbortSignal) => {
        try {
            const res = await api.get<TemplateGroup[]>('template_groups', {}, signal ? { signal } : undefined);
            if (res.success && Array.isArray(res.data)) setGroups(res.data);
        } catch (error) {
            if (isAbort(error)) return;
            console.error('Fetch groups error:', error);
        }
    }, []);

    const fetchUserTemplates = useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const res = await api.get<Template[]>('templates', {}, signal ? { signal } : undefined);
            if (signal?.aborted) return;
            if (res.success) setUserTemplates(Array.isArray(res.data) ? res.data : []);
            else showToast(res.message || 'Lỗi khi tải danh sách mẫu', 'error');
        } catch (error) {
            if (isAbort(error)) return;
            console.error('Fetch templates error:', error);
            showToast('Không thể kết nối với máy chủ', 'error');
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, [showToast]);

    // [PERF] Parallel initial fetch (<= 3 requests) with AbortController cleanup
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;

        Promise.all([
            fetchUserTemplates(signal),
            fetchGroups(signal),
            api.get<any[]>('forms', {}, { signal }).then(res => {
                if (signal.aborted) return;
                if (res.success && Array.isArray(res.data)) {
                    const keyMap = new Map<string, string>();
                    res.data.forEach((form: any) => {
                        (form.fields || []).forEach((f: any) => {
                            if (f.isCustom && f.customKey) {
                                keyMap.set(f.customKey, f.label || f.customKey);
                            }
                        });
                    });
                    setCustomMergeTags(Array.from(keyMap.entries()).map(([key, label]) => ({ key, label })));
                }
            }).catch(err => {
                if (!isAbort(err)) console.error('Fetch forms merge tags error:', err);
            })
        ]);

        return () => controller.abort();
    }, [fetchUserTemplates, fetchGroups]);

    const handleSaveTemplate = adminGuard(async (data: Partial<Template>, shouldExit: boolean = false) => {
        if (savingTemplateRef.current) return;
        savingTemplateRef.current = true;
        try {
            let res;
            const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}');
            const creatorInfo = user.name ? { name: user.name, picture: user.picture || '/imgs/ICON.png' } : null;

            if (editingTemplate && editingTemplate.id && !editingTemplate.id.startsWith('sys_')) {
                const updatedBodyStyle = {
                    ...data.bodyStyle,
                    creator: (editingTemplate.bodyStyle as any)?.creator || creatorInfo || { name: 'Hệ thống', picture: '/imgs/ICON.png' }
                };
                res = await api.put(`templates/${editingTemplate.id}`, {
                    ...editingTemplate,
                    ...data,
                    bodyStyle: updatedBodyStyle,
                    lastModified: new Date().toISOString()
                });
                if (res.success) {
                    showToast('Đã cập nhật mẫu email');
                    logAction('Cập nhật mẫu email', `Mẫu: ${data.name || editingTemplate.name}`);
                    setUserTemplates(prev => prev.map(t => t.id === editingTemplate.id ? {
                        ...t,
                        ...res.data,
                        created_at: t.created_at || (t as any).createdAt || new Date().toISOString()
                    } : t));
                }
            } else {
                const updatedBodyStyle = {
                    ...data.bodyStyle,
                    creator: creatorInfo || { name: 'Hệ thống', picture: '/imgs/ICON.png' }
                };
                res = await api.post('templates', {
                    ...data,
                    bodyStyle: updatedBodyStyle,
                    category: data.category || 'promotional',
                    thumbnail: data.thumbnail || 'https://placehold.co/600x400/f1f5f9/94a3b8?text=Email+Template',
                    lastModified: new Date().toISOString()
                });
                if (res.success) {
                    showToast('Đã tạo mẫu email mới');
                    logAction('Tạo mẫu email mới', `Mẫu: ${data.name}`);
                    setEditingTemplate(res.data);
                    const newTemplateWithDate = {
                        ...res.data,
                        created_at: new Date().toISOString(),
                        createdAt: new Date().toISOString()
                    };
                    setUserTemplates(prev => [newTemplateWithDate, ...prev]);
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
    }, 'lưu mẫu thiết kế');

    const handleDelete = adminGuard(async (ids: string[], type: 'template' | 'group' = 'template') => {
        if (deletingRef.current) return;
        deletingRef.current = true;
        try {
            if (type === 'group') {
                const res = await api.delete(`template_groups/${ids[0]}`);
                if (res.success) {
                    const groupName = groups.find(g => g.id === ids[0])?.name || ids[0];
                    logAction('Xóa nhóm mẫu', `Đã xóa nhóm: ${groupName}`);
                    setGroups(prev => prev.filter(g => g.id !== ids[0]));
                    if (filterGroupId === ids[0]) setFilterGroupId('all');
                    showToast('Đã xóa nhóm', 'info');
                    fetchUserTemplates();
                } else {
                    showToast(res.message || 'Lỗi khi xóa nhóm', 'error');
                }
            } else {
                const res = await api.delete('templates', { ids });
                if (res.success) {
                    const deletedNames = userTemplates.filter(t => ids.includes(t.id)).map(t => t.name).join(', ');
                    logAction('Xóa mẫu email', `Đã xóa: ${deletedNames || ids.join(', ')}`);
                    setUserTemplates(prev => prev.filter(t => !ids.includes(t.id)));
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
    }, 'xóa mẫu/nhóm');

    const handleBulkMove = adminGuard(async (toGroupId: string) => {
        if (selectedIds.length === 0) return;
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
                setUserTemplates(prev => prev.map(t => selectedIds.includes(t.id) ? { ...t, groupId: newGroupId } : t));
                setSelectedIds([]);
            } else {
                showToast(res.message || 'Lỗi khi di chuyển mẫu', 'error');
            }
        } catch {
            showToast('Lỗi kết nối', 'error');
        } finally {
            setIsMovingGroups(false);
        }
    }, 'di chuyển vị trí mẫu');

    const toggleSelect = useCallback((id: string) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }, []);

    const handleSelectAll = (filtered: Template[]) => {
        const selectableIds = filtered.filter(t => !t.id.startsWith('sys_')).map(t => t.id);
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

    const handleStartEdit = useCallback(async (template: Template) => {
        if (template.id.startsWith('sys_')) {
            setEditingTemplate(template);
            setIsEditorOpen(true);
            return;
        }

        if (template.blocks && template.blocks.length > 0 && typeof template.blocks[0] === 'object') {
            setEditingTemplate(template);
            setIsEditorOpen(true);
            return;
        }

        const loadToast = toast.loading('Đang mở trình thiết kế...');
        try {
            const res = await api.get<Template>(`templates/${template.id}`);
            toast.dismiss(loadToast);
            if (res.success && res.data) {
                setEditingTemplate(res.data);
                setIsEditorOpen(true);
            } else {
                showToast('Không thể tải chi tiết mẫu', 'error');
            }
        } catch {
            toast.dismiss(loadToast);
            showToast('Lỗi kết nối khi tải mẫu', 'error');
        }
    }, [showToast]);

    const handleDuplicate = adminGuard(async (tpl: Template) => {
        if (duplicatingRef.current) return;
        duplicatingRef.current = true;
        try {
            let fullTpl = tpl;
            if (!tpl.id.startsWith('sys_') && (!tpl.blocks || tpl.blocks.length === 0 || typeof tpl.blocks[0] !== 'object')) {
                const res = await api.get<Template>(`templates/${tpl.id}`);
                if (res.success && res.data) fullTpl = res.data;
            }

            const baseName = fullTpl.name.replace(' (Copy)', '');
            const newName = `${baseName} (Copy)`;

            let htmlContent = fullTpl.htmlContent;
            if (!htmlContent && fullTpl.blocks && typeof fullTpl.blocks[0] === 'object') {
                htmlContent = compileHTML(fullTpl.blocks, fullTpl.bodyStyle, fullTpl.name);
            }

            const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}');
            const creatorInfo = user.name ? { name: user.name, picture: user.picture || '/imgs/ICON.png' } : null;

            const newTpl = {
                name: newName,
                category: fullTpl.category,
                thumbnail: fullTpl.thumbnail,
                blocks: fullTpl.blocks,
                bodyStyle: {
                    ...fullTpl.bodyStyle,
                    creator: creatorInfo || { name: 'Hệ thống', picture: '/imgs/ICON.png' }
                },
                htmlContent
            };

            const res = await api.post('templates', newTpl);
            if (res.success) {
                const duplicatedWithDate = {
                    ...(res.data as any),
                    created_at: new Date().toISOString(),
                    createdAt: new Date().toISOString()
                } as Template;
                setUserTemplates(prev => [duplicatedWithDate, ...prev]);
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
    }, 'nhân bản mẫu');

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
    const allMergedTemplates = useMemo(() => [...userTemplates, ...SYSTEM_TEMPLATES], [userTemplates]);

    const filteredTemplates = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        const list = allMergedTemplates.filter(t => {
            const isSys = t.id.startsWith('sys_');
            const matchesGroup =
                filterGroupId === 'all' ? true :
                filterGroupId === 'personal' ? !isSys :
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
        return list;
    }, [allMergedTemplates, filterGroupId, debouncedSearch, sortBy]);

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

    const groupFilterOptions = useMemo(() => [
        { value: 'all', label: `Tất cả (${allMergedTemplates.length})` },
        { value: 'personal', label: `Mẫu của tôi (${userTemplates.length})` },
        { value: 'system', label: `Mẫu hệ thống (${SYSTEM_TEMPLATES.length})` },
        ...groups.map(g => ({
            value: g.id,
            label: `${g.name} (${allMergedTemplates.filter(t => t.groupId === g.id).length})`
        }))
    ], [allMergedTemplates, userTemplates.length, groups]);

    const pillClass = (active: boolean) =>
        `h-9 px-3 rounded-[var(--radius-md)] text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors border ${
            active
                ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-[var(--shadow-xs)]'
                : 'bg-[var(--color-surface)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]'
        }`;

    return (
        <div className="w-full flex flex-col gap-5">
            {isEditorOpen ? (
                <Suspense fallback={<div className="py-20 text-center text-sm text-[var(--color-text-muted)]">Đang mở trình thiết kế...</div>}>
                    <EmailEditor
                        template={editingTemplate}
                        groups={groups}
                        onSave={(data) => handleSaveTemplate(data, false)}
                        onCancel={() => { setIsEditorOpen(false); setEditingTemplate(undefined); }}
                        customMergeTags={customMergeTags}
                    />
                </Suspense>
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
                                primary: false
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
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)] overflow-hidden">
                        {/* Single-row Toolbar: category pills left, filter + sort + SearchBox right */}
                        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
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
                                        {userTemplates.length}
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

                                {groups.map(group => {
                                    const active = filterGroupId === group.id;
                                    const count = allMergedTemplates.filter(t => t.groupId === group.id).length;
                                    return (
                                        <div key={group.id} className="group/grp inline-flex items-center shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleFilterGroupChange(group.id)}
                                                className={pillClass(active)}
                                            >
                                                <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate max-w-[120px]">{group.name}</span>
                                                <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20 text-white' : 'bg-[var(--color-bg)] text-[var(--color-text-muted)]'}`}>
                                                    {count}
                                                </span>
                                            </button>
                                            {active && (
                                                <div className="inline-flex items-center ml-1 gap-0.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setEditingGroup(group); setNewGroupName(group.name); setIsGroupModalOpen(true); }}
                                                        className="w-7 h-7 rounded-[var(--radius-sm)] inline-flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] transition-colors"
                                                        title="Đổi tên nhóm"
                                                    >
                                                        <Edit3 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ isOpen: true, ids: [group.id], type: 'group' }); }}
                                                        className="w-7 h-7 rounded-[var(--radius-sm)] inline-flex items-center justify-center text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                                        title="Xóa nhóm"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                <button
                                    type="button"
                                    onClick={() => { setEditingGroup(null); setNewGroupName(''); setIsGroupModalOpen(true); }}
                                    className="h-9 px-2.5 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-secondary)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] inline-flex items-center gap-1 shrink-0 transition-colors"
                                    title="Tạo nhóm mẫu mới"
                                >
                                    <FolderPlus className="w-3.5 h-3.5" />
                                    <span>Nhóm mới</span>
                                </button>
                            </div>

                            <div className="ml-auto flex flex-wrap items-center gap-2">
                                {groups.length > 0 && (
                                    <div className="w-[165px]">
                                        <Select
                                            size="sm"
                                            value={filterGroupId}
                                            onChange={handleFilterGroupChange}
                                            options={groupFilterOptions}
                                        />
                                    </div>
                                )}
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
                                    debounceMs={300}
                                    placeholder="Tìm theo tên mẫu..."
                                    className="w-full sm:w-64"
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
                                        className="mt-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
                                    >
                                        Xóa bộ lọc
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => { setEditingTemplate(undefined); setIsEditorOpen(true); }}
                                        className="mt-2 h-9 px-4 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity"
                                    >
                                        <Plus className="w-4 h-4" /> Thiết kế mới
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {paginatedTemplates.map((template) => (
                                    <TemplateCard
                                        key={template.id}
                                        template={template}
                                        isSelected={selectedIds.includes(template.id)}
                                        groupName={getGroupName(template.groupId)}
                                        onToggleSelect={toggleSelect}
                                        onPreview={setPreviewTemplate}
                                        onEdit={handleStartEdit}
                                        onDuplicate={handleDuplicate}
                                        onDelete={(id) => setDeleteConfirm({ isOpen: true, ids: [id], type: 'template' })}
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
                            <div className="bg-slate-900/95 backdrop-blur-md border border-white/10 px-4 py-3 rounded-[var(--radius-lg)] shadow-xl flex flex-wrap items-center gap-3 lg:min-w-[520px]">
                                <div className="flex items-center gap-2.5 pr-3 border-r border-white/10">
                                    <span className="w-7 h-7 bg-[var(--color-primary)] rounded-[var(--radius-md)] flex items-center justify-center font-bold text-white text-xs">
                                        {selectedIds.length}
                                    </span>
                                    <span className="text-white font-semibold text-xs">Đã chọn</span>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedIds([])}
                                        className="text-rose-400 text-xs font-semibold hover:text-rose-300 ml-1"
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
                                        className="h-9 px-3 bg-rose-500/15 hover:bg-rose-600 text-rose-400 hover:text-white rounded-[var(--radius-md)] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors border border-rose-500/30 whitespace-nowrap"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" /> Xóa đã chọn
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleSelectAll(filteredTemplates)}
                                    className="inline-flex items-center gap-1.5 ml-auto text-white/70 hover:text-white text-xs font-semibold transition-colors"
                                >
                                    <Check className="w-3.5 h-3.5" /> Chọn tất cả
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

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
                            if (!isAdmin) {
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
                title={editingGroup ? 'Chỉnh sửa nhóm' : 'Tạo nhóm mới'}
                size="sm"
                footer={
                    <div className="flex justify-between w-full">
                        <Button variant="ghost" onClick={() => { setIsGroupModalOpen(false); setEditingGroup(null); setNewGroupName(''); }}>Hủy</Button>
                        <Button onClick={handleSaveGroup} isLoading={isSavingGroup} disabled={!newGroupName.trim()}>
                            {editingGroup ? 'Cập nhật' : 'Tạo nhóm'}
                        </Button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <Input
                        label="Tên nhóm"
                        placeholder="VD: Chào mừng, Khuyến mãi..."
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
