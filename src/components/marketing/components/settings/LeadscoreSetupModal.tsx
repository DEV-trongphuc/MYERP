import React, { useState, useEffect } from 'react';
import { X, Target, Mail, MousePointerClick, FileText, Globe, MessageSquare, Bot, Save, AlertCircle, ShoppingBag, Zap } from 'lucide-react';
import { api } from '../../services/storageAdapter';
import toast from 'react-hot-toast';

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export const LeadscoreSetupModal: React.FC<Props> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [scores, setScores] = useState({
        leadscore_email_open: 2,
        leadscore_email_click: 5,
        leadscore_form_submit: 10,
        leadscore_web_visit: 1,
        leadscore_zalo_interact: 3,
        leadscore_ai_chat: 5,
        leadscore_purchase: 10,
        leadscore_custom_event: 5
    });

    useEffect(() => {
        if (isOpen) {
            fetchSettings();
        }
    }, [isOpen]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await api.get<any>('settings');
            if (res.success && res.data) {
                const settings = res.data;
                setScores({
                    leadscore_email_open: parseInt(settings.leadscore_email_open) || 2,
                    leadscore_email_click: parseInt(settings.leadscore_email_click) || 5,
                    leadscore_form_submit: parseInt(settings.leadscore_form_submit) || 10,
                    leadscore_web_visit: parseInt(settings.leadscore_web_visit) || 1,
                    leadscore_zalo_interact: parseInt(settings.leadscore_zalo_interact) || 3,
                    leadscore_ai_chat: parseInt(settings.leadscore_ai_chat) || 5,
                    leadscore_purchase: parseInt(settings.leadscore_purchase) || 10,
                    leadscore_custom_event: parseInt(settings.leadscore_custom_event) || 5
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await api.post('settings', scores);
            if (res.success) {
                toast.success('Lưu cấu hình Leadscore thành công!');
                onClose();
            } else {
                toast.error(res.message || 'Lỗi khi lưu cấu hình.');
            }
        } catch (error) {
            toast.error('Lỗi kết nối khi lưu cấu hình.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    const scoringRules = [
        { key: 'leadscore_email_open', label: 'Mở Email', description: 'Cộng điểm khi Khách hàng mở email', icon: Mail, color: 'text-white', bg: 'bg-gradient-to-tr from-cyan-500 to-blue-500 shadow-lg shadow-blue-500/30' },
        { key: 'leadscore_email_click', label: 'Click Link Email', description: 'Cộng điểm khi click link trong email', icon: MousePointerClick, color: 'text-white', bg: 'bg-gradient-to-tr from-blue-500 to-purple-500 shadow-lg shadow-purple-500/30' },
        { key: 'leadscore_form_submit', label: 'Điền Form', description: 'Cộng điểm khi hoàn tất gửi Form đăng ký', icon: FileText, color: 'text-white', bg: 'bg-gradient-to-tr from-emerald-500 to-teal-400 shadow-lg shadow-emerald-500/30' },
        { key: 'leadscore_web_visit', label: 'Truy cập Website', description: 'Cộng điểm tự động khi truy cập (đã định danh)', icon: Globe, color: 'text-white', bg: 'bg-gradient-to-tr from-sky-400 to-blue-600 shadow-lg shadow-blue-500/30' },
        { key: 'leadscore_zalo_interact', label: 'Tương tác Zalo', description: 'Cộng điểm khi khách hàng chat/quan tâm Zalo OA', icon: MessageSquare, color: 'text-white', bg: 'bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-lg shadow-indigo-500/30' },
        { key: 'leadscore_ai_chat', label: 'Tương tác AI Chat', description: 'Cộng điểm khi gửi tin nhắn cho AI Chatbot', icon: Bot, color: 'text-white', bg: 'bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-500/30' },
        { key: 'leadscore_purchase', label: 'Sự kiện Mua Hàng', description: 'Cộng điểm khi khách hàng mua hàng (Purchase)', icon: ShoppingBag, color: 'text-white', bg: 'bg-gradient-to-tr from-pink-500 to-rose-500 shadow-lg shadow-rose-500/30' },
        { key: 'leadscore_custom_event', label: 'Sự kiện Tùy Chỉnh', description: 'Cộng điểm khi có thao tác API Custom Event', icon: Zap, color: 'text-white', bg: 'bg-gradient-to-tr from-fuchsia-500 to-pink-500 shadow-lg shadow-pink-500/30' },
    ];

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-blue-600 to-indigo-600" />
                    <div className="flex items-center gap-3 relative z-10">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <Target className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 tracking-tight">CẤU HÌNH LEADSCORE</h2>
                            <p className="text-xs text-slate-500 font-medium">Thiết lập điểm ưu tiên cho từng hành vi tương tác</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 rounded-full transition-colors relative z-10">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-sm font-medium text-amber-800/80">
                            <strong>Lưu ý:</strong> Điểm Leadscore giúp hệ thống tự động phân loại Khách hàng tiềm năng (Hot/Warm/Cold). 
                            Tất cả tính năng cộng điểm trong DOMATION (Email, API, Web, Zalo...) sẽ tự động tham chiếu theo bảng điểm này.
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {scoringRules.map((rule) => (
                                <div key={rule.key} className="flex items-center p-4 border border-slate-200 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all group">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${rule.bg}`}>
                                        <rule.icon className={`w-6 h-6 ${rule.color}`} />
                                    </div>
                                    <div className="ml-4 flex-1">
                                        <h4 className="text-sm font-bold text-slate-800">{rule.label}</h4>
                                        <p className="text-xs text-slate-500 leading-snug tracking-tight mt-0.5 pr-2">{rule.description}</p>
                                    </div>
                                    <div className="flex-shrink-0 relative">
                                        <input
                                            type="number"
                                            value={(scores as any)[rule.key]}
                                            onChange={(e) => setScores({ ...scores, [rule.key]: parseInt(e.target.value) || 0 })}
                                            className="w-16 h-10 text-center font-black text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
                                        />
                                        <div className="absolute -top-2 -right-2 bg-blue-100 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-md border border-blue-200">
                                            Pts
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-200/50 transition-colors"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-750 shadow-lg shadow-blue-500/30 transition-all disabled:opacity-50"
                    >
                        {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> : <Save className="w-4 h-4" />}
                        Lưu Thay Đổi
                    </button>
                </div>
            </div>
        </div>
    );
};
