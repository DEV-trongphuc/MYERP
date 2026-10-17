import * as React from 'react';
import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Link, Phone, Globe, MessageCircle, MessageSquare, Star, Zap, Calendar, Smile, ChevronUp, ChevronDown, AlertCircle, Sparkles, Clock, Info, Bot, UploadCloud, Loader2, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import Modal from '../common/Modal';
import Input from '../common/Input';
import { API_BASE_URL } from '../../utils/config';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port !== '';


// Helper to get headers
const getHeaders = () => {
    const token = localStorage.getItem('ai_space_access_token') || localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// Helper Component for Custom Dropdown
const CustomSelect = ({ label, value, options, onChange }: { label?: string, value: any, options: { value: any, label: React.ReactNode }[], onChange: (val: any) => void }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectedOption = options.find(opt => opt.value === value);

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
        <div className="relative" onClick={(e) => e.stopPropagation()}>
            {label && <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">{label}</label>}
            <div
                className={`w-full px-2.5 py-2.5 bg-white border cursor-pointer flex items-center justify-between rounded-xl text-[11px] font-bold transition-all shadow-sm ${isOpen ? 'border-blue-500 ring-4 ring-blue-500/10' : 'border-slate-100 hover:border-blue-200'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="text-slate-700">{selectedOption?.label || 'Chọn...'}</span>
                {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </div>

            {isVisible && (
                <div className={`absolute top-full left-0 right-0 mt-2 bg-white rounded-[14px] shadow-xl border border-slate-100 overflow-hidden z-[50] transform transition-all duration-200 ${animateDropdownIn ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-95'}`}>
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

interface ScenarioModalProps {
    scenario?: any | null;
    onClose: () => void;
    onSave: () => void;
}

interface ZaloButton {
    title: string;
    type: string;
    payload: string;
    image_icon?: string;
    show_response_config?: boolean;
    auto_response?: string;
}

interface ScenarioData {
    id: string;
    oa_config_id: string;
    type: 'welcome' | 'keyword' | 'ai_reply' | 'holiday' | 'first_message';
    trigger_text: string;
    match_type: 'exact' | 'contains';
    title: string;
    content: string;
    message_type: 'text' | 'image' | 'video';
    image_url: string;
    attachment_id: string;
    buttons: ZaloButton[];
    status: 'active' | 'inactive';
    schedule_type: 'full' | 'custom' | 'daily_range' | 'date_range';
    start_time: string;
    end_time: string;
    active_days: string;
    ai_chatbot_id: string;
    priority_override: number;
    holiday_start_at: string;
    holiday_end_at: string;
}

const ScenarioModal: React.FC<ScenarioModalProps> = ({ scenario, onClose: _onClose, onSave }) => {
    const [animateIn, setAnimateIn] = useState(false);
    useEffect(() => { setTimeout(() => setAnimateIn(true), 10); }, []);
    const onClose = () => { setAnimateIn(false); setTimeout(_onClose, 400); };

    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [oaConfigs, setOaConfigs] = useState<any[]>([]);
    const [audienceLists, setAudienceLists] = useState<any[]>([]);
    const [activeChatbots, setActiveChatbots] = useState<any[]>([]);

    const [formData, setFormData] = useState<ScenarioData>({
        id: scenario?.id || '',
        oa_config_id: scenario?.oa_config_id || '',
        type: scenario?.type || 'keyword',
        trigger_text: scenario?.trigger_text || '',
        match_type: scenario?.match_type || 'exact',
        title: scenario?.title || '',
        content: scenario?.content || '',
        message_type: scenario?.message_type || 'text',
        image_url: scenario?.image_url || '',
        attachment_id: scenario?.attachment_id || '',
        buttons: scenario?.buttons || [],
        status: scenario?.status || 'active',
        schedule_type: scenario?.schedule_type || 'full',
        start_time: scenario?.start_time || '00:00:00',
        end_time: scenario?.end_time || '23:59:59',
        active_days: scenario?.active_days || '1,2,3,4,5,6,0',
        ai_chatbot_id: scenario?.ai_chatbot_id || '',
        priority_override: scenario?.priority_override || 0,
        holiday_start_at: scenario?.holiday_start_at || '',
        holiday_end_at: scenario?.holiday_end_at || ''
    });

    const [isPerDay, setIsPerDay] = useState(formData.active_days.startsWith('{'));
    const [perDaySchedule, setPerDaySchedule] = useState<any>(() => {
        if (formData.active_days.startsWith('{')) {
            try { return JSON.parse(formData.active_days); } catch (e) { return {}; }
        }
        return {};
    });

    const [previewImage, setPreviewImage] = useState<string | null>(scenario?.image_url || null);

    useEffect(() => {
        fetchOas();
        fetchAudienceLists();
        fetchActiveChatbots();
    }, []);

    useEffect(() => {
        if (formData.image_url) {
            setFormData(prev => ({ ...prev, message_type: 'image' }));
            setPreviewImage(formData.image_url);
        } else if (!formData.attachment_id) {
            setFormData(prev => ({ ...prev, message_type: 'text' }));
            setPreviewImage(null);
        }
    }, [formData.image_url]);

    const fetchOas = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/zalo_oa.php?route=list`, { headers: getHeaders() });
            if (res.data.success) {
                const oas = res.data.data;
                setOaConfigs(oas);
                if (!formData.oa_config_id && oas.length > 0) {
                    setFormData(prev => ({ ...prev, oa_config_id: oas[0].id }));
                }
            }
        } catch (error) {
            console.error('Fetch OAs error:', error);
        }
    };

    const fetchAudienceLists = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/zalo_audience.php?route=lists`, { headers: getHeaders() });
            if (res.data.success) {
                setAudienceLists(res.data.data);
            }
        } catch (error) {
            console.error('Fetch Audience Lists error:', error);
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

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!formData.oa_config_id) return toast.error('Vui lòng chọn Zalo OA trước khi upload ảnh');

        setUploading(true);
        const uploadToast = toast.loading('Đang tải ảnh lên...');

        try {
            const formDataUpload = new FormData();
            formDataUpload.append('file', file);
            const list = audienceLists.find(l => l.oa_config_id === formData.oa_config_id);
            if (list) formDataUpload.append('list_id', list.id);

            const res = await axios.post(`${API_BASE_URL}/zalo_audience.php?route=upload_image`, formDataUpload, { headers: getHeaders() });
            if (res.data.success) {
                setFormData(prev => ({
                    ...prev,
                    message_type: 'image',
                    image_url: res.data.data.image_url,
                    attachment_id: res.data.data.attachment_id
                }));
                toast.success('Upload thành công', { id: uploadToast });
            } else {
                toast.error(res.data.message || 'Upload thất bại', { id: uploadToast });
            }
        } catch (error) {
            toast.error('Lỗi kết nối khi upload', { id: uploadToast });
        } finally {
            setUploading(false);
        }
    };

    const handleAddButton = () => {
        if (formData.buttons.length >= 4) return toast.error('Tối đa 4 nút bấm cho mỗi tin nhắn');
        setFormData({
            ...formData,
            buttons: [...formData.buttons, { title: '', type: 'oa.query.show', payload: '', image_icon: '' }]
        });
    };

    const handleRemoveButton = (index: number) => {
        const newButtons = [...formData.buttons];
        newButtons.splice(index, 1);
        setFormData({ ...formData, buttons: newButtons });
    };

    const handleButtonChange = (index: number, field: keyof ZaloButton, val: any) => {
        const newButtons = [...formData.buttons];
        (newButtons[index] as any)[field] = val;
        if (newButtons[index].type === 'oa.query.show') {
            if (field === 'title') newButtons[index].payload = val;
            if (field === 'type' && val === 'oa.query.show') newButtons[index].payload = newButtons[index].title;
        }
        setFormData({ ...formData, buttons: newButtons });
    };

    const validateKeyword = (text: string) => {
        const kws = text.split(',').map(k => k.trim()).filter(k => k !== '');
        for (const kw of kws) {
            if (kw.split(/\s+/).length < 2) {
                return `Từ khóa "${kw}" phải có ít nhất 2 từ trở lên.`;
            }
            if (/^\d+$/.test(kw)) {
                return `Từ khóa "${kw}" không được là một con số.`;
            }
        }
        return null;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.oa_config_id) return toast.error('Vui lòng chọn OA');
        if (!formData.title) return toast.error('Vui lòng nhập tên kịch bản');
        if (formData.type !== 'ai_reply' && !formData.content) return toast.error('Vui lòng nhập nội dung tin nhắn');
        if (formData.type === 'ai_reply' && !formData.ai_chatbot_id) return toast.error('Vui lòng chọn AI Chatbot');

        if (formData.type === 'keyword') {
            if (!formData.trigger_text) return toast.error('Vui lòng nhập từ khóa kích hoạt');
            const error = validateKeyword(formData.trigger_text);
            if (error) return toast.error(error);
        }

        setLoading(true);
        try {
            const conflictRes = await axios.get(`${API_BASE_URL}/zalo_automation.php?route=check_conflicts&oa_config_id=${formData.oa_config_id}&type=${formData.type}&trigger_text=${formData.trigger_text}&id=${formData.id}`, { headers: getHeaders() });
            if (conflictRes.data.success && conflictRes.data.conflicts.length > 0) {
                toast.error(conflictRes.data.conflicts[0]);
                setLoading(false);
                return;
            }

            const payload = { ...formData };
            if (isPerDay) {
                payload.active_days = JSON.stringify(perDaySchedule);
            }

            const res = await axios.post(`${API_BASE_URL}/zalo_automation.php?route=save`, payload, { headers: getHeaders() });
            if (res.data.success) {
                toast.success('Đã lưu kịch bản');
                onSave();
            } else {
                toast.error(res.data.message || 'Lỗi khi lưu');
            }
        } catch (error) {
            toast.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
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

        const days = formData.active_days.split(',').filter(d => d !== '');
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

    const DAYS = [
        { id: '1', label: 'T2' },
        { id: '2', label: 'T3' },
        { id: '3', label: 'T4' },
        { id: '4', label: 'T5' },
        { id: '5', label: 'T6' },
        { id: '6', label: 'T7' },
        { id: '0', label: 'CN' }
    ];

    return (
        <Modal
            isOpen={animateIn}
            onClose={onClose}
            size="4xl"
            noHeader
            noPadding
        >
            <div className="bg-white w-full flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className={`p-8 border-b border-slate-50 flex justify-between items-center relative overflow-hidden`}>
                    <div className={`absolute inset-0 opacity-10 ${formData.type === 'welcome' ? 'bg-gradient-to-r from-[#BD1D2D] to-[#9A1523]' : formData.type === 'holiday' ? 'bg-gradient-to-r from-rose-500 to-red-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}></div>
                    <div className="relative z-10 flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-[14px] shadow-xl flex items-center justify-center text-white ${formData.type === 'welcome' ? 'bg-gradient-to-br from-[#BD1D2D] to-[#9A1523] shadow-[var(--color-primary)]/30' : formData.type === 'holiday' ? 'bg-gradient-to-br from-rose-500 to-red-600 shadow-rose-500/30' : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'}`}>
                            {formData.type === 'welcome' ? <Star className="w-7 h-7" /> : formData.type === 'holiday' ? <Calendar className="w-7 h-7" /> : <Zap className="w-7 h-7" />}
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                                {scenario ? 'Cập Nhật Kịch Bản' : 'Tạo Automation Mới'}
                            </h2>
                            <p className="text-sm font-medium text-slate-500">Thiết lập phản hồi và tương tác tự động</p>
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
                                        label="Chọn Zalo OA"
                                        value={formData.oa_config_id}
                                        options={oaConfigs.map(oa => ({ value: oa.id, label: oa.name }))}
                                        onChange={(val) => setFormData({ ...formData, oa_config_id: val })}
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
                                            { value: 'ai_reply', label: <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-emerald-500" /><span>AI Phản hồi</span></div> },
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
                                <Input
                                    label="Tiêu đề kịch bản (Nội bộ)"
                                    placeholder="VD: Chào mừng khách mới, Tư vấn giá..."
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>

                            {formData.type === 'ai_reply' && (
                                <div className="space-y-4 p-6 bg-emerald-50/50 rounded-[18px] border border-emerald-100 animate-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                            <Sparkles className="w-4 h-4" /> Kích hoạt Trí Tuệ Nhân Tạo (AI)
                                        </label>
                                    </div>
                                    <div className="space-y-4">
                                        <CustomSelect
                                            label="Chọn AI Chatbot"
                                            value={formData.ai_chatbot_id}
                                            options={activeChatbots.map(bot => ({
                                                value: bot.property_id,
                                                label: <div className="flex items-center gap-2"><Zap className="w-3 h-3 text-emerald-500" /><span>{bot.bot_name}</span></div>
                                            }))}
                                            onChange={(val) => setFormData({ ...formData, ai_chatbot_id: val })}
                                        />
                                        <div className="bg-white/50 p-4 rounded-[14px] border border-emerald-100 space-y-2">
                                            <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase tracking-tight">
                                                <Info className="w-3.5 h-3.5" /> Cơ chế hoạt động:
                                            </div>
                                            <ul className="text-[10px] text-slate-500 font-medium space-y-1 ml-5 list-disc leading-relaxed">
                                                <li>Hệ thống sẽ dựa trên <b>Kiến thức đã Train</b> của AI để tự động trả lời Khách hàng.</li>
                                                <li>Tự động nhận diện Website Link thành <b>Nút bấm</b>.</li>
                                                <li>Tự động nhận diện Phone Number thành <b>Nút gọi</b>.</li>
                                                <li>Tự động gửi <b>ảnh</b> nếu trong câu trả lời có chứa link ảnh hợp lệ.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {formData.type === 'keyword' && (
                                <div className="space-y-4 p-6 bg-indigo-50/50 rounded-[18px] border border-indigo-100 animate-in slide-in-from-top-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                            <MessageCircle className="w-4 h-4" /> Từ khóa kích hoạt
                                        </label>
                                        <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                                            <button
                                                onClick={() => setFormData({ ...formData, match_type: 'exact' })}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${formData.match_type === 'exact' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                            >Khớp hoàn toàn</button>
                                            <button
                                                onClick={() => setFormData({ ...formData, match_type: 'contains' })}
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${formData.match_type === 'contains' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                            >Chứa từ khóa</button>
                                        </div>
                                    </div>
                                    <Input
                                        placeholder="VD: gia bao nhieu, tu van ngay..."
                                        className="text-indigo-700"
                                        value={formData.trigger_text}
                                        onChange={(e) => setFormData({ ...formData, trigger_text: e.target.value })}
                                    />
                                    <div className="bg-white/50 p-4 rounded-[14px] border border-indigo-100 space-y-2">
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase tracking-tight">
                                            <AlertCircle className="w-3.5 h-3.5" /> Quy định từ khóa:
                                        </div>
                                        <ul className="text-[10px] text-slate-500 font-medium space-y-1 ml-5 list-disc leading-relaxed">
                                            <li>Từ khóa phải có ít nhất <b>2 từ trở lên</b> (VD: "xin chào" thay vì "hi").</li>
                                            <li>Không dùng từ khóa là <b>con số</b> (VD: "123", "090").</li>
                                            <li>Dùng dấu phẩy (`,`) để ngăn cách nhiều từ khóa.</li>
                                        </ul>
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
                                                >Toàn thời gian</button>
                                                <button
                                                    onClick={() => setFormData({ ...formData, schedule_type: 'custom' })}
                                                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black transition-all ${formData.schedule_type === 'custom' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-400'}`}
                                                >Tùy chỉnh</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Holiday Specific: Priority Override */}
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
                                                    Khi bật: Nếu đang trong giờ nghỉ, hệ thống sẽ <b>CHẶN</b> tất cả các kịch bản từ khóa khác trùng lặp. Chỉ gửi duy nhất tin nhắn nghỉ này (Tối đa 1 lần/ngày/khách).
                                                </p>
                                            </div>
                                            <div className="flex-shrink-0">
                                                <button
                                                    type="button"
                                                    role="switch"
                                                    aria-checked={formData.priority_override == 1}
                                                    onClick={() => setFormData({ ...formData, priority_override: formData.priority_override == 1 ? 0 : 1 })}
                                                    className={`
                                                            relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
                                                            transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2
                                                            ${formData.priority_override == 1 ? 'bg-rose-500' : 'bg-slate-200'}
                                                        `}
                                                >
                                                    <span
                                                        aria-hidden="true"
                                                        className={`
                                                                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                                                                transition duration-200 ease-in-out
                                                                ${formData.priority_override == 1 ? 'translate-x-5' : 'translate-x-0'}
                                                            `}
                                                    />
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

                                    {(formData.schedule_type === 'custom' || formData.schedule_type === 'daily_range') && (
                                        <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2">
                                            <div className="space-y-2">
                                                <Input
                                                    label="Từ giờ"
                                                    type="time"
                                                    value={formData.start_time}
                                                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Input
                                                    label="Đến giờ"
                                                    type="time"
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
                                                <Input
                                                    label="Bắt đầu nghỉ từ"
                                                    type="datetime-local"
                                                    value={formData.holiday_start_at || ''}
                                                    onChange={(e) => setFormData({ ...formData, holiday_start_at: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Input
                                                    label="Hoạt động vào lúc"
                                                    type="datetime-local"
                                                    value={formData.holiday_end_at || ''}
                                                    onChange={(e) => setFormData({ ...formData, holiday_end_at: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Active Days (Hide for Holiday Date Range) */}
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
                                                                    // Initialize from current daily
                                                                    const initial: any = {};
                                                                    formData.active_days.split(',').forEach(d => {
                                                                        if (d) initial[d] = { start: formData.start_time, end: formData.end_time };
                                                                    });
                                                                    setPerDaySchedule(initial);
                                                                }
                                                            }}
                                                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:ring-offset-1 ${isPerDay ? 'bg-indigo-500' : 'bg-slate-300'}`}
                                                        >
                                                            <span aria-hidden="true" className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isPerDay ? 'translate-x-4' : 'translate-x-0'}`} />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                {DAYS.map(day => {
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
                                        <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                            <Smile className="w-4 h-4 text-emerald-500" /> Nội dung phản hồi (Output)
                                        </h3>
                                        {formData.type === 'welcome' && (
                                            <span className="px-3 py-1 bg-amber-50 text-[var(--color-primary)] rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-100">Chỉ gửi 1 tin</span>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <textarea
                                            placeholder="Nhập nội dung tin nhắn phản hồi..."
                                            rows={5}
                                            className="w-full p-5 bg-slate-50 border-2 border-transparent focus:bg-white focus:border-emerald-500/10 rounded-[18px] text-sm font-medium transition-all outline-none resize-none shadow-inner"
                                            value={formData.content}
                                            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                        ></textarea>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Hình ảnh đính kèm</label>
                                                {formData.image_url && (
                                                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, image_url: '', attachment_id: '', message_type: 'text' }))} className="text-[10px] text-rose-500 hover:underline font-bold">Xóa ảnh</button>
                                                )}
                                            </div>

                                            {formData.image_url ? (
                                                <div className="relative rounded-[14px] overflow-hidden border border-slate-200 group">
                                                    <img src={formData.image_url} alt="Uploaded" className="w-full h-48 object-cover" />
                                                    <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <label className="cursor-pointer bg-white text-slate-800 px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:scale-105 transition-transform flex items-center gap-2">
                                                            <ImageIcon className="w-4 h-4" /> Thay đổi
                                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                                        </label>
                                                    </div>
                                                </div>
                                            ) : (
                                                <label className={`block w-full border-2 border-dashed border-slate-200 rounded-[14px] p-8 hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                                    <div className="flex flex-col items-center justify-center gap-3">
                                                        <div className="w-12 h-12 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                                                            {uploading ? <div className="w-5 h-5 border-2 border-slate-200 border-t-blue-500 rounded-full animate-spin" /> : <UploadCloud className="w-6 h-6" />}
                                                        </div>
                                                        <div className="text-center">
                                                            <p className="text-xs font-bold text-slate-600">Click để tải ảnh lên</p>
                                                            <p className="text-[10px] text-slate-400 mt-1">JPEG, PNG, JPG (Max 5MB)</p>
                                                        </div>
                                                    </div>
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                                </label>
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
                                        <span className="text-[10px] font-bold text-slate-400">{formData.buttons.length}/4 nút</span>
                                    </div>

                                    <div className="space-y-3">
                                        {formData.buttons.map((btn: any, idx: number) => (
                                            <div key={idx} className="bg-white p-4 rounded-[14px] border border-slate-100 shadow-sm animate-in slide-in-from-left-4 duration-300 group">
                                                <div className="space-y-3">
                                                    {/* Row 1: Type, Title, Delete */}
                                                    <div className="flex gap-3 items-start">
                                                        <div className="w-[60px] space-y-1 flex-shrink-0">
                                                            <CustomSelect
                                                                label="Loại"
                                                                value={btn.type}
                                                                options={[
                                                                    { value: 'oa.open.url', label: <div className="flex justify-center w-full"><Link className="w-4 h-4" /></div> },
                                                                    { value: 'oa.query.show', label: <div className="flex justify-center w-full"><MessageCircle className="w-4 h-4" /></div> },
                                                                    { value: 'oa.open.phone', label: <div className="flex justify-center w-full"><Phone className="w-4 h-4" /></div> }
                                                                ]}
                                                                onChange={(val) => handleButtonChange(idx, 'type', val)}
                                                            />
                                                        </div>
                                                        <div className="flex-1 space-y-1">
                                                            <Input
                                                                label="Tên nút"
                                                                placeholder="Nhập tên nút..."
                                                                value={btn.title}
                                                                onChange={(e) => handleButtonChange(idx, 'title', e.target.value)}
                                                            />
                                                        </div>
                                                        <button onClick={() => handleRemoveButton(idx)} className="mt-6 p-2.5 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-100 transition-colors">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>

                                                    {/* Row 2: Payload (Only if not query.show) */}
                                                    {btn.type !== 'oa.query.show' && (
                                                        <div className="space-y-1 animate-in slide-in-from-top-1">
                                                            <Input
                                                                label={btn.type === 'oa.open.url' ? 'Đường dẫn (URL)' : 'Số điện thoại'}
                                                                placeholder={btn.type === 'oa.open.url' ? "https://..." : "849..."}
                                                                value={btn.payload || ''}
                                                                onChange={(e) => handleButtonChange(idx, 'payload', e.target.value)}
                                                                icon={btn.type === 'oa.open.url' ? Link : Phone}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                {/* Nested Scenario Auto-Configuration */}
                                                {btn.type === 'oa.query.show' && (
                                                    <div className="mt-3 bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 space-y-2">
                                                        <div
                                                            className="flex items-center justify-between cursor-pointer"
                                                            onClick={() => {
                                                                const newButtons = [...formData.buttons];
                                                                newButtons[idx].show_response_config = !newButtons[idx].show_response_config;
                                                                setFormData({ ...formData, buttons: newButtons });
                                                            }}
                                                        >
                                                            <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest flex items-center gap-1.5">
                                                                <MessageCircle className="w-3.5 h-3.5" /> Thiết lập tin nhắn phản hồi
                                                            </label>
                                                            {btn.show_response_config ? <ChevronUp className="w-3.5 h-3.5 text-indigo-400" /> : <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />}
                                                        </div>

                                                        {btn.show_response_config && (
                                                            <div className="animate-in slide-in-from-top-2 space-y-2 pt-2">
                                                                <p className="text-[10px] text-slate-500 italic">
                                                                    Tin nhắn phản hồi nhanh khi khách bấm nhận "<strong>{btn.payload || '...'}</strong>". Nếu muốn thêm nút bấm và hình ảnh xin hãy tạo thêm kịch bản mới.
                                                                </p>
                                                                <textarea
                                                                    placeholder="Nhập câu trả lời..."
                                                                    rows={3}
                                                                    className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-500 transition-all"
                                                                    value={btn.auto_response || ''}
                                                                    onChange={(e) => handleButtonChange(idx, 'auto_response', e.target.value)}
                                                                ></textarea>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}

                                        <button
                                            onClick={handleAddButton}
                                            disabled={formData.buttons.length >= 4}
                                            className="w-full py-4 border-2 border-dashed border-slate-200 rounded-[14px] text-slate-400 hover:border-blue-400 hover:bg-blue-50/30 hover:text-blue-500 transition-all font-bold text-xs flex items-center justify-center gap-2 group"
                                        >
                                            <div className="w-6 h-6 bg-slate-50 rounded-lg flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-all">
                                                <Plus className="w-4 h-4" />
                                            </div>
                                            Thêm nút bấm mới
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Preview Column */}
                        <div className="lg:w-5/12 p-8 bg-white border-l border-slate-100 hidden lg:block">
                            <div className="sticky top-0 flex flex-col justify-center items-center pt-4">
                                <div className="relative w-[320px] h-[640px] bg-slate-900 rounded-[18px] border-[8px] border-slate-800 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-7 bg-slate-800 rounded-b-[18px] z-20"></div>

                                    {/* Zalo Header Mockup */}
                                    <div className="bg-blue-600 px-4 pt-10 pb-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-white/20"></div>
                                            <div className="w-24 h-3 bg-white/30 rounded-full"></div>
                                        </div>
                                    </div>

                                    <div className="flex-1 bg-slate-100 p-4 space-y-4 overflow-y-auto custom-scrollbar">
                                        <div className="flex items-start gap-2 animate-in slide-in-from-left-4">
                                            <div className="w-8 h-8 rounded-full bg-blue-500 shadow-sm flex items-center justify-center text-white text-[10px] font-bold shrink-0">OA</div>
                                            <div className="bg-white rounded-[14px] rounded-tl-none shadow-sm overflow-hidden flex flex-col max-w-[85%]">
                                                {formData.image_url && (
                                                    <img src={formData.image_url} alt="Preview" className="w-full h-auto" />
                                                )}
                                                <div className="p-3 space-y-2">
                                                    <p className="text-[11px] text-slate-700 whitespace-pre-wrap leading-relaxed">{formData.content || 'Nhập nội dung để xem trước...'}</p>
                                                </div>
                                                {formData.buttons.length > 0 && (
                                                    <div className="border-t border-slate-50">
                                                        {formData.buttons.map((btn: any, i: number) => (
                                                            <div key={i} className="py-2.5 text-center border-t border-slate-50 first:border-t-0">
                                                                <span className="text-[11px] font-bold text-blue-600">{btn.title || 'Nút bấm'}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Zalo Bottom Bar Mockup */}
                                    <div className="bg-white p-3 border-t border-slate-200">
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-9 bg-slate-100 rounded-xl px-3 flex items-center">
                                                <div className="w-24 h-3 bg-slate-200 rounded-full"></div>
                                            </div>
                                            <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white"><Zap className="w-4 h-4" /></div>
                                        </div>
                                    </div>
                                </div>
                                <p className="mt-8 text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Bot className="w-4 h-4" /> Mobile Preview Simulator
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions - sticky at bottom */}
                <div className="px-8 py-5 bg-white border-t border-slate-100 flex justify-end gap-3 shrink-0 sticky bottom-0 z-10">
                    <button
                        onClick={onClose}
                        className="px-8 py-3.5 rounded-[14px] text-xs font-black text-slate-500 hover:bg-slate-50 active:scale-95 transition-all"
                    >Hủy bỏ</button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-10 py-3.5 bg-slate-900 hover:bg-black text-white rounded-[14px] text-xs font-black shadow-xl shadow-slate-200 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {scenario ? 'Cập nhật kịch bản' : 'Kích hoạt ngay'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

export default ScenarioModal;
