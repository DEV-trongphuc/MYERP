import { API_BASE_URL } from '../../utils/config';

import React, { useState, useEffect } from 'react';
import {
    Zap, Plus, Code2, Trash2, Edit3,
    Terminal, FileCode, Check, Copy, CheckCircle2, Info, Plug, Bell, BellRing, Power
} from 'lucide-react';
import { api } from '../../services/storageAdapter';
import { CustomEvent } from '../../types';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Input from '../common/Input';
import toast from 'react-hot-toast';
import ConfirmModal from '../common/ConfirmModal';

const CustomEventsTab: React.FC = () => {
    const [events, setEvents] = useState<CustomEvent[]>([]);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEventId, setEditingEventId] = useState<string | null>(null);
    const [eventName, setEventName] = useState('');
    const [notificationEnabled, setNotificationEnabled] = useState(false);
    const [notificationEmails, setNotificationEmails] = useState('');
    const [notificationSubject, setNotificationSubject] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Integration Modal
    const [integrationModal, setIntegrationModal] = useState<CustomEvent | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => { fetchEvents(); }, []);

    const fetchEvents = async () => {
        setLoading(true);
        const res = await api.get<CustomEvent[]>('custom_events');
        if (res.success) setEvents(res.data);
        setLoading(false);
    };

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    };

    const handleCreateNew = () => {
        setEditingEventId(null);
        setEventName('');
        setNotificationEnabled(false);
        setNotificationEmails('');
        setNotificationSubject('');
        setIsModalOpen(true);
    };

    const handleEditClick = (evt: CustomEvent) => {
        setEditingEventId(evt.id);
        setEventName(evt.name);
        setNotificationEnabled(evt.notificationEnabled || false);
        setNotificationEmails(evt.notificationEmails || '');
        setNotificationSubject(evt.notificationSubject || '');
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!eventName.trim()) {
            showToast('Vui lòng nhập tên sự kiện', 'error');
            return;
        }
        setIsSubmitting(true);

        const payload = { 
            name: eventName,
            notificationEnabled,
            notificationEmails,
            notificationSubject
        };

        let res;
        if (editingEventId) {
            res = await api.put<CustomEvent>(`custom_events/${editingEventId}`, payload);
        } else {
            res = await api.post<CustomEvent>('custom_events', payload);
        }

        if (res.success) {
            setIsModalOpen(false);
            showToast(editingEventId ? 'Đã cập nhật' : 'Đã tạo sự kiện mới');
            fetchEvents();
        } else {
            showToast(res.message || 'Lỗi khi lưu', 'error');
        }
        setIsSubmitting(false);
    };

    const executeDelete = async () => {
        if (!confirmDeleteId) return;
        const res = await api.delete(`custom_events/${confirmDeleteId}`);
        if (res.success) {
            setEvents(events.filter(e => e.id !== confirmDeleteId));
            showToast('Đã xóa sự kiện tùy chỉnh');
            setConfirmDeleteId(null);
        } else {
            showToast('Lỗi khi xóa', 'error');
        }
    };

    const handleToggleStatus = async (evt: CustomEvent) => {
        const res = await api.put(`custom_events/${evt.id}?route=toggle_status`, {});
        if (res.success) {
            setEvents(events.map(e => e.id === evt.id ? { ...e, status: (res.data as any)?.status } : e));
            showToast((res.data as any)?.status === 'active' ? 'Đã kích hoạt sự kiện' : 'Đã vô hiệu hoá sự kiện');
        } else {
            showToast('Lỗi khi thay đổi trạng thái', 'error');
        }
    };

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

        const endpoint = `${API_BASE_URL.replace(/\/$/, '')}/custom_events.php?route=track`;

    const getJsSnippet = (evtId: string) => `// Tracking Custom Event
const trackCustomEvent = async () => {
    const payload = {
        // Bắt buộc
        event_id: "${evtId}",
        email: "user@example.com", 
        
        // Dữ liệu tùy chỉnh của sự kiện
        properties: {
            source: "App Mobile",
            plan: "Premium",
            action_code: "CLICK_BANNER_123"
        },

        // Cập nhật thông tin User (Tùy chọn)
        firstName: "Nguyen", 
        lastName: "Van A"
    };

    try {
        await fetch("${endpoint}", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("Lỗi API:", err);
    }
};`;

    return (
        <div className="space-y-6 pb-40">
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Sự kiện Tùy chỉnh (Custom)</h3>
                    <p className="text-xs text-slate-500 font-medium">Kích hoạt Automation từ bất kỳ nguồn dữ liệu nào thông qua API.</p>
                </div>
                <Button icon={Plus} size="md" onClick={handleCreateNew}>Tạo Sự kiện</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-32 bg-white rounded-[40px] animate-pulse border border-slate-100" />)}
                    </div>
                ) : events.length === 0 ? (
                    <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-200 rounded-[40px] bg-slate-50/50">
                        <Zap className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <h3 className="text-slate-500 font-bold text-lg">Chưa có sự kiện nào</h3>
                        <p className="text-slate-400 mt-2 text-sm">Tạo sự kiện Custom để tích hợp sâu với hệ thống của bạn.</p>
                        <Button variant="outline" className="mt-6 px-8 h-10 rounded-xl" onClick={handleCreateNew}>Bắt đầu ngay</Button>
                    </div>
                ) : events.map(evt => (
                    <div key={evt.id} className="group bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-200 transition-all flex flex-col justify-between gap-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-blue-600 group-hover:scale-125 transition-transform"><Plug className="w-32 h-32" /></div>

                        <div className="flex justify-between items-start relative z-10">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg transition-all ${
                                    evt.status === 'inactive'
                                        ? 'bg-slate-300 shadow-slate-200/60'
                                        : 'bg-gradient-to-br from-blue-400 to-indigo-500 shadow-blue-500/30 group-hover:rotate-6'
                                }`}>
                                    <Zap className="w-6 h-6" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className={`text-base font-bold leading-tight truncate pr-2 ${
                                            evt.status === 'inactive' ? 'text-slate-400' : 'text-slate-800'
                                        }`} title={evt.name}>{evt.name}</h4>
                                        {evt.status === 'inactive' && (
                                            <span className="text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full border border-slate-200">INACTIVE</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-mono mt-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 w-fit">ID: {evt.id}</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleToggleStatus(evt)}
                                    title={evt.status === 'inactive' ? 'Kích hoạt' : 'Tạm dừng'}
                                    className={`p-2 rounded-xl transition-all ${
                                        evt.status === 'inactive'
                                            ? 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50'
                                            : 'text-emerald-500 hover:text-amber-600 hover:bg-amber-50'
                                    }`}
                                >
                                    <Power className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleEditClick(evt)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all opacity-0 group-hover:opacity-100" title="Sửa tên">
                                    <Edit3 className="w-4 h-4" />
                                </button>
                                <button onClick={() => setConfirmDeleteId(evt.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100" title="Xóa">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-4 relative z-10">
                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 group-hover:bg-blue-50/50 group-hover:border-blue-100 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Kích hoạt</span>
                                    <span className="text-sm font-black text-slate-700">{(evt.stats?.count || 0).toLocaleString()} <span className="text-[10px] font-medium text-slate-400">lần</span></span>
                                </div>
                                <div className="h-8 w-px bg-slate-200"></div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loại</span>
                                    <span className="text-sm font-black text-slate-700">Webhook</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setIntegrationModal(evt)}
                                className="w-full h-11 rounded-xl bg-slate-50 text-slate-600 border border-slate-200 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-all flex items-center justify-center gap-2 group/btn"
                            >
                                <Code2 className="w-4 h-4 text-[#2563eb] group-hover/btn:rotate-12 transition-transform" />
                                Lấy mã tích hợp API
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingEventId ? "Đổi tên sự kiện" : "Tạo sự kiện tùy chỉnh"}
                size="sm"
                footer={<div className="flex justify-between w-full"><Button variant="ghost" onClick={() => setIsModalOpen(false)}>Hủy</Button><Button icon={CheckCircle2} onClick={handleSave} isLoading={isSubmitting}>{editingEventId ? 'Cập nhật' : 'Tạo sự kiện'}</Button></div>}
            >
                <div className="space-y-4 py-2">
                    <Input
                        label="Tên sự kiện (Internal Name)"
                        placeholder="VD: App Login, Level Up, Click Banner X..."
                        value={eventName}
                        onChange={e => setEventName(e.target.value)}
                        autoFocus
                    />

                    {/* Email Notification */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1 pb-2 border-b border-slate-100 mt-2">
                            <div>
                                <h5 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-[#2563eb]" /> Lệnh gửi email Báo cáo
                                </h5>
                                <p className="text-[10px] text-slate-400 font-medium mt-1">Gửi email khi nhận sự kiện.</p>
                            </div>
                            <div
                                onClick={() => setNotificationEnabled(!notificationEnabled)}
                                className="flex items-center gap-2 cursor-pointer select-none"
                            >
                                <div className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 flex items-center ${
                                    notificationEnabled ? 'bg-amber-600 justify-end' : 'bg-slate-300 justify-start'
                                }`}>
                                    <div className="w-4.5 h-4.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                    notificationEnabled ? 'text-amber-600' : 'text-slate-400'
                                }`}>{notificationEnabled ? 'Bật' : 'Tắt'}</span>
                            </div>
                        </div>

                        {notificationEnabled && (
                            <div className="space-y-4 bg-amber-50/50 border border-amber-100 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-300">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                                        <BellRing className="w-3 h-3 inline mr-1 text-amber-600" />
                                        Email nhận thông báo <span className="text-slate-400 font-normal lowercase normal-case tracking-normal">(viết cách nhau bởi dấu phẩy)</span>
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="vd: sale1@cty.com, kho@cty.com"
                                        value={notificationEmails}
                                        onChange={e => setNotificationEmails(e.target.value)}
                                        className="w-full px-4 py-3 bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl text-sm text-slate-700 outline-none resize-none transition-all focus:ring-4 focus:ring-amber-400/10 placeholder:text-slate-300"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Tiêu đề email (tùy chọn)</label>
                                    <input
                                        type="text"
                                        placeholder={`VD: [Custom Event] ${eventName || 'Mới'}`}
                                        value={notificationSubject}
                                        onChange={e => setNotificationSubject(e.target.value)}
                                        className="w-full h-10 px-4 bg-white border-2 border-amber-200 focus:border-amber-400 rounded-xl text-sm text-slate-700 outline-none transition-all focus:ring-4 focus:ring-amber-400/10 placeholder:text-slate-300"
                                    />
                                </div>
                                <div className="flex items-start gap-2 p-3 bg-white rounded-xl border border-amber-100">
                                    <span className="text-base mt-0.5">📧</span>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        Email sẽ chứa toàn bộ trường dữ liệu thông tin đi kèm (thuộc tính properties và thông tin Khách hàng nếu có).
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3 text-blue-700 text-xs">
                        <Info className="w-5 h-5 shrink-0" />
                        <p>Hệ thống sẽ sinh một Event ID duy nhất. Bạn dùng ID này đã gửi API mỗi khi hành động xảy ra.</p>
                    </div>
                </div>
            </Modal>

            {/* INTEGRATION GUIDE MODAL */}
            {integrationModal && (
                <Modal isOpen={!!integrationModal} onClose={() => setIntegrationModal(null)} title="Tích hợp API Custom Event" size="lg">
                    <div className="space-y-6 pb-4">
                        <div className="p-5 bg-slate-50 border border-slate-200 rounded-[28px]">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2"><Terminal className="w-3.5 h-3.5" /> API Endpoint (POST)</p>
                            <div className="flex items-center justify-between gap-2 bg-white p-3 rounded-xl border border-slate-100 shadow-inner overflow-hidden">
                                <code className="text-[10px] text-slate-600 truncate font-mono">{endpoint}</code>
                                <button onClick={() => handleCopy(endpoint, 'url')} className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-400 shrink-0">
                                    {copied === 'url' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileCode className="w-3.5 h-3.5" /> JavaScript Example</span>
                                <button onClick={() => handleCopy(getJsSnippet(integrationModal.id), 'js')} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2">
                                    {copied === 'js' ? <><Check className="w-3 h-3" /> ĐÃ CHÉP</> : <><Copy className="w-3 h-3" /> SAO CHÉP CODE</>}
                                </button>
                            </div>
                            <div className="bg-[#0f172a] rounded-3xl p-6 overflow-x-auto border-b-4 border-slate-800 shadow-xl">
                                <pre className="text-[11px] font-mono text-blue-300 leading-relaxed">{getJsSnippet(integrationModal.id)}</pre>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

            {/* CONFIRM DELETE MODAL */}
            <ConfirmModal
                isOpen={!!confirmDeleteId}
                onClose={() => setConfirmDeleteId(null)}
                onConfirm={executeDelete}
                title="Xóa sự kiện này?"
                message="Hành động này sẽ xóa ID sự kiện khỏi hệ thống. Các lệnh gọi API sử dụng ID này sẽ bị lỗi."
                variant="danger"
                confirmLabel="Xóa vĩnh viễn"
            />


        </div>
    );
};

export default CustomEventsTab;
