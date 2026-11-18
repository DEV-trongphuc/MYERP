
import React from 'react';
import {
    X, Lightbulb, Zap, Users, ShieldCheck,
    FileSpreadsheet, Target, DollarSign, Send, BrainCircuit
} from 'lucide-react';
import Modal from '../common/Modal';

interface AudienceTipsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TipCard = ({ icon: Icon, title, description, colorClass, highlight }: any) => (
    <div className="group bg-white hover:bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 transition-colors duration-150 relative overflow-hidden">
        <div className="flex gap-4 relative z-10 items-start">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-black/5 ${colorClass} text-white`}>
                <Icon className="w-5 h-5" strokeWidth={2.25} />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[15px] font-bold text-slate-900">
                        {title}
                    </h4>
                    {highlight && (
                        <span className="shrink-0 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase rounded-md tracking-wider border border-slate-200 transition-colors duration-150 group-hover:bg-slate-800 group-hover:text-white group-hover:border-slate-800">
                            {highlight}
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
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
                <div className="sticky top-0 left-0 w-full h-1 bg-[var(--color-primary)] z-10" />

                <div className="p-6 lg:p-8">
                    <div className="flex items-center justify-between mb-6 lg:mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-[var(--color-primary)] text-white flex items-center justify-center border border-[var(--color-primary)]/20 shrink-0">
                                <Lightbulb className="w-7 h-7" strokeWidth={2.25} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight uppercase">Mẹo tăng trưởng</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className="h-3 w-0.5 bg-[var(--color-primary)]" />
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                        Tối ưu hóa dữ liệu & Marketing
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors duration-150"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-3">
                        <TipCard
                            icon={BrainCircuit}
                            title="Phân tích Kịch bản AI"
                            description="AI tự động phân tích hành vi Khách hàng trong Segment để đề xuất kịch bản nuôi dưỡng (Nurture Flow) phù hợp nhất."
                            colorClass="bg-[#BD1D2D]"
                            highlight="Đề xuất AI"
                        />
                        <TipCard
                            icon={Zap}
                            title="Kích hoạt Automation"
                            description="Gia nhập segment và đồng bộ Google Sheets để kích hoạt DOMATION Flows ngay lập tức."
                            colorClass="bg-emerald-600"
                            highlight="Khuyên dùng"
                        />
                        <TipCard
                            icon={DollarSign}
                            title="Tối ưu chi phí ZNS"
                            description="Gửi ZNS bằng UID từ tệp OA User đã quan tâm giúp tiết kiệm chi phí & tăng tỷ lệ nhận tin."
                            colorClass="bg-slate-800"
                            highlight="Tiết kiệm"
                        />
                        <TipCard
                            icon={Users}
                            title="List vs Segment"
                            description="Dùng Danh sách cho chiến dịch rời rác. Dùng Phân khúc cho Khách hàng có điều kiện thay đổi động."
                            colorClass="bg-slate-700"
                        />
                        <TipCard
                            icon={ShieldCheck}
                            title="Vệ sinh dữ liệu"
                            description="Định kỳ quét danh sách để loại bỏ email sai định dạng giúp bảo vệ uy tín đầu gửi của bạn."
                            colorClass="bg-rose-600"
                        />
                        <TipCard
                            icon={Target}
                            title="Tagging thông minh"
                            description="Gán nhãn sở thích ngay khi import để chuẩn bị cho các kịch bản Re-marketing đa kênh."
                            colorClass="bg-amber-600"
                        />
                        <TipCard
                            icon={FileSpreadsheet}
                            title="Import chuẩn hóa"
                            description="Luôn để định dạng Số điện thoại chuẩn quốc tế (84...) để đồng nhất trên Zalo và Messenger."
                            colorClass="bg-slate-600"
                        />
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-200 flex items-center gap-3 text-xs font-medium text-slate-500">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-500 shrink-0">
                            <Send className="w-4 h-4" />
                        </div>
                        <span>Sử dụng Phân khúc để tăng tỷ lệ chuyển đổi lên đến 35%</span>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default AudienceTipsModal;
