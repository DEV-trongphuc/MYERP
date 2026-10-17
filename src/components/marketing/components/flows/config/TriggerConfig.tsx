
import React, { useState, useEffect, useMemo } from 'react';
import {
    Users, Tag, Target, Loader2, FileInput, Calendar, Clock,
    CheckCircle2, Send, Cake, Lock,
    List, Snowflake, History, Layers, Search, MessageSquare,
    Info, Filter, ArrowRight, MousePointer2, Check, ShoppingCart, Zap,
    UserPlus, UserMinus, AlertCircle, Ticket, PartyPopper, Bot, ClipboardList
} from 'lucide-react';
import { api } from '../../../services/storageAdapter';
import { Campaign, Flow, Segment, FormDefinition, PurchaseEvent, CustomEvent, VoucherCampaign } from '../../../types';
import { Survey } from '../../../types/survey';
import IntegrationGuideModal from '../modals/IntegrationGuideModal';
import { isManualList, isSyncList } from '../../../utils/listHelpers';
import Input from '../../common/Input';
import Select from '../../common/Select';

interface TriggerConfigProps {
    config: Record<string, any>;
    onChange: (newConfig: Record<string, any>, newLabel?: string) => void;
    disabled?: boolean;
    locked?: boolean;
    allFlows?: Flow[];
    currentFlowId?: string;
}

const GoogleSheetsIcon = ({ className }: { className?: string }) => (
    <div className={className} style={{ width: className?.includes('w-3') ? '12px' : '18px', height: className?.includes('h-3') ? '12px' : '18px' }}>
        <img
            src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png"
            className="w-full h-full max-w-full max-h-full object-contain block"
            alt="Google Sheets"
        />
    </div>
);

const MisaIcon = ({ className }: { className?: string }) => (
    <div className={className} style={{ width: className?.includes('w-3') ? '12px' : '18px', height: className?.includes('h-3') ? '12px' : '18px' }}>
        <img
            src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRlIpztniIEN5ZYvLlwwqBvhzdodvu2NfPSbg&s"
            className="w-full h-full max-w-full max-h-full object-contain block rounded-full"
            alt="MISA CRM"
        />
    </div>
);

const TriggerConfig: React.FC<TriggerConfigProps> = ({ config, onChange, disabled, locked }) => {
    const [triggerType, setTriggerType] = useState<'segment' | 'tag' | 'form' | 'survey' | 'date' | 'campaign' | 'purchase' | 'custom_event' | 'erp_event' | 'voucher' | 'voucher_redeem' | 'inbound_message' | 'zalo_follow' | 'unsubscribe' | 'ai_capture'>(config.type || 'segment');
    const [targetSubtype, setTargetSubtype] = useState<'list' | 'segment' | 'sync'>(config.targetSubtype || 'list');
    const [lists, setLists] = useState<any[]>([]);
    const [segments, setSegments] = useState<Segment[]>([]);
    const [tags, setTags] = useState<any[]>([]);
    const [forms, setForms] = useState<FormDefinition[]>([]);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [purchases, setPurchases] = useState<PurchaseEvent[]>([]);
    const [customEvents, setCustomEvents] = useState<CustomEvent[]>([]);
    const [voucherCampaigns, setVoucherCampaigns] = useState<VoucherCampaign[]>([]);
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [chatbots, setChatbots] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showGuide, setShowGuide] = useState(false);
    const [birthdayTab, setBirthdayTab] = useState<'list' | 'sync' | 'segment'>('list');
    const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);
    const [customFieldDefs, setCustomFieldDefs] = useState<{ key: string; label: string; type?: string }[]>([]);

    useEffect(() => {
        if (!config.targetLists || config.targetLists !== 'specific') {
            setEstimatedCount(null);
            return;
        }

        const listIds = config.targetListIds || [];
        const segIds = config.targetSegmentIds || [];

        if (listIds.length === 0 && segIds.length === 0) {
            setEstimatedCount(0);
            return;
        }

        const timer = setTimeout(async () => {
            setIsCalculating(true);
            try {
                // Ensure array format for query params
                const listParam = listIds.join(',');
                const segParam = segIds.join(',');
                const res = await api.get<any>(`subscribers?route=count_unique&listIds=${listParam}&segmentIds=${segParam}`);
                if (res.success) {
                    setEstimatedCount(res.data.count);
                }
            } catch (e) {
                console.error("Failed to estimate audience", e);
            } finally {
                setIsCalculating(false);
            }
        }, 600); // Debounce 600ms

        return () => clearTimeout(timer);
    }, [config.targetLists, config.targetListIds, config.targetSegmentIds]);

    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            const [listRes, segRes, campRes, tagRes, formRes, purchRes, customRes, surveyRes, chatbotsRes] = await Promise.all([
                api.get<any[]>('lists'),
                api.get<Segment[]>('segments'),
                api.get<Campaign[]>('campaigns'),
                api.get<any[]>('tags'),
                api.get<FormDefinition[]>('forms'),
                api.get<PurchaseEvent[]>('purchase_events'),
                api.get<CustomEvent[]>('custom_events'),
                api.get<Survey[]>('surveys'),
                api.get<any>('ai_chatbots?action=list')
            ]);
            if (listRes.success) setLists(listRes.data);
            if (segRes.success) setSegments(segRes.data);
            if (campRes.success) setCampaigns(campRes.data);
            if (tagRes.success) setTags(Array.isArray(tagRes.data) ? tagRes.data : ((tagRes.data as any)?.data || []));
            if (formRes.success) setForms(formRes.data);
            if (purchRes.success) setPurchases(purchRes.data);
            if (chatbotsRes.success) setChatbots(chatbotsRes.data.filter((b: any) => b.ai_enabled || b.is_enabled || b.status === 'active' || !b.status));
            if (customRes.success) setCustomEvents(customRes.data);
            if (surveyRes.success) setSurveys(surveyRes.data);

            if (customRes) {
                const arr = await Promise.all([api.get<VoucherCampaign[]>('voucher_campaigns')]);
                if (arr[0].success) setVoucherCampaigns(arr[0].data);
            }
            try {
                const cfRes = await api.get<any>('subscribers?route=field_definitions');
                if (cfRes.success && cfRes.data) {
                    setCustomFieldDefs(cfRes.data.filter((f: any) => f.type === 'date' || f.type === 'datetime'));
                }
            } catch (e) { /* ignore */ }

            setLoading(false);
        };
        loadInitialData();
    }, []);

    const erpEventPresets = [
        { id: 'erp_deposit_approved', label: 'Duyệt Đặt cọc / Đóng Học phí', desc: 'Khi Kế toán duyệt phiếu thu / đợt thanh toán' },
        { id: 'erp_deal_won', label: 'Chốt thành công Cơ hội (Deal Won)', desc: 'Khi Sale chuyển Deal sang giai đoạn Won' },
        { id: 'erp_student_enrolled', label: 'Ghi danh Học viên vào Lớp học', desc: 'Khi Học viên được xếp lớp đào tạo MYERP' },
        { id: 'erp_tuition_overdue', label: 'Quá hạn đóng Học phí đợt tiếp', desc: 'Khi Học viên có đợt đóng học phí quá hạn' },
        { id: 'erp_certificate_issued', label: 'Cấp Chứng chỉ Tốt nghiệp', desc: 'Khi Học viên hoàn thành khóa & nhận chứng chỉ' },
        { id: 'erp_ticket_created', label: 'Khách tạo Ticket Hỗ trợ / Khiếu nại', desc: 'Khi phát sinh Ticket CSKH trên MYERP' },
        { id: 'erp_ticket_resolved', label: 'Hoàn tất xử lý Ticket (Resolved)', desc: 'Khi Ticket hỗ trợ được đóng / giải quyết xong' }
    ];

    const triggerOptions = [
        { id: 'segment', label: 'Danh sách & Phân khúc', icon: Layers, color: 'orange', desc: 'Bộ lọc thông minh' },
        { id: 'erp_event', label: 'Sự kiện MYERP & Học vụ', icon: CheckCircle2, color: 'indigo', desc: 'Đặt cọc, Lớp học, SLA' },
        { id: 'form', label: 'Gửi Biểu mẫu', icon: FileInput, color: 'yellow', desc: 'Từ Landing Page' },
        { id: 'survey', label: 'Làm Khảo sát', icon: ClipboardList, color: 'emerald', desc: 'Hoàn thành Survey' },
        { id: 'purchase', label: 'Khách hàng Mua', icon: ShoppingCart, color: 'pink', desc: 'Sự kiện API' },
        { id: 'inbound_message', label: 'Tin nhắn đến', icon: MessageSquare, color: 'blue', desc: 'Meta / Zalo OA / Keyword' },
        { id: 'zalo_follow', label: 'Quan tâm Zalo', icon: UserPlus, color: 'cyan', desc: 'Khi khách nhấn Follow' },
        { id: 'custom_event', label: 'Custom Event', icon: Zap, color: 'violet', desc: 'Sự kiện tùy chọn' },
        { id: 'voucher', label: 'Nhận Voucher', icon: Ticket, color: 'amber', desc: 'Mã giảm giá/Khuyến mãi' },
        { id: 'voucher_redeem', label: 'Sử dụng Voucher', icon: PartyPopper, color: 'emerald', desc: 'Khi khách gạch mã' },
        { id: 'tag', label: 'Được gắn nhãn', icon: Tag, color: 'emerald', desc: 'Phân loại thủ công' },
        { id: 'date', label: 'Ngày / Sự kiện', icon: Calendar, color: 'blue', desc: 'Sinh nhật, Ngủ đông' },
        { id: 'campaign', label: 'Sau Chiến dịch', icon: Send, color: 'indigo', desc: 'Tương tác Email' },
        { id: 'ai_capture', label: 'Lead từ AI Chatbot', icon: Bot, color: 'rose', desc: 'AI lấy Email/SDT' },
        { id: 'unsubscribe', label: 'Hủy đăng ký', icon: UserMinus, color: 'red', desc: 'Khi khách nhấn Unsub' },
    ];

    const getLabelForType = (type: string, targetId: string, subtype?: string, dateField?: string) => {
        switch (type) {
            case 'segment':
                if (subtype === 'segment') {
                    const seg = segments.find(s => s.id === targetId);
                    return seg ? `Vào Phân khúc: ${seg.name}` : 'Khi vào Phân khúc';
                }
                if (subtype === 'sync') {
                    const list = lists.find(l => l.id === targetId);
                    return list ? `Đồng bộ: ${list.name}` : 'Khi đồng bộ dữ liệu';
                }
                const list = lists.find(l => l.id === targetId);
                return list ? `Vào Danh sách: ${list.name}` : 'Khi vào Danh sách';
            case 'form':
                const form = forms.find(f => f.id === targetId);
                return form ? `Gửi Form: ${form.name}` : 'Khi đã gửi Biểu mẫu';
            case 'survey':
                const surv = surveys.find(s => s.id === targetId);
                return surv ? `Khảo sát: ${surv.name}` : 'Khi hoàn thành Khảo sát';
            case 'purchase':
                const purch = purchases.find(p => p.id === targetId);
                return purch ? `Mua hàng: ${purch.name}` : 'Khi khách Mua hàng';
            case 'erp_event':
                const erpPreset = erpEventPresets.find(e => e.id === targetId);
                return erpPreset ? `MYERP: ${erpPreset.label}` : 'Khi có sự kiện MYERP';
            case 'custom_event':
                const ce = customEvents.find(c => c.id === targetId);
                return ce ? `Sự kiện: ${ce.name}` : 'Khi có sự kiện tùy chọn';
            case 'voucher':
                const vc = voucherCampaigns.find(v => v.id === targetId);
                return vc ? `Khi nhận Voucher: ${vc.name}` : 'Khi nhận Voucher';
            case 'voucher_redeem':
                const vr = voucherCampaigns.find(v => v.id === targetId);
                return vr ? `Khi dùng Voucher: ${vr.name}` : 'Khi sử dụng mã Voucher';
            case 'inbound_message':
                return targetId ? `Tin nhắn: "${targetId}"` : 'Khi khách đã gửi tin nhắn';
            case 'zalo_follow':
                return 'Khi khách Quan tâm Zalo OA';
            case 'ai_capture':
                return 'Khi AI Chatbot Capture Lead';
            case 'unsubscribe':
                return 'Khi khách Hủy đăng ký';
            case 'tag':
                return targetId ? `Được gắn Tag: ${targetId}` : 'Khi được gắn nhãn';
            case 'campaign':
                const camp = campaigns.find(c => c.id === targetId);
                return camp ? `Sau Campaign: ${camp.name}` : 'Tương tác chiến dịch';
            case 'date':
                if (dateField === 'dateOfBirth' || dateField === 'anniversaryDate' || dateField === 'joinedAt') {
                    const isBirth = dateField === 'dateOfBirth';
                    const isJoined = dateField === 'joinedAt';
                    const attr = isBirth ? 'sinh nhật' : (isJoined ? 'ngày gia nhập' : 'ngày kỷ niệm');
                    const offsetType = config.offsetType || 'on';
                    const offsetVal = config.offsetValue || 0;
                    if (offsetType === 'on') return `Mừng ${isBirth ? 'Sinh nhật' : (isJoined ? 'Ngày gia nhập' : 'Kỷ niệm')}`;
                    return `${offsetVal} ngày ${offsetType === 'before' ? 'trước' : 'sau'} ${attr}`;
                }
                if (dateField === 'specificDate') return `Vào ngày ${config.specificDate || '...'}`;
                if (dateField === 'lastActivity') return 'Khách hàng ngủ đông';
                if (dateField === 'custom_field_date') {
                    const fieldKey = config.customFieldKey || '...';
                    const offsetType = config.offsetType || 'on';
                    const offsetVal = config.offsetValue || 0;
                    if (offsetType === 'on') return `Trigger ngày: ${fieldKey}`;
                    return `${offsetVal} ngày ${offsetType === 'before' ? 'trước' : 'sau'} [${fieldKey}]`;
                }
                return 'Sự kiện theo ngày';
            default: return 'Bắt đầu Flow';
        }
    };

    const handleTypeChange = (type: string) => {
        if (disabled || locked) return;
        setTriggerType(type as any);
        setSearchTerm('');
        const newLabel = getLabelForType(type, '', type === 'segment' ? 'list' : undefined);
        onChange({ ...config, type, targetId: '', targetSubtype: type === 'segment' ? 'list' : undefined }, newLabel);
    };

    useEffect(() => {
        if (triggerType === 'zalo_follow' && config.targetId) {
            onChange({ ...config, type: 'zalo_follow', targetId: '' }, getLabelForType('zalo_follow', ''));
        }
    }, [triggerType]);

    const handleTargetChange = (id: string, subtype?: string) => {
        if (disabled) return;
        const finalSubtype = subtype || targetSubtype;
        const newLabel = getLabelForType(triggerType, id, finalSubtype, config.dateField);
        onChange({ ...config, targetId: id, targetSubtype: finalSubtype }, newLabel);
    };

    const getOptionClasses = (color: string, isSelected: boolean) => {
        const colors: any = {
            orange: isSelected ? 'border-[var(--color-primary)] bg-red-50 ring-red-50' : 'hover:border-red-200',
            amber: isSelected ? 'border-[var(--color-primary)] bg-red-50 ring-red-50' : 'hover:border-red-200',
            yellow: isSelected ? 'border-yellow-500 bg-yellow-50 ring-yellow-50' : 'hover:border-yellow-200',
            pink: isSelected ? 'border-pink-500 bg-pink-50 ring-pink-50' : 'hover:border-pink-200',
            emerald: isSelected ? 'border-emerald-500 bg-emerald-50 ring-emerald-50' : 'hover:border-emerald-200',
            blue: isSelected ? 'border-blue-500 bg-blue-50 ring-blue-50' : 'hover:border-blue-200',
            cyan: isSelected ? 'border-cyan-500 bg-cyan-50 ring-cyan-50' : 'hover:border-cyan-200',
            violet: isSelected ? 'border-blue-500 bg-blue-50 ring-blue-50' : 'hover:border-blue-200',
            indigo: isSelected ? 'border-indigo-500 bg-indigo-50 ring-indigo-50' : 'hover:border-indigo-200',
            rose: isSelected ? 'border-rose-500 bg-rose-50 ring-rose-50' : 'hover:border-rose-200',
            red: isSelected ? 'border-red-500 bg-red-50 ring-red-50' : 'hover:border-red-200',
        };
        return colors[color] || '';
    };

    const getIconClasses = (color: string, isSelected: boolean) => {
        const colors: any = {
            orange: isSelected ? 'bg-[var(--color-primary)] text-white' : 'bg-red-50 text-[var(--color-primary)]',
            amber: isSelected ? 'bg-[var(--color-primary)] text-white' : 'bg-red-50 text-[var(--color-primary)]',
            yellow: isSelected ? 'bg-yellow-500 text-white' : 'bg-yellow-50 text-yellow-600',
            pink: isSelected ? 'bg-pink-500 text-white' : 'bg-pink-50 text-pink-500',
            emerald: isSelected ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-500',
            blue: isSelected ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-500',
            cyan: isSelected ? 'bg-cyan-500 text-white' : 'bg-cyan-50 text-cyan-600',
            violet: isSelected ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-500',
            indigo: isSelected ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-500',
            rose: isSelected ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-500',
            red: isSelected ? 'bg-red-500 text-white' : 'bg-red-50 text-red-500',
        };
        return colors[color] || '';
    };

    const ConfigItem = ({ label, desc, icon: Icon, isSelected, onClick }: any) => (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full flex items-center justify-between p-4 rounded-[14px] border-2 transition-all duration-300 group relative overflow-hidden
        ${isSelected
                    ? 'border-emerald-500 bg-emerald-50 shadow-md ring-4 ring-emerald-500/5'
                    : 'border-transparent bg-slate-50 hover:bg-white hover:border-slate-200 hover:shadow-sm'}
        ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}`}
        >
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 shrink-0 flex items-center justify-center rounded-[var(--radius-md)] transition-all duration-500 ${isSelected ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white text-slate-400 group-hover:text-slate-600 shadow-sm'}`}>
                    <Icon className="w-5 h-5" />
                </div>
                <div className="text-left overflow-hidden">
                    <p className={`text-[13px] font-black tracking-tight transition-colors ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>{label}</p>
                    {desc && <p className={`text-[10px] font-bold uppercase tracking-widest mt-0.5 transition-colors ${isSelected ? 'text-emerald-600/70' : 'text-slate-400'}`}>{desc}</p>}
                </div>
            </div>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? 'border-emerald-500 bg-emerald-500 text-white scale-110 shadow-sm' : 'border-slate-200 bg-white group-hover:border-slate-400'}`}>
                {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
            </div>
        </button>
    );

    const selectedForm = forms.find(f => f.id === config.targetId);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-32">
            {locked && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-[14px] flex items-center gap-4 shadow-sm animate-in zoom-in-95 mb-4">
                    <div className="p-2.5 bg-white rounded-[var(--radius-md)] text-amber-600 shadow-sm"><Lock className="w-4.5 h-4.5" /></div>
                    <div>
                        <p className="text-[11px] font-bold text-amber-800 uppercase tracking-tight">Trigger đã bị khóa</p>
                        <p className="text-[10px] font-medium text-amber-700 leading-tight">Quy trình đã có khách tham gia, không thể thay đổi điểm bắt đầu.</p>
                    </div>
                </div>
            )}

            {/* 1. TINH TÚY: EVENT SELECTOR (GRID 2 CỘT) */}
            <div className="space-y-4">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Chọn sự kiện khởi đầu</label>
                <div className="grid grid-cols-2 gap-3">
                    {triggerOptions.map((opt) => {
                        const isSelected = triggerType === opt.id;
                        return (
                            <button
                                key={opt.id}
                                disabled={disabled || locked}
                                onClick={() => handleTypeChange(opt.id)}
                                className={`flex items-center gap-4 p-4 rounded-[14px] border-2 transition-all duration-500 relative group overflow-hidden
                        ${getOptionClasses(opt.color, isSelected)} 
                        ${isSelected ? 'shadow-md ring-4 ring-offset-0 ring-opacity-10' : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm'}
                        ${disabled || locked ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                            >
                                <div className={`w-11 h-11 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 transition-all duration-500 ${getIconClasses(opt.color, isSelected)} ${isSelected ? 'shadow-lg scale-110' : 'group-hover:bg-white group-hover:shadow-sm'}`}>
                                    <opt.icon className={`transition-transform duration-500 ${isSelected ? 'w-5 h-5' : 'w-5 h-5 group-hover:scale-110'}`} />
                                </div>
                                <div className="text-left overflow-hidden relative z-10">
                                    <p className={`text-xs font-black leading-tight mb-1 tracking-tight ${isSelected ? 'text-slate-950' : 'text-slate-700'}`}>{opt.label}</p>
                                    <p className={`text-[10px] font-bold uppercase tracking-widest truncate ${isSelected ? 'opacity-80' : 'text-slate-400'}`}>{opt.desc}</p>
                                </div>
                                {isSelected && (
                                    <div className="absolute top-2 right-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 2. ĐỒNG BỘ: DETAILED CONFIGURATION */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
                        <Target className="w-3 h-3" /> Chi tiết nguồn dữ liệu
                    </h4>
                    {triggerType === 'form' && config.targetId && (
                        <button onClick={() => setShowGuide(true)} className="text-[9px] font-bold text-blue-600 hover:underline">Hướng dẫn tích hợp API</button>
                    )}
                </div>

                {loading ? (
                    <div className="py-20 text-center animate-pulse"><Loader2 className="w-6 h-6 animate-spin text-slate-200 mx-auto" /></div>
                ) : (
                    <div className="space-y-3.5 animate-in slide-in-from-bottom-2 duration-300">

                        {/* SUB-TAB FOR SEGMENT/LIST/SYNC */}
                        {triggerType === 'segment' && (
                            <div className="flex bg-slate-100 p-0.5 rounded-lg w-full mb-1">
                                <button
                                    onClick={() => { setTargetSubtype('list'); handleTargetChange(''); }}
                                    className={`flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${targetSubtype === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <List className="w-3 h-3" /> Danh sách
                                </button>
                                <button
                                    onClick={() => { setTargetSubtype('sync' as any); handleTargetChange(''); }}
                                    className={`flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${targetSubtype === 'sync' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <div className="flex items-center space-x-1">
                                        <GoogleSheetsIcon className="w-3 h-3" />
                                        <span className="text-[9px]">/</span>
                                        <MisaIcon className="w-3 h-3" />
                                    </div>
                                    <span className="ml-1">Đồng bộ</span>
                                </button>
                                <button
                                    onClick={() => { setTargetSubtype('segment'); handleTargetChange(''); }}
                                    className={`flex-1 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${targetSubtype === 'segment' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-400 hover:text-slate-600'}`}
                                >
                                    <Layers className="w-3 h-3" /> Phân khúc
                                </button>
                            </div>
                        )}

                        {/* SEARCH BAR */}
                        {triggerType !== 'date' && (
                            <div className="relative group">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-focus-within:text-slate-500 transition-colors" />
                                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Tìm kiếm nhanh..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-slate-400 transition-all" />
                            </div>
                        )}

                        <div className={`space-y-2 pr-1 custom-scrollbar p-0.5 ${triggerType === 'date' ? '' : 'max-h-72 overflow-y-auto'}`}>
                            {/* CASE: SEGMENT / LIST / SYNC */}
                            {triggerType === 'segment' && targetSubtype === 'list' && lists
                                .filter(i => isManualList(i) && i.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(item => (
                                    <ConfigItem
                                        key={item.id}
                                        label={item.name}
                                        desc={`${item.count || 0} liên hệ`}
                                        icon={List}
                                        isSelected={config.targetId === item.id}
                                        onClick={() => handleTargetChange(item.id)}
                                    />
                                ))
                            }

                            {triggerType === 'segment' && targetSubtype === 'sync' && lists
                                .filter(i => isSyncList(i) && i.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(item => (
                                    <ConfigItem
                                        key={item.id}
                                        label={item.name}
                                        desc={`${item.count || 0} liên hệ - ${item.source}`}
                                        icon={item.source === 'MISA CRM' ? MisaIcon : GoogleSheetsIcon}
                                        isSelected={config.targetId === item.id}
                                        onClick={() => handleTargetChange(item.id)}
                                    />
                                ))
                            }

                            {triggerType === 'segment' && targetSubtype === 'segment' && segments
                                .filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(item => (
                                    <ConfigItem
                                        key={item.id}
                                        label={item.name}
                                        desc={`${item.count || 0} liên hệ`}
                                        icon={Layers}
                                        isSelected={config.targetId === item.id}
                                        onClick={() => handleTargetChange(item.id)}
                                    />
                                ))
                            }

                            {triggerType === 'segment' && config.targetId && (
                                <div className="p-5 bg-white border border-slate-200 rounded-[14px] space-y-4 shadow-sm mt-4 animate-in slide-in-from-bottom-2">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-800">Cơ chế gửi & Enrollment</h4>
                                            <p className="text-[11px] text-slate-500 mt-1">Thiết lập đối tượng nhận khi kích hoạt luồng này.</p>
                                        </div>
                                        <div className="p-2 bg-emerald-50 rounded-lg text-emerald-500">
                                            <Users className="w-5 h-5" />
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-3 pt-2">
                                        <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${config.enrollStrategy !== 'new_only' ? 'border-emerald-500 bg-emerald-50 shadow-sm' : 'border-slate-100 hover:border-slate-200 bg-white'}`}>
                                            <input 
                                                type="radio" 
                                                name="enrollStrategy" 
                                                className="mt-1 accent-emerald-500" 
                                                checked={config.enrollStrategy !== 'new_only'}
                                                onChange={() => onChange({ ...config, enrollStrategy: 'all' }, getLabelForType(triggerType, config.targetId, targetSubtype, config.dateField))}
                                                disabled={disabled}
                                            />
                                            <div>
                                                <p className="text-xs font-bold text-slate-800">Gửi cho toàn bộ (Cũ & Mới)</p>
                                                <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">Hệ thống sẽ kéo <b>toàn bộ dữ liệu hiện có</b> trong danh sách này vào luồng ngay khi bấm Active, đồng thời áp dụng cho cả người mới về sau.</p>
                                            </div>
                                        </label>
                                        
                                        <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${config.enrollStrategy === 'new_only' ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-100 hover:border-slate-200 bg-white'}`}>
                                            <input 
                                                type="radio" 
                                                name="enrollStrategy" 
                                                className="mt-1 accent-blue-500" 
                                                checked={config.enrollStrategy === 'new_only'}
                                                onChange={() => onChange({ ...config, enrollStrategy: 'new_only' }, getLabelForType(triggerType, config.targetId, targetSubtype, config.dateField))}
                                                disabled={disabled}
                                            />
                                            <div>
                                                <p className="text-xs font-bold text-slate-800">Chỉ gửi cho người mới</p>
                                                <p className="text-[10px] text-slate-500 leading-relaxed mt-0.5">Bỏ qua dữ liệu cũ. Chỉ những ai <b>mới tham gia (Join)</b> vào danh sách kể từ lúc Flow được Active mới nhận được tin.</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* CASE: FORM SUBMIT */}
                            {triggerType === 'form' && forms
                                .filter(f => f.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(f => (
                                    <ConfigItem
                                        key={f.id}
                                        label={f.name}
                                        desc={`${f.stats?.submissions || 0} lượt đăng ký`}
                                        icon={FileInput}
                                        isSelected={config.targetId === f.id}
                                        onClick={() => handleTargetChange(f.id)}
                                    />
                                ))
                            }

                            {/* CASE: SURVEY SUBMIT */}
                            {triggerType === 'survey' && surveys
                                .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(s => (
                                    <ConfigItem
                                        key={s.id}
                                        label={s.name}
                                        desc={`${s.status === 'active' ? 'Đang kích hoạt' : 'Chưa xuất bản'}`}
                                        icon={ClipboardList}
                                        isSelected={config.targetId === s.id}
                                        onClick={() => handleTargetChange(s.id)}
                                    />
                                ))
                            }

                            {/* CASE: PURCHASE EVENT */}
                            {triggerType === 'purchase' && purchases
                                .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(p => (
                                    <ConfigItem
                                        key={p.id}
                                        label={p.name}
                                        desc={`Event ID: ${p.id.substring(0, 8)}...`}
                                        icon={ShoppingCart}
                                        isSelected={config.targetId === p.id}
                                        onClick={() => handleTargetChange(p.id)}
                                    />
                                ))
                            }

                            {/* CASE: ERP EVENT (MYERP CRM / ACADEMIC / TUITION / TICKET) */}
                            {triggerType === 'erp_event' && erpEventPresets
                                .filter(ev => ev.label.toLowerCase().includes(searchTerm.toLowerCase()) || ev.desc.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(ev => (
                                    <ConfigItem
                                        key={ev.id}
                                        label={ev.label}
                                        desc={ev.desc}
                                        icon={CheckCircle2}
                                        isSelected={config.targetId === ev.id}
                                        onClick={() => handleTargetChange(ev.id)}
                                    />
                                ))
                            }

                            {/* CASE: CUSTOM EVENT */}
                            {triggerType === 'custom_event' && customEvents
                                .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(c => (
                                    <ConfigItem
                                        key={c.id}
                                        label={c.name}
                                        desc={`ID: ${c.id.substring(0, 8)}...`}
                                        icon={Zap}
                                        isSelected={config.targetId === c.id}
                                        onClick={() => handleTargetChange(c.id)}
                                    />
                                ))
                            }

                            {/* CASE: VOUCHER */}
                            {triggerType === 'voucher' && voucherCampaigns
                                .filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(v => (
                                    <ConfigItem
                                        key={v.id}
                                        label={v.name}
                                        desc={`Còn lại: ${v.codeType === 'static' ? 'Không giới hạn' : (v.rewards?.[0]?.quantity || 0) + ' mã'}`}
                                        icon={Ticket}
                                        isSelected={config.targetId === v.id}
                                        onClick={() => handleTargetChange(v.id)}
                                    />
                                ))
                            }

                            {/* CASE: VOUCHER REDEEM */}
                            {triggerType === 'voucher_redeem' && voucherCampaigns
                                .filter(v => v.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(v => (
                                    <ConfigItem
                                        key={v.id}
                                        label={v.name}
                                        desc={`Chạy khi Khách dùng mã / được Store Gạch mã`}
                                        icon={PartyPopper}
                                        isSelected={config.targetId === v.id}
                                        onClick={() => handleTargetChange(v.id)}
                                    />
                                ))
                            }

                            {/* CASE: TAG ADDED */}
                            {triggerType === 'tag' && tags
                                .filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(t => (
                                    <ConfigItem
                                        key={t.id}
                                        label={t.name}
                                        desc={`Kích hoạt khi gắn nhãn này`}
                                        icon={Tag}
                                        isSelected={config.targetId === t.name}
                                        onClick={() => handleTargetChange(t.name)}
                                    />
                                ))
                            }

                            {/* CASE: CAMPAIGN */}
                            {triggerType === 'campaign' && campaigns
                                .filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
                                .map(c => (
                                    <ConfigItem
                                        key={c.id}
                                        label={c.name}
                                        desc={`Trạng thái: ${c.status}`}
                                        icon={Send}
                                        isSelected={config.targetId === c.id}
                                        onClick={() => handleTargetChange(c.id)}
                                    />
                                ))
                            }

                            {/* CASE: INBOUND MESSAGE KEYWORD */}
                            {triggerType === 'inbound_message' && (
                                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300 p-1">
                                    <div className="p-5 bg-white border border-slate-200 rounded-[14px] space-y-4 shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-blue-50 rounded-lg text-blue-500"><MessageSquare className="w-4 h-4" /></div>
                                            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Từ khóa kích hoạt (Tùy chọn)</span>
                                        </div>
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                placeholder="Ví dụ: GIÁ, TƯ VẤN, BÁO GIÁ"
                                                className="w-full h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 focus:border-slate-400 focus:bg-white outline-none transition-all"
                                                value={config.targetId || ''}
                                                onChange={(e) => handleTargetChange(e.target.value)}
                                            />
                                            <p className="text-[10px] text-slate-400 font-medium">Nhập từ khóa khách đã gửi. Để trống nếu muốn kích hoạt cho MỌI tin nhắn.</p>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-blue-50/30 rounded-[14px] border border-blue-100 flex items-start gap-3">
                                        <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                        <p className="text-[11px] text-blue-600 font-medium leading-relaxed">
                                            Hệ thống sẽ kiểm tra tin nhắn của khách trên Meta (Messenger) và Zalo OA.
                                            Nếu khớp với từ khóa (không phân biệt hoa thường), Flow sẽ được kích hoạt ngay lập tức.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* CASE: ZALO FOLLOW */}
                            {triggerType === 'zalo_follow' && (
                                <div className="p-8 text-center space-y-4 animate-in zoom-in-95 duration-300">
                                    <div className="w-20 h-20 bg-cyan-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-cyan-100/50">
                                        <UserPlus className="w-10 h-10 text-cyan-500" />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-800">Kích hoạt khi Quan tâm Zalo OA</h3>
                                    <p className="text-[11px] text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                                        Tự động gửi tin nhắn chào mừng hoặc bắt đầu quy trình chăm sóc ngay khi Khách hàng nhấn <b>"Quan tâm"</b> Zalo OA của bạn.
                                    </p>
                                    <div className="p-3 bg-slate-50 rounded-xl inline-block border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Không cần cấu hình thêm</span>
                                    </div>
                                </div>
                            )}

                            {/* CASE: BUNSUBSCRIBE */}
                            {triggerType === 'unsubscribe' && (
                                <div className="p-8 text-center space-y-4 animate-in zoom-in-95 duration-300">
                                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-red-100/50">
                                        <UserMinus className="w-10 h-10 text-red-500" />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-800">Kích hoạt khi Hủy đăng ký</h3>
                                    <p className="text-[11px] text-slate-500 max-w-[240px] mx-auto leading-relaxed">
                                        Sử dụng để gắn nhãn "Ngừng quan tâm" hoặc ghi nhận phản hồi vào CRM khi Khách hàng nhấn link Hủy đăng ký trong Email.
                                    </p>
                                    <div className="p-3 bg-red-50/50 rounded-xl inline-block border border-red-100">
                                        <span className="text-[10px] font-bold text-red-400 uppercase tracking-widest">Trigger Dọn dẹp & CRM</span>
                                    </div>
                                </div>
                            )}

                            {/* CASE: AI CAPTURE */}
                            {triggerType === 'ai_capture' && (
                                <div className="space-y-4 animate-in slide-in-from-bottom-2 duration-300 p-1">
                                    <div className="p-8 text-center space-y-4 bg-white border border-slate-200 rounded-[14px] shadow-sm">
                                        <div className="w-16 h-16 bg-rose-50 rounded-[14px] flex items-center justify-center mx-auto mb-2 border-2 border-rose-100/50">
                                            <Bot className="w-8 h-8 text-rose-500" />
                                        </div>
                                        <h3 className="text-sm font-bold text-slate-800">Kích hoạt khi AI lấy được Lead</h3>
                                        <p className="text-[11px] text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                                            Luồng này sẽ được kích hoạt ngay lập tức khi Chatbot AI nhận diện thành công Email/SĐT của khách hàng.
                                        </p>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 px-1">
                                            <div className="p-1.5 bg-rose-50 rounded-lg text-rose-500"><Target className="w-3.5 h-3.5" /></div>
                                            <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Chọn Nguồn Bot</span>
                                        </div>
                                        <div className="space-y-2">
                                            <ConfigItem
                                                label="Mọi AI Bot hiện có"
                                                desc="Nhận lead từ bất kỳ bot nào trong hệ thống"
                                                icon={Bot}
                                                isSelected={!config.targetId || config.targetId === 'all'}
                                                onClick={() => onChange({ ...config, targetId: 'all' }, 'Mọi AI Bot')}
                                            />
                                            {chatbots.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase())).map(b => (
                                                <ConfigItem
                                                    key={b.id}
                                                    label={b.name}
                                                    desc={`Danh mục: ${b.category_name || 'Mặc định'}`}
                                                    icon={MessageSquare}
                                                    isSelected={config.targetId === b.id}
                                                    onClick={() => onChange({ ...config, targetId: b.id }, `Bot: ${b.name}`)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* CASE: DATE / EVENTS */}
                            {triggerType === 'date' && (
                                <div className="space-y-3">
                                    {/* 1. Khách hàng NGỦ ĐÔNG */}
                                    <ConfigItem
                                        label="Khách hàng ngủ đông"
                                        desc="Khi khách không tương tác quá lâu"
                                        icon={Snowflake}
                                        isSelected={config.dateField === 'lastActivity'}
                                        onClick={() => {
                                            const newLabel = getLabelForType('date', '', undefined, 'lastActivity');
                                            onChange({ ...config, dateField: 'lastActivity', inactiveAmount: config.inactiveAmount || 30 }, newLabel);
                                        }}
                                    />

                                    {config.dateField === 'lastActivity' && (
                                        <div className="p-5 bg-white border border-slate-200 rounded-[14px] space-y-4 animate-in slide-in-from-top-2 shadow-sm mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><History className="w-4 h-4" /></div>
                                                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Thời gian không tương tác</span>
                                            </div>
                                            <div className="flex gap-4 items-center">
                                                <input
                                                    type="number"
                                                    className="w-24 h-10 px-3 bg-slate-50 border border-slate-200 rounded-lg font-bold text-base text-slate-800 focus:border-slate-400 focus:bg-white outline-none transition-all"
                                                    value={config.inactiveAmount || 30}
                                                    onChange={(e) => onChange({ ...config, inactiveAmount: parseInt(e.target.value) || 30 })}
                                                    disabled={disabled}
                                                />
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ngày liên tục</span>
                                            </div>
                                            <div className="p-3.5 bg-blue-50/50 rounded-xl flex items-start gap-2.5 border border-blue-100/50">
                                                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                                                <p className="text-[10px] text-blue-700 font-medium leading-relaxed italic">Hệ thống sẽ quét định kỳ những Khách hàng không Mở hoặc Click link trong {config.inactiveAmount || 30} ngày để đưa vào luồng.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* 2. SINH NHẬT */}
                                    <ConfigItem
                                        label="Chúc mừng Sinh nhật"
                                        desc="Chạy vào ngày sinh hoặc trước/sau"
                                        icon={Cake}
                                        isSelected={config.dateField === 'dateOfBirth'}
                                        onClick={() => {
                                            const newLabel = getLabelForType('date', '', undefined, 'dateOfBirth');
                                            onChange({ ...config, dateField: 'dateOfBirth', offsetType: config.offsetType || 'on', offsetValue: config.offsetValue || 0 }, newLabel);
                                        }}
                                    />

                                    {/* 3. KỶ NIỆM */}
                                    <ConfigItem
                                        label="Mừng ngày Kỷ niệm"
                                        desc="Theo ngày kỷ niệm riêng của khách"
                                        icon={Calendar}
                                        isSelected={config.dateField === 'anniversaryDate'}
                                        onClick={() => {
                                            const newLabel = getLabelForType('date', '', undefined, 'anniversaryDate');
                                            onChange({ ...config, dateField: 'anniversaryDate', offsetType: config.offsetType || 'on', offsetValue: config.offsetValue || 0 }, newLabel);
                                        }}
                                    />

                                    {/* 4. NGÀY GIA NHẬP */}
                                    <ConfigItem
                                        label="Kỷ niệm Ngày gia nhập"
                                        desc="Chạy hàng năm vào ngày khách đăng ký"
                                        icon={History}
                                        isSelected={config.dateField === 'joinedAt'}
                                        onClick={() => {
                                            const newLabel = getLabelForType('date', '', undefined, 'joinedAt');
                                            onChange({ ...config, dateField: 'joinedAt', offsetType: config.offsetType || 'on', offsetValue: config.offsetValue || 0 }, newLabel);
                                        }}
                                    />

                                    {/* 5. NGÀY CỤ THỂ */}
                                    <ConfigItem
                                        label="Ngày cụ thể (Lễ, Sự kiện)"
                                        desc="Chạy vào một ngày cố định duy nhất"
                                        icon={Clock}
                                        isSelected={config.dateField === 'specificDate'}
                                        onClick={() => {
                                            const newLabel = getLabelForType('date', '', undefined, 'specificDate');
                                            onChange({ ...config, dateField: 'specificDate', specificDate: config.specificDate || '' }, newLabel);
                                        }}
                                    />

                                    {config.dateField === 'specificDate' && (
                                        <div className="p-5 bg-white border border-slate-200 rounded-[14px] space-y-4 animate-in slide-in-from-top-2 shadow-sm mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 rounded-lg text-blue-500"><Calendar className="w-4 h-4" /></div>
                                                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Chọn ngày diễn ra sự kiện</span>
                                            </div>
                                            <div className="flex gap-4 items-center">
                                                <input
                                                    type="date"
                                                    className="flex-1 h-11 px-4 bg-slate-50 border border-slate-200 rounded-xl font-bold text-sm text-slate-800 focus:border-slate-400 focus:bg-white outline-none transition-all"
                                                    value={config.specificDate || ''}
                                                    onChange={(e) => {
                                                        const newCfg = { ...config, specificDate: e.target.value };
                                                        onChange(newCfg, getLabelForType('date', '', undefined, 'specificDate'));
                                                    }}
                                                    disabled={disabled}
                                                />
                                            </div>
                                            <div className="p-3.5 bg-blue-50/50 rounded-xl flex items-start gap-2.5 border border-blue-100/50">
                                                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                                                <p className="text-[10px] text-blue-700 font-medium leading-relaxed italic">Ví dụ: Thiết lập ngày 14/02 để bắt đầu chương trình Valentine cho toàn bộ khách hàng được chọn.</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* 6. THEO CUSTOM FIELD NGÀY */}
                                    <ConfigItem
                                        label="Theo Custom Field Ngày"
                                        desc="Trước/sau ngày lưu trong trường tùy chọn"
                                        icon={ArrowRight}
                                        isSelected={config.dateField === 'custom_field_date'}
                                        onClick={() => onChange(
                                            { ...config, dateField: 'custom_field_date', customFieldKey: config.customFieldKey || '', offsetType: config.offsetType || 'before', offsetValue: config.offsetValue ?? 1, triggerHour: config.triggerHour ?? 8 },
                                            getLabelForType('date', '', undefined, 'custom_field_date')
                                        )}
                                    />

                                    {config.dateField === 'custom_field_date' && (
                                        <div className="p-5 bg-white border border-blue-200 rounded-[14px] space-y-4 animate-in slide-in-from-top-2 shadow-sm mb-4">
                                            {/* Field Key */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-blue-50 rounded-lg text-blue-500"><Calendar className="w-3.5 h-3.5" /></div>
                                                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Trường ngày (Custom Field Key)</span>
                                                </div>
                                                {customFieldDefs.length > 0 ? (
                                                    <select
                                                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:border-blue-400 outline-none transition-all"
                                                        value={config.customFieldKey || ''}
                                                        onChange={e => onChange({ ...config, customFieldKey: e.target.value }, getLabelForType('date', '', undefined, 'custom_field_date'))}
                                                        disabled={disabled}
                                                    >
                                                        <option value="">-- Chọn trường ngày --</option>
                                                        {customFieldDefs.map(f => (
                                                            <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <input
                                                        type="text"
                                                        placeholder="Nhập key, ví dụ: ngày_dat_lich"
                                                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:border-blue-400 focus:bg-white outline-none transition-all"
                                                        value={config.customFieldKey || ''}
                                                        onChange={e => onChange({ ...config, customFieldKey: e.target.value }, getLabelForType('date', '', undefined, 'custom_field_date'))}
                                                        disabled={disabled}
                                                    />
                                                )}
                                                <p className="text-[9px] text-slate-400">Key của custom field chứa giá trị ngày (YYYY-MM-DD hoặc DD/MM/YYYY)</p>
                                            </div>

                                            {/* Offset Config */}
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-pink-50 rounded-lg text-pink-500"><Clock className="w-3.5 h-3.5" /></div>
                                                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Thời điểm kích hoạt</span>
                                                </div>
                                                <div className="grid grid-cols-4 gap-2">
                                                    <Select
                                                        label="Kiểu"
                                                        options={[
                                                            { value: 'before', label: 'Trước X ngày' },
                                                            { value: 'on', label: 'Đúng ngày' },
                                                            { value: 'after', label: 'Sau X ngày' },
                                                        ]}
                                                        value={config.offsetType || 'before'}
                                                        onChange={val => onChange({ ...config, offsetType: val }, getLabelForType('date', '', undefined, 'custom_field_date'))}
                                                    />
                                                    {config.offsetType !== 'on' && (
                                                        <Input
                                                            label="Số ngày (X)"
                                                            type="number"
                                                            value={config.offsetValue ?? 1}
                                                            onChange={e => onChange({ ...config, offsetValue: parseInt(e.target.value) || 0 }, getLabelForType('date', '', undefined, 'custom_field_date'))}
                                                        />
                                                    )}
                                                    <Input
                                                        label="Giờ (0-23)"
                                                        type="number"
                                                        value={config.triggerHour ?? 8}
                                                        onChange={e => onChange({ ...config, triggerHour: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) })}
                                                    />
                                                    <Input
                                                        label="Phút (0-59)"
                                                        type="number"
                                                        value={config.triggerMinute ?? 0}
                                                        onChange={e => onChange({ ...config, triggerMinute: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) })}
                                                    />
                                                </div>
                                                <p className="text-[9px] italic text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                    {(() => {
                                                        const hh = String(config.triggerHour ?? 8).padStart(2, '0');
                                                        const mm = String(config.triggerMinute ?? 0).padStart(2, '0');
                                                        const field = config.customFieldKey || 'field';
                                                        const x = config.offsetValue ?? 1;
                                                        if (config.offsetType === 'before') return `Kích hoạt ${x} ngày TRƯỚC [${field}] lúc ${hh}:${mm}`;
                                                        if (config.offsetType === 'after') return `Kích hoạt ${x} ngày SAU [${field}] lúc ${hh}:${mm}`;
                                                        return `Kích hoạt đúng ngày [${field}] lúc ${hh}:${mm}`;
                                                    })()}
                                                </p>
                                            </div>

                                            <div className="p-3 bg-blue-50/50 rounded-[var(--radius-md)] flex items-start gap-2.5 border border-blue-100">
                                                <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                                                <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                                                    Cron job hàng ngày quét subscriber có field <b>{config.customFieldKey || 'ngày'}</b> khớp điều kiện và tự động enroll vào flow.
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {(config.dateField === 'dateOfBirth' || config.dateField === 'anniversaryDate' || config.dateField === 'joinedAt' || config.dateField === 'specificDate') && (
                                        <div className="p-5 bg-white border border-slate-200 rounded-[14px] space-y-4 animate-in slide-in-from-top-2 shadow-sm mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-pink-50 rounded-[var(--radius-md)] text-pink-500"><Clock className="w-4 h-4" /></div>
                                                <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Thời điểm kích hoạt</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <Select
                                                    label="Kiểu khớp"
                                                    options={[
                                                        { value: 'on', label: 'Đúng ngày' },
                                                        { value: 'before', label: 'Trước X ngày' },
                                                        { value: 'after', label: 'Sau X ngày' }
                                                    ]}
                                                    value={config.offsetType || 'on'}
                                                    onChange={(val) => {
                                                        const newCfg = { ...config, offsetType: val };
                                                        onChange(newCfg, getLabelForType('date', '', undefined, config.dateField));
                                                    }}
                                                />
                                                {config.offsetType !== 'on' && (
                                                    <Input
                                                        label="Số ngày (X)"
                                                        type="number"
                                                        value={config.offsetValue || 1}
                                                        onChange={(e) => {
                                                            const newCfg = { ...config, offsetValue: parseInt(e.target.value) || 0 };
                                                            onChange(newCfg, getLabelForType('date', '', undefined, config.dateField));
                                                        }}
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {(config.dateField === 'dateOfBirth' || config.dateField === 'anniversaryDate' || config.dateField === 'joinedAt' || config.dateField === 'specificDate' || config.dateField === 'lastActivity' || config.dateField === 'custom_field_date') && (
                                        <div className="p-5 bg-white border border-slate-200 rounded-[14px] space-y-4 animate-in slide-in-from-top-2 shadow-sm">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-rose-50 rounded-[var(--radius-md)] text-rose-500"><Target className="w-4 h-4" /></div>
                                                    <span className="text-[9px] font-bold uppercase text-slate-400 tracking-wider">Đối tượng áp dụng</span>
                                                </div>
                                            </div>

                                            <div className="flex bg-slate-100 p-0.5 rounded-[var(--radius-md)] w-full">
                                                <button
                                                    onClick={() => onChange({ ...config, targetLists: 'all', targetListIds: [], targetSegmentIds: [] })}
                                                    className={`flex-1 py-1.5 rounded-[var(--radius-md)] text-[10px] font-bold uppercase transition-all ${!config.targetLists || config.targetLists === 'all' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    Tất cả
                                                </button>
                                                <button
                                                    onClick={() => onChange({ ...config, targetLists: 'specific', targetListIds: [] })}
                                                    className={`flex-1 py-1.5 rounded-[var(--radius-md)] text-[10px] font-bold uppercase transition-all ${config.targetLists === 'specific' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                                                >
                                                    Danh sách cụ thể
                                                </button>
                                            </div>

                                            {config.targetLists === 'specific' && (
                                                <div className="mt-4 space-y-4">
                                                    <div className="p-3 bg-amber-50 rounded-[var(--radius-md)] flex items-start gap-2.5 border border-amber-200/50">
                                                        <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                                        <p className="text-[10px] text-amber-700 font-bold leading-relaxed">
                                                            Chỉ kích hoạt đối với những người có trong danh sách/phân khúc được chọn dưới đây.
                                                            <span className="block font-medium text-slate-500 mt-0.5 italic">Nếu họ không thuộc danh sách này, flow sẽ không tự động bắt đầu.</span>
                                                        </p>
                                                    </div>
                                                    <div className="flex bg-slate-100/50 p-0.5 rounded-[var(--radius-md)] w-full mb-2">
                                                        <button
                                                            onClick={() => setBirthdayTab('list')}
                                                            className={`flex-1 py-1 rounded-[var(--radius-md)] text-[9px] font-bold uppercase transition-all ${birthdayTab === 'list' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            Danh sách
                                                        </button>
                                                        <button
                                                            onClick={() => setBirthdayTab('sync')}
                                                            className={`flex-1 py-1 rounded-[var(--radius-md)] text-[9px] font-bold uppercase transition-all ${birthdayTab === 'sync' ? 'bg-white shadow-sm text-green-600' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            Nguồn Sync
                                                        </button>
                                                        <button
                                                            onClick={() => setBirthdayTab('segment')}
                                                            className={`flex-1 py-1 rounded-[var(--radius-md)] text-[9px] font-bold uppercase transition-all ${birthdayTab === 'segment' ? 'bg-white shadow-sm text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            Phân khúc
                                                        </button>
                                                    </div>
                                                    <div className="relative group mb-2">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-300 group-focus-within:text-slate-500 transition-colors" />
                                                        <input
                                                            value={searchTerm}
                                                            onChange={e => setSearchTerm(e.target.value)}
                                                            placeholder="Tìm danh sách..."
                                                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-[var(--radius-md)] text-[11px] font-semibold outline-none focus:border-slate-400 transition-all"
                                                        />
                                                    </div>

                                                    <div className="space-y-1 custom-scrollbar border border-slate-100 rounded-[14px] p-1 bg-slate-50/50 max-h-48 overflow-y-auto">
                                                        {(birthdayTab === 'list' ? lists.filter(l => isManualList(l) && l.name.toLowerCase().includes(searchTerm.toLowerCase())) :
                                                            birthdayTab === 'sync' ? lists.filter(l => isSyncList(l) && l.name.toLowerCase().includes(searchTerm.toLowerCase())) :
                                                                segments.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))).map(item => {
                                                                    const isChecked = birthdayTab === 'segment'
                                                                        ? (config.targetSegmentIds || []).includes(item.id)
                                                                        : (config.targetListIds || []).includes(item.id);
                                                                    return (
                                                                        <div key={item.id}
                                                                            onClick={() => {
                                                                                if (birthdayTab === 'segment') {
                                                                                    const currentSegIds = config.targetSegmentIds || [];
                                                                                    const newSegIds = isChecked
                                                                                        ? currentSegIds.filter((id: string) => id !== item.id)
                                                                                        : [...currentSegIds, item.id];
                                                                                    onChange({ ...config, targetSegmentIds: newSegIds });
                                                                                } else {
                                                                                    const currentListIds = config.targetListIds || [];
                                                                                    const newListIds = isChecked
                                                                                        ? currentListIds.filter((id: string) => id !== item.id)
                                                                                        : [...currentListIds, item.id];
                                                                                    onChange({ ...config, targetListIds: newListIds });
                                                                                }
                                                                            }}
                                                                            className={`flex items-center justify-between p-2 rounded-[var(--radius-md)] cursor-pointer transition-colors ${isChecked ? 'bg-white shadow-sm ring-1 ring-emerald-500/20' : 'hover:bg-white/50'}`}
                                                                        >
                                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                                <div className="w-5 h-5 flex items-center justify-center rounded">
                                                                                    {birthdayTab === 'sync' ? (
                                                                                        item.source === 'MISA CRM' ? <MisaIcon className="w-3 h-3" /> : <GoogleSheetsIcon className="w-3 h-3" />
                                                                                    ) : birthdayTab === 'segment' ? (
                                                                                        <Layers className="w-3 h-3 text-[var(--color-primary)]" />
                                                                                    ) : (
                                                                                        <List className="w-3 h-3 text-blue-500" />
                                                                                    )}
                                                                                </div>
                                                                                <div className="overflow-hidden">
                                                                                    <p className={`text-xs font-semibold truncate ${isChecked ? 'text-slate-800' : 'text-slate-600'}`}>{item.name}</p>
                                                                                    <p className="text-[9px] text-slate-400 font-medium">
                                                                                        {item.count || 0} liên hệ
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 bg-white'}`}>
                                                                                {isChecked && <Check className="w-3 h-3" />}
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })}
                                                    </div>

                                                    {/* Total Estimate Footer */}
                                                    <div className="mt-3 px-1 flex items-center justify-between border-t border-slate-100 pt-2">
                                                        <span className="text-[10px] font-semibold text-slate-500">Ước tính (Unique):</span>
                                                        <div className="flex items-center gap-1.5">
                                                            <Users className="w-3 h-3 text-emerald-600" />
                                                            <span className="text-[10px] font-bold text-slate-700">
                                                                {isCalculating ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin inline-block" />
                                                                ) : (
                                                                    `~${estimatedCount !== null ? estimatedCount : 0} liên hệ`
                                                                )}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <IntegrationGuideModal
                isOpen={showGuide}
                onClose={() => setShowGuide(false)}
                formId={config.targetId}
                formName={selectedForm?.name || 'Form'}
                fields={selectedForm?.fields || []}
            />
        </div>
    );
};

export default TriggerConfig;
