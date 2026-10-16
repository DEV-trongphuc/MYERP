
import React, { useState } from 'react';
import { Mail, Send, X, Smartphone } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { api } from '../../services/storageAdapter';
import toast from 'react-hot-toast';

interface TestEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaignId: string;
    reminderId?: string;
    campaignName: string;
    campaignType?: string; // 'email' | 'zalo_zns'
}

const TestEmailModal: React.FC<TestEmailModalProps> = ({
    isOpen, onClose, campaignId, reminderId, campaignName, campaignType = 'email'
}) => {
    const [recipient, setRecipient] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSendTest = async () => {
        if (campaignType === 'zalo_zns') {
            if (!recipient || recipient.length < 10) {
                toast.error('Vui lòng nhập số điện thoại hợp lệ (84...).');
                return;
            }
        } else {
            if (!recipient || !recipient.includes('@')) {
                toast.error('Vui lòng nhập địa chỉ email hợp lệ.');
                return;
            }
        }

        setLoading(true);
        try {
            const payload: any = {
                campaign_id: campaignId,
                reminder_id: reminderId
            };

            if (campaignType === 'zalo_zns') {
                payload.phone = recipient;
            } else {
                payload.email = recipient;
            }

            const res = await api.post<any>('campaigns?route=send_test', payload);

            if (res.success) {
                toast.success(campaignType === 'zalo_zns' ? 'ZNS test đã được gửi thành công!' : 'Email test đã được gửi thành công!');
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                toast.error(res.message || 'Không thể gửi test.');
            }
        } catch (err) {
            toast.error('Đã xảy ra lỗi hệ thống.');
        }
        setLoading(false);
    };

    const isZns = campaignType === 'zalo_zns';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isZns ? "Gửi Test ZNS" : "Gửi Test Email"}
            size="sm"
            footer={
                <div className="flex gap-3 w-full">
                    <Button variant="secondary" fullWidth onClick={onClose} disabled={loading}>
                        Hủy bỏ
                    </Button>
                    <Button
                        variant="primary"
                        fullWidth
                        onClick={handleSendTest}
                        isLoading={loading}
                        icon={Send}
                    >
                        Gửi ngay
                    </Button>
                </div>
            }
        >
            <div className="space-y-6">
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isZns ? 'bg-blue-50 text-blue-500' : 'bg-amber-50 text-amber-600'}`}>
                        {isZns ? <Smartphone className="w-8 h-8" /> : <Mail className="w-8 h-8" />}
                    </div>
                    <div>
                        <h4 className="font-black text-slate-800 tracking-tight">Kiểm tra nội dung</h4>
                        <p className="text-xs text-slate-500 font-medium">Gửi bản xem trước của "{campaignName}" đến {isZns ? 'số điện thoại' : 'email'} của bạn.</p>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isZns ? 'Số điện thoại nhận test (84...)' : 'Địa chỉ email nhận test'}</label>
                    <input
                        type={isZns ? "text" : "email"}
                        value={recipient}
                        onChange={(e) => setRecipient(e.target.value)}
                        placeholder={isZns ? "84912345678" : "example@gmail.com"}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-600/20 focus:border-amber-600 transition-all placeholder:text-slate-300"
                        autoFocus
                    />
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic">
                    <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                        * {isZns ? 'Tin nhắn' : 'Email'} test sẽ được gửi ngay lập tức mà không cần đo lường. Các thẻ cá nhân hóa sẽ hiển thị dữ liệu mẫu.
                    </p>
                </div>
            </div>
        </Modal>
    );
};

export default TestEmailModal;
