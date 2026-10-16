import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, Bug, Lightbulb, Heart, MessageSquare, Upload, Clipboard, Trash2, Send, CheckCircle } from 'lucide-react';
import { api } from '../../../services/storageAdapter';
import { toast } from 'react-hot-toast';

interface FeedbackModalProps {
    isOpen: boolean;
    onClose: () => void;
    isDarkTheme?: boolean;
    categoryId?: string;
    botId?: string;
    conversationId?: string;
    brandColor?: string;
}

type FeedbackType = 'bug' | 'suggestion' | 'praise' | 'other';

const FEEDBACK_TYPES: { id: FeedbackType; label: string; icon: React.ReactNode; desc: string; color: string }[] = [
    { id: 'bug', label: 'Báo lỗi', icon: <Bug className="w-4 h-4" />, desc: 'Chức năng bị hỏng hoặc hoạt động sai', color: '#ef4444' },
    { id: 'suggestion', label: 'Góp ý', icon: <Lightbulb className="w-4 h-4" />, desc: 'Ý tưởng cải thiện sản phẩm', color: '#d97706' },
    { id: 'praise', label: 'Khen ngợi', icon: <Heart className="w-4 h-4" />, desc: 'Điều bạn thích ở sản phẩm', color: '#10b981' },
    { id: 'other', label: 'Khác', icon: <MessageSquare className="w-4 h-4" />, desc: 'Bất kỳ phản hồi nào khác', color: '#6366f1' },
];

const FeedbackModal: React.FC<FeedbackModalProps> = ({
    isOpen,
    onClose,
    isDarkTheme,
    categoryId,
    botId,
    conversationId,
    brandColor = '#6366f1',
}) => {
    const [type, setType] = useState<FeedbackType>('bug');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [screenshot, setScreenshot] = useState<string | null>(null); // base64 data URI
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [dragging, setDragging] = useState(false);
    const pasteZoneRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cleanup auto-close timer on unmount
    useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setType('bug');
            setTitle('');
            setDescription('');
            setScreenshot(null);
            setSubmitted(false);
        }
    }, [isOpen]);

    // Global paste listener for screenshot
    useEffect(() => {
        if (!isOpen) return;
        const handlePaste = (e: ClipboardEvent) => {
            const items = e.clipboardData?.items;
            if (!items) return;
            for (const item of Array.from(items)) {
                if (item.type.startsWith('image/')) {
                    const file = item.getAsFile();
                    if (file) readImageFile(file);
                    break;
                }
            }
        };
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [isOpen]);

    const readImageFile = useCallback((file: File) => {
        // Guard: max 5 MB
        if (file.size > 5 * 1024 * 1024) {
            toast.error('Ảnh quá lớn (tối đa 5 MB)');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            if (result) setScreenshot(result);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleFileDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) readImageFile(file);
    }, []);

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) readImageFile(file);
    };

    const handleSubmit = async () => {
        if (!title.trim()) { toast.error('Vui lòng nhập tiêu đề'); return; }
        if (!description.trim()) { toast.error('Vui lòng mô tả vấn đề'); return; }

        setSubmitting(true);
        try {
            const res = await api.post<any>('ai_org_chatbot?action=submit_feedback', {
                type,
                title: title.trim(),
                description: description.trim(),
                category_id: categoryId,
                property_id: botId,
                conversation_id: conversationId,
                page_url: window.location.href,
                screenshot_base64: screenshot,
            });
            if (res.success) {
                setSubmitted(true);
                closeTimerRef.current = setTimeout(onClose, 2500);
            } else {
                toast.error(res.message || 'Gửi feedback thất bại');
            }
        } catch (e) {
            toast.error('Lỗi kết nối');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const dk = isDarkTheme;
    const selectedMeta = FEEDBACK_TYPES.find(t => t.id === type)!;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

            {/* Modal */}
            <div
                className={`relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ${dk ? 'bg-[#0D1117] border border-slate-800' : 'bg-white border border-slate-100'}`}
                onClick={e => e.stopPropagation()}
                style={{ boxShadow: `0 25px 60px rgba(0,0,0,0.4), 0 0 0 1px ${selectedMeta.color}22` }}
            >
                {/* Colored top stripe */}
                <div className="h-1 w-full transition-colors duration-300" style={{ background: `linear-gradient(90deg, ${selectedMeta.color}, ${brandColor})` }} />

                {/* Header */}
                <div className={`flex items-center justify-between px-6 py-4 border-b ${dk ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white transition-colors duration-300" style={{ backgroundColor: selectedMeta.color }}>
                            {selectedMeta.icon}
                        </div>
                        <div>
                            <h2 className={`font-bold text-base ${dk ? 'text-white' : 'text-slate-800'}`}>Gửi Feedback</h2>
                            <p className={`text-[11px] ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Giúp chúng tôi cải thiện sản phẩm</p>
                        </div>
                    </div>
                    <button onClick={onClose} className={`p-2 rounded-xl transition-all active:scale-90 ${dk ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-400'}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {submitted ? (
                    /* Success state */
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-emerald-500/10 text-emerald-500 animate-bounce">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <div className="text-center">
                            <p className={`font-bold text-lg ${dk ? 'text-white' : 'text-slate-800'}`}>Cảm ơn bạn! 🎉</p>
                            <p className={`text-sm mt-1 ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Feedback của bạn đã được ghi nhận.</p>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">

                        {/* Type selector */}
                        <div>
                            <label className={`text-[11px] font-black uppercase tracking-widest mb-2 block ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Loại phản hồi</label>
                            <div className="grid grid-cols-4 gap-2">
                                {FEEDBACK_TYPES.map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => setType(t.id)}
                                        title={t.desc}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${type === t.id
                                            ? 'shadow-lg scale-[1.03]'
                                            : (dk ? 'border-slate-800 hover:border-slate-700' : 'border-slate-100 hover:border-slate-200')
                                            }`}
                                        style={type === t.id ? { borderColor: t.color, backgroundColor: t.color + '18', color: t.color } : {}}
                                    >
                                        <span className={type === t.id ? '' : (dk ? 'text-slate-500' : 'text-slate-400')}>{t.icon}</span>
                                        <span className={`text-[10px] font-bold ${type === t.id ? '' : (dk ? 'text-slate-400' : 'text-slate-500')}`}>{t.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Title */}
                        <div>
                            <label className={`text-[11px] font-black uppercase tracking-widest mb-2 block ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Tiêu đề *</label>
                            <input
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder={type === 'bug' ? 'VD: Nút gửi không hoạt động sau khi upload file' : 'Tóm tắt ngắn gọn...'}
                                maxLength={120}
                                className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all ${dk
                                    ? 'bg-slate-900 border-slate-700 text-slate-200 focus:border-slate-500 placeholder:text-slate-600'
                                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-slate-400 focus:bg-white placeholder:text-slate-400'
                                    }`}
                            />
                        </div>

                        {/* Description */}
                        <div>
                            <label className={`text-[11px] font-black uppercase tracking-widest mb-2 block ${dk ? 'text-slate-400' : 'text-slate-500'}`}>Mô tả chi tiết *</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder={type === 'bug'
                                    ? 'Mô tả vấn đề, các bước tái hiện, kết quả mong đợi...'
                                    : type === 'suggestion'
                                        ? 'Tính năng bạn muốn thấy, lý do tại sao hữu ích...'
                                        : 'Chia sẻ cảm nhận của bạn...'}
                                rows={4}
                                className={`w-full px-4 py-2.5 rounded-xl border text-sm outline-none transition-all resize-none ${dk
                                    ? 'bg-slate-900 border-slate-700 text-slate-200 focus:border-slate-500 placeholder:text-slate-600'
                                    : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-slate-400 focus:bg-white placeholder:text-slate-400'
                                    }`}
                            />
                        </div>

                        {/* Screenshot zone */}
                        <div>
                            <label className={`text-[11px] font-black uppercase tracking-widest mb-2 block ${dk ? 'text-slate-400' : 'text-slate-500'}`}>
                                Screenshot <span className={`font-normal normal-case tracking-normal ml-1 ${dk ? 'text-slate-600' : 'text-slate-400'}`}>(tuỳ chọn)</span>
                            </label>

                            {screenshot ? (
                                /* Preview */
                                <div className="relative group rounded-xl overflow-hidden border border-slate-700">
                                    <img src={screenshot} alt="Screenshot preview" className="w-full max-h-48 object-cover" />
                                    <button
                                        onClick={() => setScreenshot(null)}
                                        className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                        title="Xóa screenshot"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                /* Drop / paste zone */
                                <div
                                    ref={pasteZoneRef}
                                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={handleFileDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer transition-all ${dragging
                                        ? 'border-brand bg-brand/5 scale-[1.01]'
                                        : (dk ? 'border-slate-700 hover:border-slate-600 hover:bg-slate-900/50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50')
                                        }`}
                                >
                                    <div className={`flex items-center gap-2 ${dk ? 'text-slate-500' : 'text-slate-400'}`}>
                                        <Clipboard className="w-4 h-4" />
                                        <span className="text-sm font-medium">Dán ảnh (Ctrl+V)</span>
                                        <span className={`text-xs ${dk ? 'text-slate-600' : 'text-slate-300'}`}>hoặc</span>
                                        <Upload className="w-4 h-4" />
                                        <span className="text-sm font-medium">Upload file</span>
                                    </div>
                                    <p className={`text-[11px] ${dk ? 'text-slate-600' : 'text-slate-300'}`}>PNG, JPG, GIF, WEBP</p>
                                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileInput} />
                                </div>
                            )}
                        </div>

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-60"
                            style={{ background: `linear-gradient(135deg, ${selectedMeta.color}, ${brandColor})` }}
                        >
                            {submitting ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                    </svg>
                                    Đang gửi...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Gửi Feedback
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FeedbackModal;
