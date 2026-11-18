import * as React from 'react';
import { useMemo, useState } from 'react';
import { Users, Zap, Eye, Clock, TrendingUp, BarChart2, Activity, Info, Table, BookOpen } from 'lucide-react';
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import Modal from '../../common/Modal';
import StatCard from '../../common/StatCard';
import { WebStats } from '../types';

interface GeneralTabContentProps {
    stats: WebStats | null;
    formatDuration: (seconds: number) => string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="bg-white/95 backdrop-blur-md p-3 rounded-[12px] border border-slate-200 shadow-xl text-xs space-y-1.5 font-sans min-w-[160px]">
            <p className="font-bold text-slate-700 border-b border-slate-100 pb-1 mb-1">{label}</p>
            {payload.map((entry: any, index: number) => {
                const isSessions = entry.dataKey === 'sessions';
                const name = isSessions ? 'Phiên truy cập' : 'Lượt xem trang';
                const color = entry.stroke || (isSessions ? '#BD1D2D' : '#334155');
                const valFormatted = new Intl.NumberFormat('vi-VN').format(entry.value);
                return (
                    <div key={`item-${index}`} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-slate-600 font-medium">
                            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: color }} />
                            {name}:
                        </span>
                        <strong className="text-slate-900 font-bold tabular-nums" style={{ color: isSessions ? '#BD1D2D' : '#0f172a' }}>
                            {valFormatted}
                        </strong>
                    </div>
                );
            })}
        </div>
    );
};

const GeneralTabContent: React.FC<GeneralTabContentProps> = ({ stats, formatDuration }) => {
    const [isBounceInfoOpen, setIsBounceInfoOpen] = useState(false);

    const chartData = useMemo(() => {
        if (!stats?.chart || !Array.isArray(stats.chart)) return [];
        return stats.chart.map(item => ({
            date: item.date,
            sessions: Number(item.sessions || 0),
            pageViews: Number(item.pageViews || 0)
        }));
    }, [stats?.chart]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {!stats ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard loading title="Unique Visitors" value={0} icon={<Users />} color="#C6333D" />
                        <StatCard loading title="Total Sessions" value={0} icon={<Zap />} color="#0f172a" />
                        <StatCard loading title="Page Views" value={0} icon={<Eye />} color="#334155" />
                        <StatCard loading title="Bounce Rate" value={0} icon={<Activity />} color="#64748b" />
                    </div>
                    <div className="bg-[var(--color-surface)] p-6 rounded-[var(--radius-lg)] h-[380px] border border-[var(--color-border)] animate-pulse" />
                </div>
            ) : (
                <>
                    {/* 4-Card KPI StatGrid in ONE row */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="Unique Visitors"
                            value={(stats.overview.visitors || 0).toLocaleString('vi-VN')}
                            icon={<Users />}
                            color="#C6333D"
                            breakdown={<span>Người dùng mới: <b className="tabular-nums">{(stats.overview.newUsers ?? 0).toLocaleString('vi-VN')}</b></span>}
                        />
                        <StatCard
                            title="Total Sessions"
                            value={(stats.overview.sessions || 0).toLocaleString('vi-VN')}
                            icon={<Zap />}
                            color="#0f172a"
                            breakdown={
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                    TB: <b className="tabular-nums">{formatDuration(Math.floor(stats.overview.avgDuration || 0))}</b> / phiên
                                </span>
                            }
                        />
                        <StatCard
                            title="Page Views"
                            value={(stats.overview.pageViews || 0).toLocaleString('vi-VN')}
                            icon={<Eye />}
                            color="#334155"
                            breakdown={
                                <span className="tabular-nums">
                                    {stats.overview.sessions > 0
                                        ? `${(stats.overview.pageViews / stats.overview.sessions).toFixed(1)} trang / phiên`
                                        : 'Tổng lượt xem trang'}
                                </span>
                            }
                        />
                        <StatCard
                            title="Bounce Rate"
                            value={`${(stats.overview.bounceRate || 0).toFixed(1)}%`}
                            icon={<Activity />}
                            color="#64748b"
                            onClick={() => setIsBounceInfoOpen(true)}
                            breakdown={
                                <span className="inline-flex items-center gap-1.5 tabular-nums">
                                    <span>{(stats.overview.bounces || 0).toLocaleString('vi-VN')} / {(stats.overview.sessions || 0).toLocaleString('vi-VN')} phiên</span>
                                    <Info className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                                </span>
                            }
                        />
                    </div>

                    <Modal
                        isOpen={isBounceInfoOpen}
                        onClose={() => setIsBounceInfoOpen(false)}
                        title={
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-rose-50 text-[#BD1D2D] rounded-xl">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <span className="text-xl font-bold text-slate-900">Về Tỷ lệ thoát (Bounce Rate)</span>
                            </div>
                        }
                        size="xl"
                    >
                        <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl relative overflow-hidden">
                                <h4 className="flex items-center gap-2 font-bold text-lg mb-3 text-slate-900 relative">
                                    <div className="p-2 bg-[#BD1D2D] text-white rounded-xl">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    Bounce Rate là gì?
                                </h4>
                                <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                    Bounce rate hay Tỷ lệ thoát là phần trăm số lượt truy cập trang web chỉ xem duy nhất một trang và rời đi ngay lập tức mà không có thêm tương tác nào khác (như nhấn vào link hoặc xem trang thứ hai). Nó đo lường mức độ tương tác và tính hấp dẫn của trang đích.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
                                    <h5 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                                            <TrendingUp className="w-4 h-4" />
                                        </div>
                                        Tỷ lệ bao nhiêu là tốt?
                                    </h5>
                                    <p className="text-xs text-slate-600 leading-relaxed font-medium mb-4">
                                        Không có con số "chuẩn" cho mỗi lĩnh vực. Tỷ lệ thoát phụ thuộc rất lớn vào loại trang web và mục đích của trang.
                                    </p>
                                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
                                        "Ví dụ: Một trang blog trả lời đúng câu hỏi người dùng tìm kiếm có thể có tỷ lệ thoát 90%+ nhưng vẫn là chất lượng tốt."
                                    </div>
                                </div>

                                <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-xs">
                                    <h5 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                                        <div className="w-8 h-8 bg-slate-100 text-slate-700 rounded-lg flex items-center justify-center">
                                            <Table className="w-4 h-4" />
                                        </div>
                                        Trung bình theo ngành
                                    </h5>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Bán lẻ / TMĐT', range: '20% - 40%', color: 'text-emerald-600' },
                                            { label: 'Dịch vụ', range: '10% - 30%', color: 'text-emerald-600' },
                                            { label: 'Tạo Khách hàng tiềm năng', range: '30% - 50%', color: 'text-slate-800' },
                                            { label: 'Nội dung (Content site)', range: '40% - 60%', color: 'text-[var(--color-primary)]' },
                                            { label: 'Blog / Landing Page', range: '70% - 90%', color: 'text-[#BD1D2D]' }
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs font-semibold py-2 border-b border-slate-100 last:border-0">
                                                <span className="text-slate-600">{item.label}</span>
                                                <span className={`${item.color} tabular-nums`}>{item.range}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Modal>

                    {/* Chart Section - Enhanced */}
                    <div className="bg-white p-6 rounded-[16px] border border-[#E2E8F0] shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-[rgba(189,29,45,0.08)] text-[#BD1D2D] flex items-center justify-center">
                                        <BarChart2 className="w-4 h-4" />
                                    </div>
                                    Thống kê lưu lượng truy cập
                                </h3>
                                <p className="text-xs text-slate-500 mt-1 font-medium ml-10">Số lượng phiên truy cập và lượt xem trang theo thời gian</p>
                            </div>
                        </div>
                        <div className="min-h-[350px] bg-white rounded-xl p-2 border border-slate-100">
                            {chartData.length > 0 ? (
                                <div className="w-full h-[350px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart
                                            data={chartData}
                                            margin={{ top: 10, right: 15, left: 0, bottom: 5 }}
                                        >
                                            <defs>
                                                <linearGradient id="sessionsGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#BD1D2D" stopOpacity={0.28} />
                                                    <stop offset="95%" stopColor="#BD1D2D" stopOpacity={0.01} />
                                                </linearGradient>
                                                <linearGradient id="pageViewsGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#334155" stopOpacity={0.22} />
                                                    <stop offset="95%" stopColor="#334155" stopOpacity={0.01} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                tickLine={false}
                                                axisLine={{ stroke: '#e2e8f0' }}
                                                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                                                tickFormatter={(d: string) => {
                                                    const parts = String(d).split('-');
                                                    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : d;
                                                }}
                                            />
                                            <YAxis
                                                tickLine={false}
                                                axisLine={false}
                                                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                                                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                                            />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Legend
                                                verticalAlign="top"
                                                align="right"
                                                wrapperStyle={{ paddingBottom: '16px', fontSize: '12px', fontWeight: 700 }}
                                                formatter={(value: string) => (value === 'sessions' ? 'Phiên truy cập' : (value === 'pageViews' ? 'Lượt xem trang' : value))}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="sessions"
                                                name="sessions"
                                                stroke="#BD1D2D"
                                                strokeWidth={2.5}
                                                fillOpacity={1}
                                                fill="url(#sessionsGradient)"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="pageViews"
                                                name="pageViews"
                                                stroke="#334155"
                                                strokeWidth={2.5}
                                                fillOpacity={1}
                                                fill="url(#pageViewsGradient)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-sm gap-3">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                        <BarChart2 className="w-8 h-8 opacity-20" />
                                    </div>
                                    <p className="font-bold">Chưa có dữ liệu biểu đồ cho khoảng thời gian này</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default GeneralTabContent;
