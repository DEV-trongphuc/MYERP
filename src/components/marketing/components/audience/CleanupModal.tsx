import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, ArrowRight, Loader2, Eraser, CheckCircle2, Moon, AlertTriangle, Calculator, ChevronDown, Check, AlertCircle, Plus } from 'lucide-react';
import { api } from '../../services/storageAdapter';
import { getMktPortalRoot } from '../../utils/portalRoot';
import toast from 'react-hot-toast';

interface CleanupModalProps {
    target: { id: string; name: string; type: 'list' | 'segment' } | null;
    onClose: () => void;
    onSuccess: () => void;
}

// Custom Checkbox Card - Compact
const CheckboxCard = ({
    checked,
    onChange,
    title,
    description,
    colorClass,
    icon: Icon
}: {
    checked: boolean;
    onChange: () => void;
    title: string;
    description: string;
    colorClass: string;
    icon: any;
}) => {
    return (
        <div
            onClick={onChange}
            className={`cursor-pointer p-3 rounded-lg border transition-all flex items-start gap-3 group ${checked
                ? `border-${colorClass}-500 bg-${colorClass}-50/50`
                : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
        >
            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all mt-0.5 ${checked
                ? `bg-${colorClass}-500 border-${colorClass}-500`
                : 'bg-white border-slate-300 group-hover:border-slate-400'
                }`}>
                {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
            </div>
            <div className="flex-1">
                <div className={`font-bold text-xs mb-0.5 ${checked ? `text-${colorClass}-700` : 'text-slate-700'}`}>{title}</div>
                <div className="text-[10px] text-slate-500 leading-snug">{description}</div>
            </div>
        </div>
    );
};

// Custom Select Component - Compact
const CustomSelect = ({
    value,
    onChange,
    options,
    placeholder,
    onCreateNew
}: {
    value: string;
    onChange: (val: string) => void;
    options: { id: string; name: string; count?: number }[];
    placeholder: string;
    onCreateNew?: () => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
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

    const selectedOption = options.find(o => o.id === value);

    return (
        <div className="relative" ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-3 py-2 rounded-lg border cursor-pointer flex items-center justify-between transition-all ${isOpen || value ? 'border-indigo-500 ring-2 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
                    } bg-white shadow-sm text-xs`}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {selectedOption ? (
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 truncate">{selectedOption.name}</span>
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{selectedOption.count?.toLocaleString() || 0}</span>
                        </div>
                    ) : (
                        <span className="text-slate-400 font-medium">{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-lg shadow-xl border border-slate-100 py-1 max-h-48 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 custom-scrollbar">
                    {onCreateNew && (
                        <div
                            onClick={() => { onCreateNew(); setIsOpen(false); }}
                            className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center gap-2 text-indigo-600 font-bold text-xs border-b border-slate-100"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Tạo danh sách mới...
                        </div>
                    )}
                    {options.length > 0 ? options.map(opt => (
                        <div
                            key={opt.id}
                            onClick={() => { onChange(opt.id); setIsOpen(false); }}
                            className={`px-3 py-2 hover:bg-slate-50 cursor-pointer flex items-center justify-between group ${value === opt.id ? 'bg-indigo-50' : ''}`}
                        >
                            <span className={`text-xs font-medium ${value === opt.id ? 'text-indigo-700' : 'text-slate-700'}`}>{opt.name}</span>
                            <span className="text-[10px] text-slate-400 group-hover:text-slate-500">{opt.count?.toLocaleString()}</span>
                        </div>
                    )) : (
                        <div className="px-3 py-2 text-xs text-slate-400 text-center">Không có danh sách nào</div>
                    )}
                </div>
            )}
        </div>
    );
};

// Action Card Component - Compact
const ActionCard = ({
    selected,
    onSelect,
    icon: Icon,
    title,
    description,
    colorClass,
    recommended = false
}: {
    selected: boolean;
    onSelect: () => void;
    icon: any;
    title: string;
    description: string;
    colorClass: string;
    recommended?: boolean;
}) => (
    <div
        onClick={onSelect}
        className={`relative p-3.5 rounded-xl border transition-all duration-200 flex items-start gap-3 group ${selected
            ? `border-${colorClass}-500 bg-${colorClass}-50/30`
            : 'border-slate-100 bg-white hover:border-slate-200 hover:shadow-sm'
            }`}
    >
        {recommended && (
            <div className={`absolute -top-2 right-3 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-${colorClass}-100 text-${colorClass}-700 ring-1 ring-white shadow-sm`}>
                Recommended
            </div>
        )}
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${selected
            ? `bg-${colorClass}-500 text-white shadow-sm`
            : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'
            }`}>
            <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
            <h4 className={`font-bold text-xs mb-0.5 ${selected ? `text-${colorClass}-900` : 'text-slate-800'}`}>{title}</h4>
            <p className="text-[10px] text-slate-500 leading-snug">{description}</p>
        </div>
        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 transition-colors ${selected
            ? `border-${colorClass}-500`
            : 'border-slate-300'
            }`}>
            <div className={`w-2 h-2 rounded-full transition-all ${selected ? `bg-${colorClass}-500` : 'scale-0'}`} />
        </div>
    </div>
);


const CleanupModal: React.FC<CleanupModalProps> = ({ target, onClose: _onClose, onSuccess }) => {
    const [animateIn, setAnimateIn] = useState(false);
    useEffect(() => { setTimeout(() => setAnimateIn(true), 10); }, []);
    const onClose = () => { setAnimateIn(false); setTimeout(_onClose, 400); };

    const [activeTab, setActiveTab] = useState<'junk' | 'dormant'>('junk');

    // Junk State
    const [targetStatuses, setTargetStatuses] = useState<string[]>(['bounced']);

    // Dormant State
    const [dormantDays, setDormantDays] = useState<number>(90);

    // Action State
    const [action, setAction] = useState<'remove' | 'delete' | 'move'>('remove');
    const [destinationListId, setDestinationListId] = useState<string>('');
    const [isCreatingNewList, setIsCreatingNewList] = useState(false);
    const [newListName, setNewListName] = useState('');

    const [existingLists, setExistingLists] = useState<{ id: string; name: string, count?: number }[]>([]);

    // System State
    const [isLoading, setIsLoading] = useState(false);
    const [isEstimating, setIsEstimating] = useState(false);
    const [estimateCount, setEstimateCount] = useState<number | null>(null);

    useEffect(() => {
        if (action === 'move') {
            fetchLists();
        }
    }, [action]);

    // Reset estimate when key criteria changes
    useEffect(() => {
        setEstimateCount(null);
    }, [targetStatuses, dormantDays, activeTab]);

    const fetchLists = async () => {
        const res = await api.get<any[]>('lists');
        if (res.success) {
            setExistingLists(res.data.filter(l => l.id !== target?.id && l.source !== 'Google Sheets'));
        }
    };

    const handleEstimate = async () => {
        setIsEstimating(true);
        try {
            const payload = {
                targetId: target?.id,
                targetType: target?.type,
                statuses: targetStatuses,
                days: dormantDays,
                cleanupType: activeTab,
                mode: 'estimate'
            };
            const res = await api.post<any>('lists?route=cleanup', payload);
            if (res.success) {
                setEstimateCount(res.data.count);
                if (res.data.count === 0) {
                    toast.success('Không tìm thấy liên hệ nào phù hợp');
                } else {
                    toast.success(`Tìm thấy ${res.data.count} liên hệ`);
                }
            } else {
                toast.error(res.message || 'Lỗi khi ước tính');
            }
        } catch (error) {
            toast.error('Lỗi hệ thống khi ước tính');
        } finally {
            setIsEstimating(false);
        }
    }

    const handleCleanup = async () => {
        if (activeTab === 'junk' && targetStatuses.length === 0) {
            toast.error('Vui lòng chọn ít nhất một loại Trạng thái');
            return;
        }

        let finalDestId = destinationListId;

        if (action === 'move') {
            if (isCreatingNewList) {
                if (!newListName.trim()) {
                    toast.error('Vui lòng nhập tên danh sách mới');
                    return;
                }
                try {
                    const createRes = await api.post<any>('lists', { name: newListName });
                    if (createRes.success) {
                        finalDestId = createRes.data.id;
                    } else {
                        toast.error('Không thể tạo danh sách mới');
                        return;
                    }
                } catch (e) {
                    toast.error('Lỗi khi tạo danh sách mới');
                    return;
                }
            } else {
                if (!destinationListId) {
                    toast.error('Vui lòng chọn danh sách chuyển đến');
                    return;
                }
            }
        }

        setIsLoading(true);
        try {
            const payload = {
                targetId: target?.id,
                targetType: target?.type,
                statuses: targetStatuses,
                days: dormantDays,
                cleanupType: activeTab,
                action: action,
                destinationListId: finalDestId,
                mode: 'execute'
            };

            const res = await api.post<any>('lists?route=cleanup', payload);
            if (res.success) {
                toast.success(`Đã xử lý ${res.data.affected} liên hệ thành công`);
                setTimeout(() => {
                    onSuccess();
                    onClose();
                }, 1500);
            } else {
                toast.error(res.message || 'Có lỗi xảy ra');
            }
        } catch (error) {
            toast.error('Lỗi hệ thống khi dọn dẹp');
        } finally {
            setIsLoading(false);
        }
    };

    if (!target) return null;

    return createPortal(
        <div className="fixed inset-0 z-[110000] flex items-center justify-center p-4">
            <div
                className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ease-out ${animateIn ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <div
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                className={`bg-white rounded-[18px] shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] ring-1 ring-white/20 font-sans relative transform transition-all duration-500 ${animateIn ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'}`}
            >

                {isLoading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-50 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
                            <p className="text-xs font-bold text-slate-500 animate-pulse">Đang xử lý...</p>
                        </div>
                    </div>
                )}

                {/* Header - Compact */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 tracking-tight">
                            <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-slate-600 flex items-center justify-center shadow-sm">
                                <Eraser className="w-4 h-4" />
                            </div>
                            Clean Up
                        </h3>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest pl-1">{target.name} • {target.type.toUpperCase()}</p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body with Scroll */}
                <div className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar scroll-smooth">

                    {/* Tabs - Pill Style */}
                    <div className="bg-slate-100 p-1 rounded-xl flex gap-1 shadow-inner text-xs font-bold">
                        <button
                            onClick={() => { setActiveTab('junk'); setAction('remove'); setEstimateCount(null); }}
                            className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'junk' ? 'bg-white text-rose-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                            Dọn rác (Junk)
                        </button>
                        <button
                            onClick={() => { setActiveTab('dormant'); setAction('move'); setEstimateCount(null); }}
                            className={`flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === 'dormant' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}`}
                        >
                            <Moon className="w-3.5 h-3.5" />
                            Ngủ đông (Dormant)
                        </button>
                    </div>

                    {/* Content */}
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">

                        {/* 1. Criteria Section */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">1. Điều kiện lọc</h4>

                            {activeTab === 'junk' && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <CheckboxCard
                                        title="Email Bounced"
                                        description="Email hỏng hoặc đầy."
                                        checked={targetStatuses.includes('bounced')}
                                        onChange={() => {
                                            if (targetStatuses.includes('bounced')) setTargetStatuses(targetStatuses.filter(s => s !== 'bounced'));
                                            else setTargetStatuses([...targetStatuses, 'bounced']);
                                        }}
                                        colorClass="rose"
                                        icon={AlertCircle}
                                    />
                                    <CheckboxCard
                                        title="Unsubscribed"
                                        description="Đã Hủy đăng ký"

                                        checked={targetStatuses.includes('unsubscribed')}
                                        onChange={() => {
                                            if (targetStatuses.includes('unsubscribed')) setTargetStatuses(targetStatuses.filter(s => s !== 'unsubscribed'));
                                            else setTargetStatuses([...targetStatuses, 'unsubscribed']);
                                        }}
                                        colorClass="amber"
                                        icon={AlertTriangle}
                                    />
                                </div>
                            )}

                            {activeTab === 'dormant' && (
                                <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 bg-white rounded-lg shadow-sm ring-1 ring-black/5 text-indigo-600">
                                            <Moon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-800 text-sm">Người dùng ngủ đông</h4>
                                            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">Active nhưng không tương tác.</p>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-indigo-100/50">
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-xs font-bold text-slate-600">Không tương tác quá</label>
                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-bold">{dormantDays} ngày</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="30"
                                            max="365"
                                            step="30"
                                            value={dormantDays}
                                            onChange={(e) => setDormantDays(parseInt(e.target.value))}
                                            className="w-full h-1.5 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-700 transition-all"
                                        />
                                        <div className="flex justify-between text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-wider">
                                            <span>30d</span>
                                            <span>180d</span>
                                            <span>365d</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Estimate Bar - Light Theme */}
                        <div className="bg-white border border-slate-200 rounded-xl p-1 flex items-center justify-between shadow-sm">
                            <div className="px-3 py-1.5">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Tìm thấy</p>
                                <div className="flex items-baseline gap-1.5">
                                    {isEstimating ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                                    ) : (
                                        <span className="text-lg font-black text-slate-800 tracking-tight">{estimateCount !== null ? estimateCount.toLocaleString() : '0'}</span>
                                    )}
                                    <span className="text-[10px] font-bold text-slate-400">users</span>
                                </div>
                            </div>
                            <button
                                onClick={handleEstimate}
                                disabled={isEstimating}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold text-slate-600 flex items-center gap-1.5 transition-all h-full border border-slate-200/50"
                            >
                                <Calculator className="w-3 h-3" />
                                Kiểm tra
                            </button>
                        </div>

                        {/* 2. Action Section */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">2. Hành động</h4>

                            <div className="grid grid-cols-1 gap-2.5">
                                <ActionCard
                                    title="Lưu trữ (Archive)"
                                    description="Di chuyển sang danh sách riêng."
                                    icon={ArrowRight}
                                    colorClass="indigo"
                                    selected={action === 'move'}
                                    onSelect={() => setAction('move')}
                                    recommended={activeTab === 'dormant'}
                                />
                                {action === 'move' && (
                                    <div className="ml-4 sm:ml-12 animate-in slide-in-from-top-2 fade-in duration-300 space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs">
                                        <div className="flex gap-1 bg-white border border-slate-200 p-0.5 rounded-lg w-fit">
                                            <button
                                                onClick={() => setIsCreatingNewList(false)}
                                                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${!isCreatingNewList ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Có sẵn
                                            </button>
                                            <button
                                                onClick={() => setIsCreatingNewList(true)}
                                                className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${isCreatingNewList ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`}
                                            >
                                                Tạo mới +
                                            </button>
                                        </div>

                                        {isCreatingNewList ? (
                                            <input
                                                autoFocus
                                                type="text"
                                                value={newListName}
                                                onChange={(e) => setNewListName(e.target.value)}
                                                placeholder="Nhập tên danh sách mới..."
                                                className="w-full px-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium text-slate-700 bg-white"
                                            />
                                        ) : (
                                            <CustomSelect
                                                value={destinationListId}
                                                onChange={setDestinationListId}
                                                onCreateNew={() => setIsCreatingNewList(true)}
                                                options={existingLists}
                                                placeholder="- Chọn danh sách -"
                                            />
                                        )}
                                    </div>
                                )}

                                {target.type === 'list' && (
                                    <ActionCard
                                        title="Chỉ gỡ khỏi danh sách"
                                        description="Giữ lại hồ sơ, chỉ xóa khỏi danh sách hiện tại."
                                        icon={Eraser}
                                        colorClass="slate"
                                        selected={action === 'remove'}
                                        onSelect={() => setAction('remove')}
                                    />
                                )}

                                <ActionCard
                                    title="Xóa vĩnh viễn"
                                    description="Xóa hoàn toàn dữ liệu. Không thể khôi phục."
                                    icon={Trash2}
                                    colorClass="rose"
                                    selected={action === 'delete'}
                                    onSelect={() => setAction('delete')}
                                    recommended={activeTab === 'junk'}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer - Compact */}
                <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3 bg-white sticky bottom-0 z-10 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors bg-white hover:bg-slate-50 rounded-[var(--radius-md)]">
                        Hủy
                    </button>
                    <button
                        onClick={handleCleanup}
                        disabled={isLoading}
                        className={`px-6 py-2.5 rounded-[var(--radius-md)] text-white font-bold hover:shadow-md transition-all flex items-center gap-2 shadow-sm text-xs ${isLoading ? 'bg-slate-400 cursor-not-allowed shadow-none' :
                            action === 'delete' ? 'bg-rose-600 hover:bg-rose-700' :
                                'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]'
                            }`}
                    >
                        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        {!isLoading && <CheckCircle2 className="w-4 h-4" />}
                        {activeTab === 'dormant' && action === 'move' ? 'Lưu trữ ngay' : 'Thực hiện'}
                    </button>
                </div>
            </div>
        </div>,
        getMktPortalRoot()
    );
};

export default CleanupModal;
