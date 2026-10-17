import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
    Download,
    MessageSquare, User, Bot, Send, Clock, Globe,
    MousePointer2, Layout, FormInput, Copy, ExternalLink,
    ChevronDown, ChevronRight, Sparkles, UserCheck, ShieldCheck, ShieldAlert, RotateCw, Zap,
    FileText, Maximize2, Search, ChevronLeft, X
} from 'lucide-react';
import Modal from '../../common/Modal';
import ConfirmModal from '../../common/ConfirmModal';
import { ZaloUserProfileModal } from '../../zalo/ZaloUserProfileModal';
import { MetaCustomerProfileModal } from '../../meta/MetaCustomerProfileModal';
import { api } from '../../../services/storageAdapter';
import { toast } from 'react-hot-toast';
import { API_BASE_URL } from '../../../utils/config';

const openCrmContact360 = (arg1: any, arg2?: any) => {
    if (arg1 && typeof arg1.stopPropagation === 'function') arg1.stopPropagation();
    if (arg2 && typeof arg2.stopPropagation === 'function') arg2.stopPropagation();
    const rawId = (arg1 && typeof arg1.stopPropagation === 'function') ? arg2 : arg1;
    const id = Number(rawId);
    if (!id || Number.isNaN(id)) return;
    window.dispatchEvent(new CustomEvent('open-customer-drawer', { detail: { id, initialTab: 'journey360' } }));
};

// Local helper for date formatting
const formatDate = (dateStr: string, mode: 'time' | 'datetime' = 'datetime') => {
    if (!dateStr) return '';
    try {
        const d = new Date(dateStr);
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        if (mode === 'time') return `${hours}:${mins}`;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        return `${hours}:${mins} (${day}/${month})`;
    } catch (e) { return dateStr; }
};

const renderContent = (content: string, role: string, onActionClick?: (action: string) => void) => {
    if (!content) return null;

    // 0. Extract [ACTIONS:...] tags
    let extractedActions: string[] = [];
    const actionRegex = /\[?(?:ACTIONS|ACTION|BUTTONS|BUTTON|OPTIONS):?(.*?)\]?/gi;

    // Process explicit tags
    content = content.replace(actionRegex, (match, rawActions) => {
        if (!rawActions) return '';
        const separator = rawActions.includes('|') ? '|' : ',';
        const parsed = rawActions.split(separator).map((s: string) => s.trim()).filter((s: string) => s);
        extractedActions = [...extractedActions, ...parsed];
        return '';
    });

    // Strip [SHOW_LEAD_FORM] and other internal tags
    content = content.replace(/\[SHOW_LEAD_FORM\]/g, '');
    content = content.trim();

    if (!content && extractedActions.length === 0) return null;

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

            // Normalize URL: remove common trailing punctuation
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

            // Check for image extensions
            const imgExtMatch = url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i);
            const fileExtMatch = url.match(/\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)$/i);

            if (isMarkdownImage || imgExtMatch) {
                // RENDER AS IMAGE
                parts.push(
                    <div key={match.index} className="mt-2 mb-2">
                        <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-[14px] border border-slate-100 shadow-sm transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-[var(--color-primary)]/5 group/img"
                        >
                            <img
                                src={url}
                                alt={label || "Shared image"}
                                className="w-full max-h-[300px] object-cover transition-transform duration-500 group-hover/img:scale-105"
                                onError={(e) => {
                                    // Fallback if image fails to load
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                            />
                        </a>
                    </div>
                );
            } else if (fileExtMatch) {
                // RENDER AS FILE CARD
                const ext = fileExtMatch[1].toLowerCase();
                const fileName = label || url.split('/').pop() || 'Tài liệu'


                parts.push(
                    <a
                        key={match.index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block group mt-2 mb-2 no-underline"
                    >
                        <div className="flex items-center gap-3 p-3 bg-slate-50 border-2 border-slate-200 rounded-xl transition-all group-hover:border-[var(--color-primary)] group-hover:bg-white group-hover:shadow-lg group-hover:shadow-[var(--color-primary)]/10">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${ext === 'pdf' ? 'bg-rose-100 text-rose-500' :
                                ext.includes('doc') ? 'bg-blue-100 text-blue-500' :
                                    ext.includes('xls') ? 'bg-amber-100 text-[var(--color-primary)]' :
                                        'bg-slate-200 text-slate-600'
                                }`}>
                                <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h5 className="text-[13px] font-bold text-slate-700 truncate group-hover:text-[var(--color-primary)] transition-colors">{fileName}</h5>
                                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{ext.toUpperCase()} FILE • Bấm để tải</p>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center group-hover:bg-[var(--color-primary)] group-hover:text-white transition-all">
                                <Maximize2 className="w-4 h-4 rotate-45" />
                            </div>
                        </div>
                    </a>
                );
            } else {
                // NORMAL LINK
                parts.push(
                    <a
                        key={match.index}
                        href={url}
                        target={url.startsWith('http') ? "_blank" : undefined}
                        rel={url.startsWith('http') ? "noopener noreferrer" : undefined}
                        className={`font-medium transition-all duration-200 decoration-1 underline-offset-4 hover:underline break-all ${role === 'user' ? 'text-slate-100 hover:text-white underline' : 'text-blue-600 hover:text-blue-700'}`}
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

    // 2. Helper: Parse Bold (**text**)
    const parseBold = (nodes: (string | React.ReactNode)[]): React.ReactNode[] => {
        return nodes.flatMap((node, i) => {
            if (typeof node !== 'string') return node;

            const boldParts = node.split(/(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*]+\*)/g);
            return boldParts.map((part, j) => {
                if (part.startsWith('***') && part.endsWith('***')) {
                    return <strong key={`${i}-${j}`} className={`font-black italic ${role === 'user' ? 'text-white' : 'text-slate-900'}`}>{part.slice(3, -3)}</strong>;
                }
                if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={`${i}-${j}`} className={`font-black ${role === 'user' ? 'text-white' : 'text-slate-900'}`}>{part.slice(2, -2)}</strong>;
                }
                if (part.startsWith('*') && part.endsWith('*')) {
                    return <em key={`${i}-${j}`} className={`italic ${role === 'user' ? 'text-white' : 'text-slate-900'}`}>{part.slice(1, -1)}</em>;
                }
                return part;
            });
        });
    };

    const parseInline = (text: string) => {
        return parseBold(parseLinks(text));
    };

    // 3. Block Parsing
    const lines = content.split('\n');
    const blocks: React.ReactNode[] = [];
    let currentList: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.match(/^\d+\.\s/)) {
            // List Item
            const clean = trimmed.replace(/^(\* |-| \d+\.\s)\s?/, '');
            currentList.push(
                <li key={`li-${idx}`} className="leading-relaxed pl-1">
                    {parseInline(clean)}
                </li>
            );
        } else {
            // Flush List
            if (currentList.length > 0) {
                blocks.push(<ul key={`ul-${idx}`} className="list-disc pl-5 mb-3 space-y-1">{currentList}</ul>);
                currentList = [];
            }

            if (trimmed) {
                if (trimmed.startsWith('### ')) {
                    blocks.push(<h3 key={`h-${idx}`} className={`font-bold text-sm mb-2 mt-3 ${role === 'user' ? 'text-white' : 'text-slate-800'}`}>{parseInline(trimmed.substring(4))}</h3>);
                } else {
                    blocks.push(<p key={`p-${idx}`} className="mb-2 last:mb-0 leading-relaxed min-h-[1.2em]">{parseInline(trimmed)}</p>);
                }
            }
        }
    });

    if (currentList.length > 0) {
        blocks.push(<ul key={`ul-end`} className="list-disc pl-5 mb-0 space-y-1">{currentList}</ul>);
    }

    // Append Actions if any
    if (extractedActions.length > 0) {
        blocks.push(
            <div key="actions" className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-200/50">
                {extractedActions.map((action, i) => (
                    <button
                        key={`action-${i}`}
                        onClick={() => onActionClick?.(action)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95 ${onActionClick
                            ? 'bg-amber-100 text-[#9A1523] border border-amber-200 hover:bg-amber-200 hover:scale-105'
                            : 'bg-slate-50 text-slate-400 border border-slate-100 cursor-default grayscale'}`}
                    >
                        <Sparkles className={`w-3.5 h-3.5 ${onActionClick ? 'text-[var(--color-primary)]' : 'text-slate-300'}`} />
                        {action}
                    </button>
                ))}
            </div>
        );
    }

    return blocks.length > 0 ? blocks : parseInline(content);
};

interface Conversation {
    id: string;
    visitor_id: string;
    subscriber_id?: string;
    contact_id?: number | null;
    owner_id?: number | null;
    salesperson?: string | null;
    phone?: string;
    phone_number?: string;
    tags?: string[] | string;
    property_id: string;
    status: 'ai' | 'human' | 'closed';
    first_name?: string;
    last_name?: string;
    avatar?: string;
    lead_score?: number;
    email?: string;
    visit_count: number;
    last_message?: string;
    last_message_at?: string;
    ip_address?: string;
    zalo_name?: string;
    is_blocked?: number | boolean;
}

interface Message {
    id: number;
    sender: 'visitor' | 'ai' | 'human';
    message: string;
    created_at: string;
}

interface JourneyEvent {
    type: string;
    title: string;
    url?: string;
    time: string;
    details?: string;
    page_title?: string;
    page_url?: string;
}

export default function ConversationsTab({ propertyId, initialConversationId }: { propertyId: string, initialConversationId?: string | null }) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(false);
    const [msgLoading, setMsgLoading] = useState(false);
    const [reply, setReply] = useState('');
    const [journey, setJourney] = useState<JourneyEvent[]>([]);

    const [showCrmModal, setShowCrmModal] = useState(false);
    const [showZaloProfileModal, setShowZaloProfileModal] = useState(false);
    const [selectedZaloSubId, setSelectedZaloSubId] = useState<string | null>(null);
    const [showMetaProfileModal, setShowMetaProfileModal] = useState(false);
    const [selectedMetaSubId, setSelectedMetaSubId] = useState<string | null>(null);
    const [showBlockIPModal, setShowBlockIPModal] = useState(false);
    const [ipToBlock, setIpToBlock] = useState<{ ip: string; visitorName: string } | null>(null);
    const [blockReason, setBlockReason] = useState('');
    const [isBlocking, setIsBlocking] = useState(false);
    const [journeyFilter, setJourneyFilter] = useState<'all' | 'view' | 'click' | 'other'>('all');

    // CRM Modal State
    const [crmSubscriber, setCrmSubscriber] = useState<any>(null);
    const [crmLoading, setCrmLoading] = useState(false);

    // Search & Pagination
    const [showFilters, setShowFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [ipSearch, setIpSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [appliedFilters, setAppliedFilters] = useState({ search: '', ip: '', start: '', end: '' });
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [source, setSource] = useState<'all' | 'web' | 'zalo' | 'meta'>('web');
    const [exportSource, setExportSource] = useState<'all' | 'web' | 'zalo' | 'meta'>('all');
    const scrollRef = useRef<HTMLDivElement>(null);
    const isAtBottom = useRef(true);

    // Export Modal State
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportRange, setExportRange] = useState<'current' | 'custom'>('current');
    const [customExportStart, setCustomExportStart] = useState('');
    const [customExportEnd, setCustomExportEnd] = useState('');

    // CRM Global Data for Modal
    const [allLists, setAllLists] = useState<any[]>([]);
    const [allSegments, setAllSegments] = useState<any[]>([]);
    const [allFlows, setAllFlows] = useState<any[]>([]);
    const [allTags, setAllTags] = useState<any[]>([]);

    useEffect(() => {
        fetchCrmGlobalData();
    }, []);

    const fetchCrmGlobalData = async () => {
        try {
            const [listsRes, segmentsRes, flowsRes, tagsRes] = await Promise.all([
                api.get<any[]>('lists'),
                api.get<any[]>('segments'),
                api.get<any[]>('flows'),
                api.get<any[]>('tags')
            ]);
            if (listsRes.success) setAllLists((listsRes as any).data || []);
            if (segmentsRes.success) setAllSegments((segmentsRes as any).data || []);
            if (flowsRes.success) setAllFlows((flowsRes as any).data || []);
            if (tagsRes.success) setAllTags((tagsRes as any).data || []);
        } catch (e) {
            console.error('Error fetching CRM global data:', e);
        }
    };

    useEffect(() => {
        if (initialConversationId) {
            setSearchQuery(initialConversationId);
            setAppliedFilters(prev => ({ ...prev, search: initialConversationId }));
        }
    }, [initialConversationId]);

    // [FIX] Split into 2 effects:
    // Effect 1: When SOURCE tab changes – always reset to page 1 and clear selected conv
    useEffect(() => {
        if (propertyId) {
            setPage(1);
            setSelectedConv(null);
            fetchConversations(1);
        }
    }, [source]);

    // Effect 2: When propertyId or filters change – also reset to page 1
    useEffect(() => {
        if (propertyId) {
            setPage(1);
            fetchConversations(1);
        }
    }, [propertyId, appliedFilters]);

    useEffect(() => {
        if (selectedConv) {
            fetchMessages(selectedConv.id);
            fetchVisitorJourney(selectedConv.visitor_id);
            const interval = setInterval(() => {
                // Only poll if conversation is NOT closed and window is focused (optional but good)
                if (selectedConv.status !== 'closed') {
                    fetchMessages(selectedConv.id, true);
                }
            }, 10000); // 10s interval for better scalability
            return () => clearInterval(interval);
        }
    }, [selectedConv]);

    useEffect(() => {
        if (scrollRef.current && isAtBottom.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleScroll = () => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            isAtBottom.current = scrollHeight - scrollTop - clientHeight < 50;
        }
    };

    const handleApplyFilters = () => {
        setAppliedFilters({
            search: searchQuery,
            ip: ipSearch,
            start: startDate,
            end: endDate
        });
        setPage(1);
    };

    const fetchConversations = async (p = 1) => {
        setLoading(true);
        try {
            let url = `ai_chatbot?action=list_conversations&property_id=${propertyId}&page=${p}&limit=20&search=${encodeURIComponent(appliedFilters.search)}&source=${source}`;
            if (appliedFilters.ip) url += `&ip=${encodeURIComponent(appliedFilters.ip)}`;
            if (appliedFilters.start) url += `&from_date=${appliedFilters.start}`;
            if (appliedFilters.end) url += `&to_date=${appliedFilters.end}`;

            const res = await api.get<any>(url);
            if (res.success) {
                setConversations(res.data);
                if ((res as any).pagination) setTotalPages((res as any).pagination.total_pages);
                setPage(p);
                // Auto Select First only if init and search cleared
                if (p === 1 && !appliedFilters.search && !appliedFilters.ip && !appliedFilters.start && !appliedFilters.end && res.data.length > 0 && !selectedConv) setSelectedConv(res.data[0]);
            }
        } catch (e) { toast.error('Lỗi tải danh sách hội thoại'); }
        finally { setLoading(false); }
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
            fetchConversations(newPage);
        }
    };

    const fetchMessages = async (convId: string, silent = false) => {
        if (!silent) setMsgLoading(true);
        try {
            const res = await api.get<any>(`ai_chatbot?action=get_messages&conversation_id=${convId}`);
            if (res.success) setMessages(res.data);
        } catch (e) { console.error(e); }
        finally { setMsgLoading(false); }
    };

    const fetchVisitorJourney = async (visitorId: string) => {
        try {
            const res = await api.get<any>(`web_tracking?action=visitor_journey&visitor_id=${visitorId}`);
            if (res.success) setJourney(res.data);
        } catch (e) { console.error(e); }
    };

    const handleSendReply = async () => {
        if (!reply.trim() || !selectedConv) return;
        try {
            const res = await api.post<any>(`ai_chatbot?action=send_human_reply`, {
                conversation_id: selectedConv.id,
                message: reply
            });
            if (res.success) {
                setReply('');
                fetchMessages(selectedConv.id);
                // Also update status to human in local list
                setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, status: 'human' } : c));
                if (selectedConv) setSelectedConv({ ...selectedConv, status: 'human' });
            }
        } catch (e) { toast.error('Lỗi gửi tin nhắn'); }
    };

    const toggleStatus = async (status: 'ai' | 'human' | 'closed') => {
        if (!selectedConv) return;
        try {
            const res = await api.post<any>(`ai_chatbot?action=update_status`, {
                conversation_id: selectedConv.id,
                status: status
            });
            if (res.success) {
                toast.success('Đã cập nhật trạng thái');
                setSelectedConv({ ...selectedConv, status });
                setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, status } : c));
            }
        } catch (e) { toast.error('Lỗi cập nhật'); }
    };

    const handleBlockIP = async () => {
        if (!ipToBlock) return;
        setIsBlocking(true);
        try {
            const res = await api.post('web_blacklist?action=add', {
                ip: ipToBlock.ip,
                reason: blockReason
            });
            if (res.success) {
                toast.success('Đã chặn IP thành công');
                setShowBlockIPModal(false);
                setBlockReason('');
                // Update local state to reflect the block immediately
                setConversations(prev => prev.map(c => c.ip_address === ipToBlock.ip ? { ...c, is_blocked: 1 } : c));
                if (selectedConv && selectedConv.ip_address === ipToBlock.ip) {
                    setSelectedConv({ ...selectedConv, is_blocked: 1 });
                }
            } else {
                toast.error(res.message || 'Lỗi khi chặn IP');
            }
        } catch (e) { toast.error('Lỗi hệ thống'); }
        finally { setIsBlocking(false); }
    };

    const handleOpenProfile = async () => {
        if (!selectedConv) return;

        if (selectedConv.visitor_id.startsWith('zalo_')) {
            const zaloSubId = selectedConv.visitor_id.replace('zalo_', '');
            setSelectedZaloSubId(zaloSubId);
            setShowZaloProfileModal(true);
        } else if (selectedConv.visitor_id.startsWith('meta_')) {
            const metaSubId = selectedConv.visitor_id.replace('meta_', '');
            setSelectedMetaSubId(metaSubId);
            setShowMetaProfileModal(true);
        } else {
            // It's a web visitor
            let sub: any = null;
            setCrmLoading(true);
            try {
                // Priority 1: Fetch by subscriber_id if we have it
                if (selectedConv.subscriber_id) {
                    const res = await api.get(`subscribers/${selectedConv.subscriber_id}`);
                    if (res.success) {
                        sub = res.data;
                    }
                }

                // Priority 2: Fetch by visitor_id (Linked on backend but maybe not updated locally)
                if (!sub && selectedConv.visitor_id) {
                    const res = await api.get(`subscribers?visitor_id=${selectedConv.visitor_id}`);
                    if (res.success) {
                        sub = res.data;
                        const subId = (res.data as any).id;
                        if (subId && !selectedConv.subscriber_id) {
                            setSelectedConv(prev => prev ? { ...prev, subscriber_id: subId } : null);
                            setConversations(prev => prev.map(c => c.visitor_id === selectedConv.visitor_id ? { ...c, subscriber_id: subId } : c));
                        }
                    }
                }

                // Priority 3: Fetch by email if we have it
                if (!sub && selectedConv.email) {
                    const res = await api.get(`subscribers?email=${encodeURIComponent(selectedConv.email)}`);
                    if (res.success) {
                        sub = res.data;
                        const subId = (res.data as any).id;
                        if (subId && !selectedConv.subscriber_id) {
                            setSelectedConv(prev => prev ? { ...prev, subscriber_id: subId } : null);
                            setConversations(prev => prev.map(c => c.visitor_id === selectedConv.visitor_id ? { ...c, subscriber_id: subId } : c));
                        }
                    }
                }
            } catch (e) {
                console.error('Error fetching CRM profile:', e);
            } finally {
                setCrmLoading(false);
            }

            const targetObj = sub || selectedConv;
            const contactId = (selectedConv as any).contact_id || sub?.contact_id || sub?.myerp_contact_id;
            if (contactId) {
                window.dispatchEvent(new CustomEvent('open-customer-drawer', { detail: { id: Number(contactId), initialTab: 'journey360' } }));
            } else {
                const phone = sub?.phone || (selectedConv as any).phone;
                const email = sub?.email || selectedConv.email;
                window.dispatchEvent(new CustomEvent('open-customer-drawer', { detail: { phone, email, contact: targetObj, initialTab: 'journey360' } }));
            }
        }
    };

    const checkSegmentMatch = (sub: any, criteriaJson: string) => {
        try {
            if (!criteriaJson) return false;
            const criteria = JSON.parse(criteriaJson);
            if (!criteria || !Array.isArray(criteria.conditions)) return false;

            const { conditions, operator } = criteria;

            const checkCondition = (cond: any) => {
                if (cond.field === 'last_activity') {
                    const lastDateStr = sub.lastActivityAt || sub.joinedAt;
                    if (!lastDateStr) return false;
                    const date = new Date(lastDateStr);
                    const diffDays = (Date.now() - date.getTime()) / (1000 * 3600 * 24);
                    const val = parseInt(cond.value);
                    if (cond.operator === '>') return diffDays > val;
                    if (cond.operator === '<') return diffDays < val;
                    return false;
                }
                if (cond.field === 'tags') {
                    const tags = sub.tags || [];
                    if (cond.operator === 'contains') return tags.includes(cond.value);
                    if (cond.operator === 'not_contains') return !tags.includes(cond.value);
                }
                if (cond.field === 'list_id') {
                    const listIds = sub.listIds || [];
                    if (cond.operator === 'contains' || cond.operator === 'in' || cond.operator === '=') return listIds.includes(cond.value);
                    if (cond.operator === 'not_contains' || cond.operator === 'not_in' || cond.operator === '!=') return !listIds.includes(cond.value);
                }
                if (cond.field.startsWith('info.')) {
                    const key = cond.field.split('.')[1];
                    const val = (sub as any)[key] || '';
                    if (cond.operator === '=') return val == cond.value;
                    if (cond.operator === '!=') return val != cond.value;
                    if (cond.operator === 'contains') return val.toString().toLowerCase().includes(cond.value.toLowerCase());
                }
                return false;
            };

            if (operator === 'OR') return conditions.some(checkCondition);
            return conditions.every(checkCondition);
        } catch (e) { return false; }
    };

    const handleUpdateSubscriber = async (updated: any) => {
        try {
            const res = await api.put(`subscribers/${updated.id}`, updated);
            if (res.success) {
                toast.success('Đã cập nhật liên hệ');
                setCrmSubscriber(res.data);
                // Also update local conversations if firstName or email changed
                setConversations(prev => prev.map(c => (c.subscriber_id === updated.id || c.visitor_id === updated.visitor_id) ? {
                    ...c,
                    first_name: updated.firstName,
                    last_name: updated.lastName,
                    email: updated.email,
                    avatar: updated.avatar
                } : c));
                if (selectedConv && (selectedConv.subscriber_id === updated.id || selectedConv.visitor_id === updated.visitor_id)) {
                    setSelectedConv({
                        ...selectedConv,
                        first_name: updated.firstName,
                        last_name: updated.lastName,
                        email: updated.email,
                        avatar: updated.avatar
                    });
                }
            }
        } catch (e) { toast.error('Lỗi khi cập nhật'); }
    };

    const [pendingDeleteSubId, setPendingDeleteSubId] = useState<string | null>(null);

    const handleDeleteSubscriber = (id: string) => {
        setPendingDeleteSubId(id);
    };

    const executeDeleteSubscriber = async () => {
        if (!pendingDeleteSubId) return;
        try {
            const res = await api.delete(`subscribers/${pendingDeleteSubId}`);
            if (res.success) {
                toast.success('Đã xóa liên hệ');
                setShowCrmModal(false);
                setCrmSubscriber(null);
                // Update local list
                setConversations(prev => prev.map(c => c.subscriber_id === pendingDeleteSubId ? { ...c, subscriber_id: undefined } : c));
                if (selectedConv?.subscriber_id === pendingDeleteSubId) setSelectedConv({ ...selectedConv, subscriber_id: undefined });
            }
        } catch (e) { toast.error('Lỗi khi xóa'); }
        finally { setPendingDeleteSubId(null); }
    };

    const handleExport = () => {
        setCustomExportStart(startDate);
        setCustomExportEnd(endDate);
        setExportSource(source === 'all' ? 'all' : source);
        setShowExportModal(true);
    };

    const confirmExport = () => {
        
        let start = exportRange === 'current' ? startDate : customExportStart;
        let end = exportRange === 'current' ? endDate : customExportEnd;

        let url = `${API_BASE_URL}/ai_chatbot.php?action=export_conversations&property_id=${propertyId}&search=${encodeURIComponent(searchQuery)}&source=${exportSource}`;
        if (ipSearch) url += `&ip=${encodeURIComponent(ipSearch)}`;
        if (start) url += `&from_date=${start}`;
        if (end) url += `&to_date=${end}`;
        window.open(url, '_blank');
        setShowExportModal(false);
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[800px] max-w-[1400px] mx-auto bg-slate-50/30 p-4 rounded-[18px] border border-slate-100 shadow-inner overflow-hidden">
            {/* Left: Conversations List */}
            <div className="w-full lg:w-80 flex flex-col gap-4 bg-white rounded-[18px] border border-slate-100 shadow-sm overflow-hidden flex-shrink-0">
                <div className="p-5 border-b border-slate-50">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-extrabold text-slate-800 tracking-tight">Conversations</h3>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExport}
                                className="p-2 bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                title="Xuất CSV"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`p-2 rounded-xl transition-all ${showFilters ? 'bg-slate-100 text-slate-800 shadow-inner' : 'bg-slate-50 text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                            >
                                <Search className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Sub-tabs */}
                    <div className="bg-slate-50 p-1 rounded-[14px] flex flex-wrap gap-1 border border-slate-100 mb-4">

                        <button
                            onClick={() => { setSource('web'); setPage(1); }}
                            className={`flex-1 min-w-[60px] flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all ${source === 'web'
                                ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <Globe className={`w-3 h-3 ${source === 'web' ? 'text-blue-500' : 'text-slate-300'}`} />
                            <span>Web</span>
                        </button>
                        <button
                            onClick={() => { setSource('meta'); setPage(1); }}
                            className={`flex-1 min-w-[60px] flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all ${source === 'meta'
                                ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <Layout className={`w-3 h-3 ${source === 'meta' ? 'text-slate-800' : 'text-slate-300'}`} />
                            <span>Meta</span>
                        </button>
                        <button
                            onClick={() => { setSource('zalo'); setPage(1); }}
                            className={`flex-1 min-w-[60px] flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-tight transition-all ${source === 'zalo'
                                ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            <MessageSquare className={`w-3 h-3 ${source === 'zalo' ? 'text-blue-600' : 'text-slate-300'}`} />
                            <span>Zalo</span>
                        </button>
                    </div>          {showFilters && (
                        <div className="space-y-4 pt-2 animate-in slide-in-from-top-2 duration-300">
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Tìm tên, email, nội dung..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                                        className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                                <div className="relative">
                                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Lọc theo IP address..."
                                        value={ipSearch}
                                        onChange={(e) => setIpSearch(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
                                        className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 space-y-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-1">Từ ngày</p>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => setStartDate(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                        />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter pl-1">Đến ngày</p>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => setEndDate(e.target.value)}
                                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                        />
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={handleApplyFilters}
                                disabled={loading}
                                className="w-full bg-slate-800 text-white py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                            >
                                {loading ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                Áp dụng bộ lọc
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="space-y-0.5 p-1">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="py-2.5 px-3.5 border-b border-slate-50">
                                    <div className="flex justify-between items-start mb-2">
                                        <div style={{ width: '55%', height: 11, borderRadius: 5, background: '#e2e8f0', position: 'relative', overflow: 'hidden' }}><div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)', animation: 'sk-shimmer 1.4s ease-in-out infinite', transform: 'translateX(-100%)' }} /></div>
                                        <div style={{ width: 36, height: 10, borderRadius: 4, background: '#e2e8f0', position: 'relative', overflow: 'hidden' }}><div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)', animation: 'sk-shimmer 1.4s ease-in-out infinite', transform: 'translateX(-100%)' }} /></div>
                                    </div>
                                    <div style={{ width: '75%', height: 10, borderRadius: 4, background: '#e2e8f0', position: 'relative', overflow: 'hidden' }}><div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)', animation: 'sk-shimmer 1.4s ease-in-out infinite', transform: 'translateX(-100%)' }} /></div>
                                </div>
                            ))}
                        </div>
                    ) : conversations.length === 0 ? (
                        <div className="p-10 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">Không tìm thấy hội thoại</div>
                    ) : (
                        conversations.map((c) => (
                            <div
                                key={c.id}
                                onClick={() => setSelectedConv(c)}
                                className={`py-2.5 px-3.5 border-b border-slate-50 cursor-pointer transition-all hover:bg-slate-50 ${c.is_blocked ? 'bg-rose-50' : (selectedConv?.id === c.id ? 'bg-amber-50/50 !border-amber-100 border-l-4 border-l-amber-600' : '')}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-[11px] font-black text-slate-700 truncate max-w-[110px]">
                                            {c.first_name || (c.zalo_name && c.zalo_name !== 'Zalo User' ? c.zalo_name : null) || c.email || (c.visitor_id.startsWith('zalo_') ? `Zalo: ${c.visitor_id.substring(5, 13)}...` : 'Khách #' + (c.visitor_id ? c.visitor_id.substring(0, 6) : '???'))}
                                        </span>
                                        {c.visitor_id.startsWith('zalo_') ? (
                                            <div className="bg-slate-100 text-slate-500 p-0.5 rounded shadow-sm scale-90">
                                                <MessageSquare className="w-2.5 h-2.5" />
                                            </div>
                                        ) : (
                                            <div className="bg-slate-100 text-slate-500 p-0.5 rounded shadow-sm scale-90">
                                                <Globe className="w-2.5 h-2.5" />
                                            </div>
                                        )}
                                        {c.is_blocked ? <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> : null}
                                    </div>
                                    <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">
                                        {c.last_message_at ? formatDate(c.last_message_at, 'time') : ''}
                                    </span>
                                </div>
                                <p className="text-[10px] text-slate-500 truncate mb-1.5">{c.last_message || 'Chưa có tin nhắn'}</p>
                                <div className="flex items-center gap-2">

                                    {c.visitor_id.startsWith('zalo_') && (
                                        <span className="px-2 py-1 rounded-lg text-[8px] font-black uppercase tracking-tight bg-slate-800 text-white flex items-center gap-1 shadow-sm">
                                            <Bot className="w-3 h-3 text-white" /> AI AUTOMATION
                                        </span>
                                    )}
                                    {(c.subscriber_id || c.visitor_id.startsWith('zalo_')) && <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] shadow-sm"></div>}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                {
                    totalPages > 1 && (
                        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-white">
                            <button onClick={() => handlePageChange(page - 1)} disabled={page === 1} className="p-1.5 hover:bg-slate-50 rounded-lg disabled:opacity-30 text-slate-500 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Trang {page}/{totalPages}</span>
                            <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages} className="p-1.5 hover:bg-slate-50 rounded-lg disabled:opacity-30 text-slate-500 transition-colors"><ChevronRight className="w-4 h-4" /></button>
                        </div>
                    )
                }
            </div>

            {/* Chat */}
            <div className="flex-1 flex flex-col bg-white">
                {
                    selectedConv ? (
                        <>
                            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                <div className="flex items-center gap-3 group/header">
                                    <div
                                        className="w-10 h-10 rounded-[14px] bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-sm cursor-pointer hover:border-[#9A1523] hover:scale-105 transition-all overflow-hidden"
                                        onClick={handleOpenProfile}
                                        title="Xem hồ sơ"
                                    >
                                        {selectedConv.avatar ? (
                                            <img src={selectedConv.avatar} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <User className="w-5 h-5" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                                                {selectedConv.first_name ? `${selectedConv.first_name} ${selectedConv.last_name || ''}` : (selectedConv.zalo_name && selectedConv.zalo_name !== 'Zalo User' ? selectedConv.zalo_name : null) || selectedConv.email || (selectedConv.visitor_id.startsWith('zalo_') ? `Zalo User (${selectedConv.visitor_id.replace('zalo_', '')})` : (selectedConv.visitor_id.startsWith('meta_') ? `Messenger (${selectedConv.visitor_id.replace('meta_', '')})` : 'Visitor'))}
                                            </h4>
                                            {(selectedConv.subscriber_id || selectedConv.visitor_id.startsWith('zalo_') || selectedConv.visitor_id.startsWith('meta_')) && <UserCheck className="w-3 h-3 text-[var(--color-primary)]" />}
                                            {selectedConv.contact_id && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        openCrmContact360(selectedConv.contact_id);
                                                    }}
                                                    className="text-[11px] font-mono text-[var(--color-text-muted)] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer flex items-center gap-1 transition-colors"
                                                    title="Mở Hồ sơ CRM 360"
                                                >
                                                    CRM #{selectedConv.contact_id}
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse"></div>
                                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-60">Đang truy cập • {selectedConv.visit_count || 1} lần xem</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {selectedConv.contact_id && (
                                        <button
                                            type="button"
                                            onClick={() => openCrmContact360(selectedConv.contact_id)}
                                            className="px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <ExternalLink className="w-3.5 h-3.5" />
                                            Hồ sơ CRM 360
                                        </button>
                                    )}
                                    <button
                                        onClick={() => toggleStatus(selectedConv.status === 'ai' ? 'human' : 'ai')}
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm cursor-pointer ${selectedConv.status === 'ai' ? 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300' : 'bg-slate-800 text-white shadow-slate-900/20'
                                            }`}>
                                        {selectedConv.status === 'ai' ? 'Tiếp quản' : 'Bật lại AI'}
                                    </button>
                                    {!selectedConv.visitor_id.startsWith('zalo_') && !selectedConv.visitor_id.startsWith('meta_') && (
                                        <button
                                            onClick={() => {
                                                if (selectedConv.is_blocked) return;
                                                if (!(selectedConv as any).ip_address) {
                                                    toast.error('Không tìm thấy IP');
                                                    return;
                                                }
                                                setIpToBlock({
                                                    ip: selectedConv.ip_address || '',
                                                    visitorName: selectedConv.first_name || selectedConv.email || 'Visitor'
                                                });
                                                setShowBlockIPModal(true);
                                            }}
                                            className={`p-2.5 rounded-xl transition-all border ${selectedConv.is_blocked ? 'bg-rose-600 text-white border-rose-600 shadow-md cursor-default' : 'text-rose-400 hover:text-rose-600 hover:bg-rose-50 border-transparent hover:border-rose-100'}`}
                                            title={selectedConv.is_blocked ? "IP đã bị chặn" : "Chặn IP này"}
                                        >
                                            <ShieldAlert className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>


                            <div ref={scrollRef} onScroll={handleScroll} className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/30 custom-scrollbar">
                                {messages.map((m) => (
                                    <div key={m.id} className={`flex ${m.sender === 'visitor' ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[75%] space-y-1`}>
                                            <div className={`p-4 rounded-[14px] text-xs font-medium shadow-sm leading-relaxed ${m.sender === 'visitor' ? 'bg-[var(--color-primary)] text-white rounded-tl-none' :
                                                'bg-slate-100 text-slate-700 rounded-tr-none'
                                                }`}>
                                                {m.sender === 'ai' && <div className="flex items-center gap-1.5 mb-1.5 opacity-80"><Bot className="w-3.5 h-3.5" /><span className="text-[9px] font-black uppercase tracking-widest">AI Agent</span></div>}
                                                {m.sender === 'human' && <div className="flex items-center gap-1.5 mb-1.5 opacity-80"><User className="w-3.5 h-3.5" /><span className="text-[9px] font-black uppercase tracking-widest">Tư vấn viên</span></div>}
                                                {renderContent(m.message, m.sender === 'visitor' ? 'user' : 'assistant', (action) => setReply(action))}
                                            </div>
                                            <div className={`text-[9px] text-slate-400 font-bold px-2 ${m.sender === 'visitor' ? 'text-left' : 'text-right'}`}>
                                                {formatDate(m.created_at)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {msgLoading && messages.length === 0 && (
                                    <div className="space-y-4 p-6">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                                                <div style={{ width: i % 2 === 0 ? '52%' : '42%', height: i % 3 === 0 ? 64 : 48, borderRadius: 20, background: '#e2e8f0', position: 'relative', overflow: 'hidden' }}>
                                                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)', animation: `sk-shimmer 1.4s ease-in-out ${i * 0.1}s infinite`, transform: 'translateX(-100%)' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className={`p-4 bg-white border-t border-slate-100 transition-all ${selectedConv.status === 'ai' ? 'opacity-75' : ''}`}>
                                {selectedConv.visitor_id.startsWith('zalo_') && (
                                    <div className="mb-2 flex items-center gap-2 px-1">
                                        <Bot className="w-3.5 h-3.5 text-blue-500" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Zalo Mode</span>
                                    </div>
                                )}
                                {selectedConv.visitor_id.startsWith('meta_') && (
                                    <div className="mb-2 flex items-center gap-2 px-1">
                                        <Bot className="w-3.5 h-3.5 text-blue-600" />
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Messenger Mode</span>
                                    </div>
                                )}
                                <div className="relative group">
                                    <textarea
                                        value={reply}
                                        onChange={e => setReply(e.target.value)}
                                        placeholder={selectedConv.status === 'ai' ? "AI đang trả lời khách... (Bấm 'Dừng AI' hoặc 'Tiếp quản' để chat trực tiếp)" : "Nhập nội dung trả lời khách..."}
                                        disabled={selectedConv.status === 'ai'}
                                        className="w-full pl-4 pr-14 py-3 bg-slate-50 border border-slate-100 rounded-[14px] text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-800/10 focus:bg-white focus:border-slate-800 transition-all resize-none min-h-[52px]"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSendReply();
                                            }
                                        }}
                                    />
                                    <button
                                        onClick={handleSendReply}
                                        disabled={!reply.trim() || selectedConv.status === 'ai'}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-800 text-white rounded-xl shadow-lg shadow-slate-800/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="mt-2 flex items-center justify-between px-1">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 opacity-70">
                                        Shift + Enter để xuống dòng
                                    </span>
                                    {selectedConv.status === 'ai' && (
                                        <button
                                            type="button"
                                            onClick={() => toggleStatus('human')}
                                            className="pointer-events-auto text-[10px] font-black text-[var(--color-primary)] uppercase tracking-widest hover:underline cursor-pointer"
                                        >
                                            Dừng AI & Tiếp quản
                                        </button>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center space-y-4 opacity-30">
                            <div className="w-16 h-16 rounded-[18px] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300 shadow-inner">
                                <MessageSquare className="w-8 h-8" />
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Chọn một hội thoại để bắt đầu</p>
                        </div>
                    )
                }
            </div>

            {/* Journey Sidebar & Modal Logic */}
            < div className="w-80 bg-slate-50/50 border-l border-slate-200 flex flex-col" >
                <div className="px-6 pb-2">
                    <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                        {(['all', 'view', 'click', 'other'] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setJourneyFilter(tab)}
                                className={`flex-1 py-1 text-[8px] font-black uppercase tracking-tighter rounded-lg transition-all ${journeyFilter === tab
                                    ? 'bg-white text-slate-800 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                {tab === 'all' ? 'Tất cả' : tab === 'view' ? 'Views' : tab === 'click' ? 'Clicks' : 'Khác'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-6 custom-scrollbar">
                    {journey.length === 0 ? (
                        <div className="p-10 text-center text-[10px] font-black text-slate-300 uppercase italic">Chưa có thông tin tracking</div>
                    ) : (
                        <div className="space-y-6 relative ml-2">
                            <div className="absolute left-[-1.5px] top-2 bottom-2 w-[3px] bg-slate-200/50 rounded-full"></div>
                            {journey
                                .filter(item => {
                                    // 1. Brand filtering
                                    const titleStr = (item.title || '').toUpperCase();
                                    const detailsStr = (item.details || '').toUpperCase();

                                    // LEAD_CAPTURE is too important to hide, even if it happens inside the widget
                                    if (item.title === 'lead_capture') return true;

                                    if (titleStr.includes('IDEAS CHAT') || titleStr.includes('AI CHAT') ||
                                        detailsStr.includes('IDEAS CHAT') || detailsStr.includes('AI CHAT')) return false;

                                    // 2. Tab filtering
                                    if (journeyFilter === 'all') return true;
                                    if (journeyFilter === 'view') return item.type === 'pageview' || item.title === 'view';
                                    if (journeyFilter === 'click') return item.type === 'click' || item.title === 'click' || item.title === 'canvas_click' || item.title === 'lead_capture';
                                    if (journeyFilter === 'other') return item.type !== 'pageview' && item.title !== 'view' && item.title !== 'click' && item.title !== 'canvas_click' && item.title !== 'lead_capture';
                                    return true;
                                })
                                .map((item, idx) => (
                                    <div key={idx} className="relative pl-6 group">
                                        <div className={`absolute left-[-6px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-all group-hover:scale-125 ${(item.type === 'pageview' || item.title === 'view') ? 'bg-blue-500' :
                                            (item.type === 'click' || item.title === 'click' || item.title === 'canvas_click') ? 'bg-[#2563eb]' :
                                                (item.title === 'lead_capture') ? 'bg-emerald-500 font-bold' :
                                                    item.type === 'form' ? 'bg-emerald-500' : 'bg-slate-400'
                                            }`}></div>
                                        <div className="space-y-1">
                                            <div className="flex flex-col gap-0.5">
                                                <div className="flex items-center gap-2">
                                                    {(item.type === 'pageview' || item.title === 'view') ? <Globe className="w-3 h-3 text-blue-400" /> :
                                                        (item.title === 'lead_capture') ? <FormInput className="w-3 h-3 text-emerald-500" /> :
                                                            <MousePointer2 className="w-3 h-3 text-orange-400" />
                                                    }
                                                    <span className={`text-[9px] font-black text-slate-700 uppercase`}>
                                                        {item.title === 'lead_capture' ? 'Info Identified' : (item.title || 'Untitled')}
                                                    </span>
                                                </div>
                                                {item.page_title && (
                                                    <div className="flex items-center gap-1 opacity-60">
                                                        <Layout className="w-2 h-2 text-slate-400" />
                                                        <span className="text-[8px] font-bold text-slate-500 italic truncate max-w-[200px]" title={item.page_url}>
                                                            Tại: {item.page_title}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            {item.details && <p className="text-[10px] text-slate-500 font-medium leading-relaxed bg-white p-2 rounded-lg border border-slate-100 shadow-sm break-all">
                                                {item.title === 'scroll' || item.type === 'scroll' ? `${item.details}%` : item.details}
                                            </p>}
                                            <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold">
                                                <Clock className="w-3 h-3" /> {formatDate(item.time)}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>

                {
                    selectedConv?.email && (
                        <div className="p-6 bg-amber-50 border-t border-amber-100">
                            <div className="flex items-center gap-3 mb-3 min-w-0">
                                <div className="w-8 h-8 rounded-xl bg-[var(--color-primary)] flex items-center justify-center text-white shadow-lg shadow-[var(--color-primary)]/30 shrink-0">
                                    <UserCheck className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="text-[10px] font-black text-[#9A1523] uppercase tracking-widest leading-none mb-1">Lead Synced</h4>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <p className="text-[11px] font-black text-slate-700 truncate" title={selectedConv.email}>{selectedConv.email}</p>
                                        {selectedConv.lead_score !== undefined && selectedConv.lead_score > 0 && (
                                            <div className="inline-flex items-center justify-center gap-1 px-2 py-0.5 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg text-xs font-bold shrink-0">
                                                <Zap className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                                {selectedConv.lead_score}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )
                }
            </div >


            {/* Block IP Confirmation Modal */}
            <ConfirmModal
                isOpen={showBlockIPModal}
                onClose={() => setShowBlockIPModal(false)}
                onConfirm={handleBlockIP}
                title="Xác nhận chặn IP"
                isLoading={isBlocking}
                variant="danger"
                confirmLabel="Xác nhận chặn"
                message={
                    <div className="space-y-4">
                        <div className="p-4 bg-rose-50 rounded-[14px] border border-rose-100">
                            <p className="text-sm font-medium text-rose-800 leading-relaxed">
                                Bạn đang thực hiện chặn địa chỉ IP <span className="font-black underline">{ipToBlock?.ip}</span> của <span className="font-black">{ipToBlock?.visitorName}</span>.
                            </p>
                            <p className="text-[10px] text-rose-600 mt-2 font-bold uppercase tracking-tight">
                                Lưu ý: Mọi lưu lượng từ IP này sẽ bị từ chối (trừ Googlebot).
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lý do chặn (không bắt buộc)</label>
                            <textarea
                                className="w-full bg-slate-50 border border-slate-200 rounded-[14px] p-4 text-sm focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all min-h-[100px] resize-none"
                                placeholder="Ví dụ: Spam click, Attack detection..."
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                            />
                        </div>
                    </div>
                }
            />

            {/* Delete Subscriber Confirm Modal */}
            <ConfirmModal
                isOpen={!!pendingDeleteSubId}
                onClose={() => setPendingDeleteSubId(null)}
                onConfirm={executeDeleteSubscriber}
                title="Xóa liên hệ vĩnh viễn?"
                variant="danger"
                requireConfirmText="DELETE"
                confirmLabel="Xóa vĩnh viễn"
                message={
                    <div className="space-y-3">
                        <p className="text-sm text-slate-600">
                            Bạn sắp xóa liên hệ này khỏi hệ thống hoàn toàn.
                        </p>
                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 font-medium">
                            🔞 Toàn bộ lịch sử, tag và dữ liệu của liên hệ này sẽ bị xóa vĩnh viễn, không thể khôi phục.
                        </div>
                    </div>
                }
            />

            {/* Export Modal */}
            <ConfirmModal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                onConfirm={confirmExport}
                variant="success"
                title="Xuất dữ liệu hội thoại"
                confirmLabel="Xác nhận xuất CSV"
                message={
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-4 rounded-[14px] border border-slate-200 flex items-start gap-4 text-left">
                            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm shrink-0 border border-slate-100">
                                <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-sm font-bold text-slate-800">Cấu hình xuất CSV</h4>
                                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Chọn phạm vi Thời gian bạn muốn trích xuất dữ liệu cuộc trò chuyện.</p>

                                <div className="mt-4 flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                                    {[
                                        { id: 'all', label: 'Tất cả', icon: Sparkles },
                                        { id: 'web', label: 'Web', icon: Globe },
                                        { id: 'zalo', label: 'Zalo', icon: MessageSquare },
                                        { id: 'meta', label: 'Meta', icon: Layout }
                                    ].map((s) => (
                                        <button
                                            key={s.id}
                                            onClick={() => setExportSource(s.id as any)}
                                            className={`flex-1 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-tight flex items-center justify-center gap-1.5 transition-all ${exportSource === s.id ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            <s.icon className={`w-3 h-3 ${exportSource === s.id ? 'text-slate-900' : 'text-slate-300'}`} />
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setExportRange('current')}
                                className={`p-4 rounded-[14px] border-2 transition-all text-left group ${exportRange === 'current' ? 'border-slate-800 bg-slate-50' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'}`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-colors ${exportRange === 'current' ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/20' : 'bg-white text-slate-400 border border-slate-200'}`}>
                                    <Zap className="w-4 h-4" />
                                </div>
                                <div className="font-bold text-xs text-slate-800 uppercase tracking-tight">Bộ lọc hiện tại</div>
                                <p className="text-[10px] text-slate-500 mt-1 font-medium">{startDate && endDate ? `${startDate} đến ${endDate}` : 'Tất cả thời gian'}</p>
                            </button>

                            <button
                                onClick={() => setExportRange('custom')}
                                className={`p-4 rounded-[14px] border-2 transition-all text-left group ${exportRange === 'custom' ? 'border-slate-800 bg-slate-50' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'}`}
                            >
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-colors ${exportRange === 'custom' ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/20' : 'bg-white text-slate-400 border border-slate-200'}`}>
                                    <Clock className="w-4 h-4" />
                                </div>
                                <div className="font-bold text-xs text-slate-800 uppercase tracking-tight">Khoảng tùy chọn</div>
                                <p className="text-[10px] text-slate-500 mt-1 font-medium">Tự chọn ngày bắt đầu & kết thúc</p>
                            </button>
                        </div>

                        {exportRange === 'custom' && (
                            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-[14px] border border-slate-100 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày bắt đầu</label>
                                    <input
                                        type="date"
                                        value={customExportStart}
                                        onChange={(e) => setCustomExportStart(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-slate-500/10 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày kết thúc</label>
                                    <input
                                        type="date"
                                        value={customExportEnd}
                                        onChange={(e) => setCustomExportEnd(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-4 focus:ring-[var(--color-primary)]/10 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                }
            />
            {showZaloProfileModal && selectedZaloSubId && (
                <ZaloUserProfileModal
                    subscriberId={selectedZaloSubId}
                    userId={selectedZaloSubId}
                    isOpen={showZaloProfileModal}
                    onClose={() => {
                        setShowZaloProfileModal(false);
                        setSelectedZaloSubId(null);
                    }}
                    onUpdate={() => fetchConversations(page)}
                />
            )}

            {showMetaProfileModal && selectedMetaSubId && (
                <MetaCustomerProfileModal
                    subscriberId={selectedMetaSubId}
                    userId={selectedMetaSubId}
                    isOpen={showMetaProfileModal}
                    onClose={() => {
                        setShowMetaProfileModal(false);
                        setSelectedMetaSubId(null);
                    }}
                    onUpdate={() => fetchConversations(page)}
                />
            )}
        </div>
    );
}
