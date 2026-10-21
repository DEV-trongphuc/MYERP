import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../../../services/storageAdapter';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Activity, Users, MessageSquare, Bot, Calendar, ChevronDown } from 'lucide-react';
import { format, subDays, startOfWeek, startOfMonth, startOfToday } from '../../../shims/dateFns';
import { toast } from 'react-hot-toast';

interface PaginatedResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    pagination: {
        current_page: number;
        total_pages: number;
        total_items: number;
    }
}

interface AdminLogsTabProps {
    className?: string;
    categoryId?: string;
    initialBotId?: string | null;
    brandColor?: string;
    onEditMember?: (userId: number) => void;
    isDarkTheme?: boolean;
}

const AdminLogsTab: React.FC<AdminLogsTabProps> = ({ className, categoryId, initialBotId, brandColor = '#3b82f6', onEditMember, isDarkTheme }) => {
    // State
    const [activeView, setActiveView] = useState<'overview' | 'logs'>('overview');
    const [activeTable, setActiveTable] = useState<'users' | 'bots'>('users');
    const [stats, setStats] = useState<any>(null);
    const [logs, setLogs] = useState<any[]>([]);
    const [topBots, setTopBots] = useState<any[]>([]);
    const [heatmapData, setHeatmapData] = useState<any[]>([]);
    const [heatmapMetric, setHeatmapMetric] = useState<'conversations' | 'users'>('conversations');
    const [userStats, setUserStats] = useState<any[]>([]);
    const [userPage, setUserPage] = useState(1);
    const [userTotalPages, setUserTotalPages] = useState(1);
    const [loading, setLoading] = useState(false);
    const [selectedBotId, setSelectedBotId] = useState<string | null>(initialBotId || null);
    const [botList, setBotList] = useState<any[]>([]); // For filtering dropdown
    const [botStats, setBotStats] = useState<any[]>([]); // For the new bot details tab
    const [botPage, setBotPage] = useState(1);
    const [botTotalPages, setBotTotalPages] = useState(1);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    // Pagination for logs
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Filters
    const [dateRange, setDateRange] = useState({
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    const handleDatePreset = useCallback((preset: string) => {
        const today = startOfToday();
        let start = today;
        let end = today;

        switch (preset) {
            case 'today':
                start = today;
                break;
            case '7days':
                start = subDays(today, 6);
                break;
            case '30days':
                start = subDays(today, 29);
                break;
            case 'thisWeek':
                start = startOfWeek(today, { weekStartsOn: 1 });
                break;
            case 'thisMonth':
                start = startOfMonth(today);
                break;
            default:
                return;
        }

        setDateRange({
            start: format(start, 'yyyy-MM-dd'),
            end: format(end, 'yyyy-MM-dd')
        });
    }, []);

    const fetchHeatmapData = useCallback(async () => {
        try {
            const url = `admin_stats?action=get_heatmap&start_date=${dateRange.start}&end_date=${dateRange.end}&metric=${heatmapMetric}${categoryId ? `&category_id=${categoryId}` : ''}${selectedBotId ? `&chatbot_id=${selectedBotId}` : ''}`;
            const res = await api.get<any>(url);
            if (res.success) setHeatmapData(res.data);
        } catch (err) {
            console.error("Heatmap fetch error", err);
        }
    }, [dateRange, heatmapMetric, categoryId, selectedBotId]);

    const fetchBotList = useCallback(async () => {
        try {
            const url = `ai_chatbots?action=list${categoryId ? `&category_id=${categoryId}` : ''}`;
            const res = await api.get<any>(url);
            if (res.success) setBotList(res.data || []);
        } catch (err) {
            console.error("Bot list fetch error", err);
        }
    }, [categoryId]);

    const fetchGeneralStats = useCallback(async () => {
        try {
            const url = `admin_stats?action=get_general_stats${categoryId ? `&category_id=${categoryId}` : ''}${selectedBotId ? `&chatbot_id=${selectedBotId}` : ''}&start_date=${dateRange.start}&end_date=${dateRange.end}`;
            const res = await api.get<any>(url);
            if (res.success) setStats(res.data);
        } catch (err) {
            console.error("General stats fetch error", err);
        }
    }, [categoryId, selectedBotId, dateRange]);

    const fetchTopBots = useCallback(async () => {
        try {
            const url = `admin_stats?action=get_bot_usage&start_date=${dateRange.start}&end_date=${dateRange.end}${categoryId ? `&category_id=${categoryId}` : ''}${selectedBotId ? `&chatbot_id=${selectedBotId}` : ''}`;
            const res = await api.get<any>(url);
            if (res.success) setTopBots(res.data);
        } catch (err) {
            console.error("Top bots fetch error", err);
        }
    }, [dateRange, categoryId, selectedBotId]);

    const fetchUserStats = useCallback(async (pageNum: number) => {
        try {
            const url = `admin_stats?action=get_user_stats&start_date=${dateRange.start}&end_date=${dateRange.end}&page=${pageNum}&limit=20${categoryId ? `&category_id=${categoryId}` : ''}${selectedBotId ? `&chatbot_id=${selectedBotId}` : ''}`;
            const res = await api.get<any>(url) as PaginatedResponse<any>;
            if (res.success && res.pagination) {
                setUserStats(res.data);
                setUserTotalPages(res.pagination.total_pages);
                setUserPage(pageNum);
            }
        } catch (err) {
            console.error("User stats fetch error", err);
        }
    }, [dateRange, categoryId, selectedBotId]);

    const fetchBotActivityStats = useCallback(async (pageNum: number) => {
        try {
            const url = `admin_stats?action=get_all_bot_stats&start_date=${dateRange.start}&end_date=${dateRange.end}&page=${pageNum}&limit=20${categoryId ? `&category_id=${categoryId}` : ''}`;
            const res = await api.get<any>(url) as PaginatedResponse<any>;
            if (res.success && res.pagination) {
                setBotStats(res.data);
                setBotTotalPages(res.pagination.total_pages);
                setBotPage(pageNum);
            }
        } catch (err) {
            console.error("Bot activity stats fetch error", err);
        }
    }, [dateRange, categoryId]);

    const fetchLogs = useCallback(async (pageNum: number) => {
        setLoading(true);
        try {
            const url = `admin_stats?action=get_logs&page=${pageNum}&limit=20${categoryId ? `&category_id=${categoryId}` : ''}${selectedBotId ? `&chatbot_id=${selectedBotId}` : ''}`;
            const res = await api.get<any>(url) as PaginatedResponse<any>;
            if (res.success && res.pagination) {
                setLogs(res.data);
                setTotalPages(res.pagination.total_pages);
                setPage(pageNum);
            } else {
                toast.error(res.message || 'Lỗi tải nhật ký');
            }
        } catch (err) {
            console.error("Logs fetch error", err);
            toast.error('Không thể kết nối máy chủ để tải nhật ký');
        } finally {
            setLoading(false);
        }
    }, [categoryId, selectedBotId]);

    useEffect(() => {
        fetchGeneralStats();
        fetchLogs(1);
        fetchBotList();
    }, [fetchGeneralStats, fetchLogs, fetchBotList]);

    useEffect(() => {
        fetchTopBots();
        fetchUserStats(1);
        fetchBotActivityStats(1);
        fetchHeatmapData();
    }, [fetchTopBots, fetchUserStats, fetchBotActivityStats, fetchHeatmapData]);

    return (
        <div className={`space-y-6 ${className}`}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                <div className={`flex space-x-1 p-1 rounded-xl border ${isDarkTheme ? 'bg-[#0D1117]/40 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    <button
                        onClick={() => setActiveView('overview')}
                        className={`px-6 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${activeView === 'overview' ? (isDarkTheme ? 'bg-slate-800 text-white shadow-lg' : 'bg-white shadow-sm ring-1 ring-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
                        style={activeView === 'overview' && !isDarkTheme ? { color: brandColor } : {}}
                    >
                        Tổng quan
                    </button>
                    <button
                        onClick={() => setActiveView('logs')}
                        className={`px-6 py-2 text-sm font-bold rounded-lg transition-all duration-300 ${activeView === 'logs' ? (isDarkTheme ? 'bg-slate-800 text-white shadow-lg' : 'bg-white shadow-sm ring-1 ring-slate-200/50') : 'text-slate-400 hover:text-slate-600'}`}
                        style={activeView === 'logs' && !isDarkTheme ? { color: brandColor } : {}}
                    >
                        Nhật ký
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    <CustomDropdown
                        icon={Bot}
                        label={selectedBotId ? botList.find(b => b.id === selectedBotId)?.name || 'Bot' : 'Tất cả Bot'}
                        isDarkTheme={isDarkTheme}
                        isOpen={openDropdown === 'bot'}
                        onToggle={() => setOpenDropdown(openDropdown === 'bot' ? null : 'bot')}
                        onClose={() => setOpenDropdown(null)}
                    >
                        <div className={`p-2 space-y-1 ${isDarkTheme ? 'bg-black/60' : 'bg-white'}`}>
                            <button
                                onClick={() => { setSelectedBotId(null); setOpenDropdown(null); }}
                                className={`w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${!selectedBotId ? (isDarkTheme ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-100') : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                Tất cả Bot
                            </button>
                            {botList.map(b => (
                                <button
                                    key={b.id}
                                    onClick={() => { setSelectedBotId(b.id); setOpenDropdown(null); }}
                                    className={`w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${selectedBotId === b.id ? (isDarkTheme ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-900 border-slate-100') : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    {b.name}
                                </button>
                            ))}
                        </div>
                    </CustomDropdown>

                    <CustomDropdown
                        icon={Calendar}
                        label={dateRange.start === dateRange.end ? dateRange.start : `${dateRange.start} - ${dateRange.end}`}
                        isDarkTheme={isDarkTheme}
                        isOpen={openDropdown === 'date'}
                        onToggle={() => setOpenDropdown(openDropdown === 'date' ? null : 'date')}
                        onClose={() => setOpenDropdown(null)}
                    >
                        <div className={`p-2 space-y-1 ${isDarkTheme ? 'bg-black/60' : 'bg-white'}`}>
                            {[
                                { id: 'today', label: 'Hôm nay' },
                                { id: '7days', label: '7 ngày qua' },
                                { id: 'thisWeek', label: 'Tuần này' },
                                { id: 'thisMonth', label: 'Tháng này' },
                                { id: '30days', label: '30 ngày qua' },
                            ].map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => { handleDatePreset(preset.id); setOpenDropdown(null); }}
                                    className={`w-full text-left px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkTheme ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                            <div className={`mt-2 pt-2 border-t ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                                <div className="px-4 py-2 text-[8px] font-black text-slate-500 uppercase tracking-widest">Tùy chỉnh</div>
                                <div className="grid grid-cols-2 gap-2 px-2 pb-2">
                                    <div className="relative">
                                        <div className={`text-[8px] font-black mb-1 ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>TỪ</div>
                                        <div className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                            {dateRange.start}
                                            <input
                                                type="date"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                value={dateRange.start}
                                                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="relative">
                                        <div className={`text-[8px] font-black mb-1 ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>ĐẾN</div>
                                        <div className={`px-2 py-1.5 rounded-lg border text-[10px] font-bold ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                                            {dateRange.end}
                                            <input
                                                type="date"
                                                className="absolute inset-0 opacity-0 cursor-pointer"
                                                value={dateRange.end}
                                                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CustomDropdown>
                </div>
            </div>

            {activeView === 'overview' ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard icon={Users} label="Tổng thành viên" value={stats?.total_members || 0} color="blue" isDarkTheme={isDarkTheme} />
                        <StatCard icon={Bot} label="Tổng AI Bot" value={stats?.total_bots || 0} color="purple" isDarkTheme={isDarkTheme} />
                        <StatCard icon={Activity} label="Bot đang hoạt động" value={stats?.active_bots || 0} color="green" isDarkTheme={isDarkTheme} />
                        <StatCard icon={MessageSquare} label="Tổng hội thoại" value={stats?.total_conversations || 0} color="orange" isDarkTheme={isDarkTheme} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Top Bots Chart (Col 1-5) */}
                        <div className={`lg:col-span-12 xl:col-span-5 p-6 rounded-[18px] border transition-all duration-300 ${isDarkTheme ? 'bg-[rgba(13,17,23,0.6)] backdrop-blur-md border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <h3 className={`text-[11px] font-bold mb-6 uppercase tracking-wider flex items-center gap-2 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                <div className={`p-1.5 rounded-lg ${isDarkTheme ? 'bg-slate-900 text-blue-400' : 'bg-blue-50 text-blue-500/80'}`}>
                                    <Bot size={14} />
                                </div>
                                Top AI Bot phổ biến
                            </h3>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={topBots} layout="vertical" margin={{ left: 0, right: 30 }}>
                                        <defs>
                                            <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                                                <stop offset="0%" stopColor={brandColor} />
                                                <stop offset="100%" stopColor={brandColor + 'cc'} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f8fafc" />
                                        <XAxis type="number" fontSize={9} fontWeight="600" axisLine={false} tickLine={false} stroke="#94a3b8" />
                                        <YAxis dataKey="bot_name" type="category" width={70} fontSize={9} fontWeight="600" axisLine={false} tickLine={false} stroke={isDarkTheme ? '#475569' : '#64748b'} />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc', opacity: 0.4 }}
                                            contentStyle={{ borderRadius: '12px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', fontSize: '11px', fontWeight: '600' }}
                                        />
                                        <Bar dataKey="conversation_count" fill="url(#barGradient)" radius={[0, 4, 4, 0]} name="Hội thoại" barSize={16} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Heatmap (Col 6-10) */}
                        <div className={`lg:col-span-12 xl:col-span-5 p-6 rounded-[18px] border transition-all duration-300 ${isDarkTheme ? 'bg-[rgba(13,17,23,0.6)] backdrop-blur-md border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-sm'}`}>
                            <div className="flex items-center justify-between mb-6">
                                <h3 className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-2 ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                    <div className={`p-1.5 rounded-lg ${isDarkTheme ? 'bg-slate-900 text-emerald-400' : 'bg-emerald-50 text-emerald-500/80'}`}>
                                        <Activity size={14} />
                                    </div>
                                    Mật độ hội thoại
                                </h3>
                                <div className={`flex space-x-1 p-1 rounded-lg border ${isDarkTheme ? 'bg-black/20 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                    <button
                                        onClick={() => setHeatmapMetric('conversations')}
                                        className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded transition-all duration-200 ${heatmapMetric === 'conversations' ? (isDarkTheme ? 'bg-slate-800 text-white shadow-lg' : 'bg-white shadow-sm ring-1 ring-slate-200/30') : 'text-slate-400 hover:text-slate-600'}`}
                                        style={heatmapMetric === 'conversations' && !isDarkTheme ? { color: brandColor } : {}}
                                    >
                                        Hội thoại
                                    </button>
                                    <button
                                        onClick={() => setHeatmapMetric('users')}
                                        className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded transition-all duration-200 ${heatmapMetric === 'users' ? (isDarkTheme ? 'bg-slate-800 text-white shadow-lg' : 'bg-white shadow-sm ring-1 ring-slate-200/30') : 'text-slate-400 hover:text-slate-600'}`}
                                        style={heatmapMetric === 'users' && !isDarkTheme ? { color: brandColor } : {}}
                                    >
                                        Người dùng
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-col items-center justify-center">
                                <HeatmapGrid data={heatmapData} metricLabel={heatmapMetric === 'conversations' ? 'hội thoại' : 'người dùng'} isDarkTheme={isDarkTheme} />
                                <div className="mt-6 flex items-center justify-center gap-3 w-full max-w-[180px]">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Ít</span>
                                    <div className="flex-1 flex gap-1">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <div key={i} className={`h-1 flex-1 rounded-full ${i === 1 ? 'bg-slate-100' : i === 2 ? 'bg-emerald-100' : i === 3 ? 'bg-emerald-300' : i === 4 ? 'bg-emerald-500' : i === 5 ? 'bg-emerald-700' : 'bg-slate-100'}`}></div>
                                        ))}
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nhiều</span>
                                </div>
                            </div>
                        </div>

                        {/* Ratios Mini Widgets (Col 11-12) */}
                        <div className="lg:col-span-12 xl:col-span-2 flex flex-col gap-5">
                            <StatCard
                                icon={MessageSquare}
                                label="Chats / User"
                                value={stats?.avg_convo_user || 0}
                                color="indigo"
                                isRatio
                                trend={2}
                                className="flex-1"
                                isDarkTheme={isDarkTheme}
                            />
                            <StatCard
                                icon={MessageSquare}
                                label="Chats / Bot"
                                value={stats?.avg_convo_bot || 0}
                                color="pink"
                                isRatio
                                trend={-1}
                                className="flex-1"
                                isDarkTheme={isDarkTheme}
                            />
                        </div>
                    </div>

                    {/* Tables Tabbed Area */}
                    <div className={`rounded-[18px] border transition-all duration-300 overflow-hidden ${isDarkTheme ? 'bg-[rgba(13,17,23,0.6)] backdrop-blur-md border-slate-800 shadow-none' : 'bg-white border-slate-100 shadow-sm'}`}>
                        <div className={`px-8 py-2 border-b flex items-center justify-between ${isDarkTheme ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/20 border-slate-50'}`}>
                            <div className="flex space-x-6">
                                <button
                                    onClick={() => setActiveTable('users')}
                                    className={`py-4 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeTable === 'users' ? (isDarkTheme ? 'text-white' : 'opacity-100') : 'text-slate-400 hover:text-slate-600'}`}
                                    style={activeTable === 'users' && !isDarkTheme ? { color: brandColor } : {}}
                                >
                                    Hoạt động thành viên
                                    {activeTable === 'users' && <div className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full" style={{ backgroundColor: brandColor }} />}
                                </button>
                                {!selectedBotId && (
                                    <button
                                        onClick={() => setActiveTable('bots')}
                                        className={`py-4 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeTable === 'bots' ? (isDarkTheme ? 'text-white' : 'opacity-100') : 'text-slate-400 hover:text-slate-600'}`}
                                        style={activeTable === 'bots' && !isDarkTheme ? { color: brandColor } : {}}
                                    >
                                        Chi tiết AI Bot
                                        {activeTable === 'bots' && <div className="absolute bottom-0 left-0 right-0 h-1 rounded-t-full" style={{ backgroundColor: brandColor }} />}
                                    </button>
                                )}
                            </div>
                        </div>

                        {activeTable === 'users' ? (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead>
                                            <tr className={`text-[10px] font-black uppercase tracking-widest border-b ${isDarkTheme ? 'bg-slate-900/30 text-slate-400 border-slate-800' : 'bg-slate-50/50 text-slate-400 border-slate-100'}`}>
                                                <th className="px-8 py-4">Thành viên</th>
                                                <th className="px-8 py-4 text-center">Hành động</th>
                                                <th className="px-8 py-4 text-center">AI Bot</th>
                                                <th className="px-8 py-4 text-center">Hội thoại</th>
                                                <th className="px-8 py-4">Vai trò</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${isDarkTheme ? 'divide-slate-800' : 'divide-slate-50'}`}>
                                            {userStats.length > 0 ? userStats.map(u => (
                                                <tr
                                                    key={u.id}
                                                    className={`transition-colors group cursor-pointer ${isDarkTheme ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/80'}`}
                                                    onClick={() => onEditMember?.(Number(u.id))}
                                                >
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center font-black transition-colors ${isDarkTheme ? 'bg-slate-800 text-slate-500 group-hover:bg-blue-500/20 group-hover:text-blue-400' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-500'}`}>
                                                                {u.full_name?.[0]?.toUpperCase() || 'U'}
                                                            </div>
                                                            <div>
                                                                <div className={`font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{u.full_name}</div>
                                                                <div className="text-[10px] text-slate-400 font-medium">{u.email}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        <div className="inline-flex flex-col items-center">
                                                            <span className={`text-lg font-black tabular-nums ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{u.action_count}</span>
                                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">Thao tác</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        <div className="inline-flex flex-col items-center">
                                                            <span className={`text-lg font-black tabular-nums ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{u.bot_count}</span>
                                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">Bots</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        <div className="inline-flex flex-col items-center">
                                                            <span className={`text-lg font-black tabular-nums ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{u.convo_count}</span>
                                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">Chats</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${u.role === 'admin' ? (isDarkTheme ? 'bg-[var(--color-primary)]/10 text-orange-400 border-[var(--color-primary)]/20' : 'bg-orange-50 text-[var(--color-primary)] border-orange-100') : (isDarkTheme ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-100')}`}>
                                                            {u.role}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={5} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                                        Không có dữ liệu thành viên
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className={`p-6 border-t flex justify-between items-center ${isDarkTheme ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/30 border-slate-50'}`}>
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                        Trang {userPage} / {userTotalPages}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            disabled={userPage === 1}
                                            onClick={() => fetchUserStats(userPage - 1)}
                                            className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            Trước
                                        </button>
                                        <button
                                            disabled={userPage === userTotalPages}
                                            onClick={() => fetchUserStats(userPage + 1)}
                                            className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            Sau
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead>
                                            <tr className={`text-[10px] font-black uppercase tracking-widest border-b ${isDarkTheme ? 'bg-slate-900/40 text-slate-400 border-slate-800' : 'bg-slate-50/50 text-slate-400 border-slate-100'}`}>
                                                <th className="px-8 py-4">AI Bot</th>
                                                <th className="px-8 py-4 text-center">Hội thoại</th>
                                                <th className="px-8 py-4 text-center">Dữ liệu huấn luyện</th>
                                                <th className="px-8 py-4">Trạng thái</th>
                                            </tr>
                                        </thead>
                                        <tbody className={`divide-y ${isDarkTheme ? 'divide-slate-800' : 'divide-slate-50'}`}>
                                            {botStats.length > 0 ? botStats.map(b => (
                                                <tr
                                                    key={b.id}
                                                    className={`transition-colors group cursor-pointer ${isDarkTheme ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50/80'}`}
                                                    onClick={() => setSelectedBotId(b.id)}
                                                >
                                                    <td className="px-8 py-5">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center font-black transition-colors ${isDarkTheme ? 'bg-slate-800 text-slate-500 group-hover:bg-purple-500/20 group-hover:text-purple-400' : 'bg-slate-100 text-slate-400 group-hover:bg-purple-50 group-hover:text-purple-500'}`}>
                                                                {b.name?.[0]?.toUpperCase() || 'B'}
                                                            </div>
                                                            <div>
                                                                <div className={`font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{b.name}</div>
                                                                <div className="text-[10px] text-slate-400 font-medium">ID: #{b.id}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        <div className="inline-flex flex-col items-center">
                                                            <span className={`text-lg font-black tabular-nums ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>
                                                                {b.convo_count || 0}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">Hội thoại</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5 text-center">
                                                        <div className="inline-flex flex-col items-center">
                                                            <span className={`text-lg font-black tabular-nums ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>
                                                                {b.doc_count || 0}
                                                            </span>
                                                            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">Tài liệu</span>

                                                        </div>
                                                    </td>
                                                    <td className="px-8 py-5">
                                                        <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${(Number(b.is_enabled) === 1 || Number(b.ai_enabled) === 1) ? (isDarkTheme ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-100') : (isDarkTheme ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-50 text-slate-400 border-slate-100')}`}>
                                                            {(Number(b.is_enabled) === 1 || Number(b.ai_enabled) === 1) ? 'ACTIVE' : 'INACTIVE'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            )) : (
                                                <tr>
                                                    <td colSpan={4} className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest text-[10px]">
                                                        Không có dữ liệu Bot
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className={`p-6 border-t flex justify-between items-center ${isDarkTheme ? 'bg-slate-800/30 border-slate-800' : 'bg-slate-50/30 border-slate-50'}`}>
                                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                        Trang {botPage} / {botTotalPages}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            disabled={botPage === 1}
                                            onClick={() => fetchBotActivityStats(botPage - 1)}
                                            className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            Trước
                                        </button>
                                        <button
                                            disabled={botPage === botTotalPages}
                                            onClick={() => fetchBotActivityStats(botPage + 1)}
                                            className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                                        >
                                            Sau
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div >
                </div >
            ) : (
                <div className={`rounded-[18px] border shadow-sm overflow-hidden ${isDarkTheme ? 'bg-slate-800/20 border-slate-700 shadow-none' : 'bg-white border-slate-100'}`}>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className={`text-[10px] font-black uppercase tracking-widest border-b ${isDarkTheme ? 'bg-slate-800/50 text-slate-400 border-slate-700' : 'bg-slate-50/50 text-slate-400 border-slate-100'}`}>
                                    <th className="px-6 py-4">Thời gian</th>
                                    <th className="px-6 py-4">Admin</th>
                                    <th className="px-6 py-4">Hành động</th>
                                    <th className="px-6 py-4">Đối tượng</th>
                                    <th className="px-6 py-4">Chi tiết</th>
                                    <th className="px-6 py-4">IP Address</th>
                                </tr>
                            </thead>
                            <tbody className={`divide-y ${isDarkTheme ? 'divide-slate-800' : 'divide-slate-50'}`}>
                                {logs.map(log => (
                                    <tr
                                        key={log.id}
                                        className={`transition-colors group cursor-pointer ${isDarkTheme ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50/80'}`}
                                        onClick={() => onEditMember?.(Number(log.admin_id))}
                                    >
                                        <td className="px-6 py-4 text-[11px] font-bold text-slate-500">
                                            {format(new Date(log.created_at), 'dd/MM/yyyy')}
                                            <div className="text-[10px] font-medium text-slate-300">{format(new Date(log.created_at), 'HH:mm:ss')}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`font-bold ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>{log.admin_name}</div>
                                            <div className="text-[10px] text-slate-400 font-medium">{log.admin_email}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <BadgeAction action={log.action} isDarkTheme={isDarkTheme} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md mr-2 ${isDarkTheme ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-400'}`}>{log.target_type}</span>
                                            <span className={`text-[11px] font-bold ${isDarkTheme ? 'text-slate-300' : 'text-slate-600'}`}>#{log.target_id}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`text-[11px] max-w-[200px] truncate cursor-help p-2 rounded-lg border transition-colors ${isDarkTheme ? 'text-slate-400 bg-slate-800/40 border-slate-700 group-hover:bg-slate-800' : 'text-slate-500 bg-slate-50 border-slate-100 group-hover:bg-white'}`} title={JSON.stringify(log.details, null, 2)}>
                                                {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                            </div>
                                        </td>
                                        <td className={`px-6 py-4 font-mono text-[10px] font-bold ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>{log.ip_address}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className={`p-6 border-t flex justify-between items-center ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-slate-50/30 border-slate-50'}`}>
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                            Trang {page} / {totalPages}
                        </div>
                        <div className="flex gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => fetchLogs(page - 1)}
                                className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                                Trước
                            </button>
                            <button
                                disabled={page === totalPages}
                                onClick={() => fetchLogs(page + 1)}
                                className={`px-4 py-2 rounded-xl border text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-sm ${isDarkTheme ? 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                                Sau
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
};

// Helper Components
const CustomDropdown = ({ icon: Icon, label, children, isOpen, onToggle, onClose, isDarkTheme }: any) => {
    return (
        <div className="relative">
            <button
                onClick={onToggle}
                className={`flex items-center gap-2.5 border rounded-xl px-4 py-2 shadow-sm transition-all duration-200 group ${isOpen ? 'ring-2 ring-slate-100 border-slate-300' : ''} ${isDarkTheme ? 'bg-black/40 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
            >
                <div className={`transition-colors ${isDarkTheme ? 'text-slate-500 group-hover:text-blue-400' : 'text-slate-400 group-hover:text-blue-500'}`}>
                    <Icon size={14} />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isDarkTheme ? 'text-slate-200' : 'text-slate-600'}`}>{label}</span>
                <ChevronDown size={12} className={`text-slate-300 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={onClose} />
                    <div className={`absolute top-full right-0 mt-2 w-48 border rounded-[14px] shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in duration-150 origin-top-right ${isDarkTheme ? 'bg-slate-900/90 backdrop-blur-xl border-slate-800 shadow-black/40' : 'bg-white border-slate-100 shadow-slate-200/40'}`}>
                        {children}
                    </div>
                </>
            )}
        </div>
    );
};

const StatCard = ({ icon: Icon, label, value, color, isRatio, trend, className, isDarkTheme }: any) => {
    const isHighlight = color === 'orange' || color === 'pink' || color === 'rose';
    const iconBg = isHighlight
        ? (isDarkTheme ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-[#C6333D] border border-red-200')
        : (isDarkTheme ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-slate-100 text-slate-700 border border-slate-200');
    const textAccent = isHighlight
        ? (isDarkTheme ? 'text-red-400' : 'text-[#C6333D]')
        : (isDarkTheme ? 'text-slate-300' : 'text-slate-700');

    return (
        <div className={`p-5 rounded-[16px] border transition-all duration-200 flex flex-col group relative overflow-hidden h-full ${className || ''} ${isDarkTheme ? 'bg-[rgba(13,17,23,0.6)] backdrop-blur-md border-slate-800 shadow-none' : 'bg-white border-slate-200 shadow-xs hover:shadow-md'}`}>
            <div className={`flex items-center space-x-3 ${isRatio ? 'mb-3' : 'mb-5'}`}>
                <div className={`p-2 rounded-lg transition-transform duration-300 ${iconBg}`}>
                    <Icon size={isRatio ? 18 : 20} />
                </div>
                <p className={`text-[10px] font-bold uppercase tracking-wider leading-tight ${isRatio ? 'max-w-[70px]' : ''} ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>{label}</p>
            </div>

            <div className="mt-auto flex items-end justify-between gap-3">
                <div>
                    <p className={`${isRatio ? 'text-2xl' : 'text-3xl'} font-bold tabular-nums leading-none tracking-tight ${isDarkTheme ? 'text-slate-200' : 'text-[var(--color-text)] dark:text-slate-100'}`}>
                        {typeof value === 'number' ? value.toLocaleString() : value}
                    </p>
                    {isRatio && (
                        <div className="flex items-center gap-1 mt-2">
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${trend > 0 ? (isDarkTheme ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600') : (isDarkTheme ? 'bg-slate-800 text-slate-500' : 'bg-slate-50 text-slate-400')}`}>
                                {trend > 0 ? `+${trend}%` : 'Ổn định'}
                            </span>
                        </div>
                    )}
                </div>

                {isRatio && (
                    <div className="w-11 h-11 relative flex items-center justify-center flex-shrink-0">
                        <svg className="w-full h-full transform -rotate-90 opacity-60">
                            <circle cx="22" cy="22" r="19" fill="transparent" stroke="currentColor" strokeWidth="2.5" className={isDarkTheme ? 'text-slate-800' : 'text-slate-50'} />
                            <circle
                                cx="22" cy="22" r="19"
                                fill="transparent"
                                stroke="currentColor"
                                strokeWidth="3.5"
                                strokeDasharray={119}
                                strokeDashoffset={119 - (Math.min(value * 10, 100) / 100) * 119}
                                className={textAccent}
                                strokeLinecap="round"
                            />
                        </svg>
                        <span className={`absolute text-[9px] font-bold ${textAccent}`}>{value}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

const BadgeAction = ({ action, isDarkTheme }: { action: string; isDarkTheme?: boolean }) => {
    let color = isDarkTheme ? 'bg-white/5 text-slate-400 border-slate-800' : 'bg-slate-100 text-slate-600 border-slate-200';
    if (action.includes('create')) color = isDarkTheme ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (action.includes('delete')) color = isDarkTheme ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-rose-50 text-rose-700 border-rose-100';
    if (action.includes('update')) color = isDarkTheme ? 'bg-[var(--color-primary)]/10 text-amber-400 border-[var(--color-primary)]/20' : 'bg-amber-50 text-[#9A1523] border-amber-100';
    if (action.includes('train')) color = isDarkTheme ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border-indigo-100';

    return (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${color}`}>
            {action.replace('_', ' ')}
        </span>
    );
}

const HeatmapGrid = ({ data, metricLabel, isDarkTheme }: { data: any[], metricLabel: string; isDarkTheme?: boolean }) => {
    const today = new Date();
    const daysToDisplay = 35;
    const dates = [];
    for (let i = daysToDisplay - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        dates.push(d.toISOString().split('T')[0]);
    }

    const getLevel = (date: string) => {
        const entry = data.find(d => d.date === date);
        const count = entry ? entry.count : 0;
        if (count === 0) return isDarkTheme ? 'bg-slate-800/40' : 'bg-slate-100';
        if (count < 5) return 'bg-emerald-500/20';
        if (count < 10) return 'bg-emerald-500/40';
        if (count < 20) return 'bg-emerald-500/70';
        return 'bg-emerald-600';
    };

    const getCount = (date: string) => {
        const entry = data.find(d => d.date === date);
        return entry ? parseInt(entry.count) : 0;
    }

    return (
        <div className={`grid grid-cols-7 gap-1.5 p-2 rounded-[14px] border ${isDarkTheme ? 'bg-black/20 border-slate-800' : 'bg-slate-50/50 border-slate-100'}`}>
            {dates.map(date => (
                <div key={date} className="group relative">
                    <div
                        className={`w-6 h-6 md:w-8 md:h-8 rounded-[4px] ${getLevel(date)} transition-all hover:scale-110 shadow-sm cursor-pointer`}
                    ></div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900/90 backdrop-blur-sm text-white text-[10px] font-bold px-3 py-1.5 rounded-lg whitespace-nowrap z-20 shadow-xl pointer-events-none">
                        <div className="text-slate-400 text-[8px] uppercase tracking-tighter mb-0.5">{date}</div>
                        {getCount(date)} {metricLabel}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900/90"></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default React.memo(AdminLogsTab);
