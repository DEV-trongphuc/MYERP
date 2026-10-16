import React from 'react';
import { Info, Zap, CreditCard, AlertOctagon, X, ExternalLink } from 'lucide-react';
import Modal from '../common/Modal';

interface ZaloPolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ZaloPolicyModal: React.FC<ZaloPolicyModalProps> = ({ isOpen, onClose }) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Quy định & Chính sách Zalo Official Account">
            <div className="space-y-6">
                {/* Introduction */}
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 italic text-slate-600 text-sm">
                    Đây là loại tin nhắn Zalo Customer Service (CS) - công cụ tư vấn Khách hàng chủ động thông qua Zalo ID, giúp tối ưu hóa chuyển đổi mà không tốn chi phí tin nhắn ZNS.
                </div>

                <div className="space-y-4">
                    {/* Zalo CS Section */}
                    <div className="p-5 rounded-2xl border-2 border-slate-50 bg-white shadow-sm hover:border-blue-100 transition-all">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                                <Zap className="w-5 h-5" />
                            </div>
                            <h4 className="font-black text-slate-800 tracking-tight">Zalo CS (Tư vấn)</h4>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                                <span className="text-emerald-500 font-bold text-sm leading-none shrink-0 mt-0.5">✔</span>
                                <span>Gửi tin nhắn <strong>Hoàn toàn Miễn phí</strong> (theo hạn mức quota của OA).</span>
                            </li>
                            <li className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                                <span className="text-emerald-500 font-bold text-sm leading-none shrink-0 mt-0.5">✔</span>
                                <span>Gửi qua Zalo ID (dành cho Khách hàng <strong>đã tương tác OA</strong>).</span>
                            </li>
                            <li className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                                <span className="text-emerald-500 font-bold text-sm leading-none shrink-0 mt-0.5">✔</span>
                                <span>Tự động kích hoạt khi Khách hàng nhấn Menu hoặc nhắn tin cho OA.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Zalo ZNS Section */}
                    <div className="p-5 rounded-2xl border-2 border-slate-50 bg-white shadow-sm hover:border-emerald-100 transition-all">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <h4 className="font-black text-slate-800 tracking-tight">Zalo ZNS (Thông báo)</h4>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                                <span className="text-blue-500 font-bold text-sm leading-none shrink-0 mt-0.5">ℹ</span>
                                <span>Gửi qua Số điện thoại, <strong>có trả phí</strong> cho Zalo.</span>
                            </li>
                            <li className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                                <span className="text-blue-500 font-bold text-sm leading-none shrink-0 mt-0.5">ℹ</span>
                                <span>Còn được Zalo xét duyệt Template trước khi gửi.</span>
                            </li>
                            <li className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                                <span className="text-blue-500 font-bold text-sm leading-none shrink-0 mt-0.5">ℹ</span>
                                <span>Tích hợp tốt với các Flow Automation (kết hợp Email + ZNS).</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Important Rules */}
                <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 flex gap-4">
                    <div className="shrink-0 p-2 bg-white rounded-xl shadow-sm h-fit">
                        <AlertOctagon className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                        <h5 className="text-sm font-black text-amber-900 mb-1 tracking-tight">Cập nhật Quy định 2026</h5>
                        <p className="text-xs text-amber-800 font-medium leading-relaxed">
                            Từ ngày 1/1/2026, đối tác có thể gửi tin Tư vấn - CS <strong>miễn phí không giới hạn</strong> trong khung 48h và tối đa Khách hàng có tương tác với OA trong vòng 7 ngày.
                        </p>
                    </div>
                </div>

                {/* Recommendations */}
                <div className="bg-rose-50 rounded-2xl p-5 border border-rose-100">
                    <h5 className="text-sm font-black text-rose-900 mb-3 flex items-center gap-2 uppercase tracking-wider">
                        Khuyến nghị tránh SPAM
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-white/50 p-3 rounded-xl border border-rose-200/50 flex flex-col gap-1">
                            <span className="text-[10px] font-black text-rose-500 uppercase">Hạn chế quảng cáo</span>
                            <span className="text-[11px] font-bold text-slate-700 leading-tight">Tin nhắn CS không nên gửi quảng cáo và ZBS tránh gửi nội dung quảng cáo quá mức.</span>
                        </div>
                        <div className="bg-white/50 p-3 rounded-xl border border-rose-200/50 flex flex-col gap-1">
                            <span className="text-[10px] font-black text-rose-500 uppercase">Tránh làm phiền</span>
                            <span className="text-[11px] font-bold text-slate-700 leading-tight">Đảm bảo tần suất gửi hợp lý, đừng khiến Khách hàng khó chịu và nhấn Report.</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center pt-4">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-slate-800 hover:bg-black text-white rounded-2xl text-sm font-black transition-all shadow-lg shadow-slate-200 active:scale-95"
                    >
                        Tôi đã hiểu quy định
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ZaloPolicyModal;
