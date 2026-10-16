
import React from 'react';
import { X, RotateCcw } from 'lucide-react';

interface FilterPillProps {
    label: string;
    value: string;
    onRemove: () => void;
}

const FilterPill: React.FC<FilterPillProps> = ({ label, value, onRemove }) => (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-[11px] font-bold text-slate-700 hover:border-[var(--color-border)] hover:bg-[var(--color-primary-light)] transition-all duration-200 group animate-in zoom-in-95">
        <span className="text-slate-400 group-hover:text-[var(--color-primary)] transition-colors">{label}:</span>
        <span className="text-slate-700 group-hover:text-[var(--color-primary)] transition-colors uppercase tracking-tight">{value}</span>
        <button
            onClick={onRemove}
            className="p-0.5 hover:bg-[var(--color-primary-light)] rounded-full text-slate-400 hover:text-[var(--color-primary)] transition-all active:scale-90"
        >
            <X className="w-3 h-3" />
        </button>
    </div>
);

interface FilterPillsProps {
    filters: {
        status: string;
        tags: string[];
        verify: string;
        hasChat: string;
        salesperson?: string;
    };
    onRemove: (key: string, value?: string) => void;
    onClearAll: () => void;
    tags: { id: string; name: string }[];
}

const FilterPills: React.FC<FilterPillsProps> = ({ filters, onRemove, onClearAll, tags }) => {
    const activeFilters = [];

    if (filters.status !== 'all') {
        const labels: Record<string, string> = {
            'active': 'Active',
            'lead': 'Lead',
            'customer': 'Customer',
            'unsubscribed': 'Unsubscribed',
            'bounced': 'Bounced'
        };
        activeFilters.push({ key: 'status', label: 'Trạng thái', value: labels[filters.status] || filters.status });
    }

    // Handle multiple tags
    filters.tags.forEach(tag => {
        activeFilters.push({ key: 'tags', label: 'Tag', value: tag });
    });

    if (filters.verify !== 'all') {
        activeFilters.push({ key: 'verify', label: 'Xác thực', value: filters.verify === '1' ? 'Đã xác thực' : 'Chưa xác thực' });
    }

    if (filters.hasChat !== 'all') {
        activeFilters.push({ key: 'hasChat', label: 'Chat', value: filters.hasChat === 'yes' ? 'Có hội thoại' : 'Chưa có' });
    }
    
    if (filters.salesperson) {
        activeFilters.push({ key: 'salesperson', label: 'Sales', value: filters.salesperson });
    }

    if (activeFilters.length === 0) return null;

    return (
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-bg)]/40">
            <div className="flex items-center gap-2 mr-1">
                <div className="w-1 h-3.5 bg-[var(--color-primary)] rounded-full" />
                <span className="text-[11px] font-semibold text-[var(--color-text-light)]">Bộ lọc đang áp dụng:</span>
            </div>

            {activeFilters.map(filter => (
                <FilterPill
                    key={`${filter.key}-${filter.value}`}
                    label={filter.label}
                    value={filter.value}
                    onRemove={() => onRemove(filter.key, filter.value)}
                />
            ))}

            <button
                onClick={onClearAll}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[var(--color-text-light)] hover:text-rose-600 transition-colors ml-1"
            >
                <RotateCcw className="w-3 h-3" />
                <span>Xóa hết bộ lọc</span>
            </button>
        </div>
    );
};

export default FilterPills;
