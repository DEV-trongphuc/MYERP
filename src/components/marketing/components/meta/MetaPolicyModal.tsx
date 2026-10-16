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
                {/* Header with Gradient Background */}
                <div className="relative h-36 bg-gradient-to-r from-blue-600 to-indigo-700 p-8 flex items-end shrink-0">
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 bg-white/20 hover:bg-white/30 rounded-full text-white transition-colors z-20"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl text-white ring-1 ring-white/20">
                            <Clock className="w-8 h-8" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-white leading-tight">Chính sách 24 Giờ</h2>
                            <p className="text-blue-100 text-sm font-bold opacity-80 uppercase tracking-wider">Standard Messaging Window</p>
                        </div>
                    </div>

                    {/* Decorative blobs */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 blur-[80px] rounded-full -mr-20 -mt-20 pointer-events-none" />
                </div>

                <div className="p-8 space-y-8 flex-1">
                    {/* General Rule */}
                    <section className="bg-blue-50/50 p-6 rounded-[32px] border border-blue-100 relative overflow-hidden group hover:shadow-lg hover:shadow-blue-500/5 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                            <Info className="w-16 h-16 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-black text-slate-800 mb-2 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-blue-600 fill-blue-600 animate-pulse" />
                            Quy tắc vàng 24h
                        </h3>
                        <p className="text-sm text-slate-600 leading-relaxed font-medium">
                            Đây là khoảng Thời gian tiêu chuẩn mà Meta cho phép bạn phản hồi tin nhắn Khách hàng.
                            Khi một người tương tác với Trang, bạn có <span className="text-blue-600 font-black">tối đa 24 giờ</span> đã gửi tin nhắn.
                        </p>
                        <div className="mt-5 flex items-center gap-2 bg-white w-fit px-4 py-2 rounded-2xl border border-blue-100 shadow-sm">
                            <Megaphone className="w-4 h-4 text-orange-500" />
                            <p className="text-[10px] font-black text-slate-700 uppercase tracking-tight">Cho phép nội dung quảng cáo</p>
                        </div>
                    </section>

                    {/* Triggers */}
                    <div>
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-5 px-1 flex items-center gap-2">
                            <div className="w-6 h-px bg-slate-200" />
                            Các hành động mở cửa sổ 24h
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {triggers.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-4 p-4 bg-white hover:bg-slate-50 border border-slate-100 rounded-3xl transition-all group shadow-sm hover:shadow-md hover:-translate-y-0.5">
                                    <div className="p-2 bg-blue-50 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all transform group-hover:scale-110">
                                        <CheckCircle2 className="w-4 h-4" />
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 leading-snug">{item}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Note */}
                    <div className="bg-emerald-50/50 border border-emerald-100 p-7 rounded-[32px] relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full" />
                        <div className="flex items-start gap-4 relative z-10">
                            <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl text-white shadow-lg shadow-emerald-500/20 group-hover:rotate-12 transition-transform">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <div>
                                <h4 className="font-black text-emerald-900 text-sm mb-1 tracking-tight">Lời khuyên phản hồi</h4>
                                <p className="text-xs text-emerald-700 leading-relaxed font-medium">
                                    Mọi người đều mong nhận được phản hồi kịp thời. Bạn nên trả lời sớm nhất có thể.
                                    Sau 24 giờ, hệ thống sẽ bị hạn chế gửi tin nhắn trừ khi có thẻ tin nhắn (Message Tag) hợp lệ.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 bg-slate-50 flex justify-center border-t border-slate-100 shrink-0">
                    <button
                        onClick={onClose}
                        className="w-full sm:w-auto px-16 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-black transition-all shadow-xl shadow-slate-900/10 hover:-translate-y-1 active:scale-95"
                    >
                        Đã hiểu quy tắc
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default MetaPolicyModal;
