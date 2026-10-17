import * as React from 'react';
import { useEffect, useState } from 'react';
import { api } from '../../services/storageAdapter';
import {
    Users, ArrowLeft, RefreshCw, Send, Check, Minus,
    Heart, BadgeCheck, MessageCircle, ArrowRight, Clock, ExternalLink, Phone, Mail, UserCheck
} from 'lucide-react';
import Button from '../common/Button';
import StatCard from '../common/StatCard';
import Pagination from '../common/Pagination';
import Skeleton from '../common/Skeleton';
import { ZaloUserProfileModal } from './ZaloUserProfileModal';
import ZaloSendZBSModal from './ZaloSendZBSModal';
import { Avatar } from '../../../ui/Avatar';
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

const ZaloAudienceTab: React.FC = () => {
    const [lists, setLists] = useState<any[]>([]);
    const [oas, setOAs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeList, setActiveList] = useState<any | null>(null);
    const [subscribers, setSubscribers] = useState<any[]>([]);
    const [loadingSubs, setLoadingSubs] = useState(false);
    const [pagination, setPagination] = useState<PaginationState>({ page: 1, limit: 20, total: 0, totalPages: 1 });
    const [itemsPerPage] = useState(20);

    // Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
    const [isSendZBSOpen, setIsSendZBSOpen] = useState(false);

    const fetchLists = React.useCallback(async (signal?: AbortSignal) => {
        setLoading(true);
        try {
            const [resLists, resOAs] = await Promise.all([
                api.get<any[]>('zalo_audience?route=lists', {}, { signal }),
                api.get<any[]>('zalo_oa', {}, { signal })
            ]);
            if (signal?.aborted) return;
            if (resLists.success && Array.isArray(resLists.data)) {
                setLists(resLists.data);
            }
            if (resOAs.success && Array.isArray(resOAs.data)) {
                setOAs(resOAs.data);
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
        } finally {
            if (!signal?.aborted) setLoading(false);
        }
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetchLists(controller.signal);
        return () => controller.abort();
    }, [fetchLists]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPagination(prev => ({ ...prev, page: 1 }));
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const fetchSubscribers = React.useCallback(async (listId: string, page = 1, signal?: AbortSignal) => {
        setLoadingSubs(true);
        const params = new URLSearchParams({
            route: 'subscribers',
            list_id: listId,
            page: page.toString(),
            limit: itemsPerPage.toString(),
            search: debouncedSearch
        });

        try {
            const res = await api.get<any>(`zalo_audience?${params.toString()}`, {}, { signal });
            if (!signal?.aborted && res.success && Array.isArray(res.data)) {
                setSubscribers(res.data);
                const meta = res.meta || {};
                setPagination({
                    page: page,
                    limit: itemsPerPage,
                    total: meta.total || 0,
                    totalPages: Math.max(1, Math.ceil((meta.total || 0) / itemsPerPage))
                });
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
        } finally {
            if (!signal?.aborted) setLoadingSubs(false);
        }
    }, [itemsPerPage, debouncedSearch]);

    useEffect(() => {
        if (!activeList?.id) return;
        const controller = new AbortController();
        fetchSubscribers(activeList.id, pagination.page, controller.signal);
        return () => controller.abort();
    }, [activeList?.id, pagination.page, fetchSubscribers]);

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(subscribers.map(s => s.id));
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

    const getOAForList = (list: any) => {
        if (!oas || oas.length === 0) return null;
        const match = oas.find(oa => (list.name || '').toLowerCase().includes((oa.name || '').toLowerCase()));
        return match || oas[0];
    };

    if (activeList) {
        const allSelected = subscribers.length > 0 && selectedIds.length >= subscribers.length;
        const totalInList = activeList.real_count || activeList.subscriber_count || 0;
        const followedInList = activeList.followed_count || 0;
        const isFirstLoad = loadingSubs && subscribers.length === 0;

        return (
            <div className="p-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard title="Tổng khách hàng" value={totalInList.toLocaleString('vi-VN')} icon={<Users />} color="var(--color-primary)" />
                    <StatCard title="Quan tâm OA" value={followedInList.toLocaleString('vi-VN')} icon={<Heart />} color="#10b981" />
                    <StatCard title="Tương tác" value={Math.max(0, totalInList - followedInList).toLocaleString('vi-VN')} icon={<MessageCircle />} color="#0284c7" />
                </div>

                <Panel>
                    <Toolbar>
                        <button
                            type="button"
                            onClick={() => {
                                setActiveList(null);
                                setSubscribers([]);
                                setSelectedIds([]);
                                setSearchQuery('');
                            }}
                            className="h-[38px] inline-flex items-center gap-1.5 px-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span>{activeList.name}</span>
                        </button>

                        <SearchBox
                            value={searchQuery}
                            onChange={setSearchQuery}
                            placeholder="Tìm theo tên, email, SĐT..."
                            className="w-64"
                        />

                        {selectedIds.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setIsSendZBSOpen(true)}
                                className="h-[38px] inline-flex items-center gap-2 px-3.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                            >
                                <Send className="w-3.5 h-3.5" />
                                <span>Gửi ZNS ({selectedIds.length})</span>
                            </button>
                        )}

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
                                            disabled={subscribers.length === 0}
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

                                {!loadingSubs && subscribers.map(sub => {
                                    const isSelected = selectedIds.includes(sub.id);
                                    const displayName = sub.display_name || sub.name || 'Zalo User';
                                    const isFollowed = sub.is_follower == 1 || sub.status === 'followed';
                                    const contactId = sub.contact_id || sub.myerp_contact_id;
                                    const phoneVal = sub.phone_number || sub.phone || '';
                                    const emailVal = sub.manual_email || sub.user_email || sub.email || '';
                                    const tagsList = parseTags(sub.tags);

                                    return (
                                        <tr
                                            key={sub.id}
                                            className={`${ROW_CLASS} cursor-pointer ${isSelected ? 'bg-[var(--color-primary-light)]' : ''}`}
                                            onClick={() => setSelectedProfileId(sub.id)}
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
                                                        src={sub.avatar}
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
                                                                Zalo UID: {sub.zalo_user_id}
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
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${isFollowed ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-[var(--color-bg)] text-[var(--color-text-light)] border-[var(--color-border)]'}`}>
                                                    {isFollowed ? 'Quan tâm' : 'Tương tác'}
                                                </span>
                                            </td>
                                            <td className={TD_CLASS}>
                                                <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-light)]">
                                                    <Clock className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                                                    {formatTimeAgoShort(sub.last_interaction_at || sub.created_at)}
                                                </span>
                                            </td>
                                            <td className={`${TD_CLASS} text-right`}>
                                                <span className="text-[13px] font-semibold tabular-nums text-[var(--color-text)]">
                                                    {sub.lead_score || 0}
                                                </span>
                                            </td>
                                            <td className={TD_CLASS}>
                                                <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
                                                    {(sub.joined_at || sub.created_at) ? new Date(sub.joined_at || sub.created_at).toLocaleDateString('vi-VN') : '—'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="inline-flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedProfileId(sub.id);
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

                                {!loadingSubs && subscribers.length === 0 && (
                                    <tr>
                                        <td colSpan={8}>
                                            <AudienceEmptyState
                                                icon={Users}
                                                title="Chưa có người dùng Zalo nào"
                                                description="Người dùng quan tâm hoặc nhắn tin với Zalo OA sẽ tự động hiển thị tại đây."
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

                {selectedProfileId && (
                    <ZaloUserProfileModal
                        subscriberId={selectedProfileId}
                        userId={selectedProfileId}
                        isOpen={!!selectedProfileId}
                        onClose={() => setSelectedProfileId(null)}
                        onUpdate={() => fetchSubscribers(activeList.id, pagination.page)}
                        onUserUpdated={() => fetchSubscribers(activeList.id, pagination.page)}
                    />
                )}
                {isSendZBSOpen && activeList && (
                    <ZaloSendZBSModal
                        isOpen={isSendZBSOpen}
                        onClose={() => setIsSendZBSOpen(false)}
                        oaId={activeList.oa_config_id}
                        selectedSubscribers={subscribers.filter(s => selectedIds.includes(s.id))}
                        onSuccess={() => setSelectedIds([])}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="p-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-[var(--radius-lg)] bg-[var(--color-bg)] border border-[var(--color-border)]">
                <div className="flex items-center gap-3">
                    <img src="https://automation.ideas.edu.vn/imgs/zalolog.png" alt="Zalo" className="w-8 h-8 object-contain shrink-0" />
                    <div>
                        <h3 className="text-sm font-semibold text-[var(--color-text)]">Danh sách đối tượng Zalo OA</h3>
                        <p className="text-xs text-[var(--color-text-muted)]">Tự động đồng bộ từ tài khoản Zalo Official Account</p>
                    </div>
                </div>
                <Button variant="outline" icon={RefreshCw} size="sm" onClick={() => fetchLists()}>
                    Đồng bộ Zalo OA
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
            ) : lists.length === 0 ? (
                <AudienceEmptyState
                    icon={MessageCircle}
                    title="Chưa có danh sách đối tượng Zalo nào"
                    description="Kết nối Zalo OA để đồng bộ danh sách người quan tâm."
                />
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {lists.map(list => {
                        const oa = getOAForList(list);
                        return (
                            <div
                                key={list.id}
                                onClick={() => {
                                    setActiveList(list);
                                    setPagination({ page: 1, limit: itemsPerPage, total: 0, totalPages: 1 });
                                }}
                                className="bg-[var(--color-surface)] p-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-xs)] hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary)] transition-all cursor-pointer flex flex-col justify-between group"
                            >
                                <div>
                                    <div className="flex items-start justify-between mb-4">
                                        <Avatar
                                            name={list.name || 'Zalo OA'}
                                            src={oa?.avatar}
                                            size={40}
                                        />
                                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded-full flex items-center gap-1.5 border border-emerald-200">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Zalo OA
                                        </span>
                                    </div>

                                    <div className="mb-4">
                                        <h4 className="text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-1">{list.name}</h4>
                                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5 flex items-center gap-1 line-clamp-1">
                                            <Minus className="w-3 h-3 shrink-0" /> {list.description || 'Đồng bộ từ Zalo OA'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between border-t border-[var(--color-border-light)] pt-3">
                                    <div>
                                        <span className="text-[11px] font-medium text-[var(--color-text-muted)] block">Thành viên Zalo</span>
                                        <span className="text-lg font-extrabold tabular-nums text-[var(--color-text)]">{(list.real_count || list.subscriber_count || 0).toLocaleString('vi-VN')}</span>
                                    </div>
                                    <div className="w-8 h-8 bg-[var(--color-bg)] text-[var(--color-text-muted)] rounded-full group-hover:bg-[var(--color-primary-light)] group-hover:text-[var(--color-primary)] transition-colors flex items-center justify-center shrink-0">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ZaloAudienceTab;
