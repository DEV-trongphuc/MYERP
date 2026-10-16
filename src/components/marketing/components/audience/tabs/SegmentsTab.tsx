import React, { useState } from 'react';
import { Layers, RefreshCw, Filter, Edit3, Trash2, Check, X, Scissors, Eraser } from 'lucide-react';
import Skeleton from '../../common/Skeleton';
import Pagination from '../../common/Pagination';
import { Segment } from '../../../types';
import { AudienceEmptyState, ROW_CLASS, TD_CLASS, TH_CLASS, THEAD_CLASS } from '../AudienceUi';

interface SegmentsTabProps {
    loading?: boolean;
    segments: Segment[];
    currentPage?: number;
    totalPages?: number;
    totalCount?: number;
    itemsPerPage?: number;
    onPageChange?: (page: number) => void;
    onView: (segment: Segment) => void;
    onEdit: (segment: Segment) => void;
    onDelete: (id: string) => void;
    onBulkDelete?: (ids: string[]) => void;
    onSplit?: (segment: Segment) => void;
    onRefresh?: () => void;
    onCleanup: (segment: Segment) => void;
    onCreate?: () => void;
}

interface SegmentRowProps {
    seg: Segment;
    isSelected: boolean;
    onView: (seg: Segment) => void;
    onToggleSelect: (id: string) => void;
    onSplit: ((seg: Segment) => void) | undefined;
    onCleanup: (seg: Segment) => void;
    onEdit: (seg: Segment) => void;
    onDelete: (id: string) => void;
}

const SegmentRow = React.memo<SegmentRowProps>(({ seg, isSelected, onView, onToggleSelect, onSplit, onCleanup, onEdit, onDelete }) => {
    return (
        <tr
            className={`group/row ${ROW_CLASS} cursor-pointer ${isSelected ? 'bg-[var(--color-primary-light)]' : ''}`}
            onClick={() => onView(seg)}
        >
            <td className="pl-4 pr-2 py-3 w-10" onClick={(e) => { e.stopPropagation(); onToggleSelect(seg.id); }}>
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
                    <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center shrink-0 border border-[var(--color-border)]">
                        <Layers className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-[var(--color-text)] group-hover/row:text-[var(--color-primary)] transition-colors truncate">{seg.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)] truncate max-w-[260px]">{seg.description || 'Phân khúc động'}</p>
                    </div>
                </div>
            </td>
            <td className={TD_CLASS}>
                <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                    <span className="text-xs font-mono text-[var(--color-text-light)] bg-[var(--color-bg)] px-2 py-0.5 rounded border border-[var(--color-border)] truncate max-w-[180px]">
                        {seg.criteria && seg.criteria.startsWith('[') ? 'Bộ điều kiện nâng cao' : (seg.criteria || 'Tùy chỉnh')}
                    </span>
                </div>
            </td>
            <td className={TD_CLASS}>
                <span className="inline-flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
                    <RefreshCw className="w-3 h-3" />
                    Tự động đồng bộ
                </span>
            </td>
            <td className={`${TD_CLASS} text-right`}>
                <span className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">{(seg.count || 0).toLocaleString('vi-VN')}</span>
            </td>
            <td className={`${TD_CLASS} text-right`}>
                <div className="flex items-center justify-end gap-1">
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onSplit && onSplit(seg); }}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] rounded-[var(--radius-sm)] transition-colors"
                        title="Tách phân khúc"
                    >
                        <Scissors className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCleanup(seg); }}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-amber-600 hover:bg-amber-50 rounded-[var(--radius-sm)] transition-colors"
                        title="Dọn dẹp phân khúc"
                    >
                        <Eraser className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onEdit(seg); }}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] rounded-[var(--radius-sm)] transition-colors"
                        title="Chỉnh sửa cấu hình"
                    >
                        <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDelete(seg.id); }}
                        className="p-1.5 text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 rounded-[var(--radius-sm)] transition-colors"
                        title="Xóa phân khúc"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            </td>
        </tr>
    );
});
SegmentRow.displayName = 'SegmentRow';

const SegmentSkeleton = () => (
    <tr className="border-b border-[var(--color-border-light)]">
        <td className="pl-4 pr-2 py-3 w-10"><Skeleton variant="rounded" width={16} height={16} /></td>
        <td className={TD_CLASS}>
            <div className="flex items-center gap-3">
                <Skeleton variant="rounded" width={32} height={32} className="rounded-[var(--radius-md)]" />
                <div className="space-y-1.5">
                    <Skeleton variant="text" width={140} height={14} />
                    <Skeleton variant="text" width={100} height={11} />
                </div>
            </div>
        </td>
        <td className={TD_CLASS}><Skeleton variant="text" width={110} height={14} /></td>
        <td className={TD_CLASS}><Skeleton variant="text" width={80} height={12} /></td>
        <td className={`${TD_CLASS} text-right`}><Skeleton variant="text" width={40} height={14} className="ml-auto" /></td>
        <td className={`${TD_CLASS} text-right`}>
            <div className="flex justify-end gap-1.5">
                {[...Array(4)].map((_, i) => <Skeleton key={i} variant="rounded" width={24} height={24} />)}
            </div>
        </td>
    </tr>
);

const SegmentsTab: React.FC<SegmentsTabProps> = ({
    loading, segments, currentPage = 1, totalPages = 1, totalCount = 0, itemsPerPage = 10,
    onPageChange, onView, onEdit, onDelete, onBulkDelete, onSplit, onCleanup, onCreate
}) => {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const isFirstLoad = loading && segments.length === 0;

    const toggleSelectAll = React.useCallback(() => {
        setSelectedIds(prev => {
            const allSelected = segments.length > 0 && segments.every(s => prev.has(s.id));
            if (allSelected) {
                return new Set();
            } else {
                return new Set(segments.map(s => s.id));
            }
        });
    }, [segments]);

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

    const handleCancelSelection = React.useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    const isAllSelected = segments.length > 0 && segments.every(s => selectedIds.has(s.id));

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
                                            <span className="text-xs font-semibold text-[var(--color-text)]">Đã chọn <b className="text-[var(--color-primary)]">{selectedIds.size.toLocaleString('vi-VN')}</b> phân khúc</span>
                                        </div>
                                        <div className="flex items-center gap-2">
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
                                        disabled={segments.length === 0}
                                        className={`w-4 h-4 rounded border flex items-center justify-center ${isAllSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
                                    >
                                        {isAllSelected && <Check className="w-3 h-3 text-white" />}
                                    </button>
                                </th>
                                <th className={TH_CLASS}>Tên phân khúc</th>
                                <th className={TH_CLASS}>Điều kiện lọc</th>
                                <th className={TH_CLASS}>Đồng bộ</th>
                                <th className={`${TH_CLASS} text-right`}>Kết quả</th>
                                <th className={`${TH_CLASS} text-right w-36`}>Thao tác</th>
                            </tr>
                        )}
                    </thead>
                    <tbody>
                        {isFirstLoad && Array.from({ length: 5 }).map((_, i) => <SegmentSkeleton key={i} />)}
                        {!isFirstLoad && segments.map(seg => (
                            <SegmentRow
                                key={seg.id}
                                seg={seg}
                                isSelected={selectedIds.has(seg.id)}
                                onView={onView}
                                onToggleSelect={toggleSelectOne}
                                onSplit={onSplit}
                                onCleanup={onCleanup}
                                onEdit={onEdit}
                                onDelete={onDelete}
                            />
                        ))}
                        {!loading && segments.length === 0 && (
                            <tr>
                                <td colSpan={6}>
                                    <AudienceEmptyState
                                        icon={Layers}
                                        title="Chưa có phân khúc động nào"
                                        description="Tạo phân khúc động để tự động lọc khách hàng theo hành vi, nhãn hoặc điểm Lead."
                                        actionLabel={onCreate ? 'Tạo phân khúc' : undefined}
                                        onAction={onCreate}
                                    />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {onPageChange && (
                <div className="border-t border-[var(--color-border-light)] px-4">
                    <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalCount={totalCount}
                        itemsPerPage={itemsPerPage}
                        onPageChange={onPageChange}
                    />
                </div>
            )}
        </>
    );
};

export default SegmentsTab;

