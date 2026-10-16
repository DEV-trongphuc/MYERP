import * as React from 'react';
import { useEffect, useState } from 'react';
import { Calendar, Users, Info, ChevronRight, Zap } from 'lucide-react';
import { RetentionData, WebProperty } from '../types';
import { api } from '../../../services/storageAdapter';
import Modal from '../../common/Modal';

interface RetentionTabContentProps {
    property: WebProperty;
    device: string;
}

const RetentionTabContent: React.FC<RetentionTabContentProps> = ({ property, device }) => {
    const [retention, setRetention] = useState<RetentionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [cycle, setCycle] = useState<'day' | 'week' | 'month'>('week');
    const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

    useEffect(() => {
        fetchRetention();
    }, [property.id, cycle, device]);

    const fetchRetention = async () => {
        try {
            setLoading(true);
            const deviceParam = device !== 'all' ? `&device=${device}` : '';
            const res = await api.get(`web_tracking?action=retention&id=${property.id}&cycle=${cycle}${deviceParam}`);
            setRetention((res.data as RetentionData[]) || []);
        } catch (error) {
            console.error('Error fetching retention:', error);
        } finally {
            setLoading(false);
        }
    };

    const getCycleLabel = (val: number) => {
        if (cycle === 'day') return `Ngày ${val}`;
        if (cycle === 'month') return `Tháng ${val}`;
        return `Tuần ${val}`;
    };

    const getColorIntensity = (percent: number) => {
        if (percent === 100) return 'bg-blue-600 text-white border-blue-700 shadow-sm';
        if (percent >= 50) return 'bg-blue-500 text-white border-blue-600';
        if (percent >= 30) return 'bg-blue-400 text-white border-blue-500';
        if (percent >= 20) return 'bg-blue-300 text-blue-900 border-blue-400';
        if (percent >= 10) return 'bg-blue-200 text-blue-800 border-blue-300';
        if (percent >= 5) return 'bg-blue-100 text-blue-700 border-blue-200';
        if (percent > 0) return 'bg-blue-50 text-blue-600 border-blue-100';
        return 'bg-slate-50/50 text-slate-300 border-slate-100';
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Header Info - Lightened */}
            <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-5">
                    <div className="w-14 h-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center flex-shrink-0 border border-slate-100">
                        <Users className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">Phân tích Trung thành</h3>
                        <p className="text-slate-500 text-sm mt-1 font-medium max-w-md leading-relaxed">
                            Theo dõi tỷ lệ Khách hàng trung thành quay lại website theo từng {cycle === 'day' ? 'ngày' : cycle === 'month' ? 'tháng' : 'tuần'}. Đây là chỉ số quan trọng để đánh giá chất lượng nội dung.
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between ml-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chu kỳ theo dõi</span>
                        <button
                            onClick={() => setIsInfoModalOpen(true)}
                            className="p-1 px-2 text-slate-500 bg-slate-50 hover:bg-blue-50 hover:text-blue-600 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all border border-slate-100 hover:border-blue-100"
                        >
                            <Info className="w-3 h-3" />
                            Tìm hiểu
                        </button>
                    </div>
                    <div className="flex p-1 bg-slate-100 rounded-2xl border border-slate-200">
                        {[
                            { id: 'day', label: 'Ngày' },
                            { id: 'week', label: 'Tuần' },
                            { id: 'month', label: 'Tháng' }
                        ].map((c) => (
                            <button
                                key={c.id}
                                onClick={() => setCycle(c.id as any)}
                                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all ${cycle === c.id
                                    ? 'bg-white text-blue-700 shadow-sm border border-blue-100'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4 animate-pulse">
                    <div className="h-[450px] bg-slate-50 rounded-[32px] border border-slate-100"></div>
                </div>
            ) : retention.length > 0 ? (
                <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="bg-slate-50/50">
                                    <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[200px]">Thời điểm bắt đầu</th>
                                    <th className="px-6 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">Quy mô</th>
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((w) => (
                                        <th key={w} className="px-4 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 min-w-[100px]">
                                            {getCycleLabel(w)}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {retention.map((cohort, idx) => (
                                    <tr key={idx} className="group hover:bg-slate-50/30 transition-colors">
                                        <td className="px-8 py-5 border-b border-slate-50">
                                            <div className="flex items-center gap-4">
                                                <div className="p-2.5 bg-slate-50 text-slate-400 rounded-xl border border-slate-100 group-hover:bg-white group-hover:text-slate-800 group-hover:border-slate-200 transition-all">
                                                    <Calendar className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">
                                                        {cycle === 'day' ? `Ngày ${cohort.startDate}` :
                                                            cycle === 'month' ? `Tháng ${cohort.startDate}` :
                                                                `Tuần ${cohort.startDate}`}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 border-b border-slate-50 text-center">
                                            <span className="inline-flex items-center px-4 py-1.5 bg-slate-50 text-slate-600 rounded-full text-xs font-bold border border-slate-100">
                                                {cohort.total.toLocaleString()}
                                            </span>
                                        </td>
                                        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((wIdx) => {
                                            const percent = cohort.data[wIdx] ?? 0;
                                            return (
                                                <td key={wIdx} className="p-1 border-b border-slate-50">
                                                    <div className={`h-14 flex flex-col items-center justify-center rounded-xl font-black text-sm transition-all duration-300 border group-hover:scale-95 ${getColorIntensity(percent)}`}>
                                                        {percent}%
                                                        {percent > 0 && (
                                                            <span className="text-[8px] opacity-70 font-bold uppercase tracking-tighter mt-0.5">
                                                                {wIdx === 0 ? 'New' : 'Active'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-20 rounded-[32px] border border-slate-100 shadow-sm text-center flex flex-col items-center gap-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-2 border border-slate-100">
                        <Users className="w-10 h-10 text-slate-200" />
                    </div>
                    <h4 className="text-xl font-black text-slate-800 tracking-tight">Chưa đủ dữ liệu phân tích</h4>
                    <p className="text-slate-400 text-sm max-w-sm font-medium leading-relaxed">
                        Hệ thống cần tích lũy thêm dữ liệu để bắt đầu phân tích. Hãy tiếp tục theo dõi website của bạn nhé!
                    </p>
                </div>
            )}

            {/* Modal Hướng dẫn */}
            <Modal
                isOpen={isInfoModalOpen}
                onClose={() => setIsInfoModalOpen(false)}
                title={
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <Info className="w-5 h-5" />
                        </div>
                        <span>Hướng dẫn Phân tích Trung thành</span>
                    </div>
                }
                size="xl"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-8 bg-slate-50 border border-slate-100 rounded-[32px] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
                        <h4 className="flex items-center gap-2 font-black text-lg mb-6 text-slate-800 relative">
                            <div className="p-2 bg-blue-600 text-white rounded-xl">
                                <Info className="w-5 h-5" />
                            </div>
                            Cách đọc bảng Cohort
                        </h4>
                        <ul className="space-y-5 text-sm text-slate-500 font-medium relative">
                            <li className="flex gap-4">
                                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-black text-slate-400 border border-slate-100">1</div>
                                <span><b>Cohort {cycle === 'day' ? 'Day' : cycle === 'month' ? 'Month' : 'Week'}:</b> Nhóm 100% người dùng mới lần đầu đến website trong {cycle === 'day' ? 'ngày' : cycle === 'month' ? 'tháng' : 'tuần'} đó.</span>
                            </li>
                            <li className="flex gap-4">
                                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-black text-slate-400 border border-slate-100">2</div>
                                <span><b>{cycle === 'day' ? 'Ngày' : cycle === 'month' ? 'Tháng' : 'Tuần'} 0:</b> Luôn là 100% vì đây là {cycle === 'day' ? 'ngày' : cycle === 'month' ? 'tháng' : 'tuần'} họ bắt đầu "mất dấu" hoặc "ở lại".</span>
                            </li>
                            <li className="flex gap-4">
                                <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[10px] font-black text-slate-400 border border-slate-100">3</div>
                                <span><b>{cycle === 'day' ? 'Ngày' : cycle === 'month' ? 'Tháng' : 'Tuần'} 1-7:</b> Tỷ lệ % số người dùng của chính nhóm đó quay lại ở các {cycle === 'day' ? 'ngày' : cycle === 'month' ? 'tháng' : 'tuần'} kế tiếp.</span>
                            </li>
                        </ul>
                    </div>

                    <div className="p-8 bg-slate-50 border border-slate-100 rounded-[32px] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-100/30 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500"></div>
                        <h4 className="font-black text-lg mb-6 text-slate-800 relative flex items-center gap-2">
                            <div className="p-2 bg-white text-slate-400 rounded-xl border border-slate-100">
                                <Zap className="w-5 h-5" />
                            </div>
                            Tại sao nó quan trọng?
                        </h4>
                        <div className="space-y-4 relative">
                            <p className="text-sm text-slate-500 leading-relaxed font-medium">
                                Chỉ số Retention cao chứng tỏ website của bạn đủ sức hấp dẫn. Nếu tỷ lệ giảm quá nhanh ở các tuần đầu/ngày đầu, bạn cần xem xét lại chiến lược giữ chân Khách hàng (Email Marketing, Zalo ZNS...).
                            </p>
                            <div className="p-5 bg-white border border-slate-100 rounded-[24px] flex items-start gap-4 mt-6">
                                <blockquote className="text-xs text-orange-800 font-bold italic leading-relaxed">
                                    "Phân tích Cohort giúp bạn biết được liệu các cập nhật website gần đây có thực sự làm Khách hàng hài lòng hơn hay không."
                                </blockquote>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-8 p-6 bg-slate-900 rounded-[24px] text-white">
                    <h5 className="font-bold text-sm mb-2 text-blue-400">Mẹo nhỏ:</h5>
                    <p className="text-xs text-slate-300 leading-relaxed">
                        Hãy theo dõi các tuần có tỷ lệ retention cao đột biến để tìm ra nguyên nhân (ví dụ: một chiến dịch email thành công, hoặc một bài viết blog chất lượng) và nhân bản nó.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default RetentionTabContent;
