import React from 'react';
import { Bot, Menu, BookOpen, Settings, ImageIcon, User, Search, Sparkles, Wand2, Flag } from 'lucide-react';
import { ChatbotInfo } from '../../../types';
import { AI_MODELS, getModelDisplayName } from '../../../utils/ai-constants';

interface ChatHeaderProps {
    activeBot: ChatbotInfo | null;
    selectedModel: string;
    loadingChat: boolean;
    isSidebarOpen: boolean;
    setIsSidebarOpen: (value: boolean) => void;
    isDocWorkspaceOpen: boolean;
    setIsDocWorkspaceOpen: (value: boolean) => void;
    globalTab: 'files' | 'images';
    setGlobalTab: (tab: 'files' | 'images') => void;
    categoryName: string;
    showOrgSettings?: boolean;
    onOpenOrgSettings?: () => void;
    isCodeMode: boolean;
    isImageGenMode: boolean;
    isDarkTheme?: boolean;
    isMobile?: boolean;
    orgUser?: any;
    onProfileOpen?: () => void;
    isChatSearchOpen?: boolean;
    setIsChatSearchOpen?: (val: boolean) => void;
    onOpenSummary?: () => void;
    isSummarizing?: boolean;
    onOpenFeedback?: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = React.memo(({
    activeBot,
    selectedModel,
    loadingChat,
    isSidebarOpen,
    setIsSidebarOpen,
    isDocWorkspaceOpen,
    setIsDocWorkspaceOpen,
    globalTab,
    setGlobalTab,
    categoryName,
    showOrgSettings,
    onOpenOrgSettings,
    isCodeMode,
    isImageGenMode,
    isDarkTheme,
    isMobile,
    orgUser,
    onProfileOpen,
    isChatSearchOpen,
    setIsChatSearchOpen,
    onOpenSummary,
    isSummarizing,
    onOpenFeedback,
}) => {
    return (
        <div className={`sticky top-0 h-14 flex items-center justify-between px-3 sm:px-6 border-b z-30 shrink-0 select-none transition-all duration-500 ${isDarkTheme ? 'bg-[#0B0F17]/90 border-slate-800 text-slate-100' : 'bg-white/80 border-slate-100 text-slate-800'} backdrop-blur-sm`}>
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <div
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-brand to-brand-accent flex items-center justify-center text-white shadow-md relative group cursor-pointer transition-transform active:scale-95 shrink-0"
                    onClick={() => setIsSidebarOpen(true)}
                >
                    {activeBot?.settings?.bot_avatar ? (
                        <img src={activeBot.settings.bot_avatar} className="w-full h-full object-cover rounded-xl" alt="Bot Avatar" />
                    ) : (
                        <Bot className="w-5 h-5 sm:w-6 sm:h-6" />
                    )}
                    <div className="absolute inset-0 bg-black/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Menu className="w-4 h-4 text-white" />
                    </div>
                </div>
                {/* Title - column layout on mobile, row on sm+ */}
                <div className="flex flex-col min-w-0">
                    <h3 className={`font-bold leading-tight flex items-center gap-1.5 text-sm sm:text-base ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>
                        <span className="truncate max-w-[120px] sm:max-w-none">{activeBot?.name || 'AI Assistant'}</span>
                        {!isImageGenMode && (
                            <span className={`hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0 ${isDarkTheme ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                                {getModelDisplayName(AI_MODELS.find(m => m.id === selectedModel)?.name || selectedModel, categoryName)}
                            </span>
                        )}
                    </h3>
                    <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${loadingChat ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>{loadingChat ? 'Thinking...' : 'Active'}</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {/* Org Settings button - admin/assistant only */}
                {showOrgSettings && onOpenOrgSettings && (
                    <button
                        onClick={onOpenOrgSettings}
                        className={`p-2 rounded-xl transition-all active:scale-95 ${isDarkTheme ? 'text-slate-500 hover:text-amber-400 hover:bg-slate-800' : 'text-slate-400 hover:text-brand hover:bg-brand/5'}`}
                        title="Quản trị tổ chức"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                )}
                {/* Feedback button */}
                <button
                    onClick={onOpenFeedback}
                    className={`p-2 rounded-xl transition-all active:scale-95 ${isDarkTheme ? 'text-slate-500 hover:text-amber-400 hover:bg-slate-800' : 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`}
                    title="Gửi feedback / báo lỗi"
                >
                    <Flag className="w-4 h-4" />
                </button>
                <button
                    onClick={() => setIsChatSearchOpen?.(!isChatSearchOpen)}
                    className={`p-2 rounded-xl transition-all active:scale-95 ${isChatSearchOpen ? (isDarkTheme ? 'bg-slate-800 text-brand' : 'bg-slate-100 text-brand') : (isDarkTheme ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}
                    title="Tìm kiếm tin nhắn"
                >
                    <Search className="w-4 h-4" />
                </button>
                <button
                    onClick={onOpenSummary}
                    disabled={isSummarizing || loadingChat}
                    className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl transition-all shadow-sm active:scale-95 relative overflow-hidden group ${isSummarizing ? 'animate-pulse' : ''} ${isDarkTheme ? 'text-white' : 'text-white'}`}
                    title="Tóm tắt nội dung & Key Takeaways"
                >
                    {/* Brand Gradient Background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-brand to-brand-accent group-hover:opacity-90 transition-opacity" />

                    <div className="relative flex items-center gap-1.5 pt-0.5">
                        <Sparkles className={`w-4 h-4 ${isSummarizing ? 'animate-spin' : ''}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline pt-0.5">Tóm tắt</span>
                    </div>

                    {isSummarizing && (
                        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-white rounded-full animate-ping" />
                    )}
                </button>
                <button
                    onClick={() => {
                        if (isDocWorkspaceOpen && globalTab === 'files') {
                            setIsDocWorkspaceOpen(false);
                        } else {
                            // If workspace is already open but on images tab → switch to files tab
                            setIsDocWorkspaceOpen(true);
                            setGlobalTab('files');
                        }
                    }}
                    className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl transition-all ${isDocWorkspaceOpen && globalTab === 'files' ? (isDarkTheme ? 'text-white bg-slate-800 border border-slate-700 shadow-sm' : 'text-slate-700 bg-slate-100 border border-slate-200 shadow-sm') : (isDarkTheme ? 'text-slate-500 hover:text-slate-200 border border-transparent hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 border border-transparent hover:bg-slate-100')}`}
                    title="Conversation Workspace"
                >
                    <BookOpen className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest pt-0.5 hidden sm:inline">Workspace</span>
                </button>
                {/* Menu toggle - visible on mobile AND tablet (below lg) */}
                <button
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    className={`p-2 sm:p-2.5 rounded-xl transition-all active:scale-90 lg:hidden flex items-center justify-center ${isDarkTheme ? 'text-slate-300 bg-slate-800/50 border border-slate-700' : 'text-slate-600 bg-slate-50 border border-slate-100'}`}
                >
                    <Menu className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

});

export default ChatHeader;
