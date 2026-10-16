import React from 'react';
import { Bot, MessageSquare, Search, ShoppingBag, BookOpen, ChevronDown, ImageIcon, Database } from 'lucide-react';
import { ChatbotInfo, ChatSession } from '../../types';

const ChatbotCard = React.memo(({
    bot,
    onClick,
    onStartChat,
    isDarkTheme,
    categoryId
}: {
    bot: any,
    onClick: (e: React.MouseEvent) => void,
    onStartChat: (e: React.MouseEvent, bot: any) => void,
    isDarkTheme?: boolean,
    categoryId?: string
}) => {
    const isActive = Number(bot.is_active) === 1 || bot.ai_enabled || bot.is_enabled;

    return (
        <div
            onClick={onClick}
            className={`group p-6 rounded-[32px] border transition-all duration-500 cursor-pointer relative overflow-hidden flex flex-col justify-between gap-6 ${isDarkTheme ? 'bg-[#0D1117] border-slate-800 hover:border-brand/30 hover:shadow-2xl hover:shadow-brand/5' : 'bg-white border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-slate-200 hover:border-slate-300'}`}
        >
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-slate-400 group-hover:scale-125 transition-transform">
                <Bot className="w-32 h-32" />
            </div>

            <div className="flex justify-between items-start relative z-10">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-[22px] bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white shadow-xl shadow-brand/20 group-hover:rotate-3 transition-transform shrink-0 overflow-hidden border border-slate-100/10">
                        {bot.settings?.bot_avatar ? (
                            <img
                                src={bot.settings.bot_avatar}
                                className={`w-full h-full object-cover ${categoryId ? 'grayscale group-hover:grayscale-0 transition-all duration-500' : ''}`}
                            />
                        ) : (
                            <div className={`w-full h-full flex items-center justify-center transition-all duration-500 ${categoryId ? 'bg-brand' : 'bg-gradient-to-br from-[#c2410c] to-[#9a3412]'}`}>
                                <Bot className="w-7 h-7" />
                            </div>
                        )}
                    </div>
                    <div className="min-w-0">
                        <h4 className={`text-base font-bold leading-tight truncate pr-2 ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>{bot.name}</h4>
                        <p className={`text-[10px] font-mono mt-1 pr-2 truncate uppercase tracking-widest ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>{bot.domain || 'AI ASSISTANT'}</p>
                    </div>
                </div>
                <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight border shrink-0 ${isActive
                    ? (isDarkTheme ? 'bg-emerald-900/40 text-emerald-400 border-emerald-800/50' : 'bg-emerald-50 text-emerald-600 border-emerald-100')
                    : (isDarkTheme ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100')
                    }`}>
                    {isActive ? 'Active' : 'Inactive'}
                </div>
            </div>

            <div className="space-y-4 relative z-10">
                <div className={`flex items-center justify-between p-3 rounded-2xl border transition-colors ${isDarkTheme ? 'bg-[#0B0F17] border-slate-800 group-hover:bg-[#161B24]' : 'bg-slate-50 border-slate-100 group-hover:bg-slate-100 group-hover:border-slate-200'}`}>
                    <div className="flex flex-col">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tài liệu</span>

                        <span className={`text-sm font-black ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>{(bot.stats?.docs_count || 0).toLocaleString()} <span className="text-[10px] font-medium text-slate-500">docs</span></span>
                    </div>
                    <div className={`h-8 w-px ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-200'}`}></div>
                    <div className="flex flex-col items-end">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cuộc trò chuyện</span>
                        <span className={`text-sm font-black ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>{(bot.stats?.queries_count || 0).toLocaleString()} <span className="text-[10px] font-medium text-slate-500">convos</span></span>
                    </div>
                </div>

                <button
                    onClick={(e) => onStartChat(e, bot)}
                    className={`w-full h-11 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all duration-500 flex items-center justify-center gap-2 group/btn ${isDarkTheme ? 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700' : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                >
                    <MessageSquare className="w-4 h-4 text-slate-400 group-hover/btn:scale-110 transition-transform" />
                    START CHATTING
                </button>
            </div>
        </div>
    );
});

const HomeView = React.memo(({
    chatbots,
    searchTerm,
    setSearchTerm,
    loadingList,
    filteredChatbots,
    sessions,
    categoryId,
    handleNewChat,
    navigate,
    isManualNavigationRef,
    orgUser,
    isDarkTheme
}: {
    chatbots: ChatbotInfo[],
    searchTerm: string,
    setSearchTerm: (term: string) => void,
    loadingList: boolean,
    filteredChatbots: ChatbotInfo[],
    sessions: Record<string, ChatSession[]>,
    categoryId: string | undefined,
    handleNewChat: (e: React.MouseEvent, bot: ChatbotInfo) => void,
    navigate: any,
    isManualNavigationRef: React.MutableRefObject<boolean>,
    orgUser: any,
    isDarkTheme?: boolean
}) => {
    return (
        <div className={`flex-1 flex flex-col items-center justify-start px-4 md:px-6 lg:px-12 pt-10 md:pt-16 lg:pt-24 pb-12 relative z-10 overflow-y-auto custom-scrollbar transition-colors duration-500 ${isDarkTheme ? 'bg-[#05070A]' : 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-brand/10 via-white to-white'}`}>
            <div className="w-full max-w-[1600px] flex flex-col items-center animate-in fade-in duration-500">

                {/* AI Training Style Header */}
                <div className="w-full flex flex-col items-center text-center md:flex-row md:justify-between md:items-start md:text-left gap-6 md:gap-0 mb-6 md:mb-10 px-0 md:px-4 relative">
                    <div className="flex flex-col items-center md:items-start animate-in fade-in slide-in-from-left-5 duration-700">
                        <h1 className={`text-2xl md:text-[32px] font-black leading-tight flex items-center justify-center md:justify-start gap-2 ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>
                            AI Agents<span className="text-brand text-3xl md:text-4xl leading-none">.</span>
                        </h1>
                        <div className="flex items-center justify-center md:justify-start gap-3 mt-2 md:mt-3">
                            <div className="hidden md:block w-8 h-[2px] bg-slate-200"></div>
                            <p className="text-slate-500 text-xs md:text-sm font-medium">
                                Quản lý và tương tác với các chuyên gia AI được đào tạo riêng cho bạn.
                            </p>
                        </div>
                    </div>


                    <div className="absolute -top-12 -right-6 z-10 hidden md:block group cursor-pointer transition-transform hover:-translate-y-2 duration-300">
                        <a href="https://www.facebook.com/tunri0" target="_blank" rel="noopener noreferrer" title="Liên hệ IT Support">
                            <img
                                src="https://pngfile.net/files/preview/960x960/11741189725reo9wbrtum5xxfbhubjnxavgk71sl6ptkgksc801wvj0l5pjgdch8arnleln7oqh0kzvi0wrniegc642iks8woshwo14pifdaq67.png"
                                alt="AI Mascot"
                                className="w-40 h-auto drop-shadow-2xl animate-bounce-slow group-hover:animate-none"
                                style={{ transform: 'scaleX(-1)' }}
                            />
                        </a>
                    </div>
                </div>

                {/* Main Content Container (White Card style) */}
                <div className={`w-full rounded-[24px] md:rounded-[32px] border shadow-sm p-4 md:p-8 min-h-[600px] animate-in fade-in slide-in-from-bottom-5 duration-1000 delay-200 transition-colors ${isDarkTheme ? 'bg-[rgba(13,17,23,0.6)] backdrop-blur-md border-slate-800' : 'bg-white border-slate-200'}`}>
                    {/* Search & Controls Row */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 mb-6 md:mb-10">
                        <div className="flex items-center gap-4 md:gap-6 justify-between md:justify-start">
                            <h3 className={`text-base md:text-lg font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>Danh sách AI Agents</h3>
                            <div className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2 md:px-3 py-1 md:py-1.5 rounded-lg border ${isDarkTheme ? 'bg-slate-800 text-slate-500 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                                Tổng cộng: {chatbots.length}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 md:gap-3 w-full md:max-w-md">
                            <div className="relative group flex-1">
                                <div className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                    <Search className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                </div>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder="Tìm kiếm AI..."
                                    className={`w-full h-10 md:h-11 border-2 rounded-xl pl-9 md:pl-11 pr-4 text-xs font-bold transition-all outline-none ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 focus:bg-[#0B0F17] focus:border-slate-700 placeholder:text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-700 focus:bg-white focus:border-slate-300 shadow-sm placeholder:text-slate-400'}`}
                                />
                            </div>
                            <button className={`shrink-0 h-10 md:h-11 w-10 md:w-auto md:px-5 border rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                <BookOpen className="w-4 h-4 text-slate-500" />
                                <span className="hidden md:inline">Mẹo & Hướng dẫn</span>
                                <ChevronDown className="hidden md:block w-3.5 h-3.5 text-slate-400" />
                            </button>
                        </div>
                    </div>

                    {/* Grid of Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {loadingList ? [1, 2, 3].map(i => (
                            <div key={i} className={`h-48 rounded-[32px] animate-pulse border ${isDarkTheme ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-100'}`} />
                        )) : filteredChatbots.map(bot => (
                            <ChatbotCard
                                key={bot.id}
                                bot={bot}
                                categoryId={categoryId}
                                onClick={(e) => {
                                    const botSessions = sessions[bot.id] || [];
                                    if (botSessions.length > 0) {
                                        const latest = botSessions[0];
                                        isManualNavigationRef.current = true;
                                        const botTarget = bot.slug || bot.id;
                                        navigate(`/ai-space/${categoryId}/${botTarget}/${latest.id}`);
                                    } else {
                                        handleNewChat(e, bot);
                                    }
                                }}
                                onStartChat={(e) => {
                                    e.stopPropagation();
                                    const botSessions = sessions[bot.id] || [];
                                    if (botSessions.length > 0) {
                                        const latest = botSessions[0];
                                        isManualNavigationRef.current = true;
                                        const botTarget = bot.slug || bot.id;
                                        navigate(`/ai-space/${categoryId}/${botTarget}/${latest.id}`);
                                    } else {
                                        handleNewChat(e, bot);
                                    }
                                }}
                                isDarkTheme={isDarkTheme}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
});

export default HomeView;
