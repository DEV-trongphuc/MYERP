

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Save, History, FileText, Mail, MousePointer2,
    Tag, User, List, Trash2, Plus, MailOpen, UserPlus, Layers, GitMerge,
    Phone, Globe, CheckCircle2, Edit3, Briefcase, Building, MapPin, Activity, Cake, UserMinus,
    Zap, UserCircle, Search, Clock, MessageSquare, AlertOctagon, Send, AlertTriangle,
    ShoppingCart, ArrowRight, ArrowUpRight, BadgeCheck, Eye, Monitor, Smartphone, BarChart2, ChevronDown,
    Star, MessageCircle, RefreshCw, Heart, ExternalLink, MousePointerClick, Globe as Facebook, Sparkles, ArrowLeft
} from 'lucide-react';
import Modal from '../common/Modal';
import Badge from '../common/Badge';
import Tabs from '../common/Tabs';
import Button from '../common/Button';
import Input from '../common/Input';
import Select from '../common/Select';
import ConfirmModal from '../common/ConfirmModal';

import toast from 'react-hot-toast';
import { api } from '../../services/storageAdapter';
import { Subscriber, Segment, Flow, SubscriberNote } from '../../types';
import { useNavigate } from 'react-router-dom';
import ManualTriggerFlowModal from '../flows/ManualTriggerFlowModal';
import { isSyncList } from '../../utils/listHelpers';
import ReactMarkdown from '../../shims/reactMarkdown';
import { MetaCustomerProfileModal } from '../meta/MetaCustomerProfileModal';
import { Avatar } from '../../../ui/Avatar';
import { pushOverlay } from '../../../../utils/overlayStack';
import { getMktPortalRoot } from '../../utils/portalRoot';

export const GoogleSheetsIcon = ({ className }: { className?: string }) => (
    <div className={className} style={{ width: '18px', height: '18px' }}>
        <img
            src="https://mailmeteor.com/logos/assets/PNG/Google_Sheets_Logo_512px.png"
            className="w-full h-full max-w-full max-h-full object-contain block"
            alt="Google Sheets"
        />
    </div>
);

interface CustomerProfileModalProps {
    subscriber: Subscriber | null;
    onClose: () => void;
    onUpdate: (updated: Subscriber) => void;
    onDelete: (id: string) => void;
    allLists: any[];
    allSegments: Segment[];
    allFlows: Flow[];
    allTags?: { id: string; name: string }[];
    checkMatch: (sub: Subscriber, criteria: string) => boolean;
    onAddToList: (subId: string, listId: string) => void;
    onRemoveFromList: (subId: string, listId: string) => void;
}

const formatRelativeTime = (dateString?: string) => {
    if (!dateString) return 'Không có';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Chưa có';
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const diffMinutes = Math.round(diffSeconds / 60);
    const diffHours = Math.round(diffMinutes / 60);
    const diffDays = Math.round(diffHours / 24);
    if (diffSeconds < 60) return 'Vừa xong';
    if (diffMinutes < 60) return `${diffMinutes} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const CustomerProfileModal: React.FC<CustomerProfileModalProps> = ({
    subscriber, onClose, onUpdate, onDelete, allLists, allSegments, allFlows, allTags = [], checkMatch,
    onAddToList, onRemoveFromList
}) => {
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);
    const [activeTab, setActiveTab] = useState('info');
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState<any>({});
    const [newNote, setNewNote] = useState('');
    const [tagPickerValue, setTagPickerValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [fullActivity, setFullActivity] = useState<any[]>([]);

    // Config for Delete Confirmation
    const [confirmConfig, setConfirmConfig] = useState<{
        isOpen: boolean; title: string; message: string; variant: 'danger' | 'warning'; onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', variant: 'danger', onConfirm: () => { } });

    // Config for Automation Trigger Warning
    const [triggerWarning, setTriggerWarning] = useState<{
        isOpen: boolean;
        triggeredFlows: Flow[];
        actionName: string;
        onConfirm: () => void;
    }>({ isOpen: false, triggeredFlows: [], actionName: '', onConfirm: () => { } });

    const [isManualTriggerOpen, setIsManualTriggerOpen] = useState(false);
    const [attrForm, setAttrForm] = useState({ isOpen: false, key: '', value: '' });
    const [showListPicker, setShowListPicker] = useState(false);
    const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
    const [activityFilter, setActivityFilter] = useState('');
    const [activitySubTab, setActivitySubTab] = useState<'all' | 'mail' | 'system' | 'website'>('all');
    const [isSummarizing, setIsSummarizing] = useState(false);

    const handleClose = () => {
        setAnimateIn(false);
        setTimeout(() => {
            setIsVisible(false);
            onClose();
        }, 220);
    };

    const isZalo = formData.email?.endsWith('@zalo-oa.vn');
    const isMeta = formData.email?.endsWith('@facebook.com');
    const isVirtualEmail = formData.email?.endsWith('@no-email.domation') || isZalo || isMeta;

    const handleAISummarize = async () => {
        const targetId = subscriber?.id || formData?.id;
        if (!targetId) return;
        setIsSummarizing(true);
        const tid = toast.loading('AI đang phân tích dữ liệu...');
        try {
            const res = await api.post<any>('subscriber_ai_summary', { subscriber_id: targetId });
            if (res.success && res.data?.summary) {
                toast.success('Đã tóm tắt thành công!', { id: tid });
                const newNoteObj: SubscriberNote = {
                    id: Date.now().toString(),
                    content: res.data.summary,
                    createdAt: new Date().toISOString(),
                    createdBy: 'AI Summary'
                };
                setFormData((prev: any) => ({
                    ...prev,
                    notes: [newNoteObj, ...(Array.isArray(prev.notes) ? prev.notes : [])]
                }));
                // Cập nhật lên backend
                const updatedNotes = [newNoteObj, ...(Array.isArray(formData.notes) ? formData.notes : [])];
                const updatedSubscriber = { ...formData, notes: updatedNotes } as Subscriber;
                onUpdate(updatedSubscriber);

                setActiveTab('notes');
            } else {
                toast.error(res.message || 'Lỗi khi tóm tắt AI!', { id: tid });
            }
        } catch (e) {
            console.error(e);
            toast.error('Lỗi kết nối khi tóm tắt!', { id: tid });
        } finally {
            setIsSummarizing(false);
        }
    };

    const resetState = async (targetSub?: Subscriber | null) => {
        const current = targetSub || subscriber;
        if (current) {
            setFormData(JSON.parse(JSON.stringify(current)));
            setIsEditing(false);
            setNewNote('');
            setTagPickerValue('');

            // Fetch full subscriber data including activity, always fresh on open
            if (current.id) {
                const res = await api.get<any>(`subscribers/${current.id}`);
                if (res.success) {
                    setFormData({ ...res.data, notes: Array.isArray(current.notes) ? current.notes : [] });
                    setFullActivity(res.data.activity || []);
                } else {
                    setFullActivity(current.activity || []);
                }
            }
        }
    };

    useEffect(() => {
        if (subscriber) {
            setIsVisible(true);
            resetState(subscriber);
            let raf2 = 0;
            const raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => setAnimateIn(true));
            });
            return () => {
                cancelAnimationFrame(raf1);
                cancelAnimationFrame(raf2);
            };
        } else {
            setAnimateIn(false);
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, 220);
            return () => clearTimeout(timer);
        }
    }, [subscriber]);

    useEffect(() => {
        if (!isVisible) return;
        const remove = pushOverlay('marketing_subscriber_drawer', handleClose, 2000);
        return remove;
    }, [isVisible]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isVisible && !confirmConfig.isOpen && !triggerWarning.isOpen && !isManualTriggerOpen && !isMetaModalOpen) {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isVisible, confirmConfig.isOpen, triggerWarning.isOpen, isManualTriggerOpen, isMetaModalOpen]);

    // When formData.notes changes, ensure the subscriber prop's notes are also up-to-date (for other parts of the app)
    useEffect(() => {
        const subscriberNotes = Array.isArray(subscriber?.notes) ? subscriber!.notes : [];
        const formDataNotes = Array.isArray(formData.notes) ? formData.notes : [];

        if (subscriber && JSON.stringify(subscriberNotes) !== JSON.stringify(formDataNotes)) {
            setFormData(prev => ({ ...prev, notes: subscriberNotes }));
        }
    }, [subscriber?.notes, formData.notes]);


    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    };

    const memberInsights = useMemo(() => {
        // Use formData as it contains the fresh API response with activeFlows, fallback to subscriber
        const data = (formData && formData.id) ? formData : subscriber;
        if (!data) return { segments: [], flows: [] };

        const matchedSegments = allSegments.filter(seg => checkMatch(data, seg.criteria));
        const activeFlows = (data as any).activeFlows || [];
        return { segments: matchedSegments, flows: activeFlows };
    }, [formData, subscriber, allSegments, checkMatch]);

    const activities = useMemo(() => {
        let list: any[] = [];

        if (fullActivity && fullActivity.length > 0) {
            list = fullActivity.map((act, i) => {
                let icon = Activity;
                let color = 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950';
                let label = 'Hoạt động';

                switch (act.type) {
                    case 'open_email':
                        icon = MailOpen; color = 'text-emerald-500 bg-emerald-50'; label = 'Mở Email';
                        break;
                    case 'skipped_email':
                        icon = Mail; color = 'text-slate-400 bg-slate-50'; label = 'Bỏ qua Email';
                        break;
                    case 'click_link':
                        icon = MousePointer2; color = 'text-pink-500 bg-pink-50'; label = 'Click Link';
                        break;
                    case 'reply_email':
                        icon = MessageSquare; color = 'text-indigo-600 bg-indigo-50 border-indigo-100'; label = 'Đã Phản hồi';
                        break;
                    case 'unsubscribe':
                        icon = UserMinus; color = 'text-rose-600 bg-rose-50 border-rose-100'; label = 'Hủy đăng ký'
                        break;
                    case 'join_list':
                        icon = List; color = 'text-blue-500 bg-blue-50'; label = 'Vào Danh sách';
                        break;
                    case 'enter_segment':
                        icon = Layers; color = 'text-purple-500 bg-purple-50'; label = 'Vào Phân khúc';
                        break;
                    case 'enter_flow':
                        icon = Zap; color = 'text-blue-500 bg-blue-50'; label = 'Vào Automation';
                        break;
                    case 'note_added':
                        icon = FileText; color = 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950'; label = 'Ghi chú';
                        break;
                    case 'form_submit': // Added for Form Submissions
                        icon = FileText; color = 'text-amber-600 bg-amber-50'; label = 'Gửi Form';
                        break;
                    case 'purchase': // Added for Purchase Events
                        // @ts-ignore: ShoppingCart is now imported
                        icon = ShoppingCart; color = 'text-pink-500 bg-pink-50'; label = 'Mua hàng';
                        break;
                    case 'custom_event': // Added for Custom Events
                        icon = Zap; color = 'text-blue-500 bg-blue-50'; label = 'Custom Event';
                        break;
                    case 'tag_added': // Added for Tag Added
                        icon = Tag; color = 'text-emerald-500 bg-emerald-50'; label = 'Gắn Tag';
                        break;
                    case 'exit_flow': // Added for Flow Exit
                        // @ts-ignore: ArrowRight is now imported
                        icon = ArrowRight; color = 'text-red-500 bg-red-50'; label = 'Thoát Flow';
                        break;
                    case 'staff_reply':
                        icon = MessageSquare;
                        color = 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950';
                        label = 'Staff Reply';
                        // Use Facebook icon if explicitly mentioned in label or type
                        if (act.label && act.label.toLowerCase().includes('facebook')) {
                            icon = Facebook;
                        }
                        break;
                    case 'lead_score_sync':
                        icon = Star; color = 'text-amber-600 bg-amber-50'; label = 'Lead Scoring';
                        break;
                    case 'zns_sent':
                    case 'sent_zns': // Added sent_zns Alias
                        icon = MessageSquare; color = 'text-blue-500 bg-blue-50'; label = 'ZNS Sent';
                        break;
                    case 'zns_delivered':
                        icon = CheckCircle2; color = 'text-green-500 bg-green-50'; label = 'ZNS Delivered';
                        break;
                    case 'reply_zns':
                    case 'user_send_text':
                        icon = MessageCircle; color = 'text-indigo-500 bg-indigo-50'; label = 'Zalo Reply';
                        break;
                    case 'profile_sync':
                        icon = RefreshCw; color = 'text-cyan-500 bg-cyan-50'; label = 'Profile Sync';
                        break;
                    case 'follow':
                        icon = UserPlus; color = 'text-blue-500 bg-blue-50'; label = 'Zalo Follow';
                        break;
                    case 'user_reacted_message':
                    case 'reacted_broadcast':
                        icon = Heart; color = 'text-pink-500 bg-pink-50'; label = 'Zalo Heart';
                        break;
                    case 'user_feedback':
                        icon = Star; color = 'text-amber-600 bg-amber-50'; label = 'Zalo Feedback';
                        break;
                    case 'click_zns':
                    case 'zns_clicked':
                        icon = ExternalLink; color = 'text-emerald-500 bg-emerald-50'; label = 'ZNS Click';
                        break;
                    // --- WEB TRACKING EVENTS ---
                    case 'web_pageview':
                        icon = Globe; color = 'text-sky-500 bg-sky-50'; label = 'Website View';
                        break;
                    case 'web_click':
                    case 'web_canvas_click':
                        icon = MousePointer2; color = 'text-indigo-500 bg-indigo-50'; label = 'Website Click';
                        break;
                    case 'web_form':
                    case 'web_lead_capture':
                        icon = FileText; color = 'text-amber-600 bg-amber-50'; label = 'Website Lead';
                        break;
                    case 'web_scroll':
                    case 'scroll':
                        icon = ArrowUpRight; color = 'text-blue-500 bg-blue-50'; label = 'Website Scroll';
                        break;
                }

                const extractCleanClickUrl = (raw: string): string => {
                    if (!raw || typeof raw !== 'string') return '';
                    const stripped = raw.trim().replace(/^(?:Zalo\s+)?Click(?:ed)?\s+(?:link(?:\/button)?|button)(?:\s*\([^)]*\))*:\s*/i, '').trim();
                    if (/^https?:\/\//i.test(stripped)) return stripped.split(/\s+/)[0];
                    const match = stripped.match(/(https?:\/\/\S+)/i);
                    return match ? match[1] : '';
                };

                const pageTitleOrUrl = act.page_title || act.url || act.page_url || '';
                let rawLabel = act.label || act.reference_name || '';
                let detail = act.details || '';
                const actUrl = extractCleanClickUrl(act.url || act.page_url || '') || (act.type?.includes('click') ? extractCleanClickUrl(detail) : '');

                // [FIX] Detect JSON in label (often happens with Facebook templates)
                if (rawLabel.includes(': [') || rawLabel.includes(': {')) {
                    const colonPart = rawLabel.indexOf(': [');
                    const colonPartObj = rawLabel.indexOf(': {');
                    const splitIdx = (colonPart !== -1 && colonPartObj !== -1) ? Math.min(colonPart, colonPartObj) : (colonPart !== -1 ? colonPart : colonPartObj);

                    if (splitIdx !== -1) {
                        const potJSON = rawLabel.substring(splitIdx + 2).trim();
                        // Even if truncated, we split the label to keep it clean if it starts like JSON
                        if (potJSON.startsWith('[') || potJSON.startsWith('{')) {
                            rawLabel = rawLabel.substring(0, splitIdx);
                            if (!detail || detail.length < potJSON.length) detail = potJSON;
                        }
                    }
                }

                const displayLabel = (() => {
                    if (act.type === 'reply_email') return 'Khách hàng phản hồi';
                    if (act.type === 'unsubscribe') return 'Đã Hủy đăng ký'

                    if (act.type.startsWith('web_') && pageTitleOrUrl) {
                        return `${label}: ${pageTitleOrUrl}`;
                    }

                    // Avoid redundant: "Website Lead: Website Lead"
                    const cleanRaw = rawLabel.trim().toLowerCase();
                    const cleanLabel = label.trim().toLowerCase();
                    if (cleanRaw === cleanLabel || cleanRaw.startsWith(cleanLabel + ':')) {
                        return rawLabel;
                    }
                    if (cleanLabel.includes(cleanRaw) && cleanRaw.length > 3) {
                        return label;
                    }

                    return `${label}: ${rawLabel}`;
                })();

                return {
                    id: i,
                    type: act.type,
                    date: act.created_at || act.date,
                    label: displayLabel,
                    detail: detail,
                    url: actUrl,
                    duration: act.duration,
                    icon, color
                };
            });

            // [FIX] Deduplication & Merging logic (e.g., when Facebook logs text and JSON separately)
            const seen = new Map<string, any>();
            const deduplicated: any[] = [];

            list.forEach(act => {
                const dateObj = new Date(act.date);
                // Group by 10-second window to catch slight logging offsets and match backend
                const timeKey = Math.floor(dateObj.getTime() / 10000);

                // Extract ID if present: "Staff replied via Facebook (ID: 263902037430900)"
                const idMatch = act.label.match(/\(ID: (\d+)\)/);
                const idKey = idMatch ? idMatch[1] : act.label;
                const typeKey = act.type;

                const key = `${timeKey}_${typeKey}_${idKey}`;

                if (seen.has(key)) {
                    const existing = seen.get(key);
                    // Merging: Prefer JSON content for the fancy card
                    const currentIsJSON = act.detail?.trim().startsWith('[') || act.detail?.trim().startsWith('{');
                    const existingIsJSON = existing.detail?.trim().startsWith('[') || existing.detail?.trim().startsWith('{');

                    if (currentIsJSON && !existingIsJSON) {
                        existing.detail = act.detail;
                    } else if (!existing.detail && act.detail) {
                        existing.detail = act.detail;
                    }
                } else {
                    seen.set(key, act);
                    deduplicated.push(act);
                }
            });
            list = deduplicated;
        }

        // Add "Join System" event if not duplicated
        if (subscriber && !list.some(a => a.type === 'join')) {
            const siteDomain = subscriber.customAttributes?.site_domain || subscriber.customAttributes?.domain || subscriber.customAttributes?.site_name;
            const sourceDisplay = subscriber.source === 'website_tracking' && siteDomain ? siteDomain : (subscriber.source || 'Manual');

            list.push({
                id: 'join-system',
                type: 'join',
                date: subscriber.joinedAt,
                label: `Gia nhập hệ thống`,
                detail: `Nguồn: ${sourceDisplay}`,
                icon: UserPlus,
                color: 'text-blue-500 bg-blue-50'
            });
        }

        // Sort by date descending
        return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [fullActivity, subscriber]);

    const filteredActivities = useMemo(() => {
        let list = activities;

        // Sub-tab filter
        if (activitySubTab === 'mail') {
            const mailTypes = ['open_email', 'skipped_email', 'click_link', 'reply_email', 'unsubscribe', 'receive_email', 'failed_email', 'send_email', 'receive', 'failed', 'sent'];
            list = list.filter(act => mailTypes.includes(act.type));
        } else if (activitySubTab === 'website') {
            const websiteTypes = ['web_pageview', 'web_click', 'web_canvas_click', 'web_scroll', 'web_identify', 'web_form', 'web_lead_capture'];
            list = list.filter(act => websiteTypes.includes(act.type));
        } else if (activitySubTab === 'system') {
            const mailTypes = ['open_email', 'click_link', 'reply_email', 'unsubscribe', 'receive_email', 'failed_email', 'send_email', 'receive', 'failed', 'sent'];
            const websiteTypes = ['web_pageview', 'web_click', 'web_canvas_click', 'web_scroll', 'web_identify', 'web_form', 'web_lead_capture'];
            // Everything else is system (including join, tags, flows, Zalo, and specifically web_track leads)
            list = list.filter(act => !mailTypes.includes(act.type) && !websiteTypes.includes(act.type));
            // 'all' tab - no filtering needed
        }

        // USER REQUEST: Exclude 'join' (gia nhập hệ thống) and 'enter' (tham gia) from recent interaction filter view
        const excludeTypes = ['join', 'enter_list', 'enter_segment', 'enter_flow'];
        list = list.filter(act => !excludeTypes.includes(act.type));

        if (!activityFilter) return list;
        const query = activityFilter.toLowerCase();
        return list.filter(act =>
            act.label.toLowerCase().includes(query) ||
            act.detail.toLowerCase().includes(query)
        );
    }, [activities, activityFilter, activitySubTab]);

    const heatmapData = useMemo(() => {
        const daysToShow = 104; // 26 columns * 4 rows (fits standard modal width)
        const data: { date: string; count: number }[] = [];
        const now = new Date();

        for (let i = 0; i < daysToShow; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() - i);

            // Format to YYYY-MM-DD using local time
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const dateStr = `${y}-${m}-${day}`;

            // FIX: Use 'activities' instead of 'fullActivity' to include 'Join System' event
            const count = activities.filter(act => {
                const aDate = act.date || '';
                return aDate.startsWith(dateStr);
            }).length;
            data.push({ date: dateStr, count });
        }
        return data.reverse();
    }, [activities]);

    const formatDuration = (seconds: number) => {
        if (!seconds) return '0s';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return m > 0 ? `${m}m ${s}s` : `${s}s`;
    };

    const heatmapIntensity = (count: number) => {
        if (count === 0) return 'bg-slate-100';
        if (count === 1) return 'bg-emerald-200';
        if (count === 2) return 'bg-emerald-300';
        if (count <= 4) return 'bg-emerald-400';
        return 'bg-emerald-600';
    };

    const handleSave = async () => {
        if (!formData.email) {
            showToast('Email là bắt buộc', 'error');
            return;
        }
        setIsLoading(true);
        const payload = { ...formData };
        if (!payload.dateOfBirth) payload.dateOfBirth = null;
        if (!payload.anniversaryDate) payload.anniversaryDate = null;

        // --- DEFERRED AUTOMATION CHECK ---
        const originalTags = Array.isArray(subscriber?.tags) ? subscriber!.tags : [];
        const newTags = (Array.isArray(formData.tags) ? formData.tags : []).filter(t => !originalTags.includes(t));

        const originalLists = Array.isArray(subscriber?.listIds) ? subscriber!.listIds : [];
        const newListIds = (Array.isArray(formData.listIds) ? formData.listIds : []).filter(id => !originalLists.includes(id));

        let allTriggeredFlows: Flow[] = [];
        let actionNames: string[] = [];

        newTags.forEach(tag => {
            const flows = findTriggeringFlows('tag', tag);
            if (flows.length > 0) {
                allTriggeredFlows = [...allTriggeredFlows, ...flows];
                actionNames.push(`Gắn nhãn "${tag}"`);
            }
        });

        newListIds.forEach(listId => {
            const flows = findTriggeringFlows('list', listId);
            if (flows.length > 0) {
                allTriggeredFlows = [...allTriggeredFlows, ...flows];
                const listName = allLists.find(l => l.id === listId)?.name || 'Danh sách';
                actionNames.push(`Thêm vào "${listName}"`);
            }
        });

        // Remove duplicates from flows
        allTriggeredFlows = allTriggeredFlows.filter((f, i, self) => self.findIndex(x => x.id === f.id) === i);

        const performUpdate = async () => {
            try {
                await Promise.resolve(onUpdate(payload as Subscriber));

                // Fetch fresh data from server after successful update
                const res = await api.get<any>(`subscribers/${subscriber.id}`);
                if (res.success) {
                    setFormData(res.data);
                }

                setIsEditing(false);

                setTriggerWarning(prev => ({ ...prev, isOpen: false }));
            } catch (error) {
                showToast('Lỗi khi cập nhật hồ sơ', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        if (allTriggeredFlows.length > 0) {
            setTriggerWarning({
                isOpen: true,
                triggeredFlows: allTriggeredFlows,
                actionName: actionNames.join(', '),
                onConfirm: performUpdate
            });
            setIsLoading(false); // Stop loading to show warning
        } else {
            performUpdate();
        }
    };

    // Old note handlers removed


    // --- Automation Check Logic ---
    const findTriggeringFlows = (type: 'tag' | 'list', targetId: string) => {
        return allFlows.filter(flow => {
            if (flow.status !== 'active') return false;
            const trigger = flow.steps.find(s => s.type === 'trigger');
            if (!trigger) return false;

            if (type === 'tag') {
                // Lookup Tag ID from Name
                const tagObj = allTags.find(t => t.name === targetId);
                const tagId = tagObj?.id || '';
                return trigger.config.type === 'tag' && (trigger.config.targetId === tagId || trigger.config.targetId === targetId);
            }
            if (type === 'list') {
                // List trigger is typically type='segment' subtype='list' or dedicated list type
                return trigger.config.type === 'segment' &&
                    trigger.config.targetSubtype === 'list' &&
                    trigger.config.targetId === targetId;
            }
            return false;
        });
    };

    const handleAddTag = (tag: string) => {
        if (!tag) return;

        // FIX: Ensure formData.tags is an array
        const currentTags = Array.isArray(formData.tags) ? formData.tags : [];
        if (!currentTags.includes(tag)) {
            setFormData({ ...formData, tags: [...currentTags, tag] });
        }
        setTagPickerValue('');
    };

    const handleLocalAddList = (listId: string) => {
        if (!listId) return;

        // FIX: Ensure formData.listIds is an array
        const currentListIds = Array.isArray(formData.listIds) ? formData.listIds : [];
        if (!currentListIds.includes(listId)) {
            setFormData({ ...formData, listIds: [...currentListIds, listId] });
        }
    };

    const handleLocalRemoveList = (listId: string) => {
        // FIX: Ensure formData.listIds is an array
        setFormData({ ...formData, listIds: (Array.isArray(formData.listIds) ? formData.listIds : []).filter((id: string) => id !== listId) });
    };

    if (!isVisible && !subscriber) return null;

    const drawerContent = (
        <>
            <div
                style={{ zIndex: 2147483625, pointerEvents: animateIn ? 'auto' : 'none' }}
                className={`fixed inset-0 z-[2147483625] flex justify-end overflow-hidden ${animateIn ? 'pointer-events-auto' : 'pointer-events-none'}`}
            >
                {/* Backdrop Blur Overlay with Floating Circular Arrow Close Button */}
                <div
                    className="drawer-backdrop"
                    onClick={handleClose}
                    style={{
                        opacity: animateIn ? 1 : 0,
                        transition: 'opacity 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)',
                        pointerEvents: animateIn ? 'auto' : 'none',
                        zIndex: 2147483620,
                        '--drawer-backdrop-z': 2147483620
                    } as React.CSSProperties}
                />

                {/* Slide-over Right Drawer Panel - Anchored to sidebar */}
                <div
                    style={{ zIndex: 2147483625 }}
                    className="customer-profile-modal-container fixed inset-y-0 right-0 z-[2147483625] max-w-full flex pl-0 pointer-events-none"
                >
                    <div
                        className="drawer-panel fixed top-0 right-0 bottom-0 z-[2147483625] customer-profile-modal-panel w-screen max-w-none bg-white dark:bg-slate-950 shadow-2xl flex flex-col overflow-hidden"
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
                            .customer-profile-modal-container {
                              padding-left: var(--sidebar-width, 220px) !important;
                            }
                            .customer-profile-modal-panel {
                              width: calc(100vw - var(--sidebar-width, 220px)) !important;
                            }
                          }
                        `}</style>

                        {/* EXECUTIVE HEADER BAR */}
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                            {/* Customer Identity */}
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="relative shrink-0">
                                    <Avatar
                                        name={(formData.firstName || formData.lastName) ? `${formData.firstName || ''} ${formData.lastName || ''}`.trim() : (formData.email || '?')}
                                        src={formData.avatar}
                                        size={52}
                                    />
                                    {(Number(formData.verified) === 1) && (
                                        <div className="absolute -bottom-0.5 -right-0.5 bg-white dark:bg-slate-900 rounded-full p-0.5 border border-slate-100 dark:border-slate-800">
                                            <BadgeCheck className="w-4 h-4 text-blue-500 fill-blue-50" />
                                        </div>
                                    )}
                                </div>

                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-xl font-black text-slate-900 dark:text-white truncate tracking-tight">
                                            {(formData.firstName || formData.lastName) ? `${formData.firstName || ''} ${formData.lastName || ''}`.trim() : (formData.email || 'Chưa đặt tên')}
                                        </h2>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                            {formData.status || 'Active'}
                                        </span>
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                            Đã thẩm định
                                        </span>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        <span>Tạo lúc: {formatRelativeTime(formData.createdAt || formData.joinedAt)}</span>
                                        <span>•</span>
                                        <span>Tương tác gần nhất: {formatRelativeTime(formData.lastActiveAt || formData.updatedAt || formData.lastActivityAt || formData.joinedAt || formData.createdAt)}</span>
                                        {!isVirtualEmail && (
                                            <>
                                                <span>•</span>
                                                <span className="text-blue-600 dark:text-blue-400 font-bold">{formData.email}</span>
                                            </>
                                        )}
                                        {formData.phone && (
                                            <>
                                                <span>•</span>
                                                <span className="text-slate-700 dark:text-slate-300 font-bold">{formData.phone}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Header Actions */}
                            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 text-xs font-black">
                                    <Star className="w-3.5 h-3.5 fill-blue-500 text-blue-500" />
                                    {formData.leadScore || formData.score || 100} Points
                                </span>

                                {(formData.contact_id || (subscriber as any)?.contact_id) && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            window.dispatchEvent(new CustomEvent('open-customer-drawer', { detail: { initialTab: 'journey360', id: Number(formData.contact_id || (subscriber as any)?.contact_id) } }));
                                        }}
                                        className="px-3.5 py-2 rounded-xl bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white text-xs font-bold transition-all shadow-sm inline-flex items-center gap-1.5"
                                        title="Mở Hồ Sơ CRM 360°"
                                    >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Mở Hồ Sơ CRM 360°
                                    </button>
                                )}

                                <button
                                    onClick={handleAISummarize}
                                    disabled={isSummarizing}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-xs font-bold transition-all disabled:opacity-50"
                                >
                                    <Sparkles className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin' : ''}`} />
                                    {isSummarizing ? 'Đang xử lý...' : 'Tóm tắt AI'}
                                </button>

                                {isEditing ? (
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => resetState()} className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">Hủy</button>
                                        <button onClick={handleSave} className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-md shadow-blue-500/25">Lưu cập nhật</button>
                                    </div>
                                ) : (
                                    <button onClick={() => setIsEditing(true)} className="px-4 py-2 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-md shadow-blue-500/25 transition-all">Sửa hồ sơ</button>
                                )}

                                <button
                                    onClick={handleClose}
                                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all ml-1"
                                    title="Đóng (Esc)"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* SPLIT-PANE BODY */}
                        <div className="flex-1 flex min-h-0 overflow-hidden">

                            {/* LEFT SUB-SIDEBAR PANEL */}
                            <div className="w-64 shrink-0 border-r border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900 p-4 space-y-6 overflow-y-auto">
                                
                                {/* Group 1 */}
                                <div className="space-y-1">
                                    <h4 className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Thông tin & Nhật ký</h4>
                                    <button
                                        onClick={() => setActiveTab('info')}
                                        className={`w-full flex items-center gap-3 px-3.5 py-3.5 rounded-xl text-xs font-bold transition-all ${
                                            activeTab === 'info' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <User className="w-4 h-4" />
                                        <span>Thông tin chung</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('notes')}
                                        className={`w-full flex items-center gap-3 px-3.5 py-3.5 rounded-xl text-xs font-bold transition-all ${
                                            activeTab === 'notes' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <Tag className="w-4 h-4" />
                                        <span>Tags & Ghi chú</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('stats')}
                                        className={`w-full flex items-center gap-3 px-3.5 py-3.5 rounded-xl text-xs font-bold transition-all ${
                                            activeTab === 'stats' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <BarChart2 className="w-4 h-4" />
                                        <span>Số liệu & Insights</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('automation')}
                                        className={`w-full flex items-center gap-3 px-3.5 py-3.5 rounded-xl text-xs font-bold transition-all ${
                                            activeTab === 'automation' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <GitMerge className="w-4 h-4" />
                                        <span>Công việc & Flow</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('activity')}
                                        className={`w-full flex items-center gap-3 px-3.5 py-3.5 rounded-xl text-xs font-bold transition-all ${
                                            activeTab === 'activity' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <History className="w-4 h-4" />
                                        <span>Hành trình tương tác</span>
                                    </button>
                                </div>

                                {/* Group 2 */}
                                <div className="space-y-1 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <h4 className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Hội thoại & Thao tác</h4>
                                    <button
                                        onClick={() => setActiveTab('chat')}
                                        className={`w-full flex items-center gap-3 px-3.5 py-3.5 rounded-xl text-xs font-bold transition-all ${
                                            activeTab === 'chat' ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                        }`}
                                    >
                                        <MessageSquare className="w-4 h-4" />
                                        <span>Hội thoại Chat</span>
                                    </button>
                                    <button
                                        onClick={() => setIsManualTriggerOpen(true)}
                                        className="w-full flex items-center gap-3 px-3.5 py-3.5 rounded-xl text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all border border-blue-200 dark:border-blue-800/40"
                                    >
                                        <Zap className="w-4 h-4 text-blue-500" />
                                        <span>Kích hoạt Flow thủ công</span>
                                    </button>
                                </div>

                                {/* Delete Button */}
                                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <button
                                        onClick={() => setConfirmConfig({
                                            isOpen: true,
                                            title: "Xóa hồ sơ khách hàng?",
                                            message: "Tất cả dữ liệu lịch sử và phân khúc của khách hàng này sẽ bị xóa hoàn toàn.",
                                            variant: 'danger',
                                            onConfirm: () => { const id = subscriber?.id || formData?.id; if (id) onDelete(id); handleClose(); }
                                        })}
                                        className="w-full flex items-center gap-2 px-3.5 py-3.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all border border-rose-200 dark:border-rose-900/40"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Xóa hồ sơ</span>
                                    </button>
                                </div>
                            </div>

                            {/* RIGHT MAIN CONTENT CANVAS */}
                            <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-slate-50/50 dark:bg-slate-950/50 space-y-6">
                                {activeTab === 'info' && (
                                    <div className="space-y-6">
                                        {/* 4 Summary Insight Metric Cards */}
                                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Điểm tích lũy</span>
                                                <span className="text-lg font-black text-blue-600 dark:text-blue-400 mt-1 block">{formData.leadScore || formData.score || 0} Points</span>
                                                <span className="text-[10px] font-semibold text-slate-400 mt-0.5 block">Lead score tự động</span>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Tương tác đã ghi nhận</span>
                                                <span className="text-lg font-black text-slate-800 dark:text-white mt-1 block">{activities.length || 0} sự kiện</span>
                                                <span className="text-[10px] font-semibold text-slate-400 mt-0.5 block">Hoạt động hệ thống</span>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Phân khúc phù hợp</span>
                                                <span className="text-lg font-black text-slate-800 dark:text-white mt-1 block">{memberInsights.segments.length} nhóm</span>
                                                <span className="text-[10px] font-semibold text-slate-400 mt-0.5 block">Segment matching</span>
                                            </div>
                                            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm">
                                                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Lần tương tác cuối</span>
                                                <span className="text-base font-black text-slate-800 dark:text-white mt-1 block">{formatRelativeTime(formData.lastActiveAt || formData.updatedAt || formData.joinedAt)}</span>
                                            </div>
                                        </div>
                                {/* Nhóm 1: Định danh */}
                                <section className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                                        <div className="w-4 h-px bg-slate-200"></div> Thông tin định danh
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-[18px] border border-slate-100 dark:border-slate-800/60 shadow-sm">
                                        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-5">
                                            {(isEditing || formData.lastName) && (
                                                <div className="md:col-span-1">
                                                    <Input label="Họ & Tên đệm" value={formData.lastName || ''} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} disabled={!isEditing} placeholder="Họ..." />
                                                </div>
                                            )}
                                            <div className={(isEditing || formData.lastName) ? "md:col-span-1" : "md:col-span-2"}>
                                                <Input label="Tên" value={formData.firstName || ''} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} disabled={!isEditing} placeholder="Tên..." required />
                                            </div>
                                            <div className="md:col-span-1">
                                                <Select
                                                    label="Trạng thái"
                                                    options={[
                                                        { value: 'active', label: 'Active' },
                                                        { value: 'unsubscribed', label: 'Unsubscribed' },
                                                        { value: 'lead', label: 'Lead' },
                                                        { value: 'customer', label: 'Customer' },
                                                        { value: 'bounced', label: 'Bounced' },
                                                        { value: 'complained', label: 'Complained' }
                                                    ]}
                                                    value={formData.status || ''}
                                                    onChange={(v) => setFormData({ ...formData, status: v })}
                                                    disabled={!isEditing}
                                                    variant="outline"
                                                />
                                            </div>
                                        </div>
                                        <Select
                                            label="Giới tính"
                                            options={[{ value: 'male', label: 'Nam' }, { value: 'female', label: 'Nữ' }, { value: 'other', label: 'Khác' }]}
                                            value={formData.gender || ''}
                                            onChange={(v) => setFormData({ ...formData, gender: v })}
                                            disabled={!isEditing}
                                            variant="outline"
                                        />
                                        <Input label="Điện thoại" value={formData.phoneNumber} onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })} disabled={!isEditing} icon={Phone} />
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 text-slate-400">Ngày sinh</label>
                                            <div className="relative">
                                                <input type="date" value={formData.dateOfBirth || ''} onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })} disabled={!isEditing} className={`w-full h-[42px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 text-sm font-bold focus:border-blue-600 outline-none disabled:bg-slate-50 dark:bg-slate-950 transition-all pl-10 ${!formData.dateOfBirth ? 'text-slate-300' : 'text-slate-700 dark:text-slate-200'}`} />
                                                <Cake className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                            </div>
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1 text-slate-400">Ngày đặc biệt</label>
                                            <div className="relative">
                                                <input type="date" value={formData.anniversaryDate || ''} onChange={(e) => setFormData({ ...formData, anniversaryDate: e.target.value })} disabled={!isEditing} className={`w-full h-[42px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-xl px-4 text-sm font-bold focus:border-blue-600 outline-none disabled:bg-slate-50 dark:bg-slate-950 transition-all pl-10 ${!formData.anniversaryDate ? 'text-slate-300' : 'text-slate-700 dark:text-slate-200'}`} />
                                                <Activity className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                            </div>
                                        </div>
                                        <Input
                                            label="Nguồn gốc (Source)"
                                            value={formData.source || ''}
                                            onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                                            disabled={!isEditing}
                                            icon={formData.source === 'Google Sheets' ? GoogleSheetsIcon : Globe}
                                            placeholder="VD: Web Form, Import CSV..."
                                        />
                                        <Input
                                            label="Salesperson"
                                            value={formData.salesperson || ''}
                                            onChange={(e) => setFormData({ ...formData, salesperson: e.target.value })}
                                            disabled={!isEditing}
                                            icon={User}
                                            placeholder="VD: Nguyễn Văn A..."
                                        />
                                        <Input
                                            label="Ngôn ngữ"
                                            value={formData.customAttributes?.language || ''}
                                            onChange={(e: any) => {
                                                const newAttrs = { ...(formData.customAttributes || {}), language: e.target.value };
                                                setFormData({ ...formData, customAttributes: newAttrs });
                                            }}
                                            disabled={!isEditing}
                                            icon={Globe}
                                            placeholder="VD: vi_VN, en_US..."
                                        />

                                    </div>
                                </section>



                                {/* Nhóm 2: Còng việc */}
                                <section className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                                        <div className="w-4 h-px bg-slate-200"></div> Còng việc & Công ty
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-[18px] border border-slate-100 dark:border-slate-800/60 shadow-sm">
                                        <Input label="Chức danh" value={formData.jobTitle} onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })} disabled={!isEditing} icon={Briefcase} />
                                        <Input label="Tên Công ty" value={formData.companyName} onChange={(e) => setFormData({ ...formData, companyName: e.target.value })} disabled={!isEditing} icon={Building} />
                                    </div>
                                </section>

                                {/* Nhóm 3: Địa lý (Tự nhập) */}
                                <section className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                                        <div className="w-4 h-px bg-slate-200"></div> Thông tin Địa lý
                                    </h4>
                                    <div className="bg-white dark:bg-slate-900 p-4 md:p-6 rounded-2xl md:rounded-[18px] border border-slate-100 dark:border-slate-800/60 shadow-sm">
                                        <Input label="Địa chỉ" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} disabled={!isEditing} icon={MapPin} />
                                    </div>
                                </section>

                                {/* Nhóm: Custom Attributes */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <div className="w-4 h-px bg-slate-200"></div> Thuộc tính tùy chỉnh
                                        </h4>
                                        {isEditing && (
                                            <button
                                                onClick={() => setAttrForm({ isOpen: true, key: '', value: '' })}
                                                className="flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/60 rounded-xl text-[10px] font-black uppercase text-slate-600 dark:text-slate-300 transition-all hover:shadow-sm"
                                            >
                                                <Plus className="w-3.5 h-3.5 text-blue-600" /> Thêm trường
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        {attrForm.isOpen && (
                                            <div className="bg-blue-50/50 p-4 rounded-[18px] border border-blue-200 animate-in zoom-in-95 duration-200">
                                                <div className="grid grid-cols-2 gap-3 mb-3">
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black text-blue-500 uppercase ml-1">Tên trường</label>
                                                        <input
                                                            placeholder="VD: Website, Facebook..."
                                                            value={attrForm.key}
                                                            onChange={e => setAttrForm({ ...attrForm, key: e.target.value })}
                                                            className="w-full bg-white dark:bg-slate-900 border border-blue-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-300"
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[9px] font-black text-blue-500 uppercase ml-1">Giá trị</label>
                                                        <input
                                                            placeholder="Nhập giá trị..."
                                                            value={attrForm.value}
                                                            onChange={e => setAttrForm({ ...attrForm, value: e.target.value })}
                                                            className="w-full bg-white dark:bg-slate-900 border border-blue-100 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:border-blue-300"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setAttrForm({ isOpen: false, key: '', value: '' })} className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase hover:text-slate-600 dark:text-slate-300">Hủy</button>
                                                    <button
                                                        onClick={() => {
                                                            if (!attrForm.key) return;
                                                            const current = formData.customAttributes || {};
                                                            setFormData({
                                                                ...formData,
                                                                customAttributes: { ...current, [attrForm.key]: attrForm.value }
                                                            });
                                                            setAttrForm({ isOpen: false, key: '', value: '' });
                                                        }}
                                                        className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-blue-600/20"
                                                    >
                                                        Xác nhận
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className={`bg-white dark:bg-slate-900 p-6 rounded-[18px] border border-slate-100 dark:border-slate-800/60 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4 ${!formData.customAttributes || Object.keys(formData.customAttributes).length === 0 ? 'hidden' : ''}`}>
                                            {Object.entries(formData.customAttributes || {}).map(([key, value]) => (
                                                <div key={key} className="flex flex-col bg-slate-50 dark:bg-slate-950/50 p-3 px-4 rounded-xl border border-transparent hover:border-slate-200 dark:border-slate-700/60 hover:bg-white dark:bg-slate-900 group/attr relative transition-all">
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">{key}</span>
                                                    {isEditing ? (
                                                        <input
                                                            type="text"
                                                            value={String(value)}
                                                            onChange={(e) => {
                                                                setFormData({
                                                                    ...formData,
                                                                    customAttributes: { ...formData.customAttributes, [key]: e.target.value }
                                                                });
                                                            }}
                                                            className="text-xs font-bold text-slate-800 dark:text-slate-200 bg-transparent border-none outline-none rounded p-0 w-full focus:text-blue-600"
                                                        />
                                                    ) : (
                                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200 break-all">{String(value)}</span>
                                                    )}

                                                    {isEditing && (
                                                        <button
                                                            onClick={() => {
                                                                setConfirmConfig({
                                                                    isOpen: true,
                                                                    title: 'Xóa trường tùy chỉnh?',
                                                                    message: `Dữ liệu trong trường "${key}" sẽ bị gỡ khỏi hồ sơ này.`,
                                                                    variant: 'danger',
                                                                    onConfirm: () => {
                                                                        const newAttrs = { ...formData.customAttributes };
                                                                        delete newAttrs[key];
                                                                        setFormData({ ...formData, customAttributes: newAttrs });
                                                                        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
                                                                    }
                                                                });
                                                            }}
                                                            className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover/attr:opacity-100 transition-all"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {(!formData.customAttributes || Object.keys(formData.customAttributes).length === 0) && !isEditing && (
                                            <div className="text-center py-10 bg-slate-50 dark:bg-slate-950/50 rounded-[18px] border border-slate-100 dark:border-slate-800/60 border-dashed">
                                                <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                                                    <Globe className="w-6 h-6 text-slate-200" />
                                                </div>
                                                <p className="text-xs text-slate-400 font-bold italic tracking-tight">Chưa có thông tin mở rộng.</p>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Nhóm: Metadata Hệ thống */}
                                <div className="pt-6 border-t border-slate-100 dark:border-slate-800/60 flex flex-wrap gap-x-6 gap-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">ID:</span>
                                        <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400">{formData.id}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cập nhật lúc:</span>
                                        <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 tracking-tight">{formData.updatedAt ? new Date(formData.updatedAt).toLocaleString('vi-VN') : 'Unknown'}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'stats' && (
                            <div className="space-y-10">
                                {/* Nhóm: Heatmap Hoạt động (GitHub style) */}
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <div className="w-4 h-px bg-slate-200"></div> Heatmap Hoạt động
                                        </h4>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] font-bold text-slate-400">Less</span>
                                            <div className="w-2.5 h-2.5 rounded-sm bg-slate-100"></div>
                                            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-200"></div>
                                            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-300"></div>
                                            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-400"></div>
                                            <div className="w-2.5 h-2.5 rounded-sm bg-emerald-600"></div>
                                            <span className="text-[9px] font-bold text-slate-400">More</span>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 p-6 pt-12 rounded-[18px] border border-slate-100 dark:border-slate-800/60 shadow-sm overflow-visible">
                                        <div className="grid grid-rows-4 grid-flow-col gap-1.5">
                                            {heatmapData.map((day, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`w-3.5 h-3.5 rounded-sm ${heatmapIntensity(day.count)} transition-all hover:scale-150 hover:z-10 cursor-help relative group/tip`}
                                                >
                                                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-[9px] font-black rounded-lg whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-all z-50 shadow-xl">
                                                        {day.date}: {day.count} hoạt động
                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="mt-6 flex justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                                            <span>{new Date(heatmapData[0]?.date).toLocaleDateString('vi-VN', { month: 'short' })}</span>
                                            <span>{new Date(heatmapData[Math.floor(heatmapData.length / 2)]?.date).toLocaleDateString('vi-VN', { month: 'short' })}</span>
                                            <span className="text-emerald-600">Hôm nay</span>
                                        </div>
                                    </div>
                                </section>
                                {/* Nhóm: Chỉ số tương tác (Engagement) */}
                                <section className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                                        <div className="w-4 h-px bg-slate-200"></div> Chỉ số tương tác (Engagement)
                                    </h4>

                                    <div className="grid grid-cols-3 gap-3">
                                        {[
                                            { label: 'đã gửi', value: formData.stats?.emailsSent || 0, color: 'blue', icon: Send },
                                            { label: 'Đã mở', value: formData.stats?.emailsOpened || 0, color: 'orange', icon: MailOpen, rate: formData.stats?.emailsSent > 0 ? Math.round((formData.stats.emailsOpened / formData.stats.emailsSent) * 100) : 0 },
                                            { label: 'Đã bấm', value: formData.stats?.linksClicked || 0, color: 'emerald', icon: MousePointer2, rate: formData.stats?.emailsOpened > 0 ? Math.round((formData.stats.linksClicked / formData.stats.emailsOpened) * 100) : 0 },
                                        ].map((stat, idx) => (
                                            <div key={idx} className="bg-white dark:bg-slate-900 p-5 rounded-[18px] border border-slate-100 dark:border-slate-800/60 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group">
                                                <div className={`absolute top-0 right-0 w-16 h-16 -mr-4 -mt-4 rounded-full opacity-5 bg-${stat.color}-500 transform scale-150`}></div>
                                                <stat.icon className={`w-5 h-5 text-${stat.color}-500 mb-2.5 opacity-40`} />
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 z-10">{stat.label}</p>
                                                <p className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tighter z-10">{stat.value}</p>
                                                {stat.rate !== undefined && (
                                                    <div className={`mt-1.5 px-2 py-0.5 rounded-full bg-${stat.color}-50 text-${stat.color}-600 text-[9px] font-black z-10`}>
                                                        {stat.rate}%
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="bg-slate-50 dark:bg-slate-950/80 p-5 rounded-[18px] border border-slate-100 dark:border-slate-800/60 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                                        {[
                                            { label: 'Hoạt động cuối', value: formData.lastActivityAt, color: 'blue', icon: Activity },
                                            { label: 'Mở thư cuối', value: formData.stats?.lastOpenAt, color: 'orange', icon: Eye },
                                            { label: 'Bấm link cuối', value: formData.stats?.lastClickAt, color: 'emerald', icon: MousePointer2 },
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between group">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 flex items-center justify-center text-${item.color}-500 shadow-sm`}>
                                                        <item.icon className="w-4 h-4" />
                                                    </div>
                                                    <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-tighter">{item.label}:</span>
                                                </div>
                                                <span className={`text-[10px] font-black tracking-tight ${item.value ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 italic'}`}>
                                                    {item.value ? formatRelativeTime(item.value) : 'Chưa ghi nhận'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </section>



                                {/* Nhóm: Kỹ thuật & Vị trí cuối */}
                                <section className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                                        <div className="w-4 h-px bg-slate-200"></div> Hệ điều hành & Vị trí (Auto)
                                    </h4>
                                    <div className="bg-white dark:bg-slate-900 p-6 rounded-[18px] border border-slate-100 dark:border-slate-800/60 shadow-sm">
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-y-8 gap-x-4">
                                            {[
                                                { label: 'Thiết bị', value: formData.last_device, icon: Smartphone, color: 'indigo' },
                                                { label: 'Trình duyệt', value: formData.last_browser, icon: Globe, color: 'blue' },
                                                { label: 'Hệ điều hành', value: formData.last_os, icon: Monitor, color: 'slate' },
                                                { label: 'Địa danh (IP)', value: formData.last_city, icon: MapPin, color: 'rose' },
                                                { label: 'Quốc gia (IP)', value: formData.last_country, icon: Globe, color: 'emerald' },
                                                { label: 'Zalo UID', value: formData.zalo_user_id, icon: BadgeCheck, color: 'blue' },
                                            ].map((item, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`flex flex-col gap-1.5 transition-all ${item.label.includes('(IP)') && item.value ? 'cursor-pointer hover:translate-x-1 active:scale-95' : ''}`}
                                                    onClick={() => {
                                                        if (item.label.includes('(IP)') && item.value && !formData.address) {
                                                            setFormData({ ...formData, address: item.value });
                                                            toast.success(`Đã lấy địa chỉ từ ${item.label}`);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-1.5 opacity-50">
                                                        <item.icon className="w-3 h-3" />
                                                        <p className="text-[9px] font-black uppercase tracking-widest">{item.label}</p>
                                                    </div>
                                                    <p className={`text-xs font-black truncate px-1 ${item.value ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 italic font-bold'}`}>
                                                        {item.value || 'N/A'}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'automation' && (
                            <div className="space-y-10">
                                {/* Lists Section */}
                                <section className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                                        <List className="w-3.5 h-3.5" /> Danh sách tham gia
                                    </h4>
                                    <div className="space-y-3">
                                        {(Array.isArray(formData.listIds) ? formData.listIds : []).map((lId: string) => {
                                            const list = allLists.find(x => x.id === lId);
                                            return list && (
                                                <div key={lId} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl shadow-sm group">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 ${list.source === 'Google Sheets' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'} rounded-xl flex items-center justify-center border`}>
                                                            {list.source === 'Google Sheets' ? (
                                                                <GoogleSheetsIcon className="w-5 h-5" />
                                                            ) : (
                                                                <List className="w-5 h-5" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{list.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                                {list.source === 'Google Sheets' ? 'Google Sheets Sync' : 'Static List'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    {isEditing && (
                                                        <button
                                                            onClick={() => handleLocalRemoveList(lId)}
                                                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all"
                                                            title="Gỡ khỏi danh sách (Còn lưu để áp dụng)"
                                                        >
                                                            <UserMinus className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {(!Array.isArray(formData.listIds) || formData.listIds.length === 0) && (
                                            <div className="text-center py-6 border-2 border-dashed border-slate-100 dark:border-slate-800/60 rounded-2xl text-slate-300 text-xs font-bold uppercase tracking-widest">Trống</div>
                                        )}

                                        {/* Chỉ hiện nút Ghi danh khi đang Edit */}
                                        {isEditing && (
                                            <div className="pt-2 mt-4 animate-in fade-in slide-in-from-bottom-1 w-full">
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setShowListPicker(!showListPicker)}
                                                        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-2 border-dashed border-blue-200 hover:border-blue-400 rounded-2xl transition-all group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-10 h-10 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                                                                <UserPlus className="w-5 h-5 text-blue-600" />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="text-sm font-bold text-blue-900">Ghi danh vào danh sách...</p>
                                                                <p className="text-[10px] text-blue-600/70 font-medium">Chọn danh sách để thêm liên hệ</p>
                                                            </div>
                                                        </div>
                                                        <ChevronDown className={`w-5 h-5 text-blue-400 transition-transform ${showListPicker ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    {showListPicker && (
                                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700/60 shadow-xl z-50 max-h-80 overflow-y-auto">
                                                            <div className="p-2 space-y-1">
                                                                {allLists
                                                                    .filter(l => {
                                                                        // Lọc bỏ danh sách sync và danh sách đã tham gia
                                                                        const isAlreadyMember = (Array.isArray(formData.listIds) ? formData.listIds : []).includes(l.id);
                                                                        return !isSyncList(l) && !isAlreadyMember;
                                                                    })
                                                                    .map(l => (
                                                                        <button
                                                                            key={l.id}
                                                                            onClick={() => {
                                                                                handleLocalAddList(l.id);
                                                                                setShowListPicker(false);
                                                                            }}
                                                                            className="w-full flex items-center justify-between p-3 hover:bg-slate-50 dark:bg-slate-950 rounded-xl transition-all group/item"
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover/item:scale-110 transition-transform">
                                                                                    <List className="w-4 h-4" />
                                                                                </div>
                                                                                <div className="text-left">
                                                                                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200 group-hover/item:text-blue-600">{l.name}</p>
                                                                                    <p className="text-[10px] text-slate-400 font-medium">{l.count || 0} thành viên</p>
                                                                                </div>
                                                                            </div>
                                                                            <Plus className="w-4 h-4 text-slate-300 group-hover/item:text-blue-500 group-hover/item:translate-x-1 transition-all" />
                                                                        </button>
                                                                    ))
                                                                }
                                                                {allLists.filter(l => {
                                                                    const isAlreadyMember = (Array.isArray(formData.listIds) ? formData.listIds : []).includes(l.id);
                                                                    return !isSyncList(l) && !isAlreadyMember;
                                                                }).length === 0 && (
                                                                        <div className="p-6 text-center">
                                                                            <p className="text-xs text-slate-400 font-medium">Không còn danh sách nào khả dụng</p>
                                                                        </div>
                                                                    )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>

                                {/* Segments Section */}
                                <section className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                                        <Layers className="w-3.5 h-3.5" /> Phân khúc đang khớp
                                    </h4>
                                    <div className="space-y-2">
                                        {memberInsights.segments.length > 0 ? memberInsights.segments.map(seg => (
                                            <div key={seg.id} className="flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                                                <div className="flex items-center gap-3">
                                                    <Layers className="w-5 h-5 text-blue-600" />
                                                    <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{seg.name}</span>
                                                </div>
                                                <Badge variant="brand" className="text-[8px] uppercase tracking-tighter">Auto-Matched</Badge>
                                            </div>
                                        )) : <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800/60 font-bold uppercase tracking-widest">Không khớp phân khúc nào</p>}
                                    </div>
                                </section>

                                <section className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                            <GitMerge className="w-3.5 h-3.5" /> Automation đang chạy
                                        </h4>
                                        <button
                                            onClick={() => setIsManualTriggerOpen(true)}
                                            className="p-1 px-2 text-[9px] font-black text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1.5 transition-all border border-transparent hover:border-blue-100"
                                        >
                                            <Plus className="w-3 h-3" /> KÍCH HOẠT FLOW
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {memberInsights.flows.map(flow => {
                                            const isActive = flow.flowStatus === 'active';
                                            return (
                                                <div
                                                    key={flow.id}
                                                    className={`p-5 rounded-[18px] flex items-center justify-between shadow-xl cursor-pointer transition-all group/flow ${isActive ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:border-slate-300'}`}
                                                    onClick={() => {
                                                        navigate('/marketing/flows', { state: { openFlowId: flow.id, tab: 'analytics' } });
                                                        onClose();
                                                    }}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-colors ${isActive ? 'bg-white dark:bg-slate-900/10 group-hover/flow:bg-[#2563eb]/20' : 'bg-slate-200'}`}>
                                                            <Zap className={`w-5 h-5 ${isActive ? 'text-blue-600 fill-blue-600' : 'text-slate-400'}`} />
                                                        </div>
                                                        <div>
                                                            <span className={`text-sm font-bold transition-colors ${isActive ? 'group-hover/flow:text-blue-600' : 'text-slate-700 dark:text-slate-200'}`}>{flow.name}</span>
                                                            <p className="text-[10px] opacity-60 font-bold uppercase tracking-widest mt-0.5">
                                                                {isActive ? 'Active Journey' : 'Automation Paused'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                                                        <span className={`text-[9px] font-black uppercase tracking-widest ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>
                                                            {isActive ? 'In Progress' : 'Stopped'}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {memberInsights.flows.length === 0 && <p className="text-xs text-slate-400 italic text-center py-6 bg-slate-50 dark:bg-slate-950 rounded-2xl border-2 border-dashed border-slate-100 dark:border-slate-800/60 font-bold uppercase tracking-widest">Chưa tham gia quy trình nào</p>}
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'activity' && (
                            <div className="space-y-6">
                                {/* SEARCH/FILTER BAR */}
                                <div className="space-y-4 mb-6">
                                    {/* Sub Tabs */}
                                    <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
                                        {[
                                            { id: 'all', label: 'Tất cả' },
                                            { id: 'mail', label: 'Tương tác mail' },
                                            { id: 'system', label: 'Hệ thống' },
                                            { id: 'website', label: 'Website' }
                                        ].map(tab => (
                                            <button
                                                key={tab.id}
                                                onClick={() => setActivitySubTab(tab.id as any)}
                                                className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${activitySubTab === tab.id ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:text-slate-200'}`}
                                            >
                                                {tab.label}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                            <Search className="h-4 w-4 text-slate-400" />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Tìm kiếm hành trình..."
                                            value={activityFilter}
                                            onChange={(e) => setActivityFilter(e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl py-2.5 pl-10 pr-4 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50/50 focus:border-blue-400 transition-all shadow-sm"
                                        />
                                        {activityFilter && (
                                            <button
                                                onClick={() => setActivityFilter('')}
                                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 dark:text-slate-300"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="relative pl-12 space-y-12 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-100">
                                    {filteredActivities.map((act, i) => (
                                        <div key={i} className="relative animate-in slide-in-from-left-2" style={{ animationDelay: `${i * 50}ms` }}>
                                            <div className={`absolute -left-12 w-10 h-10 rounded-full border-4 border-white shadow-md flex items-center justify-center z-10 ${act.color}`}>
                                                <act.icon className="w-4 h-4" />
                                            </div>
                                            <div className="bg-white dark:bg-slate-900 p-5 rounded-[18px] border border-slate-100 dark:border-slate-800/60 shadow-sm group hover:border-blue-200 transition-all">
                                                <div className="flex items-center justify-between gap-4 mb-2">
                                                    <div className="flex-1 min-w-0">
                                                        {act.type.includes('click') && act.url && /^https?:\/\//i.test(act.url) ? (
                                                            <a
                                                                href={act.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm font-black truncate block hover:underline text-slate-800 dark:text-slate-200"
                                                                title={act.url}
                                                            >
                                                                {act.label}
                                                            </a>
                                                        ) : (
                                                            <h5
                                                                className={`text-sm font-black truncate block ${act.type.includes('scroll') ? 'text-blue-600' : 'text-slate-800 dark:text-slate-200'}`}
                                                                title={act.label}
                                                            >
                                                                {act.label}
                                                            </h5>
                                                        )}
                                                        {act.duration > 0 && (
                                                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full mt-1">
                                                                <RefreshCw className="w-2.5 h-2.5" />
                                                                {formatDuration(act.duration)}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase shrink-0">{formatRelativeTime(act.date)}</span>
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                                                    {(() => {
                                                        const text = act.detail || '';

                                                        // [FIX] Handle mixed content: "Text message: [JSON]" or just "[JSON]"
                                                        let jsonStartIndex = -1;
                                                        const firstBracket = text.indexOf('[');
                                                        const firstBrace = text.indexOf('{');

                                                        if (firstBracket !== -1 && firstBrace !== -1) jsonStartIndex = Math.min(firstBracket, firstBrace);
                                                        else if (firstBracket !== -1) jsonStartIndex = firstBracket;
                                                        else if (firstBrace !== -1) jsonStartIndex = firstBrace;

                                                        if (jsonStartIndex !== -1) {
                                                            try {
                                                                const prefix = text.substring(0, jsonStartIndex).trim();
                                                                let jsonToParse = text.substring(jsonStartIndex).trim();

                                                                // [NEW] Robust repair for truncated JSON
                                                                if (!jsonToParse.endsWith(']') && !jsonToParse.endsWith('}')) {
                                                                    // 1. Close unclosed quotes
                                                                    const quoteCount = (jsonToParse.match(/"/g) || []).length;
                                                                    if (quoteCount % 2 !== 0) jsonToParse += '"';

                                                                    // 2. Add closing brackets
                                                                    const openB = (jsonToParse.match(/\[/g) || []).length;
                                                                    const closeB = (jsonToParse.match(/\]/g) || []).length;
                                                                    const openC = (jsonToParse.match(/\{/g) || []).length;
                                                                    const closeC = (jsonToParse.match(/\}/g) || []).length;

                                                                    for (let i = 0; i < (openC - closeC); i++) jsonToParse += '}';
                                                                    for (let i = 0; i < (openB - closeB); i++) jsonToParse += ']';
                                                                }

                                                                const parsed = JSON.parse(jsonToParse);

                                                                // Helper to safely get template payload
                                                                const getPayload = (obj: any) => {
                                                                    if (obj?.payload) return obj.payload;
                                                                    if (obj?.attachment?.payload) return obj.attachment.payload;
                                                                    if (obj?.message?.attachment?.payload) return obj.message.attachment.payload;
                                                                    return null;
                                                                };

                                                                const payload = getPayload(parsed);

                                                                // 1. Array (Carousel or List)
                                                                if (Array.isArray(parsed)) {
                                                                    return (
                                                                        <div className="space-y-2 mt-1">
                                                                            {prefix && <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap mb-2">{prefix}</div>}
                                                                            {parsed.map((item: any, idx: number) => {
                                                                                if (item.type === 'template' || item.title) {
                                                                                    return (
                                                                                        <div key={idx} className="bg-slate-50 dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-800/60 flex gap-3">
                                                                                            {item.image_url && <img src={item.image_url} className="w-10 h-10 rounded-lg object-cover bg-white dark:bg-slate-900" />}
                                                                                            <div className="text-slate-600 dark:text-slate-300">
                                                                                                <div className="font-bold text-xs">{item.title}</div>
                                                                                                {item.subtitle && <div className="text-[10px] text-slate-400">{item.subtitle}</div>}
                                                                                            </div>
                                                                                        </div>
                                                                                    );
                                                                                }
                                                                                if (item.text) return <div key={idx} className="text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{item.text}</div>;
                                                                                return <div key={idx} className="text-xs text-slate-400 font-mono break-all">{JSON.stringify(item)}</div>;
                                                                            })}
                                                                        </div>
                                                                    );
                                                                }

                                                                // 2. Facebook Template (Generic/Button)
                                                                if (payload) {
                                                                    if (payload.template_type === 'generic' && Array.isArray(payload.elements)) {
                                                                        return (
                                                                            <div className="space-y-2 mt-2">
                                                                                {prefix && <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap mb-2">{prefix}</div>}
                                                                                {payload.elements.map((el: any, idx: number) => (
                                                                                    <div key={idx} className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-100 dark:border-slate-800/60 items-center">
                                                                                        {el.image_url && <img src={el.image_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-200" />}
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{el.title}</div>
                                                                                            {el.subtitle && <div className="text-xs text-slate-500 dark:text-slate-400">{el.subtitle}</div>}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        );
                                                                    }
                                                                    if (payload.template_type === 'button') {
                                                                        return (
                                                                            <div className="mt-1 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800/60">
                                                                                {prefix && <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap mb-2">{prefix}</div>}
                                                                                <div className="text-slate-700 dark:text-slate-200 font-medium text-sm mb-2">{payload.text}</div>
                                                                                {Array.isArray(payload.buttons) && (
                                                                                    <div className="flex flex-wrap gap-2">
                                                                                        {payload.buttons.map((btn: any, bIdx: number) => (
                                                                                            <span key={bIdx} className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-lg text-[10px] font-bold text-blue-600 uppercase tracking-wide shadow-sm">
                                                                                                {btn.title}
                                                                                            </span>
                                                                                        ))}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    }
                                                                }

                                                                // 3. Simple Button Template (Old format or custom)
                                                                if (parsed.type === 'template' && parsed.title) {
                                                                    return (
                                                                        <div className="mt-1 text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
                                                                            {prefix && <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap mb-2">{prefix}</div>}
                                                                            <span className="font-bold">{parsed.title}</span>
                                                                            {parsed.subtitle && <div className="text-[11px] text-slate-400">{parsed.subtitle}</div>}
                                                                        </div>
                                                                    );
                                                                }

                                                                // 4. Fallback: Pretty print object keys if simple, else formatted code block
                                                                if (typeof parsed === 'object' && parsed !== null) {
                                                                    // Check if it's a flat simple object
                                                                    const keys = Object.keys(parsed);
                                                                    const isSimple = keys.every(k => typeof parsed[k] !== 'object' && String(parsed[k]).length < 100);

                                                                    if (isSimple && keys.length > 0) {
                                                                        return (
                                                                            <div className="mt-1 space-y-1">
                                                                                {prefix && <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap mb-2">{prefix}</div>}
                                                                                {keys.map(k => (
                                                                                    <div key={k} className="flex gap-2 text-xs">
                                                                                        <span className="font-bold text-slate-400 capitalize">{k.replace(/_/g, ' ')}:</span>
                                                                                        <span className="text-slate-700 dark:text-slate-200 break-all">{String(parsed[k])}</span>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        )
                                                                    }
                                                                }

                                                                // Raw fallback for complex objects
                                                                // return <pre className="text-[10px] bg-slate-50 dark:bg-slate-950 p-3 rounded-xl mt-2 overflow-auto font-mono text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800/60 whitespace-pre-wrap">{JSON.stringify(parsed, null, 2)}</pre>;
                                                                return (
                                                                    <div className="mt-2 text-[10px] bg-slate-50 dark:bg-slate-950 p-3 rounded-xl overflow-auto border border-slate-100 dark:border-slate-800/60 font-mono text-slate-500 dark:text-slate-400">
                                                                        {prefix && <div className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap mb-2 font-sans">{prefix}</div>}
                                                                        <div className="font-bold text-slate-400 mb-1 uppercase tracking-widest text-[9px]">Raw Data</div>
                                                                        <pre className="whitespace-pre-wrap break-all">{JSON.stringify(parsed, null, 2)}</pre>
                                                                    </div>
                                                                );
                                                            } catch (e) { /* ignore, continue to link parsing */ }
                                                        }

                                                        const urlRegex = /(https?:\/\/[^\s]+)/g;
                                                        const parts = text.split(urlRegex);

                                                        return parts.map((part, index) => {
                                                            if (part.match(urlRegex)) {
                                                                const displayUrl = part.length > 50 ? part.substring(0, 47) + '...' : part;
                                                                return (
                                                                    <a
                                                                        key={index}
                                                                        href={part}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-blue-600 hover:underline break-all font-bold"
                                                                        title={part}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        {displayUrl}
                                                                    </a>
                                                                );
                                                            }
                                                            return part;
                                                        });
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {filteredActivities.length === 0 && (
                                        <div className="text-center py-20 opacity-40">
                                            <Activity className="w-12 h-12 mx-auto mb-4" />
                                            <p className="text-sm font-bold uppercase tracking-widest">
                                                {activityFilter ? 'Không tìm thấy sự kiện phù hợp' : 'Chưa ghi nhận tương tác'}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'chat' && (
                            <SubscriberChatHistory subscriber={formData} />
                        )}

                        {activeTab === 'notes' && (
                            <div className="space-y-6">
                                {/* Nhãn phân loại (Tags) */}
                                <section className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Nhãn phân loại (Tags)</label>
                                    <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {(Array.isArray(formData.tags) ? formData.tags : []).map((tag: string) => (
                                                <span key={tag} className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl text-[11px] font-black text-slate-700 dark:text-slate-200 shadow-sm uppercase tracking-tight group/tag transition-all hover:border-blue-200 hover:bg-blue-50/30">
                                                    <Tag className="w-3.5 h-3.5 text-blue-600" /> {tag}
                                                    {isEditing && <button onClick={() => setFormData({ ...formData, tags: (Array.isArray(formData.tags) ? formData.tags : []).filter((t: string) => t !== tag) })} className="text-slate-300 hover:text-rose-500 transition-colors ml-1"><X className="w-3.5 h-3.5" /></button>}
                                                </span>
                                            ))}
                                            {(!Array.isArray(formData.tags) || formData.tags.length === 0) && <p className="text-xs text-slate-400 font-bold italic">Chưa gắn nhãn.</p>}
                                        </div>
                                        {isEditing && (
                                            <div className="max-w-xs">
                                                <Select placeholder="Thêm nhãn mới..." options={allTags.filter(t => !(Array.isArray(formData.tags) ? formData.tags : []).includes(t.name)).map(t => ({ value: t.name, label: t.name }))} value={tagPickerValue} onChange={handleAddTag} variant="outline" direction="bottom" />
                                            </div>
                                        )}
                                    </div>
                                </section>

                                <div className="min-h-[300px] flex flex-col">
                                    <div className="flex items-center justify-between mb-2 px-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Nội dung ghi chú</label>
                                        {!isEditing && <span className="text-[10px] text-slate-300 italic">Bấm "Sửa hồ sơ" để chỉnh sửa</span>}
                                    </div>
                                {isEditing ? (
                                    <>
                                        <textarea
                                            className="flex-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/60 rounded-2xl p-5 text-sm font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-50/5 focus:border-blue-600 focus:bg-white dark:bg-slate-900 transition-all shadow-inner leading-relaxed resize-none"
                                            placeholder="Nhập ghi chú chi tiết cho Khách hàng này..."
                                            value={(() => {
                                                // Handle different note formats
                                                if (typeof formData.notes === 'string') {
                                                    return formData.notes;
                                                } else if (Array.isArray(formData.notes)) {
                                                    return formData.notes.map((n: any) => {
                                                        // If note is a plain string (from MISA sync)
                                                        if (typeof n === 'string') return n;
                                                        // If note is an object with createdAt/content (manual notes)
                                                        if (n?.createdAt && n?.content) {
                                                            return `[${new Date(n.createdAt).toLocaleDateString()}] ${n.content}`;
                                                        }
                                                        // Handle snake_case from Meta Sync
                                                        if (n?.created_at && n?.content) {
                                                            // Format Date nice if possible
                                                            return `[${new Date(n.created_at).toLocaleDateString()}] ${n.content}`;
                                                        }
                                                        return String(n);
                                                    }).join('\n\n');
                                                }
                                                return '';
                                            })()}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                        />
                                        <p className="text-[10px] text-slate-400 mt-2 px-1 text-right">
                                            Hỗ trợ Markdown cơ bản. Nội dung sẽ được đồng bộ với trường Description.
                                        </p>
                                    </>
                                ) : (
                                    <div className="flex-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/60 rounded-2xl p-5 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-inner overflow-y-auto max-w-none 
                                    [&_p]:mb-4 [&_p:last-child]:mb-0 
                                    [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-4 
                                    [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-4 
                                    [&_li]:mb-1 
                                    [&_strong]:font-bold [&_strong]:text-slate-900 dark:[&_strong]:text-white 
                                    [&_hr]:border-slate-200 dark:[&_hr]:border-slate-800 [&_hr]:my-4">
                                        <ReactMarkdown>
                                            {(() => {
                                                if (typeof formData.notes === 'string') {
                                                    return formData.notes;
                                                } else if (Array.isArray(formData.notes)) {
                                                    return formData.notes.map((n: any) => {
                                                        if (typeof n === 'string') return n;
                                                        if (n?.createdAt && n?.content) {
                                                            return `**[${new Date(n.createdAt).toLocaleDateString()}]**\n\n${n.content}`;
                                                        }
                                                        if (n?.created_at && n?.content) {
                                                            return `**[${new Date(n.created_at).toLocaleDateString()}]**\n\n${n.content}`;
                                                        }
                                                        return String(n);
                                                    }).join('\n\n---\n\n');
                                                }
                                                return '*Chưa có ghi chú*';
                                            })()}
                                        </ReactMarkdown>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
</div>

            {/* AUTOMATION TRIGGER WARNING MODAL */}
            <ConfirmModal
                isOpen={triggerWarning.isOpen}
                onClose={() => setTriggerWarning({ ...triggerWarning, isOpen: false })}
                onConfirm={triggerWarning.onConfirm}
                variant="warning"
                title="Xác nhận Kích hoạt Flow"
                zIndex={2147483630}
                message={
                    <div className="text-left space-y-4">
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                            <Zap className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-amber-900 mb-1">Hành động {triggerWarning.actionName} sẽ kích hoạt tự động:</p>
                                <ul className="text-[11px] list-disc pl-4 text-amber-800 space-y-1">
                                    {triggerWarning.triggeredFlows.map(f => (
                                        <li key={f.id}>Automation: <b>{f.name}</b></li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">Bạn có chắc chắn muốn thực hiện hành động này và để các quy trình trên chạy cho Khách hàng này không?</p>
                    </div>
                }
                confirmLabel="Xác nhận & Kích hoạt"
            />

            <ConfirmModal
                isOpen={confirmConfig.isOpen}
                onClose={() => setConfirmConfig({ ...confirmConfig, isOpen: false })}
                onConfirm={confirmConfig.onConfirm}
                title={confirmConfig.title}
                message={confirmConfig.message}
                variant={confirmConfig.variant}
                zIndex={2147483630}
            />

            <ManualTriggerFlowModal
                isOpen={isManualTriggerOpen}
                onClose={() => setIsManualTriggerOpen(false)}
                subscriber={formData?.id ? formData : (subscriber || {} as any)}
                flows={allFlows}
                onSuccess={(flowName) => showToast(`Đã kích hoạt flow "${flowName}"`, 'success')}
                zIndex={2147483630}
            />

            {isMetaModalOpen && formData.meta_psid && (
                <MetaCustomerProfileModal
                    subscriberId={`meta_${formData.meta_psid}`}
                    onClose={() => setIsMetaModalOpen(false)}
                />
            )}
        </>
    );

    return createPortal(drawerContent, getMktPortalRoot());
};

// Helper Component for Chat History
const SubscriberChatHistory = ({ subscriber }: { subscriber: any }) => {
    const subscriberId = subscriber.id;
    const [conversations, setConversations] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loadingMsg, setLoadingMsg] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [openIndex, setOpenIndex] = useState<number | null>(null); // For accordion style if multiple convs
    const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadConversations();
    }, [subscriberId]);

    const loadConversations = async () => {
        setLoading(true);
        try {
            // Hardcoded property_id or fetch generic? 
            // The API requires property_id for context usually, but `list_conversations` might relax it if filtering by subscriber? 
            // Yes, checking API... Line 235: $params = [$propertyId]; $where = ["c.property_id = ?"];
            // So we MUST provide a property_id. 
            // We can get it from the subscriber data `formData.property_id` if available, or just use a default one/iterate.
            // Wait, CustomerProfileModal props doesn't explicitly pass propertyId, but Subscriber interface might have it.
            // Let's try to fetch with a known property ID or just loop. 
            // Actually, the API `ai_chatbot.php` requires it. 
            // Let's assume we can pass any valid property_id or the system finds it.
            // Hack: The user has `formData`. Does `subscribers` table have `property_id`? Yes (Line 714 in previous view).
            // So we can use `formData.property_id`? The Types might not show it but we can cast.
            // Or we just try to list without property_id filter if API allowed it?
            // API line 236 `c.property_id = ?` is hardcoded.
            // Let's use wildcard/hack if we don't know it, OR use the first property.
            // For now, let's assume we have it or pass a dummy one and hope the backend doesn't strict check if we filter by subscriber?
            // No, the query starts with `where c.property_id =`.
            // We need to fetch the Property ID.

            // Temporary: Use a known Property ID or fetch it via `formData`.
            // Let's check `formData` dump. `view_file` showed `subscribers` table has `property_id`.
            // But `activeTab` has access to `formData`.
            // Let's use `(subscriber as any).property_id`.

            // Re-read API: It takes `property_id` as GET param.
            // Let's try to find it.
            const pId = (subscriberId as any)?.startsWith('meta') ? 'meta_default' : 'web_default';
            // Actually, let's fetch ALL conversations by SKIPPING property_id check in API? 
            // That would require API change.
            // Let's modify API to make property_id optional if subscriber_id is present.


            // Use API adapter to respect DEFAULT_API_URL
            const data = await api.get<any>(`ai_chatbot?action=list_conversations&subscriber_id=${subscriberId}&limit=50`);

            if (data.success) {
                const results = Array.isArray(data.data) ? data.data : [];
                setConversations(results);

                if (results.length > 0) {
                    // Auto-load first one
                    loadMessages(results[0].id);
                    setOpenIndex(0);
                }
            }
        } catch (e) {
            console.error("Failed to load chat", e);
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (convId: number, beforeId: number | null = null) => {
        if (!beforeId) {
            setLoadingMsg(true);
            setHasMore(true);
        } else {
            setLoadingMore(true);
        }

        setSelectedConvId(convId);
        try {
            const url = `ai_chatbot?action=get_messages&conversation_id=${convId}&limit=20${beforeId ? `&before_id=${beforeId}` : ''}`;
            const data = await api.get<any>(url);
            if (data.success) {
                const newMessages = data.data;

                if (newMessages.length < 20) {
                    setHasMore(false);
                }

                if (beforeId) {
                    setMessages(prev => [...newMessages, ...prev]);
                } else {
                    setMessages(newMessages);
                    // Scroll to bottom on initial load
                    setTimeout(() => {
                        if (chatContainerRef.current) {
                            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                        }
                    }, 100);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingMsg(false);
            setLoadingMore(false);
        }
    };

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop === 0 && hasMore && !loadingMore && !loadingMsg && messages.length > 0) {
            const oldestId = messages[0].id; // Assuming sorted ASC
            const currentHeight = scrollHeight;
            loadMessages(selectedConvId!, oldestId).then(() => {
                setTimeout(() => {
                    if (chatContainerRef.current) {
                        const newHeight = chatContainerRef.current.scrollHeight;
                        chatContainerRef.current.scrollTop = newHeight - currentHeight;
                    }
                }, 50);
            });
        }
    };



    // ------------------------------------------------------------------
    // Helper: Rich Text Renderer (Copied from UnifiedChat)
    // ------------------------------------------------------------------
    const renderContent = (content: string, role: string) => {
        if (!content) return null;

        // 0. Extract [ACTIONS:...] tags
        let extractedActions: string[] = [];
        const actionRegex = /\[(?:ACTIONS|ACTION|BUTTONS|BUTTON|OPTIONS):?(.*?)\]/gi;

        // Process explicit tags
        content = content.replace(actionRegex, (match, rawActions) => {
            const separator = rawActions.includes('|') ? '|' : ',';
            const parsed = rawActions.split(separator).map((s: string) => s.trim()).filter((s: string) => s);
            extractedActions = [...extractedActions, ...parsed];
            return '';
        });

        // Process implicit tags at end of string (e.g. [Option 1 | Option 2])
        content = content.replace(/\[([^\[\]]+)\]$/, (match, group1) => {
            if (group1.includes('|') || group1.length < 100) {
                const separator = group1.includes('|') ? '|' : ',';
                const parsed = group1.split(separator).map((s: string) => s.trim()).filter((s: string) => s);
                extractedActions = [...extractedActions, ...parsed];
                return '';
            }
            return match;
        }).trim();

        // Strip [SHOW_LEAD_FORM] and other internal tags
        content = content.replace(/\[SHOW_LEAD_FORM\]/g, '');
        content = content.trim();

        if (!content && extractedActions.length === 0) return null;

        // 1. Helper: Parse Links, Emails, Phones & FILES
        const parseLinks = (text: string): (string | React.ReactNode)[] => {
            const combinedRegex = /(!?\[([^\]]+)\]\(([^)]+)\)|\[?(https?:\/\/[^\s\]]+)\]?|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(\+84|0)\d{9,10})/g;
            const parts: (string | React.ReactNode)[] = [];
            let lastIndex = 0;
            let match;

            while ((match = combinedRegex.exec(text)) !== null) {
                if (match.index > lastIndex) {
                    parts.push(text.substring(lastIndex, match.index));
                }

                const isMarkdownImage = match[1].startsWith('!');
                let label = match[2];
                let url = match[3] || match[4] || match[1];

                if (!match[3] && !match[2]) {
                    url = url.replace(/[.,!?;:)\]]+$/, '');
                }

                if (!label && (url.startsWith('mailto:') || url.startsWith('tel:'))) {
                    label = url.replace(/^(mailto|tel):/, '');
                } else if (!label && url.includes('@') && !url.startsWith('http')) {
                    label = url;
                    url = `mailto:${url}`;
                } else if (!label && url.match(/^(\+84|0)\d{9,10}$/)) {
                    label = url;
                    url = `tel:${url}`;
                }

                const imgExtMatch = url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i);
                if (isMarkdownImage || imgExtMatch) {
                    parts.push(
                        <div key={match.index} className="mt-2 mb-2">
                            <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm transition-all hover:scale-[1.02]">
                                <img src={url} alt={label || "Image"} className="w-full max-h-[200px] object-cover" />
                            </a>
                        </div>
                    );
                } else {
                    parts.push(
                        <a
                            key={match.index}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 mt-1 bg-slate-100/50 border border-slate-200 dark:border-slate-700/60 rounded-lg text-blue-600 font-bold hover:bg-white dark:bg-slate-900 hover:shadow-sm transition-all no-underline"
                        >
                            <ExternalLink className="w-3 h-3 text-slate-400" />
                            <span className="truncate max-w-[200px]">{label || url}</span>
                        </a>
                    );
                }
                lastIndex = combinedRegex.lastIndex;
            }
            if (lastIndex < text.length) parts.push(text.substring(lastIndex));
            return parts.length > 0 ? parts : [text];
        };

        const parseBold = (nodes: (string | React.ReactNode)[]): React.ReactNode[] => {
            return nodes.flatMap((node, i) => {
                if (typeof node !== 'string') return node;
                const boldParts = node.split(/(\*\*[^*]+\*\*)/g);
                return boldParts.map((part, j) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={`${i}-${j}`} className="font-bold">{part.slice(2, -2)}</strong>;
                    }
                    return part;
                });
            });
        };

        const parseInline = (text: string) => parseBold(parseLinks(text));

        const lines = content.split('\n');
        const blocks: React.ReactNode[] = [];
        let currentList: React.ReactNode[] = [];

        lines.forEach((line, idx) => {
            const trimmed = line.trim();
            if (trimmed.startsWith('* ') || trimmed.startsWith('- ') || trimmed.match(/^\d+\.\s/)) {
                const clean = trimmed.replace(/^(\* |-| \d+\.\s)\s?/, '');
                currentList.push(
                    <li key={`li-${idx}`} className="leading-relaxed pl-1">
                        {parseInline(clean)}
                    </li>
                );
            } else {
                if (currentList.length > 0) {
                    blocks.push(<ul key={`ul-${idx}`} className="list-disc pl-5 mb-3 space-y-1">{currentList}</ul>);
                    currentList = [];
                }
                if (trimmed) {
                    if (trimmed.startsWith('### ')) {
                        blocks.push(<h3 key={`h-${idx}`} className={`font-bold text-sm mb-2 mt-3 text-slate-800 dark:text-slate-200`}>{parseInline(trimmed.substring(4))}</h3>);
                    } else {
                        blocks.push(<p key={`p-${idx}`} className="mb-2 last:mb-0 leading-relaxed min-h-[1.2em]">{parseInline(trimmed)}</p>);
                    }
                }
            }
        });

        if (currentList.length > 0) {
            blocks.push(<ul key={`ul-end`} className="list-disc pl-5 mb-0 space-y-1">{currentList}</ul>);
        }

        // Append Actions if any
        if (role === 'ai' && extractedActions.length > 0) {
            blocks.push(
                <div key="actions" className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    {extractedActions.map((action, i) => (
                        <div
                            key={`action-${i}`}
                            className="px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/60 rounded text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1"
                        >
                            <Sparkles className="w-3 h-3 text-blue-500" />
                            {action}
                        </div>
                    ))}
                </div>
            );
        }

        return blocks.length > 0 ? blocks : parseInline(content);
    };

    const hasWebChat = conversations.some(c => !c.visitor_id.startsWith('meta_') && !c.visitor_id.startsWith('zalo_'));



    return (
        <div className="space-y-6">
            {/* KÊNH KẾT NỐI */}
            {(subscriber.meta_psid || subscriber.zalo_user_id || hasWebChat) && (
                <section>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] px-1 flex items-center gap-2 mb-3">
                        <div className="w-4 h-px bg-slate-200"></div> Kênh kết nối
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                        {/* Facebook Card */}
                        {subscriber.meta_psid && (
                            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-5 rounded-[18px] shadow-lg shadow-blue-500/20 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                                    <Facebook className="w-20 h-20" />
                                </div>
                                <div className="relative z-10 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white dark:bg-slate-900/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 overflow-hidden">
                                            <img src="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg" alt="Facebook" className="w-full h-full object-contain p-1.5" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-blue-100 uppercase tracking-[0.2em] mb-0.5">Facebook</p>
                                            <h5 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                                                Đã kết nối
                                                <BadgeCheck className="w-4 h-4 text-blue-300 fill-white" />
                                            </h5>
                                            <p className="text-[9px] text-blue-100/70 font-bold font-mono mt-0.5 opacity-80">PSID: {subscriber.meta_psid}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setIsMetaModalOpen(true)}
                                        className="px-4 py-2 bg-white dark:bg-slate-900 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:translate-y-[-2px] active:translate-y-0 transition-all flex items-center gap-1.5"
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        Chat
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Zalo Card */}
                        {subscriber.zalo_user_id && (
                            <div className="bg-gradient-to-br from-blue-400 to-blue-600 p-5 rounded-[18px] shadow-lg shadow-blue-400/20 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                                    <MessageSquare className="w-20 h-20" />
                                </div>
                                <div className="relative z-10 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white dark:bg-slate-900/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 text-blue-600 dark:text-white">
                                            <span className="font-black text-xs">ZALO</span>
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-blue-100 uppercase tracking-[0.2em] mb-0.5">Zalo OA</p>
                                            <h5 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                                                Đã kết nối
                                                <BadgeCheck className="w-4 h-4 text-blue-200 fill-white" />
                                            </h5>
                                            <p className="text-[9px] text-blue-100/70 font-bold font-mono mt-0.5 opacity-80">UID: {subscriber.zalo_user_id}</p>
                                        </div>
                                    </div>
                                    <button className="px-4 py-2 bg-white dark:bg-slate-900/10 hover:bg-white dark:bg-slate-900/20 text-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-default">
                                        Đã đồng bộ
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Web Chat Card */}
                        {hasWebChat && (
                            <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-5 rounded-[18px] shadow-lg shadow-slate-500/20 text-white relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                                    <Globe className="w-20 h-20" />
                                </div>
                                <div className="relative z-10 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white dark:bg-slate-900/20 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/30 text-slate-800 dark:text-white">
                                            <Globe className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-0.5">Website Chat</p>
                                            <h5 className="text-sm font-black tracking-tight flex items-center gap-1.5">
                                                Hoạt động
                                                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                            </h5>
                                            <p className="text-[9px] text-slate-400 font-bold font-mono mt-0.5 opacity-80">Live Chat</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {isMetaModalOpen && subscriber.meta_psid && (
                        <MetaCustomerProfileModal
                            subscriberId={`meta_${subscriber.meta_psid}`}
                            onClose={() => setIsMetaModalOpen(false)}
                        />
                    )}
                </section>
            )}

            {loading ? <div className="p-4 text-center text-slate-400">Đang tải lịch sử hội thoại...</div> :
                conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-300">
                        <MessageSquare className="w-12 h-12 mb-3 stroke-1" />
                        <span>Chưa có lịch sử hội thoại nào</span>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {conversations.map((conv, idx) => (
                            <div key={conv.id} className="border border-slate-100 dark:border-slate-800/60 rounded-2xl overflow-hidden">
                                <div
                                    className="bg-slate-50 dark:bg-slate-950 p-4 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => {
                                        if (openIndex === idx) setOpenIndex(null);
                                        else {
                                            setOpenIndex(idx);
                                            loadMessages(conv.id);
                                        }
                                    }}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                            <MessageSquare className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Hội thoại #{conv.id}</div>
                                            <div className="text-[10px] text-slate-400">{formatRelativeTime(conv.last_message_at)}</div>
                                        </div>
                                    </div>
                                    <div className={`text-slate-400 transition-transform ${openIndex === idx ? 'rotate-180' : ''}`}>
                                        <ChevronDown className="w-4 h-4" />
                                    </div>
                                </div>

                                {openIndex === idx && (
                                    <div
                                        className="border-t border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-900 p-4 max-h-[400px] overflow-y-auto space-y-4"
                                        ref={chatContainerRef}
                                        onScroll={handleScroll}
                                    >
                                        {loadingMore && <div className="text-center text-[10px] text-slate-300 py-2"><RefreshCw className="w-3 h-3 animate-spin inline mr-1" /> Đang tải cũ hơn...</div>}
                                        {loadingMsg ? <div className="text-center text-xs text-slate-400 py-4">Đang tải tin nhắn...</div> : (
                                            messages.length === 0 ? <div className="text-center text-xs text-slate-400">Không có tin nhắn</div> : messages.map(msg => (
                                                <div key={msg.id} className={`flex ${msg.sender === 'visitor' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${msg.sender === 'visitor'
                                                        ? 'bg-blue-600 text-white rounded-tr-sm'
                                                        : 'bg-slate-100 text-slate-700 dark:text-slate-200 rounded-tl-sm'
                                                        }`}>
                                                        {renderContent(msg.message, msg.sender)}
                                                        <div className={`text-[9px] mt-1 ${msg.sender === 'visitor' ? 'text-blue-200' : 'text-slate-400'}`}>
                                                            {formatRelativeTime(msg.created_at)}
                                                        </div>
                                                    </div>
                                                </div>
                                            )))}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
        </div>
    );
};

export default CustomerProfileModal;
