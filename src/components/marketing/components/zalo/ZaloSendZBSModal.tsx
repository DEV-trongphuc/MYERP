import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { X, Send, Search, Layout, AlertTriangle, CheckCircle, RefreshCw, FileText, Download, Upload, Info, Phone, User as UserIcon, Settings2, Eye, ReceiptText, BadgeCheck, Globe, Sparkles, Smartphone, Monitor, FileSpreadsheet, Zap, ChevronDown, Check, Braces, Clock, ShieldAlert, UserPlus, Heart, ExternalLink, Star, Globe as Facebook, MessageCircle, List, Plus, Trash2, ArrowRight, MoreHorizontal, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { api } from '../../services/storageAdapter';
import Button from '../common/Button';
import Input from '../common/Input';
import Modal from '../common/Modal';

interface ZNSParam {
    name: string;
    type: string;
    require: boolean;
    sample_value?: string;
}

interface ZNSTemplate {
    id: string;
    template_id: string;
    template_name: string;
    status: string;
    preview_data: ZNSParam[];
    template_data: any;
}

interface Recipient {
    zalo_user_id: string;
    id: string | null;
    data: Record<string, string>;
}

interface ZaloOA {
    id: string;
    name: string;
    oa_id: string;
    avatar?: string;
}

interface ZaloSendZBSModalProps {
    isOpen: boolean;
    onClose: () => void;
    oaId: string;
    selectedSubscribers: any[];
    onSuccess?: () => void;
}

const MERGE_TAGS = [
    { label: 'Họ tên', value: '{{full_name}}' },
    { label: 'Tên (First Name)', value: '{{first_name}}' },
    { label: 'Họ (Last Name)', value: '{{last_name}}' },
    { label: 'Email', value: '{{email}}' },
    { label: 'Công ty', value: '{{company}}' },
    { label: 'Chức danh', value: '{{job_title}}' },
    { label: 'Số điện thoại', value: '{{phone}}' },
];

const UIDTip = () => (
    <div className="bg-amber-600/10 border border-amber-600/20 p-5 rounded-[24px] space-y-3 animate-in slide-in-from-left-4 duration-500 delay-300">
        <div className="flex items-center gap-2 text-amber-600">
            <Sparkles className="w-4 h-4 fill-amber-600" />
            <h5 className="text-[10px] font-bold uppercase tracking-widest">Smart Tip: Ưu tiên gửi qua UID</h5>
        </div>
        <div className="space-y-2">
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                Gửi ZNS qua <span className="text-amber-600 font-bold">UID</span> (Subscriber) giúp bạn <span className="text-amber-600 font-bold">tiết kiệm chi phí</span> hơn so với gửi qua SĐT và tăng khả năng phản hồi trực tiếp ngay trong khung chat OA.
            </p>
            <div className="flex items-start gap-2 bg-white/60 p-2.5 rounded-xl border border-amber-100">
                <ReceiptText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[9px] text-slate-500 font-medium leading-tight italic">
                    Hệ thống tự động tracking tỷ lệ Click & Phản hồi trong Báo cáo chi tiết của từng chiến dịch.
                </p>
            </div>
        </div>
    </div>
);

const VariablePicker: React.FC<{ onSelect: (val: string) => void }> = ({ onSelect }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [isVisible, setIsVisible] = useState(false);
    const [animatePickerIn, setAnimatePickerIn] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            const timer = setTimeout(() => setAnimatePickerIn(true), 10);
            return () => clearTimeout(timer);
        } else {
            setAnimatePickerIn(false);
            const timer = setTimeout(() => setIsVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
            >
                <Braces className="w-4 h-4" />
            </button>
            {isVisible && (
                <div className={`absolute right-0 mt-2 w-48 bg-white border border-slate-100 rounded-xl shadow-2xl z-[10020] py-2 transform transition-all duration-200 ${animatePickerIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95 translate-y-2'}`}>
                    <p className="px-4 py-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Chọn biến</p>
                    {MERGE_TAGS.map(tag => (
                        <button
                            key={tag.value}
                            onClick={() => { onSelect(tag.value); setIsOpen(false); }}
                            className="w-full px-4 py-2 text-left text-xs font-bold text-slate-700 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                        >
                            {tag.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const CustomSelect: React.FC<{
    value: string;
    options: { value: string; label: string; subLabel?: string; icon?: React.ReactNode }[];
    onChange: (value: string) => void;
    placeholder?: string;
}> = ({ value, options, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [isVisible, setIsVisible] = useState(false);
    const [animateDropdownIn, setAnimateDropdownIn] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            const timer = setTimeout(() => setAnimateDropdownIn(true), 10);
            return () => clearTimeout(timer);
        } else {
            setAnimateDropdownIn(false);
            const timer = setTimeout(() => setIsVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-4 py-3 flex items-center justify-between bg-white border rounded-[18px] text-sm font-semibold transition-all ${isOpen ? 'border-amber-600 ring-4 ring-amber-50' : 'border-slate-200 hover:border-blue-400'}`}
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    {selectedOption?.icon && <div className="shrink-0">{selectedOption.icon}</div>}
                    <span className={`block truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-700'}`}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isVisible && (
                <div className={`absolute z-[10010] w-full mt-2 bg-white border border-slate-100 rounded-[22px] shadow-[0_20px_50px_rgba(0,0,0,0.1)] max-h-60 overflow-auto transform transition-all duration-200 ${animateDropdownIn ? 'opacity-100 scale-100' : 'opacity-0 scale-95 translate-y-2'}`}>
                    {options.length > 0 ? options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => { onChange(option.value); setIsOpen(false); }}
                            className={`w-full px-5 py-3.5 flex items-start text-left hover:bg-amber-50 transition-colors group ${option.value === value ? 'bg-amber-50/50' : ''}`}
                        >
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-bold truncate ${option.value === value ? 'text-amber-700' : 'text-slate-700'}`}>{option.label}</p>
                                {option.subLabel && <p className="text-[10px] text-slate-400 mt-1 truncate font-medium">{option.subLabel}</p>}
                            </div>
                            {option.value === value && <Check className="w-4 h-4 text-amber-600 mt-0.5 ml-2 shrink-0" />}
                        </button>
                    )) : (
                        <div className="px-5 py-4 text-xs font-bold text-slate-400 text-center uppercase tracking-widest">Không có dữ liệu</div>
                    )}
                </div>
            )}
        </div>
    );
};

const ZaloSendZBSModal: React.FC<ZaloSendZBSModalProps> = ({ isOpen, onClose: _onClose, oaId, selectedSubscribers, onSuccess }) => {
    const [animateIn, setAnimateIn] = useState(false);
    useEffect(() => {
        if (isOpen) {
            setTimeout(() => setAnimateIn(true), 10);
        } else {
            setAnimateIn(false);
        }
    }, [isOpen]);

    const onClose = () => {
        setAnimateIn(false);
        setTimeout(_onClose, 400);
    };
    const [templates, setTemplates] = useState<ZNSTemplate[]>([]);
    const [oas, setOAs] = useState<ZaloOA[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [paramValues, setParamValues] = useState<Record<string, string>>({});
    const [isSending, setIsSending] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [csvRecipients, setCsvRecipients] = useState<Recipient[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const activeRecipients = csvRecipients.length > 0
        ? csvRecipients
        : selectedSubscribers.map(s => ({ zalo_user_id: s.zalo_user_id, id: s.id, data: {} }));

    const selectedTemplate = templates.find(t => t.template_id === selectedTemplateId);
    const activeOA = oas.find(o => o.id === oaId);

    useEffect(() => {
        if (isOpen && oaId) {
            fetchTemplates();
            fetchOAs();
        }
    }, [isOpen, oaId]);

    const fetchOAs = async () => {
        try {
            const res = await api.get<ZaloOA[]>('zalo_oa');
            if (res.success) setOAs(res.data);
        } catch (error) {
            console.error('Failed to fetch OAs', error);
        }
    };

    const fetchTemplates = async () => {
        setIsLoading(true);
        try {
            const res = await api.get<ZNSTemplate[]>(`zalo_templates?oa_id=${oaId}`);
            if (res.success) {
                let list = Array.isArray(res.data) ? res.data : (res.data as any)?.templates || [];
                list = list.filter((t: any) => t.status?.toUpperCase() === 'APPROVED' || t.status?.toUpperCase() === 'ENABLE' || t.status?.toUpperCase() === 'OK');
                setTemplates(list);
            }
        } catch (error) {
            console.error('Failed to fetch templates', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTemplateChange = async (tplId: string) => {
        setSelectedTemplateId(tplId);
        const t = templates.find(x => x.template_id === tplId);
        if (t) {
            const samples: Record<string, string> = {};
            (t.preview_data || []).forEach(p => { samples[p.name] = p.sample_value || ''; });
            setParamValues(samples);
            fetchTemplateDetail(t.id);
        }
    };

    const fetchTemplateDetail = async (id: string) => {
        setIsLoadingDetail(true);
        try {
            const res = await api.post<{ previewUrl?: string; price_uid?: number; price?: number }>(`zalo_templates?route=detail&id=${id}`, {});
            if (res.success && res.data) {
                setTemplates(prev => prev.map(t => t.id === id ? { ...t, template_data: { ...(t.template_data || {}), detail: res.data } } : t));
            }
        } catch (e) {
            console.error('Failed to fetch detail', e);
        } finally {
            setIsLoadingDetail(false);
        }
    };

    const handleParamChange = (name: string, value: string) => {
        setParamValues(prev => ({ ...prev, [name]: value }));
    };

    const handleUploadCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            if (!text) return;
            const lines = text.split('\n').filter(l => l.trim());
            if (lines.length < 2) return;
            const headers = lines[0].replace(/^\uFEFF/, '').split(',').map(h => h.trim());
            const uidIndex = headers.indexOf('zalo_user_id');
            if (uidIndex === -1) { alert('File CSV phải có cột "zalo_user_id"'); return; }
            const newRecipients: Recipient[] = [];
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values[uidIndex]) {
                    const data: Record<string, string> = {};
                    headers.forEach((h, idx) => { if (h !== 'zalo_user_id') data[h] = values[idx] || ''; });
                    newRecipients.push({ zalo_user_id: values[uidIndex], id: null, data: data });
                }
            }
            if (newRecipients.length > 0) { setCsvRecipients(newRecipients); if (fileInputRef.current) fileInputRef.current.value = ''; }
        };
        reader.readAsText(file);
    };

    const handleDownloadSampleCsv = () => {
        if (!selectedTemplate) return;
        const headers = ['zalo_user_id', ...(selectedTemplate.preview_data || []).map(p => p.name)];
        const row = ['UID_123', ...(selectedTemplate.preview_data || []).map(p => p.sample_value || '')];
        const csvContent = "\uFEFF" + headers.join(",") + "\n" + row.join(",");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `mau_zbs_${selectedTemplate.template_id}.csv`;
        link.click();
    };

    const handleSend = async () => {
        if (!selectedTemplate || activeRecipients.length === 0) return;
        setIsSending(true);
        setMessage(null);
        try {
            const res = await api.post('zalo_audience?route=send_zbs', {
                oa_id: oaId,
                template_id: selectedTemplate.template_id,
                recipients: activeRecipients.map(r => ({ uid: r.zalo_user_id, subscriber_id: r.id, data: r.data })),
                template_data: paramValues
            });
            if (res.success) {
                setMessage({ type: 'success', text: res.message || 'đã gửi thành công!' });
                if (onSuccess) onSuccess();
                setTimeout(() => onClose(), 2000);
            } else {
                setMessage({ type: 'error', text: res.message || 'Gửi thất bại.' });
            }
        } catch (error) { setMessage({ type: 'error', text: 'Lỗi hệ thống.' }); } finally { setIsSending(false); }
    };

    if (!isOpen && !animateIn) return null;

    const tData = selectedTemplate?.template_data?.detail;
    const rawData = selectedTemplate?.template_data?.raw;
    const priceUid = Number(tData?.price_uid || 0);
    const pricePhone = Number(tData?.price || rawData?.price || 0);
    // If UID price is 0 (unsupported), show Phone price.
    const znsPrice = priceUid > 0 ? priceUid : (pricePhone > 0 ? pricePhone : 300);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="4xl"
            noHeader
            noPadding
        >
            <div className="h-[92vh] flex flex-col overflow-hidden bg-[#fcfdfe] font-sans">
                <div className="pt-8 pb-4 text-center shrink-0">
                    <h3 className="text-[24px] font-bold text-slate-800 tracking-tight">Cấu hình Nội dung ZBS</h3>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* LEFT PANEL */}
                    <div className="w-[480px] h-full overflow-y-auto px-10 pb-10 space-y-6 custom-scrollbar">

                        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tài khoản Zalo OA</label>
                                <CustomSelect
                                    value={oaId}
                                    options={[{
                                        value: oaId,
                                        label: activeOA?.name || "IDEAS",
                                        subLabel: `ID: ${oaId}`,
                                        icon: activeOA?.avatar ? (
                                            <img src={activeOA.avatar} className="w-6 h-6 rounded-full object-cover border border-slate-100 shadow-sm" />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-600">I</div>
                                        )
                                    }]}
                                    onChange={() => { }}
                                    placeholder="Chọn tài khoản OA"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mẫu tin nhắn (Template)</label>
                                <CustomSelect
                                    value={selectedTemplateId}
                                    options={templates.map(t => ({ value: t.template_id, label: t.template_name, subLabel: `ID: ${t.template_id}` }))}
                                    onChange={handleTemplateChange}
                                    placeholder="Chọn mẫu ZNS..."
                                />
                            </div>
                        </div>

                        {selectedTemplate && (
                            <>
                                {/* REACH & COST */}
                                <div className="bg-[#111827] rounded-[32px] p-6 shadow-xl space-y-4 text-white relative overflow-hidden animate-in slide-in-from-left-4 duration-500">
                                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-600 opacity-10 rounded-full blur-3xl -mr-10 -mt-10"></div>
                                    <h5 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2 relative z-10">
                                        <Sparkles className="w-3.5 h-3.5 text-[#2563eb]" /> Ước tính gửi ZNS
                                    </h5>
                                    <div className="grid grid-cols-2 gap-4 relative z-10">
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Liên hệ mục tiêu</p>
                                            <p className="text-xl font-bold text-white">{activeRecipients.length}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter mb-1">Tạm tính chi phí</p>
                                            <p className="text-xl font-bold text-blue-400">~ {znsPrice.toLocaleString()}<span className="text-[10px] ml-0.5 text-amber-300">đ/tin</span></p>
                                        </div>
                                    </div>
                                </div>

                                {/* UID UNSUPPORTED WARNING */}
                                {znsPrice > 0 && Number(selectedTemplate?.template_data?.detail?.price_uid || 0) === 0 && (
                                    <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-[24px] flex items-start gap-4 animate-in slide-in-from-left-4 duration-500 delay-50">
                                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                                        </div>
                                        <div>
                                            <h5 className="text-[11px] font-black text-amber-800 uppercase tracking-widest mb-1">
                                                Lưu ý: Template không hỗ trợ UID
                                            </h5>
                                            <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                                                Mẫu này sẽ <b>tự động chuyển sang gửi qua SĐT</b> (nếu có) với chi phí ước tính <b>{znsPrice.toLocaleString()} đ/tin</b>.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* TIME POLICY WARNING */}
                                <div className="bg-amber-50/50 border border-amber-200 p-5 rounded-[24px] space-y-3 animate-in slide-in-from-left-4 duration-500 delay-75">
                                    <div className="flex items-center gap-2 text-amber-600">
                                        <Clock className="w-4 h-4" />
                                        <h5 className="text-[10px] font-bold uppercase tracking-widest">Quy định Thời gian gửi</h5>
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                                            Theo chính sách Zalo, tin nhắn ZNS chỉ được gửi trong khung giờ: <span className="text-amber-700 font-bold">06:00 - 22:00</span> hàng ngày.
                                        </p>
                                        <div className="flex items-start gap-2 bg-white/60 p-2.5 rounded-xl border border-amber-100">
                                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                            <p className="text-[9px] text-slate-500 font-medium leading-tight italic">
                                                Các tin nhắn kích hoạt ngoài khung giờ này sẽ được tạm giữ và gửi vào sáng ngày hôm sau.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <UIDTip />

                                {/* CSV ACTIONS */}
                                <div className="bg-white p-6 rounded-[32px] border-2 border-dashed border-slate-200 bg-amber-50/5 space-y-4 animate-in slide-in-from-left-4 duration-500 delay-150">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-50 rounded-xl text-amber-600 border border-amber-100"><FileSpreadsheet className="w-5 h-5" /></div>
                                        <div>
                                            <h5 className="text-xs font-bold text-slate-800">Dữ liệu liên hệ nâng cao</h5>
                                            <p className="text-[10px] text-slate-400 font-bold tracking-tight uppercase">Cá nhân hóa theo tệp Khách hàng</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={handleDownloadSampleCsv} className="flex items-center justify-center gap-2 py-2.5 px-3 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-[10px] font-bold transition-all border border-slate-200 uppercase tracking-widest">
                                            <Download className="w-3.5 h-3.5" /> Mẫu CSV
                                        </button>
                                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-600 rounded-xl text-[10px] font-bold transition-all border border-amber-100 uppercase tracking-widest">
                                            <Upload className="w-3.5 h-3.5" /> Tải lên CSV
                                        </button>
                                        <input type="file" ref={fileInputRef} onChange={handleUploadCsv} className="hidden" accept=".csv" />
                                    </div>
                                </div>

                                {/* PARAMETERS */}
                                <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm space-y-6 animate-in slide-in-from-left-4 duration-500 delay-200">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Tham số nội dung</label>
                                        <div className="px-2 py-0.5 bg-amber-100/50 rounded-full text-[9px] font-bold text-amber-600 uppercase tracking-tighter">UID INPUT</div>
                                    </div>
                                    <div className="space-y-5">
                                        {selectedTemplate.preview_data.map(p => (
                                            <div key={p.name} className="space-y-1.5 group">
                                                <div className="flex justify-between items-center px-1">
                                                    <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-tight">{p.name}</span>
                                                    <span className="text-[9px] text-slate-300 font-bold uppercase">{p.type}</span>
                                                </div>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        className="w-full text-xs p-3.5 pr-14 rounded-2xl border border-slate-200 bg-slate-50/20 focus:bg-white focus:border-amber-600 focus:ring-4 focus:ring-amber-50/50 transition-all outline-none font-semibold text-slate-700"
                                                        placeholder={`Nhập giá trị cho ${p.name}...`}
                                                        value={paramValues[p.name] || ''}
                                                        onChange={e => handleParamChange(p.name, e.target.value)}
                                                    />
                                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                                                        <VariablePicker onSelect={(val) => {
                                                            const newVal = (paramValues[p.name] || '') + val;
                                                            handleParamChange(p.name, newVal);
                                                        }} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* RIGHT PANEL: SIMULATOR */}
                    <div className="flex-1 bg-[#f1f5f9]/50 rounded-tl-[64px] border-l border-t border-slate-200 flex justify-center items-center relative overflow-hidden group p-10">

                        <div className="absolute -top-24 -right-24 w-[500px] h-[500px] bg-amber-100/40 rounded-full blur-[120px] pointer-events-none"></div>
                        <div className="absolute -bottom-24 -left-24 w-[500px] h-[500px] bg-[#fbbf24]/5 rounded-full blur-[120px] pointer-events-none"></div>

                        {selectedTemplate ? (
                            <div className="relative z-10 w-full h-full flex items-center justify-center animate-in zoom-in-95 duration-700">
                                {/* Fitted Phone Frame */}
                                <div className="w-[320px] h-[640px] relative transition-all duration-500 scale-[0.65] md:scale-[0.7] xl:scale-[0.85] 2xl:scale-[0.95] origin-center">
                                    <div className="absolute inset-x-[-8px] inset-y-[-8px] bg-slate-900 rounded-[50px] shadow-2xl ring-1 ring-white/10"></div>
                                    <div className="w-full h-full bg-white rounded-[44px] relative overflow-hidden flex flex-col border-[2px] border-slate-800 shadow-inner">
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-6 w-32 bg-slate-900 rounded-b-[18px] z-50 flex items-center justify-center">
                                            <div className="w-8 h-1 bg-slate-800 rounded-full"></div>
                                        </div>
                                        <div className="h-10 w-full flex justify-between items-center px-8 text-[11px] font-bold text-slate-800 shrink-0 z-40 bg-white">
                                            <span>9:41</span>
                                            <div className="flex gap-1.5 items-center">
                                                <Zap className="w-3 h-3 text-emerald-500 fill-emerald-500" />
                                                <div className="w-5 h-2.5 border border-slate-300 rounded-[3px] p-[1px] relative">
                                                    <div className="h-full w-4/5 bg-slate-800 rounded-[1px]"></div>
                                                    <div className="absolute right-[-2.5px] top-1/2 -translate-y-1/2 w-[2px] h-[3px] bg-slate-300 rounded-r-sm"></div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex-1 bg-[#f8f9fa] relative flex flex-col">
                                            {isLoadingDetail ? (
                                                <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                                                    <div className="w-10 h-10 border-4 border-amber-50 border-t-amber-600 rounded-full animate-spin"></div>
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Rendering Preview...</p>
                                                </div>
                                            ) : selectedTemplate.template_data?.detail?.previewUrl ? (
                                                <div className="w-full h-full bg-white overflow-hidden relative">
                                                    <iframe
                                                        src={selectedTemplate.template_data.detail.previewUrl}
                                                        className="absolute inset-0 border-0 origin-top pointer-events-none"
                                                        style={{
                                                            width: '125%',
                                                            height: '125%',
                                                            transform: 'scale(0.8)',
                                                            transformOrigin: 'top left',
                                                            border: 'none'
                                                        }}
                                                        scrolling="no"
                                                    />
                                                    <button
                                                        onClick={() => fetchTemplateDetail(selectedTemplate.id)}
                                                        className="absolute bottom-4 right-4 p-2 bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full text-slate-400 hover:text-amber-600 hover:border-amber-200 transition-all shadow-sm z-50 pointer-events-auto"
                                                        title="Tải lại preview"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-5">
                                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-inner border border-slate-50">
                                                        <Smartphone className="w-8 h-8 text-slate-200" />
                                                    </div>
                                                    <h5 className="font-bold text-lg text-slate-800">Preview Unavailable</h5>
                                                    <p className="text-sm font-medium text-slate-400 tracking-tight">Mẫu này chưa có URL preview từ Zalo.</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="h-7 w-full bg-white flex justify-center items-center shrink-0">
                                            <div className="w-32 h-1 bg-slate-200 rounded-full"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center space-y-6 animate-in fade-in zoom-in-95 duration-700">
                                <div className="w-[100px] h-[100px] bg-white rounded-[32px] shadow-2xl flex items-center justify-center mx-auto ring-1 ring-slate-100"><Zap className="w-12 h-12 text-amber-600 animate-pulse" /></div>
                                <div>
                                    <p className="text-slate-800 text-xl font-bold">Chưa chọn mẫu tin</p>
                                    <p className="text-slate-400 text-sm font-medium mt-2 uppercase tracking-wide">Chọn mẫu ở cột trái để xem trước</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Bar */}
                <div className="px-12 py-8 border-t border-slate-50 flex justify-between items-center bg-white shrink-0 z-50">
                    <div className="flex items-center gap-10">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold border border-amber-100/50">{activeRecipients.length}</div>
                            <div className="flex flex-col">
                                <span className="text-md font-bold text-slate-800 tracking-tight leading-none">{activeRecipients.length} Liên hệ</span>
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mt-1.5">Sẵn sàng gửi tin</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {message && (
                            <div className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-xs shadow-lg animate-in slide-in-from-right-8 ${message.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                {message.text}
                            </div>
                        )}
                        <button onClick={onClose} className="px-8 py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-widest text-slate-400 hover:text-slate-700 transition-all">Đóng</button>
                        <button onClick={handleSend} disabled={isSending || !selectedTemplate || activeRecipients.length === 0} className="group relative px-12 py-3.5 bg-slate-900 hover:bg-black text-white rounded-[18px] font-bold text-[10px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 disabled:opacity-50">
                            <span className="relative z-10 flex items-center gap-3">{isSending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3.5 h-3.5" />}{isSending ? 'ĐANG XỬ LÝ...' : 'KÍCH HOẠT GỬI NGAY'}</span>
                        </button>
                    </div>
                </div>

                <style>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 3px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
                    .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
                `}</style>
            </div>
        </Modal>
    );
};

export default ZaloSendZBSModal;
