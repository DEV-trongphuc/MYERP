import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Bot, ChevronDown, CornerDownRight, Plus, Zap, LayoutGrid, Database, Search, Trash2, Settings, LogOut, Pin, Keyboard } from 'lucide-react';
import { ChatbotInfo, ChatSession } from '../../types';
import { Skeleton } from '../ui/Skeleton';

const SidebarItem = React.memo(({
    bot,
    isActive,
    isExpanded,
    botSessions,
    sessionId,
    categoryId,
    viewMode,
    onToggleExpand,
    onNewChat,
    onDeleteSession,
    onEditSessionTitle,
    onNavigate,
    isOrganizationView,
    isDarkTheme,
    brandColor,
    onTogglePin,
    pinnedSessionIds
}: any) => {

    const sortedSessions = useMemo(() => {
        if (!botSessions) return [];
        return [...botSessions].sort((a: ChatSession, b: ChatSession) => {
            const aPinned = pinnedSessionIds?.has(String(a.id)) || (a.visitorId && pinnedSessionIds?.has(String(a.visitorId)));
            const bPinned = pinnedSessionIds?.has(String(b.id)) || (b.visitorId && pinnedSessionIds?.has(String(b.visitorId)));
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0);
        });
    }, [botSessions, pinnedSessionIds]);

    return (
        <div className="mx-2 mb-1">
            <div className="relative">
                <button
                    onClick={() => onToggleExpand(bot)}
                    className={`
                        w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 group cursor-pointer
                        ${isActive || isExpanded
                            ? (isDarkTheme ? 'bg-slate-800/80 shadow-none' : 'bg-slate-50/80 shadow-sm')
                            : (isDarkTheme ? 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50/50 hover:text-slate-700')
                        }
                    `}
                >
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${isActive ? 'bg-brand text-white shadow-brand' : (isDarkTheme ? 'bg-slate-800 text-slate-500' : 'bg-slate-100 text-slate-400')}`} style={isActive ? { backgroundColor: brandColor } : {}}>
                        {bot.settings?.bot_avatar ? (
                            <img src={bot.settings.bot_avatar} className="w-full h-full object-cover rounded-lg scale-90" />
                        ) : (
                            <Bot className="w-3.5 h-3.5" />
                        )}
                    </div>
                    <span className={`text-[13px] font-bold truncate flex-1 text-left ${isActive ? (isDarkTheme ? 'text-white' : 'text-slate-800') : (isDarkTheme ? 'text-slate-300' : 'text-slate-600')}`}>
                        {bot.name}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
            </div>

            <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-[500px] opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
                <div className="pl-6 space-y-1 py-1">
                    <button
                        onClick={(e) => onNewChat(e, bot)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand hover:bg-opacity-5 transition-colors group/new"
                    >
                        <CornerDownRight className="w-3 h-3 opacity-50" />
                        <Plus className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wider">New Chat</span>
                    </button>

                    {sortedSessions.map((sess: ChatSession) => {
                        const isPinned = pinnedSessionIds?.has(String(sess.id)) || (sess.visitorId && pinnedSessionIds?.has(String(sess.visitorId)));
                        // [P17-A2 FIX] Must also check viewMode==='chat'. Without this, when user navigates
                        // to 'home' or 'global_workspace', the old session item stays highlighted.
                        const isSessionActive = sessionId === sess.id && viewMode === 'chat' && !isOrganizationView;
                        return (
                            <div key={sess.id} className="relative group/sess">
                                <div
                                    onClick={() => onNavigate(bot.id, sess.id)}
                                    className={`
                                    w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all cursor-pointer border border-transparent
                                    ${isSessionActive
                                            ? 'bg-brand bg-opacity-10 text-brand border-brand border-opacity-20'
                                            : (isDarkTheme ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700')
                                        }
                                `}
                                >
                                    <div
                                        className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300 ${isSessionActive ? '' : (isDarkTheme ? 'bg-slate-700' : 'bg-slate-300')}`}
                                        style={isSessionActive ? { backgroundColor: brandColor } : {}}
                                    />
                                    <span className="text-[12px] truncate flex-1 text-left font-medium">{sess.title}</span>

                                    {/* Session Actions - Show on Hover or Active */}
                                    <div className={`flex items-center gap-1 ${isSessionActive || isPinned ? 'opacity-100' : 'opacity-0 group-hover/sess:opacity-100'} transition-opacity`}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onTogglePin(sess.id);
                                            }}
                                            className={`p-1 rounded bg-transparent border-0 cursor-pointer transition-colors ${isPinned ? 'text-brand' : 'hover:text-brand text-slate-400'}`}
                                            title={isPinned ? "Bỏ ghim" : "Ghim hội thoại"}
                                            style={isPinned ? { color: brandColor } : {}}
                                        >
                                            <Pin
                                                className="w-3 h-3"
                                                fill={isPinned ? brandColor || "currentColor" : "none"}
                                                stroke={isPinned ? brandColor || "currentColor" : "currentColor"}
                                            />
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditSessionTitle(bot.id, sess.id, sess.title);
                                            }}
                                            className="p-1 hover:text-brand rounded bg-transparent border-0 cursor-pointer"
                                            title="Đổi tên"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteSession(e, bot.id, sess.id);
                                            }}
                                            className="p-1 hover:text-red-500 rounded bg-transparent border-0 cursor-pointer"
                                            title="Xóa"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
});

interface SidebarProps {
    isSidebarOpen: boolean;
    isZenMode: boolean;
    categoryName: string;
    categoryId: string | undefined;
    viewMode: string;
    setViewMode: (mode: 'home' | 'chat' | 'global_workspace') => void;
    navigate: any;
    searchTermSessions: string;
    setSearchTermSessions: (term: string) => void;
    recentSessions: any[];
    sessionId: string | undefined;
    chatbots: ChatbotInfo[];
    loadingList: boolean;
    expandedBotId: string | null;
    setExpandedBotId: (id: string | null) => void;
    activeBot: ChatbotInfo | null;
    sessions: Record<string, ChatSession[]>;
    handleNewChat: (e: React.MouseEvent, bot: ChatbotInfo) => void;
    handleDeleteSession: (e: React.MouseEvent, botId: string, sessionId: string) => void;
    handleEditSessionTitle: (botId: string, sessionId: string, currentTitle: string) => void;
    isManualNavigationRef: React.MutableRefObject<boolean>;
    onOpenTraining: () => void;
    onCloseTraining?: () => void;
    orgUser: any;
    onLogout?: () => void;
    onOpenProfile?: () => void;
    onOpenKeyboardHelp?: () => void;
    isDarkTheme?: boolean;
    brandColor?: string;
    isMobile?: boolean;
    setIsSidebarOpen?: (open: boolean) => void;
    onTogglePin: (sessId: string) => void;
    pinnedSessionIds: Set<string>;
}

const Sidebar = React.memo(({
    isSidebarOpen,
    isZenMode,
    categoryName,
    categoryId,
    viewMode,
    setViewMode,
    navigate,
    searchTermSessions,
    setSearchTermSessions,
    recentSessions,
    sessionId,
    chatbots,
    loadingList,
    expandedBotId,
    setExpandedBotId,
    activeBot,
    sessions,
    handleNewChat,
    handleDeleteSession,
    handleEditSessionTitle,
    isManualNavigationRef,
    onOpenTraining,
    onCloseTraining,
    orgUser,
    onLogout,
    onOpenProfile,
    onOpenKeyboardHelp,
    isDarkTheme,
    brandColor,
    isMobile,
    setIsSidebarOpen,
    onTogglePin,
    pinnedSessionIds
}: SidebarProps) => {
    const location = useLocation();
    // [P17-A1 FIX] Guard against orphan sessions from rapid expand/collapse on an empty bot.
    // Without this, clicking expand quickly on a bot with no sessions triggers multiple handleNewChat
    // calls, creating duplicate orphan sessions in the database.
    const isCreatingSessionRef = React.useRef(false);

    const isOrganizationView = useMemo(() => {
        return location.pathname.includes('/organization') || window.location.hash.includes('/organization');
    }, [location]);

    const [showAllRecent, setShowAllRecent] = useState(false);

    return (
        <aside className={`
            fixed inset-y-0 left-0 z-50 w-[275px] border-r transform transition-all duration-500 ease-in-out lg:relative lg:translate-x-0
            ${isDarkTheme ? 'bg-[#05070A] border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-[4px_0_24px_rgba(0,0,0,0.02)]'}
            ${(isSidebarOpen && !isZenMode) ? 'translate-x-0' : '-translate-x-full lg:ml-[-275px]'}
        `}>
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className={`h-28 flex items-center px-6 gap-4 border-b relative group cursor-pointer transition-colors duration-500 ${isDarkTheme ? 'border-slate-800' : 'border-slate-50'}`}>
                    {/* Animated Logo Icon */}
                    <div className="relative w-12 h-12 shrink-0">
                        <div className="absolute inset-0 bg-brand blur-xl opacity-20 group-hover:opacity-40 transition-opacity duration-500 rounded-full"></div>
                        <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-brand rounded-2xl shadow-brand group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 ease-out border-brand border-opacity-20">
                            <Zap className="w-6 h-6 text-white fill-white/20" strokeWidth={3} />
                        </div>
                    </div>

                    <div className="flex flex-col min-w-0">
                        <h1 className={`text-2xl font-black tracking-tighter leading-none group-hover:text-brand transition-all duration-500 uppercase ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                            AI-SPACE
                        </h1>
                        <div className="flex items-center gap-2 mt-1.5 opacity-60">
                            <span className="h-3 w-[2px] bg-brand bg-opacity-30 rotate-12"></span>
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] truncate">
                                Powered by {categoryName}
                            </span>
                        </div>
                    </div>

                    {/* Mobile/Tablet close button - only when sidebar is open */}
                    {isSidebarOpen && setIsSidebarOpen && (
                        <button
                            onClick={() => setIsSidebarOpen(false)}
                            className={`absolute right-3 top-3 p-1.5 rounded-lg border transition-all active:scale-95 lg:hidden ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-700'}`}
                            title="Đóng sidebar"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    )}

                    <button onClick={() => navigate(`/ai-space/${categoryId}`)} className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100 ${isDarkTheme ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>
                        <LayoutGrid className="w-5 h-5 text-slate-400" />
                    </button>
                </div>


                <div className="flex-1 overflow-y-auto px-2 py-6 space-y-6 custom-scrollbar">
                    {/* PRIMARY NAV */}
                    <div className="space-y-1">
                        <button
                            onClick={() => {
                                navigate(`/ai-space/${categoryId}`);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${viewMode === 'home' && !isOrganizationView ? 'bg-brand text-white shadow-brand' : (isDarkTheme ? 'text-slate-400 hover:bg-slate-800 border border-transparent' : 'text-slate-600 hover:bg-slate-50 border border-transparent')}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 ${viewMode === 'home' && !isOrganizationView ? 'bg-white bg-opacity-20 text-white' : (isDarkTheme ? 'bg-slate-800 text-slate-500 group-hover:bg-slate-700' : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:shadow-md')}`}>
                                <LayoutGrid className="w-4 h-4" />
                            </div>
                            <span className={`font-bold text-sm tracking-tight ${viewMode === 'home' && !isOrganizationView ? 'text-white' : (isDarkTheme ? 'text-slate-300 group-hover:text-slate-100' : 'text-slate-600 group-hover:text-slate-900')}`}>AI Centers</span>
                            {viewMode === 'home' && !isOrganizationView && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        </button>

                        <button
                            onClick={() => {
                                navigate(`/ai-space/${categoryId}?view=global_workspace`);
                            }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${viewMode === 'global_workspace' && !isOrganizationView ? 'bg-brand text-white shadow-brand' : (isDarkTheme ? 'text-slate-400 hover:bg-slate-800 border border-transparent' : 'text-slate-600 hover:bg-slate-50 border border-transparent')}`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 ${viewMode === 'global_workspace' && !isOrganizationView ? 'bg-white bg-opacity-20 text-white' : (isDarkTheme ? 'bg-slate-800 text-slate-500 group-hover:bg-slate-700' : 'bg-slate-100 text-slate-400 group-hover:bg-white group-hover:shadow-md')}`}>
                                <Database className="w-4 h-4" />
                            </div>
                            <span className={`font-bold text-sm tracking-tight ${viewMode === 'global_workspace' && !isOrganizationView ? 'text-white' : (isDarkTheme ? 'text-slate-300 group-hover:text-slate-100' : 'text-slate-600 group-hover:text-slate-900')}`}>Workspace</span>
                            {viewMode === 'global_workspace' && !isOrganizationView && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                        </button>
                    </div>

                    {/* SEARCH SESSIONS */}
                    <div className="px-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-brand transition-colors" />
                            <input
                                type="text"
                                placeholder="Search conversations..."
                                value={searchTermSessions}
                                onChange={(e) => setSearchTermSessions(e.target.value)}
                                className={`w-full border rounded-xl py-2.5 pl-9 pr-3 text-[13px] font-medium transition-all outline-none ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 focus:bg-slate-700 focus:border-brand-accent placeholder:text-slate-500' : 'bg-slate-50 border-slate-100 text-slate-600 focus:bg-white focus:border-brand-accent focus:ring-4 focus:ring-brand focus:ring-opacity-10 placeholder:text-slate-400'}`}
                            />
                        </div>
                    </div>

                    {/* RECENT SESSIONS (Only show top 3 if no search, else show all matches) */}
                    {recentSessions.length > 0 && (
                        <div className="animate-in fade-in duration-500">
                            <div className="px-4 pb-2 flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{searchTermSessions ? 'Results' : 'Recent'}</span>
                                {!searchTermSessions && recentSessions.length > 3 && (
                                    <button
                                        onClick={() => setShowAllRecent(v => !v)}
                                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-colors ${isDarkTheme ? 'bg-slate-800 text-slate-400 hover:text-slate-200' : 'bg-slate-100 text-slate-500 hover:text-slate-700'}`}
                                    >
                                        {showAllRecent ? 'Thu gọn' : `Xem thêm (${recentSessions.length - 3})`}
                                    </button>
                                )}
                            </div>
                            <div className="space-y-1">
                                {recentSessions.slice(0, searchTermSessions ? undefined : (showAllRecent ? undefined : 3)).map(sess => {
                                    const isSessionActive = sessionId === sess.id && viewMode === 'chat' && !isOrganizationView;
                                    const isPinned = pinnedSessionIds?.has(String(sess.id)) || (sess.visitorId && pinnedSessionIds?.has(String(sess.visitorId)));
                                    return (
                                        <div
                                            key={sess.id}
                                            onClick={() => {
                                                const bot = chatbots.find(b => b.id === sess.botId);
                                                if (bot) {
                                                    isManualNavigationRef.current = true;
                                                    const botTarget = bot.slug || bot.id;
                                                    navigate(`/ai-space/${categoryId}/${botTarget}/${sess.id}`);
                                                }
                                            }}
                                            className={`
                                            w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 group mx-2 cursor-pointer
                                            ${isSessionActive
                                                    ? 'bg-brand bg-opacity-10 text-brand border border-brand border-opacity-20 shadow-sm'
                                                    : (isDarkTheme ? 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-transparent' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-transparent')
                                                }
                                        `}
                                            style={{ width: 'calc(100% - 16px)' }}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    const bot = chatbots.find(b => b.id === sess.botId);
                                                    if (bot) {
                                                        isManualNavigationRef.current = true;
                                                        const botTarget = bot.slug || bot.id;
                                                        navigate(`/ai-space/${categoryId}/${botTarget}/${sess.id}`);
                                                    }
                                                }
                                            }}
                                        >
                                            <div
                                                className={`w-1.5 h-1.5 rounded-full shrink-0 transition-all duration-300 ${isSessionActive ? '' : (isDarkTheme ? 'bg-slate-700' : 'bg-slate-300')}`}
                                                style={isSessionActive ? { backgroundColor: brandColor } : {}}
                                            />
                                            <div className="flex flex-col items-start min-w-0 flex-1">
                                                <span className={`text-[12px] font-bold truncate w-full text-left ${isSessionActive ? 'text-brand' : (isDarkTheme ? 'text-slate-300' : 'text-slate-700')}`}>{sess.title}</span>
                                                <span className="text-[10px] text-slate-400 truncate w-full text-left flex items-center gap-1">
                                                    <Bot className="w-2.5 h-2.5" /> {sess.botName}
                                                </span>
                                            </div>
                                            {/* Pin Action for Search/Recent */}
                                            <div className={`flex items-center gap-1 ${isPinned ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onTogglePin(sess.id);
                                                    }}
                                                    className={`p-1 rounded bg-transparent border-0 cursor-pointer transition-colors ${isPinned ? 'text-brand' : 'hover:text-brand text-slate-400'}`}
                                                    title={isPinned ? "Bỏ ghim" : "Ghim hội thoại"}
                                                    style={isPinned ? { color: brandColor } : {}}
                                                >
                                                    <Pin
                                                        className="w-3 h-3"
                                                        fill={isPinned ? brandColor || "currentColor" : "none"}
                                                        stroke={isPinned ? brandColor || "currentColor" : "currentColor"}
                                                    />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* AVAILABLE INTELLIGENCE */}
                    <div className={`pt-2 border-t mx-4 ${isDarkTheme ? 'border-slate-800' : 'border-slate-50'}`}></div>
                    <div>
                        <div className="px-4 pb-3 flex items-center justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Agents</span>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isDarkTheme ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>{chatbots.length}</span>
                        </div>

                        <div className="space-y-2">
                            {loadingList ? (
                                [1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="mx-4 mb-3 flex items-center gap-3">
                                        <Skeleton variant="circle" width="24px" height="24px" className="shrink-0" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton variant="rect" width="70%" height="12px" />
                                        </div>
                                    </div>
                                ))
                            ) : chatbots.map(bot => (
                                <SidebarItem
                                    key={bot.id}
                                    bot={bot}
                                    viewMode={viewMode}
                                    isActive={activeBot?.id === bot.id && viewMode === 'chat'}
                                    isExpanded={expandedBotId === bot.id}
                                    botSessions={sessions[bot.id] || []}
                                    onTogglePin={onTogglePin}
                                    pinnedSessionIds={pinnedSessionIds}
                                    sessionId={sessionId}
                                    categoryId={categoryId}
                                    isDarkTheme={isDarkTheme}
                                    brandColor={brandColor}
                                    onToggleExpand={(b: any) => {
                                        if (expandedBotId !== b.id) {
                                            setExpandedBotId(b.id);
                                            if (activeBot?.id !== b.id) {
                                                const s = sessions[b.id] || [];
                                                if (s.length > 0) {
                                                    isManualNavigationRef.current = true;
                                                    const botTarget = b.slug || b.id;
                                                    navigate(`/ai-space/${categoryId}/${botTarget}/${s[0].id}`);
                                                } else {
                                                    // [P17-A1 FIX] Debounce: skip if a session creation is already in-flight
                                                    if (!isCreatingSessionRef.current) {
                                                        isCreatingSessionRef.current = true;
                                                        handleNewChat({ stopPropagation: () => { } } as any, b);
                                                        // Reset after 500ms so the sidebar can create a new session again if needed
                                                        setTimeout(() => { isCreatingSessionRef.current = false; }, 500);
                                                    }
                                                }
                                            }
                                        } else {
                                            setExpandedBotId(null);
                                        }
                                    }}
                                    onNewChat={handleNewChat}
                                    onDeleteSession={handleDeleteSession}
                                    onEditSessionTitle={handleEditSessionTitle}
                                    isOrganizationView={isOrganizationView}
                                    onNavigate={(botId: string, sessId: string) => {
                                        isManualNavigationRef.current = true;
                                        const bot = chatbots.find(b => b.id === botId);
                                        const botTarget = bot?.slug || botId;
                                        navigate(`/ai-space/${categoryId}/${botTarget}/${sessId}`);
                                    }}
                                />
                            ))}
                        </div>

                    </div>
                </div>

                {/* Footer */}
                <div className={`p-4 border-t space-y-2 transition-colors duration-500 ${isDarkTheme ? 'bg-[#0D1117]/30 border-slate-800' : 'bg-white border-slate-50'}`}>
                    {(orgUser?.role === 'admin' || orgUser?.role === 'assistant') && (
                        <button
                            onClick={onOpenTraining}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all border border-transparent group ${isOrganizationView ? 'bg-brand text-white shadow-brand' : (isDarkTheme ? 'text-slate-400 hover:bg-slate-800 hover:text-brand' : 'text-slate-500 hover:bg-slate-50 hover:text-brand')}`}
                        >
                            <Settings className="w-4 h-4" />
                            <span className="text-[13px] font-bold">Organization</span>
                        </button>
                    )}

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenKeyboardHelp?.();
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2 rounded-xl border border-transparent transition-all group/help ${isDarkTheme
                            ? 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                            : 'hover:bg-slate-50 text-slate-500 hover:text-slate-900'
                            }`}
                    >
                        <Keyboard className="w-4 h-4 opacity-70 group-hover/help:opacity-100" />
                        <span className="text-[12px] font-bold">Phím tắt</span>
                        <div className={`ml-auto px-1.5 py-0.5 rounded border text-[9px] font-black ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-white border-slate-200 text-slate-400'
                            }`}>?</div>
                    </button>

                    <div
                        onClick={onOpenProfile}
                        className={`flex items-center gap-2 px-2 py-2 group cursor-pointer rounded-xl transition-colors ${isDarkTheme ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}>

                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand to-brand-primary-dark flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-brand group-hover:scale-110 transition-transform uppercase">
                            {(orgUser?.full_name || categoryName || '?').charAt(0)}
                        </div>
                        <div className="leading-tight overflow-hidden flex-1">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <div className={`font-bold text-[14px] truncate tracking-tight group-hover:text-brand transition-colors ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>
                                    {orgUser?.full_name || categoryName}
                                </div>
                                {orgUser?.role && (
                                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm border shrink-0 ${orgUser.role === 'admin'
                                        ? 'bg-amber-600 text-white border-amber-400'
                                        : orgUser.role === 'assistant'
                                            ? 'bg-blue-500 text-white border-blue-400'
                                            : (isDarkTheme ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-100 text-slate-500 border-slate-200')
                                        }`}>
                                        {orgUser.role}
                                    </span>
                                )}
                            </div>
                            <div className="text-slate-400 text-[11px] truncate w-36 mt-0.5 lowercase">
                                {orgUser?.email || 'Professional'}
                            </div>
                        </div>
                        {orgUser && onLogout && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onLogout();
                                }}
                                className="p-2 hover:bg-red-50 hover:text-red-500 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Đăng xuất"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </aside>
    );
});

export default Sidebar;
