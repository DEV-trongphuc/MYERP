import React from 'react';
import { UserMinus, Download, X, Mail, Clock, ExternalLink } from 'lucide-react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';

interface StepUnsubscribeUser {
    email: string;
    phone?: string;
    name: string;
    unsubscribeDate: string;
    source: string;
    reason?: string;
}

interface StepUnsubscribeModalProps {
    isOpen: boolean;
    onClose: () => void;
    stepLabel: string;
    stepId: string;
    users: StepUnsubscribeUser[];
    onExport?: () => void;
}

const StepUnsubscribeModal: React.FC<StepUnsubscribeModalProps> = ({
    isOpen,
    onClose,
    stepLabel,
    users,
    onExport
}) => {
    const handleExportCSV = () => {
        const headers = ['Email', 'SĐT', 'Tên', 'Ngày hủy', 'Nguồn', 'Lý do'];
        const rows = users.map(u => [
            u.email,
            u.phone || '',
            u.name || 'N/A',
            new Date(u.unsubscribeDate).toLocaleString('vi-VN'),
            u.source,
            u.reason || 'N/A'
        ]);

        const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `step-unsubscribes-${stepLabel}-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        if (onExport) onExport();
    };

    const formatTime = (iso: string) => {
        if (!iso) return '--';
        return new Date(iso).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Hủy đăng kýtại: ${stepLabel}`} size="lg">
            <div className="space-y-4">
                {/* Summary */}
                <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-4 flex items-start gap-3">
                    <UserMinus className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-rose-800 mb-1">Tổng quan Hủy đăng ký</h4>
                        <p className="text-xs text-rose-700">
                            Có <strong>{users.length} người dùng</strong> đã Hủy đăng ký sau khi nhận email từ bước này.
                        </p>
                    </div>
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-end gap-3 pb-3 border-b border-slate-200">
                    <button
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-700 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Xuất CSV
                    </button>
                </div>

                {/* Users Table */}
                <div className="max-h-[400px] overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Người dùng</th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Nguồn</th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Lý do</th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Thời gian</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {!Array.isArray(users) || users.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-xs text-slate-400 italic">
                                        Không có người dùng nào Hủy đăng kýtại bước này
                                    </td>
                                </tr>
                            ) : (
                                users.map((user, i) => (
                                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                                                <div>
                                                    <p className="text-xs font-bold text-slate-700">{user.name || 'Unknown'}</p>
                                                    <p className="text-[10px] text-slate-500">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
                                                <ExternalLink className="w-3 h-3" />
                                                {user.source}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-xs text-slate-600 max-w-xs truncate" title={user.reason}>
                                                {user.reason || '--'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                                <Clock className="w-3 h-3" />
                                                {formatTime(user.unsubscribeDate)}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="flex justify-end pt-4 border-t border-slate-200">
                    <Button variant="secondary" onClick={onClose}>
                        Đóng
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default StepUnsubscribeModal;
