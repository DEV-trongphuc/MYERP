import * as React from 'react';
import { useState, useEffect } from 'react';
import { Settings, Check } from 'lucide-react';

interface ColumnDef {
    id: string;
    label: string;
    required?: boolean;
}

interface ColumnCustomizerProps {
    columns: ColumnDef[];
    visibleColumns: string[];
    onChange: (visibleColumns: string[]) => void;
}

const STORAGE_KEY = 'mailflow_visible_columns';

const ColumnCustomizer: React.FC<ColumnCustomizerProps> = ({ columns, visibleColumns, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);

    const toggleColumn = (columnId: string) => {
        const column = columns.find(c => c.id === columnId);
        if (column?.required) return; // Can't toggle required columns

        const newVisible = visibleColumns.includes(columnId)
            ? visibleColumns.filter(id => id !== columnId)
            : [...visibleColumns, columnId];

        onChange(newVisible);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newVisible));
    };

    return (
        <div className="relative shrink-0">
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`h-9 inline-flex items-center gap-2 px-3 rounded-[var(--radius-md)] border text-[13px] font-medium whitespace-nowrap transition-colors select-none ${isOpen
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary-light)]'
                    : 'border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]'
                    }`}
                title="Tùy chỉnh cột hiển thị"
            >
                <Settings className="w-4 h-4" />
                <span>Cột hiển thị</span>
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-64 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xl z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-3 border-b border-[var(--color-border-light)]">
                            <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide">Tùy chỉnh cột</p>
                        </div>
                        <div className="p-2 max-h-80 overflow-y-auto custom-scrollbar">
                            {columns.map(column => {
                                const isVisible = visibleColumns.includes(column.id);
                                const isRequired = column.required;

                                return (
                                    <button
                                        key={column.id}
                                        type="button"
                                        onClick={() => toggleColumn(column.id)}
                                        disabled={isRequired}
                                        className={`w-full flex items-center justify-between p-2.5 rounded-[var(--radius-md)] transition-all mb-0.5 ${isRequired
                                            ? 'opacity-50 cursor-not-allowed bg-[var(--color-bg)]'
                                            : 'hover:bg-[var(--color-bg)] cursor-pointer'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${isVisible
                                                ? 'bg-[var(--color-primary)] border-[var(--color-primary)]'
                                                : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                                                }`}>
                                                {isVisible && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className={`text-xs font-semibold ${isVisible ? 'text-[var(--color-text)]' : 'text-[var(--color-text-light)]'}`}>
                                                {column.label}
                                            </span>
                                        </div>
                                        {isRequired && (
                                            <span className="text-[10px] font-semibold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded">
                                                Bắt buộc
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        <div className="p-3 border-t border-[var(--color-border-light)] bg-[var(--color-bg)] rounded-b-[var(--radius-lg)]">
                            <p className="text-[11px] text-[var(--color-text-muted)] font-medium">
                                Cột "Khách hàng" luôn hiển thị
                            </p>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default ColumnCustomizer;
export { STORAGE_KEY };
