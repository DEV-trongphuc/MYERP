import * as React from 'react';
import { useState, useEffect } from 'react';
import { Filter, X, Check, ChevronDown, Search, Tag, Sliders, Users } from 'lucide-react';
import Select from '../common/Select';

interface AdvancedFiltersProps {
    filterStatus: string;
    filterTags: string[];
    filterVerify: string;
    filterHasChat: string;
    filterSalesperson: string;
    filterCustomAttrKey?: string;
    filterCustomAttrValue?: string;
    onStatusChange: (value: string) => void;
    onTagsChange: (value: string[]) => void;
    onVerifyChange: (value: string) => void;
    onHasChatChange: (value: string) => void;
    onSalespersonChange: (value: string) => void;
    onCustomAttrChange?: (key: string, value: string) => void;
    tags: { id: string; name: string }[];
    customAttrKeys?: { key: string; label: string }[]; // Available custom field keys
    /** Called each time the filter panel opens (used to lazy-load tags / custom fields). */
    onOpen?: () => void;
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
    filterStatus,
    filterTags,
    filterVerify,
    filterHasChat,
    filterSalesperson,
    filterCustomAttrKey = '',
    filterCustomAttrValue = '',
    onStatusChange,
    onTagsChange,
    onVerifyChange,
    onHasChatChange,
    onSalespersonChange,
    onCustomAttrChange,
    tags,
    customAttrKeys = [],
    onOpen
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [tagSearch, setTagSearch] = useState('');

    // Local state for pending filters
    const [localStatus, setLocalStatus] = useState(filterStatus);
    const [localTags, setLocalTags] = useState<string[]>(filterTags);
    const [localVerify, setLocalVerify] = useState(filterVerify);
    const [localHasChat, setLocalHasChat] = useState(filterHasChat);
    const [localSalesperson, setLocalSalesperson] = useState(filterSalesperson);
    const [localCustomKey, setLocalCustomKey] = useState(filterCustomAttrKey);
    const [localCustomValue, setLocalCustomValue] = useState(filterCustomAttrValue);

    // Sync local state when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalStatus(filterStatus);
            setLocalTags(filterTags);
            setLocalVerify(filterVerify);
            setLocalHasChat(filterHasChat);
            setLocalSalesperson(filterSalesperson);
            setLocalCustomKey(filterCustomAttrKey);
            setLocalCustomValue(filterCustomAttrValue);
        }
    }, [isOpen, filterStatus, filterTags, filterVerify, filterHasChat, filterCustomAttrKey, filterCustomAttrValue]);

    // Count active filters (applied ones)
    const activeFiltersCount = [
        filterStatus !== 'all',
        filterTags.length > 0,
        filterVerify !== 'all',
        filterHasChat !== 'all',
        filterSalesperson !== '',
        !!filterCustomAttrKey
    ].filter(Boolean).length;

    // Check if local states differ from applied states
    const hasChanges =
        localStatus !== filterStatus ||
        JSON.stringify(localTags.sort()) !== JSON.stringify([...filterTags].sort()) ||
        localVerify !== filterVerify ||
        localHasChat !== filterHasChat ||
        localSalesperson !== filterSalesperson ||
        localCustomKey !== filterCustomAttrKey ||
        localCustomValue !== filterCustomAttrValue;

    const handleApply = () => {
        onStatusChange(localStatus);
        onTagsChange(localTags);
        onVerifyChange(localVerify);
        onHasChatChange(localHasChat);
        onSalespersonChange(localSalesperson);
        if (onCustomAttrChange) onCustomAttrChange(localCustomKey, localCustomValue);
        setIsOpen(false);
    };

    const handleReset = () => {
        setLocalStatus('all');
        setLocalTags([]);
        setLocalVerify('all');
        setLocalHasChat('all');
        setLocalSalesperson('');
        setLocalCustomKey('');
        setLocalCustomValue('');
    };

    const toggleTag = (tagName: string) => {
        setLocalTags(prev =>
            prev.includes(tagName)
                ? prev.filter(t => t !== tagName)
                : [...prev, tagName]
        );
    };

    const filteredTags = tags.filter(t =>
        t.name.toLowerCase().includes(tagSearch.toLowerCase())
    );

    const hasAnyLocal = localStatus !== 'all' || localTags.length > 0 || localVerify !== 'all' || localHasChat !== 'all' || localSalesperson !== '' || !!localCustomKey;

    return (
        <div className="relative shrink-0">
            <button
                type="button"
                onClick={() => {
                    const next = !isOpen;
                    setIsOpen(next);
                    if (next) onOpen?.();
                }}
                className={`h-9 inline-flex items-center gap-2 px-3 rounded-[var(--radius-md)] border text-[13px] font-medium whitespace-nowrap transition-colors select-none ${activeFiltersCount > 0 || isOpen
                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary-light)]'
                    : 'border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]'
                    }`}
            >
                <Filter className="w-4 h-4" />
                <span>Bộ lọc</span>
                {activeFiltersCount > 0 && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-[var(--color-primary)] text-white rounded-full text-[10px] font-bold">
                        {activeFiltersCount === 1 && localTags.length > 1 ? localTags.length : activeFiltersCount}
                    </span>
                )}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute left-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xl z-40 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-[var(--color-primary)]" />
                                <p className="text-sm font-bold text-slate-800">Bộ lọc nâng cao</p>
                            </div>
                            {hasAnyLocal && (
                                <button
                                    onClick={handleReset}
                                    className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600 transition-colors"
                                >
                                    <X className="w-3 h-3" />
                                    Xóa
                                </button>
                            )}
                        </div>

                        <div className="p-4 space-y-4 max-h-[520px] overflow-y-auto custom-scrollbar">
                            {/* Status Filter */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                    Trạng thái
                                </label>
                                <Select
                                    variant="outline"
                                    value={localStatus}
                                    onChange={setLocalStatus}
                                    options={[
                                        { value: 'all', label: 'Tất cả Trạng thái' },
                                        { value: 'active', label: 'Active' },
                                        { value: 'lead', label: 'Lead' },
                                        { value: 'customer', label: 'Customer' },
                                        { value: 'unsubscribed', label: 'Unsubscribed' },
                                        { value: 'bounced', label: 'Bounced' }
                                    ]}
                                />
                            </div>

                            {/* Verify Filter */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                    Xác thực Email
                                </label>
                                <Select
                                    variant="outline"
                                    value={localVerify}
                                    onChange={setLocalVerify}
                                    options={[
                                        { value: 'all', label: 'Tất cả' },
                                        { value: '1', label: 'Đã xác thực' },
                                        { value: '0', label: 'Chưa xác thực' }
                                    ]}
                                />
                            </div>

                            {/* Chat Filter */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                    Hội thoại
                                </label>
                                <Select
                                    variant="outline"
                                    value={localHasChat}
                                    onChange={setLocalHasChat}
                                    options={[
                                        { value: 'all', label: 'Tất cả' },
                                        { value: 'yes', label: 'Có hội thoại' },
                                        { value: 'no', label: 'Chưa có hội thoại' }
                                    ]}
                                />
                            </div>
                            
                            {/* Salesperson Filter */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                    Salesperson
                                </label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Nhập tên Salesperson..."
                                        value={localSalesperson}
                                        onChange={(e) => setLocalSalesperson(e.target.value)}
                                        className="w-full h-11 pl-9 pr-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-[var(--color-primary)] transition-all"
                                    />
                                </div>
                            </div>

                            {/* Custom Field Filter */}
                            {customAttrKeys.length > 0 && (
                                <div className="border-t border-[var(--color-border)] pt-4">
                                    <label className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Tag className="w-3 h-3" /> Lọc theo Custom Field
                                    </label>
                                    <div className="space-y-2 p-3 bg-[var(--color-primary-light)] rounded-xl border border-[var(--color-border)]">
                                        <div>
                                            <label className="text-[9px] font-bold text-[var(--color-primary)] uppercase tracking-widest mb-1 block">Tên trường</label>
                                            <select
                                                value={localCustomKey}
                                                onChange={e => { setLocalCustomKey(e.target.value); setLocalCustomValue(''); }}
                                                className="w-full h-9 px-3 bg-white border border-[var(--color-border)] rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[var(--color-primary)] transition-all"
                                            >
                                                <option value="">-- Chọn custom field --</option>
                                                {customAttrKeys.map(k => (
                                                    <option key={k.key} value={k.key}>{k.label} ({k.key})</option>
                                                ))}
                                            </select>
                                        </div>
                                        {localCustomKey && (
                                            <div>
                                                <label className="text-[9px] font-bold text-[var(--color-primary)] uppercase tracking-widest mb-1 block">Giá trị (để trống = có tồn tại)</label>
                                                <input
                                                    type="text"
                                                    value={localCustomValue}
                                                    onChange={e => setLocalCustomValue(e.target.value)}
                                                    placeholder="Nhập giá trị cần lọc..."
                                                    className="w-full h-9 px-3 bg-white border border-[var(--color-border)] rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-[var(--color-primary)] transition-all"
                                                />
                                            </div>
                                        )}
                                        {localCustomKey && (
                                            <p className="text-[9px] text-[var(--color-primary)] font-medium">
                                                {localCustomValue
                                                    ? `Lọc: ${localCustomKey} = "${localCustomValue}"`
                                                    : `Lọc: có trường "${localCustomKey}"`
                                                }
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Tag Filter (Multi-select) */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                    Nhãn (Tags) - Chọn nhiều
                                </label>
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="Tìm nhãn..."
                                            value={tagSearch}
                                            onChange={(e) => setTagSearch(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:border-[var(--color-primary)] focus:bg-white transition-all"
                                        />
                                    </div>
                                    <div className="bg-white border border-slate-100 rounded-xl max-h-40 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar shadow-inner">
                                        {filteredTags.map(tag => (
                                            <div
                                                key={tag.id}
                                                onClick={() => toggleTag(tag.name)}
                                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-all group ${localTags.includes(tag.name) ? 'bg-[var(--color-primary-light)]' : 'hover:bg-slate-50'}`}
                                            >
                                                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${localTags.includes(tag.name) ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-slate-300 group-hover:border-slate-400'}`}>
                                                    {localTags.includes(tag.name) && <Check className="w-3 h-3 text-white stroke-[4]" />}
                                                </div>
                                                <span className={`text-xs font-bold transition-colors ${localTags.includes(tag.name) ? 'text-[var(--color-primary)]' : 'text-slate-600'}`}>
                                                    {tag.name}
                                                </span>
                                            </div>
                                        ))}
                                        {filteredTags.length === 0 && (
                                            <div className="py-4 px-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                                Không tìm thấy nhãn
                                            </div>
                                        )}
                                    </div>
                                    {localTags.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {localTags.map(tagName => (
                                                <div key={tagName} className="flex items-center gap-1 px-2 py-0.5 bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-md text-[10px] font-black uppercase tracking-tight">
                                                    {tagName}
                                                    <X className="w-2.5 h-2.5 cursor-pointer hover:text-[var(--color-primary)]" onClick={(e) => { e.stopPropagation(); toggleTag(tagName); }} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-bg)] rounded-b-[var(--radius-lg)]">
                            <button
                                type="button"
                                onClick={handleApply}
                                disabled={!hasChanges && activeFiltersCount > 0}
                                className={`w-full h-9 rounded-[var(--radius-md)] text-[13px] font-semibold transition-all flex items-center justify-center gap-2 ${hasChanges || activeFiltersCount === 0
                                    ? 'bg-[var(--color-primary)] hover:opacity-90 text-white shadow-sm'
                                    : 'bg-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed'
                                    }`}
                            >
                                <Check className="w-4 h-4" />
                                Áp dụng bộ lọc
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AdvancedFilters;
