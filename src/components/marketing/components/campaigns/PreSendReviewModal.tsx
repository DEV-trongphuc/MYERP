import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getMktPortalRoot } from '../../utils/portalRoot';
import {
    X, Send, Mail, Users, Paperclip, Calendar, CheckCircle2,
    ShieldCheck, Sparkles, Smartphone, Monitor, AlertCircle,
    UserCheck, ChevronLeft, ChevronRight, User, GitMerge, FileText,
    Download, Check, Loader2, ArrowRight, Eye, RefreshCw, Layers, List
} from 'lucide-react';
import { Campaign, Flow, Segment, Subscriber, Template } from '../../types';
import { api } from '../../services/storageAdapter';
import { interpolateMergeTags, formatFileSize } from '../../utils/formatters';
import Badge from '../common/Badge';

interface PreSendReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirmSend: () => Promise<void>;
    formData: Partial<Campaign>;
    allLists: any[];
    allSegments: Segment[];
    allTags: any[];
    allTemplates: Template[];
    znsTemplates?: any[];
    allFlows: Flow[];
    isSubmitting: boolean;
    connectFlow: boolean;
    setConnectFlow: (v: boolean) => void;
    activateFlowId: string | null;
    setActivateFlowId: (id: string | null) => void;
}

const DEFAULT_SAMPLE_SUBSCRIBERS = [
    {
        id: 'sample-1',
        firstName: 'Phúc',
        lastName: 'Trần',
        fullName: 'Khách hàng mẫu',
        email: 'trongphuc@ideas.edu.vn',
        phone: '0901234567',
        companyName: 'IDEAS Fullstack Corp',
        jobTitle: 'Giám đốc Công nghệ (CTO)',
        city: 'Hồ Chí Minh',
        website: 'https://ideas.edu.vn',
        cert_no: 'CERT-2026-8899',
        cert_link: 'https://ideas.edu.vn/tra-cuu/CERT-2026-8899',
        cert_img: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=600&auto=format&fit=crop'
    },
    {
        id: 'sample-2',
        firstName: 'Linh',
        lastName: 'Nguyễn',
        fullName: 'Nguyễn Thị Mỹ Linh',
        email: 'mylinh.nguyen@company.com',
        phone: '0987654321',
        companyName: 'VinCommerce Solutions',
        jobTitle: 'Trưởng phòng Marketing',
        city: 'Hà Nội',
        website: 'https://vincommerce.vn',
        cert_no: 'CERT-2026-7722',
        cert_link: 'https://vincommerce.vn/cert/CERT-2026-7722',
        cert_img: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=600&auto=format&fit=crop'
    },
    {
        id: 'sample-3',
        firstName: 'Hoàng',
        lastName: 'Phạm',
        fullName: 'Phạm Minh Hoàng',
        email: 'hoang.pham@fintech.vn',
        phone: '0918889999',
        companyName: 'NextPay Global',
        jobTitle: 'Chuyên viên Tăng trưởng',
        city: 'Đà Nẵng',
        website: 'https://nextpay.vn',
        cert_no: 'CERT-2026-5511',
        cert_link: 'https://nextpay.vn/verify/CERT-2026-5511',
        cert_img: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=600&auto=format&fit=crop'
    }
];

export const PreSendReviewModal: React.FC<PreSendReviewModalProps> = ({
    isOpen,
    onClose,
    onConfirmSend,
    formData,
    allLists,
    allSegments,
    allTags,
    allTemplates,
    znsTemplates = [],
    allFlows,
    isSubmitting,
    connectFlow,
    setConnectFlow,
    activateFlowId,
    setActivateFlowId
}) => {
    const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [sampleSubscribers, setSampleSubscribers] = useState<any[]>(DEFAULT_SAMPLE_SUBSCRIBERS);
    const [selectedSampleIndex, setSelectedSampleIndex] = useState(0);
    const [loadingSamples, setLoadingSamples] = useState(false);

    const isZns = formData.type === 'zalo_zns';
    const selectedTemplate = isZns
        ? znsTemplates.find(t => t.template_id === formData.templateId)
        : allTemplates.find(t => t.id === formData.templateId);

    // Fetch actual subscribers from targeted list if available
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const fetchSubscribers = async () => {
            setLoadingSamples(true);
            try {
                const targetListId = formData.target?.listIds?.[0] || (formData as any).target_list_ids?.[0];
                const targetSegmentId = formData.target?.segmentIds?.[0];
                const targetTagId = formData.target?.tagIds?.[0];

                let url = 'subscribers?limit=10';
                if (targetListId) {
                    url = `subscribers?list_id=${targetListId}&limit=10`;
                } else if (targetSegmentId) {
                    url = `subscribers?segment_id=${targetSegmentId}&limit=10`;
                } else if (targetTagId) {
                    url = `subscribers?tag=${targetTagId}&limit=10`;
                }
                
                const extractList = (resData: any): any[] => {
                    if (Array.isArray(resData)) return resData;
                    if (resData && Array.isArray(resData.data)) return resData.data;
                    if (resData && Array.isArray(resData.subscribers)) return resData.subscribers;
                    return [];
                };

                let res = await api.get<any>(url);
                let list = res.success ? extractList(res.data) : [];

                // If specific target returned empty, fallback to active workspace subscribers
                if (list.length === 0 && url !== 'subscribers?limit=10') {
                    const fallbackRes = await api.get<any>('subscribers?limit=10');
                    if (fallbackRes.success) {
                        list = extractList(fallbackRes.data);
                    }
                }

                if (isMounted && list.length > 0) {
                    const mapped = list.map((sub: any, idx: number) => {
                        const fName = sub.firstName || sub.first_name || (sub.name ? sub.name.split(' ').slice(-1)[0] : '');
                        const lName = sub.lastName || sub.last_name || (sub.name ? sub.name.split(' ').slice(0, -1).join(' ') : '');
                        const full = sub.name || sub.fullName || [lName, fName].filter(Boolean).join(' ').trim() || sub.email?.split('@')[0] || 'Khách hàng';
                        const cAttrs = typeof sub.customAttributes === 'object' && sub.customAttributes 
                            ? sub.customAttributes 
                            : (typeof sub.custom_attributes === 'object' && sub.custom_attributes ? sub.custom_attributes : {});

                        return {
                            id: sub.id || `sub-${idx}`,
                            firstName: fName || 'Khách',
                            lastName: lName || '',
                            first_name: fName || 'Khách',
                            last_name: lName || '',
                            fullName: full,
                            name: full,
                            customer_name: full,
                            customerName: full,
                            email: sub.email || '',
                            phone: sub.phoneNumber || sub.phone_number || sub.phone || '',
                            phoneNumber: sub.phoneNumber || sub.phone_number || sub.phone || '',
                            companyName: sub.companyName || sub.company_name || sub.company || '',
                            company_name: sub.companyName || sub.company_name || sub.company || '',
                            jobTitle: sub.jobTitle || sub.job_title || 'Khách hàng',
                            job_title: sub.jobTitle || sub.job_title || 'Khách hàng',
                            city: sub.city || 'Việt Nam',
                            address: sub.address || sub.city || '',
                            website: sub.website || 'https://ideas.edu.vn',
                            ...cAttrs
                        };
                    });
                    setSampleSubscribers(mapped);
                    setSelectedSampleIndex(0);
                } else if (isMounted) {
                    setSampleSubscribers(DEFAULT_SAMPLE_SUBSCRIBERS);
                    setSelectedSampleIndex(0);
                }
            } catch (e) {
                if (isMounted) {
                    setSampleSubscribers(DEFAULT_SAMPLE_SUBSCRIBERS);
                    setSelectedSampleIndex(0);
                }
            } finally {
                if (isMounted) setLoadingSamples(false);
            }
        };

        fetchSubscribers();
        return () => { isMounted = false; };
    }, [isOpen, formData.target?.listIds, formData.target?.segmentIds, formData.target?.tagIds]);

    const currentSubscriber = sampleSubscribers[selectedSampleIndex] || DEFAULT_SAMPLE_SUBSCRIBERS[0];

    // Raw content
    const rawContent = useMemo(() => {
        if (formData.templateId === 'custom-html') {
            return formData.contentBody || '';
        }
        return selectedTemplate?.htmlContent || formData.contentBody || '';
    }, [formData.templateId, formData.contentBody, selectedTemplate]);

    // Interpolated Subject & Content
    const previewSubject = useMemo(() => {
        return interpolateMergeTags(
            formData.subject || (isZns ? selectedTemplate?.template_name : 'Không có tiêu đề') || '',
            currentSubscriber,
            {
                campaign_name: formData.name || 'Chiến dịch',
                variable_fallbacks: formData.config?.variable_fallbacks
            }
        );
    }, [formData.subject, isZns, selectedTemplate, currentSubscriber, formData.name, formData.config?.variable_fallbacks]);

    const previewHtml = useMemo(() => {
        return interpolateMergeTags(
            rawContent,
            currentSubscriber,
            {
                campaign_name: formData.name || 'Chiến dịch',
                unsubscribe_url: '#unsubscribe',
                variable_fallbacks: formData.config?.variable_fallbacks
            }
        );
    }, [rawContent, currentSubscriber, formData.name, formData.config?.variable_fallbacks]);

    // Audience calculation
    const targetLists = useMemo(() => {
        return (formData.target?.listIds || []).map((id: string) => allLists.find(l => l.id === id)).filter(Boolean);
    }, [formData.target?.listIds, allLists]);

    const targetSegments = useMemo(() => {
        return (formData.target?.segmentIds || []).map((id: string) => allSegments.find(s => s.id === id)).filter(Boolean);
    }, [formData.target?.segmentIds, allSegments]);

    const totalAudience = useMemo(() => {
        if (formData.totalTargetAudience && formData.totalTargetAudience > 0) return formData.totalTargetAudience;
        const fromLists = targetLists.reduce((sum: number, l: any) => sum + (Number(l.count) || 0), 0);
        const fromSegments = targetSegments.reduce((sum: number, s: any) => sum + (Number(s.count) || 0), 0);
        return Math.max(1, fromLists + fromSegments);
    }, [formData.totalTargetAudience, targetLists, targetSegments]);

    const attachments = formData.attachments || [];

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[2147483645] flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200" style={{ zIndex: 2147483645 }}>
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/80 backdrop-blur-[2px]"
                onClick={onClose} 
            />

            {/* Modal Box */}
            <div className="relative bg-white dark:bg-slate-900 rounded-[18px] shadow-2xl overflow-hidden max-w-7xl w-full h-[94vh] flex flex-col border border-slate-200/80 dark:border-slate-800 animate-in zoom-in-95 duration-300">
                
                {/* Modern Clean Header */}
                <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 z-10">
                    <div className="flex items-center gap-3.5">
                        <div className="w-10 h-10 rounded-[14px] bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
                            <Eye className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-850 dark:text-slate-100">
                                    Xác nhận & Xem trước Chiến dịch
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-600 border border-blue-200/60 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/60">
                                    Gán biến Live
                                </span>
                            </div>
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                                Kiểm tra kỹ nội dung, tệp đính kèm và thông số người gửi trước khi bấm gửi chính thức.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Device Toggle */}
                        <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-200/60 dark:border-slate-700/60">
                            <button
                                onClick={() => setPreviewDevice('desktop')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    previewDevice === 'desktop'
                                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs font-black'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                                }`}
                                title="Xem giao diện Máy tính"
                            >
                                <Monitor className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Desktop</span>
                            </button>
                            <button
                                onClick={() => setPreviewDevice('mobile')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                                    previewDevice === 'mobile'
                                        ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-white shadow-xs font-black'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                                }`}
                                title="Xem giao diện Điện thoại"
                            >
                                <Smartphone className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Mobile</span>
                            </button>
                        </div>

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                            title="Đóng (Esc)"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Main Body: 2 Columns Split */}
                <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-50/70 dark:bg-slate-950">
                    
                    {/* LEFT PANEL: Metadata & Sample Contact (Col 4/12) */}
                    <div className="lg:col-span-5 xl:col-span-4 border-r border-slate-200/80 dark:border-slate-800 p-5 md:p-6 overflow-y-auto custom-scrollbar space-y-5 bg-white dark:bg-slate-900">
                        
                        {/* 1. Sample Subscriber Switcher Card */}
                        <div className="p-5 bg-gradient-to-br from-blue-50/90 via-indigo-50/40 to-white dark:from-blue-950/30 dark:to-indigo-950/20 border border-blue-200/80 dark:border-blue-800/40 rounded-[14px] shadow-xs space-y-3.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                                        <User className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-[11px] font-black text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                                        Mẫu người nhận đại diện
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 bg-white/80 dark:bg-slate-800/80 px-1.5 py-0.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                                    <button
                                        onClick={() => setSelectedSampleIndex(prev => (prev > 0 ? prev - 1 : sampleSubscribers.length - 1))}
                                        className="p-1 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded transition-all cursor-pointer"
                                        title="Người nhận trước"
                                    >
                                        <ChevronLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-[10px] font-black text-blue-700 dark:text-blue-300 px-1.5 font-mono">
                                        {selectedSampleIndex + 1}/{sampleSubscribers.length}
                                    </span>
                                    <button
                                        onClick={() => setSelectedSampleIndex(prev => (prev < sampleSubscribers.length - 1 ? prev + 1 : 0))}
                                        className="p-1 text-slate-600 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-blue-800/50 rounded transition-all cursor-pointer"
                                        title="Người nhận tiếp theo"
                                    >
                                        <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-1.5 shadow-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black text-slate-850 dark:text-slate-100 truncate">
                                        {currentSubscriber.fullName}
                                    </span>
                                    <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 rounded-md">
                                        {currentSubscriber.jobTitle || 'Khách hàng'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
                                    {currentSubscriber.email}
                                </p>
                                {currentSubscriber.phone && (
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                                        SĐT: {currentSubscriber.phone} {currentSubscriber.companyName ? `· ${currentSubscriber.companyName}` : ''}
                                    </p>
                                )}
                            </div>

                            <p className="text-[10px] text-blue-700/90 dark:text-blue-300/80 font-medium flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span>Đã điền tự động các biến <code className="bg-blue-100/80 dark:bg-blue-900/80 px-1 py-0.5 rounded text-[9px] font-mono font-bold">{"{{first_name}}"}</code>, <code className="bg-blue-100/80 dark:bg-blue-900/80 px-1 py-0.5 rounded text-[9px] font-mono font-bold">{"{{email}}"}</code> vào email.</span>
                            </p>
                        </div>

                        {/* 2. Unified Campaign Overview Card */}
                        <div className="p-5 bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 rounded-[14px] space-y-4">
                            <h4 className="text-[11px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Thông tin chiến dịch
                            </h4>

                            <div className="space-y-3 text-xs">
                                {/* Campaign Name & Sender */}
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2">
                                    <div className="flex justify-between items-start gap-2">
                                        <span className="text-slate-400 font-medium shrink-0">Tên chiến dịch:</span>
                                        <span className="font-bold text-right text-slate-800 dark:text-slate-100 truncate" title={formData.name}>
                                            {formData.name || 'Chiến dịch mới'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-start gap-2">
                                        <span className="text-slate-400 font-medium shrink-0">Người gửi (From):</span>
                                        <span className="font-bold text-right text-slate-800 dark:text-slate-100 truncate">
                                            {formData.senderName ? `${formData.senderName} <${formData.senderEmail}>` : formData.senderEmail}
                                        </span>
                                    </div>
                                    {formData.config?.reply_to && (
                                        <div className="flex justify-between items-start gap-2">
                                            <span className="text-slate-400 font-medium shrink-0">Reply-to:</span>
                                            <span className="font-medium text-right text-slate-600 dark:text-slate-400 truncate">
                                                {formData.config.reply_to}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Target Audience */}
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                            <Users className="w-3.5 h-3.5 text-indigo-500" /> Đối tượng nhận:
                                        </span>
                                        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-black">
                                            {totalAudience.toLocaleString()} liên hệ
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                        {targetLists.map((l: any) => (
                                            <span key={l.id} className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                                                <List className="w-3 h-3 text-indigo-500" /> {l.name} ({l.count || 0})
                                            </span>
                                        ))}
                                        {targetSegments.map((s: any) => (
                                            <span key={s.id} className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md">
                                                <Layers className="w-3 h-3 text-purple-500" /> {s.name} ({s.count || 0})
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Attachments Summary */}
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                        <Paperclip className="w-3.5 h-3.5 text-emerald-500" /> Tệp đính kèm:
                                    </span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">
                                        {attachments.length > 0
                                            ? `${attachments.length} tệp (${formatFileSize(attachments.reduce((acc: number, f: any) => acc + (f.size || 0), 0))})`
                                            : 'Không có tệp'
                                        }
                                    </span>
                                </div>

                                {/* Schedule Mode */}
                                <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                                    <span className="text-slate-400 font-medium flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-blue-500" /> Lịch gửi:
                                    </span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-xs">
                                        {formData.scheduledAt
                                            ? new Date(formData.scheduledAt).toLocaleString('vi-VN')
                                            : 'Gửi ngay lập tức'
                                        }
                                    </span>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* RIGHT PANEL: Live Email Preview Sandbox (Col 7/12) */}
                    <div className="lg:col-span-7 xl:col-span-8 flex flex-col h-full overflow-hidden bg-slate-100/80 dark:bg-slate-950 p-4 sm:p-6">
                        
                        {/* Interactive Email Sandbox Mockup Window */}
                        <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden">
                            <div 
                                className={`h-full max-h-full transition-all duration-300 flex flex-col bg-white dark:bg-slate-900 shadow-2xl rounded-[14px] overflow-hidden border border-slate-200/90 dark:border-slate-800 ${
                                    previewDevice === 'mobile'
                                        ? 'w-[380px] max-w-full'
                                        : 'w-full max-w-[760px]'
                                }`}
                            >
                                {/* macOS Email Client Titlebar */}
                                <div className="px-4 py-3 bg-slate-100/90 dark:bg-slate-800/90 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-[#e0443e]" />
                                        <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123]" />
                                        <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29]" />
                                    </div>
                                    <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 font-bold">
                                        {previewDevice === 'mobile' ? 'Mobile View · 375px' : 'Inbox Preview · 600px'}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        HTML
                                    </span>
                                </div>

                                {/* Subject & Sender Header inside Mockup */}
                                <div className="px-5 py-3.5 bg-slate-50/90 dark:bg-slate-850 border-b border-slate-100 dark:border-slate-800 shrink-0 space-y-1">
                                    <h4 className="text-sm md:text-base font-black text-slate-850 dark:text-slate-100 break-words leading-tight">
                                        {previewSubject || '(Chưa có tiêu đề)'}
                                    </h4>
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                                        <span className="truncate">
                                            Từ: <span className="font-semibold text-slate-600 dark:text-slate-300">{formData.senderEmail || 'sender@domain.com'}</span>
                                        </span>
                                        <span className="truncate ml-2">
                                            Đến: <span className="font-semibold text-slate-600 dark:text-slate-300">{currentSubscriber.email}</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Sandbox Iframe Body */}
                                <div className="flex-1 w-full overflow-hidden bg-white">
                                    <iframe
                                        srcDoc={previewHtml}
                                        title="Email Live Preview"
                                        className="w-full h-full border-0"
                                        sandbox="allow-same-origin"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Footer Controls */}
                <div className="px-6 py-4 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between shrink-0 shadow-lg">
                    <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-6 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
                    >
                        ← Quay lại chỉnh sửa
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onConfirmSend}
                            disabled={isSubmitting}
                            className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-98 text-white rounded-xl font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-blue-500/25 hover:shadow-blue-500/35 hover:-translate-y-0.5 flex items-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Đang khởi chạy chiến dịch...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span>{formData.scheduledAt ? 'XÁC NHẬN LÊN LỊCH GỬI' : 'XÁC NHẬN GỬI CHIẾN DỊCH NGAY'}</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

            </div>
        </div>,
        getMktPortalRoot()
    );
};

export default PreSendReviewModal;
