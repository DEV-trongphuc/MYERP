import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles, Mail, Zap, FileText, Bot, Globe, Users, BarChart3, GitBranch, Settings, Clock, ArrowRight,
    MessageSquare, Ticket, Code2, Play, ClipboardList, QrCode, RefreshCw, Send, AlertTriangle,
    CheckCircle2, Award, ShieldCheck, Database, Layers, type LucideIcon
} from 'lucide-react';
import PageHero from '../../components/marketing/components/common/PageHero';
import StatCard from '../../components/marketing/components/common/StatCard';
import Button from '../../components/marketing/components/common/Button';
import { AppIcon } from '../../components/common/AppIcons';
import { useAuth } from '../../components/marketing/components/contexts/AuthContext';
import { SystemOverviewModal } from '../../components/marketing/components/common/SystemOverviewModal';
import { SystemConnectionsModal } from '../../components/marketing/components/common/SystemConnectionsModal';
import { LeadscoreSetupModal } from '../../components/marketing/components/settings/LeadscoreSetupModal';
import { api } from '../../components/marketing/services/storageAdapter';
import {
    MktPage, MktPanel, MktSectionTitle, MktStatGrid, MktSegmented, MktEmpty, usePageActive, useAbortable, isAbortError
} from '../../components/marketing/components/dashboard/MktLayout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';

interface Module {
    id: string;
    title: string;
    sub: string;
    icon: LucideIcon;
    path: string;
}

/** Module shortcuts – every path is an existing `/marketing/*` (or settings) route. */
export const ALL_MODULES: Module[] = [
    { id: 'campaigns', title: 'Chiến dịch', sub: 'Gửi chiến dịch hàng loạt đa kênh Email & Zalo ZNS với bộ lọc đối tượng.', icon: Mail, path: '/marketing/campaigns' },
    { id: 'flows', title: 'Automation', sub: 'Kịch bản tự động theo hành vi và sự kiện thực tế của khách hàng.', icon: Zap, path: '/marketing/flows' },
    { id: 'templates', title: 'Mẫu Email', sub: 'Thư viện mẫu kéo thả, hỗ trợ khối nội dung và biến cá nhân hóa.', icon: FileText, path: '/marketing/templates' },
    { id: 'ai-training', title: 'AI Training', sub: 'Huấn luyện AI theo dữ liệu riêng để phản hồi khách hàng đúng ngữ cảnh.', icon: Bot, path: '/marketing/web-tracking?tab=ai' },
    { id: 'ai-space', title: 'AI Space', sub: 'Không gian kiến thức AI riêng cho từng đội nhóm và phòng ban.', icon: Sparkles, path: '/marketing/web-tracking?tab=ai' },
    { id: 'reports', title: 'Tổng quan hệ thống', sub: 'Báo cáo tổng hợp tình trạng kênh, dữ liệu và hiệu suất toàn hệ thống.', icon: BarChart3, path: '' },
    { id: 'vouchers', title: 'Voucher', sub: 'Quản lý mã ưu đãi, quà tặng, sinh mã tự động và theo dõi lượt dùng.', icon: Ticket, path: '/marketing/vouchers' },
    { id: 'surveys', title: 'Khảo sát', sub: 'Thiết kế biểu mẫu khảo sát, thu thập thông tin và báo cáo realtime.', icon: ClipboardList, path: '/marketing/surveys' },
    { id: 'links-qr', title: 'Link & QR', sub: 'Rút gọn link, tạo mã QR sự kiện và phân tích lượt quét đa nền tảng.', icon: QrCode, path: '/marketing/vouchers?tab=links-qr' },
    { id: 'zalo-oa', title: 'Zalo OA', sub: 'Kết nối Zalo Official Account, gửi ZNS và quản lý hội thoại tập trung.', icon: MessageSquare, path: '/settings?tab=marketing_automation' },
    { id: 'meta-api', title: 'Meta Messenger', sub: 'Kết nối Facebook Messenger, tự động trả lời và đồng bộ khách hàng.', icon: MessageSquare, path: '/marketing/web-tracking?tab=meta' },
    { id: 'web-tracking', title: 'Web Tracking', sub: 'Theo dõi lượt xem, click, cuộn trang và hành trình khách trên website.', icon: Globe, path: '/marketing/web-tracking' },
    { id: 'audience', title: 'Tệp khách hàng', sub: 'Quản lý subscriber, phân khúc tự động theo hành vi và lịch sử tương tác.', icon: Users, path: '/marketing/audience' },
    { id: 'api-triggers', title: 'API & OTP', sub: 'Webhook, API hai chiều và OTP để kích hoạt Automation từ hệ thống ngoài.', icon: Code2, path: '/marketing/web-tracking?tab=api-triggers' },
    { id: 'settings', title: 'Cấu hình', sub: 'Thiết lập kết nối kênh gửi, phân quyền và tích hợp API ngoại vi.', icon: Settings, path: '/settings?tab=marketing_automation' },
];

const MODULE_GROUPS: { title: string; desc: string; ids: string[] }[] = [
    { title: 'Automation & Chiến dịch', desc: 'Kịch bản chăm sóc tự động và chiến dịch gửi hàng loạt', ids: ['campaigns', 'flows', 'templates'] },
    { title: 'AI & Báo cáo', desc: 'Huấn luyện AI hỗ trợ khách hàng và đo lường hiệu suất', ids: ['ai-training', 'ai-space', 'reports'] },
    { title: 'Tương tác khách hàng', desc: 'Voucher ưu đãi, biểu mẫu khảo sát và QR tracking', ids: ['vouchers', 'surveys', 'links-qr'] },
    { title: 'Kênh tích hợp & Dữ liệu', desc: 'Zalo OA, Meta, tệp khách hàng, web tracking và API', ids: ['zalo-oa', 'meta-api', 'web-tracking', 'audience', 'api-triggers', 'settings'] },
];

const BRAND_RED = '#C6333D';
const RECENT_KEY = 'recent_modules';
const PERIODS = ['7', '14', '30', '90'] as const;
type Period = typeof PERIODS[number];
type Series = 'web' | 'ai' | 'leads';

interface CampaignRow {
    id?: number | string;
    name: string;
    type?: string;
    status?: string;
    stat_total_sent?: number | string;
    stat_total_opened?: number | string;
    stat_total_clicked?: number | string;
    sent_at?: string;
    created_at?: string;
}

interface FlowRow {
    name: string;
    trigger_type?: string | null;
    stat_enrolled?: number | string;
    stat_completed?: number | string;
}

interface PipelineSegmentItem {
    id: string;
    name: string;
    stage_label: string;
    count: number;
    pct: number;
    color: string;
}

interface SourceBreakdownItem {
    label: string;
    count: number;
    pct: number;
}

interface CompletenessItem {
    field: string;
    label: string;
    filled: number;
    total: number;
    pct: number;
}

interface ChannelMetric {
    campaigns: number;
    sent: number;
    opened?: number;
    clicked?: number;
    delivered?: number;
    open_rate?: number;
    click_rate?: number;
    delivery_rate?: number;
}

interface FlowMetric {
    active_flows: number;
    enrolled: number;
    completed: number;
    completion_rate: number;
}

interface OmnichannelPerf {
    email: ChannelMetric;
    zalo: ChannelMetric;
    flows: FlowMetric;
}

interface OverviewStats {
    success: boolean;
    summary?: {
        total_web?: number;
        growth_web?: number;
        total_ai?: number;
        growth_ai?: number;
        total_leads?: number;
        growth_leads?: number;
        growth_sent?: number;
    };
    chart_data?: { date: string; web: number; ai: number; leads: number }[];
    top_campaigns?: CampaignRow[];
    top_flows?: FlowRow[];
    pipeline_segments?: PipelineSegmentItem[];
    sources_breakdown?: SourceBreakdownItem[];
    data_completeness?: CompletenessItem[];
    omnichannel_performance?: OmnichannelPerf;
}

const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const fmt = (v: unknown) => num(v).toLocaleString('vi-VN');
const pct = (part: unknown, total: unknown) => (num(total) > 0 ? Math.round((num(part) / num(total)) * 100) : 0);

/**
 * Dynamic Red / Yellow / Green color coding based on percentage:
 * - < 50%: Red (#ef4444)
 * - 50% - 79%: Yellow/Amber (#f59e0b)
 * - >= 80%: Green (#10b981)
 */
const getCompletenessTone = (percentage: number) => {
    if (percentage >= 80) {
        return {
            bar: '#10b981',
            dot: '#10b981',
            text: '#059669',
            bg: '#ecfdf5'
        };
    }
    if (percentage >= 50) {
        return {
            bar: '#f59e0b',
            dot: '#f59e0b',
            text: '#d97706',
            bg: '#fffbeb'
        };
    }
    return {
        bar: '#ef4444',
        dot: '#ef4444',
        text: '#dc2626',
        bg: '#fef2f2'
    };
};

const getFlowTriggerConfig = (triggerType?: string | null) => {
    const raw = (triggerType || '').toLowerCase();
    if (raw.includes('form')) {
        return { label: 'Form', color: '#334155', bg: '#f1f5f9', border: '#e2e8f0' };
    }
    if (raw.includes('segment')) {
        return { label: 'Segment', color: '#C6333D', bg: '#fef2f2', border: '#fecdd3' };
    }
    if (raw.includes('tag')) {
        return { label: 'Tag', color: '#0f172a', bg: '#f8fafc', border: '#e2e8f0' };
    }
    if (raw.includes('webhook') || raw.includes('api')) {
        return { label: 'Webhook', color: '#334155', bg: '#f1f5f9', border: '#e2e8f0' };
    }
    return { label: triggerType || 'Tự động', color: '#C6333D', bg: '#fef2f2', border: '#fecdd3' };
};

const readRecents = (): string[] => {
    try {
        const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.map((x: unknown) => (typeof x === 'string' ? x : (x as { id?: string })?.id)).filter(Boolean).slice(0, 4) as string[];
    } catch {
        return [];
    }
};

const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const { dbNeedsMigration } = useAuth();
    const pageActive = usePageActive('/marketing');
    const nextSignal = useAbortable();

    const [recentIds, setRecentIds] = useState<string[]>(readRecents);
    const [isOverviewOpen, setIsOverviewOpen] = useState(false);
    const [isConnectionsOpen, setIsConnectionsOpen] = useState(false);
    const [isLeadscoreOpen, setIsLeadscoreOpen] = useState(false);

    const [period, setPeriod] = useState<Period>('7');
    const [series, setSeries] = useState<Series>('web');
    const [statsLoading, setStatsLoading] = useState(true);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [statsData, setStatsData] = useState<OverviewStats | null>(null);
    const inFlightPeriodRef = useRef<string | null>(null);

    const fetchDashboardStats = useCallback(async (days: string, bust = false) => {
        if (!bust && inFlightPeriodRef.current === days) return;
        inFlightPeriodRef.current = days;
        const signalKey = bust ? `${days}_${Date.now()}` : days;
        const signal = nextSignal(signalKey);
        setStatsLoading(true);
        setStatsError(null);
        try {
            const res = await api.get<OverviewStats>(`overview_stats?days=${days}${bust ? '&bust=1' : ''}`, {}, { signal });
            const payload = res as unknown as OverviewStats;
            if (payload?.success) {
                setStatsData(payload);
            } else {
                setStatsError('Không tải được số liệu tổng quan.');
            }
        } catch (err) {
            if (isAbortError(err)) return;
            console.error('[DashboardStats] Failed to fetch stats', err);
            setStatsError('Không tải được số liệu tổng quan.');
        } finally {
            inFlightPeriodRef.current = null;
            setStatsLoading(false);
        }
    }, [nextSignal]);

    useEffect(() => {
        if (!pageActive) return;
        fetchDashboardStats(period);
    }, [period, pageActive, fetchDashboardStats]);

    const handleModuleClick = (module: Module) => {
        if (module.id === 'reports') {
            setIsOverviewOpen(true);
            return;
        }
        const next = [module.id, ...recentIds.filter(id => id !== module.id)].slice(0, 4);
        setRecentIds(next);
        try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* quota – UI preference only */ }
        navigate(module.path);
    };

    const recentModules = useMemo(
        () => recentIds.map(id => ALL_MODULES.find(m => m.id === id)).filter((m): m is Module => !!m && m.id !== 'reports'),
        [recentIds]
    );

    const summary = statsData?.summary || {};
    const campaigns = statsData?.top_campaigns || [];
    const flows = statsData?.top_flows || [];
    const chartData = statsData?.chart_data || [];
    const pipelineSegments = statsData?.pipeline_segments || [
        { id: 'seg_pipeline_uncontacted_01_02', name: 'Chưa tương tác được', stage_label: 'Pipeline 1-2', count: 0, pct: 0, color: '#f59e0b' },
        { id: 'seg_pipeline_qualified_03_12', name: 'Qualified', stage_label: 'Pipeline 3-12', count: 0, pct: 0, color: '#3b82f6' },
        { id: 'seg_pipeline_won_13_14', name: 'Won', stage_label: 'Pipeline 13-14', count: 0, pct: 0, color: '#10b981' },
        { id: 'seg_pipeline_enrolled_14', name: 'Học viên chính thức', stage_label: 'Pipeline 14', count: 0, pct: 0, color: '#8b5cf6' },
    ];
    const sourcesBreakdown = statsData?.sources_breakdown || [];
    const dataCompleteness = statsData?.data_completeness || [];
    const omnichannelPerf = statsData?.omnichannel_performance;

    const totalSentRecent = campaigns.reduce((acc, c) => acc + num(c.stat_total_sent), 0);
    const comparisonLabel = `so với ${period} ngày trước`;
    const firstLoad = statsLoading && !statsData;

    const seriesMeta: Record<Series, { key: Series; name: string }> = {
        web: { key: 'web', name: 'Website' },
        ai: { key: 'ai', name: 'Phản hồi AI' },
        leads: { key: 'leads', name: 'Liên hệ mới' },
    };

    const transformedChartData = useMemo(() => {
        return chartData.map((item) => ({
            date: item.date,
            value: num(item[series]),
            web: num(item.web),
            ai: num(item.ai),
            leads: num(item.leads),
        }));
    }, [chartData, series]);

    return (
        <MktPage className="pb-10">
            <PageHero
                title="Tổng quan Marketing & Đa kênh"
                subtitle={`Hiệu suất đa kênh Email, Zalo, Meta, Website và AI trong ${period} ngày gần nhất.`}
            >
                <MktSegmented<Period>
                    value={period}
                    onChange={setPeriod}
                    options={PERIODS.map(p => ({ id: p, label: `${p} ngày` }))}
                />
                <Button
                    variant="outline"
                    onClick={() => fetchDashboardStats(period, true)}
                    title="Làm mới dữ liệu"
                    disabled={statsLoading}
                >
                    <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Button variant="outline" icon={Settings} onClick={() => setIsLeadscoreOpen(true)}>
                    Leadscore
                </Button>
                <Button variant="primary" icon={Play} onClick={() => setIsConnectionsOpen(true)}>
                    Kết nối kênh
                </Button>
            </PageHero>

            {dbNeedsMigration && (
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-[#C6333D]/10 dark:border-[#C6333D]/30">
                    <AlertTriangle className="w-5 h-5 text-[#C6333D] shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Cơ sở dữ liệu Marketing cần cập nhật cấu trúc</p>
                        <p className="text-xs text-[#9A1523] dark:text-[#C6333D]">Một số bảng/cột mới chưa được tạo. Vui lòng chạy cập nhật để đảm bảo số liệu chính xác.</p>
                    </div>
                    <a
                        href="/mail_api/run_migrations.php"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-lg bg-[#C6333D] text-white text-[13px] font-semibold hover:opacity-90 shrink-0"
                    >
                        Cập nhật ngay
                    </a>
                </div>
            )}

            <SystemOverviewModal isOpen={isOverviewOpen} onClose={() => setIsOverviewOpen(false)} />
            <SystemConnectionsModal isOpen={isConnectionsOpen} onClose={() => setIsConnectionsOpen(false)} />
            <LeadscoreSetupModal isOpen={isLeadscoreOpen} onClose={() => setIsLeadscoreOpen(false)} />

            {statsError && !statsData && (
                <MktPanel>
                    <MktEmpty
                        icon={AlertTriangle}
                        title={statsError}
                        description="Kiểm tra kết nối mạng hoặc quyền truy cập rồi thử lại."
                        actionLabel="Thử lại"
                        onAction={() => fetchDashboardStats(period, true)}
                    />
                </MktPanel>
            )}

            {/* KPI row – Clean executive styling with zero colored borders */}
            {(firstLoad || statsData) && (
                <MktStatGrid cols={4}>
                    <StatCard
                        loading={firstLoad}
                        title="Lượt xem website"
                        value={fmt(summary.total_web)}
                        growth={summary.growth_web}
                        comparisonLabel={comparisonLabel}
                        icon={<Globe />}
                        color="#334155"
                        breakdown={<span className="text-[11.5px] text-[#64748b] leading-tight">• Phiên truy cập trang • Web Tracking</span>}
                        onClick={() => navigate('/marketing/web-tracking')}
                    />
                    <StatCard
                        loading={firstLoad}
                        title="Phản hồi AI"
                        value={fmt(summary.total_ai)}
                        growth={summary.growth_ai}
                        comparisonLabel={comparisonLabel}
                        icon={<Bot />}
                        color="#C6333D"
                        breakdown={<span className="text-[11.5px] text-[#64748b] leading-tight">• Tương tác tự động • Trợ lý AI live</span>}
                        onClick={() => navigate('/marketing/web-tracking?tab=ai')}
                    />
                    <StatCard
                        loading={firstLoad}
                        title="Liên hệ mới"
                        value={fmt(summary.total_leads)}
                        growth={summary.growth_leads}
                        comparisonLabel={comparisonLabel}
                        icon={<Users />}
                        color={BRAND_RED}
                        breakdown={<span className="text-[11.5px] text-[#64748b] leading-tight">• Tệp khách hàng CRM • Đồng bộ tự động</span>}
                        onClick={() => navigate('/marketing/audience')}
                    />
                    <StatCard
                        loading={firstLoad}
                        title="Tin đã gửi"
                        value={fmt(totalSentRecent)}
                        growth={summary.growth_sent ?? 0}
                        comparisonLabel={comparisonLabel}
                        breakdown={<span className="text-[11.5px] text-[#64748b] leading-tight">Dựa trên {campaigns.length} chiến dịch gần nhất</span>}
                        icon={<Send />}
                        color="#0f172a"
                        onClick={() => navigate('/marketing/campaigns')}
                    />
                </MktStatGrid>
            )}

            {/* Deep Marketing & CRM Funnel Analytics Suite */}
            {statsData && (
                <>
                    {/* 1. 4-Stage Pipeline Segment Breakdown Card */}
                    <div
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 16,
                            padding: '1.25rem',
                            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '1rem'
                        }}
                    >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div>
                                <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
                                    <GitBranch className="w-4 h-4 text-[#C6333D]" />
                                    Phân khúc Đối tượng theo 4 Giai đoạn Pipeline CRM
                                </h3>
                                <p className="text-xs text-[#64748b] mt-0.5">
                                    Dữ liệu đồng bộ trực tiếp từ CRM & Tuyển sinh theo hành trình chuyển đổi khách hàng.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => navigate('/marketing/audience')}
                                className="text-xs font-bold text-[#C6333D] hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0 p-0"
                            >
                                Xem tất cả tệp đối tượng <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                            {pipelineSegments.map((seg) => {
                                const tone = getCompletenessTone(seg.pct);
                                return (
                                    <div
                                        key={seg.id}
                                        onClick={() => navigate('/marketing/audience')}
                                        className="p-3.5 rounded-xl cursor-pointer transition-all hover:bg-slate-50/80 group"
                                        style={{
                                            background: '#ffffff',
                                            border: '1px solid #e2e8f0',
                                            borderRadius: 12,
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-1 mb-1.5">
                                            <span
                                                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                                                style={{ background: tone.bg, color: tone.text, border: 'none' }}
                                            >
                                                {seg.stage_label}
                                            </span>
                                            <span className="text-xs font-bold" style={{ color: tone.text }}>
                                                {seg.pct}%
                                            </span>
                                        </div>
                                        <div className="text-sm font-bold text-[#0f172a] truncate group-hover:text-[#C6333D] transition-colors">
                                            {seg.name}
                                        </div>
                                        <div className="text-xl font-extrabold text-[#0f172a] mt-1">
                                            {fmt(seg.count)} <span className="text-xs font-normal text-[#64748b]">hồ sơ</span>
                                        </div>
                                        {/* Progress Bar with tone depending on % */}
                                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-2.5">
                                            <div
                                                className="h-full rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${Math.min(Math.max(seg.pct, 0), 100)}%`,
                                                    backgroundColor: tone.bar
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 2. Charts Row: Daily Data Trend & Active Flows */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Daily trend chart with rounded Brand Red bars & LabelList on top */}
                        <div
                            className="lg:col-span-2 flex flex-col"
                            style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 16,
                                padding: '1.25rem',
                                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
                            }}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e2e8f0]">
                                <div>
                                    <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-[#C6333D]" />
                                        Hiệu suất xử lý Data theo ngày
                                    </h3>
                                    <p className="text-xs text-[#64748b] mt-0.5">
                                        Biểu đồ thể hiện lưu lượng {seriesMeta[series].name.toLowerCase()} trong {period} ngày gần nhất.
                                    </p>
                                </div>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px', borderRadius: '10px', background: '#f1f5f9', border: '1px solid #e2e8f0' }} className="shrink-0">
                                    {(['web', 'ai', 'leads'] as Series[]).map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setSeries(s)}
                                            className="px-3 py-1 rounded-md text-xs font-bold border-0 cursor-pointer transition-all"
                                            style={{
                                                background: series === s ? '#ffffff' : 'transparent',
                                                color: series === s ? '#C6333D' : '#64748b',
                                                fontWeight: series === s ? 700 : 600,
                                                boxShadow: series === s ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                                            }}
                                        >
                                            {seriesMeta[s].name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="pt-4 h-[280px]">
                                {chartData.length === 0 ? (
                                    <MktEmpty icon={BarChart3} title="Chưa có dữ liệu trong khoảng thời gian này" />
                                ) : pageActive ? (
                                    <ResponsiveContainer width="100%" height={260} minWidth={0}>
                                        <BarChart data={transformedChartData} margin={{ top: 20, right: 16, left: -10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                dy={6}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                allowDecimals={false}
                                                tick={{ fontSize: 11, fill: '#64748b' }}
                                                width={36}
                                            />
                                            <Tooltip content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div style={{
                                                            background: '#ffffff',
                                                            padding: '10px 14px',
                                                            borderRadius: '8px',
                                                            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                                                            border: '1px solid #e2e8f0',
                                                            minWidth: 140
                                                        }}>
                                                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>
                                                                {label}
                                                            </div>
                                                            <div style={{ fontSize: '0.8125rem', color: '#C6333D', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                                <span style={{ color: '#64748b' }}>{seriesMeta[series].name}:</span>
                                                                <span style={{ fontWeight: 800 }}>{fmt(payload[0].value)}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }} />
                                            <Bar dataKey="value" fill="#C6333D" radius={[6, 6, 0, 0]} maxBarSize={32}>
                                                <LabelList
                                                    dataKey="value"
                                                    position="top"
                                                    style={{ fill: '#0f172a', fontSize: 10, fontWeight: 700 }}
                                                    offset={6}
                                                    formatter={(v: any) => Number(v) > 0 ? v : ''}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : null}
                            </div>
                        </div>

                        {/* Active flows */}
                        <div
                            className="flex flex-col"
                            style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 16,
                                padding: '1.25rem',
                                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
                            }}
                        >
                            <div className="pb-3 border-b border-[#e2e8f0] flex items-center justify-between">
                                <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
                                    <GitBranch className="w-4 h-4 text-[#C6333D]" />
                                    Automation đang chạy
                                </h3>
                                <button
                                    type="button"
                                    onClick={() => navigate('/marketing/flows')}
                                    className="text-xs font-bold text-[#C6333D] hover:underline bg-transparent border-0 cursor-pointer p-0"
                                >
                                    Xem tất cả
                                </button>
                            </div>
                            {flows.length === 0 ? (
                                <MktEmpty
                                    icon={GitBranch}
                                    title="Chưa có kịch bản đang chạy"
                                    actionLabel="Tạo Automation"
                                    onAction={() => navigate('/marketing/flows')}
                                />
                            ) : (
                                <div className="custom-scrollbar pt-3 flex flex-col gap-2 overflow-y-auto max-h-[280px]">
                                    {flows.map((flow, idx) => {
                                        const rate = pct(flow.stat_completed, flow.stat_enrolled);
                                        const tone = getCompletenessTone(rate);
                                        const cfg = getFlowTriggerConfig(flow.trigger_type);
                                        return (
                                            <div
                                                key={`${flow.name}-${idx}`}
                                                className="p-2.5 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer border border-[#f1f5f9]"
                                                onClick={() => navigate('/marketing/flows')}
                                            >
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <span
                                                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wider"
                                                                style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border || '#e2e8f0'}` }}
                                                            >
                                                                {cfg.label}
                                                            </span>
                                                            <span className="text-xs font-bold text-[#0f172a] truncate" title={flow.name}>
                                                                {flow.name}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs font-extrabold shrink-0" style={{ color: tone.text }}>
                                                            {rate}%
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#64748b]">
                                                        <span className="truncate">{flow.trigger_type || 'Kích hoạt tự động'}</span>
                                                        <span className="shrink-0">{fmt(flow.stat_completed)}/{fmt(flow.stat_enrolled)} hoàn thành</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden mt-0.5">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-300"
                                                            style={{
                                                                width: `${Math.min(Math.max(rate, 0), 100)}%`,
                                                                backgroundColor: tone.bar
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. Omnichannel Channel Performance Overview */}
                    {omnichannelPerf && (
                        <div
                            style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 16,
                                padding: '1.25rem',
                                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '1rem'
                            }}
                        >
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div>
                                    <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-[#C6333D]" />
                                        Hiệu suất Kênh Omnichannel (Email, Zalo ZNS & Flows)
                                    </h3>
                                    <p className="text-xs text-[#64748b] mt-0.5">
                                        Đo lường tỷ lệ gửi thành công, mở thư và chuyển đổi trên toàn bộ kênh tương tác.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                                {/* Email Channel Card */}
                                <div
                                    className="p-4 rounded-xl"
                                    style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-[10px] bg-[#fef2f2] border border-[#fecdd3] text-[#C6333D] flex items-center justify-center">
                                                <Mail size={16} />
                                            </div>
                                            <span className="text-sm font-bold text-[#0f172a]">Email Marketing</span>
                                        </div>
                                        <span className="text-xs text-[#64748b] font-medium">{omnichannelPerf.email.campaigns} chiến dịch</span>
                                    </div>
                                    <div className="text-2xl font-extrabold text-[#0f172a]">
                                        {fmt(omnichannelPerf.email.sent)} <span className="text-xs font-normal text-[#64748b]">tin gửi</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[#f1f5f9]">
                                        <div>
                                            <span className="text-[11px] text-[#64748b] block">Tỷ lệ mở</span>
                                            {(() => {
                                                const tone = getCompletenessTone(omnichannelPerf.email.open_rate ?? 0);
                                                return (
                                                    <span className="text-sm font-bold" style={{ color: tone.text }}>
                                                        {omnichannelPerf.email.open_rate ?? 0}%
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                        <div>
                                            <span className="text-[11px] text-[#64748b] block">Tỷ lệ click</span>
                                            {(() => {
                                                const tone = getCompletenessTone(omnichannelPerf.email.click_rate ?? 0);
                                                return (
                                                    <span className="text-sm font-bold" style={{ color: tone.text }}>
                                                        {omnichannelPerf.email.click_rate ?? 0}%
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Zalo ZNS Channel Card */}
                                <div
                                    className="p-4 rounded-xl"
                                    style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-[10px] bg-[#f8fafc] border border-[#e2e8f0] text-[#334155] flex items-center justify-center">
                                                <MessageSquare size={16} />
                                            </div>
                                            <span className="text-sm font-bold text-[#0f172a]">Zalo Official (ZNS)</span>
                                        </div>
                                        <span className="text-xs text-[#64748b] font-medium">{omnichannelPerf.zalo.campaigns} chiến dịch</span>
                                    </div>
                                    <div className="text-2xl font-extrabold text-[#0f172a]">
                                        {fmt(omnichannelPerf.zalo.sent)} <span className="text-xs font-normal text-[#64748b]">thông báo</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[#f1f5f9]">
                                        <div>
                                            <span className="text-[11px] text-[#64748b] block">Đã phát thành công</span>
                                            <span className="text-sm font-bold text-[#0f172a]">{fmt(omnichannelPerf.zalo.delivered ?? 0)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[11px] text-[#64748b] block">Tỷ lệ phát</span>
                                            {(() => {
                                                const tone = getCompletenessTone(omnichannelPerf.zalo.delivery_rate ?? 0);
                                                return (
                                                    <span className="text-sm font-bold" style={{ color: tone.text }}>
                                                        {omnichannelPerf.zalo.delivery_rate ?? 0}%
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Flows Channel Card */}
                                <div
                                    className="p-4 rounded-xl"
                                    style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 12 }}
                                >
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-[10px] bg-[#fef2f2] border border-[#fecdd3] text-[#C6333D] flex items-center justify-center">
                                                <Zap size={16} />
                                            </div>
                                            <span className="text-sm font-bold text-[#0f172a]">Automation Flows</span>
                                        </div>
                                        <span className="text-xs text-[#64748b] font-medium">{omnichannelPerf.flows.active_flows} active</span>
                                    </div>
                                    <div className="text-2xl font-extrabold text-[#0f172a]">
                                        {fmt(omnichannelPerf.flows.enrolled)} <span className="text-xs font-normal text-[#64748b]">lượt chạy</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[#f1f5f9]">
                                        <div>
                                            <span className="text-[11px] text-[#64748b] block">Hoàn tất kịch bản</span>
                                            <span className="text-sm font-bold text-[#0f172a]">{fmt(omnichannelPerf.flows.completed)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[11px] text-[#64748b] block">Tỷ lệ hoàn thành</span>
                                            {(() => {
                                                const tone = getCompletenessTone(omnichannelPerf.flows.completion_rate ?? 0);
                                                return (
                                                    <span className="text-sm font-bold" style={{ color: tone.text }}>
                                                        {omnichannelPerf.flows.completion_rate ?? 0}%
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* 4. Side-by-Side: Top Sources Breakdown & Audience Data Completeness */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Top Sources Breakdown */}
                        <div
                            style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 16,
                                padding: '1.25rem',
                                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div className="pb-3 border-b border-[#e2e8f0] flex items-center justify-between">
                                <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
                                    <Award className="w-4 h-4 text-[#C6333D]" />
                                    Top Nguồn Thu Hút Khách Hàng
                                </h3>
                                <span className="text-xs text-[#64748b] font-medium">Xếp hạng theo quy mô</span>
                            </div>

                            {sourcesBreakdown.length === 0 ? (
                                <div className="py-8 text-center text-xs text-[#64748b]">
                                    Chưa có dữ liệu phân nguồn trong kỳ.
                                </div>
                            ) : (
                                <div className="pt-3 flex flex-col gap-2.5">
                                    {sourcesBreakdown.map((s, idx) => {
                                        return (
                                            <div key={idx} className="flex flex-col gap-1">
                                                <div className="flex items-center justify-between text-xs font-semibold">
                                                    <div className="flex items-center gap-2 truncate">
                                                        <span className="w-5 h-5 rounded-full bg-slate-100 text-[#0f172a] font-bold text-[10px] flex items-center justify-center shrink-0">
                                                            {idx + 1}
                                                        </span>
                                                        <span className="text-[#0f172a] truncate">{s.label}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[#64748b]">{fmt(s.count)} liên hệ</span>
                                                        <span className="font-bold text-[#0f172a] min-w-[38px] text-right">{s.pct}%</span>
                                                    </div>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-[#C6333D] transition-all duration-300"
                                                        style={{ width: `${Math.min(Math.max(s.pct, 0), 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Audience Data Completeness with Red / Yellow / Green Progress Bars */}
                        <div
                            style={{
                                background: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: 16,
                                padding: '1.25rem',
                                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div className="pb-3 border-b border-[#e2e8f0] flex items-center justify-between">
                                <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                                    Độ Đầy Đủ Dữ Liệu Marketing Audience
                                </h3>
                                <span className="text-xs text-[#64748b] font-medium">Chất lượng tệp</span>
                            </div>

                            {dataCompleteness.length === 0 ? (
                                <div className="py-8 text-center text-xs text-[#64748b]">
                                    Chưa có dữ liệu đo lường chất lượng tệp.
                                </div>
                            ) : (
                                <div className="pt-3 flex flex-col gap-3">
                                    {dataCompleteness.map((item, idx) => {
                                        const tone = getCompletenessTone(item.pct);
                                        return (
                                            <div key={idx} className="flex flex-col gap-1.5">
                                                <div className="flex items-center justify-between text-xs font-semibold">
                                                    <span className="text-[#0f172a]">{item.label}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[#64748b]">{fmt(item.filled)} / {fmt(item.total)}</span>
                                                        <span
                                                            className="px-2 py-0.5 rounded-full font-bold text-[11px]"
                                                            style={{ backgroundColor: tone.bg, color: tone.text, border: 'none' }}
                                                        >
                                                            {item.pct}%
                                                        </span>
                                                    </div>
                                                </div>
                                                {/* Dynamic Red / Yellow / Green progress bar */}
                                                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-500"
                                                        style={{
                                                            width: `${Math.min(Math.max(item.pct, 0), 100)}%`,
                                                            backgroundColor: tone.bar
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 5. Recent campaigns table */}
                    <div
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: 16,
                            padding: '1.25rem',
                            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
                        }}
                    >
                        <div className="pb-3 border-b border-[#e2e8f0] flex items-center justify-between">
                            <h3 className="text-base font-bold text-[#0f172a] flex items-center gap-2">
                                <Mail className="w-4 h-4 text-[#C6333D]" />
                                Chiến dịch gửi gần đây
                            </h3>
                            <button
                                type="button"
                                onClick={() => navigate('/marketing/campaigns')}
                                className="text-xs font-bold text-[#C6333D] hover:underline cursor-pointer bg-transparent border-0 p-0"
                            >
                                Xem tất cả
                            </button>
                        </div>
                        {campaigns.length === 0 ? (
                            <MktEmpty
                                icon={Mail}
                                title="Chưa có chiến dịch đã gửi"
                                description="Các chiến dịch đã gửi, đang gửi hoặc đã lên lịch sẽ hiển thị tại đây."
                                actionLabel="Tạo chiến dịch"
                                onAction={() => navigate('/marketing/campaigns')}
                            />
                        ) : (
                            <div className="pt-2 flex flex-col gap-1 max-h-[360px] overflow-y-auto custom-scrollbar">
                                {campaigns.map((c, idx) => {
                                    const isZalo = c.type === 'zalo' || c.type === 'zalo_zns';
                                    const dateStr = c.sent_at || c.created_at;
                                    const formattedDate = dateStr
                                        ? new Date(dateStr.replace(' ', 'T')).toLocaleString('vi-VN', {
                                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                        })
                                        : '';

                                    let statusBadge = {
                                        text: 'Đã gửi',
                                        bg: 'rgba(16, 185, 129, 0.12)',
                                        color: '#10b981',
                                    };
                                    const s = (c.status || '').toLowerCase();
                                    if (s === 'sending' || s === 'in_progress') {
                                        statusBadge = { text: 'Đang gửi', bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' };
                                    } else if (s === 'scheduled' || s === 'pending') {
                                        statusBadge = { text: 'Chờ gửi', bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b' };
                                    } else if (s === 'draft') {
                                        statusBadge = { text: 'Bản nháp', bg: 'rgba(107, 114, 128, 0.12)', color: '#6b7280' };
                                    }

                                    const openRate = pct(c.stat_total_opened, c.stat_total_sent);
                                    const clickRate = pct(c.stat_total_clicked, c.stat_total_sent);

                                    return (
                                        <div
                                            key={`${c.name}-${idx}`}
                                            onClick={() => navigate('/marketing/campaigns')}
                                            className="p-3 flex items-center gap-3 rounded-xl cursor-pointer transition-colors border-b border-[#f1f5f9] last:border-b-0 hover:bg-slate-50"
                                        >
                                            {/* Circular channel badge */}
                                            <div
                                                className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 border"
                                                style={{
                                                    backgroundColor: isZalo ? '#f8fafc' : '#fef2f2',
                                                    borderColor: isZalo ? '#e2e8f0' : '#fecdd3',
                                                    color: isZalo ? '#334155' : '#C6333D',
                                                }}
                                            >
                                                {isZalo ? <MessageSquare className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                                            </div>

                                            {/* Title & Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-sm text-[#0f172a] truncate" title={c.name}>
                                                    {c.name}
                                                </div>
                                                <div className="text-xs text-[#64748b] mt-0.5 flex items-center gap-2 truncate">
                                                    <span className="font-semibold text-[#0f172a]">{isZalo ? 'Zalo ZNS' : 'Email'}</span>
                                                    <span>•</span>
                                                    <span>{fmt(c.stat_total_sent)} đã gửi</span>
                                                    {num(c.stat_total_sent) > 0 && (
                                                        <>
                                                            <span>•</span>
                                                            <span>Mở {openRate}%</span>
                                                            <span>•</span>
                                                            <span>Click {clickRate}%</span>
                                                        </>
                                                    )}
                                                    {formattedDate && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{formattedDate}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: status pill badge with ZERO border */}
                                            <div className="text-right shrink-0">
                                                <span
                                                    className="px-2.5 py-1 rounded-full text-xs font-bold inline-block"
                                                    style={{
                                                        backgroundColor: statusBadge.bg,
                                                        color: statusBadge.color,
                                                        border: 'none',
                                                    }}
                                                >
                                                    {statusBadge.text}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Recent access */}
            {recentModules.length > 0 && (
                <section className="flex flex-col gap-3">
                    <MktSectionTitle icon={Clock} title="Truy cập gần đây" />
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {recentModules.map(module => (
                            <button
                                key={module.id}
                                type="button"
                                onClick={() => handleModuleClick(module)}
                                className="group flex items-center gap-3 p-3 text-left bg-white border border-[#e2e8f0] rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:border-[#cbd5e1] transition-all"
                            >
                                <AppIcon name={module.id} size={36} className="shrink-0 group-hover:scale-105 transition-transform" />
                                <span className="text-sm font-semibold text-[#0f172a] truncate">{module.title}</span>
                                <ArrowRight className="w-4 h-4 ml-auto text-[#64748b] group-hover:text-[#C6333D] shrink-0" />
                            </button>
                        ))}
                    </div>
                </section>
            )}

            {/* Module shortcuts */}
            {MODULE_GROUPS.map(group => (
                <section key={group.title} className="flex flex-col gap-3">
                    <MktSectionTitle title={group.title} desc={group.desc} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {ALL_MODULES.filter(m => group.ids.includes(m.id)).map(module => (
                            <button
                                key={module.id}
                                type="button"
                                onClick={() => handleModuleClick(module)}
                                className="group h-full flex items-start gap-3.5 p-4 text-left bg-white border border-[#e2e8f0] rounded-2xl shadow-[0_1px_3px_rgba(15,23,42,0.04)] hover:border-[#cbd5e1] hover:shadow-md transition-all"
                            >
                                <AppIcon name={module.id} size={42} className="shrink-0 group-hover:scale-105 transition-transform" />
                                <span className="min-w-0 flex-1 flex flex-col">
                                    <span className="text-sm font-bold text-[#0f172a]">{module.title}</span>
                                    <span className="text-xs text-[#64748b] mt-1 leading-relaxed line-clamp-2">{module.sub}</span>
                                </span>
                                <ArrowRight className="w-4 h-4 mt-0.5 text-[#64748b] group-hover:text-[#C6333D] shrink-0" />
                            </button>
                        ))}
                    </div>
                </section>
            ))}
        </MktPage>
    );
};

export default Dashboard;
