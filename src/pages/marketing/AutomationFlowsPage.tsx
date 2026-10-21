import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Plus, Trash2, RotateCcw, AlertTriangle, FileText, PauseCircle, PlayCircle, LayoutGrid, Clock, Filter, ChevronDown, Check,
    Zap, Users, Sparkles, CheckCircle2, BarChart3, ShieldCheck, GitMerge, Split, Lightbulb, Target, Send, Layers, Tag, FileInput, BellRing, List, Search
} from 'lucide-react';
import { api } from '../../components/marketing/services/storageAdapter';
import { logAction, getLogs, HistoryLog } from '../../components/marketing/services/historyService';
import { validateFlow, validateFlowAsync, ValidationError } from '../../components/marketing/services/flowValidationService';
import { calculateFlowDuration, formatDuration } from '../../components/marketing/services/flowAnalysis';

import { Flow, FlowStep, Campaign, Segment, FormDefinition, PurchaseEvent, CustomEvent } from '../../components/marketing/types';

import PageHero from '../../components/marketing/components/common/PageHero';
import StatCard from '../../components/marketing/components/common/StatCard';
import StatGrid from '../../components/marketing/components/common/StatGrid';
import Panel from '../../components/marketing/components/common/Panel';
import Toolbar from '../../components/marketing/components/common/Toolbar';
import SearchBox from '../../components/marketing/components/common/SearchBox';
import Button from '../../components/marketing/components/common/Button';
import Skeleton from '../../components/marketing/components/common/Skeleton';
import FlowCard from '../../components/marketing/components/flows/FlowCard';
import { createPortal } from 'react-dom';
import { getMktPortalRoot } from '../../components/marketing/utils/portalRoot';
import { generateFlowStepLabels } from '../../components/marketing/utils/flowLabeling';
import { getStepLabel, getStepIcon } from '../../components/marketing/components/flows/flowConstants';

// Lazy loaded heavy components
const FlowBuilderTab = React.lazy(() => import('../../components/marketing/components/flows/tabs/FlowBuilderTab'));
const FlowAnalyticsTab = React.lazy(() => import('../../components/marketing/components/flows/tabs/FlowAnalyticsTab'));
const FlowSettingsTab = React.lazy(() => import('../../components/marketing/components/flows/tabs/FlowSettingsTab'));
const StepEditor = React.lazy(() => import('../../components/marketing/components/flows/modals/StepEditor'));
const ActivateFlowModal = React.lazy(() => import('../../components/marketing/components/flows/modals/ActivateFlowModal'));
const FlowSimulateModal = React.lazy(() => import('../../components/marketing/components/flows/modals/FlowSimulateModal'));
const StepParticipantsModal = React.lazy(() => import('../../components/marketing/components/flows/modals/StepParticipantsModal'));
const HistoryModal = React.lazy(() => import('../../components/marketing/components/flows/modals/HistoryModal').then(module => ({ default: module.FlowHistoryModal })));
const FlowCreationModal = React.lazy(() => import('../../components/marketing/components/flows/modals/FlowCreationModal'));
const AddStepModal = React.lazy(() => import('../../components/marketing/components/flows/modals/AddStepModal'));
const FlowContinuationModal = React.lazy(() => import('../../components/marketing/components/flows/modals/FlowContinuationModal'));
const FlowSummaryModal = React.lazy(() => import('../../components/marketing/components/flows/modals/FlowSummaryModal'));
const GroupDetailModal = React.lazy(() => import('../../components/marketing/components/audience/GroupDetailModal'));
const PurchaseEventDetailModal = React.lazy(() => import('../../components/marketing/components/triggers/PurchaseEventDetailModal'));
const CustomEventDetailModal = React.lazy(() => import('../../components/marketing/components/triggers/CustomEventDetailModal'));
const CustomerProfileModal = React.lazy(() => import('../../components/marketing/components/audience/CustomerProfileModal'));
const CampaignDetailDrawer = React.lazy(() => import('../../components/marketing/components/campaigns/CampaignDetailDrawer'));
const FormEditorModal = React.lazy(() => import('../../components/marketing/components/forms/FormEditorModal'));

import toast from 'react-hot-toast';
import FlowEmptyState from '../../components/marketing/components/flows/FlowEmptyState';
import FlowHeader from '../../components/marketing/components/flows/builder/FlowHeader';
import { useKeyboardShortcuts } from '../../components/marketing/hooks/useKeyboardShortcuts';
import FlowSidebar from '../../components/marketing/components/flows/builder/FlowSidebar';
import ConfirmModal from '../../components/marketing/components/common/ConfirmModal';
import { useTheme } from '../../components/marketing/contexts/ThemeContext';
import Select from '../../components/marketing/components/common/Select';
import EmptyState from '../../components/marketing/components/common/EmptyState';
import Tabs from '../../components/marketing/components/common/Tabs';
import TabTransition from '../../components/marketing/components/common/TabTransition';
import TipsModal from '../../components/marketing/components/common/TipsModal';
import { useIsAdmin, useAuthUser } from '../../components/marketing/hooks/useAuthUser';
import { usePermissionGuard } from '../../components/marketing/components/common/PermissionGuard';


type FlowFilter = 'all' | 'active' | 'draft' | 'paused' | 'archived';
type TriggerTypeFilter = 'all' | 'segment' | 'date' | 'campaign' | 'form' | 'tag' | 'purchase' | 'custom_event';
type FlowViewTab = 'builder' | 'analytics' | 'settings';

const getReachableSteps = (steps: FlowStep[]): FlowStep[] => {
    const trigger = steps?.find(s => s.type === 'trigger');
    if (!trigger) return [];

    const reachableIds = new Set<string>();
    const queue = [trigger.id];
    while (queue.length > 0) {
        const currentId = queue.shift()!;
        if (reachableIds.has(currentId)) continue;

        const s = steps?.find(step => step.id === currentId);
        if (!s) continue;

        reachableIds.add(currentId);

        // Strict traversal based on step type to prevent leakage via stale fields
        if (s.type === 'condition') {
            if (s.yesStepId) queue.push(s.yesStepId);
            if (s.noStepId) queue.push(s.noStepId);
        } else if (s.type === 'split_test') {
            if (s.pathAStepId) queue.push(s.pathAStepId);
            if (s.pathBStepId) queue.push(s.pathBStepId);
        } else if (s.type === 'advanced_condition') {
            if (s.config?.branches) s.config.branches.forEach((b: any) => { const targetId = b.nextStepId || b.stepId; if (targetId) queue.push(targetId); });
            if (s.config?.defaultStepId) queue.push(s.config.defaultStepId);
        } else if (s.type === 'link_flow' || s.type === 'remove_action') {
            // These steps terminate the current flow path or jump to another flow
        } else {
            // All other steps (trigger, action, wait, tag, list_action, zalo_zns, crm_action) use nextStepId
            if (s.nextStepId) queue.push(s.nextStepId);
        }
    }
    return steps.filter(s => reachableIds.has(s.id));
};

/**
 * [SMART AUTO-FIX]
 * Automatically update 'targetStepId' for all condition nodes to point to the nearest
 * preceding Action (Email/Zalo) or Campaign Trigger.
 */
const autoFixConditionTargets = (steps: FlowStep[]): FlowStep[] => {
    const trigger = steps?.find(s => s.type === 'trigger');
    if (!trigger) return steps;

    // Use JSON parse/stringify for deep copy to avoid mutating original state incorrectly during calculation
    const newSteps: FlowStep[] = JSON.parse(JSON.stringify(steps));
    const stepIds = new Set(newSteps.map(s => s.id)); // For validation
    const visited = new Set<string>();

    const traverse = (stepId: string | undefined, lastActionId: string | null) => {
        if (!stepId || visited.has(stepId)) return;
        visited.add(stepId);

        const stepIndex = newSteps.findIndex(s => s.id === stepId);
        if (stepIndex === -1) return;
        const step = newSteps[stepIndex];

        // 1. Identify if current step is a valid source for conditions (Action producing events)
        let currentLastActionId = lastActionId;
        if (['action', 'zalo_zns', 'zalo_cs', 'zalo_oa'].includes(step.type)) {
            currentLastActionId = step.id;
        } else if (step.type === 'trigger' && step.config?.type === 'campaign') {
            currentLastActionId = step.id;
        }

        // 2. If current step is a condition, update its target to point to the nearest action
        if (step.type === 'condition' && currentLastActionId) {
            if (!step.config) step.config = {};

            const cType = step.config.conditionType || 'opened';
            // Event-based types that depend on a previous action
            const eventBasedTypes = [
                'delivered', 'opened', 'clicked', 'replied',
                'zns_delivered', 'zns_clicked', 'zns_replied', 'zns_failed',
                'received_reminder', 'opened_reminder'
            ];

            if (eventBasedTypes.includes(cType)) {
                // [FIX] Only auto-fix if current target is empty OR invalid (points to non-existent step)
                const currentTargetId = step.config.targetStepId;
                const isInvalid = !currentTargetId || !stepIds.has(currentTargetId);

                if (isInvalid && currentTargetId !== currentLastActionId) {
                    console.log(`[AutoFix] Condition "${step.label}" target synced to "${currentLastActionId}"`);
                    step.config.targetStepId = currentLastActionId;
                }
            }
        }

        // 3. Recursive traversal
        if (step.type === 'condition') {
            if (step.yesStepId) traverse(step.yesStepId, currentLastActionId);
            if (step.noStepId) traverse(step.noStepId, currentLastActionId);
        } else if (step.type === 'split_test') {
            if (step.pathAStepId) traverse(step.pathAStepId, currentLastActionId);
            if (step.pathBStepId) traverse(step.pathBStepId, currentLastActionId);
        } else if (step.type === 'advanced_condition') {
            step.config?.branches?.forEach((b: any) => { const targetId = b.nextStepId || b.stepId; if (targetId) traverse(targetId, currentLastActionId); });
            if (step.config?.defaultStepId) traverse(step.config.defaultStepId, currentLastActionId);
        } else {
            if (step.nextStepId) traverse(step.nextStepId, currentLastActionId);
        }
    };

    traverse(trigger.id, null);
    return newSteps;
};

// --- SNAPSHOT TYPES (DB-backed) ---
interface FlowSnapshot {
    id: string;           // UUID from DB
    flow_id: string;
    label: string;
    created_by?: string;
    created_at: string;   // ISO datetime from DB
    flow_data?: Flow;     // Only loaded when restoring
}

const Flows: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isAdmin = useIsAdmin();
    const currentUser = useAuthUser();
    const { guard: adminGuard, PermModal: AdminPermModal } = usePermissionGuard(true);
    const { isDark: isDarkTheme } = useTheme();

    const [flows, setFlows] = useState<Flow[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [forms, setForms] = useState<FormDefinition[]>([]);
    const [purchaseEvents, setPurchaseEvents] = useState<PurchaseEvent[]>([]);
    const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);

    const [loading, setLoading] = useState(true);
    // [PERF] Skeleton only on the very first load — afterwards keep stale data visible during refetch
    const [hasLoaded, setHasLoaded] = useState(false);
    const loadAbortRef = useRef<AbortController | null>(null);
    const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
    const [flowViewTab, setFlowViewTab] = useState<FlowViewTab>('builder');
    const [editingStep, setEditingStep] = useState<FlowStep | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isViewMode, setIsViewMode] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [isNewUnsavedFlow, setIsNewUnsavedFlow] = useState(false); // Track if this is a new unsaved flow
    const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 1024); // Default open on large screens
    const [isReportMode, setIsReportMode] = useState(false);
    const [realtimeDistribution, setRealtimeDistribution] = useState<Record<string, { count: number, avg_wait: number }>>({});
    const [completedBranchStats, setCompletedBranchStats] = useState<Record<string, number>>({});
    const [loadingReport, setLoadingReport] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    // Participants Modal States (Replicated from Analytics for Quick Report)
    const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
    const [modalParticipants, setModalParticipants] = useState<any[]>([]);
    const [loadingParticipants, setLoadingParticipants] = useState(false);
    const [selectedAnalyticsStepId, setSelectedAnalyticsStepId] = useState<string | null>(null);
    const [analyticsSearchTerm, setAnalyticsSearchTerm] = useState('');
    const [analyticsActiveTab, setAnalyticsActiveTab] = useState<'all_touched' | 'waiting' | 'opened' | 'failed' | 'unsubscribed' | 'all' | 'clicks' | 'report' | 'zns_sent' | 'zns_clicked' | 'zns_replied' | 'zns_failed'>('all_touched');
    const [analyticsPagination, setAnalyticsPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
    const [selectedBranchFilter, setSelectedBranchFilter] = useState<string | null>(null);

    // Filters - Changed default to 'active'
    const [activeTab, setActiveTab] = useState<FlowFilter>('active');
    const [selectedFlowIds, setSelectedFlowIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        setSelectedFlowIds(new Set());
    }, [activeTab]);

    const handleToggleSelectFlow = useCallback((id: string) => {
        setSelectedFlowIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);
    const [filterType, setFilterType] = useState<TriggerTypeFilter>('all');
    const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
    // Date filter (mirrors Campaign page)
    const [datePreset, setDatePreset] = useState<'all' | '7' | '30' | 'month' | 'custom'>('all');
    const [customDate, setCustomDate] = useState<{ start: string; end: string }>({ start: '', end: '' });

    // Grid vs List view
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
        return (localStorage.getItem('automation_view_mode') as 'grid' | 'list') || 'grid';
    });

    const [hasAutoSetTab, setHasAutoSetTab] = useState(false);

    // Search (debounced 300 ms)
    const [flowSearch, setFlowSearch] = useState('');
    const [debouncedFlowSearch, setDebouncedFlowSearch] = useState('');
    useEffect(() => {
        const t = window.setTimeout(() => setDebouncedFlowSearch(flowSearch), 300);
        return () => window.clearTimeout(t);
    }, [flowSearch]);

    useEffect(() => {
        if (!loading && !hasAutoSetTab) {
            if (flows.length > 0) {
                const hasActive = flows.some(f => f.status === 'active');
                setActiveTab(hasActive ? 'active' : 'all');
            }
            setHasAutoSetTab(true);
        }
    }, [flows, loading, hasAutoSetTab]);

    useEffect(() => {
        localStorage.setItem('automation_view_mode', viewMode);
    }, [viewMode]);



    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
    const [historyLogs, setHistoryLogs] = useState<HistoryLog[]>([]);
    const [isAddStepModalOpen, setIsAddStepModalOpen] = useState(false);
    const [addStepContext, setAddStepContext] = useState<{ parentId: string; branch?: 'yes' | 'no' | 'A' | 'B'; isInsert?: boolean } | null>(null);

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean; title: string; message: React.ReactNode; onConfirm: () => void; variant?: 'danger' | 'warning' | 'info' | 'success'; confirmLabel?: string; requireConfirmText?: string; dangerText?: string; dangerAction?: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    // NEW: Activation Modal State
    const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
    const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false); // New
    const [activateContext, setActivateContext] = useState<{ flow: Flow } | null>(null);

    // Aux Data for Modals
    const [allLists, setAllLists] = useState<any[]>([]);
    const [allSegments, setAllSegments] = useState<Segment[]>([]);
    const [allTags, setAllTags] = useState<any[]>([]);
    const [tagsPagination, setTagsPagination] = useState({ page: 1, limit: 100, total: 0 });

    // Modal Selection State
    const [selectedCampaignForDetail, setSelectedCampaignForDetail] = useState<Campaign | null>(null);
    const [selectedFormForEdit, setSelectedFormForEdit] = useState<FormDefinition | null>(null);
    const [selectedPurchaseEvent, setSelectedPurchaseEvent] = useState<PurchaseEvent | null>(null);
    const [selectedCustomEvent, setSelectedCustomEvent] = useState<CustomEvent | null>(null);

    // Group Detail Modal State
    const [viewingGroup, setViewingGroup] = useState<{ id: string; name: string; type: 'list' | 'segment' | 'tag'; count: number } | null>(null);
    const [groupMembers, setGroupMembers] = useState<any[]>([]);
    const [groupPagination, setGroupPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
    const [groupLoading, setGroupLoading] = useState(false);
    const [groupSearch, setGroupSearch] = useState('');
    const [selectedSubscriberForDetail, setSelectedSubscriberForDetail] = useState<any | null>(null);

    // Flow Continuation Modal State
    const [continuationModal, setContinuationModal] = useState({
        isOpen: false,
        completedUsers: { total: 0, byBranch: {} },
        newStepInfo: { type: '', label: '', parentStepLabel: '', branch: '' },
        pendingStepType: null as any,
        pendingStepId: '',
        parentId: '',
        branch: '' as any,
        isAffected: false
    });

    const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);

    // DB-backed snapshots for current flow
    const [flowSnapshots, setFlowSnapshots] = useState<FlowSnapshot[]>([]);
    const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
    // Confirm restore modal state
    const [restoreConfirmSnapshot, setRestoreConfirmSnapshot] = useState<FlowSnapshot | null>(null);
    const [isRestoringSnapshot, setIsRestoringSnapshot] = useState(false);;

    // Memoized Modals/Sub-components avoid passing fresh arrows
    const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    }, []);

    const loadTags = useCallback(async (page = 1, search = '') => {
        const res = await api.get<any>(`tags?page=${page}&limit=100&search=${search}`);
        if (res.success) {
            const raw = res.data;
            const tagList = Array.isArray(raw) ? raw : (raw?.data || []);
            setAllTags(tagList);
            if (raw?.pagination) {
                setTagsPagination(raw.pagination);
            }
        }
    }, []);

    const loadLists = useCallback(async () => {
        const res = await api.get<any[]>('lists');
        if (res.success) {
            const data = res.data;
            setAllLists(Array.isArray(data) ? data : (data as any)?.data || []);
        }
    }, []);

    const loadSegments = useCallback(async () => {
        const res = await api.get<Segment[]>('segments');
        if (res.success) {
            const data = res.data;
            setAllSegments(Array.isArray(data) ? data : (data as any)?.data || []);
        }
    }, []);

    const loadData = useCallback(async () => {
        // [PERF] Cancel any superseded load; keep stale data visible during refetch
        loadAbortRef.current?.abort();
        const ctrl = new AbortController();
        loadAbortRef.current = ctrl;
        const { signal } = ctrl;
        setLoading(true);
        try {
            // 1) Critical path: the flow list alone unblocks the page (skeleton → cards)
            const flowsRes = await api.get<Flow[]>('flows', {}, { signal });
            if (signal.aborted) return;
            if (flowsRes.success) {
                const raw = flowsRes.data as any;
                const flowList: Flow[] = Array.isArray(raw) ? raw : (raw?.data || []);
                setFlows(flowList);
            } else {
                showToast(flowsRes.message || 'Lỗi khi tải danh sách kịch bản', 'error');
            }
            setHasLoaded(true);
            setLoading(false);

            // 2) Secondary lookups (trigger labels on cards, modal pickers) — non-blocking
            const [campaignsRes, formsRes, purchRes, customRes, listsRes, segRes, tagsRes] = await Promise.all([
                api.get<Campaign[]>('campaigns', {}, { signal }),
                api.get<FormDefinition[]>('forms', {}, { signal }),
                api.get<PurchaseEvent[]>('purchase_events', {}, { signal }),
                api.get<CustomEvent[]>('custom_events', {}, { signal }),
                api.get<any[]>('lists', {}, { signal }),
                api.get<Segment[]>('segments', {}, { signal }),
                api.get<any[]>('tags', {}, { signal })
            ]);
            if (signal.aborted) return;

            if (campaignsRes.success) {
                const data = campaignsRes.data;
                setCampaigns(Array.isArray(data) ? data : (data as any)?.data || []);
            }
            if (formsRes.success) {
                const data = formsRes.data;
                setForms(Array.isArray(data) ? data : (data as any)?.data || []);
            }
            if (purchRes.success) {
                const data = purchRes.data;
                setPurchaseEvents(Array.isArray(data) ? data : (data as any)?.data || []);
            }
            if (customRes.success) {
                const data = customRes.data;
                setCustomEvents(Array.isArray(data) ? data : (data as any)?.data || []);
            }
            if (listsRes.success) {
                const data = listsRes.data;
                setAllLists(Array.isArray(data) ? data : (data as any)?.data || []);
            }
            if (segRes.success) {
                const data = segRes.data;
                setAllSegments(Array.isArray(data) ? data : (data as any)?.data || []);
            }
            if (tagsRes.success) {
                const data = tagsRes.data;
                setAllTags(Array.isArray(data) ? data : (data as any)?.data || []);
            }

            // ── Second-pass: resolve any segment/list names referenced by flow
            //    triggers that weren't included in the initial batch (e.g. pagination) ──
            const flowList2: Flow[] = flowsRes.success
                ? (Array.isArray(flowsRes.data) ? flowsRes.data : (flowsRes.data as any)?.data || [])
                : [];
            const loadedSegments: Segment[] = segRes.success
                ? (Array.isArray(segRes.data) ? segRes.data : (segRes.data as any)?.data || [])
                : [];
            const loadedLists: any[] = listsRes.success
                ? (Array.isArray(listsRes.data) ? listsRes.data : (listsRes.data as any)?.data || [])
                : [];

            const knownSegIds  = new Set(loadedSegments.map(s => s.id));
            const knownListIds = new Set(loadedLists.map(l => l.id));

            const missingSegIds : string[] = [];
            const missingListIds: string[] = [];

            for (const flow of flowList2) {
                const trigger = flow.steps?.find(s => s.type === 'trigger');
                const cfg = trigger?.config || {};
                if (!cfg.targetId || cfg.type !== 'segment') continue;

                if (cfg.targetSubtype === 'list' || cfg.targetSubtype === 'sync') {
                    if (!knownListIds.has(cfg.targetId)) missingListIds.push(cfg.targetId);
                } else {
                    if (!knownSegIds.has(cfg.targetId))  missingSegIds.push(cfg.targetId);
                    if (!knownListIds.has(cfg.targetId)) missingListIds.push(cfg.targetId);
                }
            }

            if (missingSegIds.length > 0) {
                const extras = await Promise.all(
                    [...new Set(missingSegIds)].map(id => api.get<Segment>(`segments?id=${encodeURIComponent(id)}`, {}, { signal }))
                );
                if (signal.aborted) return;
                const extra: Segment[] = extras
                    .filter(r => r.success && r.data)
                    .map(r => (Array.isArray(r.data) ? r.data[0] : r.data) as Segment)
                    .filter(Boolean);
                if (extra.length > 0) setAllSegments(prev => [...prev, ...extra]);
            }
            if (missingListIds.length > 0) {
                const extras = await Promise.all(
                    [...new Set(missingListIds)].map(id => api.get<any>(`lists?id=${encodeURIComponent(id)}`, {}, { signal }))
                );
                if (signal.aborted) return;
                const extra: any[] = extras
                    .filter(r => r.success && r.data)
                    .map(r => (Array.isArray(r.data) ? r.data[0] : r.data))
                    .filter(Boolean);
                if (extra.length > 0) setAllLists(prev => [...prev, ...extra]);
            }

        } catch (error: any) {
            // Silent on cancellation (unmount / superseded refetch)
            if (signal.aborted || error?.name === 'AbortError' || error?.name === 'CanceledError' || error?.code === 'ERR_CANCELED') return;
            showToast('Lỗi khi tải dữ liệu hệ thống', 'error');
        } finally {
            if (loadAbortRef.current === ctrl) setLoading(false);
        }
    }, [showToast]);

    // Abort in-flight list loads on unmount
    useEffect(() => () => { loadAbortRef.current?.abort(); }, []);

    const handleEmptyTrash = useCallback(() => {
        setConfirmModal({
            isOpen: true,
            title: 'Dọn sạch Thùng rác?',
            message: 'Bạn có chắc chắn muốn xóa vĩnh viễn tất cả kịch bản trong Thùng rác không? Hành động này không thể khôi phục.',
            variant: 'danger',
            confirmLabel: 'Xóa vĩnh viễn tất cả',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setLoading(true);
                try {
                    const res = await api.delete('flows?route=empty-trash');
                    if (res.success) {
                        showToast('Đã dọn sạch thùng rác thành công!', 'success');
                        loadData();
                    } else {
                        showToast(res.message || 'Lỗi khi dọn sạch thùng rác', 'error');
                    }
                } catch (error) {
                    showToast('Đã xảy ra lỗi hệ thống khi dọn sạch thùng rác', 'error');
                } finally {
                    setLoading(false);
                }
            }
        });
    }, [loadData, showToast]);

    const handleBulkDeletePermanent = useCallback(() => {
        if (selectedFlowIds.size === 0) return;
        setConfirmModal({
            isOpen: true,
            title: 'Xóa vĩnh viễn kịch bản đã chọn?',
            message: `Bạn có chắc chắn muốn xóa vĩnh viễn ${selectedFlowIds.size} kịch bản đã chọn không? Hành động này không thể khôi phục.`,
            variant: 'danger',
            confirmLabel: 'Xóa vĩnh viễn',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setLoading(true);
                try {
                    const res = await api.post('flows?route=bulk-delete', { ids: Array.from(selectedFlowIds) });
                    if (res.success) {
                        showToast(`Đã xóa vĩnh viễn ${selectedFlowIds.size} kịch bản thành công!`, 'success');
                        setSelectedFlowIds(new Set());
                        loadData();
                    } else {
                        showToast(res.message || 'Lỗi khi xóa vĩnh viễn kịch bản', 'error');
                    }
                } catch (error) {
                    showToast('Đã xảy ra lỗi hệ thống khi xóa kịch bản', 'error');
                } finally {
                    setLoading(false);
                }
            }
        });
    }, [selectedFlowIds, loadData, showToast]);

    const fetchReportData = useCallback(async (flowId: string) => {
        setLoadingReport(true);
        try {
            const [distRes, completedRes, flowRes] = await Promise.all([
                api.get<any>(`flows?id=${flowId}&route=distribution`),
                api.get<any>(`flows?id=${flowId}&route=completed-users`),
                api.get<Flow>(`flows?id=${flowId}`)
            ]);
            if (distRes.success) setRealtimeDistribution(distRes.data);
            if (completedRes.success && completedRes.data) setCompletedBranchStats(completedRes.data.byBranch || {});

            // Critical: Update the selected flow to get the latest step.stats from backend
            if (flowRes.success && flowRes.data) {
                setSelectedFlow(prev => {
                    if (!prev || prev.id !== flowId) return prev;
                    // Merge stats into existing flow to avoid breaking local UI state if user was mid-edit
                    return {
                        ...prev,
                        stats: flowRes.data.stats,
                        steps: prev.steps.map(s => {
                            const updatedStep = flowRes.data.steps?.find(us => us.id === s.id);
                            return updatedStep ? { ...s, stats: updatedStep.stats } : s;
                        })
                    };
                });
            }
        } catch (error) {
            console.error('Failed to fetch report data:', error);
        } finally {
            setLoadingReport(false);
        }
    }, []);

    useEffect(() => {
        if (isReportMode && selectedFlow) {
            fetchReportData(selectedFlow.id);
        }
    }, [isReportMode, selectedFlow?.id, fetchReportData]);

    const fetchParticipants = useCallback(async (flowId: string, stepId: string, tab: string, page = 1, search = '', branch: string | null = null) => {
        if (!selectedFlow) return;
        setLoadingParticipants(true);
        try {

            const limit = 50;
            let statusParam: string | null = '';
            let typeParam: string | null = null;
            let route = 'participants';

            // Mapping matching FlowAnalyticsTab
            if (tab === 'all_touched') { statusParam = 'all_touched'; }
            else if (tab === 'waiting') { statusParam = null; }
            else if (tab === 'opened') { typeParam = 'opens'; }
            else if (tab === 'failed') { statusParam = 'failed'; route = 'step-errors'; }
            else if (tab === 'unsubscribed') { statusParam = 'unsubscribed'; route = 'step-unsubscribes'; }
            else if (tab === 'clicks') { typeParam = 'clicks'; }
            else if (tab === 'zns_sent') { typeParam = 'zns_sent'; }
            else if (tab === 'zns_clicked') { typeParam = 'click_zns'; }
            else if (tab === 'zns_replied') { typeParam = 'reply_zns'; }
            else if (tab === 'zns_failed') { typeParam = 'zns_failed'; }

            // effectiveStepId logic for waiting users (include parent wait steps)
            let effectiveStepId = stepId;
            if (stepId && (!statusParam || statusParam === 'waiting')) {
                const sources = [stepId];
                const findWaitSources = (targetId: string) => {
                    selectedFlow.steps.forEach(s => {
                        if (s.type === 'wait' && s.nextStepId === targetId && !sources.includes(s.id)) {
                            sources.push(s.id);
                            findWaitSources(s.id);
                        }
                    });
                };
                findWaitSources(stepId);
                effectiveStepId = sources.join(',');
            }

            let url = `flows?id=${flowId}&route=${route}&page=${page}&limit=${limit}`;
            if (effectiveStepId) url += `&step_id=${effectiveStepId}`;
            if (statusParam && route === 'participants') url += `&status=${statusParam}`;
            if (typeParam) url += `&type=${typeParam}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (branch) url += `&branch=${encodeURIComponent(branch)}`;

            const res = await api.get<any>(url);
            if (res.success) {
                const responseData = res.data;
                const dataArray = responseData.data || (Array.isArray(responseData) ? responseData : []);
                const pagination = responseData.pagination || { page: 1, limit: 50, total: dataArray.length, totalPages: 1 };

                setModalParticipants(dataArray);
                setAnalyticsPagination(pagination);
            }
        } catch (error) {
            showToast('Lỗi khi tải danh sách Khách hàng', 'error');
        } finally {
            setLoadingParticipants(false);
        }
    }, [showToast, selectedFlow]);

    useEffect(() => {
        if (isParticipantsModalOpen && selectedFlow && selectedAnalyticsStepId) {
            fetchParticipants(selectedFlow.id, selectedAnalyticsStepId, analyticsActiveTab, analyticsPagination.page, analyticsSearchTerm, selectedBranchFilter);
        }
    }, [isParticipantsModalOpen, analyticsActiveTab, analyticsPagination.page, analyticsSearchTerm, selectedFlow?.id, selectedAnalyticsStepId, selectedBranchFilter, fetchParticipants]);


    const handleUpdateFlow = useCallback(async (updated: Flow, isSilent = true, logMsg?: string, skipApi = false) => {
        if (!isSilent && updated.status === 'active' && !skipApi) {
            const trigger = updated.steps?.find(s => s.type === 'trigger');
            if (trigger?.config?.type === 'campaign' && trigger.config.targetId) {
                const campaign = campaigns?.find(c => c.id === trigger.config.targetId);
                if (campaign && (campaign.status === 'waiting_flow' || campaign.status === 'draft')) {
                    setActivateContext({ flow: updated });
                    setIsActivateModalOpen(true);
                    return;
                }
            }
        }

        if (!isSilent) setIsSaving(true);

        // [AUTO-FIX] Recalculate and update condition target IDs to point to the nearest actions
        const fixedSteps = autoFixConditionTargets(updated.steps || []);

        // AUTO-PURGE: Always ensure we only save reachable steps
        const cleanedSteps = getReachableSteps(fixedSteps);

        // Derive trigger_type for backend indexing
        const trigger = cleanedSteps?.find(s => s.type === 'trigger');
        const triggerType = trigger?.config?.type || null;

        const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}');
        const creatorInfo = user.name ? { name: user.name, picture: user.picture || "/imgs/ICON.png" } : null;

        const flowToSave = {
            ...updated,
            steps: cleanedSteps,
            trigger_type: triggerType,
            config: {
                ...updated.config,
                creator: (updated.config as any)?.creator || creatorInfo || { name: 'Hệ thống', picture: '/imgs/ICON.png' }
            }
        };

        console.log(`[FlowSave] Saving flow ${flowToSave.id} with ${cleanedSteps.length} reachable steps (Original: ${updated.steps?.length})`);

        setFlows(prev => prev.map(f => f.id === flowToSave.id ? flowToSave : f));
        if (selectedFlow && selectedFlow.id === flowToSave.id) {
            setSelectedFlow(flowToSave);
        }

        try {
            if (!skipApi) {
                const res = await api.put(`flows/${flowToSave.id}`, flowToSave);
                if (!res.success) throw new Error(res.message || 'Lỗi khi lưu kịch bản');
            }
            if (logMsg) {
                // [DB SNAPSHOT] Save to backend asynchronously - don't block save
                const snapshotId = crypto.randomUUID();
                api.post(`flows?id=${updated.id}&route=flow-snapshots`, {
                    id: snapshotId,
                    label: logMsg,
                    flow_data: updated,
                    created_by: currentUser?.name || currentUser?.email || 'Admin'
                }).then(() => {
                    // Refresh snapshot list in background
                    api.get<FlowSnapshot[]>(`flows?id=${updated.id}&route=flow-snapshots`).then(res => {
                        if (res.success) setFlowSnapshots(res.data || []);
                    });
                }).catch(err => console.warn('[Snapshot] Failed to save to DB:', err));

                const newLogs = logAction(logMsg, `Flow: ${updated.name}`, updated.id);
                setHistoryLogs(newLogs);
            }
            if (skipApi) {
                setHasUnsavedChanges(true);
            }
        } catch (error: any) {
            showToast(error.message || 'Lỗi khi cập nhật kịch bản', 'error');
            // Revert local state if API failed
            loadData();
        } finally {
            if (!isSilent) setIsSaving(false);
        }
    }, [campaigns, selectedFlow, loadData]);



    // Load snapshots from DB when flow is selected or history modal opens
    const loadSnapshots = useCallback(async (flowId: string) => {
        setIsLoadingSnapshots(true);
        try {
            const res = await api.get<any>(`flows?id=${flowId}&route=flow-snapshots`);
            if (res.success) {
                // Handle both: direct array OR { data: [...] } wrapper
                const raw = res.data;
                const arr = Array.isArray(raw) ? raw : (Array.isArray(raw?.data) ? raw.data : []);
                setFlowSnapshots(arr);
            }
        } catch (e) {
            console.warn('[Snapshots] Failed to load:', e);
            setFlowSnapshots([]);
        } finally {
            setIsLoadingSnapshots(false);
        }
    }, []);

    // Restore snapshot: fetch full data then show confirm dialog
    const handleRestoreSnapshot = async (snapshot: FlowSnapshot) => {
        if (!selectedFlow) return;
        // Show confirm with snapshot meta info
        setRestoreConfirmSnapshot(snapshot);
    };

    // Execute the actual restore after confirmation
    const handleConfirmRestore = async () => {
        if (!selectedFlow || !restoreConfirmSnapshot) return;
        setIsRestoringSnapshot(true);
        try {
            // Fetch full flow_data from DB
            const res = await api.get<FlowSnapshot>(
                `flows?route=flow-snapshot-data&snapshot_id=${restoreConfirmSnapshot.id}`
            );
            if (!res.success || !res.data?.flow_data) {
                showToast('Không tải được dữ liệu phiên bản', 'error');
                return;
            }
            const restoredFlow = { ...res.data.flow_data, id: selectedFlow.id };
            setSelectedFlow(restoredFlow);
            setHasUnsavedChanges(true);
            setIsHistoryModalOpen(false);
            setRestoreConfirmSnapshot(null);
            showToast(`✅ Đã khôi phục phiên bản: ${restoreConfirmSnapshot.label}. Nhớ bấm Lưu để áp dụng!`, 'success');
        } catch (e) {
            showToast('Lỗi khi khôi phục phiên bản', 'error');
        } finally {
            setIsRestoringSnapshot(false);
        }
    };

    const [pendingMigrations, setPendingMigrations] = useState<{
        flowId: string;
        action: 'continue' | 'stop';
        continueAll?: boolean;
        branches?: string[];
        targetStepId: string;
    }[]>([]);


    const onEditStepMemo = useCallback((step: FlowStep) => setEditingStep(step), []);
    const onReportClickMemo = useCallback((stepId: string, type: string) => {
        setSelectedAnalyticsStepId(stepId);
        if (type === 'action') setAnalyticsActiveTab('opened');
        else if (type === 'zalo_zns') setAnalyticsActiveTab('zns_sent');
        else setAnalyticsActiveTab('all_touched');
    }, []);
    const onAddStepViaBuilder = useCallback((parentId: string, branch?: string, isInsert?: boolean) => {
        setAddStepContext({ parentId, branch: branch as any, isInsert });
        setIsAddStepModalOpen(true);
    }, []);

    const handleSwapSteps = useCallback((sourceId: string, targetId: string) => {
        if (!selectedFlow) return;
        const steps = [...(selectedFlow.steps || [])];
        const sourceIdx = steps.findIndex(s => s.id === sourceId);
        const targetIdx = steps.findIndex(s => s.id === targetId);

        if (sourceIdx !== -1 && targetIdx !== -1) {
            const source = { ...steps[sourceIdx] };
            const target = { ...steps[targetIdx] };

            // [FIX] MISSION-CRITICAL: Preserve connectivity fields during swap
            // We only swap the "Content/Metadata" but keep the IDs and Arrows mapping.
            // This prevents the "A pointing to A" infinite loop bug when swapping parent-child.
            const connectivityFields = [
                'id', 'nextStepId', 'yesStepId', 'noStepId',
                'pathAStepId', 'pathBStepId'
            ];

            const newSource = { ...target };
            connectivityFields.forEach(f => {
                if (source.hasOwnProperty(f)) (newSource as any)[f] = (source as any)[f];
                else delete (newSource as any)[f];
            });

            const newTarget = { ...source };
            connectivityFields.forEach(f => {
                if (target.hasOwnProperty(f)) (newTarget as any)[f] = (target as any)[f];
                else delete (newTarget as any)[f];
            });

            if (target.type === 'advanced_condition') {
                newSource.config = {
                    ...target.config,
                    branches: source.type === 'advanced_condition'
                        ? source.config?.branches
                        : (target.config?.branches || []),
                    defaultStepId: source.type === 'advanced_condition'
                        ? source.config?.defaultStepId
                        : (source.nextStepId || target.config?.defaultStepId)
                };
            }
            if (source.type === 'advanced_condition') {
                newTarget.config = {
                    ...source.config,
                    branches: target.type === 'advanced_condition'
                        ? target.config?.branches
                        : (source.config?.branches || []),
                    defaultStepId: target.type === 'advanced_condition'
                        ? target.config?.defaultStepId
                        : (target.nextStepId || source.config?.defaultStepId)
                };
            }

            for (const node of [newSource, newTarget]) {
                if (node.nextStepId === node.id) node.nextStepId = undefined;
                if (node.yesStepId === node.id) node.yesStepId = undefined;
                if (node.noStepId === node.id) node.noStepId = undefined;
                if (node.pathAStepId === node.id) node.pathAStepId = undefined;
                if (node.pathBStepId === node.id) node.pathBStepId = undefined;
            }

            steps[sourceIdx] = newSource;
            steps[targetIdx] = newTarget;

            handleUpdateFlow({ ...selectedFlow, steps }, false, "Hoán đổi nội dung bước", selectedFlow.status === 'active');

        }
    }, [selectedFlow, handleUpdateFlow]);

    // loadData is referentially stable → runs once per mount (StrictMode-safe with the unmount abort above)
    useEffect(() => {
        loadData();
        setHistoryLogs(getLogs());
    }, [loadData]);

    // Load DB snapshots when flow changes or history modal opens
    useEffect(() => {
        if (selectedFlow?.id) {
            loadSnapshots(selectedFlow.id);
        } else {
            setFlowSnapshots([]);
        }
    }, [selectedFlow?.id, isHistoryModalOpen, loadSnapshots]);

    useKeyboardShortcuts({
        'n': () => {
            if (!selectedFlow) {
                setIsCreateModalOpen(true);
            }
        }
    }, [selectedFlow, setIsCreateModalOpen]);

    useEffect(() => {
        if (!selectedFlow) {
            setValidationErrors([]);
            return;
        }

        // Bước 1: Chạy sync check ngay lập tức để hiện kết quả cơ bản
        const syncErrors = validateFlow(selectedFlow, flows, false, hasUnsavedChanges);
        setValidationErrors(syncErrors);

        // Bước 2: Chạy async check để kiểm tra template email đã xóa và ZNS template không active
        // Dùng flag để cancel nếu selectedFlow thay đổi trước khi check xong
        let cancelled = false;
        validateFlowAsync(selectedFlow, (endpoint) => api.get(endpoint)).then(asyncErrors => {
            if (!cancelled && asyncErrors.length > 0) {
                setValidationErrors(prev => {
                    // Tránh trùng lặp: loại bỏ errors cũ có cùng stepId + loại async
                    const dedupedPrev = prev.filter(e => !(asyncErrors || []).some(ae => ae.stepId === e.stepId && ae.msg === e.msg));
                    return [...dedupedPrev, ...asyncErrors];
                });
            }
        });

        return () => { cancelled = true; };
    }, [selectedFlow, flows]);

    // Fetch Group Members when viewingGroup changes or its filters change
    useEffect(() => {
        if (viewingGroup) {
            fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);
        } else {
            setGroupMembers([]);
            setGroupSearch('');
            setGroupPagination({ page: 1, limit: 50, total: 0, totalPages: 1 });
        }
    }, [viewingGroup?.id, groupPagination.page, groupSearch]);

    const fetchGroupMembers = async (group: { id: string; type: string }, page = 1, search = '') => {
        if (!group) return;
        setGroupLoading(true);
        try {
            const query = new URLSearchParams({ page: page.toString(), limit: '20', search: search });
            if (group.type === 'list') query.set('list_id', group.id);
            else if (group.type === 'segment') query.set('segment_id', group.id);
            else if (group.type === 'tag') query.set('tag', group.id);

            const res = await api.get<any>(`subscribers?${query.toString()}`);
            if (res.success) {
                if (res.data.pagination) {
                    setGroupMembers(Array.isArray(res.data.data) ? res.data.data : []);
                    setGroupPagination(res.data.pagination);
                } else if (Array.isArray(res.data)) {
                    setGroupMembers(res.data);
                    setGroupPagination({ page: 1, limit: res.data.length, total: res.data.length, totalPages: 1 });
                } else {
                    setGroupMembers([]);
                    setGroupPagination({ page: 1, limit: 50, total: 0, totalPages: 1 });
                }
            } else {
                setGroupMembers([]);
                showToast(res.message || 'Không thể tải danh sách thành viên', 'error');
            }
        } catch (error) {
            setGroupMembers([]);
            showToast('Lỗi hệ thống khi tải danh sách thành viên', 'error');
        } finally {
            setGroupLoading(false);
        }
    };

    const handleDetailRemoveFromList = async (subscriberIds: string[], listId: string, options?: { targetType: string, targetId: string }) => {
        setGroupLoading(true);
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
                if (viewingGroup) fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);
                showToast(`Đã gỡ ${res.data.affected} Khách hàng khỏi danh sách`, 'success');
            } else {
                showToast(res.message || 'Lỗi khi gỡ khỏi danh sách', 'error');
            }
        } catch (error) {
            showToast('Lỗi hệ thống khi gỡ khỏi danh sách', 'error');
        } finally {
            setGroupLoading(false);
        }
    };

    const handleDetailRemoveFromTag = async (subscriberIds: string[], tagName: string, options?: { targetType: string, targetId: string }) => {
        setGroupLoading(true);
        try {
            let payload: any = { type: 'tag_remove', tag: tagName };
            if (options) {
                payload.targetType = options.targetType;
                payload.targetId = options.targetId;
            } else {
                payload.subscriberIds = subscriberIds;
            }
            const res = await api.post<any>('bulk_operations', payload);
            if (res.success) {
                if (viewingGroup) fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);
                showToast(`Đã gỡ nhãn khỏi ${res.data.affected} Khách hàng`, 'success');
            } else {
                showToast(res.message || 'Lỗi khi gỡ nhãn', 'error');
            }
        } catch (error) {
            showToast('Lỗi hệ thống khi gỡ nhãn', 'error');
        } finally {
            setGroupLoading(false);
        }
    };


    useEffect(() => {
        const navState = (location as any).state;
        if (navState?.openFlowId && flows.length > 0) {
            const targetFlow = flows?.find(f => f.id === navState.openFlowId);
            if (targetFlow) {
                setSelectedFlow(JSON.parse(JSON.stringify(targetFlow)));
                const initialTab = navState.tab || 'builder';
                setFlowViewTab(initialTab as FlowViewTab);
                window.history.replaceState({}, document.title);

                // [FIX] Lazy-load full steps (list has only trigger step due to PERF-F3)
                api.get<Flow>(`flows?id=${targetFlow.id}`).then(res => {
                    if (res.success && res.data) setSelectedFlow(res.data);
                }).catch(() => {});
            }
        }
    }, [flows, location.state]);


    // NEW: Handle Redirects for Creation
    const [prefillCampaignId, setPrefillCampaignId] = useState<string | undefined>();
    const [prefillTemplateId, setPrefillTemplateId] = useState<string | undefined>();
    const [prefillFlowName, setPrefillFlowName] = useState<string | undefined>();

    useEffect(() => {
        if (!location.pathname.startsWith('/marketing/flows')) return;
        // Handle HashRouter query params (e.g. #/flows?action=create)
        let searchPart = location.search;
        if (!searchPart && location.hash.includes('?')) {
            searchPart = location.hash.substring(location.hash.indexOf('?'));
        }

        const params = new URLSearchParams(searchPart);
        const action = params.get('action');
        const campaignId = params.get('campaign_id');
        const templateId = params.get('template_id');

        // Also check location.state (from useNavigate)
        const stateAction = location.state?.action as string | undefined;
        const stateCampaignId = location.state?.campaignId as string | undefined;
        const stateTemplateId = location.state?.templateId as string | undefined;

        if ((action === 'create' || stateAction === 'create')) {
            const targetId = campaignId || stateCampaignId;
            const targetTpl = templateId || stateTemplateId;
            const targetName = params.get('flow_name') || (location.state?.flowName as string | undefined);

            if (targetId) setPrefillCampaignId(targetId);
            if (targetTpl) setPrefillTemplateId(targetTpl);
            if (targetName) setPrefillFlowName(targetName);

            // Pre-fill creation modal
            if (!isCreateModalOpen) {
                setIsCreateModalOpen(true);
            }

            // CLEANUP: Immediately clear the URL params and history state to prevent re-triggering on refresh/render
            if (action === 'create') {
                const newParams = new URLSearchParams(params);
                newParams.delete('action');
                newParams.delete('campaign_id');
                newParams.delete('template_id');
                newParams.delete('flow_name');
                const newSearch = newParams.toString();
                // Clear state for React Router and browser history in one go
                navigate({
                    pathname: '/marketing/flows',
                    search: newSearch ? '?' + newSearch : ''
                }, { replace: true, state: {} });
            } else if (stateAction === 'create') {
                // Also clear location state for React Router
                navigate('/marketing/flows', { replace: true, state: {} });
            }
        }
    }, [location.pathname, location.search, location.hash, location.state]); // More specific dependencies


    const filteredFlows = useMemo(() => {
        let result = Array.isArray(flows) ? flows : [];

        // 1. Status Filter
        if (activeTab === 'all') {
            result = result.filter(f => f.status !== 'archived');
        } else {
            result = result.filter(f => f.status === activeTab);
        }

        // 2. Trigger Type Filter
        if (filterType !== 'all') {
            result = result.filter(f => {
                const trigger = f.steps?.find(s => s.type === 'trigger');
                const type = trigger?.config?.type || 'segment';
                return type === filterType;
            });
        }

        // 2b. Name search (debounced)
        const q = debouncedFlowSearch.trim().toLowerCase();
        if (q) {
            result = result.filter(f => (f.name || '').toLowerCase().includes(q));
        }

        // 3. Date Range Filter (datePreset & customDate)
        if (datePreset !== 'all') {
            const now = new Date();
            result = result.filter(f => {
                const rawDate = f.createdAt || (f as any).created_at || (f as any).updated_at;
                if (!rawDate) return true;
                const created = new Date(rawDate);
                if (Number.isNaN(created.getTime())) return true;

                if (datePreset === '7') {
                    return (now.getTime() - created.getTime()) <= 7 * 86400000;
                }
                if (datePreset === '30') {
                    return (now.getTime() - created.getTime()) <= 30 * 86400000;
                }
                if (datePreset === 'month') {
                    return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                }
                if (datePreset === 'custom') {
                    if (customDate.start) {
                        const fromD = new Date(customDate.start);
                        if (created < fromD) return false;
                    }
                    if (customDate.end) {
                        const toD = new Date(customDate.end);
                        toD.setHours(23, 59, 59, 999);
                        if (created > toD) return false;
                    }
                }
                return true;
            });
        }

        return result;
    }, [flows, activeTab, filterType, datePreset, customDate, debouncedFlowSearch]);

    // Lookup Maps for Performance
    const campaignsMap = useMemo(() => new Map((Array.isArray(campaigns) ? campaigns : []).map(c => [c.id, c])), [campaigns]);
    const formsMap = useMemo(() => new Map((Array.isArray(forms) ? forms : []).map(f => [f.id, f])), [forms]);
    const purchaseEventsMap = useMemo(() => new Map((Array.isArray(purchaseEvents) ? purchaseEvents : []).map(p => [p.id, p])), [purchaseEvents]);
    const customEventsMap = useMemo(() => new Map((Array.isArray(customEvents) ? customEvents : []).map(c => [c.id, c])), [customEvents]);
    const segmentsMap = useMemo(() => new Map((Array.isArray(allSegments) ? allSegments : []).map(s => [s.id, s])), [allSegments]);
    const listsMap = useMemo(() => new Map((Array.isArray(allLists) ? allLists : []).map(l => [l.id, l])), [allLists]);

    const handleFlowClick = React.useCallback(async (flow: Flow) => {
        if (flow.status !== 'archived') {
            // Set immediately so UI opens fast (may only have trigger step from list view PERF-F3)
            setSelectedFlow(JSON.parse(JSON.stringify(flow)));
            setFlowViewTab('builder');

            // [FIX] Lazy-load full flow steps — the list response (PERF-F3) strips all non-trigger steps
            // for bandwidth. We must re-fetch the single flow to get the complete step chain.
            try {
                const res = await api.get<Flow>(`flows?id=${flow.id}`);
                if (res.success && res.data) {
                    setSelectedFlow(res.data);
                }
            } catch (e) {
                console.warn('[FlowClick] Failed to lazy-load full flow steps:', e);
            }
        }
    }, []);


    const handleOpenCampaign = React.useCallback((c: Campaign) => {
        // [FIX] Navigate to Campaigns page and open report there for better context
        navigate('/marketing/campaigns', { state: { openCampaignId: c.id } });
    }, [navigate]);
    const handleOpenForm = React.useCallback((f: FormDefinition) => setSelectedFormForEdit(f), []);
    const handleOpenPurchase = React.useCallback((event: PurchaseEvent) => {
        setSelectedPurchaseEvent(event);
    }, []);
    const handleOpenCustomEvent = React.useCallback((event: CustomEvent) => {
        setSelectedCustomEvent(event);
    }, []);
    const handleOpenList = React.useCallback((list: any) => navigate(`/marketing/audience?list_id=${list.id}`), [navigate]);
    const handleOpenSegment = React.useCallback((segment: Segment) => navigate(`/marketing/audience?segment_id=${segment.id}`), [navigate]);
    const handleOpenTag = React.useCallback((tag: string) => setViewingGroup({ id: tag, name: tag, type: 'tag', count: 0 }), []);
    const handleDuplicateFlow = React.useCallback(async (flow: Flow) => {
        setConfirmModal({
            isOpen: true,
            title: 'Nhân bản Flow',
            message: `Bạn có chắc chắn muốn nhân bản flow "${flow.name}" không?`,
            variant: 'warning',
            confirmLabel: 'Nhân bản ngay',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}');
                const creatorInfo = user.name ? { name: user.name, picture: user.picture || "/imgs/ICON.png" } : null;

                setLoading(true);
                try {
                    // Call backend dedicated duplicate route (clones complete steps from DB)
                    const res = await api.post<any>(`flows?route=duplicate&id=${flow.id}`, {
                        name: `${flow.name} (Bản sao)`,
                        creator: creatorInfo || { name: 'Hệ thống', picture: '/imgs/ICON.png' }
                    });

                    if (res && res.success) {
                        showToast('Đã nhân bản kịch bản thành công!', 'success');
                        loadData();
                    } else {
                        // Fallback: Fetch complete flow by ID then POST
                        const fullFlowRes = await api.get<any>(`flows/${flow.id}`);
                        const fullFlow = fullFlowRes?.data || fullFlowRes;
                        if (!fullFlow || !fullFlow.steps) {
                            throw new Error(res?.message || 'Lỗi khi nhân bản kịch bản');
                        }
                        const { id, stats, status, createdAt, archivedAt, ...rest } = fullFlow;
                        const newFlow = {
                            ...rest,
                            name: `${flow.name} (Bản sao)`,
                            status: 'draft' as const,
                            stats: { enrolled: 0, completed: 0, totalSent: 0, totalOpened: 0, uniqueOpened: 0, totalClicked: 0, uniqueClicked: 0 },
                            config: {
                                ...fullFlow.config,
                                creator: creatorInfo || { name: 'Hệ thống', picture: '/imgs/ICON.png' }
                            }
                        };
                        const createRes = await api.post<Flow>('flows', newFlow);
                        if (createRes && createRes.success) {
                            showToast('Đã nhân bản kịch bản thành công!', 'success');
                            loadData();
                        } else {
                            showToast(createRes?.message || 'Lỗi khi nhân bản kịch bản', 'error');
                        }
                    }
                } catch (error: any) {
                    console.error('Duplicate flow error:', error);
                    showToast('Đã xảy ra lỗi khi nhân bản kịch bản', 'error');
                } finally {
                    setLoading(false);
                }
            }
        });
    }, [loadData, showToast]);


    const handleConfirmActivation = async (activateCampaign: boolean) => {
        if (!activateContext) return;
        const { flow } = activateContext;
        setIsSaving(true);
        try {
            const updatedFlow: Flow = { ...flow, status: 'active' };
            const res = await api.put(`flows/${flow.id}`, { ...updatedFlow, activate_campaign: activateCampaign });
            if (!res.success) throw new Error(res.message || 'Lỗi khi kích hoạt kịch bản');

            await handleUpdateFlow(updatedFlow, true, undefined, true);
            logAction("Kích hoạt Flow" + (activateCampaign ? " & Chiến dịch" : ""), flow.name, flow.id);

            const trigger = flow.steps?.find(s => s.type === 'trigger');
            if (activateCampaign && trigger?.config?.targetId) {
                setCampaigns(prev => prev.map(c => c.id === trigger.config.targetId ? { ...c, status: 'scheduled' } as any : c));
            }
            showToast('Đã kích hoạt thành công.');
            setTimeout(() => {
                if (trigger?.config?.type === 'campaign') navigate('/marketing/campaigns');
                else setSelectedFlow(null);
            }, 500);
        } catch (error: any) {
            showToast(error.message || 'Lỗi khi kích hoạt', 'error');
        } finally {
            setIsActivateModalOpen(false);
            setActivateContext(null);
            setIsSaving(false);
        }
    };

    const handleRestoreFlow = async (flow: Flow) => {
        setConfirmModal({
            isOpen: true,
            title: 'Khôi phục Flow',
            message: `Bạn có muốn khôi phục flow "${flow.name}" về Trạng thái Tạm dừng không?`,
            variant: 'warning',
            confirmLabel: 'Khôi phục ngay',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setLoading(true);
                try {
                    const updated = { ...flow, status: 'paused' as const, archivedAt: undefined };
                    const res = await api.put(`flows/${flow.id}`, updated);
                    if (res.success) {
                        const newLogs = logAction("Khôi phục kịch bản", flow.name);
                        setHistoryLogs(newLogs);
                        showToast('Đã khôi phục kịch bản. Hãy kích hoạt lại để chạy.');
                        loadData();
                    } else {
                        showToast(res.message || 'Lỗi khi khôi phục kịch bản', 'error');
                    }
                } catch (error) {
                    showToast('Lỗi hệ thống khi khôi phục kịch bản', 'error');
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleSync = async () => {
        if (!selectedFlow) return;
        setConfirmModal({
            isOpen: true,
            title: 'Đồng bộ dữ liệu',
            message: 'Hệ thống sẽ tính toán lại toàn bộ thống kê của Flow này. Quá trình này có thể mất vài giây.',
            variant: 'warning',
            confirmLabel: 'Đồng bộ ngay',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                setIsSyncing(true);
                try {
                    const res = await api.get<any>(`flows?route=sync&id=${selectedFlow.id}`);
                    if (res.success) {
                        toast.success("Đã đồng bộ và tính toán lại dữ liệu");
                        // Reload flow to get updated stats
                        const reloadRes = await api.get<Flow>(`flows/${selectedFlow.id}`);
                        if (reloadRes.success) {
                            setSelectedFlow(reloadRes.data);
                        }
                    } else {
                        toast.error(res.message || "Lỗi khi đồng bộ dữ liệu");
                    }
                } catch (err) {
                    toast.error("Lỗi hệ thống khi đồng bộ");
                } finally {
                    setIsSyncing(false);
                }
            }
        });
    };

    const handleDeleteFlow = async (flow: Flow, permanent = false) => {
        if (permanent) {
            setConfirmModal({
                isOpen: true, title: 'Xóa vĩnh viễn?', message: 'Hành động này sẽ xóa sạch mọi dữ liệu liên quan và không thể khôi phục.', variant: 'danger',
                requireConfirmText: 'DELETE',
                onConfirm: async () => {
                    setLoading(true);
                    try {
                        const res = await api.delete(`flows/${flow.id}`);
                        if (res.success) {
                            logAction("Xóa vĩnh viễn kịch bản", flow.name);
                            showToast('Đã xóa vĩnh viễn kịch bản.');
                            loadData();
                        } else {
                            showToast(res.message || 'Lỗi khi xóa kịch bản', 'error');
                        }
                    } catch (error) {
                        showToast('Lỗi hệ thống khi xóa kịch bản', 'error');
                    } finally {
                        setLoading(false);
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    }
                }
            });
            return;
        }

        // SMART DELETION LOGIC
        // 1. Check for Active Users
        const res = await api.get<any>(`flows?id=${flow.id}&route=active-count`);
        const activeCount = res.success ? res.data.count : 0;

        if (activeCount > 0) {
            setConfirmModal({
                isOpen: true,
                title: 'Cảnh báo: Đang có người dùng',
                message: `Hiện có ${activeCount} người đang ở trong Flow này (đang chạy hoặc đang xử lý). Bạn muốn xử lý thế nào?`,
                variant: 'danger',
                confirmLabel: 'Hủy đăng ký & Xóa (Force Exit)',
                requireConfirmText: 'CONFIRM',
                // FIX: Add secondary action for Archive Only needs bespoke modal, but here leveraging onConfirm/onCancel or custom
                // Simplifying: offer "Force Exit & Archive" vs "Cancel". 
                // Wait, user asked for "Next step users down new flow" OR "Remove from automation".
                // Since "Next step" is complex migration UI, I will provide "Remove from Automation" and a Warning.

                // Let's stick to the prompt's request: "xóa flow thì thông báo có xx người... gỡ khỏi automation luôn"
                onConfirm: async () => {
                    setLoading(true);
                    try {
                        await api.post(`flows?id=${flow.id}&route=migrate-users`, { action: 'cancel' });
                        const updated = { ...flow, status: 'archived' as const, archivedAt: new Date().toISOString() };
                        const res = await api.put(`flows/${flow.id}`, updated);
                        if (res.success) {
                            logAction("Xóa & Hủy Active Users", flow.name);
                            showToast(`Đã hủy ${activeCount} người dùng và chuyển Flow vào thùng rác.`);
                            loadData();
                            if (selectedFlow && selectedFlow.id === flow.id) {
                                setSelectedFlow(null);
                                setHasUnsavedChanges(false);
                            }
                        } else {
                            showToast(res.message || 'Lỗi khi lưu trữ kịch bản', 'error');
                        }
                    } catch (error) {
                        showToast('Lỗi hệ thống khi xóa và hủy người dùng', 'error');
                    } finally {
                        setLoading(false);
                        setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    }
                }
            });
            return;
        }

        const isActive = flow.status === 'active';
        setConfirmModal({
            isOpen: true, title: isActive ? 'Kịch bản đang chạy' : 'Xóa vào thùng rác?',
            message: isActive ? 'Nếu xóa, hệ thống sẽ ngừng xử lý các email đang chạy' : 'Kịch bản sẽ được giữ trong thùng rác 30 ngày.',
            variant: isActive ? 'danger' : 'warning',
            onConfirm: async () => {
                setLoading(true);
                try {
                    const updated = { ...flow, status: 'archived' as const, archivedAt: new Date().toISOString() };
                    const res = await api.put(`flows/${flow.id}`, updated);
                    if (res.success) {
                        logAction("Chuyển vào thùng rác", flow.name);
                        showToast('Đã chuyển vào thùng rác.');
                        loadData();
                        if (selectedFlow && selectedFlow.id === flow.id) {
                            setSelectedFlow(null);
                            setHasUnsavedChanges(false);
                        }
                    } else {
                        showToast(res.message || 'Lỗi khi chuyển vào thùng rác', 'error');
                    }
                } catch (error) {
                    showToast('Lỗi hệ thống khi chuyển vào thùng rác', 'error');
                } finally {
                    setLoading(false);
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            }
        });
    };

    const handleAddStep = useCallback(async (type: any, skipContinuationCheck = false, forcedId?: string) => {
        if (!selectedFlow || !addStepContext) return;
        const { parentId, branch, isInsert } = addStepContext;

        if (!skipContinuationCheck && (selectedFlow.status === 'active' || selectedFlow.status === 'paused')) {
            setLoading(true);
            try {
                const res = await api.get<any>(`flows?id=${selectedFlow.id}&route=completed-users`);
                if (res.success && res.data && res.data.total > 0) {
                    const parentStep = selectedFlow.steps?.find(s => s.id === parentId);
                    const branchCounts = res.data.byBranch || {};
                    const namedBranches: { [key: string]: number } = {};
                    const flowLabels = generateFlowStepLabels(selectedFlow);

                    Object.entries(branchCounts).forEach(([stepId, count]) => {
                        const labelInfo = flowLabels[stepId];
                        const label = labelInfo ? labelInfo.fullLabel : (stepId === 'completed' || stepId === 'main' ? 'Đã Hoàn thành' : 'Không xác định');
                        namedBranches[label] = count as number;
                    });

                    const isAffected = Object.keys(branchCounts).includes(parentId);
                    const pendingId = crypto.randomUUID();

                    setContinuationModal({
                        isOpen: true,
                        completedUsers: { total: res.data.total, byBranch: namedBranches },
                        newStepInfo: { type, label: getStepLabel(type), parentStepLabel: parentStep?.label || 'Unknown', branch: addStepContext.branch || 'main' },
                        pendingStepType: type,
                        pendingStepId: pendingId,
                        parentId: parentId,
                        branch: addStepContext.branch,
                        isAffected: isAffected
                    });
                    return;
                }
            } catch (error) {
                showToast('Lỗi khi kiểm tra dữ liệu người dùng', 'error');
            } finally {
                setLoading(false);
            }
        }

        // Proceed with adding step (original logic)
        const newStepId = forcedId || crypto.randomUUID();
        const parentStep = selectedFlow.steps?.find(s => s.id === parentId);
        if (!parentStep) return;

        const getDefaultConfig = (stepType: string) => {
            if (stepType === 'wait') {
                return { duration: 1, unit: 'hours' };
            }
            if (stepType === 'condition') {
                return {
                    conditionType: 'opened',
                    waitDuration: 1,
                    waitUnit: 'days',
                    linkTargets: []
                };
            }
            if (stepType === 'split_test') {
                return {
                    ratioA: 50,
                    ratioB: 50
                };
            }
            if (stepType === 'advanced_condition') {
                const defaultCond = [{ field: 'crm_stage_id', operator: 'equals', value: '1' }];
                return {
                    branches: [
                        {
                            id: crypto.randomUUID(),
                            label: 'Nhánh 1',
                            conditions: defaultCond,
                            conditionGroup: { logic: 'AND', conditions: defaultCond }
                        }
                    ]
                };
            }
            if (stepType === 'crm_action') {
                return {
                    actionType: 'update_stage',
                    stage_id: '1',
                    lead_status: 'active',
                    temperature: 'warm'
                };
            }
            return {};
        };

        const newStep: FlowStep = {
            id: newStepId,
            type,
            label: getStepLabel(type),
            iconName: getStepIcon(type),
            config: getDefaultConfig(type)
        };

        let updatedSteps = [...(selectedFlow.steps || []), newStep];
        let updatedParent = { ...parentStep };

        if (parentStep.type === 'advanced_condition') {
            // Logic for Advanced Condition Dynamic Branches
            if (branch) {
                const branches = [...(updatedParent.config.branches || [])];
                const branchIndex = branches.findIndex((b: any) => b.id === branch);
                if (branchIndex !== -1) {
                    const oldNextId = branches[branchIndex].nextStepId || branches[branchIndex].stepId;
                    branches[branchIndex] = { ...branches[branchIndex], stepId: newStepId, nextStepId: newStepId };
                    updatedParent.config = { ...updatedParent.config, branches };

                    // [FIX] Correctly bridge the old child to the new step's primary output
                    if (isInsert && oldNextId) {
                        if (newStep.type === 'condition') newStep.yesStepId = oldNextId;
                        else if (newStep.type === 'split_test') newStep.pathAStepId = oldNextId;
                        else if (newStep.type === 'advanced_condition') newStep.config.defaultStepId = oldNextId;
                        else newStep.nextStepId = oldNextId;
                    }
                }
            } else {
                // No branch specified -> Default Step
                const oldNextId = updatedParent.config.defaultStepId;
                updatedParent.config = { ...updatedParent.config, defaultStepId: newStepId };

                // [FIX] Correctly bridge the old child
                if (isInsert && oldNextId) {
                    if (newStep.type === 'condition') newStep.yesStepId = oldNextId;
                    else if (newStep.type === 'split_test') newStep.pathAStepId = oldNextId;
                    else if (newStep.type === 'advanced_condition') newStep.config.defaultStepId = oldNextId;
                    else newStep.nextStepId = oldNextId;
                }
            }
        } else {
            const linkKey = branch === 'yes' ? 'yesStepId' : (branch === 'no' ? 'noStepId' : (branch === 'A' ? 'pathAStepId' : (branch === 'B' ? 'pathBStepId' : 'nextStepId')));
            const oldNextId = (updatedParent as any)[linkKey];
            (updatedParent as any)[linkKey] = newStepId;

            // [FIX] MISSION-CRITICAL: When inserting a branching node (Condition/Split), 
            // the 'oldNextId' must be assigned to the 'Yes/A' branch, NOT 'nextStepId'.
            if (isInsert && oldNextId) {
                if (newStep.type === 'condition') newStep.yesStepId = oldNextId;
                else if (newStep.type === 'split_test') newStep.pathAStepId = oldNextId;
                else if (newStep.type === 'advanced_condition') {
                    if (!newStep.config) newStep.config = {};
                    newStep.config.defaultStepId = oldNextId;
                }
                else newStep.nextStepId = oldNextId;
            }
        }

        updatedSteps = updatedSteps.map(s => s.id === parentId ? updatedParent : s);
        handleUpdateFlow({ ...selectedFlow, steps: updatedSteps }, false, `Thêm bước ${newStep.label}`, selectedFlow.status === 'active');
    }, [selectedFlow, addStepContext, handleUpdateFlow]);

    const handleQuickAddWait = useCallback((parentId: string, branch?: any) => {
        if (!selectedFlow) return;
        const parentStep = selectedFlow.steps?.find(s => s.id === parentId);
        if (!parentStep) return;
        const newStepId = crypto.randomUUID();
        const newStep: FlowStep = { id: newStepId, type: 'wait', label: 'Chờ 1 ngày', iconName: 'clock', config: { duration: 1, unit: 'days' } };
        let updatedSteps = [...(selectedFlow.steps || []), newStep];
        let updatedParent = { ...parentStep };
        if (parentStep.type === 'advanced_condition') {
            if (branch) {
                const branches = [...(updatedParent.config.branches || [])];
                const branchIndex = branches.findIndex((b: any) => b.id === branch);
                if (branchIndex !== -1) {
                    const oldNextId = branches[branchIndex].nextStepId || branches[branchIndex].stepId;
                    branches[branchIndex] = { ...branches[branchIndex], stepId: newStepId, nextStepId: newStepId };
                    updatedParent.config = { ...updatedParent.config, branches };
                    if (oldNextId) newStep.nextStepId = oldNextId;
                }
            } else {
                const oldNextId = updatedParent.config.defaultStepId;
                updatedParent.config = { ...updatedParent.config, defaultStepId: newStepId };
                if (oldNextId) newStep.nextStepId = oldNextId;
            }
        } else {
            const linkKey = branch === 'yes' ? 'yesStepId' : (branch === 'no' ? 'noStepId' : (branch === 'A' ? 'pathAStepId' : (branch === 'B' ? 'pathBStepId' : 'nextStepId')));
            const oldNextId = (updatedParent as any)[linkKey];
            (updatedParent as any)[linkKey] = newStepId;
            if (oldNextId) newStep.nextStepId = oldNextId;
        }
        updatedSteps = updatedSteps.map(s => s.id === parentId ? updatedParent : s);
        // Explicitly skip API if active
        handleUpdateFlow({ ...selectedFlow, steps: updatedSteps }, false, "Thêm bước Chờ nhanh", selectedFlow.status === 'active');
    }, [selectedFlow, handleUpdateFlow]);

    const handleDeleteStep = (stepId: string) => {
        if (!selectedFlow) return;
        const steps = selectedFlow.steps || [];
        const stepToDelete = steps?.find(s => s.id === stepId);
        if (!stepToDelete) return;

        // Smart Delete Logic: Find the child of the deleted step to bridge the gap
        // Only bridge for simple steps (Action, Wait, Tag, Link, List, CRM Action) that have a single output
        let bridgeId: string | undefined = undefined;
        if (['action', 'wait', 'update_tag', 'trigger', 'list_action', 'zalo_zns', 'link_flow', 'crm_action'].includes(stepToDelete.type)) {
            bridgeId = stepToDelete.nextStepId;
        }
        // For conditions/split tests, bridging is ambiguous, so we break the link (bridgeId = undefined)

        let updatedSteps = steps.filter(s => s.id !== stepId).map(s => {
            const newS = { ...s };
            // If the parent pointed to the deleted step, point it to the bridgeId instead
            if (newS.nextStepId === stepId) newS.nextStepId = bridgeId;
            if (newS.yesStepId === stepId) newS.yesStepId = bridgeId;
            if (newS.noStepId === stepId) newS.noStepId = bridgeId;
            if (newS.pathAStepId === stepId) newS.pathAStepId = bridgeId;
            if (newS.pathBStepId === stepId) newS.pathBStepId = bridgeId;
            if (newS.type === 'advanced_condition') {
                if (newS.config.defaultStepId === stepId) newS.config = { ...newS.config, defaultStepId: bridgeId };
                if (newS.config.branches) {
                    const branches = newS.config.branches.map((b: any) => {
                        if (b.stepId === stepId || b.nextStepId === stepId) return { ...b, stepId: bridgeId, nextStepId: bridgeId };
                        return b;
                    });
                    newS.config = { ...newS.config, branches };
                }
            }
            return newS;
        });

        // AUTO-PURGE: Remove steps that are no longer reachable
        updatedSteps = getReachableSteps(updatedSteps);

        // Explicitly skip API if active
        handleUpdateFlow({ ...selectedFlow, steps: updatedSteps }, false, `Xóa bước ${stepToDelete?.label}`, selectedFlow.status === 'active');
        setEditingStep(null);
    };

    const triggerTypes = [
        { id: 'all', label: 'Tất cả loại', icon: LayoutGrid },
        { id: 'campaign', label: 'Chiến dịch', icon: Send },
        { id: 'segment', label: 'Phân khúc', icon: Layers },
        { id: 'date', label: 'Ngày/Sự kiện', icon: BellRing },
        { id: 'form', label: 'Form submit', icon: FileInput },
        { id: 'tag', label: 'Gắn Tag', icon: Tag },
        { id: 'purchase', label: 'Mua hàng', icon: Target },
        { id: 'custom_event', label: 'Sự kiện tùy chỉnh', icon: GitMerge },
    ];

    const handleManualSave = () => {
        if (!selectedFlow) return;
        const isActive = selectedFlow.status === 'active';
        const errors = validateFlow(selectedFlow, flows, isActive);

        const criticalErrors = errors.filter(e => e.type === 'critical');
        if (criticalErrors.length > 0) {
            showToast('Không thể lưu: Có lỗi nghiêm trọng. Vui lòng kiểm tra lại.', 'error');
            setValidationErrors(errors);
            return;
        }

        const warnings = errors.filter(e => e.type === 'warning');

        const performSave = async () => {
            setIsSaving(true);
            try {
                if (pendingMigrations.length > 0) {
                    for (const migration of pendingMigrations) {
                        const res = await api.post(`flows?id=${migration.flowId}&route=migrate-users`, {
                            action: migration.action,
                            continueAll: migration.continueAll,
                            branches: migration.branches,
                            targetStepId: migration.targetStepId
                        });
                        if (!res.success) throw new Error(res.message || 'Lỗi khi di chuyển người dùng');
                    }
                    setPendingMigrations([]);
                    // [FIX] migrate-users thay đổi stats.completed trong DB (người được re-enroll
                    // về step mới không còn ở trạng thái 'completed' nữa). Fetch lại stats của flow
                    // này để FlowCard ngoài danh sách hiển thị đúng thay vì giữ giá trị cũ (100%).
                    try {
                        const freshRes = await api.get<any>(`flows?id=${selectedFlow!.id}&route=stats`);
                        if (freshRes.success && freshRes.data) {
                            const freshStats = freshRes.data;
                            setFlows(prev => prev.map(f =>
                                f.id === selectedFlow!.id ? { ...f, stats: freshStats } : f
                            ));
                            setSelectedFlow(sf => sf ? { ...sf, stats: freshStats } : sf);
                        }
                    } catch { /* Non-critical — stats sẽ đúng sau lần reload tiếp theo */ }
                }
                await handleUpdateFlow(selectedFlow, false); // Không log 'Lưu thủ công' vào lịch sử
                // Snapshot saved automatically inside handleUpdateFlow via API
                
                // Clear dirty flags after successful save
                setHasUnsavedChanges(false); 
                setIsNewUnsavedFlow(false);

                showToast('Đã lưu thành công.');
            } catch (error: any) {
                showToast(error.message || 'Lỗi khi lưu kịch bản', 'error');
            } finally {
                setIsSaving(false);
            }
        };

        if (warnings.length > 0) {
            setConfirmModal({
                isOpen: true,
                title: 'Cảnh báo cấu hình',
                message: `Phát hiện ${warnings.length} cảnh báo. Bạn có chắc chắn muốn lưu?`,
                variant: 'warning',
                confirmLabel: 'Xác nhận lưu',
                onConfirm: async () => {
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                    // If Active, ask again? Or just proceed?
                    if (isActive) {
                        // Chained modal workaround: setTimeout to allow modal close then open new one
                        setTimeout(() => {
                            setConfirmModal({
                                isOpen: true, title: 'Xác nhận Lưu Flow đang chạy',
                                message: 'Flow đang hoạt động. Bạn có chắc luồng đã an toàn không?',
                                variant: 'warning',
                                confirmLabel: 'Xác nhận lưu',
                                onConfirm: async () => { await performSave(); setConfirmModal(p => ({ ...p, isOpen: false })); }
                            });
                        }, 200);
                    } else {
                        await performSave();
                    }
                }
            });
            return;
        }

        if (isActive) {
            setConfirmModal({
                isOpen: true,
                title: 'Flow đang chạy',
                message: 'Flow đang hoạt động. Bất kỳ thay đổi nào sẽ áp dụng ngay lập tức cho người dùng. Bạn có chắc luồng đã an toàn và không bị ngắt quãng?',
                variant: 'warning',
                confirmLabel: 'Xác nhận lưu',
                onConfirm: async () => {
                    await performSave();
                    setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }
            });
        } else {
            performSave();
        }
    };

    const durationInfo = useMemo(() => {
        if (!selectedFlow) return null;
        const { minMinutes, maxMinutes, breakdown } = calculateFlowDuration(selectedFlow);
        return {
            min: formatDuration(minMinutes),
            max: formatDuration(maxMinutes),
            breakdown
        };
    }, [selectedFlow?.steps]);

    const mailZnsInfo = useMemo(() => {
        if (!selectedFlow) return null;
        
        const totalCount = (selectedFlow.steps || []).filter(s => s.type === 'action' || s.type === 'zalo_zns').length;
        
        const maxPathCount = (currentStepId, currentCount, visited) => {
            if (!currentStepId || visited.has(currentStepId)) return currentCount;
            const step = selectedFlow.steps?.find(s => s.id === currentStepId);
            if (!step) return currentCount;
            
            let newCount = currentCount;
            if (step.type === 'action' || step.type === 'zalo_zns') {
                newCount += 1;
            }
            
            const newVisited = new Set(visited);
            newVisited.add(currentStepId);
            
            const children = [];
            if (step.nextStepId) children.push(step.nextStepId);
            if (step.yesStepId) children.push(step.yesStepId);
            if (step.noStepId) children.push(step.noStepId);
            if (step.pathAStepId) children.push(step.pathAStepId);
            if (step.pathBStepId) children.push(step.pathBStepId);
            if (step.type === 'advanced_condition') {
                if (step.config?.defaultStepId) children.push(step.config.defaultStepId);
                if (step.config?.branches) {
                    step.config.branches.forEach(b => {
                        const targetId = b.nextStepId || b.stepId;
                        if (targetId) children.push(targetId);
                    });
                }
            }
            
            if (children.length === 0) return newCount;
            return Math.max(...children.map(childId => maxPathCount(childId, newCount, newVisited)));
        };
        
        const trigger = selectedFlow.steps?.find(s => s.type === 'trigger');
        let maxCount = 0;
        if (trigger) {
            maxCount = maxPathCount(trigger.id, 0, new Set());
        }
        
        return { total: totalCount, maxBranch: maxCount };
    }, [selectedFlow?.steps]);




    // Filtered logs for the selected flow - Move to top level to avoid Hook violation
    const currentFlowLogs = useMemo(() => {
        if (!selectedFlow) return [];
        return historyLogs.filter(log =>
            log.flowId === selectedFlow.id ||
            (log.details && log.details.includes(`Flow: ${selectedFlow.name}`))
        );
    }, [historyLogs, selectedFlow?.id, selectedFlow?.name]);

    // Stat summaries for hero — single pass over real API data (Zero mock)
    const flowStats = useMemo(() => {
        const s = { total: 0, active: 0, paused: 0, draft: 0, archived: 0, enrolled: 0, enrolledActive: 0, completed: 0, failed: 0 };
        for (const f of (Array.isArray(flows) ? flows : [])) {
            const enrolled = f.stats?.enrolled || 0;
            s.enrolled += enrolled;
            s.completed += f.stats?.completed || 0;
            s.failed += (f.stats as any)?.totalFailed || 0;
            if (f.status === 'archived') { s.archived++; continue; }
            s.total++;
            if (f.status === 'active') { s.active++; s.enrolledActive += enrolled; }
            else if (f.status === 'paused') s.paused++;
            else if (f.status === 'draft') s.draft++;
        }
        return s;
    }, [flows]);

    const statusTabItems = useMemo(() => ([
        { id: 'active', label: 'Đang chạy', icon: PlayCircle, count: flowStats.active },
        { id: 'all', label: 'Tất cả', icon: LayoutGrid, count: flowStats.total },
        { id: 'paused', label: 'Tạm dừng', icon: PauseCircle, count: flowStats.paused },
        { id: 'draft', label: 'Bản nháp', icon: FileText, count: flowStats.draft },
        { id: 'archived', label: 'Thùng rác', icon: Trash2, count: flowStats.archived },
    ]), [flowStats]);

    const isFiltering = filterType !== 'all' || datePreset !== 'all' || debouncedFlowSearch.trim() !== '';

    const renderFlowItem = (flow: Flow) => {
        const trigger = flow.steps?.find(s => s.type === 'trigger');
        const targetId = trigger?.config?.targetId;
        const type = trigger?.config?.type || 'segment';
        const subtype = trigger?.config?.targetSubtype;

        // isListTarget: explicitly 'list' or 'sync' subtype → stored in lists table
        const isListTarget = subtype === 'list' || subtype === 'sync' || (type === 'segment' && !subtype && !!targetId && listsMap.has(targetId));

        return (
            <FlowCard
                key={flow.id}
                flow={flow}
                isList={viewMode === 'list'}
                selected={selectedFlowIds.has(flow.id)}
                onToggleSelect={() => handleToggleSelectFlow(flow.id)}
                linkedCampaign={type === 'campaign' ? campaignsMap.get(targetId!) : undefined}
                linkedForm={type === 'form' ? formsMap.get(targetId!) : undefined}
                linkedPurchaseEvent={type === 'purchase' ? purchaseEventsMap.get(targetId!) : undefined}
                linkedCustomEvent={type === 'custom_event' ? customEventsMap.get(targetId!) : undefined}
                linkedSegment={(type === 'segment' && !isListTarget) ? segmentsMap.get(targetId!) : undefined}
                linkedList={(type === 'segment' && isListTarget) ? listsMap.get(targetId!) : undefined}
                linkedTag={type === 'tag' ? targetId : undefined}
                onClick={() => handleFlowClick(flow)}
                onDelete={(p) => handleDeleteFlow(flow, p)}
                onRestore={() => handleRestoreFlow(flow)}
                onDuplicate={handleDuplicateFlow}
                onOpenCampaign={handleOpenCampaign}
                onOpenForm={handleOpenForm}
                onOpenPurchase={handleOpenPurchase}
                onOpenCustomEvent={handleOpenCustomEvent}
                onOpenList={handleOpenList}
                onOpenSegment={handleOpenSegment}
                onOpenTag={handleOpenTag}
            />
        );
    };

    const toolbarControlCls = 'h-9 inline-flex items-center gap-1.5 px-3 text-[13px] font-medium rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

    return (
        <div className="w-full flex flex-col gap-5">
            {!selectedFlow && (
                <>
                    <PageHero
                        title="Kịch bản Automation"
                        subtitle="Quản lý vòng đời khách hàng tự động — nuôi dưỡng & chuyển đổi thông minh đa kênh."
                        actions={[
                            {
                                label: 'Tạo kịch bản',
                                icon: Plus,
                                primary: true,
                                onClick: adminGuard(() => setIsCreateModalOpen(true), 'tạo kịch bản automation'),
                            },
                        ]}
                    />

                    {/* Stat row — 4 cards in ONE row on desktop (contract §1) */}
                    <StatGrid cols={4}>
                        <StatCard
                            title="Tổng kịch bản"
                            value={flowStats.total.toLocaleString('vi-VN')}
                            icon={<LayoutGrid />}
                            color="#334155"
                            loading={!hasLoaded}
                            breakdown={
                                <>
                                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-600" />Hoạt động: {flowStats.active}</span>
                                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Bản nháp: {flowStats.draft}</span>
                                </>
                            }
                        />
                        <StatCard
                            title="Đang hoạt động"
                            value={flowStats.active.toLocaleString('vi-VN')}
                            icon={<Zap />}
                            color="#0f172a"
                            loading={!hasLoaded}
                            breakdown={
                                <>
                                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-600" />Đang chạy: {flowStats.active}</span>
                                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Tạm dừng: {flowStats.paused}</span>
                                </>
                            }
                        />
                        <StatCard
                            title="Lượt tham gia"
                            value={flowStats.enrolled.toLocaleString('vi-VN')}
                            icon={<Users />}
                            color="#64748b"
                            loading={!hasLoaded}
                            breakdown={
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-600" />Ở flow đang chạy: {flowStats.enrolledActive.toLocaleString('vi-VN')}</span>
                            }
                        />
                        <StatCard
                            title="Hoàn thành"
                            value={flowStats.completed.toLocaleString('vi-VN')}
                            icon={<CheckCircle2 />}
                            color="#C6333D"
                            loading={!hasLoaded}
                            breakdown={
                                <>
                                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Tỷ lệ: {flowStats.enrolled > 0 ? Math.round((flowStats.completed / flowStats.enrolled) * 100) : 0}%</span>
                                    <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Lỗi/Bỏ qua: {flowStats.failed.toLocaleString('vi-VN')}</span>
                                </>
                            }
                        />
                    </StatGrid>

                    {/* Main panel (contract §1) */}
                    <Panel
                        header={
                            <Toolbar
                                left={
                                    <Tabs
                                        variant="segmented"
                                        size="sm"
                                        activeId={activeTab}
                                        onChange={(id) => setActiveTab(id as FlowFilter)}
                                        className="flex-nowrap overflow-x-auto scrollbar-hide"
                                        items={statusTabItems}
                                    />
                                }
                                right={
                                    <>
                                        {activeTab === 'archived' && selectedFlowIds.size > 0 && (
                                            <button
                                                type="button"
                                                onClick={handleBulkDeletePermanent}
                                                disabled={loading}
                                                className="h-9 inline-flex items-center gap-1.5 px-3 text-[13px] font-semibold rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Xóa vĩnh viễn ({selectedFlowIds.size})
                                            </button>
                                        )}
                                        {activeTab === 'archived' && (
                                            <button
                                                type="button"
                                                onClick={handleEmptyTrash}
                                                disabled={filteredFlows.length === 0 || loading}
                                                className={`${toolbarControlCls} text-rose-600`}
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                Làm sạch
                                            </button>
                                        )}

                                        {/* Grid / List toggle */}
                                        <div className="h-9 flex items-center p-0.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('grid')}
                                                className={`h-full px-2 rounded-[var(--radius-sm)] transition-colors ${viewMode === 'grid' ? 'bg-[var(--color-surface)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                                                title="Chế độ lưới"
                                                aria-pressed={viewMode === 'grid'}
                                            >
                                                <LayoutGrid className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('list')}
                                                className={`h-full px-2 rounded-[var(--radius-sm)] transition-colors ${viewMode === 'list' ? 'bg-[var(--color-surface)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                                                title="Chế độ danh sách"
                                                aria-pressed={viewMode === 'list'}
                                            >
                                                <List className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {/* Trigger type */}
                                        <div className="w-40">
                                            <Select
                                                size="sm"
                                                value={filterType}
                                                onChange={val => setFilterType(val as TriggerTypeFilter)}
                                                icon={Filter}
                                                options={triggerTypes.map(t => ({ value: t.id, label: t.label }))}
                                            />
                                        </div>

                                        {/* Date range */}
                                        <div className="w-36">
                                            <Select
                                                size="sm"
                                                value={datePreset}
                                                onChange={val => setDatePreset(val as typeof datePreset)}
                                                options={[
                                                    { value: 'all', label: 'Mọi thời gian' },
                                                    { value: '7', label: '7 ngày qua' },
                                                    { value: '30', label: '30 ngày qua' },
                                                    { value: 'month', label: 'Tháng này' },
                                                    { value: 'custom', label: 'Tùy chỉnh...' },
                                                ]}
                                            />
                                        </div>
                                        {datePreset === 'custom' && (
                                            <div className="h-9 flex items-center gap-1 border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-surface)] px-2">
                                                <input
                                                    type="date"
                                                    value={customDate.start}
                                                    onChange={e => setCustomDate(p => ({ ...p, start: e.target.value }))}
                                                    className="bg-transparent text-[13px] outline-none text-[var(--color-text)] w-[118px]"
                                                />
                                                <span className="text-[var(--color-text-muted)] text-xs">–</span>
                                                <input
                                                    type="date"
                                                    value={customDate.end}
                                                    onChange={e => setCustomDate(p => ({ ...p, end: e.target.value }))}
                                                    className="bg-transparent text-[13px] outline-none text-[var(--color-text)] w-[118px]"
                                                />
                                            </div>
                                        )}

                                        {/* Search (contract §1) */}
                                        <SearchBox
                                            value={flowSearch}
                                            onChange={setFlowSearch}
                                            onDebouncedChange={setDebouncedFlowSearch}
                                            debounceMs={300}
                                            placeholder="Tìm kịch bản..."
                                            className="w-56"
                                        />
                                    </>
                                }
                            />
                        }
                        footer={
                            hasLoaded && filteredFlows.length > 0 ? (
                                <div className="text-xs text-[var(--color-text-muted)]">
                                    Hiển thị {filteredFlows.length.toLocaleString('vi-VN')} kịch bản
                                </div>
                            ) : undefined
                        }
                    >
                        <div className="relative">
                            {/* Thin progress bar while refetching (stale data stays visible) */}
                            {loading && hasLoaded && (
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--color-primary-light)] overflow-hidden z-10">
                                    <div className="h-full w-1/3 bg-[var(--color-primary)] animate-pulse" />
                                </div>
                            )}

                            {!hasLoaded ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} className="h-[188px] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 flex flex-col gap-3">
                                            <div className="flex justify-between items-start">
                                                <Skeleton variant="rounded" width={40} height={40} className="rounded-[var(--radius-md)]" />
                                                <Skeleton variant="rounded" width={64} height={20} />
                                            </div>
                                            <Skeleton variant="text" width="75%" height={18} />
                                            <Skeleton variant="text" width="45%" height={12} />
                                            <div className="mt-auto">
                                                <Skeleton variant="rounded" width="100%" height={40} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filteredFlows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                                    <LayoutGrid className="w-10 h-10 text-[var(--color-text-muted)] opacity-60 mb-3" strokeWidth={1.5} />
                                    <p className="text-sm font-semibold text-[var(--color-text)]">
                                        {isFiltering ? 'Không có kịch bản phù hợp bộ lọc' : activeTab === 'archived' ? 'Thùng rác trống' : 'Chưa có kịch bản automation'}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-sm">
                                        {isFiltering
                                            ? 'Thử đổi loại kích hoạt, khoảng thời gian hoặc từ khóa tìm kiếm.'
                                            : 'Tạo kịch bản tự động để chăm sóc và chuyển đổi khách hàng đa kênh.'}
                                    </p>
                                    {isFiltering ? (
                                        <button
                                            type="button"
                                            onClick={() => { setFilterType('all'); setDatePreset('all'); setFlowSearch(''); setDebouncedFlowSearch(''); }}
                                            className="mt-4 h-9 px-4 text-[13px] font-semibold rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90"
                                        >
                                            Xóa bộ lọc
                                        </button>
                                    ) : activeTab !== 'archived' && (
                                        <button
                                            type="button"
                                            onClick={adminGuard(() => setIsCreateModalOpen(true), 'tạo kịch bản automation')}
                                            className="mt-4 h-9 px-4 inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90"
                                        >
                                            <Plus className="w-4 h-4" />
                                            Tạo kịch bản
                                        </button>
                                    )}
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 auto-rows-fr">
                                    {filteredFlows.map(renderFlowItem)}
                                </div>
                            ) : (
                                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                                    <table className="w-full text-sm">
                                        <thead className="sticky top-0 z-[1] bg-[var(--color-bg)] text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                                            <tr className="border-b border-[var(--color-border)]">
                                                {activeTab === 'archived' && <th className="w-10 px-4 py-3" />}
                                                <th className="px-4 py-3 text-left">Kịch bản</th>
                                                <th className="px-4 py-3 text-left">Trạng thái</th>
                                                <th className="px-4 py-3 text-right">Số bước</th>
                                                <th className="px-4 py-3 text-right">Tham gia</th>
                                                <th className="px-4 py-3 text-left">Hoàn thành</th>
                                                <th className="px-4 py-3 text-left">Người tạo</th>
                                                <th className="px-4 py-3 text-left">Ngày tạo</th>
                                                <th className="px-4 py-3 text-right">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredFlows.map(renderFlowItem)}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </Panel>
                </>
            )}

            {
                selectedFlow && location.pathname.startsWith('/marketing/flows') && createPortal(
                    <div data-lenis-prevent="true" style={{ zIndex: 2147483600 }} className="fixed inset-0 z-[2147483600] flex flex-col bg-white dark:bg-slate-900 animate-in fade-in duration-300 overflow-hidden">
                        <FlowHeader
                            flow={selectedFlow}
                            isSaving={isSaving}
                            hasCriticalErrors={(validationErrors || []).some(e => e.type === 'critical')}
                            isViewMode={isViewMode}
                            activeTab={flowViewTab}
                            durationInfo={durationInfo}
                            onBack={() => {
                                if (hasUnsavedChanges) {
                                    setConfirmModal({
                                        isOpen: true,
                                        title: 'Thay đổi chưa lưu',
                                        message: 'Bạn có thay đổi chưa lưu. Bạn có muốn lưu trước khi thoát không?',
                                        onConfirm: () => { handleManualSave(); setSelectedFlow(null); setConfirmModal(prev => ({ ...prev, isOpen: false })); },
                                        confirmLabel: 'Lưu & Thoát',
                                        dangerText: 'Thoát luôn',
                                        dangerAction: () => { setSelectedFlow(null); setConfirmModal(prev => ({ ...prev, isOpen: false })); setHasUnsavedChanges(false); }
                                    });
                                } else {
                                    setSelectedFlow(null);
                                }
                            }}
                            onTabChange={setFlowViewTab}
                            onToggleStatus={async () => {
                                if (!selectedFlow) return;
                                const isNowActive = selectedFlow.status === 'active';
                                const newStatus = isNowActive ? 'paused' : 'active';
                                if (newStatus === 'active') {
                                    const errors = validateFlow(selectedFlow, flows, true);
                                    if ((errors || []).some(e => e.type === 'critical')) {
                                        setValidationErrors(errors);
                                        setConfirmModal({
                                            isOpen: true,
                                            title: 'Không thể kích hoạt',
                                            message: 'Flow đang có lỗi nghiêm trọng. Vui lòng sửa hết lỗi trước khi kích hoạt.',
                                            variant: 'danger',
                                            confirmLabel: 'Đã hiểu',
                                            onConfirm: () => setConfirmModal(prev => ({ ...prev, isOpen: false }))
                                        });
                                        return;
                                    }
                                    const warnings = errors.filter(e => e.type === 'warning');
                                    if (warnings.length > 0) {
                                        setConfirmModal({
                                            isOpen: true,
                                            title: 'Cảnh báo cấu hình',
                                            message: `Flow có ${warnings.length} cảnh báo. Bạn có muốn kích hoạt không?`,
                                            variant: 'warning',
                                            confirmLabel: 'Kích hoạt ngay',
                                            onConfirm: async () => {
                                                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                                await handleUpdateFlow({ ...selectedFlow, status: newStatus }, false, `Kích hoạt Flow`);
                                            }
                                        });
                                        return;
                                    }
                                } else {
                                    // [FIX] Hiển thị hậu quả cụ thể dựa theo trigger type của flow
                                    const trigger = selectedFlow.steps?.find(s => s.type === 'trigger');
                                    const triggerType = trigger?.config?.type || 'unknown';
                                    const triggerTarget = trigger?.config?.targetId || trigger?.config?.targetName || '';

                                    // Lấy active count trước khi show modal
                                    let activeCount = 0;
                                    try {
                                        const countRes = await api.get<any>(`flows?id=${selectedFlow.id}&route=active-count`);
                                        if (countRes.success) activeCount = countRes.data?.count || 0;
                                    } catch { }

                                    const triggerWarnings: Record<string, string> = {
                                        form: 'Biểu mẫu: Người dùng mới điền form sẽ không được tham gia vào kịch bản này. Email xác nhận sẽ không được gửi.',
                                        purchase: 'Mua hàng: Đơn hàng mới sẽ không kích hoạt kịch bản. Quy trình chăm sóc sau mua hàng sẽ bị tạm dừng.',
                                        custom_event: 'Sự kiện tùy chỉnh: Các hành vi mới của khách hàng sẽ không được ghi nhận vào luồng tự động.',
                                        campaign: 'Chiến dịch: Liên kết với các email đang gửi sẽ bị ngắt. Hành động mở/click mail sẽ không kích hoạt bước tiếp theo.',
                                        tag: 'Gắn thẻ: Khách hàng được gắn thẻ mới sẽ không tự động tham gia vào kịch bản.',
                                        list: 'Danh sách: Khách hàng mới thêm vào danh sách sẽ không được xử lý tự động.',
                                        segment: 'Phân khúc: Khách hàng mới thỏa mãn điều kiện phân khúc sẽ không được đưa vào luồng.',
                                        date: 'Ngày kỷ niệm: Các lịch gửi theo ngày sinh hoặc kỷ niệm sẽ bị bỏ qua trong thời gian này.',
                                    };

                                    const specificWarning = triggerWarnings[triggerType] || 'Cơ chế kích hoạt (Trigger) của kịch bản này sẽ ngừng hoạt động.';
                                    const activeWarning = activeCount > 0
                                        ? `Hiện có ${activeCount} khách hàng đang trong luồng — tất cả sẽ bị tạm dừng xử lý cho đến khi được kích hoạt lại.`
                                        : 'Hiện không có khách hàng nào đang trong luồng xử lý.';

                                    setConfirmModal({
                                        isOpen: true,
                                        title: 'Tạm dừng Kịch bản',
                                        message: (
                                            <div className="space-y-4 text-left">
                                                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-[14px] flex gap-3">
                                                    <PauseCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                                                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200 leading-relaxed">
                                                        {specificWarning}
                                                    </p>
                                                </div>
                                                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-[14px] flex gap-3">
                                                    <Users className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                                                    <p className="text-sm font-medium text-blue-900 dark:text-blue-200 leading-relaxed">
                                                        {activeWarning}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-slate-500 italic px-1 font-medium">
                                                    * Bạn có thể kích hoạt lại bất cứ lúc nào, nhưng các sự kiện phát sinh trong thời gian tạm dừng sẽ không được xử lý hồi tố.
                                                </p>
                                            </div>
                                        ),
                                        variant: 'warning',
                                        confirmLabel: 'Xác nhận tạm dừng',
                                        onConfirm: async () => {
                                            setConfirmModal(prev => ({ ...prev, isOpen: false }));
                                            await handleUpdateFlow({ ...selectedFlow, status: newStatus }, false, "Tạm dừng Flow");
                                        }
                                    });
                                    return;
                                }
                                await handleUpdateFlow({ ...selectedFlow, status: newStatus }, false, isNowActive ? "Tạm dừng Flow" : "Kích hoạt Flow");
                            }}
                            onActivate={() => {
                                setActivateContext({ flow: selectedFlow });
                                setIsActivateModalOpen(true);
                            }}
                            onHistory={() => setIsHistoryModalOpen(true)}
                            onToggleViewMode={() => setIsViewMode(!isViewMode)}
                            onSave={handleManualSave}
                            onRestore={() => handleRestoreFlow(selectedFlow)}
                            onSimulate={() => setIsSimulateModalOpen(true)}
                            isSidebarOpen={isSidebarOpen}
                            onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                            onSync={handleSync}
                            isSyncing={isSyncing}
                            isReportMode={isReportMode}
                            onToggleReportMode={() => setIsReportMode(!isReportMode)}
                            onRename={(newName) => { if (selectedFlow) { setSelectedFlow({ ...selectedFlow, name: newName }); setHasUnsavedChanges(true); } }}
                            canSave={hasUnsavedChanges}
                        />
                        <div className="flex-1 flex overflow-hidden relative">
                            {/* MAIN CONTENT AREA */}
                            <TabTransition key={flowViewTab} className={`flex-1 overflow-hidden relative flex flex-col transition-all duration-300 ${isSidebarOpen && selectedFlow && flowViewTab === 'builder' ? 'ml-0' : ''}`}>
                                <div className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-slate-950 dark:bg-slate-950/50">
                                    <React.Suspense fallback={
                                        <div className="w-full h-full overflow-auto bg-slate-50 dark:bg-slate-950/50 flex flex-col items-center pt-10 pb-20 px-4">
                                            <style>{`
                                                @keyframes flow-shimmer {
                                                    0% { background-position: -400px 0; }
                                                    100% { background-position: 400px 0; }
                                                }
                                                .flow-sk {
                                                    background: linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);
                                                    background-size: 800px 100%;
                                                    animation: flow-shimmer 1.6s infinite linear;
                                                    border-radius: 10px;
                                                }
                                                .dark .flow-sk {
                                                    background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
                                                    background-size: 800px 100%;
                                                }
                                            `}</style>

                                            {/* ── Helper: connector arrow ── */}
                                            {/* TRIGGER NODE */}
                                            <div className="w-[300px] bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-700/60 shadow-sm p-4 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-[12px] flex-shrink-0 animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                                                <div className="flex-1 space-y-1.5">
                                                    <div className="flow-sk h-3 w-20 rounded" />
                                                    <div className="flow-sk h-4 w-36 rounded" />
                                                </div>
                                                <div className="flow-sk h-5 w-14 rounded-full" />
                                            </div>

                                            {/* connector */}
                                            <div className="flex flex-col items-center">
                                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                                                <div className="flow-sk w-6 h-6 rounded-full" />
                                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                                            </div>

                                            {/* WAIT NODE */}
                                            <div className="w-[300px] bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-700/60 shadow-sm p-4 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-[12px] flex-shrink-0 animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                                                <div className="flex-1 space-y-1.5">
                                                    <div className="flow-sk h-3 w-16 rounded" />
                                                    <div className="flow-sk h-4 w-28 rounded" />
                                                </div>
                                                <div className="flow-sk h-5 w-12 rounded-full" />
                                            </div>

                                            {/* connector */}
                                            <div className="flex flex-col items-center">
                                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                                                <div className="flow-sk w-6 h-6 rounded-full" />
                                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                                            </div>

                                            {/* EMAIL NODE */}
                                            <div className="w-[300px] bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-700/60 shadow-sm p-4 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-[12px] flex-shrink-0 animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                                                <div className="flex-1 space-y-1.5">
                                                    <div className="flow-sk h-3 w-14 rounded" />
                                                    <div className="flow-sk h-4 w-40 rounded" />
                                                </div>
                                                <div className="flow-sk h-5 w-16 rounded-full" />
                                            </div>

                                            {/* connector */}
                                            <div className="flex flex-col items-center">
                                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                                                <div className="flow-sk w-6 h-6 rounded-full" />
                                                <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                                            </div>

                                            {/* CONDITION NODE */}
                                            <div className="w-[300px] bg-white dark:bg-slate-900 rounded-[16px] border border-slate-200 dark:border-slate-700/60 shadow-sm p-4 flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-[12px] flex-shrink-0 animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                                                <div className="flex-1 space-y-1.5">
                                                    <div className="flow-sk h-3 w-24 rounded" />
                                                    <div className="flow-sk h-4 w-32 rounded" />
                                                </div>
                                                <div className="space-y-1">
                                                    <div className="flow-sk h-4 w-14 rounded-full" />
                                                    <div className="flow-sk h-4 w-14 rounded-full" />
                                                </div>
                                            </div>

                                            {/* branch connectors */}
                                            <div className="flex items-start gap-20 mt-0">
                                                {/* YES branch */}
                                                <div className="flex flex-col items-center">
                                                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                                                    <div className="flow-sk h-5 w-10 rounded-full mb-1" />
                                                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                                                    <div className="w-[130px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-3 flex items-center gap-2">
                                                        <div className="flow-sk w-7 h-7 rounded-lg flex-shrink-0" />
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flow-sk h-2.5 w-16 rounded" />
                                                            <div className="flow-sk h-3 w-20 rounded" />
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* NO branch */}
                                                <div className="flex flex-col items-center">
                                                    <div className="w-px h-5 bg-slate-200 dark:bg-slate-700" />
                                                    <div className="flow-sk h-5 w-10 rounded-full mb-1" />
                                                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700" />
                                                    <div className="w-[130px] bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-sm p-3 flex items-center gap-2">
                                                        <div className="flow-sk w-7 h-7 rounded-lg flex-shrink-0" />
                                                        <div className="flex-1 space-y-1">
                                                            <div className="flow-sk h-2.5 w-10 rounded" />
                                                            <div className="flow-sk h-3 w-16 rounded" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    }>
                                    {flowViewTab === 'builder' && (
                                        <FlowBuilderTab
                                            flow={selectedFlow}
                                            allFlows={flows}
                                            allForms={forms}
                                            isViewMode={isViewMode}
                                            onEditStep={setEditingStep}
                                            onAddStep={onAddStepViaBuilder}
                                            onQuickAddWait={handleQuickAddWait}
                                            onSwapSteps={handleSwapSteps}
                                            isReportMode={isReportMode}
                                            realtimeDistribution={realtimeDistribution}
                                            onReportClick={onReportClickMemo}
                                        />
                                    )}
                                    {flowViewTab === 'analytics' && <div className="h-full overflow-y-auto w-full"><FlowAnalyticsTab flow={selectedFlow} onSelectSubscriber={setSelectedSubscriberForDetail} /></div>}
                                    {flowViewTab === 'settings' && <div className="h-full overflow-y-auto w-full"><FlowSettingsTab flow={selectedFlow} onUpdate={(d, silent, skipApi) => handleUpdateFlow({ ...selectedFlow, ...d }, silent ?? true, silent ? undefined : "Cập nhật cài đặt", skipApi)} /></div>}
                                    </React.Suspense>
                                </div>
                            </TabTransition>

                            {isSidebarOpen && (
                                <aside className="fixed lg:relative inset-0 top-0 lg:top-auto z-[120] lg:z-[110] lg:w-80 flex-shrink-0 h-full bg-white dark:bg-slate-900 dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 shadow-[-4px_0_20px_rgba(0,0,0,0.02)] animate-in slide-in-from-right duration-300">
                                    <div className="lg:hidden absolute top-4 right-4 z-[130]">
                                        <Button variant="ghost" size="sm" onClick={() => setIsSidebarOpen(false)} icon={Plus} className="rotate-45" />
                                    </div>
                                    <FlowSidebar
                                        validationErrors={validationErrors}
                                        logs={currentFlowLogs}
                                        durationInfo={durationInfo}
                                        mailZnsInfo={mailZnsInfo}
                                        snapshotCount={flowSnapshots.length}
                                        onOpenHistory={() => setIsHistoryModalOpen(true)}
                                        onSelectStep={(sid) => {
                                            setFlowViewTab('builder');
                                            const step = selectedFlow.steps?.find(s => s.id === sid);
                                            if (step) setEditingStep(step);
                                            if (window.innerWidth < 1024) setIsSidebarOpen(false);
                                        }}
                                    />
                                </aside>
                            )}
                        </div>
                    </div>,
                    getMktPortalRoot()
                )
            }

            {/* Permission Guard Modal */}
            {AdminPermModal}

            <React.Suspense fallback={null}>
            {isCreateModalOpen && (
                <FlowCreationModal
                    isOpen={isCreateModalOpen}
                    onClose={() => {
                        setIsCreateModalOpen(false);
                        setPrefillCampaignId(undefined);
                        setPrefillTemplateId(undefined);
                        setPrefillFlowName(undefined);
                    }}
                    initialTemplateId={prefillTemplateId}
                    initialCampaignId={prefillCampaignId}
                    initialFlowName={prefillFlowName}
                    onCreate={async (data) => {
                        setIsSaving(true);
                        try {
                            const triggerType = data.steps?.find((s: any) => s.type === 'trigger')?.config?.type || 'segment';
                            const isPriorityTrigger = ['form', 'purchase', 'custom_event'].includes(triggerType);

                            const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}');
                            const creatorInfo = user.name ? { name: user.name, picture: user.picture || "/imgs/ICON.png" } : null;

                            const newFlow: Flow = {
                                ...data,
                                name: data.name || 'Flow mới',
                                id: crypto.randomUUID(),
                                status: 'draft',
                                createdAt: new Date().toISOString(),
                                stats: { enrolled: 0, completed: 0, totalSent: 0, totalOpened: 0, uniqueOpened: 0, totalClicked: 0, uniqueClicked: 0 },
                                config: {
                                    frequencyCap: 3,
                                    activeDays: [0, 1, 2, 3, 4, 5, 6],
                                    startTime: '08:00',
                                    endTime: '21:00',
                                    exitConditions: ['unsubscribed'],
                                    type: 'realtime',
                                    frequency: isPriorityTrigger ? 'recurring' : 'one-time',
                                    allowMultiple: isPriorityTrigger ? true : false,
                                    enrollmentCooldownHours: isPriorityTrigger ? 0 : 12,
                                    creator: creatorInfo || { name: 'Hệ thống', picture: '/imgs/ICON.png' }
                                }
                            };
                            const res = await api.post<Flow>('flows', newFlow);
                            if (res.success) {
                                logAction("Tạo kịch bản mới", newFlow.name, newFlow.id);
                                setIsCreateModalOpen(false);
                                setSelectedFlow(newFlow);
                                setIsNewUnsavedFlow(true);
                                setFlowViewTab('builder');
                                setPrefillCampaignId(undefined);
                                setPrefillTemplateId(undefined);
                                setPrefillFlowName(undefined);

                                // Trigger data refresh in background without awaiting it to avoid blocking modal completion
                                loadData().catch(loadErr => {
                                    console.error("Error refreshing data after flow creation:", loadErr);
                                });
                            } else {
                                showToast(res.message || 'Lỗi khi tạo kịch bản mới', 'error');
                            }
                        } catch (error) {
                            showToast('Lỗi hệ thống khi tạo kịch bản', 'error');
                        } finally {
                            setIsSaving(false);
                        }
                    }}
                />
            )}

            {isAddStepModalOpen && (
                <AddStepModal isOpen={isAddStepModalOpen} onClose={() => setIsAddStepModalOpen(false)} onAdd={handleAddStep} parentStep={selectedFlow?.steps?.find(s => s.id === addStepContext?.parentId)} isInsert={addStepContext?.isInsert} />
            )}

            {editingStep && (
                <StepEditor
                    step={editingStep}
                    flow={selectedFlow || undefined}
                    allFlows={flows}
                    validationErrors={validationErrors}
                    onClose={() => setEditingStep(null)}
                    onSave={(s) => {
                        if (!selectedFlow) return;
                        let newSteps = (selectedFlow.steps || []).map(st => st.id === s.id ? s : st);
                        // Không log edit config step vào lịch sử (chỉ log thêm/xóa bước)
                        handleUpdateFlow({ ...selectedFlow, steps: newSteps }, false, undefined, selectedFlow.status === 'active');
                        setEditingStep(null);
                    }}
                    onDelete={handleDeleteStep}
                    isFlowArchived={selectedFlow?.status === 'archived'}
                    isViewMode={isViewMode}
                    onUpdateFlow={(configUpdates) => {
                        if (!selectedFlow) return;
                        handleUpdateFlow({
                            ...selectedFlow,
                            config: { ...selectedFlow.config, ...configUpdates }
                        }, false, undefined, selectedFlow.status === 'active'); // Không log cấu hình flow
                    }}
                />
            )}

            {/* Detail Modals for Flow Cards */}
            {selectedCampaignForDetail && (
                <CampaignDetailDrawer
                    campaign={selectedCampaignForDetail}
                    isOpen={!!selectedCampaignForDetail}
                    onClose={() => setSelectedCampaignForDetail(null)}
                    allLists={allLists}
                    allSegments={allSegments}
                    allTags={allTags}
                    allFlows={flows}
                />
            )}
            {selectedFormForEdit && (
                <FormEditorModal
                    isOpen={!!selectedFormForEdit}
                    onClose={() => setSelectedFormForEdit(null)}
                    editingFormId={selectedFormForEdit.id}
                    initialData={selectedFormForEdit}
                    lists={allLists}
                    onSuccess={() => { loadData(); setSelectedFormForEdit(null); }}
                />
            )}

            {/* Event Detail Modals */}
            {selectedPurchaseEvent && (
                <PurchaseEventDetailModal
                    event={selectedPurchaseEvent}
                    onClose={() => setSelectedPurchaseEvent(null)}
                />
            )}
            {selectedCustomEvent && (
                <CustomEventDetailModal
                    event={selectedCustomEvent}
                    onClose={() => setSelectedCustomEvent(null)}
                />
            )}

            {confirmModal.isOpen && (
                <ConfirmModal
                    isOpen={confirmModal.isOpen}
                    onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    variant={confirmModal.variant || 'danger'}
                    confirmLabel={confirmModal.confirmLabel}
                    requireConfirmText={confirmModal.requireConfirmText}
                    dangerText={confirmModal.dangerText}
                    dangerAction={confirmModal.dangerAction}
                    isDarkTheme={isDarkTheme}
                />
            )}

            {isTipsModalOpen && (
                <TipsModal
                    isOpen={isTipsModalOpen}
                    onClose={() => setIsTipsModalOpen(false)}
                    title="Mẹo Automation"
                    subtitle="Tối ưu luồng công việc & Tự động hóa"
                    accentColor="emerald"
                    tips={[
                        {
                            icon: Sparkles,
                            title: "Trigger Strategy",
                            description: "Bắt đầu flow bằng một Tag đặc biệt hoặc Segment động để tự động hóa 100%.",
                            colorClass: "bg-gradient-to-br from-blue-400 to-indigo-500",
                            highlight: "Cơ bản"
                        },
                        {
                            icon: Clock,
                            title: "Wait Steps thông minh",
                            description: "Đặt Thời gian chờ từ 1-2 tiếng giữa các tin nhắn để tránh cảm giác bị làm phiền.",
                            colorClass: "bg-gradient-to-br from-amber-400 to-orange-500",
                            highlight: "Quan trọng"
                        },
                        {
                            icon: GitMerge,
                            title: "Rẽ nhánh điều kiện",
                            description: "Sử dụng các bước Điều kiện Có/Không để lọc Khách hàng đã mở hoặc click tin nhắn.",
                            colorClass: "bg-gradient-to-br from-emerald-400 to-teal-500"
                        },
                        {
                            icon: Split,
                            title: "Split Testing",
                            description: "Chia tệp Khách hàng để thử nghiệm 2 kịch bản khác nhau, đo lường hiệu quả thực tế.",
                            colorClass: "bg-gradient-to-br from-purple-500 to-pink-500",
                            highlight: "Nâng cao"
                        },
                        {
                            icon: ShieldCheck,
                            title: "Exit Logic",
                            description: "Luôn gán Tag Hoàn thành để gỡ Khách hàng khỏi luồng sau khi họ đã mua hàng.",
                            colorClass: "bg-gradient-to-br from-rose-400 to-rose-600"
                        }
                    ]}
                />
            )}

            {continuationModal.isOpen && (
                <FlowContinuationModal
                    isOpen={continuationModal.isOpen}
                    onClose={() => setContinuationModal({ ...continuationModal, isOpen: false })}
                    completedUsers={continuationModal.completedUsers}
                    newStepInfo={continuationModal.newStepInfo}
                    isAffected={continuationModal.isAffected}
                    onContinue={async (options) => {
                        if (!selectedFlow) return;

                        const waitStepId = crypto.randomUUID();
                        const newStepId = continuationModal.pendingStepId || crypto.randomUUID();
                        const parentId = continuationModal.parentId;
                        const branch = continuationModal.branch;

                        // 1. Create the forced Wait 10 min step
                        const waitStep: FlowStep = {
                            id: waitStepId,
                            type: 'wait',
                            label: 'Chờ an toàn (10 phút)',
                            iconName: 'clock',
                            config: { duration: 10, unit: 'minutes' },
                            nextStepId: newStepId
                        };

                        // 2. Create the intended new step
                        const newStep: FlowStep = {
                            id: newStepId,
                            type: continuationModal.pendingStepType,
                            label: getStepLabel(continuationModal.pendingStepType),
                            iconName: getStepIcon(continuationModal.pendingStepType),
                            config: continuationModal.pendingStepType === 'wait'
                                ? { duration: 1, unit: 'hours' }
                                : (continuationModal.pendingStepType === 'crm_action' ? { actionType: 'update_stage', stage_id: '1', lead_status: 'active', temperature: 'warm' } : {})
                        };

                        // 3. Update structure locally
                        const steps = [...(selectedFlow.steps || []), waitStep, newStep];
                        const parentStep = steps?.find(s => s.id === parentId);
                        if (parentStep) {
                            if (parentStep.type === 'advanced_condition') {
                                if (branch) {
                                    const branches = [...(parentStep.config.branches || [])];
                                    const branchIndex = branches.findIndex((b: any) => b.id === branch);
                                    if (branchIndex !== -1) {
                                        branches[branchIndex] = { ...branches[branchIndex], nextStepId: waitStepId, stepId: waitStepId };
                                        parentStep.config = { ...parentStep.config, branches };
                                    }
                                } else {
                                    parentStep.config = { ...parentStep.config, defaultStepId: waitStepId };
                                }
                            } else {
                                const linkKey = branch === 'yes' ? 'yesStepId' : (branch === 'no' ? 'noStepId' : (branch === 'A' ? 'pathAStepId' : (branch === 'B' ? 'pathBStepId' : 'nextStepId')));
                                (parentStep as any)[linkKey] = waitStepId;
                            }
                        }

                        // 4. Queue migration
                        setPendingMigrations(prev => [...prev, {
                            flowId: selectedFlow.id,
                            action: 'continue',
                            continueAll: options.continueAll,
                            branches: options.branches,
                            targetStepId: waitStepId // Users move to the WAIT step first
                        }]);

                        handleUpdateFlow({ ...selectedFlow, steps }, false, `Thêm bước ${newStep.label} (có chèn bước chờ)`, true);
                        setContinuationModal({ ...continuationModal, isOpen: false });
                        showToast('Đã thêm bước và chèn bước chờ 10p. Nhấn Lưu để áp dụng di chuyển người dùng.');
                    }}
                    onStop={async () => {
                        if (!selectedFlow) return;

                        const waitStepId = crypto.randomUUID();
                        const newStepId = continuationModal.pendingStepId || crypto.randomUUID();
                        const parentId = continuationModal.parentId;
                        const branch = continuationModal.branch;

                        // Still insert the wait step for structural consistency if anyone else comes here later
                        const waitStep: FlowStep = {
                            id: waitStepId,
                            type: 'wait',
                            label: 'Chờ an toàn (10 phút)',
                            iconName: 'clock',
                            config: { duration: 10, unit: 'minutes' },
                            nextStepId: newStepId
                        };

                        const newStep: FlowStep = {
                            id: newStepId,
                            type: continuationModal.pendingStepType,
                            label: getStepLabel(continuationModal.pendingStepType),
                            iconName: getStepIcon(continuationModal.pendingStepType),
                            config: continuationModal.pendingStepType === 'wait'
                                ? { duration: 1, unit: 'hours' }
                                : (continuationModal.pendingStepType === 'crm_action' ? { actionType: 'update_stage', stage_id: '1', lead_status: 'active', temperature: 'warm' } : {})
                        };

                        const steps = [...(selectedFlow.steps || []), waitStep, newStep];
                        const parentStep = steps?.find(s => s.id === parentId);
                        if (parentStep) {
                            if (parentStep.type === 'advanced_condition') {
                                if (branch) {
                                    const branches = [...(parentStep.config.branches || [])];
                                    const branchIndex = branches.findIndex((b: any) => b.id === branch);
                                    if (branchIndex !== -1) {
                                        branches[branchIndex] = { ...branches[branchIndex], nextStepId: waitStepId, stepId: waitStepId };
                                        parentStep.config = { ...parentStep.config, branches };
                                    }
                                } else {
                                    parentStep.config = { ...parentStep.config, defaultStepId: waitStepId };
                                }
                            } else {
                                const linkKey = branch === 'yes' ? 'yesStepId' : (branch === 'no' ? 'noStepId' : (branch === 'A' ? 'pathAStepId' : (branch === 'B' ? 'pathBStepId' : 'nextStepId')));
                                (parentStep as any)[linkKey] = waitStepId;
                            }
                        }

                        // Queue stop decision
                        setPendingMigrations(prev => [...prev, {
                            flowId: selectedFlow.id,
                            action: 'stop',
                            targetStepId: ''
                        }]);

                        handleUpdateFlow({ ...selectedFlow, steps }, false, `Thêm bước mới (Người cũ Dừng)`, true);
                        setContinuationModal({ ...continuationModal, isOpen: false });
                        showToast('Đã thêm bước mới. Người dùng đã Hoàn thành sẽ không thực hiện bước này.');
                    }}
                />
            )}

            {isActivateModalOpen && (
                <ActivateFlowModal
                    isOpen={isActivateModalOpen}
                    onClose={() => { setIsActivateModalOpen(false); setActivateContext(null); }}
                    onConfirm={handleConfirmActivation}
                    flowName={activateContext?.flow?.name || ''}
                    linkedCampaignName={campaigns?.find(c => c.id === activateContext?.flow?.steps?.find(s => s.type === 'trigger')?.config?.targetId)?.name}
                    isLoading={isSaving}
                />
            )}
            {selectedFlow && isSimulateModalOpen && (
                <FlowSimulateModal
                    isOpen={isSimulateModalOpen}
                    onClose={() => setIsSimulateModalOpen(false)}
                    flow={selectedFlow}
                />
            )}
            {/* NEW: Automation Warning is now handled inside CustomerProfileModal on save */}
            {selectedSubscriberForDetail && (
                <CustomerProfileModal
                    subscriber={selectedSubscriberForDetail}
                    onClose={() => setSelectedSubscriberForDetail(null)}
                    // We reuse the same handler, assuming we just need to save basic info.
                    // For complex updates (list add/remove inside modal), we might need to handle onUpdate more robustly if needed.
                    // But for viewing detail, this is sufficient.
                    onUpdate={async (updated) => {
                        setLoading(true);
                        try {
                            const res = await api.put(`subscribers/${updated.id}`, updated);
                            if (res.success) {
                                if (viewingGroup) fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);
                                showToast('Đã cập nhật hồ sơ', 'success');
                            } else {
                                showToast(res.message || 'Lỗi khi cập nhật hồ sơ', 'error');
                            }
                        } catch (error) {
                            showToast('Lỗi hệ thống khi cập nhật hồ sơ', 'error');
                        } finally {
                            setLoading(false);
                        }
                    }}
                    onDelete={async (id) => {
                        setLoading(true);
                        try {
                            const res = await api.delete(`subscribers/${id}`);
                            if (res.success) {
                                if (viewingGroup) fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);
                                setSelectedSubscriberForDetail(null);
                                showToast('Đã xóa Khách hàng', 'success');
                            } else {
                                showToast(res.message || 'Lỗi khi xóa Khách hàng', 'error');
                            }
                        } catch (error) {
                            showToast('Lỗi hệ thống khi xóa Khách hàng', 'error');
                        } finally {
                            setLoading(false);
                        }
                    }}
                    allLists={allLists}
                    allSegments={allSegments}
                    allFlows={flows}
                    allTags={allTags}
                    checkMatch={() => false} // Simplify for this view
                    onAddToList={async (subId, listId) => {
                        try {
                            const getRes = await api.get<any>(`subscribers?id=${subId}`);
                            if (getRes.success) {
                                const sub = getRes.data;
                                if (Array.isArray(sub.listIds) && !sub.listIds.includes(listId)) {
                                    await api.put(`subscribers/${subId}`, { ...sub, listIds: [...sub.listIds, listId] });
                                    if (viewingGroup) fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);
                                }
                            }
                        } catch (error) {
                            showToast('Lỗi khi thêm vào danh sách', 'error');
                        }
                    }}
                    onRemoveFromList={async (subId, listId) => {
                        try {
                            let payload: any = { type: 'list_remove', listId: listId, subscriberIds: [subId] };
                            const res = await api.post<any>('bulk_operations', payload);
                            if (res.success && viewingGroup) fetchGroupMembers(viewingGroup, groupPagination.page, groupSearch);
                        } catch (error) {
                            showToast('Lỗi khi gỡ khỏi danh sách', 'error');
                        }
                    }}
                />
            )}

            {viewingGroup && (
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
                    onStatusFilter={() => { }}
                    onRemoveFromList={(ids, opts) => {
                        if (viewingGroup?.type === 'list') {
                            handleDetailRemoveFromList(ids, viewingGroup.id, opts);
                        }
                    }}
                    onRemoveFromTag={(ids, opts) => {
                        if (viewingGroup?.type === 'tag') {
                            handleDetailRemoveFromTag(ids, viewingGroup.name, opts);
                        }
                    }}
                    onViewProfile={setSelectedSubscriberForDetail}
                />
            )}
            {isParticipantsModalOpen && (
                <StepParticipantsModal
                    isOpen={isParticipantsModalOpen}
                    onClose={() => {
                        setIsParticipantsModalOpen(false);
                        setSelectedBranchFilter(null);
                    }}
                    title={selectedAnalyticsStepId ? (selectedFlow?.steps?.find(s => s.id === selectedAnalyticsStepId)?.label || 'Báo cáo bước') : 'Báo cáo'}
                    participants={modalParticipants}
                    loading={loadingParticipants}
                    pagination={analyticsPagination}
                    onPageChange={(p) => setAnalyticsPagination(prev => ({ ...prev, page: p }))}
                    onRefresh={() => selectedFlow && selectedAnalyticsStepId && fetchParticipants(selectedFlow.id, selectedAnalyticsStepId, analyticsActiveTab, analyticsPagination.page, analyticsSearchTerm, selectedBranchFilter)}
                    searchTerm={analyticsSearchTerm}
                    onSearchChange={setAnalyticsSearchTerm}
                    activeTab={analyticsActiveTab}
                    onTabChange={setAnalyticsActiveTab}
                    activeBranchFilter={selectedBranchFilter}
                    onBranchClick={setSelectedBranchFilter}
                    getStepName={(id) => selectedFlow?.steps?.find(s => s.id === id)?.label || 'Unknown'}
                    stepType={selectedFlow?.steps?.find(s => s.id === selectedAnalyticsStepId)?.type}
                    stepConfig={selectedFlow?.steps?.find(s => s.id === selectedAnalyticsStepId)?.config}
                    flowId={selectedFlow?.id}
                    stepId={selectedAnalyticsStepId || undefined}
                />
            )}
            {/* History Modal: DB-backed */}
            {isHistoryModalOpen && selectedFlow && (
                <HistoryModal
                    isOpen={isHistoryModalOpen}
                    onClose={() => setIsHistoryModalOpen(false)}
                    snapshots={flowSnapshots}
                    isLoading={isLoadingSnapshots}
                    onRestore={handleRestoreSnapshot}
                />
            )}
            {/* Restore Confirm Dialog */}
            {restoreConfirmSnapshot && (
                <ConfirmModal
                    isOpen={!!restoreConfirmSnapshot}
                    onClose={() => setRestoreConfirmSnapshot(null)}
                    onConfirm={handleConfirmRestore}
                    title="Xác nhận khôi phục phiên bản"
                    isDarkTheme={isDarkTheme}
                    variant="warning"
                    confirmText="Khôi phục ngay"
                    cancelText="Hủy bỏ"
                    isLoading={isRestoringSnapshot}
                    message={
                        <div className="space-y-4">
                            <p className="text-[13px]">Hành động này sẽ thay thế flow hiện tại.</p>
                            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4 space-y-2 text-left">
                                <p className="text-xs font-black text-amber-800 dark:text-amber-405">📋 Phiên bản được chọn:</p>
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{restoreConfirmSnapshot.label}</p>
                                <div className="flex gap-4 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                    <span>🕐 {new Date(restoreConfirmSnapshot.created_at).toLocaleString('vi-VN')}</span>
                                    {restoreConfirmSnapshot.created_by && <span>👤 {restoreConfirmSnapshot.created_by}</span>}
                                </div>
                            </div>
                            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-500/20 rounded-xl p-3 text-left">
                                <p className="text-[11px] font-bold text-rose-700 dark:text-rose-405">⚠️ Cảnh báo: Mọi thay đổi chưa lưu hiện tại sẽ bị mất. Sau khi khôi phục, bạn cần bấm <strong>Lưu</strong> để áp dụng lên server.</p>
                            </div>
                        </div>
                    }
                />
            )}
            </React.Suspense>
        </div>
    );
};

export default Flows;
