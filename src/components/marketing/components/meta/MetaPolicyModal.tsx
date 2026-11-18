import React from 'react';
import { X, Clock, Zap, MessageSquare, Megaphone, Info, CheckCircle2 } from 'lucide-react';
import Modal from '../common/Modal';

interface MetaPolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const MetaPolicyModal: React.FC<MetaPolicyModalProps> = ({ isOpen, onClose }) => {
    const triggers = [
        "Người dùng gửi tin nhắn cho Trang hoặc Instagram",
        "Nhấn vào nút Bắt đầu (Get Started)",
        "Nhấn vào quảng cáo Click-to-Messenger",
        "Gửi tin nhắn qua plugin (Send to Messenger)",
        "Nhấn vào liên kết m.me hoặc ig.me",
        "Bày tỏ cảm xúc (Reaction) với tin nhắn",
        "Bình luận về bài viết trên Trang/Instagram",
        "Đăng bài viết của khách truy cập trên Trang"
    ];

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            noHeader
            noPadding
        >
            <div className="flex flex-col h-full">
                {/* Header */}
                <div className="relative h-36 bg-slate-900 p-8 flex items-end shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-20"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 bg-white/10 rounded-xl text-white border border-white/15">
                            <Clock className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white leading-tight">Chính sách 24 Giờ</h2>
                            <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider mt-0.5">Standard Messaging Window</p>
                        </div>
                    </div>
                </div>

                <div className="p-8 space-y-8 flex-1">
                    {/* General Rule */}
                    <section className="bg-slate-50 p-6 rounded-2xl border border-slate-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Info className="w-16 h-16 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-[#BD1D2D]" />
                            Quy tắc vàng 24h
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                            Đây là khoảng Thời gian tiêu chuẩn mà Meta cho phép bạn phản hồi tin nhắn Khách hàng.
                            Khi một người tương tác với Trang, bạn có <span className="text-[#BD1D2D] font-bold">tối đa 24 giờ</span> để gửi tin nhắn.
                        </p>
                        <div className="mt-5 flex items-center gap-2 bg-white w-fit px-4 py-2 rounded-xl border border-slate-200 shadow-xs">
                            <Megaphone className="w-4 h-4 text-[#BD1D2D]" />
                            <p className="text-[11px] font-bold text-slate-700 uppercase">Cho phép nội dung quảng cáo</p>
                        </div>
                    </section>

                    {/* Triggers */}
                    <div>
                        <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-5 px-1 flex items-center gap-2">
                            <div className="w-6 h-px bg-slate-200" />
                            Các hành động mở cửa sổ 24h
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {triggers.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-4 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-colors group">
                                    <div className="p-2 bg-rose-50 rounded-lg text-[#BD1D2D] group-hover:bg-[#BD1D2D] group-hover:text-white transition-colors shrink-0">
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <p className="text-xs font-semibold text-slate-700 leading-snug">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Note */}
                    <div className="bg-emerald-50/50 border border-emerald-200/80 p-6 rounded-2xl relative overflow-hidden">
                        <div className="flex items-start gap-4 relative z-10">
                            <div className="p-2.5 bg-emerald-600 rounded-xl text-white shrink-0">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-bold text-emerald-900 text-sm mb-1">Lời khuyên phản hồi</h4>
                                <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                                    Mọi người đều mong nhận được phản hồi kịp thời. Bạn nên trả lời sớm nhất có thể.
                                    Sau 24 giờ, hệ thống sẽ bị hạn chế gửi tin nhắn trừ khi có thẻ tin nhắn (Message Tag) hợp lệ.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 bg-slate-50 flex justify-center border-t border-slate-200 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-12 py-3.5 bg-slate-900 text-white rounded-xl font-semibold text-sm hover:bg-slate-800 transition-colors shadow-sm"
                    >
                        Đã hiểu quy tắc
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default MetaPolicyModal;
