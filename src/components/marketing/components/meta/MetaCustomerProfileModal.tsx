import * as React from 'react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    X, User, History, Edit2, Check,
    Copy, Calendar, Clock, ArrowRight, ExternalLink,
    Send, MailOpen, MessageCircle, MessageSquare, Info, Trash2, ChevronDown,
    Activity, FileText, Mail, Phone, Globe, Briefcase, Building, MapPin, PenLine, Star, Plus, ArrowLeft
} from 'lucide-react';
import { api } from '../../services/storageAdapter';
import { getMktPortalRoot } from '../../utils/portalRoot';

interface MetaCustomerProfileModalProps {
    subscriberId: string;
    onClose: () => void;
    onUpdate?: () => void;
}

type TabType = 'personal' | 'interaction' | 'journey' | 'notes';

export const MetaCustomerProfileModal: React.FC<MetaCustomerProfileModalProps> = ({
    subscriberId,
    onClose,
    onUpdate
}) => {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<TabType>('personal');
    const [updating, setUpdating] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);
    useEffect(() => { const t = setTimeout(() => setAnimateIn(true), 20); return () => clearTimeout(t); }, []);
    const handleClose = () => { setAnimateIn(false); setTimeout(onClose, 350); };

    // Form fields
    const [formData, setFormData] = useState({
        displayName: '',
        gender: 'Chưa chọn',
        phone: '',
        birthday: '',
        email: '',
        notes: ''
    });

    useEffect(() => {
        fetchUserDetails();
    }, [subscriberId]);

    const fetchUserDetails = async () => {
        setLoading(true);
        const res = await api.get<any>(`meta_customers?route=user_details&id=${subscriberId}`);
        if (res.success) {
            const userData = res.data;
            setUser(userData);

            // Handle notes: separate manual text from JSON structure
            let manualNote = '';
            try {
                const notesData = JSON.parse(userData.notes);
                if (Array.isArray(notesData)) {
                    // Extract manual_note type if it exists
                    const manualObj = notesData.find((n: any) => n.type === 'manual_note');
                    manualNote = manualObj ? manualObj.content : '';
                } else {
                    manualNote = userData.notes;
                }
            } catch (e) {
                manualNote = userData.notes || '';
            }

            setFormData({
                displayName: userData.name && !userData.name.includes('Visitor') ? userData.name : `Khách hàng #${(userData.psid || '').slice(-4)}`,
                gender: userData.gender || 'Chưa chọn',
                phone: userData.phone || '',
                birthday: userData.birthday ? formatDateForInput(userData.birthday) : '',
                email: userData.email || '',
                notes: manualNote
            });
        }
        setLoading(false);
    };

    const formatDateForInput = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split('T')[0];
            }
        } catch (e) { }
        return dateStr;
    };

    const handleSave = async () => {
        setUpdating(true);

        // Prepare notes for saving: merge manual note back into JSON structure if needed
        let finalNotes = formData.notes;
        try {
            const oldNotes = JSON.parse(user.notes);
            if (Array.isArray(oldNotes)) {
                const otherNotes = oldNotes.filter((n: any) => n.type !== 'manual_note');
                finalNotes = JSON.stringify([
                    ...otherNotes,
                    { type: 'manual_note', content: formData.notes, created_at: new Date().toISOString() }
                ]);
            }
        } catch (e) {
            // Keep as plain text if it wasn't valid JSON before
        }

        const res = await api.post('meta_customers?route=update_user', {
            id: subscriberId,
            display_name: formData.displayName,
            gender: formData.gender,
            phone: formData.phone,
            birthday: formData.birthday,
            email: formData.email,
            notes: finalNotes
        });
        if (res.success) {
            await fetchUserDetails();
            setEditMode(false);
            if (onUpdate) onUpdate();
        }
        setUpdating(false);
    };

    const getInitials = (name: string) => {
        if (!name) return '';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
                <div className="bg-white rounded-[24px] p-12 flex flex-col items-center gap-4 shadow-2xl">
                    <History className="w-8 h-8 animate-spin text-blue-500" />
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Đang tải hồ sơ...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    const initials = getInitials(formData.displayName);

    return createPortal(
        <div className="fixed inset-0 z-[35000] flex justify-end overflow-hidden">
            {/* Backdrop Blur Overlay with Floating Circular Arrow Close Button */}
            <div
                className={`fixed inset-0 bg-black/80 backdrop-blur-[2px] transition-opacity duration-500 z-[35000] cursor-pointer ${animateIn ? 'opacity-100' : 'opacity-0'}`}
                onClick={handleClose}
            />

            {/* Floating Circular Arrow Button (Centered over sidebar) */}
            <div 
                className={`meta-customer-profile-back-btn hidden lg:flex absolute top-1/2 -translate-y-1/2 z-[35010] transition-opacity duration-500 ${animateIn ? 'opacity-100' : 'opacity-0'}`}
                style={{ pointerEvents: 'none' }}
            >
                <button
                    onClick={handleClose}
                    className="w-12 h-12 rounded-full bg-slate-900/90 border border-slate-700/80 text-white flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 hover:bg-blue-600 hover:border-blue-500 cursor-pointer"
                    style={{ pointerEvents: 'auto' }}
                    title="Quay lại (Esc)"
                >
                    <ArrowLeft className="w-6 h-6 stroke-[2.5]" />
                </button>
            </div>

            {/* Slide-over Right Drawer Panel - Anchored to sidebar */}
            <div className="meta-customer-profile-container fixed inset-y-0 right-0 z-[35020] max-w-full flex pl-0 pointer-events-none">
                <div className={`meta-customer-profile-panel w-screen max-w-none bg-white dark:bg-slate-950 shadow-2xl flex flex-col transform transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) overflow-hidden pointer-events-auto ${animateIn ? 'translate-x-0 opacity-100' : 'translate-x-full lg:translate-x-[100px] opacity-0'}`}>
                    <style>{`
                      @media (min-width: 1024px) {
                        .meta-customer-profile-container {
                          padding-left: var(--sidebar-width, 220px) !important;
                        }
                        .meta-customer-profile-panel {
                          width: calc(100vw - var(--sidebar-width, 220px)) !important;
                        }
                        .meta-customer-profile-back-btn {
                          left: calc(var(--sidebar-width, 220px) / 2) !important;
                          transform: translate(-50%, -50%) !important;
                        }
                      }
                    `}</style>
                    {/* Header */}
                    <div className="px-6 py-4 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 tracking-tight">Hồ sơ chi tiết Meta Messenger</h3>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all duration-200"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body Content */}
                <div className="px-6 py-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
                    <div className="flex flex-col">

                        {/* Profile Hero */}
                        <div className="flex items-center gap-5 mb-8 px-1 shrink-0">
                            <div className="w-16 h-16 rounded-[24px] bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-xl font-bold text-white shadow-xl shadow-blue-500/20 shrink-0">
                                {user.profile_pic ? (
                                    <img src={user.profile_pic} alt="" className="w-full h-full object-cover rounded-[24px]" />
                                ) : initials}
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3">
                                    <h2 className="text-2xl font-black text-slate-800 truncate tracking-tight">{formData.displayName}</h2>
                                    <span className="px-2.5 py-1 inline-flex items-center gap-1.5 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm text-[9px] transition-all duration-300 uppercase tracking-wide font-bold">
                                        Hoạt động
                                    </span>
                                    <div className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 flex items-center gap-1.5 shadow-sm ml-auto">
                                        <Star className="w-4 h-4 fill-current" />
                                        <span className="text-sm font-black">{(user.lead_score || 0).toLocaleString()}</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 mt-1.5 text-slate-500 font-bold text-xs tracking-tight">
                                    <span className="flex items-center gap-1.5 text-blue-600 lowercase">
                                        <Globe className="w-3.5 h-3.5" />
                                        PSID: {String(user.psid || '').substring(0, 15)}...
                                    </span>
                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                    <span className="text-slate-400">Tham gia: {formatTimeAgoShort(user.created_at)}</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setEditMode(!editMode)}
                                className={`px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-black border border-slate-200 transition-all duration-500 flex items-center gap-2 hover:shadow-sm ${editMode ? 'border-blue-500 text-blue-600' : ''}`}
                            >
                                <PenLine className="w-3.5 h-3.5" />
                                {editMode ? 'Đang sửa...' : 'Sửa hồ sơ'}
                            </button>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="shrink-0 mb-4">
                            <div className="flex border-b border-slate-200 mb-6 relative px-1 overflow-x-auto no-scrollbar whitespace-nowrap">
                                <ProfileTab
                                    active={activeTab === 'personal'}
                                    onClick={() => setActiveTab('personal')}
                                    label="Cá nhân"
                                    icon={User}
                                />
                                <ProfileTab
                                    active={activeTab === 'interaction'}
                                    onClick={() => setActiveTab('interaction')}
                                    label="Tương tác"
                                    icon={Activity}
                                    count={user.messages?.length || 0}
                                />
                                <ProfileTab
                                    active={activeTab === 'journey'}
                                    onClick={() => setActiveTab('journey')}
                                    label="Hành trình"
                                    icon={History}
                                />
                                <ProfileTab
                                    active={activeTab === 'notes'}
                                    onClick={() => setActiveTab('notes')}
                                    label="Ghi chú"
                                    icon={FileText}
                                    count={formData.notes ? 1 : 0}
                                />
                            </div>
                        </div>

                        {/* Tab Contents */}
                        <div className="mt-2">
                            {activeTab === 'personal' && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-300 pb-10">
                                    <div className="space-y-10">
                                        <section className="space-y-4">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                                                <div className="w-4 h-px bg-slate-200"></div> Thông tin định danh
                                            </h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-white p-6 rounded-[28px] border border-slate-100 shadow-sm">
                                                <div className="col-span-1 md:col-span-2">
                                                    <InputField
                                                        label="Họ và tên"
                                                        required
                                                        value={formData.displayName}
                                                        onChange={v => setFormData({ ...formData, displayName: v })}
                                                        disabled={!editMode}
                                                    />
                                                </div>

                                                <div className="space-y-1.5">
                                                    <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 text-slate-400">Giới tính</label>
                                                    <div className="relative">
                                                        <select
                                                            value={formData.gender}
                                                            onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                                            disabled={!editMode}
                                                            className={`w-full h-[42px] border border-slate-200 rounded-xl px-4 pr-10 text-sm font-bold focus:border-blue-500 outline-none transition-all text-slate-700 appearance-none ${!editMode ? 'bg-slate-50 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
                                                        >
                                                            <option value="Chọn...">Chọn...</option>
                                                            <option value="male">Nam (Male)</option>
                                                            <option value="female">Nữ (Female)</option>
                                                            <option value="other">Khác</option>
                                                        </select>
                                                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                                    </div>
                                                </div>

                                                <InputField
                                                    label="Điện thoại"
                                                    icon={Phone}
                                                    value={formData.phone}
                                                    onChange={v => setFormData({ ...formData, phone: v })}
                                                    disabled={!editMode}
                                                />

                                                <div className="space-y-1.5">
                                                    <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 text-slate-400">Ngày sinh</label>
                                                    <input
                                                        type="date"
                                                        value={formData.birthday}
                                                        onChange={e => setFormData({ ...formData, birthday: e.target.value })}
                                                        disabled={!editMode}
                                                        className="w-full h-[42px] bg-white border border-slate-200 rounded-xl px-4 text-sm font-bold focus:border-blue-500 outline-none disabled:bg-slate-50 transition-all text-slate-700"
                                                    />
                                                </div>

                                                <InputField
                                                    label="Email"
                                                    icon={Mail}
                                                    value={formData.email}
                                                    onChange={v => setFormData({ ...formData, email: v })}
                                                    disabled={!editMode}
                                                    placeholder="example@gmail.com"
                                                />
                                            </div>
                                        </section>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'interaction' && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-300 pb-10">
                                    <div className="flex items-center justify-between mb-6 px-1">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <div className="w-4 h-px bg-slate-200"></div> Lịch sử trò chuyện
                                        </h4>
                                    </div>
                                    <div className="space-y-4">
                                        {user.messages && user.messages.length > 0 ? user.messages.map((msg: any) => (
                                            <div key={msg.id} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                                                <div className={`max-w-[85%] px-4 py-3 rounded-[14px] text-[12px] shadow-sm ${msg.direction === 'outbound' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-50 text-slate-700 border border-slate-100 rounded-tl-none'}`}>
                                                    <p className="font-medium tracking-tight whitespace-pre-wrap leading-relaxed">{msg.message_text}</p>
                                                    <div className={`mt-1.5 text-[8px] font-black uppercase tracking-widest opacity-60 ${msg.direction === 'outbound' ? 'text-blue-50' : 'text-slate-400'}`}>
                                                        {formatTimeShort(msg.created_at)}
                                                    </div>
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="py-20 text-center bg-slate-50/50 rounded-[28px] border border-dashed border-slate-200">
                                                <Activity className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Không có tương tác nào</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'journey' && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-300 pb-10">
                                    <div className="relative pl-12 space-y-12 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
                                        {user.journey && user.journey.length > 0 ?
                                            user.journey.map((act: any, idx: number) => (
                                                <div
                                                    key={idx}
                                                    className="relative animate-in slide-in-from-left-2"
                                                    style={{ animationDelay: `${idx * 50}ms` }}
                                                >
                                                    <div className="absolute -left-12 w-10 h-10 rounded-full border-4 border-white shadow-md flex items-center justify-center z-10">
                                                        <TimelineIcon type={act.event_type} />
                                                    </div>
                                                    <div className="bg-white p-5 rounded-[28px] border border-slate-100 shadow-sm group hover:border-blue-200 transition-all">
                                                        <div className="flex justify-between items-start mb-1">
                                                            <h5 className="text-sm font-black text-slate-800">{act.event_name}</h5>
                                                            <span className="text-[10px] font-bold text-slate-300 uppercase">{formatTimeAgoShort(act.created_at)}</span>
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-medium leading-relaxed">
                                                            {(() => {
                                                                if (!act.event_data) return 'Đã tương tác qua Messenger';
                                                                try {
                                                                    const text = typeof act.event_data === 'string' ? act.event_data : JSON.stringify(act.event_data);

                                                                    // [FIX] Handle mixed content: "Text message: [JSON]" or just "[JSON]"
                                                                    let jsonStartIndex = -1;
                                                                    const firstBracket = text.indexOf('[');
                                                                    const firstBrace = text.indexOf('{');

                                                                    if (firstBracket !== -1 && firstBrace !== -1) jsonStartIndex = Math.min(firstBracket, firstBrace);
                                                                    else if (firstBracket !== -1) jsonStartIndex = firstBracket;
                                                                    else if (firstBrace !== -1) jsonStartIndex = firstBrace;

                                                                    let parsed = typeof act.event_data === 'string' ? JSON.parse(act.event_data) : act.event_data;
                                                                    let prefix = '';

                                                                    if (jsonStartIndex !== -1) {
                                                                        try {
                                                                            prefix = text.substring(0, jsonStartIndex).trim();
                                                                            let jsonToParse = text.substring(jsonStartIndex).trim();

                                                                            // [NEW] Robust repair for truncated JSON
                                                                            if (!jsonToParse.endsWith(']') && !jsonToParse.endsWith('}')) {
                                                                                // 1. Close unclosed quotes
                                                                                const quoteCount = (jsonToParse.match(/"/g) || []).length;
                                                                                if (quoteCount % 2 !== 0) jsonToParse += '"';

                                                                                // 2. Add closing brackets
                                                                                const openB = (jsonToParse.match(/\[/g) || []).length;
                                                                                const closeB = (jsonToParse.match(/\]/g) || []).length;
                                                                                const openC = (jsonToParse.match(/\{/g) || []).length;
                                                                                const closeC = (jsonToParse.match(/\}/g) || []).length;

                                                                                for (let i = 0; i < (openC - closeC); i++) jsonToParse += '}';
                                                                                for (let i = 0; i < (openB - closeB); i++) jsonToParse += ']';
                                                                            }
                                                                            parsed = JSON.parse(jsonToParse);
                                                                        } catch (e) {
                                                                            // If mixed content parsing fails, fallback to original parsing attempt or just raw
                                                                        }
                                                                    }

                                                                    // Helper to safely get template payload
                                                                    const getPayload = (obj: any) => {
                                                                        if (obj?.payload) return obj.payload;
                                                                        if (obj?.attachment?.payload) return obj.attachment.payload;
                                                                        if (obj?.message?.attachment?.payload) return obj.message.attachment.payload;
                                                                        return null;
                                                                    };

                                                                    const payload = getPayload(parsed);

                                                                    // 1. Array (Carousel or List)
                                                                    if (Array.isArray(parsed)) {
                                                                        return (
                                                                            <div className="space-y-2 mt-1">
                                                                                {prefix && <div className="text-sm text-slate-800 whitespace-pre-wrap mb-2">{prefix}</div>}
                                                                                {parsed.map((item: any, idx: number) => {
                                                                                    if (item.type === 'template' || item.title) {
                                                                                        return (
                                                                                            <div key={idx} className="bg-slate-50 p-2 rounded-xl border border-slate-100 flex gap-3">
                                                                                                {item.image_url && <img src={item.image_url} className="w-10 h-10 rounded-lg object-cover bg-white" />}
                                                                                                <div className="text-slate-600">
                                                                                                    <div className="font-bold text-xs">{item.title}</div>
                                                                                                    {item.subtitle && <div className="text-[10px] text-slate-400">{item.subtitle}</div>}
                                                                                                </div>
                                                                                            </div>
                                                                                        );
                                                                                    }
                                                                                    if (item.text) return <div key={idx} className="text-slate-600 whitespace-pre-wrap">{item.text}</div>;
                                                                                    return <div key={idx} className="text-xs text-slate-400 font-mono break-all">{JSON.stringify(item)}</div>;
                                                                                })}
                                                                            </div>
                                                                        );
                                                                    }

                                                                    // 2. Facebook Template (Generic/Button)
                                                                    if (payload) {
                                                                        if (payload.template_type === 'generic' && Array.isArray(payload.elements)) {
                                                                            return (
                                                                                <div className="space-y-2 mt-2">
                                                                                    {prefix && <div className="text-sm text-slate-800 whitespace-pre-wrap mb-2">{prefix}</div>}
                                                                                    {payload.elements.map((el: any, idx: number) => (
                                                                                        <div key={idx} className="flex gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100 items-center">
                                                                                            {el.image_url && <img src={el.image_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-200" />}
                                                                                            <div className="flex-1 min-w-0">
                                                                                                <div className="text-sm font-bold text-slate-700">{el.title}</div>
                                                                                                {el.subtitle && <div className="text-xs text-slate-500">{el.subtitle}</div>}
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            );
                                                                        }
                                                                        if (payload.template_type === 'button') {
                                                                            return (
                                                                                <div className="mt-1 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                                                    {prefix && <div className="text-sm text-slate-800 whitespace-pre-wrap mb-2">{prefix}</div>}
                                                                                    <div className="text-slate-700 font-medium text-sm mb-2">{payload.text}</div>
                                                                                    {Array.isArray(payload.buttons) && (
                                                                                        <div className="flex flex-wrap gap-2">
                                                                                            {payload.buttons.map((btn: any, bIdx: number) => (
                                                                                                <span key={bIdx} className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-blue-600 uppercase tracking-wide shadow-sm">
                                                                                                    {btn.title}
                                                                                                </span>
                                                                                            ))}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        }
                                                                    }

                                                                    // 3. Fallback: Pretty print object keys if simple
                                                                    if (typeof parsed === 'object' && parsed !== null) {
                                                                        const keys = Object.keys(parsed);
                                                                        const isSimple = keys.every(k => typeof parsed[k] !== 'object' && String(parsed[k]).length < 100);
                                                                        if (isSimple && keys.length > 0) {
                                                                            return (
                                                                                <div className="mt-1 space-y-1">
                                                                                    {prefix && <div className="text-sm text-slate-800 whitespace-pre-wrap mb-2">{prefix}</div>}
                                                                                    {keys.map(k => (
                                                                                        <div key={k} className="flex gap-2 text-xs">
                                                                                            <span className="font-bold text-slate-400 capitalize">{k.replace(/_/g, ' ')}:</span>
                                                                                            <span className="text-slate-700 break-all">{String(parsed[k])}</span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )
                                                                        }
                                                                    }

                                                                    return <div className="mt-2 text-[10px] bg-slate-50 p-3 rounded-xl overflow-auto border border-slate-100 font-mono text-slate-500">
                                                                        {prefix && <div className="text-sm text-slate-800 whitespace-pre-wrap mb-2 font-sans">{prefix}</div>}
                                                                        <div className="font-bold text-slate-400 mb-1 uppercase tracking-widest text-[9px]">Raw Data</div>
                                                                        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(parsed, null, 2)}</pre>
                                                                    </div>;
                                                                } catch (e) {
                                                                    return String(act.event_data);
                                                                }
                                                            })()}
                                                        </div>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="py-20 text-center bg-slate-50/50 rounded-[28px] border border-dashed border-slate-200 mr-12 -ml-12 pl-12">
                                                    <History className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Hành trình đang trống</p>
                                                </div>
                                            )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'notes' && (
                                <div className="animate-in fade-in slide-in-from-right-2 duration-300 pb-10">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                                            <FileText className="w-3 h-3" /> Ghi chú nội bộ & Thông tin nhãn
                                        </label>
                                        <div className="space-y-4">
                                            {(() => {
                                                try {
                                                    const notesData = JSON.parse(user.notes);
                                                    if (Array.isArray(notesData)) {
                                                        const infoNotes = notesData.filter((item: any) => item.type === 'meta_extra_info');
                                                        if (infoNotes.length === 0) return null;

                                                        return infoNotes.map((item: any, i: number) => (
                                                            <div key={i} className="p-5 bg-blue-50/30 rounded-[24px] border border-blue-100/30 animate-in slide-in-from-left duration-500">
                                                                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.15em] mb-2 px-1">Meta Lead Info</p>
                                                                <p className="text-sm font-bold text-slate-700 leading-relaxed shadow-sm bg-white p-4 rounded-2xl">{item.content}</p>
                                                                {item.created_at && <p className="text-[9px] text-slate-300 mt-3 font-bold uppercase tracking-widest px-1">{formatTimeAgoShort(item.created_at)}</p>}
                                                            </div>
                                                        ));
                                                    }
                                                } catch (e) { }
                                                return null;
                                            })()}
                                            <div className="relative pt-4">
                                                <div className="absolute top-0 left-4 px-2 bg-white text-[9px] font-black text-slate-400 uppercase tracking-widest z-10">Ghi chú cá nhân</div>
                                                <textarea
                                                    value={formData.notes}
                                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                                    className="w-full min-h-[150px] p-6 bg-slate-50/50 border border-slate-200 rounded-[28px] text-sm font-medium text-slate-600 focus:outline-none focus:border-blue-500 transition-all resize-none shadow-inner mt-2"
                                                    placeholder="Nhập ghi chú quan trọng về Khách hàng này..."
                                                />
                                                <button
                                                    onClick={handleSave}
                                                    disabled={updating}
                                                    className="absolute bottom-4 right-4 px-6 py-2.5 bg-blue-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-blue-600/20 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2"
                                                >
                                                    <Send className="w-3.5 h-3.5" />
                                                    Lưu ghi chú
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 shrink-0 flex items-center">
                    <div className="flex justify-between w-full items-center">
                        <button className="inline-flex items-center justify-center font-bold rounded-xl transition-all duration-300 active:scale-95 tracking-tight bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2.5 text-sm gap-2 border-none shadow-none">
                            <Trash2 className="w-4 h-4" />
                            Xóa
                        </button>

                        <div className="flex gap-3">
                            {editMode && (
                                <button
                                    onClick={handleSave}
                                    disabled={updating}
                                    className="inline-flex items-center justify-center font-bold rounded-xl transition-all duration-300 active:scale-95 bg-blue-600 text-white px-6 py-2.5 text-sm gap-2 shadow-lg shadow-blue-500/20"
                                >
                                    {updating ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            )}
                            <button
                                onClick={handleClose}
                                className="inline-flex items-center justify-center font-bold rounded-xl transition-all duration-500 active:scale-95 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-blue-500 hover:text-blue-600 px-5 py-2.5 text-sm gap-2"
                            >
                                Đóng
                            </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>,
        getMktPortalRoot()
    );
};

/* --- Helpers & Sub-components --- */

const ProfileTab = ({ active, onClick, label, icon: Icon, count }: any) => (
    <button
        onClick={onClick}
        className={`relative pb-3 px-4 text-[12px] font-black flex items-center gap-2 transition-colors duration-300 whitespace-nowrap shrink-0 ${active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
    >
        <Icon className={`w-3.5 h-3.5 ${active ? 'text-blue-600' : 'text-slate-300'}`} />
        {label}
        {count !== undefined && count > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${active ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                {count}
            </span>
        )}
        <div className={`absolute bottom-0 left-4 right-4 h-[2.5px] bg-blue-600 rounded-full transition-all duration-300 ${active ? 'opacity-100 scale-x-100' : 'opacity-0 scale-x-0'}`} />
    </button>
);

const InputField = ({ label, value, onChange, disabled, icon: Icon, required, placeholder }: any) => (
    <div className="w-full">
        <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 text-slate-400">
            {label} {required && <span className="text-rose-500">*</span>}
        </label>
        <div className="relative group">
            {Icon && (
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                    <Icon className="w-4 h-4" />
                </div>
            )}
            <input
                value={value || ''}
                onChange={e => onChange && onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder || `Nhập ${label.toLowerCase()}...`}
                className={`
                    w-full h-[42px] bg-white border rounded-xl px-3.5 text-sm font-bold text-slate-700
                    placeholder:text-slate-300 placeholder:font-medium
                    transition-all duration-200 shadow-sm
                    hover:border-slate-300
                    focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10
                    disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed
                    ${Icon ? 'pl-10' : ''}
                    border-slate-200
                `}
            />
        </div>
    </div>
);

const TimelineIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'message': return <div className="w-full h-full flex items-center justify-center rounded-full text-blue-500 bg-blue-50"><MessageCircle className="w-4 h-4" /></div>;
        case 'comment': return <div className="w-full h-full flex items-center justify-center rounded-full text-emerald-500 bg-emerald-50"><MessageSquare className="w-4 h-4" /></div>;
        case 'lead_form': return <div className="w-full h-full flex items-center justify-center rounded-full text-purple-500 bg-purple-50"><FileText className="w-4 h-4" /></div>;
        default: return <div className="w-full h-full flex items-center justify-center rounded-full text-slate-400 bg-slate-50"><Clock className="w-4 h-4" /></div>;
    }
};

const formatTimeAgoShort = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();
    if (diff < 60000) return 'vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
    const days = Math.floor(diff / 86400000);
    if (days < 30) return `${days} ngày trước`;
    return then.toLocaleDateString('vi-VN');
};

const formatTimeShort = (date: string) => {
    return new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};
