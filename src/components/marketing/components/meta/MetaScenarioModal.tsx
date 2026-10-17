import * as React from 'react';
import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Link, Phone, Globe, MessageCircle, MessageSquare, Star, Zap, Calendar, Smile, ChevronUp, ChevronDown, AlertCircle, Sparkles, Clock, Info, Bot, UploadCloud, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import Modal from '../common/Modal';
import { API_BASE_URL } from '../../utils/config';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port !== '';


// Helper to get headers
const getHeaders = () => {
    const token = localStorage.getItem('ai_space_access_token') || localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Custom Select Component
const CustomSelect = ({ label, value, options, onChange, className }: { label?: string, value: string, options: { value: string, label: React.ReactNode }[], onChange: (val: string) => void, className?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClick = () => setIsOpen(false);
        if (isOpen) window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [isOpen]);

    return (
        <div className={`relative ${className || ''}`} onClick={(e) => e.stopPropagation()}>
            {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">{label}</label>}
            <div
                className={`w-full px-2.5 py-2.5 bg-white border cursor-pointer flex items-center justify-between rounded-xl text-[11px] font-bold transition-all shadow-sm ${isOpen ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-100 hover:border-blue-200'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="text-slate-700">{selectedOption?.label || 'Chọn...'}</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-[14px] shadow-xl border border-slate-100 overflow-hidden z-[50] animate-in fade-in zoom-in-95 duration-200">
                    <div className="max-h-[200px] overflow-y-auto p-1.5 space-y-0.5">
                        {options.map((opt) => (
                            <div
                                key={opt.value}
                                className={`px-4 py-2.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors flex items-center justify-between ${value === opt.value ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                }}
                            >
                                {opt.label}
                                {value === opt.value && <div className="w-2 h-2 rounded-full bg-blue-500"></div>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

interface MetaScenarioModalProps {
    scenario: any | null;
    onClose: () => void;
    onSave: (data: any) => void;
    metaConfigId?: string; // Optional if we want to pre-select
}

const MetaScenarioModal: React.FC<MetaScenarioModalProps> = ({ scenario, onClose: _onClose, onSave, metaConfigId }) => {
    const [animateIn, setAnimateIn] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => { setTimeout(() => setAnimateIn(true), 10); }, []);
    const onClose = () => { setAnimateIn(false); setTimeout(_onClose, 400); };

    const [metaConfigs, setMetaConfigs] = useState<any[]>([]);
    const [activeChatbots, setActiveChatbots] = useState<any[]>([]);

    const [formData, setFormData] = useState({
        id: scenario?.id || '',
        meta_config_id: scenario?.meta_config_id || metaConfigId || '',
        type: scenario?.type || 'keyword',
        title: scenario?.title || '',
        trigger_text: scenario?.trigger_text || '',
        content: scenario?.content || '',
        message_type: scenario?.message_type || 'text',
        image_url: scenario?.image_url || '',
        attachment_id: scenario?.attachment_id || '',
        buttons: scenario?.buttons || [],
        status: scenario?.status || 'active',
        ai_chatbot_id: scenario?.ai_chatbot_id || '',
        schedule_type: scenario?.schedule_type || 'full',
        start_time: scenario?.start_time || '00:00:00',
        end_time: scenario?.end_time || '23:59:59',
        active_days: scenario?.active_days || '1,2,3,4,5,6,0',
        holiday_start_at: scenario?.holiday_start_at || '',
        holiday_end_at: scenario?.holiday_end_at || '',
        priority_override: scenario?.priority_override || 0
    });

    const [isPerDay, setIsPerDay] = useState(formData.active_days.startsWith('{'));
    const [perDaySchedule, setPerDaySchedule] = useState<any>(() => {
        if (formData.active_days.startsWith('{')) {
            try { return JSON.parse(formData.active_days); } catch (e) { return {}; }
        }
        return {};
    });

    useEffect(() => {
        fetchMetaConfigs();
        fetchActiveChatbots();
    }, []);

    const fetchMetaConfigs = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/meta_config.php`, { headers: getHeaders() });
            if (res.data.success) {
                setMetaConfigs(res.data.data);
                if (!formData.meta_config_id && res.data.data.length > 0) {
                    setFormData(prev => ({ ...prev, meta_config_id: res.data.data[0].id }));
                }
            }
        } catch (error) {
            console.error('Fetch MetaConfigs error:', error);
        }
    };

    const fetchActiveChatbots = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/ai_training.php?action=list_all_chatbots`, { headers: getHeaders() });
            if (res.data.success) {
                setActiveChatbots(res.data.data);
            }
        } catch (error) {
            console.error('Fetch Chatbots error:', error);
        }
    };

    const handleAddButton = () => {
        if (formData.buttons.length >= 3) return toast.error('Tối đa 3 nút bấm cho mỗi tin nhắn');
        setFormData({
            ...formData,
            buttons: [...formData.buttons, { title: '', type: 'web_url', url: '' }]
        });
    };

    const handleRemoveButton = (index: number) => {
        const newButtons = [...formData.buttons];
        newButtons.splice(index, 1);
        setFormData({ ...formData, buttons: newButtons });
    };

    const handleButtonChange = (index: number, field: string, val: string) => {
        const newButtons = [...formData.buttons];
        newButtons[index][field] = val;
        setFormData({ ...formData, buttons: newButtons });
    };

    const toggleDay = (day: string) => {
        if (isPerDay) {
            const newSchedule = { ...perDaySchedule };
            if (newSchedule[day]) {
                delete newSchedule[day];
            } else {
                newSchedule[day] = { start: formData.start_time || '08:00', end: formData.end_time || '17:00' };
            }
            setPerDaySchedule(newSchedule);
            return;
        }

        let currentDaysStr = formData.active_days;
        if (currentDaysStr.startsWith('{')) {
            currentDaysStr = "1,2,3,4,5,6,0";
        }

        const days = currentDaysStr.split(',').filter(d => d !== '');
        let newDays;
        if (days.includes(day)) {
            newDays = days.filter(d => d !== day);
        } else {
            newDays = [...days, day];
        }
        setFormData({ ...formData, active_days: newDays.sort().join(',') });
    };

    const updatePerDayTime = (day: string, field: 'start' | 'end', value: string) => {
        setPerDaySchedule({
            ...perDaySchedule,
            [day]: { ...perDaySchedule[day], [field]: value }
        });
    };

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const metaConfigId = formData.meta_config_id;

        try {
            // 1. Upload to Server (for URL and Preview)
            const serverFormData = new FormData();
            serverFormData.append('file', file);
            const serverRes = await axios.post(`${API_BASE_URL}/upload.php`, serverFormData, { headers: getHeaders() });

            let imageUrl = '';
            if (serverRes.data.success) {
                imageUrl = serverRes.data.data.url;
            }

            // 2. Upload to Facebook (for Attachment ID)
            const metaFormData = new FormData();
            metaFormData.append('file', file);
            metaFormData.append('meta_config_id', metaConfigId);
            const metaRes = await axios.post(`${API_BASE_URL}/meta_upload.php`, metaFormData, { headers: getHeaders() });

            if (metaRes.data.success) {
                setFormData(prev => ({
                    ...prev,
                    attachment_id: metaRes.data.data.attachment_id,
                    image_url: imageUrl || prev.image_url
                }));
                toast.success('Tải lên hoàn tất! Đã tự động cấu hình ID và URL.');
            } else {
                // If meta fails but server succeeded, we still have the URL
                if (imageUrl) {
                    setFormData(prev => ({ ...prev, image_url: imageUrl }));
                    toast.success('Đã tải lên máy chủ (không lấy được Facebook ID)');
                } else {
                    toast.error(metaRes.data.message || 'Lỗi tải lên Facebook');
                }
            }
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Lỗi kết nối máy chủ');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const DAYS = [
        { id: '1', label: 'T2' },
        { id: '2', label: 'T3' },
        { id: '3', label: 'T4' },
        { id: '4', label: 'T5' },
        { id: '5', label: 'T6' },
        { id: '6', label: 'T7' },
        { id: '0', label: 'CN' }
    ];

    const handleSubmit = () => {
        if (!formData.meta_config_id) {
            toast.error('Vui lòng chọn Fanpage');
            return;
        }
        if (!formData.title.trim()) {
            toast.error('Vui lòng nhập tiêu đề kịch bản');
            return;
        }

        if (formData.type === 'keyword' && !formData.trigger_text.trim()) {
            toast.error('Vui lòng nhập từ khóa kích hoạt');
            return;
        }

        if (formData.type !== 'ai_reply' && !formData.content.trim()) {
            toast.error('Vui lòng nhập nội dung phản hồi');
            return;
        }

        if (formData.type === 'ai_reply' && !formData.ai_chatbot_id.trim()) {
            toast.error('Vui lòng chọn AI Chatbot');
            return;
        }

        // Validate buttons
        for (const btn of formData.buttons) {
            const title = btn.title?.trim() || '';
            if (!title) {
                toast.error('Vui lòng nhập tên cho tất cả các nút');
                return;
            }

            if (btn.type === 'web_url') {
                const url = btn.url?.trim() || '';
                if (!url) {
                    toast.error(`Vui lòng nhập link cho nút "${title}"`);
                    return;
                }
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    toast.error(`Link của nút "${title}" không hợp lệ. Phải bắt đầu bằng http:// hoặc https://`);
                    return;
                }
            }

            if (btn.type === 'phone_number') {
                const phone = btn.payload?.trim() || '';
                if (!phone) {
                    toast.error(`Vui lòng nhập số điện thoại cho nút "${title}"`);
                    return;
                }
                if (!phone.startsWith('+')) {
                    toast.error(`Số điện thoại nút "${title}" phải bắt đầu bằng dấu + (VD: +84...)`);
                    return;
                }
            }

            if (btn.type === 'postback') {
                if (!btn.payload?.trim()) {
                    toast.error(`Vui lòng nhập Payload cho nút "${title}"`);
                    return;
                }
            }

            if (btn.type === 'reply') {
                if (!btn.auto_response_content?.trim()) {
                    toast.error(`Vui lòng nhập nội dung phản hồi cho nút "${title}"`);
                    return;
                }
            }
        }

        const payload = { ...formData };
        if (isPerDay) {
            payload.active_days = JSON.stringify(perDaySchedule);
        } else if (payload.active_days.startsWith('{')) {
            payload.active_days = "1,2,3,4,5,6,0";
        }
        onSave(payload);
    };

    return (
        <Modal
            isOpen={animateIn}
            onClose={onClose}
            size="4xl"
            noHeader
            noPadding
        >
            <div className="flex flex-col bg-white max-h-[90vh]">
                {/* Header */}
                <div className={`p-8 border-b border-slate-50 flex justify-between items-center relative overflow-hidden`}>
                    <div className={`absolute inset-0 opacity-10 ${formData.type === 'welcome' ? 'bg-gradient-to-r from-[#BD1D2D] to-[#9A1523]' : formData.type === 'holiday' ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}></div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-[14px] shadow-xl flex items-center justify-center text-white ${formData.type === 'welcome' ? 'bg-gradient-to-br from-[#BD1D2D] to-[#9A1523] shadow-[var(--color-primary)]/30' : formData.type === 'holiday' ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/30' : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'}`}>
                            {formData.type === 'welcome' ? <Star className="w-7 h-7" /> : formData.type === 'holiday' ? <Calendar className="w-7 h-7" /> : <Zap className="w-7 h-7" />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                                {scenario ? 'Cập Nhật Kịch Bản' : 'Tạo Kịch Bản Mới'}
                            </h2>
                            <p className="text-sm font-medium text-slate-500">Thiết lập phản hồi tự động cho Meta Messenger</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="relative z-10 p-3 hover:bg-white rounded-full transition-all text-slate-400 hover:text-slate-600 shadow-sm"><X className="w-6 h-6" /></button>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50/50 custom-scrollbar min-h-0">
                    <div className="flex flex-col lg:flex-row">
                        {/* Config Column */}
                        <div className="lg:w-7/12 p-8 space-y-8">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <CustomSelect
                                        label="Chọn Fanpage"
                                        value={formData.meta_config_id}
                                        options={metaConfigs.map(cfg => ({ value: cfg.id, label: cfg.page_name }))}
                                        onChange={(val) => setFormData({ ...formData, meta_config_id: val })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <CustomSelect
                                        label="Loại kích hoạt"
                                        value={formData.type}
                                        options={[
                                            { value: 'welcome', label: <div className="flex items-center gap-2"><Star className="w-4 h-4 text-[var(--color-primary)]" /><span>Quan tâm</span></div> },
                                            { value: 'first_message', label: <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-rose-500" /><span>Bắt chuyện</span></div> },
                                            { value: 'keyword', label: <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-indigo-500" /><span>Từ khóa</span></div> },
                                            { value: 'ai_reply', label: <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-500" /><span>AI chăm sóc</span></div> },
                                            { value: 'holiday', label: <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-rose-600" /><span>Ngày nghỉ</span></div> }
                                        ]}
                                        onChange={(val) => {
                                            const updates: any = { type: val };
                                            if (val === 'holiday') {
                                                updates.start_time = '22:00';
                                                updates.end_time = '08:00';
                                                updates.schedule_type = 'daily_range';
                                            }
                                            setFormData({ ...formData, ...updates });
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tiêu đề kịch bản</label>
                                <input
                                    type="text"
                                    placeholder="VD: Chào mừng khách mới, Tư vấn giá..."
                                    className="w-full px-5 py-4 bg-white border border-slate-100 focus:border-blue-500/30 focus:ring-4 focus:ring-blue-500/5 rounded-[14px] text-sm font-bold transition-all outline-none shadow-sm"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            {formData.type === 'keyword' && (
                                <div className="space-y-4 p-6 bg-indigo-50/50 rounded-[18px] border border-indigo-100 animate-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                            <MessageCircle className="w-4 h-4" /> Từ khóa kích hoạt
                                        </label>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="VD: giá cả, sản phẩm, hỗ trợ (phân cách bằng dấu phẩy)"
                                        className="w-full px-5 py-4 bg-white border border-indigo-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-[14px] text-sm font-bold transition-all outline-none text-indigo-700 shadow-sm"
                                        value={formData.trigger_text}
                                        onChange={(e) => setFormData({ ...formData, trigger_text: e.target.value })}
                                    />
                                    <div className="bg-white/50 p-4 rounded-[14px] border border-indigo-100 space-y-2">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-tight">
                                            <AlertCircle className="w-3.5 h-3.5" /> Lưu ý:
                                        </div>
                                        <ul className="text-[10px] text-slate-500 font-medium space-y-1 ml-5 list-disc leading-relaxed">
                                            <li>Dùng dấu phẩy (`,`) để ngăn cách nhiều từ khóa.</li>
                                            <li>Hệ thống sẽ tự động khớp từ khóa trong tin nhắn của khách.</li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {formData.type === 'ai_reply' && (
                                <div className="space-y-4 p-6 bg-emerald-50/50 rounded-[18px] border border-emerald-100 animate-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" /> Kích hoạt Trí Tuệ Nhân Tạo (AI)
                                        </label>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <CustomSelect
                                                label="Chọn AI Chatbot"
                                                value={formData.ai_chatbot_id}
                                                options={activeChatbots.map(bot => ({
                                                    value: bot.property_id,
                                                    label: <div className="flex items-center gap-2"><Zap className="w-3 h-3 text-emerald-500" /><span>{bot.bot_name}</span></div>
                                                }))}
                                                onChange={(val) => setFormData({ ...formData, ai_chatbot_id: val })}
                                            />
                                        </div>
                                        <div className="bg-white/50 p-4 rounded-[14px] border border-emerald-100 space-y-2">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase tracking-tight">
                                                <Info className="w-3.5 h-3.5" /> Cơ chế hoạt động:
                                            </div>
                                            <ul className="text-[10px] text-slate-500 font-medium space-y-1 ml-5 list-disc leading-relaxed">
                                                <li>Hệ thống sẽ dựa trên <b>Kiến thức đã Train</b> của AI để tự động trả lời Khách hàng.</li>
                                                <li>Tự động nhận diện Link Website thành <b>Nút bấm</b>.</li>
                                                <li>Tự động nhận diện Số điện thoại thành <b>Nút gọi</b>.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Scheduling Section */}
                            {(formData.type === 'holiday' || formData.schedule_type) && (
                                <div className={`bg-white p-6 rounded-[18px] border ${formData.type === 'holiday' ? 'border-rose-100 shadow-rose-500/5' : 'border-slate-100'} shadow-sm space-y-6`}>
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                            <Clock className={`w-4 h-4 ${formData.type === 'holiday' ? 'text-rose-500' : 'text-emerald-500'}`} />
                                            {formData.type === 'holiday' ? 'Thời gian nghỉ & Ưu tiên' : 'Thời gian hoạt động'}
                                        </h3>

                                        {formData.type !== 'holiday' && (
                                            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl">
                                                <button
                                                    onClick={() => setFormData({ ...formData, schedule_type: 'full' })}
                                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${formData.schedule_type === 'full' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}
                                                >Toàn Thời gian</button>
                                                <button
                                                    onClick={() => setFormData({ ...formData, schedule_type: 'custom' })}
                                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${formData.schedule_type === 'custom' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}
                                                >Tùy chỉnh</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Priority Override */}
                                    {formData.type === 'holiday' && (
                                        <div className="flex items-center justify-between gap-4 bg-rose-50/50 p-4 rounded-[14px] border border-rose-100">
                                            <div className="flex-1">
                                                <div
                                                    onClick={() => setFormData({ ...formData, priority_override: formData.priority_override == 1 ? 0 : 1 })}
                                                    className="text-xs font-bold text-rose-700 cursor-pointer select-none block mb-1"
                                                >
                                                    Chế độ ưu tiên tuyệt đối (Priority Override)
                                                </div>
                                                <p className="text-[10px] text-slate-500 leading-relaxed">
                                                    Khi bật: Nếu đang trong giờ nghỉ, hệ thống sẽ <b>CHẶN</b> tất cả các kịch bản khác. Chỉ gửi duy nhất tin nhắn nghỉ này.
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, priority_override: formData.priority_override == 1 ? 0 : 1 })}
                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${formData.priority_override == 1 ? 'bg-rose-500' : 'bg-slate-200'}`}
                                                >
                                                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${formData.priority_override == 1 ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Holiday Schedule Type Switch */}
                                    {formData.type === 'holiday' && (
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Kiểu lịch thiết lập</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => setFormData({ ...formData, schedule_type: 'daily_range' })}
                                                    className={`p-3 rounded-xl border text-left transition-all ${formData.schedule_type === 'daily_range' ? 'bg-rose-50 border-rose-200 ring-1 ring-rose-500/20' : 'bg-white border-slate-200 opacity-60 hover:opacity-100'}`}
                                                >
                                                    <div className="text-xs font-bold text-slate-700 mb-1">Khung giờ mỗi ngày</div>
                                                    <div className="text-[10px] text-slate-400">VD: 22h tối đến 5h sáng (lặp lại hàng ngày)</div>
                                                </button>
                                                <button
                                                    onClick={() => setFormData({ ...formData, schedule_type: 'date_range' })}
                                                    className={`p-3 rounded-xl border text-left transition-all ${formData.schedule_type === 'date_range' ? 'bg-rose-50 border-rose-200 ring-1 ring-rose-500/20' : 'bg-white border-slate-200 opacity-60 hover:opacity-100'}`}
                                                >
                                                    <div className="text-xs font-bold text-slate-700 mb-1">Khoảng ngày cụ thể</div>
                                                    <div className="text-[10px] text-slate-400">VD: Nghỉ Tết từ 01/02 đến 05/02</div>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Config for Daily Range (Generic Custom OR Holiday Daily) */}
                                    {(formData.schedule_type === 'custom' || formData.schedule_type === 'daily_range') && (
                                        <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Từ giờ</label>
                                                <input
                                                    type="time"
                                                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold outline-none focus:ring-2 ring-emerald-500/20"
                                                    value={formData.start_time}
                                                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Đến giờ</label>
                                                <input
                                                    type="time"
                                                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold outline-none focus:ring-2 ring-emerald-500/20"
                                                    value={formData.end_time}
                                                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Config for Date Range (Holiday Only) */}
                                    {formData.schedule_type === 'date_range' && (
                                        <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Bắt đầu nghỉ từ</label>
                                                <input
                                                    type="datetime-local"
                                                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold outline-none focus:ring-2 ring-rose-500/20"
                                                    value={formData.holiday_start_at || ''}
                                                    onChange={(e) => setFormData({ ...formData, holiday_start_at: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-1">Hoạt động vào lúc</label>
                                                <input
                                                    type="datetime-local"
                                                    className="w-full px-4 py-3 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold outline-none focus:ring-2 ring-rose-500/20"
                                                    value={formData.holiday_end_at || ''}
                                                    onChange={(e) => setFormData({ ...formData, holiday_end_at: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Active Days Selection */}
                                    {formData.schedule_type !== 'date_range' && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                    <Calendar className="w-3.5 h-3.5" /> Áp dụng ngày trong tuần
                                                </label>
                                                {/* Hide per-day toggle when full schedule */}
                                                {formData.schedule_type !== 'full' && (
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{isPerDay ? 'Giờ riêng: BẬT' : 'Giờ riêng: TẮT'}</span>
                                                        <button
                                                            type="button"
                                                            role="switch"
                                                            aria-checked={isPerDay}
                                                            onClick={() => {
                                                                const newVal = !isPerDay;
                                                                setIsPerDay(newVal);
                                                                if (newVal && Object.keys(perDaySchedule).length === 0) {
                                                                    const initial: any = {};
                                                                    if (formData.active_days.startsWith('{')) {
                                                                        try {
                                                                            const parsed = JSON.parse(formData.active_days);
                                                                            Object.assign(initial, parsed);
                                                                        } catch (e) {
                                                                            // Fallback if parse fails
                                                                        }
                                                                    } else {
                                                                        formData.active_days.split(',').forEach(d => {
                                                                            if (d) initial[d] = { start: formData.start_time, end: formData.end_time };
                                                                        });
                                                                    }
                                                                    setPerDaySchedule(initial);
                                                                }
                                                            }}
                                                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-sky-500 focus:ring-offset-1 ${isPerDay ? 'bg-sky-500' : 'bg-slate-300'}`}
                                                        >
                                                            <span aria-hidden="true" className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isPerDay ? 'translate-x-4' : 'translate-x-0'}`} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {DAYS.map(day => {
                                                    // When full schedule: all days always active, non-clickable
                                                    const isFullSchedule = formData.schedule_type === 'full';
                                                    const isActive = isFullSchedule || (isPerDay ? !!perDaySchedule[day.id] : formData.active_days.split(',').includes(day.id));
                                                    return (
                                                        <div key={day.id} className="flex flex-col gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => !isFullSchedule && toggleDay(day.id)}
                                                                className={`w-10 h-10 rounded-xl text-xs font-black transition-all border flex items-center justify-center ${isActive ? 'bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-500/30' : 'bg-white text-slate-400 border-slate-100 hover:border-emerald-200'} ${isFullSchedule ? 'cursor-default opacity-90' : ''}`}
                                                            >
                                                                {day.label}
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {isPerDay && formData.schedule_type !== 'full' && (
                                                <div className="space-y-3 bg-slate-50/50 p-4 rounded-[18px] border border-slate-100 animate-in fade-in slide-in-from-top-2">
                                                    {DAYS.map(day => {
                                                        if (!perDaySchedule[day.id]) return null;
                                                        return (
                                                            <div key={day.id} className="flex items-center gap-4 bg-white p-3 rounded-[14px] border border-slate-100/50 shadow-sm">
                                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-black">{day.label}</div>
                                                                <div className="flex-1 grid grid-cols-2 gap-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Từ</span>
                                                                        <input
                                                                            type="time"
                                                                            value={perDaySchedule[day.id].start}
                                                                            onChange={(e) => updatePerDayTime(day.id, 'start', e.target.value)}
                                                                            className="flex-1 bg-slate-50 border-none rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:ring-1 ring-emerald-500"
                                                                        />
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Đến</span>
                                                                        <input
                                                                            type="time"
                                                                            value={perDaySchedule[day.id].end}
                                                                            onChange={(e) => updatePerDayTime(day.id, 'end', e.target.value)}
                                                                            className="flex-1 bg-slate-50 border-none rounded-lg px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:ring-1 ring-emerald-500"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Content Output - Hide if AI */}
                            {formData.type !== 'ai_reply' && (
                                <div className="bg-white p-6 rounded-[18px] border border-slate-100 shadow-sm space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1"></div>
                                        {formData.type === 'welcome' && (
                                            <span className="px-3 py-1 bg-amber-50 text-[var(--color-primary)] rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100">Chỉ gửi 1 lần</span>
                                        )}
                                    </div>

                                    <div className="space-y-6">
                                        <textarea
                                            placeholder="Nhập nội dung tin nhắn phản hồi..."
                                            rows={5}
                                            className="w-full p-5 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-emerald-500/10 rounded-[18px] text-sm font-medium transition-all outline-none resize-none shadow-inner"
                                            value={formData.content}
                                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                        ></textarea>

                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                                                    {formData.message_type === 'image' ? <UploadCloud className="w-3.5 h-3.5 text-blue-500" /> : <Loader2 className="w-3.5 h-3.5 text-blue-500" />}
                                                    {formData.message_type === 'image' ? 'Hình ảnh đính kèm' : 'Video đính kèm'}
                                                </label>
                                                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl">
                                                    {['text', 'image', 'video'].map(m => (
                                                        <button
                                                            key={m}
                                                            type="button"
                                                            onClick={() => setFormData({ ...formData, message_type: m })}
                                                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${formData.message_type === m ? 'bg-white text-blue-600 shadow-sm border border-slate-100' : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            {m === 'text' ? 'Không' : m === 'image' ? 'Ảnh' : 'Video'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {(formData.message_type === 'image' || formData.message_type === 'video') && (
                                                <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <input
                                                        type="file"
                                                        ref={fileInputRef}
                                                        className="hidden"
                                                        accept={formData.message_type === 'image' ? 'image/*' : 'video/*'}
                                                        onChange={handleMediaUpload}
                                                    />

                                                    <div
                                                        onClick={() => !uploading && fileInputRef.current?.click()}
                                                        className={`group relative overflow-hidden bg-white border-2 border-dashed ${uploading ? 'border-blue-200' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'} rounded-[18px] p-10 transition-all cursor-pointer flex flex-col items-center justify-center gap-4`}
                                                    >
                                                        <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${uploading ? 'bg-blue-100' : 'bg-blue-50 group-hover:scale-110 group-hover:rotate-3'}`}>
                                                            {uploading ? (
                                                                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                                                            ) : (
                                                                <UploadCloud className="w-6 h-6 text-blue-500" />
                                                            )}
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs font-black text-slate-700">
                                                                {uploading ? 'Đang tải lên...' : `Click để tải ${formData.message_type === 'image' ? 'ảnh' : 'video'} lên`}
                                                            </p>
                                                            <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                                                                {formData.message_type === 'image' ? 'JPEG, PNG, JPG (Max 5MB)' : 'MP4, MOV (Max 25MB)'}
                                                            </p>
                                                        </div>

                                                        {/* Preview Case */}
                                                        {(formData.image_url) && !uploading && (
                                                            <div className="absolute inset-0 bg-white p-2">
                                                                {formData.message_type === 'image' ? (
                                                                    <img src={formData.image_url} alt="Preview" className="w-full h-full object-contain rounded-[14px]" />
                                                                ) : (
                                                                    <video src={formData.image_url} className="w-full h-full object-contain rounded-[14px]" />
                                                                )}
                                                                <div className="absolute top-4 right-4 p-2 bg-white/90 backdrop-blur shadow-lg rounded-full text-slate-400 hover:text-rose-500 transition-colors" onClick={(e) => { e.stopPropagation(); setFormData({ ...formData, image_url: '', attachment_id: '' }); }}>
                                                                    <Trash2 className="w-4 h-4" />
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Buttons Area - Hide if AI */}
                            {formData.type !== 'ai_reply' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                            <Plus className="w-4 h-4 text-blue-500" /> Thiết lập nút bấm
                                        </h3>
                                        <span className="text-[10px] font-bold text-slate-400">{formData.buttons.length}/3 nút</span>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.buttons.map((btn: any, idx: number) => (
                                            <div key={idx} className="bg-white p-4 rounded-[14px] border border-slate-100 shadow-sm animate-in slide-in-from-left-4 duration-300 group">
                                                <div className="space-y-3">
                                                    {/* Row 1: Type, Title, Delete */}
                                                    <div className="flex gap-2 items-center">
                                                        <div className="w-[44px] flex-shrink-0">
                                                            <CustomSelect
                                                                value={btn.type}
                                                                options={[
                                                                    { value: 'reply', label: <div className="flex justify-center w-full" title="Phản hồi nhanh"><MessageSquare className="w-4 h-4 text-slate-400" /></div> },
                                                                    { value: 'web_url', label: <div className="flex justify-center w-full" title="Mở Link"><Link className="w-4 h-4 text-slate-400" /></div> },
                                                                    { value: 'postback', label: <div className="flex justify-center w-full" title="Payload"><Globe className="w-4 h-4 text-slate-400" /></div> },
                                                                    { value: 'phone_number', label: <div className="flex justify-center w-full" title="Gọi điện"><Phone className="w-4 h-4 text-slate-400" /></div> }
                                                                ]}
                                                                onChange={(val) => handleButtonChange(idx, 'type', val)}
                                                                className="!py-2 !px-0 flex justify-center"
                                                            />
                                                        </div>
                                                        <div className="flex-1">
                                                            <input
                                                                type="text"
                                                                maxLength={20}
                                                                placeholder="Nhập tên nút..."
                                                                className="w-full px-4 py-2 bg-slate-50 border border-transparent focus:border-blue-500/10 rounded-xl text-xs font-bold outline-none transition-all"
                                                                value={btn.title}
                                                                onChange={(e) => handleButtonChange(idx, 'title', e.target.value)}
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemoveButton(idx)}
                                                            className="p-2.5 bg-rose-50/50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors"
                                                            title="Xóa nút"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    {/* Row 2: Payload/URL */}
                                                    {btn.type === 'web_url' && (
                                                        <div className="space-y-1 animate-in slide-in-from-top-1">
                                                            <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest">URL</label>
                                                            <div className="relative">
                                                                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                                <input
                                                                    type="text"
                                                                    placeholder="https://..."
                                                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border-none rounded-xl text-xs font-medium outline-none focus:ring-2 ring-emerald-500/20"
                                                                    value={btn.url || ''}
                                                                    onChange={(e) => handleButtonChange(idx, 'url', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {(btn.type === 'postback' || btn.type === 'phone_number') && (
                                                        <div className="space-y-1 animate-in slide-in-from-top-1">
                                                            <label className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                                                {btn.type === 'phone_number' ? 'Số điện thoại' : 'Payload'}
                                                            </label>
                                                            <div className="relative">
                                                                {btn.type === 'phone_number' ? <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" /> : <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />}
                                                                <input
                                                                    type="text"
                                                                    placeholder={btn.type === 'phone_number' ? "+84..." : "DEVELOPER_DEFINED_PAYLOAD"}
                                                                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border-none rounded-xl text-xs font-medium outline-none focus:ring-2 ring-emerald-500/20"
                                                                    value={btn.payload || ''}
                                                                    onChange={(e) => handleButtonChange(idx, 'payload', e.target.value)}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}

                                                    {btn.type === 'reply' && (
                                                        <div className="mt-3 animate-in slide-in-from-top-1 duration-200">
                                                            <div className="w-full flex items-center justify-between p-2.5 bg-blue-50/50 rounded-xl border border-blue-100/30">
                                                                <div className="flex items-center gap-2">
                                                                    <MessageSquare className="w-3 h-3 text-blue-500" />
                                                                    <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Thiết lập tin nhắn phản hồi</span>
                                                                </div>
                                                                <ChevronDown className="w-3 h-3 text-blue-300" />
                                                            </div>
                                                            <div className="mt-2.5">
                                                                <textarea
                                                                    placeholder="Nhập nội dung tin nhắn sẽ phản hồi..."
                                                                    rows={3}
                                                                    className="w-full p-4 bg-slate-50 border border-transparent focus:border-blue-500/10 rounded-[14px] text-xs font-medium transition-all outline-none resize-none"
                                                                    value={btn.auto_response_content || ''}
                                                                    onChange={(e) => handleButtonChange(idx, 'auto_response_content', e.target.value)}
                                                                ></textarea>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {btn.type !== 'reply' && (
                                                        <div className="mt-3 space-y-2 animate-in slide-in-from-top-1 duration-200">
                                                            <div className="flex items-center gap-2 ml-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                                {btn.type === 'web_url' ? <Link className="w-3 h-3 text-blue-500" /> : btn.type === 'phone_number' ? <Phone className="w-3 h-3 text-emerald-500" /> : <Globe className="w-3 h-3 text-indigo-500" />}
                                                                {btn.type === 'web_url' ? 'Link liên kết' : btn.type === 'phone_number' ? 'Số điện thoại' : 'Payload nhận diện'}
                                                            </div>
                                                            <input
                                                                type="text"
                                                                className="w-full px-4 py-2.5 bg-slate-50 border border-transparent focus:border-blue-500/10 rounded-xl text-xs font-bold outline-none transition-all"
                                                                placeholder={btn.type === 'web_url' ? 'https://...' : btn.type === 'phone_number' ? 'VD: +849...' : 'Payload...'}
                                                                value={btn.type === 'web_url' ? (btn.url || '') : (btn.payload || '')}
                                                                onChange={(e) => handleButtonChange(idx, btn.type === 'web_url' ? 'url' : 'payload', e.target.value)}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        {formData.buttons.length === 0 && (
                                            <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-[14px]">
                                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chưa có nút bấm nào</p>
                                            </div>
                                        )}
                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                onClick={handleAddButton}
                                                className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" /> Thêm nút bấm
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Preview Column */}
                        <div className="lg:w-5/12 bg-slate-100 p-8 flex items-start justify-center relative">
                            <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
                            <div className="sticky top-0 flex flex-col items-center justify-center pt-4 w-full">
                                <div className="w-[320px] bg-white rounded-[18px] shadow-2xl border-[8px] border-slate-800 overflow-hidden relative z-10 flex flex-col h-[620px] scale-95 origin-top">
                                    {/* StatusBar */}
                                    <div className="h-7 bg-slate-800 w-full flex justify-center items-center">
                                        <div className="w-16 h-1 bg-slate-700 rounded-full"></div>
                                    </div>

                                    {/* Header */}
                                    {(() => {
                                        const selPage = metaConfigs.find(p => p.id === formData.meta_config_id);
                                        return (
                                            <div className="bg-blue-600 p-4 text-white flex items-center gap-3 shadow-md">
                                                {selPage?.avatar_url ? <img src={selPage.avatar_url} className="w-8 h-8 rounded-full border border-white/20" /> : <div className="w-8 h-8 rounded-full bg-white/20"></div>}
                                                <div>
                                                    <p className="text-xs font-bold truncate max-w-[150px]">{selPage?.page_name || 'Meta Messenger'}</p>
                                                    <p className="text-[9px] opacity-70">Business Page</p>
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    <div className="flex-1 bg-[#e2e8f0] p-4 space-y-4 overflow-y-auto">
                                        <div className="flex items-end gap-2">
                                            <div className="bg-white rounded-r-[14px] rounded-tl-[14px] overflow-hidden shadow-sm max-w-[85%] border border-slate-100">
                                                {formData.type === 'ai_reply' ? (
                                                    <div className="p-3 text-[11px] text-slate-800 space-y-3">
                                                        <div className="flex items-center gap-2 text-emerald-600 font-black text-[9px] uppercase tracking-wider mb-2">
                                                            <Sparkles className="w-3 h-3" /> AI đang trả lời...
                                                        </div>
                                                        <div className="h-2 w-full bg-slate-100 rounded-full animate-pulse"></div>
                                                        <div className="h-2 w-3/4 bg-slate-100 rounded-full animate-pulse"></div>
                                                        <p className="text-[10px] text-slate-400 italic font-medium">Phản hồi sẽ được tạo tự động bởi AI.</p>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {(formData.message_type === 'image' || formData.message_type === 'video') && formData.image_url && (
                                                            <div className="relative aspect-video bg-slate-100 border-b border-slate-50 flex items-center justify-center overflow-hidden">
                                                                {formData.message_type === 'image' ? (
                                                                    <img src={formData.image_url} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="flex flex-col items-center gap-2 opacity-40">
                                                                        <Zap className="w-8 h-8 text-slate-600" />
                                                                        <span className="text-[9px] font-black uppercase tracking-widest">Video Content</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                        <div className="p-3 text-[11px] text-slate-800 whitespace-pre-wrap leading-relaxed">
                                                            {formData.content || <span className="text-slate-300 italic">Nội dung...</span>}
                                                        </div>
                                                        {formData.buttons.map((btn: any, i: number) => (
                                                            <div key={i} className="py-2.5 text-center text-blue-600 font-bold text-xs border-t border-slate-50 hover:bg-slate-50">{btn.title || 'Nút bấm'}</div>
                                                        ))}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer */}
                                    <div className="p-3 bg-white border-t border-slate-100 flex items-center gap-2">
                                        <div className="w-6 h-6 rounded-full bg-slate-100"></div>
                                        <div className="h-8 flex-1 bg-slate-50 rounded-full"></div>
                                        <div className="w-6 h-6 rounded-full bg-blue-500"></div>
                                    </div>{/* end zalo bottom bar */}
                                </div>{/* end phone mockup w-[320px] */}
                            </div>{/* end sticky */}
                        </div>{/* end preview col */}
                    </div>{/* end flex row */}
                </div>{/* end scroll area */}

                {/* Footer - sticky bottom */}
                <div className="sticky bottom-0 bg-white border-t border-slate-100 px-8 py-5 flex justify-end gap-3 shrink-0 z-10">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 bg-white text-slate-600 rounded-[14px] text-sm font-bold hover:bg-slate-100 transition-all border border-slate-200 shadow-sm"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-[14px] text-sm font-bold hover:shadow-lg hover:scale-105 transition-all shadow-blue-500/30"
                    >
                        Lưu kịch bản
                    </button>
                </div>
            </div>{/* end main flex-col */}
        </Modal >
    );
};

export default MetaScenarioModal;
