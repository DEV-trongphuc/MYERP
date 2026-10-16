import * as React from 'react';
import { useMemo } from 'react';
import { Globe, Save, Download, Trash2, FileSpreadsheet, FileText, FileCode, FileImage, FileVideo, FileAudio, File, Pin } from 'lucide-react';
import { FileAttachment } from '../../types';
import { formatFileSize, sanitizeUrl } from '../../utils/formatters';

const WorkspaceDocItem = React.memo(({
    doc,
    isCodeMode,
    onContextMenu,
    onClick,
    onMakeGlobal,
    onSaveSnippet,
    onDelete,
    onToggleContext,
    isInContext,
    isDarkTheme
}: {
    doc: FileAttachment,
    isCodeMode: boolean,
    onContextMenu: (e: React.MouseEvent) => void,
    onClick: () => void,
    onMakeGlobal: (doc: FileAttachment) => void,
    onSaveSnippet: (doc: FileAttachment) => void,
    onDelete: (doc: FileAttachment) => void,
    onToggleContext?: (doc: FileAttachment) => void,
    isInContext?: boolean,
    isDarkTheme?: boolean
}) => {
    // Sanitize the URL once
    const safeUrl = useMemo(() => sanitizeUrl(doc.previewUrl || doc.base64), [doc.previewUrl, doc.base64]);

    const isVirtual = safeUrl?.startsWith('virtual://') || doc.name.startsWith('preview_');

    // Get file extension and determine icon/color
    const ext = doc.name.split('.').pop()?.toLowerCase() || '';
    const getFileIcon = () => {
        // PDF
        if (ext === 'pdf') return { Icon: FileText, color: 'text-rose-500', bg: 'bg-rose-50' };
        // Excel/CSV
        if (['xls', 'xlsx', 'csv'].includes(ext)) return { Icon: FileSpreadsheet, color: 'text-emerald-600', bg: 'bg-emerald-50' };
        // Word
        if (['doc', 'docx'].includes(ext)) return { Icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' };
        // Code files
        if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'cs', 'php', 'html', 'css', 'json', 'xml', 'sql'].includes(ext))
            return { Icon: FileCode, color: 'text-blue-600', bg: 'bg-blue-50' };
        // Images
        if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext))
            return { Icon: FileImage, color: 'text-amber-600', bg: 'bg-amber-50' };
        // Videos
        if (['mp4', 'mov', 'avi', 'mkv'].includes(ext))
            return { Icon: FileVideo, color: 'text-red-600', bg: 'bg-red-50' };
        // Audio
        if (['mp3', 'wav', 'ogg'].includes(ext))
            return { Icon: FileAudio, color: 'text-pink-600', bg: 'bg-pink-50' };
        // Default
        return { Icon: File, color: 'text-slate-400', bg: 'bg-slate-50' };
    };

    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext) || (doc.type && doc.type.startsWith('image/'));
    const { Icon, color, bg } = getFileIcon();

    const renderSourceBadge = () => {
        if (!doc.source) return null;
        const src = doc.source.toLowerCase();
        let classes = '';
        let label = 'Global';

        if (src === 'global_training') {
            classes = 'bg-amber-600/80 text-white border-amber-300/30';
            label = 'Knowledge';
        } else if (src.includes('user') || src === 'file_upload') {
            classes = 'bg-blue-600/70 text-white border-blue-400/20';
            label = 'User';
        } else if (src.includes('assistant') || src.includes('ai')) {
            classes = 'bg-red-800/70 text-white border-red-400/20';
            label = 'AI';
        } else {
            classes = 'bg-slate-800/60 text-white border-slate-500/30';
            label = 'Global';
        }

        return (
            <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter backdrop-blur-md border shadow-sm ${classes}`}>
                {label}
            </span>
        );
    };

    return (
        <div
            onContextMenu={onContextMenu}
            onClick={onClick}
            className={`p-4 rounded-2xl border transition-all cursor-pointer group flex flex-col gap-3 relative overflow-hidden ${isDarkTheme ? 'bg-[#161B24] border-slate-800 hover:border-brand/40 shadow-xl shadow-black/20' : 'bg-white border-slate-100 hover:border-brand hover:border-opacity-20 hover:shadow-lg'}`}
        >
            {/* Actions overlay */}
            <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 z-10">
                {!isVirtual && doc.source !== 'workspace' && doc.source !== 'global_training' && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onMakeGlobal(doc);
                        }}
                        className="p-2 rounded-xl border shadow-sm bg-white border-slate-200 text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-all font-bold"
                        title="Make Global"
                    >
                        <Globe className="w-3.5 h-3.5" />
                    </button>
                )}
                {isVirtual ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onSaveSnippet(doc);
                        }}
                        className={`p-2 rounded-xl border shadow-sm transition-all font-bold ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10' : 'bg-white border-slate-200 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
                        title="Luu nhanh (Quick Save)"
                    >
                        <Save className="w-3.5 h-3.5" />
                    </button>
                ) : (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (safeUrl) window.open(safeUrl, '_blank');
                        }}
                        className={`p-2 rounded-xl border shadow-sm transition-all font-bold ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10' : 'bg-white border-slate-200 text-slate-500 hover:text-blue-600 hover:bg-blue-50'}`}
                        title="Tải xuống"
                    >
                        <Download className="w-3.5 h-3.5" />
                    </button>
                )}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(doc);
                    }}
                    className={`p-2 rounded-xl border shadow-sm transition-all font-bold ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10' : 'bg-white border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50'}`}
                    title="Xóa tệp"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {onToggleContext && (
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleContext(doc);
                    }}
                    className={`absolute bottom-3 right-3 p-2 rounded-xl border shadow-sm transition-all font-bold z-10 ${isInContext ? 'bg-brand text-white border-brand shadow-brand' : (isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-brand' : 'bg-white border-slate-200 text-slate-400 hover:text-brand hover:border-brand/40')}`}
                    title={isInContext ? "Gỡ khỏi Context" : "Ghim làm Context để hỏi AI"}
                >
                    <Pin className={`w-3.5 h-3.5 ${isInContext ? 'fill-current' : ''}`} />
                </button>
            )}

            {/* Preview Section */}
            {isImage && safeUrl ? (
                <div className="w-full h-32 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 relative group/img">
                    <img src={safeUrl} alt={doc.name} className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity" />
                    <div className="absolute bottom-2 left-2 z-10">
                        {renderSourceBadge()}
                    </div>
                </div>
            ) : (
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative ${isDarkTheme ? 'bg-slate-800' : bg} ${color} group-hover:scale-110 transition-transform`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    {renderSourceBadge()}
                </div>
            )}

            {/* Info Section */}
            <div className="flex-1 min-w-0">
                <h5 className={`text-[12px] font-bold truncate leading-tight transition-colors ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>{doc.name}</h5>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-medium ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>{formatFileSize(doc.size || 0)}</span>
                </div>
            </div>
        </div>
    );
});

export default WorkspaceDocItem;
