import * as React from 'react';
import { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import {
    Plus, TrendingUp, MousePointerClick,
    CheckCircle2, GitMerge, GitBranch, RefreshCw, FileText, CalendarClock, PieChart, Send, MailOpen, Paperclip, File as FileIcon,
    Search, ChevronLeft, ChevronRight, X, BarChart2, Calendar, Users, MailCheck, Activity, Zap, ExternalLink, Mail, Bell, Clock, Activity as ActivityIcon, MousePointer2, BadgeCheck, FileBarChart, MousePointerClick as ClickIcon,
    Layers, List, AlertOctagon, UserMinus, History, Tag, Loader2, ShieldCheck, Smartphone, Globe, Laptop, Trash2, Monitor, Flame, Link as LinkIcon, PauseCircle, PlayCircle, ArrowLeft,
    Edit2, Check
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RePieChart, Pie, AreaChart, Area, FunnelChart, Funnel, LabelList
} from 'recharts';
import { Campaign, CampaignStatus, Segment, Flow } from '../../types';
import { useNavigate } from 'react-router-dom';
import Badge from '../common/Badge';
import Card from '../common/Card';
import Tabs from '../common/Tabs';
import Button from '../common/Button';
import toast from 'react-hot-toast';
import { api } from '../../services/storageAdapter';
import CampaignDeliveryDetailsTab from './CampaignDeliveryDetailsTab';
import TestEmailModal from './TestEmailModal';
import LinkClicksTab from '../common/LinkClicksTab';
import TechStatsTab from './TechStatsTab';
import ConfirmModal from '../common/ConfirmModal';
import Pagination from '../common/Pagination';
import { interpolateMergeTags } from '../../utils/formatters';
import { Avatar } from '../../../ui/Avatar';
import { pushOverlay } from '../../../../utils/overlayStack';
import { getMktPortalRoot } from '../../utils/portalRoot';

interface CampaignDetailDrawerProps {
    campaign: Campaign | null;
    isOpen: boolean;
    onClose: () => void;
    allLists: any[];
    allSegments: Segment[];
    allTags: any[];
    allFlows: Flow[];
    onRename?: (id: string, newName: string) => void;
}

const CampaignDetailDrawer: React.FC<CampaignDetailDrawerProps> = ({
    campaign, isOpen, onClose, allLists, allSegments, allTags, allFlows, onRename
}) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [initialAudienceFilter, setInitialAudienceFilter] = useState('all');
    const [activityLogs, setActivityLogs] = useState<any[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logsPagination, setLogsPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    const [previewType, setPreviewType] = useState<'main' | string>('main');
    const [previewContent, setPreviewContent] = useState({ html: '', subject: '', loading: false });
    const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
    const [audienceStats, setAudienceStats] = useState<{ total_current: number, count_sent: number, gap: number, count_unsubscribed?: number, reminders: any[] } | null>(null);
    const [refreshLoading, setRefreshLoading] = useState(false);
    const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);
    const [activitySearch, setActivitySearch] = useState('');
    const [debouncedActivitySearch, setDebouncedActivitySearch] = useState('');


    const [showTestModal, setShowTestModal] = useState(false);
    const [localCampaign, setLocalCampaign] = useState<Campaign | null>(campaign);

    // Inline Rename State
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState('');
    const [isSavingName, setIsSavingName] = useState(false);

    // Attachment Management & Clear State
    const [attachmentPage, setAttachmentPage] = useState(1);
    const [showClearAttachmentsModal, setShowClearAttachmentsModal] = useState(false);
    const [clearingAttachments, setClearingAttachments] = useState(false);

    const handleClearAttachments = async () => {
        if (!localCampaign?.id) return;
        setClearingAttachments(true);
        try {
            const res = await api.post<any>('campaigns?route=clear_attachments', { id: localCampaign.id });
            if (res.success) {
                toast.success(res.message || "Đã làm sạch tệp đính kèm trên máy chủ thành công!");
                setLocalCampaign(prev => prev ? { ...prev, attachments: [] } : null);
                setShowClearAttachmentsModal(false);
            } else {
                toast.error(res.message || "Không thể dọn dẹp tệp đính kèm");
            }
        } catch (err: any) {
            toast.error(err?.message || "Lỗi khi dọn dẹp tệp đính kèm");
        } finally {
            setClearingAttachments(false);
        }
    };

    const sampleSubscriber = React.useMemo(() => ({
        id: 'sample_01',
        fullName: 'Khách hàng mẫu',
        full_name: 'Khách hàng mẫu',
        firstName: 'Phúc',
        first_name: 'Phúc',
        lastName: 'Trần Trọng',
        last_name: 'Trần Trọng',
        email: 'trongphuc@ideas.edu.vn',
        phone: '0901234567',
        company: 'IDEAS Vietnam',
        companyName: 'IDEAS Vietnam',
        jobTitle: 'Học viên K2026',
        job_title: 'Học viên K2026'
    }), []);

    useEffect(() => {
        if (localCampaign?.name) {
            setNameInput(localCampaign.name);
        }
    }, [localCampaign?.name]);

    // Live Auto-poll while campaign is actively sending
    useEffect(() => {
        let pollTimer: ReturnType<typeof setInterval> | null = null;
        if (isOpen && localCampaign?.id && localCampaign?.status === 'sending') {
            pollTimer = setInterval(async () => {
                const res = await api.get<any>(`campaigns?id=${localCampaign.id}`);
                if (res.success && res.data) {
                    setLocalCampaign(prev => ({ ...prev, ...res.data }));
                    if (res.data.status !== 'sending') {
                        if (pollTimer) clearInterval(pollTimer);
                    }
                }
            }, 2000);
        }
        return () => {
            if (pollTimer) clearInterval(pollTimer);
        };
    }, [isOpen, localCampaign?.id, localCampaign?.status]);

    const handleSaveName = async () => {
        const trimmed = nameInput.trim();
        if (!trimmed || !localCampaign || trimmed === localCampaign.name) {
            setIsEditingName(false);
            return;
        }
        setIsSavingName(true);
        try {
            const res = await api.post<any>('campaigns?route=rename', { id: localCampaign.id, name: trimmed });
            if (res.success) {
                toast.success('Đã cập nhật tên chiến dịch thành công!');
                setLocalCampaign(prev => prev ? { ...prev, name: trimmed } : null);
                onRename?.(localCampaign.id, trimmed);
                setIsEditingName(false);
            } else {
                toast.error(res.message || 'Không thể đổi tên chiến dịch');
            }
        } catch (err) {
            console.error('Rename campaign error:', err);
            toast.error('Lỗi khi đổi tên chiến dịch');
        } finally {
            setIsSavingName(false);
        }
    };

    // Extract unique links from email HTML
    const uniqueLinks = React.useMemo(() => {
        // Safe check for localCampaign
        if (!previewContent.html || !localCampaign || localCampaign.type === 'zalo_zns') return [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(previewContent.html, 'text/html');
        const anchors = doc.querySelectorAll('a[href]');
        const linksSet = new Set<string>();
        
        anchors.forEach(a => {
            let url = (a.getAttribute('href') || '').trim();
            if (!url || url === '#' || /^(?:mailto:|tel:|javascript:|data:|\{\{)/i.test(url)) return;
            if (url.startsWith('//')) url = 'https:' + url;
            else if (!/^https?:\/\//i.test(url) && !url.startsWith('/') && /^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(url)) {
                url = 'https://' + url;
            }
            if (url.startsWith('http://') || url.startsWith('https://')) {
                try {
                    const urlObj = new URL(url);
                    // Remove tracking/cta params to deduplicate
                    urlObj.searchParams.delete('mc_cta');
                    urlObj.searchParams.delete('mc_cid');
                    urlObj.searchParams.delete('mc_eid');
                    
                    // Clean trailing slash if path is empty
                    let cleanUrl = urlObj.toString();
                    if (cleanUrl.endsWith('/') && urlObj.pathname === '/') {
                        cleanUrl = cleanUrl.slice(0, -1);
                    }
                    linksSet.add(cleanUrl);
                } catch (e) {
                    linksSet.add(url.split('?mc_cta')[0]);
                }
            }
        });
        return Array.from(linksSet);
    }, [previewContent.html, localCampaign?.type]);
    
    const [statsLoading, setStatsLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);

    const [deleteModal, setDeleteModal] = useState<{
        isOpen: boolean;
        loading: boolean;
        list: any[];
        page: number;
        totalPages: number;
        total: number;
        fetchingList: boolean;
    }>({ isOpen: false, loading: false, list: [], page: 1, totalPages: 1, total: 0, fetchingList: false });

    useEffect(() => {
        if (!isOpen) return;
        return pushOverlay('campaign-detail-drawer', onClose, 2000);
    }, [isOpen, onClose]);

    useEffect(() => {
        if (campaign && isOpen) {
            if (campaign.id !== localCampaign?.id) {
                setActiveTab('overview');
                setAudienceStats(null);
                setPreviewType('main');
                setLogsPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
                setLocalCampaign(campaign);
            } else {
                setLocalCampaign(campaign);
            }

            setIsVisible(true);
            const timer = setTimeout(() => setAnimateIn(true), 10);
            return () => clearTimeout(timer);
        } else if (!isOpen) {
            setAnimateIn(false);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setLocalCampaign(null);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [campaign, isOpen]);

    const handleNavigateToAudienceFilter = (filter: string) => {
        setInitialAudienceFilter(filter);
        setActiveTab('delivery');
    };

    // Poll for activity logs and campaign stats when drawer is open and relevant tabs are active
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedActivitySearch(activitySearch);
        }, 500);
        return () => clearTimeout(timer);
    }, [activitySearch]);

    useEffect(() => {
        if (localCampaign?.id && isVisible && activeTab === 'activity') {
            setLogsPagination(prev => ({ ...prev, page: 1 }));
            if (logsPagination.page === 1) {
                fetchLogs(1);
            }
        }
    }, [debouncedActivitySearch]);

    useEffect(() => {
        if (localCampaign?.id && isVisible && activeTab === 'activity') {
            fetchLogs(logsPagination.page);
        }
    }, [localCampaign?.id, isVisible, activeTab, logsPagination.page, debouncedActivitySearch]);

    // Fetch fresh stats at least once when opened to trigger backend self-healing
    // Polling logic continues only for "sending" status progress + stats update
    useEffect(() => {
        let pollTimer: any;
        if (isVisible && localCampaign?.id) {
            // Unconditional initial fetch to grab latest healed DB state
            const fetchCampaign = async () => {
                const res = await api.get<any>(`campaigns?id=${localCampaign.id}`);
                if (res.success) {
                    setLocalCampaign(res.data);
                }
            };
            fetchCampaign();

            // [FIX P8-C3] Include 'paused' in polling — admin may resume via backend,
            // drawer should auto-refresh without requiring full page reload.
            if (['sending', 'scheduled', 'paused'].includes(localCampaign.status?.toLowerCase() || '')) {
                pollTimer = setInterval(async () => {
                    const res = await api.get<any>(`campaigns?id=${localCampaign.id}`);
                    if (res.success) {
                        setLocalCampaign(res.data);
                        if (!['sending', 'scheduled', 'paused'].includes(res.data.status?.toLowerCase() || '')) {
                            clearInterval(pollTimer);
                        }
                    }
                }, 5000);
            }
        }
        return () => {
            if (pollTimer) clearInterval(pollTimer);
        };
    }, [isVisible, localCampaign?.id, localCampaign?.status]);

    const fetchLogs = async (page = 1) => {
        if (!campaign) return;
        setLoadingLogs(true);
        const searchQuery = debouncedActivitySearch ? `&search=${encodeURIComponent(debouncedActivitySearch)}` : '';
        const res = await api.get<any>(`flows?route=history&campaign_id=${campaign.id}&page=${page}&limit=${logsPagination.limit}${searchQuery}`);
        if (res.success) {
            if (res.data.pagination) {
                setActivityLogs(res.data.data);
                setLogsPagination(res.data.pagination);
            } else {
                setActivityLogs(res.data);
            }
        }
        setLoadingLogs(false);
    };

    // Effect for Content Preview
    useEffect(() => {
        if (campaign?.id && isOpen && activeTab === 'content') {
            fetchPreviewData();
        }
    }, [campaign?.id, isOpen, activeTab, previewType]);

    const fetchPreviewData = async () => {
        if (!campaign) return;
        setPreviewContent(prev => ({ ...prev, loading: true }));
        try {
            const reminderId = previewType === 'main' ? '' : previewType;
            const res = await api.get<any>(`campaign_preview?campaign_id=${campaign.id}&reminder_id=${reminderId}`);
            if (res.success) {
                setPreviewContent({ html: res.data.html, subject: res.data.subject, loading: false });
            } else {
                setPreviewContent(prev => ({ ...prev, loading: false }));
            }
        } catch (err) {
            setPreviewContent(prev => ({ ...prev, loading: false }));
        }
    };

    // Effect for Audience Stats
    useEffect(() => {
        if (campaign?.id && isOpen && activeTab === 'audience' && campaign.status === 'sent') {
            fetchAudienceStats();
        }
    }, [campaign?.id, isOpen, activeTab]);

    const fetchAudienceStats = async () => {
        if (!campaign) return;
        setStatsLoading(true);
        try {
            const res = await api.get<any>(`campaigns?route=audience_stats&id=${campaign.id}`);
            if (res.success) {
                setAudienceStats(res.data);
            }
        } finally {
            setStatsLoading(false);
        }
    };

    const [pauseLoading, setPauseLoading] = useState(false);
    const handlePauseCampaign = async () => {
        if (!localCampaign?.id) return;
        setPauseLoading(true);
        try {
            const res = await api.post<any>('campaigns?route=pause', { campaign_id: localCampaign.id });
            if (res.success) {
                setLocalCampaign(prev => prev ? { ...prev, status: CampaignStatus.PAUSED } : null);
                toast.success('Đã tạm dừng chiến dịch thành công!');
                fetchAudienceStats();
            } else {
                toast.error(res.message || "Không thể tạm dừng chiến dịch.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Đã xảy ra lỗi khi tạm dừng chiến dịch.");
        } finally {
            setPauseLoading(false);
        }
    };

    const handleTriggerRefresh = async () => {
        if (!campaign) return;
        setRefreshLoading(true);
        try {
            const res = await api.post<any>(`campaigns?route=trigger_refresh`, { id: campaign.id });
            if (res.success) {
                setShowRefreshConfirm(false);
                fetchAudienceStats();
                setLocalCampaign(prev => prev ? { ...prev, status: CampaignStatus.SENDING, totalTargetAudience: res.data?.total_target_audience || prev.totalTargetAudience } : null);
                toast.success(`Bắt đầu làm mới chiến dịch! Các thành viên mới sẽ sớm nhận được ${isZns ? 'tin nhắn' : 'email'}.`);
            } else {
                toast.error(res.message || "Không thể làm mới chiến dịch.");
            }
        } catch (err) {
            console.error(err);
            toast.error("Đã xảy ra lỗi khi gửi yêu cầu.");
        }
        setRefreshLoading(false);
    };

    const fetchUnsubscribedList = async (page: number = 1) => {
        if (!campaign) return;
        setDeleteModal(prev => ({ ...prev, fetchingList: true, page }));
        try {
            const res = await api.get<any>(`campaigns?route=unsubscribed_list&id=${campaign.id}&page=${page}&limit=10`);
            if (res && res.success && res.data) {
                setDeleteModal(prev => ({
                    ...prev,
                    fetchingList: false,
                    list: res.data.data || [],
                    totalPages: res.data.pagination?.totalPages || 1,
                    total: res.data.pagination?.total || 0
                }));
            } else {
                setDeleteModal(prev => ({ ...prev, fetchingList: false }));
                toast.error("Không thể lấy danh sách, server phản hồi lỗi hoặc chưa nạp API mới!");
            }
        } catch (err) {
            console.error("fetchUnsubscribedList Error:", err);
            toast.error("Lỗi kết nối API lấy danh sách Unsub. Hãy chắc chắn bạn đã upload file api/campaigns.php!");
            setDeleteModal(prev => ({ ...prev, fetchingList: false }));
        }
    };

    useEffect(() => {
        if (deleteModal.isOpen && campaign) {
            fetchUnsubscribedList(deleteModal.page);
        }
    }, [deleteModal.isOpen, deleteModal.page, campaign]);

    const handleDeleteUnsubscribed = async () => {
        if (!campaign) return;
        setDeleteModal(prev => ({ ...prev, loading: true }));
        try {
            const res = await api.post<any>('campaigns?route=delete_unsubscribed', { id: campaign.id });
            if (res.success) {
                toast.success(`Đã xóa vĩnh viễn ${res.data?.deleted || 0} liên hệ Hủy đăng ký khỏi hệ thống.`);
                setDeleteModal(prev => ({ ...prev, isOpen: false, loading: false }));
                fetchAudienceStats();
            } else {
                toast.error(res.message || "Lỗi khi xóa liên hệ.");
                setDeleteModal(prev => ({ ...prev, loading: false }));
            }
        } catch (err) {
            console.error(err);
            toast.error("Lỗi khi gọi API xóa.");
            setDeleteModal(prev => ({ ...prev, loading: false }));
        }
    };

    const parsedAttachments = React.useMemo(() => {
        try {
            return typeof localCampaign?.attachments === 'string' ? JSON.parse(localCampaign.attachments) : localCampaign?.attachments || [];
        } catch (e) {
            return [];
        }
    }, [localCampaign?.attachments]);

    if (!localCampaign) return null;

    const stats = localCampaign.stats || { sent: 0, opened: 0, clicked: 0, bounced: 0, spam: 0, unsubscribed: 0, failed: 0 };
    // Real Calculations
    const isSent = localCampaign.status === CampaignStatus.SENT;
    const sentCount = stats.sent || 0;
    const deliveredCount = Math.max(0, sentCount - (stats.bounced || 0));
    const retainedCount = Math.max(0, sentCount - (stats.bounced || 0) - (stats.unsubscribed || 0));

    const isZns = localCampaign.type === 'zalo_zns';
    const openRate = (sentCount > 0 && isFinite(stats.opened / sentCount)) ? ((stats.opened / sentCount) * 100).toFixed(1) : "0.0";
    const clickRate = (sentCount > 0 && isFinite(stats.clicked / sentCount)) ? ((stats.clicked / sentCount) * 100).toFixed(1) : "0.0";
    const clickToOpenRate = (stats.opened > 0 && isFinite(stats.clicked / stats.opened)) ? ((stats.clicked / stats.opened) * 100).toFixed(1) : "0.0";

    const bounceRate = (sentCount > 0 && isFinite(stats.bounced / sentCount)) ? ((stats.bounced / sentCount) * 100).toFixed(2) : "0.00";
    const unsubRate = (sentCount > 0 && isFinite(stats.unsubscribed / sentCount)) ? ((stats.unsubscribed / sentCount) * 100).toFixed(2) : "0.00";
    const deliveryRate = (sentCount > 0 && isFinite(deliveredCount / sentCount)) ? ((deliveredCount / sentCount) * 100).toFixed(1) : "0.0";
    const retainedRate = (sentCount > 0 && isFinite(retainedCount / sentCount)) ? ((retainedCount / sentCount) * 100).toFixed(1) : "0.0";

    const funnelData = [
        { name: isZns ? 'Tin nhắn đã gửi' : 'Đã gửi (Sent)', value: sentCount, fill: '#94a3b8', icon: Send },
        { name: isZns ? 'Đã nhận (Delivered)' : 'Đã nhận (Delivered)', value: deliveredCount, fill: '#2563eb', icon: CheckCircle2 },
        { name: isZns ? 'Lượt xem (Seen)' : 'Đã mở (Opened)', value: stats.opened, fill: '#10b981', icon: isZns ? BadgeCheck : MailOpen },
        ...(isZns ? [] : [{ name: 'Đã click (Unique Click)', value: stats.clicked, fill: '#ec4899', icon: MousePointer2, subValue: (stats as any).total_clicked ? `Total: ${(stats as any).total_clicked}` : null }]),
    ];

    const healthData = [
        { name: isZns ? 'Đã nhận' : 'Hộp thư chính', value: retainedCount, fill: '#10b981' },
        { name: isZns ? 'Lỗi gửi' : 'Tỷ lệ (Bounce)', value: stats.bounced, fill: '#f43f5e' },
        ...(isZns ? [] : [{ name: 'Hủy đăng ký (Unsub)', value: stats.unsubscribed, fill: '#8b5cf6' }])
    ].filter(d => d.value > 0);

    const targetLists = localCampaign.target?.listIds.map(id => allLists.find(l => l.id === id)).filter(Boolean) || [];
    const targetSegments = localCampaign.target?.segmentIds.map(id => allSegments.find(s => s.id === id)).filter(Boolean) || [];
    const targetTags = localCampaign.target?.tagIds?.map(name => allTags.find(t => t.name === name)).filter(Boolean) || [];

    // For SENT campaigns: show actual sent count (truth). For others: show configured estimate.
    const totalAudience = (localCampaign.status === 'sent' || localCampaign.status === 'sending')
        ? (stats.sent || localCampaign.totalTargetAudience || 0)
        : (localCampaign.totalTargetAudience || 0);

    const StatBox = ({ label, value, subValue, icon: Icon, colorClass }: any) => {
        const accentColor = (() => {
            if (colorClass.includes('emerald') || colorClass.includes('green') || colorClass.includes('10b981')) return '#10b981';
            if (colorClass.includes('rose') || colorClass.includes('pink') || colorClass.includes('ec4899')) return '#ec4899';
            if (colorClass.includes('blue') || colorClass.includes('indigo')) return '#3b82f6';
            return '#8b5cf6';
        })();

        const decorSvg = (() => {
            if (accentColor === '#10b981') {
                return (
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <rect x="20" y="20" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.6" />
                        <rect x="20" y="42" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.4" />
                        <rect x="20" y="64" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.2" />
                    </svg>
                );
            }
            if (accentColor === '#ec4899') {
                return (
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
                        <path d="M50 35 V 65 M35 50 H 65" stroke="currentColor" strokeWidth="3" stroke-linecap="round" />
                    </svg>
                );
            }
            if (accentColor === '#3b82f6') {
                return (
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <path d="M10 50 Q 50 10 90 50 T 90 90" stroke="currentColor" strokeWidth="2" stroke-dasharray="3 3" />
                        <circle cx="10" cy="50" r="6" fill="currentColor" />
                        <circle cx="50" cy="10" r="6" fill="currentColor" />
                        <circle cx="90" cy="50" r="6" fill="currentColor" />
                        <path d="M50 10 L 90 50" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                );
            }
            return (
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" stroke-dasharray="4 4" />
                    <circle cx="35" cy="45" r="15" fill="currentColor" fillOpacity="0.2" />
                    <circle cx="65" cy="45" r="15" fill="currentColor" fillOpacity="0.4" />
                    <circle cx="50" cy="70" r="18" fill="currentColor" fillOpacity="0.6" />
                </svg>
            );
        })();

        return (
            <div className="stat-card bg-white dark:bg-slate-900 p-5 md:p-6 rounded-2xl md:rounded-[24px] border border-slate-100/70 dark:border-slate-800/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_36px_rgba(0,0,0,0.035)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden flex items-center justify-between group cursor-pointer">
                {decorSvg && (
                    <div className="decor-svg" style={{ color: accentColor }}>
                        {decorSvg}
                    </div>
                )}
                <div className="min-w-0 relative z-10">
                    <p className="text-[10px] md:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 leading-none">{label}</p>
                    <h4 className="text-xl md:text-2xl font-black text-slate-850 dark:text-slate-100 tracking-tight leading-none">{value}</h4>
                    {subValue && <p className="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 md:mt-2 uppercase tracking-tight truncate max-w-[150px] md:max-w-none">{subValue}</p>}
                </div>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 relative z-10 ml-4" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                    <Icon className="w-4 h-4" />
                </div>
            </div>
        );
    };

    return ReactDOM.createPortal(
        <div
            className={`fixed inset-0 flex justify-end ${isVisible ? 'pointer-events-auto' : 'pointer-events-none'}`}
            style={{ zIndex: 2147483625 }}
        >
            <div className={`absolute inset-0 bg-black/80 backdrop-blur-[2px] transition-opacity duration-500 ${animateIn ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
            
            {/* Floating Back Button on Backdrop */}
            <div 
                className={`hidden lg:flex absolute left-0 top-0 bottom-0 w-[var(--sidebar-width,220px)] items-center justify-center z-40 transition-opacity duration-500 ${animateIn ? 'opacity-100' : 'opacity-0'}`}
                style={{ pointerEvents: 'none' }}
            >
                <button
                    onClick={onClose}
                    className="w-12 h-12 rounded-full bg-slate-900/60 hover:bg-slate-900/80 text-white flex items-center justify-center shadow-2xl border border-slate-700/50 backdrop-blur-md transition-all duration-300 hover:scale-110 active:scale-95 cursor-pointer"
                    style={{ pointerEvents: 'auto' }}
                    title="Quay lại"
                >
                    <ArrowLeft className="w-6 h-6" />
                </button>
            </div>

            <div
                className={`campaign-detail-drawer relative w-full bg-[var(--color-bg)] border-l border-[var(--color-border)] shadow-2xl h-full lg:h-screen flex flex-col transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) ${animateIn ? 'translate-x-0 opacity-100' : 'translate-x-full lg:translate-x-[100px] opacity-0'}`}
            >
                {/* Header */}
                <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)] px-4 md:px-8 py-4 md:py-5 flex flex-col sm:flex-row justify-between items-start gap-4 shrink-0 shadow-sm z-30">
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1.5">
                            {/* Status badge with animated live indicators */}
                            {localCampaign.status === 'sending' ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-xs font-black uppercase tracking-wider shadow-md shadow-blue-500/30 animate-pulse">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                                    </span>
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    ĐANG GỬI ({Math.min(100, Math.round(((localCampaign.stats?.sent || 0) / Math.max(1, localCampaign.totalTargetAudience || 1)) * 100))}%)
                                </span>
                            ) : (
                                <Badge variant={
                                    localCampaign.status === 'sent' ? 'success' :
                                        localCampaign.status === 'scheduled' ? 'warning' : 'neutral'
                                } className={`px-2 py-0.5 md:px-3 md:py-1 text-[9px] md:text-xs ${
                                    localCampaign.status === 'paused' ? '!bg-orange-50 !text-orange-700 !border-orange-200' : ''
                                }`}>
                                    {localCampaign.status === 'paused' && <PauseCircle className="w-2.5 h-2.5" />}
                                    {(localCampaign.status || 'DRAFT').toUpperCase()}
                                </Badge>
                            )}
                            <span className="text-[9px] md:text-[11px] font-bold text-[var(--color-text-muted)] flex items-center gap-1">
                                <Calendar className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                {localCampaign.sentAt
                                    ? `Gửi lúc: ${!isNaN(new Date(localCampaign.sentAt).getTime()) ? new Date(localCampaign.sentAt).toLocaleString('vi-VN') : '...'}`
                                    : `Bản nháp`}
                            </span>
                            <span className="px-3 py-1 bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-secondary)] rounded-full text-[10px] md:text-xs font-black font-mono tracking-widest ml-2 shadow-sm">
                                ID: {localCampaign.id}
                            </span>
                        </div>
                        {isEditingName ? (
                            <div className="flex items-center gap-2 max-w-md my-1">
                                <input
                                    type="text"
                                    autoFocus
                                    value={nameInput}
                                    onChange={e => setNameInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleSaveName();
                                        if (e.key === 'Escape') setIsEditingName(false);
                                    }}
                                    disabled={isSavingName}
                                    className="px-3 py-1.5 text-base font-bold bg-[var(--color-surface)] border border-[var(--color-primary)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 text-[var(--color-text)] flex-1 shadow-sm"
                                    placeholder="Nhập tên chiến dịch..."
                                />
                                <button
                                    onClick={handleSaveName}
                                    disabled={isSavingName}
                                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-colors shrink-0"
                                    title="Lưu tên (Enter)"
                                >
                                    {isSavingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 stroke-[3]" />}
                                </button>
                                <button
                                    onClick={() => { if (localCampaign) setNameInput(localCampaign.name); setIsEditingName(false); }}
                                    disabled={isSavingName}
                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors shrink-0"
                                    title="Hủy (Esc)"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group/title my-0.5">
                                <h2 
                                    className="text-lg md:text-xl font-black text-[var(--color-text)] tracking-tight leading-tight truncate cursor-pointer hover:text-[var(--color-primary)] transition-colors"
                                    onDoubleClick={() => setIsEditingName(true)}
                                    title="Double-click để đổi tên"
                                >
                                    {localCampaign.name}
                                </h2>
                                <button
                                    onClick={() => setIsEditingName(true)}
                                    className="opacity-0 group-hover/title:opacity-100 p-1 text-slate-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 rounded-lg transition-all shrink-0"
                                    title="Đổi tên chiến dịch"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={async () => {
                                setRefreshLoading(true);
                                const res = await api.get<any>(`campaigns?id=${campaign.id}`);
                                if (res.success) {
                                    setLocalCampaign(res.data);
                                    toast.success("Đã làm mới dữ liệu Báo cáo");
                                }
                                setRefreshLoading(false);
                            }}
                            variant="secondary"
                            size="sm"
                            icon={RefreshCw}
                            disabled={refreshLoading}
                            className="!rounded-xl border-[var(--color-border)]"
                        >
                            <span className="hidden md:inline">{refreshLoading ? 'Đang làm mới...' : 'Làm mới'}</span>
                        </Button>
                        <Button
                            onClick={() => setShowTestModal(true)}
                            variant="secondary"
                            size="sm"
                            icon={Send}
                            className="!rounded-xl border-[var(--color-border)]"
                        >
                            <span className="hidden md:inline">{isZns ? 'Gửi Test ZNS' : 'Gửi Test Email'}</span>
                            <span className="md:hidden">Test</span>
                        </Button>
                        <button
                            onClick={onClose}
                            className="p-2 md:p-3 text-slate-400 hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] rounded-xl md:rounded-2xl transition-all"
                        >
                            <X className="w-5 h-5 md:w-6 md:h-6" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="px-4 md:px-8 py-3 bg-[var(--color-surface)] border-b border-[var(--color-border)] overflow-x-auto whitespace-nowrap scrollbar-hide">
                    <Tabs
                        variant="segmented"
                        activeId={activeTab}
                        onChange={(tabId) => {
                            if (tabId === 'delivery') {
                                setInitialAudienceFilter('all');
                            }
                            setActiveTab(tabId);
                        }}
                        items={[
                            { id: 'overview', label: 'Báo cáo', icon: BarChart2 },
                            { id: 'content', label: localCampaign.type === 'zalo_zns' ? 'Nội dung' : 'Nội dung', icon: FileText },
                            { id: 'audience', label: 'Đối tượng', icon: Users, count: totalAudience, countLabel: localCampaign.status === 'sent' ? 'đã gửi' : undefined },
                            { id: 'delivery', label: 'Lịch sử', icon: MailCheck },
                            ...(localCampaign.type !== 'zalo_zns' ? [
                                { id: 'links', label: 'Click Heatmap', icon: ClickIcon },
                                { id: 'tech', label: 'Thiết bị', icon: Smartphone },
                            ] : []),
                            { id: 'activity', label: 'Nhật ký Live', icon: Activity },
                        ]}
                    />
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 space-y-6 md:space-y-8 bg-[var(--color-bg)]">

                    {activeTab === 'overview' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-8">
                            {localCampaign.status === 'sending' && (
                                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 rounded-2xl border border-blue-500/30 p-6 shadow-xl shadow-blue-950/20 text-white relative overflow-hidden flex flex-col gap-4">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-400/10 rounded-full blur-[60px] pointer-events-none" />
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-12 h-12 bg-blue-500/20 text-cyan-300 border border-cyan-400/30 rounded-2xl flex items-center justify-center shadow-inner relative">
                                                <Send className="w-6 h-6 animate-pulse" />
                                                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-400"></span>
                                                </span>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h5 className="text-sm md:text-base font-black text-white uppercase tracking-tight">
                                                        Chiến dịch đang được gửi trực tiếp (Live Sending)
                                                    </h5>
                                                    <span className="px-2 py-0.5 bg-cyan-400/20 border border-cyan-300/30 text-cyan-300 text-[10px] font-black rounded-full uppercase tracking-wider animate-pulse">
                                                        Đang truyền tin...
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-blue-200/80 font-bold uppercase tracking-widest mt-0.5">
                                                    Tiến trình gửi SMTP đang hoạt động liên tục và tự động cập nhật
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-left sm:text-right">
                                            <p className="text-3xl font-black text-cyan-300 tracking-tight drop-shadow-sm font-mono">
                                                {Math.min(100, Math.round(((localCampaign.stats?.sent || 0) / Math.max(1, localCampaign.totalTargetAudience || 1)) * 100))}%
                                            </p>
                                            <p className="text-[10px] text-blue-200 font-bold uppercase tracking-wider">Tiến độ hoàn thành</p>
                                        </div>
                                    </div>

                                    {/* Progress bar with animated stripes */}
                                    <div className="w-full h-4 bg-black/40 border border-white/10 rounded-full overflow-hidden p-0.5 relative z-10">
                                        <div
                                            className="h-full bg-gradient-to-r from-cyan-400 via-blue-400 to-emerald-400 rounded-full transition-all duration-700 ease-out shadow-lg shadow-cyan-500/50 relative overflow-hidden"
                                            style={{ width: `${Math.min(100, Math.max(2, ((localCampaign.stats?.sent || 0) / Math.max(1, localCampaign.totalTargetAudience || 1)) * 100))}%` }}
                                        >
                                            <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.3)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.3)_50%,rgba(255,255,255,0.3)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-sending-shimmer" />
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[11px] font-bold text-blue-100 relative z-10">
                                        <div className="flex flex-wrap items-center gap-4">
                                            <span className="uppercase tracking-wider">
                                                Đã gửi: <span className="text-cyan-300 font-black text-sm">{(localCampaign.stats?.sent || 0).toLocaleString()}</span>
                                            </span>
                                            <span className="uppercase tracking-wider">
                                                Còn lại: <span className="text-white font-black text-sm">{Math.max(0, (localCampaign.totalTargetAudience || 0) - (localCampaign.stats?.sent || 0)).toLocaleString()}</span>
                                            </span>
                                            {(localCampaign.stats?.failed || 0) > 0 && (
                                                <span className="text-rose-300 uppercase tracking-wider">
                                                    Thất bại: <span className="font-black text-sm">{(localCampaign.stats?.failed || 0).toLocaleString()}</span>
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-blue-200/80 uppercase tracking-widest text-[10px]">
                                                Mục tiêu: {(localCampaign.totalTargetAudience || 0).toLocaleString()} liên hệ
                                            </span>
                                            <button
                                                onClick={handlePauseCampaign}
                                                disabled={pauseLoading}
                                                className="ml-2 px-3 py-1.5 bg-rose-500/80 hover:bg-rose-600 text-white text-[10px] font-black uppercase rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-rose-900/30 cursor-pointer"
                                                title="Tạm dừng gửi chiến dịch ngay lập tức"
                                            >
                                                {pauseLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
                                                Tạm dừng
                                            </button>
                                            <button
                                                onClick={handleTriggerRefresh}
                                                disabled={refreshLoading}
                                                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-[10px] font-black uppercase rounded-xl transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                                                title="Nếu tiến độ bị kẹt, nhấn để kích hoạt lại tiến trình gửi"
                                            >
                                                {refreshLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3.5 h-3.5 text-cyan-300" />}
                                                Đẩy gửi tiếp
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* [FIX P8-C3] Dedicated PAUSED banner — shows Circuit Breaker warning + Resume button */}
                            {localCampaign.status === 'paused' && (
                                <div className="p-1 bg-orange-50 rounded-[28px] overflow-hidden border border-orange-100">
                                    <div className="bg-white p-6 rounded-[24px] border border-orange-100 shadow-sm flex flex-col gap-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-orange-50 text-orange-600 border border-orange-200 rounded-xl flex items-center justify-center">
                                                    <PauseCircle className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h5 className="text-sm font-black text-orange-800 uppercase tracking-tight">Chiến dịch bị tạm dừng (Circuit Breaker)</h5>
                                                    <p className="text-[11px] text-orange-500 font-bold uppercase tracking-widest mt-0.5">Hệ thống đã phát hiện lỗi SMTP liên tiếp và tự động tạm dừng để bảo vệ domain</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-black text-orange-600 tracking-tight">
                                                    {Math.min(100, Math.round(((localCampaign.stats?.sent || 0) / (localCampaign.totalTargetAudience || 1)) * 100))}%
                                                </p>
                                                <p className="text-[10px] text-orange-400 font-bold uppercase">Đã hoàn thành</p>
                                            </div>
                                        </div>
                                        <div className="w-full h-3 bg-orange-50 border border-orange-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-1000 ease-out shadow-lg shadow-orange-500/20"
                                                style={{ width: `${Math.min(100, ((localCampaign.stats?.sent || 0) / (localCampaign.totalTargetAudience || 1)) * 100)}%` }}
                                            />
                                        </div>
                                        <div className="flex justify-between items-center text-[11px] font-bold">
                                            <div className="flex gap-4">
                                                <span className="text-slate-500 uppercase tracking-wider">Đã gửi: <span className="text-orange-600 font-black">{(localCampaign.stats?.sent || 0).toLocaleString()}</span></span>
                                                <span className="text-slate-400 uppercase tracking-widest">/ {localCampaign.totalTargetAudience?.toLocaleString() || '...'} mục tiêu</span>
                                            </div>
                                            <button
                                                onClick={handleTriggerRefresh}
                                                disabled={refreshLoading}
                                                className="px-4 py-2 bg-orange-500 text-white text-[10px] font-black uppercase rounded-xl hover:bg-orange-600 transition-all flex items-center gap-2 shadow-md shadow-orange-500/20"
                                                title="Khởi động lại chiến dịch — hệ thống sẽ tiếp tục gửi từ subscriber chưa nhận được email"
                                            >
                                                {refreshLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                                                Tiếp tục Chiến dịch
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {(() => {
                                const associatedFlow = allFlows.find(f => {
                                    const steps = Array.isArray(f.steps) ? f.steps : (typeof f.steps === 'string' ? (() => { try { return JSON.parse(f.steps); } catch { return []; } })() : []);
                                    return steps.some((s: any) => s.type === 'trigger' && s.config?.type === 'campaign' && s.config?.targetId === localCampaign.id);
                                });

                                return (
                                    <div className="flex flex-col gap-4">
                                        {associatedFlow && (
                                            <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-950 p-6 rounded-[24px] shadow-lg shadow-indigo-900/20 text-white flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in zoom-in duration-500 border border-white/5">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                                        <GitBranch className="w-6 h-6 text-orange-300" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-black uppercase tracking-wider">Kịch bản chăm sóc sau chiến dịch</h4>
                                                        <p className="text-xs text-indigo-100 font-medium mt-0.5">Chiến dịch này đang kích hoạt Flow: <span className="font-bold underline">{associatedFlow.name}</span></p>
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={() => {
                                                        navigate('/marketing/flows', { state: { openFlowId: associatedFlow.id, tab: 'analytics' } });
                                                        onClose();
                                                    }}
                                                    variant="secondary"
                                                    className="bg-white text-indigo-600 border-none hover:bg-slate-50 shadow-md !rounded-xl px-6"
                                                    icon={ExternalLink}
                                                >
                                                    Xem Báo cáo Flow
                                                </Button>
                                            </div>
                                        )}

                                        {(localCampaign.stats?.failed || 0) > 0 && (
                                            <div className="bg-rose-50 border border-rose-100 p-5 rounded-[24px] flex flex-col md:flex-row items-center justify-between gap-4 animate-in slide-in-from-top-4 duration-500">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/20">
                                                        <AlertOctagon className="w-6 h-6" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-black text-rose-900 uppercase tracking-tight">Phát hiện lỗi khi gửi ({(localCampaign.stats?.failed || 0).toLocaleString()} {isZns ? 'tin nhắn' : 'email'})</h4>
                                                        <p className="text-xs text-rose-700 font-medium mt-0.5">Một số {isZns ? 'tin nhắn' : 'email'} đã không thể gửi đi do lỗi hệ thống hoặc địa chỉ không tồn tại.</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    onClick={() => handleNavigateToAudienceFilter('failed')}
                                                    variant="secondary"
                                                    className="bg-white text-rose-600 border-rose-200 hover:bg-rose-50 shadow-sm !rounded-xl px-6"
                                                    icon={BarChart2}
                                                >
                                                    Xem chi tiết lỗi
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {/* 1. KEY METRICS ROW */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                <StatBox
                                    label={isZns ? "Tỷ lệ Xem (Seen Rate)" : "Tỷ lệ Mở (Open Rate)"}
                                    value={`${openRate}%`}
                                    subValue={`${(stats.opened || 0).toLocaleString()} người${(stats as any).total_opened && !isZns ? ` - ${(stats as any).total_opened.toLocaleString()} lượt` : ''}`}
                                    icon={isZns ? BadgeCheck : MailOpen}
                                    colorClass="text-emerald-500"
                                />
                                {isZns ? (
                                    <StatBox
                                        label="Đã nhận (Delivered)"
                                        value={(deliveredCount || 0).toLocaleString()}
                                        subValue="Tin nhắn đến máy khách"
                                        icon={Smartphone}
                                        colorClass="text-blue-500"
                                    />
                                ) : (
                                    <StatBox
                                        label="Tỷ lệ Click (CTR)"
                                        value={`${clickRate}%`}
                                        subValue={`${(stats as any).total_clicked?.toLocaleString() || stats.clicked?.toLocaleString() || 0} lượt - ${stats.clicked?.toLocaleString() || 0} người`}
                                        icon={MousePointerClick}
                                        colorClass="text-rose-500"
                                    />
                                )}
                                {!isZns && (
                                    <StatBox
                                        label="Click / Open (CTOR)"
                                        value={`${clickToOpenRate}%`}
                                        subValue="Chất lượng nội dung"
                                        icon={Activity}
                                        colorClass="text-blue-500"
                                    />
                                )}
                                <StatBox
                                    label={isZns ? "Chi phí tạm tính" : "Tỷ lệ gửi thành công"}
                                    value={isZns ? (() => {
                                        const configData = typeof localCampaign.config === 'string' ? JSON.parse(localCampaign.config) : localCampaign.config;
                                        const price = configData?.price || 300;
                                        return (sentCount * price).toLocaleString() + 'd';
                                    })() : `${deliveryRate}%`}
                                    subValue={isZns ? `Dựa trên ${(sentCount || 0).toLocaleString()} tin` : `${(deliveredCount || 0).toLocaleString()} / ${(sentCount || 0).toLocaleString()}`}
                                    icon={isZns ? PieChart : CheckCircle2}
                                    colorClass="text-indigo-500"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                                {/* 2. CONVERSION FUNNEL (LEFT - 2 COLS) */}
                                <div className="lg:col-span-2 space-y-6">
                                    <Card className="border-slate-100 shadow-sm min-h-[400px]" noPadding>
                                        <div className="p-6 border-b border-slate-50 flex justify-between items-center">
                                            <div>
                                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">Phễu chuyển đổi (Funnel)</h3>
                                                <p className="text-[10px] text-slate-400 mt-0.5">Hành trình tương tác của Khách hàng</p>
                                            </div>
                                            <div className="flex gap-2">
                                                {/* Legend */}
                                                <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-400" /><span className="text-[10px] font-bold text-slate-500">{isZns ? 'Đã gửi' : 'Sent'}</span></div>
                                                <div className="flex items-center gap-1.5"><div className={`w-2 h-2 rounded-full bg-[#2563eb]`} /><span className="text-[10px] font-bold text-slate-500">{isZns ? 'Đã xem' : 'Open'}</span></div>
                                                {!isZns && <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[10px] font-bold text-slate-500">Click</span></div>}
                                            </div>
                                        </div>
                                        <div className="p-6 min-h-[280px]">
                                            {stats.sent > 0 ? (
                                                <ResponsiveContainer width="100%" height={280}>
                                                    <BarChart data={funnelData} layout="vertical" margin={{ top: 5, right: 15, left: 10, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-light, #f1f5f9)" className="dark:stroke-slate-800/40" />
                                                        <XAxis type="number" hide />
                                                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--color-text-light, #64748b)' }} width={100} tickLine={false} axisLine={false} />
                                                        <Tooltip
                                                            cursor={{ fill: 'var(--color-border-light, #f8fafc)', opacity: 0.15 }}
                                                            contentStyle={{
                                                                backgroundColor: 'var(--color-surface, #fff)',
                                                                border: '1px solid var(--color-border, #e2e8f0)',
                                                                borderRadius: 'var(--radius-lg, 12px)',
                                                                boxShadow: 'var(--shadow-lg)',
                                                                padding: '8px 12px'
                                                            }}
                                                            itemStyle={{ color: 'var(--color-text, #0f172a)', fontWeight: 650, fontSize: '11px' }}
                                                        />
                                                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                                                            {funnelData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.fill} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                                    <BarChart2 className="w-12 h-12 mb-3 opacity-50" />
                                                    <p className="text-xs font-bold">Chưa có dữ liệu</p>
                                                </div>
                                            )}
                                        </div>
                                    </Card>

                                    {/* Detailed List */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                        {funnelData.map((item, idx) => (
                                            <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                                                <div className="p-2 rounded-xl bg-slate-50 text-slate-500"><item.icon className="w-4 h-4" /></div>
                                                <div>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase">{item.name.split(' (')[0]}</p>
                                                    <p className="text-sm font-black text-slate-800">{(item.value || 0).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 3. HEALTH & DELIVERY (RIGHT - 1 COL) */}
                                <div className="space-y-6">
                                    <Card className="border-slate-100 shadow-sm" noPadding>
                                        <div className="p-6 border-b border-slate-50">
                                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                                                <ShieldCheck className="w-4 h-4 text-emerald-500" /> Sức khỏe gửi tin
                                            </h3>
                                        </div>
                                        <div className="p-6">
                                            {stats.sent > 0 ? (
                                                <div className="h-40 min-h-[160px] relative">
                                                    <ResponsiveContainer width="100%" height={160}>
                                                        <RePieChart>
                                                            <Pie
                                                                data={healthData}
                                                                cx="50%"
                                                                cy="50%"
                                                                innerRadius={48}
                                                                outerRadius={62}
                                                                paddingAngle={4}
                                                                dataKey="value"
                                                            >
                                                                {healthData.map((entry, index) => (
                                                                    <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                                                                ))}
                                                            </Pie>
                                                            <Tooltip
                                                                contentStyle={{
                                                                    backgroundColor: 'var(--color-surface, #fff)',
                                                                    border: '1px solid var(--color-border, #e2e8f0)',
                                                                    borderRadius: 'var(--radius-lg, 12px)',
                                                                    boxShadow: 'var(--shadow-md)',
                                                                    padding: '8px 12px'
                                                                }}
                                                                itemStyle={{ color: 'var(--color-text, #0f172a)', fontWeight: 650, fontSize: '11px' }}
                                                            />
                                                        </RePieChart>
                                                    </ResponsiveContainer>
                                                    {/* Center Text */}
                                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                                        <span className="text-xl font-black text-slate-800 dark:text-slate-100">{retainedRate}%</span>
                                                        <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Success</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="h-40 flex items-center justify-center text-xs text-slate-400 font-medium">Chưa có dữ liệu</div>
                                            )}

                                            <div className="space-y-4 mt-2">
                                                <div className="flex justify-between items-center text-xs group cursor-pointer" onClick={() => handleNavigateToAudienceFilter('failed')}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${isZns ? 'bg-rose-500' : 'bg-rose-500'}`} />
                                                        <span className="text-slate-600 font-bold group-hover:text-blue-600 transition-colors">{isZns ? 'Lỗi gửi (Failed)' : 'Email hỏng (Bounce)'}</span>
                                                    </div>
                                                    <span className="font-mono font-bold text-rose-500">{isZns ? `${(sentCount > 0 ? ((localCampaign.stats?.failed || 0) / sentCount * 100).toFixed(2) : '0.00')}% (${localCampaign.stats?.failed || 0})` : `${bounceRate}% (${stats.bounced})`}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-xs group cursor-pointer" onClick={() => handleNavigateToAudienceFilter('unsubscribed')}>
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${isZns ? 'bg-[#ca7900]' : 'bg-[#ca7900]'}`} />
                                                        <span className="text-slate-600 font-bold group-hover:text-blue-600 transition-colors">{isZns ? 'Hủy đăng ký (Unsub)' : 'Hủy đăng ký (Unsub)'}</span>
                                                    </div>
                                                    <span className="font-mono font-bold text-[#ca7900]">{isZns ? '0.00% (0)' : `${unsubRate}% (${stats.unsubscribed})`}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </Card>

                                    <div className="p-5 bg-blue-50 border border-blue-100 rounded-[24px] relative overflow-hidden">
                                        <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-200 rounded-full opacity-20 blur-xl" />
                                        <h4 className="text-xs font-black text-blue-800 uppercase tracking-widest mb-3">Thông tin gửi</h4>
                                        <div className="space-y-2 text-[11px]">
                                            <div className="flex justify-between">
                                                <span className="text-blue-600/70 font-bold">Subject:</span>
                                                <span className="text-blue-900 font-bold truncate max-w-[150px]">{localCampaign.subject}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-blue-600/70 font-bold">{isZns ? 'ZNS Template:' : 'From:'}</span>
                                                <span className="text-blue-900 font-bold">{isZns ? localCampaign.templateId : localCampaign.senderEmail}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-blue-600/70 font-bold">{isZns ? 'Hệ thống:' : 'Tracking:'}</span>
                                                <span className="text-blue-900 font-bold">{isZns ? 'Zalo Open API' : (localCampaign.trackingEnabled ? 'ON' : 'OFF')}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'links' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <LinkClicksTab type="campaign" id={localCampaign.id} initialHtml={previewContent.html} />
                        </div>
                    )}

                    {activeTab === 'tech' && (
                        <TechStatsTab type="campaign" id={localCampaign.id} isZns={isZns} />
                    )}

                    {activeTab === 'content' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit">
                                <button
                                    onClick={() => setPreviewType('main')}
                                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${previewType === 'main' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                >
                                    <Mail className="w-3.5 h-3.5" /> {localCampaign.type === 'zalo_zns' ? 'Nội dung ZNS' : 'Email chính'}
                                </button>
                                {localCampaign.type !== 'zalo_zns' && localCampaign.reminders?.map((rem, idx) => (
                                    <button
                                        key={rem.id}
                                        onClick={() => setPreviewType(rem.id!)}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${previewType === rem.id ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                                    >
                                        <Bell className="w-3.5 h-3.5" /> Nhắc nhở {idx + 1}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div className="lg:col-span-2 space-y-4">
                                    <div className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm min-h-[950px] flex flex-col">
                                        <div className="mb-4 pb-4 border-b border-slate-50 flex justify-between items-center">
                                            <div>
                                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tiêu đề bản tin</p>
                                                <h4 className="text-base font-black text-slate-800 tracking-tight">
                                                    {previewContent.loading ? '...' : (interpolateMergeTags(previewContent.subject || localCampaign.subject || '', sampleSubscriber))}
                                                </h4>
                                            </div>
                                            <div className="flex bg-slate-100 p-1 rounded-xl">
                                                <button
                                                    onClick={() => setPreviewMode('desktop')}
                                                    className={`p-2 rounded-lg transition-all ${previewMode === 'desktop' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                    title="Xem trên máy tính"
                                                >
                                                    <Monitor className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setPreviewMode('mobile')}
                                                    className={`p-2 rounded-lg transition-all ${previewMode === 'mobile' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                                    title="Xem trên điện thoại"
                                                >
                                                    <Smartphone className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="h-[900px] bg-[#fcfcfc] rounded-2xl border border-slate-50 shadow-inner overflow-hidden relative flex justify-center items-start">
                                            {previewContent.loading ? (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3">
                                                    <RefreshCw className="w-8 h-8 animate-spin" />
                                                    <p className="text-[10px] font-bold uppercase tracking-widest">Đang tải preview...</p>
                                                </div>
                                            ) : (
                                                <div className={`h-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${previewMode === 'mobile' ? 'w-[400px] py-8' : 'w-full py-0'}`}>
                                                    <div className={`w-full h-full overflow-hidden transition-all duration-500 ${previewMode === 'mobile' ? 'rounded-[40px] shadow-[0_0_0_12px_#1e293b,0_20px_40px_rgba(0,0,0,0.2)] bg-white relative' : ''}`}>
                                                        {previewMode === 'mobile' && (
                                                            <>
                                                                <div className="absolute top-0 inset-x-0 h-6 bg-white z-10 flex justify-center">
                                                                    <div className="w-32 h-6 bg-[#1e293b] rounded-b-[16px]"></div>
                                                                </div>
                                                                <div className="absolute bottom-1.5 inset-x-0 flex justify-center z-10">
                                                                    <div className="w-32 h-1.5 bg-slate-200/50 rounded-full"></div>
                                                                </div>
                                                            </>
                                                        )}
                                                        <iframe
                                                            srcDoc={interpolateMergeTags(previewContent.html || '', sampleSubscriber)}
                                                            className={`w-full border-none bg-white ${previewMode === 'mobile' ? 'h-[calc(100%-20px)] mt-5' : 'h-full'}`}
                                                            title="Email Content Preview"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-6">
                                    <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
                                        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Clock className="w-4 h-4 text-blue-500" />
                                            {previewType === 'main' ? 'Lịch trình gửi chính' : 'Lịch nhắc nhở'}
                                        </h4>

                                        {previewType === 'main' ? (
                                            <div className="space-y-4">
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Trạng thái</p>
                                                    <Badge variant={isSent ? 'success' : 'info'} className="text-[10px] font-bold">{localCampaign.status}</Badge>
                                                </div>
                                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Thời gian</p>
                                                    <p className="text-xs font-bold text-slate-700">
                                                        {localCampaign.sentAt ? new Date(localCampaign.sentAt).toLocaleString('vi-VN') : (localCampaign.scheduledAt ? new Date(localCampaign.scheduledAt).toLocaleString('vi-VN') : 'Dự kiến ngay')}
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (() => {
                                            const rem = localCampaign.reminders?.find(r => r.id === previewType);
                                            return rem ? (
                                                <div className="space-y-4">
                                                    <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100">
                                                        <p className="text-[10px] font-bold text-orange-400 uppercase mb-1">Loại kích hoạt</p>
                                                        <p className="text-xs font-bold text-orange-700">
                                                            {rem.type === 'no_open' ? 'Gửi nếu chưa mở Mail chính' : (rem.type === 'no_click' ? 'Gửi nếu chưa nhấn link' : 'Gửi cho tất cả')}
                                                        </p>
                                                    </div>
                                                    <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                                        <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Thời gian chờ</p>
                                                        <p className="text-xs font-bold text-blue-700">
                                                            {rem.triggerMode === 'delay' ? `Sau ${rem.delayDays} ngày ${rem.delayHours} giờ` : `Vào lúc: ${rem.scheduledAt ? new Date(rem.scheduledAt).toLocaleString('vi-VN') : 'Chưa đặt'}`}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : null;
                                        })()}
                                    </div>

                                    {previewType !== 'main' && (
                                        <div className="bg-emerald-50 p-6 rounded-[24px] border border-emerald-100">
                                            <p className="text-[10px] font-bold text-emerald-600 uppercase mb-2 flex items-center gap-1.5"><Zap className="w-3.5 h-3.5" /> Gợi ý</p>
                                            <p className="text-xs text-emerald-800 leading-relaxed font-medium">Nhắc nhở này giúp tăng thêm **15-20%** tỷ lệ chuyển đổi cho những người bỏ lỡ email đầu tiên.</p>
                                        </div>
                                    )}

                                    {/* Attachments Section with Pagination & Server Clean */}
                                    {parsedAttachments && parsedAttachments.length > 0 && (() => {
                                        const ATTACHMENTS_PER_PAGE = 20;
                                        const totalAttachmentPages = Math.ceil(parsedAttachments.length / ATTACHMENTS_PER_PAGE);
                                        const displayedAttachments = parsedAttachments.slice((attachmentPage - 1) * ATTACHMENTS_PER_PAGE, attachmentPage * ATTACHMENTS_PER_PAGE);

                                        return (
                                            <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col">
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                                        <Paperclip className="w-4 h-4 text-blue-500" />
                                                        Tệp đính kèm ({parsedAttachments.length})
                                                    </h4>
                                                    {totalAttachmentPages > 1 && (
                                                        <span className="text-[10px] font-bold text-slate-400">Trang {attachmentPage}/{totalAttachmentPages}</span>
                                                    )}
                                                </div>
                                                <div className="space-y-2.5 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                                                    {displayedAttachments.map((file: any, i: number) => (
                                                        <a 
                                                            key={file.id || i} 
                                                            href={file.url || '#'} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm transition-all group"
                                                        >
                                                            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                                                <FileIcon className="w-4 h-4" />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-bold text-slate-700 truncate group-hover:text-blue-700 transition-colors">{file.name}</p>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <span className="text-[10px] text-slate-400 font-medium">{file.type?.toUpperCase() || 'FILE'}</span>
                                                                    <span className="text-slate-300">•</span>
                                                                    <span className="text-[10px] text-slate-400 font-medium">={(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                                                </div>
                                                            </div>
                                                            <Badge variant={file.logic === 'match_email' ? 'warning' : 'neutral'} className="text-[9px]">
                                                                {file.logic === 'match_email' ? 'Cá nhân hóa' : 'Gửi chung'}
                                                            </Badge>
                                                        </a>
                                                    ))}
                                                </div>

                                                {/* Pagination Controls */}
                                                {totalAttachmentPages > 1 && (
                                                    <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs font-bold text-slate-500">
                                                        <button
                                                            onClick={() => setAttachmentPage(p => Math.max(1, p - 1))}
                                                            disabled={attachmentPage === 1}
                                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors cursor-pointer text-[11px]"
                                                        >
                                                            ← Trước
                                                        </button>
                                                        <span className="text-[10px] text-slate-400">Hiển thị {displayedAttachments.length}/{parsedAttachments.length} tệp</span>
                                                        <button
                                                            onClick={() => setAttachmentPage(p => Math.min(totalAttachmentPages, p + 1))}
                                                            disabled={attachmentPage === totalAttachmentPages}
                                                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 rounded-lg transition-colors cursor-pointer text-[11px]"
                                                        >
                                                            Sau →
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Clean Server Attachments Button for Sent Campaigns */}
                                                {localCampaign.status === 'sent' && (
                                                    <button
                                                        onClick={() => setShowClearAttachmentsModal(true)}
                                                        className="mt-4 w-full py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                                                        title="Chiến dịch đã gửi xong. Xóa các tệp đính kèm khỏi máy chủ để giải phóng bộ nhớ."
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        Làm sạch tệp trên Server ({parsedAttachments.length} tệp)
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Link Summary Card */}
                                    {previewType === 'main' && uniqueLinks.length > 0 && (
                                        <div className="bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col">
                                            <div className="flex items-center justify-between mb-4">
                                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                                    <LinkIcon className="w-4 h-4 text-orange-500" />
                                                    Liên kết trong nội dung ({uniqueLinks.length})
                                                </h4>
                                            </div>
                                            <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2 mb-5">
                                                {uniqueLinks.map((url, i) => (
                                                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block p-3 rounded-xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors text-[11px] font-medium text-slate-600 truncate" title={url}>
                                                        {url}
                                                    </a>
                                                ))}
                                            </div>
                                            <button
                                                onClick={() => setActiveTab('links')}
                                                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
                                            >
                                                <Flame className="w-4 h-4" />
                                                Xem Click Heatmap
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'audience' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Users className="w-4 h-4" /> Đối tượng nhận {isZns ? 'ZNS' : 'Email'} ({(totalAudience || 0).toLocaleString()})
                            </h4>

                            {localCampaign.status === 'sent' && audienceStats && (
                                <Card noPadding className="border-amber-100 bg-amber-50/30 overflow-hidden relative">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
                                        <Users className="w-24 h-24 text-amber-600 translate-x-8 -translate-y-8" />
                                    </div>
                                    <div className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
                                        <div className="space-y-1">
                                            <h5 className="text-sm font-black text-amber-900 uppercase tracking-widest flex items-center gap-2">
                                                <Zap className={`w-4 h-4 text-orange-500 ${statsLoading ? 'animate-bounce' : ''}`} /> Phân tích đối tượng
                                            </h5>
                                            <p className="text-xs text-amber-700/70 font-medium tracking-tight">Đối tượng mà bạn chọn đã thay đổi kể từ lần gửi cuối cùng của chiến dịch này.</p>
                                        </div>
                                        {statsLoading ? (
                                            <div className="flex-1 flex justify-center items-center py-2">
                                                <div className="flex items-center gap-3 text-amber-600/50">
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest">Đang phân tích dữ liệu...</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-10">
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Đã gửi</p>
                                                    <p className="text-xl font-black text-slate-700">{(audienceStats.count_sent || 0).toLocaleString()}</p>
                                                </div>
                                                <div className="w-px h-10 bg-amber-100" />
                                                <div className="text-center">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Hiện tại</p>
                                                    <p className="text-xl font-black text-slate-700">{(audienceStats.total_current || 0).toLocaleString()}</p>
                                                </div>
                                                <div className="w-px h-10 bg-amber-100" />
                                                <div className="text-center relative group">
                                                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Chênh lệch</p>
                                                    <p className="text-xl font-black text-amber-600">+{(audienceStats.gap || 0).toLocaleString()}</p>
                                                    {audienceStats.count_unsubscribed !== undefined && audienceStats.count_unsubscribed > 0 && (
                                                        <div className="mt-2 text-center">
                                                            <p className="text-[10px] font-bold text-rose-500 whitespace-nowrap">Do {audienceStats.count_unsubscribed} người Unsub</p>
                                                            <button
                                                                onClick={() => setDeleteModal(prev => ({ ...prev, isOpen: true, loading: false, page: 1 }))}
                                                                className="mt-1 px-3 py-1 bg-rose-50 text-rose-600 hover:bg-rose-500 hover:text-white border border-rose-200 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1 mx-auto shadow-sm relative z-20"
                                                            >
                                                                <Trash2 className="w-3 h-3" /> Dọn dẹp
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {audienceStats.gap > 0 && !statsLoading && (
                                            <Button
                                                onClick={() => setShowRefreshConfirm(true)}
                                                variant="primary"
                                                className="!rounded-2xl shadow-xl shadow-amber-600/20"
                                                icon={Send}
                                            >
                                                Gửi cho {audienceStats.gap} người mới
                                            </Button>
                                        )}
                                    </div>
                                </Card>
                            )}

                            <Card noPadding className="border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                                    <h5 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <List className="w-4 h-4 text-blue-500" /> Danh sách mục tiêu
                                    </h5>
                                </div>
                                <div className="p-6 space-y-3">
                                    {targetLists.length > 0 ? targetLists.map(list => (
                                        <div key={list.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center border border-indigo-100"><List className="w-5 h-5" /></div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{list.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Static List</p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-full">{(list.count || 0).toLocaleString()}</span>
                                        </div>
                                    )) : (
                                        <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 font-bold uppercase tracking-widest">Không có danh sách nào được chọn</p>
                                    )}
                                </div>
                            </Card>

                            <Card noPadding className="border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                                    <h5 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-orange-500" /> Phân khúc mục tiêu
                                    </h5>
                                </div>
                                <div className="p-6 space-y-3">
                                    {targetSegments.length > 0 ? targetSegments.map(segment => (
                                        <div key={segment.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-orange-50 text-[#ca7900] flex items-center justify-center border border-orange-100"><Layers className="w-5 h-5" /></div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{segment.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Dynamic Segment</p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-full">{(segment.count || 0).toLocaleString()}</span>
                                        </div>
                                    )) : (
                                        <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 font-bold uppercase tracking-widest">Không có phân khúc nào được chọn</p>
                                    )}
                                </div>
                            </Card>

                            <Card noPadding className="border border-slate-100 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                                    <h5 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                        <Tag className="w-4 h-4 text-emerald-500" /> Nhãn mục tiêu
                                    </h5>
                                </div>
                                <div className="p-6 space-y-3">
                                    {targetTags.length > 0 ? targetTags.map(tag => (
                                        <div key={tag.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center border border-emerald-100"><Tag className="w-5 h-5" /></div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{tag.name}</p>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Tag Group</p>
                                                </div>
                                            </div>
                                            <span className="text-sm font-black text-slate-800 bg-slate-100 px-3 py-1 rounded-full">{tag.count.toLocaleString()}</span>
                                        </div>
                                    )) : (
                                        <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-100 font-bold uppercase tracking-widest">Không có nhãn nào được chọn</p>
                                    )}
                                </div>
                            </Card>
                        </div>
                    )}

                    {activeTab === 'delivery' && localCampaign && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300">
                            <CampaignDeliveryDetailsTab
                                key={`${localCampaign.id}-${initialAudienceFilter}`}
                                campaign={localCampaign}
                                allLists={allLists}
                                allTags={allTags}
                                initialFilter={initialAudienceFilter}
                            />
                        </div>
                    )}

                    {activeTab === 'activity' && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-300 space-y-6">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                    <Activity className="w-4 h-4" /> Nhật ký tương tác
                                </h4>
                                <button onClick={() => fetchLogs()} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                                    <RefreshCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin' : ''}`} />
                                </button>
                            </div>

                            <div className="flex justify-between gap-4 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 flex-wrap">
                                <div className="flex-1 relative group bg-white rounded-xl border border-slate-200 h-10 flex items-center overflow-hidden w-full">
                                    <Search className="w-4 h-4 ml-4 text-slate-400" />
                                    <input
                                        value={activitySearch}
                                        onChange={(e) => setActivitySearch(e.target.value)}
                                        placeholder="Tìm kiếm email hoặc tên khách hàng..."
                                        className="w-full h-full bg-transparent border-none outline-none text-xs font-medium px-3"
                                    />
                                </div>
                            </div>

                            <Card noPadding className="border border-[var(--color-border)] shadow-sm overflow-hidden min-h-[300px]">
                                <div className="table-wrap overflow-x-auto overflow-y-auto max-h-[400px] custom-scrollbar">
                                    <table className="w-full text-left">
                                        <thead className="bg-[var(--color-bg)] border-b border-[var(--color-border)] sticky top-0 z-10 backdrop-blur-sm">
                                            <tr>
                                                <th className="px-6 py-3.5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest bg-[var(--color-bg)]">Khách hàng</th>
                                                <th className="px-6 py-3.5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest bg-[var(--color-bg)]">Hành động</th>
                                                <th className="px-6 py-3.5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest bg-[var(--color-bg)]">Chi tiết</th>
                                                <th className="px-6 py-3.5 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest text-right bg-[var(--color-bg)]">Thời gian</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[var(--color-border)]">
                                            {loadingLogs ? (
                                                <tr><td colSpan={4} className="py-20 text-center text-slate-400 text-xs font-medium italic">Đang tải dữ liệu...</td></tr>
                                            ) : activityLogs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={4} className="py-20 text-center">
                                                        <History className="w-10 h-10 mx-auto mb-3 text-slate-200" />
                                                        <p className="text-xs font-bold text-slate-400 uppercase">Chưa có hoạt động nào</p>
                                                        <p className="text-[10px] text-slate-300 mt-1">Dữ liệu sẽ xuất hiện khi Khách hàng mở mail hoặc click link.</p>
                                                    </td>
                                                </tr>
                                            ) : activityLogs.map((log, idx) => {
                                                const displayName = `${log.first_name || ''} ${log.last_name || ''}`.trim();
                                                return (
                                                    <tr
                                                        key={idx}
                                                        className={`hover:bg-[var(--color-bg)] transition-colors ${log.contact_id ? 'cursor-pointer' : ''}`}
                                                        onClick={() => {
                                                            if (log.contact_id) {
                                                                window.dispatchEvent(new CustomEvent('open-customer-drawer', { detail: { initialTab: 'journey360', id: Number(log.contact_id) } }));
                                                            }
                                                        }}
                                                    >
                                                        <td className="px-6 py-3">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar name={displayName || log.email} size={32} />
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold text-[var(--color-text)]">{displayName || log.email}</span>
                                                                    <span className="text-[10px] text-[var(--color-text-muted)]">{log.email}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            {log.type === 'open_email' && (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 text-[9px] font-black uppercase tracking-wide">
                                                                    <MailOpen className="w-3 h-3" /> Opened
                                                                </span>
                                                            )}
                                                            {log.type === 'click_link' && (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-pink-50 text-pink-600 border border-pink-100 text-[9px] font-black uppercase tracking-wide">
                                                                    <MousePointer2 className="w-3 h-3" /> Clicked
                                                                </span>
                                                            )}
                                                            {log.type === 'unsubscribe' && (
                                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-100 text-[9px] font-black uppercase tracking-wide">
                                                                    <UserMinus className="w-3 h-3" /> Unsub
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-3">
                                                            <p className="text-[10px] font-medium text-[var(--color-text-secondary)] truncate max-w-[200px]">{log.details || '--'}</p>
                                                        </td>
                                                        <td className="px-6 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-[var(--color-text-muted)]">
                                                                <Clock className="w-3 h-3" />
                                                                {new Date(log.created_at).toLocaleString('vi-VN')}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                <Pagination
                                    currentPage={logsPagination.page}
                                    totalPages={logsPagination.totalPages}
                                    totalCount={logsPagination.total}
                                    itemsPerPage={logsPagination.limit}
                                    onPageChange={(p) => setLogsPagination(prev => ({ ...prev, page: p }))}
                                />
                            </Card>
                        </div>
                    )}
                </div>

                {/* Confirmation Modal for Refresh */}
                <ConfirmModal
                    isOpen={showRefreshConfirm}
                    onClose={() => setShowRefreshConfirm(false)}
                    onConfirm={handleTriggerRefresh}
                    isLoading={refreshLoading}
                    title={`Gửi email cho ${audienceStats?.gap} thành viên mới?`}
                    variant="warning"
                    confirmLabel="Xác nhận gửi ngay"
                    message={
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500 font-medium leading-relaxed text-left">
                                Bạn đang kích hoạt gửi email chính cho những thành viên mới gia nhập danh sách/phân khúc mục tiêu.
                            </p>
                            <div className="space-y-4">
                                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-4">
                                    <Bell className="w-5 h-5 text-amber-600 shrink-0" />
                                    <div className="space-y-1 text-left">
                                        <p className="text-xs font-black text-amber-900 uppercase tracking-wider">Lưu ý về Reminders</p>
                                        <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                                            Các Reminder sẽ được lập lịch dựa trên thời điểm từng thành viên nhận được email chính này. Thành viên mới sẽ nhận được toàn bộ chuỗi Reminder theo đúng khoảng thời gian bạn đã thiết lập.
                                        </p>
                                    </div>
                                </div>
                                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex gap-4">
                                    <Clock className="w-5 h-5 text-slate-400 shrink-0" />
                                    <div className="space-y-1 text-left">
                                        <p className="text-xs font-black text-slate-900 uppercase tracking-wider">Reminder Ngày cố định</p>
                                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                            Nếu bạn có Reminder theo ngày cố định đã qua, các thành viên mới này sẽ tự động bỏ qua chúng để đảm bảo tính logic.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    }
                />

                <TestEmailModal
                    isOpen={showTestModal}
                    onClose={() => setShowTestModal(false)}
                    campaignId={localCampaign.id}
                    campaignName={localCampaign.name}
                />

                <ConfirmModal
                    isOpen={deleteModal.isOpen}
                    onClose={() => !deleteModal.loading && setDeleteModal(prev => ({ ...prev, isOpen: false }))}
                    onConfirm={handleDeleteUnsubscribed}
                    title="Dọn dẹp người Unsubscribe"
                    message={
                        <div className="space-y-4">
                            <p className="text-slate-600">Bạn sắp xóa <span className="font-bold text-rose-600">{deleteModal.total || audienceStats?.count_unsubscribed || 0} người liên hệ</span> đã Hủy đăng ký từ chiến dịch này.</p>

                            {deleteModal.fetchingList ? (
                                <div className="flex justify-center p-4">
                                    <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
                                </div>
                            ) : deleteModal.list.length > 0 ? (
                                <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                                    <table className="w-full text-left text-[11px]">
                                        <thead className="bg-slate-50 border-b border-slate-100 uppercase text-slate-500 font-bold tracking-wider">
                                            <tr>
                                                <th className="px-3 py-2">Email</th>
                                                <th className="px-3 py-2">Tên</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {deleteModal.list.map(sub => (
                                                <tr key={sub.id}>
                                                    <td className="px-3 py-2 font-medium text-slate-700 truncate max-w-[150px]">{sub.email}</td>
                                                    <td className="px-3 py-2 text-slate-500">{sub.first_name} {sub.last_name}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {deleteModal.totalPages > 1 && (
                                        <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                            <span className="text-slate-500">Trang {deleteModal.page} / {deleteModal.totalPages}</span>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setDeleteModal(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                                                    disabled={deleteModal.page === 1}
                                                    className="p-1 rounded bg-white border border-slate-200 disabled:opacity-50"
                                                >
                                                    <ChevronLeft className="w-3 h-3" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteModal(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                                                    disabled={deleteModal.page === deleteModal.totalPages}
                                                    className="p-1 rounded bg-white border border-slate-200 disabled:opacity-50"
                                                >
                                                    <ChevronRight className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                                <AlertOctagon className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                                <div>
                                    <h5 className="text-sm font-bold text-rose-800">Cảnh báo: Hành động Vĩnh viễn</h5>
                                    <p className="text-xs text-rose-700/80 mt-1">Các liên hệ này sẽ bị xóa hoàn toàn khỏi cơ sở dữ liệu và không thể khôi phục. Mọi lịch sử tương tác cũng bị mất.</p>
                                </div>
                            </div>
                        </div>
                    }
                    variant="danger"
                    confirmLabel={deleteModal.loading ? "ĐANG XÓA..." : "XÓA VĨNH VIỄN"}
                />

                <ConfirmModal
                    isOpen={showClearAttachmentsModal}
                    onClose={() => !clearingAttachments && setShowClearAttachmentsModal(false)}
                    onConfirm={handleClearAttachments}
                    title="Dọn dẹp tệp đính kèm trên Server"
                    message={
                        <div className="space-y-3">
                            <p className="text-sm text-slate-600">
                                Chiến dịch này đã gửi xong tới toàn bộ danh sách liên hệ mục tiêu.
                            </p>
                            <p className="text-xs text-rose-600 font-bold bg-rose-50 p-3 rounded-xl border border-rose-200">
                                Thao tác này sẽ xóa vĩnh viễn toàn bộ tệp đính kèm vật lý trên máy chủ để giải phóng dung lượng bộ nhớ.
                            </p>
                        </div>
                    }
                    variant="danger"
                    confirmLabel={clearingAttachments ? "ĐANG XÓA..." : "LÀM SẠCH SERVER"}
                />
                <style>{`
                  @media (min-width: 1024px) {
                    .campaign-detail-drawer {
                      width: calc(100vw - var(--sidebar-width, 220px)) !important;
                      max-width: calc(100vw - var(--sidebar-width, 220px)) !important;
                    }
                  }
                `}</style>
            </div>
        </div>,
        getMktPortalRoot()
    );
};

export default CampaignDetailDrawer;