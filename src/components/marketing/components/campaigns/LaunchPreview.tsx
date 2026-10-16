
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    CheckCircle2, Mail, Users, Calendar, Target, Layout, ShieldCheck, Send, GitMerge, AlertCircle, Clock, Loader2, List, Layers, Sparkles, ChevronDown, CalendarDays, Tag, Play, Monitor, Smartphone, ExternalLink, Paperclip, File as FileIcon, X, Filter, Plus, Info, HelpCircle, ToggleLeft, ToggleRight, AlertTriangle, ArrowRight, ArrowDown, FileCheck, Search, Link2
} from 'lucide-react';
import Card from '../common/Card';
import Badge from '../common/Badge';
import Checkbox from '../common/Checkbox';
import Select from '../common/Select';
import Input from '../common/Input';
import toast from 'react-hot-toast';
import { CampaignStatus, Flow } from '../../types';
import { api } from '../../services/storageAdapter';
import ConfirmModal from '../common/ConfirmModal';
import { MultiFileUploadModal } from './MultiFileUploadModal';
import FileLibraryModal from '../common/FileLibraryModal';
import { API_BASE_URL } from '../../utils/config';
import { interpolateMergeTags } from '../../utils/formatters';



interface Attachment {
    id: string;
    name: string;
    url: string;
    path: string; // Required for backend SMTP Mailer to resolve physical file
    size: number;
    type: string;
    logic: 'all' | 'match_email';
}

interface LaunchPreviewProps {
    formData: any;
    allLists: any[];
    allSegments: any[];
    allTags?: any[];
    allTemplates: any[];
    znsTemplates?: any[]; // Added for ZNS
    allFlows?: Flow[];
    activateFlowId?: string | null;
    initialConnectFlow?: boolean;
    onTestEmail: () => Promise<void>;
    onConnectFlow?: (connect: boolean) => void;
    onScheduleChange?: (date: string | null) => void;
    onActivateFlow?: (flowId: string, activate: boolean) => void;
    onAttachmentsChange?: (attachments: Attachment[]) => void;
}

const LaunchPreview: React.FC<LaunchPreviewProps> = ({
    formData, allLists, allSegments, allTags = [], allTemplates, znsTemplates = [], allFlows = [], activateFlowId, initialConnectFlow,
    onTestEmail, onConnectFlow, onScheduleChange, onActivateFlow, onAttachmentsChange
}) => {
    const apiUrl = window.location.origin;

    const testUnsubscribeLink = () => {
        // Open test unsubscribe page with dummy subscriber ID
        const testUrl = `${API_BASE_URL}/webhook.php?type=unsubscribe&sid=test_preview&cid=${formData.id}`;
        window.open(testUrl, '_blank');
    };

    // Determine selected template based on type
    const isZns = formData.type === 'zalo_zns';
    const selectedTemplate = isZns
        ? znsTemplates.find(t => t.template_id === formData.templateId)
        : allTemplates.find(t => t.id === formData.templateId);

    const [connectFlow, setConnectFlow] = useState(initialConnectFlow || !!activateFlowId);
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [scheduleMode, setScheduleMode] = useState<'now' | 'later'>(formData.scheduledAt ? 'later' : 'now');
    const [activateLinkedFlow, setActivateLinkedFlow] = useState(true);
    const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

    // Attachment State
    const [attachments, setAttachments] = useState<Attachment[]>(formData.attachments || []);
    const [isUploading, setIsUploading] = useState(false);
    const [isPersonalizedMode, setIsPersonalizedMode] = useState(false); // Toggle State
    const fileInputRef = useRef<HTMLInputElement>(null);

    const linkedFlow = allFlows.find(f => {
        const trigger = f.steps.find(s => s.type === 'trigger');
        return trigger?.config.type === 'campaign' && trigger.config.targetId === formData.id;
    });

    const isAlreadySent = formData.status === CampaignStatus.SENT || formData.status === CampaignStatus.SENDING;

    // Custom Date/Time State
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [isCustomDate, setIsCustomDate] = useState(false);
    const [customDateValue, setCustomDateValue] = useState('');
    const [selectedHour, setSelectedHour] = useState('09');
    const [selectedMinute, setSelectedMinute] = useState('00');

    // Fresh Flow Data
    const [freshLinkedFlow, setFreshLinkedFlow] = useState<Flow | undefined>(undefined);

    useEffect(() => {
        if (linkedFlow?.id) {
            // Force fetch latest flow to ensure status and steps are current
            api.get<Flow>(`flows/${linkedFlow.id}`).then(res => {
                if (res.success && res.data) {
                    setFreshLinkedFlow(res.data);
                }
            });
        }
    }, [linkedFlow?.id]);

    const activeFlow = freshLinkedFlow || linkedFlow;

    useEffect(() => {
        if (onConnectFlow) onConnectFlow(connectFlow);
    }, [connectFlow, onConnectFlow]);

    // Sync internal state if parent forcibly updates it (e.g. from Nurture Modal)
    useEffect(() => {
        if (initialConnectFlow || activateFlowId) {
            setConnectFlow(true);
        }
    }, [initialConnectFlow, activateFlowId]);

    useEffect(() => {
        if (onActivateFlow && linkedFlow && linkedFlow.status !== 'active') {
            onActivateFlow(linkedFlow.id, activateLinkedFlow);
        }
    }, [activateLinkedFlow, linkedFlow, onActivateFlow]);

    useEffect(() => {
        if (onAttachmentsChange) onAttachmentsChange(attachments);
    }, [attachments, onAttachmentsChange]);

    useEffect(() => {
        if (scheduleMode === 'later') {
            let combinedDate = new Date();
            if (isCustomDate && customDateValue) {
                combinedDate = new Date(customDateValue);
            } else {
                combinedDate = new Date(selectedDate);
            }
            combinedDate.setHours(parseInt(selectedHour));
            combinedDate.setMinutes(parseInt(selectedMinute));
            if (onScheduleChange) onScheduleChange(combinedDate.toISOString());
        } else {
            if (onScheduleChange) onScheduleChange(null);
        }
    }, [scheduleMode, selectedDate, selectedHour, selectedMinute, isCustomDate, customDateValue, onScheduleChange]);

    const handleTestSend = async () => {
        setIsSendingTest(true);
        await onTestEmail();
        setIsSendingTest(false);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        // Fix: Cast Array.from result to File[] to ensure proper typing for the loop and filtering
        const files = Array.from(e.target.files) as File[];

        // --- VALIDATION LOGIC (Multiple Files) ---
        if (isPersonalizedMode) {
            // Check ALL files. If ANY file fails, stop everything.
            const invalidFiles = files.filter(file => {
                // Simple check: Must contain '@' and some chars before/after to look like an email inside filename
                // Regex: matches _something@something.something
                // Fix: 'file' is now typed as File so 'name' exists
                return !/_[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(file.name);
            });

            if (invalidFiles.length > 0) {
                // Fix: 'invalidFiles' is now typed as File[] so map is safe
                const invalidNames = invalidFiles.map(f => f.name).join('\n- ');
                toast.error(`LỖI ĐỊNH DẠNG TÊN FILE! Tên file phải chứa Email (VD: Hopdong_khachA@gmail.com.pdf)`);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return; // Halt upload
            }
        }
        // -------------------------

        setIsUploading(true);
        const newAttachments: Attachment[] = [];

        // Process sequentially to maintain order and manage errors
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);

            try {
                // Use the authenticated API wrapper
                const result = await api.post<any>('upload', formData);

                if (result.success && result.data) {
                    newAttachments.push({
                        id: crypto.randomUUID(),
                        name: result.data.name,
                        url: result.data.url,
                        path: result.data.path,
                        size: result.data.size,
                        type: result.data.type,
                        logic: isPersonalizedMode ? 'match_email' : 'all'
                    });
                } else {
                    console.error(`Upload failed for ${file.name}: ${result.message}`);
                    toast.error(`Upload lỗi: ${result.message || 'Không thể upload file này.'}`);
                }
            } catch (error) {
                console.error(`Upload error for ${file.name}`, error);
                toast.error(`Lỗi hệ thống khi tải lên ${file.name}`);
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

    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [attachmentToDelete, setAttachmentToDelete] = useState<string | null>(null);
    const [attachmentPage, setAttachmentPage] = useState(1);

    const executeRemoveAttachment = async () => {
        if (!attachmentToDelete) return;
        const id = attachmentToDelete;
        setAttachmentToDelete(null);

        const attachToRemove = attachments.find(a => a.id === id);
        setAttachments(prev => prev.filter(a => a.id !== id));

        if (attachToRemove && attachToRemove.path) {
            try {
                await api.post('delete_attachment', { path: attachToRemove.path });
            } catch (err) {
                console.error("Failed to auto-remove attachment from host:", err);
            }
        }
    };

    const [estimatedReach, setEstimatedReach] = useState<number>(0);
    useEffect(() => {
        const fetchReach = async () => {
            if (!formData.target) return;
            try {
                const res = await api.post('campaigns.php?route=estimate_reach', formData.target) as any;
                if (res && res.success && typeof res.data?.count === 'number') {
                    setEstimatedReach(res.data.count);
                } else if (res && res.count !== undefined) {
                    // Fallback if response structure varies
                    setEstimatedReach(res.count);
                }
            } catch (e) {
                console.error("Failed to estimate reach", e);
            }
        };
        fetchReach();
    }, [formData.target]);

    const nextDays = Array.from({ length: 5 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d;
    });

    const getDayLabel = (d: Date, index: number) => {
        if (index === 0) return 'Hôm nay';
        if (index === 1) return 'Ngày mai';
        const day = d.getDay();
        return day === 0 ? 'Chủ Nhật' : `Thứ ${day + 1}`;
    };

    const [auditData, setAuditData] = useState<{ total_checked: number, total_missing: number, missing_field_stats: any } | null>(null);
    const [isAuditing, setIsAuditing] = useState(false);

    useEffect(() => {
        if (isZns && formData.id) {
            setIsAuditing(true);
            api.get(`campaign_audit.php?campaign_id=${formData.id}`).then((res: any) => {
                if (res.success) {
                    setAuditData(res.data);
                }
                setIsAuditing(false);
            }).catch(() => setIsAuditing(false));
        }
    }, [isZns, formData.id]);

    const [sampledSubscriber, setSampledSubscriber] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchTargetSubscriber = async () => {
            try {
                const targetListId = formData.target?.listIds?.[0] || (formData as any).target_list_ids?.[0];
                const targetSegmentId = formData.target?.segmentIds?.[0];
                const targetTagId = formData.target?.tagIds?.[0];

                let url = 'subscribers?limit=5';
                if (targetListId) {
                    url = `subscribers?list_id=${targetListId}&limit=5`;
                } else if (targetSegmentId) {
                    url = `subscribers?segment_id=${targetSegmentId}&limit=5`;
                } else if (targetTagId) {
                    url = `subscribers?tag=${targetTagId}&limit=5`;
                }

                const res = await api.get<any>(url);
                const extractList = (resData: any): any[] => {
                    if (Array.isArray(resData)) return resData;
                    if (resData && Array.isArray(resData.data)) return resData.data;
                    if (resData && Array.isArray(resData.subscribers)) return resData.subscribers;
                    return [];
                };

                let list = res.success ? extractList(res.data) : [];

                if (list.length === 0 && url !== 'subscribers?limit=5') {
                    const fallback = await api.get<any>('subscribers?limit=5');
                    if (fallback.success) {
                        list = extractList(fallback.data);
                    }
                }

                if (isMounted && list.length > 0) {
                    const sub = list[0];
                    const fName = sub.firstName || sub.first_name || (sub.name ? sub.name.split(' ').slice(-1)[0] : '');
                    const lName = sub.lastName || sub.last_name || (sub.name ? sub.name.split(' ').slice(0, -1).join(' ') : '');
                    const full = sub.name || sub.fullName || [lName, fName].filter(Boolean).join(' ').trim() || sub.email?.split('@')[0] || 'Khách hàng';
                    const cAttrs = typeof sub.customAttributes === 'object' && sub.customAttributes 
                        ? sub.customAttributes 
                        : (typeof sub.custom_attributes === 'object' && sub.custom_attributes ? sub.custom_attributes : {});

                    setSampledSubscriber({
                        id: sub.id,
                        firstName: fName || full || 'Khách',
                        first_name: fName || full || 'Khách',
                        lastName: lName || '',
                        last_name: lName || '',
                        fullName: full || fName || 'Khách hàng',
                        name: full || fName || 'Khách hàng',
                        customer_name: full || fName || 'Khách hàng',
                        customerName: full || fName || 'Khách hàng',
                        email: sub.email || formData.senderEmail || '',
                        phone: sub.phoneNumber || sub.phone_number || sub.phone || '',
                        phoneNumber: sub.phoneNumber || sub.phone_number || sub.phone || '',
                        company: sub.companyName || sub.company_name || sub.company || '',
                        companyName: sub.companyName || sub.company_name || sub.company || '',
                        company_name: sub.companyName || sub.company_name || sub.company || '',
                        jobTitle: sub.jobTitle || sub.job_title || '',
                        job_title: sub.jobTitle || sub.job_title || '',
                        city: sub.city || '',
                        address: sub.address || sub.city || '',
                        ...cAttrs
                    });
                }
            } catch (e) {
                // ignore
            }
        };

        fetchTargetSubscriber();
        return () => { isMounted = false; };
    }, [formData.target?.listIds, formData.target?.segmentIds, formData.target?.tagIds]);

    const contentToRender = formData.templateId === 'custom-html' ? formData.contentBody : (selectedTemplate?.htmlContent || '');

    const interpolatedPreviewHtml = useMemo(() => {
        if (!contentToRender) return '';
        const sampleSub = sampledSubscriber || {
            firstName: 'Quý khách',
            first_name: 'Quý khách',
            lastName: '',
            last_name: '',
            fullName: 'Quý khách hàng',
            name: 'Quý khách hàng',
            customer_name: 'Quý khách hàng',
            customerName: 'Quý khách hàng',
            email: formData.senderEmail || 'khachhang@example.com',
            phone: '0901234567',
            company: 'Công ty Cổ phần Mẫu',
            companyName: 'Công ty Cổ phần Mẫu',
            company_name: 'Công ty Cổ phần Mẫu',
            jobTitle: 'Khách hàng',
            job_title: 'Khách hàng',
            city: 'TP. Hồ Chí Minh',
            address: '123 Đường Nguyễn Huệ, Quận 1',
            ...(formData.target?.sampleSubscriber || {})
        };
        const previewContext = {
            campaign_name: formData.name || 'Chiến dịch Mẫu',
            campaignName: formData.name || 'Chiến dịch Mẫu',
            unsubscribe_url: `${API_BASE_URL}/webhook.php?type=unsubscribe&sid=preview_test&cid=${formData.id || ''}`,
            unsubscribeLink: `${API_BASE_URL}/webhook.php?type=unsubscribe&sid=preview_test&cid=${formData.id || ''}`,
            variable_fallbacks: formData.config?.variable_fallbacks || {},
            fallbacks: formData.config?.variable_fallbacks || {}
        };
        return interpolateMergeTags(contentToRender, sampleSub, previewContext);
    }, [contentToRender, sampledSubscriber, formData.senderEmail, formData.name, formData.id, formData.config?.variable_fallbacks, formData.target?.sampleSubscriber]);

    return (
        <div className="space-y-8 animate-in zoom-in-95 duration-500 pb-10">

            {/* Top Bar: Quality Check OR Progress Tracking */}
            {formData.status === CampaignStatus.SENDING ? (
                <div className="bg-emerald-900 rounded-[24px] p-6 shadow-xl border border-emerald-500/20 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400 opacity-[0.05] rounded-full blur-[40px]"></div>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-500/20 rounded-2xl text-emerald-400 border border-emerald-500/20 animate-pulse">
                                <Send className="w-6 h-6" />
                            </div>
                            <div>
                                <h5 className="text-sm font-bold text-white flex items-center gap-2">
                                    Hệ thống đang gửi {isZns ? 'ZNS' : 'Email'}...
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                                </h5>
                                <p className="text-[10px] text-emerald-300/70 font-medium uppercase tracking-widest mt-1">Đừng đóng trình duyệt này để theo dõi tiến độ</p>
                            </div>
                        </div>

                        <div className="flex-1 max-w-md w-full">
                            <div className="flex justify-between items-end mb-2">
                                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Tiến đã gửi</span>
                                <span className="text-xl font-black text-white tabular-nums">
                                    {formData.stats?.sent?.toLocaleString() || 0}
                                    <span className="text-sm text-emerald-500/70 mx-1">/</span>
                                    {formData.totalTargetAudience?.toLocaleString() || estimatedReach.toLocaleString()}
                                </span>
                            </div>
                            <div className="h-3 bg-black/30 rounded-full overflow-hidden border border-white/5">
                                <div
                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all duration-1000 ease-out"
                                    style={{ width: `${Math.min(100, (formData.stats?.sent || 0) / (formData.totalTargetAudience || estimatedReach || 1) * 100)}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-[#0f172a] rounded-[24px] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border border-white/5 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-[#2563eb] opacity-[0.05] rounded-full blur-[40px] transition-transform group-hover:scale-150"></div>
                    <div className="flex items-center gap-3 relative z-10 pl-2">
                        <div className="p-2 bg-white/10 rounded-xl text-[#2563eb] border border-white/10"><ShieldCheck className="w-5 h-5" /></div>
                        <div>
                            <h5 className="text-sm font-bold text-white">Kiểm định chất lượng</h5>
                            <p className="text-[10px] text-slate-400 font-medium">Gửi {isZns ? 'tin ZNS' : 'email'} test đến chính bạn để rà soát hiển thị trước khi gửi thật.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); handleTestSend(); }}
                        disabled={isSendingTest}
                        className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-white/10 flex items-center gap-2 shrink-0 disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer z-20"
                    >
                        {isSendingTest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        <span>{isSendingTest ? 'Đang gửi...' : (isZns ? 'Gửi ZNS Test' : 'Gửi Mail Test')}</span>
                    </button>
                </div>
            )}

            {/* [NEW] ZNS Data Audit Alert */}
            {isZns && (isAuditing || (auditData && auditData.total_missing > 0)) && (
                <div className={`rounded-[24px] p-6 border transition-all animate-in slide-in-from-top-4 duration-500 ${auditData?.total_missing ? 'bg-rose-50 border-rose-200' : 'bg-blue-50 border-blue-100'}`}>
                    <div className="flex items-start gap-4">
                        <div className={`p-3 rounded-2xl ${auditData?.total_missing ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-blue-500 text-white animate-pulse'}`}>
                            {isAuditing ? <Loader2 className="w-6 h-6 animate-spin" /> : <AlertTriangle className="w-6 h-6" />}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center justify-between">
                                <h5 className={`text-sm font-black uppercase tracking-tight ${auditData?.total_missing ? 'text-rose-900' : 'text-blue-900'}`}>
                                    {isAuditing ? 'Đang kiểm tra dữ liệu đối tượng...' : `Phát hiện ${auditData?.total_missing} liên hệ thiếu dữ liệu`}
                                </h5>
                                {auditData && (
                                    <Badge variant="neutral" className="bg-white/50 text-[10px] border-none font-bold">
                                        Đã quét: {auditData.total_checked} liên hệ gần nhất
                                    </Badge>
                                )}
                            </div>

                            {isAuditing ? (
                                <p className="text-xs text-blue-700 font-medium mt-1">Hệ thống đang đối soát danh sách người nhận với các tham số mẫu ZNS đã mapping...</p>
                            ) : (
                                <>
                                    <p className="text-xs text-rose-700 font-medium mt-1">
                                        Có <strong>{auditData?.total_missing}</strong> liên hệ trong tệp {formData.target?.listIds.length ? 'CSV/Danh sách' : 'Phân đoạn'} này không đủ dữ liệu đã gửi ZNS. Các tin nhắn này sẽ bị <strong>tự động Bỏ qua</strong> để tránh lỗi gửi từ Zalo.
                                    </p>
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        {Object.entries(auditData?.missing_field_stats || {}).map(([field, count]) => (
                                            <div key={field} className="bg-white/60 border border-rose-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
                                                <span className="text-[10px] font-black text-rose-600 uppercase tracking-tight">{field}:</span>
                                                <span className="text-xs font-bold text-rose-800">{count as any} liên hệ thiếu</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 p-3 bg-white/40 rounded-xl border border-rose-100">
                                        <p className="text-[10px] font-bold text-rose-600/80 italic flex items-center gap-1">
                                            <Info className="w-3 h-3" /> Mẹo: Hãy rà soát lại tệp CSV hoặc mapping tham số để đảm bảo đầy đủ thông tin nhất.
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Grid: 2 Columns */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 items-start">

                {/* COLUMN 1: SUMMARY & AUDIENCE (7 Cols on XL) */}
                <div className="space-y-4 xl:col-span-7">
                    <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs h-full flex flex-col">
                        {/* Summary Header */}
                        <div className="p-4 sm:p-5 border-b border-slate-100 relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-[60px] -mr-10 -mt-10 pointer-events-none"></div>
                            <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2.5 flex items-center gap-2"><Target className="w-3.5 h-3.5 text-orange-500" /> Tổng quan chiến dịch</h5>
                            <div className="space-y-1 relative z-10">
                                <p className="text-lg sm:text-xl font-black text-slate-800 leading-tight truncate" title={formData.name}>{formData.name}</p>
                                <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">{isZns ? selectedTemplate?.template_name : formData.subject}</p>
                            </div>
                            <div className="flex items-center gap-2 mt-3 relative z-10">
                                <Badge variant="neutral" className="px-2.5 py-1 text-[10px] font-bold"><ShieldCheck className="w-3 h-3 mr-1 text-emerald-600" /> {isZns ? `ZNS Template: ${selectedTemplate?.template_id}` : formData.senderEmail}</Badge>
                            </div>
                        </div>

                        {/* P1 FIX: Unsubscribe Link Preview */}
                        {!isZns && (
                            <div className="p-4 sm:p-5 pb-0">
                                <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-3.5">
                                    <div className="flex items-start gap-2.5">
                                        <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg shrink-0 mt-0.5">
                                            <Link2 className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-xs font-bold text-blue-900">Unsubscribe Link (CAN-SPAM Compliance)</h4>
                                            <p className="text-[11px] text-blue-700 font-medium mt-0.5 leading-relaxed">Link Hủy đăng ký sẽ tự động được thêm vào cuối mỗi email bởi hệ thống.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Audience Section */}
                        <div className="p-4 sm:p-5 bg-slate-50/40 flex-1 flex flex-col">
                            <div className="flex justify-between items-center mb-3">
                                <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2"><Users className="w-3.5 h-3.5 text-orange-500" /> Đối tượng nhận tin</h5>
                            </div>

                            <div className="space-y-2.5 flex-1">
                                {/* Lists Rendering */}
                                {formData.target?.listIds.map((id: string) => (
                                    <div key={id} className="flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl shadow-xs">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shrink-0"><List className="w-3.5 h-3.5" /></div>
                                            <div><p className="text-xs font-bold text-slate-800">{allLists.find(l => l.id === id)?.name}</p><p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Static List</p></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">{allLists.find(l => l.id === id)?.count || 0}</span>
                                    </div>
                                ))}

                                {/* Segments Rendering */}
                                {formData.target?.segmentIds.map((id: string) => (
                                    <div key={id} className="flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl shadow-xs">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-orange-50 text-[#ca7900] flex items-center justify-center border border-orange-100 shrink-0"><Layers className="w-3.5 h-3.5" /></div>
                                            <div><p className="text-xs font-bold text-slate-800">{allSegments.find(s => s.id === id)?.name}</p><p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Dynamic Segment</p></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">{allSegments.find(s => s.id === id)?.count || 0}</span>
                                    </div>
                                ))}

                                {/* Tags Rendering */}
                                {formData.target?.tagIds?.map((tagName: string) => (
                                    <div key={tagName} className="flex items-center justify-between px-3.5 py-2.5 bg-white border border-slate-200/80 rounded-xl shadow-xs">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0"><Tag className="w-3.5 h-3.5" /></div>
                                            <div><p className="text-xs font-bold text-slate-800">{tagName}</p><p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">Tag Group</p></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">{allTags?.find(t => t.name === tagName)?.count || 0}</span>
                                    </div>
                                ))}

                                {(!formData.target?.listIds?.length && !formData.target?.segmentIds?.length && !formData.target?.tagIds?.length) && (
                                    <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-100/50 rounded-xl border border-dashed border-slate-200">Chưa chọn đối tượng nào</div>
                                )}
                            </div>

                            {/* Reach Estimate Styled like SUM at Bottom */}
                            <div className="mt-4 pt-3 border-t border-slate-200/80 flex flex-wrap justify-end gap-3">
                                <div className="flex items-center gap-3 bg-white px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 min-w-[160px] justify-between shadow-xs">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Tổng Reach</span>
                                    <div className="flex items-center gap-1.5">
                                        <Users className="w-3.5 h-3.5 text-slate-400" />
                                        <span className="text-base font-black leading-none">{estimatedReach.toLocaleString()}</span>
                                    </div>
                                </div>

                                {isZns && (() => {
                                    const znsPrice = selectedTemplate?.template_data?.detail?.price_uid || selectedTemplate?.template_data?.detail?.price || selectedTemplate?.template_data?.raw?.price || 300;
                                    return (
                                        <div className="flex items-center gap-3 bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2.5 rounded-xl shadow-xs text-white min-w-[160px] justify-between transition-all">
                                            <span className="text-[9px] font-bold text-blue-200 uppercase tracking-widest">Chi phí ước tính</span>
                                            <div className="flex items-center gap-1.5">
                                                <Sparkles className="w-3.5 h-3.5 text-[#2563eb] animate-pulse" />
                                                <span className="text-base font-black leading-none">{(estimatedReach * znsPrice).toLocaleString()}<span className="text-[9px] ml-0.5 font-bold">đ</span></span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>

                            {/* [BUG-13 FIX] SES Send-Time Estimate — show when email audience > 1,000 */}
                            {!isZns && estimatedReach > 1000 && (() => {
                                const SES_RATE = 10;
                                const totalSeconds = Math.ceil(estimatedReach / SES_RATE);
                                const minutes = Math.floor(totalSeconds / 60);
                                const seconds = totalSeconds % 60;
                                const timeLabel = minutes > 0
                                    ? `${minutes} phút${seconds > 0 ? ` ${seconds} giây` : ''}`
                                    : `${seconds} giây`;
                                return (
                                    <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 animate-in slide-in-from-bottom-2 duration-300">
                                        <div className="p-1 bg-amber-400 text-white rounded-md shrink-0 mt-0.5">
                                            <Clock className="w-3.5 h-3.5" />
                                        </div>
                                        <div className="flex-1 space-y-0.5">
                                            <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Thời gian gửi ước tính</p>
                                            <p className="text-xs font-black text-amber-900">
                                                ~{timeLabel}
                                                <span className="text-[10px] font-bold text-amber-600 ml-2">({estimatedReach.toLocaleString()} emails × 10/s)</span>
                                            </p>
                                            <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                                                Hệ thống giới hạn 10 email/giây để đảm bảo ổn định SES. Worker chạy ngầm độc lập.
                                            </p>
                                        </div>
                                    </div>
                                );
                            })()}

                        </div>
                    </div>
                </div>

                {/* COLUMN 2: ATTACHMENTS, TIMING & FLOW (5 Cols on XL) */}
                <div className="space-y-4 xl:col-span-5">

                    {/* Automation Connection Logic */}
                    {linkedFlow ? (
                        <div className={`p-4 rounded-2xl border transition-all group ${activeFlow.status === 'active' ? 'bg-emerald-50/70 border-emerald-200' : 'bg-amber-50/70 border-amber-200'}`}>
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${activeFlow.status === 'active' ? 'bg-emerald-500 text-white shadow-xs' : 'bg-amber-600 text-white shadow-xs'}`}>
                                        <GitMerge className="w-4.5 h-4.5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-sm font-bold text-slate-800">Đã kết nối Flow: {activeFlow.name}</h4>
                                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${activeFlow.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{activeFlow.status}</span>
                                        </div>
                                        <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium opacity-80">
                                            {activeFlow.status === 'active' ? <span className="text-emerald-700 flex items-center gap-1"><Play className="w-3 h-3" /> Automation sẽ chạy khi Campaign gửi.</span> : <span className="text-amber-700 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Automation đang tắt.</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            {activeFlow.status !== 'active' && !isAlreadySent && (
                                <div className="mt-3 pt-3 border-t border-amber-200/50 flex items-center gap-2">
                                    <Checkbox
                                        id="activate-flow"
                                        checked={activateLinkedFlow}
                                        onChange={(checked) => setActivateLinkedFlow(checked)}
                                        label="Kích hoạt Flow này & Xuất bản cùng lúc?"
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className={`p-4 border transition-all rounded-2xl ${connectFlow ? 'bg-blue-50/50 border-blue-200 shadow-xs' : 'bg-white border-slate-200/90 shadow-xs'}`}>
                            <div
                                className={`flex items-center justify-between group ${isAlreadySent ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                                onClick={() => !isAlreadySent && setConnectFlow(!connectFlow)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors shrink-0 ${connectFlow ? 'bg-blue-500 text-white shadow-xs' : 'bg-slate-100 text-slate-400'}`}>
                                        <GitMerge className="w-4.5 h-4.5" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <h4 className={`text-sm font-bold transition-colors ${connectFlow ? 'text-blue-900' : 'text-slate-800'}`}>Kích hoạt chăm sóc sau chiến dịch?</h4>
                                        <p className="text-xs text-slate-500 font-medium max-w-sm leading-relaxed">
                                            {isAlreadySent ? "Không thể bật automation vì chiến dịch đã gửi." : "Tự động gửi email chăm sóc khi Khách hàng nhận chiến dịch."}
                                        </p>
                                    </div>
                                </div>
                                <div className={`w-11 h-6 rounded-full p-0.5 transition-all duration-300 flex items-center shrink-0 ml-3 ${connectFlow ? 'bg-blue-600 justify-end' : 'bg-slate-200 justify-start'}`}>
                                    <div className="w-5 h-5 bg-white rounded-full shadow-xs"></div>
                                </div>
                            </div>

                            {connectFlow && !isAlreadySent && (
                                <div className="mt-3.5 pt-3.5 border-t border-blue-100 animate-in slide-in-from-top-2">
                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-2 block">Chọn kịch bản muốn kết nối:</label>
                                    <div className="space-y-2">
                                        <button
                                            onClick={() => onActivateFlow && onActivateFlow('', true)}
                                            className={`w-full p-2.5 rounded-xl border-2 text-left flex items-center justify-between transition-all ${!activateFlowId ? 'border-blue-500 bg-white ring-2 ring-blue-50 shadow-xs' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${!activateFlowId ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                                                    <Plus className="w-3.5 h-3.5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-800">Tạo Flow mới</p>
                                                    <p className="text-[10px] text-slate-500 font-medium">Chọn mẫu Chăm sóc sau chiến dịch</p>
                                                </div>
                                            </div>
                                            {!activateFlowId && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                                        </button>

                                        {allFlows.filter(f => {
                                            const trigger = f.steps?.find(s => s.type === 'trigger');
                                            return trigger?.config?.type === 'campaign' && !trigger.config.targetId;
                                        }).map((flow) => (
                                            <button
                                                key={flow.id}
                                                onClick={() => onActivateFlow && onActivateFlow(flow.id, true)}
                                                className={`w-full p-2.5 rounded-xl border-2 text-left flex items-center justify-between transition-all ${activateFlowId === flow.id ? 'border-blue-500 bg-white ring-2 ring-blue-50 shadow-xs' : 'border-slate-100 bg-white hover:border-slate-200'}`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${activateFlowId === flow.id ? 'bg-blue-100 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                                                        <GitMerge className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-800 truncate max-w-[200px]">{flow.name}</p>
                                                        <p className="text-[10px] text-slate-500 font-medium">Kịch bản chăm sóc sẵn có</p>
                                                    </div>
                                                </div>
                                                {activateFlowId === flow.id && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ATTACHMENTS SECTION */}
                    {!isZns && (
                        <div className="p-4 border border-slate-200/90 bg-white rounded-2xl shadow-xs space-y-3.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600"><Paperclip className="w-4 h-4" /></div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 text-sm sm:text-base">Tệp đính kèm</h4>
                                        <p className="text-xs text-slate-400 font-medium mt-0.5">Hỗ trợ PDF, DOC, Excel, IMG (Max 10MB)</p>
                                    </div>
                                </div>
                            </div>

                            <div className={`p-2.5 px-3.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${isPersonalizedMode ? 'bg-blue-50/60 border-blue-200 shadow-xs' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`} onClick={() => !isAlreadySent && setIsPersonalizedMode(!isPersonalizedMode)}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`p-1.5 rounded-lg ${isPersonalizedMode ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                                        {isPersonalizedMode ? <Filter className="w-3.5 h-3.5" /> : <Layers className="w-3.5 h-3.5" />}
                                    </div>
                                    <div>
                                        <p className={`text-xs sm:text-sm font-bold ${isPersonalizedMode ? 'text-blue-800' : 'text-slate-700'}`}>Bật gửi file khớp cá nhân</p>
                                        {isPersonalizedMode && <p className="text-xs text-blue-600 font-medium mt-0.5">Tự động tìm file chứa Email Khách hàng</p>}
                                    </div>
                                </div>
                                <div className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-300 flex items-center ml-3 shrink-0 ${isPersonalizedMode ? 'bg-blue-600 justify-end' : 'bg-slate-300 justify-start'}`}>
                                    <div className="w-5 h-5 bg-white rounded-full shadow-xs"></div>
                                </div>
                            </div>

                            {isPersonalizedMode && (
                                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 shadow-xs space-y-3 animate-in slide-in-from-top-2">
                                    <h5 className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center gap-2">
                                        <Info className="w-3.5 h-3.5 text-blue-500" />
                                        Quy trình gửi tệp cá nhân hóa
                                    </h5>
                                    <div className="space-y-3">
                                        <div className="flex gap-2.5 items-start">
                                            <div className="w-5 h-5 shrink-0 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold shadow-xs mt-0.5">1</div>
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-bold text-slate-800">Quy tắc đặt tên file nghiêm ngặt</p>
                                                <p className="text-[11.5px] text-slate-600 leading-relaxed">
                                                    Tên tệp phải chứa dấu gạch dưới <code>_</code> liền trước email: <code>BangDiem_user@gmail.com.pdf</code>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2.5 items-start">
                                            <div className="w-5 h-5 shrink-0 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold shadow-xs mt-0.5">2</div>
                                            <div className="space-y-0.5">
                                                <p className="text-xs font-bold text-slate-800">Mapping tự động & bảo mật</p>
                                                <p className="text-[11.5px] text-slate-600 leading-relaxed">
                                                    Hệ thống chỉ gửi tệp tương ứng cho đúng email có tên khớp. Tên file gửi đi sẽ được làm sạch tự động.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className={`space-y-2.5 ${isAlreadySent ? 'opacity-50 pointer-events-none' : ''}`}>
                                {/* Row: Upload + Library */}
                                <div className="flex gap-2">
                                    <div
                                        onClick={() => {
                                             if (isAlreadySent) return;
                                            if (isPersonalizedMode) setIsUploadModalOpen(true);
                                            else fileInputRef.current?.click();
                                        }}
                                        className="flex-1 cursor-pointer py-2.5 px-3.5 border border-dashed border-slate-300 rounded-xl flex items-center justify-center gap-2 text-slate-600 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50/30 transition-all font-bold text-xs shadow-xs"
                                    >
                                        {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                        <span className="uppercase tracking-wider">
                                            {isPersonalizedMode ? 'Upload (Email)' : 'Upload File'}
                                        </span>
                                        {!isPersonalizedMode && <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} disabled={isUploading || isAlreadySent} />}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => !isAlreadySent && setIsLibraryOpen(true)}
                                        className="px-3.5 py-2.5 border border-dashed border-blue-200 rounded-xl flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:border-blue-400 hover:bg-blue-50/40 transition-all text-xs font-bold uppercase tracking-wider shrink-0 shadow-xs"
                                        title="Chọn file từ thư viện đã upload"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M3 7h18M3 12h18M3 17h18" strokeLinecap="round"/>
                                            <rect x="3" y="3" width="7" height="7" rx="1"/>
                                        </svg>
                                        Thư viện
                                    </button>
                                </div>

                                {attachments.length > 0 && (() => {
                                    const ATTACHMENTS_PER_PAGE = 20;
                                    const totalAttachmentPages = Math.ceil(attachments.length / ATTACHMENTS_PER_PAGE);
                                    const displayedAttachments = attachments.slice((attachmentPage - 1) * ATTACHMENTS_PER_PAGE, attachmentPage * ATTACHMENTS_PER_PAGE);

                                    return (
                                        <div className="space-y-1.5 pt-1">
                                            <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
                                                {displayedAttachments.map((att) => (
                                                    <div key={att.id} className={`border rounded-xl p-2 animate-in fade-in slide-in-from-bottom-2 transition-colors ${att.logic !== 'all' ? 'bg-blue-50/30 border-blue-100' : 'bg-white border-slate-100'}`}>
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-2 overflow-hidden">
                                                                <a href={att.url || '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 group flex-1 min-w-0" title="Bấm để xem tệp">
                                                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border transition-colors ${att.logic !== 'all' ? 'bg-blue-100 text-blue-600 border-blue-200 group-hover:bg-blue-500 group-hover:text-white' : 'bg-slate-50 text-slate-400 border-slate-100 group-hover:bg-blue-500 group-hover:text-white group-hover:border-blue-500'}`}>
                                                                        <FileIcon className="w-3.5 h-3.5" />
                                                                    </div>
                                                                    <div className="min-w-0 cursor-pointer">
                                                                        <p className="text-xs font-bold text-slate-700 truncate group-hover:text-blue-600 transition-colors" title={att.name}>{att.name}</p>
                                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                                            <p className="text-[10px] text-slate-400 font-mono">{(att.size / 1024).toFixed(1)} KB</p>
                                                                            {att.logic !== 'all' && <span className="text-[8px] font-black text-blue-600 bg-blue-100 px-1.5 py-0.2 rounded uppercase">Personalized</span>}
                                                                        </div>
                                                                    </div>
                                                                </a>
                                                            </div>
                                                            <button onClick={() => !isAlreadySent && setAttachmentToDelete(att.id)} className="text-slate-300 hover:text-rose-500 p-0.5" disabled={isAlreadySent}><X className="w-3.5 h-3.5" /></button>
                                                        </div>

                                                        {att.logic === 'match_email' && (
                                                            <p className="text-[10px] text-blue-600 mt-0.5 px-1 flex items-center gap-1 font-medium bg-white/60 p-1 rounded-lg">
                                                                <Filter className="w-3.5 h-3.5" /> Chỉ gửi cho Email khớp trong tên file.
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {totalAttachmentPages > 1 && (
                                                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-xs font-bold text-slate-500">
                                                    <button
                                                        onClick={() => setAttachmentPage(p => Math.max(1, p - 1))}
                                                        disabled={attachmentPage === 1}
                                                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors cursor-pointer text-[10px]"
                                                    >
                                                        ← Trước
                                                    </button>
                                                    <span className="text-[10px] text-slate-400">Trang {attachmentPage}/{totalAttachmentPages} ({attachments.length} tệp)</span>
                                                    <button
                                                        onClick={() => setAttachmentPage(p => Math.min(totalAttachmentPages, p + 1))}
                                                        disabled={attachmentPage === totalAttachmentPages}
                                                        className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors cursor-pointer text-[10px]"
                                                    >
                                                        Sau →
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Timing Card */}
                    <div className="p-4 border border-slate-200/90 bg-white rounded-2xl shadow-xs space-y-3.5">
                        <div className="flex items-center gap-2.5">
                            <div className={`p-1.5 rounded-lg transition-colors ${scheduleMode === 'now' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                <Clock className="w-4 h-4" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-800 text-sm sm:text-base">Thời điểm gửi</h4>
                                <p className="text-xs text-slate-400 font-medium mt-0.5">Thiết lập thời gian khởi chạy chiến dịch</p>
                            </div>
                        </div>

                        {isZns && (() => {
                            const checkDate = scheduleMode === 'later' ? (() => {
                                let d = new Date(selectedDate);
                                d.setHours(parseInt(selectedHour));
                                d.setMinutes(parseInt(selectedMinute));
                                return d;
                            })() : new Date();

                            const hour = checkDate.getHours();
                            const isTimeRestricted = hour < 6 || hour >= 22;

                            if (!isTimeRestricted) return null;

                            return (
                                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2.5 animate-in slide-in-from-top-2 duration-300">
                                    <div className="p-1 bg-rose-500 text-white rounded-md shadow-sm mt-0.5">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 space-y-0.5">
                                        <h5 className="text-xs font-black text-rose-900 uppercase tracking-tight">Ngoài khung giờ gửi ZNS quy định</h5>
                                        <p className="text-xs text-rose-700 font-medium leading-relaxed">
                                            Theo chính sách của Zalo, tin nhắn ZNS chỉ được phép gửi trong khung giờ từ <strong>06:00 đến 22:00</strong> hàng ngày.
                                        </p>
                                    </div>
                                </div>
                            );
                        })()}

                        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
                            <button
                                onClick={() => !isAlreadySent && setScheduleMode('now')}
                                disabled={isAlreadySent}
                                className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${scheduleMode === 'now' ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20' : 'text-slate-600 hover:text-slate-900'} ${isAlreadySent ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Send className="w-3.5 h-3.5" /> Gửi ngay lập tức
                            </button>
                            <button
                                onClick={() => !isAlreadySent && setScheduleMode('later')}
                                disabled={isAlreadySent}
                                className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase transition-all flex items-center justify-center gap-2 ${scheduleMode === 'later' ? 'bg-white shadow-md text-[#ca7900]' : 'text-slate-600 hover:text-slate-900'} ${isAlreadySent ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <Calendar className="w-3.5 h-3.5" /> Lên lịch gửi
                            </button>
                        </div>

                        {scheduleMode === 'later' && !isAlreadySent && (
                            <div className="animate-in slide-in-from-top-2 space-y-3 pt-0.5">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block ml-0.5">Chọn ngày</label>
                                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                                        {nextDays.map((d, i) => {
                                            const isSelected = !isCustomDate && d.toDateString() === selectedDate.toDateString();
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => { setSelectedDate(d); setIsCustomDate(false); }}
                                                    className={`flex flex-col items-center justify-center w-14 h-16 rounded-xl border transition-all flex-shrink-0 ${isSelected ? 'border-[#2563eb] bg-orange-50 text-[#ca7900] shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}
                                                >
                                                    <span className="text-[9px] font-bold uppercase">{getDayLabel(d, i)}</span>
                                                    <span className="text-lg font-black mt-0.5">{d.getDate()}</span>
                                                    <span className="text-[8px] font-medium opacity-60">Thg {d.getMonth() + 1}</span>
                                                </button>
                                            );
                                        })}
                                        <button onClick={() => setIsCustomDate(true)} className={`flex flex-col items-center justify-center w-14 h-16 rounded-xl border transition-all flex-shrink-0 ${isCustomDate ? 'border-[#2563eb] bg-orange-50 text-[#ca7900] shadow-sm' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}`}>
                                            <CalendarDays className="w-3.5 h-3.5 mb-0.5" />
                                            <span className="text-[8px] font-bold uppercase text-center leading-tight">Ngày<br />khác</span>
                                        </button>
                                    </div>
                                </div>
                                {isCustomDate && (
                                    <div className="animate-in slide-in-from-top-2">
                                        <Input
                                            label="Ngày cụ thể"
                                            type="date"
                                            min={new Date().toISOString().split('T')[0]}
                                            value={customDateValue}
                                            onChange={(e) => setCustomDateValue(e.target.value)}
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-400 mb-1.5 block ml-0.5">Giờ gửi (24h)</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <Select
                                                value={selectedHour}
                                                onChange={(val) => setSelectedHour(val)}
                                                options={Array.from({ length: 24 }, (_, i) => {
                                                    const h = i.toString().padStart(2, '0');
                                                    return { value: h, label: `${h} giờ` };
                                                })}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <Select
                                                value={selectedMinute}
                                                onChange={(val) => setSelectedMinute(val)}
                                                options={['00', '15', '30', '45'].map(m => ({ value: m, label: `${m} phút` }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-2.5">
                                    <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
                                    <div>
                                        <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">Thời gian dự kiến</p>
                                        <p className="text-xs font-black text-blue-900 mt-0.5">
                                            {selectedHour}:{selectedMinute} - {(isCustomDate && customDateValue) ? new Date(customDateValue).toLocaleDateString('vi-VN') : selectedDate.toLocaleDateString('vi-VN')}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isAlreadySent && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2.5">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                <p className="text-xs font-bold text-amber-700">Chiến dịch này đã hoàn tất hoặc đang được gửi. Không thể thay đổi lịch trình.</p>
                            </div>
                        )}

                        {scheduleMode === 'now' && !isAlreadySent && (
                            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-2.5 animate-in fade-in">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <p className="text-xs font-bold text-emerald-800">Hệ thống đã sẵn sàng gửi ngay.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* FULL WIDTH INLINE PREVIEW */}
            <div className="bg-slate-100 rounded-[32px] p-2 sm:p-4 border border-slate-200 shadow-sm relative overflow-hidden flex flex-col items-center">
                {/* Preview Toolbar */}
                <div className="w-full flex justify-between items-center px-4 py-3 mb-2">
                    <h5 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                        <Layout className="w-4 h-4 text-orange-500" /> Xem trước nội dung
                    </h5>
                    {!isZns && (
                        <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex gap-1">
                            <button onClick={() => setPreviewDevice('desktop')} className={`p-2 rounded-lg transition-all ${previewDevice === 'desktop' ? 'bg-[#2563eb] text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`} title="Desktop"><Monitor className="w-4 h-4" /></button>
                            <button onClick={() => setPreviewDevice('mobile')} className={`p-2 rounded-lg transition-all ${previewDevice === 'mobile' ? 'bg-[#2563eb] text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`} title="Mobile"><Smartphone className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>

                {/* Iframe Container */}
                <div className="w-full flex justify-center bg-slate-200/50 rounded-[24px] overflow-hidden border border-slate-200 min-h-[600px] relative">
                    <div className={`transition-all duration-500 ease-in-out bg-white shadow-2xl overflow-hidden my-8 relative ${previewDevice === 'mobile' || isZns ? 'w-[375px] h-[667px] rounded-[32px] border-8 border-slate-800' : 'w-full max-w-3xl h-[700px] rounded-2xl border border-slate-200/60'}`}>
                        {(previewDevice === 'mobile' || isZns) && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-xl z-20"></div>}
                        {isZns ? (
                            <iframe
                                src={selectedTemplate?.template_data?.detail?.previewUrl || selectedTemplate?.template_data?.raw?.previewUrl}
                                className="w-full h-full border-none bg-white"
                                title="ZNS Preview"
                                sandbox="allow-scripts allow-same-origin"
                            />
                        ) : (
                            <iframe
                                srcDoc={interpolatedPreviewHtml || ''}
                                className="w-full h-full border-none bg-white"
                                title="Email Preview"
                                sandbox="allow-same-origin allow-scripts"
                            />
                        )}
                    </div>
                </div>
            </div>
            {/* Confirm Modal */}
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
                targetConfig={formData.target}
            />

            {/* File Library Modal */}
            <FileLibraryModal
                isOpen={isLibraryOpen}
                onClose={() => setIsLibraryOpen(false)}
                onSelect={(picked) => {
                    const newAtts = picked.map(f => ({
                        id: crypto.randomUUID(),
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
        </div>
    );
};

export default LaunchPreview;
