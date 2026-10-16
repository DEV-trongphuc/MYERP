import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../../services/storageAdapter';
import { toast } from 'react-hot-toast';
import { Bug, Lightbulb, Heart, MessageSquare, RefreshCw, Image, ChevronDown, ChevronUp, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';

type FeedbackStatus = 'new' | 'in_review' | 'resolved' | 'closed';
type FeedbackType = 'bug' | 'suggestion' | 'praise' | 'other';

interface FeedbackItem {
    id: number;
    org_user_id: number | null;
    user_name: string | null;
    user_email: string | null;
    category_id: string | null;
    property_id: string | null;
    conversation_id: string | null;
    type: FeedbackType;
    title: string;
    description: string;
    screenshot_url: string | null;
    page_url: string | null;
    status: FeedbackStatus;
    admin_note: string | null;
    created_at: string;
}

const TYPE_META: Record<FeedbackType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
    bug: { label: 'Lỗi', icon: <Bug className="w-3.5 h-3.5" />, color: '#ef4444', bg: 'bg-red-500/10 text-red-400' },
    suggestion: { label: 'Góp ý', icon: <Lightbulb className="w-3.5 h-3.5" />, color: '#d97706', bg: 'bg-amber-600/10 text-amber-400' },
    praise: { label: 'Khen ngợi', icon: <Heart className="w-3.5 h-3.5" />, color: '#10b981', bg: 'bg-emerald-500/10 text-emerald-400' },
    other: { label: 'Khác', icon: <MessageSquare className="w-3.5 h-3.5" />, color: '#6366f1', bg: 'bg-indigo-500/10 text-indigo-400' },
};

const STATUS_META: Record<FeedbackStatus, { label: string; icon: React.ReactNode; cls: string }> = {
    new: { label: 'Mới', icon: <AlertCircle className="w-3.5 h-3.5" />, cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
    in_review: { label: 'Đang xem xét', icon: <Clock className="w-3.5 h-3.5" />, cls: 'bg-amber-600/10 text-amber-400 border-amber-600/30' },
    resolved: { label: 'Đã xử lý', icon: <CheckCircle className="w-3.5 h-3.5" />, cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    closed: { label: 'Đã đóng', icon: <XCircle className="w-3.5 h-3.5" />, cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
};

const FeedbackRow: React.FC<{
    fb: FeedbackItem;
    onUpdate: (id: number, status: FeedbackStatus, note: string) => Promise<void>;
}> = ({ fb, onUpdate }) => {
    const [expanded, setExpanded] = useState(false);
    const [status, setStatus] = useState<FeedbackStatus>(fb.status);
    const [note, setNote] = useState(fb.admin_note || '');
    const [saving, setSaving] = useState(false);
    const [lightbox, setLightbox] = useState(false);

    // Sync local state if parent refreshes the list
    useEffect(() => { setStatus(fb.status); setNote(fb.admin_note || ''); }, [fb.status, fb.admin_note]);

    const tm = TYPE_META[fb.type];
    const sm = STATUS_META[status];

    const handleSave = async () => {
        setSaving(true);
        await onUpdate(fb.id, status, note);
        setSaving(false);
    };

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden transition-all">
            {/* Row header */}
            <div
                className="flex items-start gap-3 p-4 cursor-pointer hover:bg-slate-800/30 transition-colors"
                onClick={() => setExpanded(p => !p)}
            >
                {/* Type badge */}
                <span className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold shrink-0 ${tm.bg}`}>
                    {tm.icon} {tm.label}
                </span>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-200 truncate">{fb.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-bold ${sm.cls}`}>
                            {sm.icon} {sm.label}
                        </span>
                        {fb.user_name && (
                            <span className="text-[11px] text-slate-500">{fb.user_name}</span>
                        )}
                        {fb.user_email && !fb.user_name && (
                            <span className="text-[11px] text-slate-500">{fb.user_email}</span>
                        )}
                        {!fb.user_name && !fb.user_email && (
                            <span className="text-[11px] text-slate-600 italic">Khách</span>
                        )}
                        <span className="text-[11px] text-slate-600">
                            {new Date(fb.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {fb.screenshot_url && (
                            <span className="flex items-center gap-0.5 text-[11px] text-indigo-400">
                                <Image className="w-3 h-3" /> Cònh
                            </span>
                        )}
                    </div>
                </div>

                {/* Expand toggle */}
                <div className="text-slate-600 shrink-0">
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
            </div>

            {/* Expanded body */}
            {expanded && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-800 space-y-4">
                    {/* Description */}
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Mô tả</p>
                        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{fb.description}</p>
                    </div>

                    {/* Screenshot */}
                    {fb.screenshot_url && (
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-2">Screenshot</p>
                            <img
                                src={fb.screenshot_url}
                                alt="Screenshot"
                                className="max-h-48 rounded-xl border border-slate-700 cursor-zoom-in object-cover"
                                onClick={() => setLightbox(true)}
                            />
                        </div>
                    )}

                    {/* Page URL */}
                    {fb.page_url && (
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Trang</p>
                            <a href={fb.page_url} target="_blank" rel="noreferrer" className="text-xs text-indigo-400 hover:underline break-all">{fb.page_url}</a>
                        </div>
                    )}

                    {/* Admin controls */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-slate-800">
                        <div className="flex-1">
                            <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Ghi chú nội bộ</p>
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Ghi chú xử lý..."
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-xs outline-none resize-none focus:border-indigo-500 placeholder:text-slate-600"
                            />
                        </div>
                        <div className="sm:w-44 flex flex-col gap-2.5">
                            <div>
                                <p className="text-[11px] font-black uppercase tracking-widest text-slate-500 mb-1">Trạng thái</p>
                                <select
                                    value={status}
                                    onChange={e => setStatus(e.target.value as FeedbackStatus)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-200 text-xs outline-none focus:border-indigo-500"
                                >
                                    <option value="new">Mới</option>
                                    <option value="in_review">Đang xem xét</option>
                                    <option value="resolved">Đã xử lý</option>
                                    <option value="closed">Đã đóng</option>
                                </select>
                            </div>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all active:scale-95 disabled:opacity-60"
                            >
                                {saving ? 'Đang lưu...' : 'Lưu'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Lightbox */}
            {lightbox && fb.screenshot_url && (
                <div className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center p-4" onClick={() => setLightbox(false)}>
                    <img src={fb.screenshot_url} alt="Screenshot full" className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain" />
                </div>
            )}
        </div>
    );
};

const FeedbackAdminPanel: React.FC = () => {
    const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [typeFilter, setTypeFilter] = useState<string>('');

    const fetchFeedbacks = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '50', offset: '0' });
            if (statusFilter) params.set('status', statusFilter);
            if (typeFilter) params.set('type', typeFilter);
            const res = await api.get<any>(`ai_org_chatbot?action=list_feedback&${params}`);
            if (res.success) {
                // Normalize: API may return array directly, or {items:[], total:N}, or {data:[]}
                const raw = res.data;
                const list: FeedbackItem[] = Array.isArray(raw)
                    ? raw
                    : Array.isArray(raw?.items)
                        ? raw.items
                        : Array.isArray(raw?.data)
                            ? raw.data
                            : [];
                setFeedbacks(list);
                setTotal(res.total ?? raw?.total ?? list.length);
            } else {
                toast.error(res.message || 'Không thể tải feedback');
            }
        } catch {
            toast.error('Lỗi kết nối');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, typeFilter]);

    // Debounce filter changes — only fetch after 300ms idle
    useEffect(() => {
        const t = setTimeout(() => { fetchFeedbacks(); }, 300);
        return () => clearTimeout(t);
    }, [fetchFeedbacks]);

    const handleUpdate = useCallback(async (id: number, status: FeedbackStatus, note: string) => {
        try {
            const res = await api.post<any>('ai_org_chatbot?action=update_feedback', { id, status, admin_note: note });
            if (res.success) {
                toast.success('Đã cập nhật');
                setFeedbacks(prev => prev.map(f => f.id === id ? { ...f, status, admin_note: note } : f));
            } else {
                toast.error('Lỗi cập nhật');
            }
        } catch {
            toast.error('Lỗi kết nối');
        }
    }, []);

    // Summary counts — guard against non-array state during initial render
    const counts = (Array.isArray(feedbacks) ? feedbacks : []).reduce((acc, f) => {
        acc[f.status] = (acc[f.status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h2 className="text-xl font-black text-white">Feedback từ người dùng</h2>
                    <p className="text-slate-500 text-sm mt-0.5">{total} phản hồi tổng cộng</p>
                </div>
                <button
                    onClick={fetchFeedbacks}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-bold transition-all active:scale-95"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Làm mới
                </button>
            </div>

            {/* Status summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(Object.entries(STATUS_META) as [FeedbackStatus, typeof STATUS_META[FeedbackStatus]][]).map(([k, m]) => (
                    <div key={k} className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${m.cls}`}>
                        {m.icon}
                        <div>
                            <p className="text-[13px] font-bold">{counts[k] || 0}</p>
                            <p className="text-[10px] opacity-70">{m.label}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-3 flex-wrap">
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-sm outline-none focus:border-indigo-500"
                >
                    <option value="">Tất cả Trạng thái</option>
                    <option value="new">Mới</option>
                    <option value="in_review">Đang xem xét</option>
                    <option value="resolved">Đã xử lý</option>
                    <option value="closed">Đã đóng</option>
                </select>
                <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl border border-slate-700 bg-slate-900 text-slate-300 text-sm outline-none focus:border-indigo-500"
                >
                    <option value="">Tất cả loại</option>
                    <option value="bug">Báo lỗi</option>
                    <option value="suggestion">Góp ý</option>
                    <option value="praise">Khen ngợi</option>
                    <option value="other">Khác</option>
                </select>
            </div>

            {/* List */}
            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 rounded-xl bg-slate-800/50 animate-pulse" />
                    ))}
                </div>
            ) : feedbacks.length === 0 ? (
                <div className="text-center py-16">
                    <MessageSquare className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                    <p className="text-slate-500 font-medium">Chưa có feedback nào</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {feedbacks.map(fb => (
                        <FeedbackRow key={fb.id} fb={fb} onUpdate={handleUpdate} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default FeedbackAdminPanel;
