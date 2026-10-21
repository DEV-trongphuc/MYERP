import * as React from 'react';
import { useMemo, useState } from 'react';
import { Users, Zap, Eye, Clock, TrendingUp, BarChart2, Activity, Info, Table, BookOpen } from 'lucide-react';
import Modal from '../../common/Modal';
import StatCard from '../../common/StatCard';
import Chart from '../../../shims/apexCharts';
import type { ApexOptions } from '../../../shims/apexCharts';
import { WebStats } from '../types';

interface GeneralTabContentProps {
    stats: WebStats | null;
    formatDuration: (seconds: number) => string;
}

const GeneralTabContent: React.FC<GeneralTabContentProps> = ({ stats, formatDuration }) => {
    const [isBounceInfoOpen, setIsBounceInfoOpen] = useState(false);
    const chartOptions: ApexOptions = useMemo(() => ({
        chart: {
            type: 'area',
            toolbar: { show: false },
            zoom: { enabled: false },
            fontFamily: 'Inter, system-ui, sans-serif',
            animations: {
                enabled: true,
                easing: 'easeinout',
                speed: 800,
                animateGradually: { enabled: true, delay: 150 }
            },
            background: 'transparent'
        },
        dataLabels: { enabled: false },
        stroke: {
            curve: 'smooth',
            width: [2.5, 2.5],
            lineCap: 'round',
            dashArray: [0, 0]
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.35,
                opacityTo: 0.05,
                stops: [0, 90, 100]
            }
        },
        xaxis: {
            categories: stats?.chart.map(c => c.date) || [],
            labels: {
                style: {
                    colors: '#94a3b8',
                    fontSize: '10px',
                    fontWeight: 600,
                    fontFamily: 'Inter, system-ui, sans-serif'
                },
                offsetY: 2,
                rotate: 0
            },
            axisBorder: { show: false },
            axisTicks: { show: false },
            tooltip: { enabled: false }
        },
        yaxis: {
            labels: {
                style: {
                    colors: '#94a3b8',
                    fontSize: '10px',
                    fontWeight: 600,
                    fontFamily: 'Inter, system-ui, sans-serif'
                },
                formatter: (val) => val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toString()
            }
        },
        grid: {
            borderColor: '#f1f5f9',
            strokeDashArray: 3,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: true } },
            padding: { top: 10, right: 15, bottom: 5, left: 5 }
        },
        colors: ['#C6333D', '#334155'],
        legend: {
            show: true,
            position: 'top',
            horizontalAlign: 'right',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            itemMargin: { horizontal: 12, vertical: 0 },
            markers: {
                radius: 12,
                width: 10,
                height: 10,
                offsetY: 0,
                strokeWidth: 0
            },
            labels: {
                colors: '#475569'
            }
        },
        tooltip: {
            theme: 'light',
            style: { fontSize: '11px', fontFamily: 'Inter, system-ui, sans-serif' },
            x: { show: true },
            y: {
                formatter: (val) => val.toLocaleString(),
                title: {
                    formatter: (seriesName) => seriesName + ':'
                }
            },
            marker: { show: true }
        }
    }), [stats]);

    const chartSeries = useMemo(() => [
        { name: 'Sessions', data: stats?.chart.map(c => c.sessions) || [] },
        { name: 'Page Views', data: stats?.chart.map(c => c.pageViews) || [] }
    ], [stats]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
            {!stats ? (
                <div className="space-y-6">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard loading title="Unique Visitors" value={0} icon={<Users />} color="#a31422" />
                        <StatCard loading title="Total Sessions" value={0} icon={<Zap />} color="#3b82f6" />
                        <StatCard loading title="Page Views" value={0} icon={<Eye />} color="#10b981" />
                        <StatCard loading title="Bounce Rate" value={0} icon={<Activity />} color="#f59e0b" />
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
                            color="#a31422"
                            breakdown={<span>Người dùng mới: <b>{(stats.overview.newUsers ?? 0).toLocaleString('vi-VN')}</b></span>}
                        />
                        <StatCard
                            title="Total Sessions"
                            value={(stats.overview.sessions || 0).toLocaleString('vi-VN')}
                            icon={<Zap />}
                            color="#3b82f6"
                            breakdown={
                                <span className="inline-flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                    TB: <b>{formatDuration(Math.floor(stats.overview.avgDuration || 0))}</b> / phiên
                                </span>
                            }
                        />
                        <StatCard
                            title="Page Views"
                            value={(stats.overview.pageViews || 0).toLocaleString('vi-VN')}
                            icon={<Eye />}
                            color="#10b981"
                            breakdown={
                                <span>
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
                            color="#f59e0b"
                            onClick={() => setIsBounceInfoOpen(true)}
                            breakdown={
                                <span className="inline-flex items-center gap-1.5">
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
                                <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <span className="text-xl font-black text-slate-800 tracking-tight">Về Tỷ lệ thoát (Bounce Rate)</span>
                            </div>
                        }
                        size="xl"
                    >
                        <div className="space-y-8 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="p-8 bg-slate-50 border border-slate-100 rounded-[18px] relative overflow-hidden group">
                                <h4 className="flex items-center gap-2 font-black text-lg mb-4 text-slate-800 relative">
                                    <div className="p-2 bg-rose-600 text-white rounded-xl">
                                        <BookOpen className="w-5 h-5" />
                                    </div>
                                    Bounce Rate là gì?
                                </h4>
                                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                                    Bounce rate hay Tỷ lệ thoát là phần trăm số lượt truy cập trang web chỉ xem duy nhất một trang và rời đi ngay lập tức mà không có thêm tương tác nào khác (như nhấn vào link hoặc xem trang thứ hai). Nó đo lường mức độ tương tác và tính hấp dẫn của trang đích.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="p-8 bg-white border border-slate-100 rounded-[18px] shadow-sm">
                                    <h5 className="font-black text-slate-800 mb-6 flex items-center gap-2">
                                        <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                                            <TrendingUp className="w-4 h-4" />
                                        </div>
                                        Tỷ lệ bao nhiêu là tốt?
                                    </h5>
                                    <p className="text-xs text-slate-500 leading-relaxed font-medium mb-4">
                                        Không có con số "chuẩn" cho mỗi lĩnh vực. Tỷ lệ thoát phụ thuộc rất lớn vào loại trang web và mục đích của trang.
                                    </p>
                                    <div className="p-4 bg-orange-50 border border-orange-100 rounded-[14px] italic text-[11px] text-orange-800 font-bold">
                                        "Ví dụ: Một trang blog trả lời đúng câu hỏi người dùng tìm kiếm có thể có tỷ lệ thoát 90%+ nhưng vẫn là chất lượng tốt."
                                    </div>
                                </div>

                                <div className="p-8 bg-white border border-slate-100 rounded-[18px] shadow-sm">
                                    <h5 className="font-black text-slate-800 mb-6 flex items-center gap-2">
                                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                            <Table className="w-4 h-4" />
                                        </div>
                                        Trung bình theo ngành
                                    </h5>
                                    <div className="space-y-3">
                                        {[
                                            { label: 'Bán lẻ / TMĐT', range: '20% - 40%', color: 'text-emerald-500' },
                                            { label: 'Dịch vụ', range: '10% - 30%', color: 'text-emerald-500' },
                                            { label: 'Tạo Khách hàng tiềm năng', range: '30% - 50%', color: 'text-blue-500' },
                                            { label: 'Nội dung (Content site)', range: '40% - 60%', color: 'text-[var(--color-primary)]' },
                                            { label: 'Blog / Landing Page', range: '70% - 90%', color: 'text-rose-500' }
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center justify-between text-[11px] font-bold py-2 border-b border-slate-50 last:border-0">
                                                <span className="text-slate-500">{item.label}</span>
                                                <span className={item.color}>{item.range}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Modal>

                    {/* Chart Section - Enhanced */}
                    <div className="bg-gradient-to-br from-white to-slate-50/30 p-6 rounded-[18px] border border-slate-200/60 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.08)]">
                        <div className="flex items-center justify-between mb-5">
                            <div>
                                <h3 className="text-base font-black text-slate-800 flex items-center gap-2.5 tracking-tight">
                                    <div className="p-2 bg-gradient-to-br from-indigo-500 to-blue-600 text-white rounded-xl shadow-lg shadow-indigo-500/30">
                                        <BarChart2 className="w-4 h-4" />
                                    </div>
                                    Traffic Trend Analytics
                                </h3>
                                <p className="text-[10px] text-slate-500 mt-1.5 font-semibold ml-11">Thống kê lưu lượng truy cập theo Thời gian</p>
                            </div>
                        </div>
                        <div className="min-h-[350px] bg-white rounded-[14px] p-4 border border-slate-100">
                            {stats?.chart && stats.chart.length > 0 ? (
                                <Chart options={chartOptions} series={chartSeries} type="area" height={350} />
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-sm gap-3">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                        <BarChart2 className="w-8 h-8 opacity-20" />
                                    </div>
                                    <p className="font-bold">Chưa có dữ liệu biểu đồ cho khoảng Thời gian này</p>
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
