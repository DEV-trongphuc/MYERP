import React, { useState, useEffect, useCallback } from 'react';
import { X, Activity, Server, Zap, Users, ShieldCheck, Mail, Database, Bot, BarChart3, TrendingUp, Globe, Loader2, Sparkles, MessageSquare, ChevronLeft, ChevronRight, Send } from 'lucide-react';
import { api } from '../../services/storageAdapter';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, Legend
} from 'recharts';
import Tabs from './Tabs';
import MetaGrowthReport from '../meta/MetaGrowthReport';
import ZaloReportTab from '../zalo/ZaloReportTab';
import AIChatReport from '../reports/AIChatReport';
import WebJourneyReport from '../reports/WebJourneyReport';
import Modal from './Modal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    isDarkTheme?: boolean;
}

const MODAL_STYLES = `
@keyframes pulseRing {
    0%, 100% { transform: scale(1);    opacity: 0.5; }
    50%       { transform: scale(1.2);  opacity: 0; }
}
@keyframes spin2    { to { transform: rotate(360deg); } }
@keyframes spin2rev { to { transform: rotate(-360deg); } }
@keyframes dotBounce {
    0%, 80%, 100% { transform: scaleY(0.4); opacity: 0.3; }
    40%            { transform: scaleY(1.2); opacity: 1; }
}
`;

export const SystemOverviewModal: React.FC<Props> = ({ isOpen, onClose, isDarkTheme }) => {
    const [loading, setLoading] = useState(true);
    const [days, setDays] = useState(7);
    const [data, setData] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'overview' | 'meta' | 'zalo' | 'ai' | 'web'>('overview');

    const dateRange = React.useMemo(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    }, [days]);

    useEffect(() => {
        let isMounted = true;
        if (!isOpen) {
            setLoading(true);
            setData(null);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            try {
                const result = await api.get(`overview_stats?days=${days}`);
                if (!isMounted) return;
                if (result?.success) {
                    setData(result);
                }
            } catch (error) {
                console.error(error);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchData();

        return () => { isMounted = false; };
    }, [isOpen, days]);

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="2xl"
            noHeader
            noPadding
            noScroll
            isDarkTheme={isDarkTheme}
        >
            <div className={`relative w-full h-full flex flex-col overflow-hidden ${isDarkTheme ? 'bg-[#11151d] text-slate-100' : 'bg-white text-slate-800'}`}>

                {/* Header */}
                <div className={`px-6 py-4 border-b flex items-center justify-between relative overflow-hidden shrink-0 ${isDarkTheme ? 'bg-[#11151d] border-slate-800/80' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-[var(--color-primary)]" />

                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-white shadow-sm border border-slate-200 flex items-center justify-center text-[var(--color-primary)]">
                            <Server className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800">TỔNG QUAN HỆ THỐNG</h2>
                            <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-emerald-500" /> Báo cáo hợp nhất đa kênh
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className={`flex p-1 rounded-[var(--radius-md)] border ${isDarkTheme ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200/50'}`}>
                            {[3, 7, 14, 30].map(d => (
                                <button
                                    key={d}
                                    onClick={() => setDays(d)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-[var(--radius-md)] transition-all duration-300 ${days === d ? (isDarkTheme ? 'bg-slate-900 text-white' : 'bg-white shadow-sm text-[var(--color-primary)]') : (isDarkTheme ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-700')}`}
                                >
                                    {d} ngày
                                </button>
                            ))}
                        </div>
                        <button onClick={onClose} className={`p-2 rounded-full transition-colors ${isDarkTheme ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'bg-slate-50 hover:bg-slate-200 text-slate-400'}`}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Sub-Navigation Tabs */}
                <div className={`px-6 py-3 border-b ${isDarkTheme ? 'bg-[#11151d] border-slate-800/80' : 'bg-white border-slate-100'}`}>
                    <Tabs
                        activeId={activeTab}
                        onChange={(id) => setActiveTab(id as any)}
                        items={[
                            { id: 'overview', label: 'Dashboard', icon: Activity },
                            { id: 'ai', label: 'Chat AI', icon: Bot },
                            { id: 'web', label: 'Website', icon: Globe },
                            { id: 'meta', label: 'Meta', icon: Users },
                            { id: 'zalo', label: 'Zalo OA', icon: MessageSquare }
                        ]}
                        variant="segmented"
                    />
                </div>

                {/* Content */}
                <div className={`flex-1 overflow-y-auto p-6 relative custom-scrollbar ${isDarkTheme ? 'bg-[#141822]' : 'bg-slate-50'}`}>

                    {loading ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="p-5 rounded-[18px] bg-white border border-slate-100 shadow-sm space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="w-11 h-11 rounded-[14px] bg-slate-100 animate-pulse" />
                                            <div className="w-14 h-5 rounded bg-slate-100 animate-pulse" />
                                        </div>
                                        <div className="w-28 h-3 rounded bg-slate-100 animate-pulse" />
                                        <div className="w-20 h-7 rounded bg-slate-200 animate-pulse" />
                                    </div>
                                ))}
                            </div>
                            <div className="bg-white p-6 rounded-[18px] border border-slate-100 shadow-sm space-y-4">
                                <div className="w-48 h-5 bg-slate-100 rounded animate-pulse" />
                                <div className="h-[260px] w-full bg-slate-50 rounded-[14px] animate-pulse" />
                            </div>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-[18px] border border-slate-100 shadow-sm space-y-3">
                                    <div className="w-40 h-5 bg-slate-100 rounded animate-pulse mb-4" />
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-14 w-full bg-slate-50 rounded-[14px] animate-pulse" />
                                    ))}
                                </div>
                                <div className="bg-white p-6 rounded-[18px] border border-slate-100 shadow-sm space-y-3">
                                    <div className="w-40 h-5 bg-slate-100 rounded animate-pulse mb-4" />
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-14 w-full bg-slate-50 rounded-[14px] animate-pulse" />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (data && activeTab === 'overview' && (
                        <div className="space-y-6 animate-fade-in">

                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <StatCard
                                    title="AI Chat Phản Hồi"
                                    value={(data.summary?.total_ai || 0).toLocaleString()}
                                    growth={data.summary?.growth_ai || 0}
                                    icon={<Bot className="w-5 h-5" />}
                                    gradient="from-rose-500 to-pink-600 shadow-rose-500/25"
                                    trendColor={(data.summary?.growth_ai || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}
                                    isDarkTheme={isDarkTheme}
                                />
                                <StatCard
                                    title="Truy cập Website"
                                    value={(data.summary?.total_web || 0).toLocaleString()}
                                    growth={data.summary?.growth_web || 0}
                                    icon={<Globe className="w-5 h-5" />}
                                    gradient="from-blue-500 to-indigo-600 shadow-blue-500/25"
                                    trendColor={(data.summary?.growth_web || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}
                                    isDarkTheme={isDarkTheme}
                                />
                                <StatCard
                                    title="Khách Mới"
                                    value={(data.summary?.total_leads || 0).toLocaleString()}
                                    growth={data.summary?.growth_leads || 0}
                                    icon={<Users className="w-5 h-5" />}
                                    gradient="from-blue-500 to-indigo-600 shadow-indigo-500/25"
                                    trendColor={(data.summary?.growth_leads || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}
                                    isDarkTheme={isDarkTheme}
                                />
                            </div>

                            {/* Email Sent Bar Chart */}
                            <EmailSentChart />

                            {/* Traffic Chart Area */}
                            <div className="bg-white p-6 rounded-[18px] border border-slate-100 shadow-sm">
                                <div className="flex items-center gap-2 mb-6">
                                    <BarChart3 className="w-5 h-5 text-[var(--color-primary)]" />
                                    <h3 className="font-bold text-slate-800">Lưu lượng {days} ngày qua</h3>
                                </div>
                                <div className="h-[300px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data.chart_data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorWeb" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#BD1D2D" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#BD1D2D" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} dy={10} />
                                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94a3b8' }} />
                                            <Tooltip
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                                labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '8px' }}
                                            />
                                            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
                                            <Area type="monotone" name="Truy cập Web" dataKey="web" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorWeb)" />
                                            <Area type="monotone" name="AI Phản hồi" dataKey="ai" stroke="#BD1D2D" strokeWidth={3} fillOpacity={1} fill="url(#colorAi)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Two Column Lists */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Top Campaigns */}
                                <div className="bg-white p-6 rounded-[18px] border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary)] shadow-sm flex items-center justify-center">
                                            <Mail className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="font-bold text-slate-800">Top Chiến dịch Email</h3>
                                        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded uppercase">All Time</span>
                                    </div>
                                    <div className="space-y-3">
                                        {data.top_campaigns.length === 0 ? (
                                            <div className="text-center py-6 text-sm text-slate-400">Chưa có dữ liệu chiến dịch</div>
                                        ) : data.top_campaigns.map((camp: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-[14px] border border-slate-50 hover:bg-slate-50 transition-colors">
                                                <div className="min-w-0 flex-1 mr-4">
                                                    <p className="text-sm font-bold text-slate-800 truncate mb-1">{camp.name}</p>
                                                    <div className="flex gap-3 text-xs text-slate-500 font-medium tracking-tight">
                                                        <span>Gửi: <strong className="text-slate-700">{camp.stat_total_sent?.toLocaleString() || 0}</strong></span>
                                                        <span>Mở: <strong className="text-emerald-600">{camp.stat_total_opened?.toLocaleString() || 0}</strong></span>
                                                        <span>Click: <strong className="text-blue-600">{camp.stat_total_clicked?.toLocaleString() || 0}</strong></span>
                                                    </div>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                                                    #{idx + 1}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Top Flows */}
                                <div className="bg-white p-6 rounded-[18px] border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary)] shadow-sm flex items-center justify-center">
                                            <Zap className="w-5 h-5 text-white" />
                                        </div>
                                        <h3 className="font-bold text-slate-800">Top DOMATION Kích hoạt</h3>
                                        <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded uppercase">All Time</span>
                                    </div>
                                    <div className="space-y-3">
                                        {data.top_flows.length === 0 ? (
                                            <div className="text-center py-6 text-sm text-slate-400">Chưa có dữ liệu kịch bản</div>
                                        ) : data.top_flows.map((flow: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-slate-50 hover:bg-slate-50 transition-colors">
                                                <div className="min-w-0 flex-1 mr-4">
                                                    <p className="text-sm font-bold text-slate-800 truncate mb-1">{flow.name}</p>
                                                    <div className="flex gap-3 text-xs text-slate-500 font-medium tracking-tight">
                                                        <span>Enroll: <strong className="text-slate-700">{flow.stat_enrolled?.toLocaleString() || 0}</strong></span>
                                                        <span>Hoàn thành: <strong className="text-emerald-600">{flow.stat_completed?.toLocaleString() || 0}</strong></span>
                                                        <span className="px-1.5 py-px border border-slate-200 rounded text-[9px] uppercase tracking-wider">{flow.trigger_type || 'Manual'}</span>
                                                    </div>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-400">
                                                    #{idx + 1}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Rendering Sub-Reports */}
                    {!loading && activeTab === 'ai' && (
                        <div className="animate-fade-in">
                            <AIChatReport dateRange={dateRange} />
                        </div>
                    )}
                    
                    {!loading && activeTab === 'web' && (
                        <div className="animate-fade-in">
                            <WebJourneyReport dateRange={dateRange} />
                        </div>
                    )}

                    {!loading && activeTab === 'meta' && (
                        <div className="animate-fade-in">
                            <MetaGrowthReport />
                        </div>
                    )}

                    {!loading && activeTab === 'zalo' && (
                        <div className="animate-fade-in">
                            <ZaloReportTab />
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

// ─── Email Sent Chart Component ─────────────────────────────────────────────
const VI_MONTHS = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

const CustomBarTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl border border-slate-700">
            <p className="text-xs text-slate-400 font-bold mb-1">{label}</p>
            <p className="text-lg font-black text-blue-500">{payload[0].value.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 font-medium">email đã gửi</p>
        </div>
    );
};

const EmailSentChart: React.FC = () => {
    const now = new Date();
    const [mode, setMode] = useState<'yearly' | 'monthly'>('yearly');
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [chartData, setChartData] = useState<any[]>([]);
    const [summary, setSummary] = useState({ total: 0, peak: 0 });
    const [availableYears, setAvailableYears] = useState<number[]>([now.getFullYear()]);
    const [loading, setLoading] = useState(true);

    const fetchChart = useCallback(async () => {
        setLoading(true);
        try {
            const url = `overview_stats?route=email_sent_chart&mode=${mode}&year=${year}&month=${month}`;
            // Cast to `any` — backend returns { success, data, summary, years } at root level
            // which doesn't match the generic ApiResponse<T> shape (only has success/data/message)
            const res = await api.get<any>(url) as any;
            if (res.success) {
                setChartData(res.data || []);
                setSummary(res.summary || { total: 0, peak: 0 });
                if (res.years?.length) setAvailableYears(res.years);
            }
        } catch (e) {
            console.error('[EmailSentChart]', e);
        } finally {
            setLoading(false);
        }
    }, [mode, year, month]);

    useEffect(() => { fetchChart(); }, [fetchChart]);

    const prevPeriod = () => {
        if (mode === 'yearly') setYear(y => y - 1);
        else {
            if (month === 1) { setMonth(12); setYear(y => y - 1); }
            else setMonth(m => m - 1);
        }
    };
    const nextPeriod = () => {
        if (mode === 'yearly') setYear(y => y + 1);
        else {
            if (month === 12) { setMonth(1); setYear(y => y + 1); }
            else setMonth(m => m + 1);
        }
    };

    const maxVal = summary.peak || 1;

    return (
        <div className="bg-white rounded-[18px] border border-slate-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-5 pb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary)] shadow-sm flex items-center justify-center">
                        <Send className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h3 className="font-black text-slate-800 text-sm">Email & ZNS đã gửi</h3>
                        <p className="text-[11px] text-slate-400 font-medium">
                            {mode === 'yearly' ? `Năm ${year}` : `${VI_MONTHS[month - 1]} ${year}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Mode switcher */}
                    <div className="flex p-1 bg-slate-100 rounded-[var(--radius-md)] border border-slate-200">
                        <button
                            onClick={() => setMode('yearly')}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-[var(--radius-md)] transition-all ${
                                mode === 'yearly' ? 'bg-white shadow text-[var(--color-primary)]' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >Theo tháng</button>
                        <button
                            onClick={() => setMode('monthly')}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-[var(--radius-md)] transition-all ${
                                mode === 'monthly' ? 'bg-white shadow text-[var(--color-primary)]' : 'text-slate-500 hover:text-slate-700'
                            }`}
                        >Theo ngày</button>
                    </div>

                    {/* Period navigator */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={prevPeriod}
                            className="p-1.5 rounded-[var(--radius-md)] hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                        ><ChevronLeft className="w-4 h-4" /></button>
                        
                        {mode === 'yearly' ? (
                            <select
                                value={year}
                                onChange={e => setYear(Number(e.target.value))}
                                className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
                            >
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        ) : (
                            <select
                                value={month}
                                onChange={e => setMonth(Number(e.target.value))}
                                className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)]"
                            >
                                {VI_MONTHS.map((mn, i) => <option key={i+1} value={i+1}>{mn}</option>)}
                            </select>
                        )}

                        <button
                            onClick={nextPeriod}
                            className="p-1.5 rounded-[var(--radius-md)] hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                        ><ChevronRight className="w-4 h-4" /></button>
                    </div>
                </div>
            </div>

            {/* Summary strip */}
            <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
                <div className="px-6 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-rose-50 flex items-center justify-center">
                        <Send className="w-4 h-4 text-[var(--color-primary)]" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tổng gửi</p>
                        <p className="text-xl font-black text-slate-800">{loading ? '—' : summary.total.toLocaleString()}</p>
                    </div>
                </div>
                <div className="px-6 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-indigo-50 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cao nhất / kỳ</p>
                        <p className="text-xl font-black text-slate-800">{loading ? '—' : summary.peak.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Chart */}
            <div className="px-2 pt-4 pb-3 relative" style={{ height: 280 }}>
                {loading ? (
                    <div className="px-4 h-full flex items-end gap-3 pb-6">
                        {[40, 65, 35, 80, 55, 90, 60, 75, 45, 70, 50, 85].map((h, idx) => (
                            <div key={idx} className="flex-1 bg-slate-100 rounded-t-[6px] animate-pulse" style={{ height: `${h}%` }} />
                        ))}
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }} barCategoryGap="20%">
                            <defs>
                                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#c084fc" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.85} />
                                </linearGradient>
                                <linearGradient id="barGradientPeak" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#e11d48" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#BD1D2D" stopOpacity={1} />
                                </linearGradient>
                                <linearGradient id="barGradientZero" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#e2e8f0" stopOpacity={1} />
                                    <stop offset="100%" stopColor="#cbd5e1" stopOpacity={1} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis
                                dataKey="label"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: mode === 'monthly' ? 10 : 12, fill: '#94a3b8', fontWeight: 700 }}
                                dy={8}
                                interval={mode === 'monthly' ? 2 : 0}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                                tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}
                            />
                            <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(189,29,45,0.06)', radius: 6 }} />
                            <Bar dataKey="sent" radius={[6, 6, 0, 0]} maxBarSize={mode === 'monthly' ? 18 : 48}>
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={
                                            entry.sent === 0
                                                ? 'url(#barGradientZero)'
                                                : entry.sent === maxVal
                                                ? 'url(#barGradientPeak)'
                                                : 'url(#barGradient)'
                                        }
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Legend */}
            <div className="px-6 pb-4 flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-purple-600" />
                    <span className="text-[10px] font-bold text-slate-500">Email / ZNS đã gửi</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-[var(--color-primary)] ring-2 ring-rose-300" />
                    <span className="text-[10px] font-bold text-slate-500">Cao nhất</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-slate-200" />
                    <span className="text-[10px] font-bold text-slate-400">Không có gửi</span>
                </div>
            </div>
        </div>
    );
};
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = ({ title, value, growth, icon, gradient, isDarkTheme }: any) => {
    return (
        <div className={`p-5 rounded-[18px] shadow-[0_4px_20px_rgba(0,0,0,0.015)] border transition-all duration-300 relative overflow-hidden group hover:shadow-[0_12px_36px_rgba(0,0,0,0.035)] hover:-translate-y-1 ${isDarkTheme ? 'bg-[#11151d] border-slate-800/80' : 'bg-white border-slate-100/70'}`}>
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -mr-10 -mt-10 opacity-30 group-hover:scale-110 transition-transform ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-50'}`} />
            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className={`w-11 h-11 rounded-[14px] bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg`}>
                    {icon}
                </div>
                <div className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md ${growth >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    <TrendingUp className={`w-3 h-3 ${growth < 0 ? 'rotate-180' : ''}`} />
                    {growth > 0 ? '+' : ''}{growth}%
                </div>
            </div>
            <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">{title}</h4>
            <div className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100">{value}</div>
        </div>
    );
};
