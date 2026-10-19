import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    X, User, History,
    Clock, ExternalLink,
    Send, MailOpen, MessageCircle, Info, Trash2,
    Activity, FileText, Mail, Phone, PenLine, Star, RefreshCw, ArrowLeft, Bot, UserCheck, Tag
} from 'lucide-react';
import { api } from '../../services/storageAdapter';
import Input from '../common/Input';
import Select from '../common/Select';
import ConfirmModal from '../common/ConfirmModal';
import { getMktPortalRoot } from '../../utils/portalRoot';
import { toast } from 'react-hot-toast';

const openCrmContact360 = (arg1: any, arg2?: any) => {
    if (arg1 && typeof arg1.stopPropagation === 'function') arg1.stopPropagation();
    if (arg2 && typeof arg2.stopPropagation === 'function') arg2.stopPropagation();
    const rawId = (arg1 && typeof arg1.stopPropagation === 'function') ? arg2 : arg1;
    const id = Number(rawId);
    if (!id || Number.isNaN(id)) return;
    window.dispatchEvent(new CustomEvent('open-customer-drawer', { detail: { id, initialTab: 'journey360' } }));
};

export type TabType = 'personal' | 'interaction' | 'journey' | 'notes';

interface ZaloUserProfileModalProps {
    subscriberId?: string;
    userId?: string;
    isOpen?: boolean;
    onClose: () => void;
    onUpdate?: () => void;
    onUserUpdated?: () => void;
    initialTab?: TabType;
}

export const ZaloUserProfileModal: React.FC<ZaloUserProfileModalProps> = ({
    subscriberId,
    userId,
    isOpen = true,
    onClose,
    onUpdate,
    onUserUpdated,
    initialTab = 'personal'
}) => {
    const resolvedId = subscriberId || userId || '';
    const showToast = (msg: string, type?: string) => {
        if (type === 'error') toast.error(msg);
        else toast.success(msg);
    };
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<TabType>(initialTab);
    const [updating, setUpdating] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [sendingReply, setSendingReply] = useState(false);
    const sendingReplyRef = useRef(false);

    useEffect(() => {
        if (!isOpen || !resolvedId || loading || !user) return;
        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => setAnimateIn(true));
        });
        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
        };
    }, [isOpen, resolvedId, loading, user]);

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    const handleClose = () => { setAnimateIn(false); setTimeout(onClose, 220); };

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
        if (isOpen && resolvedId) {
            fetchUserDetails();
        }
    }, [resolvedId, isOpen]);

    const fetchUserDetails = async () => {
        if (!resolvedId) return;
        setLoading(true);
        const res = await api.get<any>(`zalo_audience?route=user_details&id=${resolvedId}`);
        if (res.success && res.data) {
            const userData = res.data;
            setUser(userData);

            // Handle notes: separate manual text from JSON structure (Sync with Meta)
            let manualNote = '';
            try {
                const notesData = JSON.parse(userData.notes);
                if (Array.isArray(notesData)) {
                    const manualObj = notesData.find((n: any) => n.type === 'manual_note');
                    manualNote = manualObj ? manualObj.content : '';
                } else {
                    manualNote = userData.notes;
                }
            } catch (e) {
                manualNote = userData.notes || '';
            }

            setFormData({
                displayName: userData.display_name || '',
                gender: userData.gender || 'Chưa chọn',
                phone: userData.phone_number || userData.phone || '',
                birthday: userData.birthday ? formatDateForInput(userData.birthday) : '',
                email: userData.manual_email || userData.user_email || userData.email || '',
                notes: manualNote
            });
        }
        setLoading(false);
    };

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const handleDelete = async () => {
        setUpdating(true);
        const res = await api.delete(`zalo_audience?id=${resolvedId}`);
        if (res.success) {
            onUpdate?.();
            onUserUpdated?.();
            handleClose();
        } else {
            showToast('Lỗi khi xóa: ' + (res.message || 'Không xác định'), 'error');
        }
        setUpdating(false);
        setShowDeleteConfirm(false);
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

        const res = await api.post('zalo_audience?route=update_user', {
            id: resolvedId,
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
            showToast('Đã lưu thông tin hồ sơ Zalo', 'success');
            onUpdate?.();
            onUserUpdated?.();
        } else {
            showToast(res.message || 'Không thể lưu thông tin', 'error');
        }
        setUpdating(false);
    };

    const handleSendDirectReply = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const text = replyText.trim();
        if (!text || sendingReplyRef.current || !user) return;
        sendingReplyRef.current = true;
        setSendingReply(true);
        try {
            const rawZaloId = user.zalo_user_id || resolvedId;
            const convId = String(rawZaloId).startsWith('zalo_') ? String(rawZaloId) : `zalo_${rawZaloId}`;
            const res = await api.post<any>('ai_chatbot?action=send_human_reply', {
                conversation_id: convId,
                message: text
            });
            if (res.success) {
                const newMsg = {
                    id: Date.now(),
                    direction: 'outbound',
                    sender: 'human',
                    sender_type: 'human',
                    is_bot: 0,
                    message_text: text,
                    created_at: new Date().toISOString()
                };
                setUser((prev: any) => ({
                    ...prev,
                    messages: [...(prev?.messages || []), newMsg]
                }));
                setReplyText('');
                showToast('Đã gửi phản hồi trực tiếp qua Zalo OA', 'success');
                onUpdate?.();
                onUserUpdated?.();
            } else {
                showToast(res.message || 'Gửi tin nhắn thất bại', 'error');
            }
        } catch (err: any) {
            showToast(err?.message || 'Lỗi kết nối khi gửi phản hồi', 'error');
        } finally {
            sendingReplyRef.current = false;
            setSendingReply(false);
        }
    };

    const getInitials = (name: string) => {
        if (!name) return '';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name[0].toUpperCase();
    };

    const parseTags = (rawTags: any): string[] => {
        if (!rawTags) return [];
        if (Array.isArray(rawTags)) return rawTags.map(String).filter(Boolean);
        if (typeof rawTags === 'string') {
            try {
                const parsed = JSON.parse(rawTags);
                if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
            } catch {
                return rawTags.split(',').map(s => s.trim()).filter(Boolean);
            }
        }
        return [];
    };

    if (!isOpen || !resolvedId) return null;

    if (loading) {
        return createPortal(
            <div className="modal-backdrop fixed inset-0 bg-black/60 backdrop-blur-[6px] z-[2147483625] flex items-center justify-center p-4" style={{ zIndex: 2147483625, background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}>
                <div className="bg-white rounded-[18px] p-12 flex flex-col items-center gap-4 shadow-2xl">
                    <History className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
                    <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Đang tải hồ sơ...</p>
                </div>
            </div>,
            getMktPortalRoot()
        );
    }

    if (!user) return null;

    const initials = getInitials(formData.displayName);
    const userTags = parseTags(user.tags);

    const drawerContent = (
        <>
            <div className="fixed inset-0 z-[2147483625] flex justify-end overflow-hidden" style={{ zIndex: 2147483625, pointerEvents: animateIn ? 'auto' : 'none' }}>
                {/* Backdrop Blur Overlay with Floating Circular Arrow Close Button */}
                <div
                    className="drawer-backdrop"
                    onClick={handleClose}
                    style={{
                        background: 'rgba(0, 0, 0, 0.6)',
                        backdropFilter: 'blur(6px)',
                        WebkitBackdropFilter: 'blur(6px)',
                        opacity: animateIn ? 1 : 0,
                        transition: 'opacity 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)',
                        pointerEvents: animateIn ? 'auto' : 'none',
                        zIndex: 2147483620,
                        '--drawer-backdrop-z': 2147483620
                    } as React.CSSProperties}
                />

                {/* Slide-over Right Drawer Panel - Anchored to sidebar */}
                <div className="zalo-user-profile-modal-container fixed inset-y-0 right-0 z-[2147483625] max-w-full flex pl-0 pointer-events-none" style={{ zIndex: 2147483625 }}>
                    <div
                        className="drawer-panel fixed top-0 right-0 bottom-0 z-[2147483625] zalo-user-profile-modal-panel w-screen max-w-none bg-white dark:bg-slate-950 shadow-2xl flex flex-col overflow-hidden"
                        style={{
                            zIndex: 2147483625,
                            opacity: animateIn ? 1 : 0,
                            transform: animateIn ? 'translate3d(0, 0, 0)' : 'translate3d(48px, 0, 0)',
                            transition: 'transform 0.22s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.20s cubic-bezier(0.25, 0.1, 0.25, 1)',
                            pointerEvents: animateIn ? 'auto' : 'none'
                        }}
                    >
                    <style>{`
                      @media (min-width: 1024px) {
                        .zalo-user-profile-modal-container {
                          padding-left: var(--sidebar-width, 220px) !important;
                        }
                        .zalo-user-profile-modal-panel {
                          width: calc(100vw - var(--sidebar-width, 220px)) !important;
                        }
                      }
                    `}</style>
                    {/* Header */}
                    <div className="px-6 py-4 flex justify-between items-center bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 shrink-0">
                        <div className="flex items-center gap-3">
                            <h3 className="text-lg font-bold text-slate-800 tracking-tight">Hồ sơ chi tiết Zalo OA</h3>
                            {user.contact_id && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        openCrmContact360(user.contact_id);
                                    }}
                                    className="text-[11px] font-mono text-[var(--color-text-muted)] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-2 py-0.5 cursor-pointer flex items-center gap-1 transition-colors"
                                    title="Mở Hồ sơ CRM 360"
                                >
                                    CRM #{user.contact_id}
                                    <ExternalLink className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            {user.contact_id && (
                                <button
                                    type="button"
                                    onClick={() => openCrmContact360(user.contact_id)}
                                    className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-[var(--color-primary)] border border-red-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                                >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                    Mở Hồ sơ CRM 360
                                </button>
                            )}
                            <button
                                onClick={handleClose}
                                className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full transition-all duration-200"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Body Content */}
                    <div className="px-6 py-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
                        <div className="flex flex-col">

                            {/* Profile Hero */}
                            <div className="flex flex-wrap items-center gap-5 mb-8 px-1 shrink-0">
                                <div className="w-16 h-16 rounded-[18px] bg-gradient-to-br from-[#BD1D2D] to-[#9A1523] flex items-center justify-center text-xl font-bold text-white shadow-xl shadow-red-500/20 shrink-0">
                                    {user.avatar ? (
                                        <img src={user.avatar} alt="" className="w-full h-full object-cover rounded-[18px]" />
                                    ) : initials}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <h2 className="text-2xl font-black text-slate-800 truncate tracking-tight">{formData.displayName}</h2>
                                        <span className="px-2.5 py-1 inline-flex items-center gap-1.5 rounded-lg border bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm text-[9px] uppercase tracking-wide font-bold">
                                            Hoạt động
                                        </span>
                                        {user.contact_id && (
                                            <span
                                                onClick={() => openCrmContact360(user.contact_id)}
                                                className="text-[11px] font-mono text-[var(--color-text-muted)] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer"
                                            >
                                                CRM #{user.contact_id}
                                            </span>
                                        )}
                                        <div className="px-3 py-1 bg-amber-50 text-[var(--color-primary)] rounded-lg border border-amber-100 flex items-center gap-1.5 shadow-sm ml-auto">
                                            <Star className="w-4 h-4 fill-current" />
                                            <span className="text-sm font-black">{(user.lead_score || 0).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-slate-500 font-bold text-xs tracking-tight">
                                        <span className="text-[11px] font-mono text-slate-600 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5">
                                            Zalo UID: {String(user.zalo_user_id || resolvedId)}
                                        </span>
                                        {user.salesperson && (
                                            <>
                                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                <span className="text-slate-600">Sale phụ trách: <strong className="text-slate-800">{user.salesperson}</strong></span>
                                            </>
                                        )}
                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                        <span className="text-slate-400">Tham gia: {formatTimeAgoShort(user.joined_at || user.created_at)}</span>
                                    </div>
                                    {userTags.length > 0 && (
                                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                            <Tag className="w-3 h-3 text-slate-400" />
                                            {userTags.map((tag, idx) => (
                                                <span key={idx} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold border border-slate-200">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => setEditMode(!editMode)}
                                    className={`px-4 py-2 bg-white hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-black border border-slate-200 transition-all duration-300 flex items-center gap-2 hover:shadow-sm ${editMode ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : ''}`}
                                >
                                    <PenLine className="w-3.5 h-3.5" />
                                    {editMode ? 'Đang sửa...' : 'Sửa hồ sơ'}
                                </button>
                            </div>

                            <div className="shrink-0 mb-4">
                                <div className="flex bg-slate-100 p-1 rounded-[14px] mb-6 relative w-fit overflow-x-auto no-scrollbar whitespace-nowrap">
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
                                            {/* Identity Section */}
                                            <section className="space-y-4">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                                                    <div className="w-4 h-px bg-slate-200"></div> Thông tin định danh
                                                </h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-white p-6 rounded-[18px] border border-slate-100 shadow-sm">
                                                    <div className="col-span-1 md:col-span-2">
                                                        <Input
                                                            label="Họ và tên"
                                                            required
                                                            value={formData.displayName}
                                                            onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                                            disabled={!editMode}
                                                        />
                                                    </div>

                                                    <div className="space-y-1.5">
                                                        <Select
                                                            label="Giới tính"
                                                            value={formData.gender}
                                                            onChange={val => setFormData({ ...formData, gender: val })}
                                                            disabled={!editMode}
                                                            options={[
                                                                { value: 'Chọn...', label: 'Chọn...' },
                                                                { value: 'Nam', label: 'Nam' },
                                                                { value: 'Nữ', label: 'Nữ' },
                                                                { value: 'Khác', label: 'Khác' }
                                                            ]}
                                                        />
                                                    </div>

                                                    <Input
                                                        label="Điện thoại"
                                                        icon={Phone}
                                                        value={formData.phone}
                                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                                        disabled={!editMode}
                                                    />

                                                    <Input
                                                        label="Ngày sinh"
                                                        type="date"
                                                        value={formData.birthday}
                                                        onChange={e => setFormData({ ...formData, birthday: e.target.value })}
                                                        disabled={!editMode}
                                                    />

                                                    <Input
                                                        label="Email"
                                                        icon={Mail}
                                                        value={formData.email}
                                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                                        disabled={!editMode}
                                                        placeholder="example@gmail.com"
                                                    />
                                                </div>
                                            </section>
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'interaction' && (
                                    <div className="animate-in fade-in slide-in-from-right-2 duration-300 pb-6 flex flex-col">
                                        <div className="flex items-center justify-between mb-6 px-1">
                                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                <div className="w-4 h-px bg-slate-200"></div> Lịch sử trò chuyện Zalo OA
                                            </h4>
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                                                {user.messages?.length || 0} tin nhắn
                                            </span>
                                        </div>
                                        <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
                                            {user.messages && user.messages.length > 0 ? user.messages.map((msg: any, index: number) => {
                                                const isOutbound = msg.direction === 'outbound' || msg.sender === 'ai' || msg.sender === 'human' || msg.sender_type === 'ai' || msg.sender_type === 'human' || msg.sender === 'bot';
                                                const isAiBot = isOutbound && (msg.sender === 'ai' || msg.sender === 'bot' || msg.sender_type === 'ai' || msg.sender_type === 'bot' || Number(msg.is_bot) === 1);
                                                return (
                                                    <div key={msg.id || index} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                                                        <div className={`max-w-[85%] px-4 py-3 rounded-[16px] text-[13px] shadow-sm ${isOutbound ? (isAiBot ? 'bg-slate-800 text-white rounded-tr-none' : 'bg-[var(--color-primary)] text-white rounded-tr-none') : 'bg-slate-50 text-slate-700 border border-slate-200 rounded-tl-none'}`}>
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                {isOutbound ? (
                                                                    isAiBot ? (
                                                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/15 text-amber-200">
                                                                            <Bot className="w-3 h-3" /> AI Bot
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/20 text-white">
                                                                            <UserCheck className="w-3 h-3" /> Tư vấn viên
                                                                        </span>
                                                                    )
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-slate-400">
                                                                        Khách hàng
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="font-medium tracking-tight whitespace-pre-wrap leading-relaxed">{msg.message_text || msg.content}</p>
                                                            <div className={`mt-1.5 text-[9px] font-bold uppercase tracking-widest opacity-70 ${isOutbound ? 'text-white/80 text-right' : 'text-slate-400'}`}>
                                                                {formatTimeShort(msg.created_at)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }) : (
                                                <div className="py-16 text-center bg-slate-50/50 rounded-[18px] border border-dashed border-slate-200">
                                                    <Activity className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chưa có tin nhắn tương tác nào</p>
                                                </div>
                                            )}
                                        </div>

                                        {/* Direct Reply Bar */}
                                        <form onSubmit={handleSendDirectReply} className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-3">
                                            <input
                                                type="text"
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                placeholder="Nhập nội dung phản hồi trực tiếp cho khách qua Zalo OA..."
                                                disabled={sendingReply}
                                                className="flex-1 h-11 px-4 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-sm font-medium text-slate-800 focus:outline-none focus:border-[var(--color-primary)] transition-all"
                                            />
                                            <button
                                                type="submit"
                                                disabled={sendingReply || !replyText.trim()}
                                                className="h-11 px-5 rounded-xl bg-[var(--color-primary)] hover:bg-[#9A1523] disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-sm transition-all cursor-pointer shrink-0"
                                            >
                                                <Send className="w-3.5 h-3.5" />
                                                {sendingReply ? 'Đang gửi...' : 'Gửi phản hồi'}
                                            </button>
                                        </form>
                                    </div>
                                )}

                                {activeTab === 'journey' && (
                                    <div className="animate-in fade-in slide-in-from-right-2 duration-300 pb-10">
                                        <div className="relative pl-12 space-y-12 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
                                            {user.activities && user.activities.filter((a: any) => !['user_send_text', 'sent_message', 'receive_broadcast'].includes(a.type)).length > 0 ?
                                                user.activities.filter((a: any) => !['user_send_text', 'sent_message', 'receive_broadcast'].includes(a.type)).map((act: any, idx: number) => (
                                                    <div
                                                        key={act.id || idx}
                                                        className="relative animate-in slide-in-from-left-2"
                                                        style={{ animationDelay: `${idx * 50}ms` }}
                                                    >
                                                        <div className="absolute -left-12 w-10 h-10 rounded-full border-4 border-white shadow-md flex items-center justify-center z-10">
                                                            <TimelineIcon type={act.type} />
                                                        </div>
                                                        <div className="bg-white p-5 rounded-[18px] border border-slate-100 shadow-sm group hover:border-red-200 transition-all">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <h5 className={`text-sm font-black transition-colors ${act.type === 'lead_score_sync' ? 'text-emerald-600' : 'text-slate-800'}`}>
                                                                    {getEventLabel(act.type)}: {act.reference_name || 'Hệ thống'}
                                                                </h5>
                                                                <span className="text-[10px] font-bold text-slate-300 uppercase">{formatTimeAgoShort(act.created_at)}</span>
                                                            </div>
                                                            <div className="text-xs text-slate-500 font-medium leading-relaxed">
                                                                {(() => {
                                                                    try {
                                                                        const text = typeof act.details === 'string' ? act.details : JSON.stringify(act.details);
                                                                        let jsonStartIndex = -1;
                                                                        const firstBracket = text.indexOf('[');
                                                                        const firstBrace = text.indexOf('{');

                                                                        if (firstBracket !== -1 && firstBrace !== -1) jsonStartIndex = Math.min(firstBracket, firstBrace);
                                                                        else if (firstBracket !== -1) jsonStartIndex = firstBracket;
                                                                        else if (firstBrace !== -1) jsonStartIndex = firstBrace;

                                                                        let details = typeof act.details === 'string' ? JSON.parse(act.details) : act.details;
                                                                        let prefix = '';

                                                                        if (jsonStartIndex !== -1) {
                                                                            try {
                                                                                prefix = text.substring(0, jsonStartIndex).trim();
                                                                                let jsonToParse = text.substring(jsonStartIndex).trim();

                                                                                if (!jsonToParse.endsWith(']') && !jsonToParse.endsWith('}')) {
                                                                                    const quoteCount = (jsonToParse.match(/"/g) || []).length;
                                                                                    if (quoteCount % 2 !== 0) jsonToParse += '"';

                                                                                    const openB = (jsonToParse.match(/\[/g) || []).length;
                                                                                    const closeB = (jsonToParse.match(/\]/g) || []).length;
                                                                                    const openC = (jsonToParse.match(/\{/g) || []).length;
                                                                                    const closeC = (jsonToParse.match(/\}/g) || []).length;

                                                                                    for (let i = 0; i < (openC - closeC); i++) jsonToParse += '}';
                                                                                    for (let i = 0; i < (openB - closeB); i++) jsonToParse += ']';
                                                                                }
                                                                                details = JSON.parse(jsonToParse);
                                                                            } catch (e) {
                                                                            }
                                                                        }

                                                                        if (typeof details === 'object' && details !== null) {
                                                                            return (
                                                                                <div className="space-y-1.5 mt-2 bg-slate-50 p-4 rounded-[14px] border border-slate-100">
                                                                                    {prefix && <div className="text-sm text-slate-800 whitespace-pre-wrap mb-2">{prefix}</div>}
                                                                                    {Object.entries(details).map(([key, value]: [string, any]) => (
                                                                                        <div key={key} className="flex gap-2">
                                                                                            <span className="font-black text-[10px] uppercase text-slate-400 min-w-[100px]">{key.replace(/_/g, ' ')}:</span>
                                                                                            <span className="text-slate-600 font-bold break-all">
                                                                                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                                                                            </span>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <div>
                                                                                {prefix && <div className="text-sm text-slate-800 whitespace-pre-wrap mb-2">{prefix}</div>}
                                                                                {String(details)}
                                                                            </div>
                                                                        );
                                                                    } catch (e) {
                                                                        return act.details || 'Không có chi tiết';
                                                                    }
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="py-20 text-center bg-slate-50/50 rounded-[18px] border border-dashed border-slate-200 mr-12 -ml-12 pl-12">
                                                        <History className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                                                        <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Hành trình đang trống</p>
                                                    </div>
                                                )}
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'notes' && (
                                    <div className="animate-in fade-in slide-in-from-right-2 duration-300 pb-10">
                                        <div className="space-y-6">
                                            {(() => {
                                                try {
                                                    const notesData = JSON.parse(user.notes);
                                                    if (Array.isArray(notesData)) {
                                                        const infoNotes = notesData.filter((item: any) => item.type === 'zalo_extra_info' || item.type === 'extra_info');
                                                        if (infoNotes.length === 0) return null;

                                                        return infoNotes.map((item: any, i: number) => (
                                                            <div key={i} className="p-5 bg-amber-50/30 rounded-[18px] border border-amber-100/30 animate-in slide-in-from-left duration-500">
                                                                <p className="text-[10px] font-black text-[var(--color-primary)] uppercase tracking-[0.15em] mb-2 px-1">Zalo Form Info</p>
                                                                <p className="text-sm font-bold text-slate-700 leading-relaxed shadow-sm bg-white p-4 rounded-[14px]">{item.content}</p>
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
                                                    className="w-full min-h-[150px] p-6 bg-slate-50/50 border border-slate-200 rounded-[18px] text-sm font-medium text-slate-600 focus:outline-none focus:border-[var(--color-primary)] transition-all resize-none shadow-inner mt-2"
                                                    placeholder="Nhập ghi chú quan trọng về Khách hàng này..."
                                                />
                                                <div className="mt-3 flex justify-end">
                                                    <button
                                                        onClick={handleSave}
                                                        disabled={updating}
                                                        className="px-6 py-2.5 bg-[var(--color-primary)] hover:bg-[#9A1523] text-white rounded-[14px] text-[11px] font-black uppercase tracking-widest shadow-lg shadow-red-600/20 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2"
                                                    >
                                                        <Send className="w-3.5 h-3.5" />
                                                        Lưu ghi chú
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 px-2 text-slate-400">
                                                <Info className="w-3 h-3" />
                                                <p className="text-[10px] font-bold">Thông tin này được đồng bộ với hồ sơ khách hàng.</p>
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
                            <button
                                onClick={() => setShowDeleteConfirm(true)}
                                className="inline-flex items-center justify-center font-bold rounded-xl transition-all duration-300 active:scale-95 tracking-tight bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2.5 text-sm gap-2 border-none shadow-none"
                            >
                                <Trash2 className="w-4 h-4" />
                                Xóa
                            </button>

                            <div className="flex gap-3">
                                {editMode && (
                                    <button
                                        onClick={handleSave}
                                        disabled={updating}
                                        className="inline-flex items-center justify-center font-bold rounded-xl transition-all duration-300 active:scale-95 bg-[var(--color-primary)] hover:bg-[#9A1523] text-white px-6 py-2.5 text-sm gap-2 shadow-lg shadow-red-500/20"
                                    >
                                        {updating ? 'Đang lưu...' : 'Lưu thay đổi'}
                                    </button>
                                )}
                                <button
                                    onClick={handleClose}
                                    className="inline-flex items-center justify-center font-bold rounded-xl transition-all duration-500 active:scale-95 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:border-[#9A1523] hover:text-[#9A1523] px-5 py-2.5 text-sm gap-2"
                                >
                                    Đóng
                                </button>
                            </div>
                        </div>
                    </div>

                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={handleDelete}
                title="Xóa kết nối Zalo"
                message="Bạn có chắc chắn muốn xóa kết nối Zalo này? Hành động này sẽ xóa lịch sử tin nhắn và hoạt động Zalo của người dùng này nhưng không ảnh hưởng đến hồ sơ chính."
                confirmLabel="Xác nhận xóa"
                variant="danger"
                zIndex={2147483645}
            />
        </>
    );

    return createPortal(drawerContent, getMktPortalRoot());
};

/* --- Helpers & Sub-components --- */

const ProfileTab = ({ active, onClick, label, icon: Icon, count }: any) => (
    <button
        onClick={onClick}
        className={`px-4 py-2.5 rounded-xl text-[12px] font-black flex items-center gap-2 transition-all duration-300 whitespace-nowrap shrink-0 ${active ? 'bg-white text-[var(--color-primary)] shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
    >
        <Icon className={`w-3.5 h-3.5 ${active ? 'text-[var(--color-primary)]' : 'text-slate-300'}`} />
        {label}
        {count !== undefined && count > 0 && (
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black ${active ? 'bg-red-50 text-[var(--color-primary)]' : 'bg-slate-100 text-slate-400'}`}>
                {count}
            </span>
        )}
    </button>
);

const TimelineIcon = ({ type }: { type: string }) => {
    switch (type) {
        case 'follow': return <div className="w-full h-full flex items-center justify-center rounded-full text-[var(--color-primary)] bg-orange-50"><User className="w-4 h-4" /></div>;
        case 'unfollow': return <div className="w-full h-full flex items-center justify-center rounded-full text-rose-500 bg-rose-50"><User className="w-4 h-4" /></div>;
        case 'user_send_text': return <div className="w-full h-full flex items-center justify-center rounded-full text-blue-500 bg-blue-50"><MessageCircle className="w-4 h-4" /></div>;
        case 'sent_message': return <div className="w-full h-full flex items-center justify-center rounded-full text-indigo-500 bg-indigo-50"><Send className="w-4 h-4" /></div>;
        case 'seen_broadcast': return <div className="w-full h-full flex items-center justify-center rounded-full text-emerald-500 bg-emerald-50"><MailOpen className="w-4 h-4" /></div>;
        case 'reacted_broadcast': return <div className="w-full h-full flex items-center justify-center rounded-full text-blue-500 bg-blue-50"><Activity className="w-4 h-4" /></div>;
        case 'user_submit_info': return <div className="w-full h-full flex items-center justify-center rounded-full text-purple-500 bg-purple-50"><FileText className="w-4 h-4" /></div>;
        case 'lead_score_reward': return <div className="w-full h-full flex items-center justify-center rounded-full text-[var(--color-primary)] bg-amber-50"><Star className="w-4 h-4 fill-current" /></div>;
        case 'lead_score_sync': return <div className="w-full h-full flex items-center justify-center rounded-full text-emerald-600 bg-emerald-50"><RefreshCw className="w-4 h-4" /></div>;
        default: return <div className="w-full h-full flex items-center justify-center rounded-full text-slate-400 bg-slate-50"><Clock className="w-4 h-4" /></div>;
    }
};

const getEventLabel = (type: string) => {
    switch (type) {
        case 'follow': return 'Quan tâm OA';
        case 'unfollow': return 'Bỏ quan tâm';
        case 'user_send_text': return 'KH gửi tin';
        case 'sent_message': return 'Phản hồi';
        case 'receive_broadcast': return 'Nhận tin';
        case 'seen_broadcast': return 'Đã xem';
        case 'reacted_broadcast': return 'Tương tác';
        case 'user_submit_info': return 'Gửi Form';
        case 'lead_score_reward': return 'Nhận điểm';
        case 'lead_score_sync': return 'Đồng bộ điểm';
        default: return type.toUpperCase();
    }
};

const formatTimeAgoShort = (date: string) => {
    if (!date) return '---';
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
    if (!date) return '';
    return new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
};
