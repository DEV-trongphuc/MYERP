import * as React from 'react';
import { useState, useEffect } from 'react';
import { AlertOctagon, Download, RefreshCcw, X, Mail, Clock, Trash2, ArrowRight, AlertTriangle, ShieldAlert, ChevronRight } from 'lucide-react';
import Modal from '../../common/Modal';
import Button from '../../common/Button';
import { api } from '../../../services/storageAdapter';
import { toast } from 'react-hot-toast';

interface StepErrorUser {
    subscriber_id: string;
    email: string;
    phone?: string;
    name: string;
    errorType: string;
    errorMessage: string;
    timestamp: string;
    attemptCount?: number;
}

interface StepErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    stepLabel: string;
    stepId: string;
    flowId: string;
    users: StepErrorUser[];
    availableSteps?: any[];
    exitConditions?: string[];
    onResolved?: () => void;
    onExport?: () => void;
}

const StepErrorModal: React.FC<StepErrorModalProps> = ({
    isOpen,
    onClose,
    stepLabel,
    stepId,
    flowId,
    users,
    availableSteps = [],
    exitConditions = [],
    onResolved,
    onExport
}) => {
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showMoveDialog, setShowMoveDialog] = useState(false);
    const [isMoveDialogVisible, setIsMoveDialogVisible] = useState(false);
    const [animateMoveDialogIn, setAnimateMoveDialogIn] = useState(false);
    const [targetStep, setTargetStep] = useState<any>(null);

    useEffect(() => {
        if (showMoveDialog) {
            setIsMoveDialogVisible(true);
            const timer = setTimeout(() => setAnimateMoveDialogIn(true), 10);
            return () => clearTimeout(timer);
        } else {
            setAnimateMoveDialogIn(false);
            const timer = setTimeout(() => setIsMoveDialogVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [showMoveDialog]);

    const closeMoveDialog = () => {
        setAnimateMoveDialogIn(false);
        setTimeout(() => setShowMoveDialog(false), 300);
    };

    const isBouncedExitEnabled = exitConditions.includes('bounced');

    const handleSelectAll = () => {
        if (selectedIds.length === users.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(users.map(u => u.subscriber_id));
        }
    };

    const handleToggleUser = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
        );
    };

    const handleResolveAction = async (action: 'retry' | 'move' | 'cleanup', targetId?: string) => {
        if (selectedIds.length === 0) return;

        setIsLoading(true);
        try {
            const res = await api.post<any>('flows?route=resolve-step-error', {
                action,
                flow_id: flowId,
                step_id: stepId,
                subscriber_ids: selectedIds,
                target_step_id: targetId
            });

            if (res.success) {
                toast.success(res.data.message || 'Thao tác thành công');
                setSelectedIds([]);
                setShowMoveDialog(false);
                setTargetStep(null);
                if (onResolved) onResolved();
            } else {
                toast.error(res.message || 'Có lỗi xảy ra');
            }
        } catch (err) {
            toast.error('Lỗi kết nối máy chủ');
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportCSV = () => {
        const headers = ['Email', 'SĐT', 'Tên', 'Loại lỗi', 'Thông báo lỗi', 'Thời gian', 'Số lần thử'];
        const rows = users.map(u => [
            u.email,
            u.phone || '',
            u.name || 'N/A',
            u.errorType,
            u.errorMessage,
            new Date(u.timestamp).toLocaleString('vi-VN'),
            u.attemptCount?.toString() || '1'
        ]);

        const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `step-errors-${stepLabel}-${new Date().toISOString().split('T')[0]}.csv`;
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

    const isNextStepEmail = targetStep?.type === 'action' || targetStep?.type === 'email';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Lỗi gửi mail tại: ${stepLabel}`} size="lg">
            <div className="space-y-4">
                {/* Summary & Warnings */}
                <div className="space-y-2">
                    <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start gap-3">
                        <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-rose-900 mb-1">Tổng quan lỗi</h4>
                            <p className="text-xs text-rose-700">
                                Có <strong>{users.length} người dùng</strong> gặp lỗi khi gửi email tại bước này. Hệ thống đã tạm dừng Flow cho họ để bạn xử lý thủ công.
                            </p>
                        </div>
                    </div>

                    {isBouncedExitEnabled && (
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3">
                            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                                <strong>Lưu ý:</strong> Flow này được cấu hình tự động thoát khi gặp lỗi Bounce. Bạn chỉ nên thực hiện <strong>Dọn dẹp</strong> để đảm bảo an toàn cho danh bạ.
                            </p>
                        </div>
                    )}
                </div>

                {/* Action Bar */}
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleSelectAll}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors"
                        >
                            {selectedIds.length === users.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                        </button>
                        {selectedIds.length > 0 && (
                            <span className="text-xs text-slate-500 font-medium">
                                ({selectedIds.length} đã chọn)
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {selectedIds.length > 0 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleResolveAction('retry')}
                                    disabled={isLoading || isBouncedExitEnabled}
                                    title={isBouncedExitEnabled ? "Không thể thử lại với cấu hình Bounced" : ""}
                                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 hover:text-emerald-700 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                >
                                    <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                    Thử lại

                                </button>
                                <button
                                    onClick={() => setShowMoveDialog(true)}
                                    disabled={isLoading || isBouncedExitEnabled}
                                    className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors disabled:opacity-50"
                                >
                                    <ArrowRight className="w-3.5 h-3.5" />
                                    Chuyển bước
                                </button>
                                <button
                                    onClick={() => handleResolveAction('cleanup')}
                                    disabled={isLoading}
                                    className="flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    Dọn dẹp
                                </button>
                            </div>
                        )}
                        <div className="w-px h-6 bg-slate-200 mx-1" />
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-700 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            Xuất CSV
                        </button>
                    </div>
                </div>

                {/* Users Table */}
                <div className="max-h-[400px] overflow-y-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 sticky top-0 z-10">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 w-10">
                                    <input
                                        type="checkbox"
                                        checked={selectedIds.length === users.length && users.length > 0}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300"
                                    />
                                </th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Người dùng</th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Loại lỗi</th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Thông báo</th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400">Thời gian</th>
                                <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 text-center">Lần thử</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {!Array.isArray(users) || users.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="py-8 text-center text-xs text-slate-400 italic">
                                        Không có lỗi nào được ghi nhận
                                    </td>
                                </tr>
                            ) : (
                                users.map((user, i) => (
                                    <tr key={i} className={`transition-colors ${selectedIds.includes(user.subscriber_id) ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}>
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(user.subscriber_id)}
                                                onChange={() => handleToggleUser(user.subscriber_id)}
                                                className="w-4 h-4 text-blue-600 rounded border-slate-300"
                                            />
                                        </td>
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
                                            <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                                {user.errorType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-xs text-slate-600 max-w-xs truncate" title={user.errorMessage}>
                                                {user.errorMessage}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1 text-xs text-slate-500">
                                                <Clock className="w-3 h-3" />
                                                {formatTime(user.timestamp)}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="text-xs font-bold text-slate-700">
                                                {user.attemptCount || 1}
                                            </span>
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

            {/* Move Step Dialog */}
            {isMoveDialogVisible && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                    <div
                        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${animateMoveDialogIn ? 'opacity-100' : 'opacity-0'}`}
                        onClick={closeMoveDialog}
                    />
                    <div className={`bg-white rounded-[28px] shadow-2xl border border-slate-100 w-full max-w-md overflow-hidden relative transform transition-all duration-300 ${animateMoveDialogIn ? 'scale-100 opacity-100' : 'scale-[0.95] opacity-0'}`}>
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <ArrowRight className="w-5 h-5 text-blue-600" />
                                Chuyển sang bước khác
                            </h3>
                            <button onClick={closeMoveDialog} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-500 font-medium">
                                Chọn bước tiếp theo để {selectedIds.length} người dùng này tiếp tục Flow.
                            </p>

                            <div className="max-h-60 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                                {availableSteps.filter(s => s.id !== stepId && s.type !== 'trigger').map(step => (
                                    <button
                                        key={step.id}
                                        onClick={() => setTargetStep(step)}
                                        className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center justify-between group ${targetStep?.id === step.id ? 'border-blue-600 bg-blue-50' : 'border-slate-100 hover:border-slate-200 bg-white'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${targetStep?.id === step.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-slate-700">{step.label}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{step.type}</p>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {targetStep && isNextStepEmail && (
                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl flex items-start gap-3 animate-in fade-in duration-300">
                                    <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <h5 className="text-[11px] font-bold text-orange-900 mb-1">Cònh báo uy tín tên miền</h5>
                                        <p className="text-[10px] text-orange-700 leading-relaxed italic">
                                            Bước bạn chọn là một bước <strong>gửi Email</strong>. Việc liên tiếp gửi email cho địa chỉ đã từng lỗi có thể làm giảm uy tín tên miền của bạn. Hãy cân nhắc <strong>Dọn dẹp</strong> nếu lỗi trước đó là do địa chỉ không tồn tại.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                            <Button variant="secondary" onClick={closeMoveDialog}>Hủy</Button>
                            <Button
                                onClick={() => handleResolveAction('move', targetStep?.id)}
                                disabled={!targetStep || isLoading}
                                isLoading={isLoading}
                            >
                                Xác nhận chuyển
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default StepErrorModal;
