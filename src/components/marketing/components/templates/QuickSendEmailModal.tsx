import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../common/Modal';
import { api } from '../../services/storageAdapter';
import { useSettings } from '../contexts/SettingsContext';
import { Subscriber, List } from '../../types';
import {
    Send,
    Users,
    FileText,
    Search,
    Check,
    X,
    Loader2,
    Mail,
    Plus,
    AlertCircle,
    CheckCircle2,
    Sparkles,
    UserCheck,
    ChevronDown,
    Filter,
    Layers,
    Trash2,
    AtSign,
    User
} from 'lucide-react';
import toast from 'react-hot-toast';

interface QuickSendEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    template?: { id?: string; name?: string; subject?: string; htmlContent?: string } | null;
    htmlContent?: string;
    defaultSubject?: string;
    isDarkTheme?: boolean;
}

const cleanSubjectText = (raw?: string): string => {
    if (!raw) return 'Thông báo từ hệ thống';
    // Remove prefixes like [Test], Test:, [QA Check], (Test), etc.
    let cleaned = raw.replace(/^\[?(?:Test|QA Check|Kiểm tra|Demo)\]?\s*[:-]?\s*/i, '').trim();
    return cleaned || 'Thông báo từ hệ thống';
};

const QuickSendEmailModal: React.FC<QuickSendEmailModalProps> = ({
    isOpen,
    onClose,
    template,
    htmlContent,
    defaultSubject,
    isDarkTheme = false,
}) => {
    const { senderEmails } = useSettings();
    const finalHtml = htmlContent || template?.htmlContent || '';
    const initialSubject = cleanSubjectText(defaultSubject || template?.subject || template?.name);

    const [subject, setSubject] = useState(initialSubject);
    const [fromEmail, setFromEmail] = useState<string>('');
    const [fromName, setFromName] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'subscribers' | 'import'>('subscribers');

    // Subscribers & Lists data
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [lists, setLists] = useState<List[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [selectedListId, setSelectedListId] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Selected contacts
    const [selectedSubscribers, setSelectedSubscribers] = useState<Record<string, Subscriber>>({});

    // Import / Paste mode
    const [rawEmailsInput, setRawEmailsInput] = useState('');

    // CC & BCC
    const [showCcBcc, setShowCcBcc] = useState(false);
    const [ccInput, setCcInput] = useState('');
    const [bccInput, setBccInput] = useState('');

    // Sending State
    const [isSending, setIsSending] = useState(false);
    const [sendResult, setSendResult] = useState<{ total: number; sent: number; failed: number; errors: string[] } | null>(null);

    // Reset when modal opens
    useEffect(() => {
        if (isOpen) {
            setSubject(cleanSubjectText(defaultSubject || template?.subject || template?.name));
            if (senderEmails && senderEmails.length > 0 && !fromEmail) {
                setFromEmail(senderEmails[0]);
            }
            setSendResult(null);
            setIsSending(false);
            loadData();
        }
    }, [isOpen, defaultSubject, template, senderEmails]);

    const loadData = async () => {
        setIsLoadingData(true);
        try {
            const [subsRes, listsRes] = await Promise.all([
                api.get<any>('subscribers?limit=50'),
                api.get<any>('lists'),
            ]);

            let subsData: Subscriber[] = [];
            if (subsRes && subsRes.data) {
                subsData = Array.isArray(subsRes.data) ? subsRes.data : (subsRes.data.data || []);
            } else if (Array.isArray(subsRes)) {
                subsData = subsRes;
            }
            setSubscribers(subsData);

            let listsData: List[] = [];
            if (listsRes && listsRes.data) {
                listsData = Array.isArray(listsRes.data) ? listsRes.data : (listsRes.data.data || []);
            } else if (Array.isArray(listsRes)) {
                listsData = listsRes;
            }
            setLists(listsData);
        } catch (err) {
            console.error('Failed to load subscribers/lists for quick send', err);
        } finally {
            setIsLoadingData(false);
        }
    };

    // Filtered subscribers list
    const filteredSubscribers = useMemo(() => {
        return subscribers.filter(sub => {
            if (!sub.email) return false;
            // List filter
            if (selectedListId !== 'all') {
                const subLists = (sub as any).listIds || (sub as any).lists || [];
                const inList = Array.isArray(subLists)
                    ? subLists.some((l: any) => (typeof l === 'object' ? l.id === selectedListId : String(l) === String(selectedListId)))
                    : false;
                if (!inList) return false;
            }
            // Search filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase();
                const fullName = `${sub.firstName || ''} ${sub.lastName || ''}`.toLowerCase();
                const email = (sub.email || '').toLowerCase();
                const phone = (sub.phoneNumber || '').toLowerCase();
                return fullName.includes(q) || email.includes(q) || phone.includes(q);
            }
            return true;
        });
    }, [subscribers, selectedListId, searchQuery]);

    // Parse raw emails from textarea
    const parsedImportEmails = useMemo(() => {
        if (!rawEmailsInput.trim()) return [];
        const lines = rawEmailsInput.split(/[\n\r,;]+/);
        const results: { email: string; name?: string }[] = [];
        const seen = new Set<string>();

        for (let line of lines) {
            line = line.trim();
            if (!line) continue;

            // Check if format "Name <email@domain.com>"
            const angleMatch = line.match(/([^<]+)<([^>]+)>/);
            if (angleMatch) {
                const name = angleMatch[1].trim();
                const email = angleMatch[2].trim().toLowerCase();
                if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !seen.has(email)) {
                    seen.add(email);
                    results.push({ email, name });
                }
            } else {
                const email = line.toLowerCase();
                if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !seen.has(email)) {
                    seen.add(email);
                    results.push({ email });
                }
            }
        }
        return results;
    }, [rawEmailsInput]);

    // Total recipients count
    const totalRecipientsCount = useMemo(() => {
        if (activeTab === 'subscribers') {
            return Object.keys(selectedSubscribers).length;
        } else {
            return parsedImportEmails.length;
        }
    }, [activeTab, selectedSubscribers, parsedImportEmails]);

    // Toggle subscriber selection
    const toggleSubscriber = (sub: Subscriber) => {
        setSelectedSubscribers(prev => {
            const copy = { ...prev };
            if (copy[sub.id]) {
                delete copy[sub.id];
            } else {
                copy[sub.id] = sub;
            }
            return copy;
        });
    };

    // Select all filtered
    const handleSelectAllFiltered = () => {
        setSelectedSubscribers(prev => {
            const copy = { ...prev };
            filteredSubscribers.forEach(sub => {
                copy[sub.id] = sub;
            });
            return copy;
        });
    };

    // Deselect all
    const handleDeselectAll = () => {
        setSelectedSubscribers({});
    };

    // Handle Send Action
    const handleSend = async () => {
        if (!subject.trim()) {
            toast.error('Vui lòng nhập tiêu đề email');
            return;
        }
        if (!finalHtml.trim()) {
            toast.error('Nội dung email trống');
            return;
        }
        if (totalRecipientsCount === 0) {
            toast.error('Vui lòng chọn hoặc nhập ít nhất 1 người nhận');
            return;
        }

        setIsSending(true);
        setSendResult(null);

        try {
            let recipientsPayload: any[] = [];
            let subscriberIdsPayload: string[] = [];

            if (activeTab === 'subscribers') {
                const subs = Object.values(selectedSubscribers);
                subscriberIdsPayload = subs.map(s => s.id);
                recipientsPayload = subs.map(s => ({
                    id: s.id,
                    email: s.email,
                    first_name: s.firstName || '',
                    last_name: s.lastName || '',
                    phone_number: s.phoneNumber || '',
                    company_name: s.companyName || '',
                }));
            } else {
                recipientsPayload = parsedImportEmails.map(p => ({
                    email: p.email,
                    first_name: p.name || '',
                }));
            }

            const payload = {
                subject: subject.trim(),
                from_email: fromEmail.trim() || undefined,
                from_name: fromName.trim() || undefined,
                html_content: finalHtml,
                template_name: template?.name || 'Quick Send',
                recipients: recipientsPayload,
                subscriber_ids: subscriberIdsPayload,
                cc_emails: ccInput.trim(),
                bcc_emails: bccInput.trim(),
            };

            const res = await api.post<any>('quick_send_email', payload);

            if (res && res.success) {
                setSendResult(res.data || { total: totalRecipientsCount, sent: totalRecipientsCount, failed: 0, errors: [] });
                toast.success(res.message || `Đã gửi thành công ${res.data?.sent || totalRecipientsCount} email!`);
            } else {
                toast.error(res?.error || 'Có lỗi xảy ra khi gửi email');
            }
        } catch (err: any) {
            console.error('Quick send error:', err);
            toast.error(err?.message || 'Lỗi hệ thống khi gửi email');
        } finally {
            setIsSending(false);
        }
    };

    const selectedList = Object.values(selectedSubscribers);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="2xl"
            isDarkTheme={isDarkTheme}
            title={
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-500/20">
                        <Send className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className={`text-lg font-black tracking-tight ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>
                            Gửi Email Nhanh
                        </h3>
                        <p className="text-xs font-semibold text-slate-400 mt-0.5 flex items-center gap-1.5">
                            <span>Mẫu: <b>{template?.name || 'Email Template'}</b></span>
                            <span className="w-1 h-1 rounded-full bg-slate-300" />
                            <span className="text-amber-600 font-bold">{totalRecipientsCount} người nhận</span>
                        </p>
                    </div>
                </div>
            }
            footer={
                <div className="flex items-center justify-between w-full">
                    <div className="text-xs text-slate-500 font-medium">
                        {totalRecipientsCount > 0 ? (
                            <span>
                                Sẵn sàng gửi tới <strong className="text-amber-600">{totalRecipientsCount}</strong> người nhận
                                {fromEmail ? ` từ ${fromEmail}` : ''}
                                {ccInput.trim() ? ` (+ CC)` : ''}
                                {bccInput.trim() ? ` (+ BCC)` : ''}
                            </span>
                        ) : (
                            <span className="text-slate-400">Chưa chọn người nhận</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSending}
                            className={`px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                                isDarkTheme
                                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                        >
                            Đóng
                        </button>
                        <button
                            type="button"
                            onClick={handleSend}
                            disabled={isSending || totalRecipientsCount === 0}
                            className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/25 transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none active:scale-95"
                        >
                            {isSending ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Đang gửi ({totalRecipientsCount})...
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Gửi ngay ({totalRecipientsCount})
                                </>
                            )}
                        </button>
                    </div>
                </div>
            }
        >
            <div className="space-y-5">
                {/* Result Notification Banner */}
                {sendResult && (
                    <div
                        className={`p-4 rounded-2xl border flex items-start gap-3 transition-all ${
                            sendResult.failed === 0
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                : 'bg-amber-50 border-amber-200 text-amber-900'
                        }`}
                    >
                        {sendResult.failed === 0 ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        )}
                        <div className="text-xs">
                            <h4 className="font-bold text-sm mb-1">
                                {sendResult.failed === 0 ? 'Gửi thành công toàn bộ!' : 'Đã hoàn tất gửi email'}
                            </h4>
                            <p>
                                Đã gửi thành công <b>{sendResult.sent}</b> / <b>{sendResult.total}</b> email.
                                {sendResult.failed > 0 && ` (${sendResult.failed} gửi thất bại)`}
                            </p>
                            {sendResult.errors && sendResult.errors.length > 0 && (
                                <ul className="mt-2 text-[11px] list-disc list-inside text-rose-600 space-y-0.5">
                                    {sendResult.errors.map((err, idx) => (
                                        <li key={idx}>{err}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {/* Sender & Subject Configuration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200">
                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                            <AtSign className="w-3.5 h-3.5 text-amber-500" />
                            Email gửi đi (Sender)
                        </label>
                        {senderEmails && senderEmails.length > 1 ? (
                            <select
                                value={fromEmail}
                                onChange={e => setFromEmail(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-semibold transition-all bg-white text-slate-700"
                            >
                                {senderEmails.map(e => (
                                    <option key={e} value={e}>{e}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="email"
                                value={fromEmail}
                                onChange={e => setFromEmail(e.target.value)}
                                placeholder={senderEmails[0] || 'marketing@ka-en.com.vn'}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-semibold transition-all bg-white"
                            />
                        )}
                    </div>

                    <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-amber-500" />
                            Tên hiển thị người gửi (Tùy chọn)
                        </label>
                        <input
                            type="text"
                            value={fromName}
                            onChange={e => setFromName(e.target.value)}
                            placeholder="Ví dụ: IDEAS AI Platform"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-xs font-semibold transition-all bg-white"
                        />
                    </div>
                </div>

                {/* Email Subject Input */}
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Tiêu đề Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={subject}
                            onChange={e => setSubject(e.target.value)}
                            placeholder="Nhập tiêu đề email..."
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-sm font-semibold transition-all bg-white"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                            <span>Biến:</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">{"{{firstName}}"}</span>
                            <span className="px-1.5 py-0.5 bg-slate-100 rounded text-slate-600">{"{{email}}"}</span>
                        </div>
                    </div>
                </div>

                {/* Tabs: Choose from Subscribers vs Import/Paste */}
                <div>
                    <div className="flex border-b border-slate-200 mb-4">
                        <button
                            type="button"
                            onClick={() => setActiveTab('subscribers')}
                            className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 -mb-[2px] ${
                                activeTab === 'subscribers'
                                    ? 'border-amber-500 text-amber-600'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <Users className="w-4 h-4" />
                            Chọn từ Danh sách Khách hàng ({Object.keys(selectedSubscribers).length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('import')}
                            className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 border-b-2 -mb-[2px] ${
                                activeTab === 'import'
                                    ? 'border-amber-500 text-amber-600'
                                    : 'border-transparent text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <FileText className="w-4 h-4" />
                            Nhập / Dán danh sách Email ({parsedImportEmails.length})
                        </button>
                    </div>

                    {/* Tab 1: Subscribers Picker */}
                    {activeTab === 'subscribers' && (
                        <div className="space-y-3">
                            {/* Filter Bar */}
                            <div className="flex flex-col sm:flex-row gap-2.5">
                                {/* Search box */}
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Tìm theo tên, email, số điện thoại..."
                                        className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                    />
                                    {searchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* List Filter */}
                                <div className="sm:w-56">
                                    <select
                                        value={selectedListId}
                                        onChange={e => setSelectedListId(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-700"
                                    >
                                        <option value="all">Tất cả danh sách ({subscribers.length})</option>
                                        {lists.map(l => (
                                            <option key={l.id} value={l.id}>
                                                {l.name} ({l.subscriberCount || 0})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Select All / Deselect buttons */}
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={handleSelectAllFiltered}
                                        className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl text-xs font-bold transition-all"
                                    >
                                        Chọn tất cả ({filteredSubscribers.length})
                                    </button>
                                    {Object.keys(selectedSubscribers).length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleDeselectAll}
                                            className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-all"
                                            title="Bỏ chọn tất cả"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Selected Chips Bar */}
                            {selectedList.length > 0 && (
                                <div className="flex items-center gap-1.5 p-2 bg-amber-50/50 border border-amber-200/60 rounded-xl overflow-x-auto max-h-24 flex-wrap">
                                    <span className="text-[11px] font-bold text-amber-800 shrink-0 mr-1">
                                        Đã chọn {selectedList.length}:
                                    </span>
                                    {selectedList.slice(0, 15).map(sub => (
                                        <span
                                            key={sub.id}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-[11px] font-medium text-slate-700 shadow-sm"
                                        >
                                            <span className="truncate max-w-[140px]">{sub.firstName ? `${sub.firstName} (${sub.email})` : sub.email}</span>
                                            <button
                                                type="button"
                                                onClick={() => toggleSubscriber(sub)}
                                                className="hover:text-rose-500 ml-0.5"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                    {selectedList.length > 15 && (
                                        <span className="text-[11px] font-bold text-amber-600">
                                            +{selectedList.length - 15} người khác
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Subscribers Scroll List */}
                            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white max-h-64 overflow-y-auto divide-y divide-slate-100">
                                {isLoadingData ? (
                                    <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2 text-xs">
                                        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                                        Đang tải danh sách khách hàng...
                                    </div>
                                ) : filteredSubscribers.length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 text-xs">
                                        Không tìm thấy khách hàng nào khớp với tìm kiếm.
                                    </div>
                                ) : (
                                    filteredSubscribers.map(sub => {
                                        const isSelected = !!selectedSubscribers[sub.id];
                                        const fullName = `${sub.firstName || ''} ${sub.lastName || ''}`.trim();
                                        return (
                                            <div
                                                key={sub.id}
                                                onClick={() => toggleSubscriber(sub)}
                                                className={`p-3 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                                                    isSelected ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div
                                                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                                                            isSelected
                                                                ? 'bg-amber-500 border-amber-500 text-white'
                                                                : 'border-slate-300 bg-white'
                                                        }`}
                                                    >
                                                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                                    </div>
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0 uppercase border border-slate-200">
                                                        {fullName ? fullName.charAt(0) : sub.email.charAt(0)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold text-slate-800 truncate">
                                                            {fullName || sub.email}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 truncate">
                                                            {sub.email} {sub.phoneNumber && `• ${sub.phoneNumber}`}
                                                        </div>
                                                    </div>
                                                </div>

                                                {sub.companyName && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md shrink-0 hidden sm:inline">
                                                        {sub.companyName}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Tab 2: Import / Paste Mode */}
                    {activeTab === 'import' && (
                        <div className="space-y-3">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                                    Dán danh sách Email (ngăn cách bằng dấu phẩy, chấm phẩy hoặc xuống dòng):
                                </label>
                                <textarea
                                    value={rawEmailsInput}
                                    onChange={e => setRawEmailsInput(e.target.value)}
                                    rows={5}
                                    placeholder={`Ví dụ:
nguyenvana@gmail.com
Trần Văn B <tranvanb@gmail.com>
lethic@gmail.com, Lê Thị C`}
                                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 leading-relaxed"
                                />
                            </div>

                            {/* Parsing Status & Tags */}
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-500 font-medium">
                                    Đã nhận diện:{' '}
                                    <strong className="text-amber-600">{parsedImportEmails.length}</strong> địa chỉ hợp lệ
                                </span>
                                {rawEmailsInput && (
                                    <button
                                        type="button"
                                        onClick={() => setRawEmailsInput('')}
                                        className="text-rose-500 hover:underline font-semibold text-[11px]"
                                    >
                                        Xóa tất cả
                                    </button>
                                )}
                            </div>

                            {parsedImportEmails.length > 0 && (
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl max-h-36 overflow-y-auto flex flex-wrap gap-1.5">
                                    {parsedImportEmails.map((p, idx) => (
                                        <span
                                            key={idx}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-sm"
                                        >
                                            <Mail className="w-3 h-3 text-amber-500" />
                                            <span>{p.name ? `${p.name} <${p.email}>` : p.email}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* CC & BCC Section Toggle */}
                <div className="border-t border-slate-100 pt-3">
                    <button
                        type="button"
                        onClick={() => setShowCcBcc(!showCcBcc)}
                        className="text-xs font-bold text-slate-500 hover:text-amber-600 flex items-center gap-1.5 transition-colors"
                    >
                        <Plus className={`w-3.5 h-3.5 transition-transform ${showCcBcc ? 'rotate-45' : ''}`} />
                        {showCcBcc ? 'Ẩn tùy chọn CC / BCC' : 'Thêm CC / BCC (Gửi sao chép & gửi ẩn)'}
                    </button>

                    {showCcBcc && (
                        <div className="mt-3 space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    CC (Sao chép email):
                                </label>
                                <input
                                    type="text"
                                    value={ccInput}
                                    onChange={e => setCcInput(e.target.value)}
                                    placeholder="sales@company.com, support@company.com"
                                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>
                            <div>
                                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                    BCC (Gửi ẩn danh):
                                </label>
                                <input
                                    type="text"
                                    value={bccInput}
                                    onChange={e => setBccInput(e.target.value)}
                                    placeholder="crm@company.com, audit@company.com"
                                    className="w-full px-3 py-2 bg-white rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                />
                            </div>
                            <p className="text-[10px] text-slate-400 italic">
                                💡 Lưu ý: CC và BCC nhận bản sao sạch (không tính lượt mở/click vào chỉ số của khách hàng).
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default QuickSendEmailModal;
