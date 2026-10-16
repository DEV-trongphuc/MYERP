import React, { useState } from 'react';
import {
    X, Search, Grid3x3, Plus, Trash2, FileText, Image as ImageIcon,
    File, Download, ExternalLink, MoreVertical, Database
} from 'lucide-react';
import { FileAttachment } from '../../types';
import { formatFileSize } from '../../utils/formatters';

interface WorkspacePanelProps {
    isOpen: boolean;
    onClose: () => void;
    workspaceDocs: FileAttachment[];
    onFileClick: (doc: FileAttachment) => void;
    onDeleteFile: (doc: FileAttachment) => void;
    onUploadFile: () => void;
    onClearWorkspace: () => void;
}

const WorkspacePanel: React.FC<WorkspacePanelProps> = ({
    isOpen,
    onClose,
    workspaceDocs,
    onFileClick,
    onDeleteFile,
    onUploadFile,
    onClearWorkspace
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [activeTab, setActiveTab] = useState<'all' | 'drafts' | 'cleanup'>('all');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    const filteredDocs = workspaceDocs.filter(doc =>
        doc.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getFileIcon = (doc: FileAttachment) => {
        const ext = doc.name.split('.').pop()?.toLowerCase();
        if (doc.type?.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '')) {
            return <ImageIcon className="w-5 h-5 text-amber-600" />;
        }
        if (ext === 'pdf') {
            return <FileText className="w-5 h-5 text-rose-500" />;
        }
        return <File className="w-5 h-5 text-slate-500" />;
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 animate-in fade-in duration-200"
                    onClick={onClose}
                />
            )}

            {/* Panel */}
            <div
                className={`fixed top-0 right-0 h-full w-[400px] bg-white shadow-2xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                {/* Header */}
                <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                            <Database className="w-5 h-5 text-brand" />
                        </div>
                        <div>
                            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                WORKSPACE
                            </h2>
                            <p className="text-xs text-slate-400 font-semibold">
                                {filteredDocs.length} tệp tin
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            title={viewMode === 'list' ? 'Grid View' : 'List View'}
                        >
                            <Grid3x3 className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                            onClick={onUploadFile}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Upload File"
                        >
                            <Plus className="w-4 h-4 text-slate-600" />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4 text-slate-600" />
                        </button>
                    </div>
                </div>

                {/* Search */}
                <div className="px-6 pt-4 pb-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm trong Workspace..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:bg-white focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-6 flex items-center gap-6 border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`pb-3 text-sm font-bold transition-colors relative ${activeTab === 'all'
                            ? 'text-brand'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        Tất cả tệp
                        {activeTab === 'all' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full" />
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('drafts')}
                        className={`pb-3 text-sm font-bold transition-colors relative ${activeTab === 'drafts'
                            ? 'text-brand'
                            : 'text-slate-400 hover:text-slate-600'
                            }`}
                    >
                        Bản nhập
                        {activeTab === 'drafts' && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full" />
                        )}
                    </button>
                    <button
                        onClick={onClearWorkspace}
                        className="pb-3 text-sm font-bold text-rose-500 hover:text-rose-600 transition-colors ml-auto"
                    >
                        Dọn dẹp
                    </button>
                </div>

                {/* File List */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 custom-scrollbar">
                    {filteredDocs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                            <Database className="w-16 h-16 opacity-20" />
                            <p className="text-sm font-semibold">
                                {searchTerm ? 'Không tìm thấy tệp nào' : 'Workspace trống'}
                            </p>
                            <button
                                onClick={onUploadFile}
                                className="mt-2 px-4 py-2 bg-brand text-white rounded-xl text-sm font-bold hover:bg-brand/90 transition-colors"
                            >
                                Tải tệp đầu tiên
                            </button>
                        </div>
                    ) : (
                        filteredDocs.map((doc, idx) => (
                            <div
                                key={doc.id || idx}
                                onClick={() => onFileClick(doc)}
                                className="group relative bg-white border border-slate-200 rounded-xl p-4 hover:border-brand hover:shadow-md transition-all cursor-pointer"
                            >
                                <div className="flex items-start gap-3">
                                    {/* Icon */}
                                    <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 group-hover:bg-brand/10 transition-colors">
                                        {getFileIcon(doc)}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="text-sm font-semibold text-slate-800 truncate group-hover:text-brand transition-colors">
                                                {doc.name}
                                            </h3>
                                            {doc.source === 'workspace' && (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-wider rounded-md shrink-0">
                                                    GLOBAL
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 mt-1 font-medium">
                                            {formatFileSize(doc.size)}
                                        </p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {doc.previewUrl && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.open(doc.previewUrl, '_blank');
                                                }}
                                                className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                                                title="Mở trong tab mới"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteFile(doc);
                                            }}
                                            className="p-1.5 hover:bg-rose-50 rounded-lg transition-colors"
                                            title="Xóa"
                                        >
                                            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </>
    );
};

export default WorkspacePanel;
