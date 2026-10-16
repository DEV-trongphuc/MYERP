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
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

interface CampaignRow { name: string; type?: string; status?: string; stat_total_sent?: number | string; stat_total_opened?: number | string; stat_total_clicked?: number | string }
interface FlowRow { name: string; trigger_type?: string | null; stat_enrolled?: number | string; stat_completed?: number | string }
interface OverviewStats {
    success: boolean;
    summary?: { total_web?: number; growth_web?: number; total_ai?: number; growth_ai?: number; total_leads?: number; growth_leads?: number };
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

const readRecents = (): string[] => {
    try {
        const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.map((x: unknown) => (typeof x === 'string' ? x : (x as { id?: string })?.id)).filter(Boolean).slice(0, 4) as string[];
    } catch {
        return [];
    }
};

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color?: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-md)] shadow-[var(--shadow-md)] px-3 py-2 text-xs">
            <div className="font-semibold text-[var(--color-text)] mb-1">{label}</div>
            {payload.map((p) => (
                <div key={p.name} className="flex items-center justify-between gap-4 text-[var(--color-text-light)]">
                    <span>{p.name}</span>
                    <span className="font-bold text-[var(--color-text)]">{fmt(p.value)}</span>
                </div>
            ))}
        </div>
    );
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
    const inFlightRef = useRef<string | null>(null);

    const fetchDashboardStats = useCallback(async (days: string, bust = false) => {
        if (!bust && inFlightRef.current === days) return;
        inFlightRef.current = days;
        const signal = nextSignal();
        setStatsLoading(true);
        setStatsError(null);
        try {
            const res = await api.get<OverviewStats>(`overview_stats?days=${days}${bust ? '&bust=1' : ''}`, {}, { signal });
            const payload = res as unknown as OverviewStats;
            if (payload?.success) setStatsData(payload);
            else setStatsError('Không tải được số liệu tổng quan.');
        } catch (err) {
            if (isAbortError(err)) return;
            console.error('[DashboardStats] Failed to fetch stats', err);
            setStatsError('Không tải được số liệu tổng quan.');
        } finally {
            inFlightRef.current = null;
        }
        if (!signal.aborted) setStatsLoading(false);
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
        web: { key: 'web', name: 'Lượt xem website' },
        ai: { key: 'ai', name: 'Phản hồi AI' },
        leads: { key: 'leads', name: 'Liên hệ mới' },
    };

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
                <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[var(--radius-lg)] border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30">
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">Cơ sở dữ liệu Marketing cần cập nhật cấu trúc</p>
                        <p className="text-xs text-amber-700 dark:text-amber-500">Một số bảng/cột mới chưa được tạo. Vui lòng chạy cập nhật để đảm bảo số liệu chính xác.</p>
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
                        {/* Daily trend chart */}
                        <MktPanel className="lg:col-span-2 flex flex-col">
                            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--color-border)]">
                                <MktSectionTitle icon={BarChart3} title="Xu hướng theo ngày" />
                                <div className="ml-auto">
                                    <MktSegmented<Series>
                                        value={series}
                                        onChange={setSeries}
                                        options={[
                                            { id: 'web', label: 'Website' },
                                            { id: 'ai', label: 'AI' },
                                            { id: 'leads', label: 'Liên hệ' },
                                        ]}
                                    />
                                </div>
                            </div>
                            <div className="px-2 pt-4 pb-2 h-[300px]">
                                {chartData.length === 0 ? (
                                    <MktEmpty icon={BarChart3} title="Chưa có dữ liệu trong khoảng thời gian này" />
                                ) : pageActive ? (
                                    <ResponsiveContainer width="100%" height={280} minWidth={0}>
                                        <AreaChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="mktDashArea" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.25} />
                                                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-light)" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} dy={6} />
                                            <YAxis axisLine={false} tickLine={false} allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Area
                                                type="monotone"
                                                dataKey={seriesMeta[series].key}
                                                name={seriesMeta[series].name}
                                                stroke="var(--color-primary)"
                                                strokeWidth={2}
                                                fill="url(#mktDashArea)"
                                                isAnimationActive={false}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                ) : null}
                            </div>
                        </MktPanel>

                        {/* Active flows */}
                        <MktPanel className="flex flex-col">
                            <div className="px-4 py-3 border-b border-[var(--color-border)]">
                                <MktSectionTitle
                                    icon={GitBranch}
                                    title="Automation đang chạy"
                                    action={<button type="button" onClick={() => navigate('/marketing/flows')} className="text-xs font-semibold text-[var(--color-primary)] hover:underline">Xem tất cả</button>}
                                />
                            </div>
                            {flows.length === 0 ? (
                                <MktEmpty icon={GitBranch} title="Chưa có kịch bản đang chạy" actionLabel="Tạo Automation" onAction={() => navigate('/marketing/flows')} />
                            ) : (
                                <ul className="divide-y divide-[var(--color-border-light)]">
                                    {flows.map((flow, idx) => {
                                        const rate = pct(flow.stat_completed, flow.stat_enrolled);
                                        return (
                                            <li key={`${flow.name}-${idx}`}>
                                                <button
                                                    type="button"
                                                    onClick={() => navigate('/marketing/flows')}
                                                    className="w-full text-left px-4 py-3 hover:bg-[var(--color-bg)] transition-colors"
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-sm font-semibold text-[var(--color-text)] truncate">{flow.name}</span>
                                                        <span className="text-xs font-bold text-[var(--color-primary)] shrink-0">{rate}%</span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3 mt-1 text-xs text-[var(--color-text-muted)]">
                                                        <span className="truncate">{flow.trigger_type || 'Kích hoạt thủ công'}</span>
                                                        <span className="shrink-0">{fmt(flow.stat_enrolled)} tham gia</span>
                                                    </div>
                                                    <div className="h-1 mt-2 rounded-full bg-[var(--color-border-light)] overflow-hidden">
                                                        <div className="h-full bg-[var(--color-primary)] rounded-full" style={{ width: `${Math.min(rate, 100)}%` }} />
                                                    </div>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </MktPanel>
                    </div>

                    {/* Recent campaigns table */}
                    <MktPanel>
                        <div className="px-4 py-3 border-b border-[var(--color-border)]">
                            <MktSectionTitle
                                icon={Mail}
                                title="Chiến dịch gần đây"
                                action={<button type="button" onClick={() => navigate('/marketing/campaigns')} className="text-xs font-semibold text-[var(--color-primary)] hover:underline">Xem tất cả</button>}
                            />
                        </div>
                        {campaigns.length === 0 ? (
                            <MktEmpty icon={Mail} title="Chưa có chiến dịch đã gửi" description="Các chiến dịch đã gửi, đang gửi hoặc đã lên lịch sẽ hiển thị tại đây." actionLabel="Tạo chiến dịch" onAction={() => navigate('/marketing/campaigns')} />
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-[var(--color-bg)] text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                                        <tr>
                                            <th className="px-4 py-3 text-left">Chiến dịch</th>
                                            <th className="px-4 py-3 text-left">Kênh</th>
                                            <th className="px-4 py-3 text-right">Đã gửi</th>
                                            <th className="px-4 py-3 text-right">Tỷ lệ mở</th>
                                            <th className="px-4 py-3 text-right">Tỷ lệ click</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {campaigns.map((c, idx) => {
                                            const isZalo = c.type === 'zalo' || c.type === 'zalo_zns';
                                            return (
                                                <tr
                                                    key={`${c.name}-${idx}`}
                                                    onClick={() => navigate('/marketing/campaigns')}
                                                    className="border-b border-[var(--color-border-light)] last:border-b-0 hover:bg-[var(--color-bg)] cursor-pointer"
                                                >
                                                    <td className="px-4 py-3 font-semibold text-[var(--color-text)] max-w-[360px] truncate">{c.name}</td>
                                                    <td className="px-4 py-3 text-[var(--color-text-light)]">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            {isZalo ? <MessageSquare className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                                                            {isZalo ? 'Zalo ZNS' : 'Email'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-[var(--color-text)]">{fmt(c.stat_total_sent)}</td>
                                                    <td className="px-4 py-3 text-right text-[var(--color-text)]">{pct(c.stat_total_opened, c.stat_total_sent)}%</td>
                                                    <td className="px-4 py-3 text-right text-[var(--color-text)]">{pct(c.stat_total_clicked, c.stat_total_sent)}%</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
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
