
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, Search, FolderOpen, Image, FileText, FileSpreadsheet,
    File as FileIcon, CheckCircle2, Loader2, RefreshCw,
    Download, AlertCircle, Trash2, ChevronLeft, ChevronRight,
    Pencil, Check
} from 'lucide-react';
import { api } from '../../services/storageAdapter';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { useTheme } from '../../contexts/ThemeContext';

interface LibraryFile {
    name: string;
    uniqueName: string;
    url: string;
    path: string;
    size: number;
    type: string;
    modified_at: number;
}

interface FileLibraryModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Called with selected files; caller should assign logic & id */
    onSelect: (files: LibraryFile[]) => void;
    /** Allow picking multiple files */
    multi?: boolean;
    isDarkTheme?: boolean;
    zIndex?: number;
}

type FilterType = 'all' | 'image' | 'pdf' | 'doc';

const PAGE_SIZE = 20;

const IMAGES = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const PDFS   = ['pdf'];
const DOCS   = ['doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'zip'];

function getFilter(ext: string): FilterType {
    if (IMAGES.includes(ext)) return 'image';
    if (PDFS.includes(ext))   return 'pdf';
    return 'doc';
}

function FileTypeIcon({ ext, className = '' }: { ext: string; className?: string }) {
    if (IMAGES.includes(ext)) return <Image    className={`w-5 h-5 text-blue-500 ${className}`} />;
    if (PDFS.includes(ext))   return <FileText className={`w-5 h-5 text-rose-500   ${className}`} />;
    if (['xls', 'xlsx', 'csv'].includes(ext))
        return <FileSpreadsheet className={`w-5 h-5 text-emerald-500 ${className}`} />;
    return <FileIcon className={`w-5 h-5 text-slate-400 ${className}`} />;
}

function iconBg(ext: string, isDark: boolean = false): string {
    if (IMAGES.includes(ext)) return isDark ? 'bg-blue-950/40 border-blue-900/40' : 'bg-blue-50 border-blue-100';
    if (PDFS.includes(ext))   return isDark ? 'bg-rose-950/40 border-rose-900/40' : 'bg-rose-50 border-rose-100';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return isDark ? 'bg-emerald-950/40 border-emerald-900/40' : 'bg-emerald-50 border-emerald-100';
    return isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-100';
}

function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(unixSec: number) {
    return new Date(unixSec * 1000).toLocaleDateString('vi-VN', {
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
}

const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all',   label: 'Tất cả'   },
    { key: 'image', label: 'Hình ảnh' },
    { key: 'pdf',   label: 'PDF'      },
    { key: 'doc',   label: 'Tài liệu' },
];

const FileLibraryModal: React.FC<FileLibraryModalProps> = ({
    isOpen, onClose, onSelect, multi = true, isDarkTheme, zIndex
}) => {
    const { isDark } = (() => {
        try {
            return useTheme();
        } catch {
            return { isDark: false };
        }
    })();
    const activeDark = isDarkTheme ?? isDark;
    const [files, setFiles]         = useState<LibraryFile[]>([]);
    const [loading, setLoading]     = useState(false);
    const [search, setSearch]       = useState('');
    const [filter, setFilter]       = useState<FilterType>('all');
    const [selected, setSelected]   = useState<Set<string>>(new Set());
    const [error, setError]         = useState('');
    const [page, setPage]           = useState(1);
    // Delete states
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [deleting, setDeleting]           = useState<string | null>(null);
    const [deleteError, setDeleteError]     = useState<string | null>(null);
    // Bulk delete states
    const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
    const [bulkDeleting, setBulkDeleting]           = useState(false);
    const [bulkDeleteError, setBulkDeleteError]     = useState('');
    // Rename state
    const [renamingKey, setRenamingKey]   = useState<string | null>(null);
    const [renameValue, setRenameValue]   = useState('');
    const [renameSaving, setRenameSaving] = useState(false);
    const renameInputRef = useRef<HTMLInputElement>(null);

    const fetchFiles = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await api.get<LibraryFile[]>('upload?route=library');
            if (res.success) setFiles(res.data || []);
            else setError('Không thể tải thư viện file.');
        } catch {
            setError('Lỗi kết nối.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            setSelected(new Set());
            setSearch('');
            setFilter('all');
            setPage(1);
            fetchFiles();
        }
    }, [isOpen, fetchFiles]);

    // Reset page on search or filter change
    useEffect(() => { setPage(1); }, [search, filter]);

    if (!isOpen) return null;

    const filtered = files.filter(f => {
        const matchSearch = f.name.toLowerCase().includes(search.toLowerCase());
        const matchFilter = filter === 'all' || getFilter(f.type) === filter;
        return matchSearch && matchFilter;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage   = Math.min(page, totalPages);
    const paged      = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const toggleSelect = (uniqueName: string) => {
        if (!multi) {
            const picked = files.filter(f => f.uniqueName === uniqueName);
            onSelect(picked);
            onClose();
            return;
        }

        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(uniqueName)) {
                next.delete(uniqueName);
            } else {
                next.add(uniqueName);
            }
            return next;
        });
    };

    const handleConfirm = () => {
        const picked = files.filter(f => selected.has(f.uniqueName));
        onSelect(picked);
        onClose();
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
        try {
            const res = await api.get<{ deleted: string }>(`upload?route=delete&file=${encodeURIComponent(uniqueName)}`);
            if (res.success) {
                setFiles(prev => prev.filter(f => f.uniqueName !== uniqueName));
                setSelected(prev => { const n = new Set(prev); n.delete(uniqueName); return n; });
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

    // ── Rename ────────────────────────────────────────────────────────────────
    const startRename = (e: React.MouseEvent, file: LibraryFile) => {
        e.stopPropagation();
        setRenamingKey(file.uniqueName);
        setRenameValue(file.name);
        setTimeout(() => renameInputRef.current?.select(), 50);
    };

    const commitRename = async (uniqueName: string) => {
        const trimmed = renameValue.trim();
        if (!trimmed || trimmed === files.find(f => f.uniqueName === uniqueName)?.name) {
            setRenamingKey(null);
            return;
        }
        setRenameSaving(true);
        try {
            const res = await api.post<{ uniqueName: string; name: string; url: string }>(
                'upload?route=rename',
                JSON.stringify({ uniqueName, newName: trimmed })
            );
            if (res.success && res.data) {
                setFiles(prev => prev.map(f =>
                    f.uniqueName === uniqueName
                        ? { ...f, name: res.data!.name, uniqueName: res.data!.uniqueName, url: res.data!.url }
                        : f
                ));
                toast.success('Đã đổi tên');
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

    const handleBulkDelete = async () => {
        const toDelete = Array.from(selected);
        setBulkDeleting(true);
        setBulkDeleteError('');
        let failed = 0;
        for (const uniqueName of toDelete) {
            try {
                const res = await api.get<{ deleted: string }>(`upload?route=delete&file=${encodeURIComponent(uniqueName)}`);
                if (res.success) {
                    setFiles(prev => prev.filter(f => f.uniqueName !== uniqueName));
                    setSelected(prev => { const n = new Set(prev); n.delete(uniqueName); return n; });
                } else {
                    failed++;
                }
            } catch {
                failed++;
            }
        }
        setBulkDeleting(false);
        setBulkDeleteConfirm(false);
        if (failed > 0) {
            setBulkDeleteError(`Xóa thất bại ${failed} file.`);
        } else {
            setSelected(new Set());
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="4xl"
            isDarkTheme={activeDark}
            noPadding
            noHeader
            noScroll
            zIndex={zIndex}
        >
            <div className={`flex flex-col h-full select-none ${activeDark ? 'bg-[#11151d] text-slate-100' : 'bg-white text-slate-800'}`}>
                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 border-b shrink-0 ${activeDark ? 'border-slate-800/85' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${activeDark ? 'bg-blue-950/40 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                            <FolderOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className={`font-bold text-sm ${activeDark ? 'text-slate-200' : 'text-slate-800'}`}>Thư viện File</h3>
                            <p className={`text-[10px] font-medium ${activeDark ? 'text-slate-450' : 'text-slate-400'}`}>
                                {files.length} file đã upload — chọn để đính kèm
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchFiles}
                            disabled={loading}
                            className={`p-2 rounded-xl transition-all duration-200 ${activeDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'} hover:scale-105 active:scale-95`}
                            title="Tải lại"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            onClick={onClose}
                            className={`p-2 rounded-xl transition-all duration-200 ${activeDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'} hover:scale-105 active:scale-95`}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className={`px-6 py-3 border-b flex items-center gap-3 shrink-0 flex-wrap ${activeDark ? 'border-slate-800/80 bg-slate-900/20' : 'border-slate-100'}`}>
                    {/* Search */}
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-455" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm tên file..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className={`w-full pl-9 pr-4 py-2 text-xs rounded-xl outline-none transition-all ${
                                activeDark
                                    ? 'bg-slate-900 border border-slate-800 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-900/30'
                                    : 'bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-50'
                            }`}
                        />
                    </div>

                    {/* Filter pills */}
                    <div className={`flex gap-1 p-1 rounded-xl ${activeDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                        {FILTERS.map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key)}
                                className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                                    filter === f.key
                                        ? 'bg-blue-600 text-white shadow shadow-blue-500/20'
                                        : `${activeDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700'}`
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* File Grid */}
                <div className={`flex-1 overflow-y-auto p-6 custom-scrollbar ${activeDark ? 'bg-[#11151d]' : 'bg-white'}`}>
                    {loading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3 text-slate-400">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                <p className={`text-xs font-medium ${activeDark ? 'text-slate-450' : 'text-slate-400'}`}>Đang tải thư viện...</p>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3 text-rose-500">
                                <AlertCircle className="w-8 h-8" />
                                <p className="text-xs font-medium">{error}</p>
                                <button onClick={fetchFiles} className="text-xs text-blue-600 underline">Thử lại</button>
                            </div>
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="flex flex-col items-center gap-3 text-slate-400">
                                <FolderOpen className={`w-12 h-12 ${activeDark ? 'text-slate-800' : 'text-slate-200'}`} />
                                <p className={`text-sm font-bold ${activeDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {search ? 'Không tìm thấy file nào' : 'Thư viện trống'}
                                </p>
                                <p className={`text-xs ${activeDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {search ? 'Thử từ khóa khác.' : 'Upload file đính kèm để chúng xuất hiện ở đây.'}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                            {paged.map(file => {
                                const isSelected = selected.has(file.uniqueName);
                                const isImage = IMAGES.includes(file.type);
                                return (
                                    <div
                                        key={file.uniqueName}
                                        onClick={() => toggleSelect(file.uniqueName)}
                                        className={`
                                            group relative rounded-2xl border-2 transition-all duration-200 cursor-pointer overflow-hidden
                                            ${isSelected
                                                ? (activeDark
                                                    ? 'border-blue-500 bg-blue-950/20 ring-2 ring-blue-900/30 shadow-lg shadow-blue-950/50'
                                                    : 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-100 shadow-lg shadow-blue-100')
                                                : (activeDark
                                                    ? 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900 hover:shadow-md'
                                                    : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-md')}
                                        `}
                                    >
                                        {/* Thumbnail / Icon area */}
                                        <div className={`aspect-square relative overflow-hidden ${activeDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
                                            {isImage ? (
                                                <img
                                                    src={file.url}
                                                    alt={file.name}
                                                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                                    loading="lazy"
                                                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                                />
                                            ) : (
                                                <div className={`w-full h-full flex items-center justify-center border-b ${activeDark ? 'border-slate-850' : 'border-slate-100'} ${iconBg(file.type, activeDark)}`}>
                                                    <FileTypeIcon ext={file.type} className="!w-10 !h-10 opacity-70" />
                                                </div>
                                            )}

                                            {/* Extension badge */}
                                            <div className="absolute top-2 left-2">
                                                <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border ${iconBg(file.type, activeDark)}`}>
                                                    {file.type}
                                                </span>
                                            </div>

                                            {/* Selection indicator */}
                                            <div className={`absolute top-2 right-2 transition-all duration-200 ${isSelected ? 'opacity-100 scale-100' : 'opacity-0 scale-75 group-hover:opacity-60 group-hover:scale-90'}`}>
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center shadow ${isSelected ? 'bg-blue-600' : (activeDark ? 'bg-slate-900 border border-slate-700' : 'bg-white/90 border border-slate-200')}`}>
                                                    {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                                </div>
                                            </div>
                                            {/* Overlay on hover */}
                                            {!isSelected && (
                                                <div className="absolute inset-0 bg-blue-500/0 group-hover:bg-blue-500/5 transition-colors" />
                                            )}

                                            {/* Delete - inside thumbnail zone */}
                                            {confirmDelete === file.uniqueName ? (
                                                <div
                                                    className={`absolute bottom-0 inset-x-0 flex items-center justify-between gap-1 border-t px-2 py-1.5 z-20 ${activeDark ? 'bg-slate-900/98 border-rose-950' : 'bg-white/95 border-rose-200'}`}
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <span className="text-[9px] font-bold text-rose-500 truncate">
                                                        {deleteError === file.uniqueName ? 'Lỗi! Thử lại?' : 'Xóa file này?'}
                                                    </span>
                                                    <div className="flex gap-1 shrink-0">
                                                        <button
                                                            onClick={e => handleDeleteConfirm(e, file.uniqueName)}
                                                            disabled={deleting === file.uniqueName}
                                                            className="text-[9px] font-black text-white bg-rose-500 hover:bg-rose-600 rounded px-2 py-0.5 transition-colors disabled:opacity-60"
                                                        >
                                                            {deleting === file.uniqueName ? '...' : 'Xóa'}
                                                        </button>
                                                        <button
                                                            onClick={handleDeleteCancel}
                                                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded transition-colors ${activeDark ? 'text-slate-400 hover:text-slate-250 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-750 hover:bg-slate-100'}`}
                                                        >
                                                            Không
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={e => handleDeleteClick(e, file.uniqueName)}
                                                    title="Xóa file"
                                                    className={`absolute bottom-2 right-2 p-1.5 rounded-lg border shadow-sm opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 ${
                                                        activeDark
                                                            ? 'bg-slate-900 border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-900/50'
                                                            : 'bg-white/90 border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-200'
                                                    }`}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="p-3">
                                            {renamingKey === file.uniqueName ? (
                                                <div
                                                    className="flex items-center gap-1 mb-1"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <input
                                                        ref={renameInputRef}
                                                        value={renameValue}
                                                        onChange={e => setRenameValue(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') commitRename(file.uniqueName);
                                                            if (e.key === 'Escape') setRenamingKey(null);
                                                        }}
                                                        className={`flex-1 min-w-0 text-[10px] font-bold border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-blue-500 ${
                                                            activeDark
                                                                ? 'text-slate-200 border-slate-700 bg-slate-950'
                                                                : 'text-slate-700 border-blue-400 bg-white'
                                                        }`}
                                                        autoFocus
                                                    />
                                                    <button
                                                        onClick={() => commitRename(file.uniqueName)}
                                                        disabled={renameSaving}
                                                        className="p-1 rounded text-emerald-650 hover:bg-emerald-50 transition-colors shrink-0"
                                                    >
                                                        {renameSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="group/name flex items-center gap-1 min-w-0 mb-1">
                                                    <p className={`text-[10px] font-bold truncate leading-tight flex-1 ${activeDark ? 'text-slate-200' : 'text-slate-700'}`} title={file.name}>
                                                        {file.name}
                                                    </p>
                                                    <button
                                                        onClick={e => startRename(e, file)}
                                                        title="Đổi tên"
                                                        className="shrink-0 p-0.5 rounded text-slate-350 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all duration-150"
                                                    >
                                                        <Pencil className="w-2.5 h-2.5" />
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex items-center justify-between">
                                                <span className={`text-[9px] font-mono ${activeDark ? 'text-slate-500' : 'text-slate-400'}`}>{formatSize(file.size)}</span>
                                                <span className={`text-[9px] ${activeDark ? 'text-slate-500' : 'text-slate-400'}`}>{formatDate(file.modified_at)}</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Bulk delete confirm overlay */}
                {bulkDeleteConfirm && (
                    <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 rounded-[28px] ${activeDark ? 'bg-slate-950/98' : 'bg-white/95'}`}>
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center ${activeDark ? 'bg-rose-950/30' : 'bg-rose-105'}`}>
                            <Trash2 className="w-7 h-7 text-rose-500" />
                        </div>
                        <div className="text-center">
                            <p className={`font-bold text-sm ${activeDark ? 'text-slate-200' : 'text-slate-800'}`}>
                                Xóa {selected.size} file đã chọn?
                            </p>
                            <p className={`text-xs mt-1 ${activeDark ? 'text-slate-500' : 'text-slate-400'}`}>Hành động này không thể hoàn tác.</p>
                            {bulkDeleteError && (
                                <p className="text-xs text-rose-500 font-bold mt-2">{bulkDeleteError}</p>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => { setBulkDeleteConfirm(false); setBulkDeleteError(''); }}
                                disabled={bulkDeleting}
                                className={`px-5 py-2 text-xs font-bold rounded-xl transition-all disabled:opacity-50 ${activeDark ? 'text-slate-300 bg-slate-800 hover:bg-slate-750' : 'text-slate-605 bg-slate-100 hover:bg-slate-200'}`}
                            >
                                Không
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                disabled={bulkDeleting}
                                className="px-5 py-2 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-xl transition-all flex items-center gap-2 disabled:opacity-60 shadow-lg shadow-rose-900/10"
                            >
                                {bulkDeleting
                                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xóa...</>
                                    : <><Trash2 className="w-3.5 h-3.5" /> Xóa hết</>}
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className={`shrink-0 px-6 py-4 border-t flex items-center justify-between ${activeDark ? 'bg-slate-900 border-slate-800/80' : 'bg-slate-50/50 border-slate-100'}`}>
                    <div className={`text-xs font-medium ${activeDark ? 'text-slate-400' : 'text-slate-500'}`}>
                        {selected.size > 0 ? (
                            <span className={`flex items-center gap-1.5 font-bold ${activeDark ? 'text-blue-400' : 'text-blue-750'}`}>
                                <CheckCircle2 className="w-4 h-4" />
                                Đã chọn {selected.size} file
                            </span>
                        ) : (
                            <span className={`${activeDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                {filtered.length > 0 ? `${filtered.length} file · Trang ${safePage}/${totalPages}` : 'Chưa chọn file nào'}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={safePage <= 1}
                                    className={`flex items-center gap-0.5 px-2.5 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                                        activeDark ? 'text-slate-400 hover:text-slate-250 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" /> Trước
                                </button>
                                <span className={`text-xs font-bold min-w-[60px] text-center ${activeDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {safePage} / {totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                    disabled={safePage >= totalPages}
                                    className={`flex items-center gap-0.5 px-2.5 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                                        activeDark ? 'text-slate-400 hover:text-slate-250 hover:bg-slate-800' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    Sau <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                        {/* Bulk delete — only when files selected */}
                        {selected.size > 0 && (
                            <button
                                onClick={() => { setBulkDeleteError(''); setBulkDeleteConfirm(true); }}
                                className="px-4 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-all flex items-center gap-1.5"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                Xóa ({selected.size})
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className={`px-4 py-2 text-xs font-bold transition-colors ${activeDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-505 hover:text-slate-700'}`}
                        >
                            Hủy
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={selected.size === 0}
                            className={`px-5 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                                selected.size > 0
                                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20 hover:scale-[1.02]'
                                    : `${activeDark ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`
                            }`}
                        >
                            <Download className="w-3.5 h-3.5" />
                            Chọn {selected.size > 0 ? `(${selected.size})` : ''}
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default FileLibraryModal;
