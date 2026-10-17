import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Scissors, Loader2, Phone, CheckCircle2, Filter, Plus, FileText, ArrowRight, Trash2, Zap, ChevronDown, Check, Calculator, ArrowDown, Shuffle } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../services/storageAdapter';
import { getMktPortalRoot } from '../../utils/portalRoot';

interface AudienceSplitModalProps {
    sourceId: string;
    sourceName: string;
    sourceType: 'segment' | 'list';
    subscriberCount: number;
    onClose: () => void;
    onSuccess: () => void;
    selectedIds?: string[];
    onRequestSelection?: () => void;
}

// --- Custom Components ---

const ActionCard = ({
    selected,
    onClick,
    icon: Icon,
    title,
    subtitle,
    colorClass = "indigo",
    layout = "col" // "col" for vertical (Source), "row" for horizontal (Option)
}: {
    selected: boolean;
    onClick: () => void;
    icon: any;
    title: string;
    subtitle?: string;
    colorClass?: string;
    layout?: "col" | "row";
}) => (
    <div
        onClick={onClick}
        className={`cursor-pointer rounded-xl border transition-all group relative overflow-hidden flex items-center ${layout === 'col' ? 'flex-col p-3 text-center gap-2 justify-center h-full' : 'p-3 flex-row gap-3 text-left w-full'
            } ${selected
                ? `border-${colorClass}-500 bg-${colorClass}-50/50 shadow-md ring-1 ring-${colorClass}-500/20`
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
            }`}
    >
        {selected && layout === 'col' && <div className={`absolute top-0 right-0 w-0 h-0 border-t-[24px] border-t-${colorClass}-500 border-l-[24px] border-l-transparent`} />}
        {selected && layout === 'col' && <Check className="absolute top-[2px] right-[2px] w-3 h-3 text-white" strokeWidth={3} />}

        <div className={`rounded-xl flex items-center justify-center shrink-0 transition-colors ${layout === 'col' ? 'w-10 h-10' : 'w-9 h-9'
            } ${selected
                ? `bg-${colorClass}-500 text-white shadow-sm`
                : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
            }`}>
            <Icon className={layout === 'col' ? "w-5 h-5" : "w-4.5 h-4.5"} />
        </div>

        <div className="flex-1 min-w-0">
            {layout === 'row' ? (
                <div className="flex items-center justify-between">
                    <div>
                        <div className={`text-xs font-bold leading-tight ${selected ? `text-${colorClass}-900` : 'text-slate-700'}`}>{title}</div>
                        {subtitle && <div className="text-[10px] text-slate-500 leading-snug">{subtitle}</div>}
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? `border-${colorClass}-500` : 'border-slate-300'}`}>
                        <div className={`w-2 h-2 rounded-full transition-all ${selected ? `bg-${colorClass}-500` : 'scale-0'}`} />
                    </div>
                </div>
            ) : (
                <>
                    <div className={`text-xs font-bold leading-tight ${selected ? `text-${colorClass}-700` : 'text-slate-700'}`}>{title}</div>
                    {subtitle && <div className="text-[10px] text-slate-400 mt-1 font-medium leading-tight">{subtitle}</div>}
                </>
            )}
        </div>
    </div>
);

const CustomSelect = ({
    value,
    onChange,
    options,
    placeholder
}: {
    value: string;
    onChange: (val: string) => void;
    options: { id: string; name: string; count?: number }[];
    placeholder: string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(o => o.id === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-3 py-2.5 rounded-xl border cursor-pointer flex items-center justify-between transition-all bg-white text-xs ${isOpen || value ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-slate-200 hover:border-slate-300'
                    }`}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {selectedOption ? (
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800 truncate">{selectedOption.name}</span>
                            <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full font-bold">{selectedOption.count?.toLocaleString() || 0}</span>
                        </div>
                    ) : (
                        <span className="text-slate-400 font-medium">{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 py-1 max-h-56 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-b border-slate-100 sticky top-0">Chọn danh sách đích</div>
                    {options.map(opt => (
                        <div
                            key={opt.id}
                            onClick={() => { onChange(opt.id); setIsOpen(false); }}
                            className={`px-3 py-2.5 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs group transition-colors ${value === opt.id ? 'bg-indigo-50' : ''}`}
                        >
                            <span className={`font-bold ${value === opt.id ? 'text-indigo-700' : 'text-slate-600 group-hover:text-slate-800'}`}>{opt.name}</span>
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{opt.count?.toLocaleString() || 0}</span>
                        </div>
                    ))}
                    {options.length === 0 && (
                        <div className="px-3 py-4 text-center text-xs text-slate-400 italic">Không có danh sách nào khác</div>
                    )}
                </div>
            )}
        </div>
    );
};


const AudienceSplitModal: React.FC<AudienceSplitModalProps> = ({ sourceId, sourceName, sourceType, subscriberCount, onClose: _onClose, onSuccess, selectedIds = [], onRequestSelection }) => {
    // Animation
    const [animateIn, setAnimateIn] = useState(false);
    useEffect(() => { setTimeout(() => setAnimateIn(true), 10); }, []);
    const onClose = () => { setAnimateIn(false); setTimeout(_onClose, 400); };

    // State
    const [tab, setTab] = useState<'list' | 'selection' | 'phone' | 'quantity'>(selectedIds.length > 0 ? 'selection' : 'quantity');
    const [destType, setDestType] = useState<'new' | 'existing'>('new');
    const [destinationName, setDestinationName] = useState(`Split - ${sourceName} - ${new Date().toLocaleDateString('vi-VN')}`);
    const [existingLists, setExistingLists] = useState<any[]>([]);
    const [selectedListId, setSelectedListId] = useState<string>('');
    const [inputText, setInputText] = useState('');

    // Quantity State
    const [splitQuantity, setSplitQuantity] = useState<number>(Math.ceil(subscriberCount / 2));
    const [splitStrategy, setSplitStrategy] = useState<'random' | 'top'>('random');

    // Options
    const [createAutomation, setCreateAutomation] = useState(false);
    const [excludeFromSource, setExcludeFromSource] = useState(false);
    const [cleanupInvalid, setCleanupInvalid] = useState(false);

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        api.get<any[]>('lists').then(res => {
            if (res.success && Array.isArray(res.data)) {
                // Filter out Google Sheets lists as they are read-only EXCEPT current list if source is list
                // Also exclude self if source is list
                const manualLists = res.data.filter(l => l.source !== 'Google Sheets' && l.id !== sourceId);
                setExistingLists(manualLists);
                if (manualLists.length > 0) setSelectedListId(manualLists[0].id);
            }
        }).catch(() => { });
    }, [sourceId]);

    const handleSplit = async () => {
        // Validation
        let data: any[] = [];
        if (tab === 'list') {
            data = inputText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
            if (data.length === 0) return toast.error('Vui lòng nhập danh sách Email/SĐT');
        } else if (tab === 'selection') {
            data = selectedIds;
            if (data.length === 0) return toast.error('Vui lòng chọn Khách hàng');
        } else if (tab === 'quantity') {
            if (splitQuantity <= 0) return toast.error('Số lượng tách phải lớn hơn 0');
            if (splitQuantity > subscriberCount) return toast.error('Số lượng tách không thể lớn hơn Tổng số hiện có');
        }

        if (destType === 'new' && !destinationName.trim()) return toast.error('Nhập tên danh sách mới');
        if (destType === 'existing' && !selectedListId) return toast.error('Chọn danh sách đích');

        setIsLoading(true);
        try {
            const payload = {
                source_id: sourceId,
                source_type: sourceType,
                type: tab,
                data: tab === 'phone' || tab === 'quantity' ? [] : data,
                quantity: tab === 'quantity' ? splitQuantity : 0,
                strategy: splitStrategy,
                destination_id: destType === 'existing' ? selectedListId : null,
                destination_name: destType === 'new' ? destinationName : null,
                create_automation: createAutomation,
                exclude_from_source: excludeFromSource,
                cleanup_invalid: cleanupInvalid
            };
            const res = await api.post('audience_split.php', payload);
            if (res.success) {
                toast.success(res.message || 'Tách thành công!');
                onSuccess();
                onClose();
            } else {
                toast.error(res.message || 'Lỗi khi tách dữ liệu');
            }
        } catch (error) {
            toast.error('Có lỗi hệ thống xảy ra');
        } finally {
            setIsLoading(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[110000] flex items-center justify-center p-4">
            <div
                className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ease-out ${animateIn ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <div
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                className={`bg-white rounded-[18px] shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden ring-1 ring-white/20 font-sans relative transform transition-all duration-500 ${animateIn ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'}`}
            >

                {isLoading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-50 flex items-center justify-center rounded-[18px]">
                        <div className="flex flex-col items-center gap-3">
                            <div className="relative">
                                <div className="absolute inset-0 bg-red-100 rounded-full animate-ping"></div>
                                <div className="relative bg-white p-3 rounded-full shadow-xl border border-red-100">
                                    <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
                                </div>
                            </div>
                            <p className="text-sm font-bold text-slate-600 animate-pulse">Đang xử lý tách dữ liệu...</p>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white/80 backdrop-blur-md shrink-0 sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2.5 tracking-tight">
                            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-light)] border border-slate-100 text-[var(--color-primary)] flex items-center justify-center shadow-sm">
                                <Scissors className="w-5 h-5" />
                            </div>
                            Tách Dữ Liệu
                        </h3>
                        <p className="text-[11px] font-bold text-slate-400 mt-1 uppercase tracking-widest pl-1">
                            {sourceType === 'segment' ? 'Phân khúc' : 'Danh sách'}: <span className="text-slate-600">{sourceName}</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto custom-scrollbar space-y-6 flex-1 scroll-smooth bg-slate-50/30">

                    {/* 1. Source Data Strategy */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="section-header">1. Phương thức tách</h4>
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">Tổng: {(subscriberCount || 0).toLocaleString()}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <ActionCard
                                title="Số lượng"
                                subtitle="Ngẫu nhiên/Top"
                                icon={Calculator}
                                selected={tab === 'quantity'}
                                onClick={() => setTab('quantity')}
                                colorClass="indigo"
                                layout="col"
                            />
                            <ActionCard
                                title="Thủ công"
                                subtitle="Paste Email/SĐT"
                                icon={FileText}
                                selected={tab === 'list'}
                                onClick={() => setTab('list')}
                                colorClass="slate"
                                layout="col"
                            />
                            <ActionCard
                                title="Đã chọn"
                                subtitle={`${selectedIds.length} users`}
                                icon={CheckCircle2}
                                selected={tab === 'selection'}
                                onClick={() => {
                                    if (selectedIds.length === 0) {
                                        if (onRequestSelection) {
                                            onRequestSelection();
                                            return;
                                        }
                                        toast.error('Vui lòng chọn Khách hàng từ danh sách trước khi sử dụng tính năng này.');
                                        return;
                                    }
                                    setTab('selection')
                                }}
                                colorClass="emerald"
                                layout="col"
                            />
                            <ActionCard
                                title="Lọc SĐT"
                                subtitle="Có số ĐT"
                                icon={Phone}
                                selected={tab === 'phone'}
                                onClick={() => setTab('phone')}
                                colorClass="blue"
                                layout="col"
                            />
                        </div>

                        {/* Description Box */}
                        <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex gap-3 items-start animate-fade-in">
                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                                <span className="text-[10px] font-black text-slate-500">i</span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                {tab === 'quantity' && <span><strong>Tách theo số lượng:</strong> Hệ thống sẽ lấy ra một số lượng Khách hàng nhất định từ nguồn (Ngẫu nhiên hoặc Mới nhất).</span>}
                                {tab === 'list' && <span><strong>Tách theo danh sách thủ công:</strong> Nhập danh sách Email hoặc Số điện thoại để hệ thống tìm và tách những người này ra.</span>}
                                {tab === 'selection' && <span><strong>Tách theo lựa chọn:</strong> Chỉ tách {selectedIds.length} Khách hàng mà bạn đã tích chọn từ danh sách bên ngoài.</span>}
                                {tab === 'phone' && <span><strong>Lọc theo SĐT:</strong> Tách tất cả những Khách hàng đang có số điện thoại hợp lệ ({'>='} 9 số) trong nguồn dữ liệu.</span>}
                            </p>
                        </div>

                        {/* SUB-OPTIONS FOR QUANTITY */}
                        {tab === 'quantity' && (
                            <div className="mt-4 p-4 bg-white rounded-[14px] border border-indigo-100 shadow-sm animate-in slide-in-from-top-1 space-y-4">
                                <div>
                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1.5 block">Số lượng cần tách</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={splitQuantity}
                                            onChange={(e) => setSplitQuantity(parseInt(e.target.value) || 0)}
                                            className="w-full pl-4 pr-12 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none text-sm font-bold text-slate-700 bg-slate-50 focus:bg-white transition-all"
                                            min={1}
                                            max={subscriberCount}
                                        />
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                                            / {(subscriberCount || 0).toLocaleString()}
                                        </div>
                                    </div>
                                    <input
                                        type="range"
                                        min="1"
                                        max={subscriberCount}
                                        value={splitQuantity}
                                        onChange={(e) => setSplitQuantity(parseInt(e.target.value))}
                                        className="w-full mt-3 accent-indigo-500 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                                    />
                                </div>

                                <div>
                                    <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">Cách chọn</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div
                                            onClick={() => setSplitStrategy('random')}
                                            className={`cursor-pointer border rounded-xl p-3 flex items-center gap-3 transition-all ${splitStrategy === 'random' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${splitStrategy === 'random' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                <Shuffle className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className={`text-xs font-bold ${splitStrategy === 'random' ? 'text-indigo-900' : 'text-slate-700'}`}>Ngẫu nhiên</div>
                                                <div className="text-[10px] text-slate-400">Random selection</div>
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => setSplitStrategy('top')}
                                            className={`cursor-pointer border rounded-xl p-3 flex items-center gap-3 transition-all ${splitStrategy === 'top' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}
                                        >
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${splitStrategy === 'top' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                <ArrowDown className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <div className={`text-xs font-bold ${splitStrategy === 'top' ? 'text-indigo-900' : 'text-slate-700'}`}>Từ trên xuống</div>
                                                <div className="text-[10px] text-slate-400">Top newest</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {tab === 'list' && (
                            <div className="animate-in fade-in slide-in-from-top-1 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                                <textarea
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg outline-none text-xs font-mono min-h-[120px] placeholder:text-slate-300 resize-none bg-white"
                                    placeholder={`Dán danh sách Email hoặc SĐT tại đây...\nname@example.com\n0912345678`}
                                />
                            </div>
                        )}
                    </div>

                    {/* 2. Destination */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                        <h4 className="section-header mt-4">2. Lưu vào đâu?</h4>

                        <div className="p-4 bg-white rounded-[14px] border border-slate-100 shadow-sm space-y-4">
                            {/* Toggle */}
                            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200 w-fit gap-0.5">
                                <button
                                    onClick={() => setDestType('new')}
                                    className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${destType === 'new' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Tạo danh sách mới
                                </button>
                                <button
                                    onClick={() => setDestType('existing')}
                                    className={`px-4 py-1.5 text-[10px] font-bold rounded-lg transition-all ${destType === 'existing' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    Vào danh sách cũ
                                </button>
                            </div>

                            {destType === 'new' ? (
                                <div className="relative group animate-in slide-in-from-left-2 fade-in duration-200">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Plus className="h-4 w-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        value={destinationName}
                                        onChange={(e) => setDestinationName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none text-xs font-bold text-slate-700 bg-slate-50/50 focus:bg-white shadow-sm transition-all placeholder:font-normal"
                                        placeholder="Nhập tên danh sách mới..."
                                    />
                                </div>
                            ) : (
                                <div className="animate-in slide-in-from-right-2 fade-in duration-200">
                                    <CustomSelect
                                        value={selectedListId}
                                        onChange={setSelectedListId}
                                        options={existingLists}
                                        placeholder="-- Chọn danh sách đích --"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 3. Options */}
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                        <h4 className="section-header mt-4">3. Tùy chọn xử lý</h4>
                        <div className="grid grid-cols-1 gap-2.5">
                            <ActionCard
                                title="Di chuyển (Move)"
                                subtitle={`Chuyển contacts sang danh sách đích, xóa khỏi ${sourceType === 'segment' ? 'phân khúc' : 'danh sách'} gốc.`}
                                icon={Filter}
                                selected={excludeFromSource}
                                onClick={() => setExcludeFromSource(!excludeFromSource)}
                                colorClass="orange"
                                layout="row"
                            />
                            <ActionCard
                                title="Tự động hóa (Automation)"
                                subtitle="Kích hoạt Flow chào mừng (nếu có) cho contacts mới."
                                icon={Zap}
                                selected={createAutomation}
                                onClick={() => setCreateAutomation(!createAutomation)}
                                colorClass="indigo"
                                layout="row"
                            />
                            <ActionCard
                                title="Dọn dẹp rác (Clean)"
                                subtitle="Tự động loại bỏ các Email hỏng/Unsubscribed trong tập đích."
                                icon={Trash2}
                                selected={cleanupInvalid}
                                onClick={() => setCleanupInvalid(!cleanupInvalid)}
                                colorClass="rose"
                                layout="row"
                            />
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-slate-100 flex justify-end gap-3 bg-white sticky bottom-0 z-10 shrink-0">
                    <button onClick={onClose} className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors bg-slate-50 hover:bg-slate-100 rounded-[var(--radius-md)]">
                        Hủy bỏ
                    </button>
                    <button
                        onClick={handleSplit}
                        disabled={isLoading}
                        className="px-8 py-2.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold shadow-sm flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
                        Thực hiện Tách
                    </button>
                </div>

            </div>
            <style>{`
                .section-header {
                    font-size: 10px;
                    font-weight: 900;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    margin-left: 4px;
                }
            `}</style>
        </div>,
        getMktPortalRoot()
    );
};

export default AudienceSplitModal;
