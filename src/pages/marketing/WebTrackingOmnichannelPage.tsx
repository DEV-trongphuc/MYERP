import { EXTERNAL_ASSET_BASE } from '../../components/marketing/utils/config';
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../components/marketing/services/storageAdapter';
import toast from 'react-hot-toast';
import {
    Plus, Trash2, Code, Globe,
    MousePointerClick, Activity, ArrowUpRight,
    Users, GanttChartSquare, RefreshCw, BarChart2,
    Monitor, Smartphone, Tablet,
    Copy, MousePointer, MessageSquare, Sparkles, ArrowLeft, ShieldCheck, Filter,
    Webhook, Bot, Share2
} from 'lucide-react';
import PageHero from '../../components/marketing/components/common/PageHero';
import StatCard from '../../components/marketing/components/common/StatCard';
import SearchBox from '../../components/marketing/components/common/SearchBox';
import Button from '../../components/marketing/components/common/Button';
import Tabs from '../../components/marketing/components/common/Tabs';
import Select from '../../components/marketing/components/common/Select';
import {
    MktPage, MktPanel, MktToolbar, MktStatGrid, MktEmpty
} from '../../components/marketing/components/dashboard/MktLayout';

// Sub-components
import { WebProperty, WebStats, Visitor, VisitorStats } from '../../components/marketing/components/web-tracking/types';
import { useNavigation } from '../../components/marketing/contexts/NavigationContext';
import { useLocation, useSearchParams } from 'react-router-dom';

const OverviewTab = React.lazy(() => import('../../components/marketing/components/web-tracking/OverviewTab'));
const VisitorsTab = React.lazy(() => import('../../components/marketing/components/web-tracking/VisitorsTab'));
const ConversationsTab = React.lazy(() => import('../../components/marketing/components/web-tracking/conversations/ConversationsTab'));
const WebTrackingModals = React.lazy(() => import('../../components/marketing/components/web-tracking/WebTrackingModals'));
const ApiTriggersView = React.lazy(() => import('../../components/marketing/views/ApiTriggers'));
const MetaMessengerView = React.lazy(() => import('../../components/marketing/views/MetaMessenger'));
const AITrainingView = React.lazy(() => import('../../components/marketing/views/AITraining'));

type OmniModule = 'web' | 'ai' | 'meta' | 'api-triggers';

const WebTracking: React.FC = () => {
    const { setCustomBackAction } = useNavigation();
    const location = useLocation();
    const [, setSearchParams] = useSearchParams();
    const [omniModule, setOmniModule] = useState<OmniModule>('web');

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const tabParam = params.get('tab');
        if (tabParam === 'ai') setOmniModule('ai');
        else if (tabParam === 'api-triggers') setOmniModule('api-triggers');
        else if (tabParam === 'meta') setOmniModule('meta');
        else setOmniModule('web');
    }, [location.search]);

    const switchOmniModule = (next: OmniModule) => {
        setOmniModule(next);
        setSearchParams(next === 'web' ? {} : { tab: next }, { replace: true });
    };

    const [websites, setWebsites] = useState<WebProperty[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedWebsite, setSelectedWebsite] = useState<WebProperty | null>(null);
    const [view, setView] = useState<'list' | 'report'>('list');
    const [tab, setTab] = useState<'overview' | 'visitors' | 'heatmap' | 'pages' | 'events' | 'chat'>('overview');
    const [targetConversationId, setTargetConversationId] = useState<string | null>(null);

    // Add Modal State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newSiteData, setNewSiteData] = useState({ name: '', domain: '' });

    // Report State
    const [stats, setStats] = useState<WebStats | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [reportPeriod, setReportPeriod] = useState('7d');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportDevice, setReportDevice] = useState<'all' | 'mobile' | 'desktop' | 'tablet' | 'bot'>('all');

    // Setup Script State
    const [showScript, setShowScript] = useState(false);
    const [includeAiChat, setIncludeAiChat] = useState(true);
    const [copied, setCopied] = useState(false);

    // Delete Modal State
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [siteToDelete, setSiteToDelete] = useState<WebProperty | null>(null);

    // Visitors State
    const [visitors, setVisitors] = useState<Visitor[]>([]);
    const [selectedVisitor, setSelectedVisitor] = useState<Visitor | null>(null);

    const backToVisitors = React.useCallback(() => setSelectedVisitor(null), []);
    const backToList = React.useCallback(() => setView('list'), []);

    // Smart Back Logic
    useEffect(() => {
        if (selectedVisitor) {
            setCustomBackAction(() => backToVisitors);
        } else if (view === 'report') {
            setCustomBackAction(() => backToList);
        } else {
            setCustomBackAction(null);
        }

        return () => setCustomBackAction(null);
    }, [selectedVisitor, view, setCustomBackAction, backToVisitors, backToList]);

    const [visitorEvents, setVisitorEvents] = useState<any[]>([]);
    const [visitorStats, setVisitorStats] = useState<VisitorStats | null>(null);
    const [visitorPage, setVisitorPage] = useState(1);
    const [visitorPagination, setVisitorPagination] = useState<any>(null);
    const [visitorSearch, setVisitorSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [visitorLoyalty, setVisitorLoyalty] = useState<'all' | 'returning' | 'identified'>('all');
    const [liveVisitorCount, setLiveVisitorCount] = useState(0);
    const [visitorType, setVisitorType] = useState<'user' | 'bot'>('user');

    // Heatmap State
    const [heatmapUrl, setHeatmapUrl] = useState('');
    const [, setHeatmapData] = useState<any[]>([]);
    const [, setAvailablePages] = useState<string[]>([]);
    const [, setHeatmapLoading] = useState(false);
    const [heatmapDevice] = useState<'all' | 'mobile' | 'desktop'>('all');
    const [websiteSearch, setWebsiteSearch] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        fetchWebsites();
        const now = new Date();
        const start = new Date();
        start.setDate(now.getDate() - 7);
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(visitorSearch);
        }, 300);
        return () => clearTimeout(timer);
    }, [visitorSearch]);

    useEffect(() => {
        if (selectedWebsite && view === 'report') {
            fetchStats();
            if (tab === 'visitors') fetchVisitors();
            if (tab === 'overview' || tab === 'heatmap') fetchAvailablePages();
        }
    }, [selectedWebsite, view, reportPeriod, tab, startDate, endDate, reportDevice, visitorPage, debouncedSearch, visitorLoyalty, visitorType]);

    // Reset page on filter change
    useEffect(() => {
        setVisitorPage(1);
        setTargetConversationId(null);
    }, [reportDevice, debouncedSearch, visitorLoyalty, selectedWebsite, visitorType]);

    useEffect(() => {
        if (tab === 'heatmap' && heatmapUrl) {
            fetchHeatmap();
        }
    }, [heatmapUrl, tab, heatmapDevice]);

    const fetchWebsites = async () => {
        try {
            const res = await api.get<WebProperty[]>('web_tracking?action=list');
            if (res.success) {
                setWebsites(Array.isArray(res.data) ? res.data : []);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        if (!selectedWebsite) return;
        setStatsLoading(true);
        try {
            const deviceParam = reportDevice !== 'all' ? `&device=${reportDevice}` : '';
            let url = `web_tracking?action=stats&id=${selectedWebsite.id}&period=${reportPeriod}${deviceParam}`;
            if (reportPeriod === 'custom' && startDate && endDate) {
                url += `&start_date=${startDate}&end_date=${endDate}`;
            }
            const res = await api.get<WebStats>(url);
            if (res.success) {
                setStats(res.data);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setStatsLoading(false);
        }
    };

    const fetchVisitors = async () => {
        if (!selectedWebsite) return;
        try {
            let deviceParam = reportDevice !== 'all' ? `&device=${reportDevice}` : '';
            if (visitorType === 'bot') {
                deviceParam = '&device=bot';
            }

            const searchParam = debouncedSearch ? `&q=${encodeURIComponent(debouncedSearch)}` : '';
            const loyaltyParam = visitorLoyalty !== 'all' ? `&returning=${visitorLoyalty}` : '';
            const res = await api.get<any>(`web_tracking?action=visitors&id=${selectedWebsite.id}${deviceParam}${searchParam}${loyaltyParam}&page=${visitorPage}`);
            if (res.success) {
                const newVisitors = res.data.visitors || [];
                setVisitors(newVisitors);
                setVisitorPagination(res.data.pagination);
                setLiveVisitorCount(res.data.live_count || 0);

                if (newVisitors.length > 0) {
                    const isStillSelected = newVisitors.some((v: any) => v.id === selectedVisitor?.id);
                    if (!isStillSelected) {
                        fetchVisitorJourney(newVisitors[0]);
                    }
                } else {
                    setSelectedVisitor(null);
                }
            }
        } catch (e) { console.error(e); }
    };

    const fetchVisitorJourney = async (visitor: Visitor) => {
        setSelectedVisitor(visitor);
        setVisitorEvents([]);
        setVisitorStats(null);
        try {
            const res = await api.get<any>(`web_tracking?action=visitors&id=${selectedWebsite?.id}&visitor_id=${visitor.id}`);
            if (res.success && res.data) {
                const rawEvents = Array.isArray(res.data) ? res.data : (res.data.timeline || []);
                const vStats = !Array.isArray(res.data) ? res.data.stats : null;

                setVisitorStats(vStats);

                const mapped = rawEvents.map((ev: any) => ({
                    ...ev,
                    timestamp: ev.time || ev.created_at || ev.loaded_at,
                    target_text: ev.target,
                    page_title: ev.page_title,
                    url: ev.url,
                    element_info: ev.meta?.element || ev.meta?.text,
                    duration: ev.duration,
                    source: ev.source
                }));
                setVisitorEvents(mapped);
            }
        } catch (e) {
            console.error('Visitor journey error:', e);
        }
    };

    const fetchAvailablePages = async () => {
        if (!selectedWebsite || !stats?.topPages) return;
        const pages = stats.topPages.map(p => p.url);
        setAvailablePages(pages);
        if (pages.length > 0 && !heatmapUrl) {
            setHeatmapUrl(pages[0]);
        }
    };

    const fetchHeatmap = async () => {
        if (!selectedWebsite || !heatmapUrl) return;
        setHeatmapLoading(true);
        try {
            let url = `web_tracking?action=heatmap&id=${selectedWebsite.id}&url=${encodeURIComponent(heatmapUrl)}`;
            if (heatmapDevice !== 'all') {
                url += `&device=${heatmapDevice}`;
            }
            const res = await api.get<any[]>(url);
            if (res.success) {
                setHeatmapData(res.data || []);
            }
        } catch (e) {
            console.error('Heatmap error:', e);
        } finally {
            setHeatmapLoading(false);
        }
    };

    const handleAddWebsite = async () => {
        if (!newSiteData.name || !newSiteData.domain) {
            toast.error('Vui lòng điền đầy đủ thông tin');
            return;
        }
        try {
            const res = await api.post<WebProperty>('web_tracking?action=create', newSiteData);
            if (res.success) {
                toast.success('Thêm website thành công!');
                setWebsites([res.data, ...websites]);
                setIsAddOpen(false);
                setNewSiteData({ name: '', domain: '' });
            }
        } catch (e: any) {
            toast.error(e.message || 'Có lỗi xảy ra');
        }
    };

    const handleDeleteClick = (site: WebProperty, e: React.MouseEvent) => {
        e.stopPropagation();
        setSiteToDelete(site);
        setIsDeleteOpen(true);
    };

    const confirmDeleteAction = async () => {
        if (!siteToDelete) return;

        try {
            await api.delete(`web_tracking?action=delete&id=${siteToDelete.id}`);
            toast.success('Đã xóa dữ liệu website');
            setWebsites(websites.filter(w => w.id !== siteToDelete.id));
            setIsDeleteOpen(false);
            setSiteToDelete(null);
            if (selectedWebsite?.id === siteToDelete.id) {
                setView('list');
                setSelectedWebsite(null);
            }
        } catch (e: any) {
            toast.error(e.message || 'Lỗi xóa');
        }
    };

    const copyScript = () => {
        if (!selectedWebsite) return;

        let actualScript = '';
        if (includeAiChat) {
            actualScript = `<!-- MailFlow Pro Tracker & AI Chat -->
<script>
  window._mf_config = {
    property_id: "${selectedWebsite.id}",
    ai_chat: true
  };
</script>
<script src="${EXTERNAL_ASSET_BASE}/tracker.js" async></script>`;
        } else {
            actualScript = `<!-- MailFlow Pro Tracker -->
<script src="${EXTERNAL_ASSET_BASE}/tracker.js" data-website-id="${selectedWebsite.id}" async></script>`;
        }

        navigator.clipboard.writeText(actualScript);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleJumpToChat = (conversationId: string) => {
        setTargetConversationId(conversationId);
        setTab('chat');
    };

    const renderEventIcon = (type: string) => {
        switch (type) {
            case 'pageview': return <Globe className="w-4 h-4 text-blue-500" />;
            case 'click': return <MousePointerClick className="w-4 h-4 text-emerald-500" />;
            case 'canvas_click': return <GanttChartSquare className="w-4 h-4 text-indigo-500" />;
            case 'scroll': return <ArrowUpRight className="w-4 h-4 text-orange-400" />;
            case 'identify': return <Users className="w-4 h-4 text-purple-500" />;
            case 'copy': return <Copy className="w-4 h-4 text-rose-500" />;
            case 'select': return <MousePointer className="w-4 h-4 text-amber-600" />;
            case 'form': return <Sparkles className="w-4 h-4 text-[#2563eb]" />;
            default: return <Activity className="w-4 h-4 text-slate-400" />;
        }
    };

    const formatDuration = (seconds: number) => {
        if (!seconds) return '0s';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    const safeFormatDate = (dateValue: any) => {
        if (!dateValue) return 'N/A';
        try {
            let date: Date;
            if (typeof dateValue === 'number') {
                date = dateValue < 10000000000 ? new Date(dateValue * 1000) : new Date(dateValue);
            } else if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(dateValue)) {
                date = new Date(dateValue.replace(' ', 'T'));
            } else {
                date = new Date(dateValue);
            }
            if (isNaN(date.getTime())) return 'N/A';
            return date.toLocaleString('vi-VN', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit'
            });
        } catch (e) {
            return 'N/A';
        }
    };

    const shortenUrl = (url: string) => {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname + urlObj.search;
        } catch {
            return url;
        }
    };

    const getUserInitials = (visitor: Visitor) => {
        const name = visitor.first_name || visitor.subscriber?.first_name || visitor.email || 'Anonymous';
        return name.substring(0, 2).toUpperCase();
    };

    const filteredWebsites = useMemo(
        () => websites.filter(site =>
            (site.name || '').toLowerCase().includes(websiteSearch.toLowerCase()) ||
            (site.domain || '').toLowerCase().includes(websiteSearch.toLowerCase())
        ),
        [websites, websiteSearch]
    );

    if (omniModule === 'ai') return <React.Suspense fallback={null}><AITrainingView /></React.Suspense>;
    if (omniModule === 'meta') return <React.Suspense fallback={null}><MetaMessengerView /></React.Suspense>;
    if (omniModule === 'api-triggers') return <React.Suspense fallback={null}><ApiTriggersView /></React.Suspense>;

    return (
        <MktPage className="pb-12">
            {view === 'list' && (
                <>
                    <PageHero
                        title="Web Tracking & Đa kênh"
                        subtitle="Theo dõi toàn diện hành trình người dùng: Visitors, Sessions, Heatmaps và tích hợp đa kênh."
                        actions={[
                            { label: 'Thêm Website', icon: Plus, onClick: () => setIsAddOpen(true) }
                        ]}
                    />

                    {/* 4-Card KPI Row in ONE line */}
                    <MktStatGrid cols={4}>
                        <StatCard
                            loading={loading}
                            title="Tổng tên miền"
                            value={websites.length.toLocaleString('vi-VN')}
                            icon={<Globe />}
                            color="#BD1D2D"
                            breakdown={<span>Đang kết nối hệ thống</span>}
                        />
                        <StatCard
                            loading={loading}
                            title="Đang hoạt động"
                            value={websites.length.toLocaleString('vi-VN')}
                            icon={<Activity />}
                            color="#BD1D2D"
                            breakdown={<span>Realtime Tracker Online</span>}
                        />
                        <StatCard
                            loading={loading}
                            title="Bảo vệ chống Bot"
                            value={websites.length.toLocaleString('vi-VN')}
                            icon={<ShieldCheck />}
                            color="#BD1D2D"
                            breakdown={<span>Premium Bot & IP Shield</span>}
                        />
                        <StatCard
                            loading={loading}
                            title="Tích hợp Đa kênh"
                            value="4"
                            icon={<Share2 />}
                            color="#BD1D2D"
                            breakdown={<span>Web, AI Chat, Meta, Webhook</span>}
                        />
                    </MktStatGrid>

                    <MktPanel>
                        <MktToolbar
                            left={
                                <Tabs
                                    activeId={omniModule}
                                    onChange={(id) => switchOmniModule(id as OmniModule)}
                                    variant="segmented"
                                    items={[
                                        { id: 'web', label: 'Website Tracking', icon: Globe, count: websites.length },
                                        { id: 'ai', label: 'AI Training', icon: Bot },
                                        { id: 'meta', label: 'Meta Messenger', icon: MessageSquare },
                                        { id: 'api-triggers', label: 'API & Webhook', icon: Webhook },
                                    ]}
                                />
                            }
                            right={
                                <>
                                    <SearchBox
                                        value={websiteSearch}
                                        onChange={setWebsiteSearch}
                                        placeholder="Tìm kiếm tên miền, website..."
                                        className="w-64"
                                    />
                                    <Button variant="outline" icon={RefreshCw} onClick={fetchWebsites} title="Làm mới">
                                        Làm mới
                                    </Button>
                                </>
                            }
                        />

                        {loading ? (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {[0, 1, 2].map((i) => (
                                    <div key={i} className="h-44 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg)] animate-pulse" />
                                ))}
                            </div>
                        ) : websites.length === 0 ? (
                            <MktEmpty
                                icon={Globe}
                                title="Chưa có website nào được kết nối"
                                description="Thêm tên miền website để bắt đầu theo dõi lượt truy cập, hành trình người dùng và cài đặt AI Livechat."
                                actionLabel="Thêm Website đầu tiên"
                                onAction={() => setIsAddOpen(true)}
                            />
                        ) : filteredWebsites.length === 0 ? (
                            <MktEmpty
                                icon={Globe}
                                title="Không tìm thấy website phù hợp"
                                description="Thử thay đổi từ khóa tìm kiếm hoặc xóa bộ lọc."
                                actionLabel="Xóa tìm kiếm"
                                onAction={() => setWebsiteSearch('')}
                            />
                        ) : (
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {filteredWebsites.map(site => (
                                    <div
                                        key={site.id}
                                        className="group bg-[var(--color-surface)] p-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-xs)] hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-md)] transition-all flex flex-col justify-between gap-5 h-full"
                                    >
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
                                                    <Globe className="w-5 h-5" />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-sm font-bold text-[var(--color-text)] truncate" title={site.name}>{site.name}</h4>
                                                    <p className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5 truncate">{site.domain}</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteClick(site, e)}
                                                className="w-8 h-8 rounded-[var(--radius-md)] inline-flex items-center justify-center text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                                                title="Xóa website"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg)] rounded-[var(--radius-md)] border border-[var(--color-border-light)] text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                                    <span className="font-semibold text-[var(--color-text)]">Online</span>
                                                </div>
                                                <div className="flex items-center gap-1 text-[var(--color-text-muted)]">
                                                    <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                                                    <span className="font-medium">Premium Shield</span>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    variant="outline"
                                                    icon={Code}
                                                    onClick={() => { setSelectedWebsite(site); setShowScript(true); }}
                                                >
                                                    Mã nhúng
                                                </Button>
                                                <Button
                                                    variant="primary"
                                                    icon={BarChart2}
                                                    onClick={() => { setSelectedWebsite(site); setView('report'); }}
                                                >
                                                    Báo cáo
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </MktPanel>
                </>
            )}

            {view === 'report' && selectedWebsite && (
                <div className="flex flex-col gap-5">
                    <PageHero
                        title={`Website: ${selectedWebsite.name}`}
                        subtitle={`Báo cáo chi tiết cho tên miền ${selectedWebsite.domain}. Phân tích hành trình người dùng và đo lường chuyển đổi.`}
                    >
                        <Button variant="outline" icon={ArrowLeft} onClick={() => setView('list')}>
                            Danh sách
                        </Button>
                        <Button
                            variant={showFilters ? 'primary' : 'outline'}
                            icon={Filter}
                            onClick={() => setShowFilters(!showFilters)}
                        >
                            Bộ lọc
                        </Button>
                        <Button
                            variant="outline"
                            onClick={fetchStats}
                            title="Làm mới dữ liệu"
                            disabled={statsLoading}
                        >
                            <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
                        </Button>
                        <Button variant="primary" icon={Code} onClick={() => setShowScript(true)}>
                            Cài đặt mã
                        </Button>
                    </PageHero>

                    <MktPanel>
                        <MktToolbar
                            left={
                                <Tabs
                                    activeId={tab}
                                    onChange={setTab as any}
                                    variant="segmented"
                                    layoutId="webTrackingReportMainTabs"
                                    size="md"
                                    items={[
                                        { id: 'overview', label: 'Tổng quan báo cáo', icon: BarChart2 },
                                        { id: 'visitors', label: 'Hành trình User', icon: GanttChartSquare },
                                        { id: 'chat', label: 'Cuộc trò chuyện', icon: MessageSquare },
                                    ]}
                                />
                            }
                        />

                        {/* Filter Toolbar Section */}
                        {showFilters && (
                            <div className="px-4 py-3 bg-[var(--color-bg)] border-b border-[var(--color-border)] flex flex-wrap items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">Thiết bị:</span>
                                    <div className="inline-flex bg-[var(--color-surface)] p-0.5 rounded-[var(--radius-md)] border border-[var(--color-border)]">
                                        {([
                                            { id: 'all', label: 'Tất cả', icon: Globe },
                                            { id: 'desktop', label: 'Desktop', icon: Monitor },
                                            { id: 'mobile', label: 'Mobile', icon: Smartphone },
                                            { id: 'tablet', label: 'Tablet', icon: Tablet },
                                        ] as const).map((d) => {
                                            const Icon = d.icon;
                                            const active = reportDevice === d.id;
                                            return (
                                                <button
                                                    key={d.id}
                                                    type="button"
                                                    onClick={() => setReportDevice(d.id)}
                                                    className={`px-3 py-1.5 text-xs font-semibold rounded-[calc(var(--radius-md)-2px)] transition-colors inline-flex items-center gap-1.5 ${active ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-light)] hover:text-[var(--color-text)]'}`}
                                                >
                                                    <Icon className="w-3.5 h-3.5" />
                                                    {d.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-2 ml-auto">
                                    <div className="w-40">
                                        <Select
                                            options={[
                                                { value: '7d', label: '7 ngày qua' },
                                                { value: '30d', label: '30 ngày qua' },
                                                { value: 'this_month', label: 'Tháng này' },
                                                { value: 'last_month', label: 'Tháng trước' },
                                                { value: 'this_year', label: 'Năm nay' },
                                                { value: 'custom', label: 'Tùy chọn...' },
                                            ]}
                                            value={reportPeriod}
                                            onChange={(p) => {
                                                setReportPeriod(p);
                                                const now = new Date();
                                                let start = new Date();
                                                let end = new Date();
                                                if (p === '7d') start.setDate(now.getDate() - 7);
                                                if (p === '30d') start.setDate(now.getDate() - 30);
                                                if (p === 'this_month') { start.setDate(1); }
                                                if (p === 'last_month') {
                                                    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                                                    end = new Date(now.getFullYear(), now.getMonth(), 0);
                                                }
                                                if (p === 'this_year') { start.setMonth(0, 1); }
                                                if (p !== 'custom') {
                                                    setStartDate(start.toISOString().split('T')[0]);
                                                    setEndDate(end.toISOString().split('T')[0]);
                                                }
                                            }}
                                            variant="outline"
                                            className="h-9 bg-[var(--color-surface)]"
                                        />
                                    </div>
                                    <div className="inline-flex items-center gap-2 bg-[var(--color-surface)] px-3 h-9 rounded-[var(--radius-md)] border border-[var(--color-border)]">
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => { setStartDate(e.target.value); setReportPeriod('custom'); }}
                                            className="bg-transparent border-0 p-0 text-xs font-semibold text-[var(--color-text)] outline-none w-[110px]"
                                        />
                                        <span className="text-xs text-[var(--color-text-muted)]">đến</span>
                                        <input
                                            type="date"
                                            value={endDate}
                                            onChange={(e) => { setEndDate(e.target.value); setReportPeriod('custom'); }}
                                            className="bg-transparent border-0 p-0 text-xs font-semibold text-[var(--color-text)] outline-none w-[110px]"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab Content */}
                        <div className="p-4 md:p-6">
                            <React.Suspense fallback={null}>
                                {tab === 'overview' && (
                                    <OverviewTab
                                        stats={stats}
                                        formatDuration={formatDuration}
                                        shortenUrl={shortenUrl}
                                        renderEventIcon={renderEventIcon}
                                        property={selectedWebsite}
                                        startDate={startDate}
                                        endDate={endDate}
                                        reportDevice={reportDevice}
                                    />
                                )}

                                {tab === 'visitors' && (
                                    <VisitorsTab
                                        visitors={visitors}
                                        selectedVisitor={selectedVisitor}
                                        setSelectedVisitor={setSelectedVisitor}
                                        fetchVisitorJourney={fetchVisitorJourney}
                                        visitorEvents={visitorEvents}
                                        visitorStats={visitorStats}
                                        renderEventIcon={renderEventIcon}
                                        formatDuration={formatDuration}
                                        safeFormatDate={safeFormatDate}
                                        getUserInitials={getUserInitials}
                                        visitorType={visitorType}
                                        setVisitorType={setVisitorType}
                                        deviceFilter={reportDevice}
                                        pagination={visitorPagination}
                                        onPageChange={setVisitorPage}
                                        searchTerm={visitorSearch}
                                        setSearchTerm={setVisitorSearch}
                                        returningFilter={visitorLoyalty}
                                        setReturningFilter={setVisitorLoyalty}
                                        propertyId={selectedWebsite.id}
                                        property={selectedWebsite}
                                        liveCount={liveVisitorCount}
                                        fetchVisitors={fetchVisitors}
                                        onJumpToChat={handleJumpToChat}
                                    />
                                )}

                                {tab === 'chat' && (
                                    <ConversationsTab propertyId={selectedWebsite.id} initialConversationId={targetConversationId} />
                                )}
                            </React.Suspense>
                        </div>
                    </MktPanel>
                </div>
            )}

            {(isAddOpen || showScript || isDeleteOpen) && (
                <React.Suspense fallback={null}>
                    <WebTrackingModals
                        isAddOpen={isAddOpen}
                        setIsAddOpen={setIsAddOpen}
                        newSiteData={newSiteData}
                        setNewSiteData={setNewSiteData}
                        handleAddWebsite={handleAddWebsite}
                        showScript={showScript}
                        setShowScript={setShowScript}
                        includeAiChat={includeAiChat}
                        setIncludeAiChat={setIncludeAiChat}
                        selectedWebsite={selectedWebsite}
                        copyScript={copyScript}
                        copied={copied}
                        isDeleteOpen={isDeleteOpen}
                        setIsDeleteOpen={setIsDeleteOpen}
                        siteToDelete={siteToDelete}
                        confirmDeleteAction={confirmDeleteAction}
                    />
                </React.Suspense>
            )}
        </MktPage>
    );
};

export default WebTracking;

