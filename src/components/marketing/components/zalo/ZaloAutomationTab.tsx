import * as React from 'react';
import { useState, useEffect } from 'react';
import { Plus, MessageSquare, Star, Zap, Trash2, Edit2, Play, Pause, Search, BarChart, Info, CreditCard, AlertOctagon, Check, Calendar, Bot, ChevronDown } from 'lucide-react';
import ScenarioModal from './ScenarioModal.tsx';
import AutomationStatsModal from './AutomationStatsModal.tsx';
import ConfirmModal from '../common/ConfirmModal.tsx';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import Input from '../common/Input';
import TabTransition from '../common/TabTransition';
import { EmptyState } from '../common/EmptyState';
import Skeleton from '../common/Skeleton';
import { API_BASE_URL } from '../../utils/config';

interface Scenario {
    id: string;
    oa_config_id: string;
    type: 'welcome' | 'keyword' | 'ai_reply' | 'holiday';
    trigger_text: string;
    title: string;
    content: string;
    message_type: 'text' | 'image';
    image_url: string;
    attachment_id: string;
    buttons: any[];
    status: 'active' | 'inactive';
    ai_chatbot_id?: string;
    ai_bot_name?: string;
}

const ZaloAutomationTab: React.FC = () => {
    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingScenario, setEditingScenario] = useState<Scenario | null>(null);
    const [viewingStatsScenario, setViewingStatsScenario] = useState<Scenario | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean; title: string; message: string; onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const [oaConfigs, setOaConfigs] = useState<any[]>([]);
    const [selectedOAId, setSelectedOAId] = useState<string>('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        fetchOAs();
    }, []);

    useEffect(() => {
        if (selectedOAId) {
            fetchScenarios();
        }
    }, [selectedOAId]);

    const fetchOAs = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/zalo_oa.php`);
            if (res.data.success && res.data.data.length > 0) {
                setOaConfigs(res.data.data);
                setSelectedOAId(res.data.data[0].id);
            }
        } catch (error) {
            console.error('Error fetching OAs:', error);
        }
    };

    const fetchScenarios = async () => {
        if (!selectedOAId) return;
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/zalo_automation.php?route=list&oa_config_id=${selectedOAId}`);
            if (res.data.success) {
                setScenarios(res.data.data);
            }
        } catch (error) {
            console.error('Fetch error:', error);
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
                    await axios.delete(`${API_BASE_URL}/zalo_automation.php?route=delete&id=${id}`);
                    toast.success('Đã xóa kịch bản');
                    fetchScenarios();
                } catch (error) {
                    toast.error('Lỗi khi xóa');
                }
            }
        });
    };

    const toggleStatus = async (scenario: Scenario) => {
        const newStatus = scenario.status === 'active' ? 'inactive' : 'active';
        try {
            await axios.post(`${API_BASE_URL}/zalo_automation.php?route=save`, {
                ...scenario,
                status: newStatus
            });
            toast.success(`Đã ${newStatus === 'active' ? 'kích hoạt' : 'tạm dừng'}`);
            fetchScenarios();
        } catch (error) {
            toast.error('Lỗi khi cập nhật Trạng thái');
        }
    };

    const filteredScenarios = scenarios.filter(s =>
        (s.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.trigger_text || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedOA = oaConfigs.find(oa => oa.id === selectedOAId);

    return (
        <TabTransition className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-[14px] border border-slate-100 shadow-sm relative z-20">

                {/* OA Dropdown Selector */}
                <div className="relative w-full md:w-72">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="w-full h-9 flex items-center justify-between bg-slate-50 border border-slate-200 text-slate-700 text-sm rounded-[var(--radius-md)] px-3 py-2 font-medium hover:bg-slate-100 transition-colors"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            {selectedOA?.avatar ? (
                                <img src={selectedOA.avatar} alt="" className="w-5 h-5 rounded-full object-cover border border-slate-200 shrink-0" />
                            ) : (
                                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] shrink-0 font-bold">
                                    {selectedOA?.name?.charAt(0) || 'O'}
                                </div>
                            )}
                            <span className="truncate max-w-[170px] text-xs font-semibold">{selectedOA?.name || 'Chọn OA'}</span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setIsDropdownOpen(false)}></div>
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl z-20 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
                                    {oaConfigs.map(oa => (
                                        <button
                                            key={oa.id}
                                            onClick={() => {
                                                setSelectedOAId(oa.id);
                                                setIsDropdownOpen(false);
                                            }}
                                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedOAId === oa.id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                }`}
                                        >
                                            {oa.avatar ? (
                                                <img src={oa.avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs border border-slate-200">{oa.name.charAt(0)}</div>
                                            )}
                                            <div className="text-left">
                                                <div className="font-bold truncate">{oa.name}</div>
                                            </div>
                                            {selectedOAId === oa.id && <div className="ml-auto w-2 h-2 rounded-full bg-blue-500"></div>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex items-center gap-4 flex-1 w-full max-w-md">
                    <Input
                        placeholder="Tìm kiếm kịch bản..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        icon={Search}
                        fullWidth
                    />
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setEditingScenario(null); setIsModalOpen(true); }}
                        disabled={!selectedOAId}
                        className="h-9 px-4 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white shadow-xs rounded-[var(--radius-md)] text-xs font-semibold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 w-full md:w-auto disabled:opacity-50 disabled:shadow-none cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        Tạo kịch bản
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="p-6 bg-white rounded-[18px] border border-slate-100 shadow-sm space-y-4">
                            <div className="flex justify-between items-start">
                                <Skeleton variant="rounded" width={48} height={48} className="rounded-[14px]" />
                                <Skeleton variant="rounded" width={60} height={28} />
                            </div>
                            <Skeleton variant="text" width="70%" height={20} />
                            <Skeleton variant="text" width="100%" height={14} />
                            <Skeleton variant="text" width="90%" height={14} />
                        </div>
                    ))}
                </div>
            ) : filteredScenarios.length === 0 ? (
                <div className="bg-white rounded-[18px] border border-slate-100 shadow-sm">
                    <EmptyState
                        icon={Zap}
                        title="Chưa có kịch bản nào"
                        description="Bắt đầu thiết lập kịch bản chăm sóc hoặc phản hồi tự động cho tài khoản Zalo OA của bạn."
                        ctaLabel="Tạo kịch bản"
                        onCtaClick={() => setIsModalOpen(true)}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredScenarios.map((scenario) => (
                        <div key={scenario.id} className="group bg-white rounded-[18px] border border-slate-100 shadow-sm hover:shadow-md hover:border-[var(--color-primary-light)] transition-all p-6 relative overflow-hidden cursor-pointer hover:-translate-y-0.5" onClick={() => { setEditingScenario(scenario); setIsModalOpen(true); }}>
                            <div className={`absolute top-0 right-0 w-40 h-40 -mr-12 -mt-12 rounded-full opacity-[0.03] transition-transform group-hover:scale-125 ${scenario.type === 'welcome' ? 'bg-[var(--color-primary)]' :
                                scenario.type === 'ai_reply' ? 'bg-purple-500' :
                                    scenario.type === 'holiday' ? 'bg-rose-500' :
                                        'bg-blue-500'}`}></div>

                            <div className="flex justify-between items-start mb-6 relative z-10">
                                <div className={`p-3.5 rounded-[14px] shadow-sm ${scenario.type === 'welcome' ? 'bg-gradient-to-br from-[#BD1D2D] to-[#9A1523] text-white shadow-[var(--color-primary)]/20' :
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
                                        onClick={() => setViewingStatsScenario(scenario)}
                                        className="p-2.5 bg-blue-50 text-blue-500 hover:bg-blue-100 rounded-xl transition-all flex items-center justify-center"
                                        title="Báo cáo hiệu quả"
                                    >
                                        <BarChart className="w-4 h-4" />
                                    </button>
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
                                    <span className={`text-[9px] font-black px-2.5 py-1 rounded-lg uppercase tracking-widest border ${scenario.type === 'welcome' ? 'bg-amber-50 text-[var(--color-primary)] border-amber-100' :
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

            {isModalOpen && (
                <ScenarioModal
                    scenario={editingScenario}
                    onClose={() => setIsModalOpen(false)}
                    onSave={() => { setIsModalOpen(false); fetchScenarios(); }}
                />
            )}

            {viewingStatsScenario && (
                <AutomationStatsModal
                    scenario={viewingStatsScenario}
                    onClose={() => setViewingStatsScenario(null)}
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
        </TabTransition>
    );
};

export default ZaloAutomationTab;
