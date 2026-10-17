import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Sparkles, Mail, Zap, FileText, Bot, Globe, Users, BarChart3, GitBranch, Settings, Clock, ArrowRight,
    MessageSquare, Ticket, Code2, Play, ClipboardList, QrCode, RefreshCw, Send, AlertTriangle, type LucideIcon
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

const BRAND = '#BD1D2D';
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
}

const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const fmt = (v: unknown) => num(v).toLocaleString('vi-VN');
const pct = (part: unknown, total: unknown) => (num(total) > 0 ? Math.round((num(part) / num(total)) * 100) : 0);

const getFlowTriggerConfig = (triggerType?: string | null) => {
    const raw = (triggerType || '').toLowerCase();
    if (raw.includes('form')) {
        return { label: 'Form', color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)' };
    }
    if (raw.includes('segment')) {
        return { label: 'Segment', color: '#6366f1', bg: 'rgba(99, 102, 241, 0.12)' };
    }
    if (raw.includes('tag')) {
        return { label: 'Tag', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)' };
    }
    if (raw.includes('webhook') || raw.includes('api')) {
        return { label: 'Webhook', color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)' };
    }
    return { label: triggerType || 'Thủ công', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)' };
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
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] border border-amber-300 bg-amber-50 dark:bg-[var(--color-primary)]/10 dark:border-[var(--color-primary)]/30">
                    <AlertTriangle className="w-5 h-5 text-[var(--color-primary)] shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Cơ sở dữ liệu Marketing cần cập nhật cấu trúc</p>
                        <p className="text-xs text-[#9A1523] dark:text-[var(--color-primary)]">Một số bảng/cột mới chưa được tạo. Vui lòng chạy cập nhật để đảm bảo số liệu chính xác.</p>
                    </div>
                    <a
                        href="/mail_api/run_migrations.php"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 h-9 px-3.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:opacity-90 shrink-0"
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

            {/* KPI row – real overview_stats values only */}
            {(firstLoad || statsData) && (
                <MktStatGrid cols={4}>
                    <StatCard
                        loading={firstLoad}
                        title="Lượt xem website"
                        value={fmt(summary.total_web)}
                        growth={summary.growth_web}
                        comparisonLabel={comparisonLabel}
                        icon={<Globe />}
                        color="#3b82f6"
                        onClick={() => navigate('/marketing/web-tracking')}
                    />
                    <StatCard
                        loading={firstLoad}
                        title="Phản hồi AI"
                        value={fmt(summary.total_ai)}
                        growth={summary.growth_ai}
                        comparisonLabel={comparisonLabel}
                        icon={<Bot />}
                        color="#6366f1"
                        onClick={() => navigate('/marketing/web-tracking?tab=ai')}
                    />
                    <StatCard
                        loading={firstLoad}
                        title="Liên hệ mới"
                        value={fmt(summary.total_leads)}
                        growth={summary.growth_leads}
                        comparisonLabel={comparisonLabel}
                        icon={<Users />}
                        color="#10b981"
                        onClick={() => navigate('/marketing/audience')}
                    />
                    <StatCard
                        loading={firstLoad}
                        title="Tin đã gửi"
                        value={fmt(totalSentRecent)}
                        growth={summary.growth_sent ?? 0}
                        comparisonLabel={comparisonLabel}
                        breakdown={<span>{campaigns.length} chiến dịch gần nhất</span>}
                        icon={<Send />}
                        color="#f59e0b"
                        onClick={() => navigate('/marketing/campaigns')}
                    />
                </MktStatGrid>
            )}

            {statsData && (
                <>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Daily trend chart matching Dashboard's Hiệu suất xử lý Data theo ngày */}
                        <MktPanel className="lg:col-span-2 flex flex-col">
                            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-border)]">
                                <div>
                                    <h3 className="text-[1.125rem] font-bold text-[var(--color-text)] flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />
                                        Hiệu suất xử lý Data theo ngày
                                    </h3>
                                    <p className="text-[0.8125rem] text-[var(--color-text-light)] mt-0.5">
                                        Biểu đồ thể hiện lưu lượng {seriesMeta[series].name.toLowerCase()} trong {period} ngày gần nhất.
                                    </p>
                                </div>
                                <div className="flex bg-[var(--color-bg)] p-1 rounded-[var(--radius-md)] border border-[var(--color-border-light)] shrink-0">
                                    {(['web', 'ai', 'leads'] as Series[]).map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setSeries(s)}
                                            className="px-3 py-1.5 rounded-[var(--radius-sm)] text-[0.8125rem] font-semibold border-0 cursor-pointer transition-all duration-200"
                                            style={{
                                                background: series === s ? 'var(--color-surface)' : 'transparent',
                                                color: series === s ? 'var(--color-primary)' : 'var(--color-text-muted)',
                                                boxShadow: series === s ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none',
                                            }}
                                        >
                                            {seriesMeta[s].name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="px-2 pt-4 pb-2 h-[300px]">
                                {chartData.length === 0 ? (
                                    <MktEmpty icon={BarChart3} title="Chưa có dữ liệu trong khoảng thời gian này" />
                                ) : pageActive ? (
                                    <ResponsiveContainer width="100%" height={280} minWidth={0}>
                                        <BarChart data={transformedChartData} margin={{ top: 12, right: 16, left: -10, bottom: 0 }}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 11, fill: 'var(--color-text-light)' }}
                                                dy={6}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                allowDecimals={false}
                                                tick={{ fontSize: 11, fill: 'var(--color-text-light)' }}
                                                width={36}
                                            />
                                            <Tooltip content={({ active, payload, label }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div style={{
                                                            background: 'var(--color-surface)',
                                                            padding: '10px 14px',
                                                            borderRadius: '8px',
                                                            boxShadow: '0 10px 25px rgba(0,0,0,0.1), 0 3px 10px rgba(0,0,0,0.06)',
                                                            border: '1px solid var(--color-border)',
                                                            minWidth: 140
                                                        }}>
                                                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>
                                                                {label}
                                                            </div>
                                                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                                                <span style={{ color: 'var(--color-text-muted)' }}>{seriesMeta[series].name}:</span>
                                                                <span style={{ fontWeight: 800 }}>{fmt(payload[0].value)}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }} />
                                            <Bar dataKey="value" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={36}>
                                                <LabelList
                                                    dataKey="value"
                                                    position="top"
                                                    style={{ fill: 'var(--color-text)', fontSize: 10, fontWeight: 700 }}
                                                    offset={6}
                                                    formatter={(v: any) => Number(v) > 0 ? v : ''}
                                                />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : null}
                            </div>
                        </MktPanel>

                        {/* Active flows matching Dashboard's Top Tư vấn viên / Tỷ lệ vòng */}
                        <MktPanel className="flex flex-col">
                            <div className="px-4 py-3 border-b border-[var(--color-border)]">
                                <MktSectionTitle
                                    icon={GitBranch}
                                    title="Automation đang chạy"
                                    action={
                                        <button
                                            type="button"
                                            onClick={() => navigate('/marketing/flows')}
                                            className="text-xs font-semibold text-[var(--color-primary)] hover:underline"
                                        >
                                            Xem tất cả
                                        </button>
                                    }
                                />
                            </div>
                            {flows.length === 0 ? (
                                <MktEmpty
                                    icon={GitBranch}
                                    title="Chưa có kịch bản đang chạy"
                                    actionLabel="Tạo Automation"
                                    onAction={() => navigate('/marketing/flows')}
                                />
                            ) : (
                                <div className="custom-scrollbar p-2 flex flex-col gap-1 overflow-y-auto max-h-[300px]">
                                    {flows.map((flow, idx) => {
                                        const rate = pct(flow.stat_completed, flow.stat_enrolled);
                                        const cfg = getFlowTriggerConfig(flow.trigger_type);
                                        return (
                                            <div
                                                key={`${flow.name}-${idx}`}
                                                className="hover-lift p-2.5 rounded-[var(--radius-md)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
                                                onClick={() => navigate('/marketing/flows')}
                                            >
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center justify-between gap-2 min-w-0">
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <span
                                                                className="text-[10px] font-bold px-1.5 py-0.5 rounded-[var(--radius-sm)] shrink-0 uppercase tracking-wider"
                                                                style={{ backgroundColor: cfg.bg, color: cfg.color }}
                                                            >
                                                                {cfg.label}
                                                            </span>
                                                            <span className="text-sm font-semibold text-[var(--color-text)] truncate" title={flow.name}>
                                                                {flow.name}
                                                            </span>
                                                        </div>
                                                        <span className="text-xs font-extrabold shrink-0" style={{ color: cfg.color }}>
                                                            {rate}%
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
                                                        <span className="truncate">{flow.trigger_type || 'Kích hoạt tự động'}</span>
                                                        <span className="shrink-0">{fmt(flow.stat_completed)}/{fmt(flow.stat_enrolled)} đã xong</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-[var(--color-bg)] dark:bg-white/5 rounded-full overflow-hidden mt-0.5">
                                                        <div
                                                            className="h-full rounded-full transition-all duration-300"
                                                            style={{
                                                                width: `${Math.min(Math.max(rate, 0), 100)}%`,
                                                                backgroundColor: cfg.color
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </MktPanel>
                    </div>

                    {/* Recent campaigns matching Dashboard's Lịch sử giao Data gần đây */}
                    <MktPanel>
                        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                            <MktSectionTitle
                                icon={Mail}
                                title="Chiến dịch gần đây"
                            />
                            <button
                                type="button"
                                onClick={() => navigate('/marketing/campaigns')}
                                className="text-xs font-bold text-[var(--color-primary)] hover:underline cursor-pointer"
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
                            <div className="p-2 flex flex-col gap-1 max-h-[360px] overflow-y-auto custom-scrollbar">
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
                                            className="hover-lift p-3 flex items-center gap-3 rounded-[var(--radius-lg)] cursor-pointer transition-colors border-b border-[var(--color-border-light)] last:border-b-0 hover:bg-[var(--color-bg)]"
                                        >
                                            {/* Circular channel badge */}
                                            <div
                                                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                                                style={{
                                                    backgroundColor: isZalo ? 'rgba(0, 104, 255, 0.12)' : 'rgba(225, 29, 72, 0.12)',
                                                    color: isZalo ? '#0068ff' : '#e11d48',
                                                }}
                                            >
                                                {isZalo ? <MessageSquare className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                                            </div>

                                            {/* Title & Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-sm text-[var(--color-text)] truncate" title={c.name}>
                                                    {c.name}
                                                </div>
                                                <div className="text-xs text-[var(--color-text-muted)] mt-0.5 flex items-center gap-2 truncate">
                                                    <span className="font-medium text-[var(--color-text-light)]">{isZalo ? 'Zalo ZNS' : 'Email'}</span>
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

                                            {/* Right: status pill badge */}
                                            <div className="text-right shrink-0">
                                                <span
                                                    className="px-2.5 py-1 rounded-[var(--radius-sm)] text-xs font-bold inline-block"
                                                    style={{
                                                        backgroundColor: statusBadge.bg,
                                                        color: statusBadge.color,
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
                    </MktPanel>
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
                                className="group flex items-center gap-3 p-3 text-left bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)] hover:border-[var(--color-primary)] transition-all"
                            >
                                <AppIcon name={module.id} size={36} className="shrink-0 group-hover:scale-105 transition-transform" />
                                <span className="text-sm font-semibold text-[var(--color-text)] truncate">{module.title}</span>
                                <ArrowRight className="w-4 h-4 ml-auto text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] shrink-0" />
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
                                className="group h-full flex items-start gap-3.5 p-4 text-left bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-[var(--shadow-xs)] hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-md)] transition-all"
                            >
                                <AppIcon name={module.id} size={42} className="shrink-0 group-hover:scale-105 transition-transform" />
                                <span className="min-w-0 flex-1 flex flex-col">
                                    <span className="text-sm font-bold text-[var(--color-text)]">{module.title}</span>
                                    <span className="text-xs text-[var(--color-text-muted)] mt-1 leading-relaxed line-clamp-2">{module.sub}</span>
                                </span>
                                <ArrowRight className="w-4 h-4 mt-0.5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] shrink-0" />
                            </button>
                        ))}
                    </div>
                </section>
            ))}
        </MktPage>
    );
};

export default Dashboard;
