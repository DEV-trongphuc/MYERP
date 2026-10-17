import React from 'react';
import {
    Users, CheckCircle2, Mail, MailOpen, AlertOctagon, UserMinus, Activity,
    MousePointerClick, TrendingUp, BarChart3
} from 'lucide-react';
import Modal from '../../common/Modal';
import { Flow, FlowStats } from '../../../types';

interface FlowSummaryModalProps {
    isOpen: boolean;
    onClose: () => void;
    flow: Flow;
    stats: FlowStats;
}

const FlowSummaryModal: React.FC<FlowSummaryModalProps> = ({ isOpen, onClose, flow, stats }) => {
    if (!isOpen) return null;

    const enrolled = stats.enrolled || 0;
    const completed = stats.completed || 0;
    const completionRate = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;

    const totalSent = stats.totalSent || 0;
    const totalOpened = stats.totalOpened || 0;
    const combinedClicked = (stats.totalClicked || 0) + (stats.totalZaloClicked || 0);
    const combinedUniqueClicked = (stats.uniqueClicked || 0) + (stats.uniqueZaloClicked || 0);
    const openRate =
        stats.openRate != null
            ? Math.round(stats.openRate * 100)
            : totalSent > 0
            ? Math.round((totalOpened / totalSent) * 100)
            : 0;

    const StatCard = ({ label, value, icon: Icon, color, subValue }: any) => {
        const hexColor = (() => {
            const cStr = String(color).toLowerCase();
            if (cStr.includes('blue') || cStr.includes('indigo')) return '#3b82f6';
            if (cStr.includes('emerald') || cStr.includes('teal')) return '#10b981';
            if (cStr.includes('orange') || cStr.includes('amber') || cStr.includes('red')) return '#f59e0b';
            if (cStr.includes('rose') || cStr.includes('pink')) return '#ec4899';
            if (cStr.includes('violet') || cStr.includes('purple') || cStr.includes('cyan')) return '#8b5cf6';
            return '#64748b';
        })();

        const decorSvg = (() => {
            if (hexColor === '#10b981') {
                return (
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <rect x="20" y="20" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.6" />
                        <rect x="20" y="42" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.4" />
                        <rect x="20" y="64" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.2" />
                    </svg>
                );
            }
            if (hexColor === '#ec4899') {
                return (
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
                        <path d="M50 35 V 65 M35 50 H 65" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                );
            }
            if (hexColor === '#3b82f6') {
                return (
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <path d="M10 50 Q 50 10 90 50 T 90 90" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" />
                        <circle cx="10" cy="50" r="6" fill="currentColor" />
                        <circle cx="50" cy="10" r="6" fill="currentColor" />
                        <circle cx="90" cy="50" r="6" fill="currentColor" />
                        <path d="M50 10 L 90 50" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                );
            }
            return (
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                    <circle cx="35" cy="45" r="15" fill="currentColor" fillOpacity="0.2" />
                    <circle cx="65" cy="45" r="15" fill="currentColor" fillOpacity="0.4" />
                    <circle cx="50" cy="70" r="18" fill="currentColor" fillOpacity="0.6" />
                </svg>
            );
        })();

        return (
            <div className="bg-white dark:bg-slate-900 p-5 md:p-6 rounded-[14px] border border-slate-100/70 dark:border-slate-800/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between group hover:shadow-[0_12px_36px_rgba(0,0,0,0.035)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden min-h-[145px] cursor-pointer">
                {decorSvg && (
                    <div className="decor-svg" style={{ color: hexColor }}>
                        {decorSvg}
                    </div>
                )}
                <div className="relative z-10 flex flex-col justify-between h-full w-full">
                    <div>
                        <div className="flex justify-between items-center mb-3.5">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">
                                {label}
                            </p>
                            <div
                                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 relative z-10"
                                style={{ backgroundColor: `${hexColor}15`, color: hexColor }}
                            >
                                <Icon className="w-4 h-4" />
                            </div>
                        </div>
                        <h4 className="text-xl md:text-2xl font-black text-slate-850 dark:text-slate-100 tracking-tight leading-none mb-2.5">
                            {value.toLocaleString()}
                        </h4>
                    </div>
                    {subValue && (
                        <div className="mt-2 text-[10px] font-bold text-slate-450 dark:text-slate-500">
                            {subValue}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="2xl"
            title={
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-900 rounded-[14px] flex items-center justify-center text-white shadow-xl">
                        <BarChart3 className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                            Tổng quan hiệu suất
                        </h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{flow.name}</p>
                    </div>
                </div>
            }
            footer={
                <div className="flex justify-between items-center w-full">
                    <p className="text-[11px] font-bold text-slate-400 italic">
                        Dữ liệu được cập nhật theo Thời gian thực từ hệ thống Tracking.
                    </p>
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-slate-900 text-white rounded-[var(--radius-md)] text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                    >
                        Đóng Báo cáo
                    </button>
                </div>
            }
        >
            <div className="space-y-8">
                {/* Main Performance Section */}
                <div className="bg-[#0f172a] rounded-xl p-8 text-white relative overflow-hidden ring-1 ring-white/10 shadow-2xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>

                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-10">
                        <div className="w-full md:w-1/2 space-y-6">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-blue-500 rounded-[14px] flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <Activity className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Tỷ lệ hoàn tất
                                    </p>
                                    <h3 className="text-3xl font-black tracking-tight">{completionRate}%</h3>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-1000"
                                        style={{ width: `${completionRate}%` }}
                                    ></div>
                                </div>
                                <p className="text-[10px] text-slate-500 font-bold">
                                    {completed.toLocaleString()} / {enrolled.toLocaleString()} Khách hàng Hoàn thành
                                </p>
                            </div>
                        </div>

                        <div className="w-px h-24 bg-white/10 hidden md:block"></div>

                        <div className="w-full md:w-1/2 flex justify-around">
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                    Unique Open
                                </p>
                                <p className="text-3xl font-black text-emerald-400">{openRate}%</p>
                                <p className="text-[10px] text-slate-500 font-bold mt-1">Trung bình</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                                    CTR
                                </p>
                                <p className="text-3xl font-black text-orange-400">
                                    {totalSent > 0 ? Math.round((combinedClicked / totalSent) * 100) : 0}%
                                </p>
                                <p className="text-[10px] text-slate-500 font-bold mt-1">Average</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Detailed Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <StatCard
                        label="Khách tham gia"
                        value={enrolled}
                        icon={Users}
                        color="from-blue-500 to-indigo-600 shadow-blue-500/20"
                        subValue="Enrolled"
                    />
                    <StatCard
                        label="Hoàn tất"
                        value={completed}
                        icon={CheckCircle2}
                        color="from-emerald-500 to-teal-600 shadow-emerald-500/20"
                        subValue={`${completionRate}%`}
                    />
                    <StatCard
                        label="Lượt gửi"
                        value={totalSent}
                        icon={Mail}
                        color="from-indigo-500 to-blue-600 shadow-indigo-500/20"
                        subValue="Total Sent"
                    />
                    <StatCard
                        label="Lượt mở"
                        value={totalOpened}
                        icon={MailOpen}
                        color="from-cyan-500 to-blue-600 shadow-cyan-500/20"
                        subValue={`${openRate}% Open`}
                    />
                    <StatCard
                        label="Lượt Click"
                        value={combinedClicked}
                        icon={MousePointerClick}
                        color="from-orange-500 to-red-600 shadow-orange-500/20"
                    />
                    <StatCard
                        label="Unique Clicks"
                        value={combinedUniqueClicked}
                        icon={TrendingUp}
                        color="from-amber-400 to-orange-500 shadow-amber-600/20"
                    />
                    <StatCard
                        label="Gửi lỗi"
                        value={stats.totalFailed || 0}
                        icon={AlertOctagon}
                        color="from-rose-500 to-red-600 shadow-rose-500/20"
                    />
                    <StatCard
                        label="Hủy đăng ký"
                        value={stats.totalUnsubscribed || 0}
                        icon={UserMinus}
                        color="from-slate-600 to-slate-800 shadow-slate-600/20"
                    />
                </div>

                {/* Per-Channel Breakdown */}
                {stats.zaloSent || stats.znsSent || stats.metaSent ? (
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                            Phân tích theo kênh
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="text-center p-4 rounded-[14px] bg-indigo-50 border border-indigo-100">
                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-1">
                                    Email
                                </p>
                                <p className="text-2xl font-black text-indigo-700">
                                    {Math.max(
                                        0,
                                        totalSent -
                                            (stats.zaloSent || 0) -
                                            (stats.znsSent || 0) -
                                            (stats.metaSent || 0)
                                    ).toLocaleString()}
                                </p>
                            </div>
                            {stats.zaloSent ? (
                                <div className="text-center p-4 rounded-[14px] bg-teal-50 border border-teal-100">
                                    <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wider mb-1">
                                        Zalo CS
                                    </p>
                                    <p className="text-2xl font-black text-teal-700">
                                        {stats.zaloSent.toLocaleString()}
                                    </p>
                                </div>
                            ) : null}
                            {stats.znsSent ? (
                                <div className="text-center p-4 rounded-[14px] bg-blue-50 border border-blue-100">
                                    <p className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-1">
                                        Zalo ZNS
                                    </p>
                                    <p className="text-2xl font-black text-blue-700">
                                        {stats.znsSent.toLocaleString()}
                                    </p>
                                    <p className="text-[10px] text-blue-400 font-bold mt-1">Lượt gửi</p>
                                </div>
                            ) : null}
                            {(stats.totalZaloClicked || 0) > 0 ? (
                                <div className="text-center p-4 rounded-[14px] bg-cyan-50 border border-cyan-100">
                                    <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider mb-1">
                                        ZNS Clicks
                                    </p>
                                    <p className="text-2xl font-black text-cyan-700">
                                        {(stats.totalZaloClicked || 0).toLocaleString()}
                                    </p>
                                    <p className="text-[10px] text-cyan-400 font-bold mt-1">Lượt Click Link</p>
                                </div>
                            ) : null}
                            {stats.metaSent ? (
                                <div className="text-center p-4 rounded-[14px] bg-sky-50 border border-sky-100">
                                    <p className="text-[10px] font-bold text-sky-400 uppercase tracking-wider mb-1">
                                        Meta
                                    </p>
                                    <p className="text-2xl font-black text-sky-700">
                                        {stats.metaSent.toLocaleString()}
                                    </p>
                                </div>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </div>
        </Modal>
    );
};

export default FlowSummaryModal;
