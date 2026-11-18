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
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-slate-600 text-sm">
                    Đây là loại tin nhắn Zalo Customer Service (CS) - công cụ tư vấn Khách hàng chủ động thông qua Zalo ID, giúp tối ưu hóa chuyển đổi mà không tốn chi phí tin nhắn ZNS.
                </div>

                <div className="space-y-4">
                    {/* Zalo CS Section */}
                    <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg">
                                <Zap className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-slate-800">Zalo CS (Tư vấn)</h4>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                                <span className="text-emerald-600 font-bold text-sm leading-none shrink-0 mt-0.5">✔</span>
                                <span>Gửi tin nhắn <strong>Hoàn toàn Miễn phí</strong> (theo hạn mức quota của OA).</span>
                            </li>
                            <li className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                                <span className="text-emerald-600 font-bold text-sm leading-none shrink-0 mt-0.5">✔</span>
                                <span>Gửi qua Zalo ID (dành cho Khách hàng <strong>đã tương tác OA</strong>).</span>
                            </li>
                            <li className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                                <span className="text-emerald-600 font-bold text-sm leading-none shrink-0 mt-0.5">✔</span>
                                <span>Tự động kích hoạt khi Khách hàng nhấn Menu hoặc nhắn tin cho OA.</span>
                            </li>
                        </ul>
                    </div>

                    {/* Zalo ZNS Section */}
                    <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-xs hover:border-slate-300 transition-colors">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                                <CreditCard className="w-5 h-5" />
                            </div>
                            <h4 className="font-bold text-slate-800">Zalo ZNS (Thông báo)</h4>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                                <span className="text-slate-500 font-bold text-sm leading-none shrink-0 mt-0.5">ℹ</span>
                                <span>Gửi qua Số điện thoại, <strong>có trả phí</strong> cho Zalo.</span>
                            </li>
                            <li className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                                <span className="text-slate-500 font-bold text-sm leading-none shrink-0 mt-0.5">ℹ</span>
                                <span>Còn được Zalo xét duyệt Template trước khi gửi.</span>
                            </li>
                            <li className="flex gap-2 text-xs font-semibold text-slate-600 leading-relaxed">
                                <span className="text-slate-500 font-bold text-sm leading-none shrink-0 mt-0.5">ℹ</span>
                                <span>Tích hợp tốt với các Flow Automation (kết hợp Email + ZNS).</span>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Important Rules */}
                <div className="bg-amber-50 rounded-xl p-5 border border-amber-200 flex gap-4">
                    <div className="shrink-0 p-2 bg-white rounded-xl border border-amber-100 h-fit">
                        <AlertOctagon className="w-5 h-5 text-[var(--color-primary)]" />
                    </div>
                    <div>
                        <h5 className="text-sm font-bold text-amber-900 mb-1">Cập nhật Quy định 2026</h5>
                        <p className="text-xs text-amber-800 font-medium leading-relaxed">
                            Từ ngày 1/1/2026, đối tác có thể gửi tin Tư vấn - CS <strong>miễn phí không giới hạn</strong> trong khung 48h và tối đa Khách hàng có tương tác với OA trong vòng 7 ngày.
                        </p>
                    </div>
                </div>

                {/* Recommendations */}
                <div className="bg-rose-50 rounded-xl p-5 border border-rose-200">
                    <h5 className="text-sm font-bold text-rose-900 mb-3 flex items-center gap-2 uppercase tracking-wider">
                        Khuyến nghị tránh SPAM
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-xl border border-rose-200/70 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-[#BD1D2D] uppercase">Hạn chế quảng cáo</span>
                            <span className="text-[11px] font-medium text-slate-700 leading-snug">Tin nhắn CS không nên gửi quảng cáo và ZBS tránh gửi nội dung quảng cáo quá mức.</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-rose-200/70 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-[#BD1D2D] uppercase">Tránh làm phiền</span>
                            <span className="text-[11px] font-medium text-slate-700 leading-snug">Đảm bảo tần suất gửi hợp lý, đừng khiến Khách hàng khó chịu và nhấn Report.</span>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center pt-2">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
                    >
                        Tôi đã hiểu quy định
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ZaloPolicyModal;
