import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, Users, MessageSquareText, MessagesSquare, ArrowRight } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import toast from 'react-hot-toast';
import { api } from '../../../services/storageAdapter';
import { getMktPortalRoot } from '../../../utils/portalRoot';

interface AIStatsModalProps {
    propertyId: string;
    onClose: () => void;
    brandColor?: string;
    onOpenAnalysis?: () => void;
}

const AIStatsModal: React.FC<AIStatsModalProps> = ({ propertyId, onClose, onOpenAnalysis }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any>(null);
    const [chartData, setChartData] = useState<any[]>([]);

    useEffect(() => {
        const controller = new AbortController();

        const fetchStats = async () => {
            try {
                const res: any = await api.get(`ai_report.php?action=detailed_ai_insights&property_id=${propertyId}&period=week&days=7`, { signal: controller.signal });

                if (res.success && res.stats) {
                    setStats(res.stats);
                    setChartData(res.chart || []);
                } else if (!controller.signal.aborted) {
                    toast.error(res.message || 'Lỗi: Phiên bản API backend chưa được cập nhật. Vui lòng upload api/ai_report.php lên server.');
                }
            } catch (err: any) {
                if (err.name !== 'AbortError') {
                    toast.error('Không thể kết nối đến máy chủ AI');
                }
            } finally {
                if (!controller.signal.aborted) {
                    setLoading(false);
                }
            }
        };

        fetchStats();

        return () => controller.abort();
    }, [propertyId]);

    const formatHour = (hour: number) => `${hour}h`;
    const maxCount = chartData.length > 0 ? Math.max(...chartData.map(d => d.count || 0)) : 0;

    return createPortal(
        <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-[18px] shadow-2xl w-full max-w-4xl flex flex-col md:h-[85vh] h-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="shrink-0 flex items-center justify-between p-5 md:px-8 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary)]/10 flex items-center justify-center shadow-sm">
                            <Sparkles className="w-5 h-5 text-[var(--color-primary)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                Phân Tích Kênh AI Hiện Tại
                                <span className="bg-[var(--color-primary)]/10 text-[var(--color-primary)] text-[10px] uppercase font-black px-2 py-0.5 rounded-full tracking-wider">7 Ngày Qua</span>
                            </h2>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">Thống kê mật độ tương tác & Đánh giá chuyên sâu từ Gemini</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-5 md:p-8 space-y-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
                            <div className="relative w-16 h-16">
                                <div className="absolute inset-0 rounded-full border-4 border-slate-200"></div>
                                <div className="absolute inset-0 rounded-full border-4 border-t-[var(--color-primary)] border-r-[var(--color-primary)] animate-spin"></div>
                            </div>
                            <p className="font-semibold px-6 py-2 bg-white rounded-full shadow-sm text-sm border border-slate-100 text-slate-600">Đang tổng hợp thông tin & Khởi chạy LLM...</p>
                        </div>
                    ) : (
                        <>
                            {/* Stats row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-5 rounded-[14px] shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center gap-4 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                                    <div className="w-12 h-12 rounded-[var(--radius-md)] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
                                        <Users className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Khách Tiếp Cận</p>
                                        <p className="text-2xl font-black text-slate-800">{stats?.visitors || 0}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-[14px] shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center gap-4 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                                    <div className="w-12 h-12 rounded-[var(--radius-md)] bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0 shadow-md shadow-purple-500/20">
                                        <MessagesSquare className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Cuộc Hội Thoại</p>
                                        <p className="text-2xl font-black text-slate-800">{stats?.conversations || 0}</p>
                                    </div>
                                </div>
                                <div className="bg-white p-5 rounded-[14px] shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] border border-slate-100 flex items-center gap-4 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                                    <div className="w-12 h-12 rounded-[var(--radius-md)] bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20">
                                        <MessageSquareText className="w-6 h-6 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng Tin Nhắn</p>
                                        <p className="text-2xl font-black text-slate-800">{stats?.messages || 0}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Chart */}
                            <div className="bg-white p-6 rounded-[14px] shadow-sm border border-slate-100">
                                <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2">
                                    Phân bổ tin nhắn theo khung giờ
                                    <span className="text-[10px] font-medium text-slate-400 font-normal bg-slate-100 px-2 py-0.5 rounded-md">Dữ liệu 24h</span>
                                </h3>
                                <div className="h-64 w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorYellow" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                                                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                                </linearGradient>
                                                <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="0%" stopColor="#BD1D2D" stopOpacity={0.9} />
                                                    <stop offset="100%" stopColor="#BD1D2D" stopOpacity={0.3} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
                                            <XAxis
                                                dataKey="hr"
                                                tickFormatter={formatHour}
                                                tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                                                axisLine={false}
                                                tickLine={false}
                                                minTickGap={2}
                                            />
                                            <YAxis
                                                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                                                axisLine={false}
                                                tickLine={false}
                                                allowDecimals={false}
                                            />
                                            <Tooltip
                                                cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }}
                                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', padding: '12px 16px' }}
                                                labelFormatter={(val) => `${formatHour(val as number)}`}
                                                formatter={(val: number) => [`${val} tin nhắn`, 'Lượng Tương Tác']}
                                            />
                                            <Bar
                                                dataKey="count"
                                                radius={[6, 6, 0, 0]}
                                                barSize={20}
                                            >
                                                {chartData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.count === maxCount && maxCount > 0 ? 'url(#colorRed)' : 'url(#colorYellow)'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* AI Insights Button */}
                            <button
                                onClick={() => { if (onOpenAnalysis) onOpenAnalysis(); }}
                                className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 hover:border-blue-300 rounded-[14px] transition-all shadow-[0_2px_10px_-3px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(104,61,242,0.15)] group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-[var(--radius-md)] bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-110 transition-transform">
                                        <Sparkles className="w-6 h-6" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-base font-black text-slate-800">Phân Tích Báo Cáo AI</h3>
                                        <p className="text-[11px] text-slate-600 font-medium mt-0.5">Truy cập giao diện phân tích toàn diện hội thoại khách hàng</p>
                                    </div>
                                </div>
                                <div className="w-8 h-8 flex items-center justify-center text-white bg-slate-900 shadow-sm rounded-[var(--radius-md)] opacity-80 group-hover:opacity-100 transition-opacity">
                                    <ArrowRight className="w-4 h-4" />
                                </div>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>,
        getMktPortalRoot()
    );
};

export default AIStatsModal;
