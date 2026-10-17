import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { api } from '../services/storageAdapter';
import { toast } from 'react-hot-toast';

import AITrainingGrid from '../components/ai/training/AITrainingGrid';
import AITrainingDetail from '../components/ai/training/AITrainingDetail';
import AIModals from '../components/ai/modals/AIModals';
import { ManualAddModal, EditDocModal } from '../components/ai/modals/TrainingModals';
import { useNavigation } from '../contexts/NavigationContext';
import Modal from '../components/common/Modal';
import TipsModal from '../components/common/TipsModal';
import { Lightbulb, Target, Sparkles, Zap, ShieldCheck, Brain, MessageSquare, UserCheck, Search, ListCheck, Users, Shield, Activity, Bot, Copy, ExternalLink } from 'lucide-react';
import { useChatPage } from '../contexts/ChatPageContext';
import OrgUserManager from '../components/ai/org/OrgUserManager';
import FeedbackAdminPanel from '../components/ai/training/FeedbackAdminPanel';
import UnifiedChat from '../components/ai/UnifiedChat';
import { API_BASE_URL } from '../utils/config';
import { useAuthStore } from '../../../store/authStore';
import { AppIcon } from '../../common/AppIcons';


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
    status_message?: string;
    error_message?: string;
    _meta?: any;
    content?: string;
    tags?: string;
    content_size?: number;
}


interface ChatbotCategory {
    id: string;
    name: string; slug?: string;
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
    category_id?: string;
    ai_enabled?: boolean;
    description?: string;
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
    teaser_msg?: string;
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
    auto_open_excluded_pages?: string[];
    auto_open_excluded_paths?: string[];
    auto_open?: number;
    notification_emails?: string;
    notification_cc_emails?: string;
    notification_subject?: string;
    intent_configs?: any;
    cat_brand_color?: string;
    cat_gemini_api_key?: string;
    cat_bot_avatar?: string;
    has_api_key?: boolean;
    has_cat_api_key?: boolean;
    notification_enabled?: number;
}


const AITraining: React.FC = () => {
    const { setCustomBackAction } = useNavigation();
    const [properties, setProperties] = useState<WebProperty[]>([]);
    const [chatbots, setChatbots] = useState<WebProperty[]>([]); // Reuse WebProperty interface for chatbots
    const [selectedProperty, setSelectedProperty] = useState<string>('');
    const [docs, setDocs] = useState<AIDoc[]>([]);
    const [settings, setSettings] = useState<AISettings>({
        property_id: '',
        is_enabled: 0,
        bot_name: 'AI Assistant',
        company_name: '',
        brand_color: '#2563eb',
        bot_avatar: '',
        welcome_msg: 'Chào bạn! Mình có thể giúp gì cho bạn?',
        teaser_msg: 'Chat với AI',
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
        auto_open_excluded_pages: [],
        auto_open_excluded_paths: [],
        auto_open: 0,
        notification_emails: '',
        notification_cc_emails: '',
        notification_subject: ''
    });

    const [viewMode, setViewMode] = useState<'grid' | 'doc'>('grid');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'training' | 'settings' | 'embed' | 'instruction' | 'inbox' | 'logs' | 'scenarios'>('inbox');
    const [newDoc, setNewDoc] = useState<{ name: string, content: string, tags: string, batchName?: string }>({ name: '', content: '', tags: '', batchName: '' });
    const [tagInput, setTagInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [docSearchTerm, setDocSearchTerm] = useState('');
    const [mainTab, setMainTab] = useState<'website' | 'chat'>('website');
    const [categorySubTab, setCategorySubTab] = useState<'chatbots' | 'users' | 'logs' | 'settings' | 'feedback'>('chatbots');

    const { orgUser } = useChatPage();
    const authUser = useAuthStore(s => s.user);

    // ── MYERP Authenticated User Integration ─────────────────────────────────
    // Use the authenticated MYERP user from useAuthStore (or AI Space orgUser)
    // so AI Training & Internal AI Chat always reflect the real logged-in user.
    const effectiveOrgUser = React.useMemo(() => {
        if (orgUser) return orgUser;
        if (authUser) {
            const rawRole = String(authUser.role || '').toLowerCase();
            const isAdminRole = ['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes(rawRole) || authUser.id === 1;
            return {
                id: `erp-${authUser.id}`,
                erp_user_id: authUser.id,
                email: authUser.email,
                full_name: authUser.full_name || authUser.email,
                role: (isAdminRole ? 'admin' : 'member') as 'admin' | 'member',
                status: 'active' as const,
                permissions: isAdminRole ? { modes: ['*'], access: '*' } : { modes: ['chat'], access: 'standard' },
            };
        }
        try {
            const savedUser = JSON.parse(
                localStorage.getItem('user') ||
                localStorage.getItem('currentUser') ||
                localStorage.getItem('authUser') ||
                'null'
            );
            if (savedUser && (savedUser.email || savedUser.full_name || savedUser.username)) {
                const rawRole = String(savedUser.role || savedUser.user_type || '').toLowerCase();
                const isAdminRole = ['admin', 'superadmin', 'super_admin', 'manager', 'director'].includes(rawRole) ||
                    savedUser.id === 1 || savedUser.id === '1' || savedUser.is_admin || savedUser.isAdmin;
                return {
                    id: savedUser.id ? `erp-${savedUser.id}` : 'erp-user',
                    erp_user_id: savedUser.id,
                    email: savedUser.email || '',
                    full_name: savedUser.full_name || savedUser.name || savedUser.username || 'Nhân sự MYERP',
                    role: (isAdminRole ? 'admin' : 'member') as 'admin' | 'member',
                    status: 'active' as const,
                    permissions: isAdminRole ? { modes: ['*'], access: '*' } : { modes: ['chat'], access: 'standard' },
                };
            }
        } catch { /* ignore */ }
        return null;
    }, [orgUser, authUser]);


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
    const memoAutoOpenExcludedPages = React.useMemo(() => settings.auto_open_excluded_pages || EMPTY_ARR, [settings.auto_open_excluded_pages, EMPTY_ARR]);
    const memoAutoOpenExcludedPaths = React.useMemo(() => settings.auto_open_excluded_paths || EMPTY_ARR, [settings.auto_open_excluded_paths, EMPTY_ARR]);
    const [selectedBotLogsId, setSelectedBotLogsId] = useState<string | null>(null);

    // Edit Inline State
    const [editingSynKey, setEditingSynKey] = useState<string | null>(null);
    const [editSynKeyVal, setEditSynKeyVal] = useState('');
    const [editSynValuesVal, setEditSynValuesVal] = useState('');

    // Edit Modal State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState<any>(null);
    const [fileLoading, setFileLoading] = useState(false);
    const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

    // Delete Confirmation State
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id?: string, batchId?: string, name?: string, docType?: string } | null>(null);
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
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
    const [isCreateCategoryModalOpen, setIsCreateCategoryModalOpen] = useState(false);
    const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryDesc, setNewCategoryDesc] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState('#0f172a');
    const [newCategoryApiKey, setNewCategoryApiKey] = useState('');
    const [newCategoryAvatar, setNewCategoryAvatar] = useState('');
    const [newCategorySlug, setNewCategorySlug] = useState('');
    const [editingCategory, setEditingCategory] = useState<ChatbotCategory | null>(null);
    const [viewModeChat, setViewModeChat] = useState<'categories' | 'chatbots'>('categories');
    const [currentBrandColor, setCurrentBrandColor] = useState<string>('#2563eb'); // Persistent brand color

    const backToGrid = React.useCallback(() => setViewMode('grid'), []);
    const backToCategories = React.useCallback(() => setViewModeChat('categories'), []);

    // Smart Back Logic
    useEffect(() => {
        if (viewMode === 'doc') {
            setCustomBackAction(() => backToGrid);
        } else if (mainTab === 'chat' && viewModeChat === 'chatbots') {
            setCustomBackAction(() => backToCategories);
        } else {
            setCustomBackAction(null);
        }

        return () => setCustomBackAction(null);
    }, [viewMode, mainTab, viewModeChat, setCustomBackAction, backToGrid, backToCategories]);

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
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

    // Deep Linking State
    const [initialConversationId, setInitialConversationId] = useState<string | null>(null);
    const [initialVisitorId, setInitialVisitorId] = useState<string | null>(null);

    const [isAITrainingDarkTheme, setIsAITrainingDarkTheme] = useState(false);
    const [isOrgManagerOpen, setIsOrgManagerOpen] = useState(false);
    const [aiSpaceModal, setAiSpaceModal] = useState<{
        isOpen: boolean;
        categoryId: string | null;
        activeBotId: string | null;
    }>({ isOpen: false, categoryId: null, activeBotId: null });

    useEffect(() => {
        // AI Training in AutoFlow follows its own local theme and should not affect global AutoFlow shell
    }, [isAITrainingDarkTheme]);

    // Deep Linking Logic (supports query params + /ai-space/:categoryId and /chat/:botId routes)
    useEffect(() => {
        const handleRouteOrHashChange = () => {
            const hash = window.location.hash;
            const pathname = window.location.pathname;
            const combinedPath = `${pathname} ${hash}`;

            const aiSpaceMatch = combinedPath.match(/\/ai-space\/([^/?#\s]+)/);
            if (aiSpaceMatch && aiSpaceMatch[1]) {
                const targetCat = decodeURIComponent(aiSpaceMatch[1]);
                setMainTab('chat');
                setSelectedCategoryId(targetCat);
                setViewModeChat('chatbots');
                setAiSpaceModal(prev => ({
                    isOpen: true,
                    categoryId: targetCat,
                    activeBotId: prev.categoryId === targetCat ? prev.activeBotId : null
                }));
                return;
            }

            const chatBotMatch = combinedPath.match(/\/chat\/([^/?#\s]+)/);
            if (chatBotMatch && chatBotMatch[1]) {
                const targetBot = decodeURIComponent(chatBotMatch[1]);
                setMainTab('chat');
                setAiSpaceModal(prev => ({
                    isOpen: true,
                    categoryId: prev.categoryId,
                    activeBotId: targetBot
                }));
                return;
            }

            if (hash.includes('?')) {
                const query = hash.split('?')[1];
                const params = new URLSearchParams(query);

                const pId = params.get('propertyId');
                const tab = params.get('tab');
                const mainTabParam = params.get('mainTab');
                const convId = params.get('conversationId');
                const visId = params.get('visitorId');

                if (mainTabParam === 'chat' || mainTabParam === 'website') {
                    setMainTab(mainTabParam as any);
                }

                if (pId) {
                    setSelectedProperty(pId);
                    setViewMode('doc');

                    if (tab && ['training', 'settings', 'embed', 'instruction', 'inbox'].includes(tab)) {
                        setActiveTab(tab as any);
                    }

                    if (convId) setInitialConversationId(convId);
                    if (visId) setInitialVisitorId(visId);
                }
            }
        };

        handleRouteOrHashChange();

        window.addEventListener('hashchange', handleRouteOrHashChange);
        window.addEventListener('popstate', handleRouteOrHashChange);
        return () => {
            window.removeEventListener('hashchange', handleRouteOrHashChange);
            window.removeEventListener('popstate', handleRouteOrHashChange);
        };
    }, []);

    // Resolve slug or missing activeBotId inside AI Space modal once categories & chatbots load
    useEffect(() => {
        if (!aiSpaceModal.isOpen) return;
        let resolvedCatId = aiSpaceModal.categoryId;
        if (resolvedCatId && categories.length > 0) {
            const matchedCat = categories.find(
                c => String(c.id) === String(resolvedCatId) || String(c.slug || '') === String(resolvedCatId)
            );
            if (matchedCat && String(matchedCat.id) !== String(resolvedCatId)) {
                resolvedCatId = matchedCat.id;
                setSelectedCategoryId(matchedCat.id);
            }
        }
        if (!aiSpaceModal.activeBotId && chatbots.length > 0) {
            const catBots = resolvedCatId
                ? chatbots.filter(b => String(b.category_id) === String(resolvedCatId))
                : chatbots;
            const firstBot = catBots[0] || chatbots[0];
            if (firstBot) {
                setAiSpaceModal(prev => ({
                    ...prev,
                    categoryId: resolvedCatId || firstBot.category_id || prev.categoryId,
                    activeBotId: firstBot.id
                }));
            }
        } else if (aiSpaceModal.activeBotId && !aiSpaceModal.categoryId && chatbots.length > 0) {
            const matchedBot = chatbots.find(b => String(b.id) === String(aiSpaceModal.activeBotId));
            if (matchedBot?.category_id) {
                setAiSpaceModal(prev => ({
                    ...prev,
                    categoryId: matchedBot.category_id || null
                }));
            }
        }
    }, [aiSpaceModal.isOpen, aiSpaceModal.categoryId, aiSpaceModal.activeBotId, categories, chatbots]);

    // Sync Tags for Info Modal
    useEffect(() => {
        if (infoDoc) setTagInput(infoDoc.tags || '');
    }, [infoDoc]);

    const handleTestAI = React.useCallback(() => {
        if (!selectedProperty) return;

        // If this property is a group chatbot, open the interactive AI Space Chat directly
        const groupBot = chatbots.find(b => String(b.id) === String(selectedProperty));
        if (groupBot) {
            setAiSpaceModal({
                isOpen: true,
                categoryId: groupBot.category_id || selectedCategoryId || null,
                activeBotId: groupBot.id
            });
            return;
        }

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

        toast.success('Khởi tạo Widget Test...', { icon: '🤖' });
    }, [selectedProperty, settings, chatbots, selectedCategoryId]);

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
    const [isTraining, setIsTraining] = useState(false);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [folderName, setFolderName] = useState('');
    const [isEditFolderModalOpen, setIsEditFolderModalOpen] = useState(false);
    const [editingFolder, setEditingFolder] = useState<any>(null);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isOptimizationModalOpen, setIsOptimizationModalOpen] = useState(false);
    const [isEmbeddingModalOpen, setIsEmbeddingModalOpen] = useState(false);
    const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploadLimit, setUploadLimit] = useState<string>('');


    useEffect(() => {
        fetchProperties();
        fetchCategories(); // Init categories
        fetchChatbots();   // Pre-fetch all chatbots for bulk move/copy
        fetchUploadLimit();
    }, []);


    useEffect(() => {
        // [P17-C3] Clear multi-selections when switching main tabs (website/chat)
        // to prevent stale cross-tab selection state.
        setSelectedIds([]);
    }, [mainTab]);

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

    // Always keep a ref pointing to the latest docs so the polling loop
    // can check current status without stale closures
    const docsRef = React.useRef(docs);
    useEffect(() => { docsRef.current = docs; }, [docs]);

    // Stable refs for values the polling loop needs — updated via useEffect only
    const selectedPropertyRef = React.useRef(selectedProperty);
    useEffect(() => { selectedPropertyRef.current = selectedProperty; }, [selectedProperty]);
    const docSearchTermRef = React.useRef(docSearchTerm);
    useEffect(() => { docSearchTermRef.current = docSearchTerm; }, [docSearchTerm]);

    // Polling ref
    const pollingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!selectedProperty) return;

        let cancelled = false;

        const schedulePoll = () => {
            pollingTimeoutRef.current = setTimeout(async () => {
                if (cancelled) return;

                // [P17-C1] Skip API call when tab is hidden — saves server load & avoids
                // unnecessary requests while user is on a different tab.
                if (document.visibilityState !== 'visible') {
                    if (!cancelled) schedulePoll();
                    return;
                }

                // Check latest docs state via ref
                const hasWIP = docsRef.current.some(
                    d => d.status === 'pending' || d.status === 'processing'
                );

                // Only hit the API when there is actual work in progress
                // (loop keeps running regardless — so it auto-wakes when training starts)
                if (hasWIP) {
                    try {
                        const propId = selectedPropertyRef.current;
                        const search = docSearchTermRef.current;
                        const queryParam = search ? `&search=${encodeURIComponent(search)}` : '';
                        const res = await api.get<any>(
                            `ai_training?action=list_docs&property_id=${propId}${queryParam}`
                        );
                        if (!cancelled && res.success) {
                            setDocs(res.data);
                        }
                    } catch (_) { /* silent — retry next tick */ }
                }

                // Always schedule the next tick while the property is active
                // [P19-A3 ADAPTIVE POLLING] Use a short interval when training is in progress
                // (for real-time status updates), and a long interval when idle
                // (to reduce server load by ~10x when nothing is happening).
                const nextInterval = hasWIP ? 3000 : 30000;
                if (!cancelled) pollingTimeoutRef.current = setTimeout(schedulePoll, nextInterval - 3000);
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


    // Fetch chatbots when category changes
    useEffect(() => {
        if (viewModeChat === 'chatbots' && selectedCategoryId) {
            fetchChatbots(selectedCategoryId);
        }

        // Update brand color when category changes
        if (selectedCategoryId) {
            const activeCategory = categories.find(c => String(c.id) === String(selectedCategoryId));
            if (activeCategory?.brand_color) {
                setCurrentBrandColor(activeCategory.brand_color);
            }
        }
    }, [viewModeChat, selectedCategoryId, categories]);

    const fetchProperties = async () => {
        setLoading(true);
        try {
            const res = await api.get<any>('web_tracking?action=list');
            if (res.success) {
                setProperties(res.data);
            }
        } catch (e) {
            toast.error('Không thể tải danh sách website');
        } finally {
            setLoading(false);
        }
    };

    const fetchUploadLimit = async () => {
        try {
            const res = await api.get<any>('ai_training?action=get_upload_limit') as any;
            if (res.success) {
                setUploadLimit(res.upload_max_filesize);
            }
        } catch (e) {
            console.error('Failed to fetch upload limit');
        }
    };


    const fetchCategories = async () => {
        try {
            const res = await api.get<any>('ai_chatbots?action=list_categories');
            if (res.success) {
                const cats = res.data || [];
                setCategories(cats);
                // Auto-select first category on load if none selected
                if (!selectedCategoryId && cats.length > 0) {
                    setSelectedCategoryId(cats[0].id);
                    // Set initial brand color
                    if (cats[0].brand_color) {
                        setCurrentBrandColor(cats[0].brand_color);
                    }
                }
            }
        } catch (e) {
            toast.error('Không thể tải danh sách nhóm');
        }
    };

    const fetchChatbots = async (catId?: string) => {
        try {
            const url = catId
                ? `ai_chatbots?action=list&category_id=${encodeURIComponent(catId)}`
                : 'ai_chatbots?action=list';
            const res = await api.get<any>(url);
            if (res.success) {
                const incoming: WebProperty[] = res.data || [];
                if (catId) {
                    setChatbots(prev => {
                        const otherCats = prev.filter(b => String(b.category_id) !== String(catId));
                        return [...otherCats, ...incoming];
                    });
                } else {
                    setChatbots(incoming);
                }
            }
        } catch (e) {
            toast.error('Không thể tải danh sách AI Chatbot');
        }
    };

    const handleCreateCategory = async () => {
        if (!newCategoryName.trim()) {
            toast.error('Vui lòng nhập tên nhóm');
            return;
        }

        try {
            const res = await api.post<any>('ai_chatbots?action=create_category', {
                name: newCategoryName,
                description: newCategoryDesc,
                brand_color: newCategoryColor,
                gemini_api_key: newCategoryApiKey,
                bot_avatar: newCategoryAvatar, slug: newCategorySlug
            });

            if (res.success) {
                toast.success('Đã tạo nhóm mới');
                setIsCreateCategoryModalOpen(false);
                setNewCategoryName('');
                setNewCategoryDesc('');
                setNewCategoryColor('#2563eb');
                setNewCategoryApiKey('');
                setNewCategoryAvatar(''); setNewCategorySlug('');
                fetchCategories();
            } else {
                toast.error(res.message || 'Lỗi khi tạo nhóm');
            }
        } catch (e) {
            toast.error('Đã xảy ra lỗi');
        }
    };

    const handleEditCategory = (category: ChatbotCategory) => {
        setEditingCategory(category);
        setNewCategoryName(category.name);
        setNewCategoryDesc(category.description);
        setNewCategoryColor(category.brand_color || '#2563eb');
        setNewCategoryApiKey(category.gemini_api_key || '');
        setNewCategoryAvatar(category.bot_avatar || ''); setNewCategorySlug(category.slug || '');
        setIsEditCategoryModalOpen(true);
    };

    const handleUpdateCategory = async () => {
        if (!editingCategory || !newCategoryName.trim()) return;

        try {
            const res = await api.post<any>('ai_chatbots?action=update_category', {
                id: editingCategory.id,
                name: newCategoryName,
                description: newCategoryDesc,
                brand_color: newCategoryColor,
                gemini_api_key: newCategoryApiKey,
                bot_avatar: newCategoryAvatar, slug: newCategorySlug
            });

            if (res.success) {
                toast.success('Đã cập nhật nhóm');
                setIsEditCategoryModalOpen(false);
                setEditingCategory(null);
                setNewCategoryName('');
                setNewCategoryDesc('');
                setNewCategoryColor('#2563eb');
                setNewCategoryApiKey('');
                setNewCategoryAvatar(''); setNewCategorySlug('');
                fetchCategories();
            } else {
                toast.error(res.message || 'Lỗi khi cập nhật');
            }
        } catch (e) {
            toast.error('Đã xảy ra lỗi');
        }
    };

    const handleCreateBot = async () => {
        if (!newBotName.trim()) {
            toast.error('Vui lòng nhập tên AI Chatbot');
            return;
        }
        setLoading(true);
        try {
            const res = await api.post<any>('ai_chatbots?action=create', {
                name: newBotName,
                description: newBotDesc,
                slug: newBotSlug,
                category_id: selectedCategoryId
            });
            if (res.success) {
                toast.success('Đã tạo AI Chatbot mới');
                setIsCreateBotModalOpen(false);
                setNewBotName('');
                setNewBotDesc('');
                setNewBotSlug('');
                fetchChatbots(selectedCategoryId || undefined);
                fetchCategories();
            } else {
                toast.error(res.message || 'Lỗi tạo chatbot');
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
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
                toast.success('Cập nhật Chatbot thành công');
                setIsEditBotModalOpen(false);
                // Refresh list if needed (we are likely viewing the chatbots list)
                if (selectedCategoryId) {
                    const resList = await api.get<any>(`ai_chatbots?action=list&category_id=${selectedCategoryId}`);
                    if (resList.success) setChatbots(resList.data);
                }
            } else {
                toast.error(res.message || 'Lỗi cập nhật');
            }
        } catch (e) {
            toast.error('Đã xảy ra lỗi');
        } finally {
            setLoading(false);
        }
    };

    const handleShareBot = (botId: string) => {
        const shareUrl = `${window.location.origin}/chat/${botId}`;
        navigator.clipboard.writeText(shareUrl);
        toast.success('Đã copy link chia sẻ!', { icon: '🔗' });
    };

    const handleOpenAISpace = React.useCallback((categoryId: string, preferredBotId?: string) => {
        const catBots = chatbots.filter(b => String(b.category_id) === String(categoryId));
        const initialBotId = preferredBotId || catBots[0]?.id || null;
        setAiSpaceModal({
            isOpen: true,
            categoryId,
            activeBotId: initialBotId
        });
        if (catBots.length === 0) {
            fetchChatbots(categoryId);
        }
    }, [chatbots]);

    const handleOpenBotChat = React.useCallback((botId: string, categoryId?: string) => {
        const bot = chatbots.find(b => String(b.id) === String(botId));
        const catId = categoryId || bot?.category_id || selectedCategoryId || null;
        setAiSpaceModal({
            isOpen: true,
            categoryId: catId,
            activeBotId: botId
        });
    }, [chatbots, selectedCategoryId]);

    const handleOpenChatPage = (botId: string) => {
        handleOpenBotChat(botId);
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
        try {
            const res = await api.post<any>('ai_chatbots?action=delete', { id });
            if (res.success) {
                toast.success('Đã xóa AI Chatbot');
                fetchChatbots(selectedCategoryId || undefined);
                fetchCategories();
                setIsDeleteConfirmModalOpen(false);
            } else {
                toast.error('Lỗi khi xóa chatbot');
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
        }
    };

    const handleDeleteCategory = (id: string, name: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfig({ id, name, type: 'category' });
        setIsDeleteConfirmModalOpen(true);
    };

    const confirmDeleteCategory = async (id: string) => {
        try {
            const res = await api.post<any>('ai_chatbots?action=delete_category', { id });
            if (res.success) {
                toast.success('Đã xóa nhóm');
                fetchCategories();
                if (selectedCategoryId === id) {
                    setSelectedCategoryId(null);
                    setViewModeChat('categories');
                }
                setIsDeleteConfirmModalOpen(false);
            } else {
                toast.error('Lỗi khi xóa nhóm');
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
        }
    };

    const handleShareCategory = (catId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const shareUrl = `${window.location.origin}/#/ai-space/${catId}`;
        setShareLinkToCopy(shareUrl);
        setIsShareLinkModalOpen(true);
    };

    const fetchDocs = async (search?: string) => {
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
    };


    const handleTrainDocs = React.useCallback(async () => {
        const hasApiKey = settings.gemini_api_key || settings.cat_gemini_api_key || settings.has_api_key || settings.has_cat_api_key;
        if (!hasApiKey) {
            toast.error('Vui lòng cấu hình Gemini API Key (trong bot này hoặc trong Nhóm) trước khi huấn luyện.');
            setActiveTab('settings');
            return;
        }

        setLoading(true);
        try {
            const res = await api.post<any>('ai_training?action=train_docs', { property_id: selectedProperty });
            if (res.success) {
                // If it was queued (trained_count might be 0 or message says queued)
                if (res.message?.includes('hàng đợi')) {
                    toast.success('Đã đưa vào hàng đợi xử lý ngầm. Bạn có thể đóng trình duyệt.');
                } else {
                    toast.success(`Đã huấn luyện xong ${(res as any).trained_count} mục`);
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
                    auto_open_excluded_pages: typeof data.auto_open_excluded_pages === 'string' ? JSON.parse(data.auto_open_excluded_pages) : (data.auto_open_excluded_pages || []),
                    auto_open_excluded_paths: typeof data.auto_open_excluded_paths === 'string' ? JSON.parse(data.auto_open_excluded_paths) : (data.auto_open_excluded_paths || []),
                    cat_gemini_api_key: data.cat_gemini_api_key || '',
                    cat_brand_color: data.cat_brand_color || '',
                    cat_bot_avatar: data.cat_bot_avatar || '',
                    notification_emails: data.notification_emails || '',
                    notification_cc_emails: data.notification_cc_emails || '',
                    notification_subject: data.notification_subject || '',
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
                    auto_open_excluded_pages: [],
                    auto_open_excluded_paths: [],
                    intent_configs: {},
                    system_instruction: `Bạn là tư vấn viên chuyên nghiệp về lĩnh vực giáo dục.
#TONE: Chuyên nghiệp, tư vấn đầy đủ nhưng đúng trọng tâm, KHÔNG emoji, KHÔNG nói kiểu ("theo dữ liệu...").
Xưng "em", gọi khách "anh/chị"

### ROLE & PERSONA
Bạn là **{$botName}** - Chuyên viên tư vấn **{$companyName}**.
- **Ngày hiện tại:** {$today}

### Thời gian
- **QUY TẮC QUAN TRỌNG:** Khi tư vấn lịch học/sự kiện, bạn PHẢI so sánh ngày trong dữ liệu với ngày hôm nay ({\$today}).
    - Chỉ liệt kê DUY NHẤT 1 lộ trình/Thời gian gần với hôm nay nhất
    - Nếu dữ liệu không có KHÔNG được bịa ngày.

### HÀNH TRÌNH Khách hàng
Khách đang xem: {\$currentPage}
Lịch sử hoạt động: 
{\$activityContext}

### RULES 
0. **NGÔN NGỮ (QUAN TRỌNG NHẤT):**
   - **PHẢI** trả lời bằng ngôn ngữ mà Khách hàng đang sử dụng.
    - Nếu khách hỏi Tiếng Anh -> Trả lời hoàn toàn bằng Tiếng Anh (Dịch thông tin từ Knowledge Base sang Tiếng Anh).
   - Nếu khách hỏi Tiếng Việt hoặc mơ hồ thì ưu tiên trả lời Tiếng Việt.

1. **ANTI-HALLUCINATION (KHÔNG ĐƯỢC BỊA ĐẶT):**
   - Nếu thông tin không có trong KNOWLEDGE BASE, bạn phải trả lời: "Dạ vấn đề này hiện em chưa có thông tin chính xác nhất. Nhờ anh/chị để lại số điện thoại hoặc email, chuyên viên bên em sẽ kiểm tra và báo lại ngay ạ."
   - Nếu thu thập thông tin hoặc khách cần liên hệ tư vấn viên thì phải check {\$isIdentified} nếu chưa thì thêm sau cú pháp [SHOW_LEAD_FORM]. Không được bịa thêm thông tin khác ngoài KNOWLEDGE BASE.   
   - Không tự chế tên khóa học, không tự chế ngày, không tự chế tên bất kỳ ai, không tự chế bất kỳ thứ gì nếu không thấy trong văn bản.

2. **TƯ DUY TƯ VẤN:**
   - Đừng chỉ trả lời cộc lốc. Hãy cởi mở và gợi mở. Ví dụ: Khách hỏi "Học phí bao nhiêu?", đừng chỉ ném con số. Hãy nói: "Học phí khóa này là X. Đặc biệt bên em đang có ưu đãi Y cho đăng ký sớm, anh/chị có quan tâm không ạ??"
   - Tư vấn rõ ràng, hướng Khách hàng tìm hiểu sâu hơn, Khách hàng không hiểu gì thì phải giải thích rõ.

3. **AN TOÀN PHÁP LÝ:**
   - Không cam kết thay mặt nhóm nếu không có văn bản khẳng định cái nào không rõ thì phải trả lời phải tùy vào trường hợp...

4. **QUICK ACTIONS (ĐỀ XUẤT HÀNH ĐỘNG):**
   - Luôn tư vấn theo hướng gợi mở thêm các tag hành động, Nếu bạn thấy Khách hàng đang quan tâm đến một chủ đề cụ thể giải thích rõ ràng ra: ví dụ có cái này không thì nêu chi tiết ra chứ không phải để có rồi thôi, hãy đề xuất hành động bằng cách thêm tag ở cuối câu trả lời (Hệ thống sẽ hiển thị nút bấm).
   - Cú pháp: [ACTIONS: Tên nút 1 | Tên nút 2 | Tên nút 3]

### RESPONSE FORMAT
- Trên 3 ý (liệt kê) thì cho gạch đầu dòng (cái gì là liệt kê thì liệt kê cho đầy đủ, cảm thấy ko đủ thì gợi mở cho câu sau)
- Trả lời đi thẳng vào vấn đề.`,
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
                    auto_open: 0,
                    notification_emails: '',
                    notification_cc_emails: '',
                    notification_subject: ''
                });
            }
        } catch (e) {
            console.error('Lỗi tải cài đặt');
        }
    };




    const handleSaveSettings = React.useCallback(async () => {
        if (!selectedProperty) return;
        const hasApiKey = settings.gemini_api_key || settings.cat_gemini_api_key || settings.has_api_key || settings.has_cat_api_key;
        if (!hasApiKey) {
            toast.error('Vui lòng nhập Gemini API Key để kích hoạt AI');
            return;
        }
        setLoading(true);
        try {
            // Clean arrays before saving
            const cleanedSettings = {
                ...settings,
                excluded_pages: (settings.excluded_pages || []).map(s => s.trim()).filter(Boolean),
                excluded_paths: (settings.excluded_paths || []).map(s => s.trim()).filter(Boolean),
                auto_open_excluded_pages: (settings.auto_open_excluded_pages || []).map(s => s.trim()).filter(Boolean),
                auto_open_excluded_paths: (settings.auto_open_excluded_paths || []).map(s => s.trim()).filter(Boolean)
            };

            const res = await api.post<any>('ai_training?action=update_settings', {
                ...cleanedSettings,
                property_id: selectedProperty
            });
            if (res.success) {
                toast.success('Đã cập nhật cấu hình AI');
                // Refresh local settings after clean-up save to sync UI
                setSettings({ ...settings, ...cleanedSettings });
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

    const deleteDoc = async (id: string | null | undefined, batchId?: string) => {
        if (!id && !batchId) return;

        // Prevent deletion if doc is currently training
        let docName: string | undefined;
        let docType: string | undefined;

        if (id) {
            const doc = docs.find(d => d.id === id);
            if (doc && doc.status === 'processing') {
                toast.error('Không thể xóa tài liệu đang trong quá trình huấn luyện.');
                return;
            }
            docName = doc?.name;
            docType = doc?.source_type;
        } else if (batchId) {
            const isBatchTraining = docs.some(d => (d as any).batch_name === batchId && d.status === 'processing');
            if (isBatchTraining) {
                toast.error('Không thể xóa thư mục khi có tài liệu bên trong đang huấn luyện.');
                return;
            }
            // Get batch (folder) name
            const folderDoc = docs.find(d => d.source_type === 'folder' && d.id === batchId);
            docName = folderDoc?.name || batchId;
            docType = 'folder';
        }

        setDeleteTarget({ id: id || undefined, batchId, name: docName, docType });
        setIsDeleteModalOpen(true);
    };

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
        // Mở modal ngay với dữ liệu đã có sẵn trong docs list
        const localDoc = docs.find((d: any) => d.id === id);
        let tags: any = [];
        if (localDoc?.tags) {
            try { tags = typeof localDoc.tags === 'string' ? JSON.parse(localDoc.tags) : localDoc.tags; } catch { tags = []; }
        }
        setEditingDoc({
            id,
            name: localDoc?.name || '',
            content: null, // null = đang tải
            tags: Array.isArray(tags) ? tags : [],
            source_type: localDoc?.source_type || '',
            created_at: localDoc?.created_at,
            updated_at: localDoc?.updated_at,
        });
        setIsEditModalOpen(true);

        // Load content trong nền
        try {
            const res = await api.get<any>(`ai_training?action=get_doc&id=${id}&property_id=${selectedProperty}`);
            if (res.success && res.data) {
                const docData = res.data;
                let fullTags: any = [];
                if (docData.tags) {
                    try { fullTags = typeof docData.tags === 'string' ? JSON.parse(docData.tags) : docData.tags; } catch { fullTags = []; }
                }
                setEditingDoc({
                    id: docData.id,
                    name: docData.name || '',
                    content: docData.content || '',
                    tags: Array.isArray(fullTags) ? fullTags : [],
                    source_type: docData.source_type,
                    created_at: docData.created_at,
                    updated_at: docData.updated_at
                });
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error('Không thể tải nội dung tài liệu');
        }
    }, [selectedProperty, docs]);

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


    const handleCreateCache = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.post<any>('ai_training?action=create_cache', { property_id: selectedProperty });
            if (res.success) {
                toast.success('Đã tạo bộ nhớ đệm thành công (1 giờ)');
                fetchSettings();
            } else {
                toast.error('Lỗi: ' + res.message);
            }
        } catch (e) { toast.error('Lỗi kết nối'); }
        finally { setLoading(false); }
    }, [selectedProperty, fetchSettings]);

    const handleAutoLearnSynonyms = React.useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.post<any>('ai_training?action=auto_learn_synonyms', { property_id: selectedProperty });
            if (res.success) {
                toast.success(res.message, { icon: '🚀' });
                fetchSettings();
            } else {
                toast.error(res.message);
            }
        } catch (e) {
            toast.error('Lỗi phân tích tự động nghĩa');
        } finally {
            setLoading(false);
        }
    }, [selectedProperty, fetchSettings]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (fileInputRef.current) fileInputRef.current.value = '';

        // Only accept PDF
        const ext = file.name.split('.').pop()?.toLowerCase();
        if (ext !== 'pdf') {
            toast.error('Chỉ hỗ trợ file PDF');
            return;
        }

        // Detect page count via PDF.js (same as AITrainingDetail)
        let totalPages = 0;
        try {
            const pdfjsLib = await import('../shims/docReaders');
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
            // Method 2: Regex on binary (no external lib)
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
            const { api: apiAdapter } = await import('../services/storageAdapter');
            const res = await fetch(`${apiAdapter.baseUrl}/ai_training.php`, { method: 'POST', body: formData });
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

        // Remove old key if changed or just to refresh
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
                toast.success('Đã lưu cấu hình từ đồng nghĩa', { icon: '🤖' });
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

        // Map priorities: Top item gets highest priority
        const priorityUpdates: { id: string, priority: number, is_batch?: boolean, batch_id?: string }[] = [];
        const newDocs = [...docs];

        newList.forEach((item, idx) => {
            const newPriority = 2000 - idx;
            if (item.isGroup) {
                priorityUpdates.push({ id: item.id, priority: newPriority, is_batch: true, batch_id: item.batchId });
                // Update all docs in this group locally
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

        // Optimistic UI Update
        setDocs(newDocs);

        try {
            const res = await api.post<any>('ai_training?action=update_priority', {
                property_id: selectedProperty,
                items: priorityUpdates
            });
            if (res.success) {
                toast.success('Đã cập nhật thứ tự', { icon: '🚀' });
            }
        } catch (e) {
            toast.error('Không thể lưu thứ tự mới');
            fetchDocs(); // Rollback
        }
    }, [selectedProperty, docs, fetchDocs]);

    const formatSize = (bytes: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    const totalSelectableCount = React.useMemo(() => docs.length, [docs]);

    const groupedDocs = React.useMemo(() => {
        const groups: Record<string, any> = {};
        const rootDocs: any[] = [];

        // First pass: Identify folders and root items
        docs.forEach(doc => {
            // Check for valid parent_id
            const pId = doc.parent_id && doc.parent_id !== '0' ? doc.parent_id : null;

            if (doc.source_type === 'folder') {
                groups[doc.id] = { ...doc, isGroup: true, members: [], totalSize: 0, batchId: doc.id };
            } else if (!pId) {
                // If it's not a child of anything, it's a root doc
                rootDocs.push({ ...doc, isGroup: false, batchId: null });
            }
        });

        // Second pass: Assign children to folders
        docs.forEach(doc => {
            if (doc.source_type === 'folder') return; // Folders already handled

            const pId = doc.parent_id && doc.parent_id !== '0' ? doc.parent_id : null;
            if (pId && groups[pId]) {
                const member = { ...doc };
                groups[pId].members.push(member);
                groups[pId].totalSize += (member.content_size || 0);
            } else if (pId && !groups[pId]) {
                // Orphaned child, treat as root or hidden? Treat as root for safety
                rootDocs.push({ ...doc, isGroup: false });
            }
        });

        // Combine into final list
        const combined = [...Object.values(groups), ...rootDocs];

        // Sort by priority DESC (Custom order), then created_at DESC
        return combined.sort((a, b) => {
            if ((b.priority || 0) !== (a.priority || 0)) {
                return (b.priority || 0) - (a.priority || 0);
            }
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    }, [docs]);

    const onToggleSelect = React.useCallback((id: string) => {
        const getAllDescendantIds = (parentId: string): string[] => {
            const children = docs.filter(d => d.parent_id === parentId).map(d => d.id);
            let descendants = [...children];
            for (const childId of children) {
                descendants = [...descendants, ...getAllDescendantIds(childId)];
            }
            return descendants;
        };

        const allToToggle = [id, ...getAllDescendantIds(id)];

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
        // Logic: Determine if "all in view" are currently selected.
        const allInViewIds = docs.map(d => d.id);
        const currentSelectedSet = new Set(selectedIds);
        const isAllSelected = allInViewIds.length > 0 && allInViewIds.every(id => currentSelectedSet.has(id));

        if (isAllSelected) {
            // DESELECT ALL
            setSelectedIds([]);
        } else {
            // SELECT ALL
            setSelectedIds(allInViewIds);
        }
    }, [selectedIds, docs]);

    const selectedIdsSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);

    const handleBulkDelete = React.useCallback(() => {
        if (selectedIds.length === 0) return;

        setDeleteVerifyText('');
        setIsBulkDeleteConfirmModalOpen(true);
    }, [selectedIds, docs]);

    const handleFinalBulkDelete = React.useCallback(async () => {
        if (deleteVerifyText.toUpperCase() !== 'DELETE') {
            toast.error('Vui lòng nhập đúng chữ DELETE để xác nhận.');
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
    }, [properties, chatbots, selectedProperty, deleteVerifyText, selectedIds, fetchDocs]);

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
                toast.success(`Đã ${bulkActionType === 'copy' ? 'sao chép' : 'di chuyển'} ${selectedIds.length.toLocaleString()} mục thành công. Hệ thống đang tự động tối ưu dữ liệu tại AI đích...`);
                setSelectedIds([]);
                setIsBulkMoveModalOpen(false);
                setBulkActionType(null);

                // Auto-trigger training for target property to optimize knowledge base
                api.post('ai_training?action=train_docs', { property_id: targetPropertyId });

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
    const closeDeleteModal = React.useCallback(() => setIsDeleteModalOpen(false), []);
    const closeFolderModal = React.useCallback(() => setIsFolderModalOpen(false), []);
    const closeEditFolderModal = React.useCallback(() => { setIsEditFolderModalOpen(false); setEditingFolder(null); setFolderName(''); }, []);
    const closeBulkMoveModal = React.useCallback(() => setIsBulkMoveModalOpen(false), []);
    const closeBulkDeleteConfirmModal = React.useCallback(() => setIsBulkDeleteConfirmModalOpen(false), []);
    const closeShareLinkModal = React.useCallback(() => setIsShareLinkModalOpen(false), []);
    const closeDeleteConfirmModal = React.useCallback(() => setIsDeleteConfirmModalOpen(false), []);

    const filteredProperties = React.useMemo(() => properties.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.domain.toLowerCase().includes(searchTerm.toLowerCase())
    ), [properties, searchTerm]);

    const filteredChatbots = React.useMemo(() => chatbots.filter(c => {
        const matchCategory = !selectedCategoryId || !c.category_id || String(c.category_id) === String(selectedCategoryId);
        const matchSearch = !searchTerm ||
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.description && c.description.toLowerCase().includes(searchTerm.toLowerCase()));
        return matchCategory && matchSearch;
    }), [chatbots, selectedCategoryId, searchTerm]);

    const activeSpaceCategory = React.useMemo(() => {
        if (!aiSpaceModal.categoryId) return null;
        return categories.find(
            c => String(c.id) === String(aiSpaceModal.categoryId) || String(c.slug || '') === String(aiSpaceModal.categoryId)
        ) || null;
    }, [categories, aiSpaceModal.categoryId]);

    const spaceBots = React.useMemo(() => {
        if (!aiSpaceModal.categoryId) return chatbots;
        const resolvedId = activeSpaceCategory?.id || aiSpaceModal.categoryId;
        const filtered = chatbots.filter(b => String(b.category_id) === String(resolvedId));
        return filtered.length > 0 ? filtered : chatbots;
    }, [chatbots, aiSpaceModal.categoryId, activeSpaceCategory]);

    return (
        <div className="animate-fade-in space-y-6 pb-20 w-full min-w-0">
            {viewMode === 'grid' ? (
                <AITrainingGrid
                    mainTab={mainTab}
                    setMainTab={setMainTab}
                    categorySubTab={categorySubTab}
                    setCategorySubTab={setCategorySubTab}
                    searchTerm={searchTerm}
                    setSearchTerm={setSearchTerm}
                    setIsCreateCategoryModalOpen={setIsCreateCategoryModalOpen}
                    setIsCreateBotModalOpen={setIsCreateBotModalOpen}
                    viewModeChat={viewModeChat}
                    categories={categories}
                    setSelectedCategoryId={setSelectedCategoryId}
                    setViewModeChat={setViewModeChat}
                    chatbots={chatbots}
                    selectedCategoryId={selectedCategoryId}
                    setSelectedProperty={setSelectedProperty}
                    setViewMode={setViewMode}
                    handleEditCategory={handleEditCategory}
                    handleDeleteCategory={handleDeleteCategory}
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
                    brandColor={currentBrandColor}
                    isDarkTheme={isAITrainingDarkTheme}
                    onOpenOrgManager={() => setIsOrgManagerOpen(true)}
                    selectedCategory={categories.find(c => String(c.id) === String(selectedCategoryId)) || null}
                    orgUserOverride={effectiveOrgUser}
                    onOpenAISpace={handleOpenAISpace}
                    onOpenBotChat={handleOpenBotChat}
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
                    newQuickAction={newQuickAction}
                    setNewQuickAction={setNewQuickAction}
                    addQuickAction={addQuickAction}
                    removeQuickAction={removeQuickAction}
                    initialConversationId={initialConversationId}
                    initialVisitorId={initialVisitorId}
                    isDarkTheme={isAITrainingDarkTheme}
                    hideLogsTab={true}
                    fileInputRef={fileInputRef}
                    handleFileUpload={handleFileUpload}
                    uploadLimit={uploadLimit}
                    fetchDocs={fetchDocs}
                    orgUser={effectiveOrgUser}
                />
            )}

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
                handleCreateCategory={handleCreateCategory} newCategorySlug={newCategorySlug} setNewCategorySlug={setNewCategorySlug}
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
                deleteTarget={deleteTarget}
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
                deleteConfirmText={deleteConfirmText}
                setDeleteConfirmText={setDeleteConfirmText}
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
                cancelEditSynonym={cancelEditSynonym}
                startEditSynonym={startEditSynonym}
                handleDeleteSynonym={handleRemoveSynonymGroup}
                handleSaveSynonyms={handleSaveSynonyms}
                newQuickAction={newQuickAction}
                setNewQuickAction={setNewQuickAction}
                addQuickAction={addQuickAction}
                removeQuickAction={removeQuickAction}
                isBulkMoveModalOpen={isBulkMoveModalOpen}
                setIsBulkMoveModalOpen={setIsBulkMoveModalOpen}
                bulkActionType={bulkActionType}
                setIsTargetDropdownOpen={setIsTargetDropdownOpen}
                isTargetDropdownOpen={isTargetDropdownOpen}
                chatbots={chatbots}
                properties={properties}
                targetPropertyId={targetPropertyId}
                setTargetPropertyId={setTargetPropertyId}
                handleBulkMoveOrCopy={handleBulkAction}
                isBulkDeleteConfirmModalOpen={isBulkDeleteConfirmModalOpen}
                setIsBulkDeleteConfirmModalOpen={setIsBulkDeleteConfirmModalOpen}
                selectedProperty={selectedProperty}
                deleteVerifyText={deleteVerifyText}
                setDeleteVerifyText={setDeleteVerifyText}
                confirmBulkDelete={handleFinalBulkDelete}
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
                isDarkTheme={isAITrainingDarkTheme}
            />
            <ManualAddModal
                isOpen={isAddModalOpen}
                onClose={closeAddModal}
                onAdd={handleAddManual}
                loading={loading}
                groupedDocs={groupedDocs}
                newDoc={newDoc}
                setNewDoc={setNewDoc}
            />

            <EditDocModal
                isOpen={isEditModalOpen}
                onClose={closeEditModal}
                onUpdate={handleUpdateDoc}
                loading={loading}
                editingDoc={editingDoc}
                setEditingDoc={setEditingDoc}
            />

            {/* Org Manager Modal */}
            <Modal
                isOpen={isOrgManagerOpen}
                onClose={() => setIsOrgManagerOpen(false)}
                title="Quản trị Tổ chức"
                size="4xl"
                isDarkTheme={isAITrainingDarkTheme}
                noPadding
            >
                <div className={`flex-1 overflow-hidden p-6 ${isAITrainingDarkTheme ? 'bg-[#11151d]' : 'bg-slate-50'}`}>
                    <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 lg:mx-0 lg:px-0 max-w-fit">
                        <OrgUserManager
                            isDarkTheme={isAITrainingDarkTheme}
                            categoryId={selectedCategoryId || undefined}
                        />
                    </div>
                </div>
            </Modal>

            {/* AI Space Interactive Workspace Modal */}
            <Modal
                isOpen={aiSpaceModal.isOpen}
                onClose={() => setAiSpaceModal(prev => ({ ...prev, isOpen: false }))}
                title={
                    <div className="flex items-center gap-3">
                        <AppIcon name="ai_training" size={32} className="rounded-[10px] shrink-0" />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                    AI Space: {activeSpaceCategory?.name || 'Trợ lý AI Nội bộ'}
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    {spaceBots.length} AI Agents
                                </span>
                            </div>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {activeSpaceCategory?.description || 'Không gian hỏi đáp tri thức nội bộ và kiểm thử kịch bản AI trực tiếp'}
                            </p>
                        </div>
                    </div>
                }
                size="4xl"
                isDarkTheme={isAITrainingDarkTheme}
                noPadding
            >
                <div className={`flex flex-col h-[680px] max-h-[82vh] overflow-hidden ${isAITrainingDarkTheme ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-800'}`}>
                    {/* Sub-toolbar: Category switcher + Quick actions */}
                    <div className={`px-4 py-2.5 border-b flex flex-wrap items-center justify-between gap-2 shrink-0 ${isAITrainingDarkTheme ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50/80 border-slate-200'}`}>
                        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                            {categories.map(cat => {
                                const isCurrentCat = String(cat.id) === String(activeSpaceCategory?.id || aiSpaceModal.categoryId);
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => handleOpenAISpace(cat.id)}
                                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap border ${
                                            isCurrentCat
                                                ? 'bg-indigo-600 text-white border-indigo-600'
                                                : (isAITrainingDarkTheme
                                                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100')
                                        }`}
                                    >
                                        {cat.name}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {aiSpaceModal.categoryId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const url = `${window.location.origin}/ai-space/${activeSpaceCategory?.id || aiSpaceModal.categoryId}`;
                                        navigator.clipboard.writeText(url);
                                        toast.success('Đã sao chép đường dẫn AI Space!');
                                    }}
                                    className={`h-8 px-3 rounded-lg border text-[11px] font-semibold transition-colors flex items-center gap-1.5 ${
                                        isAITrainingDarkTheme
                                            ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                    }`}
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy Link Space</span>
                                </button>
                            )}
                            {aiSpaceModal.activeBotId && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        const botId = aiSpaceModal.activeBotId!;
                                        setAiSpaceModal(prev => ({ ...prev, isOpen: false }));
                                        setSelectedProperty(botId);
                                        setViewMode('doc');
                                    }}
                                    className="h-8 px-3 rounded-lg bg-[var(--color-primary)] text-white text-[11px] font-bold transition-colors flex items-center gap-1.5 hover:brightness-95"
                                >
                                    <Bot className="w-3.5 h-3.5" />
                                    <span>Huấn luyện Bot này</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 2-Column Workspace Body */}
                    <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
                        {/* Left Bot Selector Sidebar */}
                        <div className={`w-full lg:w-64 border-b lg:border-b-0 lg:border-r p-3 flex lg:flex-col gap-2 overflow-x-auto lg:overflow-y-auto shrink-0 ${
                            isAITrainingDarkTheme ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50/50 border-slate-200'
                        }`}>
                            <div className="hidden lg:block text-[10px] font-black uppercase tracking-widest text-slate-400 px-1 mb-1">
                                Chọn AI Agent ({spaceBots.length})
                            </div>
                            {spaceBots.map(bot => {
                                const isSelected = String(bot.id) === String(aiSpaceModal.activeBotId);
                                return (
                                    <button
                                        key={bot.id}
                                        type="button"
                                        onClick={() => setAiSpaceModal(prev => ({ ...prev, activeBotId: bot.id }))}
                                        className={`p-3 rounded-[14px] border text-left transition-colors flex items-start gap-2.5 shrink-0 lg:w-full min-w-[200px] lg:min-w-0 ${
                                            isSelected
                                                ? (isAITrainingDarkTheme
                                                    ? 'bg-indigo-500/15 border-indigo-500/40 text-white'
                                                    : 'bg-indigo-50/80 border-indigo-300 text-slate-900')
                                                : (isAITrainingDarkTheme
                                                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                                                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300')
                                        }`}
                                    >
                                        <AppIcon name="ai_training" size={32} className="rounded-[8px] shrink-0 mt-0.5" />
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-bold truncate">{bot.name}</div>
                                            <div className="text-[10px] text-slate-400 truncate mt-0.5">
                                                {bot.description || 'Trợ lý AI nội bộ'}
                                            </div>
                                            <div className="flex items-center gap-2 mt-1.5 text-[10px] font-semibold text-slate-500">
                                                <span>{(bot.stats?.docs_count || 0)} docs</span>
                                                <span>•</span>
                                                <span>{(bot.stats?.queries_count || 0)} convos</span>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Right UnifiedChat Workspace */}
                        <div className="flex-1 min-w-0 min-h-0 p-3 overflow-hidden flex flex-col">
                            {aiSpaceModal.activeBotId ? (
                                <UnifiedChat
                                    key={aiSpaceModal.activeBotId}
                                    propertyId={aiSpaceModal.activeBotId}
                                    isGroup={true}
                                    initialSource="org"
                                    isDarkTheme={isAITrainingDarkTheme}
                                />
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                                    <Bot className="w-12 h-12 text-slate-300 mb-3" />
                                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300">Chưa có AI Agent trong nhóm này</h4>
                                    <p className="text-xs text-slate-400 mt-1">Vui lòng chọn nhóm khác hoặc nhấn "Tạo AI Agent" để bắt đầu.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default AITraining;

// Dual value declarations for verbatimModuleSyntax compatibility
export const AISettings: any = undefined;
