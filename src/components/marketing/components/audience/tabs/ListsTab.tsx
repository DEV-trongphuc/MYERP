import * as React from 'react';
import { useState } from 'react';
import {
    Trash2, Edit3, Calendar, UserPlus,
    List, Check, X, Scissors, Eraser,
    Upload, GitMerge, Download
} from 'lucide-react';
import Skeleton from '../../common/Skeleton';
import Pagination from '../../common/Pagination';
import { AudienceEmptyState, ROW_CLASS, TD_CLASS, TH_CLASS, THEAD_CLASS } from '../AudienceUi';

interface ListRowProps {
    list: any;
    isSelected: boolean;
    onView: (list: any) => void;
    onToggleSelect: (id: string) => void;
    onEdit: (list: any) => void;
    onDelete: (id: string) => void;
    onCleanup: (list: any) => void;
    onSplit?: (list: any) => void;
    onExport?: (list: any) => void;
}

const ListRow = React.memo(({ list, isSelected, onView, onToggleSelect, onEdit, onDelete, onCleanup, onSplit, onExport }: ListRowProps) => {
    return (
        <tr
            onClick={() => onView(list)}
            className={`group/row ${ROW_CLASS} cursor-pointer ${isSelected ? 'bg-[var(--color-primary-light)]' : ''}`}
        >
            <td className="pl-4 pr-2 py-3 w-10" onClick={(e) => { e.stopPropagation(); onToggleSelect(list.id); }}>
                <span
                    role="checkbox"
                    aria-checked={isSelected}
                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
                >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                </span>
            </td>
            <td className={TD_CLASS}>
                <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all ${list.source === 'Google Sheets'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                        : list.source === 'MISA CRM'
                            ? 'bg-sky-50 border-sky-200 text-sky-600'
                            : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/15 dark:text-emerald-400'
                        }`}>
                        {list.source === 'Google Sheets' ? (
                            <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" className="w-4 h-4 object-contain" alt="GS" />
                        ) : list.source === 'MISA CRM' ? (
                            <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlIpztniIEN5ZYvLlwwqBvhzdodvu2NfPSbg&s" className="w-4 h-4 object-contain rounded" alt="MISA" />
                        ) : (
                            <List className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        )}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--color-text)] group-hover/row:text-emerald-600 transition-colors truncate">{list.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {list.type === 'sync' ? 'Danh sách đồng bộ' : 'Danh sách tĩnh'}
                        </p>
                    </div>
                </div>
            </td>
            <td className={TD_CLASS}>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[var(--color-bg)] text-[var(--color-text-light)] text-xs font-medium border border-[var(--color-border)]">
                    {list.source === 'Google Sheets' ? (
                        <img src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png" className="w-3 h-3 object-contain" alt="GS" />
                    ) : list.source === 'MISA CRM' ? (
                        <img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlIpztniIEN5ZYvLlwwqBvhzdodvu2NfPSbg&s" className="w-3 h-3 object-contain rounded-sm" alt="MISA" />
                    ) : list.source === 'Import CSV' ? (
                        <Upload className="w-3 h-3" />
                    ) : (
                        <UserPlus className="w-3 h-3" />
                    )}
                    {list.source || 'Manual'}
                </span>
            </td>
            <td className={TD_CLASS}>
                <div className="flex items-center gap-1.5 text-[var(--color-text-muted)] text-xs tabular-nums">
                    <Calendar className="w-3.5 h-3.5" />
                    {list.created}
                </div>
            </td>
            <td className={`${TD_CLASS} text-right`}>
                <span className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">{(list.count || 0).toLocaleString('vi-VN')}</span>
            </td>
            <td className={`${TD_CLASS} text-right`}>
                <div className="flex items-center justify-end gap-1">
                    {onExport && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onExport(list); }}
                            className="p-1.5 text-[var(--color-text-muted)] hover:text-emerald-600 hover:bg-emerald-50 rounded-[var(--radius-sm)] transition-colors"
                            title="Xuất CSV"
                        >
                            <Download className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSplit && onSplit(list); }}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] rounded-[var(--radius-sm)] transition-colors"
                        title="Tách danh sách"
                    >
                        <Scissors className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEdit(list); }}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] rounded-[var(--radius-sm)] transition-colors"
                        title="Chỉnh sửa danh sách"
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCleanup(list); }}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-amber-600 hover:bg-amber-50 rounded-[var(--radius-sm)] transition-colors"
                        title="Dọn dẹp danh sách"
                    >
                        <Eraser className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDelete(list.id); }}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 rounded-[var(--radius-sm)] transition-colors"
                        title="Xóa danh sách"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </td>
        </tr>
    );
});
ListRow.displayName = 'ListRow';

const ListSkeleton = () => (
    <tr className="border-b border-[var(--color-border-light)]">
        <td className="pl-4 pr-2 py-3 w-10"><Skeleton variant="rounded" width={16} height={16} /></td>
        <td className={TD_CLASS}>
            <div className="flex items-center gap-3">
                <Skeleton variant="rounded" width={32} height={32} className="rounded-[var(--radius-md)]" />
                <div className="space-y-1.5">
                    <Skeleton variant="text" width={140} height={14} />
                    <Skeleton variant="text" width={80} height={11} />
                </div>
            </div>
        </td>
        <td className={TD_CLASS}><Skeleton variant="rounded" width={90} height={22} /></td>
        <td className={TD_CLASS}><Skeleton variant="text" width={90} height={12} /></td>
        <td className={`${TD_CLASS} text-right`}><Skeleton variant="text" width={40} height={14} className="ml-auto" /></td>
        <td className={`${TD_CLASS} text-right`}>
            <div className="flex justify-end gap-1.5">
                {[...Array(4)].map((_, i) => <Skeleton key={i} variant="rounded" width={24} height={24} />)}
            </div>
        </td>
    </tr>
);

interface ListsTabProps {
    loading: boolean;
    lists: any[];
    currentPage: number;
    totalPages: number;
    totalCount: number;
    itemsPerPage: number;
    onPageChange: (page: number) => void;
    onView: (list: any) => void;
    onEdit: (list: any) => void;
    onDelete: (id: string) => void;
    onBulkDelete?: (ids: string[]) => void;
    onMerge?: (ids: string[]) => void;
    onCleanup: (list: any) => void;
    onSplit?: (list: any) => void;
    onExport?: (list: any) => void;
    onBulkExport?: (ids: string[]) => void;
    onCreate?: () => void;
}

const ListsTab: React.FC<ListsTabProps> = ({
    loading, lists, currentPage = 1, totalPages = 1, totalCount = 0, itemsPerPage = 10,
    onPageChange, onView, onEdit, onDelete, onBulkDelete, onMerge, onCleanup, onSplit, onExport, onBulkExport, onCreate
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const isFirstLoad = loading && lists.length === 0;

    const toggleSelectAll = React.useCallback(() => {
        setSelectedIds(prev => {
            const allSelected = lists.length > 0 && lists.every(l => prev.has(l.id));
            if (allSelected) {
                return new Set();
            } else {
                return new Set(lists.map(l => l.id));
            }
        });
    }, [lists]);

    const toggleSelectOne = React.useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    }, []);

    const handleBulkDelete = React.useCallback(() => {
        if (onBulkDelete) {
            onBulkDelete(Array.from(selectedIds));
            setSelectedIds(new Set());
        }
    }, [onBulkDelete, selectedIds]);

    const handleMerge = React.useCallback(() => {
        if (onMerge && selectedIds.size >= 2) {
            onMerge(Array.from(selectedIds));
        }
    }, [onMerge, selectedIds]);

    const handleBulkExport = React.useCallback(() => {
        if (onBulkExport) {
            onBulkExport(Array.from(selectedIds));
        }
    }, [onBulkExport, selectedIds]);

    const handleCancelSelection = React.useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const isAllSelected = lists.length > 0 && lists.every(l => selectedIds.has(l.id));

    return (
        <>
            <div className={`overflow-x-auto transition-opacity ${loading && !isFirstLoad ? 'opacity-60' : ''}`}>
                <table className="w-full text-sm border-collapse">
                    <thead className={THEAD_CLASS}>
                        {selectedIds.size > 0 ? (
                            <tr className="bg-[var(--color-primary-light)] border-b border-[var(--color-border)]">
                                <th colSpan={6} className="px-4 py-2.5">
                                    <div className="flex items-center justify-between w-full">
                                        <div className="flex items-center gap-3">
                                            <button type="button" onClick={toggleSelectAll} className="w-4 h-4 rounded border border-[var(--color-primary)] bg-[var(--color-primary)] flex items-center justify-center" title="Bỏ chọn tất cả">
                                                <Check className="w-3 h-3 text-white" />
                                            </button>
                                            <span className="text-xs font-semibold text-[var(--color-text)]">Đã chọn <b className="text-[var(--color-primary)]">{selectedIds.size.toLocaleString('vi-VN')}</b> danh sách</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {selectedIds.size >= 2 && onMerge && (
                                                <button
                                                    type="button"
                                                    onClick={handleMerge}
                                                    className="h-8 inline-flex items-center gap-1.5 px-3 bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-primary)] hover:bg-[var(--color-bg)] rounded-[var(--radius-md)] text-xs font-semibold transition-colors"
                                                >
                                                    <GitMerge className="w-3.5 h-3.5" />
                                                    <span>Gộp danh sách</span>
                                                </button>
                                            )}
                                            {onBulkExport && (
                                                <button
                                                    type="button"
                                                    onClick={handleBulkExport}
                                                    className="h-8 inline-flex items-center gap-1.5 px-3 bg-[var(--color-surface)] border border-[var(--color-border)] text-emerald-600 hover:bg-emerald-50 rounded-[var(--radius-md)] text-xs font-semibold transition-colors"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    <span>Xuất CSV</span>
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={handleBulkDelete}
                                                className="h-8 inline-flex items-center gap-1.5 px-3 bg-[var(--color-surface)] border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-[var(--radius-md)] text-xs font-semibold transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                                <span>Xóa đã chọn</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCancelSelection}
                                                className="p-1.5 hover:bg-[var(--color-surface)] rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                                                title="Hủy chọn"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </th>
                            </tr>
                        ) : (
                            <tr className="border-b border-[var(--color-border)]">
                                <th className="pl-4 pr-2 py-3 w-10">
                                    <button
                                        type="button"
                                        onClick={toggleSelectAll}
                                        disabled={lists.length === 0}
                                        className={`w-4 h-4 rounded border flex items-center justify-center ${isAllSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
                                    >
                                        {isAllSelected && <Check className="w-3 h-3 text-white" />}
                                    </button>
                                </th>
                                <th className={TH_CLASS}>Tên danh sách</th>
                                <th className={TH_CLASS}>Nguồn</th>
                                <th className={TH_CLASS}>Ngày tạo</th>
                                <th className={`${TH_CLASS} text-right`}>Số lượng</th>
                                <th className={`${TH_CLASS} text-right w-36`}>Thao tác</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {isFirstLoad && Array.from({ length: 6 }).map((_, i) => <ListSkeleton key={i} />)}
                        {!isFirstLoad && lists.map(list => (
                            <ListRow
                                key={list.id}
                                list={list}
                                isSelected={selectedIds.has(list.id)}
                                onView={onView}
                                onToggleSelect={toggleSelectOne}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onCleanup={onCleanup}
                                onSplit={onSplit}
                                onExport={onExport}
                            />
                        ))}
                        {!loading && lists.length === 0 && (
                            <tr>
                                <td colSpan={6}>
                                    <AudienceEmptyState
                                        icon={List}
                                        title="Chưa có danh sách tĩnh nào"
                                        description="Tạo danh sách tĩnh để gom nhóm khách hàng từ file CSV hoặc chiến dịch cụ thể."
                                        actionLabel={onCreate ? 'Tạo danh sách' : undefined}
                                        onAction={onCreate}
                                    />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            <div className="border-t border-[var(--color-border-light)] px-4">
                <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalCount={totalCount}
                    itemsPerPage={itemsPerPage}
                    onPageChange={onPageChange}
                />
            </div>
        </>
    );
};

export default ListsTab;

