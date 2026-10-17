import { API_BASE_URL } from '../../utils/config';
﻿import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { api } from '../../services/storageAdapter';
import { toast } from 'react-hot-toast';

import AITrainingGrid from './training/AITrainingGrid';
import AITrainingDetail from './training/AITrainingDetail';
import AdminLogsTab from './training/AdminLogsTab';
import AIModals from './modals/AIModals';
import { ManualAddModal, EditDocModal } from './modals/TrainingModals';
import { ArrowLeft, Save, Bot, Sparkles, Database, FolderPlus, BrainCircuit, FlaskConical, Search, AlertTriangle, HelpCircle, RefreshCw, X, Copy, Move, Trash2, Check, BookOpen, Palette, Building, Image as ImageIcon, Users, FileInput, ShieldCheck, Zap, Settings, ChevronDown, BarChart2, Activity } from 'lucide-react';

interface AIDoc {
    id: string;
    property_id: string;
    name: string;
    source_type: string;
    is_active: number;
    status: 'pending' | 'trained' | 'error' | 'processing';
    priority: number;
    parent_id?: string;
    created_at: string;
    updated_at: string;
    _meta?: any;
    content?: string;
    tags?: string | string[];
    content_size?: string;
}

interface ChatbotCategory {
    id: string;
    name: string;
    slug?: string;
    description: string;
    chatbot_count?: number;
    brand_color?: string;
    gemini_api_key?: string;
    bot_avatar?: string;
}

interface WebProperty {
    id: string;
    name: string;
    domain: string;
    description?: string;
    slug?: string;
    category_id?: string;
    ai_enabled?: boolean;
    stats?: {
        docs_count: number;
        queries_count: number;
    }
}

export interface AISettings {
    property_id: string;
    is_enabled: number;
    bot_name: string;
    company_name: string;
    brand_color: string;
    bot_avatar: string;
    welcome_msg: string;
    persona_prompt: string;
    gemini_api_key: string;
    quick_actions: string[];
    gemini_cache_name?: string;
    gemini_cache_expires_at?: string;
    system_instruction?: string;
    fast_replies?: { pattern: string; reply: string }[];
    similarity_threshold?: number;
    top_k?: number;
    history_limit?: number;
    temperature?: number;
    max_output_tokens?: number;
    chunk_size?: number;
    chunk_overlap?: number;
    widget_position?: 'bottom-right' | 'bottom-left';
    excluded_pages?: string[];
    excluded_paths?: string[];
    auto_open?: number;
    intent_configs?: any;
    cat_brand_color?: string;
    cat_gemini_api_key?: string;
    cat_bot_avatar?: string;
}

interface AITrainingManagerProps {
    onClose: () => void;
    categoryId?: string;
    brandColor?: string;
    onOpenOrgManager?: (userId?: number) => void;
    isDarkTheme?: boolean;
}

const AITrainingManager: React.FC<AITrainingManagerProps> = ({ onClose, categoryId, brandColor, onOpenOrgManager, isDarkTheme }) => {
    // Removed useNavigation as this is an overlay now
    const [properties, setProperties] = useState<WebProperty[]>([]);
    const [chatbots, setChatbots] = useState<WebProperty[]>([]); // Reuse WebProperty interface for chatbots
    const [selectedProperty, setSelectedProperty] = useState<string>('');
    const [docs, setDocs] = useState<AIDoc[]>([]);
    const [settings, setSettings] = useState<AISettings>({
        property_id: '',
        is_enabled: 0,
        bot_name: 'AI Assistant',
        company_name: '',
        brand_color: brandColor || '#0066FF',
        bot_avatar: '',
        welcome_msg: 'Chào bạn! Mình có thể giúp gì cho bạn?',
        persona_prompt: 'Bạn là trợ lý ảo chuyên nghiệp.',
        gemini_api_key: '',
        quick_actions: [],
        system_instruction: '',
        fast_replies: [],
        similarity_threshold: 0.45,
        top_k: 12,
        history_limit: 10,
        chunk_size: 1000,
        chunk_overlap: 150,
        widget_position: 'bottom-right',
        excluded_pages: [],
        excluded_paths: [],
        auto_open: 0
    });

    const [viewMode, setViewMode] = useState<'grid' | 'doc'>('grid');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'training' | 'settings' | 'embed' | 'instruction' | 'inbox' | 'logs' | 'scenarios'>('inbox');
    const [newDoc, setNewDoc] = useState<{ name: string, content: string, tags: string, batchName?: string }>({ name: '', content: '', tags: '', batchName: '' });
    const [tagInput, setTagInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [docSearchTerm, setDocSearchTerm] = useState('');
    const [mainTab, setMainTab] = useState<'website' | 'chat'>(categoryId ? 'chat' : 'website');
    const [selectedBotLogsId, setSelectedBotLogsId] = useState<string | null>(null);

    const [newQuickAction, setNewQuickAction] = useState('');
    const [isSynonymsModalOpen, setIsSynonymsModalOpen] = useState(false);
    const [newSynKey, setNewSynKey] = useState('');
    const [newSynValues, setNewSynValues] = useState('');

    // Stable references for defaults
    const EMPTY_OBJ = React.useMemo(() => ({}), []);
    const EMPTY_ARR = React.useMemo(() => [], []);

    // Memoize derived props for stability
    const memoSynonyms = React.useMemo(() => settings.intent_configs?.synonyms || EMPTY_OBJ, [settings.intent_configs?.synonyms, EMPTY_OBJ]);
    const memoFastReplies = React.useMemo(() => settings.fast_replies || EMPTY_ARR, [settings.fast_replies, EMPTY_ARR]);
    const memoQuickActions = React.useMemo(() => settings.quick_actions || EMPTY_ARR, [settings.quick_actions, EMPTY_ARR]);
    const memoExcludedPages = React.useMemo(() => settings.excluded_pages || EMPTY_ARR, [settings.excluded_pages, EMPTY_ARR]);
    const memoExcludedPaths = React.useMemo(() => settings.excluded_paths || EMPTY_ARR, [settings.excluded_paths, EMPTY_ARR]);

    // Edit Inline State
    const [editingSynKey, setEditingSynKey] = useState<string | null>(null);
    const [editSynKeyVal, setEditSynKeyVal] = useState('');
    const [editSynValuesVal, setEditSynValuesVal] = useState('');

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<any>(null);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id?: string, batchId?: string } | null>(null);
    const [infoDoc, setInfoDoc] = useState<any | null>(null);

    // Multi-select states
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkMoveModalOpen, setIsBulkMoveModalOpen] = useState(false);
    const [bulkActionType, setBulkActionType] = useState<'copy' | 'move' | null>(null);
    const [targetPropertyId, setTargetPropertyId] = useState<string>('');
    const [isTargetDropdownOpen, setIsTargetDropdownOpen] = useState(false);

    // Bulk Delete Verification
    const [isBulkDeleteConfirmModalOpen, setIsBulkDeleteConfirmModalOpen] = useState(false);
    const [deleteVerifyText, setDeleteVerifyText] = useState('');

    // AI Chat specific states
    const [isCreateBotModalOpen, setIsCreateBotModalOpen] = useState(false);
    const [newBotName, setNewBotName] = useState('');
    const [newBotDesc, setNewBotDesc] = useState('');

    // AI Chat Categories States
    const [categories, setCategories] = useState<ChatbotCategory[]>([]);
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(categoryId || null);
    const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
    const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryDesc, setNewCategoryDesc] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState(brandColor || '#0f172a');
    const [newCategoryApiKey, setNewCategoryApiKey] = useState('');
    const [newCategoryAvatar, setNewCategoryAvatar] = useState('');
    const [newCategorySlug, setNewCategorySlug] = useState('');
    const [editingCategory, setEditingCategory] = useState<ChatbotCategory | null>(null);
    const [viewModeChat, setViewModeChat] = useState<'categories' | 'chatbots'>(categoryId ? 'chatbots' : 'categories');

    // Edit Chatbot States
    const [isEditBotModalOpen, setIsEditBotModalOpen] = useState(false);
    const [editingBot, setEditingBot] = useState<any>(null);
    const [newBotColor, setNewBotColor] = useState('');
    const [newBotApiKey, setNewBotApiKey] = useState('');
    const [newBotAvatar, setNewBotAvatar] = useState('');
    const [newBotSlug, setNewBotSlug] = useState('');

    // New Modal States
    const [isShareLinkModalOpen, setIsShareLinkModalOpen] = useState(false);
    const [shareLinkToCopy, setShareLinkToCopy] = useState('');
    const [isDeleteConfirmModalOpen, setIsDeleteConfirmModalOpen] = useState(false);
    const [deleteConfig, setDeleteConfig] = useState<{ id: string, type: 'bot' | 'category', name: string } | null>(null);

    // Deep Linking State
    const [initialConversationId, setInitialConversationId] = useState<string | null>(null);
    const [initialVisitorId, setInitialVisitorId] = useState<string | null>(null);

    // PDF Training
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadLimit, setUploadLimit] = useState<string>('');

    // Deep Linking Logic - Adapted for overlay if needed, or simplifed
    useEffect(() => {
        // We might not need hash change logic if valid overlay, but keeping for compatibility if params passed differently
    }, []);

    // Sync Tags for Info Modal
    useEffect(() => {
        if (infoDoc) setTagInput(infoDoc.tags || '');
    }, [infoDoc]);

    useEffect(() => {
        if (brandColor) {
            setNewCategoryColor(brandColor);
        }
    }, [brandColor]);

    // Fetch upload limit once
    useEffect(() => {
        api.get<any>('ai_training?action=get_upload_limit').then((res: any) => {
            if (res?.success) setUploadLimit(res.upload_max_filesize || '');
        }).catch(() => { });
    }, []);

    // PDF upload handler (mirrors AITraining.tsx)
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (fileInputRef.current) fileInputRef.current.value = '';

        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'pdf') { toast.error('Chỉ hỗ trợ file PDF'); return; }

        let totalPages = 0;

        // Method 1: pdfjs-dist (most accurate)
        try {
            const pdfjsLib = await import('../../shims/docReaders');
            pdfjsLib.GlobalWorkerOptions.workerSrc = '';
            const buf = await file.arrayBuffer();
            const pdf = await (pdfjsLib.getDocument({
                data: new Uint8Array(buf),
                useWorkerFetch: false,
                isEvalSupported: false,
                useSystemFonts: true,
            } as any)).promise;
            totalPages = pdf.numPages;
            await pdf.destroy();
        } catch {
            // Method 2: Regex on binary (no external lib needed)
            try {
                const buf2 = await file.arrayBuffer();
                const text = new TextDecoder('latin1').decode(buf2);
                const m1 = text.match(/\/Count\s+(\d+)/);
                if (m1) {
                    totalPages = parseInt(m1[1], 10);
                } else {
                    const m2 = text.match(/\/Type\s*\/Page[^s]/g);
                    totalPages = m2 ? m2.length : 0;
                }
            } catch { totalPages = 0; }
        }

        if (!totalPages || totalPages < 1) {
            toast.error('Không thể đọc số trang PDF. Vui lòng kiểm tra lại file.');
            return;
        }

        const formData = new FormData();
        formData.append('action', 'upload_training_file');
        formData.append('property_id', selectedProperty);
        formData.append('total_pages', String(totalPages));
        formData.append('file', file);

        setLoading(true);
        const tId = toast.loading(`Đang tải lên ${file.name} (${totalPages} trang)...`);
        try {
            const res = await fetch(`${api.baseUrl}/ai_training.php`, { method: 'POST', body: formData });
            const data = await res.json();
            if (data.success) {
                toast.success(
                    `📄 Đã đưa vào hàng đợi: ${data.total_chunks} đợt trích xuất (${totalPages} trang). AI sẽ học ngầm tự động!`,
                    { id: tId, duration: 6000 }
                );
                fetchDocs();
            } else {
                toast.error(data.message || 'Lỗi upload', { id: tId });
            }
        } catch (err: any) {
            toast.error('Lỗi kết nối: ' + err.message, { id: tId });
        } finally {
            setLoading(false);
        }
    };


    const handleTestAI = React.useCallback(() => {
        if (!selectedProperty) return;

        // 1. Set global config
        (window as any)._mf_config = {
            property_id: selectedProperty,
            endpoint: `${API_BASE_URL}/track.php`,
            is_test: true,
            auto_open: 1,
            welcome_msg: settings.welcome_msg,
            bot_name: settings.bot_name,
            brand_color: settings.brand_color,
            bot_avatar: settings.bot_avatar,
            company_name: settings.company_name,
            quick_actions: settings.quick_actions
        };

        // 2. Cleanup existing widget if any
        ['mf-root', 'mf-trigger', 'mf-styles', 'mf-window'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });

        // 3. Remove existing script tag
        const scriptId = 'mf-ai-embedded-script';
        const oldScript = document.getElementById(scriptId);
        if (oldScript) oldScript.remove();

        // 4. Inject script
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `/ai-chat-embedded.js?v=${Date.now()}`;
        document.body.appendChild(script);

        toast.success('Khởi tạo Widget Test...', { icon: '🚀' });
    }, [selectedProperty, settings]);

    const handleSaveTags = async () => {
        if (!infoDoc) return;
        setLoading(true);
        try {
            const res = await api.post<any>('ai_training', { action: 'update_tags', doc_id: infoDoc.id, tags: tagInput });
            if (res.success) {
                toast.success('Đã cập nhật Tags');
                const updatedDocs = docs.map(d => d.id === infoDoc.id ? { ...d, tags: tagInput } : d);
                setDocs(updatedDocs);
                setInfoDoc({ ...infoDoc, tags: tagInput });
            } else toast.error('Lỗi khi lưu tags');
        } catch (e) { toast.error('Lỗi kết nối'); }
        setLoading(false);
    };

    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [isEditFolderModalOpen, setIsEditFolderModalOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState<any>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);
    const [isEmbeddingModalOpen, setIsEmbeddingModalOpen] = useState(false);
    const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);

    useEffect(() => {
        if (!categoryId) {
            fetchProperties();
        }
        fetchCategories(); // Init categories
        fetchChatbots();   // Pre-fetch all chatbots for bulk move/copy
    }, []);

    useEffect(() => {
        // Clear selections when switching properties to avoid cross-property selection bugs
        setSelectedIds([]);
        if (selectedProperty) {
            fetchDocs(docSearchTerm);
            fetchSettings();
        }
    }, [selectedProperty]);

    // Debounced search for training documents
    useEffect(() => {
        if (!selectedProperty) return;
        const timer = setTimeout(() => {
            fetchDocs(docSearchTerm);
        }, 500);
        return () => clearTimeout(timer);
    }, [docSearchTerm]);

    // ── Polling: auto-refresh docs when training is in progress ──────────────
    const docsRef = useRef(docs);
    useEffect(() => { docsRef.current = docs; }, [docs]);
    const selectedPropertyRef = useRef(selectedProperty);
    useEffect(() => { selectedPropertyRef.current = selectedProperty; }, [selectedProperty]);
    const docSearchTermRef = useRef(docSearchTerm);
    useEffect(() => { docSearchTermRef.current = docSearchTerm; }, [docSearchTerm]);
    const pollingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!selectedProperty) return;
        let cancelled = false;

        const schedulePoll = () => {
            pollingTimeoutRef.current = setTimeout(async () => {
                if (cancelled) return;
                // Only call the API when there is actual work in progress
                // Loop stays alive regardless — auto-wakes when training starts
                const hasWIP = docsRef.current.some(
                    d => d.status === 'pending' || d.status === 'processing'
                );
                if (hasWIP) {
                    try {
                        const propId = selectedPropertyRef.current;
                        const search = docSearchTermRef.current;
                        const queryParam = search ? `&search=${encodeURIComponent(search)}` : '';
                        const res = await api.get<any>(
                            `ai_training?action=list_docs&property_id=${propId}${queryParam}`
                        );
                        if (!cancelled && res.success) setDocs(res.data);
                    } catch (_) { /* silent — retry next tick */ }
                }
                if (!cancelled) schedulePoll();
            }, 3000);
        };

        schedulePoll();
        return () => {
            cancelled = true;
            if (pollingTimeoutRef.current) {
                clearTimeout(pollingTimeoutRef.current);
                pollingTimeoutRef.current = null;
            }
        };
         
    }, [selectedProperty]);

    useEffect(() => {
        if (viewModeChat === 'chatbots' && selectedCategoryId) {
            fetchChatbots(selectedCategoryId);
        }
    }, [viewModeChat, selectedCategoryId]);

    const fetchProperties = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<any>('web_tracking?action=list');
            if (res.success) {
                let props = res.data || [];
                if (categoryId) {
                    props = props.filter((p: any) => p.category_id === categoryId);
                }
                setProperties(props);
            }
        } catch (e) {
            toast.error('Không thể tải danh sách website');
        } finally {
            setLoading(false);
        }
    }, [categoryId]);

    const fetchCategories = React.useCallback(async () => {
        try {
            const res = await api.get<any>('ai_chatbots?action=list_categories');
            if (res.success) {
                let cats = res.data || [];
                if (categoryId) {
                    cats = cats.filter((c: any) => String(c.id) === String(categoryId));
                }
                setCategories(cats);
                // Auto-select first category on load if none selected
                if (!selectedCategoryId && cats.length > 0) {
                    setSelectedCategoryId(cats[0].id);
                }
            }
        } catch (e) {
            toast.error('Không thể tải danh sách nhóm');
        }
    }, [categoryId, selectedCategoryId]);

    const fetchChatbots = React.useCallback(async (catId?: string) => {
        try {
            const url = catId
                ? `ai_chatbots?action=list&category_id=${catId}`
                : 'ai_chatbots?action=list'; // Fallback logic
            const res = await api.get<any>(url);
            if (res.success) {
                let bots = res.data || [];
                if (categoryId) {
                    bots = bots.filter((b: any) => b.category_id === categoryId);
                }
                setChatbots(bots);
            }
        } catch (e) {
            toast.error('Không thể tải danh sách AI Chatbot');
        }
    }, [categoryId]);

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) {
            toast.error('Vui lòng nhập tên nhóm');
            return;
        }

        const tid = toast.loading('Đang tạo nhóm mới...');
        try {
            const res = await api.post<any>('ai_chatbots?action=create_category', {
                name: newCategoryName,
                description: newCategoryDesc,
                brand_color: newCategoryColor,
                gemini_api_key: newCategoryApiKey,
                bot_avatar: newCategoryAvatar,
                slug: newCategorySlug
            });

            if (res.success) {
                toast.success('Đã tạo nhóm mới thành công', { id: tid });
                setIsCreateCategoryModalOpen(false);
                setNewCategoryName('');
                setNewCategoryDesc('');
                setNewCategoryColor('#0066FF');
                setNewCategoryApiKey('');
                setNewCategoryAvatar('');
                setNewCategorySlug('');
                fetchCategories();
            } else {
                toast.error(res.message || 'Lỗi khi tạo nhóm', { id: tid });
            }
        } catch (e) {
            toast.error('Đã xảy ra lỗi kết nối', { id: tid });
        }
    };

    const handleEditCategory = async (category: ChatbotCategory) => {
        // If the passed category is incomplete (e.g. name is empty due to timing), fetch fresh
        let cat = category;
        if (!cat.name && (cat.id || categoryId)) {
            try {
                // Use resolvePropertyId style fetching or just list and find
                const targetId = cat.id || categoryId;
                const res = await api.get<any>(`ai_chatbots?action=list_categories`);
                if (res.success && res.data) {
                    const found = res.data.find((c: any) => String(c.id) === String(targetId));
                    if (found) cat = found;
                }
            } catch (e) { /* use cat as-is */ }
        }
        setEditingCategory(cat);
        setNewCategoryName(cat.name || '');
        setNewCategoryDesc(cat.description || '');
        setNewCategoryColor(cat.brand_color || '#0066FF');
        setNewCategoryApiKey(cat.gemini_api_key || '');
        setNewCategoryAvatar(cat.bot_avatar || '');
        setNewCategorySlug(cat.slug || '');
        setIsEditCategoryModalOpen(true);
    };

    const handleUpdateCategory = async () => {
        if (!editingCategory || !newCategoryName.trim()) return;

        const tid = toast.loading('Đang cập nhật nhóm...');
        try {
            const res = await api.post<any>('ai_chatbots?action=update_category', {
                id: editingCategory.id,
                name: newCategoryName,
                description: newCategoryDesc,
                brand_color: newCategoryColor,
                gemini_api_key: newCategoryApiKey,
                bot_avatar: newCategoryAvatar,
                slug: newCategorySlug
            });

            if (res.success) {
                toast.success('Đã cập nhật nhóm thành công', { id: tid });
                setIsEditCategoryModalOpen(false);
                setEditingCategory(null);
                setNewCategoryName('');
                setNewCategoryDesc('');
                setNewCategoryColor('#0066FF');
                setNewCategoryApiKey('');
                setNewCategoryAvatar('');
                setNewCategorySlug('');
                fetchCategories();
            } else {
                toast.error(res.message || 'Lỗi khi cập nhật', { id: tid });
            }
        } catch (e) {
            toast.error('Đã xảy ra lỗi kết nối', { id: tid });
        }
    };

    const handleCreateBot = async () => {
        if (!newBotName.trim()) {
            toast.error('Vui lòng nhập tên AI Chatbot');
            return;
        }
        setLoading(true);
        const tid = toast.loading('Đang tạo AI Chatbot...');
        try {
            const res = await api.post<any>('ai_chatbots?action=create', {
                name: newBotName,
                description: newBotDesc,
                slug: newBotSlug,
                category_id: selectedCategoryId
            });
            if (res.success) {
                toast.success('Đã tạo AI Chatbot mới thành công', { id: tid });
                setIsCreateBotModalOpen(false);
                setNewBotName('');
                setNewBotDesc('');
                setNewBotSlug('');
                fetchChatbots(selectedCategoryId || undefined);
                fetchCategories();
            } else {
                toast.error(res.message || 'Lỗi tạo chatbot', { id: tid });
            }
        } catch (e) {
            toast.error('Lỗi kết nối máy chủ', { id: tid });
        } finally {
            setLoading(false);
        }
    };

    const handleEditBot = async (bot: any) => {
        setEditingBot(bot);
        setNewBotName(bot.name);
        setNewBotDesc(bot.description || '');
        setNewBotColor('');
        setNewBotApiKey('');
        setNewBotAvatar('');
        setNewBotSlug(bot.slug || '');

        setIsEditBotModalOpen(true);
        // Load existing settings
        try {
            const res = await api.get<any>(`ai_training?action=get_settings&property_id=${bot.id}`);
            if (res.success && res.data) {
                setNewBotColor(res.data.brand_color_source === 'category' ? '' : (res.data.brand_color || ''));
                setNewBotApiKey(res.data.gemini_api_key_source === 'category' ? '' : (res.data.gemini_api_key || ''));
                setNewBotAvatar(res.data.bot_avatar_source === 'category' ? '' : (res.data.bot_avatar || ''));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleUpdateBot = async () => {
        if (!editingBot || !newBotName.trim()) return;
        setLoading(true);
        const tid = toast.loading('Đang cập nhật AI Chatbot...');
        try {
            const res = await api.post<any>('ai_chatbots?action=update', {
                id: editingBot.id,
                name: newBotName,
                description: newBotDesc,
                slug: newBotSlug,
                brand_color: newBotColor,
                gemini_api_key: newBotApiKey,
                bot_avatar: newBotAvatar,
                category_id: editingBot.category_id
            });

            if (res.success) {
                toast.success('Cập nhật Chatbot thành công', { id: tid });
                setIsEditBotModalOpen(false);
                // Refresh list if needed (we are likely viewing the chatbots list)
                if (selectedCategoryId) {
                    const resList = await api.get<any>(`ai_chatbots?action=list&category_id=${selectedCategoryId}`);
                    if (resList.success) setChatbots(resList.data);
                }
            } else {
                toast.error(res.message || 'Lỗi cập nhật', { id: tid });
            }
        } catch (e) {
            toast.error('Đã xảy ra lỗi kết nối', { id: tid });
        } finally {
            setLoading(false);
        }
    };

    // Re-fetch chatbots when switching back to grid view to prevent empty list
    useEffect(() => {
        if (viewMode === 'grid' && mainTab === 'chat' && viewModeChat === 'chatbots' && selectedCategoryId) {
            fetchChatbots(selectedCategoryId);
        }
    }, [viewMode, mainTab]);

    const handleDeleteChatbot = (id: string, name: string) => {
        setDeleteConfig({ id, name, type: 'bot' });
        setIsDeleteConfirmModalOpen(true);
    };

    const confirmDeleteChatbot = async (id: string) => {
        const tid = toast.loading('Đang xóa AI Chatbot...');
        try {
            const res = await api.post<any>('ai_chatbots?action=delete', { id });
            if (res.success) {
                toast.success('Đã xóa AI Chatbot thành công', { id: tid });
                fetchChatbots(selectedCategoryId || undefined);
                fetchCategories();
                setIsDeleteConfirmModalOpen(false);
            } else {
                toast.error(res.message || 'Lỗi khi xóa chatbot', { id: tid });
            }
        } catch (e) {
            toast.error('Lỗi kết nối máy chủ', { id: tid });
        }
    };

    const handleDeleteCategory = (id: string, name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfig({ id, name, type: 'category' });
        setIsDeleteConfirmModalOpen(true);
    };

    const confirmDeleteCategory = async (id: string) => {
        const tid = toast.loading('Đang xóa nhóm...');
        try {
            const res = await api.post<any>('ai_chatbots?action=delete_category', { id });
            if (res.success) {
                toast.success('Đã xóa nhóm thành công', { id: tid });
                fetchCategories();
                if (selectedCategoryId === id) {
                    setSelectedCategoryId(null);
                    setViewModeChat('categories');
                }
                setIsDeleteConfirmModalOpen(false);
            } else {
                toast.error(res.message || 'Lỗi khi xóa nhóm', { id: tid });
            }
        } catch (e) {
            toast.error('Lỗi kết nối máy chủ', { id: tid });
        }
    };

    const fetchDocs = React.useCallback(async (search?: string) => {
        try {
            const queryParam = search ? `&search=${encodeURIComponent(search)}` : '';
            const res = await api.get<any>(`ai_training?action=list_docs&property_id=${selectedProperty}${queryParam}`);
            if (res.success) {
                const docsData = res.data;
                setDocs(docsData);
            }
        } catch (e) {
            toast.error('Lỗi tải dữ liệu huấn luyện');
        }
    }, [selectedProperty]);

    const handleTrainDocs = React.useCallback(async () => {
        const hasApiKey = settings.gemini_api_key || settings.cat_gemini_api_key;
        if (!hasApiKey) {
            toast.error('Vui lòng cấu hình Gemini API Key (trong bot này hoặc trong Nhóm) trước khi huấn luyện.');
            setActiveTab('settings');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post<any>('ai_training?action=train_docs', { property_id: selectedProperty });
            if (res.success) {
                if ((res as any).async) {
                    toast.success('Hệ thống đang huấn luyện ngầm. Vui lòng đợi vài phút.', { icon: '⏳' });
                } else {
                    toast.success(`Đã huấn luyện xong ${(res as any).trained_count || 0} mục`);
                }
                fetchDocs();
            } else {
                toast.error('Lỗi huấn luyện: ' + res.message);
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    }, [selectedProperty, settings, fetchDocs]);

    const fetchSettings = async () => {
        try {
            const res = await api.get<any>(`ai_training?action=get_settings&property_id=${selectedProperty}`);
            if (res.success && res.data) {
                const data = res.data;
                let qa = [];
                try {
                    qa = typeof data.quick_actions === 'string' ? JSON.parse(data.quick_actions) : (data.quick_actions || []);
                } catch (e) { qa = []; }

                let fr = [];
                try {
                    fr = typeof data.fast_replies === 'string' ? JSON.parse(data.fast_replies) : (data.fast_replies || []);
                } catch (e) { fr = []; }

                setSettings({
                    ...data,
                    company_name: data.company_name || '',
                    quick_actions: Array.isArray(qa) ? qa : [],
                    fast_replies: Array.isArray(fr) ? fr : [],
                    widget_position: data.widget_position || 'bottom-right',
                    excluded_pages: typeof data.excluded_pages === 'string' ? JSON.parse(data.excluded_pages) : (data.excluded_pages || []),
                    excluded_paths: typeof data.excluded_paths === 'string' ? JSON.parse(data.excluded_paths) : (data.excluded_paths || []),
                    cat_gemini_api_key: data.cat_gemini_api_key || '',
                    cat_brand_color: data.cat_brand_color || '',
                    cat_bot_avatar: data.cat_bot_avatar || '',
                    intent_configs: (typeof data.intent_configs === 'string' ? JSON.parse(data.intent_configs) : data.intent_configs) || {}
                });
            } else {
                setSettings({
                    property_id: selectedProperty,
                    is_enabled: 0,
                    bot_name: 'AI Assistant',
                    company_name: '',
                    brand_color: '#111729',
                    bot_avatar: '',
                    welcome_msg: 'Chào bạn, chúng tôi có thể giúp gì cho bạn?',
                    persona_prompt: 'Bạn là trợ lý ảo chuyên nghiệp.',
                    gemini_api_key: '',
                    temperature: 1,
                    max_output_tokens: 16384,
                    history_limit: 10,
                    top_k: 12,
                    quick_actions: [],
                    intent_configs: {},
                    system_instruction: '',
                    fast_replies: [
                        { pattern: 'chào, hi, hello, xin chào, hé lô, chào bạn, hello ad, hi ad', reply: 'Chào bạn! Mình là trợ lý của {companyName}. Mình có thể giúp gì cho bạn hôm nay ạ?' },
                        { pattern: 'tạm biệt, bye, cám ơn, cảm ơn, thanks, kêu, iu, yêu', reply: 'Dạ, cảm ơn bạn đã quan tâm! Chúc bạn một ngày tốt lành ạ.' },
                        { pattern: 'ok, oke, dạ, vâng, đúng, ok nhé, oke nhé', reply: 'Dạ vâng ạ. Bạn cần hỗ trợ thêm thông tin gì không ạ?' },
                        { pattern: 'hihi, hehe, haha, kaka, hí hí', reply: '😊' },
                        { pattern: 'ngu, dốt, kém, tệ, cút, biến, vô dụng', reply: 'Xin lỗi nếu mình làm bạn phật ý. Mình sẽ cố gắng học hỏi thêm từng ngày để hỗ trợ bạn tốt hơn ạ.' },
                        { pattern: 'thông minh, giỏi, tốt, hay quá, xịn, tuyệt vời', reply: 'Cảm ơn bạn đã khen! Mình sẽ tiếp tục cố gắng phát huy ạ.' },
                        { pattern: 'tên gì, tên là, mày là ai, bạn là ai', reply: 'Mình là trợ lý ảo AI được phát triển bởi {companyName} để hỗ trợ bạn 24/7 ạ.' },
                        { pattern: 'có ai, ai, nhân viên, người, gặp, chat với, tư vấn, trực', reply: 'Dạ Anh/chị cần thông tin gì cứ nhắn em nhé.' }
                    ],
                    widget_position: 'bottom-right',
                    excluded_pages: [],
                    excluded_paths: [],
                    auto_open: 0
                });
            }
        } catch (e) {
            console.error('Lỗi tải cài đặt');
        }
    };

    const handleSaveSettings = React.useCallback(async () => {
        if (!selectedProperty) return;
        const hasApiKey = settings.gemini_api_key || settings.cat_gemini_api_key;
        if (!hasApiKey) {
            toast.error('Vui lòng nhập Gemini API Key để kích hoạt AI');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post<any>('ai_training?action=update_settings', {
                ...settings,
                property_id: selectedProperty
            });
            if (res.success) {
                toast.success('Đã cập nhật cấu hình AI');
            }
        } catch (e) {
            toast.error('Cập nhật thất bại');
        } finally {
            setLoading(false);
        }
    }, [selectedProperty, settings]);

    const toggleChatbotStatus = React.useCallback(async (newStatus: number) => {
        if (!selectedProperty) return;
        const oldStatus = settings.is_enabled;
        setSettings({ ...settings, is_enabled: newStatus });

        try {
            const res = await api.post<any>('ai_training?action=update_settings', {
                ...settings,
                is_enabled: newStatus,
                property_id: selectedProperty
            });
            if (res.success) {
                toast.success(newStatus ? 'Đã kích hoạt Chatbot' : 'Đã tạm dừng Chatbot');
            } else {
                setSettings({ ...settings, is_enabled: oldStatus });
                toast.error(res.message);
            }
        } catch (e) {
            setSettings({ ...settings, is_enabled: oldStatus });
            toast.error('Cập nhật thất bại');
        }
    }, [selectedProperty, settings]);

    const toggleDoc = React.useCallback(async (id: string, currentStatus: number, batchId?: string) => {
        try {
            if (batchId) {
                const res = await api.post<any>('ai_training?action=toggle_batch', {
                    property_id: selectedProperty,
                    batch_id: batchId,
                    is_active: currentStatus ? 0 : 1
                });
                if (res.success) {
                    toast.success('Đã cập nhật Trạng thái nhóm');
                    fetchDocs();
                }
            } else {
                const newStatus = Number(currentStatus) === 1 ? 0 : 1;
                const res = await api.post<any>('ai_training?action=update_doc', {
                    property_id: selectedProperty,
                    id: id,
                    is_active: newStatus
                });
                if (res.success) {
                    toast.success(newStatus ? 'Đã kích hoạt' : 'Đã hủy kích hoạt');
                    fetchDocs();
                }
            }
        } catch (e) {
            toast.error('Lỗi cập nhật');
        }
    }, [selectedProperty, fetchDocs]);

    const deleteDoc = React.useCallback(async (id: string | null | undefined, batchId?: string) => {
        setIsDeleteModalOpen(true);
        setDeleteTarget({ id: id || undefined, batchId });
    }, []);

    const confirmDelete = React.useCallback(async () => {
        if (!deleteTarget) return;
        setLoading(true);
        try {
            if (deleteTarget.batchId) {
                const res = await api.post<any>('ai_training?action=delete_batch', {
                    property_id: selectedProperty,
                    batch_id: deleteTarget.batchId
                });
                if (res.success) {
                    toast.success('Đã xóa nhóm dữ liệu');
                    fetchDocs();
                    setIsDeleteModalOpen(false);
                }
            } else {
                const res = await api.delete<any>(`ai_training?action=delete_doc&id=${deleteTarget.id}&property_id=${selectedProperty}`);
                if (res.success) {
                    toast.success('Đã xóa dữ liệu');
                    fetchDocs();
                    setIsDeleteModalOpen(false);
                }
            }
        } catch (e) {
            toast.error('Lỗi xóa dữ liệu');
        } finally {
            setLoading(false);
            setDeleteTarget(null);
        }
    }, [deleteTarget, selectedProperty, fetchDocs]);

    const handleAddManual = React.useCallback(async () => {
        if (!newDoc.content) return toast.error('Nội dung không được để trống');

        setLoading(true);
        try {
            const res = await api.post<any>('ai_training?action=add_manual', {
                ...newDoc,
                property_id: selectedProperty,
                batch_id: newDoc.batchName || undefined
            });
            if (res.success) {
                toast.success('Đã nạp dữ liệu thành công');
                setIsAddModalOpen(false);
                setNewDoc({ name: '', content: '', tags: '', batchName: '' });
                setTagInput('');
                fetchDocs();
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error('Lỗi kết nối AI');
        } finally {
            setLoading(false);
        }
    }, [newDoc, selectedProperty, fetchDocs]);

    const handleViewDoc = React.useCallback(async (id: string) => {
        setEditingDoc(null);
        setLoading(true);
        try {
            const res = await api.get<any>(`ai_training?action=get_doc&id=${id}&property_id=${selectedProperty}`);
            if (res.success && res.data) {
                const docData = res.data;
                let tags = [];
                if (docData.tags) {
                    try {
                        tags = typeof docData.tags === 'string' ? JSON.parse(docData.tags) : docData.tags;
                    } catch (e) { tags = []; }
                }

                setEditingDoc({
                    id: docData.id,
                    name: docData.name || '',
                    content: docData.content || '',
                    tags: Array.isArray(tags) ? tags : [],
                    source_type: docData.source_type,
                    created_at: docData.created_at,
                    updated_at: docData.updated_at
                });
                setIsEditModalOpen(true);
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error('Không thể tải nội dung tài liệu');
        } finally {
            setLoading(false);
        }
    }, [selectedProperty]);

    const handleUpdateDoc = React.useCallback(async () => {
        if (!editingDoc) return;
        if (!editingDoc.content) return toast.error('Nội dung không được để trống');

        // Check for changes
        const originalDoc = docs.find(d => d.id === editingDoc.id);
        if (originalDoc) {
            const isNameSame = (originalDoc.name || '').trim() === (editingDoc.name || '').trim();
            const isContentSame = (originalDoc.content || '').trim() === (editingDoc.content || '').trim();

            const parseTags = (val: any) => {
                if (Array.isArray(val)) return val;
                if (typeof val === 'string') return val.split(',');
                return [];
            };

            const t1 = parseTags(originalDoc.tags).map((t: string) => t.trim()).filter((t: string) => t).sort().join(',');
            const t2 = parseTags(editingDoc.tags).map((t: string) => t.trim()).filter((t: string) => t).sort().join(',');

            const isTagsSame = t1 === t2;

            if (isNameSame && isContentSame && isTagsSame) {
                // No changes at all
                setIsEditModalOpen(false);
                return;
            }
        }

        // Prepare tags as Array
        const tagsToSend = typeof editingDoc.tags === 'string'
            ? editingDoc.tags.split(',').map((t: string) => t.trim()).filter((t: string) => t)
            : (Array.isArray(editingDoc.tags) ? editingDoc.tags : []);

        setLoading(true);
        try {
            const res = await api.post<any>('ai_training?action=update_doc', {
                property_id: selectedProperty,
                id: editingDoc.id,
                name: editingDoc.name,
                content: editingDoc.content,
                tags: tagsToSend
            });
            if (res.success) {
                toast.success('Cập nhật thành công');
                setIsEditModalOpen(false);
                fetchDocs();
            }
        } catch (e) {
            toast.error('Lỗi cập nhật dữ liệu');
        } finally {
            setLoading(false);
        }
    }, [editingDoc, docs, selectedProperty, fetchDocs]);

    const handleCreateFolder = React.useCallback(async () => {
        if (!folderName.trim()) return;
        setLoading(true);
        try {
            const res = await api.post<any>('ai_training?action=create_folder', {
                property_id: selectedProperty, name: folderName
            });
            if (res.success) {
                toast.success('Đã tạo thư mục');
                setIsFolderModalOpen(false);
                setFolderName('');
                fetchDocs();
            }
        } catch (e) { toast.error('Lỗi tạo thư mục'); }
        finally { setLoading(false); }
    }, [folderName, selectedProperty, fetchDocs]);

    const handleEditFolder = React.useCallback((folder: any) => {
        setEditingFolder(folder);
        setFolderName(folder.name);
        setIsEditFolderModalOpen(true);
    }, []);

    const handleUpdateFolder = React.useCallback(async () => {
        if (!folderName.trim() || !editingFolder) return;
        setLoading(true);
        try {
            const res = await api.post<any>('ai_training?action=update_doc', {
                property_id: selectedProperty,
                id: editingFolder.id,
                name: folderName
            });
            if (res.success) {
                toast.success('Đã đổi tên thư mục');
                setIsEditFolderModalOpen(false);
                setEditingFolder(null);
                setFolderName('');
                fetchDocs();
            }
        } catch (e) { toast.error('Lỗi cập nhật thư mục'); }
        finally { setLoading(false); }
    }, [folderName, editingFolder, selectedProperty, fetchDocs]);

    const handleAutoLearnSynonyms = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.post<any>('ai_training?action=auto_learn_synonyms', { property_id: selectedProperty });
            if (res.success) {
                toast.success(res.message, { icon: '✨' });
                fetchSettings();
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error('Lỗi phân tích từ đồng nghĩa');
        } finally {
            setLoading(false);
        }
    }, [selectedProperty, fetchSettings]);

    const handleAddSynonymGroup = React.useCallback(() => {
        if (!newSynKey.trim()) return;
        const currentSyns = settings.intent_configs?.synonyms || {};
        const synList = newSynValues.split(',').map(s => s.trim()).filter(s => s);

        const newSyns = { ...currentSyns, [newSynKey.trim()]: synList };
        setSettings({ ...settings, intent_configs: { ...(settings.intent_configs || {}), synonyms: newSyns } });
        setNewSynKey('');
        setNewSynValues('');
    }, [newSynKey, newSynValues, settings]);

    const handleRemoveSynonymGroup = React.useCallback((key: string) => {
        const currentSyns = { ...(settings.intent_configs?.synonyms || {}) };
        delete currentSyns[key];
        setSettings({ ...settings, intent_configs: { ...(settings.intent_configs || {}), synonyms: currentSyns } });
    }, [settings]);

    const startEditSynonym = React.useCallback((key: string, list: string[]) => {
        setEditingSynKey(key);
        setEditSynKeyVal(key);
        setEditSynValuesVal(list.join(', '));
    }, []);

    const cancelEditSynonym = React.useCallback(() => {
        setEditingSynKey(null);
        setEditSynKeyVal('');
        setEditSynValuesVal('');
    }, []);

    const saveEditSynonym = React.useCallback(() => {
        if (!editingSynKey || !editSynKeyVal.trim()) return;

        const currentSyns = { ...(settings.intent_configs?.synonyms || {}) };

        if (editingSynKey !== editSynKeyVal.trim()) {
            delete currentSyns[editingSynKey];
        }

        const synList = editSynValuesVal.split(',').map(s => s.trim()).filter(s => s);
        currentSyns[editSynKeyVal.trim()] = synList;

        setSettings({ ...settings, intent_configs: { ...(settings.intent_configs || {}), synonyms: currentSyns } });
        cancelEditSynonym();
    }, [editingSynKey, editSynKeyVal, editSynValuesVal, settings, cancelEditSynonym]);

    const handleSaveSynonyms = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.post<any>('ai_training?action=update_settings', {
                property_id: selectedProperty,
                ...settings,
                intent_configs: settings.intent_configs
            });
            if (res.success) {
                toast.success('Đã lưu cấu hình từ đồng nghĩa', { icon: '💾' });
                fetchSettings();
                setIsSynonymsModalOpen(false);
            } else {
                toast.error('Lỗi khi lưu');
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    }, [selectedProperty, settings, fetchSettings]);

    const onReorder = React.useCallback(async (fromIndex: number, toIndex: number, list: any[]) => {
        const newList = [...list];
        const [movedItem] = newList.splice(fromIndex, 1);
        newList.splice(toIndex, 0, movedItem);

        const priorityUpdates: { id: string, priority: number, is_batch?: boolean, batch_id?: string }[] = [];
        const newDocs = [...docs];

        newList.forEach((item, idx) => {
            const newPriority = 2000 - idx;
            if (item.isGroup) {
                priorityUpdates.push({ id: item.id, priority: newPriority, is_batch: true, batch_id: item.batchId });
                newDocs.forEach(d => {
                    if (d.parent_id === item.batchId || d.id === item.id) {
                        d.priority = newPriority;
                    }
                });
            } else {
                priorityUpdates.push({ id: item.id, priority: newPriority });
                const dIdx = newDocs.findIndex(d => d.id === item.id);
                if (dIdx > -1) newDocs[dIdx].priority = newPriority;
            }
        });

        setDocs(newDocs);

        try {
            const res = await api.post<any>('ai_training?action=update_priority', {
                property_id: selectedProperty,
                items: priorityUpdates
            });
            if (res.success) {
                toast.success('Đã cập nhật thứ tự', { icon: '✨' });
            }
        } catch (e) {
            toast.error('Không thể lưu thứ tự mới');
            fetchDocs(); // Rollback
        }
    }, [selectedProperty, docs, fetchDocs]);

    const totalSelectableCount = React.useMemo(() => docs.length, [docs]);

    const groupedDocs = React.useMemo(() => {
        const groups: Record<string, any> = {};
        const rootDocs: any[] = [];

        docs.forEach(doc => {
            const pId = doc.parent_id && doc.parent_id !== '0' ? doc.parent_id : null;

            if (doc.source_type === 'folder') {
                groups[doc.id] = { ...doc, isGroup: true, members: [], totalSize: 0, batchId: doc.id };
            } else if (!pId) {
                rootDocs.push({ ...doc, isGroup: false, batchId: null });
            }
        });

        docs.forEach(doc => {
            if (doc.source_type === 'folder') return;

            const pId = doc.parent_id && doc.parent_id !== '0' ? doc.parent_id : null;
            if (pId && groups[pId]) {
                const member = { ...doc };
                groups[pId].members.push(member);
                groups[pId].totalSize += (parseInt(member.content_size || '0') || 0);
            } else if (pId && !groups[pId]) {
                rootDocs.push({ ...doc, isGroup: false });
            }
        });

        const combined = [...Object.values(groups), ...rootDocs];

        return combined.sort((a, b) => {
            if ((b.priority || 0) !== (a.priority || 0)) {
                return (b.priority || 0) - (a.priority || 0);
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [docs]);

    const onToggleSelect = React.useCallback((id: string) => {
        const targetDoc = docs.find(d => d.id === id);
        const childrenIds = (targetDoc?.source_type === 'folder')
            ? docs.filter(d => d.parent_id === id).map(d => d.id)
            : [];

        const allToToggle = [id, ...childrenIds];

        setSelectedIds(prev => {
            const newSet = new Set(prev);
            const isSelected = newSet.has(id);

            if (isSelected) {
                allToToggle.forEach(tId => newSet.delete(tId));
            } else {
                allToToggle.forEach(tId => newSet.add(tId));
            }
            return Array.from(newSet);
        });
    }, [docs]);

    const onToggleSelectAll = React.useCallback(() => {
        const allInViewIds = docs.map(d => d.id);
        const currentSelectedSet = new Set(selectedIds);
        const isAllSelected = allInViewIds.length > 0 && allInViewIds.every(id => currentSelectedSet.has(id));

        if (isAllSelected) {
            setSelectedIds([]);
        } else {
            setSelectedIds(allInViewIds);
        }
    }, [selectedIds, docs]);

    const selectedIdsSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

    const handleBulkDelete = React.useCallback(() => {
        if (selectedIds.length === 0) return;
        setDeleteVerifyText('');
        setIsBulkDeleteConfirmModalOpen(true);
    }, [selectedIds]);

    const handleFinalBulkDelete = React.useCallback(async () => {
        if (deleteVerifyText.toUpperCase() !== 'DELETE') {
            toast.error('Vui lòng nhập chính xác "DELETE" để xác nhận.');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post<any>('ai_training?action=bulk_delete', {
                property_id: selectedProperty,
                ids: selectedIds
            });
            if (res.success) {
                toast.success(`Đã xóa ${selectedIds.length.toLocaleString()} mục`);
                setSelectedIds([]);
                setIsBulkDeleteConfirmModalOpen(false);
                fetchDocs();
            } else {
                toast.error(res.message || 'Lỗi khi xóa hàng loạt');
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    }, [selectedProperty, deleteVerifyText, selectedIds, fetchDocs]);

    const handleBulkAction = React.useCallback(async () => {
        if (!bulkActionType || !targetPropertyId) return;

        setLoading(true);
        try {
            const res = await api.post<any>(`ai_training?action=bulk_${bulkActionType}`, {
                property_id: selectedProperty,
                target_property_id: targetPropertyId,
                ids: selectedIds
            });

            if (res.success) {
                toast.success(`Đã ${bulkActionType === 'copy' ? 'sao chép' : 'di chuyển'} ${selectedIds.length.toLocaleString()} mục thành công.`);
                setSelectedIds([]);
                setIsBulkMoveModalOpen(false);
                setBulkActionType(null);

                const trainRes = await api.post<any>('ai_training?action=train_docs', { property_id: targetPropertyId });
                if (trainRes.success && (trainRes as any).async) {
                    toast.success('Đã kích hoạt huấn luyện tự động cho chatbot đích.', { icon: '✨' });
                }

                setTargetPropertyId('');
                fetchDocs();
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    }, [bulkActionType, targetPropertyId, selectedProperty, selectedIds, fetchDocs]);

    const addQuickAction = React.useCallback(() => {
        if (!newQuickAction.trim()) return;
        if (settings.quick_actions.length >= 4) return toast.error('Tối đa 4 câu hỏi nhanh');
        setSettings({
            ...settings,
            quick_actions: [...settings.quick_actions, newQuickAction.trim()]
        });
        setNewQuickAction('');
    }, [newQuickAction, settings]);

    const removeQuickAction = React.useCallback((index: number) => {
        const updated = [...settings.quick_actions];
        updated.splice(index, 1);
        setSettings({ ...settings, quick_actions: updated });
    }, [settings]);

    const closeAddModal = React.useCallback(() => setIsAddModalOpen(false), []);
    const closeEditModal = React.useCallback(() => { setIsEditModalOpen(false); setEditingDoc(null); }, []);

    const filteredChatbots = React.useMemo(() => chatbots.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [chatbots, searchTerm]);

    const hexToHSL = (hex: string) => {
        let r = 0, g = 0, b = 0;
        const hx = hex.startsWith('#') ? hex : '#' + hex;
        if (hx.length === 4) {
            r = parseInt("0x" + hx[1] + hx[1]) / 255;
            g = parseInt("0x" + hx[2] + hx[2]) / 255;
            b = parseInt("0x" + hx[3] + hx[3]) / 255;
        } else if (hx.length === 7) {
            r = parseInt("0x" + hx[1] + hx[2]) / 255;
            g = parseInt("0x" + hx[3] + hx[4]) / 255;
            b = parseInt("0x" + hx[5] + hx[6]) / 255;
        }
        let cmin = Math.min(r, g, b), cmax = Math.max(r, g, b), delta = cmax - cmin, h = 0, s = 0, l = 0;
        if (delta === 0) h = 0;
        else if (cmax === r) h = ((g - b) / delta) % 6;
        else if (cmax === g) h = (b - r) / delta + 2;
        else h = (r - g) / delta + 4;
        h = Math.round(h * 60);
        if (h < 0) h += 360;
        l = (cmax + cmin) / 2;
        s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
        s = +(s * 100).toFixed(1);
        l = +(l * 100).toFixed(1);
        return { h, s, l };
    };

    const hsl = hexToHSL(brandColor);

    return (
        <div className={`ai-space-root w-full h-full flex flex-col animate-in fade-in duration-300 ${isDarkTheme ? 'bg-[#05070A]' : 'bg-slate-50'}`}>
            <style dangerouslySetInnerHTML={{
                __html: `
                @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,300;0,400;0,500;0,700;0,900;1,400&display=swap');
                :root {
                    --brand-h: ${hsl.h};
                    --brand-s: ${hsl.s}%;
                    --brand-l: ${hsl.l}%;
                    --brand-primary: hsl(var(--brand-h), var(--brand-s), var(--brand-l));
                    --brand-primary-light: hsl(var(--brand-h), var(--brand-s), calc(var(--brand-l) + 10%));
                    --brand-primary-dark: hsl(var(--brand-h), var(--brand-s), calc(var(--brand-l) - 10%));
                    --brand-surface: ${isDarkTheme ? 'hsl(var(--brand-h), var(--brand-s), 10%)' : 'hsl(var(--brand-h), var(--brand-s), 98.5%)'};
                    --brand-shadow: hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.12);
                }
                .bg-[var(--color-primary)] { background-color: var(--brand-primary) !important; }
                .text-[var(--color-primary)] { color: var(--brand-primary) !important; }
                .from-[var(--color-primary)] { --tw-gradient-from: var(--brand-primary) !important; --tw-gradient-to: var(--brand-primary-dark) !important; --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important; }
                .to-[#9A1523] { --tw-gradient-to: var(--brand-primary-dark) !important; }
                .ai-space-root, .ai-space-root * { font-family: 'Roboto', sans-serif !important; }
            `}} />
            {/* Content */}
            <div className={`flex-1 overflow-y-auto px-4 md:px-6 lg:px-12 pt-4 md:pt-16 lg:pt-24 pb-12 custom-scrollbar`}>
                <div className="w-full max-w-[1600px] mx-auto pb-20">
                    {activeTab === 'logs' ? (
                        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={() => setActiveTab('inbox')}
                                        className={`w-12 h-12 rounded-[14px] flex items-center justify-center transition-all shadow-sm hover:shadow-md group ${isDarkTheme ? 'bg-slate-800 border border-slate-700 hover:bg-slate-750' : 'bg-white border border-slate-100 hover:bg-slate-50'}`}
                                    >
                                        <ArrowLeft className={`w-6 h-6 transition-colors ${isDarkTheme ? 'text-slate-500 group-hover:text-slate-200' : 'text-slate-400 group-hover:text-slate-900'}`} />
                                    </button>
                                    <div className="flex items-center gap-4">
                                        <div className={`w-14 h-14 rounded-[14px] bg-gradient-to-br from-[var(--color-primary)] to-[#9A1523] flex items-center justify-center text-white shadow-xl shadow-[var(--color-primary)]/20 transition-all duration-500`}>
                                            <Activity className="w-7 h-7" />
                                        </div>
                                        <div>
                                            <h2 className={`text-2xl font-black tracking-tight ${isDarkTheme ? 'text-white' : 'text-slate-800'}`}>Hệ thống Quản trị</h2>
                                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Thống kê & Nhật ký hoạt động toàn cục</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <AdminLogsTab
                                categoryId={categoryId}
                                initialBotId={selectedBotLogsId}
                                brandColor={brandColor}
                                onEditMember={onOpenOrgManager}
                                isDarkTheme={isDarkTheme}
                            />
                        </div>
                    ) : viewMode === 'grid' ? (
                        <AITrainingGrid
                            isDarkTheme={isDarkTheme}
                            mainTab={mainTab}
                            setMainTab={setMainTab}
                            searchTerm={searchTerm}
                            setSearchTerm={setSearchTerm}
                            setIsCreateCategoryModalOpen={setIsCreateCategoryModalOpen}
                            setIsCreateBotModalOpen={setIsCreateBotModalOpen}
                            viewModeChat={viewModeChat}
                            categories={categories}
                            setSelectedCategoryId={setSelectedCategoryId}
                            setViewModeChat={setViewModeChat}
                            selectedCategoryId={selectedCategoryId}
                            setSelectedProperty={setSelectedProperty}
                            setViewMode={setViewMode}
                            handleEditCategory={handleEditCategory}
                            handleDeleteCategory={handleDeleteCategory}
                            chatbots={chatbots}
                            filteredChatbots={filteredChatbots}
                            handleEditBot={handleEditBot}
                            handleDeleteChatbot={handleDeleteChatbot}
                            properties={properties}
                            loading={loading}
                            setShareLinkToCopy={setShareLinkToCopy}
                            setIsShareLinkModalOpen={setIsShareLinkModalOpen}
                            setIsOptimizationModalOpen={setIsOptimizationModalOpen}
                            setIsEmbeddingModalOpen={setIsEmbeddingModalOpen}
                            setIsTipsModalOpen={setIsTipsModalOpen}
                            activePropertyId={selectedProperty}
                            hideWebsiteTab={!!categoryId}
                            brandColor={brandColor}
                            onOpenOrgManager={onOpenOrgManager}
                            setActiveTab={setActiveTab}
                            singleGroupMode={!!categoryId}
                            onClose={onClose}
                            selectedCategory={categories[0] || null}
                        />
                    ) : (
                        <AITrainingDetail
                            mainTab={mainTab}
                            selectedProperty={selectedProperty}
                            chatbots={chatbots}
                            properties={properties}
                            settings={settings}
                            setIsOptimizationModalOpen={setIsOptimizationModalOpen}
                            setIsEmbeddingModalOpen={setIsEmbeddingModalOpen}
                            setIsTipsModalOpen={setIsTipsModalOpen}
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            setSelectedBotLogsId={setSelectedBotLogsId}
                            setIsFolderModalOpen={setIsFolderModalOpen}
                            setIsSynonymsModalOpen={setIsSynonymsModalOpen}
                            loading={loading}
                            handleTestAI={handleTestAI}
                            toggleChatbotStatus={toggleChatbotStatus}
                            docs={docs}
                            handleTrainDocs={handleTrainDocs}
                            docSearchTerm={docSearchTerm}
                            setDocSearchTerm={setDocSearchTerm}
                            selectedIds={selectedIds}
                            fetchChatbots={fetchChatbots}
                            setBulkActionType={setBulkActionType}
                            setIsBulkMoveModalOpen={setIsBulkMoveModalOpen}
                            handleBulkDelete={handleBulkDelete}
                            setSelectedIds={setSelectedIds}
                            groupedDocs={groupedDocs}
                            expandedGroups={expandedGroups}
                            setExpandedGroups={setExpandedGroups}
                            onReorder={onReorder}
                            toggleDoc={toggleDoc}
                            handleViewDoc={handleViewDoc}
                            isDarkTheme={isDarkTheme}
                            deleteDoc={deleteDoc}
                            setInfoDoc={setInfoDoc}
                            newDoc={newDoc}
                            handleEditFolder={handleEditFolder}
                            setIsAddModalOpen={setIsAddModalOpen}
                            setNewDoc={setNewDoc}
                            selectedIdsSet={selectedIdsSet}
                            totalSelectableCount={totalSelectableCount}
                            onToggleSelect={onToggleSelect}
                            onToggleSelectAll={onToggleSelectAll}
                            setSettings={setSettings}
                            showAdvanced={showAdvanced}
                            setShowAdvanced={setShowAdvanced}
                            handleSaveSettings={handleSaveSettings}
                            initialConversationId={initialConversationId}
                            initialVisitorId={initialVisitorId}
                            newQuickAction={newQuickAction}
                            setNewQuickAction={setNewQuickAction}
                            addQuickAction={addQuickAction}
                            removeQuickAction={removeQuickAction}
                            fileInputRef={fileInputRef}
                            handleFileUpload={handleFileUpload}
                            uploadLimit={uploadLimit}
                            fetchDocs={fetchDocs}
                            categoryId={selectedCategoryId || categoryId || undefined}
                            onBack={() => {
                                setSelectedProperty('');
                                setViewMode('grid');
                            }}
                        />
                    )}

                    {/* Modals - Same as AITraining.tsx */}
                    <AIModals
                        isCreateCategoryModalOpen={isCreateCategoryModalOpen}
                        setIsCreateCategoryModalOpen={setIsCreateCategoryModalOpen}
                        newCategoryName={newCategoryName}
                        setNewCategoryName={setNewCategoryName}
                        newCategoryDesc={newCategoryDesc}
                        setNewCategoryDesc={setNewCategoryDesc}
                        newCategoryAvatar={newCategoryAvatar}
                        setNewCategoryAvatar={setNewCategoryAvatar}
                        newCategoryColor={newCategoryColor}
                        setNewCategoryColor={setNewCategoryColor}
                        newCategoryApiKey={newCategoryApiKey}
                        setNewCategoryApiKey={setNewCategoryApiKey}
                        isDarkTheme={isDarkTheme}
                        newCategorySlug={newCategorySlug}
                        setNewCategorySlug={setNewCategorySlug}
                        handleCreateCategory={handleCreateCategory}
                        loading={loading}
                        isEditCategoryModalOpen={isEditCategoryModalOpen}
                        setIsEditCategoryModalOpen={setIsEditCategoryModalOpen}
                        editingCategory={editingCategory}
                        setEditingCategory={setEditingCategory}
                        handleUpdateCategory={handleUpdateCategory}
                        isEditBotModalOpen={isEditBotModalOpen}
                        setIsEditBotModalOpen={setIsEditBotModalOpen}
                        newBotName={newBotName}
                        setNewBotName={setNewBotName}
                        newBotDesc={newBotDesc}
                        setNewBotDesc={setNewBotDesc}
                        editingBot={editingBot}
                        setEditingBot={setEditingBot}
                        newBotColor={newBotColor}
                        setNewBotColor={setNewBotColor}
                        newBotApiKey={newBotApiKey}
                        setNewBotApiKey={setNewBotApiKey}
                        newBotAvatar={newBotAvatar}
                        setNewBotAvatar={setNewBotAvatar}
                        newBotSlug={newBotSlug}
                        setNewBotSlug={setNewBotSlug}
                        handleUpdateBot={handleUpdateBot}
                        isCreateBotModalOpen={isCreateBotModalOpen}
                        setIsCreateBotModalOpen={setIsCreateBotModalOpen}
                        handleCreateBot={handleCreateBot}
                        isDeleteModalOpen={isDeleteModalOpen}
                        setIsDeleteModalOpen={setIsDeleteModalOpen}
                        confirmDelete={confirmDelete}
                        isFolderModalOpen={isFolderModalOpen}
                        setIsFolderModalOpen={setIsFolderModalOpen}
                        folderName={folderName}
                        setFolderName={setFolderName}
                        handleCreateFolder={handleCreateFolder}
                        isEditFolderModalOpen={isEditFolderModalOpen}
                        setIsEditFolderModalOpen={setIsEditFolderModalOpen}
                        setEditingFolder={setEditingFolder}
                        handleUpdateFolder={handleUpdateFolder}
                        infoDoc={infoDoc}
                        setInfoDoc={setInfoDoc}
                        tagInput={tagInput}
                        setTagInput={setTagInput}
                        handleSaveTags={handleSaveTags}
                        isOptimizationModalOpen={isOptimizationModalOpen}
                        setIsOptimizationModalOpen={setIsOptimizationModalOpen}
                        isEmbeddingModalOpen={isEmbeddingModalOpen}
                        setIsEmbeddingModalOpen={setIsEmbeddingModalOpen}
                        isTipsModalOpen={isTipsModalOpen}
                        setIsTipsModalOpen={setIsTipsModalOpen}
                        isShareLinkModalOpen={isShareLinkModalOpen}
                        setIsShareLinkModalOpen={setIsShareLinkModalOpen}
                        shareLinkToCopy={shareLinkToCopy}
                        isDeleteConfirmModalOpen={isDeleteConfirmModalOpen}
                        setIsDeleteConfirmModalOpen={setIsDeleteConfirmModalOpen}
                        deleteConfig={deleteConfig}
                        confirmDeleteChatbot={confirmDeleteChatbot}
                        confirmDeleteCategory={confirmDeleteCategory}
                        isSynonymsModalOpen={isSynonymsModalOpen}
                        setIsSynonymsModalOpen={setIsSynonymsModalOpen}
                        synonyms={memoSynonyms}
                        newSynKey={newSynKey}
                        setNewSynKey={setNewSynKey}
                        newSynValues={newSynValues}
                        setNewSynValues={setNewSynValues}
                        handleAddSynonym={handleAddSynonymGroup}
                        handleAutoLearnSynonyms={handleAutoLearnSynonyms}
                        editingSynKey={editingSynKey}
                        setEditingSynKey={setEditingSynKey}
                        editSynKeyVal={editSynKeyVal}
                        setEditSynKeyVal={setEditSynKeyVal}
                        editSynValuesVal={editSynValuesVal}
                        setEditSynValuesVal={setEditSynValuesVal}
                        handleSaveSynonymEdit={saveEditSynonym}
                        startEditSynonym={startEditSynonym}
                        handleDeleteSynonym={handleRemoveSynonymGroup}
                        handleSaveSynonyms={handleSaveSynonyms}
                        isBulkMoveModalOpen={isBulkMoveModalOpen}
                        setIsBulkMoveModalOpen={setIsBulkMoveModalOpen}
                        bulkActionType={bulkActionType}
                        chatbots={chatbots}
                        targetPropertyId={targetPropertyId}
                        setTargetPropertyId={setTargetPropertyId}
                        handleBulkMoveOrCopy={handleBulkAction}
                        isBulkDeleteConfirmModalOpen={isBulkDeleteConfirmModalOpen}
                        setIsBulkDeleteConfirmModalOpen={setIsBulkDeleteConfirmModalOpen}
                        deleteVerifyText={deleteVerifyText}
                        setDeleteVerifyText={setDeleteVerifyText}
                        confirmBulkDelete={handleFinalBulkDelete}
                        brandColor={brandColor}
                        properties={properties}
                        selectedProperty={selectedProperty}
                        deleteConfirmText={deleteVerifyText}
                        setDeleteConfirmText={setDeleteVerifyText}
                        cancelEditSynonym={() => { setEditingSynKey(null); }}
                        newQuickAction={newQuickAction}
                        setNewQuickAction={setNewQuickAction}
                        addQuickAction={addQuickAction}
                        removeQuickAction={removeQuickAction}
                        isAddModalOpen={isAddModalOpen}
                        setIsAddModalOpen={setIsAddModalOpen}
                        handleAddManual={handleAddManual}
                        groupedDocs={groupedDocs}
                        newDoc={newDoc}
                        setNewDoc={setNewDoc}
                        isEditModalOpen={isEditModalOpen}
                        setIsEditModalOpen={setIsEditModalOpen}
                        handleUpdateDoc={handleUpdateDoc}
                        editingDoc={editingDoc}
                        setEditingDoc={setEditingDoc}
                    />
                    <ManualAddModal
                        isOpen={isAddModalOpen}
                        onClose={closeAddModal}
                        onAdd={handleAddManual}
                        loading={loading}
                        groupedDocs={groupedDocs}
                        newDoc={newDoc}
                        setNewDoc={setNewDoc}
                        isDarkTheme={isDarkTheme}
                    />
                    <EditDocModal
                        isOpen={isEditModalOpen}
                        onClose={closeEditModal}
                        onUpdate={handleUpdateDoc}
                        loading={loading}
                        editingDoc={editingDoc}
                        setEditingDoc={setEditingDoc}
                        isDarkTheme={isDarkTheme}
                    />
                </div>
            </div>
        </div>
    );
};

export default AITrainingManager;

// Dual value declarations for verbatimModuleSyntax compatibility
export const AISettings: any = undefined;
