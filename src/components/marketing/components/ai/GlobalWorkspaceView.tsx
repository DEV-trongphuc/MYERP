
import React from 'react';
import {
    RefreshCw, Plus, FileText, ImageIcon, ChevronDown, Layers, Globe, Upload, Sparkles, Check, CheckCircle, Search, Trash2, Database, FileSpreadsheet, FileCode, Volume2, Video, FileQuestion, Link as LinkIcon, ArrowRight, MessageSquare, Lightbulb, Bot
} from 'lucide-react';
import { api } from '../../services/storageAdapter';
import { toast } from 'react-hot-toast';
import { ChatbotInfo, FileAttachment } from '../../types';
import { formatFileSize, sanitizeUrl } from '../../utils/formatters';

interface GlobalWorkspaceViewProps {
    globalTab: 'files' | 'images';
    setGlobalTab: (tab: 'files' | 'images') => void;
    handleMigration: () => void;
    docInputRef: React.RefObject<HTMLInputElement>;
    globalTotal: number;
    globalSourceFilter: 'all' | 'workspace' | 'chat_user' | 'chat_assistant';
    setGlobalSourceFilter: (filter: 'all' | 'workspace' | 'chat_user' | 'chat_assistant') => void;
    handleSelectAll: () => void;
    selectedGlobalDocs: string[];
    globalDbAssets: FileAttachment[];
    globalSearchInput: string;
    setGlobalSearchInput: (input: string) => void;
    isPromoting: boolean;
    activeBot: ChatbotInfo | null;
    chatbotId: string | undefined;
    fetchGlobalAssets: () => void;
    setSelectedGlobalDocs: React.Dispatch<React.SetStateAction<string[]>>;
    setIsGlobalSelectMode: (is: boolean) => void;
    isGlobalSelectMode: boolean;
    handleDeleteFromDb: (ids: any[]) => void;
    setWorkspaceDocs: React.Dispatch<React.SetStateAction<FileAttachment[]>>;
    chatAssets: { files: FileAttachment[], images: FileAttachment[] };
    setDeletedGalleryImages: React.Dispatch<React.SetStateAction<string[]>>;
    isLoadingGlobalAssets: boolean;
    globalPage: number;
    setGlobalPage: React.Dispatch<React.SetStateAction<number>>;
    formatFileSize: (size: number) => string;
    copyToClipboard: (text: string) => void;
    setActiveDoc: (doc: FileAttachment | null) => void;
    setIsDocWorkspaceOpen: (open: boolean) => void;
    navigate: any;
    categoryId: string | undefined;
    setPreviewImage: (url: string | null) => void;
    remoteConvId: string | null;
    sessionId: string;
    onOpenTips?: () => void;
    variant?: 'default' | 'sidebar';
    isDarkTheme?: boolean;
}

const GlobalWorkspaceView = React.memo(({
    globalTab,
    setGlobalTab,
    handleMigration,
    docInputRef,
    globalTotal,
    globalSourceFilter,
    setGlobalSourceFilter,
    handleSelectAll,
    selectedGlobalDocs,
    globalDbAssets,
    globalSearchInput,
    setGlobalSearchInput,
    isPromoting,
    activeBot,
    chatbotId,
    fetchGlobalAssets,
    setSelectedGlobalDocs,
    setIsGlobalSelectMode,
    isGlobalSelectMode,
    handleDeleteFromDb,
    setWorkspaceDocs,
    chatAssets,
    setDeletedGalleryImages,
    isLoadingGlobalAssets,
    globalPage,
    setGlobalPage,
    formatFileSize: propFormatFileSize, // We can use the prop or the utility. The prop is passed from parent.
    copyToClipboard,
    setActiveDoc,
    setIsDocWorkspaceOpen,
    navigate,
    categoryId,
    setPreviewImage,
    remoteConvId,
    sessionId,
    onOpenTips,
    variant = 'default',
    isDarkTheme
}: GlobalWorkspaceViewProps) => {
    const totalPages = Math.ceil(globalTotal / 24); // Assume 24 is fixed here for simplicity or pass as prop
    const [isSourceDropdownOpen, setIsSourceDropdownOpen] = React.useState(false);

    return (
        <div className={`flex-1 flex flex-col items-center justify-start relative z-10 overflow-y-auto custom-scrollbar transition-colors duration-500
            ${variant === 'default'
                ? (isDarkTheme ? 'px-4 md:px-6 lg:px-12 pt-10 md:pt-16 lg:pt-24 pb-12 bg-[#05070A]' : 'px-4 md:px-6 lg:px-12 pt-10 md:pt-16 lg:pt-24 pb-12 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand/10 via-white to-white')
                : (isDarkTheme ? 'px-0 pt-0 pb-0 bg-slate-950' : 'px-0 pt-0 pb-0 bg-white')
            }`}>
            <div className={`w-full flex flex-col items-center animate-in fade-in duration-500`}>

                {/* Header - Only for Default Variant */}
                {variant === 'default' && (
                    <div className="w-full flex flex-col items-center text-center md:flex-row md:justify-between md:items-start md:text-left gap-6 md:gap-0 mb-6 md:mb-10 px-0 md:px-4 relative">
                        <div className="flex flex-col items-center md:items-start animate-in fade-in slide-in-from-left-5 duration-700">
                            <h1 className={`text-2xl md:text-[32px] font-black leading-tight flex items-center justify-center md:justify-start gap-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                                Global Workspace<span className="text-brand text-3xl md:text-4xl leading-none">.</span>
                            </h1>
                            <div className="flex items-center justify-center md:justify-start gap-3 mt-2 md:mt-3">
                                <div className={`hidden md:block w-8 h-[2px] ${isDarkTheme ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
                                <p className={isDarkTheme ? 'text-slate-400 text-xs md:text-sm font-medium' : 'text-slate-500 text-xs md:text-sm font-medium'}>
                                    Quản lý tệp tin và hình ảnh dùng chung cho tất cả các hội thoại của bạn.
                                </p>
                            </div>
                        </div>

                        {/* <div className="absolute -top-12 -right-6 z-10 animate-bounce-slow hidden md:block">
                            <img
                                src="https://pngfile.net/files/preview/960x960/11741189725reo9wbrtum5xxfbhubjnxavgk71sl6ptkgksc801wvj0l5pjgdch8arnleln7oqh0kzvi0wrniegc642iks8woshwo14pifdaq67.png"
                                alt="AI Mascot"
                                className="w-40 h-auto drop-shadow-2xl"
                                style={{ transform: 'scaleX(-1)' }}
                            />
                        </div> */}

                        <div className="flex items-center justify-center gap-3 shrink-0 relative z-20">
                            <button
                                onClick={handleMigration}
                                className={`h-10 md:h-11 px-6 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 shadow-sm ${isDarkTheme ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                title="Đồng bộ lại nguồn gốc file"
                            >
                                <RefreshCw className="w-4 h-4" />
                                <span className="hidden sm:inline">Đồng bộ</span>
                            </button>
                            <button
                                onClick={onOpenTips}
                                className={`h-10 md:h-11 px-6 border rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 shadow-sm ${isDarkTheme ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                                title="Mẹo sử dụng Workspace"
                            >
                                <Lightbulb className="w-4 h-4 text-amber-600" />
                                <span className="hidden sm:inline">Mẹo</span>
                            </button>
                            <button
                                onClick={() => docInputRef.current?.click()}
                                className="h-10 md:h-11 px-6 bg-brand text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm hover:shadow-md transition-all flex items-center gap-2 active:scale-95"
                            >
                                <Upload className="w-4 h-4" />
                                UPLOAD
                            </button>
                        </div>
                    </div>

                )}

                {/* Main Content Container (White Card style) */}
                <div className={`w-full transition-all duration-500 ${variant === 'default'
                    ? `${isDarkTheme ? 'bg-[rgba(13,17,23,0.6)] backdrop-blur-md border-slate-800 shadow-none' : 'bg-white border-slate-200 shadow-sm'} rounded-[24px] md:rounded-[32px] border p-4 md:p-8 min-h-[600px] animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-200`
                    : 'bg-transparent p-0 min-h-0'}
                `}>
                    {/* Sticky Header: Filters or Bulk Actions */}
                    <div className={`sticky top-0 z-40 backdrop-blur-xl border-b mb-6 transition-all duration-300 overflow-visible
                        ${isDarkTheme ? 'bg-[rgba(13,17,23,0.8)] border-slate-800' : 'bg-white/95 border-slate-100'}
                        ${variant === 'default' ? '-mx-4 lg:-mx-8 px-4 lg:px-8' : 'px-4 -mx-4'}
                    `}>
                        {selectedGlobalDocs.length > 0 ? (
                            /* BULK ACTION MODE */
                            <div className="py-3 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
                                    <div className="flex items-center h-10 px-4 bg-brand/5 border border-brand/10 rounded-xl shrink-0">
                                        <span className="text-[10px] font-bold text-brand uppercase tracking-widest leading-none">Đã chọn {selectedGlobalDocs.length}</span>
                                    </div>

                                    {selectedGlobalDocs.some(name => {
                                        const doc = globalDbAssets.find(a => a.name === name);
                                        return doc && doc.source !== 'workspace' && doc.source !== 'global_training' && !(doc as any).isGlobal;
                                    }) && (
                                            <button
                                                onClick={async () => {
                                                    const toPromote = globalDbAssets.filter(a => selectedGlobalDocs.includes(a.name) && a.source !== 'workspace' && a.source !== 'global_training' && !(a as any).isGlobal);
                                                    if (toPromote.length === 0) return;

                                                    const tid = toast.loading(`đang chạy ${toPromote.length} tệp thành Global...`);
                                                    try {
                                                        for (const asset of toPromote) {
                                                            await api.post('ai_org_chatbot', {
                                                                action: 'make_global',
                                                                url: asset.previewUrl,
                                                                name: asset.name,
                                                                type: asset.type,
                                                                size: asset.size,
                                                                property_id: activeBot?.id,
                                                                conversation_id: asset.conversationId || remoteConvId || undefined,
                                                                source: 'workspace'
                                                            });
                                                        }
                                                        toast.success(`Đã chuyển ${toPromote.length} tệp thành Global`, { id: tid });
                                                        fetchGlobalAssets();
                                                        setSelectedGlobalDocs([]);
                                                        setIsGlobalSelectMode(false);
                                                    } catch (err) {
                                                        toast.error('Lỗi khi chuyển tệp', { id: tid });
                                                    }
                                                }}
                                                className="h-10 px-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 shadow-sm whitespace-nowrap"
                                            >
                                                <Globe className="w-4 h-4" />
                                                Make Global
                                            </button>
                                        )}

                                    <button
                                        onClick={async () => {

                                            const toDeleteNames = selectedGlobalDocs;
                                            const toDeleteIds = globalDbAssets
                                                .filter(a => toDeleteNames.includes(a.name))
                                                .map(a => a.id)
                                                .filter(id => id != null && !String(id).startsWith('training_'));

                                            if (toDeleteIds.length > 0) {
                                                handleDeleteFromDb(toDeleteIds);
                                            } else {
                                                setWorkspaceDocs(prev => prev.filter(d => !toDeleteNames.includes(d.name)));
                                                setIsGlobalSelectMode(false);
                                            }

                                            const chatImgUrls = chatAssets.images
                                                .filter(img => toDeleteNames.includes(img.name))
                                                .map(img => img.previewUrl!)
                                                .filter(Boolean);
                                            if (chatImgUrls.length > 0) {
                                                setDeletedGalleryImages(prev => [...prev, ...chatImgUrls]);
                                            }

                                            setSelectedGlobalDocs([]);
                                            setIsGlobalSelectMode(false);
                                        }}
                                        className="h-10 px-5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center gap-2 active:scale-95 shadow-sm whitespace-nowrap"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Xóa ({selectedGlobalDocs.length})
                                    </button>
                                </div>

                                <button
                                    onClick={() => { setIsGlobalSelectMode(false); setSelectedGlobalDocs([]); }}
                                    className={`h-10 px-5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap ${isDarkTheme ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
                                >
                                    Hủy
                                </button>
                            </div>
                        ) : (
                            /* STANDARD FILTER MODE */
                            <div className="py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-in fade-in duration-300 overflow-visible">
                                <div className={`flex items-center gap-2 p-1 backdrop-blur-md rounded-xl lg:rounded-2xl border w-full lg:w-fit overflow-x-auto no-scrollbar ${isDarkTheme ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-100/50 border-slate-200/50'}`}>
                                    <button
                                        onClick={() => setGlobalTab('files')}
                                        className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 lg:px-6 py-2 rounded-lg lg:rounded-xl text-[10px] lg:text-xs font-bold uppercase tracking-wide transition-all duration-300 whitespace-nowrap ${globalTab === 'files' ? (isDarkTheme ? 'bg-slate-700 text-white shadow-sm border border-slate-600' : 'bg-white text-slate-700 shadow-sm border border-slate-200') : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/30'}`}
                                    >
                                        <FileText className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-slate-400" />
                                        Tài liệu

                                    </button>
                                    <button
                                        onClick={() => setGlobalTab('images')}
                                        className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 lg:px-6 py-2 rounded-lg lg:rounded-xl text-[10px] lg:text-xs font-bold uppercase tracking-wide transition-all duration-300 whitespace-nowrap ${globalTab === 'images' ? (isDarkTheme ? 'bg-slate-700 text-white shadow-sm border border-slate-600' : 'bg-white text-slate-700 shadow-sm border border-slate-200') : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/30'}`}
                                    >
                                        <ImageIcon className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-slate-400" />
                                        Hình ảnh
                                    </button>
                                </div>

                                <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 overflow-visible">
                                    <div className="flex items-center gap-2 pb-1 lg:pb-0">
                                        <div className="relative shrink-0">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsSourceDropdownOpen(!isSourceDropdownOpen);
                                                }}
                                                className={`h-10 lg:h-11 px-3 lg:px-4 border rounded-xl text-[10px] lg:text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${isSourceDropdownOpen ? 'border-brand ring-4 ring-brand/5' : (isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300')}`}
                                            >
                                                <span className="text-[9px] lg:text-[10px] text-slate-400 uppercase tracking-wider">Nguồn:</span>
                                                <span className={isDarkTheme ? 'text-slate-200' : 'text-slate-800'}>
                                                    {globalSourceFilter === 'all' ? 'Tất cả' : globalSourceFilter === 'workspace' ? 'Global' : globalSourceFilter === 'chat_user' ? 'User' : 'AI'}
                                                </span>
                                                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isSourceDropdownOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isSourceDropdownOpen && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-40"
                                                        onClick={() => setIsSourceDropdownOpen(false)}
                                                    />
                                                    <div className={`absolute top-full mt-2 left-0 lg:left-auto lg:right-0 w-48 border rounded-2xl shadow-lg p-2 animate-in fade-in zoom-in-95 duration-200 z-50 ${isDarkTheme ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                        {[
                                                            { id: 'all', label: 'Tất cả', icon: Layers },
                                                            { id: 'workspace', label: 'Global', icon: Globe },
                                                            { id: 'chat_user', label: 'User Tải Lên', icon: Upload },
                                                            { id: 'chat_assistant', label: 'AI Tạo Ra', icon: Sparkles }
                                                        ].map(filter => {
                                                            const Icon = filter.icon;
                                                            return (
                                                                <button
                                                                    key={filter.id}
                                                                    onClick={() => {
                                                                        setGlobalSourceFilter(filter.id as any);
                                                                        setIsSourceDropdownOpen(false);
                                                                    }}
                                                                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${globalSourceFilter === filter.id ? (isDarkTheme ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-900') : (isDarkTheme ? 'text-slate-400 hover:bg-slate-700/50' : 'text-slate-600 hover:bg-slate-50')}`}
                                                                >
                                                                    <Icon className="w-4 h-4" />
                                                                    {filter.label}
                                                                    {globalSourceFilter === filter.id && <Check className={`w-3.5 h-3.5 ml-auto ${isDarkTheme ? 'text-white' : 'text-slate-900'}`} />}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        <button
                                            onClick={handleSelectAll}
                                            className={`h-10 lg:h-11 px-4 lg:px-5 rounded-xl text-[9px] lg:text-[10px] font-bold uppercase tracking-wide transition-all flex items-center gap-2 border whitespace-nowrap shrink-0 ${selectedGlobalDocs.length === globalDbAssets.length && globalDbAssets.length > 0 ? 'bg-brand text-white border-brand shadow-md' : (isDarkTheme ? 'bg-slate-800 text-slate-400 border-slate-700 hover:border-brand/30 hover:text-brand' : 'bg-white text-slate-500 border-slate-200 hover:border-brand/30 hover:text-brand')}`}
                                        >
                                            {selectedGlobalDocs.length === globalDbAssets.length && globalDbAssets.length > 0 ? <CheckCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4" /> : <Check className="w-3.5 h-3.5 lg:w-4 lg:h-4" />}
                                            {selectedGlobalDocs.length === globalDbAssets.length && globalDbAssets.length > 0 ? 'Bỏ chọn' : 'Chọn tất cả'}
                                        </button>
                                    </div>

                                    <div className="relative group flex-1 w-full lg:w-64">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 lg:w-4 lg:h-4 text-slate-400 group-focus-within:text-brand transition-colors" />
                                        <input
                                            type="text"
                                            value={globalSearchInput}
                                            onChange={(e) => setGlobalSearchInput(e.target.value)}
                                            placeholder="Tìm kiếm tài sản..."
                                            className={`w-full h-10 lg:h-11 border rounded-xl pl-10 lg:pl-11 pr-4 text-[11px] lg:text-xs font-bold transition-all outline-none ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 focus:bg-slate-900 focus:border-brand-accent' : 'bg-slate-50 border-slate-200 text-slate-700 focus:bg-white focus:border-brand-accent'}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Empty State / Grid */}
                    {(() => {
                        // Show skeleton ONLY when loading AND no data yet
                        if (isLoadingGlobalAssets && globalDbAssets.length === 0) {
                            return (
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {[...Array(12)].map((_, i) => (
                                        <div key={i} className={`p-3 rounded-2xl border animate-pulse ${isDarkTheme ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-100'}`}>
                                            <div className={`w-full aspect-square rounded-xl mb-3 relative overflow-hidden ${isDarkTheme ? 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-700' : 'bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100'}`}>
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" style={{ animationDuration: '2s' }} />
                                            </div>
                                            <div className={`h-4 rounded-lg w-3/4 mb-2 ${isDarkTheme ? 'bg-slate-700' : 'bg-slate-100'}`} />
                                            <div className={`h-3 rounded-lg w-1/2 ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-50'}`} />
                                        </div>
                                    ))}
                                </div>
                            );
                        }

                        if (globalDbAssets.length === 0) return (
                            <div className="flex flex-col items-center justify-center py-20 text-center">
                                <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-6 border animate-pulse ${isDarkTheme ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <Database className={`w-10 h-10 ${isDarkTheme ? 'text-slate-600' : 'text-slate-200'}`} />
                                </div>
                                <h4 className={`text-lg font-bold mb-2 ${isDarkTheme ? 'text-slate-100' : 'text-slate-900'}`}>Chưa có tệp tin nào</h4>
                                <p className={`text-sm max-w-xs ${isDarkTheme ? 'text-slate-400' : 'text-slate-400'}`}>Các tài liệu hoặc hình ảnh quan trọng để sử dụng chung cho nhiều Bot khác nhau.</p>
                            </div>
                        );

                        return (
                            <div className="flex flex-col gap-8">
                                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {globalDbAssets.map((doc) => {
                                        const isSelected = selectedGlobalDocs.includes(doc.name);
                                        const fileExt = doc.name.split('.').pop()?.toLowerCase() || '';
                                        const getIconStyle = (ext: string) => {
                                            switch (ext) {
                                                case 'pdf': return { Icon: FileText, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' };
                                                case 'doc':
                                                case 'docx': return { Icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' };
                                                case 'xls':
                                                case 'xlsx':
                                                case 'csv': return { Icon: FileSpreadsheet, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' };
                                                case 'ppt':
                                                case 'pptx': return { Icon: FileText, color: 'text-orange-500', bg: 'bg-orange-50', border: 'border-orange-100' };
                                                case 'txt': return { Icon: FileText, color: 'text-slate-500', bg: 'bg-slate-50', border: 'border-slate-100' };
                                                case 'zip':
                                                case 'rar':
                                                case '7z': return { Icon: Layers, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' };
                                                case 'html': case 'css': case 'js': case 'jsx': case 'ts': case 'tsx': case 'php': case 'json': case 'sql':
                                                    return { Icon: FileCode, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' };
                                                case 'mp3': case 'wav': return { Icon: Volume2, color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-100' };
                                                case 'mp4': case 'mov': return { Icon: Video, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-100' };
                                                default: return { Icon: FileQuestion, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100' };
                                            }
                                        };
                                        const { Icon, color, bg, border } = getIconStyle(fileExt);
                                        const uniqueKey = doc.id || `${doc.name}_${doc.conversationId || 'no-conv'}`;
                                        const safeUrl = sanitizeUrl(doc.previewUrl || doc.base64);

                                        return (
                                            <div
                                                key={uniqueKey}
                                                onClick={() => {
                                                    if (selectedGlobalDocs.length > 0) {
                                                        setSelectedGlobalDocs(prev =>
                                                            prev.includes(doc.name) ? prev.filter(n => n !== doc.name) : [...prev, doc.name]
                                                        );
                                                    }
                                                }}
                                                className={`group relative p-3 rounded-[24px] border transition-all duration-300 cursor-pointer overflow-hidden hover:shadow-lg hover:-translate-y-1
                                                    ${isDarkTheme ? 'bg-slate-800/40 border-slate-700/60 hover:shadow-slate-900/40' : 'bg-white border-slate-100/60 hover:shadow-slate-200/20'}
                                                    ${isSelected ? 'ring-2 ring-brand bg-brand/5 shadow-md shadow-brand/5 -translate-y-1' : ''}
                                                `}
                                            >
                                                {isSelected && (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-brand/[0.08] via-transparent to-transparent pointer-events-none" />
                                                )}

                                                {!isGlobalSelectMode && (
                                                    <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 translate-y-1 group-hover:translate-y-0">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                copyToClipboard(safeUrl || '');
                                                            }}
                                                            className={`p-2 backdrop-blur-md shadow-md rounded-xl hover:text-brand hover:scale-110 transition-all border ${isDarkTheme ? 'bg-slate-700/90 text-slate-400 border-slate-600' : 'bg-white/90 text-slate-400 border-slate-100'}`}
                                                            title="Share Link"
                                                        >
                                                            <LinkIcon className="w-3.5 h-3.5" />
                                                        </button>
                                                        {(doc.source === 'chat_user' || doc.source === 'chat_assistant') && !(doc as any).isGlobal && (
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    const tid = toast.loading('đang chạy...');
                                                                    try {
                                                                        const data = await api.post<any>('ai_org_chatbot', {
                                                                            action: 'workspace_save', // Sync to both local and global
                                                                            url: safeUrl,
                                                                            name: doc.name,
                                                                            type: doc.type,
                                                                            size: doc.size,
                                                                            property_id: activeBot?.id || chatbotId,
                                                                            conversation_id: doc.conversationId || remoteConvId || sessionId,
                                                                            source: 'workspace'
                                                                        });
                                                                        if (data.success) {
                                                                            toast.success('Đã chuyển thành file Global', { id: tid });
                                                                            fetchGlobalAssets();
                                                                        }
                                                                    } catch (err) {
                                                                        toast.error('Lỗi khi chuyển thành file Global');
                                                                    }
                                                                }}
                                                                className={`p-2 backdrop-blur-md shadow-md rounded-xl hover:text-emerald-500 hover:scale-110 transition-all border ${isDarkTheme ? 'bg-slate-700/90 text-slate-400 border-slate-600' : 'bg-white/90 text-slate-400 border-slate-100'}`}
                                                                title="Make Global"
                                                            >
                                                                <Globe className="w-3.5 h-3.5" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();

                                                                const idStr = String(doc.id);
                                                                if (doc.id != null && !idStr.startsWith('training_')) {
                                                                    handleDeleteFromDb([doc.id]);
                                                                } else {
                                                                    setWorkspaceDocs(prev => prev.filter(d => d.name !== doc.name));
                                                                    toast.success('Đã xóa tệp');
                                                                }
                                                            }}
                                                            className={`p-2 backdrop-blur-md shadow-md rounded-xl hover:text-rose-500 hover:scale-110 transition-all border ${isDarkTheme ? 'bg-slate-700/90 text-slate-400 border-slate-600' : 'bg-white/90 text-slate-400 border-slate-100'}`}
                                                            title="Xóa"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}

                                                <div
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedGlobalDocs(prev =>
                                                            prev.includes(doc.name) ? prev.filter(n => n !== doc.name) : [...prev, doc.name]
                                                        );
                                                    }}
                                                    className={`absolute top-3 left-3 w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all duration-300 z-20 cursor-pointer shadow-sm
                                                        ${isSelected
                                                            ? 'bg-brand border-brand text-white rotate-0 scale-100 shadow-md'
                                                            : `backdrop-blur-md text-transparent opacity-0 -rotate-12 scale-75 group-hover:opacity-100 group-hover:rotate-0 group-hover:scale-100 hover:border-brand/50 ${isDarkTheme ? 'bg-slate-700/90 border-slate-600' : 'bg-white/90 border-slate-200'}`}
                                                    `}
                                                >
                                                    <Check className={`w-4 h-4 transition-transform duration-500 ${isSelected ? 'scale-100' : 'scale-50'}`} strokeWidth={4} />
                                                </div>

                                                <div
                                                    onClick={(e) => {
                                                        if (selectedGlobalDocs.length === 0) {
                                                            e.stopPropagation();
                                                            if (doc.type.startsWith('image/')) {
                                                                setPreviewImage(safeUrl || '');
                                                            } else {
                                                                setActiveDoc({ ...doc, previewUrl: safeUrl });
                                                                setIsDocWorkspaceOpen(true);
                                                            }
                                                        }
                                                    }}
                                                    className={`w-full aspect-square rounded-xl border flex items-center justify-center mb-3 overflow-hidden group-hover:scale-[1.02] transition-transform relative ${isDarkTheme ? 'bg-slate-900 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}
                                                >
                                                    {doc.source && (
                                                        <div className="absolute bottom-2 left-2 z-10">
                                                            <span className={`text-[7px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter backdrop-blur-md border shadow-sm ${(() => {
                                                                const src = doc.source.toLowerCase();
                                                                if (src === 'global_training' || (doc as any).isGlobal) return 'bg-amber-600/80 text-white border-amber-300/20';
                                                                if (src.includes('user') || src === 'file_upload') return 'bg-blue-600/70 text-white border-blue-400/20';
                                                                if (src.includes('assistant') || src.includes('ai')) return 'bg-red-800/70 text-white border-red-400/20';
                                                                return 'bg-slate-800/60 text-white border-slate-500/30';
                                                            })()}`}>
                                                                {(() => {
                                                                    const src = doc.source.toLowerCase();
                                                                    if (src === 'global_training' || (doc as any).isGlobal) return 'Knowledge';
                                                                    if (src.includes('user') || src === 'file_upload') return 'User';
                                                                    if (src.includes('assistant') || src.includes('ai')) return 'AI';
                                                                    return 'Global';
                                                                })()}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {doc.type.startsWith('image/') ? (
                                                        <img
                                                            src={safeUrl}
                                                            loading="lazy"
                                                            className="w-full h-full object-cover"
                                                            alt={doc.name}
                                                        />
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className={`w-12 h-12 rounded-2xl ${bg} ${border} shadow-sm flex items-center justify-center ${color} group-hover:scale-110 transition-all duration-300 border-2`}>
                                                                <Icon className="w-6 h-6" />
                                                            </div>
                                                            <span className="text-[9px] font-black font-mono text-slate-400 uppercase tracking-wider">{fileExt}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div
                                                    onClick={(e) => {
                                                        if (selectedGlobalDocs.length === 0 && doc.conversationId) {
                                                            e.stopPropagation();
                                                            if (doc.propertyId || chatbotId) {
                                                                navigate(`/ai-space/${categoryId}/${doc.propertyId || chatbotId}/${doc.conversationId}`);
                                                            }
                                                        }
                                                    }}
                                                    className={`px-1 relative ${doc.conversationId ? 'cursor-alias' : ''}`}
                                                >
                                                    <h5 className={`text-[11px] font-bold truncate group-hover:text-brand transition-colors mb-0.5 ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>{doc.name}</h5>
                                                    {doc.conversationTitle && (
                                                        <p className="text-[9px] text-slate-400 font-medium truncate mb-1" title={doc.conversationTitle}>
                                                            {(doc.source === 'global_training' || (doc as any).isGlobal)
                                                                ? <Bot className="w-2.5 h-2.5 inline mr-1 text-amber-600" />
                                                                : <MessageSquare className="w-2.5 h-2.5 inline mr-1" />}
                                                            {doc.conversationTitle}
                                                        </p>
                                                    )}
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[9px] text-slate-400 font-bold">{propFormatFileSize(doc.size)}</span>
                                                        <ArrowRight className="w-2.5 h-2.5 text-slate-300 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {totalPages > 1 && (
                                    <div className={`flex items-center justify-center gap-2 mt-4 pt-8 border-t ${isDarkTheme ? 'border-slate-800' : 'border-slate-50'}`}>
                                        <button
                                            onClick={() => setGlobalPage(prev => Math.max(1, prev - 1))}
                                            disabled={globalPage === 1}
                                            className={`p-2.5 rounded-xl border transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-500 hover:text-brand disabled:opacity-20' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-brand disabled:opacity-30'} disabled:pointer-events-none`}
                                        >
                                            <ChevronDown className="w-4 h-4 rotate-90" />
                                        </button>

                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setGlobalPage(i + 1)}
                                                className={`w-10 h-10 rounded-xl text-xs font-bold transition-all ${globalPage === i + 1 ? 'bg-brand text-white shadow-md' : (isDarkTheme ? 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-brand-accent' : 'bg-white border border-slate-100 text-slate-500 hover:border-brand-accent')}`}
                                            >
                                                {i + 1}
                                            </button>
                                        ))}

                                        <button
                                            onClick={() => setGlobalPage(prev => Math.min(totalPages, prev + 1))}
                                            disabled={globalPage === totalPages}
                                            className={`p-2.5 rounded-xl border transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-500 hover:text-brand disabled:opacity-20' : 'bg-white border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-brand disabled:opacity-30'} disabled:pointer-events-none`}
                                        >
                                            <ChevronDown className="w-4 h-4 -rotate-90" />
                                        </button>

                                        <span className="ml-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            Trang {globalPage} / {totalPages} ({globalTotal} tệp)
                                        </span>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div >
    );
});

export default GlobalWorkspaceView;
