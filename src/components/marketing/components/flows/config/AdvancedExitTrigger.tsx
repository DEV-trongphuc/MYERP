
import React, { useState, useEffect, useRef } from 'react';
import { ShoppingCart, FileInput, Zap, Check, Search, Filter, AlertCircle, Loader2, ChevronDown, X } from 'lucide-react';
import { api } from '../../../services/storageAdapter';
import Card from '../../common/Card';
import { PurchaseEvent, CustomEvent, FormDefinition } from '../../../types';

interface AdvancedExitTriggerProps {
    config: {
        forms?: { enabled: boolean; all: boolean; ids: string[] };
        purchases?: { enabled: boolean; all: boolean; ids: string[] };
        customEvents?: { enabled: boolean; all: boolean; ids: string[] };
    };
    onChange: (newConfig: any) => void;
    disabled?: boolean;
}

// --- HELPER: Searchable Multi-Select ---
interface MultiSelectProps {
    items: { id: string; name: string }[];
    selectedIds: string[];
    isAll: boolean;
    onChange: (ids: string[], all: boolean) => void;
    placeholder: string;
    disabled?: boolean;
}

const MultiSelectProp: React.FC<MultiSelectProps> = ({ items, selectedIds, isAll, onChange, placeholder, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredItems = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

    const toggleItem = (id: string) => {
        if (isAll) {
            // First click on item when ALL is selected -> Switch to specific
            onChange([id], false);
        } else {
            const newIds = selectedIds.includes(id)
                ? selectedIds.filter(x => x !== id)
                : [...selectedIds, id];
            onChange(newIds, false);
        }
    };

    const toggleAll = () => {
        if (isAll) {
            // Deselect All -> Cleared
            onChange([], false);
        } else {
            onChange([], true);
        }
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                className={`
                    w-full min-h-[42px] px-3 py-2 bg-white border rounded-xl flex items-center justify-between cursor-pointer transition-all
                    ${isOpen ? 'border-slate-400 ring-4 ring-slate-100' : 'border-slate-200 hover:border-slate-300'}
                    ${disabled ? 'opacity-60 bg-slate-50 cursor-not-allowed' : ''}
                `}
            >
                <div className="flex flex-wrap gap-1.5 flex-1">
                    {isAll ? (
                        <div className="px-2 py-0.5 bg-slate-800 text-white rounded text-xs font-bold flex items-center gap-1">
                            <span>Tất cả sự kiện</span>
                            <X className="w-3 h-3 cursor-pointer hover:text-red-300" onClick={(e) => { e.stopPropagation(); onChange([], false); }} />
                        </div>
                    ) : selectedIds.length > 0 ? (
                        <>
                            {selectedIds.slice(0, 3).map(id => {
                                const item = items.find(i => i.id === id);
                                return item ? (
                                    <div key={id} className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-bold border border-slate-200 flex items-center gap-1">
                                        <span className="truncate max-w-[100px]">{item.name}</span>
                                        <X className="w-3 h-3 cursor-pointer hover:text-slate-900" onClick={(e) => { e.stopPropagation(); toggleItem(id); }} />
                                    </div>
                                ) : null;
                            })}
                            {selectedIds.length > 3 && (
                                <span className="text-xs font-bold text-slate-500 py-0.5">+{selectedIds.length - 3} khác</span>
                            )}
                        </>
                    ) : (
                        <span className="text-sm text-slate-400 font-medium">{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-200">
                    <div className="relative mb-2">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                        <input
                            autoFocus
                            type="text"
                            className="w-full pl-8 pr-3 py-2 bg-slate-50 rounded-lg text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-slate-300"
                            placeholder="Tìm kiếm..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-1">
                        {/* Option: ALL */}
                        {!search && (
                            <div
                                onClick={toggleAll}
                                className={`
                                    px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between cursor-pointer transition-all
                                    ${isAll ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}
                                `}
                            >
                                <span>Chọn tất cả (Bất kỳ sự kiện nào)</span>
                                {isAll && <Check className="w-3.5 h-3.5" />}
                            </div>
                        )}

                        {filteredItems.map(item => {
                            const isSel = selectedIds.includes(item.id);
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => toggleItem(item.id)}
                                    className={`
                                        px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between cursor-pointer transition-all
                                        ${isSel && !isAll ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}
                                        ${isAll ? 'opacity-50 pointer-events-none' : ''}
                                    `}
                                >
                                    <span>{item.name}</span>
                                    {isSel && !isAll && <Check className="w-3.5 h-3.5" />}
                                </div>
                            );
                        })}
                        {filteredItems.length === 0 && (
                            <div className="text-center py-4 text-xs text-slate-400 italic">Không tìm thấy kết quả</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};


const AdvancedExitTrigger: React.FC<AdvancedExitTriggerProps> = ({ config, onChange, disabled }) => {
    const [forms, setForms] = useState<FormDefinition[]>([]);
    const [purchases, setPurchases] = useState<PurchaseEvent[]>([]);
    const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [formRes, purchRes, customRes] = await Promise.all([
                    api.get<FormDefinition[]>('forms'),
                    api.get<PurchaseEvent[]>('purchase_events'),
                    api.get<CustomEvent[]>('custom_events')
                ]);
                if (formRes.success) setForms(formRes.data);
                if (purchRes.success) setPurchases(purchRes.data);
                if (customRes.success) setCustomEvents(customRes.data);
            } catch (e) {
                console.error("Failed to load options", e);
            }
            setLoading(false);
        };
        loadData();
    }, []);

    const updateSection = (key: 'forms' | 'purchases' | 'customEvents', updates: any) => {
        const currentSection = config[key] || { enabled: false, all: false, ids: [] };
        onChange({
            ...config,
            [key]: { ...currentSection, ...updates }
        });
    };

    const renderSection = (
        key: 'forms' | 'purchases' | 'customEvents',
        title: string,
        icon: React.ElementType,
        colorClass: string,
        items: { id: string; name: string }[]
    ) => {
        const sectionConfig = config[key] || { enabled: false, all: false, ids: [] };
        const isEnabled = sectionConfig.enabled;
        const colorName = colorClass.split('-')[1]; // e.g. amber, emerald

        return (
            <div className={`border rounded-xl p-1 transition-all ${isEnabled ? 'bg-white border-emerald-500 shadow-sm' : 'bg-slate-50 border-slate-200'}`}>
                {/* Header / Enable Switch */}
                <div
                    className="flex items-center justify-between cursor-pointer p-4 pb-2"
                    onClick={() => !disabled && updateSection(key, { enabled: !isEnabled })}
                >
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isEnabled ? colorClass : 'bg-slate-200 text-slate-400'}`}>
                            {React.createElement(icon, { size: 18 })}
                        </div>
                        <div>
                            <h4 className={`text-sm font-black ${isEnabled ? 'text-slate-800' : 'text-slate-500'}`}>{title}</h4>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">Xảy ra khi Khách hàng thực hiện hành động này</p>
                        </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${isEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all shadow-sm ${isEnabled ? 'left-5' : 'left-1'}`} />
                    </div>
                </div>

                {/* Content */}
                {isEnabled && (
                    <div className="px-4 pb-4 pl-[68px] animate-in fade-in slide-in-from-top-1 duration-200">
                        <MultiSelectProp
                            items={items}
                            selectedIds={sectionConfig.ids || []}
                            isAll={!!sectionConfig.all}
                            onChange={(ids, all) => updateSection(key, { ids, all })}
                            placeholder="Chọn sự kiện cụ thể..."
                            disabled={disabled}
                        />
                        <p className="text-[10px] text-slate-400 mt-2 font-medium italic">
                            * Mặc định chọn "Tất cả" nếu bạn không chọn sự kiện nào cụ thể.
                        </p>
                    </div>
                )}
            </div>
        );
    };

    if (loading) return <div className="text-center py-4 text-slate-400 flex justify-center"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 px-1 mb-2">
                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 shadow-sm">
                    <Filter className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest">Ngắt luồng nâng cao (Trigger)</h3>
            </div>

            {renderSection('forms', 'Khi khách gửi Biểu mẫu (Form Submit)', FileInput, 'bg-amber-100 text-amber-600', forms)}
            {renderSection('purchases', 'Khi khách Mua hàng (Purchase)', ShoppingCart, 'bg-emerald-100 text-emerald-600', purchases)}
            {renderSection('customEvents', 'Khi có Sự kiện tùy chỉnh (Custom Event)', Zap, 'bg-blue-100 text-blue-600', customEvents)}

            <div className="flex gap-3 p-3 bg-blue-50 text-blue-800 text-xs rounded-xl mt-4 border border-blue-100">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-blue-600" />
                <p className="font-medium leading-relaxed">
                    Khách hàng sẽ bị ngắt khỏi Flow <strong>NGAY LẬP TỨC</strong> khi thực hiện bất kỳ hành động nào được chọn ở trên.
                    <br /><span className="opacity-70 font-normal">Ví dụ: Khách hàng mua hàng → Ngắt chuỗi chăm sóc Khách hàng tiềm năng.</span>
                </p>
            </div>
        </div>
    );
};

export default AdvancedExitTrigger;
