import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
    MessageCircle, X, Send, User,
    Bot, Maximize2, Minimize2,
    Sparkles, ShieldCheck,
    FileText, ArrowRight
} from 'lucide-react';
import { api } from '../../services/storageAdapter';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

const renderContent = (content: string, role: 'user' | 'assistant', onActionClick?: (action: string) => void) => {
    // 0. Extract [ACTIONS:...] tags
    let extractedActions: string[] = [];
    const actionRegex = /\[(?:ACTIONS|ACTION|BUTTONS|BUTTON|OPTIONS):?(.*?)\]/gi;

    // Process explicit tags
    content = content.replace(actionRegex, (match, rawActions) => {
        const separator = rawActions.includes('|') ? '|' : ',';
        const parsed = rawActions.split(separator).map((s: string) => s.trim()).filter((s: string) => s);
        extractedActions = [...extractedActions, ...parsed];
        return '';
    });

    // Process implicit tags at end of string (e.g. [Option 1 | Option 2])
    content = content.replace(/\[([^\[\]]+)\]$/, (match, group1) => {
        if (group1.includes('|') || group1.length < 100) {
            const separator = group1.includes('|') ? '|' : ',';
            const parsed = group1.split(separator).map((s: string) => s.trim()).filter((s: string) => s);
            extractedActions = [...extractedActions, ...parsed];
            return '';
        }
        return match;
    }).trim();

    // Deduplicate actions
    extractedActions = Array.from(new Set(extractedActions));

    // 1. Helper: Parse Links, Emails, Phones & FILES
    const parseLinks = (text: string): (string | React.ReactNode)[] => {
        const combinedRegex = /(!?\[([^\]]+)\]\(([^)]+)\)|\[?(https?:\/\/[^\s\]]+)\]?|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(\+84|0)\d{9,10})/g;
        const parts: (string | React.ReactNode)[] = [];
        let lastIndex = 0;
        let match;

        while ((match = combinedRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                parts.push(text.substring(lastIndex, match.index));
            }

            const isMarkdownImage = match[1].startsWith('!');
            let label = match[2];
            let url = match[3] || match[4] || match[1];

            if (!match[3] && !match[2]) {
                url = url.replace(/[.,!?;:)\]]+$/, '');
            }

            if (!label && (url.startsWith('mailto:') || url.startsWith('tel:'))) {
                label = url.replace(/^(mailto|tel):/, '');
            } else if (!label && url.includes('@') && !url.startsWith('http')) {
                label = url;
                url = `mailto:${url}`;
            } else if (!label && url.match(/^(\+84|0)\d{9,10}$/)) {
                label = url;
                url = `tel:${url}`;
            }

            const imgExtMatch = url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i);
            const fileExtMatch = url.match(/\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)$/i);
            const youtubeMatch = url.match(/^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/);

            if (youtubeMatch) {
                const vidId = youtubeMatch[4];
                const thumb = `https://img.youtube.com/vi/${vidId}/mqdefault.jpg`;
                parts.push(
                    <a
                        key={match.index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group mt-2 mb-2 no-underline"
                    >
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs transition-colors group-hover:border-[#BD1D2D]/40">
                            <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                                <img
                                    src={thumb}
                                    alt="YouTube Preview"
                                    className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/15 transition-colors">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#BD1D2D] text-white shadow-md">
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-slate-50">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">XEM VIDEO TRÊN YOUTUBE</span>
                                    <span className="text-xs font-bold text-slate-700 truncate group-hover:text-[var(--color-primary)] transition-colors">Bấm để phát ngay</span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[var(--color-primary)] transition-colors" />
                            </div>
                        </div>
                    </a>
                );
            } else if (isMarkdownImage || imgExtMatch) {
                parts.push(
                    <div key={match.index} className="mt-2 mb-2">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-xl border border-slate-200 shadow-xs transition-colors hover:border-slate-300 group/img"
                        >
                            <img
                                src={url}
                                alt={label || "Shared image"}
                                className="w-full h-auto max-h-[400px] object-contain bg-black/5"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </a>
                    </div>
                );
            } else if (fileExtMatch) {
                const ext = fileExtMatch[1].toLowerCase();
                const fileName = label || url.split('/').pop() || 'Tải lên'


                parts.push(
                    <a
                        key={match.index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group mt-2 mb-2 no-underline"
                    >
                        <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl transition-colors group-hover:border-[#BD1D2D]/40 group-hover:bg-white">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${ext === 'pdf' ? 'bg-rose-100 text-rose-500' :
                                ext.includes('doc') ? 'bg-blue-100 text-blue-500' :
                                    ext.includes('xls') ? 'bg-emerald-100 text-emerald-500' :
                                        'bg-slate-200 text-slate-600'
                                }`}>
                                <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h5 className="text-[13px] font-bold text-slate-700 truncate group-hover:text-[#BD1D2D] transition-colors">{fileName}</h5>
                                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{ext.toUpperCase()} FILE • Bấm để tải</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-[#BD1D2D] group-hover:text-white transition-colors">
                                <Maximize2 className="w-4 h-4 rotate-45" />
                            </div>
                        </div>
                    </a>
                );
            } else {
                const isCitation = label && (label.toLowerCase().includes('trang') || label.toLowerCase().includes('page') || /^\d+$/.test(label));

                parts.push(
                    <a
                        key={match.index}
                        href={url}
                        target={url.startsWith('http') ? "_blank" : undefined}
                        rel={url.startsWith('http') ? "noopener noreferrer" : undefined}
                        className={isCitation
                            ? "mf-citation"
                            : `font-medium transition-colors duration-200 decoration-1 underline-offset-4 hover:underline ${role === 'user' ? 'text-blue-200 hover:text-white' : 'text-[var(--color-primary)] hover:text-[#9A1523]'}`
                        }
                    >
                        {label || url}
                    </a>
                );
            }
            lastIndex = combinedRegex.lastIndex;
        }

        if (lastIndex < text.length) {
            parts.push(text.substring(lastIndex));
        }
        return parts.length > 0 ? parts : [text];
    };

    const parseBold = (nodes: (string | React.ReactNode)[]): React.ReactNode[] => {
        return nodes.flatMap((node, i) => {
            if (typeof node !== 'string') return node;

            const boldParts = node.split(/(\*\*[^*]+\*\*)/g);
            return boldParts.map((part, j) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={`${i}-${j}`} className={`font-bold ${role === 'user' ? 'text-white' : 'text-slate-900'}`}>{part.slice(2, -2)}</strong>;
                }
                return part;
            });
        });
    };

    const parseInline = (text: string) => {
        return parseBold(parseLinks(text));
    };

    const lines = content.split('\n');
    const blocks: React.ReactNode[] = [];
    let currentList: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        const listMatch = trimmed.match(/^([-*•–—]|\d+\.)\s*(.*)$/);
        const isIndented = line.startsWith('  ') || line.startsWith('\t');

        if (listMatch) {
            const clean = listMatch[2];
            currentList.push(
                <li key={`li-${idx}`} className="leading-relaxed pl-1 mb-1" style={{ display: 'list-item', listStyleType: 'inherit' }}>
                    {parseInline(clean)}
                </li>
            );
        } else if (isIndented && currentList.length > 0 && trimmed) {
            currentList.push(
                <li key={`li-cont-${idx}`} className="leading-relaxed pl-1 mb-1 list-none" style={{ display: 'block' }}>
                    {parseInline(trimmed)}
                </li>
            );
        } else {
            if (currentList.length > 0) {
                blocks.push(
                    <ul
                        key={`ul-${idx}`}
                        className="pl-6 mb-3 space-y-1"
                        style={{ listStyleType: 'disc', listStylePosition: 'outside', display: 'block' }}
                    >
                        {currentList}
                    </ul>
                );
                currentList = [];
            }

            if (trimmed) {
                if (trimmed.startsWith('### ')) {
                    blocks.push(<h3 key={`h-${idx}`} className={`font-bold text-sm mb-2 mt-3 ${role === 'user' ? 'text-white' : 'text-slate-800'}`}>{parseInline(trimmed.substring(4))}</h3>);
                } else if (trimmed.startsWith('## ')) {
                    blocks.push(<h2 key={`h2-${idx}`} className={`font-bold text-base mb-2 mt-4 ${role === 'user' ? 'text-white' : 'text-slate-800'}`}>{parseInline(trimmed.substring(3))}</h2>);
                } else {
                    blocks.push(<div key={`div-p-${idx}`} className="mb-2 last:mb-0 leading-relaxed min-h-[1.2em]">{parseInline(trimmed)}</div>);
                }
            } else if (idx < lines.length - 1) {
                blocks.push(<div key={`br-${idx}`} className="h-2"></div>);
            }
        }
    });

    if (currentList.length > 0) {
        blocks.push(<ul key={`ul-end`} className="list-disc pl-5 mb-0 space-y-1">{currentList}</ul>);
    }

    // Append Actions if any
    if (role === 'assistant' && extractedActions.length > 0 && onActionClick) {
        blocks.push(
            <div key="actions" className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100 flex-shrink-0">
                {extractedActions.map((action, i) => (
                    <button
                        key={`action-${i}`}
                        onClick={() => onActionClick(action)}
                        className="px-4 py-2 bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-[#9A1523] border border-slate-200 hover:border-rose-200 rounded-xl text-[13px] font-semibold transition-colors shadow-xs flex items-center gap-2 mf-ignore-tracking"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-[#BD1D2D] mf-ignore-tracking" strokeWidth={1.75} />
                        {action}
                    </button>
                ))}
            </div>
        );
    }

    return blocks.length > 0 ? blocks : parseInline(content);
};

interface AIChatWidgetProps {
    propertyId?: string;
    config?: {
        bot_name?: string;
        welcome_msg?: string;
        brand_color?: string;
        bot_avatar?: string;
        quick_actions?: string[];
        widget_position?: 'bottom-right' | 'bottom-left';
        excluded_pages?: string[];
        excluded_paths?: string[];
    };
    initiallyOpen?: boolean;
    onClose?: () => void;
    isTest?: boolean;
}

const AIChatWidget: React.FC<AIChatWidgetProps> = ({
    propertyId,
    config,
    initiallyOpen = false,
    onClose,
    isTest = false
}) => {
    // Check Visibility Logic
    const shouldRender = React.useMemo(() => {
        if (isTest) return true; // Always show in test mode
        if (!config) return true;
        if (typeof window === 'undefined') return true;

        const currentPath = window.location.pathname;
        const currentUrl = window.location.href;

        const pages = config.excluded_pages || [];
        const paths = config.excluded_paths || [];

        // Exact match
        if (pages.some(p => p && p.trim() && (currentPath === p.trim() || currentUrl === p.trim()))) return false;

        // Prefix match
        if (paths.some(p => p && p.trim() && currentPath.startsWith(p.trim()))) return false;

        return true;
    }, [config, isTest]);

    const positionClass = React.useMemo(() => {
        return config?.widget_position === 'bottom-left' ? 'bottom-8 left-8' : 'bottom-8 right-8';
    }, [config?.widget_position]);

    const [isOpen, setIsOpen] = useState(initiallyOpen);
    const [isMaximized, setIsMaximized] = useState(false);
    const [cooldown, setCooldown] = useState(0);

    // Cooldown Timer
    useEffect(() => {
        if (cooldown > 0) {
            const timer = setInterval(() => {
                setCooldown(prev => prev - 1);
            }, 1000);
            return () => clearInterval(timer);
        }
    }, [cooldown]);

    if (!shouldRender) return null;
    const [quickActions, setQuickActions] = useState<string[]>(config?.quick_actions || ['Tư vấn bảng giá', 'Hỗ trợ kỹ thuật']);

    useEffect(() => {
        if (config?.quick_actions) setQuickActions(config.quick_actions);
    }, [config?.quick_actions]);

    const [conversationId, setConversationId] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('mailflow_chat_conv_id');
        }
        return null;
    });

    useEffect(() => {
        if (conversationId) localStorage.setItem('mailflow_chat_conv_id', conversationId);
    }, [conversationId]);

    const [messages, setMessages] = useState<Message[]>([
        {
            id: '1',
            role: 'assistant',
            content: config?.welcome_msg || 'Chào anh/chị! Em là trợ lý ảo của MailFlow Pro. Em có thể giúp gì cho mình ạ?',
            timestamp: Date.now()
        }
    ]);

    // Track messages for async access
    const messagesRef = useRef<Message[]>(messages);
    useEffect(() => { messagesRef.current = messages; }, [messages]);

    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Track input for intelligent debounce (wait if user is typing)
    const inputRef = useRef(input);
    useEffect(() => { inputRef.current = input; }, [input]);

    // Debounce Refs
    const sendBuffer = useRef<string[]>([]);
    const sendTimer = useRef<NodeJS.Timeout | null>(null);
    const cooldownRef = useRef(0);
    useEffect(() => { cooldownRef.current = cooldown; }, [cooldown]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    const executeSend = async () => {
        if (sendBuffer.current.length === 0) return;

        const combinedMsg = sendBuffer.current.join('\n');
        sendBuffer.current = []; // Clear buffer

        const startTime = Date.now();
        try {
            // Build history for Test Mode (Stateless)
            const historyPayload = (!conversationId && messagesRef.current.length > 0)
                ? messagesRef.current.slice(0, -1)
                    .filter(m => m.content && m.content.trim() !== "" && !(m as any).isError) // Filter empty & errors
                    .map(m => ({
                        role: m.role === 'user' ? 'user' : 'model',
                        parts: [{ text: m.content }]
                    }))
                : undefined;

            const res = await api.post<any>('ai_chatbot', {
                message: combinedMsg,
                property_id: propertyId,
                conversation_id: conversationId,
                history: historyPayload,
                is_test: isTest,
                context: {
                    current_url: window.location.href,
                    path: window.location.pathname
                }
            });

            // No artificial delay, show response as soon as it arrives
            if (res.success) {
                const responseData = res as any;
                if (responseData.conversation_id) setConversationId(responseData.conversation_id);

                if (res.data && res.data.quick_actions && res.data.quick_actions.length > 0) {
                    setQuickActions(res.data.quick_actions);
                }

                // FRONTEND PARSING FOR ACTIONS (Robustness)
                // Even if backend sends 'quick_actions', we also check text for [ACTIONS:...] in case backend stops parsing
                // or if we want to handle it entirely on frontend.
                let cleanMsg = res.data.message;
                const actionRegex = /\[(?:ACTIONS|ACTION|BUTTONS|BUTTON|OPTIONS):?(.*?)\]/i;
                const explicitMatch = cleanMsg.match(actionRegex);
                const implicitMatch = cleanMsg.match(/\[([^\[\]]+)\]\s*$/); // Match [Content] at end with opt whitespace

                let rawActions = "";
                let matchedText = "";

                if (explicitMatch) {
                    rawActions = explicitMatch[1];
                    matchedText = explicitMatch[0];
                } else if (implicitMatch) {
                    const content = implicitMatch[1];
                    if (content.includes('|') || content.length < 100) {
                        rawActions = content;
                        matchedText = implicitMatch[0];
                    }
                }

                if (rawActions && matchedText) {
                    const separator = rawActions.includes('|') ? '|' : ',';
                    const parsedActions = rawActions.split(separator).map((s: string) => s.trim()).filter((s: string) => s);

                    if (parsedActions.length > 0) {
                        setQuickActions(parsedActions);
                        cleanMsg = cleanMsg.replace(matchedText, '').trim();
                    }
                }

                const aiMsg: Message = {
                    id: (Date.now() + 1).toString(),
                    role: 'assistant',
                    content: cleanMsg,
                    timestamp: Date.now()
                };
                setMessages(prev => [...prev, aiMsg]);
            } else {
                throw new Error(res.message);
            }
        } catch (e: any) {
            const errorMsg: any = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: 'Xin lỗi, em đang gặp chút gián đoạn kết nối. Mình vui lòng thử lại sau nhé.',
                timestamp: Date.now(),
                isError: true
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            // Only set loading to false if buffer is empty (no new messages queued while waiting)
            if (sendBuffer.current.length === 0) {
                setLoading(false);
            }
        }
    };

    const handleSendMessage = async (text?: string) => {
        if (cooldownRef.current > 0 && !text) return;
        const messageText = text || input;
        if (!messageText.trim()) return;

        setQuickActions([]);
        if (!text) setInput('');

        // Optimistic UI Update
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText.trim(),
            timestamp: Date.now()
        };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        // Start cooldown immediately to prevent double wait
        setCooldown(5);
        cooldownRef.current = 5; // FIX: Update ref immediately to prevent race condition

        // Buffer & Debounce
        sendBuffer.current.push(messageText.trim());

        if (sendTimer.current) clearTimeout(sendTimer.current);
        // FIX: Debounce execution by 600ms to allow batching and prevent double-sends
        sendTimer.current = setTimeout(() => executeSend(), 600);
    };

    // Persistence Key
    const storageKey = `mailflow_chat_store_${propertyId || 'default'}`;

    // Sync Welcome Msg if config changes and we are at initial state
    useEffect(() => {
        if (config?.welcome_msg && messages.length === 1 && messages[0].id === '1') {
            setMessages([
                {
                    ...messages[0],
                    content: config.welcome_msg
                }
            ]);
        }
    }, [config?.welcome_msg]);

    // Load state on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.messages && Array.isArray(parsed.messages)) setMessages(parsed.messages);
                if (typeof parsed.isOpen === 'boolean') setIsOpen(parsed.isOpen);
            }
        } catch (e) {
            console.error("Failed to load chat state", e);
        }
    }, [propertyId]);

    // Save state on change
    useEffect(() => {
        const stateToSave = {
            messages: messages.slice(-50), // Limit history to last 50 messages to save space
            isOpen
        };
        localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    }, [messages, isOpen, propertyId]);

    const handleClose = () => {
        setIsOpen(false);
        if (onClose) onClose();
    };

    // Helper to find navigation link
    const findNavLink = (text: string) => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const matches = text.match(urlRegex);
        if (!matches || matches.length !== 1) return null;

        const url = matches[0].replace(/[.,!?;:)\]]+$/, '');
        // Ignore file downloads (handled by file card)
        if (url.match(/\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)$/i)) return null;
        // Ignore images (handled by image preview)
        if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i)) return null;

        return url;
    };

    const navLink = (msg: Message) => {
        if (msg.role !== 'assistant') return null;
        const url = findNavLink(msg.content);
        if (!url) return null;

        return (
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-between w-full p-3 bg-slate-50 hover:bg-[#0F172A] group/btn border border-slate-200 hover:border-[#0F172A] rounded-xl transition-colors cursor-pointer no-underline"
            >
                <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover/btn:text-white/80 transition-colors">Đường dẫn đề xuất</span>
                    <span className="text-xs font-bold text-slate-700 truncate group-hover/btn:text-white transition-colors">Truy cập liên kết</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs">
                    <ArrowRight className="w-4 h-4 text-[#0F172A]" />
                </div>
            </a>
        );
    };

    if (!isOpen) {
        if (!shouldRender) return null;
        return (
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed ${positionClass} w-14 h-14 bg-[#BD1D2D] hover:bg-[#9A1523] text-white rounded-2xl shadow-xl flex items-center justify-center transition-colors z-[200] group mf-ignore-tracking`}
                style={config?.brand_color ? { backgroundColor: config.brand_color } : {}}
            >
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full mf-ignore-tracking"></div>
                <MessageCircle className="w-6 h-6 mf-ignore-tracking" strokeWidth={1.75} />
            </button>
        );
    }

    return (
        <div id="mf-chat-widget" className={`
            fixed ${positionClass} bg-white/95 !backdrop-blur-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] rounded-2xl border border-slate-200 flex flex-col overflow-hidden z-[200] transition-[width,height,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
            chat-widget-animate mf-ignore-tracking
            ${isMaximized ? 'w-[450px] h-[750px] max-h-[calc(100vh-80px)] max-w-[calc(100vw-32px)]' : 'w-[400px] h-[650px] max-h-[calc(100vh-80px)] max-w-[calc(100vw-32px)]'}
        `} style={{ fontFamily: '"Inter", sans-serif', '--brand-primary': config?.brand_color || '#BD1D2D' } as React.CSSProperties}>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes widget-entrance {
                    0% { transform: scale(0.95) translateY(20px); opacity: 0; transform-origin: bottom right; }
                    100% { transform: scale(1) translateY(0); opacity: 1; }
                }
                @keyframes message-pop {
                    0% { transform: translateY(8px); opacity: 0; }
                    100% { transform: translateY(0); opacity: 1; }
                }
                .chat-widget-animate { animation: widget-entrance 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                .message-animate { animation: message-pop 0.25s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
                
                .chat-scroll::-webkit-scrollbar { width: 5px; }
                .chat-scroll::-webkit-scrollbar-track { background: transparent; }
                .chat-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
                .chat-scroll::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }

                @media (max-width: 480px) {
                    #mf-chat-widget {
                        width: 95vw !important;
                        height: 80vh !important;
                        right: auto !important;
                        bottom: auto !important;
                        left: 50% !important;
                        top: 50% !important;
                        transform: translate(-50%, -50%) !important;
                        border-radius: 1.5rem !important;
                    }
                }
            `}} />

            {/* Header */}
            <div
                className="relative px-6 py-5 flex items-center justify-between overflow-hidden"
                style={{ backgroundColor: config?.brand_color || '#0F172A' }}
            >
                <div className="flex items-center gap-3.5 relative z-10">
                    <div className="relative">
                        <div className="w-11 h-11 bg-white/15 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 overflow-hidden">
                            {config?.bot_avatar ? (
                                <img src={config.bot_avatar} className="w-full h-full object-cover" alt="avatar" />
                            ) : (
                                <Bot className="w-6 h-6 text-white" strokeWidth={1.75} />
                            )}
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-base flex items-center gap-1.5">
                            {config?.bot_name || 'AI Consultant'}
                            <ShieldCheck className="w-4 h-4 text-emerald-300" />
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-white/80 font-semibold uppercase tracking-[0.05em]">Sẵn sàng hỗ trợ 24/7</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 relative z-10">
                    <button
                        onClick={() => setIsMaximized(!isMaximized)}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/15 rounded-xl transition-colors"
                    >
                        {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                    <button
                        onClick={handleClose}
                        className="p-2 text-white/70 hover:text-white hover:bg-white/15 rounded-xl transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto chat-scroll p-6 bg-slate-50/40 space-y-6">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} message-animate`}>
                        <div className={`flex gap-3 max-w-[88%] min-w-0 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-white text-[var(--color-primary)] border border-slate-200'}`}>
                                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                            </div>
                            <div className={`flex flex-col gap-1.5 min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                <div
                                    className={`px-4 py-3 rounded-2xl text-[14px] leading-[1.6] break-words shadow-xs ${msg.role === 'user'
                                        ? 'bg-slate-900 text-white rounded-tr-none'
                                        : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                                        }`}
                                >
                                    {renderContent(msg.content.replace('[SHOW_LEAD_FORM]', ''), msg.role as 'user' | 'assistant', handleSendMessage)}
                                </div>

                                {msg.role === 'assistant' && msg.content.includes('[SHOW_LEAD_FORM]') && (
                                    <div className="mt-2 w-full p-5 bg-white border border-slate-200 rounded-xl shadow-sm border-l-4 border-l-[#BD1D2D]">
                                        <h4 className="text-[13px] font-bold text-slate-800 mb-4 flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-[#BD1D2D]" strokeWidth={1.75} />
                                            Thông tin hỗ trợ tư vấn
                                        </h4>
                                        <div className="space-y-3">
                                            <input
                                                type="email"
                                                id={`email-${msg.id}`}
                                                placeholder="Email của mình..."
                                                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-colors bg-slate-50/50"
                                            />
                                            <input
                                                type="tel"
                                                id={`phone-${msg.id}`}
                                                placeholder="Số điện thoại..."
                                                className="w-full px-4 py-3 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] transition-colors bg-slate-50/50 mf-ignore-tracking"
                                            />
                                            <button
                                                onClick={() => {
                                                    const email = (document.getElementById(`email-${msg.id}`) as HTMLInputElement)?.value;
                                                    const phone = (document.getElementById(`phone-${msg.id}`) as HTMLInputElement)?.value;
                                                    if (!email && !phone) return;
                                                    handleSendMessage(`Đây là thông tin của tôi: Email: ${email || 'N/A'}, SĐT: ${phone || 'N/A'}`);

                                                    // Sync with Web Tracker
                                                    if (typeof window !== 'undefined' && (window as any)._mfIdentify) {
                                                        (window as any)._mfIdentify(email || null, phone || null);
                                                    }

                                                    const formContainer = (document.getElementById(`email-${msg.id}`)?.closest('.border-l-4'));
                                                    if (formContainer) formContainer.innerHTML = '<div class="py-2 text-[13px] text-emerald-600 font-semibold flex items-center gap-2 mf-ignore-tracking"><div class="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mf-ignore-tracking"><svg class="w-4 h-4 mf-ignore-tracking" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg></div> Đã gửi thông tin thành công</div>';
                                                }}
                                                className="w-full py-3 bg-[var(--color-primary)] hover:bg-[#9A1523] text-white text-[13px] font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 mf-ignore-tracking"
                                            >
                                                Gửi thông tin tư vấn
                                                <ArrowRight className="w-4 h-4 mf-ignore-tracking" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {navLink(msg)}

                                <span className="text-[10px] text-slate-400 mt-1 px-2 font-medium tracking-wide tabular-nums">
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="flex justify-start">
                        <div className="flex gap-3 max-w-[85%]">
                            <div className={`w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center shrink-0`} style={config?.brand_color ? { color: config.brand_color } : { color: '#94a3b8' }}>
                                <Bot className="w-5 h-5" />
                            </div>
                            <div className="bg-white border border-slate-200 px-5 py-3.5 rounded-2xl rounded-tl-none flex gap-2 items-center h-12 shadow-xs">
                                <span className="w-2 h-2 rounded-full animate-pulse [animation-delay:-0.3s]" style={{ backgroundColor: config?.brand_color || '#94a3b8' }}></span>
                                <span className="w-2 h-2 rounded-full animate-pulse [animation-delay:-0.15s]" style={{ backgroundColor: config?.brand_color || '#94a3b8' }}></span>
                                <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: config?.brand_color || '#94a3b8' }}></span>
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Fast Actions */}
            {quickActions.length > 0 && (
                <div className="px-6 py-3 overflow-x-auto whitespace-nowrap hide-scrollbar flex gap-2 bg-white border-t border-slate-100">
                    <style dangerouslySetInnerHTML={{ __html: '.hide-scrollbar::-webkit-scrollbar { display: none; } .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }' }} />
                    {quickActions.map((qa, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                setQuickActions([]);
                                handleSendMessage(qa);
                            }}
                            className="px-4 py-2 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 hover:text-[#9A1523] rounded-full text-[12px] font-semibold text-slate-600 transition-colors flex items-center gap-2 message-animate mf-ignore-tracking"
                            style={{ animationDelay: `${idx * 0.05}s` }}
                        >
                            <Sparkles className="w-3.5 h-3.5 text-[#BD1D2D] mf-ignore-tracking" strokeWidth={1.75} /> {qa}
                        </button>
                    ))}
                </div>
            )}

            {/* Input */}
            <div className="p-5 pt-2 bg-white border-t border-slate-100">
                <div className="relative flex items-center">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && cooldown <= 0) {
                                handleSendMessage();
                            }
                        }}
                        disabled={cooldown > 0}
                        placeholder={cooldown > 0 ? `Vui lòng đợi ${cooldown}s...` : "Nhập câu hỏi của mình..."}
                        className="w-full pl-5 pr-16 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[14px] focus:bg-white focus:ring-2 focus:ring-[var(--color-primary)]/10 focus:border-[var(--color-primary)] outline-none transition-colors placeholder:text-slate-400 disabled:opacity-70 disabled:cursor-not-allowed mf-ignore-tracking"
                    />
                    <button
                        onClick={() => handleSendMessage()}
                        disabled={!input.trim() || cooldown > 0}
                        className="absolute right-2 w-10 h-10 bg-[var(--color-primary)] text-white rounded-xl flex items-center justify-center hover:brightness-95 disabled:opacity-50 transition-colors mf-ignore-tracking"
                        style={config?.brand_color ? { backgroundColor: config.brand_color } : {}}
                    >
                        {cooldown > 0 ? (
                            <span className="text-[10px] font-bold tabular-nums">{cooldown}s</span>
                        ) : (
                            <Send className="w-4 h-4 fill-current mf-ignore-tracking" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIChatWidget;
