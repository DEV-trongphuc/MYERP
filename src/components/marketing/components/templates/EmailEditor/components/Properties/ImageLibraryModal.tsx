// src/components/marketing/components/templates/EmailEditor/components/Properties/ImageLibraryModal.tsx
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Search, FolderOpen, Image as ImageIcon, CheckCircle2,
    Loader2, RefreshCw, AlertCircle, Trash2, Upload,
    ChevronLeft, ChevronRight, Pencil, Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../../../services/storageAdapter';
import { DEMO_MODE } from '../../../../../utils/config';
import { getMktPortalRoot } from '../../../../../utils/portalRoot';

interface ImageLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect?: (url: string) => void;
}

export interface ImageFile {
    name: string;
    uniqueName: string;
    url: string;
    thumbUrl?: string;
    size: number;
    date: number;
    modified_at?: number;
    type?: string;
}

const PAGE_SIZE = 24;

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(unixSec: number) {
    if (!unixSec) return '';
    return new Date(unixSec * 1000).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

// ── Demo Mode helpers ─────────────────────────────────────────────────────────
const DEMO_IMAGES_KEY = 'mailflow_demo_images';

const DEMO_STOCK_IMAGES: ImageFile[] = [
    { name: 'banner-sale.jpg', uniqueName: 'banner-sale.jpg', url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&auto=format&fit=crop', size: 85000, date: Math.floor(Date.now() / 1000) - 86400 },
    { name: 'product-coffee.jpg', uniqueName: 'product-coffee.jpg', url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop', size: 72000, date: Math.floor(Date.now() / 1000) - 172800 },
    { name: 'team-photo.jpg', uniqueName: 'team-photo.jpg', url: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop', size: 110000, date: Math.floor(Date.now() / 1000) - 259200 },
    { name: 'discount-banner.jpg', uniqueName: 'discount-banner.jpg', url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800&q=60&auto=format&fit=crop&crop=entropy', size: 95000, date: Math.floor(Date.now() / 1000) - 345600 },
    { name: 'logo-domation.png', uniqueName: 'logo-domation.png', url: 'https://images.unsplash.com/photo-1634986666676-ec8fd927c23d?w=400&auto=format&fit=crop', size: 34000, date: Math.floor(Date.now() / 1000) - 432000 },
    { name: 'newsletter-hero.jpg', uniqueName: 'newsletter-hero.jpg', url: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop', size: 125000, date: Math.floor(Date.now() / 1000) - 518400 },
];

function getDemoImages(): ImageFile[] {
    try {
        const raw = localStorage.getItem(DEMO_IMAGES_KEY);
        if (!raw) {
            localStorage.setItem(DEMO_IMAGES_KEY, JSON.stringify(DEMO_STOCK_IMAGES));
            return DEMO_STOCK_IMAGES;
        }
        return JSON.parse(raw) as ImageFile[];
    } catch {
        return DEMO_STOCK_IMAGES;
    }
}

function saveDemoImages(imgs: ImageFile[]) {
    localStorage.setItem(DEMO_IMAGES_KEY, JSON.stringify(imgs));
}

// ── Module-Level In-Memory Cache for 0ms Instant Open ─────────────────────────
let cachedLibraryImages: ImageFile[] | null = null;
let cachedLibraryTimestamp = 0;
let inFlightLibraryFetch: Promise<ImageFile[]> | null = null;

async function fetchLibraryImagesInternal(force = false): Promise<ImageFile[]> {
    if (DEMO_MODE) {
        const demo = getDemoImages();
        cachedLibraryImages = demo;
        cachedLibraryTimestamp = Date.now();
        return demo;
    }

    if (!force && cachedLibraryImages && Date.now() - cachedLibraryTimestamp < 20000) {
        return cachedLibraryImages;
    }

    if (inFlightLibraryFetch) {
        return inFlightLibraryFetch;
    }

    inFlightLibraryFetch = (async () => {
        try {
            const res = await api.get<ImageFile[]>('upload?route=library');
            if (res.success && Array.isArray(res.data)) {
                const imgs = res.data.filter((f: any) => {
                    const ext = (f.type || '').toLowerCase();
                    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);
                });
                cachedLibraryImages = imgs;
                cachedLibraryTimestamp = Date.now();
                return imgs;
            }
            const res2 = await api.get<any[]>('list_images');
            if (res2.success && Array.isArray(res2.data)) {
                const fallbackImgs: ImageFile[] = res2.data.map((f: any) => ({
                    name: f.name,
                    uniqueName: f.name,
                    url: f.url,
                    thumbUrl: f.thumbUrl || f.url,
                    size: f.size ?? 0,
                    date: f.date ?? 0,
                    modified_at: f.date ?? 0,
                }));
                cachedLibraryImages = fallbackImgs;
                cachedLibraryTimestamp = Date.now();
                return fallbackImgs;
            }
            throw new Error('Không thể tải danh sách ảnh');
        } finally {
            inFlightLibraryFetch = null;
        }
    })();

    return inFlightLibraryFetch;
}

/**
 * Preload image library into RAM so clicking "Thư viện Ảnh" opens in 0ms
 */
export function preloadImageLibrary(): void {
    fetchLibraryImagesInternal(false).catch(() => {});
}

const ImageLibraryModal: React.FC<ImageLibraryModalProps> = ({ isOpen, onClose, onSelect }) => {
    const [images, setImages]               = useState<ImageFile[]>(() => cachedLibraryImages || []);
    const [loading, setLoading]             = useState<boolean>(() => !cachedLibraryImages);
    const [refreshing, setRefreshing]       = useState<boolean>(false);
    const [search, setSearch]               = useState('');
    const [page, setPage]                   = useState(1);
    const [uploading, setUploading]         = useState(false);
    const [error, setError]                 = useState('');
    // Single delete states
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [deleting, setDeleting]           = useState<string | null>(null);
    const [deleteError, setDeleteError]     = useState<string | null>(null);
    // Multi-select & bulk delete
    const [selected, setSelected]                   = useState<Set<string>>(new Set());
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
    const [bulkDeleting, setBulkDeleting]           = useState(false);
    const [bulkDeleteError, setBulkDeleteError]     = useState('');
    // Rename state
    const [renamingKey, setRenamingKey]     = useState<string | null>(null);
    const [renameValue, setRenameValue]     = useState('');
    const [renameSaving, setRenameSaving]   = useState(false);
    const renameInputRef = useRef<HTMLInputElement>(null);

    const syncImages = useCallback((updater: ImageFile[] | ((prev: ImageFile[]) => ImageFile[])) => {
        setImages(prev => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            cachedLibraryImages = next;
            cachedLibraryTimestamp = Date.now();
            return next;
        });
    }, []);

    const fetchImages = useCallback(async (force = false) => {
        const hasWarmCache = Boolean(cachedLibraryImages && cachedLibraryImages.length > 0);
        if (!hasWarmCache) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }
        setError('');
        try {
            const list = await fetchLibraryImagesInternal(force);
            setImages(list);
        } catch {
            if (!hasWarmCache) {
                setError('Không thể tải danh sách hình ảnh. Vui lòng thử lại.');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            setPage(1);
            setSearch('');
            setSelected(new Set());
            if (cachedLibraryImages) {
                setImages(cachedLibraryImages);
                setLoading(false);
            }
            fetchImages(false);
        }
    }, [isOpen, fetchImages]);

    useEffect(() => { setPage(1); }, [search]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const fileList = Array.from(e.target.files || []);
        if (fileList.length === 0) return;
        setUploading(true);

        if (DEMO_MODE) {
            for (const file of fileList) {
                await new Promise<void>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const dataUrl = reader.result as string;
                        const uniqueName = `${Date.now()}_${file.name}`;
                        const newImg: ImageFile = {
                            name: file.name,
                            uniqueName,
                            url: dataUrl,
                            thumbUrl: dataUrl,
                            size: file.size,
                            date: Math.floor(Date.now() / 1000),
                        };
                        const current = getDemoImages();
                        const updated = [newImg, ...current];
                        saveDemoImages(updated);
                        syncImages(updated);
                        resolve();
                    };
                    reader.onerror = () => resolve();
                    reader.readAsDataURL(file);
                });
            }
            toast.success(`Đã tải lên ${fileList.length} ảnh`);
            setUploading(false);
            e.target.value = '';
            return;
        }

        let uploadedCount = 0;
        const newlyUploaded: ImageFile[] = [];
        try {
            for (const file of fileList) {
                const formData = new FormData();
                formData.append('file', file);
                const res = await api.post<any>('upload', formData);
                if (res.success && res.data) {
                    uploadedCount++;
                    const nowSec = Math.floor(Date.now() / 1000);
                    newlyUploaded.push({
                        name: res.data.name || file.name,
                        uniqueName: res.data.uniqueName || res.data.name || file.name,
                        url: res.data.url,
                        thumbUrl: res.data.thumbUrl || res.data.url,
                        size: res.data.size ?? file.size,
                        date: res.data.date ?? nowSec,
                        modified_at: res.data.modified_at ?? nowSec,
                        type: res.data.type,
                    });
                }
            }
            if (uploadedCount > 0) {
                syncImages(prev => [...newlyUploaded, ...prev]);
                setPage(1);
                toast.success(`Đã tải lên ${uploadedCount} hình ảnh thành công`);
            } else {
                toast.error('Tải ảnh lên thất bại');
            }
        } catch {
            toast.error('Lỗi kết nối khi tải ảnh lên');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleDeleteClick = (e: React.MouseEvent, uniqueName: string) => {
        e.stopPropagation();
        setDeleteError(null);
        setConfirmDelete(uniqueName);
    };

    const handleDeleteConfirm = async (e: React.MouseEvent, uniqueName: string) => {
        e.stopPropagation();
        setDeleting(uniqueName);
        setDeleteError(null);

        if (DEMO_MODE) {
            const updated = getDemoImages().filter(f => f.uniqueName !== uniqueName);
            saveDemoImages(updated);
            syncImages(updated);
            toast.success('Đã xóa ảnh');
            setDeleting(null);
            setConfirmDelete(null);
            return;
        }

        try {
            const res = await api.get<any>(`upload?route=delete&file=${encodeURIComponent(uniqueName)}`);
            if (res.success) {
                syncImages(prev => prev.filter(f => f.uniqueName !== uniqueName));
                setSelected(prev => {
                    const n = new Set(prev);
                    n.delete(uniqueName);
                    return n;
                });
                toast.success('Đã xóa ảnh');
            } else {
                setDeleteError(uniqueName);
            }
        } catch {
            setDeleteError(uniqueName);
        } finally {
            setDeleting(null);
            setConfirmDelete(null);
        }
    };

    const handleDeleteCancel = (e: React.MouseEvent) => {
        e.stopPropagation();
        setConfirmDelete(null);
        setDeleteError(null);
    };

    const startRename = (e: React.MouseEvent, file: ImageFile) => {
        e.stopPropagation();
        setRenamingKey(file.uniqueName);
        setRenameValue(file.name);
        setTimeout(() => renameInputRef.current?.select(), 50);
    };

    const commitRename = async (uniqueName: string) => {
        const trimmed = renameValue.trim();
        if (!trimmed || trimmed === images.find(f => f.uniqueName === uniqueName)?.name) {
            setRenamingKey(null);
            return;
        }
        setRenameSaving(true);
        if (DEMO_MODE) {
            const updated = getDemoImages().map(f =>
                f.uniqueName === uniqueName ? { ...f, name: trimmed } : f
            );
            saveDemoImages(updated);
            syncImages(updated);
            toast.success('Đã đổi tên ảnh');
            setRenamingKey(null);
            setRenameSaving(false);
            return;
        }
        try {
            const res = await api.post<{ uniqueName: string; name: string; url: string; thumbUrl?: string }>(
                'upload?route=rename',
                JSON.stringify({ uniqueName, newName: trimmed })
            );
            if (res.success && res.data) {
                syncImages(prev => prev.map(f =>
                    f.uniqueName === uniqueName
                        ? {
                            ...f,
                            name: res.data!.name,
                            uniqueName: res.data!.uniqueName,
                            url: res.data!.url,
                            thumbUrl: res.data!.thumbUrl || f.thumbUrl || res.data!.url,
                        }
                        : f
                ));
                toast.success('Đã đổi tên ảnh');
            } else {
                toast.error('Đổi tên thất bại');
            }
        } catch {
            toast.error('Lỗi kết nối');
        } finally {
            setRenameSaving(false);
            setRenamingKey(null);
        }
    };

    const toggleSelect = (uniqueKey: string) => {
        setSelected(prev => {
            const n = new Set(prev);
            if (n.has(uniqueKey)) n.delete(uniqueKey); else n.add(uniqueKey);
            return n;
        });
    };

    const handleBulkDelete = async () => {
        const toDelete = Array.from(selected);
        if (toDelete.length === 0) return;
        setBulkDeleting(true);
        setBulkDeleteError('');
        try {
            // Single batch request instead of sequential loop!
            const res = await api.post<any>('upload?route=bulk_delete', { files: toDelete });
            if (res.success) {
                const deletedList: string[] = Array.isArray(res.data?.deleted) ? res.data.deleted : toDelete;
                const deletedSet = new Set(deletedList);
                syncImages(prev => prev.filter(f => !deletedSet.has(f.uniqueName)));
                setSelected(new Set());
                setBulkDeleteConfirm(false);
                toast.success(`Đã xóa ${deletedSet.size} hình ảnh`);
            } else {
                setBulkDeleteError(res.message || 'Không thể xóa các ảnh đã chọn.');
            }
        } catch {
            setBulkDeleteError('Lỗi kết nối khi xóa hàng loạt.');
        } finally {
            setBulkDeleting(false);
        }
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return images;
        return images.filter(f => (f.name || '').toLowerCase().includes(q));
    }, [images, search]);

    if (!isOpen) return null;

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    return createPortal(
        <>
            {/* App-Standard Dark Blur Backdrop */}
            <div
                className="fixed inset-0 z-[2147483645] transition-opacity duration-200"
                style={{
                    zIndex: 2147483645,
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                }}
                onClick={onClose}
            />

            {/* Modal Container */}
            <div
                className="fixed inset-x-3 top-3 bottom-3 md:inset-x-[6%] md:top-5 md:bottom-5 lg:inset-x-[10%] xl:inset-x-[13%] z-[2147483646] flex flex-col bg-white rounded-[22px] border border-slate-200 shadow-2xl overflow-hidden"
                style={{ zIndex: 2147483646 }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-rose-50 border border-rose-200/80 rounded-[12px] text-[#BD1D2D] flex items-center justify-center shrink-0">
                            <ImageIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 text-[15px] leading-tight">Thư viện Hình ảnh</h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                {images.length} hình ảnh đã tải lên {onSelect ? '— Bấm vào ảnh để chọn ngay' : '— Quản lý & tối ưu ảnh WebP'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <label
                            className={`h-9 px-3.5 rounded-[11px] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all border ${
                                uploading
                                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                    : 'bg-[#BD1D2D] hover:bg-[#a61927] text-white border-[#BD1D2D] shadow-xs'
                            }`}
                        >
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            <span>{uploading ? 'Đang tải lên...' : 'Tải ảnh lên'}</span>
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                multiple
                                onChange={handleUpload}
                                disabled={uploading}
                            />
                        </label>
                        <button
                            type="button"
                            onClick={() => fetchImages(true)}
                            disabled={loading || refreshing}
                            className="w-9 h-9 rounded-[11px] border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer outline-none focus:outline-none"
                            title="Làm mới thư viện"
                        >
                            <RefreshCw className={`w-4 h-4 ${(loading || refreshing) ? 'animate-spin text-[#BD1D2D]' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-9 h-9 rounded-[11px] bg-slate-100 hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer outline-none focus:outline-none"
                            title="Đóng"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="px-6 py-3 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between gap-3 shrink-0">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm theo tên hình ảnh..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            data-no-autofocus="true"
                            className="w-full h-9 pl-9 pr-8 text-xs bg-white border border-slate-200 rounded-[10px] text-slate-800 placeholder-slate-400 outline-none focus:border-[#BD1D2D] transition-colors"
                        />
                        {search && (
                            <button
                                type="button"
                                onClick={() => setSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                        <span>Hiển thị {paged.length} / {filtered.length} ảnh</span>
                    </div>
                </div>

                {/* Image Grid */}
                <div data-lenis-prevent="true" className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-white">
                    {loading && images.length === 0 ? (
                        /* Layout-Matched Skeleton Grid (Zero full-screen spinner!) */
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5">
                            {Array.from({ length: 18 }).map((_, idx) => (
                                <div key={idx} className="rounded-[14px] border border-slate-200 overflow-hidden bg-white">
                                    <div className="aspect-square bg-slate-100 animate-pulse" />
                                    <div className="p-2.5 space-y-1.5">
                                        <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
                                        <div className="h-2.5 w-1/2 bg-slate-100 rounded animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : error && images.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3 text-rose-600">
                                <AlertCircle className="w-8 h-8" />
                                <p className="text-xs font-semibold">{error}</p>
                                <button
                                    type="button"
                                    onClick={() => fetchImages(true)}
                                    className="px-3.5 py-1.5 rounded-[9px] bg-[#BD1D2D] text-white text-xs font-bold cursor-pointer"
                                >
                                    Thử tải lại
                                </button>
                            </div>
                        </div>
                    ) : paged.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2.5 text-slate-400">
                                <FolderOpen className="w-12 h-12 text-slate-300" />
                                <p className="text-sm font-bold text-slate-700">
                                    {search ? 'Không tìm thấy hình ảnh phù hợp' : 'Thư viện chưa có hình ảnh nào'}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {search ? 'Hãy thử tìm với từ khóa khác.' : 'Bấm nút "Tải ảnh lên" ở góc phải để thêm ảnh mới.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3.5">
                            {paged.map(file => {
                                const uniqueKey = file.uniqueName || file.url;
                                const isSelected = selected.has(uniqueKey);
                                const displayThumb = file.thumbUrl || file.url;
                                return (
                                    <div
                                        key={uniqueKey}
                                        onClick={(e) => {
                                            if (selected.size > 0 || e.shiftKey || e.ctrlKey || e.metaKey) {
                                                toggleSelect(uniqueKey);
                                            } else if (onSelect) {
                                                onSelect(file.url);
                                                onClose();
                                            } else {
                                                toggleSelect(uniqueKey);
                                            }
                                        }}
                                        className={`group relative rounded-[14px] border transition-all duration-150 cursor-pointer overflow-hidden bg-white ${
                                            isSelected
                                                ? 'border-[#BD1D2D] ring-2 ring-[#BD1D2D]/15'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        {/* Lightweight WebP Thumbnail */}
                                        <div className="aspect-square relative overflow-hidden bg-slate-100">
                                            <img
                                                src={displayThumb}
                                                alt={file.name}
                                                loading="lazy"
                                                decoding="async"
                                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                                                onError={e => {
                                                    const imgEl = e.target as HTMLImageElement;
                                                    if (file.url && imgEl.src !== file.url) {
                                                        imgEl.src = file.url;
                                                    } else {
                                                        imgEl.style.display = 'none';
                                                    }
                                                }}
                                            />

                                            {/* Selection Checkbox */}
                                            <div
                                                className={`absolute top-2 right-2 transition-all duration-150 cursor-pointer ${
                                                    isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-90 group-hover:opacity-100'
                                                }`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleSelect(uniqueKey);
                                                }}
                                            >
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shadow-xs ${
                                                    isSelected ? 'bg-[#BD1D2D] text-white' : 'bg-white/95 border border-slate-300'
                                                }`}>
                                                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                                </div>
                                            </div>

                                            {/* Single Delete Action */}
                                            {confirmDelete === uniqueKey ? (
                                                <div
                                                    className="absolute bottom-0 inset-x-0 flex items-center justify-between gap-1 bg-white/95 backdrop-blur-xs border-t border-rose-200 px-2 py-1.5 z-20"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <span className="text-[10px] font-bold text-[#BD1D2D] truncate">
                                                        {deleteError === uniqueKey ? 'Lỗi! Thử lại?' : 'Xóa ảnh?'}
                                                    </span>
                                                    <div className="flex gap-1 shrink-0">
                                                        <button
                                                            type="button"
                                                            onClick={e => handleDeleteConfirm(e, uniqueKey)}
                                                            disabled={deleting === uniqueKey}
                                                            className="text-[10px] font-bold text-white bg-[#BD1D2D] hover:bg-[#a61927] rounded px-2 py-0.5 disabled:opacity-60 cursor-pointer"
                                                        >
                                                            {deleting === uniqueKey ? '...' : 'Xóa'}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleDeleteCancel}
                                                            className="text-[10px] font-semibold text-slate-600 hover:text-slate-900 px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer"
                                                        >
                                                            Hủy
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={e => handleDeleteClick(e, uniqueKey)}
                                                    title="Xóa ảnh"
                                                    className="absolute bottom-2 right-2 p-1.5 rounded-[8px] bg-white/95 border border-slate-200 text-slate-500 hover:text-[#BD1D2D] hover:border-rose-200 shadow-2xs opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10 cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* File Info & Rename */}
                                        <div className="p-2.5 border-t border-slate-100">
                                            {renamingKey === uniqueKey ? (
                                                <div
                                                    className="flex items-center gap-1 mb-1"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <input
                                                        ref={renameInputRef}
                                                        value={renameValue}
                                                        onChange={e => setRenameValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') commitRename(uniqueKey);
                                                            if (e.key === 'Escape') setRenamingKey(null);
                                                        }}
                                                        className="flex-1 min-w-0 text-[11px] font-semibold text-slate-800 border border-[#BD1D2D] rounded px-1.5 py-0.5 outline-none bg-white"
                                                        autoFocus
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => commitRename(uniqueKey)}
                                                        disabled={renameSaving}
                                                        className="p-1 rounded text-emerald-600 hover:bg-emerald-50 transition-colors shrink-0 cursor-pointer"
                                                    >
                                                        {renameSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="group/name flex items-center gap-1 min-w-0 mb-1">
                                                    <p className="text-[11px] font-semibold text-slate-700 truncate leading-tight flex-1" title={file.name}>
                                                        {file.name}
                                                    </p>
                                                    <button
                                                        type="button"
                                                        onClick={e => startRename(e, file)}
                                                        title="Đổi tên"
                                                        className="shrink-0 p-0.5 rounded text-slate-400 hover:text-[#BD1D2D] opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                    >
                                                        <Pencil className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium">
                                                <span>{formatSize(file.size)}</span>
                                                <span>{formatDate(file.modified_at ?? file.date)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Bulk Delete Confirmation Overlay */}
                {bulkDeleteConfirm && (
                    <div className="absolute inset-0 z-30 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center gap-4 p-6">
                        <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
                            <Trash2 className="w-6 h-6 text-[#BD1D2D]" />
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-slate-900 text-sm">Xóa {selected.size} hình ảnh đã chọn?</p>
                            <p className="text-xs text-slate-500 mt-1">Hành động này sẽ xóa vĩnh viễn các file ảnh khỏi thư viện.</p>
                            {bulkDeleteError && <p className="text-xs text-[#BD1D2D] font-bold mt-2">{bulkDeleteError}</p>}
                        </div>
                        <div className="flex gap-2.5">
                            <button
                                type="button"
                                onClick={() => { setBulkDeleteConfirm(false); setBulkDeleteError(''); }}
                                disabled={bulkDeleting}
                                className="h-9 px-4 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-[10px] transition-colors cursor-pointer"
                            >
                                Hủy bỏ
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkDelete}
                                disabled={bulkDeleting}
                                className="h-9 px-4 text-xs font-bold text-white bg-[#BD1D2D] hover:bg-[#a61927] rounded-[10px] transition-colors flex items-center gap-1.5 disabled:opacity-60 cursor-pointer"
                            >
                                {bulkDeleting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xóa...</> : <><Trash2 className="w-3.5 h-3.5" /> Xác nhận xóa</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="shrink-0 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50">
                    <div className="text-xs font-semibold">
                        {selected.size > 0 ? (
                            <span className="flex items-center gap-1.5 text-[#BD1D2D] font-bold">
                                <CheckCircle2 className="w-4 h-4" />
                                Đã chọn {selected.size} ảnh
                            </span>
                        ) : (
                            <span className="text-slate-500">
                                {filtered.length > 0 ? `Trang ${safePage} / ${totalPages} (${filtered.length} ảnh)` : 'Chưa có ảnh nào'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={safePage <= 1}
                            className="h-8 px-3 rounded-[9px] border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" /> Trước
                        </button>
                        <span className="text-xs font-bold text-slate-700 px-2">{safePage} / {totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={safePage >= totalPages}
                            className="h-8 px-3 rounded-[9px] border border-slate-200 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 transition-colors cursor-pointer"
                        >
                            Sau <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        {selected.size > 0 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => { setBulkDeleteError(''); setBulkDeleteConfirm(true); }}
                                    className="h-8 px-3 text-xs font-bold text-[#BD1D2D] bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-[9px] transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Xóa ({selected.size})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelected(new Set())}
                                    className="h-8 px-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                                >
                                    Bỏ chọn
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>,
        getMktPortalRoot()
    );
};

export default ImageLibraryModal;
