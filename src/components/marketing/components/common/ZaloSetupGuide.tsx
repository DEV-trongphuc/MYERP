import React from 'react';
import { HelpCircle, ExternalLink, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { API_BASE_URL, EXTERNAL_API_BASE } from '../../utils/config';

interface ZaloSetupGuideProps {
    isOpen: boolean;
    onClose: () => void;
}

const ZaloSetupGuide: React.FC<ZaloSetupGuideProps> = ({ isOpen, onClose }) => {
    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Hướng dẫn kết nối Zalo OA"
            size="lg"

        >
            <div className="space-y-6">
                {/* Introduction */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                    <div className="flex gap-3">
                        <AlertCircle className="w-6 h-6 text-blue-600 shrink-0" />
                        <div className="text-sm text-blue-800">
                            <p className="font-bold mb-2">Yêu cầu trước khi bắt đầu:</p>
                            <ul className="list-disc list-inside space-y-1 text-blue-700">
                                <li>Đã có Zalo Official Account (OA) được duyệt</li>
                                <li>Có quyền quản trị OA</li>
                                <li>Đã đăng ký Zalo Developer Account</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Step 1: OA ID */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-sm">
                            1
                        </div>
                        <h3 className="text-base font-black text-slate-800">Lấy OA ID</h3>
                    </div>
                    <div className="pl-10 space-y-3">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <p className="text-sm font-bold text-slate-700 mb-2">Cách 1: Từ Zalo OA Dashboard</p>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                                <li>Truy cập <a href="https://oa.zalo.me" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                                    https://oa.zalo.me <ExternalLink className="w-3 h-3" />
                                </a></li>
                                <li>Đăng nhập và chọn OA của bạn</li>
                                <li>Vào <strong>Cài đặt</strong> → <strong>Thông tin cơ bản</strong></li>
                                <li>OA ID sẽ hiển thị ở phần <strong>ID Official Account</strong></li>
                            </ol>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                            <strong>Lưu ý:</strong> OA ID là dãy số dài, ví dụ: <code className="bg-amber-100 px-2 py-0.5 rounded">1234567890123456789</code>
                        </div>
                    </div>
                </div>

                {/* Step 2: App ID & App Secret */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-sm">
                            2
                        </div>
                        <h3 className="text-base font-black text-slate-800">Lấy App ID & App Secret</h3>
                    </div>
                    <div className="pl-10 space-y-3">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <p className="text-sm font-bold text-slate-700 mb-3">Từ Zalo Developer Console:</p>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                                <li>Truy cập <a href="https://developers.zalo.me" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                                    https://developers.zalo.me <ExternalLink className="w-3 h-3" />
                                </a></li>
                                <li>Đăng nhập bằng tài khoản Zalo của bạn</li>
                                <li>Vào <strong>Ứng dụng của tôi</strong> → Chọn hoặc tạo ứng dụng mới</li>
                                <li>Trong phần <strong>Thông tin ứng dụng</strong>:
                                    <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                                        <li><strong>App ID</strong>: Hiển thị ngay trên trang</li>
                                        <li><strong>App Secret</strong>: Click vào biểu tượng "mắt" để xem</li>
                                    </ul>
                                </li>
                                <li>Trong phần <strong>Sản phẩm</strong>, đảm bảo đã kích hoạt:
                                    <ul className="list-disc list-inside ml-5 mt-1 space-y-1">
                                        <li><strong>Zalo Official Account API</strong></li>
                                        <li><strong>ZNS (Zalo Notification Service)</strong></li>
                                    </ul>
                                </li>
                            </ol>
                        </div>
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
                            <strong>⚠️ Bảo mật:</strong> App Secret là thông tin nhạy cảm, không chia sẻ với người khác!
                        </div>
                    </div>
                </div>

                {/* Step 3: Daily Quota */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-sm">
                            3
                        </div>
                        <h3 className="text-base font-black text-slate-800">Daily Quota (Hạn mức hàng ngày)</h3>
                    </div>
                    <div className="pl-10 space-y-3">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <p className="text-sm font-bold text-slate-700 mb-3">Hạn mức gửi tin nhắn ZNS mỗi ngày:</p>
                            <div className="space-y-2 text-sm text-slate-600">
                                <div className="flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                    <div>
                                        <strong>OA mới:</strong> Bắt đầu với <strong>5,000 tin/ngày</strong>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                    <div>
                                        <strong>Tăng hạn mức:</strong> Có thể tăng lên tối đa <strong>500,000 tin/ngày</strong> dựa trên:
                                        <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                                            <li>Chất lượng nội dung (tỷ lệ báo xấu thấp)</li>
                                            <li>Tần suất sử dụng</li>
                                            <li>Thời gian hoạt động của OA</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800">
                            <strong>💡 Mẹo:</strong> Kiểm tra hạn mức hiện tại tại <a href="https://oa.zalo.me" target="_blank" className="text-blue-600 hover:underline">Zalo OA Dashboard</a> → <strong>Thống kê</strong> → <strong>ZNS</strong>
                        </div>
                        <div className="bg-slate-100 rounded-xl p-3">
                            <p className="text-xs font-bold text-slate-600 mb-2">Nhập vào form:</p>
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value="5000"
                                    readOnly
                                    className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono"
                                />
                                <button
                                    onClick={() => copyToClipboard('5000')}
                                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Giá trị mặc định cho OA mới</p>
                        </div>
                    </div>
                </div>

                {/* Step 4: Callback URL */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-sm">
                            4
                        </div>
                        <h3 className="text-base font-black text-slate-800">Cấu hình Callback URL (Để kết nối)</h3>
                    </div>
                    <div className="pl-10 space-y-3">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <p className="text-sm font-bold text-slate-700 mb-3">Thêm URL sau vào App của bạn trên Zalo Developers:</p>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                                <li>Vào <strong>Zalo Developers</strong> → <strong>Ứng dụng của tôi</strong></li>
                                <li>Chọn App → <strong>Đăng nhập</strong></li>
                                <li>Tìm mục <strong>Callback URL</strong> (hoặc Redirect URI)</li>
                                <li>Dán đường dẫn sau vào:</li>
                            </ol>

                            <div className="mt-3 flex items-center gap-2">
                                <code className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono break-all">
                                    {EXTERNAL_API_BASE}/zalo_oauth_callback.php
                                </code>
                                <button
                                    onClick={() => copyToClipboard(`${EXTERNAL_API_BASE}/zalo_oauth_callback.php`)}
                                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                                    title="Copy URL"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                            <strong>⚠️ Lưu ý:</strong> Nếu không cấu hình đúng URL này, bạn sẽ gặp lỗi "Redirect URI mismatch" khi kết nối.
                        </div>
                    </div>
                </div>

                {/* Step 5: Webhook URL */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-black text-sm">
                            5
                        </div>
                        <h3 className="text-base font-black text-slate-800">Cấu hình Webhook (Cập nhật Trạng thái)</h3>
                    </div>
                    <div className="pl-10 space-y-3">
                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                            <p className="text-sm font-bold text-slate-700 mb-3">Để hệ thống tự động cập nhật Trạng thái Template & Gửi tin:</p>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-600">
                                <li>Vào <strong>Zalo Developers</strong> → <strong>Ứng dụng của tôi</strong></li>
                                <li>Chọn App → <strong>Webhook</strong></li>
                                <li>Kích hoạt tính năng Webhook</li>
                                <li>Dán đường dẫn sau vào ô <strong>Webhook URL</strong>:</li>
                            </ol>

                            <div className="mt-3 flex items-center gap-2">
                                <code className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-mono break-all">
                                    {EXTERNAL_API_BASE}/zalo_webhook.php
                                </code>
                                <button
                                    onClick={() => copyToClipboard(`${EXTERNAL_API_BASE}/zalo_webhook.php`)}
                                    className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shrink-0"
                                    title="Copy URL"
                                >
                                    <Copy className="w-4 h-4" />
                                </button>
                            </div>

                            <p className="text-sm font-bold text-slate-700 mt-4 mb-2">Đăng ký các sự kiện:</p>
                            <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                                <li><code>change_template_status</code> (Thay đổi Trạng thái Template)</li>
                                <li><code>user_feedback</code> (Người dùng phản hồi/đánh giá)</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Additional Resources */}
                <div className="border-t border-slate-200 pt-6">
                    <h4 className="text-sm font-black text-slate-700 mb-3 uppercase tracking-wider">Tài liệu tham khảo</h4>
                    <div className="space-y-2">
                        <a
                            href="https://developers.zalo.me/docs/official-account/bat-dau/tao-ung-dung-post-2626"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Hướng dẫn tạo ứng dụng Zalo
                        </a>
                        <a
                            href="https://developers.zalo.me/docs/zalo-notification-service/gioi-thieu/gioi-thieu-zns-post-4205"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Tài liệu Zalo Notification Service (ZNS)
                        </a>
                        <a
                            href="https://developers.zalo.me/docs/api/official-account-api/phu-luc/ma-loi-post-4307"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                            <ExternalLink className="w-4 h-4" />
                            Bảng mã lỗi API
                        </a>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default ZaloSetupGuide;
