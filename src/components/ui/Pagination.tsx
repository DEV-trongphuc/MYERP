import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  total: number;
  page: number;
  pageSize?: number;
  onChange: (page: number) => void;
  showSizeChanger?: boolean;
  onPageSizeChange?: (size: number) => void;
  isLightText?: boolean;
}

export const Pagination: React.FC<PaginationProps> = ({
  total,
  page,
  pageSize = 50,
  onChange,
  showSizeChanger,
  onPageSizeChange,
  isLightText = false,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (page > 4) pages.push('...');
    for (let i = Math.max(2, page - 2); i <= Math.min(totalPages - 1, page + 2); i++) pages.push(i);
    if (page < totalPages - 3) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  if (total === 0) return null;

  return (
    <div 
      className="pagination"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '1rem 0',
        background: 'transparent',
        flexWrap: 'wrap',
        gap: '1rem'
      }}
    >
      <div 
        className="pagination-info"
        style={{
          fontSize: '0.8125rem',
          color: isLightText ? '#ffffff' : 'var(--color-text-muted)',
          textShadow: isLightText ? '0 1px 3px rgba(0, 0, 0, 0.7)' : 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          flexWrap: 'wrap',
          fontWeight: isLightText ? 500 : 'normal'
        }}
      >
        Hiển thị <strong style={{ color: isLightText ? '#ffffff' : 'inherit' }}>{start}</strong> - <strong style={{ color: isLightText ? '#ffffff' : 'inherit' }}>{end}</strong> trên <strong style={{ color: isLightText ? '#ffffff' : 'inherit' }}>{total}</strong>
      </div>

      <div 
        className="pagination-pages"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}
      >
        <button
          className="pagination-btn"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          title="Trang trước"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--color-border-light)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            cursor: page <= 1 ? 'not-allowed' : 'pointer',
            opacity: page <= 1 ? 0.4 : 1,
            padding: 0,
            transition: 'all 0.2s',
            boxShadow: 'var(--shadow-xs)'
          }}
          onMouseEnter={e => {
            if (page > 1) {
              e.currentTarget.style.background = 'var(--color-bg-light)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--color-surface)';
            e.currentTarget.style.borderColor = 'var(--color-border-light)';
          }}
        >
          <ChevronLeft size={16} />
        </button>

        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {getPages().map((p, i) =>
            p === '...' ? (
              <span key={`dots-${i}`} style={{
                padding: '0 4px',
                color: isLightText ? '#ffffff' : 'var(--color-text-muted)',
                textShadow: isLightText ? '0 1px 3px rgba(0, 0, 0, 0.7)' : 'none',
                fontSize: '0.875rem'
              }}>…</span>
            ) : (
              <button
                key={p}
                className={`pagination-btn ${page === p ? 'active' : ''}`}
                onClick={() => onChange(p as number)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  fontWeight: page === p ? 600 : 650,
                  border: page === p ? 'none' : '1px solid var(--color-border-light)',
                  background: page === p ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: page === p ? '#ffffff' : 'var(--color-text)',
                  cursor: page === p ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  padding: 0,
                  boxShadow: page === p ? '0 4px 10px rgba(189, 29, 45, 0.2)' : 'none'
                }}
                onMouseEnter={e => {
                  if (page !== p) {
                    e.currentTarget.style.background = 'var(--color-bg-light)';
                    e.currentTarget.style.borderColor = 'var(--color-border)';
                  }
                }}
                onMouseLeave={e => {
                  if (page !== p) {
                    e.currentTarget.style.background = 'var(--color-surface)';
                    e.currentTarget.style.borderColor = 'var(--color-border-light)';
                  }
                }}
              >
                {p}
              </button>
            )
          )}
        </div>

        <button
          className="pagination-btn"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          title="Trang sau"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--color-border-light)',
            background: 'var(--color-surface)',
            color: 'var(--color-text)',
            cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            opacity: page >= totalPages ? 0.4 : 1,
            padding: 0,
            transition: 'all 0.2s',
            boxShadow: 'var(--shadow-xs)'
          }}
          onMouseEnter={e => {
            if (page < totalPages) {
              e.currentTarget.style.background = 'var(--color-bg-light)';
              e.currentTarget.style.borderColor = 'var(--color-border)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'var(--color-surface)';
            e.currentTarget.style.borderColor = 'var(--color-border-light)';
          }}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
