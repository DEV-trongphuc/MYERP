import React from 'react';
import {
    Brain, ChevronDown, ChevronRight, Folder, Globe,
    FileText, Plus, MoreHorizontal, File, Trash2, Edit2, FileInput, GripVertical, Check, Download, ExternalLink, Move, Hash, CornerDownRight, Info, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AITrainingTableProps {
    groupedDocs: any[];
    expandedGroups: string[];
    setExpandedGroups: React.Dispatch<React.SetStateAction<string[]>>;
    onReorder: (fromIndex: number, toIndex: number, list: any[]) => void;
    toggleDoc: (id: string, currentStatus: any) => void;
    handleViewDoc: (id: string) => void;
    deleteDoc: (id: string | null | undefined, batchId?: string) => void;
    setUploadTargetBatchId?: (id: string | null) => void;
    fileInputRef?: React.RefObject<HTMLInputElement>;
    setNewDoc: (doc: any) => void;
    setIsAddModalOpen: (isOpen: boolean) => void;
    setInfoDoc: (doc: any) => void;
    newDoc: any;
    handleEditFolder?: (folder: any) => void;
    selectedIds: Set<string>;
    totalCount?: number;
    onToggleSelect: (id: string) => void;
    onToggleSelectAll: () => void;
    toggleWorkspace: (id: string, current: number) => void;
    isDarkTheme?: boolean;
    showGlobal?: boolean;
}

const formatSize = (bytes: number) => {
    if (!bytes) return '-';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const CustomCheckbox: React.FC<{ checked: boolean; onChange: () => void; isDarkTheme?: boolean }> = React.memo(({ checked, onChange, isDarkTheme }) => (
    <div
        onClick={(e) => { e.stopPropagation(); onChange(); }}
        className={`w-5 h-5 rounded-[6px] border flex items-center justify-center cursor-pointer transition-all duration-200 ${checked
            ? 'bg-brand border-brand text-white'
            : (isDarkTheme ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300')
            }`}
    >
        {checked && <Check className="w-3.5 h-3.5 stroke-[4]" />}
    </div>
));

const getFileInfo = (name: string, sourceType: string) => {
    if (sourceType === 'website' || sourceType === 'crawl_bot' || sourceType === 'sitemap') {
        return { icon: Globe, color: 'text-blue-500', bgColor: 'bg-blue-50', darkBgColor: 'bg-blue-500/10', darkColor: 'text-blue-400' };
    }
    if (sourceType === 'manual') {
        return { icon: FileText, color: 'text-slate-400', bgColor: 'bg-slate-50', darkBgColor: 'bg-slate-700/40', darkColor: 'text-slate-500' };
    }

    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'pdf':
            return { icon: File, color: 'text-rose-500', bgColor: 'bg-rose-50', darkBgColor: 'bg-rose-500/10', darkColor: 'text-rose-400' };
        case 'docx':
        case 'doc':
            return { icon: FileText, color: 'text-blue-600', bgColor: 'bg-blue-50', darkBgColor: 'bg-blue-600/10', darkColor: 'text-blue-400' };
        case 'txt':
            return { icon: FileText, color: 'text-slate-500', bgColor: 'bg-slate-50', darkBgColor: 'bg-slate-500/10', darkColor: 'text-slate-400' };
        default:
            return { icon: FileText, color: 'text-slate-400', bgColor: 'bg-slate-50', darkBgColor: 'bg-slate-800', darkColor: 'text-slate-500' };
    }
};

const MemberRow = React.memo(({ member, isLast, isSelected, onToggleSelect, handleViewDoc, toggleDoc, deleteDoc, setInfoDoc, toggleWorkspace, isDarkTheme, showGlobal }: any) => {
    const fileInfo = getFileInfo(member.name, member.source_type);
    const Icon = fileInfo.icon;

    let fileUrl = '';
    try {
        if (member.metadata) {
            const meta = typeof member.metadata === 'string' ? JSON.parse(member.metadata) : member.metadata;
            fileUrl = meta.file_url || '';
        }
    } catch (e) { }

    return (
        <div
            onClick={() => {
                if (member.source_type === 'upload' && fileUrl) {
                    window.open(fileUrl, '_blank');
                } else {
                    handleViewDoc(member.id);
                }
            }}
            className={`grid grid-cols-[30px_30px_1fr_auto] ${showGlobal ? 'lg:grid-cols-[40px_40px_minmax(300px,2fr)_100px_120px_120px_100px_100px_minmax(100px,1fr)]' : 'lg:grid-cols-[40px_40px_minmax(300px,2fr)_100px_120px_120px_100px_minmax(100px,1fr)]'} gap-2 lg:gap-4 px-3 lg:px-6 py-3 items-center group/member transition-colors relative cursor-pointer ${isSelected ? (isDarkTheme ? 'bg-brand/10' : 'bg-brand/5') : ''} ${isDarkTheme ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}`}
        >
            <div className={`absolute left-[92px] top-0 w-px transition-colors ${isLast ? 'h-1/2' : 'bottom-0'} ${isDarkTheme ? 'bg-slate-800 group-hover/member:bg-slate-700' : 'bg-slate-200 group-hover/member:bg-slate-300'}`}></div>
            <div className={`absolute left-[92px] top-1/2 w-4 h-px transition-colors ${isDarkTheme ? 'bg-slate-800 group-hover/member:bg-slate-700' : 'bg-slate-200 group-hover/member:bg-slate-300'}`}></div>
            <div className="flex justify-center items-center">
                <CustomCheckbox
                    checked={isSelected}
                    onChange={() => onToggleSelect(member.id)}
                    isDarkTheme={isDarkTheme}
                />
            </div>
            <div></div>
            <div className="flex items-center gap-2 lg:gap-4 pl-0 lg:pl-6 overflow-hidden">
                <div className={`w-8 h-8 flex items-center justify-center rounded-lg border shadow-sm transition-colors shrink-0 ${isDarkTheme ? (fileInfo.darkBgColor + ' ' + fileInfo.darkColor + ' border-slate-700') : (fileInfo.bgColor + ' ' + fileInfo.color + ' border-slate-100')}`}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="flex flex-col min-w-0">
                    <span className={`text-[12px] lg:text-[13px] font-medium truncate ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>{member.name}</span>
                    {fileUrl && (
                        <div className="flex items-center gap-2 mt-0.5">
                            <a
                                href={fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className={`text-[10px] flex items-center gap-1 font-bold ${isDarkTheme ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} underline decoration-dotted underline-offset-2`}
                            >
                                <ExternalLink className="w-2.5 h-2.5" /> Xem file gốc
                            </a>
                            <span className={`text-[9px] px-1 rounded ${isDarkTheme ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                                {member.name.split('.').pop()?.toUpperCase()}
                            </span>
                        </div>
                    )}
                </div>
            </div>
            <div className={`hidden lg:block text-right font-mono text-[11px] ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>
                {formatSize(member.content_size || 0)}
            </div>
            <div className="hidden lg:flex justify-center">
                {member.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></div>
                        <span className="text-[11px] font-medium text-amber-600">Waiting</span>
                    </div>
                ) : member.status === 'error' ? (
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
                        <span className="text-[11px] font-medium text-rose-600">Error</span>
                    </div>
                ) : member.status === 'processing' ? (
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-spin"></div>
                        <span className="text-[11px] font-medium text-blue-600">Learning...</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                        <span className="text-[11px] font-medium text-emerald-600 tracking-tight">Cấu trúc tốt</span>
                    </div>
                )}
            </div>
            <div className={`hidden lg:block text-center text-[11px] text-slate-400`}>
                {new Date(member.updated_at || member.created_at).toLocaleDateString()}
            </div>
            <div className="hidden lg:flex justify-center" onClick={e => e.stopPropagation()}>
                <div
                    onClick={() => {
                        if (member.status !== 'trained') {
                            toast.error('Vui lòng huấn luyện dữ liệu trước khi kích hoạt');
                            return;
                        }
                        toggleDoc(member.id, member.is_active);
                    }}
                    className={`
                        w-8 h-4 rounded-full p-0.5 transition-all duration-300
                        ${member.status !== 'trained' ? (isDarkTheme ? 'bg-slate-800' : 'bg-slate-100') + ' cursor-not-allowed opacity-50' : (member.is_active ? 'bg-emerald-500 cursor-pointer' : (isDarkTheme ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300') + ' cursor-pointer')}
                    `}
                >
                    <div className={`
                        w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300
                        ${member.is_active ? 'translate-x-4' : 'translate-x-0'}
                    `}></div>
                </div>
            </div>
            {showGlobal && (
                <div className="hidden lg:flex justify-center" onClick={e => e.stopPropagation()}>
                    {member.source_type === 'upload' && (
                        <div
                            onClick={() => {
                                toggleWorkspace(member.id, member.is_global_workspace);
                            }}
                            className={`
                                w-8 h-4 rounded-full p-0.5 transition-all duration-300
                                ${member.is_global_workspace ? 'bg-amber-600 cursor-pointer' : (isDarkTheme ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-200 hover:bg-slate-300') + ' cursor-pointer'}
                            `}
                        >
                            <div className={`
                                w-3 h-3 bg-white rounded-full shadow-sm transition-all duration-300
                                ${member.is_global_workspace ? 'translate-x-4' : 'translate-x-0'}
                            `}></div>
                        </div>
                    )}
                </div>
            )}
            <div className="flex justify-end pr-2" onClick={e => e.stopPropagation()}>
                <div className="relative w-full h-8 flex items-center justify-end">
                    <div className="absolute right-0 opacity-100 group-hover/member:opacity-0 transition-opacity duration-200">
                        <MoreHorizontal className="w-4 h-4 text-slate-300" />
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover/member:opacity-100 transition-all duration-200 translate-x-4 group-hover/member:translate-x-0">
                        <button onClick={() => setInfoDoc(member)} className={`p-1.5 rounded-md transition-all ${isDarkTheme ? 'hover:bg-blue-500/20 hover:text-blue-400 text-slate-500' : 'hover:bg-blue-50 hover:text-blue-600 text-slate-300'}`} title="Chi tiết & Tags">
                            <Info className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => handleViewDoc(member.id)}
                            className={`p-1.5 rounded-md transition-all ${isDarkTheme ? 'hover:bg-slate-700 hover:text-slate-200 text-slate-500' : 'hover:bg-slate-200 hover:text-slate-700 text-slate-300'}`}
                            title={member.source_type === 'upload' ? 'Xem nội dung văn bản' : 'Sửa'}
                        >
                            {member.source_type === 'upload' ? <Eye className="w-3.5 h-3.5" /> : <Edit2 className="w-3.5 h-3.5" />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); deleteDoc(member.id); }}
                            className={`p-1.5 rounded-md transition-all ${isDarkTheme ? 'hover:bg-rose-500/20 hover:text-rose-400 text-slate-500' : 'hover:bg-rose-100 hover:text-rose-600 text-slate-300'}`}
                            title="Xóa"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
});

const TrainingRow = React.memo(({ row, index, isExpanded, isSelected, dragOverIndex, handleDragStart, handleDragOver, handleDrop, onToggleSelect, setExpandedGroups, handleViewDoc, toggleDoc, setNewDoc, setIsAddModalOpen, handleEditFolder, deleteDoc, selectedIds, newDoc, setInfoDoc, toggleWorkspace, isDarkTheme, showGlobal }: any) => {
    const isGroup = row.isGroup;
    const activeCount = isGroup ? (row.members || []).filter((m: any) => Number(m.is_active) === 1 && m.status === 'trained').length : 0;

    return (
        <div
            className="group/row transition-all duration-200"
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDrop={(e) => handleDrop(e, index)}
        >
            <div
                onClick={() => {
                    if (isGroup) {
                        setExpandedGroups((prev: string[]) => prev.includes(row.batchId) ? prev.filter(b => b !== row.batchId) : [...prev, row.batchId]);
                    } else if (row.source_type === 'upload') {
                        let fUrl = '';
                        try {
                            if (row.metadata) {
                                const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
                                fUrl = meta.file_url || '';
                            }
                        } catch (e) { }
                        if (fUrl) window.open(fUrl, '_blank');
                    } else {
                        handleViewDoc(row.id);
                    }
                }}
                className={`
                    grid grid-cols-[30px_40px_1fr_auto] ${showGlobal ? 'lg:grid-cols-[40px_40px_minmax(300px,2fr)_100px_120px_120px_100px_100px_minmax(100px,1fr)]' : 'lg:grid-cols-[40px_40px_minmax(300px,2fr)_100px_120px_120px_100px_minmax(100px,1fr)]'} gap-2 lg:gap-4 px-3 lg:px-6 py-3 lg:py-4 items-center border-b transition-colors cursor-pointer select-none
                    ${isExpanded ? (isDarkTheme ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100') : (isDarkTheme ? 'bg-transparent border-slate-800' : 'bg-white border-slate-50')}
                    ${dragOverIndex === index ? (isDarkTheme ? 'border-t-2 border-t-brand border-b-transparent' : 'border-t-2 border-t-slate-800 border-b-transparent') : ''}
                    ${isSelected ? (isDarkTheme ? 'bg-brand/10' : 'bg-brand/5') : ''}
                    ${isDarkTheme ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50'}
                `}
            >
                <div className="flex justify-center items-center">
                    <CustomCheckbox
                        checked={isSelected}
                        onChange={() => onToggleSelect(row.id)}
                        isDarkTheme={isDarkTheme}
                    />
                </div>
                <div className="flex justify-center items-center gap-1">
                    <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1">
                        <GripVertical className="w-4 h-4" />
                    </div>
                    {isGroup && (
                        <button className={`w-5 h-5 flex items-center justify-center rounded-full text-slate-400 transition-all ${isExpanded ? 'rotate-90 text-slate-600' : ''}`}>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                <div className="flex items-center gap-2 lg:gap-4 pl-0 lg:pl-2 overflow-hidden">
                    <div className={`relative w-9 h-9 lg:w-10 lg:h-10 flex items-center justify-center rounded-lg lg:rounded-xl transition-all duration-200 shrink-0 border shadow-sm ${row.source_type === 'folder' ? (isDarkTheme ? 'bg-[#ffc800]/10 border-[#ffc800]/20' : 'bg-amber-50/50 border-[#fde68a]') : (isDarkTheme ? (getFileInfo(row.name, row.source_type).darkBgColor + ' ' + getFileInfo(row.name, row.source_type).darkColor + ' border-slate-700') : (getFileInfo(row.name, row.source_type).bgColor + ' ' + getFileInfo(row.name, row.source_type).color + ' border-slate-100'))}`}>
                        {row.source_type === 'folder' ? <Folder className={`w-4 h-4 lg:w-5 lg:h-5 ${isDarkTheme ? 'fill-[#ffc800] text-[#ffc800]' : 'fill-[#fbbf24] text-[#fbbf24]'}`} /> : React.createElement(getFileInfo(row.name, row.source_type).icon, { className: "w-4 h-4 lg:w-5 lg:h-5" })}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className={`text-[13px] lg:text-[14px] font-semibold truncate transition-colors ${isExpanded ? (isDarkTheme ? 'text-slate-100' : 'text-slate-900') : (isDarkTheme ? 'text-slate-200' : 'text-slate-700')}`}>{row.name}</span>
                        {isGroup ? (
                            <span className={`text-[10px] lg:text-[11px] font-medium mt-0.5 ${isDarkTheme ? 'text-slate-400' : 'text-slate-400'}`}>{(row.members || []).length.toLocaleString()} items</span>
                        ) : (() => {
                            let fileUrl = '';
                            try {
                                if (row.metadata) {
                                    const meta = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
                                    fileUrl = meta.file_url || '';
                                }
                            } catch (e) { }
                            return fileUrl ? (
                                <div className="flex items-center gap-2 mt-0.5">
                                    <a
                                        href={fileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={e => e.stopPropagation()}
                                        className={`text-[10px] flex items-center gap-1 font-bold ${isDarkTheme ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'} underline decoration-dotted underline-offset-2`}
                                    >
                                        <ExternalLink className="w-2.5 h-2.5" /> Xem file gốc
                                    </a>
                                    <span className={`text-[9px] px-1 rounded ${isDarkTheme ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400'}`}>
                                        {row.name.split('.').pop()?.toUpperCase()}
                                    </span>
                                </div>
                            ) : null;
                        })()}
                    </div>
                </div>
                <div className={`hidden lg:block text-right font-mono text-[12px] font-medium ${isDarkTheme ? 'text-slate-500' : 'text-slate-500'}`}>{formatSize(row.totalSize || row.content_size)}</div>
                <div className="hidden lg:flex justify-center">
                    {row.source_type !== 'folder' && (
                        row.status === 'pending' ? (
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div><span className="text-[12px] font-medium text-amber-600">Waiting</span></div>
                        ) : row.status === 'processing' ? (
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 animate-spin"></div><span className="text-[12px] font-medium text-blue-600">Learning...</span></div>
                        ) : row.status === 'error' ? (
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div><span className="text-[12px] font-medium text-rose-600">Error</span></div>
                        ) : (
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-[12px] font-medium text-emerald-600">Ready</span></div>
                        )
                    )}
                </div>
                <div className={`hidden lg:block text-center text-[12px] font-medium ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(row.updated_at || row.created_at).toLocaleDateString()}</div>
                <div className="hidden lg:flex justify-center" onClick={e => e.stopPropagation()}>
                    {isGroup ? (
                        <span className={`text-[11px] font-bold px-2 py-1 rounded-full ${activeCount > 0 ? (isDarkTheme ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDarkTheme ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')}`}>{activeCount.toLocaleString()}/{(row.members || []).length.toLocaleString()}</span>
                    ) : (
                        <div
                            onClick={() => {
                                if (row.status !== 'trained') {
                                    toast.error('Vui lòng huấn luyện dữ liệu trước khi kích hoạt');
                                    return;
                                }
                                toggleDoc(row.id, row.is_active);
                            }}
                            className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ease-out ${row.status !== 'trained' ? (isDarkTheme ? 'bg-slate-800' : 'bg-slate-100') + ' cursor-not-allowed opacity-50' : (row.is_active ? 'bg-emerald-500 cursor-pointer' : (isDarkTheme ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-300 hover:bg-slate-400') + ' cursor-pointer')}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${row.is_active ? 'translate-x-4' : 'translate-x-0'}`}></div>
                        </div>
                    )}
                </div>
                {showGlobal && (
                    <div className="hidden lg:flex justify-center" onClick={e => e.stopPropagation()}>
                        {!isGroup && row.source_type === 'upload' && (
                            <div
                                onClick={() => {
                                    toggleWorkspace(row.id, row.is_global_workspace);
                                }}
                                className={`w-9 h-5 rounded-full p-0.5 transition-all duration-300 ease-out ${row.is_global_workspace ? 'bg-amber-600 cursor-pointer' : (isDarkTheme ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-300 hover:bg-slate-400') + ' cursor-pointer'}`}
                            >
                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-all duration-300 ${row.is_global_workspace ? 'translate-x-4' : 'translate-x-0'}`}></div>
                            </div>
                        )}
                    </div>
                )}
                <div className="flex justify-end pr-2" onClick={e => e.stopPropagation()}>
                    <div className="relative w-full h-8 flex items-center justify-end">
                        <div className="absolute right-0 opacity-100 group-hover/row:opacity-0 transition-opacity duration-200"><MoreHorizontal className="w-5 h-5 text-slate-300" /></div>
                        <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-all duration-200 translate-x-4 group-hover/row:translate-x-0">
                            {isGroup ? (
                                <>
                                    <button onClick={() => { setNewDoc({ ...newDoc, batchName: row.batchId }); setIsAddModalOpen(true); }} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isDarkTheme ? 'hover:bg-slate-700 text-slate-500 hover:text-slate-200' : 'hover:bg-slate-200 hover:text-slate-700 text-slate-400'}`} title="Thêm DL"><Plus className="w-4 h-4" /></button>
                                    <button onClick={() => handleEditFolder?.(row)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isDarkTheme ? 'hover:bg-slate-700 text-slate-500 hover:text-slate-200' : 'hover:bg-slate-200 hover:text-slate-700 text-slate-400'}`} title="Đổi tên"><Edit2 className="w-4 h-4" /></button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setInfoDoc(row)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isDarkTheme ? 'hover:bg-blue-500/20 hover:text-blue-400 text-slate-500' : 'hover:bg-blue-50 hover:text-blue-600 text-slate-400'}`} title="Chi tiết & Tags"><Info className="w-4 h-4" /></button>
                                    <button
                                        onClick={() => handleViewDoc(row.id)}
                                        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isDarkTheme ? 'hover:bg-slate-700 text-slate-500 hover:text-slate-200' : 'hover:bg-slate-200 hover:text-slate-700 text-slate-400'}`}
                                        title={row.source_type === 'upload' ? 'Xem nội dung văn bản' : 'Sửa'}
                                    >
                                        {row.source_type === 'upload' ? <Eye className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                                    </button>
                                </>
                            )}
                            <button onClick={() => deleteDoc(row.id, row.isGroup ? row.batchId : undefined)} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isDarkTheme ? 'hover:bg-rose-500/20 hover:text-rose-400 text-slate-500' : 'hover:bg-rose-500 hover:text-white text-slate-400'}`} title="Xóa"><Trash2 className="w-4 h-4" /></button>
                        </div>
                    </div>
                </div>
            </div>
            <div className={`grid transition-all duration-300 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                <div className="overflow-hidden">
                    <div className={`flex flex-col ${isDarkTheme ? 'bg-slate-900/40' : 'bg-slate-50/20'}`}>
                        {isExpanded && (row.members || []).map((member: any, mIdx: number) => (
                            <MemberRow
                                key={member.id}
                                member={member}
                                isLast={mIdx === (row.members || []).length - 1}
                                isSelected={selectedIds.has(member.id)}
                                onToggleSelect={onToggleSelect}
                                handleViewDoc={handleViewDoc}
                                toggleDoc={toggleDoc}
                                deleteDoc={deleteDoc}
                                setInfoDoc={setInfoDoc}
                                toggleWorkspace={toggleWorkspace}
                                isDarkTheme={isDarkTheme}
                                showGlobal={showGlobal}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div >
    );
});

const AITrainingTable: React.FC<AITrainingTableProps> = ({
    groupedDocs,
    expandedGroups,
    setExpandedGroups,
    onReorder,
    toggleDoc,
    handleViewDoc,
    deleteDoc,
    setNewDoc,
    setIsAddModalOpen,
    newDoc,
    handleEditFolder,
    selectedIds,
    totalCount = 0,
    onToggleSelect,
    onToggleSelectAll,
    toggleWorkspace,
    setInfoDoc,
    isDarkTheme,
    showGlobal = false,
}) => {
    const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

    const handleDragStart = React.useCallback((e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('text/plain', index.toString());
        e.dataTransfer.effectAllowed = 'move';
    }, []);

    const handleDragOver = React.useCallback((e: React.DragEvent, index: number) => {
        e.preventDefault();
        setDragOverIndex(index);
    }, []);

    const handleDrop = React.useCallback((e: React.DragEvent, toIndex: number) => {
        e.preventDefault();
        setDragOverIndex(null);
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        if (fromIndex !== toIndex) {
            onReorder(fromIndex, toIndex, groupedDocs);
        }
    }, [onReorder, groupedDocs]);

    return (
        <div className="w-full">
            <div className={`grid grid-cols-[30px_30px_1fr_auto] ${showGlobal ? 'lg:grid-cols-[40px_40px_minmax(300px,2fr)_100px_120px_120px_100px_100px_minmax(100px,1fr)]' : 'lg:grid-cols-[40px_40px_minmax(300px,2fr)_100px_120px_120px_100px_minmax(100px,1fr)]'} gap-2 lg:gap-4 px-3 lg:px-6 py-4 border-b text-[10px] lg:text-[11px] font-bold uppercase tracking-wider items-center ${isDarkTheme ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-400'}`}>
                <div className="flex justify-center items-center">
                    <CustomCheckbox
                        checked={totalCount > 0 && selectedIds.size === totalCount}
                        onChange={onToggleSelectAll}
                        isDarkTheme={isDarkTheme}
                    />
                </div>
                <div className="text-center">#</div>
                <div className="pl-0 lg:pl-2">Tên dữ liệu</div>
                <div className="hidden lg:block text-right">Kích cỡ</div>
                <div className="hidden lg:block text-center">Trạng thái</div>
                <div className="hidden lg:block text-center">Cập nhật</div>
                <div className="hidden lg:block text-center">Active</div>
                {showGlobal && <div className="hidden lg:block text-center">Global</div>}
                <div className="text-right">Thao tác</div>
            </div>

            <div className="flex flex-col">
                {groupedDocs.length === 0 ? (
                    <div className={`flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-dashed mt-4 ${isDarkTheme ? 'bg-slate-800/20 border-slate-700' : 'bg-slate-50/30 border-slate-200'}`}>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-sm mb-4 ${isDarkTheme ? 'bg-slate-800 text-slate-600' : 'bg-white text-slate-200'}`}>
                            <Brain className="w-8 h-8" />
                        </div>
                        <p className={`font-medium text-sm ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Chưa có dữ liệu huấn luyện</p>
                    </div>
                ) : (
                    groupedDocs.map((row, index) => (
                        <TrainingRow
                            key={row.id || (row.isGroup ? row.batchId : 'row-' + index)}
                            row={row}
                            index={index}
                            isExpanded={row.isGroup && expandedGroups.includes(row.batchId)}
                            isSelected={selectedIds.has(row.id)}
                            dragOverIndex={dragOverIndex}
                            handleDragStart={handleDragStart}
                            handleDragOver={handleDragOver}
                            handleDrop={handleDrop}
                            onToggleSelect={onToggleSelect}
                            setExpandedGroups={setExpandedGroups}
                            handleViewDoc={handleViewDoc}
                            toggleDoc={toggleDoc}
                            setNewDoc={setNewDoc}
                            setIsAddModalOpen={setIsAddModalOpen}
                            handleEditFolder={handleEditFolder}
                            deleteDoc={deleteDoc}
                            selectedIds={selectedIds}
                            newDoc={newDoc}
                            setInfoDoc={setInfoDoc}
                            toggleWorkspace={toggleWorkspace}
                            isDarkTheme={isDarkTheme}
                            showGlobal={showGlobal}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default React.memo(AITrainingTable);
