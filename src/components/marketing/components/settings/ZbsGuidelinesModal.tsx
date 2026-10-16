import React from 'react';
import { X, FileCheck, AlertCircle, CheckCircle2, ShieldAlert } from 'lucide-react';
import Modal from '../common/Modal';

interface ZbsGuidelinesModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const ZbsGuidelinesModal: React.FC<ZbsGuidelinesModalProps> = ({ isOpen, onClose }) => {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Quy định kiểm duyệt mẫu ZNS Zalo Business"
            size="4xl"
        >
            <div className="h-[75vh] overflow-y-auto custom-scrollbar p-6 bg-slate-50">
                <div className="max-w-4xl mx-auto space-y-8 pb-10">
                    
                    {/* Header Intro */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex gap-4 items-start">
                            <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                <FileCheck className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-slate-800">Quy định chung khi kiểm duyệt mẫu tin nhắn ZBS</h3>
                                <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                                    Nội dung mẫu template cần đảm bảo xác minh mục đích sử dụng và trình bày chuyên nghiệp. 
                                    Zalo có quyền từ chối các mẫu có nội dung chưa phù hợp, thiếu thông tin hoặc sai lỗi chính tả.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Section 1: Yêu cầu tổng quan */}
                    <div className="space-y-4">
                        <h4 className="text-base font-black text-slate-800 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs">1</div>
                            Yêu cầu tổng quan
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white p-5 rounded-xl border border-slate-200">
                                <h5 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Ngôn ngữ & Văn phong
                                </h5>
                                <ul className="space-y-2 text-sm text-slate-600 list-disc ml-5 marker:text-slate-300">
                                    <li>Đúng chính tả, không lỗi đánh máy (typo).</li>
                                    <li>Tiếng Việt phải có dấu, dùng đồng nhất MỘT ngôn ngữ.</li>
                                    <li>Không chèn link hoặc SĐT vào phần nội dung chữ.</li>
                                    <li>Không dùng icon, ký tự đặc biệt, không viết tắt.</li>
                                    <li>Văn phong chuyên nghiệp, không mê tín, lừa gạt, thần thánh hóa.</li>
                                </ul>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200">
                                <h5 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Logo & Hình Ảnh
                                </h5>
                                <ul className="space-y-2 text-sm text-slate-600 list-disc ml-5 marker:text-slate-300">
                                    <li><b className="text-blue-600">Logo canh sát lề trái</b>, tỷ lệ chuẩn (400x96px), rõ nét.</li>
                                    <li>Tối đa 1-3 hình (Tỷ lệ 16:9), dung lượng {`< 500kb`}.</li>
                                    <li>Hình ảnh không chứa barcode/QR code, không ghép khung, viền.</li>
                                    <li>Chữ trong ảnh chiếm không quá 50% diện tích (Khuyên dùng font {`> 42pt`}).</li>
                                    <li>Không dùng ảnh mồi click (Nút play giả), không hở hang, bạo lực.</li>
                                </ul>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200">
                                <h5 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Tham số (Biến động)
                                </h5>
                                <ul className="space-y-2 text-sm text-slate-600 list-disc ml-5 marker:text-slate-300">
                                    <li>Không dấu, không khoảng trắng, nối bằng gạch dưới (VD: {`<ma_don_hang>`}).</li>
                                    <li>Không xưng hô bằng biến (như "anh/chị {`<ten>`}"), dùng từ trung tính (bạn, khách hàng, quý khách).</li>
                                    <li>Phải có tiền tố rõ ràng: "Mã đơn của bạn là {`<order_id>`}".</li>
                                </ul>
                            </div>
                            <div className="bg-white p-5 rounded-xl border border-slate-200">
                                <h5 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Nút thao tác (CTA)
                                </h5>
                                <ul className="space-y-2 text-sm text-slate-600 list-disc ml-5 marker:text-slate-300">
                                    <li>Link & SĐT <b className="text-rose-600">BẮT BUỘC</b> đặt ở nút, không đặt ở nội dung.</li>
                                    <li>Không dùng link rút gọn (bitly, v.v.), không chuyển hướng vào Group chat, FB.</li>
                                    <li>Link CTA phải liên quan mật thiết đến nội dung tin.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Yêu cầu theo mục đích */}
                    <div className="space-y-4">
                        <h4 className="text-base font-black text-slate-800 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs">2</div>
                            Phân loại mục đích gửi (Tags)
                        </h4>
                        <div className="space-y-3">
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5">
                                <h5 className="font-bold text-indigo-800">Tag 1 - Giao dịch (Transaction)</h5>
                                <p className="text-sm text-indigo-900/80 mt-1 mb-2">Thông báo đơn hàng, thanh toán, xác nhận lịch hẹn...</p>
                                <ul className="text-sm list-disc ml-5 text-indigo-900/70 marker:text-indigo-300">
                                    <li>Bắt buộc có tên khách hàng và 1 tham số mã giao dịch (mã đơn, mã HĐ...).</li>
                                    <li>Nếu yếu cầu thanh toán ngân hàng, bắt buộc dùng template dạng Thanh toán.</li>
                                </ul>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-5">
                                <h5 className="font-bold text-emerald-800">Tag 2 - Chăm sóc khách hàng (Customer Care)</h5>
                                <p className="text-sm text-emerald-900/80 mt-1 mb-2">Tích lũy điểm, biến động số dư, đổi hạng tài khoản, sinh nhật...</p>
                                <ul className="text-sm list-disc ml-5 text-emerald-900/70 marker:text-emerald-300">
                                    <li>Tuyệt đối KHÔNG quảng cáo sản phẩm mới ở nhóm này.</li>
                                    <li>Sinh nhật: Bắt buộc kèm hình ảnh thư chúc + Quà/Voucher.</li>
                                </ul>
                            </div>
                            <div className="bg-orange-50 border border-orange-100 rounded-xl p-5">
                                <h5 className="font-bold text-orange-800">Tag 3 - Hậu mãi (Promotion)</h5>
                                <p className="text-sm text-orange-900/80 mt-1 mb-2">Upsell, mã giảm giá, giới thiệu dịch vụ mới...</p>
                                <ul className="text-sm list-disc ml-5 text-orange-900/70 marker:text-orange-300">
                                    <li>Hotline SĐT ở nút dẫn ra ngoài phải là Tổng đài 1800/1900 hoặc SĐT đăng ký doanh nghiệp.</li>
                                    <li>Tất cả thông báo có mã ưu đãi bắt buộc dùng loại thiết kế Voucher của Zalo.</li>
                                    <li>Cấm/Hạn chế với ngành Thẩm mỹ viện, Rượu bia, TPCN, Phong thủy. Bắt buộc kèm giấy chứng nhận.</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Ngành nghề cấm/hạn chế */}
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-6">
                        <h4 className="text-base font-black text-rose-800 flex items-center gap-2 mb-3">
                            <ShieldAlert className="w-5 h-5" /> Ngành nghề bị cấm / Hạn chế khắt khe (Cần đối chiếu kỹ)
                        </h4>
                        <div className="text-sm text-rose-900/80 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 list-disc ml-4">
                            <li>Thực phẩm chức năng (Phải ghi "*SP ko phải là thuốc*")</li>
                            <li>Đồ uống có cồn, rượu bia</li>
                            <li>Phẫu thuật xâm lấn, hút mỡ... (Cấm gửi Tag 3)</li>
                            <li>Dịch vụ phong thủy, tử vi, bói toán</li>
                            <li>Tiền ảo/Crypto, cho vay cá nhân, bet/baccarat</li>
                            <li>Sữa cho trẻ dưới 24 tháng, đồ chơi tình dục</li>
                        </div>
                    </div>

                </div>
            </div>
        </Modal>
    );
};

export default ZbsGuidelinesModal;
