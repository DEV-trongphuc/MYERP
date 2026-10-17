import * as React from 'react';
import { useEffect, useState, useMemo } from 'react';
import { api } from '../../services/storageAdapter';
import {
    Users, ArrowLeft, RefreshCw, Filter, Check, Minus,
    BadgeCheck, Star, Globe as Facebook, Clock, MessageCircle, ExternalLink, Phone, Mail, UserCheck
} from 'lucide-react';
import Button from '../common/Button';
import StatCard from '../common/StatCard';
import Pagination from '../common/Pagination';
import Skeleton from '../common/Skeleton';
import { Avatar } from '../../../ui/Avatar';
import { MetaCustomerProfileModal } from './MetaCustomerProfileModal';
import {
    AudienceEmptyState,
    Panel,
    ROW_CLASS,
    SearchBox,
    TD_CLASS,
    TH_CLASS,
    THEAD_CLASS,
    Toolbar
} from '../audience/AudienceUi';

const openCrmContact360 = (arg1: any, arg2?: any) => {
    if (arg1 && typeof arg1.stopPropagation === 'function') arg1.stopPropagation();
    if (arg2 && typeof arg2.stopPropagation === 'function') arg2.stopPropagation();
    const rawId = (arg1 && typeof arg1.stopPropagation === 'function') ? arg2 : arg1;
    const id = Number(rawId);
    if (!id || Number.isNaN(id)) return;
    window.dispatchEvent(new CustomEvent('open-customer-drawer', { detail: { id, initialTab: 'journey360' } }));
};

interface PaginationState {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const formatTimeAgoShort = (date: string) => {
    if (!date) return 'Vừa xong';
    const now = new Date();
    const then = new Date(date);
    const diff = now.getTime() - then.getTime();
    if (diff < 60000) return 'Vừa xong';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} phút trước`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} giờ trước`;
    const days = Math.floor(diff / 86400000);
    if (days < 30) return `${days} ngày trước`;
    return then.toLocaleDateString('vi-VN');
};

const parseTags = (rawTags: any): string[] => {
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

const MetaCustomers: React.FC = () => {
    const [pages, setPages] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [activePage, setActivePage] = useState<any | null>(null);
    const [subscribers, setSubscribers] = useState<any[]>([]);
    const [loadingSubs, setLoadingSubs] = useState(false);
    const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: 20, total: 0, totalPages: 1 });
    const [itemsPerPage] = useState(20);

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [filterVerify, setFilterVerify] = useState<'all' | 'verified' | 'unverified'>('all');
    const [filterPoints, setFilterPoints] = useState<'all' | 'low' | 'med' | 'high'>('all');
    const [filterDataType, setFilterDataType] = useState<'all' | 'synced' | 'unsynced'>('all');

    // Stats State
    const [stats, setStats] = useState<any>(null);

    // Selection & Profile Modal State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const filterRef = React.useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setIsFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchPages = React.useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const res = await api.get<any[]>('meta_config', {}, { signal });
            if (!signal?.aborted && res.success && Array.isArray(res.data)) {
                setPages(res.data);
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetchPages(controller.signal);
        return () => controller.abort();
    }, [fetchPages]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPagination(prev => ({ ...prev, page: 1 }));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchSubscribers = React.useCallback(async (pageId: string, page = 1, signal?: AbortSignal) => {
        setLoadingSubs(true);
        const offset = (page - 1) * itemsPerPage;

        let filterValue = 'all';
        if (filterVerify === 'verified') filterValue = 'identified';

        const params = new URLSearchParams({
            route: 'subscribers',
            page_id: pageId,
            limit: itemsPerPage.toString(),
            offset: offset.toString(),
            search: debouncedSearch,
            filter: filterDataType !== 'all' ? filterDataType : filterValue
        });

        try {
            const res = await api.get<any>(`meta_customers?${params.toString()}`, {}, { signal });
            if (!signal?.aborted && res.success && res.data) {
                setSubscribers(res.data.customers || []);
                setPagination({
                    page: page,
                    limit: itemsPerPage,
                    total: res.data.total || 0,
                    totalPages: Math.max(1, Math.ceil((res.data.total || 0) / itemsPerPage))
                });
                setStats(res.data.counts || null);
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
        } finally {
            if (!signal?.aborted) setLoadingSubs(false);
        }
    }, [itemsPerPage, debouncedSearch, filterVerify, filterDataType]);

    useEffect(() => {
        if (!activePage?.page_id) return;
        const controller = new AbortController();
        fetchSubscribers(activePage.page_id, pagination.page, controller.signal);
        return () => controller.abort();
    }, [activePage?.page_id, pagination.page, fetchSubscribers]);

    const handlePageClick = (page: any) => {
        setActivePage(page);
        setPagination({ page: 1, limit: itemsPerPage, total: 0, totalPages: 1 });
        setSelectedIds([]);
    };

    const handleBack = () => {
        setActivePage(null);
        setSubscribers([]);
        setFilterVerify('all');
        setFilterPoints('all');
        setFilterDataType('all');
        setSearchQuery('');
        setPagination({ page: 1, limit: 20, total: 0, totalPages: 1 });
        setSelectedIds([]);
        setSelectedUserId(null);
    };

    const filteredSubscribers = useMemo(() => {
        if (!Array.isArray(subscribers)) return [];
        return subscribers.filter(sub => {
            const score = Number(sub.lead_score || 0);
            if (filterPoints === 'low' && score >= 10) return false;
            if (filterPoints === 'med' && (score < 10 || score >= 50)) return false;
            if (filterPoints === 'high' && score < 50) return false;
            return true;
        });
    }, [subscribers, filterPoints]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredSubscribers.map(s => s.id));
        } else {
            setSelectedIds([]);
        }
    };

    const toggleSelect = (id: string) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    if (activePage) {
        const allSelected = filteredSubscribers.length > 0 && selectedIds.length >= filteredSubscribers.length;
        const activeFilterCount = (filterVerify !== 'all' ? 1 : 0) + (filterPoints !== 'all' ? 1 : 0) + (filterDataType !== 'all' ? 1 : 0);
        const isFirstLoad = loadingSubs && subscribers.length === 0;

        return (
            <div className="p-4 flex flex-col gap-4">
                {stats && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <StatCard title="Tổng khách hàng" value={(stats.all || 0).toLocaleString('vi-VN')} icon={<Users />} color="var(--color-primary)" />
                        <StatCard title="Đã định danh" value={(stats.identified || 0).toLocaleString('vi-VN')} icon={<BadgeCheck />} color="#10b981" />
                        <StatCard title="Chờ xử lý" value={(stats.unsynced || 0).toLocaleString('vi-VN')} icon={<RefreshCw />} color="#f59e0b" />
                    </div>
                )}

                <Panel>
                    <Toolbar>
                        <button
                            type="button"
                            onClick={handleBack}
                            className="h-[38px] inline-flex items-center gap-1.5 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>{activePage.page_name || activePage.name || 'Fanpage'}</span>
                        </button>

                        <SearchBox
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Tìm theo tên, email, PSID..."
                            className="w-64"
                        />

                        <div className="relative" ref={filterRef}>
                            <button
                                type="button"
                                onClick={() => setIsFilterOpen(!isFilterOpen)}
                                className={`h-[38px] inline-flex items-center gap-2 px-3 rounded-[var(--radius-md)] border text-xs font-semibold transition-colors ${isFilterOpen || activeFilterCount > 0
                                    ? 'border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary-light)]'
                                    : 'border-[var(--color-border)] text-[var(--color-text)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]'
                                    }`}
                            >
                                <Filter className="w-4 h-4" />
                                <span>Bộ lọc</span>
                                {activeFilterCount > 0 && (
                                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-primary)] text-white text-[10px] font-bold flex items-center justify-center">
                                        {activeFilterCount}
                                    </span>
                                )}
                            </button>

                            {isFilterOpen && (
                                <div className="absolute left-0 mt-2 w-72 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] shadow-xl p-4 z-40 space-y-4">
                                    <div>
                                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2 block">Trạng thái định danh</label>
                                        <div className="space-y-1">
                                            {[
                                                { id: 'all', label: 'Tất cả đối tượng' },
                                                { id: 'verified', label: 'Đã định danh (Linked)' },
                                                { id: 'unverified', label: 'Chưa định danh' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setFilterVerify(opt.id as any)}
                                                    className={`w-full px-3 py-2 rounded-[var(--radius-md)] text-xs font-medium text-left transition-colors flex items-center justify-between ${filterVerify === opt.id ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-semibold' : 'text-[var(--color-text-light)] hover:bg-[var(--color-bg)]'}`}
                                                >
                                                    {opt.label}
                                                    {filterVerify === opt.id && <Check className="w-3.5 h-3.5" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="h-px bg-[var(--color-border-light)]" />

                                    <div>
                                        <label className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wide mb-2 block">Mức điểm Lead</label>
                                        <div className="space-y-1">
                                            {[
                                                { id: 'all', label: 'Tất cả mức điểm' },
                                                { id: 'low', label: 'Dưới 10 (Mới)' },
                                                { id: 'med', label: '10 - 50 (Tiềm năng)' },
                                                { id: 'high', label: 'Trên 50 (Khách VIP)' }
                                            ].map(opt => (
                                                <button
                                                    key={opt.id}
                                                    type="button"
                                                    onClick={() => setFilterPoints(opt.id as any)}
                                                    className={`w-full px-3 py-2 rounded-[var(--radius-md)] text-xs font-medium text-left transition-colors flex items-center justify-between ${filterPoints === opt.id ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)] font-semibold' : 'text-[var(--color-text-light)] hover:bg-[var(--color-bg)]'}`}
                                                >
                                                    <span className="flex items-center gap-1.5">
                                                        {opt.id !== 'all' && <Star className={`w-3 h-3 ${filterPoints === opt.id ? 'fill-current' : ''}`} />}
                                                        {opt.label}
                                                    </span>
                                                    {filterPoints === opt.id && <Check className="w-3.5 h-3.5" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {activeFilterCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => { setFilterVerify('all'); setFilterPoints('all'); setFilterDataType('all'); }}
                                            className="w-full py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-[var(--radius-md)] transition-colors"
                                        >
                                            Xóa bộ lọc
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <span className="h-[38px] inline-flex items-center px-3 rounded-[var(--radius-md)] bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-medium text-[var(--color-text-light)] whitespace-nowrap">
                                Tổng cộng: <b className="ml-1 font-bold text-[var(--color-text)] tabular-nums">{(pagination.total || 0).toLocaleString('vi-VN')}</b>
                            </span>
                        </div>
                    </Toolbar>

                    <div className="overflow-x-auto transition-opacity">
                        <table className="w-full text-sm border-collapse">
                            <thead className={THEAD_CLASS}>
                                <tr className="border-b border-[var(--color-border)]">
                                    <th className="pl-4 pr-2 py-3 w-10">
                                        <button
                                            type="button"
                                            onClick={() => handleSelectAll(!allSelected)}
                                            disabled={filteredSubscribers.length === 0}
                                            className={`w-4 h-4 rounded border flex items-center justify-center ${allSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
                                        >
                                            {allSelected && <Check className="w-3 h-3 text-white" />}
                                        </button>
                                    </th>
                                    <th className={TH_CLASS}>Khách hàng</th>
                                    <th className={TH_CLASS}>Liên hệ / Sale phụ trách</th>
                                    <th className={TH_CLASS}>Trạng thái</th>
                                    <th className={TH_CLASS}>Hoạt động gần nhất</th>
                                    <th className={`${TH_CLASS} text-right`}>Điểm Lead</th>
                                    <th className={TH_CLASS}>Ngày tham gia</th>
                                    <th className={`${TH_CLASS} text-right`}>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingSubs && Array.from({ length: 6 }).map((_, i) => (
                                    <tr key={i} className="border-b border-[var(--color-border-light)]">
                                        <td className="pl-4 pr-2 py-3"><Skeleton variant="rounded" width={16} height={16} /></td>
                                        <td className={TD_CLASS}>
                                            <div className="flex items-center gap-3">
                                                <Skeleton variant="circular" width={32} height={32} />
                                                <Skeleton variant="text" width={120} height={14} />
                                            </div>
                                        </td>
                                        <td className={TD_CLASS}><Skeleton variant="text" width={110} height={14} /></td>
                                        <td className={TD_CLASS}><Skeleton variant="rounded" width={64} height={20} /></td>
                                        <td className={TD_CLASS}><Skeleton variant="text" width={90} height={12} /></td>
                                        <td className={`${TD_CLASS} text-right`}><Skeleton variant="text" width={32} height={14} className="ml-auto" /></td>
                                        <td className={TD_CLASS}><Skeleton variant="text" width={70} height={12} /></td>
                                        <td className="px-4 py-3" />
                                    </tr>
                                ))}

                                {!loadingSubs && filteredSubscribers.map(sub => {
                                    const isSelected = selectedIds.includes(sub.id);
                                    const displayName = sub.name || sub.display_name || 'Facebook User';
                                    const contactId = sub.contact_id || sub.myerp_contact_id;
                                    const phoneVal = sub.phone_number || sub.phone || '';
                                    const emailVal = sub.manual_email || sub.email || '';
                                    const tagsList = parseTags(sub.tags);

                                    return (
                                        <tr
                                            key={sub.id}
                                            className={`${ROW_CLASS} cursor-pointer ${isSelected ? 'bg-[var(--color-primary-light)]' : ''}`}
                                            onClick={() => setSelectedUserId(String(sub.id))}
                                        >
                                            <td className="pl-4 pr-2 py-3 w-10" onClick={e => { e.stopPropagation(); toggleSelect(sub.id); }}>
                                                <span
                                                    role="checkbox"
                                                    aria-checked={isSelected}
                                                    className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-[var(--color-primary)] border-[var(--color-primary)]' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}
                                                >
                                                    {isSelected && <Check className="w-3 h-3 text-white" />}
                                                </span>
                                            </td>
                                            <td className={TD_CLASS}>
                                                <div className="flex items-center gap-3">
                                                    <Avatar
                                                        name={displayName}
                                                        src={sub.avatar || sub.profile_pic}
                                                        size={32}
                                                        className="shrink-0"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="text-[13px] font-semibold text-[var(--color-text)] flex items-center gap-1 truncate">
                                                            {displayName}
                                                            {(emailVal || phoneVal) && <BadgeCheck className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                                                        </div>
                                                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                                            {contactId && (
                                                                <span
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openCrmContact360(contactId);
                                                                    }}
                                                                    className="text-[11px] font-mono text-[var(--color-text-muted)] bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                                                                    title="Mở Hồ sơ CRM 360"
                                                                >
                                                                    CRM #{contactId}
                                                                </span>
                                                            )}
                                                            <span className="text-[11px] font-mono text-[var(--color-text-muted)] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 truncate max-w-[160px]">
                                                                PSID: {String(sub.psid || '')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={TD_CLASS}>
                                                <div className="flex flex-col gap-1 min-w-[140px]">
                                                    {(phoneVal || emailVal) ? (
                                                        <div className="flex flex-col gap-0.5 text-xs text-[var(--color-text)]">
                                                            {phoneVal && (
                                                                <span className="inline-flex items-center gap-1 font-medium">
                                                                    <Phone className="w-3 h-3 text-[var(--color-text-muted)]" />
                                                                    {phoneVal}
                                                                </span>
                                                            )}
                                                            {emailVal && (
                                                                <span className="inline-flex items-center gap-1 text-[var(--color-text-muted)] truncate max-w-[180px]">
                                                                    <Mail className="w-3 h-3 shrink-0" />
                                                                    {emailVal}
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-[var(--color-text-muted)]">Chưa có SĐT/Email</span>
                                                    )}
                                                    {sub.salesperson && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600 font-medium">
                                                            <UserCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                                            Sale: <strong className="text-slate-800">{sub.salesperson}</strong>
                                                        </span>
                                                    )}
                                                    {tagsList.length > 0 && (
                                                        <div className="flex flex-wrap gap-1 mt-0.5">
                                                            {tagsList.slice(0, 3).map((t, idx) => (
                                                                <span key={idx} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-semibold">
                                                                    {t}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className={TD_CLASS}>
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${sub.is_synced ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-[var(--color-bg)] text-[var(--color-text-light)] border-[var(--color-border)]'}`}>
                                                    {sub.is_synced ? 'Active' : 'Visitor'}
                                                </span>
                                            </td>
                                            <td className={TD_CLASS}>
                                                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-light)]">
                                                    <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                                    {formatTimeAgoShort(sub.last_active_at || sub.updated_at)}
                                                </span>
                                            </td>
                                            <td className={`${TD_CLASS} text-right`}>
                                                <span className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
                                                    {sub.lead_score || 0}
                                                </span>
                                            </td>
                                            <td className={TD_CLASS}>
                                                <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                                                    {(sub.created_at || sub.joined_at) ? new Date(sub.created_at || sub.joined_at).toLocaleDateString('vi-VN') : '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="inline-flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedUserId(String(sub.id));
                                                        }}
                                                        className="px-2.5 py-1 rounded-md border border-[var(--color-border)] bg-white hover:bg-slate-50 text-xs font-semibold text-[var(--color-text)] inline-flex items-center gap-1 transition-colors cursor-pointer"
                                                        title="Xem Hồ sơ & Lịch sử Chat"
                                                    >
                                                        <MessageCircle className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                                                        <span>Hồ sơ & Chat</span>
                                                    </button>
                                                    {contactId && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openCrmContact360(contactId);
                                                            }}
                                                            className="px-2.5 py-1 rounded-md border border-slate-200 bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 transition-colors cursor-pointer"
                                                            title="Hồ sơ CRM 360"
                                                        >
                                                            <ExternalLink className="w-3 h-3" />
                                                            <span>CRM 360</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {!loadingSubs && filteredSubscribers.length === 0 && (
                                    <tr>
                                        <td colSpan={8}>
                                            <AudienceEmptyState
                                                icon={Users}
                                                title="Chưa có khách hàng Messenger nào"
                                                description="Khách hàng nhắn tin qua Fanpage sẽ tự động đồng bộ về đây."
                                            />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="border-t border-[var(--color-border-light)] px-4">
                        <Pagination
                            currentPage={pagination.page}
                            totalPages={pagination.totalPages}
                            totalCount={pagination.total}
                            itemsPerPage={itemsPerPage}
                            onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))}
                        />
                    </div>
                </Panel>

                {selectedUserId && (
                    <MetaCustomerProfileModal
                        subscriberId={selectedUserId}
                        userId={selectedUserId}
                        isOpen={!!selectedUserId}
                        onClose={() => setSelectedUserId(null)}
                        onUpdate={() => fetchSubscribers(activePage.page_id, pagination.page)}
                        onUserUpdated={() => fetchSubscribers(activePage.page_id, pagination.page)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-bg)] border border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                    <img src="https://upload.wikimedia.org/wikipedia/commons/b/b8/2021_Facebook_icon.svg" alt="Facebook" className="w-8 h-8 object-contain shrink-0" />
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--color-text)]">Danh sách khách hàng Messenger</h3>
                        <p className="text-xs text-[var(--color-text-muted)]">Tự động đồng bộ từ Facebook Pages đã kết nối</p>
                    </div>
                </div>
                <Button variant="outline" icon={RefreshCw} size="sm" onClick={() => fetchPages()}>
                    Đồng bộ Pages
                </Button>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="bg-[var(--color-surface)] p-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] space-y-4">
                            <div className="flex items-start justify-between">
                                <Skeleton variant="rounded" width={40} height={40} />
                                <Skeleton variant="rounded" width={70} height={20} />
                            </div>
                            <div className="space-y-2">
                                <Skeleton variant="text" width="70%" height={16} />
                                <Skeleton variant="text" width="40%" height={12} />
                            </div>
                            <div className="pt-3 border-t border-[var(--color-border-light)] flex items-center justify-between">
                                <Skeleton variant="text" width={60} height={20} />
                                <Skeleton variant="circular" width={32} height={32} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : !Array.isArray(pages) || pages.length === 0 ? (
                <AudienceEmptyState
                    icon={Facebook}
                    title="Chưa có kết nối Fanpage nào"
                    description="Kết nối Facebook Fanpage để đồng bộ khách hàng nhắn tin qua Messenger."
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pages.map(page => (
                        <div
                            key={page.id}
                            onClick={() => handlePageClick(page)}
                            className="bg-[var(--color-surface)] p-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary)] transition-all cursor-pointer flex flex-col justify-between group"
                        >
                            <div>
                                <div className="flex items-start justify-between mb-4">
                                    <Avatar
                                        name={page.page_name || page.name || 'Meta Page'}
                                        src={page.avatar_url}
                                        size={40}
                                    />
                                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded-full flex items-center gap-1.5 border border-emerald-200">
                                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Live Sync
                                    </span>
                                </div>

                                <div className="mb-4">
                                    <h4 className="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">{page.page_name || page.name}</h4>
                                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1">
                                        <Minus className="w-3 h-3" /> Page ID: {page.page_id}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-[var(--color-border-light)] pt-3">
                                <div>
                                    <span className="text-[11px] font-medium text-[var(--color-text-muted)] block">Khách hàng Meta</span>
                                    <span className="text-lg font-extrabold tabular-nums text-[var(--color-text)]">{(page.subscriber_count || 0).toLocaleString('vi-VN')}</span>
                                </div>
                                <div className="w-8 h-8 bg-[var(--color-bg)] text-[var(--color-text-muted)] rounded-full group-hover:bg-[var(--color-primary-light)] group-hover:text-[var(--color-primary)] transition-colors flex items-center justify-center shrink-0">
                                    <ArrowLeft className="w-4 h-4 rotate-180" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MetaCustomers;
