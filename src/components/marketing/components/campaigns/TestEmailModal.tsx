import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Mail, Send, Smartphone, Search, Users, CheckSquare, Square, AtSign,
    Building2, UserCheck, AlertCircle, ShieldCheck, Check, User, ChevronDown, X
} from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { api } from '../../services/storageAdapter';
import { useSettings, parseVerifiedSenderEmails } from '../contexts/SettingsContext';
import erpApi from '../../../../api/axios';
import { Avatar } from '../../../ui/Avatar';
import toast from 'react-hot-toast';

interface TestEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaignId?: string;
    reminderId?: string;
    campaignName: string;
    campaignType?: string; // 'email' | 'zalo_zns'
    defaultSenderEmail?: string;
    defaultSenderName?: string;
    onSend?: (emails: string[], senderEmail?: string, senderName?: string) => Promise<void> | void;
}

interface RecipientOption {
    id: string;
    name: string;
    email: string;
    badge: string;
    source: 'employee' | 'subscriber';
    avatar?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TestEmailModal: React.FC<TestEmailModalProps> = ({
    isOpen,
    onClose,
    campaignId,
    reminderId,
    campaignName,
    campaignType = 'email',
    defaultSenderEmail,
    defaultSenderName,
    onSend
}) => {
    const isZns = campaignType === 'zalo_zns';
    const { senderEmails: contextSenderEmails, settings, refreshSettings } = useSettings();

    // ZNS state
    const [recipientPhone, setRecipientPhone] = useState('');

    // Verified Sender state
    const [verifiedSenders, setVerifiedSenders] = useState<string[]>(contextSenderEmails);
    const normalizeSenderName = (val?: string | null) => {
        const s = String(val || '').trim();
        if (!s || /^viện\s+quốc\s+tế\s+ideas$/i.test(s)) return 'IDEAS';
        return s;
    };
    const [selectedSenderEmail, setSelectedSenderEmail] = useState<string>(
        defaultSenderEmail || contextSenderEmails[0] || 'tuyensinh@ideas.edu.vn'
    );
    const [senderName, setSenderName] = useState<string>(
        normalizeSenderName(defaultSenderName || settings?.senderName)
    );
    const [isSenderDropdownOpen, setIsSenderDropdownOpen] = useState(false);
    const senderDropdownRef = useRef<HTMLDivElement>(null);

    // Multi-recipient Email state
    const [candidates, setCandidates] = useState<RecipientOption[]>([]);
    const [loadingCandidates, setLoadingCandidates] = useState(false);
    const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
    const [customEmailsText, setCustomEmailsText] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [sourceFilter, setSourceFilter] = useState<'all' | 'employee' | 'subscriber'>('all');
    const [loading, setLoading] = useState(false);

    // Close sender dropdown when clicking outside
    useEffect(() => {
        if (!isSenderDropdownOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (senderDropdownRef.current && !senderDropdownRef.current.contains(e.target as Node)) {
                setIsSenderDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isSenderDropdownOpen]);

    // Sync verified senders from context & API on open
    useEffect(() => {
        if (!isOpen || isZns) return;
        let cancelled = false;

        refreshSettings().catch(() => {});

        api.get<any>('settings')
            .then((res) => {
                if (cancelled) return;
                const payload = res?.data && typeof res.data === 'object' ? res.data : res;
                const parsed = parseVerifiedSenderEmails(payload);
                const mergedSet = new Set<string>([...parsed, ...contextSenderEmails]);
                if (defaultSenderEmail && EMAIL_REGEX.test(defaultSenderEmail.trim())) {
                    mergedSet.add(defaultSenderEmail.trim().toLowerCase());
                }
                const finalSenders = Array.from(mergedSet);
                if (finalSenders.length > 0) {
                    setVerifiedSenders(finalSenders);
                    setSelectedSenderEmail((prev) => {
                        if (defaultSenderEmail && finalSenders.includes(defaultSenderEmail.trim().toLowerCase())) {
                            return defaultSenderEmail.trim().toLowerCase();
                        }
                        if (prev && finalSenders.includes(prev.toLowerCase())) {
                            return prev.toLowerCase();
                        }
                        return finalSenders[0];
                    });
                }
                const resolvedName = normalizeSenderName(
                    defaultSenderName ||
                    payload?.default_sender_name ||
                    payload?.smtp_from_name ||
                    payload?.ses_sender_name ||
                    settings?.senderName ||
                    'IDEAS'
                );
                setSenderName((prev) => (!prev || /^viện\s+quốc\s+tế\s+ideas$/i.test(prev) ? resolvedName : prev));
            })
            .catch(() => {
                if (cancelled) return;
                if (contextSenderEmails.length > 0) {
                    setVerifiedSenders(contextSenderEmails);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isOpen, isZns, defaultSenderEmail, defaultSenderName]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!isOpen || isZns) return;
        let cancelled = false;

        const fetchRecipients = async () => {
            setLoadingCandidates(true);
            try {
                const [usersRes, subsRes] = await Promise.allSettled([
                    erpApi.get<any>('/users'),
                    api.get<any>('subscribers?limit=30')
                ]);

                if (cancelled) return;

                const map = new Map<string, RecipientOption>();

                // 1. Company employees from /users
                if (usersRes.status === 'fulfilled' && usersRes.value) {
                    const uPayload = usersRes.value?.data ?? usersRes.value;
                    const rawUsers = Array.isArray(uPayload)
                        ? uPayload
                        : (Array.isArray(uPayload?.data) ? uPayload.data : (Array.isArray(uPayload?.users) ? uPayload.users : []));

                    rawUsers.forEach((u: any) => {
                        const email = String(u.email || '').trim().toLowerCase();
                        if (!email || !EMAIL_REGEX.test(email)) return;
                        if (u.status && String(u.status).toLowerCase() === 'inactive') return;
                        const name = u.full_name || u.name || u.username || email.split('@')[0];
                        const badge = u.position || u.job_title || u.department_name || u.department || u.role_name || u.role || 'Nhân sự';
                        const avatarUrl = u.avatar_url || u.avatar || u.profile_picture || undefined;
                        map.set(email, {
                            id: `emp_${u.id || email}`,
                            name,
                            email,
                            badge: String(badge),
                            source: 'employee',
                            avatar: avatarUrl ? String(avatarUrl) : undefined
                        });
                    });
                }

                // 2. Sample subscribers from marketing module
                if (subsRes.status === 'fulfilled' && subsRes.value) {
                    const rawSubs = Array.isArray(subsRes.value)
                        ? subsRes.value
                        : (Array.isArray(subsRes.value.data) ? subsRes.value.data : (Array.isArray(subsRes.value.items) ? subsRes.value.items : []));

                    rawSubs.forEach((s: any) => {
                        const email = String(s.email || '').trim().toLowerCase();
                        if (!email || !EMAIL_REGEX.test(email) || map.has(email)) return;
                        const fullName = [s.first_name, s.last_name].filter(Boolean).join(' ').trim() || s.full_name || s.name || email.split('@')[0];
                        const subAvatar = s.avatar_url || s.avatar || undefined;
                        map.set(email, {
                            id: `sub_${s.id || email}`,
                            name: fullName,
                            email,
                            badge: s.job_title || s.company_name || 'Khách hàng',
                            source: 'subscriber',
                            avatar: subAvatar ? String(subAvatar) : undefined
                        });
                    });
                }

                setCandidates(Array.from(map.values()));
            } catch {
                // Silent fallback if endpoints fail
            } finally {
                if (!cancelled) setLoadingCandidates(false);
            }
        };

        fetchRecipients();
        return () => {
            cancelled = true;
        };
    }, [isOpen, isZns]);

    // Filter candidates by search & tab
    const filteredCandidates = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return candidates.filter(c => {
            if (sourceFilter !== 'all' && c.source !== sourceFilter) return false;
            if (!q) return true;
            return (
                c.name.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q) ||
                c.badge.toLowerCase().includes(q)
            );
        });
    }, [candidates, searchQuery, sourceFilter]);

    // Selected recipient objects for quick preview chips
    const selectedRecipientObjects = useMemo(() => {
        const byEmail = new Map<string, RecipientOption>();
        candidates.forEach(c => byEmail.set(c.email.toLowerCase(), c));
        return selectedEmails.map(em => byEmail.get(em.toLowerCase()) || {
            id: em,
            name: em.split('@')[0],
            email: em,
            badge: 'Email',
            source: 'employee' as const
        });
    }, [candidates, selectedEmails]);

    // Parse custom textarea emails
    const { validCustomEmails, invalidCustomTokens } = useMemo(() => {
        if (!customEmailsText.trim()) {
            return { validCustomEmails: [] as string[], invalidCustomTokens: [] as string[] };
        }
        const rawTokens = customEmailsText
            .split(/[,;\n\r\s]+/)
            .map(t => t.trim().toLowerCase())
            .filter(Boolean);

        const validSet = new Set<string>();
        const invalid: string[] = [];

        rawTokens.forEach(token => {
            if (EMAIL_REGEX.test(token)) {
                validSet.add(token);
            } else {
                invalid.push(token);
            }
        });

        return {
            validCustomEmails: Array.from(validSet),
            invalidCustomTokens: invalid
        };
    }, [customEmailsText]);

    // Final deduplicated email list
    const finalEmails = useMemo(() => {
        const set = new Set<string>();
        selectedEmails.forEach(e => set.add(e.trim().toLowerCase()));
        validCustomEmails.forEach(e => set.add(e.trim().toLowerCase()));
        return Array.from(set);
    }, [selectedEmails, validCustomEmails]);

    const toggleCandidateEmail = (email: string) => {
        const normalized = email.trim().toLowerCase();
        setSelectedEmails(prev =>
            prev.includes(normalized)
                ? prev.filter(e => e !== normalized)
                : [...prev, normalized]
        );
    };

    const handleToggleAllFiltered = () => {
        const visibleEmails = filteredCandidates.map(c => c.email.toLowerCase());
        if (visibleEmails.length === 0) return;
        const allSelected = visibleEmails.every(e => selectedEmails.includes(e));
        if (allSelected) {
            setSelectedEmails(prev => prev.filter(e => !visibleEmails.includes(e)));
        } else {
            setSelectedEmails(prev => Array.from(new Set([...prev, ...visibleEmails])));
        }
    };

    const handleSendTest = async () => {
        if (isZns) {
            if (!recipientPhone || recipientPhone.trim().length < 9) {
                toast.error('Vui lòng nhập số điện thoại hợp lệ (84...).');
                return;
            }
            setLoading(true);
            try {
                const res = await api.post<any>('campaigns?route=send_test', {
                    campaign_id: campaignId,
                    reminder_id: reminderId,
                    phone: recipientPhone.trim()
                });
                if (res.success) {
                    toast.success('ZNS test đã được gửi thành công!');
                    onClose();
                } else {
                    toast.error(res.message || 'Không thể gửi ZNS test.');
                }
            } catch {
                toast.error('Đã xảy ra lỗi hệ thống.');
            } finally {
                setLoading(false);
            }
            return;
        }

        if (finalEmails.length === 0) {
            toast.error('Vui lòng chọn ít nhất 1 nhân sự hoặc nhập địa chỉ email nhận test.');
            return;
        }

        const chosenFromEmail = (selectedSenderEmail || verifiedSenders[0] || 'tuyensinh@ideas.edu.vn').trim().toLowerCase();
        const chosenFromName = senderName.trim() || 'Viện Quốc Tế IDEAS';

        setLoading(true);
        try {
            if (onSend) {
                await onSend(finalEmails, chosenFromEmail, chosenFromName);
            } else {
                const payload: any = {
                    campaign_id: campaignId,
                    reminder_id: reminderId,
                    emails: finalEmails,
                    email: finalEmails[0],
                    sender_email: chosenFromEmail,
                    from_email: chosenFromEmail,
                    sender_name: chosenFromName,
                    from_name: chosenFromName,
                };
                const res = await api.post<any>('campaigns?route=send_test', payload);
                if (res.success) {
                    toast.success(res.message || `Đã gửi email test từ ${chosenFromEmail} đến ${finalEmails.length} người nhận!`);
                    onClose();
                } else {
                    toast.error(res.message || 'Không thể gửi email test.');
                }
            }
        } catch (err: any) {
            if (!onSend) {
                toast.error(err?.message || 'Đã xảy ra lỗi hệ thống khi gửi email test.');
            }
        } finally {
            setLoading(false);
        }
    };

    const employeeCount = useMemo(() => candidates.filter(c => c.source === 'employee').length, [candidates]);
    const subscriberCount = useMemo(() => candidates.filter(c => c.source === 'subscriber').length, [candidates]);
    const allFilteredSelected = filteredCandidates.length > 0 && filteredCandidates.every(c => selectedEmails.includes(c.email.toLowerCase()));

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isZns ? 'Gửi Test ZNS' : 'Gửi Email Kiểm Thử (Chọn Email Gửi Đã Xác Minh)'}
            size={isZns ? 'sm' : 'lg'}
            zIndex={2147483645}
            footer={
                <div className="flex items-center justify-between gap-3 w-full">
                    {!isZns && (
                        <div className="text-xs font-bold text-slate-600 flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-rose-50 text-[#BD1D2D] font-extrabold">
                                {finalEmails.length} người nhận
                            </span>
                            <span className="text-slate-400 font-medium hidden sm:inline">
                                Từ: <strong className="text-slate-700">{selectedSenderEmail}</strong>
                            </span>
                        </div>
                    )}
                    <div className={`flex gap-2.5 ${isZns ? 'w-full' : 'ml-auto'}`}>
                        <Button variant="secondary" fullWidth={isZns} onClick={onClose} disabled={loading}>
                            Hủy bỏ
                        </Button>
                        <Button
                            variant="primary"
                            fullWidth={isZns}
                            onClick={handleSendTest}
                            isLoading={loading}
                            icon={Send}
                            disabled={!isZns && finalEmails.length === 0}
                        >
                            {isZns ? 'Gửi ngay' : `Gửi Email Test (${finalEmails.length})`}
                        </Button>
                    </div>
                </div>
            }
        >
            {isZns ? (
                <div className="space-y-6">
                    <div className="flex flex-col items-center text-center space-y-3">
                        <div className="w-16 h-16 rounded-[14px] flex items-center justify-center bg-[#BD1D2D]/10 text-[#BD1D2D]">
                            <Smartphone className="w-8 h-8" />
                        </div>
                        <div>
                            <h4 className="font-black text-slate-800 tracking-tight">Kiểm tra nội dung ZNS</h4>
                            <p className="text-xs text-slate-500 font-medium">
                                Gửi bản xem trước của "{campaignName}" đến số điện thoại của bạn.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Số điện thoại nhận test (84...)
                        </label>
                        <input
                            type="text"
                            value={recipientPhone}
                            onChange={(e) => setRecipientPhone(e.target.value)}
                            placeholder="84912345678"
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-[14px] text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 focus:border-[var(--color-primary)] transition-all placeholder:text-slate-300"
                            autoFocus
                        />
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Header Banner */}
                    <div className="flex items-center gap-3.5 p-3 rounded-[14px] bg-gradient-to-r from-rose-50/80 to-slate-50 border border-rose-200/60">
                        <div className="w-10 h-10 rounded-xl bg-white shadow-xs flex items-center justify-center text-[#BD1D2D] shrink-0">
                            <Mail className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h4 className="text-sm font-black text-slate-800 truncate">
                                Kiểm tra hiển thị: {campaignName || 'Thiết kế Email'}
                            </h4>
                            <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                Chọn địa chỉ Email gửi đã xác minh trong hệ thống và người nhận test. Các biến (<code className="text-[#BD1D2D] font-bold">{'{{full_name}}'}</code>, <code className="text-[#BD1D2D] font-bold">{'{{email}}'}</code>...) sẽ tự động cá nhân hóa.
                            </p>
                        </div>
                    </div>

                    {/* Section 1: Sleek Custom Dropdown for Verified Sender Email + From Name */}
                    <div className="p-3.5 rounded-[14px] bg-slate-50/80 border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                1. Cấu hình Email Gửi Đi (Đã xác minh trong App)
                            </label>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <Check className="w-3 h-3 stroke-[2.5]" />
                                Verified SES / SMTP ({verifiedSenders.length})
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Custom Styled Sender Email Dropdown */}
                            <div className="relative" ref={senderDropdownRef}>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                                    <AtSign className="w-3 h-3 text-[#BD1D2D]" />
                                    Địa chỉ Email gửi đi
                                </label>
                                <button
                                    type="button"
                                    onClick={() => setIsSenderDropdownOpen(prev => !prev)}
                                    className={`w-full h-11 px-3 bg-white border rounded-xl text-left flex items-center justify-between gap-2 transition-all cursor-pointer outline-none focus:outline-none ${
                                        isSenderDropdownOpen
                                            ? 'border-[#BD1D2D] ring-2 ring-[#BD1D2D]/15 shadow-xs'
                                            : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-7 h-7 rounded-lg bg-[#BD1D2D]/10 text-[#BD1D2D] flex items-center justify-center shrink-0">
                                            <Mail className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-800 truncate leading-tight">
                                                {selectedSenderEmail}
                                            </div>
                                            <div className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1 leading-tight mt-0.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                                                Đã xác minh tên miền
                                            </div>
                                        </div>
                                    </div>
                                    <ChevronDown
                                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                                            isSenderDropdownOpen ? 'rotate-180 text-[#BD1D2D]' : ''
                                        }`}
                                    />
                                </button>

                                {isSenderDropdownOpen && (
                                    <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150 max-h-64 overflow-y-auto custom-scrollbar">
                                        <div className="px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                                            <span>Chọn địa chỉ gửi đi</span>
                                            <span className="text-emerald-600">{verifiedSenders.length} khả dụng</span>
                                        </div>
                                        <div className="space-y-1">
                                            {verifiedSenders.map((email, idx) => {
                                                const isSelected = selectedSenderEmail.toLowerCase() === email.toLowerCase();
                                                return (
                                                    <button
                                                        key={email}
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedSenderEmail(email);
                                                            setIsSenderDropdownOpen(false);
                                                        }}
                                                        className={`w-full px-2.5 py-2 rounded-xl text-left transition-all flex items-center justify-between gap-2 cursor-pointer outline-none focus:outline-none ${
                                                            isSelected
                                                                ? 'bg-rose-50/90 border border-[#BD1D2D]/30'
                                                                : 'hover:bg-slate-50 border border-transparent'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div
                                                                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                                    isSelected ? 'bg-[#BD1D2D] text-white' : 'bg-slate-100 text-slate-500'
                                                                }`}
                                                            >
                                                                <Mail className="w-3.5 h-3.5" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span
                                                                        className={`text-xs font-bold truncate ${
                                                                            isSelected ? 'text-[#BD1D2D]' : 'text-slate-800'
                                                                        }`}
                                                                    >
                                                                        {email}
                                                                    </span>
                                                                    {idx === 0 && (
                                                                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                                                            Mặc định
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className="text-[10px] text-emerald-600 font-semibold block">
                                                                    Đã xác minh SES / SMTP
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                                                isSelected ? 'bg-[#BD1D2D] text-white' : 'border border-slate-300'
                                                            }`}
                                                        >
                                                            {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sender Display Name */}
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1">
                                    <User className="w-3 h-3 text-[#BD1D2D]" />
                                    Tên hiển thị người gửi (From Name)
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={senderName}
                                        onChange={(e) => setSenderName(e.target.value)}
                                        placeholder="VD: IDEAS"
                                        className="w-full h-11 px-3.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#BD1D2D]/15 focus:border-[#BD1D2D] transition-all shadow-2xs"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Company Employees & Sample Subscribers Multi-Select */}
                    <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <Users className="w-4 h-4 text-[#BD1D2D]" />
                                2. Chọn Nhân sự Công ty / Người nhận ({selectedEmails.length} đã chọn)
                            </label>
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setSourceFilter('all')}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                                        sourceFilter === 'all'
                                            ? 'bg-slate-800 text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    Tất cả ({candidates.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSourceFilter('employee')}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                        sourceFilter === 'employee'
                                            ? 'bg-[#BD1D2D] text-white shadow-xs'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    <Building2 className="w-3 h-3" />
                                    Nhân sự ({employeeCount})
                                </button>
                                {subscriberCount > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setSourceFilter('subscriber')}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer ${
                                            sourceFilter === 'subscriber'
                                                ? 'bg-slate-800 text-white shadow-xs'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        <UserCheck className="w-3 h-3" />
                                        Khách hàng ({subscriberCount})
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Search & Select All Bar */}
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Tìm theo tên nhân sự, email, chức vụ, phòng ban..."
                                    className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#BD1D2D]/15 focus:border-[#BD1D2D] transition-all"
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleToggleAllFiltered}
                                disabled={filteredCandidates.length === 0}
                                className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 shrink-0 disabled:opacity-40 transition-all cursor-pointer"
                            >
                                {allFilteredSelected ? (
                                    <>
                                        <CheckSquare className="w-3.5 h-3.5 text-[#BD1D2D]" />
                                        Bỏ chọn ({filteredCandidates.length})
                                    </>
                                ) : (
                                    <>
                                        <Square className="w-3.5 h-3.5 text-slate-400" />
                                        Chọn tất cả ({filteredCandidates.length})
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Selected Recipients Chips */}
                        {selectedRecipientObjects.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 max-h-16 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-200/80 custom-scrollbar">
                                {selectedRecipientObjects.map(rec => (
                                    <span
                                        key={rec.email}
                                        className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-800 shadow-2xs"
                                    >
                                        <Avatar name={rec.name} src={rec.avatar} size={18} />
                                        <span className="truncate max-w-[140px]">{rec.name}</span>
                                        <button
                                            type="button"
                                            onClick={() => toggleCandidateEmail(rec.email)}
                                            className="text-slate-400 hover:text-[#BD1D2D] cursor-pointer outline-none"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Candidate List with Real & Multi-Color Avatars */}
                        <div className="border border-slate-200 rounded-[14px] bg-white max-h-56 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
                            {loadingCandidates ? (
                                <div className="p-3 space-y-2">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="h-11 rounded-xl bg-slate-200/70 animate-pulse" />
                                    ))}
                                </div>
                            ) : filteredCandidates.length === 0 ? (
                                <div className="py-6 text-center text-xs font-medium text-slate-400">
                                    Không tìm thấy nhân sự hoặc người nhận phù hợp. Bạn có thể nhập trực tiếp email ở ô bên dưới.
                                </div>
                            ) : (
                                filteredCandidates.map((item) => {
                                    const isChecked = selectedEmails.includes(item.email.toLowerCase());

                                    return (
                                        <div
                                            key={item.id}
                                            onClick={() => toggleCandidateEmail(item.email)}
                                            className={`flex items-center justify-between gap-3 px-3.5 py-2.5 cursor-pointer transition-colors select-none ${
                                                isChecked ? 'bg-rose-50/70 hover:bg-rose-50' : 'bg-white hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}}
                                                    className="w-4 h-4 rounded border-slate-300 text-[#BD1D2D] focus:ring-[#BD1D2D] pointer-events-none shrink-0 accent-[#BD1D2D]"
                                                />
                                                <Avatar
                                                    name={item.name}
                                                    src={item.avatar}
                                                    size={34}
                                                />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-slate-800 truncate">
                                                            {item.name}
                                                        </span>
                                                        <span
                                                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                                                                item.source === 'employee'
                                                                    ? 'bg-slate-100 text-slate-600'
                                                                    : 'bg-rose-50 text-[#BD1D2D]'
                                                            }`}
                                                        >
                                                            {item.badge}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] font-medium text-slate-500 truncate">
                                                        {item.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Section 3: Unlimited Custom Emails Textarea */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                <AtSign className="w-4 h-4 text-[#BD1D2D]" />
                                3. Nhập thêm danh sách Email nhận test (Không giới hạn)
                            </label>
                            {validCustomEmails.length > 0 && (
                                <span className="text-[11px] font-bold text-emerald-600">
                                    +{validCustomEmails.length} email hợp lệ
                                </span>
                            )}
                        </div>
                        <textarea
                            rows={2}
                            value={customEmailsText}
                            onChange={(e) => setCustomEmailsText(e.target.value)}
                            placeholder="Nhập hoặc dán nhiều địa chỉ email, phân cách bằng dấu phẩy (,), chấm phẩy (;), khoảng trắng hoặc xuống dòng..."
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-[14px] text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#BD1D2D]/15 focus:border-[#BD1D2D] transition-all placeholder:text-slate-400 leading-relaxed resize-y"
                        />
                        {invalidCustomTokens.length > 0 && (
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/70">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                <span>
                                    Bỏ qua {invalidCustomTokens.length} định dạng chưa hợp lệ: {invalidCustomTokens.slice(0, 3).join(', ')}
                                    {invalidCustomTokens.length > 3 ? '...' : ''}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default TestEmailModal;
