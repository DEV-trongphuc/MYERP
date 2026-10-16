
import React from 'react';
import { UserMinus, Trash2, AlertTriangle } from 'lucide-react';
import Radio from '../../common/Radio';

interface RemoveActionConfigProps {
    config: Record<string, any>;
    onChange: (newConfig: Record<string, any>, newLabel?: string) => void;
    disabled?: boolean;
}

const RemoveActionConfig: React.FC<RemoveActionConfigProps> = ({ config, onChange, disabled }) => {
    const actionType = config.actionType || 'unsubscribe';

    const handleActionChange = (type: string) => {
        if (disabled) return;

        let label = 'Dọn dẹp';
        if (type === 'unsubscribe') label = 'Hủy đăng ký'
        if (type === 'delete_contact') label = 'Xóa vĩnh viễn';

        onChange({ ...config, actionType: type }, label);
    };

    const options = [
        { id: 'unsubscribe', label: 'Hủy đăng ký', desc: 'Chuyển Trạng thái sang Unsubscribed. Khách sẽ không nhận được email nữa.', icon: UserMinus },
        { id: 'delete_contact', label: 'Xóa vĩnh viễn (Delete)', desc: 'Xóa hoàn toàn user khỏi hệ thống. Hành động này không thể hoàn tác.', icon: Trash2 },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3 text-rose-800">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <p className="text-xs font-medium leading-relaxed">
                    Đây là hành động <strong>Hủy bỏ/Xóa</strong>. Vui lòng đảm bảo luồng Logic đã kiểm tra kỹ trước khi thực hiện bước này để tránh mất dữ liệu quan trọng.
                </p>
            </div>

            <Radio
                label="Hành động thực hiện:"
                options={options}
                value={actionType}
                onChange={handleActionChange}
                disabled={disabled}
            />

            {actionType === 'delete_contact' && (
                <div className="p-4 border-2 border-red-100 bg-red-50 rounded-2xl animate-in slide-in-from-top-2">
                    <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-1">Cảnh báo dữ liệu</p>
                    <p className="text-[11px] text-red-500">
                        Khách hàng sẽ bị xóa vĩnh viễn khỏi Database. Mọi lịch sử mở mail, click link cũng sẽ bị xóa.
                    </p>
                </div>
            )}
        </div>
    );
};

export default RemoveActionConfig;
