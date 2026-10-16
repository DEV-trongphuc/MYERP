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
                            <h3 className="text-lg font-black text-amber-600 mb-2">Giới thiệu Kho Mã & Tính năng mới</h3>
                            <p>Kho Voucher giúp bạn tạo và quản lý các loại ưu đãi: <strong>Mã giảm phần trăm, Mã giảm tiền mặt, hoặc Tặng quà vật lý</strong>.</p>
                            
                            <h4 className="font-bold text-slate-800">Các khái niệm cốt lõi:</h4>
                            <ul className="space-y-3 pl-4 border-l-2 border-amber-200">
                                <li>
                                    <span className="font-bold text-blue-600">Phân bổ quà (Target Reward):</span> Khi một Chiến dịch có nhiều quà (Vd: Tặng hiện vật + Mã giảm giá), khi ấn Generate Mã (Tạo mã ngẫu nhiên), hệ thống cho phép anh <strong>Chỉ định quà nhận cụ thể</strong> hoặc <strong>Cứ rải đều 50/50 ngẫu nhiên</strong>!
                                </li>
                                <li>
                                    <span className="font-bold text-rose-600">Hạn sử dụng linh hoạt:</span> Giờ đây thiết lập chiến dịch có thể ấn định Ngày hết hạn cố định (Fix Date) HOẶC <strong>Sau X ngày kể từ khi Khách nhận mã (Dynamic Date)</strong>. Hệ thống sẽ điểm danh đỏ chót các Mã đã hết hạn trên màn hình Quản lý!
                                </li>
                                <li>
                                    <span className="font-bold text-emerald-600">Trạng thái thông minh:</span> Voucher đi qua 3 vòng đời: <span className="bg-slate-200 px-1 rounded text-slate-600 font-bold">Chờ nhận (Available)</span> &rarr; <span className="bg-amber-100 px-1 rounded text-amber-700 font-bold">Đã phân phối (Sent)</span> &rarr; <span className="bg-emerald-100 px-1 rounded text-emerald-700 font-bold">Đã sử dụng (Used)</span>.
                                </li>
                            </ul>
                            <div className="bg-blue-50 text-blue-800 p-4 rounded-xl mt-4 text-xs font-semibold">
                                <span className="text-xl">💡</span> Cơ chế bảo vệ: Khi anh Sửa chiến dịch, hệ thống sẽ bật 1 khung Chống Lỗi (Conflict Resolver) hỏi anh muốn <strong>Giữ nguyên mã cũ</strong> hay <strong>Thu hồi mã chưa dùng (Reset)</strong> để bảo vệ độ an toàn dữ liệu khách hàng!
                            </div>
                        </div>
                    )}

                    {activeTab === 'flow' && (
                        <div className="space-y-5 text-slate-700 leading-relaxed text-sm">
                            <h3 className="text-lg font-black text-amber-600 mb-2">Voucher & DOMATION (Chuẩn Enterprise)</h3>
                            <p className="font-bold text-slate-800">Hệ sinh thái Voucher đã hòa nhập 100% vào Flow Engine!</p>
                            
                            <p className="font-bold text-slate-800 border-b pb-2 pt-2">Trigger Tự động (Mốc kích hoạt bằng Voucher)</p>
                            <ul className="space-y-2 list-disc pl-5 mb-4">
                                <li><strong>Trigger: Nhận được Voucher:</strong> Ngay khi hệ thống xuất mã nhét vào túi cho khách (do khách bấm nhấp link quay thưởng), Flow tự động bắt sóng và nhả Kịch bản chúc mừng.</li>
                                <li><strong>Trigger: Sử dụng Voucher:</strong> ĐỈNH CAO CHỐT SALE! Khi thu ngân <strong>Gạch Mã</strong> ở cửa hàng (Redeem API), Flow bắt sóng và chạy thẳng luồng <strong>"Cảm ơn & Tặng quà sau Mua (ZNS)"</strong> - Mẫu kịch bản này đã có sẵn trong kho Template!</li>
                            </ul>
                            
                            <p className="font-bold text-slate-800 border-b pb-2">Chèn mã vào Tin nhắn/Email</p>
                            <p>Bạn có thể kéo thả chức năng <strong>"Voucher"</strong> vào Email, hoặc gõ tag <code className="bg-rose-100 text-rose-700 px-1 py-0.5 rounded font-mono">[VOUCHER_id_chiến_dịch]</code>. Hệ thống sẽ âm thầm phi thẳng vào Kho Mã và <strong>Xí (Cướp bằng thuật toán FOR UPDATE SKIP LOCKED siêu chống trùng lặp)</strong> 1 cái Mã trống nhét gửi vào thư.</p>
                            
                        </div>
                    )}

                    {activeTab === 'csv' && (
                        <div className="space-y-5 text-slate-700 leading-relaxed text-sm">
                            <h3 className="text-lg font-black text-amber-600 mb-2">Nhập mã / Phân phối đích danh (CSV)</h3>
                            <p>Anh đang ôm một nhóm sinh viên có sẵn, và anh đã có 1 tệp mã thẻ cào offline in trên giấy? Đây là cách anh "Map" (Ghép) chúng cho nhau.</p>
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

                            <h4 className="font-bold text-slate-800 pt-4">3 Tình huống quét File cực thông minh:</h4>
                            <ul className="space-y-2 list-disc pl-5">
                                <li><strong>Người chưa từng tồn tại:</strong> Hệ thống tự động múc SĐT/Email đó khởi tạo thành một <span className="bg-emerald-100 text-emerald-700 px-1 rounded">Lead</span> mới tinh khôi vào kho khách hàng. Tặng mã trót lọt!</li>
                                <li><strong>Nhập Sai Mã / Thiếu Mã:</strong> Hệ thống sẽ tự khước từ dòng đó, Báo Đỏ cảnh báo, các dòng còn lại vẫn Map chạy tít. Tiền trảm hậu tấu.</li>
                                <li><strong>Ứng dụng:</strong> Sau khi Map xong, anh có thể vào DOMATION, chọn mục tiêu "Gửi một nhóm Sinh Viên" &gt; Gắn Email có cái Voucher đó. DOMATION cam kết Cậu Sinh viên A nhận đúng tờ thẻ cào XMAS2024 như anh chỉ định!</li>
                            </ul>
                        </div>
                    )}

                    {activeTab === 'api' && (
                        <div className="space-y-5 text-slate-700 leading-relaxed text-sm">
                            <h3 className="text-lg font-black text-amber-600 mb-2">Đấu nối Website / MiniGame ngoài lề</h3>
                            <p>Khi tổ chức vòng quay may mắn trên web khác, hãy chèn thẳng Link Móc Nối (API webhook) này vào nút của anh:</p>
                            
                            <div className="bg-slate-800 text-green-400 p-4 rounded-xl font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
{`https://domain_cua_anh.com/api/voucher_claim.php?
campaign_id=vc_177...218
&email=nguyenvan_a@gmail.com
&event=claim_voucher_xmas
&redirect_success=https://web_cua_anh/nhan-thuong
&redirect_empty=https://web_cua_anh/het-han`}
                            </div>
                            
                            <h4 className="font-bold text-slate-800 pt-4">Nó hoạt động ra sao?</h4>
                            <ol className="space-y-3 list-decimal pl-5">
                                <li><strong>Tác nhân:</strong> Khi khách hàng nhấp chuột chạy link kiện trên.</li>
                                <li><strong>Phân xử:</strong> Nó rút ngay 1 mã Voucher nhét vào túi khách hàng. </li>
                                <li><strong>Còi báo hiệu (Trigger):</strong> Sau đó Hệ thống nổi lên sự kiện Custom Event có mã là <code className="font-bold text-amber-600">claim_voucher_xmas</code>. (Anh hãy tạo 1 Flow có nút Trigger là cái Event này nhé). Flow sẽ bắt sóng ngay lập tức và xả luồng gửi email tới tấp.</li>
                                <li><strong>Điều hướng (Redirect):</strong> Trang web sẽ tự động nhào lộn nhảy sang <code className="text-blue-500">redirect_success</code> đính kèm đuôi <code className="text-rose-500">?voucher=MÃ_CHÍNH_THỨC</code> để Web của anh biết mà hiển thị Chúc Mừng Lên Màn Hình! Nếu hết quà, nó dội văng sang <code className="text-slate-500">redirect_empty</code>.</li>
                            </ol>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default VoucherGuideModal;
