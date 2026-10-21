import * as React from 'react';
import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../../components/marketing/services/storageAdapter';
import { getMktPortalRoot } from '../../components/marketing/utils/portalRoot';
import { Subscriber, Segment, Flow } from '../../components/marketing/types';
import {
    UserPlus, Layers, Users, RefreshCw,
    List, Plus, Trash2, Tag, TrendingUp, UserMinus,
    FileText, X, ShieldCheck, Zap, Calendar, Globe as Facebook, MessageCircle, Lightbulb
} from 'lucide-react';
import Button from '../../components/marketing/components/common/Button';
import PageHero from '../../components/marketing/components/common/PageHero';
import StatCard from '../../components/marketing/components/common/StatCard';
import Tabs from '../../components/marketing/components/common/Tabs';
import Select from '../../components/marketing/components/common/Select';
import toast from 'react-hot-toast';
import ListsTab from '../../components/marketing/components/audience/tabs/ListsTab';
import SegmentsTab from '../../components/marketing/components/audience/tabs/SegmentsTab';
import ContactsTab from '../../components/marketing/components/audience/tabs/ContactsTab';
import IntegrationsTab from '../../components/marketing/components/audience/tabs/IntegrationsTab';
import ConfirmModal from '../../components/marketing/components/common/ConfirmModal';
import { isManualList } from '../../components/marketing/utils/listHelpers';
import ColumnCustomizer from '../../components/marketing/components/audience/ColumnCustomizer';
import AdvancedFilters from '../../components/marketing/components/audience/AdvancedFilters';
import MetaCustomers from '../../components/marketing/components/meta/MetaCustomers';
import ZaloAudienceTab from '../../components/marketing/components/zalo/ZaloAudienceTab';
import TabTransition from '../../components/marketing/components/common/TabTransition';
import FilterPills from '../../components/marketing/components/audience/FilterPills';
import { Panel, Toolbar, SearchBox } from '../../components/marketing/components/audience/AudienceUi';
import { useIsAdmin } from '../../components/marketing/hooks/useAuthUser';
import { usePermissionGuard } from '../../components/marketing/components/common/PermissionGuard';

const SegmentBuilderModal = React.lazy(() => import('../../components/marketing/components/audience/SegmentBuilderModal'));
const ListFormModal = React.lazy(() => import('../../components/marketing/components/audience/ListFormModal'));
const ImportSubscribersModal = React.lazy(() => import('../../components/marketing/components/audience/ImportSubscribersModal'));
const IntegrationsModal = React.lazy(() => import('../../components/marketing/components/audience/IntegrationsModal'));
const GroupDetailModal = React.lazy(() => import('../../components/marketing/components/audience/GroupDetailModal'));
const AudienceSplitModal = React.lazy(() => import('../../components/marketing/components/audience/AudienceSplitModal'));
const ListMergeModal = React.lazy(() => import('../../components/marketing/components/audience/ListMergeModal'));
const CleanupModal = React.lazy(() => import('../../components/marketing/components/audience/CleanupModal'));
const AudienceTipsModal = React.lazy(() => import('../../components/marketing/components/audience/AudienceTipsModal'));

const UndoToastContent = ({ t, icon: Icon, iconColorClass, title, subtitle, durationMs, onUndo }: any) => {
    const [timeLeft, setTimeLeft] = useState(Math.floor(durationMs / 1000));

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${iconColorClass}`}>
                <Icon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-[150px]">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{title}</p>
                <div className="flex items-center gap-1 mt-0.5">
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>
                    <span className="text-[10px] font-black text-rose-500 tabular-nums">({timeLeft}s)</span>
                </div>
            </div>
            <button
                onClick={onUndo}
                className="px-3 py-1.5 bg-slate-900 text-white text-[10px] font-black rounded-lg hover:bg-slate-800 transition-all uppercase tracking-widest shrink-0 shadow-sm"
            >
                Hoàn tác
            </button>
        </div>
    );
};


const ITEMS_PER_PAGE = 20;

// Column Definitions for Customization
const COLUMN_DEFINITIONS = [
    { id: 'name', label: 'Khách hàng', required: true },
    { id: 'phone', label: 'Liên hệ', required: false },
    { id: 'company', label: 'Công ty', required: false },
    { id: 'status', label: 'Trạng thái', required: false },
    { id: 'source', label: 'Nguồn', required: false },
    { id: 'lastActivity', label: 'Hoạt động gần nhất', required: false },
    { id: 'tags', label: 'Tags', required: false },
    { id: 'salesperson', label: 'Phụ trách', required: false },
    { id: 'joinedAt', label: 'Ngày tham gia', required: false },
];

const DEFAULT_VISIBLE_COLUMNS = ['name', 'phone', 'status', 'source', 'lastActivity', 'tags'];

const PIPELINE_STAGE_LABELS: Record<number, string> = {
    1: '01 – New Lead',
    2: '02 – Contact Attempted',
    3: '03 – Connected',
    4: '04 – Needed',
    5: '05 – Discovery Completed',
    6: '06 – Program Matched',
    7: '07 – Proposal Sent',
    8: '08 – Evaluation / Objection',
    9: '09 – Application Started',
    10: '10 – Application Completed',
    11: '11 – Admission Approved',
    12: '12 – Offer / Scholarship Accepted',
    13: '13 – Deposit / Tuition Payment',
    14: '14 – Enrolled',
};

const formatSegmentCriteriaDisplay = (seg: any): string => {
    const desc = typeof seg?.description === 'string' ? seg.description.trim() : '';
    if (desc && desc.startsWith('Pipeline:')) {
        return desc;
    }
    const raw = typeof seg?.rawCriteria === 'string' ? seg.rawCriteria : (typeof seg?.criteria === 'string' ? seg.criteria : '');
    if (!raw || !raw.trim().startsWith('[')) {
        return raw || desc || 'Tùy chỉnh';
    }
    try {
        const parsed = JSON.parse(raw);
        const groups = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.groups) ? parsed.groups : []);
        const stageNums: number[] = [];
        let onlyStageConds = groups.length > 0;
        for (const g of groups) {
            const conds = Array.isArray(g?.conditions) ? g.conditions : [];
            if (conds.length === 0) {
                onlyStageConds = false;
                break;
            }
            for (const c of conds) {
                if (c?.field === 'crm_stage_id' || c?.field === 'stage_id') {
                    const tokens = String(c?.value ?? '').split(',').map(s => s.trim()).filter(Boolean);
                    for (const t of tokens) {
                        const n = Number(t);
                        if (Number.isFinite(n)) {
                            const normalized = n >= 31 && n <= 44 ? n - 30 : n;
                            if (normalized >= 1 && normalized <= 14 && !stageNums.includes(normalized)) {
                                stageNums.push(normalized);
                            }
                        }
                    }
                } else {
                    onlyStageConds = false;
                }
            }
        }
        if (onlyStageConds && stageNums.length > 0) {
            stageNums.sort((a, b) => a - b);
            const first = PIPELINE_STAGE_LABELS[stageNums[0]] || `Stage ${stageNums[0]}`;
            const last = PIPELINE_STAGE_LABELS[stageNums[stageNums.length - 1]] || `Stage ${stageNums[stageNums.length - 1]}`;
            return stageNums.length === 1 ? `Pipeline: ${first}` : `Pipeline: ${first} → ${last}`;
        }
    } catch {
        // Fallback to raw criteria
    }
    return raw;
};

const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'Chưa có dữ liệu';
    const date = new Date(dateString);
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);
    if (diffSeconds < 60) return 'Vừa xong';
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN');
};



interface PaginationState {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

import { useNavigation } from '../../components/marketing/contexts/NavigationContext';

const Audience: React.FC = () => {
    const { setCustomBackAction } = useNavigation();
    const navigate = useNavigate();
    const isAdmin = useIsAdmin();
    const { guard: adminGuard, PermModal: AdminPermModal } = usePermissionGuard(isAdmin);

    const [activeTab, setActiveTab] = useState<'lists' | 'segments' | 'contacts' | 'integrations' | 'meta' | 'zalo'>('contacts');

    // Main Subscriber List State (Paginated)
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 });

    // Auxiliary Data
    const [segments, setSegments] = useState<Segment[]>([]);
    const [allSegments, setAllSegments] = useState<Segment[]>([]);
    const [segmentsPagination, setSegmentsPagination] = useState<PaginationState>({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 });
    const [flows, setFlows] = useState<Flow[]>([]);
    const [staticLists, setStaticLists] = useState<any[]>([]);
    const [allStaticLists, setAllStaticLists] = useState<any[]>([]);
    const [listsPagination, setListsPagination] = useState<PaginationState>({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 });
    const [integrations, setIntegrations] = useState<any[]>([]); // New state for integrations
    const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSavingSubscriber, setIsSavingSubscriber] = useState(false);
    const [isProcessingBulk, setIsProcessingBulk] = useState(false);
    const [stats, setStats] = useState({ total: 0, unsubscribed: 0, customer: 0, lead: 0, active: 0, email_reach: 0, zalo_reach: 0 });

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterTags, setFilterTags] = useState<string[]>([]);
    const [filterVerify, setFilterVerify] = useState<string>('all');
    const [filterHasChat, setFilterHasChat] = useState<string>('all');
    const [filterCustomAttrKey, setFilterCustomAttrKey] = useState<string>('');
    const [filterCustomAttrValue, setFilterCustomAttrValue] = useState<string>('');
    const [filterSalesperson, setFilterSalesperson] = useState<string>('');
    const [customAttrKeys, setCustomAttrKeys] = useState<{ key: string; label: string }[]>([]);
    const [sortBy, setSortBy] = useState<string>('newest');
    const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
    const [isDateRangeModalOpen, setIsDateRangeModalOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [recentDays, setRecentDays] = useState<number>(7);

    // NEW: Column Customization & Items Per Page
    const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
        const saved = localStorage.getItem('mailflow_items_per_page');
        return saved ? parseInt(saved) : 20;
    });

    const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
        const saved = localStorage.getItem('mailflow_visible_columns');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    const normalized = parsed
                        .map((col: string) => (col === 'email' ? 'phone' : col))
                        .filter((col: string, idx: number, arr: string[]) => col !== 'salesperson' && col !== 'leadScore' && arr.indexOf(col) === idx);
                    return normalized.length > 0 ? normalized : DEFAULT_VISIBLE_COLUMNS;
                }
            } catch {
                // Ignore parsing errors
            }
        }
        return DEFAULT_VISIBLE_COLUMNS;
    });

    const [isImportModalOpen, setImportModalOpen] = useState(false);
    const [isIntegrationsModalOpen, setIsIntegrationsModalOpen] = useState(false);
    const [isSegmentBuilderOpen, setSegmentBuilderOpen] = useState(false);
    const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);

    // Viewing Group State (GroupDetailModal)
    const [viewingGroup, setViewingGroup] = useState<{ id: string; name: string; type: 'list' | 'segment'; count: number } | null>(null);
    const [editingIntegration, setEditingIntegration] = useState<any | null>(null);
    const [groupMembers, setGroupMembers] = useState<Subscriber[]>([]);
    const [groupPagination, setGroupPagination] = useState<PaginationState>({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 });
    const [groupLoading, setGroupLoading] = useState(false);
    const [groupSearch, setGroupSearch] = useState('');
    const [groupStatus, setGroupStatus] = useState<string>('all');

    const [editingSegment, setEditingSegment] = useState<Segment | null>(null);
    const [editingList, setEditingList] = useState<any | null>(null);
    const [isCreateListModalOpen, setIsCreateListModalOpen] = useState(false);

    // Modals & UI
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        variant: 'danger' | 'warning' | 'info';
        onConfirm: () => void | Promise<any>;
        requireConfirmText?: string;
        isLoading?: boolean;
    }>({ isOpen: false, title: '', message: '', variant: 'warning', onConfirm: () => { } });

    const [bulkTagModalOpen, setBulkTagModalOpen] = useState(false);
    const [bulkTagName, setBulkTagName] = useState('');

    // Split Audience State (Generic)
    const [splittingTarget, setSplittingTarget] = useState<{ id: string; name: string; type: 'segment' | 'list'; count: number } | null>(null);
    const [splitSelectedIds, setSplitSelectedIds] = useState<string[]>([]);

    // Merge Lists State
    const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
    const [mergingLists, setMergingLists] = useState<any[]>([]);

    const [cleanupTarget, setCleanupTarget] = useState<{ id: string; name: string; type: 'list' | 'segment' } | null>(null);
    const [isBulkListModalOpen, setIsBulkListModalOpen] = useState(false);
    const [isGlobalSelected, setIsGlobalSelected] = useState(false);
    const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);

    const pendingActionsRef = useRef<Record<string, NodeJS.Timeout>>({});
    const initialLoadDone = useRef(false);

    // AbortController refs for in-flight tab/group requests
    const subscribersAbortRef = useRef<AbortController | null>(null);
    const listsAbortRef = useRef<AbortController | null>(null);
    const segmentsAbortRef = useRef<AbortController | null>(null);
    const integrationsAbortRef = useRef<AbortController | null>(null);
    const groupAbortRef = useRef<AbortController | null>(null);

    // Lazy-loaded auxiliary data flags
    const loadedAuxRef = useRef({
        allLists: false,
        allSegments: false,
        flows: false,
        tagsAndForms: false,
    });

    // Form-protection modal state
    const [formProtectionModal, setFormProtectionModal] = useState<{
        isOpen: boolean;
        listName: string;
        linkedForms: { id: string; name: string }[];
    }>({ isOpen: false, listName: '', linkedForms: [] });

    useEffect(() => {
        return () => {
            subscribersAbortRef.current?.abort();
            listsAbortRef.current?.abort();
            segmentsAbortRef.current?.abort();
            integrationsAbortRef.current?.abort();
            groupAbortRef.current?.abort();
        };
    }, []);

    const ensureAllListsLoaded = React.useCallback(async (force = false) => {
        if (loadedAuxRef.current.allLists && !force) return;
        loadedAuxRef.current.allLists = true;
        const listRes = await api.get<any[]>('lists');
        if (listRes.success) {
            const listData = Array.isArray(listRes.data) ? listRes.data : ((listRes.data as any)?.data || []);
            setAllStaticLists(listData);
            setListsPagination(prev => ({ ...prev, total: (listRes.data as any)?.pagination?.total || listData.length }));
        }
    }, []);

    const ensureAllSegmentsLoaded = React.useCallback(async (force = false) => {
        if (loadedAuxRef.current.allSegments && !force) return;
        loadedAuxRef.current.allSegments = true;
        const segRes = await api.get<Segment[]>('segments');
        if (segRes.success) {
            const segData = Array.isArray(segRes.data) ? segRes.data : ((segRes.data as any)?.data || []);
            setAllSegments(segData);
            setSegmentsPagination(prev => ({ ...prev, total: (segRes.data as any)?.pagination?.total || segData.length }));
        }
    }, []);

    const ensureFlowsLoaded = React.useCallback(async () => {
        if (loadedAuxRef.current.flows) return;
        loadedAuxRef.current.flows = true;
        const flowRes = await api.get<Flow[]>('flows');
        if (flowRes.success) {
            const rawF = flowRes.data as any;
            setFlows(Array.isArray(rawF) ? rawF : (rawF?.data || []));
        }
    }, []);

    const ensureTagsAndCustomKeysLoaded = React.useCallback(async () => {
        if (loadedAuxRef.current.tagsAndForms) return;
        loadedAuxRef.current.tagsAndForms = true;
        const [tagRes, formsRes] = await Promise.all([
            api.get<{ id: string; name: string }[]>('tags'),
            api.get<any[]>('forms'),
        ]);
        if (tagRes.success) {
            setTags(Array.isArray(tagRes.data) ? tagRes.data : ((tagRes.data as any)?.data || []));
        }
        if (formsRes.success && Array.isArray(formsRes.data)) {
            const keyMap = new Map<string, string>();
            formsRes.data.forEach((form: any) => {
                (form.fields || []).forEach((f: any) => {
                    if (f.isCustom && f.customKey) {
                        keyMap.set(f.customKey, f.label || f.customKey);
                    }
                });
            });
            setCustomAttrKeys(Array.from(keyMap.entries()).map(([key, label]) => ({ key, label })));
        }
    }, []);

    const fetchGlobalStats = React.useCallback(async () => {
        const totalSubRes = await api.get<any>('subscribers?limit=1');
        if (totalSubRes.success && totalSubRes.data) {
            const total = totalSubRes.data.pagination ? totalSubRes.data.pagination.total : 0;
            const apiStats = totalSubRes.data?.globalStats || { customer: 0, unsubscribed: 0, lead: 0, active: 0, email_reach: 0, zalo_reach: 0 };
            setStats(prev => ({
                ...prev,
                total,
                customer: apiStats.customer || 0,
                unsubscribed: apiStats.unsubscribed || 0,
                lead: apiStats.lead || 0,
                active: apiStats.active || 0,
                email_reach: apiStats.email_reach || 0,
                zalo_reach: apiStats.zalo_reach || 0,
            }));
        }
    }, []);

    const handleSelectSubscriber = React.useCallback((s: Subscriber | null | any) => {
        if (!s) return;
        const contactId = s.contact_id || s.myerp_contact_id;
        if (contactId) {
            window.dispatchEvent(new CustomEvent('open-customer-drawer', { detail: { id: Number(contactId), initialTab: 'journey360' } }));
        } else {
            window.dispatchEvent(new CustomEvent('open-customer-drawer', { detail: { phone: s.phone, email: s.email, contact: s, initialTab: 'journey360' } }));
        }
    }, []);

    const backToContacts = React.useCallback(() => setSelectedSubscriber(null), []);
    const backToGroups = React.useCallback(() => setViewingGroup(null), []);

    // Smart Back Logic
    useEffect(() => {
        if (selectedSubscriber) {
            setCustomBackAction(() => backToContacts);
            ensureAllListsLoaded();
            ensureAllSegmentsLoaded();
            ensureFlowsLoaded();
            ensureTagsAndCustomKeysLoaded();
        } else if (viewingGroup) {
            setCustomBackAction(() => backToGroups);
        } else {
            setCustomBackAction(null);
        }

        return () => setCustomBackAction(null);
    }, [selectedSubscriber, viewingGroup, setCustomBackAction, backToContacts, backToGroups, ensureAllListsLoaded, ensureAllSegmentsLoaded, ensureFlowsLoaded, ensureTagsAndCustomKeysLoaded]);

    useEffect(() => {
        if (isImportModalOpen || isBulkListModalOpen) {
            ensureAllListsLoaded();
        }
    }, [isImportModalOpen, isBulkListModalOpen, ensureAllListsLoaded]);

    useEffect(() => {
        if (bulkTagModalOpen) {
            ensureTagsAndCustomKeysLoaded();
        }
    }, [bulkTagModalOpen, ensureTagsAndCustomKeysLoaded]);

    // Debounce Search (300ms)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPagination(prev => ({ ...prev, page: 1 }));
            setListsPagination(prev => ({ ...prev, page: 1 }));
            setSegmentsPagination(prev => ({ ...prev, page: 1 }));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        if (initialLoadDone.current) return;
        initialLoadDone.current = true;
        Promise.all([
            fetchGlobalStats(),
            fetchSubscribers(1),
        ]);
    }, []);

    const location = useLocation();
    useEffect(() => {
        const state = location.state as any;
        if (state?.openSubscriberId) {
            const subId = state.openSubscriberId;
            api.get<Subscriber>(`subscribers/${subId}`).then(res => {
                if (res.success && res.data) {
                    handleSelectSubscriber(res.data);
                    navigate(location.pathname, { replace: true, state: { ...state, openSubscriberId: undefined } });
                }
            });
        }
        if (state?.openListId) {
            setViewingGroup({ id: state.openListId, name: state.openListName || 'Danh sách', type: 'list', count: state.openListCount || 0 });
            navigate(location.pathname, { replace: true, state: { ...state, openListId: undefined, openListName: undefined, openListCount: undefined } });
        }

        const params = new URLSearchParams(location.search);
        const qTab = params.get('tab');
        const qSegmentId = params.get('segment_id');
        const qListId = params.get('list_id');

        if (qTab && ['contacts', 'segments', 'lists', 'tags'].includes(qTab)) {
            setActiveTab(qTab as any);
        }

        if (qSegmentId) {
            setActiveTab('segments');
            const found = allSegments.find(s => s.id === qSegmentId) || segments.find(s => s.id === qSegmentId);
            if (found) {
                setViewingGroup({ id: found.id, name: found.name, type: 'segment', count: found.count || 0 });
            } else {
                api.get<Segment>(`segments?id=${qSegmentId}`).then(res => {
                    if (res.success && res.data) {
                        const seg = Array.isArray(res.data) ? res.data[0] : res.data;
                        if (seg) setViewingGroup({ id: seg.id, name: seg.name, type: 'segment', count: seg.count || 0 });
                    }
                });
            }
            navigate(location.pathname, { replace: true, state: state });
        }

        if (qListId) {
            setActiveTab('lists');
            const found = allStaticLists.find((l: any) => l.id === qListId) || staticLists.find((l: any) => l.id === qListId);
            if (found) {
                setViewingGroup({ id: found.id, name: found.name, type: 'list', count: found.count || 0 });
            } else {
                api.get<any>(`lists?id=${qListId}`).then(res => {
                    if (res.success && res.data) {
                        const lst = Array.isArray(res.data) ? res.data[0] : res.data;
                        if (lst) setViewingGroup({ id: lst.id, name: lst.name, type: 'list', count: lst.count || 0 });
                    }
                });
            }
            navigate(location.pathname, { replace: true, state: state });
        }
    }, [location.state, location.search]);

    // CRITICAL: These callbacks must be defined BEFORE any conditional rendering to avoid hooks violations
    const handleToggleSelection = React.useCallback((id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
        if (isGlobalSelected) setIsGlobalSelected(false);
    }, [selectedIds, isGlobalSelected]);

    const handleToggleSelectAll = React.useCallback(() => {
        const currentPageIds = subscribers.map(s => s.id);
        const allSelected = currentPageIds.every(id => selectedIds.has(id));
        const newSet = new Set(selectedIds);

        if (allSelected) {
            currentPageIds.forEach(id => newSet.delete(id));
            if (isGlobalSelected) setIsGlobalSelected(false);
        } else {
            currentPageIds.forEach(id => newSet.add(id));
        }
        setSelectedIds(newSet);
    }, [subscribers, selectedIds, isGlobalSelected]);

    const handleClearSelection = React.useCallback(() => {
        setSelectedIds(new Set());
        if (isGlobalSelected) setIsGlobalSelected(false);
    }, [isGlobalSelected]);

    // Generic fetch for Lists with pagination + AbortController
    const fetchLists = async (page = 1) => {
        listsAbortRef.current?.abort();
        const controller = new AbortController();
        listsAbortRef.current = controller;

        setLoading(true);
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                limit: ITEMS_PER_PAGE.toString(),
                search: debouncedSearch
            });
            const res = await api.get<any>(`lists?${query.toString()}`, {}, { signal: controller.signal });
            if (controller.signal.aborted) return;
            if (res.success && res.data?.pagination) {
                setStaticLists(Array.isArray(res.data.data) ? res.data.data : []);
                setListsPagination(res.data.pagination);
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    };

    // Generic fetch for Segments with pagination + AbortController
    const fetchSegments = async (page = 1) => {
        segmentsAbortRef.current?.abort();
        const controller = new AbortController();
        segmentsAbortRef.current = controller;

        setLoading(true);
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                limit: ITEMS_PER_PAGE.toString(),
                search: debouncedSearch
            });
            const res = await api.get<any>(`segments?${query.toString()}`, {}, { signal: controller.signal });
            if (controller.signal.aborted) return;
            if (res.success && res.data?.pagination) {
                setSegments(Array.isArray(res.data.data) ? res.data.data : []);
                setSegmentsPagination(res.data.pagination);
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    };

    const fetchIntegrations = async (silent = false) => {
        integrationsAbortRef.current?.abort();
        const controller = new AbortController();
        integrationsAbortRef.current = controller;

        if (!silent) setLoading(true);
        try {
            const res = await api.get<any[]>(`integrations?t=${Date.now()}`, {}, { signal: controller.signal });
            if (controller.signal.aborted) return null;
            if (res.success) {
                setIntegrations(Array.isArray(res.data) ? res.data : ((res.data as any)?.data || []));
            }
            if (!silent) setLoading(false);
            return res.success ? res.data : null;
        } catch (error: any) {
            if (error?.name === 'AbortError') return null;
            console.error("Lỗi khi tải kết nối", error);
            if (!silent && !controller.signal.aborted) setLoading(false);
            return null;
        }
    };

    // Effect to fetch ONLY the active tab's data
    useEffect(() => {
        if (!initialLoadDone.current) return;
        if (activeTab === 'contacts') {
            fetchSubscribers(pagination.page);
        } else if (activeTab === 'lists') {
            ensureAllListsLoaded();
            fetchLists(listsPagination.page);
        } else if (activeTab === 'segments') {
            ensureAllSegmentsLoaded();
            fetchSegments(segmentsPagination.page);
        } else if (activeTab === 'integrations') {
            ensureAllListsLoaded();
            fetchIntegrations();
        }
    }, [activeTab, pagination.page, listsPagination.page, segmentsPagination.page, debouncedSearch, filterStatus, filterTags, filterVerify, filterHasChat, filterSalesperson, sortBy, dateRange, itemsPerPage, recentDays, filterCustomAttrKey, filterCustomAttrValue]);

    // Reset page to 1 on filter/search change
    useEffect(() => {
        setPagination(prev => ({ ...prev, page: 1 }));
        setListsPagination(prev => ({ ...prev, page: 1 }));
        setSegmentsPagination(prev => ({ ...prev, page: 1 }));
    }, [debouncedSearch, filterStatus, filterTags, filterVerify, filterHasChat, filterSalesperson, sortBy, filterCustomAttrKey, filterCustomAttrValue]);

    // Fetch Group Members when viewingGroup changes or its filters change
    useEffect(() => {
        if (viewingGroup) {
            fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch, groupStatus);
        } else {
            groupAbortRef.current?.abort();
            setGroupMembers([]);
            setGroupSearch('');
            setGroupStatus('all');
            setGroupPagination({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 });
        }
    }, [viewingGroup?.id, groupPagination.page, groupSearch, groupStatus]);

    const fetchInitialData = async () => {
        await fetchGlobalStats();
        if (activeTab === 'contacts') await fetchSubscribers(pagination.page);
        else if (activeTab === 'lists') {
            await Promise.all([ensureAllListsLoaded(true), fetchLists(listsPagination.page)]);
        } else if (activeTab === 'segments') {
            await Promise.all([ensureAllSegmentsLoaded(true), fetchSegments(segmentsPagination.page)]);
        } else if (activeTab === 'integrations') {
            await Promise.all([ensureAllListsLoaded(true), fetchIntegrations()]);
        }
    };

    // Polling for Sync Status with timeout protection & visibility awareness
    const prevSyncingRef = useRef(false);
    useEffect(() => {
        let isMounted = true;
        const isCurrentlySyncing = integrations.some((i: any) => i.sync_status === 'syncing');
        
        if (prevSyncingRef.current && !isCurrentlySyncing) {
            fetchGlobalStats();
            if (activeTab === 'contacts') fetchSubscribers(1);
        }
        prevSyncingRef.current = isCurrentlySyncing;

        if (activeTab !== 'integrations' || !isCurrentlySyncing) return;

        const syncStartTime = Date.now();

        const interval = setInterval(() => {
            if (typeof document !== 'undefined' && document.hidden) return;
            const elapsed = Date.now() - syncStartTime;

            if (elapsed > 300000) {
                if (isMounted) fetchIntegrations(true);
                clearInterval(interval);
                return;
            }

            if (isMounted) fetchIntegrations(true);
        }, 2000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [activeTab, integrations.some(i => i.sync_status === 'syncing'), fetchGlobalStats]);

    const fetchSubscribers = async (page = 1) => {
        subscribersAbortRef.current?.abort();
        const controller = new AbortController();
        subscribersAbortRef.current = controller;

        setLoading(true);
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                limit: itemsPerPage.toString(),
                search: debouncedSearch,
                status: filterStatus,
                tag: filterTags.join(','),
                verified: filterVerify,
                has_chat: filterHasChat,
                sort: sortBy,
                salesperson: filterSalesperson,
                ...(sortBy === 'birthday_custom' ? { startDate: dateRange.from, endDate: dateRange.to } : {}),
                ...(sortBy === 'recent_activity' ? { recent_days: recentDays.toString() } : {}),
                ...(filterCustomAttrKey ? { custom_attr_key: filterCustomAttrKey, custom_attr_value: filterCustomAttrValue } : {})
            });

            const res = await api.get<any>(`subscribers?${query.toString()}`, {}, { signal: controller.signal });
            if (controller.signal.aborted) return;
            if (res.success) {
                if (res.data?.pagination) {
                    setSubscribers(Array.isArray(res.data.data) ? res.data.data : []);
                    setPagination(res.data.pagination);
                } else if (Array.isArray(res.data)) {
                    setSubscribers(res.data);
                    setPagination({ page: 1, limit: res.data.length, total: res.data.length, totalPages: 1 });
                }
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    };

    const fetchGroupMembers = async (group: { id: string; type: string }, page = 1, search = '', status = 'all') => {
        if (!group) return;
        groupAbortRef.current?.abort();
        const controller = new AbortController();
        groupAbortRef.current = controller;

        setGroupLoading(true);
        try {
            const query = new URLSearchParams({
                page: page.toString(),
                limit: ITEMS_PER_PAGE.toString(),
                search: search,
                status: status === 'has_phone' ? 'all' : status,
                sort: 'newest'
            });

            if (status === 'has_phone') {
                query.set('has_phone', '1');
            }

            if (group.type === 'list') query.set('list_id', group.id);
            else if (group.type === 'segment') query.set('segment_id', group.id);
            else if (group.type === 'tag') query.set('tag', group.id);

            const res = await api.get<any>(`subscribers?${query.toString()}`, {}, { signal: controller.signal });
            if (controller.signal.aborted) return;
            if (res.success) {
                if (res.data.pagination) {
                    setGroupMembers(Array.isArray(res.data.data) ? res.data.data : []);
                    setGroupPagination(res.data.pagination);
                } else if (Array.isArray(res.data)) {
                    setGroupMembers(res.data);
                    setGroupPagination({ page: 1, limit: res.data.length, total: res.data.length, totalPages: 1 });
                } else {
                    setGroupMembers([]);
                    setGroupPagination({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 });
                }
            } else {
                setGroupMembers([]);
                setGroupPagination({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 1 });
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
        } finally {
            if (!controller.signal.aborted) setGroupLoading(false);
        }
    };

    const checkSegmentMatch = (sub: Subscriber, criteriaJson: string) => {
        try {
            if (!criteriaJson) return false;
            const criteria = JSON.parse(criteriaJson);
            if (!criteria) return false;

            const checkCondition = (cond: any) => {
                if (cond.field === 'last_activity') {
                    // Logic: "Inactive > X days" means days since last activity > X
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

                // Generic Top-level Fields (meta_psid, email, firstName, source, etc.)
                const val = (sub as any)[cond.field] !== undefined ? (sub as any)[cond.field] : '';
                const stringVal = (val !== null && val !== undefined) ? val.toString().toLowerCase() : '';
                const searchVal = (cond.value !== null && cond.value !== undefined) ? cond.value.toString().toLowerCase() : '';

                switch (cond.operator) {
                    case 'is_not_empty':
                        return !!val && val !== '';
                    case 'is_empty':
                        return !val || val === '';
                    case 'contains':
                    case 'like':
                        return stringVal.includes(searchVal);
                    case 'not_contains':
                        return !stringVal.includes(searchVal);
                    case 'equals':
                    case 'is':
                    case '=':
                        return val == cond.value;
                    case '!=':
                    case 'is_not':
                        return val != cond.value;
                    case 'starts_with':
                        return stringVal.startsWith(searchVal);
                    case 'greater_than':
                        return parseFloat(val) > parseFloat(cond.value);
                    case 'less_than':
                        return parseFloat(val) < parseFloat(cond.value);
                    default:
                        // Special handling for nested stats
                        if (cond.field.includes('.')) {
                            const parts = cond.field.split('.');
                            let current: any = sub;
                            for (const part of parts) {
                                if (current && current[part] !== undefined) {
                                    current = current[part];
                                } else {
                                    current = undefined;
                                    break;
                                }
                            }
                            if (current !== undefined) {
                                if (cond.operator === 'greater_than') return parseFloat(current) > parseFloat(cond.value);
                                if (cond.operator === 'less_than') return parseFloat(current) < parseFloat(cond.value);
                                if (cond.operator === '=') return current == cond.value;
                            }
                        }
                        return false;
                }
            };

            // NEW: Array of groups structure [ { id, conditions: [] }, ... ]
            // Logic: Groups are ORed, Conditions within a group are ANDed
            if (Array.isArray(criteria)) {
                if (criteria.length === 0) return false;
                return criteria.some((group: any) => {
                    const conditions = group.conditions || [];
                    if (conditions.length === 0) return true; // Empty group matches all? (standard behavior)
                    return conditions.every(checkCondition);
                });
            }

            // OLD: Single object structure { conditions: [], operator: 'AND'|'OR' }
            if (criteria.conditions && Array.isArray(criteria.conditions)) {
                const { conditions, operator } = criteria;
                if (operator === 'OR') {
                    return conditions.some(checkCondition);
                } else {
                    return conditions.every(checkCondition);
                }
            }

            return false;
        } catch (e) {
            console.error('Error parsing criteria', e);
            return false;
        }
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    };

    const handleUpdateSubscriber = async (updated: Subscriber) => {
        if (isSavingSubscriber) return; // [GUARD] Prevent double-submit
        setIsSavingSubscriber(true);
        // [OPTIMISTIC UI] Update local state immediately
        setSubscribers(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s));
        try {
            const res = await api.put<Subscriber>(`subscribers/${updated.id}`, updated);
            if (res.success) {
                setSubscribers(prev => prev.map(s => s.id === updated.id ? res.data : s));
                if (viewingGroup) fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);
                if (selectedSubscriber?.id === updated.id) setSelectedSubscriber(res.data);
                showToast('Cap nhat ho so thanh cong', 'success');
            } else {
                fetchSubscribers(pagination.page); // [ROLLBACK]
                showToast(res.message || 'Loi cap nhat ho so', 'error');
            }
        } catch (e) {
            fetchSubscribers(pagination.page); // [ROLLBACK]
            showToast('Loi ket noi khi cap nhat ho so', 'error');
        } finally {
            setIsSavingSubscriber(false); // [GUARD] Always unlock
        }
    };

    const handleRemoveFromList = async (subscriberIds: string[], listId: string, options?: { targetType: string, targetId: string }) => {
        setLoading(true);
        try {
            let payload: any = { type: 'list_remove', listId: listId };
            if (options) {
                payload.targetType = options.targetType;
                payload.targetId = options.targetId;
            } else {
                payload.subscriberIds = subscriberIds;
            }

            const res = await api.post<any>('bulk_operations', payload);
            if (res.success) {
                if (activeTab === 'contacts') fetchSubscribers(pagination.page);
                if (viewingGroup) fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);

                const listRes = await api.get<any[]>('lists');
                if (listRes.success) setStaticLists(Array.isArray(listRes.data) ? listRes.data : ((listRes.data as any)?.data || []));

                showToast(`Đã gỡ ${res.data.affected} Khách hàng khỏi danh sách`, 'success');
            } else {
                showToast(res.message || 'Lỗi khi gỡ khỏi danh sách', 'error');
            }
        } catch (error) {
            showToast('Đã xảy ra lỗi hệ thống khi gỡ khỏi danh sách', 'error');
        } finally {
            setLoading(false);
        }
    };

    const exportListContacts = async (list: any) => {
        const toastId = toast.loading('Đang chuẩn bị xuất dữ liệu...', { position: 'top-center' });
        try {
            const query = new URLSearchParams({
                page: '1',
                limit: '1000000',
                list_id: list.id
            });
            const res = await api.get<any>(`subscribers?${query.toString()}`);
            if (res.success && res.data) {
                const data = res.data.pagination ? res.data.data : (Array.isArray(res.data) ? res.data : []);
                if (data.length === 0) {
                    toast.error('Danh sách này chưa có liên hệ nào!', { id: toastId });
                    return;
                }
                
                const headers = ['Họ Tên', 'Số điện thoại', 'Email', 'Trạng thái', 'Nguồn', 'Ngày tham gia'];
                const rows = data.map((sub: any) => {
                    const fullName = `${sub.firstName || ''} ${sub.lastName || ''}`.trim() || 'Unknown';
                    return [
                        `"${fullName.replace(/"/g, '""')}"`,
                        `"${(sub.phoneNumber || '').replace(/"/g, '""')}"`,
                        `"${(sub.email || '').replace(/"/g, '""')}"`,
                        `"${(sub.status || '').replace(/"/g, '""')}"`,
                        `"${(sub.source || '').replace(/"/g, '""')}"`,
                        `"${(sub.joinedAt || sub.createdAt || '').replace(/"/g, '""')}"`
                    ].join(',');
                });
                
                const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.setAttribute("href", url);
                link.setAttribute("download", `danh_sach_${list.name.toLowerCase().replace(/\s+/g, '_')}.csv`);
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                toast.success(`Đã xuất thành công ${data.length} liên hệ!`, { id: toastId });
            } else {
                toast.error('Không thể lấy dữ liệu danh sách.', { id: toastId });
            }
        } catch (err) {
            console.error(err);
            toast.error('Lỗi kết nối khi xuất danh sách.', { id: toastId });
        }
    };

    const exportMultipleListsContacts = async (listIds: string[]) => {
        if (listIds.length === 0) return;
        const toastId = toast.loading('Đang chuẩn bị xuất dữ liệu từ các danh sách...', { position: 'top-center' });
        try {
            const allContactsMap = new Map();
            for (const listId of listIds) {
                const query = new URLSearchParams({
                    page: '1',
                    limit: '1000000',
                    list_id: listId
                });
                const res = await api.get<any>(`subscribers?${query.toString()}`);
                if (res.success && res.data) {
                    const data = res.data.pagination ? res.data.data : (Array.isArray(res.data) ? res.data : []);
                    data.forEach((sub: any) => {
                        allContactsMap.set(sub.id, sub);
                    });
                }
            }
            
            const combinedData = Array.from(allContactsMap.values());
            if (combinedData.length === 0) {
                toast.error('Các danh sách đã chọn không có liên hệ nào!', { id: toastId });
                return;
            }
            
            const headers = ['Họ Tên', 'Số điện thoại', 'Email', 'Trạng thái', 'Nguồn', 'Ngày tham gia'];
            const rows = combinedData.map((sub: any) => {
                const fullName = `${sub.firstName || ''} ${sub.lastName || ''}`.trim() || 'Unknown';
                return [
                    `"${fullName.replace(/"/g, '""')}"`,
                    `"${(sub.phoneNumber || '').replace(/"/g, '""')}"`,
                    `"${(sub.email || '').replace(/"/g, '""')}"`,
                    `"${(sub.status || '').replace(/"/g, '""')}"`,
                    `"${(sub.source || '').replace(/"/g, '""')}"`,
                    `"${(sub.joinedAt || sub.createdAt || '').replace(/"/g, '""')}"`
                ].join(',');
            });
            
            const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `danh_sach_tong_hop_${listIds.length}_lists.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(`Đã xuất thành công ${combinedData.length} liên hệ (lọc trùng)!`, { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error('Lỗi kết nối khi xuất danh sách.', { id: toastId });
        }
    };

    const handleDeleteSubscriber = (id: string, name?: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Xóa liên hệ vĩnh viễn?',
            message: (
                <div className="space-y-2">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Bạn sắp xóa vĩnh viễn liên hệ{name ? <strong> {name}</strong> : ''} khỏi hệ thống.
                    </p>
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-700 font-medium">
                        ⚠️ Toàn bộ lịch sử hoạt động, tag, và dữ liệu của liên hệ này sẽ bị xóa không thể khôi phục.
                    </div>
                </div>
            ),
            variant: 'danger',
            requireConfirmText: 'DELETE',
            onConfirm: async () => {
                setLoading(true);
                try {
                    const res = await api.delete(`subscribers/${id}`);
                    if (res.success) {
                        fetchSubscribers(pagination.page);
                        if (viewingGroup) fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);

                        const listRes = await api.get<any[]>('lists');
                        if (listRes.success) setStaticLists(Array.isArray(listRes.data) ? listRes.data : ((listRes.data as any)?.data || []));
                        const segRes = await api.get<Segment[]>('segments');
                        if (segRes.success) setSegments(Array.isArray(segRes.data) ? segRes.data : ((segRes.data as any)?.data || []));

                        if (selectedSubscriber?.id === id) setSelectedSubscriber(null);
                        if (selectedIds.has(id)) {
                            const newSet = new Set(selectedIds);
                            newSet.delete(id);
                            setSelectedIds(newSet);
                        }
                        showToast('Đã xóa Khách hàng hoàn toàn khỏi hệ thống', 'success');
                    } else {
                        showToast(res.message || 'Lỗi khi xóa Khách hàng', 'error');
                    }
                } catch (error) {
                    showToast('Đã xảy ra lỗi hệ thống khi xóa Khách hàng', 'error');
                } finally {
                    setLoading(false);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };


    const handleBulkDelete = async (options?: { targetType: string }) => {
        const isGlobal = options?.targetType === 'all';
        const countLabel = isGlobal ? pagination.total : selectedIds.size;
        const currentSelectedIds = Array.from(selectedIds);

        setConfirmModal({
            isOpen: true,
            title: `Xóa ${countLabel.toLocaleString()} liên hệ?`,
            message: isGlobal
                ? 'Hành động này sẽ xóa các liên hệ trong hệ thống (theo bộ lọc hiện tại). Bạn có 5 giây để hoàn tác sau khi xác nhận.'
                : 'Hành động này sẽ xóa các liên hệ đã chọn. Bạn có 5 giây để hoàn tác sau khi xác nhận.',
            variant: 'danger',
            requireConfirmText: 'CONFIRM',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setSelectedIds(new Set()); // Optimistic clear

                const actionId = `delete_${Date.now()}`;
                const timeout = setTimeout(async () => {
                    let payload: any = { type: 'delete' };
                    if (isGlobal) {
                        payload.targetType = 'all';
                        payload.status = filterStatus;
                        payload.tag = filterTags.join(',');
                        payload.search = debouncedSearch;
                        payload.verified = filterVerify;
                        payload.has_chat = filterHasChat;
                        if (filterCustomAttrKey) {
                            payload.custom_attr_key = filterCustomAttrKey;
                            payload.custom_attr_value = filterCustomAttrValue;
                        }
                    } else {
                        payload.subscriberIds = currentSelectedIds;
                    }

                    const res = await api.post<any>('bulk_operations', payload);
                    if (res.success) {
                        fetchSubscribers(pagination.page);
                        fetchInitialData();
                    }
                    delete pendingActionsRef.current[actionId];
                }, 5000);

                pendingActionsRef.current[actionId] = timeout;

                toast((t) => (
                    <UndoToastContent
                        t={t}
                        icon={Trash2}
                        iconColorClass="bg-rose-100 text-rose-600 animate-pulse-subtle"
                        title={`Đã xóa ${countLabel} liên hệ`}
                        subtitle="Hệ thống sẽ thực hiện thao tác xóa danh tính khách hàng... "
                        durationMs={5000}
                        onUndo={() => {
                            clearTimeout(timeout);
                            delete pendingActionsRef.current[actionId];
                            setSelectedIds(new Set(currentSelectedIds)); // Restore
                            toast.dismiss(t.id);
                            toast.success('Đã hoàn tác xóa liên hệ', { icon: '↩️' });
                        }}
                    />
                ), { duration: 6000, position: 'bottom-center' });
            }
        });
    };

    const handleBulkDeleteLists = async (ids: string[]) => {
        if (ids.length === 0) return;

        setConfirmModal({
            isOpen: true,
            title: `Xóa ${ids.length} danh sách?`,
            message: 'Hành động này sẽ xóa danh sách nhưng KHÔNG xóa subscribers. Bạn có chắc chắn muốn tiếp tục?',
            variant: 'warning',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                let successCount = 0;
                for (const id of ids) {
                    const res = await api.delete(`lists?id=${id}`);
                    if (res.success) successCount++;
                }
                const lRes = await api.get<any[]>('lists');
                if (lRes.success) setStaticLists(Array.isArray(lRes.data) ? lRes.data : ((lRes.data as any)?.data || []));
                showToast(`Đã xóa ${successCount} danh sách`, 'success');
            }
        });
    };

    const handleBulkDeleteSegments = async (ids: string[]) => {
        if (ids.length === 0) return;

        setConfirmModal({
            isOpen: true,
            title: `Xóa ${ids.length} segment?`,
            message: 'Segments sẽ bị xóa vĩnh viễn. Bạn có chắc chắn muốn tiếp tục?',
            variant: 'danger',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                let successCount = 0;
                for (const id of ids) {
                    const res = await api.delete(`segments?id=${id}`);
                    if (res.success) successCount++;
                }
                const sRes = await api.get<Segment[]>('segments');
                if (sRes.success) setSegments(Array.isArray(sRes.data) ? sRes.data : ((sRes.data as any)?.data || []));
                showToast(`Đã xóa ${successCount} phân khúc`, 'success');
            }
        });
    };

    const handleBulkTag = async () => {
        if (selectedIds.size === 0) return;
        setBulkTagName('');
        setBulkTagModalOpen(true);
    };

    const confirmBulkTag = async () => {
        if (!bulkTagName.trim()) return;
        const tagName = bulkTagName.trim().toUpperCase().replace(/\s+/g, '_');
        const idsToTag = Array.from(selectedIds);

        setBulkTagModalOpen(false);
        setLoading(true);
        try {
            const res = await api.post<any>('bulk_operations', {
                type: 'tag_add',
                tag: tagName,
                subscriberIds: idsToTag
            });

            if (res.success) {
                setSelectedIds(new Set());
                fetchSubscribers(pagination.page);
                const tagRes = await api.get<{ id: string, name: string }[]>('tags');
                if (tagRes.success) setTags(Array.isArray(tagRes.data) ? tagRes.data : ((tagRes.data as any)?.data || []));

                toast((t) => (
                    <UndoToastContent
                        t={t}
                        icon={Tag}
                        iconColorClass="bg-orange-100 text-orange-600"
                        title={`Đã gắn nhãn #${tagName}`}
                        subtitle={`Cho ${res.data.affected} liên hệ`}
                        durationMs={6000}
                        onUndo={async () => {
                            toast.dismiss(t.id);
                            setLoading(true);
                            const undoRes = await api.post<any>('bulk_operations', {
                                type: 'tag_remove',
                                tag: tagName,
                                subscriberIds: idsToTag
                            });
                            if (undoRes.success) {
                                fetchSubscribers(pagination.page);
                                const tagRes = await api.get<{ id: string, name: string }[]>('tags');
                                if (tagRes.success) setTags(Array.isArray(tagRes.data) ? tagRes.data : ((tagRes.data as any)?.data || []));
                                toast.success('Đã hoàn tác gắn nhãn', { icon: '↩️' });
                            }
                            setLoading(false);
                        }}
                    />
                ), { duration: 6000, position: 'bottom-center' });
            } else {
                showToast(res.message || 'Lỗi khi gắn tag', 'error');
            }
        } catch (e) {
            showToast('Lỗi hệ thống khi gắn tag', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBulkAddToList = async (listId: string, isNew = false, newListName = '') => {
        setLoading(true);
        try {
            let targetListId = listId;

            if (isNew && newListName) {
                const lRes = await api.post<any>('lists', {
                    name: newListName,
                    count: 0,
                    source: 'Bulk Action',
                    created: new Date().toLocaleDateString('vi-VN')
                });
                if (lRes.success) {
                    targetListId = lRes.data.id;
                } else {
                    showToast('Lỗi khi tạo danh sách mới', 'error');
                    setLoading(false);
                    return;
                }
            }

            if (!targetListId) {
                showToast('Chưa chọn danh sách', 'error');
                setLoading(false);
                return;
            }

            const res = await api.post<any>('bulk_operations', {
                type: 'list_add',
                listId: targetListId,
                subscriberIds: Array.from(selectedIds)
            });

            if (res.success) {
                showToast(`Đã thêm ${res.data.affected} liên hệ vào danh sách`, 'success');
                setSelectedIds(new Set());
                setIsBulkListModalOpen(false);

                // Refresh data
                fetchSubscribers(pagination.page);
                const listRes = await api.get<any[]>('lists');
                if (listRes.success) {
                    const listData = Array.isArray(listRes.data) ? listRes.data : ((listRes.data as any)?.data || []);
                    setAllStaticLists(listData);
                    setStaticLists(listData);
                }
            } else {
                showToast(res.message || 'Lỗi khi thêm vào danh sách', 'error');
            }
        } catch (e) {
            showToast('Lỗi hệ thống khi thực hiện thao tác', 'error');
        } finally {
            setLoading(false);
        }
    };

    const hasActiveContactFilters =
        Boolean(debouncedSearch) ||
        filterStatus !== 'all' ||
        filterTags.length > 0 ||
        filterVerify !== 'all' ||
        filterHasChat !== 'all' ||
        Boolean(filterSalesperson) ||
        Boolean(filterCustomAttrKey);

    const handleClearAllContactFilters = () => {
        setSearchTerm('');
        setDebouncedSearch('');
        setFilterStatus('all');
        setFilterTags([]);
        setFilterVerify('all');
        setFilterHasChat('all');
        setFilterSalesperson('');
        setFilterCustomAttrKey('');
        setFilterCustomAttrValue('');
        handleClearSelection();
    };

    const filteredIntegrations = debouncedSearch
        ? integrations.filter((item: any) =>
            (item.name || '').toLowerCase().includes(debouncedSearch.toLowerCase()) ||
            (item.provider || '').toLowerCase().includes(debouncedSearch.toLowerCase())
        )
        : integrations;

    return (
        <>
            <div className="w-full flex flex-col gap-5 pb-12 min-w-0">
                <PageHero
                    title="Tệp khách hàng & Phân khúc"
                    subtitle="Quản lý vòng đời khách hàng từ lúc đăng ký đến lúc chuyển đổi đa kênh."
                    actions={[
                        {
                            label: 'Kết nối đồng bộ',
                            icon: RefreshCw,
                            onClick: () => setIsIntegrationsModalOpen(true),
                            primary: false
                        },
                        {
                            label: 'Import liên hệ',
                            icon: UserPlus,
                            onClick: () => setImportModalOpen(true),
                            primary: true
                        }
                    ]}
                />

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Tổng liên hệ"
                        value={stats.total.toLocaleString()}
                        icon={<Users className="w-4 h-4" />}
                        color="#334155"
                        loading={loading && subscribers.length === 0}
                        breakdown={
                            <>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-600" />Customer: {(stats.customer || 0).toLocaleString()}</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Lead: {(stats.lead || 0).toLocaleString()}</span>
                            </>
                        }
                    />
                    <StatCard
                        title="Đang hoạt động"
                        value={(stats.active || 0).toLocaleString()}
                        icon={<ShieldCheck className="w-4 h-4" />}
                        color="#0f172a"
                        loading={loading && subscribers.length === 0}
                        breakdown={
                            <>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-600" />Active: {(stats.active || 0).toLocaleString()}</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Tổng: {stats.total.toLocaleString()}</span>
                            </>
                        }
                    />
                    <StatCard
                        title="Độ phủ tiếp cận"
                        value={((stats.email_reach || 0) + (stats.zalo_reach || 0)).toLocaleString()}
                        icon={<Zap className="w-4 h-4" />}
                        color="#C6333D"
                        loading={loading && subscribers.length === 0}
                        breakdown={
                            <>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#C6333D]" />Email: {(stats.email_reach || 0).toLocaleString()}</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-[#0f172a]" />Zalo/SĐT: {(stats.zalo_reach || 0).toLocaleString()}</span>
                            </>
                        }
                    />
                    <StatCard
                        title="Hủy đăng ký"
                        value={(stats.unsubscribed || 0).toLocaleString()}
                        icon={<UserMinus className="w-4 h-4" />}
                        color="#64748b"
                        loading={loading && subscribers.length === 0}
                        breakdown={
                            <>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Unsubscribed: {(stats.unsubscribed || 0).toLocaleString()}</span>
                            </>
                        }
                    />
                </div>

                <Panel>
                    <div className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
                        <Tabs
                            activeId={activeTab}
                            onChange={(tab) => {
                                setActiveTab(tab);
                                handleClearSelection();
                            }}
                            variant="segmented"
                            items={[
                                { id: 'contacts', label: 'Tất cả liên hệ', icon: Users, count: pagination.total || stats.total },
                                { id: 'segments', label: 'Phân khúc', icon: Layers, count: segmentsPagination.total || undefined },
                                { id: 'lists', label: 'Danh sách tĩnh', icon: List, count: allStaticLists.filter(isManualList).length || undefined },
                                { id: 'meta', label: 'Meta Audience', icon: Facebook },
                                { id: 'zalo', label: 'Zalo Audience', icon: MessageCircle },
                                { id: 'integrations', label: 'Kết nối đồng bộ', icon: Zap, count: integrations.length || undefined },
                            ]}
                        />
                    </div>

                    {activeTab !== 'meta' && activeTab !== 'zalo' && (
                        <Toolbar>
                            <SearchBox
                                value={searchTerm}
                                onChange={setSearchTerm}
                                placeholder="Tìm theo tên, SĐT, email..."
                                className="w-64"
                            />
                            {activeTab === 'contacts' && (
                                <>
                                    <AdvancedFilters
                                        filterStatus={filterStatus}
                                        filterTags={filterTags}
                                        filterVerify={filterVerify}
                                        filterHasChat={filterHasChat}
                                        filterSalesperson={filterSalesperson}
                                        filterCustomAttrKey={filterCustomAttrKey}
                                        filterCustomAttrValue={filterCustomAttrValue}
                                        onStatusChange={setFilterStatus}
                                        onTagsChange={setFilterTags}
                                        onVerifyChange={setFilterVerify}
                                        onHasChatChange={setFilterHasChat}
                                        onSalespersonChange={setFilterSalesperson}
                                        onCustomAttrChange={(key, value) => {
                                            setFilterCustomAttrKey(key);
                                            setFilterCustomAttrValue(value);
                                            setPagination(prev => ({ ...prev, page: 1 }));
                                        }}
                                        tags={tags}
                                        customAttrKeys={customAttrKeys}
                                        onOpen={ensureTagsAndCustomKeysLoaded}
                                    />
                                    <div className="w-44">
                                        <Select
                                            size="sm"
                                            variant="outline"
                                            icon={TrendingUp}
                                            value={sortBy}
                                            onChange={(val) => {
                                                setSortBy(val);
                                                if (val === 'birthday_custom') setIsDateRangeModalOpen(true);
                                            }}
                                            options={[
                                                { value: 'newest', label: 'Mới nhất' },
                                                { value: 'score', label: 'Điểm cao nhất' },
                                                { value: 'recent_activity', label: 'Tương tác gần đây' },
                                                { value: 'unlisted', label: 'Chưa vào danh sách' },
                                                { value: 'birthday_today', label: 'Sinh nhật hôm nay' },
                                                { value: 'birthday_month', label: 'Sinh nhật tháng này' },
                                                { value: 'birthday_custom', label: 'Tùy chọn khoảng sinh nhật...' }
                                            ]}
                                        />
                                    </div>
                                    {sortBy === 'recent_activity' && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs font-medium text-[var(--color-text-light)]">Trong</span>
                                            <input
                                                type="number"
                                                min="1"
                                                max="365"
                                                value={recentDays}
                                                onChange={(e) => setRecentDays(parseInt(e.target.value) || 7)}
                                                className="w-14 h-9 px-2 border border-[var(--color-border)] bg-[var(--color-surface)] rounded-[var(--radius-md)] text-xs font-semibold text-[var(--color-text)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15 outline-none transition-all"
                                            />
                                            <span className="text-xs font-medium text-[var(--color-text-light)]">ngày</span>
                                        </div>
                                    )}
                                    <div className="ml-auto flex items-center gap-2">
                                        <ColumnCustomizer
                                            columns={COLUMN_DEFINITIONS}
                                            visibleColumns={visibleColumns}
                                            onChange={setVisibleColumns}
                                        />
                                        <div className="h-9 px-3 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] text-xs text-[var(--color-text-light)] font-medium shrink-0">
                                            Tổng cộng: <span className="font-bold text-[var(--color-text)] tabular-nums">{(pagination.total || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                            {activeTab === 'segments' && (
                                <div className="ml-auto flex items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon={RefreshCw}
                                        onClick={adminGuard(async () => {
                                            setLoading(true);
                                            const res = await api.post('segments?route=sync', {});
                                            if (res.success) {
                                                await Promise.all([ensureAllSegmentsLoaded(true), fetchSegments(segmentsPagination.page)]);
                                                showToast('Đã đồng bộ lại dữ liệu phân khúc', 'success');
                                            }
                                            setLoading(false);
                                        }, 'đồng bộ phân khúc')}
                                    >
                                        Làm mới
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={adminGuard(() => { setEditingSegment(null); setSegmentBuilderOpen(true); }, 'tạo phân khúc')}
                                    >
                                        Tạo phân khúc
                                    </Button>
                                </div>
                            )}
                            {activeTab === 'lists' && (
                                <div className="ml-auto flex items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon={UserPlus}
                                        onClick={() => setImportModalOpen(true)}
                                    >
                                        Import liên hệ
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={adminGuard(() => setIsCreateListModalOpen(true), 'tạo danh sách')}
                                    >
                                        Tạo danh sách
                                    </Button>
                                </div>
                            )}
                            {activeTab === 'integrations' && (
                                <div className="ml-auto flex items-center gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon={RefreshCw}
                                        onClick={() => fetchIntegrations()}
                                    >
                                        Làm mới
                                    </Button>
                                    <Button
                                        size="sm"
                                        icon={Plus}
                                        onClick={() => setIsIntegrationsModalOpen(true)}
                                    >
                                        Thêm kết nối
                                    </Button>
                                </div>
                            )}
                        </Toolbar>
                    )}

                    {activeTab === 'contacts' && (
                        <FilterPills
                            filters={{
                                status: filterStatus,
                                tags: filterTags,
                                verify: filterVerify,
                                hasChat: filterHasChat,
                                salesperson: filterSalesperson
                            }}
                            onRemove={(key, value) => {
                                if (key === 'status') setFilterStatus('all');
                                else if (key === 'tags') setFilterTags(prev => prev.filter(t => t !== value));
                                else if (key === 'verify') setFilterVerify('all');
                                else if (key === 'hasChat') setFilterHasChat('all');
                                else if (key === 'salesperson') setFilterSalesperson('');
                            }}
                            onClearAll={() => {
                                setFilterStatus('all');
                                setFilterTags([]);
                                setFilterVerify('all');
                                setFilterHasChat('all');
                                setFilterSalesperson('');
                            }}
                            tags={tags}
                        />
                    )}

                    <div>
                        {activeTab === 'lists' && (
                            <TabTransition>
                                <ListsTab
                                    loading={loading}
                                    lists={staticLists.filter(isManualList)}
                                    currentPage={listsPagination.page}
                                    totalPages={listsPagination.totalPages}
                                    totalCount={listsPagination.total}
                                    itemsPerPage={listsPagination.limit}
                                    onPageChange={(p) => setListsPagination(prev => ({ ...prev, page: p }))}
                                    onView={(list) => setViewingGroup({ id: list.id, name: list.name, type: 'list', count: list.count })}
                                    onEdit={adminGuard(setEditingList, 'sửa danh sách')}
                                    onCreate={adminGuard(() => setIsCreateListModalOpen(true), 'tạo danh sách')}
                                    onDelete={adminGuard(async (id) => {
                                        const list = staticLists.find(l => l.id === id);
                                        const checkRes = await api.get<{ id: string; name: string }[]>(`forms?list_id=${id}`);
                                        const linkedForms = (checkRes.success && Array.isArray(checkRes.data)) ? checkRes.data : [];

                                        if (linkedForms.length > 0) {
                                            setFormProtectionModal({ isOpen: true, listName: list?.name || id, linkedForms });
                                            return;
                                        }

                                        setConfirmModal({
                                            isOpen: true,
                                            title: 'Xóa danh sách?',
                                            message: 'Gỡ toàn bộ Khách hàng khỏi danh sách này.',
                                            variant: 'danger',
                                            onConfirm: async () => {
                                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                const res = await api.delete(`lists/${id}`);
                                                if (res.success) {
                                                    fetchLists(listsPagination.page);
                                                    ensureAllListsLoaded(true);
                                                    showToast('Đã xóa danh sách thành công', 'success');
                                                } else {
                                                    showToast(res.message, 'error');
                                                    if (res.message && res.message.includes('đang được sử dụng trong Flow')) {
                                                        setTimeout(() => {
                                                            setConfirmModal({
                                                                isOpen: true,
                                                                title: 'Xác nhận xóa cưỡng chế',
                                                                message: (
                                                                    <div className="space-y-3">
                                                                        <p className="text-sm text-slate-600 dark:text-slate-300 font-bold">{res.message}</p>
                                                                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-600 font-medium leading-relaxed">
                                                                            ⚠️ Cảnh báo: Việc xóa này có thể khiến các Automation Flow đang chạy gặp lỗi. Bạn vẫn muốn tiếp tục xóa cưỡng chế danh sách này?
                                                                        </div>
                                                                    </div>
                                                                ),
                                                                variant: 'danger',
                                                                requireConfirmText: 'FORCE DELETE',
                                                                onConfirm: async () => {
                                                                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                                    const forceRes = await api.delete(`lists/${id}?force=1`);
                                                                    if (forceRes.success) {
                                                                        fetchLists(listsPagination.page);
                                                                        ensureAllListsLoaded(true);
                                                                        showToast('Đã xóa danh sách thành công (Cưỡng chế)', 'success');
                                                                    } else {
                                                                        showToast(forceRes.message || 'Lỗi khi xóa cưỡng chế', 'error');
                                                                    }
                                                                }
                                                            });
                                                        }, 300);
                                                    }
                                                }
                                            }
                                        });
                                    }, 'xóa danh sách')}
                                    onBulkDelete={adminGuard(handleBulkDeleteLists, 'xóa danh sách')}
                                    onMerge={adminGuard((listIds) => {
                                        const lists = staticLists.filter(l => listIds.includes(l.id));
                                        setMergingLists(lists);
                                        setIsMergeModalOpen(true);
                                    }, 'gộp danh sách')}
                                    onCleanup={adminGuard((list) => setCleanupTarget({ id: list.id, name: list.name, type: 'list' }), 'dọn rác danh sách')}
                                    onSplit={adminGuard((list) => { setSplittingTarget({ id: list.id, name: list.name, type: 'list', count: list.count }); setSplitSelectedIds([]); }, 'tách danh sách')}
                                    onExport={exportListContacts}
                                    onBulkExport={exportMultipleListsContacts}
                                />
                            </TabTransition>
                        )}
                        {activeTab === 'segments' && (
                            <TabTransition>
                                <SegmentsTab
                                    loading={loading}
                                    segments={(Array.isArray(segments) ? segments : []).map((seg: any) => ({
                                        ...seg,
                                        rawCriteria: seg.rawCriteria ?? seg.criteria,
                                        criteria: formatSegmentCriteriaDisplay(seg)
                                    }))}
                                    currentPage={segmentsPagination.page}
                                    totalPages={segmentsPagination.totalPages}
                                    totalCount={segmentsPagination.total}
                                    itemsPerPage={segmentsPagination.limit}
                                    onPageChange={(p) => setSegmentsPagination(prev => ({ ...prev, page: p }))}
                                    onView={(seg) => setViewingGroup({ id: seg.id, name: seg.name, type: 'segment', count: seg.count })}
                                    onEdit={adminGuard((seg: any) => { setEditingSegment({ ...seg, criteria: seg.rawCriteria ?? seg.criteria }); setSegmentBuilderOpen(true); }, 'sửa phân khúc')}
                                    onCreate={adminGuard(() => { setEditingSegment(null); setSegmentBuilderOpen(true); }, 'tạo phân khúc')}
                                    onDelete={adminGuard((id) => setConfirmModal({
                                        isOpen: true, title: 'Xóa phân khúc?', message: 'Dữ liệu phân khúc động sẽ bị xóa.', variant: 'danger', onConfirm: async () => {
                                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                            await api.delete(`segments/${id}`);
                                            fetchSegments(segmentsPagination.page);
                                            ensureAllSegmentsLoaded(true);
                                            showToast('Đã xóa phân khúc thành công', 'success');
                                        }
                                    }), 'xóa phân khúc')}
                                    onBulkDelete={adminGuard(handleBulkDeleteSegments, 'xóa phân khúc')}
                                    onSplit={adminGuard((seg) => { setSplittingTarget({ id: seg.id, name: seg.name, type: 'segment', count: seg.count }); setSplitSelectedIds([]); }, 'tách phân khúc')}
                                    onRefresh={fetchInitialData}
                                    onCleanup={adminGuard((seg) => setCleanupTarget({ id: seg.id, name: seg.name, type: 'segment' }), 'dọn rác phân khúc')}
                                />
                            </TabTransition>
                        )}
                        {activeTab === 'contacts' && (
                            <TabTransition>
                                <ContactsTab
                                    loading={loading}
                                    hasActiveFilters={hasActiveContactFilters}
                                    onClearFilters={handleClearAllContactFilters}
                                    onImport={() => setImportModalOpen(true)}
                                    subscribers={subscribers}
                                    selectedIds={selectedIds}
                                    onToggleSelection={handleToggleSelection}
                                    onToggleSelectAll={handleToggleSelectAll}
                                    onClearSelection={handleClearSelection}
                                    onSelectSubscriber={handleSelectSubscriber}
                                    formatRelativeTime={formatRelativeTime}
                                    currentPage={pagination.page}
                                    totalPages={pagination.totalPages}
                                    totalCount={pagination.total}
                                    onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))}
                                    onBulkDelete={handleBulkDelete}
                                    onBulkTag={handleBulkTag}
                                    onBulkAddToList={() => setIsBulkListModalOpen(true)}
                                    isGlobalSelected={isGlobalSelected}
                                    onToggleGlobalSelection={setIsGlobalSelected}
                                    visibleColumns={visibleColumns}
                                    itemsPerPage={itemsPerPage}
                                    onItemsPerPageChange={(newValue) => {
                                        setItemsPerPage(newValue);
                                        setPagination(prev => ({ ...prev, page: 1, limit: newValue }));
                                    }}
                                />
                            </TabTransition>
                        )}
                        {activeTab === 'integrations' && (
                            <TabTransition>
                                <IntegrationsTab
                                    integrations={filteredIntegrations}
                                    lists={allStaticLists}
                                    onConnect={() => setIsIntegrationsModalOpen(true)}
                                    onEdit={adminGuard((item) => {
                                        setEditingIntegration(item);
                                        setIsIntegrationsModalOpen(true);
                                    }, 'sửa cấu hình')}
                                    onView={(item) => {
                                        const config = JSON.parse(item.config || '{}');
                                        if (config.targetListId) {
                                            const targetList = allStaticLists.find(l => l.id == config.targetListId);
                                            if (targetList) {
                                                setViewingGroup({ id: targetList.id, name: targetList.name, type: 'list', count: targetList.count });
                                            } else {
                                                showToast('Không tìm thấy danh sách đích (có thể đã bị xóa)', 'error');
                                            }
                                        } else {
                                            showToast('Kết nối này chưa được cấu hình danh sách đích', 'error');
                                        }
                                    }}
                                    onCleanup={adminGuard((item) => {
                                        const config = JSON.parse(item.config || '{}');
                                        if (config.targetListId) {
                                            const targetList = allStaticLists.find(l => l.id == config.targetListId);
                                            if (targetList) {
                                                setCleanupTarget({ id: targetList.id, name: targetList.name, type: 'list' });
                                            }
                                        }
                                    }, 'dọn rác kết nối')}
                                    onSplit={adminGuard((item) => {
                                        const config = JSON.parse(item.config || '{}');
                                        if (config.targetListId) {
                                            const targetList = allStaticLists.find(l => l.id == config.targetListId);
                                            if (targetList) {
                                                setSplittingTarget({ id: targetList.id, name: targetList.name, type: 'list', count: targetList.count });
                                                setSplitSelectedIds([]);
                                            }
                                        }
                                    }, 'tách danh sách kết nối')}
                                    onDelete={adminGuard((id) => {
                                        const integration = integrations.find(i => i.id === id);
                                        const config = integration ? JSON.parse(integration.config || '{}') : {};
                                        const targetListId = config.targetListId;
                                        const targetList = targetListId ? allStaticLists.find(l => l.id === targetListId) : null;

                                        setConfirmModal({
                                            isOpen: true,
                                            title: 'Xóa kết nối đồng bộ?',
                                            message: targetList
                                                ? `Kết nối sẽ bị xóa và danh sách "${targetList.name}" (${targetList.count} liên hệ) cũng sẽ bị xóa. Bạn có chắc chắn?`
                                                : 'Kết nối sẽ bị xóa. Dữ liệu đã tải về sẽ KHÔNG bị xóa.',
                                            variant: 'danger',
                                            onConfirm: async () => {
                                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                if (targetListId) {
                                                    await api.delete(`lists/${targetListId}`);
                                                }
                                                await api.delete(`integrations?id=${id}`);
                                                fetchIntegrations();
                                                ensureAllListsLoaded(true);
                                                showToast(
                                                    targetList
                                                        ? `Đã xóa kết nối và danh sách "${targetList.name}"`
                                                        : 'Đã xóa kết nối',
                                                    'success'
                                                );
                                            }
                                        });
                                    }, 'xóa kết nối')}
                                    onSyncNow={adminGuard(async (id) => {
                                        setConfirmModal({
                                            isOpen: true,
                                            title: 'Đồng bộ ngay',
                                            message: 'Bắt đầu quá trình đồng bộ dữ liệu từ nguồn bên ngoài. Việc này có thể mất vài phút tùy vào lượng dữ liệu.',
                                            variant: 'warning',
                                            onConfirm: async () => {
                                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                setIntegrations(prev => prev.map(i =>
                                                    i.id === id ? { ...i, sync_status: 'syncing' } : i
                                                ));

                                                showToast('Đang tiến hành đồng bộ...', 'info');
                                                try {
                                                    const res = await api.post(`integrations?route=sync_now&id=${id}`, {});
                                                    
                                                    if (res.success) {
                                                        showToast('Đồng bộ thành công!', 'success');
                                                        fetchIntegrations(true);
                                                        await Promise.all([
                                                            ensureAllListsLoaded(true),
                                                            fetchGlobalStats(),
                                                        ]);
                                                    } else {
                                                        showToast(res.message || 'Lỗi khi đồng bộ.', 'error');
                                                        fetchIntegrations(true);
                                                    }
                                                } catch (e) {
                                                    showToast('Lỗi khi kết nối máy chủ đồng bộ.', 'error');
                                                    setIntegrations(prev => prev.map(i =>
                                                        i.id === id ? { ...i, sync_status: 'idle' } : i
                                                    ));
                                                }
                                            }
                                        });
                                    }, 'đồng bộ kết nối')}
                                />
                            </TabTransition>
                        )}
                        {activeTab === 'meta' && <TabTransition className="p-4"><MetaCustomers /></TabTransition>}
                        {activeTab === 'zalo' && <TabTransition className="p-4"><ZaloAudienceTab /></TabTransition>}
                    </div>
                </Panel>
            </div>

            {isSegmentBuilderOpen && (
                <React.Suspense fallback={null}>
                    <SegmentBuilderModal
                        isOpen={isSegmentBuilderOpen}
                        onClose={() => setSegmentBuilderOpen(false)}
                        onSave={async (seg) => {
                            const isNew = !seg.id;
                            const res = isNew ? await api.post<Segment>('segments', seg) : await api.put<Segment>(`segments/${seg.id}`, seg);
                            if (res.success) {
                                await ensureAllSegmentsLoaded(true);
                                if (isNew) {
                                    setSegmentsPagination(prev => ({ ...prev, page: 1 }));
                                    fetchSegments(1);
                                } else {
                                    fetchSegments(segmentsPagination.page);
                                }
                                showToast('Đã lưu phân khúc động', 'success');
                            }
                        }}
                        initialSegment={editingSegment}
                        subscribers={[]}
                    />
                </React.Suspense>
            )}

            {(isCreateListModalOpen || !!editingList) && (
                <React.Suspense fallback={null}>
                    <ListFormModal
                        isOpen={isCreateListModalOpen || !!editingList}
                        onClose={() => { setIsCreateListModalOpen(false); setEditingList(null); }}
                        list={editingList}
                        onSave={async (d: any, isNew) => {
                            setLoading(true);
                            try {
                                let res: any;
                                if (isNew) {
                                    if (d.auto_populate && d.criteria) {
                                        const payload = {
                                            ...d,
                                            criteria: typeof d.criteria === 'string' ? d.criteria : JSON.stringify(d.criteria),
                                            auto_populate: true,
                                            include_crm_contacts: true,
                                            source: d.source || 'CRM Deep Filter',
                                            created: new Date().toLocaleDateString('vi-VN')
                                        };
                                        res = await api.post('lists?route=create_with_filter', payload);
                                        if (!res?.success) {
                                            res = await api.post('lists', payload);
                                        }
                                        if (res?.success) {
                                            const addedCnt = res.data?.populated_count ?? res.data?.added_count ?? res.data?.count;
                                            showToast(
                                                addedCnt !== undefined
                                                    ? `Đã tạo danh sách tĩnh và nạp ${Number(addedCnt).toLocaleString('vi-VN')} khách hàng`
                                                    : 'Đã tạo danh sách tĩnh theo bộ lọc MYERP',
                                                'success'
                                            );
                                        }
                                    } else {
                                        res = await api.post('lists', { ...d, count: 0, source: d.source || 'Manual', created: new Date().toLocaleDateString('vi-VN') });
                                        if (res.success) showToast('Đã tạo danh sách tĩnh', 'success');
                                    }
                                } else {
                                    res = await api.put(`lists/${editingList.id}`, { ...editingList, ...d });
                                    if (res.success) showToast('Đã cập nhật danh sách', 'success');
                                }
                                if (res?.success) {
                                    await ensureAllListsLoaded(true);
                                    fetchLists(isNew ? 1 : listsPagination.page);
                                    setIsCreateListModalOpen(false);
                                    setEditingList(null);
                                } else {
                                    showToast(res?.message || 'Lỗi khi lưu danh sách', 'error');
                                }
                            } catch (error) {
                                showToast('Đã xảy ra lỗi hệ thống khi lưu danh sách', 'error');
                            } finally {
                                setLoading(false);
                            }
                        }}
                        isNew={isCreateListModalOpen}
                    />
                </React.Suspense>
            )}

            {isImportModalOpen && (
                <React.Suspense fallback={null}>
                    <ImportSubscribersModal
                        isOpen={isImportModalOpen}
                        onClose={() => setImportModalOpen(false)}
                        existingLists={allStaticLists}
                        existingEmails={new Set(subscribers.map(s => s.email).filter(Boolean))}
                        existingPhones={new Set(subscribers.map(s => s.phoneNumber).filter(Boolean) as string[])}
                        onImport={async (d) => {
                            const { subscribers: newSubs, targetListId, newListName } = d;
                            let finalListId = targetListId;
                            try {
                                if (newListName) {
                                    const lRes = await api.post<any>('lists', {
                                        name: newListName,
                                        count: 0,
                                        source: 'Import CSV',
                                        created: new Date().toLocaleDateString('vi-VN')
                                    });
                                    if (lRes.success) finalListId = lRes.data.id;
                                }

                                if (newSubs.length > 0) {
                                    const STANDARD_KEYS = [
                                        'email', 'firstName', 'lastName', 'phoneNumber', 'jobTitle',
                                        'companyName', 'city', 'country', 'gender', 'dateOfBirth',
                                        'anniversaryDate', 'tags', 'source', 'salesperson', 'joinedAt'
                                    ];

                                    const subsPayload = newSubs.map((s: any) => {
                                        const customAttr: Record<string, any> = {};
                                        Object.keys(s).forEach(key => {
                                            if (!STANDARD_KEYS.includes(key)) {
                                                customAttr[key] = s[key];
                                            }
                                        });

                                        return {
                                            ...s,
                                            listIds: finalListId ? [finalListId] : [],
                                            tags: s.tags ? s.tags.split(',').map((t: string) => t.trim().toUpperCase().replace(/\s+/g, '_')) : [],
                                            joinedAt: new Date().toISOString(),
                                            status: 'active',
                                            source: s.source || 'Import CSV',
                                            stats: { emailsSent: 0, emailsOpened: 0, linksClicked: 0 },
                                            customAttributes: customAttr
                                        };
                                    });

                                    await api.post('bulk_operations', { 
                                        type: 'import', 
                                        subscribers: subsPayload,
                                        createVirtualEmail: d.createVirtualEmail
                                    });
                                    showToast(`Đã import thành công ${newSubs.length} liên hệ!`, 'success');

                                    await Promise.all([
                                        fetchSubscribers(1),
                                        fetchInitialData()
                                    ]);
                                }
                            } catch (error) {
                                showToast('Lỗi khi import dữ liệu', 'error');
                            }
                        }}
                    />
                </React.Suspense>
            )}

            {isIntegrationsModalOpen && (
                <React.Suspense fallback={null}>
                    <IntegrationsModal
                        isOpen={isIntegrationsModalOpen}
                        onClose={() => {
                            setIsIntegrationsModalOpen(false);
                            setEditingIntegration(null);
                            if (activeTab === 'integrations') fetchIntegrations();
                        }}
                        editingIntegration={editingIntegration}
                    />
                </React.Suspense>
            )}

            {viewingGroup && (
                <React.Suspense fallback={null}>
                    <GroupDetailModal
                        isOpen={!!viewingGroup}
                        onClose={() => setViewingGroup(null)}
                        group={viewingGroup}
                        members={groupMembers}
                        totalCount={groupPagination.total}
                        currentPage={groupPagination.page}
                        totalPages={groupPagination.totalPages}
                        loading={groupLoading}
                        onPageChange={(p) => viewingGroup && setGroupPagination(prev => ({ ...prev, page: p }))}
                        onSearch={(term) => { setGroupSearch(term); setGroupPagination(prev => ({ ...prev, page: 1 })) }}
                        onStatusFilter={(status) => { setGroupStatus(status); setGroupPagination(prev => ({ ...prev, page: 1 })) }}
                        activeStatusFilter={groupStatus}
                        onCleanup={async (id) => {
                            if (!viewingGroup) return;
                            setLoading(true);
                            try {
                                const res = await api.post<any>('lists?route=cleanup', {
                                    targetId: id,
                                    targetType: viewingGroup.type,
                                    cleanupType: 'junk',
                                    statuses: ['unsubscribed', 'error', 'bounced', 'complained'],
                                    action: 'remove'
                                });
                                if (res.success) {
                                    showToast(res.message || 'Đã dọn dẹp thành công', 'success');
                                    fetchInitialData();
                                    if (viewingGroup) fetchGroupMembers(viewingGroup, 1, groupSearch);
                                } else {
                                    showToast(res.message || 'Lỗi khi dọn dẹp', 'error');
                                }
                            } catch (error) {
                                showToast('Đã xảy ra lỗi hệ thống khi dọn dẹp', 'error');
                            } finally {
                                setLoading(false);
                            }
                        }}
                        onRemoveFromList={(ids, opts) => {
                            if (viewingGroup?.type === 'list') {
                                handleRemoveFromList(ids, viewingGroup.id, opts);
                            }
                        }}
                        onRemoveFromTag={async (ids, opts) => {
                            setLoading(true);
                            try {
                                let payload: any = { type: 'tag_remove', tag: viewingGroup.name };
                                if (opts) {
                                    payload.targetType = opts.targetType;
                                    payload.targetId = opts.targetId;
                                } else {
                                    payload.subscriberIds = ids;
                                }
                                const res = await api.post<any>('bulk_operations', payload);
                                if (res.success) {
                                    fetchSubscribers(pagination.page);
                                    if (viewingGroup) fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);
                                    showToast(`Đã gỡ nhãn khỏi ${res.data.affected} Khách hàng`, 'success');
                                } else {
                                    showToast(res.message || 'Lỗi khi gỡ nhãn', 'error');
                                }
                            } catch (error) {
                                showToast('Đã xảy ra lỗi hệ thống khi gỡ nhãn', 'error');
                            } finally {
                                setLoading(false);
                            }
                        }}
                        onExcludeFromSegment={async (ids, segmentId) => {
                            setLoading(true);
                            try {
                                const res = await api.post<{ count: number }>('segments?route=exclude', { segment_id: segmentId, subscriber_ids: ids });
                                if (res.success) {
                                    fetchSubscribers(pagination.page);
                                    if (viewingGroup) fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);
                                    showToast(`Đã gỡ vĩnh viễn ${res.data?.count || 0} Khách hàng khỏi phân khúc`, 'success');
                                } else {
                                    showToast(res.message || 'Lỗi khi gỡ khỏi phân khúc', 'error');
                                }
                            } catch (error) {
                                showToast('Đã xảy ra lỗi hệ thống khi gỡ khỏi phân khúc', 'error');
                            } finally {
                                setLoading(false);
                            }
                        }}
                        onSplit={(ids, group) => {
                            setSplittingTarget({ id: group.id, name: group.name, type: (group as any).criteria ? 'segment' : 'list', count: (group as any).count || 0 });
                            setSplitSelectedIds(ids);
                        }}
                        onViewProfile={handleSelectSubscriber}
                    />
                </React.Suspense>
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant || 'danger'}
                requireConfirmText={confirmModal.requireConfirmText}
                isLoading={confirmModal.isLoading}
            />

            <ConfirmModal
                isOpen={bulkTagModalOpen}
                onClose={() => setBulkTagModalOpen(false)}
                onConfirm={confirmBulkTag}
                title="Gắn nhãn hàng loạt"
                confirmLabel="Xác nhận gắn nhãn"
                message={
                    <div className="space-y-4">
                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-start gap-3">
                            <Tag className="w-5 h-5 text-emerald-600 mt-0.5" />
                            <div>
                                <h4 className="text-sm font-bold text-emerald-800">Gắn tag cho {selectedIds.size} liên hệ</h4>
                                <p className="text-xs text-emerald-600/80 mt-1">Các liên hệ đã chọn sẽ được bổ sung nhãn mới này.</p>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên nhãn muốn gắn</label>
                            <input
                                placeholder="VD: KHACH_QUEN, VIP_2024..."
                                value={bulkTagName}
                                onChange={(e) => setBulkTagName(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/60 rounded-xl text-sm font-black text-slate-800 dark:text-slate-200 uppercase placeholder:text-slate-300 outline-none focus:bg-white dark:bg-slate-900 focus:border-emerald-500 transition-all"
                                autoFocus
                            />
                        </div>
                    </div>
                }
            />

            {splittingTarget && (
                <React.Suspense fallback={null}>
                    <AudienceSplitModal
                        sourceId={splittingTarget.id}
                        sourceName={splittingTarget.name}
                        sourceType={splittingTarget.type}
                        subscriberCount={splittingTarget.count}
                        selectedIds={splitSelectedIds}
                        onClose={() => setSplittingTarget(null)}
                        onRequestSelection={() => {
                            setViewingGroup({
                                id: splittingTarget.id,
                                name: splittingTarget.name,
                                type: splittingTarget.type,
                                count: splittingTarget.count
                            });
                            setSplittingTarget(null);
                        }}
                        onSuccess={() => {
                            fetchInitialData();
                            if (activeTab === 'lists') {
                                setListsPagination(prev => ({ ...prev, page: 1 }));
                                fetchLists(1);
                            }
                            if (activeTab === 'segments') {
                                setSegmentsPagination(prev => ({ ...prev, page: 1 }));
                                fetchSegments(1);
                            }

                            if (viewingGroup && viewingGroup.id === splittingTarget.id) {
                                fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);
                            }
                        }}
                    />
                </React.Suspense>
            )}

            {isMergeModalOpen && (
                <React.Suspense fallback={null}>
                    <ListMergeModal
                        lists={mergingLists}
                        onClose={() => {
                            setIsMergeModalOpen(false);
                            setMergingLists([]);
                        }}
                        onSuccess={() => {
                            fetchLists(listsPagination.page);
                            ensureAllListsLoaded(true);
                        }}
                    />
                </React.Suspense>
            )}

            {cleanupTarget && (
                <React.Suspense fallback={null}>
                    <CleanupModal
                        target={cleanupTarget}
                        onClose={() => setCleanupTarget(null)}
                        onSuccess={() => {
                            fetchInitialData();
                            if (activeTab === 'lists') fetchLists(listsPagination.page);
                            if (activeTab === 'segments') fetchSegments(segmentsPagination.page);
                        }}
                    />
                </React.Suspense>
            )}

            {isDateRangeModalOpen && createPortal(
                <div className="fixed inset-0 z-[110000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[var(--color-surface)] rounded-[18px] border border-[var(--color-border)] w-full max-w-sm shadow-xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-[var(--color-text)]">Chọn khoảng thời gian</h3>
                            <button onClick={() => setIsDateRangeModalOpen(false)} className="p-1 hover:bg-[var(--color-bg)] rounded-full text-[var(--color-text-light)] hover:text-[var(--color-text)] transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-[var(--color-text-light)]">Từ ngày</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                    <input
                                        type="date"
                                        value={dateRange.from}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                                        className="w-full h-9 pl-10 pr-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-xs font-medium text-[var(--color-text)] focus:border-[var(--color-primary)] outline-none transition-all"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-medium text-[var(--color-text-light)]">Đến ngày</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                                    <input
                                        type="date"
                                        value={dateRange.to}
                                        onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                                        className="w-full h-9 pl-10 pr-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-xs font-medium text-[var(--color-text)] focus:border-[var(--color-primary)] outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button variant="secondary" className="flex-1" onClick={() => setIsDateRangeModalOpen(false)}>Hủy</Button>
                            <Button className="flex-1" onClick={() => {
                                setIsDateRangeModalOpen(false);
                                if (!dateRange.from || !dateRange.to) showToast('Vui lòng chọn đầy đủ ngày bắt đầu và kết thúc', 'error');
                            }}>Áp dụng</Button>
                        </div>
                    </div>
                </div>,
                getMktPortalRoot()
            )}

            {isBulkListModalOpen && createPortal(
                <div className="fixed inset-0 z-[110000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-[var(--color-surface)] rounded-[18px] w-full max-w-lg shadow-2xl p-6 space-y-6 animate-in zoom-in-95 duration-200 relative border border-[var(--color-border)]">
                        <button onClick={() => setIsBulkListModalOpen(false)} className="absolute top-5 right-5 p-2 hover:bg-[var(--color-bg)] rounded-lg text-[var(--color-text-light)] hover:text-[var(--color-text)] transition-all">
                            <X className="w-5 h-5" />
                        </button>

                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-[var(--color-text)]">Thêm vào danh sách</h3>
                            <p className="text-xs text-[var(--color-text-light)]">Chọn danh sách có sẵn hoặc tạo danh sách mới cho <span className="text-[var(--color-primary)] font-bold">{selectedIds.size.toLocaleString()}</span> liên hệ đã chọn.</p>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-[var(--color-text-light)]">Chọn danh sách hiện có</label>
                                <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-0.5">
                                    {allStaticLists.filter(isManualList).map(list => (
                                        <button
                                            key={list.id}
                                            onClick={() => handleBulkAddToList(list.id)}
                                            className="flex items-center justify-between p-3 bg-[var(--color-bg)] hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary)]/30 border border-[var(--color-border)] rounded-[var(--radius-md)] transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] flex items-center justify-center">
                                                    <List className="w-4 h-4 text-[var(--color-text-light)] group-hover:text-[var(--color-primary)]" />
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)]">{list.name}</p>
                                                    <p className="text-xs text-[var(--color-text-light)]">{list.count.toLocaleString()} liên hệ</p>
                                                </div>
                                            </div>
                                            <Plus className="w-4 h-4 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-all" />
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="relative">
                                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--color-border)]"></div></div>
                                <div className="relative flex justify-center text-xs font-medium"><span className="bg-[var(--color-surface)] px-3 text-[var(--color-text-light)]">Hoặc tạo mới</span></div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-[var(--color-text-light)]">Tên danh sách mới</label>
                                <div className="flex gap-2">
                                    <input
                                        id="newListNameBulk"
                                        type="text"
                                        placeholder="Ví dụ: Khách hàng VIP 2026..."
                                        className="flex-1 h-9 px-3.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] text-xs font-medium text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] transition-all"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const val = (e.currentTarget as HTMLInputElement).value;
                                                if (val) handleBulkAddToList('', true, val);
                                            }
                                        }}
                                    />
                                    <Button size="sm" onClick={() => {
                                        const el = document.getElementById('newListNameBulk') as HTMLInputElement;
                                        if (el.value) handleBulkAddToList('', true, el.value);
                                        else showToast('Vui lòng nhập tên danh sách', 'error');
                                    }}>Tạo & Thêm</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                getMktPortalRoot()
            )}

            {isTipsModalOpen && (
                <React.Suspense fallback={null}>
                    <AudienceTipsModal
                        isOpen={isTipsModalOpen}
                        onClose={() => setIsTipsModalOpen(false)}
                    />
                </React.Suspense>
            )}

            {formProtectionModal.isOpen && createPortal(
                <div className="fixed inset-0 z-[110000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setFormProtectionModal(prev => ({ ...prev, isOpen: false }))} />
                    <div className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
                        <div className="flex items-start gap-4 mb-5">
                            <div className="w-11 h-11 bg-[var(--color-primary-light)] rounded-[var(--radius-md)] flex items-center justify-center shrink-0">
                                <span className="text-xl">🔗</span>
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-[var(--color-text)]">Không thể xóa danh sách</h3>
                                <p className="text-xs text-[var(--color-text-light)] mt-1">
                                    Danh sách <strong className="text-[var(--color-text)]">"{formProtectionModal.listName}"</strong> đang được kết nối với form thu thập dữ liệu. Hãy hủy liên kết trước khi xóa.
                                </p>
                            </div>
                        </div>

                        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[14px] p-4 mb-4">
                            <p className="text-xs font-semibold text-[var(--color-text-light)] mb-2.5">Form đang sử dụng danh sách này</p>
                            <div className="space-y-2">
                                {formProtectionModal.linkedForms.map(form => (
                                    <div key={form.id} className="flex items-center justify-between bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 bg-[var(--color-primary-light)] rounded-md flex items-center justify-center">
                                                <FileText className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                                            </div>
                                            <span className="text-xs font-semibold text-[var(--color-text)]">{form.name}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormProtectionModal(prev => ({ ...prev, isOpen: false }));
                                                navigate('/marketing/forms');
                                            }}
                                            className="text-xs font-semibold text-[var(--color-primary)] hover:underline px-2 py-1 rounded-md transition-colors"
                                        >
                                            Mở Form →
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[14px] px-4 py-3 text-xs text-[var(--color-text-light)] mb-5 leading-relaxed">
                            💡 Vào Form → Chỉnh sửa → Đổi <strong>"Danh sách nhận liên hệ"</strong> sang danh sách khác hoặc để trống, sau đó quay lại xóa danh sách này.
                        </div>

                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setFormProtectionModal(prev => ({ ...prev, isOpen: false }))}
                            >
                                Đóng
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => {
                                    setFormProtectionModal(prev => ({ ...prev, isOpen: false }));
                                    navigate('/marketing/forms');
                                }}
                            >
                                Đến trang Forms
                            </Button>
                        </div>
                    </div>
                </div>,
                getMktPortalRoot()
            )}

            {AdminPermModal}
        </>
    );
};

export default Audience;

