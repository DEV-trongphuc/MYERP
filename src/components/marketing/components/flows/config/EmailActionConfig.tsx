
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Eye, Layout, Mail, Info, User, ShieldCheck, Zap, FileText, Code, Check, Braces, ChevronDown, Paperclip, File as FileIcon, X, Filter, Plus, AlertCircle, Loader2, Layers, Edit3 } from 'lucide-react';
import { api } from '../../../services/storageAdapter';
import { Template, Attachment, TemplateGroup } from '../../../types';
import Input from '../../common/Input';
import Button from '../../common/Button';
import Select from '../../common/Select';
import TemplateSelector from '../TemplateSelector';
import EmailPreviewDrawer from './EmailPreviewDrawer';
import EmailEditor from '../../templates/EmailEditor/index';
import toast from 'react-hot-toast';
import ConfirmModal from '../../common/ConfirmModal';
import { MultiFileUploadModal } from '../../campaigns/MultiFileUploadModal';
import FileLibraryModal from '../../common/FileLibraryModal';
import { useSettings } from '../../contexts/SettingsContext';
import { getMktPortalRoot } from '../../../utils/portalRoot';

interface EmailActionConfigProps {
    config: Record<string, any>;
    onChange: (newConfig: Record<string, any>) => void;
    disabled?: boolean;
}

const MERGE_TAGS = [
    { label: 'Họ tên', value: '{{full_name}}' },
    { label: 'Tên', value: '{{first_name}}' },
    { label: 'Họ', value: '{{last_name}}' },
    { label: 'Email', value: '{{email}}' },
    { label: 'Công ty', value: '{{company}}' },
    { label: 'Chức danh', value: '{{job_title}}' },
    { label: 'Số điện thoại', value: '{{phone}}' },
    { label: 'Hủy đăng ký (Bắt buộc)', value: '{{unsubscribe_url}}' },
];

const EmailActionConfig: React.FC<EmailActionConfigProps> = ({ config, onChange, disabled }) => {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [groups, setGroups] = useState<TemplateGroup[]>([]);
    const [isEditingTemplate, setIsEditingTemplate] = useState(false);
    // [FIX] Dùng global SettingsContext thay vì fetch settings riêng mỗi lần mở node
    const { senderEmails } = useSettings();
    const verifiedEmails = senderEmails.map(e => ({ value: e, label: e }));
    const [showPicker, setShowPicker] = useState(false);
    const [previewData, setPreviewData] = useState<{ template: Template | null, html?: string } | null>(null);
    const [showPersonalization, setShowPersonalization] = useState<{ target: 'subject' | 'body' | null }>({ target: null });

    // HTML Mode State
    const [showVarDropdown, setShowVarDropdown] = useState(false);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);

    // Attachment States
    const [attachments, setAttachments] = useState<Attachment[]>(config.attachments || []);
    const [isUploading, setIsUploading] = useState(false);
    const [isPersonalizedMode, setIsPersonalizedMode] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    // [FIX] Template deleted flag
    const [templateDeleted, setTemplateDeleted] = useState(false);

    // Simple UUID fallback
    const generateId = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    // 'template' or 'html'
    const sourceMode = config.sourceMode || (config.templateId ? 'template' : (config.customHtml ? 'html' : 'template'));

    useEffect(() => {
        api.get<Template[]>('templates').then(res => {
            if (res.success) {
                const personalTemplates = res.data.filter(t => !t.id.startsWith('sys_'));
                setTemplates(personalTemplates);
            }
        });
        api.get<TemplateGroup[]>('template_groups').then(res => {
            if (res.success) setGroups(res.data);
        });
    }, []);  

    // [AUTO-SELECT] Nếu bước chưa có email người gửi HOẶC email đã lưu không còn tồn tại → tự chọn lại
    useEffect(() => {
        if (senderEmails.length === 0) return;
        if (!config.senderEmail || !senderEmails.includes(config.senderEmail)) {
            const lastUsed = localStorage.getItem('mailflow_last_sender_email');
            const defaultEmail = (lastUsed && senderEmails.includes(lastUsed)) ? lastUsed : senderEmails[0];
            onChange({ ...config, senderEmail: defaultEmail });
        }
    }, [senderEmails]); // eslint-disable-line react-hooks/exhaustive-deps

    // Sync attachments with parent config
    const initialAttachmentsRef = useRef(attachments);
    useEffect(() => {
        if (attachments !== initialAttachmentsRef.current) {
            onChange({ ...config, attachments: attachments });
        }
    }, [attachments]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch full template data when templateId changes
    useEffect(() => {
        if (config.templateId && sourceMode === 'template') {
            setTemplateDeleted(false); // Reset khi templateId thay đổi
            api.get<Template>(`templates?id=${config.templateId}`).then(res => {
                if (res.success && res.data) {
                    // Update templates array with full data
                    setTemplates(prev => {
                        const index = prev.findIndex(t => t.id === config.templateId);
                        if (index >= 0) {
                            const updated = [...prev];
                            updated[index] = res.data;
                            return updated;
                        }
                        return [...prev, res.data];
                    });
                } else {
                    // Template đã bị xóa hoặc không tồn tại
                    setTemplateDeleted(true);
                }
            });
        } else {
            setTemplateDeleted(false);
        }
    }, [config.templateId, sourceMode]);

    const selectedTemplate = templates.find(t => t.id === config.templateId);

    const injectTag = (tag: string, target?: 'subject' | 'body') => {
        if (disabled) return;

        // Determine target based on context
        if (target) {
            const targetKey = target === 'subject' ? 'subject' : 'contentBody';
            const current = config[targetKey] || '';
            onChange({ ...config, [targetKey]: current + ' ' + tag });
            setShowPersonalization({ target: null });
            return;
        }

        // Default to customHtml if in HTML mode and no specific target
        if (sourceMode === 'html') {
            const textarea = textAreaRef.current;
            if (textarea) {
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const current = config.customHtml || '';
                const newText = current.substring(0, start) + tag + current.substring(end);
                onChange({ ...config, customHtml: newText });
                setShowVarDropdown(false);
            } else {
                const current = config.customHtml || '';
                onChange({ ...config, customHtml: current + tag });
            }
        }
    };

    const handleModeChange = (mode: 'template' | 'html') => {
        onChange({ ...config, sourceMode: mode });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled || !e.target.files || e.target.files.length === 0) return;

        const files = Array.from(e.target.files) as File[];

        if (isPersonalizedMode) {
            const invalidFiles = files.filter(file => !/_[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(file.name));
            if (invalidFiles.length > 0) {
                const invalidNames = invalidFiles.map(f => f.name).join('\n- ');
                toast.error(`LỖI ĐỊNH DẠNG TÊN FILE!\n\nCác file sau không hợp lệ ở chế độ "Gửi Riêng":\n- ${invalidNames}\n\nYêu cầu: Tên file phải chứa Email (VD: Hopdong_khachA@gmail.com.pdf)`);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
        }

        setIsUploading(true);
        const newAttachments: Attachment[] = [];


        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                const result = await api.post<any>('upload', formData);

                if (result.success && result.data) {
                    newAttachments.push({
                        id: generateId(),
                        name: result.data.name,
                        url: result.data.url,
                        size: result.data.size,
                        type: result.data.type,
                        logic: isPersonalizedMode ? 'match_email' : 'all',
                        path: result.data.path // Save internal path for mailer
                    });
                } else {
                    console.error(`Upload failed for ${file.name}: ${result.message}`);
                }
            } catch (error) {
                console.error(`Upload error for ${file.name}`, error);
            }
        }

        if (newAttachments.length > 0) {
            setAttachments(prev => [...prev, ...newAttachments]);
        } else {
            toast.error('Không upload được file nào. Vui lòng kiểm tra kết nối.');
        }

        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const [attachmentToDelete, setAttachmentToDelete] = useState<string | null>(null);

    const executeRemoveAttachment = async () => {
        if (disabled || !attachmentToDelete) return;
        const id = attachmentToDelete;
        setAttachmentToDelete(null);

        const attachToRemove = attachments.find(a => a.id === id);

        // Remove from UI immediately for snappy feeling
        setAttachments(prev => prev.filter(a => a.id !== id));

        // Delete from server to save space
        if (attachToRemove && attachToRemove.path) {
            try {
                await api.post('delete_attachment', { path: attachToRemove.path });
            } catch (err) {
                console.error("Failed to auto-remove attachment from host:", err);
            }
        }
    };


    return (
        <div className="space-y-6">
            {/* 1. SENDER & SUBJECT */}
            <div className="space-y-4">
                <div className="relative">
                    <Input
                        label="Tiêu đề Email (Subject)"
                        placeholder="VD: Quà tặng cho {{first_name}}..."
                        value={config.subject || ''}
                        onChange={(e) => onChange({ ...config, subject: e.target.value })}
                        error={!config.subject ? "Tiêu đề không được để trống" : ""}
                        disabled={disabled}
                    />
                    <button
                        onClick={() => setShowPersonalization({ target: showPersonalization.target === 'subject' ? null : 'subject' })}
                        className={`absolute right-4 top-[32px] p-1.5 transition-colors ${showPersonalization.target === 'subject' ? 'text-[var(--color-primary)]' : 'text-slate-400 hover:text-[var(--color-primary)]'}`}
                        title="Cá nhân hóa tiêu đề"
                        disabled={disabled}
                    >
                        <User className="w-4 h-4" />
                    </button>

                    {showPersonalization.target === 'subject' && (
                        <div className="absolute right-0 top-20 z-50 w-56 bg-white rounded-[14px] shadow-2xl border border-slate-100 p-2 animate-in zoom-in-95">
                            <p className="text-[9px] font-black uppercase text-slate-400 p-2 tracking-widest">Cá nhân hóa tiêu đề</p>
                            <div className="grid grid-cols-1 gap-1">
                                {MERGE_TAGS.map(tag => (
                                    <button
                                        key={tag.value}
                                        onClick={() => injectTag(tag.value, 'subject')}
                                        className="w-full text-left px-3 py-2 rounded-[var(--radius-md)] hover:bg-rose-50/50 text-xs font-bold text-slate-700 transition-colors flex justify-between items-center"
                                    >
                                        {tag.label} <code className="text-[9px] text-[var(--color-primary)] font-mono">{tag.value}</code>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2 ml-1">
                        <label className="block text-sm font-bold text-slate-700">Chọn Email gửi đi</label>
                        <div className="group relative cursor-help">
                            <Info className="w-4 h-4 text-slate-400 hover:text-blue-500 transition-colors" />
                            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-64 p-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl z-50 text-center animate-in fade-in zoom-in slide-in-from-bottom-2">
                                Các email này đã được xác thực trong phần Cài đặt. Nếu chưa có, hãy vào Cài đặt để thêm nhé.
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {verifiedEmails.length > 0 ? verifiedEmails.map((email, index) => (
                            <button
                                key={email.value}
                                onClick={() => {
                                    if (!disabled) {
                                        onChange({ ...config, senderEmail: email.value });
                                        // Lưu lại để các bước email sau tự kế thừa
                                        localStorage.setItem('mailflow_last_sender_email', email.value);
                                    }
                                }}
                                className={`flex items-center justify-between p-4 rounded-[14px] border-2 transition-all text-left ${config.senderEmail === email.value ? 'border-[#2563eb] bg-blue-50/40 ring-4 ring-blue-50' : 'border-slate-100 bg-white hover:border-slate-200'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                disabled={disabled}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-[var(--radius-md)] ${config.senderEmail === email.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                        <ShieldCheck className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-slate-800">{email.label}</p>
                                        <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center">
                                            Đã xác minh
                                            {index === 0 && <span className="ml-2 text-[9px] text-blue-600 font-bold uppercase tracking-widest bg-blue-100/80 border border-blue-200/50 px-2 py-0.5 rounded-full shrink-0">Mặc định</span>}
                                        </p>
                                    </div>
                                </div>
                                {config.senderEmail === email.value && <Zap className="w-4 h-4 text-blue-600 fill-blue-600" />}
                            </button>
                        )) : (
                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-[14px] flex items-center gap-3 text-rose-600">
                                <Info className="w-5 h-5 shrink-0" />
                                <p className="text-xs font-bold">Chưa có email xác minh. Hãy vào Cài đặt để thêm.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. CONTENT SOURCE SELECTOR */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center gap-2 ml-1">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest block">Nội dung Email</label>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[9px] font-black uppercase rounded-full tracking-widest">Thiết kế chuẩn</span>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-[var(--radius-md)]">
                    <button
                        onClick={() => handleModeChange('template')}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${sourceMode === 'template' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        disabled={disabled}
                    >
                        <Layout className="w-3.5 h-3.5" /> Chọn Mẫu (Visual)
                    </button>
                    <button
                        onClick={() => handleModeChange('html')}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${sourceMode === 'html' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        disabled={disabled}
                    >
                        <Code className="w-3.5 h-3.5" /> HTML Code
                    </button>
                </div>

                {sourceMode === 'template' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        {/* Cảnh báo khi template đã bị xóa */}
                        {templateDeleted && (
                            <div className="flex items-start gap-3 p-4 bg-rose-50 border-2 border-rose-200 rounded-[14px] animate-in fade-in">
                                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-rose-700">⚠️ Mẫu email đã bị xóa!</p>
                                    <p className="text-xs text-rose-600 mt-1">
                                        Mẫu email được chọn cho bước này không còn tồn tại trong hệ thống. Email sẽ <strong>không gửi được</strong> cho đến khi chọn lại mẫu mới.
                                    </p>
                                    <button
                                        onClick={() => { onChange({ ...config, templateId: undefined }); setTemplateDeleted(false); setShowPicker(true); }}
                                        className="mt-2 text-xs font-bold text-rose-700 underline hover:text-rose-900"
                                        disabled={disabled}
                                    >
                                        Chọn mẫu khác ngay
                                    </button>
                                </div>
                            </div>
                        )}
                        {selectedTemplate ? (
                            <div className="group relative rounded-xl border-2 border-[#2563eb]/20 hover:border-[#2563eb] transition-all overflow-hidden bg-white shadow-lg hover:shadow-xl">
                                <div className="aspect-[16/9] bg-slate-50 relative overflow-hidden">
                                    {selectedTemplate.htmlContent ? (
                                        <iframe
                                            srcDoc={selectedTemplate.htmlContent}
                                            className="w-full h-full pointer-events-none scale-[0.4] origin-top-left"
                                            style={{ width: '250%', height: '250%' }}
                                            sandbox="allow-same-origin"
                                            title="Email Preview"
                                        />
                                    ) : (
                                        <img src={selectedTemplate.thumbnail} className="w-full h-full object-cover transition-all duration-500 opacity-80 group-hover:opacity-100" alt={selectedTemplate.name} />
                                    )}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />
                                    <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                                        <div>
                                            <h4 className="font-bold text-white text-sm drop-shadow-lg">{selectedTemplate.name}</h4>
                                            <p className="text-[9px] font-black text-blue-300 uppercase tracking-widest drop-shadow">{selectedTemplate.category}</p>
                                        </div>
                                        <div className="flex gap-2 flex-nowrap shrink-0 ml-4 max-w-full overflow-x-auto pb-1 custom-scrollbar">
                                            <button onClick={() => setShowPicker(true)} className="px-3 py-2 bg-slate-900/50 backdrop-blur-md text-white rounded-[var(--radius-md)] text-[10px] font-black uppercase hover:bg-slate-800 transition-all whitespace-nowrap shadow-sm shrink-0 flex items-center" title="Đổi sang mẫu email khác">Đổi mẫu</button>
                                            <button
                                                onClick={() => setIsEditingTemplate(true)}
                                                className="px-3 py-2 bg-white text-[#2563eb] rounded-[var(--radius-md)] text-[10px] font-black uppercase hover:bg-blue-50 transition-all flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0"
                                                title="Sửa mẫu trực tiếp"
                                            >
                                                <Edit3 className="w-3.5 h-3.5" /> Sửa mẫu
                                            </button>
                                            <button
                                                onClick={async () => {
                                                    // Fetch full template data with htmlContent
                                                    const res = await api.get<Template>(`templates?id=${selectedTemplate.id}`);
                                                    if (res.success && res.data) {
                                                        setPreviewData({ template: res.data });
                                                    } else {
                                                        setPreviewData({ template: selectedTemplate });
                                                    }
                                                }}
                                                className="px-3 py-2 bg-blue-600 text-white rounded-[var(--radius-md)] text-[10px] font-black uppercase hover:bg-blue-700 transition-all flex items-center gap-1 shadow-sm whitespace-nowrap shrink-0"
                                                title="Xem trước mẫu"
                                            >
                                                <Eye className="w-3.5 h-3.5" /> Xem
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowPicker(true)}
                                className={`w-full py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 text-slate-400 flex flex-col items-center justify-center gap-3 hover:bg-white hover:border-blue-300 hover:text-blue-600 transition-all group shadow-inner ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                disabled={disabled}
                            >
                                <div className="p-3 bg-white rounded-[var(--radius-md)] shadow-sm group-hover:scale-110 transition-transform"><Layout className="w-6 h-6" /></div>
                                <span className="text-xs font-bold uppercase tracking-wider">Chọn mẫu từ thư viện</span>
                            </button>
                        )}
                    </div>
                )}

                {/* MODE: HTML CODE */}
                {sourceMode === 'html' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                        <div className="relative">
                            <div className="absolute top-0 right-0 z-10 flex gap-2">
                                {/* VARIABLE DROPDOWN */}
                                <div className="relative">
                                    <button
                                        onClick={() => !disabled && setShowVarDropdown(!showVarDropdown)}
                                        disabled={disabled}
                                        className="bg-slate-700 text-white px-3 py-1.5 rounded-bl-xl text-[10px] font-bold uppercase hover:bg-slate-600 transition-colors flex items-center gap-1 border-r border-slate-600"
                                    >
                                        <Braces className="w-3.5 h-3.5 text-[#2563eb]" />
                                        Biến động (Click to Insert)
                                        <ChevronDown className="w-3 h-3 opacity-50 ml-1" />
                                    </button>
                                    {showVarDropdown && (
                                        <>
                                            <div className="fixed inset-0 z-20" onClick={() => setShowVarDropdown(false)}></div>
                                            <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-[14px] shadow-xl border border-slate-100 overflow-hidden z-30 animate-in fade-in zoom-in-95">
                                                <div className="bg-slate-50 px-4 py-2 border-b border-slate-100">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Click để chèn</p>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto custom-scrollbar p-1">
                                                    {MERGE_TAGS.map((tag) => (
                                                        <button
                                                            key={tag.value}
                                                            onClick={() => injectTag(tag.value)}
                                                            className="w-full text-left px-4 py-3 hover:bg-slate-50 flex items-center justify-between group transition-colors rounded-lg"
                                                        >
                                                            <span className="text-xs font-bold text-slate-700">{tag.label}</span>
                                                            <code className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono group-hover:text-[var(--color-primary)] group-hover:bg-rose-50/50">{tag.value}</code>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button
                                    onClick={() => setPreviewData({ template: null, html: config.customHtml })}
                                    className="bg-blue-600 text-white px-3 py-1.5 rounded-bl-xl text-[10px] font-bold uppercase hover:bg-blue-700 transition-colors flex items-center gap-1"
                                >
                                    <Eye className="w-3 h-3" /> Preview HTML
                                </button>
                            </div>
                            <textarea
                                ref={textAreaRef}
                                className="w-full h-64 bg-[#1e293b] text-indigo-100 font-mono text-xs p-4 pt-10 rounded-[14px] outline-none border-2 border-transparent focus:border-blue-500 transition-all resize-y leading-relaxed custom-scrollbar"
                                placeholder="<html><body><h1>Paste your HTML here...</h1></body></html>"
                                value={config.customHtml || ''}
                                onChange={(e) => onChange({ ...config, customHtml: e.target.value })}
                                spellCheck={false}
                                disabled={disabled}
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* 3. ATTACHMENTS SECTION */}
            <div className="pt-4 border-t border-slate-100 space-y-4">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest block ml-1">Tệp đính kèm (Attachments)</label>
                <div className="space-y-4">
                    {/* Toggle for Personalized Mode */}
                    <div className={`mb-4 p-4 rounded-[14px] border-2 transition-all flex items-center justify-between cursor-pointer ${isPersonalizedMode ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50 border-slate-100'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`} onClick={() => !disabled && setIsPersonalizedMode(!isPersonalizedMode)}>
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-6 rounded-full p-1 transition-colors duration-300 flex items-center ${isPersonalizedMode ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                                <div className="w-4 h-4 bg-white rounded-full shadow-md"></div>
                            </div>
                            <div>
                                <p className={`text-xs font-bold ${isPersonalizedMode ? 'text-blue-700' : 'text-slate-600'}`}>Bật đã gửi file khớp cá nhân</p>
                                {isPersonalizedMode && <p className="text-[9px] text-blue-500 font-medium mt-0.5">Tự động tìm file chứa Email Khách hàng</p>}
                            </div>
                        </div>
                        {isPersonalizedMode ? <Filter className="w-5 h-5 text-blue-500" /> : <Layers className="w-5 h-5 text-slate-400" />}
                    </div>

                    {/* Personalized Mode Info */}
                    {isPersonalizedMode && (
                        <div className="p-4 bg-blue-50/50 border border-blue-100/50 rounded-[14px] flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                            <p className="text-[10px] text-blue-700 font-medium leading-relaxed italic">
                                Khi chế độ này BẬT, tên file đính kèm phải chứa địa chỉ email của người nhận (VD: `invoice_john@example.com.pdf`). File chỉ được gửi nếu khớp email.
                            </p>
                        </div>
                    )}

                    {/* Upload + Library Buttons */}
                    <div className={`flex gap-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        {/* Upload new file */}
                        <div
                            onClick={() => {
                                if (disabled) return;
                                if (isPersonalizedMode) setIsUploadModalOpen(true);
                                else fileInputRef.current?.click();
                            }}
                            className="flex-1 cursor-pointer py-3.5 border-2 border-dashed rounded-[14px] flex items-center justify-center gap-2 text-slate-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/30 transition-all"
                        >
                            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            <span className="text-[10px] font-bold uppercase">
                                {isPersonalizedMode ? 'Upload (Cá nhân)' : 'Upload File'}
                            </span>
                            {!isPersonalizedMode && <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} disabled={isUploading || disabled} />}
                        </div>

                        {/* Pick from library */}
                        <button
                            type="button"
                            onClick={() => !disabled && setIsLibraryOpen(true)}
                            className="px-4 py-3.5 border-2 border-dashed border-blue-200 rounded-[14px] flex items-center gap-1.5 text-blue-500 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-50/40 transition-all text-[10px] font-bold uppercase shrink-0"
                            title="Chọn file từ thư viện đã upload"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round"/>
                                <rect x="3" y="3" width="7" height="7" rx="1"/>
                            </svg>
                            Thư viện
                        </button>
                    </div>

                    {/* Attachment List */}
                    {attachments.length > 0 ? attachments.map((att) => (
                        <div key={att.id} className={`border rounded-[14px] p-3 animate-in fade-in slide-in-from-bottom-2 transition-colors ${att.logic !== 'all' ? 'bg-blue-50/30 border-blue-100' : 'bg-white border-slate-100'}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <a href={att.url || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 group flex-1 min-w-0" title="Bấm để xem tệp">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${att.logic !== 'all' ? 'bg-blue-100 text-blue-600 border-blue-200 group-hover:bg-blue-500 group-hover:text-white' : 'bg-slate-50 text-slate-400 border-slate-100 group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500'}`}>
                                            <FileIcon className="w-5 h-5" />
                                        </div>
                                        <div className="min-w-0 cursor-pointer">
                                            <p className="text-xs font-bold text-slate-700 truncate group-hover:text-blue-600 transition-colors" title={att.name}>{att.name}</p>
                                            <div className="flex items-center gap-2">
                                                <p className="text-[9px] text-slate-400 font-mono">{(att.size / 1024).toFixed(1)} KB</p>
                                                {att.logic !== 'all' && <span className="text-[8px] font-black text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded uppercase">Personalized</span>}
                                            </div>
                                        </div>
                                    </a>
                                </div>
                                <button onClick={() => setAttachmentToDelete(att.id)} className="text-slate-300 hover:text-rose-500 p-1" disabled={disabled}><X className="w-4 h-4" /></button>
                            </div>

                            {att.logic === 'match_email' && (
                                <p className="text-[9px] text-blue-600 mt-2 px-1 flex items-center gap-1 font-medium bg-white/50 p-1 rounded-lg">
                                    <Filter className="w-3 h-3" /> Chỉ gửi cho Email khớp trong tên file.
                                </p>
                            )}
                        </div>
                    )) : null}

                    {attachments.length === 0 && (
                        <div className="p-4 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[14px] text-center text-slate-400 text-xs italic">
                            Chưa có tệp đính kèm.
                        </div>
                    )}
                </div>
            </div>

            {/* Overlay for Picker Backdrop via Portal */}
            {showPicker && typeof document !== 'undefined' && createPortal(
                <>
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[2147483642]" onClick={() => setShowPicker(false)}></div>
                    <div className="bg-white rounded-xl border-2 border-slate-100 shadow-2xl animate-in fade-in zoom-in-95 duration-200 fixed inset-4 md:inset-12 lg:inset-20 z-[2147483643] overflow-hidden flex flex-col max-w-6xl mx-auto my-auto max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center shrink-0">
                            <h3 className="font-bold text-slate-800 text-lg">Chọn mẫu Email</h3>
                            <button onClick={() => setShowPicker(false)} className="p-2 hover:bg-slate-100 text-slate-500 rounded-full transition-colors"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 md:p-6 custom-scrollbar bg-slate-50/50">
                            <TemplateSelector
                                templates={templates}
                                selectedId={config.templateId}
                                onSelect={(t) => { 
                                    if (!disabled) { 
                                        onChange({ 
                                            ...config, 
                                            templateId: t.id,
                                            subject: config.subject || t.name 
                                        }); 
                                        setShowPicker(false); 
                                    } 
                                }}
                            />
                        </div>
                    </div>
                </>,
                getMktPortalRoot()
            )}

            <EmailPreviewDrawer
                template={previewData?.template || null}
                htmlContent={previewData?.html}
                isOpen={!!previewData}
                onClose={() => setPreviewData(null)}
            />

            <ConfirmModal
                isOpen={!!attachmentToDelete}
                onClose={() => setAttachmentToDelete(null)}
                onConfirm={executeRemoveAttachment}
                title="Xóa tệp đính kèm?"
                message="Bạn có chắc chắn muốn xóa tệp này vĩnh viễn khỏi server không? Hành động này không thể hoàn tác."
                variant="danger"
                cancelText="Hủy"
                confirmText="Xóa vĩnh viễn"
            />

            {/* MultiFile Upload Modal */}
            <MultiFileUploadModal
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUploadComplete={(newAttachments) => {
                    setAttachments(prev => [...prev, ...newAttachments]);
                    setIsUploadModalOpen(false);
                }}
                targetConfig={{}} // Empty target matches against ALL active subscribers since Flow is dynamic 
            />

            {/* File Library Modal */}
            <FileLibraryModal
                isOpen={isLibraryOpen}
                onClose={() => setIsLibraryOpen(false)}
                onSelect={(picked) => {
                    const newAtts = picked.map(f => ({
                        id: generateId(),
                        name: f.name,
                        url: f.url,
                        path: f.path,
                        size: f.size,
                        type: f.type,
                        logic: (isPersonalizedMode ? 'match_email' : 'all') as 'all' | 'match_email',
                    }));
                    setAttachments(prev => [...prev, ...newAtts]);
                }}
            />

            {/* AI Email Editor Modal (Quick edit) */}
            {isEditingTemplate && selectedTemplate && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[2147483645] bg-slate-900/40 backdrop-blur-sm">
                    <EmailEditor
                        template={templates.find(t => t.id === selectedTemplate.id) || selectedTemplate}
                        groups={groups}
                        onSave={async (data) => {
                            if (selectedTemplate.id.startsWith('sys_')) {
                                toast.error('Lỗi: Bạn không thể sửa mẫu mặc định của hệ thống.');
                                return;
                            }
                            const res = await api.put(`templates/${selectedTemplate.id}`, { ...selectedTemplate, ...data, lastModified: new Date().toISOString() });
                            if (res.success) {
                                toast.success('Đã cấu hình & lưu lại mẫu!');
                                setIsEditingTemplate(false);
                                // Refresh template view to update thumbnail/changes
                                const detail = await api.get<Template>(`templates?id=${selectedTemplate.id}`);
                                if (detail.success && detail.data) {
                                    setTemplates(prev => {
                                        const idx = prev.findIndex(t => t.id === selectedTemplate.id);
                                        if (idx >= 0) {
                                            const updated = [...prev];
                                            updated[idx] = detail.data!;
                                            return updated;
                                        }
                                        return [...prev, detail.data!];
                                    });
                                }
                            } else {
                                toast.error('Lỗi lưu mẫu: ' + (res.message || 'Không rõ lý do'));
                            }
                        }}
                        onCancel={() => setIsEditingTemplate(false)}
                    />
                </div>,
                getMktPortalRoot()
            )}
        </div>
    );
};

export default EmailActionConfig;
