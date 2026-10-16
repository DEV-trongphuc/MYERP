import * as React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { api } from '../../services/storageAdapter';
import { Search, Filter, MessageSquare, Clock, ArrowRight, User, Bot, Send, Trash2, MoreVertical, Layout, Globe, MousePointer2, FormInput, Activity, Zap, ShieldAlert, RotateCw, UserCheck, MessageCircle, Globe as Facebook, FileText, Maximize2, ChevronLeft, ChevronRight, Copy, ExternalLink, Sparkles, ShieldCheck, Phone, Mail, StickyNote, X, Layers, ChevronDown, Download, Share2, Info, Play, Eye, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Modal from '../common/Modal'; // Adjust import path as needed
import ConfirmModal from '../common/ConfirmModal';
import CustomerProfileModal from '../audience/CustomerProfileModal'; // Adjust import path
import { MetaCustomerProfileModal } from '../meta/MetaCustomerProfileModal';
import { ZaloUserProfileModal } from '../zalo/ZaloUserProfileModal';

interface Message {
    id: number;
    conversation_id: string;
    sender: 'visitor' | 'ai' | 'human';
    message: string;
    created_at: string;
    bot_name?: string;
}

interface Conversation {
    id: string;
    visitor_id: string;
    last_message: string;
    last_message_at: string;
    status: 'ai' | 'human' | 'closed';
    property_id: string;
    first_name?: string;
    last_name?: string;
    avatar?: string;
    lead_score?: number;
    email?: string;
    phone?: string;
    ip_address?: string;
    zalo_name?: string;
    zalo_avatar?: string;
    sub_phone?: string;
    vis_phone?: string;
    is_blocked?: number;
    user_id?: string;
    created_at?: string;
    updated_at?: string;
    source?: string;
    zalo_oa_name?: string;
    page_name?: string;
    last_message_time?: string;
    subscriber_id?: string;
}

interface JourneyItem {
    time: string;
    type: string;
    title?: string;
    page_title?: string;
    page_url?: string;
    details?: string;
    description?: string;
    source?: string;
    page_name?: string;
}

interface TopicStat {
    topic: string;
    count: number;
    percentage: number;
}

interface UnifiedChatProps {
    key?: string | number;
    propertyId: string;
    initialConversationId?: string | null;
    initialVisitorId?: string | null;
    defaultShowAnalysis?: boolean | number;
    publicMode?: boolean;
    initialReportIndex?: number;
    isGroup?: boolean;
    initialSource?: 'all' | 'web' | 'zalo' | 'meta' | 'org';
    isDarkTheme?: boolean;
}

const CopyButton = React.memo(({ text }: { text: string }) => {
    const [copied, setCopied] = React.useState(false);
    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                setCopied(true);
                toast.success('Đã copy mã!');
                setTimeout(() => setCopied(false), 2000);
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    };

    const fallbackCopy = (text: string) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setCopied(true);
            toast.success('Đã copy mã!');
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error('Không thể copy mã!');
        }
        document.body.removeChild(textArea);
    };

    return (
        <button
            onClick={handleCopy}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white flex items-center gap-1.5"
            title="Copy code"
        >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
    );
});

const UnifiedChat: React.FC<UnifiedChatProps> = ({
    propertyId,
    initialConversationId,
    initialVisitorId,
    defaultShowAnalysis = false,
    publicMode = false,
    initialReportIndex = 0,
    isGroup = false,
    initialSource = 'web',
    isDarkTheme = false
}) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [reply, setReply] = useState('');
    const [loading, setLoading] = useState(false);
    const [showAnalysisModal, setShowAnalysisModal] = useState(defaultShowAnalysis);
    const [msgLoading, setMsgLoading] = useState(false);
    const [source, setSource] = useState<'all' | 'web' | 'zalo' | 'meta' | 'org'>(isGroup ? 'org' : (initialSource === 'all' ? 'web' : initialSource));
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [journeyFilter, setJourneyFilter] = useState<'all' | 'view' | 'click' | 'other'>('all');

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const latestConvFetchId = useRef(0);
    const latestMsgFetchId = useRef(0);
    const [hasMoreMessages, setHasMoreMessages] = useState(false);
    const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);

    const [journey, setJourney] = useState<JourneyItem[]>([]);
    const [lastVisitorMsgAt, setLastVisitorMsgAt] = useState<string | null>(null);
    const [showMetaModal, setShowMetaModal] = useState(false);
    const [showZaloModal, setShowZaloModal] = useState(false);
    const [profileSubscriberId, setProfileSubscriberId] = useState<string | null>(null);

    // Advanced Filters
    const [filterDate, setFilterDate] = useState('');
    const [filterIp, setFilterIp] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // CRM Modal
    const [showCrmModal, setShowCrmModal] = useState(false);
    const [crmSubscriber, setCrmSubscriber] = useState<any>(null);
    const [allLists, setAllLists] = useState<any[]>([]);
    const [allSegments, setAllSegments] = useState<any[]>([]);
    const [allFlows, setAllFlows] = useState<any[]>([]);
    const [allTags, setAllTags] = useState<any[]>([]);

    // Block IP Modal
    const [showBlockIPModal, setShowBlockIPModal] = useState(false);
    const [showUnblockIPModal, setShowUnblockIPModal] = useState(false);
    const [isBlocking, setIsBlocking] = useState(false);
    const [blockReason, setBlockReason] = useState('');
    const [ipToBlock, setIpToBlock] = useState<{ ip: string, visitorName: string } | null>(null);

    // Export
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportRange, setExportRange] = useState<'current' | 'custom'>('current');
    const [customExportStart, setCustomExportStart] = useState('');
    const [customExportEnd, setCustomExportEnd] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [indexToDelete, setIndexToDelete] = useState<number | null>(null);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [showAnalysisConfirm, setShowAnalysisConfirm] = useState(false);
    const [isDeleteChatModalOpen, setIsDeleteChatModalOpen] = useState(false);
    const [startDate, setStartDate] = useState(''); // Synced with filterDate

    // HTML Preview
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewContent, setPreviewContent] = useState('');
    const [previewTitle, setPreviewTitle] = useState('');

    const handleOpenPreview = useCallback((title: string, content: string) => {
        setPreviewTitle(title);
        setPreviewContent(content);
        setShowPreviewModal(true);
    }, []);


    const [endDate, setEndDate] = useState('');
    const [filterIdType, setFilterIdType] = useState(''); // '', 'has_phone', 'has_email'
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [exportSource, setExportSource] = useState<'all' | 'web' | 'zalo' | 'meta' | 'org'>('all');

    // Page/OA Filter
    const [availablePages, setAvailablePages] = useState<{ id: string, name: string, type: 'meta' | 'zalo', avatar?: string, avatar_url?: string }[]>([]);
    const [selectedPageId, setSelectedPageId] = useState('');
    const [isPageDropdownOpen, setIsPageDropdownOpen] = useState(false);
    const [mobileView, setMobileView] = useState<'list' | 'chat' | 'journey'>('list');

    // AI Analysis
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    // showAnalysisModal is declared above
    const [analysisView, setAnalysisView] = useState<'config' | 'report'>('config');
    const [currentAnalysisIndex, setCurrentAnalysisIndex] = useState(0);
    const [docTab, setDocTab] = useState<'media' | 'files' | 'links'>('files');
    const [workspaceFiles, setWorkspaceFiles] = useState<{ id: number; file_name: string; file_type: string; file_url: string; created_at: string; file_size: number }[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    // Memoized data processing
    const groupedConversations = useMemo(() => {
        if (source !== 'org') return [];
        return Object.entries(
            conversations.reduce((acc, c) => {
                const key = c.email ? c.email : (c.user_id ? c.user_id : 'unknown');
                if (!acc[key]) acc[key] = [];
                acc[key].push(c);
                return acc;
            }, {} as Record<string, Conversation[]>)
        );
    }, [conversations, source]);

    const extractedAssets = useMemo(() => {
        const items: { url: string; type: 'image' | 'file' | 'link'; date: string; name?: string }[] = [];
        const seenUrls = new Set<string>();

        messages.forEach(m => {
            const urlRegex = /(https?:\/\/[^\s"<]+)/g;
            const matches = m.message.match(urlRegex) || [];

            matches.forEach((matchUrl: string) => {
                const url = matchUrl.replace(/[.,;:)\]]+$/, '');
                if (seenUrls.has(url)) return;
                seenUrls.add(url);

                const lowerUrl = url.toLowerCase();
                const isImage = /\.(jpg|jpeg|png|gif|webp|svg|blob:)/.test(lowerUrl);
                const isFile = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|txt|csv)$/.test(lowerUrl);

                if (isImage) {
                    items.push({ url, type: 'image', date: m.created_at });
                } else if (isFile) {
                    items.push({ url, type: 'file', date: m.created_at, name: url.split('/').pop() });
                } else {
                    items.push({ url, type: 'link', date: m.created_at });
                }
            });
        });

        // Add workspace files to items
        workspaceFiles.forEach(wf => {
            if (seenUrls.has(wf.file_url)) return;
            seenUrls.add(wf.file_url);

            const lowerUrl = wf.file_url.toLowerCase();
            const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/.test(lowerUrl);
            items.push({
                url: wf.file_url,
                type: isImage ? 'image' : 'file',
                date: wf.created_at,
                name: wf.file_name
            });
        });

        return items;
    }, [messages, workspaceFiles]);

    const currentExtractedItems = useMemo(() => {
        return extractedAssets.filter(i =>
            docTab === 'media' ? i.type === 'image' :
                docTab === 'files' ? i.type === 'file' :
                    i.type === 'link'
        );
    }, [extractedAssets, docTab]);

    const groupedExtractedItems = useMemo(() => {
        return currentExtractedItems.reduce((acc, item) => {
            const dateStr = new Date(item.date).toLocaleDateString('vi-VN');
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(item);
            return acc;
        }, {} as Record<string, typeof currentExtractedItems>);
    }, [currentExtractedItems]);

    // Drag & Drop
    const [isDragging, setIsDragging] = useState(false);

    // File Preview
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewType, setPreviewType] = useState<'image' | 'file' | null>(null);

    // Resizable Layout
    const [rightSidebarWidth, setRightSidebarWidth] = useState(320);
    const [isResizingRight, setIsResizingRight] = useState(false);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const startResizingRight = useCallback((e: React.MouseEvent) => {
        setIsResizingRight(true);
        e.preventDefault();
    }, []);

    const stopResizingRight = useCallback(() => {
        setIsResizingRight(false);
    }, []);

    const resizeRight = useCallback((e: MouseEvent) => {
        if (isResizingRight) {
            const newWidth = window.innerWidth - e.clientX;
            if (newWidth > 250 && newWidth < 800) {
                setRightSidebarWidth(newWidth);
            }
        }
    }, [isResizingRight]);

    useEffect(() => {
        window.addEventListener('mousemove', resizeRight);
        window.addEventListener('mouseup', stopResizingRight);
        return () => {
            window.removeEventListener('mousemove', resizeRight);
            window.removeEventListener('mouseup', stopResizingRight);
        };
    }, [resizeRight, stopResizingRight]);


    // Fetch history whenever modal is opened (lazy - don't block conversation loading)
    useEffect(() => {
        if (showAnalysisModal && propertyId) {
            fetchLastAnalysis();
        }
    }, [showAnalysisModal, propertyId]);

    // Load analysis once on mount for public/embed mode
    useEffect(() => {
        if (defaultShowAnalysis && propertyId) {
            fetchLastAnalysis();
        }
    }, []);

    // Drag Handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isDragging) setIsDragging(true);
    }, [isDragging]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            // Check only the first file for now or handle multiple
            const file = files[0] as File;
            // Simulating an upload logic or pre-fill
            toast.success(`File "${file.name}" ready to upload (Simulation)`);
            // Here you would typically set the file to state to be sent
        }
    }, []);

    // Sync prop to state
    useEffect(() => {
        if (defaultShowAnalysis) {
            setShowAnalysisModal(true);
            setAnalysisView('config'); // Luôn hiện UI tùy chỉnh (config) trước khi mở modal
        }
    }, [defaultShowAnalysis]);
    const [analysisReport, setAnalysisReport] = useState('');
    const [analysisHistory, setAnalysisHistory] = useState<any[]>([]);
    const [analysisSampleCount, setAnalysisSampleCount] = useState(0);
    const [analysisTimeStats, setAnalysisTimeStats] = useState<number[]>([]);
    const [analysisTopicStats, setAnalysisTopicStats] = useState<TopicStat[]>([]);
    const [analysisVisitorCount, setAnalysisVisitorCount] = useState(0);
    const [analysisTotalCount, setAnalysisTotalCount] = useState(0);

    // Analysis Settings (Internal to Modal)
    const [anSource, setAnSource] = useState<'all' | 'web' | 'zalo' | 'meta' | 'org'>('all');
    const [anFromDate, setAnFromDate] = useState('');
    const [anToDate, setAnToDate] = useState('');
    const [anDatePreset, setAnDatePreset] = useState('7days');
    const [anPageId, setAnPageId] = useState('');
    const [isAnSourceOpen, setIsAnSourceOpen] = useState(false);
    const [isAnDateOpen, setIsAnDateOpen] = useState(false);

    const [reportConversations, setReportConversations] = useState<any[]>([]);
    const [isFetchingReportConvs, setIsFetchingReportConvs] = useState(false);
    const [reportPage, setReportPage] = useState(1);
    const [reportTotalPages, setReportTotalPages] = useState(1);
    const [reportSearch, setReportSearch] = useState('');

    // Reset selectedPageId when source changes
    useEffect(() => {
        setSelectedPageId('');
    }, [source]);

    // Fetch available pages/OAs
    useEffect(() => {
        const fetchPages = async () => {
            try {
                const res = await api.get<any>(`ai_chatbot?action=get_available_pages&_t=${Date.now()}`);
                if (res.success && res.data) {
                    setAvailablePages(res.data);
                }
            } catch (e) {
                console.error('Failed to fetch pages:', e);
            }
        };
        fetchPages();
    }, []);

    useEffect(() => {
        if (propertyId) {
            // Clear conversations ngay lập tức khi source thay đổi để tránh hiển thị dữ liệu cũ
            setConversations([]);
            setSelectedConv(null);
            setPage(1); // Reset về trang 1
            if (!publicMode) {
                // Run fetchConversations immediately; analysis is loaded lazily (on modal open)
                fetchConversations();
            }
        }
    }, [propertyId, source, debouncedSearchTerm, filterDate, filterIp, filterIdType, selectedPageId]);

    const fetchLastAnalysis = async (skipViewSwitch = false) => {
        try {
            const res = await api.get<any>(`ai_chatbot?action=get_last_analysis&property_id=${propertyId}&is_group=${isGroup ? 1 : 0}`);

            const rawHistory = (res as any).history;
            const history = Array.isArray(rawHistory) ? rawHistory : (rawHistory && typeof rawHistory === 'object' ? Object.values(rawHistory) : []);
            setAnalysisHistory(history);

            if (history.length > 0) {
                // Determine which report to show
                const idx = (publicMode && initialReportIndex < history.length) ? initialReportIndex : 0;
                const latest = history[idx];

                setAnalysisReport(latest.report || '');
                setAnalysisTimeStats(latest.time_stats || []);
                setAnalysisTopicStats(latest.topic_stats || []);
                setAnalysisSampleCount(latest.sample_count || 0);
                setAnalysisVisitorCount(latest.visitor_count || 0);
                setAnalysisTotalCount(latest.total_count || 0);

                // Sync filters
                setAnSource(latest.source || 'all');
                setAnFromDate(latest.from_date || '');
                setAnToDate(latest.to_date || '');
                setAnPageId(latest.page_id || '');

                if (defaultShowAnalysis && !skipViewSwitch) {
                    setAnalysisView('report');
                }
            } else {
                setAnalysisReport('');
                setAnalysisTimeStats([]);
                setAnalysisTopicStats([]);
                setAnalysisSampleCount(0);
                setAnalysisVisitorCount(0);
                setAnalysisTotalCount(0);
            }
        } catch (e) {
            console.error('Failed to fetch last analysis:', e);
        }
    };

    const handleDeleteAnalysis = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        setIndexToDelete(index);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (indexToDelete === null) return;
        if (deleteConfirmText !== 'DELETE') {
            toast.error('Vui lòng nhập đúng chữ DELETE để xác nhận');
            return;
        }
        try {
            const res = await api.get<any>(`ai_chatbot?action=delete_analysis&property_id=${propertyId}&index=${indexToDelete}&is_group=${isGroup ? 1 : 0}`);
            if (res.success) {
                toast.success('Đã xóa Báo cáo thành công');
                fetchLastAnalysis(true); // skipViewSwitch = true
            }
        } catch (e) {
            toast.error('Lỗi khi xóa Báo cáo');
        } finally {
            setShowDeleteConfirm(false);
            setIndexToDelete(null);
            setDeleteConfirmText('');
        }
    };

    // Initialize date range on mount with default preset
    useEffect(() => {
        const today = new Date();
        const formatDate = (date: Date) => date.toISOString().split('T')[0];
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        setAnFromDate(formatDate(sevenDaysAgo));
        setAnToDate(formatDate(today));
    }, []); // Run once on mount

    // Separate effect for page changes (không clear conversations)
    const isFirstPageEffect = useRef(true);
    useEffect(() => {
        if (propertyId) {
            if (isFirstPageEffect.current) {
                isFirstPageEffect.current = false;
                return;
            }
            fetchConversations();
        }
    }, [page]);

    useEffect(() => {
        if (selectedConv) {
            fetchMessages(selectedConv.id);
            // Polling disabled as per request
            // const interval = setInterval(() => fetchMessages(selectedConv.id), 5000);
            // return () => clearInterval(interval);
        }
    }, [selectedConv]);

    useEffect(() => {
        if (scrollRef.current && autoScroll) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, autoScroll]);

    useEffect(() => {
        if (selectedConv) {
            setMobileView('chat');
        }
    }, [selectedConv]);

    useEffect(() => {
        if (initialConversationId) {
            const find = conversations.find(c => c.id === initialConversationId);
            if (find) {
                setSelectedConv(find);
            } else {
                // Fetch specific conversation if not in list
                api.get<any>(`ai_chatbot?action=get_conversation&id=${initialConversationId}`).then(res => {
                    if (res.success && res.data) {
                        setSelectedConv(res.data);
                        // Optional: Add to list if not present
                        setConversations(prev => [res.data, ...prev]);
                    }
                });
            }
        } else if (initialVisitorId) {
            // Find by visitor ID
            const find = conversations.find(c => c.visitor_id === initialVisitorId || c.visitor_id.endsWith(initialVisitorId));
            if (find) {
                setSelectedConv(find);
            } else {
                // Search/Fetch by visitor ID logic 
                // We'll search for it
                setSearchTerm(initialVisitorId); // This will trigger fetchConversations with search
            }
        } else if (!selectedConv && conversations.length > 0 && !loading) {
            // [NEW] Auto-select first conversation if nothing selected
            setSelectedConv(conversations[0]);
        }
    }, [initialConversationId, initialVisitorId, conversations, loading]);

    const fetchConversations = async () => {
        const fetchId = ++latestConvFetchId.current;
        setLoading(true);
        try {
            let url = `ai_chatbot?action=list_conversations&property_id=${propertyId}&source=${source}&is_group=${isGroup ? 1 : 0}`;
            if (debouncedSearchTerm) url += `&search=${encodeURIComponent(debouncedSearchTerm)}`;
            if (filterDate) {
                // Assuming filterDate handles from/to or single date logic
                // For simplicity: from_date = filterDate
                url += `&from_date=${filterDate}`;
            }
            if (filterIp) url += `&ip=${filterIp}`;
            if (filterIdType) url += `&id_filter=${filterIdType}`;
            if (selectedPageId) url += `&page_id=${selectedPageId}`;
            url += `&page=${page}&limit=10`; // Add pagination params

            const res = await api.get<any>(url);
            if (fetchId !== latestConvFetchId.current) return;

            if (res.success) {
                setConversations(res.data || []);
                if ((res as any).pagination && (res as any).pagination.total_pages) {
                    setTotalPages((res as any).pagination.total_pages);
                }
            } else {
                // Nếu API trả về lỗi, clear conversations
                setConversations([]);
            }
        } catch (e) {
            console.error('Error fetching conversations:', e);
            setConversations([]); // Clear on error
        } finally {
            setLoading(false);
        }
    };

    const fetchWorkspaceFiles = async (convId: string) => {
        try {
            const res = await api.get<any>(`ai_org_chatbot?action=workspace_list&conversation_id=${convId}&property_id=${propertyId}`);
            if (res.success) {
                setWorkspaceFiles(res.data || []);
            } else {
                setWorkspaceFiles([]);
            }
        } catch (e) {
            console.error('Error fetching workspace files:', e);
            setWorkspaceFiles([]);
        }
    };

    const fetchMessages = async (convId: string) => {
        const fetchId = ++latestMsgFetchId.current;
        setMsgLoading(true);
        setHasMoreMessages(false);
        setMessages([]); // Clear immediately for instant feedback
        setJourney([]); // Clear journey too
        setWorkspaceFiles([]); // Clear previous workspace files
        try {
            const LIMIT = 30;
            const res = await api.get<any>(`ai_chatbot?action=get_messages&conversation_id=${convId}&limit=${LIMIT}`);
            if (res.success) {
                if (fetchId !== latestMsgFetchId.current) return;
                setMessages(res.data);
                // If we got exactly LIMIT messages, there may be more older ones
                setHasMoreMessages(res.data.length >= LIMIT);

                // Find last visitor message
                const lastVisMsg = [...res.data].reverse().find(m => m.sender === 'visitor');
                if (lastVisMsg) {
                    setLastVisitorMsgAt(lastVisMsg.created_at);
                } else {
                    setLastVisitorMsgAt(null);
                }
            }

            // Set loading false as soon as messages are ready
            setMsgLoading(false);

            // Fetch background data in parallel without blocking UI
            (async () => {
                // If in Org/Consultant mode, also fetch Workspace Files
                if (source === 'org') {
                    fetchWorkspaceFiles(convId);
                }

                // Also fetch journey based on source
                if (selectedConv && selectedConv.visitor_id) {
                    let journeyData: any[] = [];

                    // Fetch journey based on source
                    if (selectedConv.source === 'meta') {
                        // For Meta, fetch from meta_customers API
                        const psid = selectedConv.visitor_id.replace('meta_', '');
                        const metaRes = await api.get<any>(`meta_customers?route=user_details&id=${selectedConv.visitor_id}`);
                        if (metaRes.success && metaRes.data?.journey) {
                            journeyData = metaRes.data.journey.map((j: any) => ({
                                type: j.event_type || 'other',
                                title: j.event_name || 'Event',
                                description: j.event_data ? JSON.stringify(j.event_data) : '',
                                time: j.created_at,
                                page_name: j.page_name
                            }));
                        }
                    } else if (selectedConv.source === 'zalo') {
                        // For Zalo, could add similar logic if needed
                        journeyData = [];
                    } else {
                        // For Web, use existing web_tracking API
                        const vid = selectedConv.visitor_id;
                        const jRes = await api.get<any>(`web_tracking?action=visitor_journey&visitor_id=${vid}`);
                        if (jRes.success) {
                            journeyData = jRes.data || [];
                        }
                    }

                    // Client-side: Detect Phone Numbers from Messages (for all sources)
                    const phoneRegex = /(0[3|5|7|8|9][0-9]{8})\b/g;
                    const detectedPhones = new Set();

                    // Scan messages from Visitor
                    (res.data || []).forEach((m: any) => {
                        if (m.sender === 'visitor' && m.message) {
                            // 1. Phone Detection
                            const matches = m.message.match(phoneRegex);
                            if (matches) {
                                matches.forEach((phone: string) => {
                                    detectedPhones.add(phone);

                                    // Avoid duplicates in the same fetch if needed
                                    journeyData.push({
                                        type: 'phone_detected',
                                        title: 'phone_detected',
                                        details: phone,
                                        time: m.created_at,
                                        page_title: 'Chat Conversation'
                                    });
                                });
                            }

                            // 2. Meta Lead Form Parsing
                            if (m.message.includes('Full name:') || m.message.includes('Phone number:') || m.message.includes('Email:')) {
                                const nameMatch = m.message.match(/Full name:\s*(.+)/i);
                                const phoneMatch = m.message.match(/Phone number:\s*(.+)/i);
                                const emailMatch = m.message.match(/Email:\s*(.+)/i);

                                const leadInfo: any = {};
                                if (nameMatch) leadInfo.first_name = nameMatch[1].trim();
                                if (phoneMatch) leadInfo.phone = phoneMatch[1].trim();
                                if (emailMatch) leadInfo.email = emailMatch[1].trim();

                                const lines = m.message.split('\n');
                                const notes: string[] = [];
                                lines.forEach((line: string) => {
                                    if (line.trim() && !line.match(/Full name:|Phone number:|Email:/i)) {
                                        notes.push(line.trim());
                                    }
                                });
                                if (notes.length > 0) leadInfo.notes = notes.join('; ');

                                if (Object.keys(leadInfo).length > 0) {
                                    const isGeneric = (conv: Conversation | null) => {
                                        if (!conv) return false;
                                        const name = conv.first_name || '';
                                        return name.startsWith('v_') || name.startsWith('Visitor ') || !name;
                                    };

                                    if (leadInfo.first_name && isGeneric(selectedConv)) {
                                        const newName = leadInfo.first_name;
                                        setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, first_name: newName, email: leadInfo.email || c.email } : c));
                                        setSelectedConv(prev => prev ? { ...prev, first_name: newName, email: leadInfo.email || prev.email } as Conversation : null);
                                        if (source === 'meta') toast.success("Đã đồng bộ thông tin Lead từ Meta!", { icon: '⚡' });

                                        api.post('ai_chatbot?action=update_visitor_info', {
                                            conversation_id: selectedConv.id,
                                            first_name: newName,
                                            email: leadInfo.email,
                                            phone: leadInfo.phone
                                        });
                                    }
                                }
                            }
                        }
                    });

                    // 3. Rename generic visitor if ONLY phone detected
                    const isGeneric = (conv: Conversation | null) => {
                        if (!conv) return false;
                        const name = conv.first_name || '';
                        return name.startsWith('v_') || name.startsWith('Visitor ') || !name;
                    };

                    if (detectedPhones.size > 0 && isGeneric(selectedConv)) {
                        const lastPhone = Array.from(detectedPhones).pop() as string;
                        if (!selectedConv.first_name) {
                            const newName = lastPhone;
                            setConversations(prev => prev.map(c => c.id === selectedConv.id ? { ...c, first_name: newName } : c));
                            setSelectedConv(prev => prev ? { ...prev, first_name: newName } as Conversation : null);

                            api.post('ai_chatbot?action=update_visitor_info', {
                                conversation_id: selectedConv.id,
                                first_name: newName,
                                phone: lastPhone
                            });
                        }
                    }

                    journeyData.sort((a: any, b: any) => new Date(b.time).getTime() - new Date(a.time).getTime());
                    if (journeyData.length > 20) journeyData = journeyData.slice(0, 20);

                    if (selectedConv && (selectedConv.source === 'meta' || selectedConv.source === 'zalo')) {
                        const pageName = selectedConv.source === 'zalo' ? (selectedConv.zalo_oa_name || 'Zalo OA') : (selectedConv.page_name || 'Facebook Page');
                        const sourceLabel = selectedConv.source === 'zalo' ? 'Nhắn tin từ Zalo OA' : 'Nhắn tin từ Facebook Page';

                        journeyData.unshift({
                            type: 'page_source',
                            title: sourceLabel,
                            description: pageName,
                            time: selectedConv.last_message_time || new Date().toISOString(),
                            page_name: pageName,
                            source: selectedConv.source
                        });
                    }
                    setJourney(journeyData);
                }
            })();
        } catch (e) {
            console.error(e);
        } finally {
            setMsgLoading(false);
        }
    };

    const handleSendReply = async () => {
        if (!reply.trim() || !selectedConv) return;
        const tempMsg = {
            id: Date.now(),
            conversation_id: selectedConv.id,
            sender: 'human',
            message: reply,
            created_at: new Date().toISOString()
        } as Message;

        setMessages([...messages, tempMsg]);
        setReply('');
        setAutoScroll(true);

        try {
            const res = await api.post<any>('ai_chatbot?action=send_human_reply', {
                conversation_id: selectedConv.id,
                message: tempMsg.message,
                property_id: propertyId
            });
            if (res.success) {
                toast.success('đã gửi trả lời & Tạm dừng AI 30p');
                fetchMessages(selectedConv.id);
            } else {
                toast.error('Gửi thất bại: ' + res.message);
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
        }
    };


    const handleDatePreset = (preset: string) => {
        setAnDatePreset(preset);
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        switch (preset) {
            case 'today':
                setAnFromDate(today);
                setAnToDate(today);
                break;
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(now.getDate() - 1);
                const yStr = yesterday.toISOString().split('T')[0];
                setAnFromDate(yStr);
                setAnToDate(yStr);
                break;
            case '7days':
                const last7 = new Date(now);
                last7.setDate(now.getDate() - 7);
                setAnFromDate(last7.toISOString().split('T')[0]);
                setAnToDate(today);
                break;
            case 'this_month':
                const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                setAnFromDate(monthStart.toISOString().split('T')[0]);
                setAnToDate(today);
                break;
            case 'last_month':
                const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
                setAnFromDate(lastMonthStart.toISOString().split('T')[0]);
                setAnToDate(lastMonthEnd.toISOString().split('T')[0]);
                break;
            case 'all':
            default:
                setAnFromDate('');
                setAnToDate('');
                break;
        }
    };

    const triggerAnalysis = async () => {
        if (isAnalyzing) return;
        setIsAnalyzing(true);
        try {
            const res = await api.get<any>(`ai_chatbot?action=analyze_segment&property_id=${propertyId}&source=${anSource}&from_date=${anFromDate}&to_date=${anToDate}&page_id=${selectedPageId}&is_group=${isGroup ? 1 : 0}`);
            if (res.success) {
                const data = res as any;
                setAnPageId(selectedPageId);
                setAnalysisReport(data.report);
                setAnalysisTimeStats(data.time_stats || []);
                setAnalysisTopicStats(data.topic_stats || []);
                setAnalysisSampleCount(data.sample_count || 0);
                setAnalysisVisitorCount(data.visitor_count || 0);
                setAnalysisTotalCount(data.total_count || 0);
                setCurrentAnalysisIndex(0); // New report is always at index 0
                setAnalysisView('report');
                // Refresh last analysis
                fetchLastAnalysis();
            } else {
                toast.error(res.message || 'Phân tích thất bại');
            }
        } catch (e) {
            console.error('Analysis error:', e);
            toast.error('Lỗi kết nối máy chủ');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - scrollTop - clientHeight > 50) {
            setAutoScroll(false);
        } else {
            setAutoScroll(true);
        }
        // Load older messages when scrolled near top
        if (scrollTop < 50 && hasMoreMessages && !loadingMoreMessages && selectedConv) {
            fetchMoreMessages();
        }
    };

    const fetchMoreMessages = async () => {
        if (!selectedConv || loadingMoreMessages || !hasMoreMessages) return;
        const oldestMsg = messages[0];
        if (!oldestMsg) return;
        setLoadingMoreMessages(true);
        try {
            const LIMIT = 30;
            const res = await api.get<any>(`ai_chatbot?action=get_messages&conversation_id=${selectedConv.id}&limit=${LIMIT}&before_id=${oldestMsg.id}`);
            if (res.success && res.data.length > 0) {
                // Preserve scroll position after prepending messages
                const container = scrollRef.current;
                const prevScrollHeight = container?.scrollHeight || 0;
                setMessages(prev => [...res.data, ...prev]);
                setHasMoreMessages(res.data.length >= LIMIT);
                // After React re-renders, restore scroll so user stays at same visual position
                requestAnimationFrame(() => {
                    if (container) {
                        container.scrollTop = container.scrollHeight - prevScrollHeight;
                    }
                });
            } else {
                setHasMoreMessages(false);
            }
        } catch (e) {
            console.error('Error loading more messages:', e);
        } finally {
            setLoadingMoreMessages(false);
        }
    };

    const isGenericName = (c: Conversation | null) => {
        if (!c) return false;
        // Prioritize actual user data
        const name = c.first_name || c.last_name || c.zalo_name;
        if (!name) return true;
        // Check for common anonymous patterns
        return name.toLowerCase().includes('visitor') ||
            name.toLowerCase().includes('khách ẩn danh') ||
            (name.includes('-') && name.length > 20); // Basic check for UUID
    };

    const formatDate = useCallback((dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    }, []);

    const getDisplayName = (c: Conversation) => {
        let name = (source === 'org' && c.email) ? c.email : (c.first_name || c.last_name || c.zalo_name);
        // If empty or looks like UUID, show placeholder with last 4 digits
        if (!name || (name.includes('-') && name.length > 20)) {
            const id = c.visitor_id || name || '';
            const suffix = id.length >= 4 ? id.slice(-4) : id;
            return `Khách hàng #${suffix}`;
        }
        return name;
    };

    const getAvatar = (c: Conversation) => {
        if (c.avatar) return <img src={c.avatar} className="w-full h-full object-cover" />;
        if (c.zalo_avatar) return <img src={c.zalo_avatar} className="w-full h-full object-cover" />;

        // Check if identified
        const hasContact = c.email || c.phone || c.sub_phone || c.vis_phone;
        const name = getDisplayName(c);

        // 1. Phone Number Detection
        const isPhone = c.phone || (name && name.match(/^(0[3|5|7|8|9][0-9]{8,9})$/));

        if (isPhone) {
            return <div className="w-full h-full bg-emerald-500 text-white flex items-center justify-center"><Phone className="w-3.5 h-3.5" /></div>;
        }

        if (hasContact) {
            // Identified Lead
            // Use suffix char for avatar if it's "Khách hàng 1234" pattern
            let initial = name.charAt(0).toUpperCase();
            if (name.startsWith('Khách hàng ')) {
                initial = name.trim().slice(-1).toUpperCase();
            }

            return (
                <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-black text-[10px] uppercase shadow-inner">
                    {initial}
                </div>
            );
        }

        // Anonymous or Org
        return (
            <div className="w-full h-full bg-white border border-slate-200 text-slate-400 flex items-center justify-center">
                {source === 'org' ? <Bot className="w-3.5 h-3.5 text-brand" /> : <User className="w-3.5 h-3.5" />}
            </div>
        );
    };


    const toggleStatus = async (status: 'ai' | 'human') => {
        if (!selectedConv) return;
        try {
            await api.post('ai_chatbot?action=update_status', {
                conversation_id: selectedConv.id,
                status: status
            });
            toast.success('Đã cập nhật Trạng thái: ' + status);
            setSelectedConv({ ...selectedConv, status });
            // Update in list
            setConversations(conversations.map(c => c.id === selectedConv.id ? { ...c, status } : c));
        } catch (e) {
            toast.error('Lỗi cập nhật Trạng thái');
        }
    };

    const handleDeleteChat = () => {
        if (!selectedConv) return;
        setIsDeleteChatModalOpen(true);
    };

    const confirmDeleteChat = async () => {
        if (!selectedConv) return;

        try {
            const res = await api.post<any>('ai_chatbot?action=delete_conversation', {
                conversation_id: selectedConv.id
            });
            if (res.success) {
                toast.success('Đã xóa cuộc hội thoại');
                // Remove from list
                const updatedConvs = conversations.filter(c => c.id !== selectedConv.id);
                setConversations(updatedConvs);

                // Select next conversation if available
                if (updatedConvs.length > 0) {
                    setSelectedConv(updatedConvs[0]);
                } else {
                    setSelectedConv(null);
                    setMessages([]);
                }
            } else {
                toast.error('Lỗi khi xóa: ' + res.message);
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
        } finally {
            setIsDeleteChatModalOpen(false);
        }
    };

    const handleBlockIP = async () => {
        if (!selectedConv) return;

        // If already blocked, open Unblock Modal
        if (selectedConv.is_blocked) {
            setShowUnblockIPModal(true);
            return;
        }

        // Open Block Modal
        if (!isBlocking && !showBlockIPModal) {
            if (selectedConv?.ip_address) {
                setIpToBlock({ ip: selectedConv.ip_address, visitorName: selectedConv.first_name || 'Visitor' });
                setShowBlockIPModal(true);
            } else if (selectedConv?.visitor_id.startsWith('zalo_')) {
                toast('Zalo users cannot be IP blocked yet.');
            } else {
                toast('No IP address found for this user.');
            }
            return;
        }

        if (!ipToBlock || !selectedConv) return;
        setIsBlocking(true);
        try {
            // Call block Web API
            const res = await api.post<any>('web_blacklist?action=add', {
                ip: ipToBlock.ip,
                reason: blockReason
            });
            if (res.success) {
                toast.success(`Đã chặn IP ${ipToBlock.ip}`);
                setShowBlockIPModal(false);
                setBlockReason('');
                setIpToBlock(null);
                // Refresh list to show blocked status
                fetchConversations();
                if (selectedConv) setSelectedConv({ ...selectedConv, is_blocked: 1 });
            } else {
                toast.error(res.message || 'Lỗi khi chặn IP');
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
        } finally {
            setIsBlocking(false);
        }
    };

    const handleUnblockIP = async () => {
        if (!selectedConv || !selectedConv.ip_address) return;
        setIsBlocking(true);
        try {
            const res = await api.delete<any>(`web_blacklist?action=delete&ip=${selectedConv.ip_address}`);
            if (res.success) {
                toast.success(`Đã bỏ chặn IP ${selectedConv.ip_address}`);
                setShowUnblockIPModal(false);
                fetchConversations();
                setSelectedConv({ ...selectedConv, is_blocked: 0 });
            } else {
                toast.error(res.message || 'Lỗi khi bỏ chặn IP');
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
        } finally {
            setIsBlocking(false);
        }
    };

    const openExportModal = () => {
        // Init dates from filters
        setShowExportModal(true);
        setCustomExportStart(filterDate || '');
        setCustomExportEnd('');
        setExportSource(source === 'all' ? 'all' : source); // Sync with current view
    }

    const confirmExport = () => {
        let url = `action=export_conversations&property_id=${propertyId}&source=${exportSource}&is_group=${isGroup ? 1 : 0}`;
        if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
        if (filterIp) url += `&ip=${filterIp}`;

        if (exportRange === 'custom') {
            if (customExportStart) url += `&from_date=${customExportStart}`;
            if (customExportEnd) url += `&to_date=${customExportEnd}`;
        } else {
            if (filterDate) url += `&from_date=${filterDate}`;
        }

        window.open(api.baseUrl + '/ai_chatbot.php?' + url, '_blank');
        setShowExportModal(false);
    };


    const handleFetchReportConversations = async (pageNum: number = 1, searchOverride?: string) => {
        if (isFetchingReportConvs) return;
        setIsFetchingReportConvs(true);
        const searchTerm = searchOverride !== undefined ? searchOverride : reportSearch;
        try {
            let url = `ai_report_conversations?action=list&property_id=${propertyId}&source=${anSource}&from_date=${anFromDate}&to_date=${anToDate}&page_id=${anPageId}&page=${pageNum}&limit=20&is_group=${isGroup ? 1 : 0}`;
            if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;
            const res = await api.get<any>(url) as any;
            if (res.success) {
                setReportConversations(res.data);
                setReportPage(pageNum);
                setReportTotalPages(res.pagination?.total_pages || 1);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsFetchingReportConvs(false);
        }
    };

    const handleReportPageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= reportTotalPages && !isFetchingReportConvs) {
            handleFetchReportConversations(newPage);
        }
    };

    useEffect(() => {
        if (analysisView === 'report' && showAnalysisModal) {
            setReportSearch('');
            setReportConversations([]);
            setReportPage(1);
            handleFetchReportConversations(1, '');
        }
    }, [analysisView, showAnalysisModal, anSource, anFromDate, anToDate, anPageId]);


    // CRM Profile
    const handleOpenProfile = async () => {
        if (!selectedConv || (!selectedConv.email && !selectedConv.visitor_id)) return;

        // 1. Check if it's a platform-specific user UNLINKED to main CRM
        if (selectedConv.visitor_id.startsWith('meta_')) {
            const metaId = (selectedConv as any).id; // The internal MD5 ID
            setProfileSubscriberId(metaId);
            setShowMetaModal(true);
            return;
        }

        if (selectedConv.visitor_id.startsWith('zalo_')) {
            const zaloId = selectedConv.visitor_id.replace('zalo_', '');
            setProfileSubscriberId(zaloId);
            setShowZaloModal(true);
            return;
        }

        // 2. Try to fetch subscriber by ID if linked
        let sub = null;
        if (selectedConv.lead_score && (selectedConv as any).subscriber_id) {
            const res = await api.get(`subscribers/${(selectedConv as any).subscriber_id}`);
            if (res.success) sub = res.data;
        }

        // For now, if we have subscriber info attached to conversation, use it
        if (!sub && (selectedConv.first_name || selectedConv.email)) {
            await fetchCrmMetadata();
            if ((selectedConv as any).subscriber_id) {
                const res = await api.get(`subscribers/${(selectedConv as any).subscriber_id}`);
                if (res.success) setCrmSubscriber(res.data);
                else setCrmSubscriber(null);
            } else {
                setCrmSubscriber(null);
                toast("Chưa liên kết CRM");
                return;
            }
            setShowCrmModal(true);
        } else if (sub) {
            await fetchCrmMetadata();
            setCrmSubscriber(sub);
            setShowCrmModal(true);
        }
    };

    const fetchCrmMetadata = async () => {
        try {
            const [lists, segments, flows, tags] = await Promise.all([
                api.get<any>('lists'),
                api.get<any>('segments'),
                api.get<any>('flows'),
                api.get<any>('tags')
            ]);
            if (lists.success) setAllLists(lists.data);
            if (segments.success) setAllSegments(segments.data);
            if (flows.success) setAllFlows(flows.data);
            if (tags.success) setAllTags(tags.data);
        } catch (e) { console.error('[UnifiedChat] fetchCrmMetadata failed:', e); }
    }

    const checkSegmentMatch = (segId: string) => false; // Simplified
    const handleUpdateSubscriber = async (id: string, data: any) => {
        await api.put(`subscribers/${id}`, data);
        const fresh = await api.get(`subscribers/${id}`);
        if (fresh.success) setCrmSubscriber(fresh.data);
    };
    const handleDeleteSubscriber = async (id: string) => {
        await api.delete(`subscribers/${id}`);
        setShowCrmModal(false);
    };

    // ------------------------------------------------------------------
    // [RESTORED] Complex Content Renderer from WebTracking/ConversationsTab
    // ------------------------------------------------------------------
    const renderContent = useCallback((content: string, role: string, onActionClick?: (action: string) => void) => {
        if (!content) return null;

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

        // Strip [SHOW_LEAD_FORM] and other internal tags for UI display
        content = content.replace(/\[SHOW_LEAD_FORM\]/g, '');
        content = content.replace(/\*\*\*(.*?)\*\*\*/g, '**$1**'); // Clean up triple asterisks to prevent leftover *
        content = content.trim();

        if (!content && extractedActions.length === 0) return null;

        // Key counter for unique keys
        let keyCounter = 0;
        const getUniqueKey = (prefix: string) => `${prefix}-${keyCounter++}`;

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

                // Normalize URL
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

                // Extensions
                const imgExtMatch = url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i);
                const fileExtMatch = url.match(/\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|csv)$/i);

                if (isMarkdownImage || imgExtMatch) {
                    parts.push(
                        <div key={match.index} className="mt-2 mb-2">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-slate-100 shadow-sm transition-all hover:scale-[1.02]">
                                <img src={url} alt={label || "Image"} className="w-full max-h-[300px] object-cover" />
                            </a>
                        </div>
                    );
                } else if (fileExtMatch) {
                    const ext = fileExtMatch[1].toLowerCase();
                    const fileName = label || url.split('/').pop() || 'Tải lên'

                    parts.push(
                        <a key={match.index} href={url} target="_blank" rel="noopener noreferrer" className="block group mt-2 mb-2 no-underline">
                            <div className={`flex items-center gap-3 p-3 border rounded-xl transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 hover:border-slate-500' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${ext === 'pdf' ? 'bg-rose-100 text-rose-500' :
                                    ext.includes('doc') ? 'bg-blue-100 text-blue-500' :
                                        ext.includes('xls') ? 'bg-emerald-100 text-emerald-500' :
                                            'bg-slate-200 text-slate-600'
                                    }`}>
                                    <FileText className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h5 className={`text-xs font-bold truncate ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{fileName}</h5>
                                    <p className="text-[10px] font-medium text-slate-400 mt-0.5 uppercase tracking-wider">{ext} file • Click to open</p>
                                </div>
                                <Download className="w-4 h-4 text-slate-300" />
                            </div>
                        </a>
                    );
                } else {
                    parts.push(
                        <a
                            key={match.index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-1 bg-blue-50/30 border border-blue-100/50 rounded-lg text-blue-600 font-bold hover:bg-blue-50 transition-all no-underline text-xs"
                        >
                            <ExternalLink className="w-3 h-3 text-blue-400" />
                            <span className="truncate max-w-[200px]">{label || url}</span>
                        </a>
                    );
                }
                lastIndex = combinedRegex.lastIndex;
            }
            if (lastIndex < text.length) parts.push(text.substring(lastIndex));
            return parts.length > 0 ? parts : [text];
        };

        // 2a. Helper: Parse Break (<br>)
        const parseBreak = (nodes: React.ReactNode[]): React.ReactNode[] => {
            return nodes.flatMap((node, i) => {
                if (typeof node !== 'string') return node;
                const breakParts = node.split(/(\r\n|\r|\n)/);
                return breakParts.map((part, j) => {
                    if (part === '\n' || part === '\r' || part === '\r\n') {
                        return <br key={`${i}-${j}`} />;
                    }
                    return part;
                });
            });
        };

        // 2. Helper: Parse Bold (**text**)
        const parseBold = (nodes: (string | React.ReactNode)[]): React.ReactNode[] => {
            return nodes.flatMap((node, i) => {
                if (typeof node !== 'string') return node;
                const boldParts = node.split(/(\*\*[^*]+\*\*)/g);
                return boldParts.map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={`${i}-${j}`} className={`font-black ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{part.slice(2, -2)}</strong>;
                    }
                    return part;
                });
            });
        };

        // 2b. Helper: Parse Italic (*text*)
        const parseItalic = (nodes: (string | React.ReactNode)[]): React.ReactNode[] => {
            return nodes.flatMap((node, i) => {
                if (typeof node !== 'string') return node;
                const italicParts = node.split(/(\*[^*]+\*)/g);
                return italicParts.map((part, j) => {
                    if (part.startsWith('*') && part.endsWith('*')) {
                        return <em key={`${i}-${j}`} className="italic">{part.slice(1, -1)}</em>;
                    }
                    return part;
                });
            });
        };

        const parseInline = (text: string) => {
            return parseBreak(parseItalic(parseBold(parseLinks(text))));
        };

        // 3. Block Parsing
        const lines = content.split('\n');
        const blocks: React.ReactNode[] = [];
        let currentList: React.ReactNode[] = [];
        let currentTableRows: string[] = [];
        let currentListType: 'ul' | 'ol' | null = null;
        let currentCode: { lang: string, lines: string[] } | null = null;

        const flushList = () => {
            if (currentList.length > 0) {
                const Tag = currentListType === 'ol' ? 'ol' : 'ul';
                blocks.push(
                    <Tag key={`${Tag}-${blocks.length}`} className={`${Tag === 'ol' ? 'list-decimal' : 'list-disc'} pl-5 mb-3 space-y-2`}>
                        {currentList}
                    </Tag>
                );
                currentList = [];
            }
        };

        const flushTable = () => {
            if (currentTableRows.length === 0) return;

            // Filter out separator rows and potentially empty/malformed rows
            const rows = currentTableRows.filter(r =>
                !(r.includes('---') && r.includes('|') && !r.match(/[a-zA-Z0-9]/)) &&
                r.trim().length > 0
            );

            if (rows.length > 0) {
                // Determine header (assume first row if separator followed, or just first row)
                const hasHeader = currentTableRows.some(r => r.includes('---'));

                blocks.push(
                    <div key={`table-${blocks.length}`} className={`my-6 overflow-x-auto rounded-xl border shadow-sm ${isDarkTheme ? 'border-slate-700 bg-slate-900' : 'border-slate-200 shadow-sm bg-white'}`}>
                        <table className="w-full text-left border-collapse">
                            <thead>
                                {rows.slice(0, 1).map((row, ri) => {
                                    const cells = row.split('|').filter((c, i, arr) => i > 0 && i < arr.length - 1);
                                    return (
                                        <tr key={ri} className={`${isDarkTheme ? 'bg-slate-800 border-b border-slate-700' : 'bg-slate-50 border-b border-slate-200'}`}>
                                            {cells.map((cell, ci) => (
                                                <th key={ci} className={`px-4 py-3 text-[10px] font-black uppercase tracking-wider whitespace-nowrap ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                                    {parseInline(cell.trim())}
                                                </th>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </thead>
                            <tbody className={`divide-y ${isDarkTheme ? 'divide-slate-800' : 'divide-slate-100'}`}>
                                {rows.slice(hasHeader ? 1 : 0).map((row, ri) => {
                                    const cells = row.split('|').filter((c, i, arr) => i > 0 && i < arr.length - 1);
                                    return (
                                        <tr key={ri} className={`${isDarkTheme ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/50'} transition-colors`}>
                                            {cells.map((cell, ci) => (
                                                <td key={ci} className={`px-4 py-3 text-[11px] leading-relaxed align-top min-w-[140px] ${isDarkTheme ? 'text-slate-300' : 'text-slate-700'}`}>
                                                    {parseInline(cell.trim())}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                );
            }
            currentTableRows = [];
        };

        lines.forEach((line, idx) => {
            const trimmed = line.trim();

            // 3.1 Handle Code Blocks
            if (trimmed.startsWith('```')) {
                if (currentCode) {
                    const codeText = currentCode.lines.join('\n');
                    const lang = currentCode.lang;

                    blocks.push(
                        <div key={`code-${idx}`} className="my-6 rounded-2xl overflow-hidden bg-[#1e1e2e] shadow-2xl border border-white/5 group/code scale-[1.01] transition-transform">
                            {/* Header with dots and icons */}
                            <div className="px-5 py-3 bg-[#181825] border-b border-white/5 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                                        <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] border-l border-white/10 pl-4">{lang || 'code'}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    {(lang === 'html' || lang === 'htm' || codeText.trim().startsWith('<')) && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleOpenPreview('HTML Preview', codeText); }}
                                            className="p-1.5 hover:bg-emerald-500/20 rounded-lg transition-all text-emerald-400 hover:text-emerald-300"
                                            title="Preview HTML"
                                        >
                                            <Play className="w-4 h-4" />
                                        </button>
                                    )}
                                    <button className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white">
                                        <Maximize2 className="w-4 h-4" />
                                    </button>
                                    <CopyButton text={codeText} />
                                </div>
                            </div>
                            <pre className="p-6 overflow-x-auto custom-scrollbar bg-[#1e2030]">
                                <code className="text-[12px] font-mono leading-relaxed text-[#cdd6f4] whitespace-pre block select-all">
                                    {codeText}
                                </code>
                            </pre>
                        </div>
                    );
                    currentCode = null;
                } else {
                    flushList();
                    flushTable();
                    currentCode = { lang: trimmed.substring(3).toLowerCase(), lines: [] };
                }
                return;
            }

            if (currentCode) {
                currentCode.lines.push(line);
                return;
            }

            const indentMatch = line.match(/^(\s*)/);
            const indentLevel = indentMatch ? Math.floor(indentMatch[0].length / 2) : 0; // 2 spaces = 1 level

            const listMatch = trimmed.match(/^(\d+\.|[\*\-•])\s+(.*)/);
            const isTable = trimmed.startsWith('|') && trimmed.endsWith('|');
            const isSeparator = trimmed.includes('|') && trimmed.includes('-') && !trimmed.match(/[a-zA-Z0-9]/);

            if (listMatch) {
                flushTable();
                const marker = listMatch[1];
                const clean = listMatch[2];
                const isOrdered = /^\d+/.test(marker);
                const newType = isOrdered ? 'ol' : 'ul';

                // If type changes (and not just an indent), flush
                if (currentListType && currentListType !== newType && indentLevel === 0) {
                    flushList();
                }
                currentListType = newType;

                let listStyle = isOrdered ? "list-decimal" : "list-disc";
                let listMargin = "ml-0";

                if (!isOrdered) {
                    if (indentLevel >= 1) listStyle = "list-[circle]";
                    if (indentLevel >= 2) listStyle = "list-[square]";
                }

                if (indentLevel >= 1) listMargin = "ml-6";
                if (indentLevel >= 2) listMargin = "ml-12";

                const liValue = isOrdered ? parseInt(marker) : undefined;

                currentList.push(
                    <li
                        key={`li-${idx}`}
                        value={liValue}
                        className={`leading-relaxed pl-1 ${listStyle} ${listMargin} mb-1`}
                        style={{ color: isDarkTheme ? '#94a3b8' : '#475569' }}
                    >
                        <span style={{ color: isDarkTheme ? '#cbd5e1' : '#334155' }}>
                            {parseInline(clean)}
                        </span>
                    </li>
                );
            } else if (isTable || isSeparator) {
                flushList();
                currentTableRows.push(trimmed);
            } else {
                flushList();
                flushTable();

                if (trimmed) {
                    if (trimmed.startsWith('### ')) {
                        blocks.push(<h3 key={`h-${idx}`} className={`font-black text-[13px] mb-2 mt-4 flex items-center gap-2 ${isDarkTheme ? 'text-slate-200' : 'text-slate-800'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isDarkTheme ? 'bg-slate-600' : 'bg-slate-400'}`} />
                            {parseInline(trimmed.substring(4))}
                        </h3>);
                    } else if (trimmed.startsWith('## ')) {
                        blocks.push(<h2 key={`h2-${idx}`} className={`font-black text-lg mb-4 mt-8 pb-2 border-b tracking-tight flex items-center gap-3 ${isDarkTheme ? 'border-slate-700 text-slate-100' : 'border-slate-200 text-slate-900'}`}>
                            <div className="w-2.5 h-2.5 rounded-lg bg-indigo-500 shadow-lg shadow-indigo-100 rotate-45" />
                            {parseInline(trimmed.substring(3))}
                        </h2>);
                    } else if (trimmed.startsWith('# ')) {
                        blocks.push(<h1 key={`h1-${idx}`} className={`font-black text-2xl mb-6 mt-10 tracking-tighter ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>{parseInline(trimmed.substring(2))}</h1>);
                    } else if (trimmed.startsWith('> ')) {
                        blocks.push(
                            <div key={`bq-${idx}`} className={`pl-4 border-l-4 my-4 py-1 rounded-r-lg ${isDarkTheme ? 'border-slate-600 bg-slate-800/50' : 'border-slate-300 bg-slate-50'}`}>
                                <div className={`italic text-xs leading-relaxed ${isDarkTheme ? 'text-slate-400' : 'text-slate-700'}`}>{parseInline(trimmed.substring(2))}</div>
                            </div>
                        );
                    } else {
                        blocks.push(<div key={`p-${idx}`} className="mb-2 last:mb-0 leading-relaxed min-h-[1.2em]">{parseInline(trimmed)}</div>);
                    }
                }
            }
        });

        flushList();
        flushTable();

        // Append Actions if any
        if (role === 'ai' && extractedActions.length > 0) {
            blocks.push(
                <div key="actions" className={`flex flex-wrap gap-1.5 mt-4 pt-4 border-t ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                    {extractedActions.map((action, i) => (
                        <button
                            key={`action-${i}`}
                            onClick={() => onActionClick && onActionClick(action)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700 hover:border-slate-600' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300'}`}
                        >
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            {action}
                        </button>
                    ))}
                </div>
            );
        }


        if (currentList.length > 0) {
            blocks.push(<ul key={`ul-end`} className="list-disc pl-5 mb-0 space-y-1">{currentList}</ul>);
        }

        return blocks.length > 0 ? blocks : parseInline(content);
    }, [handleOpenPreview, isDarkTheme]);

    const [isPageDropdownVisible, setIsPageDropdownVisible] = useState(false);
    const [animatePageDropdownIn, setAnimatePageDropdownIn] = useState(false);

    useEffect(() => {
        if (isPageDropdownOpen) {
            setIsPageDropdownVisible(true);
            const timer = setTimeout(() => setAnimatePageDropdownIn(true), 10);
            return () => clearTimeout(timer);
        } else {
            setAnimatePageDropdownIn(false);
            const timer = setTimeout(() => setIsPageDropdownVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isPageDropdownOpen]);

    const memoizedMessages = useMemo(() => (
        <>
            {messages.map((m, idx) => (
                <div key={m.id || idx} className={`flex ${m.sender === 'visitor' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[85%] lg:max-w-[75%] p-3.5 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${m.sender === 'visitor'
                        ? (isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-200 rounded-tl-none shadow-slate-950/20' : 'bg-white border-slate-100 text-slate-700 rounded-tl-none')
                        : m.sender === 'ai'
                            ? (isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-200 rounded-tr-none shadow-slate-950/20' : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tr-none')
                            : 'bg-slate-800 text-white rounded-tr-none'
                        }`}>
                        {m.sender !== 'visitor' && (
                            <div className="flex items-center gap-1.5 mb-1.5 opacity-70 border-b border-black/5 pb-1">
                                {m.sender === 'ai' ? <Bot className="w-3 h-3 text-slate-500" /> : <User className="w-3 h-3" />}
                                <span className="text-[9px] font-black uppercase tracking-widest">
                                    {m.sender === 'ai'
                                        ? (m.bot_name ? `AI Assistant (${m.bot_name})` : 'AI Assistant')
                                        : 'You'}
                                </span>
                            </div>
                        )}
                        {renderContent(m.message, m.sender, (action) => setReply(action))}
                        <div className={`text-[9px] font-bold mt-1 ${m.sender === 'visitor' ? 'text-slate-400' :
                            m.sender === 'ai' ? 'text-slate-400' : 'text-white/50'
                            }`}>
                            {formatDate(m.created_at)}
                        </div>
                    </div>
                </div>
            ))}
            {msgLoading && messages.length === 0 && <div className="p-10 text-center text-slate-300">Loading messages...</div>}
        </>
    ), [messages, msgLoading, isDarkTheme, formatDate, renderContent]);

    // identification Filter logic continues...
    return (
        <div className={`flex flex-col lg:flex-row gap-4 lg:gap-6 h-[calc(100vh-140px)] lg:h-[800px] p-2 lg:p-4 rounded-[32px] border shadow-inner overflow-hidden ${isDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/30 border-slate-100'}`}>
            {/* Left: Conversations List */}
            <div className={`w-full lg:w-80 flex flex-col gap-4 rounded-[28px] border shadow-sm overflow-hidden flex-shrink-0 ${mobileView === 'list' ? 'flex' : 'hidden lg:flex'} ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                {/* Search & Tabs */}
                <div className={`p-5 border-b z-10 space-y-4 ${isDarkTheme ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`w-full pl-9 pr-20 py-2.5 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-white focus:ring-slate-700' : 'bg-slate-50 border-slate-100 text-slate-700 focus:ring-slate-200'}`}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                                onClick={() => fetchConversations()}
                                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                                title="Làm mới"
                            >
                                <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`p-1.5 rounded-lg transition-all ${isFilterOpen || filterIdType ? 'bg-slate-100 text-slate-600' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-600'}`}
                                title="Bộ lọc nâng cao"
                            >
                                <Filter className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setShowExportModal(true)}
                                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all"
                                title="Xuất CSV"
                            >
                                <Download className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {!isGroup && (
                        <div className={`flex p-1 rounded-xl mb-5 ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-100'}`}>
                            <button
                                onClick={() => setSource('web')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${source === 'web' ? (isDarkTheme ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-700 shadow-sm') : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Globe className={`w-3.5 h-3.5 ${source === 'web' ? (isDarkTheme ? 'text-white' : 'text-slate-700') : 'text-slate-400'}`} /> Web
                            </button>
                            <button
                                onClick={() => setSource('zalo')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${source === 'zalo' ? (isDarkTheme ? 'bg-slate-700 text-[#0068ff] shadow-sm' : 'bg-white text-[#0068ff] shadow-sm') : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <MessageSquare className={`w-3.5 h-3.5 ${source === 'zalo' ? 'text-[#0068ff]' : 'text-slate-400'}`} /> Zalo
                            </button>
                            <button
                                onClick={() => setSource('meta')}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${source === 'meta' ? (isDarkTheme ? 'bg-slate-700 text-[#0668E1] shadow-sm' : 'bg-white text-[#0668E1] shadow-sm') : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Facebook className={`w-3.5 h-3.5 ${source === 'meta' ? 'text-[#0668E1]' : 'text-slate-400'}`} /> Meta
                            </button>
                        </div>
                    )}
                </div>

                {/* Sub-source Filter (Page/OA) - Premium Custom Dropdown */}
                {(source === 'meta' || source === 'zalo') && availablePages.filter(p => p.type === source).length > 0 && (
                    <div className="px-5 relative">
                        <div
                            onClick={() => setIsPageDropdownOpen(!isPageDropdownOpen)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 border rounded-2xl cursor-pointer transition-all group ${isDarkTheme ? 'bg-slate-800 border-slate-700 hover:bg-slate-700/50' : 'bg-slate-50 border-slate-100 hover:bg-slate-100/50'}`}
                        >
                            <div className="flex items-center gap-2 overflow-hidden">
                                {(() => {
                                    const activePage = availablePages.find(p => `${source}_${p.id}` === selectedPageId);
                                    if (activePage) {
                                        return (
                                            <>
                                                <div className="w-5 h-5 rounded-full overflow-hidden border border-white shadow-sm flex-shrink-0">
                                                    {activePage.avatar ? (
                                                        <img
                                                            src={activePage.avatar}
                                                            alt={activePage.name}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).style.display = 'none';
                                                                (e.target as HTMLImageElement).parentElement!.classList.add('bg-slate-200', 'flex', 'items-center', 'justify-center');
                                                                (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-[10px] font-bold text-slate-400 uppercase">${activePage.name.substring(0, 1)}</span>`;
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-400 uppercase">
                                                            {activePage.name.substring(0, 1)}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`text-[10px] font-black uppercase tracking-wider truncate ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>
                                                    {activePage.name}
                                                </span>
                                            </>
                                        );
                                    }
                                    return (
                                        <>
                                            <div className="w-5 h-5 rounded-full bg-slate-200 border border-white shadow-sm flex items-center justify-center text-slate-400 flex-shrink-0">
                                                <Layers className="w-3 h-3" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                                Tất cả {source === 'zalo' ? 'Zalo OA' : 'Facebook Pages'}
                                            </span>
                                        </>
                                    );
                                })()}
                            </div>
                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isPageDropdownOpen ? 'rotate-180' : ''}`} />
                        </div>

                        {/* Dropdown Menu */}
                        {isPageDropdownVisible && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsPageDropdownOpen(false)}></div>
                                <div className={`absolute left-5 right-5 top-full mt-2 border rounded-2xl shadow-2xl z-50 overflow-hidden transform transition-all duration-200 ${animatePageDropdownIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'} ${isDarkTheme ? 'bg-slate-900 border-slate-800 shadow-slate-950/50' : 'bg-white border-slate-100 shadow-slate-200/50'}`}>
                                    <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                        {/* Option: All */}
                                        <div
                                            onClick={() => {
                                                setSelectedPageId('');
                                                setIsPageDropdownOpen(false);
                                            }}
                                            className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b last:border-0 ${isDarkTheme ? 'hover:bg-slate-800 border-slate-800' : 'hover:bg-slate-50 border-slate-50'} ${!selectedPageId ? (isDarkTheme ? 'bg-slate-800/50' : 'bg-amber-50/50') : ''}`}
                                        >
                                            <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shadow-sm flex-shrink-0" />
                                            <span className={`text-[10px] font-bold tracking-wide uppercase ${!selectedPageId ? (isDarkTheme ? 'text-slate-200' : 'text-slate-600') : 'text-slate-500'}`}>
                                                Tất cả {source === 'zalo' ? 'Zalo OA' : 'Facebook Pages'}
                                            </span>
                                        </div>

                                        {/* Dynamic Options */}
                                        {availablePages
                                            .filter(p => p.type === source)
                                            .map(page => (
                                                <div
                                                    key={page.id}
                                                    onClick={() => {
                                                        setSelectedPageId(`${source}_${page.id}`);
                                                        setIsPageDropdownOpen(false);
                                                    }}
                                                    className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors border-b last:border-0 ${isDarkTheme ? 'hover:bg-slate-800 border-slate-800' : 'hover:bg-slate-50 border-slate-50'} ${selectedPageId === `${source}_${page.id}` ? (isDarkTheme ? 'bg-slate-800/80' : 'bg-amber-50/50') : ''}`}
                                                >
                                                    <div className="w-6 h-6 rounded-lg overflow-hidden border border-white shadow-sm flex-shrink-0">
                                                        {page.avatar ? (
                                                            <img
                                                                src={page.avatar}
                                                                alt={page.name}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    (e.target as HTMLImageElement).style.display = 'none';
                                                                    (e.target as HTMLImageElement).parentElement!.classList.add('bg-slate-100', 'flex', 'items-center', 'justify-center');
                                                                    (e.target as HTMLImageElement).parentElement!.innerHTML = `<span class="text-[10px] font-bold text-slate-400">${page.name.substring(0, 1).toUpperCase()}</span>`;
                                                                }}
                                                            />
                                                        ) : (
                                                            <div className="w-full h-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                                                {page.name.substring(0, 1).toUpperCase()}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className={`text-[10px] font-bold tracking-wide uppercase truncate ${selectedPageId === `${source}_${page.id}` ? (isDarkTheme ? 'text-white font-black' : 'text-slate-700 font-black') : (isDarkTheme ? 'text-slate-400' : 'text-slate-600')}`}>
                                                        {page.name}
                                                    </span>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Identification Filter */}
                {/* Identification Filter */}
                {/* Identification Filter */}
                {(isFilterOpen || filterIdType || searchTerm || selectedPageId) && (
                    <div className="px-5 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilterIdType(filterIdType === 'has_phone' ? '' : 'has_phone')}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-bold border transition-all flex items-center justify-center gap-1 ${filterIdType === 'has_phone' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}
                            >
                                {filterIdType === 'has_phone' ? <X className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
                                Có SĐT
                            </button>
                            <button
                                onClick={() => setFilterIdType(filterIdType === 'has_email' ? '' : 'has_email')}
                                className={`flex-1 py-1.5 px-2 rounded-lg text-[9px] font-bold border transition-all flex items-center justify-center gap-1 ${filterIdType === 'has_email' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-white text-slate-500 border-slate-100 hover:border-slate-200'}`}
                            >
                                {filterIdType === 'has_email' ? <X className="w-3 h-3" /> : <Mail className="w-3 h-3" />}
                                Có Email
                            </button>
                        </div>
                        {(filterIdType || searchTerm || selectedPageId) && (
                            <button
                                onClick={() => {
                                    setFilterIdType('');
                                    setSearchTerm('');
                                    setSelectedPageId('');
                                }}
                                className="w-full mt-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 hover:bg-slate-50 border border-dashed border-slate-200 transition-all flex items-center justify-center gap-2"
                            >
                                <X className="w-3 h-3" /> Xóa bộ lọc
                            </button>
                        )}
                    </div>
                )}

                {/* List */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar flex flex-col">
                    <div className="flex-1 space-y-2">
                        {loading && conversations.length === 0 ? (
                            <div className="p-10 text-center"><div className="inline-block w-6 h-6 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin"></div></div>
                        ) : conversations.length === 0 ? (
                            <div className="p-10 text-center text-xs text-slate-400 font-medium italic">Không tìm thấy hội thoại</div>
                        ) : (
                            source === 'org' ? (
                                groupedConversations.map(([userId, userConvs]: [string, Conversation[]]) => {
                                    const isExpanded = expandedGroups[userId] ?? true; // Default to expanded
                                    return (
                                        <div key={userId} className="mb-2">
                                            {/* User Header */}
                                            <div
                                                className={`px-2 py-1.5 flex items-center justify-between gap-2 mb-1 cursor-pointer rounded-lg transition-colors group ${isDarkTheme ? 'hover:bg-slate-800' : 'hover:bg-slate-50'}`}
                                                onClick={() => setExpandedGroups(prev => ({ ...prev, [userId]: !isExpanded }))}
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border text-slate-400 group-hover:shadow-sm transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 group-hover:bg-slate-700' : 'bg-slate-100 border-slate-200 group-hover:bg-white'}`}>
                                                        {source === 'org' ? <Bot className="w-3 h-3 text-brand" /> : <User className="w-3 h-3" />}
                                                    </div>
                                                    <span className={`text-[10px] font-black uppercase tracking-wider truncate max-w-[180px] ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                                        {userId === 'unknown' ? (source === 'org' ? 'AI Consultant' : 'Khách hàng') : userId}
                                                    </span>
                                                    <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-bold transition-colors ${isDarkTheme ? 'bg-slate-800 text-slate-500 group-hover:bg-slate-700' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                                                        {userConvs.length}
                                                    </span>
                                                </div>
                                                <ChevronDown className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                            </div>

                                            {/* Conversations */}
                                            {isExpanded && (
                                                <div className={`space-y-1 pl-3 border-l-2 ml-2.5 animate-in slide-in-from-top-1 duration-200 ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                                                    {userConvs.map(c => (
                                                        <div
                                                            key={c.id}
                                                            onClick={() => setSelectedConv(c)}
                                                            className={`p-2 rounded-xl cursor-pointer border transition-all ${selectedConv?.id === c.id
                                                                ? (isDarkTheme ? 'bg-slate-800 border-slate-700 shadow-sm' : 'bg-slate-100 border-slate-300 shadow-sm')
                                                                : (isDarkTheme ? 'bg-slate-900 border-transparent hover:border-slate-800' : 'bg-slate-50 border-transparent hover:border-slate-100')
                                                                }`}
                                                        >
                                                            <h4 className={`text-[11px] font-bold truncate mb-0.5 ${selectedConv?.id === c.id ? (isDarkTheme ? 'text-white' : 'text-slate-900') : (isDarkTheme ? 'text-slate-300' : 'text-slate-700')}`}>
                                                                {c.first_name || 'Hội thoại mới'}
                                                            </h4>
                                                            <div className="flex items-center justify-between">
                                                                <p className="text-[9px] text-slate-400 font-medium truncate max-w-[120px]">
                                                                    {c.last_message || '...'}
                                                                </p>
                                                                <span className="text-[8px] font-bold text-slate-300">{formatDate(c.updated_at || c.created_at)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                conversations.map(c => {
                                    const isZalo = c.visitor_id.startsWith('zalo_');
                                    const isMeta = c.visitor_id.startsWith('meta_');
                                    return (
                                        <div
                                            key={c.id}
                                            onClick={() => setSelectedConv(c)}
                                            className={`p-2.5 rounded-2xl cursor-pointer border transition-all hover:shadow-md ${selectedConv?.id === c.id
                                                ? (isDarkTheme ? 'bg-slate-800 border-slate-700 shadow-sm' : 'bg-slate-100 border-slate-300 shadow-sm')
                                                : (isDarkTheme ? 'bg-slate-900 border-transparent hover:border-slate-800' : 'bg-white border-transparent hover:border-slate-100')
                                                }`}
                                        >
                                            <div className="flex items-start justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border ${isDarkTheme ? 'border-slate-700' : 'border-slate-100'}`}>
                                                        {getAvatar(c)}
                                                    </div>
                                                    <span className="text-[9px] font-bold text-slate-400">{formatDate(c.last_message_at)}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {isZalo ? <MessageCircle className="w-2.5 h-2.5 text-blue-500" /> : isMeta ? <Facebook className="w-2.5 h-2.5 text-blue-600" /> : <Globe className="w-2.5 h-2.5 text-slate-400" />}
                                                    {/* Chỉ hiển thị badge AI/Human cho Web chat, không cho Zalo/Meta */}
                                                    {!isZalo && !isMeta && c.status === 'human' && <span className="px-1 py-0.5 bg-slate-800 text-white text-[7px] font-black uppercase rounded">Human</span>}
                                                    {!isZalo && !isMeta && c.status === 'ai' && <span className="px-1 py-0.5 bg-slate-100 text-slate-700 text-[7px] font-black uppercase rounded">AI Agent</span>}
                                                </div>
                                            </div>
                                            <h4 className={`text-[11px] font-bold truncate mb-0.5 flex items-center gap-1.5 ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>
                                                {c.is_blocked ? <ShieldAlert className="w-3 h-3 text-rose-500 shrink-0" /> : null}
                                                <span className="truncate">{getDisplayName(c)}</span>
                                            </h4>
                                            <p className={`text-[9px] line-clamp-1 leading-relaxed opacity-80 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                                {c.last_message || '...'}
                                            </p>
                                        </div>
                                    );
                                })
                            )
                        )}
                    </div>
                </div>

                {/* Pagination Controls - Fixed at Bottom */}
                {totalPages > 1 && (
                    <div className="p-3 border-t border-slate-100 bg-white flex items-center justify-between">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-all text-slate-500 hover:text-slate-700"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Trang {page} / {totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                            className="p-1.5 hover:bg-slate-100 rounded-lg disabled:opacity-30 transition-all text-slate-500 hover:text-slate-700"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>


            {/* Chat Area */}
            <div
                className={`flex-1 flex flex-col border rounded-[28px] shadow-sm overflow-hidden relative ${mobileView === 'chat' ? 'flex' : 'hidden lg:flex'} ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Drag and Drop Overlay */}
                {isDragging && (
                    <div
                        className="absolute inset-0 z-50 bg-blue-500/10 backdrop-blur-sm border-2 border-blue-500 border-dashed m-4 rounded-3xl flex flex-col items-center justify-center animate-in fade-in duration-200 pointer-events-none"
                    >
                        <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20 mb-4 animate-bounce">
                            <Download className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-blue-600 uppercase tracking-tight">Thả tệp đã gửi</h3>
                        <p className="text-blue-500 font-bold mt-1 text-sm">Hỗ trợ Hình ảnh, PDF, Excel...</p>
                    </div>
                )}

                {/* File Preview Modal */}
                {previewUrl && (
                    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewUrl(null)}>
                        <div className="bg-white rounded-[32px] overflow-hidden w-full max-w-4xl max-h-[90vh] flex flex-col relative shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
                                        {previewType === 'image' ? <Sparkles className="w-5 h-5 text-slate-400" /> : <FileText className="w-5 h-5 text-blue-500" />}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight leading-none mb-1">Xem trước tài liệu</h4>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{previewType === 'image' ? 'Hình ảnh' : 'Tải lên'}</p>

                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a href={previewUrl} download className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-all">
                                        <Download className="w-5 h-5" />
                                    </a>
                                    <button onClick={() => setPreviewUrl(null)} className="p-2.5 hover:bg-rose-50 rounded-xl text-slate-400 hover:text-rose-500 transition-all">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-auto bg-slate-900/5 p-4 flex items-center justify-center min-h-[400px]">
                                {previewType === 'image' ? (
                                    <img src={previewUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-lg shadow-black/10" />
                                ) : (
                                    <iframe src={previewUrl} className="w-full h-full min-h-[600px] border-none rounded-lg bg-white shadow-lg" />
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {selectedConv ? (
                    <>
                        {/* Header */}
                        <div className={`px-4 lg:px-6 py-4 border-b flex items-center justify-between ${isDarkTheme ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/50 border-slate-100'}`}>
                            <div className="flex items-center gap-2 lg:gap-3">
                                {/* Mobile Back Button */}
                                <button
                                    onClick={() => setMobileView('list')}
                                    className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-slate-600"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <div className="w-8 h-8 lg:w-10 lg:h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 overflow-hidden">
                                    {getAvatar(selectedConv)}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className={`text-[11px] lg:text-sm font-black uppercase tracking-tight truncate max-w-[120px] lg:max-w-none ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>
                                            {getDisplayName(selectedConv)}
                                        </h3>
                                        {selectedConv.is_blocked ? (
                                            <div className="px-1.5 py-0.5 bg-rose-100 text-rose-600 text-[8px] font-black uppercase rounded border border-rose-200 flex items-center gap-1">
                                                <ShieldAlert className="w-2.5 h-2.5" />
                                                Blocked
                                            </div>
                                        ) : null}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${selectedConv.status === 'ai' ? 'bg-emerald-500' : 'bg-slate-800'}`}></div>
                                        <span className="text-[8px] lg:text-[10px] font-bold text-slate-400 uppercase">
                                            {isGroup ? 'AI Consultant' : (selectedConv.status === 'ai' ? 'AI Agent' : 'Human')}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5 lg:gap-2">
                                {source !== 'org' && (
                                    <button
                                        onClick={() => toggleStatus(selectedConv.status === 'ai' ? 'human' : 'ai')}
                                        className={`px-2 lg:px-3 py-1.5 rounded-lg text-[9px] lg:text-[10px] font-black uppercase tracking-widest border shadow-sm transition-all flex items-center gap-2 ${selectedConv.status === 'human'
                                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:shadow'
                                            }`}
                                    >
                                        {selectedConv.status === 'human' ? (
                                            <>
                                                <div className="w-1 h-1 lg:w-1.5 lg:h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="hidden sm:inline">Trực</span>
                                            </>
                                        ) : (
                                            <span className="hidden sm:inline">CHĂM SÓC</span>
                                        )}
                                    </button>
                                )}

                                {/* Mobile Journey Toggle */}
                                <button
                                    onClick={() => setMobileView('journey')}
                                    className="lg:hidden p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 transition-all"
                                    title="Hành trình"
                                >
                                    <Activity className="w-4 h-4" />
                                </button>

                                <button
                                    onClick={() => handleBlockIP()}
                                    className={`p-1.5 lg:p-2 border rounded-lg transition-all ${selectedConv.is_blocked ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-600/20' : 'border-slate-200 text-slate-400 hover:text-rose-600 hover:bg-rose-50'}`}
                                    title={selectedConv.is_blocked ? "Bỏ chặn IP" : "Chặn IP"}
                                >
                                    <ShieldAlert className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={handleDeleteChat}
                                    className="p-1.5 lg:p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all ml-1.5"
                                    title="Xóa hội thoại"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleOpenProfile()}
                                    className="p-1.5 lg:p-2 border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                    title="View Profile"
                                >
                                    <UserCheck className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            className={`flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar transition-colors ${isDarkTheme ? 'bg-slate-950/30' : 'bg-slate-50/30'}`}
                            ref={scrollRef}
                            onScroll={handleScroll}
                        >
                            {/* Load More Indicator */}
                            {(loadingMoreMessages || hasMoreMessages) && messages.length > 0 && (
                                <div className="flex justify-center py-3">
                                    {loadingMoreMessages ? (
                                        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-100 px-4 py-2 rounded-full">
                                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                                            Đang tải tin nhắn cũ...
                                        </div>
                                    ) : (
                                        <button
                                            onClick={fetchMoreMessages}
                                            className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-4 py-2 rounded-full transition-all"
                                        >
                                            <ChevronLeft className="w-3.5 h-3.5 rotate-90" />
                                            Tải thêm tin nhắn cũ
                                        </button>
                                    )}
                                </div>
                            )}
                            {memoizedMessages}
                        </div>

                        {/* Footer Input */}
                        {source !== 'org' && (
                            <div className={`p-4 border-t ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                {(() => {
                                    if (!selectedConv || (selectedConv.source !== 'meta' && selectedConv.source !== 'zalo')) return null;
                                    if (!lastVisitorMsgAt) return null;

                                    const lastAt = new Date(lastVisitorMsgAt).getTime();
                                    const now = Date.now();
                                    const diffHours = (now - lastAt) / (1000 * 60 * 60);

                                    const limit = selectedConv.source === 'meta' ? 24 : 48;
                                    const isExpired = diffHours >= limit;

                                    if (!isExpired) {
                                        const remainingHours = Math.floor(limit - diffHours);
                                        const remainingMins = Math.floor(((limit - diffHours) % 1) * 60);
                                        return (
                                            <div className="mb-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-2 text-[10px] font-bold text-blue-600 animate-in fade-in slide-in-from-bottom-1">
                                                <Clock className="w-3 h-3" />
                                                Cửa sổ phản hồi {selectedConv.source === 'meta' ? '24h' : '48h'} đang mở. Còn lại: {remainingHours}h {remainingMins}p
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="mb-2 px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-lg flex items-center gap-2 text-[10px] font-bold text-rose-600 animate-in shake duration-500">
                                            <ShieldAlert className="w-3.5 h-3.5 animate-pulse" />
                                            Cửa sổ phản hồi {limit}h đã đóng. Bạn không thể phản hồi tin nhắn này theo quy tắc của {selectedConv.source === 'meta' ? 'Meta' : 'Zalo'}.
                                        </div>
                                    );
                                })()}
                                <div className="relative">
                                    <textarea
                                        value={reply}
                                        onChange={e => setReply(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                                        placeholder={selectedConv.status === 'human' ? "Nhập tin nhắn..." : "Còn tiếp quản để chat..."}
                                        disabled={(() => {
                                            if (selectedConv.status !== 'human') return true;
                                            if (!lastVisitorMsgAt) return false;
                                            const diffHours = (Date.now() - new Date(lastVisitorMsgAt).getTime()) / (1000 * 60 * 60);
                                            const limit = selectedConv.source === 'meta' ? 24 : 48;
                                            return (selectedConv.source === 'meta' || selectedConv.source === 'zalo') && diffHours >= limit;
                                        })()}
                                        className={`w-full pl-4 pr-12 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 min-h-[50px] resize-none disabled:opacity-50 disabled:cursor-not-allowed transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-white focus:ring-slate-700 placeholder-slate-500' : 'bg-slate-50 border-slate-100 text-slate-800 focus:ring-slate-800/10'}`}
                                    />
                                    <button
                                        onClick={handleSendReply}
                                        disabled={!reply.trim() || selectedConv.status !== 'human'}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-900 text-white rounded-lg hover:bg-black transition-all disabled:opacity-50"
                                    >
                                        <Send className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="mt-2 text-[10px] text-slate-400 font-medium text-center">
                                    Sending a reply automatically pauses AI for this conversation for 30 minutes.
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center opacity-30">
                        <MessageSquare className="w-12 h-12 text-slate-300 mb-4" />
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Select a conversation</p>
                    </div>
                )}
            </div>

            {/* Drag Handle (Desktop) */}
            <div
                className={`hidden lg:flex w-1 bg-transparent hover:bg-blue-400 cursor-col-resize items-center justify-center transition-colors group z-10 ${isResizingRight ? 'bg-blue-500' : ''}`}
                onMouseDown={startResizingRight}
            >
                <div className={`w-[2px] h-8 bg-slate-300 rounded-full group-hover:bg-white transition-colors ${isResizingRight ? 'bg-white' : ''}`} />
            </div>

            {/* Journey / Right Sidebar */}
            <div
                className={`flex-col border-l rounded-r-[28px] overflow-hidden ${mobileView === 'journey' ? 'flex w-full absolute inset-0 z-20 bg-white' : 'hidden lg:flex'} ${isDarkTheme ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50/50 border-slate-200'}`}
                style={mobileView !== 'journey' ? { width: rightSidebarWidth } : {}}
            >
                {source === 'org' && (
                    <div className={`flex flex-col h-full border-l ${isDarkTheme ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        {/* Header & Tabs */}
                        <div className={`p-4 border-b ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <div className="flex items-center gap-2 mb-4">
                                <button onClick={() => setMobileView('chat')} className="lg:hidden p-1 text-slate-400 hover:text-slate-600">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <h4 className={`text-[10px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Hội thoại</h4>
                            </div>

                            {/* Tabs */}
                            <div className={`flex p-1 rounded-xl ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                {(['media', 'files', 'links'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setDocTab(tab)}
                                        className={`flex-1 py-1.5 text-[10px] font-bold capitalize rounded-lg transition-all ${docTab === tab
                                            ? (isDarkTheme ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-700 shadow-sm')
                                            : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        {tab}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                            {currentExtractedItems.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-2">
                                    {docTab === 'media' ? <Maximize2 className="w-8 h-8 opacity-50" /> :
                                        docTab === 'files' ? <FileText className="w-8 h-8 opacity-50" /> :
                                            <ExternalLink className="w-8 h-8 opacity-50" />}
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Không có {docTab}</span>
                                </div>
                            ) : (
                                Object.entries(groupedExtractedItems).map(([date, groupItems]) => (
                                    <div key={date} className="mb-6 last:mb-0">
                                        <h5 className={`text-[10px] font-black uppercase tracking-widest mb-3 sticky top-0 py-1 z-10 ${isDarkTheme ? 'bg-slate-900 text-slate-500' : 'bg-slate-50 text-slate-400'}`}>
                                            {date}
                                        </h5>
                                        <div className={`grid gap-3 ${docTab === 'media' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                                            {groupItems.map((item, idx) => (
                                                docTab === 'media' ? (
                                                    <div
                                                        key={idx}
                                                        onClick={() => { setPreviewUrl(item.url); setPreviewType('image'); }}
                                                        className="group relative aspect-square bg-slate-200 rounded-xl overflow-hidden border border-slate-200 hover:shadow-md transition-all cursor-pointer"
                                                    >
                                                        <img src={item.url} alt="Media" className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                                                            <Maximize2 className="w-5 h-5 text-white" />
                                                        </div>
                                                    </div>
                                                ) : docTab === 'files' ? (
                                                    <div
                                                        key={idx}
                                                        onClick={() => { setPreviewUrl(item.url); setPreviewType('file'); }}
                                                        className={`flex items-center gap-3 p-3 border rounded-xl transition-all group cursor-pointer ${isDarkTheme ? 'bg-slate-800 border-slate-700 hover:border-blue-500 hover:bg-slate-700/50' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-sm'}`}
                                                    >
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-blue-500 shrink-0 ${isDarkTheme ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                                                            <FileText className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className={`text-[11px] font-bold truncate transition-colors ${isDarkTheme ? 'text-slate-200 group-hover:text-blue-400' : 'text-slate-700 group-hover:text-blue-600'}`}>
                                                                {decodeURIComponent(item.name || 'document')}
                                                            </div>
                                                            <div className="text-[9px] text-slate-400 font-medium">Click to preview</div>
                                                        </div>
                                                        <Maximize2 className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                                    </div>
                                                ) : (
                                                    <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer" className={`flex items-start gap-3 p-3 border rounded-xl transition-all group ${isDarkTheme ? 'bg-slate-800 border-slate-700 hover:border-indigo-500 hover:bg-slate-700/50' : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'}`}>
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-indigo-500 shrink-0 mt-0.5 ${isDarkTheme ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                                                            <ExternalLink className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className={`text-[11px] font-bold break-words line-clamp-2 transition-colors leading-relaxed ${isDarkTheme ? 'text-slate-200 group-hover:text-indigo-400' : 'text-slate-700 group-hover:text-indigo-600'}`}>
                                                                {item.url}
                                                            </div>
                                                        </div>
                                                    </a>
                                                )
                                            ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
                {source !== 'org' && (
                    <>
                        <div className={`p-4 border-b flex items-center justify-between ${isDarkTheme ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100/50 border-slate-200'}`}>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setMobileView('chat')}
                                    className="lg:hidden p-1 text-slate-400 hover:text-slate-600"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <h4 className={`text-[10px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>Hành trình Khách hàng</h4>
                            </div>
                        </div>
                        <div className="px-6 pb-2 pt-4">
                            <div className={`flex p-0.5 rounded-xl border ${isDarkTheme ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                {(['view', 'click', 'other'] as const).map((tab) => (
                                    <button
                                        key={tab}
                                        onClick={() => setJourneyFilter(tab)}
                                        className={`flex-1 py-1 text-[8px] font-black uppercase tracking-tighter rounded-lg transition-all ${journeyFilter === tab
                                            ? (isDarkTheme ? 'bg-slate-700 text-white shadow-sm' : 'bg-white text-slate-800 shadow-sm')
                                            : 'text-slate-400 hover:text-slate-600'
                                            }`}
                                    >
                                        {tab === 'view' ? 'Views' : tab === 'click' ? 'Clicks' : 'Khác'}
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
                                            if (journeyFilter === 'click') return item.type === 'click' || item.title === 'click' || item.title === 'canvas_click' || item.title === 'lead_capture' || item.title === 'phone_detected';
                                            if (journeyFilter === 'other') return item.type !== 'pageview' && item.title !== 'view' && item.title !== 'click' && item.title !== 'canvas_click' && item.title !== 'lead_capture' && item.title !== 'phone_detected';
                                            return true;
                                        })
                                        .map((item, idx) => (
                                            <div key={idx} className="relative pl-6 group">
                                                <div className={`absolute left-[-6px] top-1 w-3 h-3 rounded-full border-2 border-white shadow-sm transition-all group-hover:scale-125 ${(item.type === 'pageview' || item.title === 'view') ? 'bg-blue-500' :
                                                    (item.type === 'click' || item.title === 'click' || item.title === 'canvas_click') ? 'bg-slate-400' :
                                                        (item.title === 'lead_capture' || item.title === 'phone_detected') ? 'bg-emerald-500 font-bold' :
                                                            item.type === 'form' ? 'bg-emerald-500' : 'bg-slate-400'
                                                    }`}></div>
                                                <div className="space-y-1">
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="flex items-center gap-2">
                                                            {(item.type === 'pageview' || item.title === 'view') ? <Globe className="w-3 h-3 text-blue-400" /> :
                                                                (item.title === 'lead_capture' || item.title === 'phone_detected') ? (
                                                                    item.title === 'phone_detected' ? <Phone className="w-3 h-3 text-emerald-500" /> : <FormInput className="w-3 h-3 text-emerald-500" />
                                                                ) :
                                                                    <MousePointer2 className="w-3 h-3 text-slate-400" />
                                                            }
                                                            <span className={`text-[9px] font-black uppercase ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>
                                                                {item.type === 'page_source'
                                                                    ? `${item.title} - ${item.description}`
                                                                    : item.title === 'lead_capture'
                                                                        ? 'Info Identified'
                                                                        : item.title === 'phone_detected'
                                                                            ? 'SĐT Nhận diện'
                                                                            : (item.title || 'Untitled')}
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
                                                    {item.details && <p className={`text-[10px] font-medium leading-relaxed p-2 rounded-lg border shadow-sm break-all ${isDarkTheme ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-white text-slate-500 border-slate-100 shadow-sm'}`}>
                                                        {(item.title === 'scroll' || item.type === 'scroll') && !isNaN(Number(item.details)) ? `${item.details}%` : item.details}
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
                                <div className={`p-6 border-t ${isDarkTheme ? 'bg-slate-800/40 border-slate-700/50' : 'bg-slate-50 border-t border-slate-100'}`}>
                                    <div className="flex items-center gap-3 mb-3 min-w-0">
                                        <div className="w-8 h-8 rounded-xl bg-slate-600 flex items-center justify-center text-white shadow-lg shadow-slate-600/30 shrink-0">
                                            <UserCheck className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="text-[10px] font-black text-slate-700 dark:text-slate-400 uppercase tracking-widest leading-none mb-1">Lead Synced</h4>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <p className={`text-[11px] font-black truncate ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`} title={selectedConv.email}>{selectedConv.email}</p>
                                                {selectedConv.lead_score !== undefined && selectedConv.lead_score > 0 && (
                                                    <div className={`inline-flex items-center justify-center gap-1 px-2 py-0.5 border rounded-lg text-xs font-bold shrink-0 ${isDarkTheme ? 'bg-slate-800/60 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                                        <Zap className="w-3 h-3 fill-slate-500 text-slate-500" />
                                                        {selectedConv.lead_score}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        }
                    </>
                )}
            </div>

            {/* Modals */}
            {
                showCrmModal && crmSubscriber && (
                    <CustomerProfileModal
                        subscriber={crmSubscriber}
                        onClose={() => setShowCrmModal(false)}
                        onUpdate={(updated) => handleUpdateSubscriber(updated.id, updated)}
                        onDelete={handleDeleteSubscriber}
                        allLists={allLists}
                        allSegments={allSegments}
                        allFlows={allFlows}
                        allTags={allTags}
                        checkMatch={(sub, criteria) => checkSegmentMatch(criteria)}
                        onAddToList={async (subId, listId) => { }} // Implement if needed
                        onRemoveFromList={async (subId, listId) => { }} // Implement if needed
                    />
                )
            }

            {/* Export Modal */}
            <Modal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                title="Xuất dữ liệu hội thoại"
                size="md"
            >
                <div className="space-y-6">
                    <div className={`p-4 rounded-2xl border flex items-start gap-4 ${isDarkTheme ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm shrink-0 border ${isDarkTheme ? 'bg-slate-900 text-slate-400 border-slate-700' : 'bg-white text-slate-400 border-slate-100'}`}>
                            <FileText className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <h4 className={`text-sm font-bold ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Cấu hình xuất CSV</h4>
                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Chọn phạm vi Thời gian bạn muốn trích xuất dữ liệu cuộc trò chuyện.</p>

                            <div className={`mt-4 flex p-1 rounded-xl border ${isDarkTheme ? 'bg-slate-900 border-slate-700' : 'bg-slate-100 border-slate-200/50'}`}>
                                {[
                                    { id: 'all', label: 'Tất cả', icon: Sparkles, hide: isGroup },
                                    { id: 'web', label: 'Web', icon: Globe },
                                    { id: 'org', label: 'Consultant', icon: ShieldCheck },
                                    { id: 'zalo', label: 'Zalo', icon: MessageSquare, hide: isGroup },
                                    { id: 'meta', label: 'Meta', icon: Facebook, hide: isGroup }
                                ].filter(s => !s.hide).map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => setExportSource(s.id as any)}
                                        className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight flex items-center justify-center gap-1.5 transition-all ${exportSource === s.id
                                            ? (isDarkTheme ? 'bg-slate-800 text-white shadow-sm border border-slate-700' : 'bg-white text-slate-900 shadow-sm border border-slate-200')
                                            : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        <s.icon className={`w-3 h-3 ${exportSource === s.id ? (isDarkTheme ? 'text-white' : 'text-slate-900') : 'text-slate-300'}`} />
                                        {s.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button
                            onClick={() => setExportRange('current')}
                            className={`p-4 rounded-2xl border-2 transition-all text-left group ${exportRange === 'current' ? (isDarkTheme ? 'border-slate-600 bg-slate-800' : 'border-slate-800 bg-slate-50') : (isDarkTheme ? 'border-slate-800 hover:border-slate-700 bg-slate-900' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50')}`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-colors ${exportRange === 'current' ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/20' : (isDarkTheme ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-white text-slate-400 border border-slate-200')}`}>
                                <Zap className="w-4 h-4" />
                            </div>
                            <div className={`font-bold text-xs uppercase tracking-tight ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Bộ lọc hiện tại</div>
                            <p className="text-[10px] text-slate-500 mt-1 font-medium">{filterDate ? `${filterDate}` : 'Tất cả Thời gian'}</p>
                        </button>

                        <button
                            onClick={() => setExportRange('custom')}
                            className={`p-4 rounded-2xl border-2 transition-all text-left group ${exportRange === 'custom' ? (isDarkTheme ? 'border-slate-600 bg-slate-800' : 'border-slate-800 bg-slate-50') : (isDarkTheme ? 'border-slate-800 hover:border-slate-700 bg-slate-900' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50')}`}
                        >
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 transition-colors ${exportRange === 'custom' ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/20' : (isDarkTheme ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-white text-slate-400 border border-slate-200')}`}>
                                <Clock className="w-4 h-4" />
                            </div>
                            <div className={`font-bold text-xs uppercase tracking-tight ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Khoảng tùy chọn</div>
                            <p className="text-[10px] text-slate-500 mt-1 font-medium">Tự chọn ngày bắt đầu & kết thúc</p>
                        </button>
                    </div>

                    {exportRange === 'custom' && (
                        <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 animate-in slide-in-from-top-2 duration-300">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày bắt đầu</label>
                                <input
                                    type="date"
                                    value={customExportStart}
                                    onChange={(e) => setCustomExportStart(e.target.value)}
                                    className={`w-full px-4 py-2.5 border rounded-xl text-xs font-bold outline-none transition-all ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-white focus:ring-[#2563eb]/20' : 'bg-white border-slate-200 text-slate-800 focus:ring-[#2563eb]/20'}`}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ngày kết thúc</label>
                                <input
                                    type="date"
                                    value={customExportEnd}
                                    onChange={(e) => setCustomExportEnd(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-[#2563eb]/20 outline-none transition-all"
                                />
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            onClick={() => setShowExportModal(false)}
                            className="flex-1 py-3 px-4 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={confirmExport}
                            className="flex-[2] py-3 px-4 rounded-xl bg-emerald-600 text-white text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                            <FileText className="w-4 h-4 text-emerald-100" />
                            Xác nhận xuất CSV
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Meta Profile Modal */}
            {showMetaModal && profileSubscriberId && (
                <MetaCustomerProfileModal
                    subscriberId={profileSubscriberId}
                    onClose={() => setShowMetaModal(false)}
                />
            )}

            {/* Zalo Profile Modal */}
            {showZaloModal && profileSubscriberId && (
                <ZaloUserProfileModal
                    subscriberId={profileSubscriberId}
                    onClose={() => setShowZaloModal(false)}
                />
            )}

            {/* Block IP Confirmation Modal */}
            <Modal
                isOpen={showBlockIPModal}
                onClose={() => setShowBlockIPModal(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-black text-slate-800 tracking-tight">Xác nhận chặn IP</span>
                    </div>
                }
                size="md"
            >
                <div className="space-y-6">
                    <div className={`p-6 rounded-[24px] border ${isDarkTheme ? 'bg-rose-950/20 border-rose-900/50' : 'bg-rose-50 border-rose-100'}`}>
                        <p className={`text-sm font-medium leading-relaxed ${isDarkTheme ? 'text-rose-200' : 'text-rose-800'}`}>
                            Bạn đang thực hiện chặn địa chỉ IP <span className="font-black underline">{ipToBlock?.ip}</span> của <span className="font-black">{ipToBlock?.visitorName}</span>.
                        </p>
                        <p className={`text-xs mt-2 font-bold ${isDarkTheme ? 'text-rose-400' : 'text-rose-600'}`}>
                            Lưu ý: Sau khi chặn, tất cả lưu lượng từ địa chỉ IP này sẽ không thể truy cập vào website của bạn nữa (ngoại trừ Googlebot).
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest ml-1">Lý do chặn (không bắt buộc)</label>
                        <textarea
                            className={`w-full border rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 transition-all min-h-[100px] ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-white focus:ring-rose-500/20 focus:border-rose-400' : 'bg-slate-50 border-slate-200 focus:ring-rose-500/20 focus:border-rose-400 text-slate-800'}`}
                            placeholder="Ví dụ: Spam click, Attack detection..."
                            value={blockReason}
                            onChange={(e) => setBlockReason(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            onClick={() => setShowBlockIPModal(false)}
                            className="flex-1 h-12 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleBlockIP}
                            disabled={isBlocking}
                            className="flex-1 h-12 bg-rose-500 text-white font-bold rounded-2xl hover:bg-rose-600 transition-all shadow-lg shadow-rose-500/30 flex items-center justify-center gap-2"
                        >
                            {isBlocking ? <RotateCw className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
                            {isBlocking ? 'Đang xử lý...' : 'Xác nhận chặn'}
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Unblock IP Confirmation Modal */}
            <Modal
                isOpen={showUnblockIPModal}
                onClose={() => setShowUnblockIPModal(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                            <ShieldCheck className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-black text-slate-800 tracking-tight">Bỏ chặn IP</span>
                    </div>
                }
                size="md"
            >
                <div className="space-y-6">
                    <div className={`p-6 rounded-[24px] border ${isDarkTheme ? 'bg-emerald-950/20 border-emerald-900/50' : 'bg-emerald-50 border-emerald-100/50'}`}>
                        <p className={`text-sm font-medium leading-relaxed ${isDarkTheme ? 'text-emerald-200' : 'text-emerald-800'}`}>
                            Bạn có chắc chắn muốn bỏ chặn địa chỉ IP <span className="font-bold underline">{selectedConv?.ip_address}</span>?
                        </p>
                        <p className={`text-xs mt-2 font-bold italic ${isDarkTheme ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            * Sau khi bỏ chặn, người dùng này có thể truy cập lại website và trò chuyện với AI bình thường.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowUnblockIPModal(false)}
                            className="flex-1 h-12 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={handleUnblockIP}
                            className="flex-1 h-12 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2"
                        >
                            <ShieldCheck className="w-4 h-4" />
                            Xác nhận bỏ chặn
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Delete Analysis Confirmation Modal */}
            <Modal
                isOpen={showDeleteConfirm}
                onClose={() => {
                    setShowDeleteConfirm(false);
                    setIndexToDelete(null);
                    setDeleteConfirmText('');
                }}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-black text-slate-800 tracking-tight">Xác nhận xóa Báo cáo</span>
                    </div>
                }
                size="md"
            >
                <div className="space-y-6">
                    <div className="p-6 bg-red-50 rounded-[28px] border border-red-100/50">
                        <p className="text-sm font-medium text-red-800 leading-relaxed">
                            Bạn có chắc chắn muốn xóa bản ghi phân tích này không?
                        </p>
                        <p className="text-xs text-red-600/70 mt-2 font-bold italic">
                            * Hành động này không thể hoàn tác. Dữ liệu Báo cáo sẽ bị xóa vĩnh viễn khỏi lịch sử.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nhập chữ <span className="text-red-500">DELETE</span> để xác nhận</label>
                        <input
                            type="text"
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            placeholder="Gõ DELETE vào đây..."
                            className="w-full px-5 py-3.5 bg-white border-2 border-slate-100 rounded-[20px] text-sm font-bold focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all placeholder:text-slate-300"
                        />
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => {
                                setShowDeleteConfirm(false);
                                setIndexToDelete(null);
                                setDeleteConfirmText('');
                            }}
                            className="flex-1 h-12 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all font-mono tracking-wider"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={confirmDelete}
                            disabled={deleteConfirmText !== 'DELETE'}
                            className={`flex-1 h-12 font-bold rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2 ${deleteConfirmText === 'DELETE' ? 'bg-red-500 text-white hover:bg-red-600 shadow-red-500/30' : 'bg-slate-100 text-slate-300 cursor-not-allowed shadow-none'}`}
                        >
                            <Trash2 className="w-4 h-4" />
                            Xác nhận xóa
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Analysis Confirmation Modal */}
            <Modal
                isOpen={showAnalysisConfirm}
                onClose={() => setShowAnalysisConfirm(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                            <Zap className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-black text-slate-800 tracking-tight">Xác nhận thông số phân tích</span>
                    </div>
                }
                size="md"
            >
                <div className="space-y-6">
                    <div className="p-6 bg-slate-50 rounded-[28px] border border-slate-200/50 space-y-4">
                        <p className="text-sm font-medium text-slate-600 leading-relaxed border-b border-slate-200 pb-3">
                            Vui lòng kiểm tra lại cấu hình phân tích trước khi bắt đầu. AI sẽ quét toàn bộ hội thoại dựa trên các tiêu chí này:
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nguồn dữ liệu</span>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                                        {anSource === 'web' ? <Globe className="w-3.5 h-3.5 text-blue-500" /> :
                                            anSource === 'zalo' ? <MessageSquare className="w-3.5 h-3.5 text-blue-600" /> :
                                                anSource === 'meta' ? <Facebook className="w-3.5 h-3.5 text-indigo-600" /> :
                                                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />}
                                    </div>
                                    <span className="text-sm font-bold text-slate-800 uppercase">
                                        {anSource === 'web' ? 'Website' : anSource === 'zalo' ? 'Zalo OA' : anSource === 'meta' ? 'Meta' : anSource === 'org' ? 'Consultant' : 'Đa kênh'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Khoảng Thời gian</span>
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                                    </div>
                                    <span className="text-sm font-bold text-slate-800">
                                        {anFromDate || anToDate ?
                                            `${anFromDate ? new Date(anFromDate).toLocaleDateString('vi-VN') : '...'} - ${anToDate ? new Date(anToDate).toLocaleDateString('vi-VN') : '...'}` :
                                            'Toàn bộ lịch sử'}
                                    </span>
                                </div>
                            </div>

                            {selectedPageId && (
                                <div className="col-span-2 space-y-1 mt-2">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Trang/OA mục tiêu</span>
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-white rounded-lg border border-slate-200">
                                            <Layers className="w-3.5 h-3.5 text-slate-400" />
                                        </div>
                                        <span className="text-sm font-bold text-slate-800">
                                            {availablePages.find(p => p.id === selectedPageId)?.name || 'Trang cụ thể'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowAnalysisConfirm(false)}
                            className="flex-1 h-12 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all font-mono tracking-wider"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={() => {
                                setShowAnalysisConfirm(false);
                                triggerAnalysis();
                            }}
                            className="flex-1 h-12 bg-slate-800 text-white font-bold rounded-2xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2"
                        >
                            <Zap className="w-4 h-4" />
                            Tiến hành phân tích
                        </button>
                    </div>
                </div>
            </Modal>

            {/* AI Analysis Modal */}
            <Modal
                isOpen={!!showAnalysisModal}
                onClose={() => {
                    if (!publicMode) setShowAnalysisModal(false);
                }}
                title={<div className="flex items-center gap-2 text-slate-600"><Sparkles className="w-5 h-5 text-slate-400" /> <span>Phân tích hội thoại AI</span></div>}
                size={analysisView === 'config' ? 'xl' : '4xl'}
                hideCloseButton={publicMode}
                footer={analysisView === 'report' ? (
                    <div className="w-full flex justify-between items-center">
                        {!publicMode ? (
                            <button
                                onClick={() => setAnalysisView('config')}
                                className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-all font-mono tracking-widest"
                            >
                                <ChevronLeft className="w-4 h-4" /> Quay lại tùy chỉnh
                            </button>
                        ) : <div />}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    const publicUrl = window.location.origin + window.location.pathname + `#/public-report/${propertyId}/index/${currentAnalysisIndex}`;
                                    navigator.clipboard.writeText(publicUrl);
                                    toast.success('Đã sao chép link Báo cáo!');
                                }}
                                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-slate-200 flex items-center gap-2 group/btn active:scale-95"
                            >
                                <Share2 className="w-4 h-4 group-hover/btn:rotate-12 transition-transform" /> Chia sẻ link hiện tại
                            </button>
                            <button
                                onClick={() => {
                                    window.open(api.baseUrl + `/ai_chatbot.php?action=export_word&property_id=${propertyId}&index=${currentAnalysisIndex}`, '_blank');
                                }}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 group/btn active:scale-95"
                            >
                                <Download className="w-4 h-4 group-hover/btn:translate-y-0.5 transition-transform" /> Xuất file Word (.doc)
                            </button>
                            {!publicMode && (
                                <button
                                    onClick={() => setAnalysisView('config')}
                                    className="px-8 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black transition-all active:scale-95 shadow-xl shadow-slate-200"
                                >
                                    Đóng
                                </button>
                            )}
                        </div>
                    </div>
                ) : null}
            >
                <div className="p-0 overflow-visible min-h-[500px]">
                    {analysisView === 'config' ? (
                        <div className="p-8">
                            <div className="max-w-2xl mx-auto space-y-8">
                                <div className="text-center space-y-3">
                                    <div className={`relative inline-flex items-center justify-center w-16 h-16 rounded-[22px] mb-2 shadow-xl transition-all group ${isGroup ? 'bg-brand shadow-brand/20' : 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-200/50'}`}>
                                        <div className={`absolute inset-0 opacity-30 blur-xl group-hover:opacity-50 transition-opacity ${isGroup ? 'bg-brand' : 'bg-gradient-to-br from-amber-400 to-amber-600'}`}></div>
                                        <Bot className="w-8 h-8 text-white relative z-10 drop-shadow-sm" />
                                    </div>
                                    <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-600 uppercase tracking-tight">Thấu hiểu Khách hàng</h3>
                                    <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-md mx-auto">
                                        AI sẽ phân tích các cuộc hội thoại thực tế để giúp bạn tối ưu hóa chiến dịch Marketing và nâng cao tỷ lệ chuyển đổi.
                                    </p>
                                </div>

                                <div className="space-y-6">
                                    <div className="flex flex-col gap-3">
                                        <button
                                            onClick={() => setShowAnalysisConfirm(true)}
                                            disabled={isAnalyzing}
                                            className={`relative w-full py-5 rounded-[24px] text-base font-black uppercase tracking-wider transition-all shadow-xl overflow-hidden group ${isAnalyzing
                                                ? 'bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-[length:200%_100%] animate-gradient-x cursor-not-allowed'
                                                : 'bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 shadow-slate-300 hover:shadow-slate-400 hover:-translate-y-1 active:translate-y-0'
                                                }`}
                                        >
                                            {isAnalyzing ? (
                                                <>
                                                    {/* Advanced Analyzing Animation */}
                                                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 opacity-90" />

                                                    {/* Liquid Glow Effect */}
                                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-400/20 via-transparent to-slate-400/20 animate-pulse" />

                                                    {/* Scanning Bar */}
                                                    <div className="absolute inset-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/50 to-transparent top-0 animate-scan" style={{ animation: 'scan 2s linear infinite' }} />

                                                    {/* Shimmer Bloom */}
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"
                                                        style={{
                                                            backgroundSize: '150% 100%',
                                                            animationName: 'shimmer',
                                                            animationDuration: '1.5s',
                                                            animationIterationCount: 'infinite',
                                                            animationTimingFunction: 'linear'
                                                        }} />

                                                    {/* Floating Core Particles */}
                                                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                                                        {[...Array(8)].map((_, i) => (
                                                            <div
                                                                key={i}
                                                                className="absolute w-1 h-1 bg-white/40 rounded-full blur-[1px]"
                                                                style={{
                                                                    left: `${10 + Math.random() * 80}%`,
                                                                    top: `${10 + Math.random() * 80}%`,
                                                                    animationName: 'float-particle',
                                                                    animationDuration: `${2 + Math.random() * 3}s`,
                                                                    animationIterationCount: 'infinite',
                                                                    animationTimingFunction: 'ease-in-out',
                                                                    animationDelay: `${i * 0.4}s`
                                                                }}
                                                            />
                                                        ))}
                                                    </div>

                                                    {/* Content */}
                                                    <div className="relative flex items-center justify-center gap-4 text-white z-10">
                                                        <div className="relative w-7 h-7 flex items-center justify-center">
                                                            <div className="absolute inset-0 border-2 border-white/20 rounded-full" />
                                                            <div className="absolute inset-0 border-2 border-transparent border-t-white rounded-full animate-spin" />
                                                            <Sparkles className="w-3 h-3 text-white animate-pulse" />
                                                        </div>
                                                        <div className="flex flex-col items-start">
                                                            <span className="font-black text-sm tracking-widest uppercase">Đang thấu hiểu Khách hàng</span>
                                                            <span className="text-[10px] font-bold text-white/70 normal-case tracking-normal">
                                                                AI đang phân tích các cuộc hội thoại...
                                                            </span>
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="relative flex items-center justify-center gap-3 text-white">
                                                    <div className="bg-white/10 p-1.5 rounded-full backdrop-blur-sm">
                                                        <Zap className="w-6 h-6 text-slate-300 group-hover:scale-110 transition-transform fill-slate-300" />
                                                    </div>
                                                    <span>Phân tích ngay</span>
                                                </div>
                                            )}
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 relative">
                                        {/* Custom Source Dropdown */}
                                        <div className="space-y-2 relative">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                                                <div className="w-5 h-5 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-sm shadow-blue-200">
                                                    <Layers className="w-3 h-3 text-white" />
                                                </div>
                                                Nguồn dữ liệu
                                            </label>
                                            <div
                                                onClick={() => {
                                                    setIsAnSourceOpen(!isAnSourceOpen);
                                                    setIsAnDateOpen(false);
                                                }}
                                                className="w-full h-12 flex items-center justify-between px-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:border-slate-300 transition-all group shadow-sm"
                                            >
                                                <span className="text-xs font-bold text-slate-700">
                                                    {anSource === 'all' ? 'Tất cả kênh kết nối' :
                                                        anSource === 'web' ? 'Website Tracking' :
                                                            anSource === 'org' ? 'AI Consultant Chat' :
                                                                anSource === 'zalo' ? 'Zalo OA Message' : 'Messenger/Instagram'}
                                                </span>
                                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isAnSourceOpen ? 'rotate-180' : ''}`} />
                                            </div>

                                            {isAnSourceOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-[60]" onClick={() => setIsAnSourceOpen(false)}></div>
                                                    <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[70] overflow-hidden py-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                        {[
                                                            ...(!isGroup ? [
                                                                { id: 'web', label: 'Website Tracking' },
                                                                { id: 'zalo', label: 'Zalo OA Message' },
                                                                { id: 'meta', label: 'Messenger/Instagram' }
                                                            ] : []),
                                                            { id: 'org', label: 'Hội thoại' }
                                                        ].map(opt => (
                                                            <div
                                                                key={opt.id}
                                                                onClick={() => {
                                                                    setAnSource(opt.id as any);
                                                                    setIsAnSourceOpen(false);
                                                                }}
                                                                className={`px-4 py-2.5 text-xs font-bold cursor-pointer transition-colors ${anSource === opt.id ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                                                            >
                                                                {opt.label}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>

                                        {/* Custom Date Dropdown */}
                                        <div className="space-y-2 relative">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-2">
                                                <div className="w-5 h-5 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center shadow-sm shadow-amber-200">
                                                    <Clock className="w-3 h-3 text-white" />
                                                </div>
                                                Khoảng Thời gian
                                            </label>
                                            <div
                                                onClick={() => {
                                                    setIsAnDateOpen(!isAnDateOpen);
                                                    setIsAnSourceOpen(false);
                                                }}
                                                className="w-full h-12 flex items-center justify-between px-4 bg-white border border-slate-200 rounded-2xl cursor-pointer hover:border-slate-300 transition-all group shadow-sm"
                                            >
                                                <span className="text-xs font-bold text-slate-700">
                                                    {anDatePreset === 'all' ? 'Toàn bộ lịch sử' :
                                                        anDatePreset === 'today' ? 'Hôm nay' :
                                                            anDatePreset === 'yesterday' ? 'Hôm qua' :
                                                                anDatePreset === '7days' ? '7 ngày gần nhất' :
                                                                    anDatePreset === 'this_month' ? 'Tháng này' :
                                                                        anDatePreset === 'last_month' ? 'Tháng trước' : 'Tùy chọn khác...'}
                                                </span>
                                                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isAnDateOpen ? 'rotate-180' : ''}`} />
                                            </div>

                                            {isAnDateOpen && (
                                                <>
                                                    <div className="fixed inset-0 z-[60]" onClick={() => setIsAnDateOpen(false)}></div>
                                                    <div className="absolute left-0 right-0 bottom-full mb-2 bg-white border border-slate-100 rounded-2xl shadow-2xl z-[70] overflow-hidden py-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                        {[
                                                            { id: 'all', label: 'Toàn bộ lịch sử' },
                                                            { id: 'today', label: 'Hôm nay' },
                                                            { id: 'yesterday', label: 'Hôm qua' },
                                                            { id: '7days', label: '7 ngày gần nhất' },
                                                            { id: 'this_month', label: 'Tháng này' },
                                                            { id: 'last_month', label: 'Tháng trước' },
                                                            { id: 'custom', label: 'Tùy chọn khác...' }
                                                        ].map(opt => (
                                                            <div
                                                                key={opt.id}
                                                                onClick={() => {
                                                                    handleDatePreset(opt.id);
                                                                    setIsAnDateOpen(false);
                                                                }}
                                                                className={`px-4 py-2.5 text-xs font-bold cursor-pointer transition-colors ${anDatePreset === opt.id ? 'bg-amber-50 text-amber-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                                            >
                                                                {opt.label}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {anDatePreset === 'custom' && (
                                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1 font-mono">Từ ngày</label>
                                                <input
                                                    type="date"
                                                    value={anFromDate}
                                                    onChange={(e) => setAnFromDate(e.target.value)}
                                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-100 shadow-sm"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1 font-mono">Đến ngày</label>
                                                <input
                                                    type="date"
                                                    value={anToDate}
                                                    onChange={(e) => setAnToDate(e.target.value)}
                                                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-100 shadow-sm"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-2">
                                        {analysisHistory.length > 0 && (
                                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-1 mt-2">Báo cáo gần đây</p>
                                        )}
                                        {analysisHistory.length === 0 && (
                                            <div className="py-8 px-6 bg-slate-50 rounded-2xl border border-slate-200 text-center">
                                                <Clock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                                                <p className="text-xs font-bold text-slate-400 mb-1">Chưa có Báo cáo nào</p>
                                                <p className="text-[10px] text-slate-400">Nhấn "Phân tích ngay" để tạo Báo cáo đầu tiên</p>
                                            </div>
                                        )}
                                        {analysisHistory.map((item, idx) => (
                                            <div key={idx} className="group relative">
                                                <div
                                                    onClick={() => {
                                                        setAnalysisReport(item.report);
                                                        setAnalysisTimeStats(item.time_stats || []);
                                                        setAnalysisTopicStats(item.topic_stats || []);
                                                        setAnalysisSampleCount(item.sample_count || 0);
                                                        setAnalysisVisitorCount(item.visitor_count || 0);
                                                        setAnalysisTotalCount(item.total_count || 0);
                                                        setAnSource(item.source || 'all');
                                                        setAnFromDate(item.from_date || '');
                                                        setAnToDate(item.to_date || '');
                                                        setAnPageId(item.page_id || '');
                                                        setCurrentAnalysisIndex(idx);
                                                        setAnalysisView('report');
                                                    }}
                                                    className="w-full py-4 px-5 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[11px] font-bold hover:bg-slate-50 hover:border-amber-200 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-2 shadow-sm relative overflow-hidden group/item"
                                                >
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400 opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover/item:bg-amber-50 group-hover/item:text-amber-600 transition-colors">
                                                            <Clock className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-slate-800 text-[12px] leading-tight">
                                                                Phân tích {
                                                                    item.source === 'web' ? 'Website' :
                                                                        item.source === 'zalo' ? 'Zalo OA' :
                                                                            item.source === 'meta' ? 'Meta' : 'Đa kênh'
                                                                } {
                                                                    item.from_date || item.to_date ?
                                                                        `(${item.from_date ? new Date(item.from_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '...'} - ${item.to_date ? new Date(item.to_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) : '...'})` :
                                                                        '(Toàn bộ)'
                                                                }
                                                            </span>
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                    Tài liệu {item.generated_at ? new Date(item.generated_at).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : `Bản ghi #${idx + 1}`}
                                                                </span>
                                                                <span className="text-[9px] text-amber-600 font-bold opacity-0 group-hover/item:opacity-100 transition-opacity ml-1">Click để xem lại</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover/item:opacity-100 transition-all transform translate-x-2 group-hover/item:translate-x-0">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const publicUrl = window.location.origin + window.location.pathname + `#/public-report/${propertyId}/index/${idx}`;
                                                                navigator.clipboard.writeText(publicUrl);
                                                                toast.success('Đã sao chép link Báo cáo này!');
                                                            }}
                                                            className="p-2 hover:bg-amber-100 text-amber-600 rounded-xl transition-all active:scale-90"
                                                            title="Chia sẻ Báo cáo này"
                                                        >
                                                            <Share2 className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDeleteAnalysis(e, idx)}
                                                            className="p-2 hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-xl transition-all active:scale-90"
                                                            title="Xóa Báo cáo"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="text-center pb-12">
                                        <p className="text-[10px] font-bold text-slate-400 italic">
                                            * Hệ thống sử dụng AI để phân tích hành vi người dùng thực tế.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-0">
                            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chiến dịch phân tích</p>
                                    <div className="flex items-center gap-2">
                                        <div className="px-2 py-1 bg-gradient-to-r from-amber-600 to-orange-500 rounded text-[10px] font-black text-white uppercase italic shadow-sm shadow-orange-100 flex items-center gap-1.5">
                                            <Zap className="w-3 h-3 fill-current" /> Dữ liệu chất lượng cao
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                            <Clock className="w-3 h-3" />
                                            {anFromDate || anToDate ? `${anFromDate || '...'} → ${anToDate || '...'}` : 'Toàn bộ Thời gian'}
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                                            <Globe className="w-3 h-3" />
                                            {anSource === 'all' ? 'Tất cả kênh' :
                                                anSource === 'web' ? 'Website' :
                                                    anSource === 'zalo' ? 'Zalo OA' : 'Messenger'}
                                            {anPageId && (
                                                <span className="ml-1 text-slate-500 border-l border-slate-200 pl-1">
                                                    {availablePages.find(p => p.id === anPageId)?.name || anPageId}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Trạng thái</p>
                                    <div className="flex items-center gap-2 justify-end">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <p className="text-sm font-black text-emerald-600 uppercase flex items-center gap-1.5">
                                            <ShieldCheck className="w-4 h-4" /> Đã Hoàn thành
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {analysisTimeStats.length > 0 && (
                                <div className="mb-12">
                                    <div className="flex items-center justify-between mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                                                <Activity className="w-6 h-6 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-none">Phân tích Giờ cao điểm</h3>
                                                <p className="text-xs font-bold text-slate-500 mt-1">Dựa trên {analysisTotalCount > analysisSampleCount ? `mẫu ${analysisSampleCount}/${analysisTotalCount}` : `tổng ${analysisTotalCount}`} tin nhắn từ {analysisVisitorCount} Khách hàng</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 rounded bg-gradient-to-t from-blue-600 to-cyan-400" />
                                                <span className="text-xs font-bold text-slate-600">Hoạt động thường</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 rounded bg-gradient-to-t from-amber-600 to-orange-400" />
                                                <span className="text-xs font-bold text-slate-600">Giờ cao điểm</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-gradient-to-br from-slate-50 to-white h-96 rounded-[32px] border-2 border-slate-100 shadow-xl overflow-hidden relative">
                                        {/* Grid Background */}
                                        <div className="absolute inset-0 px-12 py-12 pointer-events-none z-0 flex flex-col justify-between">
                                            {[4, 3, 2, 1, 0].map(i => (
                                                <div key={i} className="w-full border-t border-slate-100 relative h-0">
                                                    <span className="absolute -left-8 -top-2 text-[10px] font-bold text-slate-400 w-6 text-right">
                                                        {Math.round((Math.max(...analysisTimeStats, 1) * i) / 4)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Bar Container */}
                                        <div className="absolute inset-0 px-12 py-12 z-10 flex items-end justify-between gap-1">
                                            {analysisTimeStats.map((count, hr) => {
                                                const max = Math.max(...analysisTimeStats, 1);
                                                const height = (count / max) * 100;
                                                const isPeak = count === max && count > 0;
                                                const isHighActivity = count > max * 0.3; // Hạ ngưỡng xuống 0.3

                                                return (
                                                    <div key={hr} className="flex-1 flex flex-col items-center justify-end h-full relative group/bar">
                                                        <div className="relative w-full h-full flex items-end justify-center">
                                                            {/* Tooltip */}
                                                            {count > 0 && (
                                                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-black px-3 py-2 rounded-xl opacity-0 group-hover/bar:opacity-100 transition-all duration-200 whitespace-nowrap z-30 shadow-2xl pointer-events-none transform -translate-y-2 group-hover/bar:translate-y-0">
                                                                    <div className="text-center">
                                                                        <div className="text-amber-400 font-bold">{count} tin nhắn</div>
                                                                        <div className="text-[9px] text-slate-300 opacity-80 mt-0.5 font-mono">{String(hr).padStart(2, '0')}:00 - {String(hr).padStart(2, '0')}:59</div>
                                                                    </div>
                                                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
                                                                </div>
                                                            )}

                                                            {/* Bar */}
                                                            <div
                                                                className={`w-full rounded-t-md mx-[1px] transition-all duration-500 ease-out cursor-pointer relative overflow-hidden ${isPeak
                                                                    ? 'bg-gradient-to-t from-amber-600 to-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.3)] z-10 scale-x-110'
                                                                    : isHighActivity
                                                                        ? 'bg-gradient-to-t from-blue-500 to-cyan-400 hover:from-blue-400 hover:to-cyan-300'
                                                                        : 'bg-gradient-to-t from-slate-200 to-slate-100 hover:from-slate-300 hover:to-slate-200'
                                                                    }`}
                                                                style={{ height: `${Math.max(height, 2)}%` }}
                                                            >
                                                                {/* Shine effect */}
                                                                <div className="absolute inset-0 bg-gradient-to-t from-white/0 via-white/10 to-white/0 opacity-0 group-hover/bar:opacity-100 transition-opacity" />
                                                            </div>
                                                        </div>

                                                        {/* Hour label - Absolute Bottom but outside padding */}
                                                        <span className={`absolute -bottom-8 left-1/2 -translate-x-1/2 text-[9px] font-bold font-mono transition-colors ${isPeak
                                                            ? 'text-amber-600 font-black scale-110'
                                                            : count > 0
                                                                ? 'text-slate-500'
                                                                : 'text-slate-300'
                                                            }`}>
                                                            {String(hr).padStart(2, '0')}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        {/* X-axis */}
                                        <div className="mt-4 pt-4 border-t-2 border-slate-200 text-center">
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Khung giờ trong ngày (24h)</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Topic Statistics Table */}
                            {analysisTopicStats && analysisTopicStats.length > 0 && (
                                <div className="mt-8 mb-8">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="p-2 bg-indigo-100 rounded-xl">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800">Thống kê Chủ đề & Từ khóa</h3>
                                            <p className="text-sm text-slate-500 font-medium">Các vấn đề được Khách hàng quan tâm nhất</p>
                                        </div>
                                    </div>

                                    <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="bg-slate-50 border-b border-slate-100">
                                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider w-1/2">Chủ đề / Keyword</th>
                                                        <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider w-32">Số lượng</th>
                                                        <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Mức độ quan tâm</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {analysisTopicStats.map((stat, index) => (
                                                        <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                                                            <td className="px-6 py-4">
                                                                <span className="font-semibold text-slate-700">{stat.topic}</span>
                                                            </td>
                                                            <td className="px-6 py-4 text-right">
                                                                <span className="font-mono font-bold text-slate-600">{stat.count}</span>
                                                            </td>
                                                            <td className="px-6 py-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                                                        <div
                                                                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 relative"
                                                                            style={{ width: `${Math.min(stat.percentage, 100)}%` }}
                                                                        >
                                                                            <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-sm font-bold text-indigo-600 min-w-[3rem] text-right">{stat.percentage}%</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="prose prose-slate prose-sm max-w-none prose-headings:text-slate-800 prose-headings:font-black prose-p:text-slate-600 prose-p:leading-relaxed prose-strong:text-slate-900 prose-li:text-slate-600 bg-slate-50/10 p-4 lg:p-8 rounded-[32px] border border-slate-100 shadow-inner overflow-x-auto">
                                {renderContent(analysisReport, 'ai')}
                            </div>

                            {/* [NEW] Detailed Conversations Table */}
                            <div className="mt-12 mb-12">
                                <div className="flex items-center justify-between mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-100 rounded-xl">
                                            <MessageSquare className="h-6 w-6 text-emerald-600" />
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-slate-800">Chi tiết cuộc hội thoại</h3>
                                            <p className="text-sm text-slate-500 font-medium">Danh sách các câu hỏi và trả lời tương ứng bộ lọc</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {/* Search input for report conversations */}
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={reportSearch}
                                                onChange={e => setReportSearch(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') {
                                                        setReportConversations([]);
                                                        setReportPage(1);
                                                        handleFetchReportConversations(1, reportSearch);
                                                    }
                                                }}
                                                placeholder="Tìm kiếm tin nhắn..."
                                                className="text-xs pl-8 pr-8 py-2 border border-slate-200 rounded-xl bg-white text-slate-600 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-300 w-48"
                                            />
                                            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                                            {reportSearch && (
                                                <button
                                                    onClick={() => {
                                                        setReportSearch('');
                                                        setReportConversations([]);
                                                        setReportPage(1);
                                                        handleFetchReportConversations(1, '');
                                                    }}
                                                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => {
                                                setReportConversations([]);
                                                setReportPage(1);
                                                handleFetchReportConversations(1, reportSearch);
                                            }}
                                            disabled={isFetchingReportConvs}
                                            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 bg-indigo-50 px-3 py-2 rounded-xl border border-indigo-100 transition-all active:scale-95 disabled:opacity-50"
                                        >
                                            {isFetchingReportConvs ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                                            Tìm
                                        </button>
                                        <button
                                            onClick={() => {
                                                const url = api.baseUrl + `/ai_chatbot.php?action=export_conversations&property_id=${propertyId}&source=${anSource}&from_date=${anFromDate}&to_date=${anToDate}&page_id=${anPageId}&is_group=${isGroup ? 1 : 0}`;
                                                window.open(url, '_blank');
                                            }}
                                            className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-xl border border-emerald-100 transition-all active:scale-95"
                                            title="Export conversations as CSV"
                                        >
                                            <Download className="w-4 h-4" /> CSV
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white rounded-[24px] border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full table-fixed">
                                            <thead>
                                                <tr className="bg-slate-50 border-b border-slate-100">
                                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-[140px]">Thời gian</th>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest w-[200px]">Người dùng</th>
                                                    <th className="px-6 py-4 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung trao đổi</th>
                                                    <th className="px-6 py-4 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest w-[100px]">Thao tác</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {isFetchingReportConvs && reportConversations.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-12 text-center">
                                                            <div className="flex flex-col items-center gap-3">
                                                                <RotateCw className="w-6 h-6 text-emerald-500 animate-spin" />
                                                                <p className="text-xs font-bold text-slate-400">Đang tải dữ liệu hội thoại...</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : reportConversations.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-12 text-center">
                                                            <div className="flex flex-col items-center gap-3">
                                                                <Info className="w-8 h-8 text-slate-200" />
                                                                <p className="text-xs font-bold text-slate-400">Không tìm thấy cuộc hội thoại nào trong khoảng Thời gian này</p>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    reportConversations.map((row, idx) => (
                                                        <tr key={`${row.id}-${idx}`} className="hover:bg-slate-50/50 transition-colors group">
                                                            <td className="px-6 py-4 align-top">
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="text-[11px] font-black text-slate-700">{new Date(row.time).toLocaleDateString('vi-VN')}</span>
                                                                    <span className="text-[10px] font-bold text-slate-400 font-mono">{new Date(row.time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 align-top">
                                                                <div className="flex items-center gap-3">
                                                                    {row.user_avatar ? (
                                                                        <img src={row.user_avatar} className="w-8 h-8 rounded-full border-2 border-white shadow-sm shrink-0" alt="" />
                                                                    ) : (
                                                                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-[10px] font-bold border-2 border-white shadow-sm uppercase shrink-0">
                                                                            {row.user_name?.substring(0, 1)}
                                                                        </div>
                                                                    )}
                                                                    <div className="flex flex-col min-w-0">
                                                                        <span className="text-xs font-black text-slate-700 truncate" title={row.user_name}>{row.user_name}</span>
                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">ID: {row.id?.substring(0, 8)}</span>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 align-top">
                                                                <div className="space-y-6 max-w-full overflow-hidden py-2">
                                                                    {row.user && (
                                                                        <div className="flex flex-col items-start gap-1.5 max-w-[95%]">
                                                                            <div className="flex items-center gap-2 ml-1">
                                                                                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                                                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Khách hàng</span>
                                                                            </div>
                                                                            <div className="bg-slate-50/80 backdrop-blur-sm border border-slate-200/60 p-4 rounded-[24px] rounded-tl-none text-[11px] text-slate-600 leading-relaxed italic w-full shadow-sm max-h-[250px] overflow-y-auto custom-scrollbar relative group/msg">
                                                                                {renderContent(row.user, 'visitor')}
                                                                                {row.user.length > 300 && <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-slate-50/90 to-transparent pointer-events-none opacity-0 group-hover/msg:opacity-100 transition-opacity" />}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {row.ai && (
                                                                        <div className="flex flex-col items-start gap-1.5 max-w-[95%]">
                                                                            <div className="flex items-center gap-2 ml-1">
                                                                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                                                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Tài liệu AI</span>
                                                                            </div>
                                                                            <div className="bg-gradient-to-br from-emerald-50/60 to-teal-50/40 backdrop-blur-sm border border-emerald-100/80 p-5 rounded-[24px] rounded-tl-none text-[11px] text-slate-800 leading-relaxed w-full shadow-md relative group/msg-ai">
                                                                                <div className="max-h-[350px] overflow-y-auto custom-scrollbar pr-2">
                                                                                    <div className="prose prose-slate prose-xs max-w-none prose-p:leading-relaxed prose-pre:bg-[#1e1e2e] prose-pre:border-slate-800">
                                                                                        {renderContent(row.ai, 'ai')}
                                                                                    </div>
                                                                                </div>
                                                                                {row.ai.length > 500 && <div className="absolute bottom-4 right-4 text-[9px] font-black text-emerald-400 bg-white/50 px-2 py-0.5 rounded-full border border-emerald-100 opacity-0 group-hover/msg-ai:opacity-100 transition-opacity pointer-events-none">CUỘN ĐỂ XEM THÊM</div>}

                                                                                {row.actions && (
                                                                                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-emerald-100/40">
                                                                                        {row.actions.split(/[,|]/).filter((a: string) => a.trim()).map((act: string, ai: number) => (
                                                                                            <span key={ai} className="px-3 py-1.5 bg-white text-indigo-600 text-[10px] font-black rounded-xl border border-indigo-100 uppercase tracking-tight shadow-sm hover:scale-105 transition-transform cursor-default">
                                                                                                {act.trim()}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-6 py-4 text-right align-top">
                                                                <button
                                                                    onClick={async () => {
                                                                        // Determine source type from row.id prefix to auto-switch sidebar tab
                                                                        const rowIsOrg = row.id?.startsWith('org_');
                                                                        const rowIdStripped = row.id?.replace(/^(cust_|org_)/, '') || '';

                                                                        // Auto switch source tab so sidebar matches the conversation's channel
                                                                        const targetSource = rowIsOrg ? 'org'
                                                                            : row.origin === 'org' ? 'org'
                                                                                : anSource !== 'all' ? anSource as any
                                                                                    : 'web';

                                                                        // Try find in current sidebar list (normalize IDs for comparison)
                                                                        const conv = conversations.find(c => {
                                                                            const cStripped = c.id?.replace(/^(cust_|org_)/, '') || '';
                                                                            return c.id === row.id || cStripped === rowIdStripped;
                                                                        });

                                                                        if (conv) {
                                                                            setSelectedConv(conv);
                                                                            fetchMessages(conv.id);
                                                                            setShowAnalysisModal(false);
                                                                        } else {
                                                                            // Not in current filtered list – fetch directly by ID then switch source
                                                                            try {
                                                                                const res = await api.get<any>(`ai_chatbot?action=get_conversation&id=${row.id}&property_id=${propertyId}`);
                                                                                if (res.success && res.data) {
                                                                                    // Switch source tab so the sidebar refreshes to show this conversation's channel
                                                                                    setSource(targetSource);
                                                                                    setSelectedConv(res.data);
                                                                                    fetchMessages(res.data.id);
                                                                                    setShowAnalysisModal(false);
                                                                                } else {
                                                                                    toast.error('Không tìm thấy hội thoại. Dữ liệu có thể đã bị thay đổi.');
                                                                                }
                                                                            } catch {
                                                                                toast.error('Không thể tải hội thoại. Vui lòng thử lại.');
                                                                            }
                                                                        }
                                                                    }}
                                                                    className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all active:scale-95 group/view shadow-sm"
                                                                >
                                                                    <ArrowRight className="w-4 h-4 group-hover/view:translate-x-0.5 transition-transform" />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}


                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    {reportConversations.length > 0 && reportTotalPages > 1 && (
                                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
                                            <div className="text-xs text-slate-500 font-medium">
                                                Trang <span className="font-black text-slate-700">{reportPage}</span> / <span className="font-black">{reportTotalPages}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleReportPageChange(1)}
                                                    disabled={reportPage === 1 || isFetchingReportConvs}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                >
                                                    ««
                                                </button>
                                                <button
                                                    onClick={() => handleReportPageChange(reportPage - 1)}
                                                    disabled={reportPage === 1 || isFetchingReportConvs}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                >
                                                    «
                                                </button>
                                                <div className="flex items-center gap-1">
                                                    {Array.from({ length: Math.min(5, reportTotalPages) }, (_, i) => {
                                                        let pageNum;
                                                        if (reportTotalPages <= 5) {
                                                            pageNum = i + 1;
                                                        } else if (reportPage <= 3) {
                                                            pageNum = i + 1;
                                                        } else if (reportPage >= reportTotalPages - 2) {
                                                            pageNum = reportTotalPages - 4 + i;
                                                        } else {
                                                            pageNum = reportPage - 2 + i;
                                                        }
                                                        return (
                                                            <button
                                                                key={pageNum}
                                                                onClick={() => handleReportPageChange(pageNum)}
                                                                disabled={isFetchingReportConvs}
                                                                className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${reportPage === pageNum
                                                                    ? 'bg-indigo-600 text-white border-indigo-600'
                                                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                                                    }`}
                                                            >
                                                                {pageNum}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <button
                                                    onClick={() => handleReportPageChange(reportPage + 1)}
                                                    disabled={reportPage === reportTotalPages || isFetchingReportConvs}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                >
                                                    »
                                                </button>
                                                <button
                                                    onClick={() => handleReportPageChange(reportTotalPages)}
                                                    disabled={reportPage === reportTotalPages || isFetchingReportConvs}
                                                    className="px-3 py-1.5 text-xs font-bold rounded-lg border transition-all disabled:opacity-30 disabled:cursor-not-allowed bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                                >
                                                    »»
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            {/* Export CSV Modal */}
            <Modal
                isOpen={showExportModal}
                onClose={() => setShowExportModal(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                            <Download className="w-6 h-6" />
                        </div>
                        <span className="text-xl font-black text-slate-800 tracking-tight text-emerald-600 uppercase">Xuất dữ liệu hội thoại</span>
                    </div>
                }
                size="md"
            >
                <div className="space-y-6">
                    <div className="p-5 bg-slate-50 rounded-[28px] border border-slate-200/50 space-y-4">
                        <div className="flex items-center gap-3 pb-3 border-b border-slate-200/50">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                <Info className="w-4 h-4 text-emerald-600" />
                            </div>
                            <p className="text-xs font-bold text-slate-600 leading-relaxed">
                                Dữ liệu sẽ được xuất dựa trên các bộ lọc hiện tại của bạn.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Kênh đang chạy</label>

                                <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 uppercase flex items-center gap-2">
                                    {source === 'web' ? <Globe className="w-3.5 h-3.5 text-blue-500" /> :
                                        source === 'zalo' ? <MessageSquare className="w-3.5 h-3.5 text-blue-600" /> :
                                            <Facebook className="w-3.5 h-3.5 text-indigo-600" />}
                                    {source === 'web' ? 'Website' : source === 'zalo' ? 'Zalo OA' : 'Meta'}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Bộ lọc ID</label>
                                <div className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2">
                                    {filterIdType === 'has_phone' ? <Phone className="w-3.5 h-3.5 text-emerald-500" /> :
                                        filterIdType === 'has_email' ? <Mail className="w-3.5 h-3.5 text-blue-500" /> :
                                            <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                                    {filterIdType === 'has_phone' ? 'Chỉ có SĐT' : filterIdType === 'has_email' ? 'Chỉ có Email' : 'Tất cả khách'}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                                <Clock className="w-3 h-3" /> Khoảng Thời gian xuất (Tùy chọn)
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Từ ngày</label>
                                    <input
                                        type="date"
                                        value={customExportStart}
                                        onChange={(e) => setCustomExportStart(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider pl-1">Đến ngày</label>
                                    <input
                                        type="date"
                                        value={customExportEnd}
                                        onChange={(e) => setCustomExportEnd(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowExportModal(false)}
                            className="flex-1 h-12 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all text-sm uppercase tracking-wider"
                        >
                            Hủy bỏ
                        </button>
                        <button
                            onClick={() => {
                                const url = api.baseUrl + `/ai_chatbot.php?action=export_conversations` +
                                    `&property_id=${propertyId}` +
                                    `&source=${source}` +
                                    `&search=${searchTerm}` +
                                    `&id_filter=${filterIdType}` +
                                    `&from_date=${customExportStart}` +
                                    `&to_date=${customExportEnd}` +
                                    `&page_id=${selectedPageId}`;
                                window.open(url, '_blank');
                                setShowExportModal(false);
                                toast.success('Đang khởi tạo tệp CSV...');
                            }}
                            className="flex-1 h-12 bg-emerald-500 text-white font-bold rounded-2xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
                        >
                            <Download className="w-4 h-4" />
                            Xuất CSV
                        </button>
                    </div>
                </div>
            </Modal>


            {/* HTML Preview Modal */}
            <Modal
                isOpen={showPreviewModal}
                onClose={() => setShowPreviewModal(false)}
                title={previewTitle}
                size="lg"
            >
                <div className="w-full h-[600px] bg-white rounded-xl overflow-hidden border border-slate-200">
                    <iframe
                        srcDoc={previewContent}
                        title="HTML Preview"
                        className="w-full h-full border-none"
                    />
                </div>
            </Modal>

            <ConfirmModal
                isOpen={isDeleteChatModalOpen}
                onClose={() => setIsDeleteChatModalOpen(false)}
                onConfirm={confirmDeleteChat}
                title="Xóa cuộc hội thoại"
                message="Bạn có chắc chắn muốn xóa cuộc hội thoại này? Hành động này không thể hoàn tác."
                confirmText="Xóa cuộc hội thoại"
                variant="danger"
            />
        </div>
    );
};

export default React.memo(UnifiedChat);
