import React from 'react';
import { Copy, Download, Mail, Tag, List, Trash2, Check } from 'lucide-react';
import { Subscriber } from '../../types';
import toast from 'react-hot-toast';

interface BulkActionsToolbarProps {
    selectedIds: Set<string>;
    subscribers: Subscriber[];
    visibleColumnsCount: number;
    isGlobalSelected: boolean;
    onToggleSelectAll: () => void;
    onClearSelection?: () => void;
    onBulkTag: () => void;
    onBulkAddToList: () => void;
    onBulkDelete: () => void;
}

const BulkActionsToolbar: React.FC<BulkActionsToolbarProps> = ({
    selectedIds,
    subscribers,
    visibleColumnsCount,
    isGlobalSelected,
    onToggleSelectAll,
    onClearSelection,
    onBulkTag,
    onBulkAddToList,
    onBulkDelete,
}) => {
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    };

    const isAllPageSelected = subscribers.length > 0 && subscribers.every(s => selectedIds.has(s.id));

    const handleCopyEmails = () => {
        const selectedMembers = subscribers.filter(s => selectedIds.has(s.id));
        const emails = selectedMembers.map(s => s.email).filter(Boolean).join(', ');
        if (!emails) {
            showToast('Không có email nào để sao chép', 'info');
            return;
        }
        navigator.clipboard.writeText(emails);
        showToast(`Đã sao chép ${selectedMembers.length.toLocaleString('vi-VN')} email từ trang này`, 'success');
    };

    const handleExportCSV = () => {
        const selectedMembers = subscribers.filter(s => selectedIds.has(s.id));
        if (selectedMembers.length === 0) {
            showToast('Không có dữ liệu liên hệ để xuất', 'info');
            return;
        }
        const header = ['ID', 'Email', 'SĐT', 'First Name', 'Last Name', 'Giới tính', 'Địa chỉ', 'Công ty', 'Nguồn', 'Status', 'Joined At', 'Tags'];
        const rows = selectedMembers.map(s => [
            s.id,
            s.email,
            s.phoneNumber || '',
            s.firstName || '',
            s.lastName || '',
            s.gender || '',
            s.address || '',
            s.companyName || '',
            s.source || '',
            s.status,
            s.joinedAt,
            (Array.isArray(s.tags) ? s.tags : []).join(';')
        ]);
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + 
            [header, ...rows].map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `contacts_export_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Đã xuất ${selectedMembers.length.toLocaleString('vi-VN')} liên hệ từ trang này`, 'success');
    };

    const handleSendEmail = () => {
        const selectedMembers = subscribers.filter(s => selectedIds.has(s.id));
        const emails = selectedMembers.map(s => s.email).filter(Boolean).join(',');
        if (!emails) {
            showToast('Không có email hợp lệ để gửi', 'info');
            return;
        }
        window.open(`mailto:?bcc=${emails}`);
    };

    return (
        <tr className="bg-[var(--color-primary-light)] border-b border-[var(--color-border)] shadow-sm animate-in fade-in duration-200">
            <th colSpan={visibleColumnsCount + 2} className="px-6 py-3">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClearSelection || onToggleSelectAll}
                            className="p-1 hover:bg-white/80 dark:hover:bg-slate-800/80 rounded transition-colors"
                            title="Bỏ chọn tất cả"
                        >
                            <span className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isAllPageSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-primary)] bg-[var(--color-surface)]'}`}>
                                {isAllPageSelected ? (
                                    <Check className="w-3 h-3 text-white" />
                                ) : (
                                    <div className="w-2 h-0.5 bg-[var(--color-primary)] rounded-full" />
                                )}
                            </span>
                        </button>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                                Đã chọn <span className="text-[var(--color-primary)] font-black text-sm">{selectedIds.size.toLocaleString('vi-VN')}</span> liên hệ
                            </span>
                            {onClearSelection && (
                                <button
                                    type="button"
                                    onClick={onClearSelection}
                                    className="text-xs font-semibold text-[var(--color-primary)] hover:underline ml-1"
                                >
                                    (Bỏ chọn)
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={handleCopyEmails} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-[var(--color-primary)] hover:shadow-sm transition-all" title="Sao chép Email"><Copy className="w-4 h-4" /></button>
                        <button type="button" onClick={handleExportCSV} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-emerald-600 hover:shadow-sm transition-all" title="Xuất CSV"><Download className="w-4 h-4" /></button>
                        <button type="button" onClick={handleSendEmail} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-[var(--color-primary)] hover:shadow-sm transition-all" title="Gửi Email"><Mail className="w-4 h-4" /></button>
                        <button type="button" onClick={onBulkTag} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-amber-600 hover:shadow-sm transition-all" title="Gắn Tag"><Tag className="w-4 h-4" /></button>
                        <button type="button" onClick={onBulkAddToList} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-emerald-600 hover:shadow-sm transition-all" title="Thêm vào danh sách"><List className="w-4 h-4" /></button>
                        <div className="h-4 w-px bg-[var(--color-border)] mx-1"></div>
                        <button type="button" onClick={onBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg text-xs font-bold shadow-sm transition-all">
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{isGlobalSelected ? 'Xóa TẤT CẢ' : 'Xóa nhanh'}</span>
                        </button>
                    </div>
                </div>
            </th>
        </tr>
    );
};

export default BulkActionsToolbar;
