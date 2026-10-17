import { API_BASE_URL } from '../../utils/config';

import React, { useState, useEffect } from 'react';
import {
    ShoppingCart, Plus, Code2, Trash2, Edit3, ShoppingBag,
    Terminal, FileCode, Check, Copy, CheckCircle2, Info, Bell, BellRing, Power
} from 'lucide-react';
import { api } from '../../services/storageAdapter';
import { PurchaseEvent } from '../../types';
import Button from '../common/Button';
import Modal from '../common/Modal';
import Input from '../common/Input';
import toast from 'react-hot-toast';
import ConfirmModal from '../common/ConfirmModal';
import { AppIcon } from '../../../common/AppIcons';

const PurchasesTab: React.FC = () => {
    const [events, setEvents] = useState<PurchaseEvent[]>([]);
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
    const [integrationModal, setIntegrationModal] = useState<PurchaseEvent | null>(null);
    const [copied, setCopied] = useState<string | null>(null);

    useEffect(() => { fetchEvents(); }, []);

    const fetchEvents = async () => {
        setLoading(true);
        const res = await api.get<PurchaseEvent[]>('purchase_events');
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

    const handleEditClick = (evt: PurchaseEvent) => {
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
            res = await api.put<PurchaseEvent>(`purchase_events/${editingEventId}`, payload);
        } else {
            res = await api.post<PurchaseEvent>('purchase_events', payload);
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
        const res = await api.delete(`purchase_events/${confirmDeleteId}`);
        if (res.success) {
            setEvents(events.filter(e => e.id !== confirmDeleteId));
            showToast('Đã xóa sự kiện mua hàng');
            setConfirmDeleteId(null);
        } else {
            showToast('Lỗi khi xóa', 'error');
        }
    };

    const handleToggleStatus = async (evt: PurchaseEvent) => {
        const res = await api.put(`purchase_events/${evt.id}?route=toggle_status`, {});
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

        const endpoint = `${API_BASE_URL.replace(/\/$/, '')}/purchase_events.php?route=track`;

    const getJsSnippet = (evtId: string) => `// API Tracking Mua hàng
const trackPurchase = async () => {
    const payload = {
        // Bắt buộc
        event_id: "${evtId}",
        email: "customer@example.com", 
        
        // Thông tin đơn hàng (Khuyên dùng)
        total_value: 1500000,
        currency: "VND",
        items: [
            { name: "Sản phẩm A", price: 500000 },
            { name: "Sản phẩm B", price: 1000000 }
        ],

        // Cập nhật thông tin khách (Tùy chọn)
        firstName: "Nguyen",
        lastName: "Van A",
        phoneNumber: "0901234567"
    };

    try {
        await fetch("${endpoint}", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
    } catch (err) {
        console.error("Lỗi Tracking:", err);
    }
};`;

    return (
        <div className="space-y-6 pb-40">
            <div className="flex justify-between items-center bg-[var(--color-surface)] p-4 rounded-[20px] border border-[var(--color-border)] shadow-xs">
                <div className="flex items-center gap-3">
                    <AppIcon name="trigger_purchase" size={38} className="shrink-0" />
                    <div>
                        <h3 className="text-base font-bold text-[var(--color-text)]">Sự kiện Mua hàng</h3>
                        <p className="text-xs text-[var(--color-text-muted)] font-medium">Định nghĩa sự kiện để API ghi nhận đơn hàng.</p>
                    </div>
                </div>
                <Button icon={Plus} size="md" onClick={handleCreateNew}>Tạo Sự kiện</Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <>
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 space-y-4">
                                <div className="flex justify-between items-start gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                                        <div className="space-y-2">
                                            <div className="w-36 h-4 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[8px]" />
                                            <div className="w-24 h-3 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[6px]" />
                                        </div>
                                    </div>
                                    <div className="w-16 h-6 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[8px]" />
                                </div>
                                <div className="h-14 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                                <div className="h-9 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                            </div>
                        ))}
                    </>
                ) : events.length === 0 ? (
                    <div className="col-span-full py-16 text-center border-2 border-dashed border-[var(--color-border)] rounded-[20px] bg-[var(--color-bg)]">
                        <div className="flex justify-center mb-3">
                            <AppIcon name="trigger_purchase" size={44} />
                        </div>
                        <h3 className="text-[var(--color-text)] font-bold text-base">Chưa có sự kiện nào</h3>
                        <p className="text-[var(--color-text-muted)] mt-1 text-xs">Tạo sự kiện để API có thể gửi dữ liệu đơn hàng về hệ thống.</p>
                        <Button variant="outline" className="mt-5 px-6 h-[38px] rounded-[var(--radius-md)]" onClick={handleCreateNew}>Bắt đầu ngay</Button>
                    </div>
                ) : events.map(evt => (
                    <div key={evt.id} className="group hover-lift bg-[var(--color-surface)] p-5 rounded-[20px] border border-[var(--color-border)] shadow-xs hover:border-[var(--color-primary-light)] transition-all flex flex-col justify-between gap-4 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] text-pink-600 group-hover:scale-125 transition-transform"><ShoppingBag className="w-32 h-32" /></div>

                        <div className="flex justify-between items-start relative z-10">
                            <div className="flex items-center gap-3">
                                <AppIcon
                                    name="trigger_purchase"
                                    size={38}
                                    className={`shrink-0 transition-transform group-hover:scale-105 ${
                                        evt.status === 'inactive' ? 'opacity-50 grayscale' : ''
                                    }`}
                                />
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h4 className={`text-sm font-bold leading-tight truncate pr-2 ${
                                            evt.status === 'inactive' ? 'text-slate-400' : 'text-[var(--color-text)]'
                                        }`} title={evt.name}>{evt.name}</h4>
                                        {evt.status === 'inactive' && (
                                            <span className="text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full border border-slate-200">INACTIVE</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-mono mt-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 w-fit">ID: {evt.id}</p>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleToggleStatus(evt)}
                                    title={evt.status === 'inactive' ? 'Kích hoạt' : 'Tạm dừng'}
                                    className={`p-1.5 rounded-lg transition-all ${
                                        evt.status === 'inactive'
                                            ? 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50'
                                            : 'text-emerald-500 hover:text-amber-600 hover:bg-amber-50'
                                    }`}
                                >
                                    <Power className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleEditClick(evt)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all" title="Sửa tên">
                                    <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setConfirmDeleteId(evt.id)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all" title="Xóa">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-3 relative z-10">
                            <div className="flex items-center justify-between p-2.5 bg-slate-50/70 rounded-xl border border-slate-200/60">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Đơn hàng</span>
                                    <span className="text-xs font-extrabold text-slate-800">{(evt.stats?.count || 0).toLocaleString()}</span>
                                </div>
                                <div className="h-6 w-px bg-slate-200"></div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doanh thu</span>
                                    <span className="text-xs font-extrabold text-slate-800">N/A</span>
                                </div>
                            </div>

                            <button
                                onClick={() => setIntegrationModal(evt)}
                                className="w-full h-9 rounded-xl bg-[var(--color-bg)] text-slate-700 hover:text-[var(--color-primary)] border border-[var(--color-border)] text-xs font-semibold hover:bg-slate-100 hover:border-slate-300 transition-all flex items-center justify-center gap-1.5"
                            >
                                <Code2 className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                                Lấy mã tích hợp API
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={editingEventId ? "Đổi tên sự kiện" : "Tạo sự kiện mới"}
                size="sm"
                footer={<div className="flex justify-between w-full"><Button variant="ghost" onClick={() => setIsModalOpen(false)}>Hủy</Button><Button icon={CheckCircle2} onClick={handleSave} isLoading={isSubmitting}>{editingEventId ? 'Cập nhật' : 'Tạo sự kiện'}</Button></div>}
            >
                <div className="space-y-4 py-2">
                    <Input
                        label="Tên sự kiện mua hàng"
                        placeholder="VD: Mua gói Premium..."
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
                                    notificationEnabled ? 'bg-[var(--color-primary)] justify-end' : 'bg-slate-300 justify-start'
                                }`}>
                                    <div className="w-4.5 h-4.5 w-5 h-5 bg-white rounded-full shadow-sm" />
                                </div>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${
                                    notificationEnabled ? 'text-[var(--color-primary)]' : 'text-slate-400'
                                }`}>{notificationEnabled ? 'Bật' : 'Tắt'}</span>
                            </div>
                        </div>

                        {notificationEnabled && (
                            <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 animate-in slide-in-from-top-2 duration-300">
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">
                                        <BellRing className="w-3 h-3 inline mr-1 text-[var(--color-primary)]" />
                                        Email nhận thông báo <span className="text-slate-400 font-normal lowercase normal-case tracking-normal">(viết cách nhau bởi dấu phẩy)</span>
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="vd: sale1@cty.com, kho@cty.com"
                                        value={notificationEmails}
                                        onChange={e => setNotificationEmails(e.target.value)}
                                        className="w-full px-4 py-3 bg-white border-2 border-slate-200 focus:border-[var(--color-primary)] rounded-xl text-sm text-slate-700 outline-none resize-none transition-all focus:ring-4 focus:ring-[var(--color-primary)]/10 placeholder:text-slate-300"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Tiêu đề email (tùy chọn)</label>
                                    <input
                                        type="text"
                                        placeholder={`VD: [Purchase] Có đơn đặt hàng mới...`}
                                        value={notificationSubject}
                                        onChange={e => setNotificationSubject(e.target.value)}
                                        className="w-full h-10 px-4 bg-white border-2 border-slate-200 focus:border-[var(--color-primary)] rounded-xl text-sm text-slate-700 outline-none transition-all focus:ring-4 focus:ring-[var(--color-primary)]/10 placeholder:text-slate-300"
                                    />
                                </div>
                                <div className="flex items-start gap-2 p-3 bg-white rounded-xl border border-slate-200">
                                    <span className="text-base mt-0.5">📧</span>
                                    <p className="text-[11px] text-slate-500 leading-relaxed">
                                        Email sẽ chứa toàn bộ trường dữ liệu thông tin đơn hàng đi kèm.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex gap-3 text-blue-700 text-xs">
                        <Info className="w-5 h-5 shrink-0" />
                        <p>ID sẽ được sinh tự động. Tên hàng, giá tiền và thông tin chi tiết sẽ được truyền động qua API khi gọi.</p>
                    </div>
                </div>
            </Modal>

            {/* INTEGRATION GUIDE MODAL */}
            {integrationModal && (
                <Modal
                    isOpen={!!integrationModal}
                    onClose={() => setIntegrationModal(null)}
                    title="Tích hợp API Mua hàng"
                    size="lg"
                >
                    <div className="space-y-6 pb-4">
                        <div className="p-5 bg-slate-50 border border-slate-200 rounded-[18px]">
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
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><FileCode className="w-3.5 h-3.5" /> JavaScript Code Example</span>
                                <button onClick={() => handleCopy(getJsSnippet(integrationModal.id), 'js')} className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-all flex items-center gap-2">
                                    {copied === 'js' ? <><Check className="w-3 h-3" /> ĐÃ CHÉP</> : <><Copy className="w-3 h-3" /> SAO CHÉP CODE</>}
                                </button>
                            </div>
                            <div className="bg-[#0f172a] rounded-[18px] p-6 overflow-x-auto border-b-4 border-slate-800 shadow-xl">
                                <pre className="text-[11px] font-mono text-pink-300 leading-relaxed">{getJsSnippet(integrationModal.id)}</pre>
                            </div>
                        </div>
                    </div>
                </Modal>
            )}

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

export default PurchasesTab;
