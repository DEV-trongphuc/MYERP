import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, stripLegacyClasses } from './cn';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  itemsPerPage?: number;
  onPageChange: (page: number) => void;
  className?: string;
  isDarkTheme?: boolean;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalCount,
  itemsPerPage,
  onPageChange,
  className = '',
}) => {
  if (totalPages <= 1) return null;

  const hasRange = itemsPerPage !== undefined && itemsPerPage > 0 && totalCount > 0;
  const from = hasRange ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const to = hasRange ? Math.min(currentPage * itemsPerPage, totalCount) : 0;

  const range: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start < maxVisible - 1) {
    start = Math.max(1, end - maxVisible + 1);
  }
  for (let i = start; i <= end; i++) {
    range.push(i);
  }

  return (
    <div
      className={cn(
        'px-4 py-2.5 border-t border-[var(--color-border)] bg-[var(--color-surface)] flex flex-wrap items-center justify-between gap-3',
        stripLegacyClasses(className),
      )}
    >
      <div className="text-xs font-medium text-[var(--color-text-muted)] whitespace-nowrap flex items-center gap-1 shrink-0">
        {hasRange ? (
          <>
            <span>Hiển thị</span>
            <strong className="font-semibold text-[var(--color-text)]">{from.toLocaleString()}</strong>
            <span>&ndash;</span>
            <strong className="font-semibold text-[var(--color-text)]">{to.toLocaleString()}</strong>
            <span>trên</span>
            <strong className="font-semibold text-[var(--color-text)]">{totalCount.toLocaleString()}</strong>
          </>
        ) : (
          <>
            <span>Tổng:</span>
            <strong className="font-semibold text-[var(--color-text)]">{totalCount.toLocaleString()}</strong>
            <span>kết quả (Trang {currentPage}/{totalPages})</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          title="Trang trước"
          aria-label="Trang trước"
          className="w-8 h-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-bg)] inline-flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {range.map((pageNum) => {
          const isActive = currentPage === pageNum;
          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'min-w-[32px] h-8 px-2 rounded-[var(--radius-md)] text-xs font-semibold transition-colors inline-flex items-center justify-center cursor-pointer',
                isActive
                  ? 'bg-[var(--color-primary)] text-white border border-[var(--color-primary)] shadow-[var(--shadow-xs)]'
                  : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-bg)]',
              )}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          title="Trang sau"
          aria-label="Trang sau"
          className="w-8 h-8 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-bg)] inline-flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default Pagination;


