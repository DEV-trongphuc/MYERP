import * as React from 'react';
import { useRef, useEffect, useMemo } from 'react';
import {
    Copy, Volume2, StopCircle, RefreshCw, Undo, Sparkles, Globe, FileText, Loader2, ImageIcon, Bot, FileCode, Brain,
    ChevronUp, ChevronDown, X
} from 'lucide-react';
import { useVirtualizer } from '../../shims/reactVirtual';
import { Message, FileAttachment, ChatbotInfo } from '../../types';
import { isExpertModel } from '../../utils/ai-constants';

const EXT_MAP: Record<string, string> = {
    'javascript': 'js',
    'js': 'js',
    'typescript': 'ts',
    'ts': 'ts',
    'python': 'py',
    'py': 'py',
    'java': 'java',
    'c++': 'cpp',
    'cpp': 'cpp',
    'c#': 'cs',
    'cs': 'cs',
    'c': 'c',
    'php': 'php',
    'html': 'html',
    'css': 'css',
    'sql': 'sql',
    'json': 'json',
    'xml': 'xml',
    'yaml': 'yaml',
    'yml': 'yaml',
    'markdown': 'md',
    'md': 'md',
    'bash': 'sh',
    'sh': 'sh',
    'shell': 'sh',
    'powershell': 'ps1',
    'ps1': 'ps1',
    'ruby': 'rb',
    'rb': 'rb',
    'go': 'go',
    'rust': 'rs',
    'rs': 'rs',
    'swift': 'swift',
    'kotlin': 'kt',
    'kt': 'kt',
    'scala': 'scala',
    'r': 'r',
    'perl': 'pl',
    'pl': 'pl',
    'lua': 'lua',
    'dart': 'dart',
    'objective-c': 'm',
    'visual basic': 'vb',
    'vb': 'vb',
};

const MemoizedContent = React.memo(({
    content,
    role,
    messageId,
    renderMarkdown,
    isCodeMode,
    workspaceDocs,
    isDarkTheme
}: {
    content: string,
    role: string,
    messageId?: string,
    renderMarkdown: (text: string) => string,
    isCodeMode: boolean,
    workspaceDocs: FileAttachment[],
    isDarkTheme?: boolean
}) => {
    let codeBlockIndex = 0;
    let cleanContent = role === 'assistant'
        ? content
            .replace(/\[(?:ACTIONS|ACTION|BUTTONS|OPTIONS):?([\s\S]*?)\]/iu, '')
            .replace(/\[IMAGE_REQUEST:[\s\S]*?\]/g, '')
            .replace(/!\[.*\]\(\s*\)/g, '')
            .replace(/```(\w+)?\n([\s\S]*?)(?:```|$)/g, (match, lang, code) => {
                if (role === 'assistant') {
                    if (!code || code.length < 5) return match;

                    const language = (lang || 'txt').toLowerCase();
                    const ext = EXT_MAP[language] || language;
                    const fileName = `code_${messageId || 'unknown'}_${codeBlockIndex++}.${ext}`;

                    // Check if this file actually exists in the workspace
                    const fileExists = workspaceDocs.some(d => d.name === fileName);

                    if (isCodeMode && fileExists) {
                        return `\n\n[[CODE_EXTRACTED_MARKER:${fileName}]]\n\n`;
                    }
                }
                return match;
            })
            .replace(/The right section, labeled \"LÀM VIỆC TRỞ LẠI\"[\s\S]*?high-end\]/g, '')
            .replace(/\" on the second line.[\s\S]*?high-end\]/g, '')
        : content;

    // Strip PDF citation tags entirely
    cleanContent = cleanContent
        .replace(/\[\[PDFPAGECIT:\d+\]\]/g, '')
        .replace(/\[\[PDF_PAGE_CIT:\d+\]\]/g, '')
        .replace(/\[Xem trang \d+\]/g, '')
        // Strip markdown links with invalid/placeholder URLs (not real http/https links)
        // e.g. [Tổng Quan...](URL_của_tài_liệu_nếu_có) → **Tổng Quan...**
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
            const trimmedUrl = url.trim();
            if (/^https?:\/\//i.test(trimmedUrl)) return match; // valid URL → keep
            return `**${label}**`; // placeholder URL → strip to bold text
        });

    return (
        <div
            dangerouslySetInnerHTML={{
                __html: role === 'assistant'
                    ? renderMarkdown(cleanContent).replace(/\[\[CODE_EXTRACTED_MARKER:(.+?)\]\]/g, (match, fileName) => `
                <div onclick="window.__openWorkspaceFile('${fileName}')" class="code-extracted-info cursor-pointer group flex items-center justify-between gap-3 p-2 bg-slate-950 border border-slate-800 rounded-lg my-1 text-slate-300 font-medium text-[11px] shadow-sm hover:shadow-md select-none transform hover:-translate-y-0.5 duration-200 max-w-md">
                    <div class="flex items-center gap-2 overflow-hidden">
                        <div class="h-6 w-6 shrink-0 rounded-md bg-slate-800 flex items-center justify-center text-slate-400">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
                        </div>
                        <span class="font-mono tracking-tight truncate">${fileName}</span>
                    </div>
                </div>
            `)
                    : renderMarkdown(cleanContent)
            }}
        />
    );
});

const MemoizedEmptyState = React.memo(({
    isCodeMode,
    isImageGenMode,
    isResearchMode,
    isKbOnlyMode,
    setIsCodeMode,
    setIsImageGenMode,
    setIsResearchMode,
    setIsKbOnlyMode,
    setIsImageSettingsOpen,
    activeBot,
    isDarkTheme
}: {
    isCodeMode: boolean;
    isImageGenMode: boolean;
    isResearchMode: boolean;
    isKbOnlyMode: boolean;
    setIsCodeMode: (val: boolean) => void;
    setIsImageGenMode: (val: boolean) => void;
    setIsResearchMode: (val: boolean) => void;
    setIsKbOnlyMode: (val: boolean) => void;
    setIsImageSettingsOpen?: (val: boolean) => void;
    activeBot?: ChatbotInfo;
    isDarkTheme?: boolean;
}) => {
    const modes = [
        {
            id: 'standard',
            title: 'Trò chuyện Chuẩn',
            desc: 'Hội thoại thông minh, đa năng và nhanh chóng.',
            icon: <Sparkles className="w-5 h-5 text-brand" />,
            active: !isCodeMode && !isImageGenMode && !isResearchMode,
            onClick: () => {
                setIsCodeMode(false);
                setIsImageGenMode(false);
                setIsResearchMode(false);
                setIsKbOnlyMode(true);
            }
        },
        {
            id: 'research',
            title: 'Chế độ Nghiên cứu',
            desc: 'Truy cập Internet Thời gian thực để cập nhật tin tức mới nhất.',
            icon: <Globe className="w-5 h-5 text-brand" />,
            active: isResearchMode,
            onClick: () => {
                setIsResearchMode(true);
                setIsCodeMode(false);
                setIsImageGenMode(false);
                setIsKbOnlyMode(false);
            }
        },
        {
            id: 'code',
            title: 'Chế độ Code',
            desc: 'Tự động trích xuất và lưu mã nguồn vào Workspace của bạn.',
            icon: <FileCode className="w-5 h-5 text-brand" />,
            active: isCodeMode,
            onClick: () => {
                setIsCodeMode(true);
                setIsImageGenMode(false);
                setIsResearchMode(false);
                setIsKbOnlyMode(false);
            }
        },
        {
            id: 'image',
            title: 'Chế độ Hình ảnh',
            desc: 'Tạo ảnh nghệ thuật và quản lý thư vận hành ảnh AI.',
            icon: <ImageIcon className="w-5 h-5 text-brand" />,
            active: isImageGenMode,
            onClick: () => {
                setIsImageGenMode(true);
                setIsCodeMode(false);
                setIsResearchMode(false);
                setIsKbOnlyMode(false);
                if (setIsImageSettingsOpen) setIsImageSettingsOpen(true);
            }
        }
    ];

    return (
        <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col items-center animate-in fade-in duration-700">
            <div className="w-20 h-20 rounded-[28px] bg-gradient-to-br from-brand to-brand-accent flex items-center justify-center text-white shadow-2xl shadow-brand/20 mb-8 animate-in zoom-in duration-700">
                {activeBot?.settings?.bot_avatar ? (
                    <img src={activeBot.settings.bot_avatar} className="w-full h-full object-cover rounded-[28px]" alt="Avatar" />
                ) : (
                    <Bot className="w-10 h-10" />
                )}
            </div>

            <h2 className={`text-3xl font-black mb-3 tracking-tight text-center animate-in fade-in slide-in-from-bottom-2 duration-700 delay-100 ${isDarkTheme ? 'text-slate-100' : 'text-slate-900'}`}>
                Sẵn sàng trợ giúp, {activeBot?.name || 'AI Assistant'}
            </h2>
            <p className={`font-medium mb-12 text-center max-w-lg animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                Hãy bắt đầu một cuộc hội thoại mới hoặc chọn một chế độ chuyên dụng bên dưới để tối ưu hiệu quả công việc.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
                {modes.map((mode) => (
                    <button
                        key={mode.id}
                        onClick={mode.onClick}
                        className={`group p-5 rounded-3xl border-2 transition-all duration-300 text-left flex gap-4 items-start ${mode.active && mode.id !== 'standard'
                            ? (isDarkTheme ? 'bg-slate-800 border-slate-600 shadow-xl scale-[1.02]' : 'bg-white border-slate-200 shadow-xl scale-[1.02]')
                            : (isDarkTheme ? 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800 hover:shadow-lg' : 'bg-slate-50/50 border-slate-100 hover:border-slate-200 hover:bg-white hover:shadow-lg')
                            }`}
                    >
                        <div className={`p-3 rounded-2xl shrink-0 transition-transform group-hover:scale-110 duration-300 ${mode.active && mode.id !== 'standard' ? 'bg-brand/10' : (isDarkTheme ? 'bg-slate-700 shadow-sm border border-slate-600' : 'bg-white shadow-sm border border-slate-100')
                            }`}>
                            {mode.icon}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <h4 className={`font-bold text-sm ${mode.active && mode.id !== 'standard' ? 'text-brand' : (isDarkTheme ? 'text-slate-200' : 'text-slate-800')}`}>
                                    {mode.title}
                                </h4>
                                {mode.active && mode.id !== 'standard' && (
                                    <div className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
                                )}
                            </div>
                            <p className={`text-xs leading-relaxed font-medium ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                {mode.desc}
                            </p>
                        </div>
                    </button>
                ))}
            </div>

            <div className="mt-12 flex flex-wrap justify-center gap-6 animate-in fade-in duration-1000 delay-700">
                <div className={`flex items-center gap-2 grayscale hover:grayscale-0 transition-all opacity-40 hover:opacity-100 cursor-default`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkTheme ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/10 text-blue-600'}`}>
                        <FileText className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>Phân tích Tài liệu</span>
                </div>
                <div className={`flex items-center gap-2 grayscale hover:grayscale-0 transition-all opacity-40 hover:opacity-100 cursor-default`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkTheme ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-500/10 text-emerald-600'}`}>
                        <Globe className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>Kết nối Internet</span>
                </div>
                <div className={`flex items-center gap-2 grayscale hover:grayscale-0 transition-all opacity-40 hover:opacity-100 cursor-default`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDarkTheme ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/10 text-blue-600'}`}>
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>Prompt thông minh</span>
                </div>
            </div>
        </div>
    );
});

const MessageList = React.memo(({
    messages,
    activeBot,
    loadingChat,
    workspaceDocs,
    openTabNames,
    setWorkspaceDocs,
    setOpenTabNames,
    setActiveDoc,
    setIsDocWorkspaceOpen,
    renderMarkdown,
    isCodeMode,
    isImageGenMode,
    copyToClipboard,
    speakMessage,
    isSpeaking,
    regenerateResponse,
    reuseMessage,
    setInput,
    suggestedQuestions,
    handleNewChatSuggestion,
    messagesEndRef,
    attachments,
    onPreviewImage,
    onMakeGlobal,
    isResearchMode,
    setIsResearchMode,
    isKbOnlyMode,
    setIsKbOnlyMode,
    setIsCodeMode,
    setIsImageGenMode,
    setIsImageSettingsOpen,
    isDarkTheme,
    isMobile,
    selectedModel,
    onLoadMore,
    isLoadingMore,
    canLoadMore,
    chatSearchTerm
}: any) => {
    const isExpertMode = isExpertModel(selectedModel);
    const parentRef = useRef<HTMLDivElement>(null);
    const isInitialLoadRef = useRef(true);

    const displayItems = useMemo(() => {
        const items: any[] = [];
        let lastDate: string | null = null;

        messages.forEach((m: any, idx: number) => {
            const date = m.timestamp ? new Date(m.timestamp) : new Date();
            const dateStr = date.toLocaleDateString('vi-VN');

            if (dateStr !== lastDate) {
                let label = dateStr;
                const now = new Date();
                const todayStr = now.toLocaleDateString('vi-VN');
                const yesterdayStr = new Date(now.setDate(now.getDate() - 1)).toLocaleDateString('vi-VN');

                if (dateStr === todayStr) label = "Hôm nay";
                else if (dateStr === yesterdayStr) label = "Hôm qua";

                items.push({ type: 'separator', label, id: `sep-${dateStr}-${idx}` });
                lastDate = dateStr;
            }
            items.push({ type: 'message', data: m, index: idx });
        });
        return items;
    }, [messages]);

    const rowVirtualizer = useVirtualizer({
        count: displayItems.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => displayItems[index].type === 'separator' ? 60 : 150,
        overscan: 5,
    });

    // Detect scroll to top for infinite load
    useEffect(() => {
        const el = parentRef.current;
        if (!el) return;

        const handleScroll = () => {
            // Ignore scroll events during initial load — virtualizer auto-scrolls to bottom
            // which can briefly pass scrollTop=0 and trigger a premature loadMore
            if (isInitialLoadRef.current) return;
            if (el.scrollTop < 50 && onLoadMore && !isLoadingMore && canLoadMore) {
                onLoadMore();
            }
        };

        el.addEventListener('scroll', handleScroll);
        return () => el.removeEventListener('scroll', handleScroll);
    }, [onLoadMore, isLoadingMore, canLoadMore]);

    useEffect(() => {
        isInitialLoadRef.current = true;
    }, [activeBot?.id]);

    useEffect(() => {
        if (messages.length > 0) {
            const behavior = isInitialLoadRef.current ? 'auto' : 'smooth';
            rowVirtualizer.scrollToIndex(displayItems.length - 1, { align: 'end', behavior });

            // If the last message is from the user, it means we probably just sent something, 
            // so we should keep smooth scrolling for the AI response
            if (messages[messages.length - 1]?.role === 'assistant') {
                isInitialLoadRef.current = false;
            } else {
                // After the first render of existing messages, next scrolls should be smooth
                setTimeout(() => { isInitialLoadRef.current = false; }, 100);
            }
        }
    }, [messages.length, rowVirtualizer, activeBot?.id]);


    return (
        <div
            ref={parentRef}
            className={`flex-1 overflow-y-auto custom-scrollbar pt-6 pb-80 transition-colors duration-500 ${isDarkTheme ? 'bg-[#0B0F17]' : 'bg-white'}`}
            id="chat-scroll"
        >
            {messages.length === 0 ? (
                <MemoizedEmptyState
                    isCodeMode={isCodeMode}
                    isImageGenMode={isImageGenMode}
                    isResearchMode={isResearchMode}
                    isKbOnlyMode={isKbOnlyMode}
                    setIsCodeMode={setIsCodeMode}
                    setIsImageGenMode={setIsImageGenMode}
                    setIsResearchMode={setIsResearchMode}
                    setIsKbOnlyMode={setIsKbOnlyMode}
                    setIsImageSettingsOpen={setIsImageSettingsOpen}
                    activeBot={activeBot}
                    isDarkTheme={isDarkTheme}
                />
            ) : (
                <div
                    className="max-w-5xl mx-auto px-4 md:px-8 relative"
                    style={{
                        height: `${rowVirtualizer.getTotalSize()}px`,
                        width: '100%',
                    }}
                >
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                        const item = displayItems[virtualRow.index];

                        if (item.type === 'separator') {
                            return (
                                <div
                                    key={item.id}
                                    data-index={virtualRow.index}
                                    ref={rowVirtualizer.measureElement}
                                    className="flex justify-center my-6 absolute left-0 right-0 z-10"
                                    style={{
                                        transform: `translateY(${virtualRow.start}px)`,
                                    }}
                                >
                                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm border ${isDarkTheme ? 'bg-[#161B24]/80 border-slate-700/50 text-slate-400 backdrop-blur-md' : 'bg-white/80 border-slate-100 text-slate-400 backdrop-blur-md'}`}>
                                        {item.label}
                                    </div>
                                </div>
                            );
                        }

                        const msg = item.data;
                        const isUser = msg.role === 'user';
                        const isHighlighted = chatSearchTerm && msg.content.toLowerCase().includes(chatSearchTerm.toLowerCase());

                        return (
                            <div
                                key={msg.id}
                                data-index={virtualRow.index}
                                data-message-id={msg.id}
                                ref={rowVirtualizer.measureElement}
                                className={`group flex gap-4 mb-6 absolute left-4 right-4 md:left-8 md:right-8 transition-all duration-500 ${isUser ? 'flex-row-reverse items-start' : 'items-start'} ${isHighlighted ? 'ring-2 ring-brand/20 rounded-3xl' : ''}`}
                                style={{
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                {/* Message Body Container */}
                                <div className={`flex flex-col max-w-[90%] md:max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-2 mb-1.5 opacity-50 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                        {isUser ? 'Bạn' : activeBot?.name || 'AI Assistant'}
                                    </div>

                                    <div className={`
                                        relative px-4 py-3 md:px-6 md:py-4 rounded-3xl shadow-sm transition-all duration-300 group/msg
                                        ${isUser
                                            ? (isDarkTheme ? 'bg-[#1E2532] border border-slate-700/50 text-slate-100 rounded-tr-lg' : 'bg-white border border-slate-100 text-slate-800 rounded-tr-lg')
                                            : (isDarkTheme ? 'bg-[#161B24] border border-slate-800/80 text-slate-200 rounded-tl-lg' : 'bg-slate-50/80 border border-slate-100/50 text-slate-800 rounded-tl-lg')
                                        }
                                    `}>

                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className={`mb-4 ${isUser ? 'flex flex-col items-end' : 'flex flex-wrap gap-2'}`}>
                                                {isUser && msg.attachments.filter((a: any) => a.type.startsWith('image/')).length > 1 ? (
                                                    <div className="relative w-48 h-48 my-6 mr-6 group/fan cursor-pointer hover:mr-10 transition-all duration-500" onClick={() => onPreviewImage(msg.attachments.filter((a: any) => a.type.startsWith('image/'))[0].previewUrl)}>
                                                        {msg.attachments.filter((a: any) => a.type.startsWith('image/')).slice(0, 4).map((file: any, i: number, arr: any[]) => (
                                                            <div
                                                                key={i}
                                                                className="absolute inset-0 transition-all duration-500 origin-bottom-right shadow-2xl rounded-[24px] border-4 border-white overflow-hidden bg-slate-50 group-hover/fan:scale-110 group-hover/fan:-translate-x-2 group-hover/fan:-translate-y-2 z-0 hover:z-10"
                                                                style={{
                                                                    zIndex: 10 - i,
                                                                    transform: `rotate(${(i - (arr.length - 1) / 2) * 15}deg) translateX(${i * 20}px) translateY(${i * -5}px)`,
                                                                }}
                                                            >
                                                                <img src={file.previewUrl || file.base64} className="w-full h-full object-cover" />
                                                                <div className="absolute inset-0 bg-black/5 opacity-0 group-hover/fan:opacity-100 transition-opacity" />
                                                            </div>
                                                        ))}
                                                        {msg.attachments.filter((a: any) => a.type.startsWith('image/')).length > 4 && (
                                                            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-brand text-white rounded-full flex items-center justify-center text-[10px] font-black z-20 shadow-lg border-2 border-white">
                                                                +{msg.attachments.filter((a: any) => a.type.startsWith('image/')).length - 4}
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className={`flex flex-wrap gap-2 ${isUser ? 'justify-end' : ''}`}>
                                                        {msg.attachments.filter((a: any) => a.type.startsWith('image/')).map((file: any, i: number) => (
                                                            <div key={i} className="group/att relative cursor-pointer" onClick={() => onPreviewImage(file.previewUrl || file.base64)}>
                                                                <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-md transition-all hover:border-brand hover:scale-110 hover:z-50 duration-300 w-full bg-slate-50 max-w-[300px]">
                                                                    <img src={file.previewUrl || file.base64} alt={file.name} className="w-full h-auto object-contain" />
                                                                    {msg.role === 'assistant' && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onMakeGlobal(file);
                                                                            }}
                                                                            className="absolute bottom-2 right-2 p-1.5 bg-white/90 backdrop-blur rounded-lg text-slate-500 hover:text-brand hover:bg-white shadow-sm opacity-0 group-hover/att:opacity-100 transition-all transform translate-y-2 group-hover/att:translate-y-0"
                                                                            title="Make Global"
                                                                        >
                                                                            <Globe className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}

                                                <div className={`flex flex-wrap gap-2 mt-2 ${isUser ? 'justify-end' : ''}`}>
                                                    {msg.attachments.filter((a: any) => !a.type.startsWith('image/')).map((file: any, i: number) => (
                                                        <div key={i} className="group/att relative cursor-pointer" onClick={() => {
                                                            if (!workspaceDocs.some((d: any) => d.name === file.name)) setWorkspaceDocs((prev: any) => [...prev, file]);
                                                            if (!openTabNames.includes(file.name)) setOpenTabNames((prev: any) => [...prev, file.name]);
                                                            setActiveDoc(file);
                                                            setIsDocWorkspaceOpen(true);
                                                        }}>
                                                            {file.type.startsWith('video/') ? (
                                                                <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-md transition-all hover:border-brand hover:scale-110 hover:z-50 duration-300 bg-slate-50">
                                                                    <video src={file.previewUrl || file.base64} controls className="max-w-[280px] max-h-[280px] md:max-w-[400px] md:max-h-[400px]" onClick={(e: any) => e.stopPropagation()} />
                                                                    {msg.role === 'assistant' && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onMakeGlobal(file);
                                                                            }}
                                                                            className="absolute top-2 right-2 p-1.5 bg-white/90 backdrop-blur rounded-lg text-slate-500 hover:text-brand hover:bg-white shadow-sm opacity-0 group-hover/att:opacity-100 transition-all"
                                                                            title="Make Global"
                                                                        >
                                                                            <Globe className="w-4 h-4" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-[11px] font-bold hover:bg-brand hover:bg-opacity-5 hover:border-brand-accent hover:text-brand transition-all shadow-sm hover:shadow-md pr-8 relative">
                                                                    <FileText className="w-4 h-4 text-brand" />
                                                                    <span className="truncate max-w-[150px] text-slate-700">{file.name}</span>
                                                                    <span className="text-[9px] text-slate-400 font-normal ml-1 border rounded px-1 group-hover/att:border-brand-accent">View</span>
                                                                    {msg.role === 'assistant' && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                onMakeGlobal(file);
                                                                            }}
                                                                            className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-brand transition-colors"
                                                                            title="Make Global"
                                                                        >
                                                                            <Globe className="w-3.5 h-3.5" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className={`content-area ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'} selection:bg-blue-500 selection:text-white ${loadingChat && virtualRow.index === messages.length - 1 && msg.role === 'assistant' ? 'typing-cursor' : ''}`}>
                                            <MemoizedContent
                                                content={msg.content}
                                                role={msg.role}
                                                messageId={msg.id}
                                                renderMarkdown={renderMarkdown}
                                                isCodeMode={isCodeMode}
                                                workspaceDocs={workspaceDocs}
                                                isDarkTheme={isDarkTheme}
                                            />
                                            {loadingChat && virtualRow.index === messages.length - 1 && msg.role === 'assistant' && !msg.content && !isImageGenMode && (
                                                <div className="flex flex-col gap-2 mt-4 ml-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <div className="w-8 h-8 rounded-xl bg-brand/10 flex items-center justify-center relative overflow-hidden group">
                                                                <Brain className="w-5 h-5 text-brand animate-pulse relative z-10" />
                                                                <div className="absolute inset-0 bg-brand/5 animate-pulse" />
                                                            </div>
                                                            <div className="absolute -inset-1 bg-brand/20 blur-md rounded-full animate-pulse -z-10" />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className={`text-[13px] font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>
                                                                {attachments.length > 0 ? 'Analyzing data...' : 'AI đang suy nghĩ...'}
                                                            </span>
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 flex items-center gap-1">
                                                                    <Loader2 className="w-2 h-2 animate-spin" />
                                                                    {/* Est. {isExpertMode ? '~5-10s' : '~2-3s'} */}
                                                                </span>
                                                                <span className={`text-[11px] font-medium uppercase tracking-wider ${isExpertMode ? 'text-amber-600' : 'text-brand'}`}>
                                                                    {isExpertMode ? 'Expert Mode' : 'Auto Mode'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {isImageGenMode && loadingChat && virtualRow.index === messages.length - 1 && msg.role === 'assistant' && (
                                                <div className="mt-4 p-6 rounded-3xl bg-slate-50/50 border border-slate-200/50 relative overflow-hidden group/gen">
                                                    <div className="flex flex-col items-center gap-4 relative z-10">
                                                        <div className="relative">
                                                            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-brand flex items-center justify-center shadow-brand animate-pulse">
                                                                <ImageIcon className="w-10 h-10 text-white animate-bounce" />
                                                            </div>
                                                            <div className="absolute -inset-4 bg-brand bg-opacity-20 rounded-full blur-2xl animate-pulse -z-10" />
                                                        </div>
                                                        <div className="flex flex-col items-center gap-1.5">
                                                            <span className="text-[13px] font-black text-slate-800 uppercase tracking-widest">AI Image Studio</span>
                                                            <span className="text-[11px] font-bold text-brand flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-brand animate-ping" />
                                                                Đang tạo hình ảnh...
                                                            </span>
                                                        </div>
                                                        <div className="w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-2">
                                                            <div className="h-full bg-gradient-to-r from-brand animate-[progress_3s_ease-in-out_infinite]" />
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {
                                        msg.role === 'user' && (
                                            <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                                                <button onClick={() => reuseMessage(msg.content, msg.attachments)} className="p-1.5 bg-white hover:bg-slate-50 text-slate-400 hover:text-brand rounded-lg transition-all border border-slate-100 shadow-sm flex items-center justify-center">
                                                    <Undo className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )
                                    }

                                    {
                                        msg.role === 'assistant' && (
                                            <div className="flex flex-col gap-3 mt-3">
                                                {msg.quickActions && msg.quickActions.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mb-3">
                                                        {msg.quickActions.map((action: string, ai: number) => (
                                                            <button key={ai} onClick={() => { setInput(action); setTimeout(() => document.getElementById('send-button')?.click(), 100); }} className="group/btn text-left px-3 py-1.5 md:px-4 md:py-2.5 bg-white hover:bg-brand hover:bg-opacity-5 border border-slate-200 hover:border-brand-accent rounded-xl text-[11px] md:text-[13px] font-medium text-slate-600 hover:text-brand transition-all shadow-sm hover:shadow-md flex items-center gap-2 md:gap-2.5">
                                                                <Sparkles className="shrink-0 w-3 h-3 md:w-3.5 md:h-3.5 text-brand opacity-60 group-hover/btn:opacity-100 group-hover/btn:rotate-12 transition-all" />
                                                                <span className="line-clamp-2 md:line-clamp-1">{action}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                                <div className="flex items-center gap-3 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => copyToClipboard(msg.content)} className="text-slate-500 hover:text-slate-800 transition-colors"><Copy className="w-4 h-4" /></button>
                                                    <button onClick={() => speakMessage(msg.content, msg.id)} className={`text-slate-500 hover:text-slate-800 transition-colors ${isSpeaking === msg.id ? 'text-green-500 animate-pulse' : ''}`}>
                                                        {isSpeaking === msg.id ? <StopCircle className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                                    </button>
                                                    {virtualRow.index === messages.length - 1 && (
                                                        <button onClick={regenerateResponse} className="text-slate-500 hover:text-slate-800 transition-colors"><RefreshCw className="w-4 h-4" /></button>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    }
                                </div>
                            </div>
                        );
                    })}
                </div >
            )}
        </div >
    );
});

export default MessageList;
