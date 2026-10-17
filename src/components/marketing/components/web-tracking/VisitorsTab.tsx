import * as React from 'react';
import { useState, useMemo, useEffect } from 'react';
import { User, Users, X, Smartphone, Tablet, Monitor, Terminal, MapPin, Globe, ChevronDown, RefreshCw, ChevronLeft, ChevronRight, Repeat, Clock, ShieldAlert, Check, List, BarChart3, ShieldCheck, Trash2, Bot, MessageSquare, Activity, ExternalLink, UserCheck, Phone, Mail } from 'lucide-react';
import { Visitor, VisitorStats, WebProperty } from './types';
import LiveTrafficModal from './LiveTrafficModal';
import RetentionTabContent from './overview/RetentionTabContent';
import Tabs from '../common/Tabs';
import Modal from '../common/Modal';
import StatCard from '../common/StatCard';
import SearchBox from '../common/SearchBox';
import { MktSegmented } from '../dashboard/MktLayout';
import TabTransition from '../common/TabTransition';
import ConfirmModal from '../common/ConfirmModal';
import { api } from '../../services/storageAdapter';
import toast from 'react-hot-toast';
import { Avatar } from '../../../ui/Avatar';

/** Opens MYERP CustomerProfileDrawer (journey360 tab) on top of current view without navigating away. */
const openCrmContact360 = (e: React.MouseEvent, contactId: unknown) => {
    e.stopPropagation();
    const id = Number(contactId);
    if (!id || Number.isNaN(id)) return;
    window.dispatchEvent(new CustomEvent('open-customer-drawer', { detail: { id, initialTab: 'journey360' } }));
};

const parseVisitorTags = (rawTags: any): string[] => {
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

interface VisitorsTabProps {
    visitors: Visitor[];
    selectedVisitor: Visitor | null;
    setSelectedVisitor: (visitor: Visitor | null) => void;
    fetchVisitorJourney: (visitor: Visitor) => void;
    visitorEvents: any[];
    visitorStats: VisitorStats | null;
    renderEventIcon: (type: string) => React.ReactNode;
    formatDuration: (seconds: number) => string;
    safeFormatDate: (dateValue: any) => string;
    getUserInitials: (visitor: Visitor) => string;
    visitorType: 'user' | 'bot'; // New
    setVisitorType: (val: 'user' | 'bot') => void; // New
    deviceFilter: string; // Keep for knowing current global filter if needed
    pagination: any;
    onPageChange: (page: number) => void;
    searchTerm: string;
    setSearchTerm: (val: string) => void;
    returningFilter: 'all' | 'returning' | 'identified';
    setReturningFilter: (val: 'all' | 'returning' | 'identified') => void;
    propertyId: string;
    liveCount: number;
    property: WebProperty;
    fetchVisitors: () => void;
    onJumpToChat?: (conversationId: string) => void;
    loading?: boolean;
}

const VisitorsTab: React.FC<VisitorsTabProps> = ({
    visitors, selectedVisitor, setSelectedVisitor, fetchVisitorJourney,
    visitorEvents, visitorStats, renderEventIcon, formatDuration,
    safeFormatDate, getUserInitials, visitorType, setVisitorType, deviceFilter, pagination,
    onPageChange, searchTerm, setSearchTerm, returningFilter,
    setReturningFilter, propertyId, liveCount, property, fetchVisitors, loading = false
}) => {
    const [mainTab, setMainTab] = useState<'list' | 'loyalty' | 'blocked'>('list');
    const [reportPeriod, setReportPeriod] = useState('7d');
    const [openDropdown, setOpenDropdown] = useState<'returning' | null>(null);
    const [liveModalOpen, setLiveModalOpen] = useState(false);
    const [activeJourneyTab, setActiveJourneyTab] = useState<'journey' | 'loyalty'>('journey');
    const [journeySubTab, setJourneySubTab] = useState<'all' | 'pageview' | 'click' | 'canvas_click' | 'other'>('all');
    const [expandedIdentities, setExpandedIdentities] = useState<Set<string>>(new Set());

    // Block IP Modal State
    const [ipBlockModalOpen, setIpBlockModalOpen] = useState(false);
    const [ipToBlock, setIpToBlock] = useState<{ ip: string; visitorName?: string } | null>(null);
    const [blockReason, setBlockReason] = useState('Manual block from Visitor Tab');
    const [isBlocking, setIsBlocking] = useState(false);

    const toggleIdentity = (e: React.MouseEvent | null, identity: string) => {
        if (e) e.stopPropagation();
        const newSet = new Set(expandedIdentities);
        if (newSet.has(identity)) newSet.delete(identity);
        else newSet.add(identity);
        setExpandedIdentities(newSet);
    };

    const handleJumpToChat = (visitor: Visitor) => {
        window.history.pushState({}, '', `/marketing/web-tracking?tab=ai&subtab=inbox&visitorId=${visitor.id}&propertyId=${propertyId}`);
        window.dispatchEvent(new PopStateEvent('popstate'));
    };

    const groupedVisitors = useMemo(() => {
        const result: { parent: Visitor; children: Visitor[] }[] = [];
        const identityMap = new Map<string, number>();

        visitors.forEach(v => {
            // Priority 1: Identity (Email or Phone)
            let identity = v.email || v.phone;

            // Priority 2: IP Address (for anonymous visitors)
            if (!identity && v.ip_address) {
                identity = `ip:${v.ip_address}`;
            }

            if (identity && identityMap.has(identity)) {
                result[identityMap.get(identity)!].children.push(v);
            } else {
                if (identity) {
                    identityMap.set(identity, result.length);
                }
                result.push({ parent: v, children: [] });
            }
        });
        return result;
    }, [visitors]);

    const filteredVisitors = visitors;

    // Find source from events (first non-direct source usually preferred, or just the latest/first)
    const sourceInfo = useMemo(() => {
        const evWithSource = visitorEvents.find(e => e.source && e.source !== 'direct / none');
        return evWithSource ? evWithSource.source : (visitorEvents[0]?.source || 'Direct / None');
    }, [visitorEvents]);

    const returningOptions = [
        { id: 'all', label: 'Tất cả Visitors', icon: <Users className="w-4 h-4" /> },
        { id: 'returning', label: 'Khách quay lại (2+)', icon: <RefreshCw className="w-4 h-4" /> },
        { id: 'identified', label: 'Khách đã định danh', icon: <User className="w-4 h-4" /> },
    ];

    const renderBrandIcon = (name: string | null) => {
        if (!name) return <Terminal className="w-4 h-4 text-slate-400" />;
        const n = name.toLowerCase();

        // OS Icons
        if (n.includes('win')) return (
            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0 3.449L9.75 2.1v9.451H0v-8.102zm10.949-1.467l13.05-1.879v11.33H10.949V1.983zm-10.949 10.65H9.75v8.103l-9.75-1.332v-6.771zm10.949 0h13.05v9.568l-13.05-1.879v-7.689z" />
            </svg>
        );
        if (n.includes('mac') || n.includes('ios') || n.includes('iphone') || n.includes('ipad')) return (
            <svg className="w-4 h-4 text-slate-800" viewBox="0 0 384 512" fill="currentColor">
                <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
            </svg>
        );
        if (n.includes('android')) return (
            <svg className="w-4 h-4 text-emerald-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.523 15.3414c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993.0001.5511-.4482.9997-.9993.9997m-11.046 0c-.5511 0-.9993-.4486-.9993-.9997s.4482-.9993.9993-.9993c.5511 0 .9993.4482.9993.9993 0 .5511-.4482.9997-.9993.9997m11.4045-6.02l1.9973-3.4592a.416.416 0 00-.1521-.5676.416.416 0 00-.5676.1521l-2.0223 3.503C15.5902 8.0745 13.8532 7.5 12 7.5c-1.8532 0-3.5902.5745-5.1367 1.4501L4.841 5.4467a.416.416 0 00-.5676-.1521.416.416 0 00-.1521.5676l1.9973 3.4592C2.6889 11.1867.3432 14.6589 0 18.761h24c-.3432-4.1021-2.6889-7.5743-6.1185-9.4396" />
            </svg>
        );
        if (n.includes('linux')) return <Terminal className="w-4 h-4 text-[var(--color-primary)]" />;

        // Browser Icons
        if (n.includes('chrome')) return (
            <svg className="w-4 h-4" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="chrome_a" x1="3.2173" y1="15" x2="44.7812" y2="15" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#d93025" /><stop offset="1" stopColor="#ea4335" /></linearGradient>
                    <linearGradient id="chrome_b" x1="20.7219" y1="47.6791" x2="41.5039" y2="11.6837" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#fcc934" /><stop offset="1" stopColor="#fbbc04" /></linearGradient>
                    <linearGradient id="chrome_c" x1="26.5981" y1="46.5015" x2="5.8161" y2="10.506" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#1e8e3e" /><stop offset="1" stopColor="#34a853" /></linearGradient>
                </defs>
                <circle cx="24" cy="23.9947" r="12" fill="#fff" />
                <path d="M3.2154,36A24,24,0,1,0,12,3.2154,24,24,0,0,0,3.2154,36ZM34.3923,18A12,12,0,1,1,18,13.6077,12,12,0,0,1,34.3923,18Z" fill="none" />
                <path d="M24,12H44.7812a23.9939,23.9939,0,0,0-41.5639.0029L13.6079,30l.0093-.0024A11.9852,11.9852,0,0,1,24,12Z" fill="url(#chrome_a)" />
                <circle cx="24" cy="24" r="9.5" fill="#1a73e8" />
                <path d="M34.3913,30.0029,24.0007,48A23.994,23.994,0,0,0,44.78,12.0031H23.9989l-.0025.0093A11.985,11.985,0,0,1,34.3913,30.0029Z" fill="url(#chrome_b)" />
                <path d="M13.6086,30.0031,3.218,12.006A23.994,23.994,0,0,0,24.0025,48L34.3931,30.0029l-.0067-.0068a11.9852,11.9852,0,0,1-20.7778.007Z" fill="url(#chrome_c)" />
            </svg>
        );
        if (n.includes('safari')) return (
            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm6.545 6.545l-2.071 8.878-8.878 2.071 2.071-8.878 8.878-2.071zM12 10.339a1.661 1.661 0 1 0 0 3.322 1.661 1.661 0 0 0 0-3.322z" />
            </svg>
        );
        if (n.includes('firefox')) return (
            <svg className="w-4 h-4 text-[var(--color-primary)]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.9 11.5c.2-3.8-2.3-7.4-6-8.9.5 2.1-.2 4.4-1.8 5.8 2.6 2.7 1.5 7.1-2.2 8.5-3.1 1.2-6.5-.2-8-3-2-3.7 1.4-7.9 4.6-8.8-.5 1.3-1.3 3-.7 3.9.9 1.5 3.9 1.7 5.3-.6 1.3-2.3-.4-4.8-2.3-5.4.4-1.2.4-2.6-.3-3.7-2.7.2-4.9.4-6.1.8 1.6-1.5 4.3-1.4 6-1.2-4.2.2-7.8 2.8-9.2 6.7-2 5.6 1.1 11.8 6.7 13.8 5.6 2 11.8-1.1 13.8-6.7.2-.4.4-.8.5-1.2z" />
            </svg>
        );
        if (n.includes('edge')) return (
            <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M0.4 10.7c.4-3.1 2.5-6.1 5.8-7.2 4-1.3 8.3 0 10.7 3.4.6.8 2 0 3-.8 2.4-1.7 1.3-4.7-1.3-5.3C11.5-.5 3.5 3 0.5 9c-.5 1 .6 1.4 1 1.4-.4.1-.7.2-1.1.3zm1.9 9.3c5.3 9.7 20.9 2.1 21.2-6.1.1-3-.7-5.1-4.2-6.3-1.4-.5-2.5-.2-3.3.3.4.2 1.9 1 2.2 1.2 2 .9 2.5 4 .9 5.8-1.5 1.7-4.4 1.7-6.2.3-2.1-1.7-1.5-5.1 1.2-5.1 1.2 0 2.2.8 2.5 2 .2 1 .3 2.1.2 3.1 4.5 0 5-4.5 3.5-6.8-2.2-3.5-7.7-2.3-9.5 1.4-1.3 2.6-1.2 5.7 1.2 7.8 3 2.6 7.4 2.1 9.9.5.4-.3.9-.7 1.2-1.2.9-1.5 1.7-3.2 2.3-5-2-5.7-9.5-6.5-14.2-2.3-4.3 3.9-4.7 10.6.2 14.4z" />
            </svg>
        );

        return <Globe className="w-4 h-4 text-slate-400" />;
    };

    const renderSourceLogo = (sourceName: string) => {
        const s = sourceName.toLowerCase();
        if (s === 'direct' || s.includes('direct')) return <Globe className="w-4 h-4 text-slate-400" />;
        if (s.includes('google')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Google_Favicon_2025.svg/250px-Google_Favicon_2025.svg.png" className="w-4 h-4 object-contain" alt="Google" />;
        if (s.includes('facebook') || s === 'fb') return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/960px-2021_Facebook_icon.svg.png" className="w-4 h-4 object-contain" alt="Facebook" />;
        if (s.includes('zalo')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/960px-Icon_of_Zalo.svg.png" className="w-4 h-4 object-contain" alt="Zalo" />;
        return <Globe className="w-4 h-4 text-slate-400" />;
    };

    const identifiedCount = useMemo(
        () => visitors.filter(v => !!(v.subscriber_id || v.zalo_user_id || v.email || v.phone)).length,
        [visitors]
    );
    const returningCount = useMemo(
        () => visitors.filter(v => (v.sessions && v.sessions > 1) || (v.visit_count && v.visit_count > 1)).length,
        [visitors]
    );

    const tabsHeader = (
        <div className="flex-shrink-0">
            <Tabs
                activeId={mainTab}
                onChange={setMainTab as any}
                variant="sub-segmented"
                layoutId="visitorMainSubTabs"
                items={[
                    { id: 'list', label: 'Danh sách Visitor', icon: List },
                    { id: "loyalty", label: "Báo cáo Trung thành", icon: BarChart3 },
                    { id: 'blocked', label: 'IP Đã Chặn', icon: ShieldAlert },
                ]}
            />
        </div>
    );

    if (mainTab === 'loyalty') {
        return (
            <TabTransition className="space-y-6">
                {tabsHeader}
                <RetentionTabContent property={property} device={deviceFilter} />
            </TabTransition>
        );
    }

    if (mainTab === 'blocked') {
        return (
            <TabTransition className="space-y-6">
                {tabsHeader}
                <BlockedIPsContent property={property} />
            </TabTransition>
        );
    }

    return (
        <TabTransition className="space-y-5">
            {/* 4-Card KPI Row in ONE line */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Đang xem (Live)"
                    value={liveCount.toLocaleString('vi-VN')}
                    icon={<Activity />}
                    color="#BD1D2D"
                    onClick={() => setLiveModalOpen(true)}
                    breakdown={<span>Click để xem luồng trực tiếp</span>}
                />
                <StatCard
                    title="Tổng Visitors"
                    value={(pagination?.total || filteredVisitors.length).toLocaleString('vi-VN')}
                    icon={<Users />}
                    color="#BD1D2D"
                    onClick={() => setReturningFilter('all')}
                    breakdown={<span>Trong trang: <b>{visitors.length}</b></span>}
                />
                <StatCard
                    title="Khách đã định danh"
                    value={identifiedCount.toLocaleString('vi-VN')}
                    icon={<User />}
                    color="#BD1D2D"
                    onClick={() => setReturningFilter('identified')}
                    breakdown={<span>Có Email / SĐT / Zalo</span>}
                />
                <StatCard
                    title="Khách quay lại (2+)"
                    value={returningCount.toLocaleString('vi-VN')}
                    icon={<Repeat />}
                    color="#BD1D2D"
                    onClick={() => setReturningFilter('returning')}
                    breakdown={<span>Từ 2 phiên truy cập trở lên</span>}
                />
            </div>

            <LiveTrafficModal isOpen={liveModalOpen} onClose={() => setLiveModalOpen(false)} propertyId={propertyId} />

            {/* Standardized 1-Row Toolbar */}
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] shadow-[var(--shadow-xs)]">
                {tabsHeader}
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setLiveModalOpen(true)}
                        className="inline-flex items-center gap-2 h-[38px] px-3 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity cursor-pointer"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
                        </span>
                        <span>Live: {liveCount.toLocaleString('vi-VN')}</span>
                    </button>

                    <MktSegmented<'user' | 'bot'>
                        value={visitorType}
                        onChange={setVisitorType}
                        options={[
                            { id: 'user', label: 'Người dùng', icon: User },
                            { id: 'bot', label: 'Bot Crawler', icon: Bot },
                        ]}
                    />

                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setOpenDropdown(openDropdown === 'returning' ? null : 'returning')}
                            className={`h-[38px] inline-flex items-center gap-2 px-3 rounded-[var(--radius-md)] text-[13px] font-semibold border transition-colors ${openDropdown === 'returning' ? 'bg-[var(--color-bg)] border-[var(--color-primary)] text-[var(--color-text)]' : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg)]'}`}
                        >
                            <Users className="w-4 h-4 text-[var(--color-text-muted)]" />
                            <span>{returningOptions.find(o => o.id === returningFilter)?.label}</span>
                            <ChevronDown className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${openDropdown === 'returning' ? 'rotate-180' : ''}`} />
                        </button>

                        {openDropdown === 'returning' && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                                <div className="absolute top-full mt-1.5 right-0 w-56 bg-[var(--color-surface)] rounded-[var(--radius-md)] border border-[var(--color-border)] shadow-[var(--shadow-lg)] z-20 py-1.5 overflow-hidden">
                                    {returningOptions.map(opt => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => { setReturningFilter(opt.id as any); setOpenDropdown(null); }}
                                            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-semibold transition-colors ${returningFilter === opt.id ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'text-[var(--color-text)] hover:bg-[var(--color-bg)]'}`}
                                        >
                                            {opt.icon}
                                            <span>{opt.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    <SearchBox
                        value={searchTerm}
                        onChange={setSearchTerm}
                        placeholder="Tìm kiếm visitor (Tên, Email, IP)..."
                        className="w-64 h-[38px] rounded-[var(--radius-md)]"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Visitor Table */}
                <div className="lg:col-span-2 bg-[var(--color-surface)] rounded-[20px] border border-[var(--color-border)] shadow-xs overflow-hidden flex flex-col h-[800px]">
                    <div className="p-4 border-b border-[var(--color-border)] flex-shrink-0 flex items-center justify-between bg-[var(--color-surface)]">
                        <h3 className="text-base font-bold text-[var(--color-text)]">Danh sách ({(pagination?.total || filteredVisitors.length).toLocaleString()})</h3>
                        <button
                            onClick={() => fetchVisitors()}
                            className="p-1.5 text-slate-400 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)] rounded-lg transition-all group"
                            title="Tải lại danh sách"
                        >
                            <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full">
                            <thead className="bg-slate-50 sticky top-0 z-10">
                                <tr className="text-left text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                    <th className="px-3 py-2.5 bg-slate-50">Khách</th>
                                    <th className="px-2 py-2.5 text-center bg-slate-50 w-12">Device</th>
                                    <th className="px-2 py-2.5 bg-slate-50 w-20">Last Visit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    Array.from({ length: 6 }).map((_, idx) => (
                                        <tr key={`skeleton-${idx}`} className="border-b border-slate-100">
                                            <td className="px-3 py-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-8 h-8 rounded-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] shrink-0" />
                                                    <div className="space-y-1.5 flex-1 min-w-0">
                                                        <div className="h-3.5 w-28 rounded-[6px] animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                                                        <div className="h-2.5 w-36 rounded-[6px] animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-2 py-3 text-center">
                                                <div className="w-7 h-7 rounded-lg animate-pulse bg-slate-200/70 dark:bg-white/[0.06] mx-auto" />
                                            </td>
                                            <td className="px-2 py-3">
                                                <div className="flex flex-col items-end gap-1.5">
                                                    <div className="h-3 w-16 rounded-[6px] animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                                                    <div className="h-2.5 w-12 rounded-[6px] animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : groupedVisitors.length > 0 ? (
                                    groupedVisitors.map((group) => {
                                        const { parent: visitor, children } = group;
                                        const identity = visitor.email || visitor.phone || visitor.id;
                                        const isExpanded = expandedIdentities.has(identity);
                                        const hasChildren = children.length > 0;

                                        return (
                                            <React.Fragment key={visitor.id}>
                                                <tr
                                                    onClick={() => {
                                                        fetchVisitorJourney(visitor);
                                                        if (hasChildren) toggleIdentity(null, identity);
                                                    }}
                                                    className={`border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${(visitor as any).is_blocked ? 'bg-rose-50' : (selectedVisitor?.id === visitor.id ? 'bg-slate-100/80 shadow-[inset_4px_0_0_0_var(--color-primary)]' : '')}`}
                                                >
                                                    <td className="px-3 py-2.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className="relative flex-shrink-0">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center border border-white shadow-sm overflow-hidden ${visitor.device_type === 'bot' ? 'bg-white' : (visitor.subscriber_id || visitor.zalo_user_id || visitor.email || visitor.phone) ? 'bg-[var(--color-primary)] text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                                    {visitor.device_type === 'bot' ? (
                                                                        (() => {
                                                                            const b = (visitor.browser || '').toLowerCase();
                                                                            if (b.includes('google') || b.includes('lighthouse')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Google_Favicon_2025.svg/250px-Google_Favicon_2025.svg.png" className="w-5 h-5 object-contain" alt="" />;
                                                                            if (b.includes('facebook') || b.includes('facebot')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/960px-2021_Facebook_icon.svg.png" className="w-5 h-5 object-contain" alt="" />;
                                                                            if (b.includes('zalo')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/960px-Icon_of_Zalo.svg.png" className="w-5 h-5 object-contain" alt="" />;
                                                                            if (b.includes('twitter') || b.includes(' x ')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/X_logo_2023.svg/100px-X_logo_2023.svg.png" className="w-5 h-5 object-contain" alt="" />;
                                                                            if (b.includes('bing')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Bing_Fluent_Logo.svg/100px-Bing_Fluent_Logo.svg.png" className="w-5 h-5 object-contain" alt="" />;
                                                                            if (b.includes('amazon') || b.includes('aws')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png" className="w-5 h-5 object-contain" alt="" />;
                                                                            if (b.includes('bytespider') || b.includes('tiktok')) return <img loading="lazy" decoding="async" src="https://img.freepik.com/premium-photo/tiktok-logo_1080029-103.jpg?semt=ais_hybrid&w=740&q=80" className="w-5 h-5 object-contain" alt="" />;
                                                                            if (b.includes('baidu')) return <img loading="lazy" decoding="async" src="https://cdn-icons-png.flaticon.com/512/2504/2504887.png" className="w-5 h-5 object-contain" alt="" />;
                                                                            if (b.includes('mailflow')) return <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-white"><Globe className="w-4 h-4" /></div>;
                                                                            return <Bot className="w-5 h-5 text-slate-400" />;
                                                                        })()
                                                                    ) : visitor.avatar_url ? (
                                                                        <img loading="lazy" decoding="async" src={visitor.avatar_url} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        (visitor.email || visitor.first_name) ? (
                                                                            <span className="text-[10px] font-bold uppercase">
                                                                                {(visitor.email?.[0] || visitor.first_name?.[0] || '?')}
                                                                            </span>
                                                                        ) : <User className="w-4 h-4" />
                                                                    )}
                                                                </div>
                                                                {((visitor as any).is_blocked || visitor.subscriber_id || visitor.zalo_user_id || visitor.email || visitor.phone || visitor.device_type === 'bot') && (
                                                                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 ${(visitor as any).is_blocked ? 'bg-rose-600' : (visitor.device_type === 'bot' ? 'bg-[var(--color-primary)]' : 'bg-emerald-500')} rounded-full flex items-center justify-center border-2 border-white`} title={(visitor as any).is_blocked ? 'Blocked' : (visitor.device_type === 'bot' ? 'Verified Bot' : 'Identified Customer')}>
                                                                        {(visitor as any).is_blocked ? <ShieldAlert className="w-1.5 h-1.5 text-white" /> : (
                                                                            <svg className="w-1.5 h-1.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="5">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-1.5">
                                                                    <p className="text-sm font-bold text-slate-700 truncate max-w-[140px]">
                                                                        {(visitor as any).is_blocked ? <span className="text-rose-600 font-extrabold">Blocked User</span> : (visitor.device_type === 'bot' ? (visitor.browser || 'Bot') : (visitor.first_name && visitor.first_name !== 'Visitor' ? visitor.first_name : (visitor.email || (visitor.phone ? 'Phone Visitor' : 'Anonymous'))))}
                                                                    </p>
                                                                    {visitor.device_type === 'bot' && (
                                                                        <span className="text-[9px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-lg font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
                                                                            <Check className="w-2.5 h-2.5" />
                                                                            Super Bot Verify
                                                                        </span>
                                                                    )}
                                                                    {hasChildren && (
                                                                        <button
                                                                            onClick={(e) => toggleIdentity(e, identity)}
                                                                            className="p-1 hover:bg-slate-100 rounded-lg transition-colors text-slate-400 group/chevron"
                                                                        >
                                                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? '' : '-rotate-90'} group-hover/chevron:text-blue-500`} />
                                                                        </button>
                                                                    )}
                                                                    {(visitor.sessions > 1 || visitor.visit_count > 1 || hasChildren) && (
                                                                        <span className="text-[9px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-lg font-bold uppercase tracking-wider shrink-0">Quay lại</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-1 mt-1">
                                                                    {visitor.contact_id && (
                                                                        <span
                                                                            onClick={(e) => openCrmContact360(e, visitor.contact_id)}
                                                                            className="text-[11px] font-mono text-[var(--color-text-muted)] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer"
                                                                            title="Mở Hồ sơ CRM 360"
                                                                        >
                                                                            CRM #{visitor.contact_id}
                                                                        </span>
                                                                    )}
                                                                    <span className="text-[11px] font-mono text-[var(--color-text-muted)] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                                                        Web ID: {visitor.id.substring(0, 8)}
                                                                    </span>
                                                                </div>
                                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-slate-500 font-medium">
                                                                    {visitor.device_type === 'bot' ? (
                                                                        <span>{(visitor.browser || '').toLowerCase().includes('mailflow') ? 'Bot cào của mailflow này Automated Verified Crawler' : 'Automated Verified Crawler'}</span>
                                                                    ) : (
                                                                        <>
                                                                            {(visitor.phone_number || visitor.phone) && (
                                                                                <span className="inline-flex items-center gap-0.5 text-slate-600 font-semibold">
                                                                                    <Phone className="w-2.5 h-2.5" />
                                                                                    {visitor.phone_number || visitor.phone}
                                                                                </span>
                                                                            )}
                                                                            {visitor.email && (
                                                                                <span className="inline-flex items-center gap-0.5 truncate max-w-[140px]">
                                                                                    <Mail className="w-2.5 h-2.5" />
                                                                                    {visitor.email}
                                                                                </span>
                                                                            )}
                                                                            {!visitor.phone_number && !visitor.phone && !visitor.email && visitor.ip_address && (
                                                                                <span>IP: {visitor.ip_address}</span>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                    {visitor.salesperson && (
                                                                        <span className="inline-flex items-center gap-0.5 text-emerald-700 font-semibold">
                                                                            <UserCheck className="w-2.5 h-2.5" />
                                                                            {visitor.salesperson}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {parseVisitorTags(visitor.tags).length > 0 && (
                                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                                        {parseVisitorTags(visitor.tags).slice(0, 2).map((t, idx) => (
                                                                            <span key={idx} className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[9px] font-semibold">
                                                                                {t}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2.5 text-center">
                                                        <div className="inline-flex items-center gap-1.5 bg-slate-50/50 rounded-lg p-1.5 border border-slate-100 hover:border-slate-200 transition-colors" title={visitor.device_type ? visitor.device_type.charAt(0).toUpperCase() + visitor.device_type.slice(1) : 'Unknown'}>
                                                            <div className="text-slate-500 flex-shrink-0">
                                                                {visitor.device_type === 'bot' ? <Bot className="w-3.5 h-3.5" /> :
                                                                    visitor.device_type === 'mobile' ? <Smartphone className="w-3.5 h-3.5" /> :
                                                                        visitor.device_type === 'tablet' ? <Tablet className="w-3.5 h-3.5" /> :
                                                                            <Monitor className="w-3.5 h-3.5" />}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-2 py-2.5">
                                                        <div className="flex flex-col items-end gap-1">
                                                            <div className="text-[10px] font-bold text-slate-700 leading-tight">{safeFormatDate(visitor.last_visit_at).split(' ')[0]}</div>
                                                            <div className="text-[9px] font-medium text-slate-400 leading-tight">{safeFormatDate(visitor.last_visit_at).split(' ')[1]}</div>
                                                            <div className="flex items-center gap-1 mt-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        fetchVisitorJourney(visitor);
                                                                    }}
                                                                    className="px-1.5 py-0.5 rounded border border-slate-200 bg-white hover:bg-slate-50 text-[10px] font-semibold text-slate-700 inline-flex items-center gap-0.5"
                                                                    title="Xem Hồ sơ & Lịch sử Chat"
                                                                >
                                                                    <MessageSquare className="w-2.5 h-2.5 text-[var(--color-primary)]" />
                                                                    <span>Hồ sơ</span>
                                                                </button>
                                                                {visitor.contact_id && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => openCrmContact360(e, visitor.contact_id)}
                                                                        className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-700 inline-flex items-center gap-0.5"
                                                                        title="Hồ sơ CRM 360"
                                                                    >
                                                                        <ExternalLink className="w-2.5 h-2.5" />
                                                                        <span>CRM</span>
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {isExpanded && children.map(child => (
                                                    <tr
                                                        key={child.id}
                                                        onClick={() => fetchVisitorJourney(child)}
                                                        className={`border-b border-slate-100/50 bg-slate-50/30 hover:bg-slate-50 cursor-pointer transition-colors ${selectedVisitor?.id === child.id ? 'bg-slate-100/60' : ''}`}
                                                    >
                                                        <td className="px-3 py-2 pl-10">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-[8px] border border-white">
                                                                    <Clock className="w-3 h-3" />
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <p className="text-xs font-semibold text-slate-600">Lượt truy cập khác</p>
                                                                    <p className="text-[9px] text-slate-400 font-mono">ID: {child.id.substring(0, 8)}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2 text-center">
                                                            <div className="inline-flex items-center gap-1 text-slate-400 opacity-60" title={child.device_type || 'Unknown'}>
                                                                {child.device_type === 'bot' ? <Bot className="w-2.5 h-2.5" /> :
                                                                    child.device_type === 'mobile' ? <Smartphone className="w-2.5 h-2.5" /> :
                                                                        child.device_type === 'tablet' ? <Tablet className="w-2.5 h-2.5" /> :
                                                                            <Monitor className="w-2.5 h-2.5" />}
                                                            </div>
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <div className="text-[9px] font-bold text-slate-500 leading-tight">{safeFormatDate(child.last_visit_at).split(' ')[0]}</div>
                                                            <div className="text-[8px] font-medium text-slate-400 leading-tight">{safeFormatDate(child.last_visit_at).split(' ')[1]}</div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-slate-400 text-sm">
                                            Không tìm thấy visitor nào
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.pages > 1 && (
                        <div className="p-4 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                                Trang <span className="text-slate-800">{pagination.current_page}</span> / {pagination.pages}
                                <span className="ml-2 opacity-50 font-medium lowercase">({pagination.total} entries)</span>
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => onPageChange(pagination.current_page - 1)}
                                    disabled={pagination.current_page === 1}
                                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => onPageChange(pagination.current_page + 1)}
                                    disabled={pagination.current_page === pagination.pages}
                                    className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-all shadow-sm"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Journey Details */}
                <div className="lg:col-span-3 bg-[var(--color-surface)] rounded-[20px] border border-[var(--color-border)] shadow-xs p-6 h-[800px] flex flex-col">
                    {selectedVisitor ? (
                        <>
                            <div className="flex-shrink-0 mb-6">
                                <div className="flex items-start justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <div className={`w-14 h-14 rounded-[14px] flex items-center justify-center shadow-lg border-2 border-white ${selectedVisitor.device_type === 'bot' ? 'bg-white' : (selectedVisitor.subscriber_id || selectedVisitor.zalo_user_id || selectedVisitor.email || selectedVisitor.phone) ? 'bg-[var(--color-primary)] text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                {selectedVisitor.device_type === 'bot' ? (
                                                    (() => {
                                                        const b = (selectedVisitor.browser || '').toLowerCase();
                                                        if (b.includes('google') || b.includes('lighthouse')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Google_Favicon_2025.svg/250px-Google_Favicon_2025.svg.png" className="w-8 h-8 object-contain" alt="" />;
                                                        if (b.includes('facebook') || b.includes('facebot')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/960px-2021_Facebook_icon.svg.png" className="w-8 h-8 object-contain" alt="" />;
                                                        if (b.includes('zalo')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/960px-Icon_of_Zalo.svg.png" className="w-8 h-8 object-contain" alt="" />;
                                                        if (b.includes('twitter') || b.includes(' x ')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/X_logo_2023.svg/100px-X_logo_2023.svg.png" className="w-8 h-8 object-contain" alt="" />;
                                                        if (b.includes('bing')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Bing_Fluent_Logo.svg/100px-Bing_Fluent_Logo.svg.png" className="w-8 h-8 object-contain" alt="" />;
                                                        if (b.includes('amazon') || b.includes('aws')) return <img loading="lazy" decoding="async" src="https://upload.wikimedia.org/wikipedia/commons/d/de/Amazon_icon.png" className="w-8 h-8 object-contain" alt="" />;
                                                        if (b.includes('bytespider') || b.includes('tiktok')) return <img loading="lazy" decoding="async" src="https://img.freepik.com/premium-photo/tiktok-logo_1080029-103.jpg?semt=ais_hybrid&w=740&q=80" className="w-8 h-8 object-contain" alt="" />;
                                                        if (b.includes('baidu')) return <img loading="lazy" decoding="async" src="https://cdn-icons-png-flaticon.com/512/2504/2504887.png" className="w-8 h-8 object-contain" alt="" />;
                                                        if (b.includes('mailflow')) return <div className="w-12 h-12 bg-slate-700 rounded-[14px] flex items-center justify-center text-white shadow-lg"><Globe className="w-7 h-7" /></div>;
                                                        return <Bot className="w-8 h-8 text-slate-400" />;
                                                    })()
                                                ) : selectedVisitor.avatar_url ? (
                                                    <img loading="lazy" decoding="async" src={selectedVisitor.avatar_url} alt="" className="w-full h-full object-cover rounded-[14px]" />
                                                ) : (
                                                    (selectedVisitor.email || selectedVisitor.first_name) ? (
                                                        <span className="text-xl font-bold uppercase">
                                                            {(selectedVisitor.email?.[0] || selectedVisitor.first_name?.[0] || '?')}
                                                        </span>
                                                    ) : <User className="w-7 h-7" />
                                                )}
                                            </div>
                                            {((selectedVisitor as any).is_blocked || selectedVisitor.subscriber_id || selectedVisitor.zalo_user_id || selectedVisitor.email || selectedVisitor.phone || selectedVisitor.device_type === 'bot') && (
                                                <div className={`absolute -bottom-1 -right-1 w-5 h-5 ${(selectedVisitor as any).is_blocked ? 'bg-rose-600' : (selectedVisitor.device_type === 'bot' ? 'bg-[var(--color-primary)]' : 'bg-emerald-500')} rounded-full flex items-center justify-center border-2 border-white shadow-sm`} title={(selectedVisitor as any).is_blocked ? 'Blocked' : (selectedVisitor.device_type === 'bot' ? 'Verified Bot' : 'Identified Customer')}>
                                                    {(selectedVisitor as any).is_blocked ? <ShieldAlert className="w-3 h-3 text-white" /> : (
                                                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <h4 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                                    {(selectedVisitor as any).is_blocked ? <span className="text-rose-600">Blocked User</span> : (selectedVisitor.device_type === 'bot' ? (selectedVisitor.browser || 'Bot') : (selectedVisitor.first_name && selectedVisitor.first_name !== 'Visitor' ? selectedVisitor.first_name : (selectedVisitor.email || (selectedVisitor.phone ? 'Phone Visitor' : 'Anonymous'))))}
                                                    {selectedVisitor.device_type === 'bot' ? (
                                                        <span className="text-[10px] px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-xl font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm border border-emerald-100">
                                                            <Check className="w-3 h-3" />
                                                            Super Bot Verify
                                                        </span>
                                                    ) : (selectedVisitor.sessions > 1 || selectedVisitor.visit_count > 1) && (
                                                        <span className="text-[10px] px-2.5 py-1 bg-blue-50 text-blue-600 rounded-xl font-bold uppercase tracking-wider">Khách quay lại</span>
                                                    )}
                                                </h4>
                                                {selectedVisitor.contact_id && (
                                                    <span
                                                        onClick={(e) => openCrmContact360(e, selectedVisitor.contact_id)}
                                                        className="text-[11px] font-mono text-[var(--color-text-muted)] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer"
                                                    >
                                                        CRM #{selectedVisitor.contact_id}
                                                    </span>
                                                )}
                                                <span className="text-[11px] font-mono text-[var(--color-text-muted)] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">
                                                    Web ID: {selectedVisitor.id.substring(0, 8)}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500 font-medium mt-1">
                                                <span>
                                                    {selectedVisitor.device_type === 'bot' ? ((selectedVisitor.browser || '').toLowerCase().includes('mailflow') ? 'Bot cào của mailflow này Automated Verified Crawler' : 'Automated Verified Crawler') : (selectedVisitor.email || selectedVisitor.phone_number || selectedVisitor.phone || `ID: ${selectedVisitor.id}`)}
                                                </span>
                                                {selectedVisitor.salesperson && (
                                                    <span className="text-xs text-emerald-700 font-semibold inline-flex items-center gap-1">
                                                        <UserCheck className="w-3.5 h-3.5" />
                                                        Sale: {selectedVisitor.salesperson}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {selectedVisitor.contact_id && (
                                            <button
                                                type="button"
                                                onClick={(e) => openCrmContact360(e, selectedVisitor.contact_id)}
                                                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                Hồ sơ CRM 360
                                            </button>
                                        )}
                                        <button onClick={() => setSelectedVisitor(null)} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>

                                {/* Visitor Info Cards */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-[14px]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-slate-500 p-1.5 bg-white rounded-lg shadow-sm">
                                                {selectedVisitor.device_type === 'bot' ? <Bot className="w-4 h-4" /> :
                                                    selectedVisitor.device_type === 'mobile' ? <Smartphone className="w-4 h-4" /> :
                                                        selectedVisitor.device_type === 'tablet' ? <Tablet className="w-4 h-4" /> :
                                                            <Monitor className="w-4 h-4" />}
                                            </div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Thiết bị</p>

                                        </div>
                                        <p className="text-sm font-bold text-slate-800 pl-1">
                                            {selectedVisitor.device_type ? selectedVisitor.device_type.charAt(0).toUpperCase() + selectedVisitor.device_type.slice(1) : 'Unknown'}
                                        </p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-[14px]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-slate-500 p-1.5 bg-white rounded-lg shadow-sm">
                                                {renderBrandIcon(selectedVisitor.os)}
                                            </div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">HĐH</p>
                                        </div>
                                        <p className="text-sm font-bold text-slate-800 pl-1">{selectedVisitor.os || 'Unknown'}</p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-[14px]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-slate-500 p-1.5 bg-white rounded-lg shadow-sm">
                                                {renderBrandIcon(selectedVisitor.browser)}
                                            </div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Browser</p>
                                        </div>
                                        <p className="text-sm font-bold text-slate-800 pl-1">{selectedVisitor.browser || 'Unknown'}</p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-100 p-4 rounded-[14px]">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="text-slate-500 p-1.5 bg-white rounded-lg shadow-sm">
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vị trí</p>
                                        </div>
                                        <div className="pl-1 flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-slate-800 truncate" title={selectedVisitor.city || selectedVisitor.country || 'Unknown'}>
                                                    {selectedVisitor.city || selectedVisitor.country || 'Unknown'}
                                                </p>
                                                <p className="text-[10px] font-mono text-slate-500 mt-0.5">
                                                    {selectedVisitor.ip_address || 'No IP'}
                                                </p>
                                            </div>
                                            {selectedVisitor.ip_address && selectedVisitor.device_type !== 'bot' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setIpToBlock({
                                                            ip: selectedVisitor.ip_address!,
                                                            visitorName: selectedVisitor.first_name || selectedVisitor.email || 'Visitor'
                                                        });
                                                        setIpBlockModalOpen(true);
                                                    }}
                                                    className={`p-1.5 rounded-lg transition-all flex-shrink-0 ${(selectedVisitor as any).is_blocked ? 'bg-rose-600 text-white shadow-md cursor-default' : 'bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white border border-rose-100'}`}
                                                    title={(selectedVisitor as any).is_blocked ? 'IP Đã bị chặn' : 'Chặn IP này'}
                                                >
                                                    <ShieldAlert className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 min-h-0 flex flex-col">

                                {/* Journey Stats */}
                                {visitorStats && (
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 flex-shrink-0">
                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-[14px] hover:border-slate-200 transition-colors">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Time</p>
                                            <p className="text-xl font-black text-slate-800">{formatDuration(visitorStats.total_time || 0)}</p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-[14px] hover:border-slate-200 transition-colors">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Page Views</p>
                                            <p className="text-xl font-black text-slate-800">{visitorStats.page_views || 0}</p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-[14px] hover:border-slate-200 transition-colors">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Button Clicks</p>
                                            <p className="text-xl font-black text-slate-800">{visitorStats.clicks || 0}</p>
                                        </div>
                                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-[14px] hover:border-slate-200 transition-colors">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Canvas Clicks</p>
                                            <p className="text-xl font-black text-slate-800">{visitorStats.canvas_clicks || 0}</p>
                                        </div>
                                    </div>
                                )}

                                {/* Tabs Header */}
                                <div className="flex items-center gap-6 mb-4 flex-shrink-0 border-b border-slate-100">
                                    <button
                                        onClick={() => setActiveJourneyTab('journey')}
                                        className={`pb-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeJourneyTab === 'journey' ? 'border-[var(--color-primary)] text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Hành trình hiện tại
                                    </button>
                                    <button
                                        onClick={() => setActiveJourneyTab('loyalty')}
                                        className={`pb-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${activeJourneyTab === 'loyalty' ? 'border-[var(--color-primary)] text-slate-800' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Loyalty
                                    </button>

                                    <div className="flex-1" />

                                    <button
                                        onClick={() => selectedVisitor && handleJumpToChat(selectedVisitor)}
                                        className="mr-4 pb-3 text-slate-400 hover:text-[var(--color-primary)] transition-colors flex items-center gap-1.5 text-xs font-bold group"
                                        title="Chat với khách này"
                                    >
                                        <MessageSquare className="w-3.5 h-3.5" />
                                        <span>Chat AI</span>
                                    </button>

                                    <button
                                        onClick={() => selectedVisitor && fetchVisitorJourney(selectedVisitor)}
                                        className="pb-3 text-slate-400 hover:text-[var(--color-primary)] transition-colors flex items-center gap-1.5 text-xs font-bold group"
                                        title="Tải lại hành trình"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                                        <span>Reload</span>
                                    </button>
                                </div>
                                {activeJourneyTab === 'journey' && (
                                    <>
                                        <div className="flex bg-slate-100 p-1 rounded-xl mb-4 w-fit">
                                            {[
                                                { id: 'all', label: 'All' },
                                                { id: 'pageview', label: 'View' },
                                                { id: 'click', label: 'Click' },
                                                { id: 'canvas_click', label: 'Canvas' },
                                                { id: 'other', label: 'Other' },
                                            ].map((tab) => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setJourneySubTab(tab.id as any)}
                                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${journeySubTab === tab.id
                                                        ? 'bg-white text-slate-800 shadow-sm'
                                                        : 'text-slate-400 hover:text-slate-600'
                                                        }`}
                                                >
                                                    {tab.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded">Timeline</div>
                                            {sourceInfo && (
                                                <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                                                    <span className="text-slate-400">Nguồn:</span>
                                                    <div className="flex items-center gap-1.5">
                                                        {renderSourceLogo(sourceInfo)}
                                                        <span className="font-bold text-slate-700 capitalize">{sourceInfo}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}

                                {/* Content */}
                                {activeJourneyTab === 'journey' ? (
                                    <>
                                        <>
                                            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                                                {(() => {
                                                    const filteredJourneyEvents = visitorEvents.filter(ev => {
                                                        // Filter out 0% scroll events (redundant)
                                                        if (ev.type === 'scroll' && (ev.target === '0' || ev.target === 0 || ev.target_text === '0' || ev.target_text === 0)) return false;

                                                        if (journeySubTab === 'all') return ev.type !== 'ping';
                                                        if (journeySubTab === 'other') return !['pageview', 'click', 'canvas_click', 'identify'].includes(ev.type) && ev.type !== 'ping';
                                                        return ev.type === journeySubTab;
                                                    });

                                                    if (filteredJourneyEvents.length === 0) {
                                                        return (
                                                            <div className="flex flex-col items-center justify-center py-20 text-center select-none">
                                                                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-slate-100">
                                                                    <List className="w-8 h-8 text-slate-300" />
                                                                </div>
                                                                <h5 className="text-sm font-black text-slate-700 mb-1">Không có sự kiện nào</h5>
                                                                <p className="text-xs font-medium text-slate-400 max-w-[200px] leading-relaxed">
                                                                    Chưa ghi nhận hoạt động nào tương ứng với bộ lọc hiện tại.
                                                                </p>
                                                            </div>
                                                        );
                                                    }

                                                    return filteredJourneyEvents.map((ev, idx) => (
                                                        <div key={idx} className="flex gap-4 items-start group">
                                                            <div className="mt-1 relative">
                                                                <div className="relative z-10 bg-white p-1 rounded-full border border-slate-100 shadow-sm text-slate-500 group-hover:text-[var(--color-primary)] group-hover:border-amber-100 transition-colors">
                                                                    {renderEventIcon(ev.type)}
                                                                </div>
                                                                {idx !== filteredJourneyEvents.length - 1 && (
                                                                    <div className="absolute top-8 left-1/2 -translate-x-1/2 w-px h-full bg-slate-100 -z-0" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0 bg-slate-50/50 p-4 rounded-[14px] border border-slate-100/50 hover:bg-slate-50 hover:border-slate-200 transition-colors">
                                                                <div className="flex items-start justify-between gap-3 mb-1">
                                                                    <div className="flex-1 min-w-0">
                                                                        <a
                                                                            href={ev.url || '#'}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className={`text-sm font-semibold truncate hover:underline block ${ev.type === 'scroll' ? 'text-blue-600' : 'text-slate-800'}`}
                                                                            title={ev.target_text || ev.url}
                                                                        >
                                                                            {(() => {
                                                                                const typeUC = ev.type.charAt(0).toUpperCase() + ev.type.slice(1);
                                                                                if (ev.type === 'pageview') return ev.target || ev.url || 'Page View';
                                                                                if (ev.type === 'click' || ev.type === 'canvas_click') return `Click: ${ev.target_text || ev.element_info || 'Unknown Location'}`;
                                                                                if (ev.type === 'select') return `Select: "${ev.target_text || 'Unknown'}"`;
                                                                                if (ev.type === 'copy') return `Copy: "${ev.target_text || 'Unknown'}"`;
                                                                                if (ev.type === 'scroll') return `Scroll - ${ev.meta?.percent || ev.target}%`;
                                                                                if (ev.type === 'form') return ev.target_text || 'Form submission';
                                                                                return typeUC;
                                                                            })()}
                                                                        </a>
                                                                        {(ev.type !== 'pageview' && (ev.page_title || ev.url)) && (
                                                                            <a
                                                                                href={ev.url || '#'}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-[10px] font-bold text-slate-500 hover:text-blue-600 uppercase tracking-wider mt-0.5 flex items-center gap-1 transition-colors"
                                                                            >
                                                                                <Globe className="w-3 h-3" />
                                                                                <span className="truncate max-w-[500px]">{ev.page_title || ev.url}</span>
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                    {ev.duration > 0 && (
                                                                        <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full whitespace-nowrap">
                                                                            <RefreshCw className="w-3 h-3" />
                                                                            {formatDuration(ev.duration)}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-400 font-medium">
                                                                    {safeFormatDate(ev.timestamp || ev.created_at || ev.loaded_at)}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>

                                            {journeySubTab === 'all' && (
                                                <div className="flex-shrink-0 pt-4 border-t border-slate-50 mt-4">
                                                    <details className="group">
                                                        <summary className="text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-800 flex items-center gap-2 select-none">
                                                            <span>Xem thêm sự kiện ({visitorEvents.filter(ev => ['scroll', 'ping'].includes(ev.type)).length.toLocaleString()})</span>
                                                        </summary>
                                                        <div className="mt-3 space-y-2 max-h-[150px] overflow-y-auto pl-2 border-l-2 border-slate-100 ml-1">
                                                            {visitorEvents
                                                                .filter(ev => ['scroll', 'ping'].includes(ev.type))
                                                                .filter(ev => !(ev.type === 'scroll' && (ev.target_text === '0' || ev.target_text === 0)))
                                                                .map((ev, idx) => (
                                                                    <div key={idx} className="text-xs text-slate-400 flex flex-col gap-1 py-1 border-b border-slate-50 last:border-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                                                                            <span className="uppercase font-bold text-[10px] tracking-wider w-12">{ev.type}</span>
                                                                            <span className="text-slate-300">|</span>
                                                                            <span className="font-mono text-[10px]">{safeFormatDate(ev.timestamp)}</span>
                                                                        </div>
                                                                        {ev.type === 'scroll' && (
                                                                            <div className="pl-3.5 text-[10px] font-medium text-slate-500">
                                                                                Cuộn <span className="text-emerald-600 font-bold">{ev.meta?.percent || ev.target || '??'}%</span> tại <span className="italic">"{ev.page_title || ev.url || 'Trang không tên'}"</span>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ))}
                                                        </div>
                                                    </details>
                                                </div>
                                            )}
                                        </>
                                    </>
                                ) : (
                                    <div className="flex-1 overflow-y-auto pr-2">
                                        <div className="space-y-6">
                                            {/* Retention / Frequency */}
                                            <div className="relative overflow-hidden bg-white p-5 rounded-[20px] border border-slate-200/50 shadow-lg shadow-slate-100/50">
                                                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-50 to-slate-100 rounded-full blur-3xl opacity-30" />
                                                <div className="relative">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <div className="p-2 bg-slate-50 text-slate-500 border border-slate-100 rounded-xl shadow-sm">
                                                            <Repeat className="w-4 h-4 text-slate-500" />
                                                        </div>
                                                        <h5 className="text-sm font-bold text-slate-800">Mức độ quay lại</h5>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div className="group relative bg-white/80 backdrop-blur-sm p-4 rounded-[14px] border border-slate-200/50 hover:border-emerald-200 hover:shadow-md transition-all duration-300">
                                                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            <p className="relative text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Tổng phiên</p>
                                                            <p className="relative text-2xl font-black text-slate-800">{(selectedVisitor.sessions || 1).toLocaleString()}</p>
                                                        </div>
                                                        <div className="group relative bg-white/80 backdrop-blur-sm p-4 rounded-[14px] border border-slate-200/50 hover:border-emerald-200 hover:shadow-md transition-all duration-300">
                                                            <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            <p className="relative text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">Tần suất</p>
                                                            <p className="relative text-lg font-black text-slate-800">
                                                                {(selectedVisitor.sessions && selectedVisitor.sessions > 1) ? 'Thường xuyên' : 'Mới'}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Engagement */}
                                            <div className="relative overflow-hidden bg-gradient-to-br from-white to-slate-50 p-5 rounded-[20px] border border-slate-200/50 shadow-lg shadow-slate-100/50">
                                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-emerald-50 to-cyan-50 rounded-full blur-3xl opacity-30" />
                                                <div className="relative">
                                                    <div className="flex items-center gap-2 mb-4">
                                                        <div className="p-2 bg-gradient-to-br from-emerald-500 to-cyan-600 rounded-xl shadow-lg shadow-emerald-200">
                                                            <Clock className="w-4 h-4 text-white" />
                                                        </div>
                                                        <h5 className="text-sm font-bold text-slate-800">Tương tác theo Thời gian</h5>
                                                    </div>
                                                    <div className="space-y-2.5">
                                                        <div className="group flex justify-between items-center p-3.5 bg-white/80 backdrop-blur-sm rounded-[14px] border border-slate-200/50 hover:border-emerald-200 hover:shadow-md transition-all duration-300">
                                                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/50 to-transparent rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            <span className="relative text-xs font-semibold text-slate-600">Lần đầu truy cập</span>
                                                            <span className="relative text-xs font-black text-slate-800">{safeFormatDate(selectedVisitor.first_visit_at)}</span>
                                                        </div>
                                                        <div className="group flex justify-between items-center p-3.5 bg-white/80 backdrop-blur-sm rounded-[14px] border border-slate-200/50 hover:border-cyan-200 hover:shadow-md transition-all duration-300">
                                                            <div className="absolute inset-0 bg-gradient-to-r from-cyan-50/50 to-transparent rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            <span className="relative text-xs font-semibold text-slate-600">Truy cập gần nhất</span>
                                                            <span className="relative text-xs font-black text-slate-800">{safeFormatDate(selectedVisitor.last_visit_at)}</span>
                                                        </div>
                                                        <div className="group flex justify-between items-center p-3.5 bg-white/80 backdrop-blur-sm rounded-[14px] border border-slate-200/50 hover:border-emerald-200 hover:shadow-md transition-all duration-300">
                                                            <div className="absolute inset-0 bg-gradient-to-r from-emerald-50/50 to-transparent rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            <span className="relative text-xs font-semibold text-slate-600">Tổng Thời gian onsite</span>
                                                            <span className="relative text-xs font-black text-emerald-600">{formatDuration(visitorStats?.total_time || 0)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400">
                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <User className="w-10 h-10 text-slate-300" />
                            </div>
                            <p className="font-medium text-slate-600">Chưa chọn Visitor nào</p>
                            <p className="text-sm text-slate-400 max-w-[200px] text-center mt-2">Chọn một visitor từ danh sách bên trái để xem chi tiết hành trình</p>
                        </div>
                    )}
                </div>
            </div>
            {/* Block IP Confirmation Modal */}
            <ConfirmModal
                isOpen={ipBlockModalOpen}
                onClose={() => setIpBlockModalOpen(false)}
                onConfirm={async () => {
                    if (!ipToBlock) return;
                    setIsBlocking(true);
                    try {
                        const res = await api.post('web_blacklist?action=add', {
                            ip: ipToBlock.ip,
                            reason: blockReason
                        });
                        if (res.success) {
                            toast.success('Đã chặn IP thành công');
                            setIpBlockModalOpen(false);
                            fetchVisitors();
                        } else {
                            toast.error(res.message || 'Lỗi khi chặn IP');
                        }
                    } catch (e) {
                        toast.error('Lỗi kết nối máy chủ');
                    } finally {
                        setIsBlocking(false);
                    }
                }}
                title="Xác nhận chặn IP"
                isLoading={isBlocking}
                variant="danger"
                confirmLabel="Xác nhận chặn"
                message={
                    <div className="space-y-4">
                        <div className="p-4 bg-rose-50 rounded-[14px] border border-rose-100">
                            <p className="text-sm font-medium text-rose-800 leading-relaxed">
                                Bạn đang thực hiện chặn địa chỉ IP <span className="font-black underline">{ipToBlock?.ip}</span> của <span className="font-black">{ipToBlock?.visitorName}</span>.
                            </p>
                            <p className="text-[10px] text-rose-600 mt-2 font-bold uppercase tracking-tight">
                                Lưu ý: Mọi lưu lượng từ IP này sẽ bị từ chối (trừ Googlebot).
                            </p>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Lý do chặn (không bắt buộc)</label>
                            <textarea
                                className="w-full bg-slate-50 border border-slate-200 rounded-[14px] p-4 text-sm focus:outline-none focus:ring-4 focus:ring-rose-500/10 focus:border-rose-300 transition-all min-h-[100px] resize-none"
                                placeholder="Ví dụ: Spam click, Attack detection..."
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                            />
                        </div>
                    </div>
                }
            />
        </TabTransition>
    );
};

// Internal sub-component for Blocked IPs
const BlockedIPsContent: React.FC<{ property: WebProperty }> = ({ property }) => {
    const [ips, setIps] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchBlocked = async () => {
        setLoading(true);
        try {
            const res = await api.get<any[]>('web_tracking?action=blacklist');
            if (res.success) setIps(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBlocked();
    }, []);

    const unblockIP = async (id: number) => {
        try {
            const res = await api.delete(`web_blacklist?action=delete&id=${id}`);
            if (res.success) {
                toast.success('Đã bỏ chặn IP');
                fetchBlocked();
            }
        } catch (e: any) {
            toast.error(e.message || 'Lỗi');
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-[var(--color-surface)] p-6 rounded-[20px] border border-[var(--color-border)] shadow-xs">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Danh sách IP Đã Chặn</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Security & Spam Protection</p>
                    </div>
                </div>
                <button
                    onClick={fetchBlocked}
                    className="p-2.5 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100 group"
                    title="Làm mới"
                >
                    <RefreshCw className="w-4 h-4 text-slate-400 group-hover:text-[var(--color-primary)] group-hover:rotate-180 transition-transform duration-500" />
                </button>
            </div>

            {/* Mechanism Explanation */}
            <div className="mb-6 bg-slate-50/80 rounded-[14px] p-4 border border-slate-100">
                <div className="flex gap-3">
                    <div className="mt-0.5">
                        <ShieldCheck className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-xs text-slate-600 leading-relaxed">
                        <span className="font-bold text-slate-700">Cơ chế hoạt động:</span> Khi bạn chặn một địa chỉ IP, hệ thống sẽ từ chối mọi truy cập từ IP đó vào website.
                        Tuy nhiên, các <span className="font-semibold text-emerald-600">Google Bot</span> và các bot tìm kiếm được xác minh khác vẫn sẽ được phép truy cập để đảm bảo SEO không bị ảnh hưởng.
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                {loading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                        <div key={`blocked-skeleton-${idx}`} className="flex items-center justify-between p-3 pl-4 bg-white border border-slate-100 rounded-xl">
                            <div className="flex items-center gap-4 min-w-0 flex-1">
                                <div className="w-8 h-8 rounded-lg animate-pulse bg-slate-200/70 dark:bg-white/[0.06] shrink-0" />
                                <div className="space-y-1.5 flex-1">
                                    <div className="h-3.5 w-32 rounded-[6px] animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                                    <div className="h-2.5 w-48 rounded-[6px] animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-lg animate-pulse bg-slate-200/70 dark:bg-white/[0.06]" />
                        </div>
                    ))
                ) : ips.length > 0 ? (
                    ips.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3 pl-4 bg-white border border-slate-100 rounded-xl hover:border-rose-200 hover:shadow-sm transition-all group">
                            <div className="flex items-center gap-4 min-w-0">
                                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100 shrink-0">
                                    <Globe className="w-4 h-4 text-slate-400" />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="text-sm font-bold text-slate-800 font-mono">{item.ip_address}</div>
                                        <div className="text-[10px] text-slate-400 font-medium">
                                            • {new Date(item.created_at).toLocaleString('vi-VN')}
                                        </div>
                                    </div>
                                    {item.reason && (
                                        <div className="text-[10px] text-rose-500 truncate max-w-[300px] mt-0.5 font-medium">
                                            Reason: {item.reason}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => unblockIP(item.id)}
                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                title="Bỏ chặn"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))
                ) : (
                    <div className="py-12 text-center bg-slate-50/50 rounded-[14px] border border-dashed border-slate-200">
                        <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm border border-slate-100">
                            <ShieldCheck className="w-6 h-6 text-slate-300" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-700">Chưa có IP bị chặn</h4>
                        <p className="text-slate-400 text-xs mt-1">Website của bạn đang hoạt động bình thường</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VisitorsTab;
