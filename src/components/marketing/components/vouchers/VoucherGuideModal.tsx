import React, { useState } from 'react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Tabs from '../common/Tabs';
import { BookOpen, Zap, FileSpreadsheet, Globe, CheckCircle } from 'lucide-react';

interface VoucherGuideModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const VoucherGuideModal: React.FC<VoucherGuideModalProps> = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('intro');

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Cẩm nang thiết lập Voucher Toàn Tập"
            size="2xl"
            footer={
                <div className="flex justify-end w-full">
                    <Button onClick={onClose} variant="primary">Đã hiểu</Button>
                </div>
            }
        >
            <div className="space-y-6">
                <Tabs 
                    variant="segmented"
                    activeId={activeTab}
                    onChange={setActiveTab}
                    items={[
                        { id: 'intro', label: 'Cơ bản', icon: BookOpen },
                        { id: 'flow', label: 'Tự động gửi (Flow)', icon: Zap },
                        { id: 'csv', label: 'Nhập file CSV', icon: FileSpreadsheet },
                        { id: 'api', label: 'Web/API ngoài', icon: Globe },
                    ]}
                />

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 h-[400px] overflow-y-auto custom-scrollbar">
                    {activeTab === 'intro' && (
                        <div className="space-y-5 text-slate-700 leading-relaxed text-sm">
                            <h3 className="text-lg font-bold text-[#BD1D2D] mb-2">Giới thiệu Kho Mã & Tính năng mới</h3>
                            <p>Kho Voucher giúp bạn tạo và quản lý các loại ưu đãi: <strong>Mã giảm phần trăm, Mã giảm tiền mặt, hoặc Tặng quà vật lý</strong>.</p>
                            
                            <h4 className="font-bold text-slate-800">Các khái niệm cốt lõi:</h4>
                            <ul className="space-y-3 pl-4 border-l-2 border-amber-200">
                                <li>
                                    <span className="font-bold text-slate-900">Phân bổ quà (Target Reward):</span> Khi một Chiến dịch có nhiều quà (Vd: Tặng hiện vật + Mã giảm giá), khi ấn Generate Mã (Tạo mã ngẫu nhiên), hệ thống cho phép <strong>Chỉ định quà nhận cụ thể</strong> hoặc <strong>Phân bổ đều 50/50 ngẫu nhiên</strong>.
                                </li>
                                <li>
                                    <span className="font-bold text-[#BD1D2D]">Hạn sử dụng linh hoạt:</span> Thiết lập chiến dịch có thể ấn định Ngày hết hạn cố định (Fix Date) HOẶC <strong>Sau X ngày kể từ khi Khách nhận mã (Dynamic Date)</strong>. Hệ thống sẽ đánh dấu đỏ các Mã đã hết hạn trên màn hình Quản lý.
                                </li>
                                <li>
                                    <span className="font-bold text-emerald-700">Trạng thái thông minh:</span> Voucher đi qua 3 vòng đời: <span className="bg-slate-200 px-1 rounded text-slate-700 font-bold">Chờ nhận (Available)</span> &rarr; <span className="bg-amber-100 px-1 rounded text-amber-800 font-bold">Đã phân phối (Sent)</span> &rarr; <span className="bg-emerald-100 px-1 rounded text-emerald-800 font-bold">Đã sử dụng (Used)</span>.
                                </li>
                            </ul>
                            <div className="bg-slate-100 text-slate-800 border border-slate-200 p-4 rounded-xl mt-4 text-xs font-semibold">
                                <span className="font-bold text-[#BD1D2D]">Cơ chế bảo vệ:</span> Khi chỉnh sửa chiến dịch, hệ thống sẽ hiển thị hộp thoại xác nhận (Conflict Resolver) để chọn <strong>Giữ nguyên mã cũ</strong> hoặc <strong>Thu hồi mã chưa dùng (Reset)</strong> nhằm bảo vệ dữ liệu khách hàng.
                            </div>
                        </div>
                    )}

                    {activeTab === 'flow' && (
                        <div className="space-y-5 text-slate-700 leading-relaxed text-sm">
                            <h3 className="text-lg font-bold text-[#BD1D2D] mb-2">Voucher & DOMATION (Chuẩn Enterprise)</h3>
                            <p className="font-bold text-slate-800">Hệ sinh thái Voucher đã đồng bộ 100% với Flow Engine.</p>
                            
                            <p className="font-bold text-slate-800 border-b pb-2 pt-2">Trigger Tự động (Mốc kích hoạt bằng Voucher)</p>
                            <ul className="space-y-2 list-disc pl-5 mb-4">
                                <li><strong>Trigger: Nhận được Voucher:</strong> Ngay khi hệ thống xuất mã cho khách (từ link quay thưởng), Flow tự động bắt sự kiện và chạy kịch bản chúc mừng.</li>
                                <li><strong>Trigger: Sử dụng Voucher:</strong> Khi thu ngân <strong>Gạch Mã</strong> tại cửa hàng (Redeem API), Flow nhận tín hiệu và chạy luồng <strong>"Cảm ơn & Tặng quà sau Mua (ZNS)"</strong> đã cấu hình sẵn trong kho Template.</li>
                            </ul>
                            
                            <p className="font-bold text-slate-800 border-b pb-2">Chèn mã vào Tin nhắn/Email</p>
                            <p>Bạn có thể kéo thả khối <strong>"Voucher"</strong> vào Email, hoặc gõ tag <code className="bg-rose-100 text-rose-700 px-1 py-0.5 rounded font-mono">[VOUCHER_id_chiến_dịch]</code>. Hệ thống sẽ lấy mã trống từ Kho Mã bằng khóa an toàn chống trùng lặp và đính kèm vào thư.</p>
                            
                        </div>
                    )}

                    {activeTab === 'csv' && (
                        <div className="space-y-5 text-slate-700 leading-relaxed text-sm">
                            <h3 className="text-lg font-bold text-[#BD1D2D] mb-2">Nhập mã / Phân phối đích danh (CSV)</h3>
                            <p>Khi đã có tệp mã thẻ ưu đãi offline và danh sách người nhận, đây là cách ghép nối (Map) dữ liệu chính xác.</p>
                            <table className="w-full text-left text-xs mb-4 border border-slate-200">
                                <thead className="bg-slate-100 font-bold">
                                    <tr>
                                        <th className="p-2 border border-slate-200">Cột A: Mã Tồn Tại</th>
                                        <th className="p-2 border border-slate-200">Cột B: Người nhận (Email/SĐT)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td className="p-2 border border-slate-200 font-mono">XMAS2024</td>
                                        <td className="p-2 border border-slate-200">anhphuc@gmail.com</td>
                                    </tr>
                                    <tr>
                                        <td className="p-2 border border-slate-200 font-mono">TET2025</td>
                                        <td className="p-2 border border-slate-200">0901234567</td>
                                    </tr>
                                </tbody>
                            </table>
                            <p className="font-bold text-rose-600 text-xs">(Không cần dòng tiêu đề, có thể lưu Excel sang định dạng .CSV và tải lên ngay).</p>

                            <h4 className="font-bold text-slate-800 pt-4">3 Tình huống xử lý File:</h4>
                            <ul className="space-y-2 list-disc pl-5">
                                <li><strong>Người chưa từng tồn tại:</strong> Hệ thống tự động lấy SĐT/Email đó khởi tạo thành một <span className="bg-emerald-100 text-emerald-700 px-1 rounded">Lead</span> mới trong kho khách hàng và cấp mã.</li>
                                <li><strong>Nhập Sai Mã / Thiếu Mã:</strong> Hệ thống tự động bỏ qua dòng lỗi và hiển thị cảnh báo đỏ, các dòng hợp lệ còn lại vẫn được xử lý bình thường.</li>
                                <li><strong>Ứng dụng:</strong> Sau khi Map xong, bạn có thể vào DOMATION, chọn mục tiêu và gắn Email chứa Voucher để đảm bảo mỗi người nhận đúng mã đã chỉ định.</li>
                            </ul>
                        </div>
                    )}

                    {activeTab === 'api' && (
                        <div className="space-y-5 text-slate-700 leading-relaxed text-sm">
                            <h3 className="text-lg font-bold text-[#BD1D2D] mb-2">Đấu nối Website / MiniGame ngoài lề</h3>
                            <p>Khi tổ chức chương trình ưu đãi trên website khác, chèn API webhook dưới đây vào sự kiện nút bấm:</p>
                            
                            <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
{`https://domain_cua_anh.com/api/voucher_claim.php?
campaign_id=vc_177...218
&email=nguyenvan_a@gmail.com
&event=claim_voucher_xmas
&redirect_success=https://web_cua_anh/nhan-thuong
&redirect_empty=https://web_cua_anh/het-han`}
                            </div>
                            
                            <h4 className="font-bold text-slate-800 pt-4">Cơ chế hoạt động:</h4>
                            <ol className="space-y-3 list-decimal pl-5">
                                <li><strong>Tác nhân:</strong> Khách hàng nhấn nút kích hoạt liên kết trên.</li>
                                <li><strong>Phân xử:</strong> Hệ thống xuất 1 mã Voucher hợp lệ gán cho khách hàng.</li>
                                <li><strong>Trigger sự kiện:</strong> Hệ thống phát sinh Custom Event với mã <code className="font-bold text-[#BD1D2D]">claim_voucher_xmas</code> để kích hoạt Flow Automation tương ứng.</li>
                                <li><strong>Điều hướng (Redirect):</strong> Trang web tự động chuyển hướng sang <code className="text-slate-700 font-semibold">redirect_success</code> kèm tham số <code className="text-[#BD1D2D] font-semibold">?voucher=MÃ_CHÍNH_THỨC</code>. Nếu hết mã, chuyển sang <code className="text-slate-500">redirect_empty</code>.</li>
                            </ol>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default VoucherGuideModal;
