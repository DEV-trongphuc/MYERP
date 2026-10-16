
import React from 'react';
import {
    X, Lightbulb, Zap, Users, ShieldCheck,
    MessageSquare, FileSpreadsheet, Target, ArrowRight,
    MousePointer2, DollarSign, Send, BrainCircuit
} from 'lucide-react';
import Modal from '../common/Modal';

interface AudienceTipsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

import Button from '../common/Button';

const TipCard = ({ icon: Icon, title, description, colorClass, highlight }: any) => (
    <div className="group bg-white hover:bg-slate-50/50 p-5 rounded-[24px] border border-slate-100 hover:border-slate-200 transition-all duration-300 hover:shadow-sm relative overflow-hidden">
        {/* Subtle hover background highlight */}
        <div className={`absolute inset-0 opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500 ${colorClass}`} />

        <div className="flex gap-5 relative z-10">
            <div className="relative shrink-0">
                {/* Glow effect - refined blur */}
                <div className={`absolute inset-0 blur-sm opacity-20 group-hover:opacity-30 transition-opacity duration-300 rounded-full ${colorClass}`} />
                <div className={`relative w-12 h-12 rounded-[18px] flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 ${colorClass} text-white`}>
                    <Icon className="w-5.5 h-5.5 md:w-6 md:h-6" strokeWidth={2.5} />
                </div>
            </div>
            <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[15px] font-bold text-slate-800 tracking-tight">
                        {title}
                    </h4>
                    {highlight && (
                        <span className="shrink-0 px-2 py-0.5 bg-slate-50 text-slate-500 text-[9px] font-black uppercase rounded-lg tracking-wider border border-slate-100 transition-all group-hover:bg-slate-800 group-hover:text-white group-hover:border-slate-800">
                            {highlight}
                        </span>
                    )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                    {description}
                </p>
            </div>
        </div>
    </div>
);

const AudienceTipsModal: React.FC<AudienceTipsModalProps> = ({ isOpen, onClose }) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            noHeader
            noPadding
        >
            <div className="relative bg-white">
                {/* Top Gradient Bar - Thinner and more subtle */}
                <div className="sticky top-0 left-0 w-full h-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 z-10" />

                <div className="p-8 lg:p-12">
                    <div className="flex items-center justify-between mb-8 lg:mb-10">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <div className="absolute inset-0 bg-amber-400 blur-lg opacity-10 animate-pulse" />
                                <div className="relative w-16 h-16 rounded-[24px] bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-600/10 group transition-transform hover:rotate-3 border border-amber-300/20">
                                    <Lightbulb className="w-8 h-8 fill-white/20" strokeWidth={2.5} />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none uppercase">Mẹo tăng trưởng</h1>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className="h-3.5 w-0.5 bg-amber-400 rotate-12"></span>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                        Tối ưu hóa dữ liệu & Marketing
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 hover:bg-slate-50 rounded-full text-slate-300 hover:text-slate-500 transition-all active:scale-95 group"
                        >
                            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-4">
                        <TipCard
                            icon={BrainCircuit}
                            title="Phân tích Kịch bản AI"
                            description="AI tự động phân tích hành vi Khách hàng trong Segment để đề xuất kịch bản nuôi dưỡng (Nurture Flow) phù hợp nhất."
                            colorClass="bg-gradient-to-br from-fuchsia-500 to-purple-600 shadow-fuchsia-200"
                            highlight="Mới & Hot"
                        />
                        <TipCard
                            icon={Zap}
                            title="Kích hoạt Automation"
                            description="Gia nhập segment và đồng bộ Google Sheets để kích hoạt DOMATION Flows ngay lập tức."
                            colorClass="bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-emerald-200"
                            highlight="Khuyên dùng"
                        />
                        <TipCard
                            icon={DollarSign}
                            title="Tối ưu chi phí ZNS"
                            description="Gửi ZNS bằng UID từ tệp OA User đã quan tâm giúp tiết kiệm chi phí & tăng tỷ lệ nhận tin."
                            colorClass="bg-gradient-to-br from-blue-500 to-cyan-500 shadow-blue-200"
                            highlight="Tiết kiệm"
                        />
                        <TipCard
                            icon={Users}
                            title="List vs Segment"
                            description="Dùng Danh sách cho chiến dịch rời rác. Dùng Phân khúc cho Khách hàng có điều kiện thay đổi động."
                            colorClass="bg-gradient-to-br from-indigo-500 to-purple-500 shadow-indigo-200"
                        />
                        <TipCard
                            icon={ShieldCheck}
                            title="Vệ sinh dữ liệu"
                            description="Định kỳ quét danh sách để loại bỏ email sai định dạng giúp bảo vệ uy tín đầu gửi của bạn."
                            colorClass="bg-gradient-to-br from-rose-500 to-rose-600 shadow-rose-200"
                        />
                        <TipCard
                            icon={Target}
                            title="Tagging thông minh"
                            description="Gán nhãn sở thích ngay khi import để chuẩn bị cho các kịch bản Re-marketing đa kênh."
                            colorClass="bg-gradient-to-br from-orange-400 to-amber-600 shadow-amber-200"
                        />
                        <TipCard
                            icon={FileSpreadsheet}
                            title="Import chuẩn hóa"
                            description="Luôn để định dạng Số điện thoại chuẩn quốc tế (84...) để đồng nhất trên Zalo và Messenger."
                            colorClass="bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-200"
                        />
                    </div>

                    <div className="mt-12 pt-10 border-t border-slate-100 flex items-center gap-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] italic">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-200">
                            <Send className="w-5 h-5" />
                        </div>
                        <span>Sử dụng Phân khúc để tăng tỷ lệ chuyển đổi lên đến 35%</span>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default AudienceTipsModal;
