
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
    onBulkTag,
    onBulkAddToList,
    onBulkDelete,
}) => {
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    };

    const handleCopyEmails = () => {
        const selectedMembers = subscribers.filter(s => selectedIds.has(s.id));
        const emails = selectedMembers.map(s => s.email).join(', ');
        navigator.clipboard.writeText(emails);
        showToast(`Đã sao chép ${selectedIds.size.toLocaleString()} email từ trang này`, 'success');
    };

    const handleExportCSV = () => {
        const selectedMembers = subscribers.filter(s => selectedIds.has(s.id));
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
        link.setAttribute("download", `contacts_export_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast(`Đã xuất ${selectedIds.size.toLocaleString()} liên hệ`, 'success');
    };

    const handleSendEmail = () => {
        const selectedMembers = subscribers.filter(s => selectedIds.has(s.id));
        const emails = selectedMembers.map(s => s.email).join(',');
        window.open(`mailto:?bcc=${emails}`);
    };

    return (
        <tr className="bg-[var(--color-primary-light)] border-b border-[var(--color-border)] shadow-sm animate-in fade-in duration-200">
            <th colSpan={visibleColumnsCount + 2} className="px-6 py-3">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={onToggleSelectAll} className="p-1 hover:bg-[var(--color-primary-light)] rounded text-[var(--color-primary)] transition-colors" title="Bỏ chọn tất cả">
                            <div className="relative flex items-center justify-center">
                                <input type="checkbox" checked readOnly className="peer w-5 h-5 cursor-pointer appearance-none rounded-md border-2 border-[var(--color-primary)] bg-[var(--color-primary)]" />
                                <Check className="absolute w-3.5 h-3.5 text-white pointer-events-none" />
                            </div>
                        </button>
                        <span className="text-xs font-bold text-slate-700">Đã chọn <span className="text-[var(--color-primary)] font-black text-sm">{selectedIds.size.toLocaleString()}</span> liên hệ</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={handleCopyEmails} className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-[var(--color-primary)] hover:shadow-sm transition-all" title="Sao chép Email"><Copy className="w-4 h-4" /></button>
                        <button type="button" onClick={handleExportCSV} className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-emerald-600 hover:shadow-sm transition-all" title="Xuất CSV"><Download className="w-4 h-4" /></button>
                        <button type="button" onClick={handleSendEmail} className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-[var(--color-primary)] hover:shadow-sm transition-all" title="Gửi Email"><Mail className="w-4 h-4" /></button>
                        <button type="button" onClick={onBulkTag} className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-amber-600 hover:shadow-sm transition-all" title="Gắn Tag"><Tag className="w-4 h-4" /></button>
                        <button type="button" onClick={onBulkAddToList} className="p-2 hover:bg-white rounded-lg text-slate-500 hover:text-emerald-600 hover:shadow-sm transition-all" title="Thêm vào danh sách"><List className="w-4 h-4" /></button>
                        <div className="h-4 w-px bg-[var(--color-primary-light)] mx-1"></div>
                        <button type="button" onClick={onBulkDelete} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-lg text-xs font-bold shadow-sm transition-all">
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
