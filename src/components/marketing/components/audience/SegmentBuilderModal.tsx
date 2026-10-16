import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, Users, Crown, Zap, ShieldCheck, ChevronDown, Check, X, Filter, Sparkles, Copy, MonitorPlay, Search, Loader2, MessageCircle, Bell } from 'lucide-react';
import { Segment, Subscriber } from '../../types';
import { api } from '../../services/storageAdapter';
import toast from 'react-hot-toast';

interface SegmentBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (segment: any) => void;
    initialSegment?: Segment | null;
    subscribers?: Subscriber[];
}

interface SegmentCondition {
    id: string;
    field: string;
    operator: string;
    value: string;
}

interface SegmentGroup {
    id: string;
    conditions: SegmentCondition[];
}

// --- Constants ---

const FIELD_DEFINITIONS: Record<string, { type: 'text' | 'number' | 'date' | 'select' | 'tags', label: string, icon?: any }> = {
    email: { type: 'text', label: 'Email' },
    status: { type: 'select', label: 'Trạng thái' },
    tags: { type: 'tags', label: 'Tag (Nhãn)' },
    source: { type: 'text', label: 'Nguồn (Source)' },
    firstName: { type: 'text', label: 'Tên đầu' },
    lastName: { type: 'text', label: 'Tên đệm/Họ' },
    address: { type: 'text', label: 'Địa chỉ' },
    joinedAt: { type: 'date', label: 'Ngày tham gia' },
    'stats.emailsOpened': { type: 'number', label: 'Đã mở email (lần)' },
    'stats.linksClicked': { type: 'number', label: 'Đã click link (lần)' },
    lastActivityDays: { type: 'number', label: 'Ngày không tương tác' },
    verified: { type: 'select', label: 'Xác thực (Verified)' },
    meta_psid: { type: 'text', label: 'Facebook Messenger' },
};

const OPERATORS_BY_TYPE: Record<string, { value: string, label: string }[]> = {
    text: [
        { value: 'contains', label: 'Chứa' },
        { value: 'equals', label: 'Là' },
        { value: 'starts_with', label: 'Bắt đầu' },
        { value: 'not_contains', label: 'Không chứa' },
        { value: 'is_not_empty', label: 'Có giá trị (*)' },
        { value: 'is_empty', label: 'Không có giá trị (*)' },
    ],
    number: [
        { value: 'greater_than', label: 'Lớn hơn (>)' },
        { value: 'less_than', label: 'Nhỏ hơn (<)' },
        { value: 'equals', label: 'Bằng (=)' },
    ],
    date: [
        { value: 'after', label: 'Sau ngày' },
        { value: 'before', label: 'Trước ngày' },
        { value: 'on', label: 'Đúng ngày' },
    ],
    select: [
        { value: 'is', label: 'Là' },
        { value: 'is_not', label: 'Không là' },
    ],
    tags: [
        { value: 'contains', label: 'Có chứa' },
        { value: 'not_contains', label: 'Không chứa' },
    ]
};

// Define templates slightly differently to avoid TS inference issues with keys
interface SegmentTemplate {
    id: string;
    name: string;
    icon: any;
    color: string;
    criteria: SegmentGroup[];
}

const SEGMENT_TEMPLATES: SegmentTemplate[] = [
    {
        id: 'vip',
        name: 'Khách hàng VIP',
        icon: Crown,
        color: 'amber',
        criteria: [{
            id: 'g1', conditions: [
                { id: 'c1', field: 'tags', operator: 'contains', value: 'VIP' },
                { id: 'c2', field: 'stats.emailsOpened', operator: 'greater_than', value: '10' }
            ]
        }]
    },
    {
        id: 'new_leads',
        name: 'Người mới (7 ngày)',
        icon: Sparkles,
        color: 'blue',
        criteria: [{
            id: 'g1', conditions: [
                { id: 'c1', field: 'joinedAt', operator: 'after', value: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] }
            ]
        }]
    },
    {
        id: 'engaged',
        name: 'Tương tác cao',
        icon: Zap,
        color: 'emerald',
        criteria: [{
            id: 'g1', conditions: [
                { id: 'c1', field: 'stats.linksClicked', operator: 'greater_than', value: '5' }
            ]
        }]
    },
    {
        id: 'verified',
        name: 'Đã Verify Email',
        icon: ShieldCheck,
        color: 'indigo',
        criteria: [{
            id: 'g1', conditions: [
                { id: 'c1', field: 'verified', operator: 'is', value: '1' }
            ]
        }]
    },
    {
        id: 'web_visitors',
        name: 'Khách truy cập Web',
        icon: Filter,
        color: 'rose',
        criteria: [{
            id: 'g1', conditions: [
                { id: 'c1', field: 'source', operator: 'contains', value: 'website_tracking' }
            ]
        }]
    },
    {
        id: 'facebook_messenger',
        name: 'Linked Messenger',
        icon: MessageCircle,
        color: 'blue',
        criteria: [{
            id: 'g1', conditions: [
                { id: 'c1', field: 'meta_psid', operator: 'is_not_empty', value: '' }
            ]
        }]
    }
];

// --- Custom UI Components ---

const CompactSelect = ({
    value,
    onChange,
    options,
    placeholder,
    className = ""
}: {
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    className?: string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(o => o.value === value);

    const [isVisible, setIsVisible] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        if (isOpen) {
            setIsVisible(true);
            const timer = setTimeout(() => setAnimateIn(true), 10);
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                clearTimeout(timer);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        } else {
            setAnimateIn(false);
            const timer = setTimeout(() => setIsVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-3 py-2 rounded-lg border cursor-pointer flex items-center justify-between transition-all bg-white text-xs h-[38px] ${isOpen ? 'border-[#2563eb] ring-2 ring-orange-500/10' : 'border-slate-200 hover:border-slate-300'
                    }`}
            >
                <span className={`truncate font-medium ${selectedOption ? 'text-slate-700' : 'text-slate-400'}`}>
                    {selectedOption?.label || placeholder}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isVisible && (
                <div className={`absolute z-50 w-full mt-1 bg-white rounded-lg shadow-xl border border-slate-100 py-1 max-h-56 overflow-y-auto custom-scrollbar transform transition-all duration-200 ${animateIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`}>
                    {options.map(opt => (
                        <div
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`px-3 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs group ${value === opt.value ? 'bg-orange-50 text-[#2563eb] font-bold' : 'text-slate-600'}`}
                        >
                            <span>{opt.label}</span>
                            {value === opt.value && <Check className="w-3 h-3 text-[#2563eb]" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


const SegmentBuilderModal: React.FC<SegmentBuilderModalProps> = ({ isOpen, onClose, onSave, initialSegment, subscribers = [] }) => {
    // Animation State
    const [isVisible, setIsVisible] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);

    const [name, setName] = useState('');
    const [groups, setGroups] = useState<SegmentGroup[]>([]);
    const [estimatedCount, setEstimatedCount] = useState(0);
    const [autoCleanupDays, setAutoCleanupDays] = useState('0');
    const [notifyOnJoin, setNotifyOnJoin] = useState(false);
    const [notifySubject, setNotifySubject] = useState('');
    const [notifyEmail, setNotifyEmail] = useState('');
    const [notifyCc, setNotifyCc] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Initial Load
    useEffect(() => {
        if (isOpen) {
            if (initialSegment) {
                setName(initialSegment.name);
                setAutoCleanupDays(initialSegment.autoCleanupDays?.toString() || '0');
                // Cast to boolean explicitly since API might return 0, 1, "0" or "1" depending on MySQL driver
                const nj = initialSegment.notifyOnJoin as any;
                setNotifyOnJoin(nj === true || nj === 1 || nj === '1');
                setNotifySubject(initialSegment.notifySubject || '');
                setNotifyEmail(initialSegment.notifyEmail || '');
                setNotifyCc(initialSegment.notifyCc || '');
                try {
                    const parsedCriteria = JSON.parse(initialSegment.criteria);
                    setGroups(Array.isArray(parsedCriteria) ? parsedCriteria : []);
                } catch {
                    resetGroups();
                }
            } else {
                setName('');
                setAutoCleanupDays('0');
                setNotifyOnJoin(false);
                setNotifySubject('');
                setNotifyEmail('');
                setNotifyCc('');
                resetGroups();
            }
        }
    }, [isOpen, initialSegment]);

    // Animation Effect
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
            setTimeout(() => setAnimateIn(true), 10);
        } else {
            setAnimateIn(false);
            setTimeout(() => {
                setIsVisible(false);
                document.body.style.overflow = 'unset';
            }, 400);
        }
    }, [isOpen]);

    const resetGroups = () => {
        setGroups([{ id: crypto.randomUUID(), conditions: [{ id: crypto.randomUUID(), field: 'tags', operator: 'contains', value: '' }] }]);
    };

    // Estimate Effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!isOpen) return;
            try {
                const res = await api.post('segments.php?route=estimate', { criteria: groups });
                if (res.success && typeof (res.data as any)?.count === 'number') {
                    setEstimatedCount((res.data as any).count);
                }
            } catch (e) { console.error(e); }
        }, 600);
        return () => clearTimeout(timer);
    }, [groups, isOpen]);

    // Handlers
    const applyTemplate = (tpl: SegmentTemplate) => {
        setName(tpl.name);
        setGroups(tpl.criteria.map((g) => ({
            ...g,
            id: crypto.randomUUID(),
            conditions: g.conditions.map((c) => ({ ...c, id: crypto.randomUUID() }))
        })));
    };

    const updateCondition = (groupId: string, condId: string, key: keyof SegmentCondition, val: string) => {
        setGroups(groups.map(g => {
            if (g.id !== groupId) return g;
            return {
                ...g,
                conditions: g.conditions.map(c => {
                    if (c.id !== condId) return c;
                    const updated = { ...c, [key]: val };
                    // Reset value/operator when field changes
                    if (key === 'field') {
                        const type = FIELD_DEFINITIONS[val]?.type || 'text';
                        updated.operator = OPERATORS_BY_TYPE[type][0].value;
                        updated.value = '';
                    }
                    return updated;
                })
            };
        }));
    };

    const addCondition = (groupId: string) => {
        setGroups(groups.map(g => g.id === groupId ? { ...g, conditions: [...g.conditions, { id: crypto.randomUUID(), field: 'email', operator: 'contains', value: '' }] } : g));
    };

    const removeCondition = (groupId: string, condId: string) => {
        setGroups(groups.map(g => g.id === groupId ? {
            ...g, conditions: g.conditions.filter(c => c.id !== condId)
        } : g).filter(g => g.conditions.length > 0)); // Remove group if empty
    };

    const addGroup = () => {
        setGroups([...groups, {
            id: crypto.randomUUID(),
            conditions: [{ id: crypto.randomUUID(), field: 'email', operator: 'contains', value: '' }]
        }]);
    };

    const handleSave = async () => {
        if (!name.trim()) return toast.error('Vui lòng nhập tên phân khúc');
        setIsLoading(true);
        try {
            await Promise.resolve(onSave({ ...initialSegment, name, criteria: JSON.stringify(groups), count: estimatedCount, autoCleanupDays: parseInt(autoCleanupDays), notifyOnJoin, notifySubject, notifyEmail, notifyCc }));
            onClose(); // Close modal after successful save
        } catch (error) {
            toast.error('Có lỗi xảy ra');
        } finally {
            setIsLoading(false);
        }
    };

    const renderInput = (groupId: string, cond: SegmentCondition) => {
        const type = FIELD_DEFINITIONS[cond.field]?.type || 'text';

        // Hide input for is_empty and is_not_empty operators
        if (cond.operator === 'is_empty' || cond.operator === 'is_not_empty') {
            return (
                <input
                    type="text"
                    disabled
                    value="*"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-400 h-[38px] text-center cursor-not-allowed"
                    placeholder="Bất kỳ giá trị nào"
                />
            );
        }

        if (type === 'select' && cond.field === 'status') {
            return <CompactSelect options={[
                { value: 'active', label: 'Active' },
                { value: 'unsubscribed', label: 'Unsubscribed' },
                { value: 'bounced', label: 'Bounced' },
                { value: 'complained', label: 'Complained' },
                { value: 'lead', label: 'Lead' },
                { value: 'customer', label: 'Customer' }
            ]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} />;
        }
        if (type === 'select' && cond.field === 'verified') {
            return <CompactSelect options={[{ value: '1', label: 'Đã xác thực' }, { value: '0', label: 'Chưa xác thực' }]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} />;
        }

        return (
            <input
                type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
                value={cond.value}
                onChange={(e) => updateCondition(groupId, cond.id, 'value', e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-[#2563eb] focus:ring-2 focus:ring-orange-100 outline-none text-xs font-medium text-slate-700 bg-white h-[38px]"
                placeholder="Giá trị..."
            />
        );
    };

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[110000] flex items-center justify-center p-4">
            <div
                className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ease-out ${animateIn ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <div
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                className={`bg-white rounded-[24px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] ring-1 ring-white/20 font-sans overflow-hidden transform transition-all duration-500 relative ${animateIn ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'}`}
            >

                {isLoading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-50 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 text-[#2563eb] animate-spin" />
                            <p className="text-xs font-bold text-slate-500 animate-pulse">Đang xử lý...</p>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#2563eb] flex items-center justify-center border border-orange-100 shadow-sm">
                            <Filter className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 tracking-tight">{initialSegment ? 'Chỉnh sửa Phân Khúc' : 'Tạo Phân Khúc Mới'}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bộ lọc dữ liệu Khách hàng</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 pb-8 overflow-y-auto custom-scrollbar space-y-6 flex-1 bg-slate-50/50">

                    {/* Templates */}
                    {!initialSegment && (
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mẫu có sẵn</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {SEGMENT_TEMPLATES.map(tpl => {
                                    const Icon = tpl.icon;
                                    return (
                                        <button
                                            key={tpl.id}
                                            onClick={() => applyTemplate(tpl)}
                                            className={`flex flex-col items-center justify-center p-3 rounded-xl border border-slate-100 bg-white hover:border-${tpl.color}-200 hover:shadow-md hover:bg-${tpl.color}-50/30 transition-all group w-full`}
                                        >
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 transition-transform group-hover:scale-110 bg-${tpl.color}-100 text-${tpl.color}-600`}>
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-800 text-center leading-tight">{tpl.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tên phân khúc</label>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="VD: Khách hàng VIP tại TP.HCM..."
                                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 focus:border-[#2563eb] focus:ring-4 focus:ring-orange-100 outline-none text-xs font-bold text-slate-700 bg-white h-[40px]"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Lưu trữ tự động</label>
                            <CompactSelect
                                value={autoCleanupDays}
                                onChange={setAutoCleanupDays}
                                options={[
                                    { value: '0', label: 'Không bao giờ' },
                                    { value: '30', label: 'Sau 30 ngày' },
                                    { value: '90', label: 'Sau 90 ngày' }
                                ]}
                                className="h-[40px]"
                            />
                        </div>
                    </div>

                    {/* Features Toggle */}
                    <div className="flex flex-col p-3.5 rounded-[16px] border border-slate-200 bg-white shadow-sm mt-4 transition-all">
                        <div className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center transition-colors group-hover:bg-orange-100 border border-orange-100 shadow-sm">
                                    <Bell className={`w-5 h-5 ${notifyOnJoin ? 'text-orange-500 animate-pulse' : 'text-[#2563eb]'}`} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 tracking-tight mb-0.5">Thời gian thực: Báo Cáo Lead Mới</h4>
                                    <p className="text-[11px] font-medium text-slate-500">Tự động push thông báo trực tiếp cho bạn khi có user thỏa mãn điều kiện gia nhập (Join) vào nhánh phân khúc này.</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer mr-1">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={notifyOnJoin}
                                    onChange={(e) => setNotifyOnJoin(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#2563eb]"></div>
                            </label>
                        </div>
                        
                        {notifyOnJoin && (
                            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tiêu đề (Subject) <span className="text-orange-500">*</span></label>
                                    <input
                                        value={notifySubject}
                                        onChange={(e) => setNotifySubject(e.target.value)}
                                        placeholder="VD: [Cảnh báo Khách Nóng] Lead mới lọt lưới..."
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-[#2563eb] focus:ring-4 focus:ring-orange-100 outline-none text-xs font-medium text-slate-700 bg-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Email nhận <span className="text-orange-500">*</span></label>
                                    <input
                                        value={notifyEmail}
                                        onChange={(e) => setNotifyEmail(e.target.value)}
                                        placeholder="admin@example.com"
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-[#2563eb] focus:ring-4 focus:ring-orange-100 outline-none text-xs font-medium text-slate-700 bg-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Email CC thêm (Tùy chọn)</label>
                                    <input
                                        value={notifyCc}
                                        onChange={(e) => setNotifyCc(e.target.value)}
                                        placeholder="sale1@example.com, mgr@example.com"
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:border-[#2563eb] focus:ring-4 focus:ring-orange-100 outline-none text-xs font-medium text-slate-700 bg-white"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Conditions */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Điều kiện lọc</h4>
                        </div>

                        {groups.map((group, groupIdx) => (
                            <div key={group.id} className="relative animate-in slide-in-from-bottom-2 duration-300">
                                {groupIdx > 0 && (
                                    <div className="flex items-center gap-3 my-3">
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                        <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[9px] font-bold uppercase tracking-wider border border-amber-100 shadow-sm">HOẶC (OR)</div>
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                    </div>
                                )}

                                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm group hover:border-orange-300 hover:shadow-md transition-all relative">
                                    {/* Group Actions */}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button onClick={() => setGroups([...groups, { ...group, id: crypto.randomUUID(), conditions: group.conditions.map(c => ({ ...c, id: crypto.randomUUID() })) }])} className="p-1.5 text-slate-400 hover:text-[#2563eb] hover:bg-orange-50 rounded-lg transition-colors" title="Nhân bản">
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                        {groups.length > 1 && (
                                            <button onClick={() => setGroups(groups.filter(g => g.id !== group.id))} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Xóa nhóm">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        {group.conditions.map((cond, condIdx) => (
                                            <div key={cond.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center relative pl-8 sm:pl-0">
                                                {/* Logic Connector */}
                                                <div className="absolute sm:static left-0 top-3 sm:top-auto w-6 sm:w-10 text-right shrink-0 mr-2">
                                                    {condIdx === 0 ? (
                                                        <span className="text-[10px] font-bold text-slate-400">NẾU</span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-[#2563eb] bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100">VÀ</span>
                                                    )}
                                                </div>

                                                <div className="flex-1 grid grid-cols-10 gap-2 w-full">
                                                    <div className="col-span-4">
                                                        <CompactSelect
                                                            options={Object.entries(FIELD_DEFINITIONS).map(([k, v]) => ({ value: k, label: v.label }))}
                                                            value={cond.field}
                                                            onChange={(v) => updateCondition(group.id, cond.id, 'field', v)}
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <CompactSelect
                                                            options={OPERATORS_BY_TYPE[FIELD_DEFINITIONS[cond.field]?.type || 'text'] || OPERATORS_BY_TYPE.text}
                                                            value={cond.operator}
                                                            onChange={(v) => updateCondition(group.id, cond.id, 'operator', v)}
                                                        />
                                                    </div>
                                                    <div className="col-span-4 relative group/input">
                                                        {renderInput(group.id, cond)}
                                                        {group.conditions.length > 1 && (
                                                            <button onClick={() => removeCondition(group.id, cond.id)} className="absolute -right-2 -top-2 bg-white text-rose-500 p-1 rounded-full border border-slate-100 shadow-md opacity-0 group-hover/input:opacity-100 transition-all hover:bg-rose-50 hover:scale-110">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-3 pl-12 flex">
                                        <button
                                            onClick={() => addCondition(group.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-[#2563eb] bg-orange-50 hover:bg-orange-100 transition-all border border-orange-100"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Thêm điều kiện (AND)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={addGroup}
                            className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#2563eb] hover:bg-orange-50/50 text-slate-400 hover:text-[#2563eb] transition-all flex items-center justify-center gap-2 text-xs font-bold group"
                        >
                            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            Thêm nhóm điều kiện mới (OR)
                        </button>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white shrink-0 sticky bottom-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Dự kiến</p>
                            <div className="flex items-end gap-1">
                                <span className="text-lg font-black text-slate-800 leading-none">{estimatedCount.toLocaleString()}</span>
                                <span className="text-[10px] font-bold text-slate-500 mb-0.5">khách</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} disabled={isLoading} className="px-5 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 bg-white hover:bg-slate-50 rounded-xl transition-all">
                            Hủy
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className={`px-6 py-2.5 rounded-xl text-white text-xs font-bold shadow-lg shadow-[#2563eb]/20 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 ${isLoading ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-[#2563eb] to-blue-600 hover:from-[#561dd0] hover:to-blue-700'}`}
                        >
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {initialSegment ? 'Lưu thay đổi' : 'Tạo phân khúc'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SegmentBuilderModal;
