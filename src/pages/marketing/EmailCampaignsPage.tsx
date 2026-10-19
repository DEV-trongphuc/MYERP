import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { api } from '../../components/marketing/services/storageAdapter';
import { Campaign, CampaignStatus, Segment, Template, Flow } from '../../components/marketing/types';
import {
    Plus, MousePointerClick, CheckCircle2, GitMerge, FileText, CalendarClock, PieChart, Send, MailOpen,
    Lightbulb, ShieldCheck, Zap, Target, Sparkles, Clock
} from 'lucide-react';
import Select from '../../components/marketing/components/common/Select';
import SearchBox from '../../components/marketing/components/common/SearchBox';
import PageHero from '../../components/marketing/components/common/PageHero';
import toast from 'react-hot-toast';
import CampaignList from '../../components/marketing/components/campaigns/CampaignList';
import FlowReviewModal from '../../components/marketing/components/campaigns/FlowReviewModal';
import ConfirmModal from '../../components/marketing/components/common/ConfirmModal';
import Tabs from '../../components/marketing/components/common/Tabs';
import Pagination from '../../components/marketing/components/common/Pagination';
import StatCard from '../../components/marketing/components/common/StatCard';
import Modal from '../../components/marketing/components/common/Modal';
import { useNavigate, useLocation } from 'react-router-dom';
import { useKeyboardShortcuts } from '../../components/marketing/hooks/useKeyboardShortcuts';
import { useIsAdmin } from '../../components/marketing/hooks/useAuthUser';
import { usePermissionGuard } from '../../components/marketing/components/common/PermissionGuard';
import { useSettings } from '../../components/marketing/components/contexts/SettingsContext';
import { useTheme } from '../../components/marketing/contexts/ThemeContext';
import { logAction } from '../../components/marketing/services/historyService';

// [PERF] Heavy overlays are code-split and only fetched the first time they are opened.
const CampaignWizard = lazy(() => import('../../components/marketing/components/campaigns/CampaignWizard'));
const CampaignDetailDrawer = lazy(() => import('../../components/marketing/components/campaigns/CampaignDetailDrawer'));
const SesQuotaWidget = lazy(() => import('../../components/marketing/components/common/SesQuotaWidget'));
const TipsModal = lazy(() => import('../../components/marketing/components/common/TipsModal'));

const ROUTE_PATH = '/marketing/campaigns';
const PAGE_LIMIT = 20;
const POLL_MS = 5000;
const BRAND = '#BD1D2D';
const SUCCESS = '#10b981';

type StatusTab = 'all' | 'sent' | 'scheduled' | 'draft' | 'waiting';
type TypeFilter = 'all' | 'email' | 'zalo_zns';
type DatePreset = '7' | '30' | '90' | 'month' | 'all' | 'custom';

const TAB_ITEMS = [
    { id: 'all', label: 'Tất cả', icon: PieChart },
    { id: 'sent', label: 'Đã gửi', icon: CheckCircle2 },
    { id: 'waiting', label: 'Chờ Flow', icon: GitMerge },
    { id: 'scheduled', label: 'Đang xử lý', icon: CalendarClock },
    { id: 'draft', label: 'Bản nháp', icon: FileText }
];

const TYPE_OPTIONS = [
    { value: 'all', label: 'Tất cả kênh' },
    { value: 'email', label: 'Email' },
    { value: 'zalo_zns', label: 'Zalo ZNS' }
];

const DATE_OPTIONS = [
    { value: '90', label: '90 ngày qua' },
    { value: '30', label: '30 ngày qua' },
    { value: '7', label: '7 ngày qua' },
    { value: 'month', label: 'Tháng này' },
    { value: 'all', label: 'Toàn thời gian' },
    { value: 'custom', label: 'Tùy chỉnh...' }
];

/** Optional server-side aggregate (campaigns.php list → `summary`). Falls back to page aggregates. */
interface CampaignSummary {
    total?: number; running?: number; draft?: number;
    sent?: number; email_sent?: number; zalo_sent?: number; opened?: number; clicked?: number;
}

const isRunning = (c: Campaign) => c.status === CampaignStatus.SCHEDULED || c.status === CampaignStatus.SENDING || c.status === CampaignStatus.PAUSED;
const isAbort = (e: any) => e?.name === 'AbortError' || e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED';
const fmtYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const resolveDates = (preset: DatePreset, custom: { start: string; end: string }) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();
    switch (preset) {
        case '7': start.setDate(today.getDate() - 7); break;
        case '30': start.setDate(today.getDate() - 30); break;
        case '90': start.setDate(today.getDate() - 90); break;
        case 'month':
            start = new Date(today.getFullYear(), today.getMonth(), 1);
            end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            break;
        case 'all': return { startDate: '', endDate: '' };
        case 'custom':
            if (!custom.start || !custom.end) return { startDate: '', endDate: '' };
            return { startDate: custom.start, endDate: custom.end };
    }
    return { startDate: fmtYmd(start), endDate: fmtYmd(end) };
};

/** Client-side safety filter (idempotent with server filter when backend honours `status`/`type`). */
const matchesFilters = (c: Campaign, tab: StatusTab, type: TypeFilter) => {
    if (tab === 'sent' && c.status !== CampaignStatus.SENT) return false;
    if (tab === 'scheduled' && !isRunning(c)) return false;
    if (tab === 'waiting' && c.status !== CampaignStatus.WAITING_FLOW) return false;
    if (tab === 'draft' && c.status !== CampaignStatus.DRAFT) return false;
    if (type === 'email' && !(c.type === 'email' || !c.type)) return false;
    if (type === 'zalo_zns' && c.type !== 'zalo_zns') return false;
    return true;
};

const normalizeFlows = (raw: any): Flow[] => (Array.isArray(raw) ? raw : (raw?.data || []));

const getCreatorInfo = () => {
    try {
        const user = JSON.parse(localStorage.getItem('user') || localStorage.getItem('currentUser') || '{}');
        return user?.name ? { name: user.name, picture: user.picture || '/imgs/ICON.png' } : null;
    } catch {
        return null;
    }
};

const Campaigns: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const isAdmin = useIsAdmin();
    const { guard: adminGuard, PermModal: AdminPermModal } = usePermissionGuard(isAdmin);
    const { isDark } = useTheme();
    const { senderEmails: verifiedEmails } = useSettings();

    // ── List state ───────────────────────────────────────────────────────────
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [page, setPage] = useState(1);
    const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
    const [summary, setSummary] = useState<CampaignSummary | null>(null);
    const [loading, setLoading] = useState(true);       // first load only (skeleton)
    const [refreshing, setRefreshing] = useState(false); // background refetch (stale data stays)
    const [reloadKey, setReloadKey] = useState(0);
    const hasLoadedRef = useRef(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeTab, setActiveTab] = useState<StatusTab>('all');
    const [activeType, setActiveType] = useState<TypeFilter>('all');
    const [datePreset, setDatePreset] = useState<DatePreset>('90');
    const [customDate, setCustomDate] = useState({ start: '', end: '' });

    // ── Overlays ─────────────────────────────────────────────────────────────
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [wizardMounted, setWizardMounted] = useState(false);
    const [wizardInitialData, setWizardInitialData] = useState<Partial<Campaign> | undefined>(undefined);
    const [selectedDetailCampaign, setSelectedDetailCampaign] = useState<Campaign | null>(null);
    const [drawerMounted, setDrawerMounted] = useState(false);
    const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);
    const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
    const [awsQuickInfo, setAwsQuickInfo] = useState<{ remaining: number; usage_pct: number } | null>(null);

    const [flowReviewData, setFlowReviewData] = useState<{ campaign: Campaign, flow: Flow | null } | null>(null);
    const [isStartingFlow, setIsStartingFlow] = useState(false);
    const savingDraftRef = useRef(false);
    const publishingRef = useRef(false);
    const isDeletingRef = useRef(false);

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean; title: string; message: string; variant: 'danger' | 'warning' | 'info';
        onConfirm: () => void; requireConfirmText?: string;
    }>({ isOpen: false, title: '', message: '', variant: 'warning', onConfirm: () => { } });

    const [advancedDeleteModal, setAdvancedDeleteModal] = useState<{
        isOpen: boolean; campaignId: string | null; flows: Flow[]; deleteFlowMode: number;
    }>({ isOpen: false, campaignId: null, flows: [], deleteFlowMode: 0 });

    // ── Auxiliary data (only needed by Wizard / Drawer / delete / flow) ─────
    const [allLists, setAllLists] = useState<any[]>([]);
    const [allSegments, setAllSegments] = useState<Segment[]>([]);
    const [allTemplates, setAllTemplates] = useState<Template[]>([]);
    const [allFlows, setAllFlows] = useState<Flow[]>([]);
    const [allTags, setAllTags] = useState<{ id: string, name: string, count: number }[]>([]);
    const auxPromiseRef = useRef<Promise<Flow[]> | null>(null);
    const flowsRef = useRef<Flow[]>([]);
    useEffect(() => { flowsRef.current = allFlows; }, [allFlows]);

    /** Lazily loads wizard/drawer reference data once (de-duplicated). Resolves with flows. */
    const ensureAuxData = useCallback((): Promise<Flow[]> => {
        if (auxPromiseRef.current) return auxPromiseRef.current;
        const p = Promise.all([
            api.get<any[]>('lists'),
            api.get<Segment[]>('segments'),
            api.get<Template[]>('templates'),
            api.get<Flow[]>('flows'),
            api.get<{ id: string, name: string, subscriber_count: number }[]>('tags'),
        ]).then(([lRes, sRes, tRes, fRes, tagRes]) => {
            if (lRes.success) setAllLists(Array.isArray(lRes.data) ? lRes.data : []);
            if (sRes.success) setAllSegments(Array.isArray(sRes.data) ? sRes.data : []);
            if (tRes.success) setAllTemplates(Array.isArray(tRes.data) ? tRes.data : []);
            const flows = fRes.success ? normalizeFlows(fRes.data) : [];
            if (fRes.success) { setAllFlows(flows); flowsRef.current = flows; }
            if (tagRes.success && Array.isArray(tagRes.data)) {
                setAllTags(tagRes.data.map(tag => ({ id: tag.id, name: tag.name, count: tag.subscriber_count || 0 })));
            }
            return flows;
        }).catch((err) => {
            auxPromiseRef.current = null; // allow retry
            console.error('Load campaign reference data failed', err);
            return flowsRef.current;
        });
        auxPromiseRef.current = p;
        return p;
    }, []);

    const refreshFlows = useCallback(() => {
        api.get<any>('flows').then(r => { if (r.success) setAllFlows(normalizeFlows(r.data)); }).catch(() => { });
    }, []);

    // ── Debounced search (300 ms) → reset to page 1 ──────────────────────────
    useEffect(() => {
        if (searchTerm === debouncedSearch) return;
        const t = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [searchTerm, debouncedSearch]);

    const dates = useMemo(() => resolveDates(datePreset, customDate), [datePreset, customDate]);

    const buildQuery = useCallback((p: number) => {
        const q: Record<string, string | number> = { page: p, limit: PAGE_LIMIT };
        if (debouncedSearch) q.search = debouncedSearch;
        if (dates.startDate) q.startDate = dates.startDate;
        if (dates.endDate) q.endDate = dates.endDate;
        if (activeTab !== 'all') q.status = activeTab;
        if (activeType !== 'all') q.type = activeType;
        return q;
    }, [debouncedSearch, dates.startDate, dates.endDate, activeTab, activeType]);

    const latestQueryRef = useRef(buildQuery(page));
    useEffect(() => { latestQueryRef.current = buildQuery(page); }, [buildQuery, page]);

    const applyListResponse = useCallback((res: any) => {
        if (!res?.success) return false;
        const payload = res.data;
        if (payload?.pagination) {
            setCampaigns(Array.isArray(payload.data) ? payload.data : []);
            setMeta({
                total: Number(payload.pagination.total) || 0,
                totalPages: Math.max(1, Number(payload.pagination.totalPages) || 1),
            });
            setSummary(payload.summary && typeof payload.summary === 'object' ? payload.summary : null);
        } else if (Array.isArray(payload)) {
            setCampaigns(payload);
            setMeta({ total: payload.length, totalPages: 1 });
            setSummary(null);
        }
        return true;
    }, []);

    // ── Main list fetch: one effect, AbortController, stale data kept ───────
    useEffect(() => {
        if (datePreset === 'custom' && (!customDate.start || !customDate.end)) return;
        const controller = new AbortController();
        const isFirst = !hasLoadedRef.current;
        if (isFirst) setLoading(true); else setRefreshing(true);

        const listReq = api.get<any>('campaigns', buildQuery(page), { signal: controller.signal });
        // Initial load: list + quota badge in ONE parallel batch (quota failure never blocks the list).
        const quotaReq = isFirst
            ? api.get<any>('ses_quota', {}, { signal: controller.signal }).catch(e => { if (isAbort(e)) throw e; return null; })
            : Promise.resolve(null);

        Promise.all([listReq, quotaReq])
            .then(([res, quota]) => {
                if (controller.signal.aborted) return;
                if (!applyListResponse(res)) toast.error(res?.message || 'Không thể tải danh sách chiến dịch');
                if (quota?.success && quota.data?.aws) {
                    setAwsQuickInfo({ remaining: Number(quota.data.aws.remaining) || 0, usage_pct: Number(quota.data.aws.usage_pct) || 0 });
                }
                hasLoadedRef.current = true;
            })
            .catch(err => {
                if (isAbort(err)) return;
                console.error('Load campaigns failed', err);
                toast.error('Không thể tải danh sách chiến dịch');
            })
            .finally(() => {
                if (controller.signal.aborted) return;
                setLoading(false);
                setRefreshing(false);
            });

        return () => controller.abort();
    }, [buildQuery, page, reloadKey, applyListResponse, datePreset, customDate.start, customDate.end]);

    const reloadList = useCallback(() => setReloadKey(k => k + 1), []);

    // ── Silent polling for running campaigns (paused when tab hidden / route inactive) ──
    const campaignsRef = useRef(campaigns);
    useEffect(() => { campaignsRef.current = campaigns; }, [campaigns]);
    const isRouteActiveRef = useRef(location.pathname === ROUTE_PATH);
    useEffect(() => { isRouteActiveRef.current = location.pathname === ROUTE_PATH; }, [location.pathname]);

    useEffect(() => {
        let inFlight: AbortController | null = null;
        const tick = () => {
            if (document.hidden || !isRouteActiveRef.current || inFlight) return;
            if (!campaignsRef.current.some(isRunning)) return;
            const ctrl = new AbortController();
            inFlight = ctrl;
            api.get<any>('campaigns', latestQueryRef.current, { signal: ctrl.signal })
                .then(res => {
                    if (ctrl.signal.aborted || !res?.success) return;
                    const next: Campaign[] | undefined = res.data?.data ?? (Array.isArray(res.data) ? res.data : undefined);
                    if (!next) return;
                    setCampaigns(prev => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
                    if (res.data?.summary) setSummary(res.data.summary);
                })
                .catch(() => { /* silent */ })
                .finally(() => { if (inFlight === ctrl) inFlight = null; });
        };
        const interval = window.setInterval(tick, POLL_MS);
        return () => {
            window.clearInterval(interval);
            inFlight?.abort();
        };
    }, []);

    // ── Overlay openers ──────────────────────────────────────────────────────
    const openWizard = useCallback((initial?: Partial<Campaign>) => {
        setSelectedDetailCampaign(null);
        setWizardInitialData(initial);
        setWizardMounted(true);
        setIsWizardOpen(true);
        ensureAuxData();
    }, [ensureAuxData]);

    const openDetail = useCallback((c: Campaign) => {
        setDrawerMounted(true);
        setSelectedDetailCampaign(c);
        ensureAuxData();
    }, [ensureAuxData]);

    const handleCreateClick = useMemo(() => adminGuard(() => openWizard(undefined), 'tạo chiến dịch mới'), [adminGuard, openWizard]);

    useKeyboardShortcuts({ 'n': () => openWizard(undefined) }, [openWizard]);

    // Deep-link via navigation state or query params (open a campaign report / open wizard with preselected list or contacts)
    useEffect(() => {
        if (!location.pathname.startsWith('/marketing/campaigns')) return;
        const navState = (location as any).state;
        const params = new URLSearchParams(location.search);
        const queryListId = params.get('list_id') || navState?.listId;
        const crmContactsParam = params.get('crm_contacts');
        const preselectedContacts = navState?.preselectedCrmContacts;
        const isCreateParam = params.get('create') === '1' || params.get('action') === 'create';

        if (navState?.openCampaignId && campaigns.length > 0) {
            const targetCamp = campaigns.find(c => c.id === navState.openCampaignId);
            if (targetCamp) {
                openDetail(targetCamp);
                window.history.replaceState({}, document.title);
            }
        } else if (navState?.openWizard || isCreateParam || queryListId || crmContactsParam || (Array.isArray(preselectedContacts) && preselectedContacts.length > 0)) {
            const individualIds = Array.isArray(preselectedContacts) && preselectedContacts.length > 0
                ? preselectedContacts.map((c: any) => String(c.domation_subscriber_id || c.subscriber_id || c.id)).filter(Boolean)
                : (crmContactsParam ? crmContactsParam.split(',').map(s => s.trim()).filter(Boolean) : []);
            const initialCamp = (queryListId || individualIds.length > 0)
                ? ({ target: { listIds: queryListId ? [String(queryListId)] : [], segmentIds: [], tagIds: [], individualIds } } as any)
                : undefined;
            openWizard(initialCamp);
            window.history.replaceState({}, document.title, location.pathname);
        }
    }, [location.state, location.search, campaigns, openDetail, openWizard, location.pathname]);

    const filteredCampaigns = useMemo(
        () => campaigns.filter(c => matchesFilters(c, activeTab, activeType)),
        [campaigns, activeTab, activeType]
    );

    const stats = useMemo(() => {
        const pageSent = campaigns.reduce((a, c) => a + (c.stats?.sent || 0), 0);
        const pageZalo = campaigns.filter(c => c.type === 'zalo_zns').reduce((a, c) => a + (c.stats?.sent || 0), 0);
        const totalSent = summary?.sent ?? pageSent;
        const zaloSent = summary?.zalo_sent ?? pageZalo;
        const emailSent = summary?.email_sent ?? (pageSent - pageZalo);
        const totalOpened = summary?.opened ?? campaigns.reduce((a, c) => a + (c.stats?.opened || 0), 0);
        const totalClicked = summary?.clicked ?? campaigns.reduce((a, c) => a + (c.stats?.clicked || 0), 0);
        return {
            totalCampaigns: summary?.total ?? meta.total,
            running: summary?.running ?? campaigns.filter(isRunning).length,
            draft: summary?.draft ?? campaigns.filter(c => c.status === CampaignStatus.DRAFT).length,
            totalSent, emailSent, zaloSent, totalOpened, totalClicked,
            openRate: totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0',
            ctr: totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : '0',
        };
    }, [campaigns, summary, meta.total]);
    const statsArePageScoped = !summary && meta.total > campaigns.length;

    // ── Mutations ────────────────────────────────────────────────────────────
    const handleSaveDraft = useCallback(async (data: Partial<Campaign>) => {
        if (savingDraftRef.current) return null; // synchronous double-submit guard
        savingDraftRef.current = true;
        const creatorInfo = getCreatorInfo();
        const payload = {
            ...data,
            status: CampaignStatus.DRAFT,
            stats: data.id ? undefined : { sent: 0, opened: 0, clicked: 0, bounced: 0, spam: 0, unsubscribed: 0, failed: 0 },
            config: {
                ...data.config,
                creator: (data.config as any)?.creator || creatorInfo || { name: 'Hệ thống', picture: '/imgs/ICON.png' }
            }
        };
        try {
            const res = data.id ? await api.put<Campaign>(`campaigns/${data.id}`, payload) : await api.post<Campaign>('campaigns', payload);
            if (res.success) {
                toast.success('Đã lưu nháp chiến dịch!');
                logAction(data.id ? 'Cập nhật chiến dịch nháp' : 'Tạo chiến dịch nháp mới', `Chiến dịch: ${data.name || res.data.name}`);
                if (data.id) {
                    setCampaigns(prev => prev.map(c => c.id === data.id ? { ...c, ...res.data } : c));
                } else {
                    setCampaigns(prev => [res.data, ...prev]);
                    setMeta(prev => ({ ...prev, total: prev.total + 1 }));
                }
                setWizardInitialData(res.data);
                return res.data;
            }
            toast.error(res.message || 'Lỗi khi lưu bản nháp');
        } catch {
            toast.error('Đã xảy ra lỗi hệ thống khi lưu bản nháp');
        } finally {
            savingDraftRef.current = false;
        }
        return null;
    }, []);

    const handlePublish = useCallback(async (data: Partial<Campaign>, options: { connectFlow: boolean, activateFlowId: string | null }) => {
        if (publishingRef.current) return null;
        publishingRef.current = true;
        let finalStatus = CampaignStatus.SCHEDULED;
        const scheduleTime = data.scheduledAt;
        if (options.connectFlow && !options.activateFlowId) finalStatus = CampaignStatus.WAITING_FLOW;
        else if (!scheduleTime) finalStatus = CampaignStatus.SENDING;

        const creatorInfo = getCreatorInfo();
        const payload = {
            ...data,
            status: finalStatus,
            sentAt: finalStatus === CampaignStatus.SENDING ? new Date().toISOString() : data.sentAt,
            scheduledAt: scheduleTime,
            config: {
                ...data.config,
                creator: (data.config as any)?.creator || creatorInfo || { name: 'Hệ thống', picture: '/imgs/ICON.png' }
            }
        };

        try {
            const res = data.id ? await api.put<Campaign>(`campaigns/${data.id}`, payload) : await api.post<Campaign>('campaigns', payload);
            if (res.success) {
                logAction(data.id ? 'Cập nhật chiến dịch' : 'Khởi tạo chiến dịch', `Chiến dịch: ${data.name || res.data.name} (Trạng thái: ${finalStatus})`);
                const campId = data.id || res.data.id;
                // [FIX DUP-SEND] Backend POST/PUT already dispatches the worker for SENDING — do not trigger again.
                if (options.connectFlow && options.activateFlowId) {
                    const flows = await ensureAuxData();
                    const flow = flows.find(f => f.id === options.activateFlowId);
                    if (flow) {
                        const updatedSteps = flow.steps.map(s => s.type === 'trigger'
                            ? { ...s, config: { ...s.config, type: 'campaign', targetId: campId } }
                            : s);
                        await api.put(`flows/${options.activateFlowId}`, { status: 'active', steps: updatedSteps, activate_campaign: true });
                    }
                    refreshFlows();
                } else if (options.connectFlow && !options.activateFlowId) {
                    setTimeout(() => {
                        navigate('/marketing/flows', {
                            state: { action: 'create', campaignId: campId, templateId: 'campaign_tracking', flowName: `Chăm sóc sau Chiến dịch ${data.name}` }
                        });
                    }, 300);
                }

                toast.success(finalStatus === CampaignStatus.SENDING ? 'Chiến dịch đang được gửi!' : 'Đã lên lịch gửi chiến dịch!');
                if (data.id) {
                    setCampaigns(prev => prev.map(c => c.id === data.id ? { ...c, ...res.data } : c));
                } else {
                    setCampaigns(prev => [res.data, ...prev]);
                    setMeta(prev => ({ ...prev, total: prev.total + 1 }));
                }
                openDetail(res.data);
                return res.data;
            }
            toast.error(res.message || 'Lỗi khi đăng chiến dịch');
        } catch {
            toast.error('Đã xảy ra lỗi hệ thống khi đăng chiến dịch');
        } finally {
            publishingRef.current = false;
        }
        return null;
    }, [ensureAuxData, refreshFlows, navigate, openDetail]);

    const executeDelete = useCallback(async (id: string, deleteFlowMode: number) => {
        if (isDeletingRef.current) return;
        isDeletingRef.current = true;
        let snapshot: Campaign[] = [];
        setCampaigns(prev => { snapshot = prev; return prev.filter(c => c.id !== id); });
        setMeta(prev => ({ ...prev, total: Math.max(0, prev.total - 1) }));
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setAdvancedDeleteModal(prev => ({ ...prev, isOpen: false }));
        try {
            const res = await api.delete(`campaigns/${id}?delete_flow=${deleteFlowMode}`);
            if (res.success) {
                toast.success('Đã xóa chiến dịch thành công!');
                const deleted = snapshot.find(c => c.id === id);
                logAction('Xóa chiến dịch', `Đã xóa chiến dịch: ${deleted ? deleted.name : id}`);
                api.clearCache('campaigns');
                if (deleteFlowMode === 1) refreshFlows();
                reloadList(); // re-sync page/total with server
            } else {
                toast.error(res.message || 'Lỗi khi xóa chiến dịch');
                setCampaigns(snapshot);
                setMeta(prev => ({ ...prev, total: prev.total + 1 }));
            }
        } catch {
            toast.error('Đã xảy ra lỗi hệ thống khi xóa chiến dịch');
            setCampaigns(snapshot);
            setMeta(prev => ({ ...prev, total: prev.total + 1 }));
        } finally {
            isDeletingRef.current = false;
        }
    }, [refreshFlows, reloadList]);

    const handleDeleteCampaign = useCallback(async (id: string) => {
        setSelectedDetailCampaign(prev => prev?.id === id ? null : prev);
        const targetCampaign = campaignsRef.current.find(c => c.id === id);
        const isDraft = !targetCampaign?.status || targetCampaign.status === CampaignStatus.DRAFT;
        const flows = await ensureAuxData();
        const connectedFlows = flows.filter(f => {
            const trigger = f.steps?.find(s => s.type === 'trigger');
            return trigger?.config?.type === 'campaign' && trigger.config.targetId === id;
        });

        if (connectedFlows.length > 0) {
            setAdvancedDeleteModal({ isOpen: true, campaignId: id, flows: connectedFlows, deleteFlowMode: 0 });
        } else {
            setConfirmModal({
                isOpen: true,
                title: isDraft ? 'Xóa bản nháp chiến dịch' : 'Xác nhận xóa chiến dịch',
                message: isDraft
                    ? `Bạn có chắc chắn muốn xóa bản nháp "${targetCampaign?.name || 'Chiến dịch mới'}" không?`
                    : 'Bạn có chắc chắn muốn xóa chiến dịch này không? Toàn bộ dữ liệu kết quả và thống kê sẽ bị xóa vĩnh viễn.',
                variant: 'danger',
                requireConfirmText: isDraft ? undefined : 'DELETE',
                onConfirm: () => executeDelete(id, 1)
            });
        }
    }, [ensureAuxData, executeDelete]);

    const handlePauseCampaign = useCallback(async (id: string) => {
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: CampaignStatus.PAUSED } : c));
        try {
            const res = await api.post<any>('campaigns?route=pause', { campaign_id: id });
            if (res.success) {
                toast.success('Đã tạm dừng chiến dịch!');
                logAction('Tạm dừng chiến dịch', `Chiến dịch: ${id}`);
            } else {
                toast.error(res.message || 'Không thể tạm dừng chiến dịch');
                reloadList();
            }
        } catch (err) {
            console.error('handlePauseCampaign error:', err);
            toast.error('Lỗi khi tạm dừng chiến dịch');
            reloadList();
        }
    }, [reloadList]);

    const handleResumeCampaign = useCallback(async (id: string) => {
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: CampaignStatus.SENDING } : c));
        try {
            const res = await api.post<any>('campaigns?route=resume', { campaign_id: id });
            if (res.success) {
                toast.success('Đã tiếp tục gửi chiến dịch!');
                logAction('Tiếp tục chiến dịch', `Chiến dịch: ${id}`);
            } else {
                toast.error(res.message || 'Không thể tiếp tục chiến dịch');
                reloadList();
            }
        } catch (err) {
            console.error('handleResumeCampaign error:', err);
            toast.error('Lỗi khi tiếp tục chiến dịch');
            reloadList();
        }
    }, [reloadList]);

    const handleRenameCampaign = useCallback(async (id: string, newName: string) => {
        try {
            const res = await api.post<any>('campaigns?route=rename', { id, name: newName });
            if (res.success) {
                toast.success('Đã cập nhật tên chiến dịch!');
                setCampaigns(prev => prev.map(c => c.id === id ? { ...c, name: newName } : c));
                setSelectedDetailCampaign(prev => prev?.id === id ? { ...prev, name: newName } : prev);
                logAction('Đổi tên chiến dịch', `Đã đổi tên chiến dịch ${id} thành: ${newName}`);
            } else {
                toast.error(res.message || 'Không thể đổi tên chiến dịch');
            }
        } catch (err) {
            console.error('handleRenameCampaign error:', err);
            toast.error('Lỗi khi đổi tên chiến dịch');
        }
    }, []);

    const handlePlayClick = useCallback(async (campaign: Campaign) => {
        const flows = await ensureAuxData();
        const flow = flows.find(f => {
            const trigger = f.steps?.find(s => s.type === 'trigger');
            return trigger?.config?.type === 'campaign' && trigger.config.targetId === campaign.id;
        });
        if (flow) setFlowReviewData({ campaign, flow });
        else toast('Chiến dịch này chưa được kết nối với kịch bản chăm sóc nào.');
    }, [ensureAuxData]);

    const handleConfirmStart = async () => {
        if (!flowReviewData?.flow) return;
        setIsStartingFlow(true);
        try {
            const res = await api.put(`flows/${flowReviewData.flow.id}`, { status: 'active' });
            if (res.success) {
                toast.success('Kịch bản chăm sóc đã được kích hoạt!');
                setAllFlows(prev => prev.map(f => f.id === flowReviewData.flow!.id ? { ...f, status: 'active' } : f));
                reloadList();
            } else {
                toast.error(res.message || 'Không thể kích hoạt kịch bản.');
            }
        } catch {
            toast.error('Không thể kích hoạt kịch bản.');
        } finally {
            setIsStartingFlow(false);
            setFlowReviewData(null);
        }
    };

    const handleEdit = useCallback((c: Campaign) => openWizard(c), [openWizard]);

    // ── Filter handlers (always reset to page 1) ─────────────────────────────
    const changeTab = useCallback((id: StatusTab) => { setActiveTab(id); setPage(1); }, []);
    const changeType = useCallback((v: string) => { setActiveType(v as TypeFilter); setPage(1); }, []);
    const changeDate = useCallback((v: string) => { setDatePreset(v as DatePreset); setPage(1); }, []);
    const isFiltered = activeTab !== 'all' || activeType !== 'all' || !!debouncedSearch || datePreset !== '90';
    const clearFilters = useCallback(() => {
        setActiveTab('all'); setActiveType('all'); setDatePreset('90'); setCustomDate({ start: '', end: '' });
        setSearchTerm(''); setDebouncedSearch(''); setPage(1);
    }, []);

    const quotaTone = awsQuickInfo
        ? (awsQuickInfo.usage_pct > 80 ? 'bg-rose-50 text-rose-700' : awsQuickInfo.usage_pct > 60 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700')
        : '';

    return (
        <div className="w-full flex flex-col gap-5">
            <PageHero
                title="Chiến dịch Marketing"
                subtitle="Gửi Email & Zalo ZNS, theo dõi tỷ lệ mở, click và hiệu quả từng chiến dịch."
                actions={[
                    { label: 'Chiến dịch mới', icon: Plus, onClick: handleCreateClick, primary: true },
                ]}
            >
                <div
                    onClick={() => setIsQuotaModalOpen(true)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[var(--radius-md)] text-xs font-semibold bg-[var(--color-surface)] border border-[var(--color-border)] shadow-[var(--shadow-xs)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
                    title="Nhấn để xem chi tiết hạn mức gửi AWS SES"
                >
                    <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span className="text-[var(--color-text)]">Hạn mức gửi:</span>
                    {awsQuickInfo ? (
                        <span className={`px-1.5 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-bold ${quotaTone}`}>
                            còn {awsQuickInfo.remaining.toLocaleString('vi-VN')}
                        </span>
                    ) : (
                        <span className="inline-block w-14 h-4 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[6px]" />
                    )}
                </div>
            </PageHero>

            {/* Stat row — 4 cards on one line (desktop) */}
            <div className="flex flex-col gap-1.5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        title="Tổng chiến dịch"
                        value={stats.totalCampaigns.toLocaleString('vi-VN')}
                        icon={<PieChart />}
                        color="#6366f1"
                        loading={loading}
                        breakdown={
                            <>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Đang chạy: {stats.running.toLocaleString('vi-VN')}</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Bản nháp: {stats.draft.toLocaleString('vi-VN')}</span>
                            </>
                        }
                    />
                    <StatCard
                        title="Tổng đã gửi"
                        value={stats.totalSent.toLocaleString('vi-VN')}
                        icon={<Send />}
                        color="#3b82f6"
                        loading={loading}
                        breakdown={
                            <>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Email: {stats.emailSent.toLocaleString('vi-VN')}</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />Zalo: {stats.zaloSent.toLocaleString('vi-VN')}</span>
                            </>
                        }
                    />
                    <StatCard
                        title="Tỷ lệ mở"
                        value={`${stats.openRate}%`}
                        icon={<MailOpen />}
                        color="#10b981"
                        loading={loading}
                        breakdown={
                            <>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Lượt mở: {stats.totalOpened.toLocaleString('vi-VN')}</span>
                                <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Chưa mở: {Math.max(0, stats.totalSent - stats.totalOpened).toLocaleString('vi-VN')}</span>
                            </>
                        }
                    />
                    <StatCard
                        title="Lượt click"
                        value={stats.totalClicked.toLocaleString('vi-VN')}
                        icon={<MousePointerClick />}
                        color="#f59e0b"
                        loading={loading}
                        breakdown={
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />CTR: {stats.ctr}%</span>
                        }
                    />
                </div>
                {statsArePageScoped && !loading && (
                    <p className="text-xs text-[var(--color-text-muted)]">
                        Số liệu gửi / mở / click được tính trên {campaigns.length.toLocaleString('vi-VN')} chiến dịch của trang hiện tại.
                    </p>
                )}
            </div>

            {/* Main panel */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)] overflow-hidden">
                {/* Toolbar — ONE row: tabs left, filters + search right */}
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
                    <div className="max-w-full overflow-x-auto">
                        <Tabs variant="segmented" size="sm" activeId={activeTab} onChange={changeTab} items={TAB_ITEMS} />
                    </div>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <div className="w-[150px]">
                            <Select size="sm" value={datePreset} onChange={changeDate} options={DATE_OPTIONS} />
                        </div>
                        {datePreset === 'custom' && (
                            <div className="flex items-center gap-1 h-9 px-2 border border-[var(--color-border)] rounded-[var(--radius-md)] bg-[var(--color-surface)]">
                                <input
                                    type="date"
                                    value={customDate.start}
                                    max={customDate.end || undefined}
                                    onChange={e => { setCustomDate(prev => ({ ...prev, start: e.target.value })); setPage(1); }}
                                    className="bg-transparent text-[13px] outline-none text-[var(--color-text)] w-[118px]"
                                    aria-label="Từ ngày"
                                />
                                <span className="text-[var(--color-text-muted)]">–</span>
                                <input
                                    type="date"
                                    value={customDate.end}
                                    min={customDate.start || undefined}
                                    onChange={e => { setCustomDate(prev => ({ ...prev, end: e.target.value })); setPage(1); }}
                                    className="bg-transparent text-[13px] outline-none text-[var(--color-text)] w-[118px]"
                                    aria-label="Đến ngày"
                                />
                            </div>
                        )}
                        <div className="w-[140px]">
                            <Select size="sm" value={activeType} onChange={changeType} options={TYPE_OPTIONS} />
                        </div>
                        <SearchBox
                            value={searchTerm}
                            onChange={setSearchTerm}
                            placeholder="Tìm theo tên, tiêu đề..."
                            className="w-full sm:w-64"
                        />
                    </div>
                </div>

                <CampaignList
                    campaigns={filteredCampaigns}
                    loading={loading}
                    refreshing={refreshing}
                    onSelect={openDetail}
                    onEdit={handleEdit}
                    onDelete={handleDeleteCampaign}
                    onPlayFlow={handlePlayClick}
                    onPause={handlePauseCampaign}
                    onResume={handleResumeCampaign}
                    onRename={handleRenameCampaign}
                    onCreate={handleCreateClick}
                    isFiltered={isFiltered}
                    onClearFilters={clearFilters}
                />

                <Pagination
                    currentPage={page}
                    totalPages={meta.totalPages}
                    totalCount={meta.total}
                    itemsPerPage={PAGE_LIMIT}
                    onPageChange={setPage}
                />
            </div>

            {AdminPermModal}

            <Modal isOpen={isQuotaModalOpen} onClose={() => setIsQuotaModalOpen(false)} title="Hạn mức gửi email (Quota)" size="sm" isDarkTheme={isDark}>
                {isQuotaModalOpen && (
                    <Suspense
                        fallback={
                            <div className="space-y-3 py-2">
                                <div className="h-20 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                                <div className="h-12 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                                <div className="h-12 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                            </div>
                        }
                    >
                        <SesQuotaWidget mode="sidebar" />
                    </Suspense>
                )}
            </Modal>

            <Suspense fallback={null}>
                {wizardMounted && (
                    <CampaignWizard
                        isOpen={isWizardOpen}
                        onClose={() => setIsWizardOpen(false)}
                        initialData={wizardInitialData}
                        allLists={allLists}
                        allSegments={allSegments}
                        allTags={allTags}
                        allTemplates={allTemplates}
                        allFlows={allFlows}
                        senderEmails={verifiedEmails}
                        onSaveDraft={handleSaveDraft}
                        onPublish={handlePublish}
                    />
                )}
                {drawerMounted && (
                    <CampaignDetailDrawer
                        campaign={selectedDetailCampaign}
                        isOpen={!!selectedDetailCampaign}
                        onClose={() => setSelectedDetailCampaign(null)}
                        allLists={allLists}
                        allSegments={allSegments}
                        allTags={allTags}
                        allFlows={allFlows}
                        onRename={handleRenameCampaign}
                    />
                )}
                {isTipsModalOpen && (
                    <TipsModal
                        isOpen={isTipsModalOpen}
                        onClose={() => setIsTipsModalOpen(false)}
                        title="Mẹo chiến dịch"
                        subtitle="Tối ưu nội dung & tỷ lệ chuyển đổi"
                        accentColor="blue"
                        tips={[
                            { icon: Clock, title: 'Khung giờ vàng', description: 'Gửi vào 8h–9h sáng thường đạt tỷ lệ mở cao nhất trong ngày.', colorClass: 'bg-[var(--color-primary)]', highlight: 'Hiệu quả' },
                            { icon: Sparkles, title: 'Cá nhân hóa nội dung', description: 'Dùng biến {first_name} trong tiêu đề để tăng tỷ lệ click.', colorClass: 'bg-[var(--color-primary)]', highlight: 'Mẹo hay' },
                            { icon: Target, title: 'Theo dõi click', description: 'Luôn bật theo dõi click để biết chính xác ai quan tâm đến sản phẩm.', colorClass: 'bg-[var(--color-primary)]' },
                            { icon: Zap, title: 'Follow-up tự động', description: 'Kết nối Flow chăm sóc ngay sau khi gửi để tối đa điểm chạm khách hàng.', colorClass: 'bg-emerald-500', highlight: 'Nâng cao' },
                            { icon: ShieldCheck, title: 'Vệ sinh tệp gửi', description: 'Ưu tiên gửi tới liên hệ hoạt động trong 30 ngày qua để bảo vệ uy tín tên miền gửi.', colorClass: 'bg-rose-500' }
                        ]}
                    />
                )}
            </Suspense>

            <FlowReviewModal
                isOpen={!!flowReviewData}
                onClose={() => setFlowReviewData(null)}
                onConfirm={handleConfirmStart}
                campaign={flowReviewData?.campaign || null}
                flow={flowReviewData?.flow || null}
                isProcessing={isStartingFlow}
                isDarkTheme={isDark}
            />

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
                requireConfirmText={confirmModal.requireConfirmText}
                isDarkTheme={isDark}
            />

            <ConfirmModal
                isOpen={advancedDeleteModal.isOpen}
                onClose={() => setAdvancedDeleteModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={() => {
                    if (advancedDeleteModal.campaignId) executeDelete(advancedDeleteModal.campaignId, advancedDeleteModal.deleteFlowMode);
                }}
                title="Xác nhận xóa chiến dịch"
                isDarkTheme={isDark}
                message={
                    <div className="flex flex-col gap-3">
                        <p className="text-sm text-[var(--color-text-secondary)]">
                            Chiến dịch đang được kết nối với <b>{advancedDeleteModal.flows.length} kịch bản (Flow)</b> chăm sóc.
                        </p>
                        {[
                            { mode: 0, title: 'Giữ lại Flow (chỉ gỡ kết nối)', desc: 'Chiến dịch bị xóa, kịch bản chăm sóc được giữ lại với trigger trống.', tone: 'border-amber-300 bg-amber-50' },
                            { mode: 1, title: 'Xóa toàn bộ (chiến dịch & Flow)', desc: `Xóa vĩnh viễn chiến dịch và ${advancedDeleteModal.flows.length} flow đang theo dõi chiến dịch này.`, tone: 'border-rose-300 bg-rose-50' },
                        ].map(opt => (
                            <label
                                key={opt.mode}
                                className={`flex items-start gap-3 p-3 border rounded-[var(--radius-md)] cursor-pointer transition-colors ${advancedDeleteModal.deleteFlowMode === opt.mode ? opt.tone : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
                            >
                                <input
                                    type="radio"
                                    name="delete_flow"
                                    checked={advancedDeleteModal.deleteFlowMode === opt.mode}
                                    onChange={() => setAdvancedDeleteModal(prev => ({ ...prev, deleteFlowMode: opt.mode }))}
                                    className="mt-1"
                                />
                                <span className="flex flex-col">
                                    <b className={`text-sm ${opt.mode === 1 ? 'text-rose-700' : 'text-[var(--color-text)]'}`}>{opt.title}</b>
                                    <span className="text-xs text-[var(--color-text-muted)] mt-0.5">{opt.desc}</span>
                                </span>
                            </label>
                        ))}
                    </div>
                }
                variant={advancedDeleteModal.deleteFlowMode === 1 ? 'danger' : 'warning'}
                requireConfirmText={advancedDeleteModal.deleteFlowMode === 1 ? 'DELETE' : undefined}
            />
        </div>
    );
};

export default Campaigns;
