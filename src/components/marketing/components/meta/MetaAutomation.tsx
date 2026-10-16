import * as React from 'react';
import { useState, useEffect } from 'react';
import { Plus, MessageSquare, Star, Zap, Trash2, Edit2, Play, Pause, Search, BarChart, Info, Bot, Calendar, ChevronDown } from 'lucide-react';
import MetaScenarioModal from './MetaScenarioModal';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import ConfirmModal from '../common/ConfirmModal';
import { API_BASE_URL } from '../../utils/config';

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.port !== '';


// Helper to get headers
const getHeaders = () => {
    const token = localStorage.getItem('ai_space_access_token') || localStorage.getItem('access_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
};

interface MetaScenario {
    id: string;
    meta_config_id: string;
    type: 'welcome' | 'keyword' | 'ai_reply' | 'holiday';
    trigger_text: string;
    title: string;
    content: string;
    message_type: 'text' | 'image' | 'video';
    image_url: string;
    attachment_id?: string;
    buttons: any[];
    status: 'active' | 'inactive';
    ai_chatbot_id?: string;
    ai_bot_name?: string;
    schedule_type: 'full' | 'custom' | 'daily_range' | 'date_range';
    start_time: string;
    end_time: string;
    active_days: string;
    priority_override?: number;
    holiday_start_at?: string;
    holiday_end_at?: string;
}

interface MetaConfig {
    id: string;
    page_name: string;
    avatar_url?: string;
}

const MetaAutomation: React.FC = () => {
    const [scenarios, setScenarios] = useState<MetaScenario[]>([]);
    const [configs, setConfigs] = useState<MetaConfig[]>([]);
    const [selectedConfigId, setSelectedConfigId] = useState<string>('');

    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingScenario, setEditingScenario] = useState<MetaScenario | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean; title: string; message: string; onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    useEffect(() => {
        fetchConfigs();
    }, []);

    useEffect(() => {
        if (selectedConfigId) {
            fetchScenarios(selectedConfigId);
        }
    }, [selectedConfigId]);

    const fetchConfigs = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/meta_config.php`);
            if (res.data.success && res.data.data.length > 0) {
                setConfigs(res.data.data);
                setSelectedConfigId(res.data.data[0].id); // Select first by default
            } else {
                setLoading(false); // No configs
            }
        } catch (error) {
            console.error(error);
            setLoading(false);
        }
    };

    const fetchScenarios = async (configId: string) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/meta_automation.php?route=list&meta_config_id=${configId}`);
            if (res.data.success) {
                setScenarios(res.data.data);
            }
        } catch (error) {
            toast.error('Lỗi tải kịch bản');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: 'Xóa kịch bản?',
            message: 'Bạn có chắc chắn muốn xóa kịch bản này? Hành động này không thể hoàn tác.',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, isOpen: false }));
                try {
                    await axios.delete(`${API_BASE_URL}/meta_automation.php?route=delete&id=${id}`);
                    toast.success('Đã xóa kịch bản');
                    fetchScenarios(selectedConfigId);
                } catch (error) {
                    toast.error('Lỗi khi xóa');
                }
            }
        });
    };

    const toggleStatus = async (scenario: MetaScenario) => {
        const newStatus = scenario.status === 'active' ? 'inactive' : 'active';
        try {
            await axios.post(`${API_BASE_URL}/meta_automation.php?route=save`, {
                ...scenario,
                status: newStatus
            });
            toast.success(`Đã ${newStatus === 'active' ? 'kích hoạt' : 'tạm dừng'}`);
            fetchScenarios(selectedConfigId);
        } catch (error) {
            toast.error('Lỗi khi cập nhật Trạng thái');
        }
    };

    // Helper for Modal Save (Adapting Zalo Scenario Modal if needed)
    // For now we assume we use a similar modal or custom one.
    // If Zalo Scenario Modal is strictly for Zalo, we might need to duplicate it or make it generic.
    // Given the previous task instructions, I will reuse ScenarioModal if possible, 
    // BUT I need to pass `oa_config_id` prop which matches `meta_config_id`.
    // Let's assume ScenarioModal is flexible or we wrapper it.
    // Actually, creating a specific MetaScenarioModal might be safer to avoid Prop mess.
    // For brevity, I will implement a simplified modal trigger here or reuse logic.

    // To properly support "Save", I need to handle the API endpoint inside the Modal or pass a handler.
    // If reusing Zalo's ScenarioModal, it likely calls Zalo API hardcoded.
    // So I MUST Create a wrapper or new Modal component for Meta.
    // I will use a placeholder UI for now and suggest "Creating New" opens a modal.

    // NOTE: Since I cannot see ScenarioModal code in this turn (and previous turn showed `Zalo/ScenarioModal.tsx` handles saving internally via axios probably), 
    // I should create a `MetaScenarioModal` to ensure it hits `meta_automation.php`.

    const handleSaveScenario = async (data: any) => {
        try {
            const payload = {
                meta_config_id: selectedConfigId,
                ...data
            };
            const res = await axios.post(`${API_BASE_URL}/meta_automation.php?route=save`, payload);
            if (res.data.success) {
                toast.success('Lưu kịch bản thành công');
                setIsModalOpen(false);
                fetchScenarios(selectedConfigId);
            } else {
                toast.error(res.data.message || 'Lỗi lưu');
            }
        } catch (err) {
            toast.error('Lỗi hệ thống');
        }
    };

    const filteredScenarios = scenarios.filter(s =>
        s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.trigger_text && s.trigger_text.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    const selectedConfig = configs.find(c => c.id === selectedConfigId);

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm relative z-20">

                {/* Custom Page Selector with Avatar */}
                <div className="relative w-full md:w-72">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full flex items-center justify-between bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-xl px-4 py-2.5 font-bold hover:bg-slate-100 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <div className="relative w-6 h-6 rounded-full overflow-hidden border border-[#ffe8cc] bg-[#fff4e0] flex items-center justify-center text-[#2563eb] font-black text-[10px] shrink-0">
                                {selectedConfig?.page_name ? selectedConfig.page_name.charAt(0) : 'P'}
                                {selectedConfig?.avatar_url && (
                                    <img 
                                        src={selectedConfig.avatar_url} 
                                        alt="" 
                                        className="absolute inset-0 w-full h-full object-cover bg-white" 
                                        onError={(e) => {
                                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                                        }}
                                    />
                                )}
                            </div>
                            <span className="truncate max-w-[160px]">{selectedConfig?.page_name || 'Chọn Fanpage'}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                        <>
                            <div
                                className="fixed inset-0 z-10"
                                onClick={() => setIsDropdownOpen(false)}
                            ></div>
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
                                    {configs.length > 0 ? configs.map(c => (
                                        <button
                                            key={c.id}
                                            onClick={() => {
                                                setSelectedConfigId(c.id);
                                                setIsDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedConfigId === c.id
                                                ? 'bg-blue-50 text-blue-600'
                                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                }`}
                                        >
                                            <div className="relative w-8 h-8 rounded-full overflow-hidden border border-[#ffe8cc] bg-[#fff4e0] flex items-center justify-center text-[#2563eb] font-black text-xs shrink-0">
                                                {c.page_name ? c.page_name.charAt(0) : 'F'}
                                                {c.avatar_url && (
                                                    <img 
                                                        src={c.avatar_url} 
                                                        alt="" 
                                                        className="absolute inset-0 w-full h-full object-cover bg-white" 
                                                        onError={(e) => {
                                                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            <div className="text-left">
                                                <div className="font-bold truncate">{c.page_name}</div>
                                                <div className="text-[10px] text-slate-400">ID: {c.id.substring(0, 8)}...</div>
                                            </div>
                                            {selectedConfigId === c.id && (
                                                <div className="ml-auto w-2 h-2 rounded-full bg-blue-500"></div>
                                            )}
                                        </button>
                                    )) : (
                                        <div className="text-center py-4 text-slate-400 text-xs">
                                            Chưa có Fanpage nào
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-4 flex-1 w-full md:max-w-md">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm kịch bản..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 ring-emerald-500/20 transition-all font-medium placeholder:font-normal"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <button
                        onClick={() => { setEditingScenario(null); setIsModalOpen(true); }}
                        disabled={!selectedConfigId}
                        className="h-11 px-6 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shrink-0 w-full md:w-auto disabled:opacity-50 disabled:shadow-none hover:-translate-y-0.5"
                    >
                        <Plus className="w-4 h-4" />
                        Tạo kịch bản
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                </div>
            ) : filteredScenarios.length === 0 ? (
                <div className="text-center py-20 bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-200">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 text-slate-300">
                        <Zap className="w-8 h-8" />
                    </div>
                    <p className="text-slate-500 font-medium">Chưa có kịch bản nào cho Page này</p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        disabled={!selectedConfigId}
                        className="mt-4 text-emerald-500 font-bold hover:underline disabled:opacity-50"
                    >
                        Bắt đầu tạo kịch bản đầu tiên
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredScenarios.map((scenario) => (
                        <div key={scenario.id} className="group bg-white rounded-[28px] border border-slate-100 shadow-sm hover:shadow-xl transition-all p-6 relative overflow-hidden cursor-pointer hover:-translate-y-1" onClick={() => { setEditingScenario(scenario); setIsModalOpen(true); }}>
                            <div className={`absolute top-0 right-0 w-40 h-40 -mr-12 -mt-12 rounded-full opacity-[0.03] transition-transform group-hover:scale-125 ${scenario.type === 'welcome' ? 'bg-amber-600' :
                                scenario.type === 'ai_reply' ? 'bg-purple-500' :
                                    scenario.type === 'holiday' ? 'bg-rose-500' :
                                        'bg-blue-500'}`}></div>

                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div className={`p-3.5 rounded-2xl shadow-sm ${scenario.type === 'welcome' ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-orange-500/20' :
                                    scenario.type === 'ai_reply' ? 'bg-gradient-to-br from-fuchsia-500 to-purple-600 text-white shadow-purple-500/20' :
                                        scenario.type === 'holiday' ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-rose-500/20' :
                                            'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/20'}`}>
                                    {scenario.type === 'welcome' ? <Star className="w-6 h-6" /> :
                                        scenario.type === 'ai_reply' ? <Bot className="w-6 h-6" /> :
                                            scenario.type === 'holiday' ? <Calendar className="w-6 h-6" /> :
                                                <Zap className="w-6 h-6" />}
                                </div>
                                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => toggleStatus(scenario)}
                                        className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${scenario.status === 'active' ? 'bg-emerald-50 text-emerald-500 hover:bg-emerald-100' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                        title={scenario.status === 'active' ? 'Dừng' : 'Kích hoạt'}
                                    >
                                        <Play className={`w-4 h-4 ${scenario.status === 'active' ? 'hidden' : ''}`} />
                                        <Pause className={`w-4 h-4 ${scenario.status === 'active' ? '' : 'hidden'}`} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(scenario.id)}
                                        className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all flex items-center justify-center"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="relative z-10 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border ${scenario.type === 'welcome' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                        scenario.type === 'ai_reply' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                            scenario.type === 'holiday' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                'bg-blue-50 text-blue-600 border-blue-100'}`}>
                                        {scenario.type === 'welcome' ? 'Chào mừng' :
                                            scenario.type === 'ai_reply' ? 'AI Phản hồi' :
                                                scenario.type === 'holiday' ? 'Ngày nghỉ' :
                                                    'Từ khóa'}
                                    </span>
                                    {scenario.status === 'inactive' && (
                                        <span className="text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest bg-slate-100 text-slate-500 border border-slate-200">
                                            Tạm dừng
                                        </span>
                                    )}
                                </div>

                                <div>
                                    <h3 className="text-lg font-black text-slate-800 group-hover:text-blue-600 transition-colors line-clamp-1 mb-1">{scenario.title}</h3>
                                    {scenario.type === 'keyword' && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                                            <MessageSquare className="w-3.5 h-3.5" />
                                            <span>Keywords: </span>
                                            <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">{scenario.trigger_text ? scenario.trigger_text.split(',')[0] : ''}...</span>
                                        </div>
                                    )}
                                    {scenario.type === 'ai_reply' && (
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2">
                                            <Bot className="w-3.5 h-3.5 text-purple-500" />
                                            <span>Chatbot: </span>
                                            <span className="font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[11px]">{scenario.ai_bot_name || 'Hệ thống'}</span>
                                        </div>
                                    )}
                                    <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed h-10 font-medium">
                                        {scenario.type === 'ai_reply' ? 'Tự động phản hồi dựa trên kiến thức được đào tạo của AI Chatbot.' : scenario.content}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Reuse Zalo Scenario Modal but we need to adapt it, 
                ideally we should have separate MetaScenarioModal to map fields correctly.
                For now, creating a temporary placeholder for the Modal Logic 
                as I cannot fully replicate the Zalo modal in this single turn without seeing it fully.
                I'll assume `ScenarioModal` accepts `scenario` and `onSave` which returns the data object.
            */}
            {isModalOpen && (
                <MetaScenarioModal
                    scenario={editingScenario}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveScenario}
                    metaConfigId={selectedConfigId}
                />
            )}

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant="danger"
            />
        </div>
    );
};

export default MetaAutomation;
