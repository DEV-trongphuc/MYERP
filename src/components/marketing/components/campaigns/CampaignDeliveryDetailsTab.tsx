
import React, { useState, useEffect } from 'react';
import { api } from '../../services/storageAdapter';
import { Campaign, Subscriber } from '../../types';
import { Search, Filter, RefreshCw, Smartphone, Monitor, Globe, Mail, AlertTriangle, CheckCircle2, XCircle, MoreHorizontal, Tag, Trash2, Plus, MailOpen, Save, Eye, BadgeCheck } from 'lucide-react';
import Input from '../common/Input';
import Card from '../common/Card';
import Badge from '../common/Badge';
import Select from '../common/Select';
import ConfirmModal from '../common/ConfirmModal';
import Modal from '../common/Modal';
import Checkbox from '../common/Checkbox';
import Radio from '../common/Radio';
import TabTransition from '../common/TabTransition';
import toast from 'react-hot-toast';
import Pagination from '../common/Pagination';
import { Avatar } from '../../../ui/Avatar';

interface Props {
    campaign: Campaign;
    allLists: any[];
    allTags: any[];
    initialFilter?: string;
}

const CampaignDeliveryDetailsTab: React.FC<Props> = ({ campaign, allLists, allTags, initialFilter = 'all' }) => {
    const isZns = campaign.type === 'zalo_zns';
    const [recipients, setRecipients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState(initialFilter);
    const [typeFilter, setTypeFilter] = useState('all');
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    // Pagination State
    const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

    // Stats State (fetched from API)
    const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, opened: 0 });

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: React.ReactNode;
        onConfirm: () => void;
        variant?: 'danger' | 'warning';
        confirmLabel?: string;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const [deleteOptionModal, setDeleteOptionModal] = useState(false);
    const [deleteOption, setDeleteOption] = useState<'permanent' | 'from_list'>('from_list');

    // Preview Modal State
    const [previewModal, setPreviewModal] = useState<{
        isOpen: boolean;
        recipient: any | null;
        content: string;
        subject: string;
        loading: boolean;
    }>({ isOpen: false, recipient: null, content: '', subject: '', loading: false });

    const [minOpens, setMinOpens] = useState('');
    const [minClicks, setMinClicks] = useState('');

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Sync filter state with initialFilter prop changes (e.g. from parent tab switches)
    useEffect(() => {
        setFilter(initialFilter);
    }, [initialFilter]);

    // Fetch when filters/search/page changes (wait, we need to handle page separately or reset it)
    // Actually, when Filter/Search changes, we MUST reset to Page 1.
    // So we use a separate effect for that? Or just call fetch with page 1.

    // Pagination limit state change trigger
    const [limit, setLimit] = useState(20);

    useEffect(() => {
        fetchRecipients(1);
    }, [campaign, filter, typeFilter, debouncedSearch, minOpens, minClicks, limit]);


    const fetchRecipients = async (page = 1, customLimit?: number) => {
        setLoading(true);
        const currentLimit = customLimit !== undefined ? customLimit : limit;
        const query = new URLSearchParams({
            route: 'recipients',
            id: campaign.id,
            page: page.toString(),
            limit: currentLimit.toString(),
            status: filter,
            type: typeFilter,
            search: debouncedSearch,
            min_opens: minOpens,
            min_clicks: minClicks
        });

        const res = await api.get<any>(`campaigns?${query.toString()}`);
        if (res.success) {
            setRecipients(res.data.data || []);
            setPagination(res.data.pagination || { page: 1, limit: currentLimit, total: 0, totalPages: 1 });
            if (res.data.stats) {
                setStats(res.data.stats);
            }
            setSelectedIds([]);
        }
        setLoading(false);
    };

    const [openActionId, setOpenActionId] = useState<string | null>(null);
    const [tagInputId, setTagInputId] = useState<string | null>(null);
    const [tagValue, setTagValue] = useState('');
    const [bulkActionOpen, setBulkActionOpen] = useState(false);
    const [bulkTagValue, setBulkTagValue] = useState('');
    const [showBulkTagInput, setShowBulkTagInput] = useState(false);
    const [showBulkListInput, setShowBulkListInput] = useState(false);
    const [bulkListValue, setBulkListValue] = useState('');

    const handleActionClick = (id: string) => {
        setOpenActionId(openActionId === id ? null : id);
        setTagInputId(null);
    };

    // ...

    const handleSelectAll = async () => {
        if (selectedIds.length > 0) {
            setSelectedIds([]);
            return;
        }

        setLoading(true);
        try {
            const query = new URLSearchParams({
                route: 'recipients',
                id: campaign.id,
                status: filter,
                type: typeFilter,
                search: debouncedSearch,
                min_opens: minOpens,
                min_clicks: minClicks,
                return_ids_only: '1'
            });
            const endpoint = `campaigns?${query.toString()}`;
            const res = await api.get<any>(endpoint);
            if (res.success && res.data?.ids) {
                const fetchedIds = res.data.ids.filter((id: string | null) => id != null);
                setSelectedIds(fetchedIds);
                if (fetchedIds.length > 0) {
                    toast.success(`Đã chọn toàn bộ ${fetchedIds.length.toLocaleString()} liên hệ theo bộ lọc hiện tại!`);
                }
            }
        } catch (err) {
            console.error(err);
            toast.error("Không thể chọn tất cả liên hệ.");
        }
        setLoading(false);
    };

    const handleSelectRow = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(sid => sid !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const performBulkApi = async (action: string, value: string = '') => {
        setLoading(true);
        const res = await api.post('campaigns.php?route=bulk_update_subscribers', {
            subscriber_ids: selectedIds,
            action,
            value
        });

        if (res.success) {
            fetchRecipients(pagination.page);
            setShowBulkTagInput(false);
            setBulkTagValue('');
            setShowBulkListInput(false);
            setBulkListValue('');
            setBulkActionOpen(false);
            setTagInputId(null);
            toast.success('Hành động xử lý thành công!');
        } else {
            toast.error('Có lỗi xảy ra: ' + ((res as any).message || 'Unknown error'));
        }
        setLoading(false);
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };

    const executeBulkAction = (action: 'add_tag' | 'add_list' | 'unsubscribe' | 'delete', value: string = '') => {
        if (selectedIds.length === 0) return;

        if (action === 'delete') {
            setDeleteOptionModal(true);
            return;
        }

        if (action === 'unsubscribe') {
            setConfirmModal({
                isOpen: true,
                title: 'Xác nhận Hủy đăng ký',
                message: `Bạn có chắc muốn Hủy đăng ký ${selectedIds.length} người đã chọn? Họ sẽ không nhận được ${isZns ? 'tin nhắn' : 'email'} nữa.`,
                variant: 'warning',
                confirmLabel: 'Hủy đăng ký',
                onConfirm: () => performBulkApi('unsubscribe')
            });
            return;
        }

        if (action === 'add_tag') {
            performBulkApi('add_tag', value);
        }

        if (action === 'add_list') {
            performBulkApi('add_list', value);
        }
    };

    const handleConfirmDeleteOption = () => {
        setDeleteOptionModal(false);
        if (deleteOption === 'permanent') {
            setConfirmModal({
                isOpen: true,
                title: 'CẢNH BÁO: Xóa Vĩnh Viễn',
                message: (
                    <div className="space-y-3">
                        <p>Bạn đang yêu cầu <b>XÓA VĨNH VIỄN</b> {selectedIds.length} người đăng ký khỏi hệ thống.</p>
                        <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded border border-rose-100">
                            ⚠ Hành động này không thể hoàn tác. Tất cả dữ liệu lịch sử hoạt động sẽ bị mất.
                        </div>
                    </div>
                ),
                variant: 'danger',
                confirmLabel: 'Xác nhận Xóa',
                onConfirm: () => performBulkApi('delete')
            });
        } else {
            performBulkApi('unsubscribe');
        }
    };

    const handleQuickAction = (action: 'tag' | 'delete', subscriberId: string, email: string) => {
        if (action === 'delete') {
            setOpenActionId(null);
            setSelectedIds([subscriberId]);
            setDeleteOptionModal(true);
        } else if (action === 'tag') {
            setTagInputId(subscriberId);
            setTagValue('');
            setOpenActionId(null);
        }
    };

    const submitTag = async (subscriberId: string) => {
        if (tagValue.trim()) {
            await api.post('campaigns.php?route=bulk_update_subscribers', {
                subscriber_ids: [subscriberId],
                action: 'add_tag',
                value: tagValue.trim()
            });
            setTagInputId(null);
            fetchRecipients(pagination.page);
        }
    };

    const handlePreview = async (recipient: any) => {
        setPreviewModal({ ...previewModal, isOpen: true, loading: true, recipient, content: '', subject: '' });

        try {
            const res = await api.get<any>(`campaign_preview?campaign_id=${campaign.id}&email=${recipient.email}&reminder_id=${recipient.reminder_id || ''}`);
            if (res.success) {
                setPreviewModal(prev => ({
                    ...prev,
                    loading: false,
                    content: res.data.html,
                    subject: res.data.subject
                }));
            } else {
                setPreviewModal(prev => ({ ...prev, loading: false, content: `<p class="p-10 text-rose-500 font-bold text-center">Không thể tải nội dung ${isZns ? 'tin nhắn' : 'email'}.</p>` }));
            }
        } catch (err) {
            setPreviewModal(prev => ({ ...prev, loading: false, content: '<p class="p-10 text-rose-500 font-bold text-center">Lỗi kết nối server.</p>' }));
        }
    };

    return (
        <TabTransition className="space-y-6 pb-20">
            {/* ... stats ... */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Card 1: Tổng gửi */}
                <div className="stat-card bg-white dark:bg-slate-900 p-5 md:p-6 rounded-[24px] border border-slate-100/70 dark:border-slate-800/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-center justify-between group hover:shadow-[0_12px_36px_rgba(0,0,0,0.035)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden min-h-[100px]">
                    <div className="decor-svg" style={{ color: '#3b82f6' }}>
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                            <path d="M10 50 Q 50 10 90 50 T 90 90" stroke="currentColor" strokeWidth="2" stroke-dasharray="3 3" />
                            <circle cx="10" cy="50" r="6" fill="currentColor" />
                            <circle cx="50" cy="10" r="6" fill="currentColor" />
                            <circle cx="90" cy="50" r="6" fill="currentColor" />
                            <path d="M50 10 L 90 50" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 leading-none">Tổng gửi</p>
                        <h4 className="text-xl md:text-2xl font-black text-slate-850 dark:text-slate-100 tracking-tight leading-none">{stats.total.toLocaleString()}</h4>
                    </div>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 relative z-10" style={{ backgroundColor: '#3b82f615', color: '#3b82f6' }}>
                        {isZns ? <Smartphone className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
                    </div>
                </div>

                {/* Card 2: Thành công */}
                <div className="stat-card bg-white dark:bg-slate-900 p-5 md:p-6 rounded-[24px] border border-slate-100/70 dark:border-slate-800/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-center justify-between group hover:shadow-[0_12px_36px_rgba(0,0,0,0.035)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden min-h-[100px]">
                    <div className="decor-svg" style={{ color: '#10b981' }}>
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                            <rect x="20" y="20" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.6" />
                            <rect x="20" y="42" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.4" />
                            <rect x="20" y="64" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.2" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 leading-none">Thành công</p>
                        <h4 className="text-xl md:text-2xl font-black text-emerald-600 dark:text-emerald-500 tracking-tight leading-none">{stats.sent.toLocaleString()}</h4>
                    </div>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 relative z-10" style={{ backgroundColor: '#10b98115', color: '#10b981' }}>
                        <CheckCircle2 className="w-4 h-4" />
                    </div>
                </div>

                {/* Card 3: Lượt mở */}
                <div className="stat-card bg-white dark:bg-slate-900 p-5 md:p-6 rounded-[24px] border border-slate-100/70 dark:border-slate-800/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-center justify-between group hover:shadow-[0_12px_36px_rgba(0,0,0,0.035)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden min-h-[100px]">
                    <div className="decor-svg" style={{ color: '#8b5cf6' }}>
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" stroke-dasharray="4 4" />
                            <circle cx="35" cy="45" r="15" fill="currentColor" fillOpacity="0.2" />
                            <circle cx="65" cy="45" r="15" fill="currentColor" fillOpacity="0.4" />
                            <circle cx="50" cy="70" r="18" fill="currentColor" fillOpacity="0.6" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 leading-none">{isZns ? 'Người xem' : 'Lượt mở'}</p>
                        <h4 className="text-xl md:text-2xl font-black text-purple-600 dark:text-purple-550 tracking-tight leading-none">{stats.opened.toLocaleString()}</h4>
                    </div>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 relative z-10" style={{ backgroundColor: '#8b5cf615', color: '#8b5cf6' }}>
                        {isZns ? <BadgeCheck className="w-4 h-4" /> : <MailOpen className="w-4 h-4" />}
                    </div>
                </div>

                {/* Card 4: Thất bại */}
                <div className="stat-card bg-white dark:bg-slate-900 p-5 md:p-6 rounded-[24px] border border-slate-100/70 dark:border-slate-800/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex items-center justify-between group hover:shadow-[0_12px_36px_rgba(0,0,0,0.035)] hover:-translate-y-1 transition-all duration-300 relative overflow-hidden min-h-[100px]">
                    <div className="decor-svg" style={{ color: '#ec4899' }}>
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                            <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
                            <path d="M50 35 V 65 M35 50 H 65" stroke="currentColor" strokeWidth="3" stroke-linecap="round" />
                        </svg>
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] uppercase font-black text-slate-400 dark:text-slate-500 tracking-wider mb-1.5 leading-none">Thất bại</p>
                        <h4 className="text-xl md:text-2xl font-black text-rose-600 dark:text-rose-500 tracking-tight leading-none">{stats.failed.toLocaleString()}</h4>
                    </div>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110 relative z-10" style={{ backgroundColor: '#ec489915', color: '#ec4899' }}>
                        <XCircle className="w-4 h-4" />
                    </div>
                </div>
            </div>

            <div className="flex justify-between gap-4 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 flex-wrap">
                <div className="flex gap-2 flex-1 min-w-[300px]">
                    <div className="flex-1 relative group bg-white rounded-xl border border-slate-200 h-10 flex items-center overflow-hidden w-full">
                        <Search className="w-4 h-4 ml-4 text-slate-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={isZns ? "Tìm kiếm sđt..." : "Tìm kiếm email..."}
                            className="w-full h-full bg-transparent border-none outline-none text-xs font-medium px-3"
                        />
                    </div>
                </div>

                {/* Advanced Filters */}
                <div className="flex gap-2 items-center">
                    <div className="w-24 relative group">
                        <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                            <Eye className="w-3 h-3 text-slate-400" />
                        </div>
                        <input
                            type="number"
                            min="0"
                            value={minOpens}
                            onChange={(e) => setMinOpens(e.target.value)}
                            placeholder="Mở > 0"
                            className="w-full h-9 pl-7 pr-2 text-xs font-medium bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                        />
                    </div>
                    {!isZns && (
                        <div className="w-24 relative group">
                            <div className="absolute inset-y-0 left-2 flex items-center pointer-events-none">
                                <Monitor className="w-3 h-3 text-slate-400" />
                            </div>
                            <input
                                type="number"
                                min="0"
                                value={minClicks}
                                onChange={(e) => setMinClicks(e.target.value)}
                                placeholder="Click > 0"
                                className="w-full h-9 pl-7 pr-2 text-xs font-medium bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300"
                            />
                        </div>
                    )}

                    <div className="w-40">
                        <Select
                            size="sm"
                            variant="outline"
                            value={typeFilter}
                            onChange={(val) => setTypeFilter(val)}
                            options={[
                                { value: 'all', label: 'Tất cả Loại' },
                                { value: 'Main Campaign', label: 'Chiến dịch chính' },
                                { value: 'Reminder', label: 'Reminder' }
                            ]}
                        />
                    </div>
                    <div className="w-48">
                        <Select
                            size="sm"
                            variant="outline"
                            value={filter}
                            onChange={(val) => setFilter(val)}
                            options={[
                                { value: 'all', label: 'Tất cả Trạng thái' },
                                { value: 'success', label: 'Thành công (Sent)' },
                                { value: 'opened', label: 'Đã mở (Opened)' },
                                { value: 'clicked', label: 'Đã click (Clicked)' },
                                { value: 'failed', label: 'Thất bại (Failed)' },
                                { value: 'unsubscribed', label: 'Hủy đăng ký (Unsubscribed)' }
                            ]}
                        />
                    </div>
                    <button onClick={() => fetchRecipients(1)} className="p-2 h-9 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-[#2563eb] hover:border-[#2563eb] transition-all"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
                </div>
            </div>

            <Card noPadding className="border-[var(--color-border)] shadow-sm min-h-[300px] overflow-visible">
                <div className="table-wrap overflow-x-auto max-h-[400px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left">
                        <thead className="bg-[var(--color-bg)] border-b border-[var(--color-border)] sticky top-0 z-20 backdrop-blur-sm">
                            {selectedIds.length > 0 ? (
                                <tr className="bg-[#fffbf0] border-b border-orange-200 shadow-sm animate-in fade-in duration-200">
                                    <th colSpan={6} className="px-6 py-3">
                                        <div className="flex items-center justify-between w-full">
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    checked={true}
                                                    onChange={handleSelectAll}
                                                    size="sm"
                                                />
                                                <span className="text-xs font-bold text-slate-700">
                                                    Đã chọn <span className="text-[var(--color-primary)] font-black text-sm">{selectedIds.length.toLocaleString()}</span> {isZns ? 'người nhận' : 'người nhận'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                {showBulkTagInput ? (
                                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                                        <div className="w-40">
                                                            <Select
                                                                size="sm"
                                                                variant="outline"
                                                                value={bulkTagValue}
                                                                onChange={val => setBulkTagValue(val)}
                                                                options={[
                                                                    { value: '', label: 'Chọn Tag...' },
                                                                    ...allTags.map(t => ({ value: t.name, label: t.name }))
                                                                ]}
                                                            />
                                                        </div>
                                                        <button onClick={() => executeBulkAction('add_tag', bulkTagValue)} className="p-1.5 bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 shadow-sm transition-all"><Plus className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => setShowBulkTagInput(false)} className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-slate-50 transition-all"><XCircle className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                ) : showBulkListInput ? (
                                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                                                        <div className="w-48 relative">
                                                            <Input
                                                                value={bulkListValue}
                                                                onChange={(e) => setBulkListValue(e.target.value)}
                                                                list="listDropdownMenu"
                                                                placeholder="Chọn/Nhập tên Danh sách"
                                                                customSize="sm"
                                                                className="!text-xs"
                                                            />
                                                            <datalist id="listDropdownMenu">
                                                                {allLists.map(l => (
                                                                    <option key={l.id} value={l.name || l.id} />
                                                                ))}
                                                            </datalist>
                                                        </div>
                                                        <button onClick={() => executeBulkAction('add_list', bulkListValue)} className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 shadow-sm transition-all"><Plus className="w-3.5 h-3.5" /></button>
                                                        <button onClick={() => setShowBulkListInput(false)} className="p-1.5 bg-white border border-slate-200 text-slate-400 rounded-lg hover:bg-slate-50 transition-all"><XCircle className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => { setShowBulkTagInput(false); setShowBulkListInput(true); }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-100 text-blue-600 hover:bg-blue-50 hover:border-blue-200 rounded-lg text-xs font-bold shadow-sm transition-all"
                                                        >
                                                            <Save className="w-3.5 h-3.5" /> Thêm vào List
                                                        </button>
                                                        <button
                                                            onClick={() => { setShowBulkListInput(false); setShowBulkTagInput(true); }}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-orange-100 text-orange-600 hover:bg-orange-50 hover:border-orange-200 rounded-lg text-xs font-bold shadow-sm transition-all"
                                                        >
                                                            <Tag className="w-3.5 h-3.5" /> Gắn Tag
                                                        </button>
                                                        <div className="h-4 w-px bg-orange-200 mx-1"></div>
                                                        <button
                                                            onClick={() => executeBulkAction('delete')}
                                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-100 text-rose-600 hover:bg-rose-50 hover:border-rose-200 rounded-lg text-xs font-bold shadow-sm transition-all"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" /> Xóa nhanh
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </th>
                                </tr>
                            ) : (
                                <tr>
                                    <th className="px-6 py-4 w-10">
                                        <Checkbox
                                            checked={selectedIds.length > 0}
                                            onChange={handleSelectAll}
                                            size="sm"
                                        />
                                    </th>
                                    <th className="px-6 py-4 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Loại</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest max-w-[220px]">{isZns ? "Số điện thoại" : "Email người nhận"}</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Trạng thái</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Tương tác</th>
                                    <th className="px-6 py-4 text-[10px] font-black text-[var(--color-text-muted)] uppercase tracking-widest">Thời gian gửi</th>
                                </tr>
                            )}
                        </thead>
                        <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
                            {loading ? (
                                <tr><td colSpan={6} className="py-20 text-center text-slate-400 text-xs font-medium italic">Đang tải danh sách...</td></tr>
                            ) : recipients.length === 0 ? (
                                <tr><td colSpan={6} className="py-20 text-center text-slate-400 text-xs font-medium italic">Không tìm thấy người nhận nào khớp với bộ lọc.</td></tr>
                            ) : (
                                recipients.map((r, i) => {
                                    const displayName = `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.full_name || r.name || '';
                                    return (
                                        <tr
                                            key={i}
                                            className={`group/row transition-colors ${(r.contact_id || r.subscriber_id) ? 'cursor-pointer' : ''} ${selectedIds.includes(r.subscriber_id) ? 'bg-[var(--color-primary)]/5' : 'hover:bg-[var(--color-bg)]'}`}
                                            onClick={() => {
                                                if (r.contact_id) {
                                                    window.dispatchEvent(new CustomEvent('open-customer-drawer', { detail: { initialTab: 'journey360', id: Number(r.contact_id) } }));
                                                } else if (r.subscriber_id) {
                                                    handleSelectRow(r.subscriber_id);
                                                }
                                            }}
                                        >
                                            <td className="px-6 py-3" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={selectedIds.includes(r.subscriber_id)}
                                                    onChange={() => r.subscriber_id && handleSelectRow(r.subscriber_id)}
                                                    disabled={!r.subscriber_id}
                                                    size="sm"
                                                />
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${r.type === 'Reminder' ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                                    {r.type === 'Main Campaign' ? 'Main' : (r.type || 'Main')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 max-w-[240px]">
                                                 <div className="flex items-center gap-3">
                                                     <Avatar name={displayName || r.email} size={32} />
                                                     <div className="min-w-0">
                                                         <div className="text-xs font-bold text-[var(--color-text)] group-hover/row:text-[var(--color-primary)] transition-colors truncate" title={displayName || r.email}>
                                                             {displayName || r.email}
                                                         </div>
                                                         {displayName && r.email && (
                                                             <div className="text-[10px] text-[var(--color-text-muted)] truncate" title={r.email}>{r.email}</div>
                                                         )}
                                                     </div>
                                                 </div>
                                             </td>
                                            <td className="px-6 py-3">
                                                <Badge variant={r.delivery_status === 'success' ? 'success' : 'danger'} className="uppercase text-[9px]">
                                                    {r.delivery_status}
                                                </Badge>
                                                {r.error_message && <p className="text-[9px] text-rose-500 mt-1 max-w-[200px] truncate" title={r.error_message}>{r.error_message}</p>}
                                            </td>
                                            <td className="px-6 py-3 text-xs text-[var(--color-text-secondary)]">
                                                {!r.subscriber_id ? (
                                                    <Badge variant="danger" className="text-[9px] bg-rose-50 text-rose-600 border-rose-100">Đã xóa</Badge>
                                                ) : r.subscriber_status === 'unsubscribed' ? (
                                                    <Badge variant="warning" className="text-[9px] bg-amber-50 text-amber-600 border-amber-100">Đã hủy</Badge>
                                                ) : (
                                                    <div className="flex gap-2">
                                                        {r.open_count > 0 && <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-100">{r.open_count.toLocaleString()} {isZns ? 'Xem' : 'Open'}</span>}
                                                        {!isZns && r.click_count > 0 && <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-bold border border-blue-100">{r.click_count.toLocaleString()} Click</span>}
                                                        {r.open_count == 0 && (isZns || r.click_count == 0) && <span className="text-slate-400">-</span>}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-3 text-[10px] font-bold text-[var(--color-text-muted)] font-mono">
                                                {new Date(r.sent_at).toLocaleString('vi-VN')}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Result Count and Pagination Footer */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                        <span>Hiển thị</span>
                        <select
                            value={limit}
                            onChange={(e) => {
                                const newLimit = parseInt(e.target.value);
                                setLimit(newLimit);
                                fetchRecipients(1, newLimit);
                            }}
                            className="bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none text-slate-700 font-bold focus:border-[#2563eb] cursor-pointer"
                        >
                            <option value={10}>10 dòng</option>
                            <option value={20}>20 dòng</option>
                            <option value={50}>50 dòng</option>
                            <option value={100}>100 dòng</option>
                            <option value={200}>200 dòng</option>
                        </select>
                        <span>trên mỗi trang</span>
                    </div>
                    <Pagination
                        currentPage={pagination.page}
                        totalPages={pagination.totalPages}
                        totalCount={pagination.total}
                        itemsPerPage={pagination.limit}
                        onPageChange={(p) => fetchRecipients(p)}
                    />
                </div>
            </Card>

            <ConfirmModal
                isOpen={confirmModal.isOpen}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
                title={confirmModal.title}
                message={confirmModal.message}
                variant={confirmModal.variant}
                confirmLabel={confirmModal.confirmLabel}
            />

            <Modal
                isOpen={deleteOptionModal}
                onClose={() => setDeleteOptionModal(false)}
                title="Lựa chọn Xóa"
                size="sm"
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <button onClick={() => setDeleteOptionModal(false)} className="px-3 py-1.5 text-slate-500 hover:bg-slate-50 rounded-lg text-sm font-bold">Hủy</button>
                        <button onClick={handleConfirmDeleteOption} className="px-3 py-1.5 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-sm font-bold shadow-lg">Tiếp tục</button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">Bạn muốn xử lý <span className="font-bold text-slate-900">{selectedIds.length} người đăng ký</span> này như thế nào?</p>
                    <Radio
                        variant="cards"
                        value={deleteOption}
                        onChange={(val) => setDeleteOption(val as any)}
                        options={[
                            {
                                id: 'from_list',
                                label: 'Gỡ khỏi Danh sách nhận tin (Unsubscribe)',
                                desc: 'Người dùng sẽ bị đánh dấu Unsubscribed. Dữ liệu lịch sử vẫn được giữ lại.'
                            },
                            {
                                id: 'permanent',
                                label: 'Xóa vĩnh viễn khỏi hệ thống',
                                desc: 'Xóa hoàn toàn người dùng và mọi lịch sử tương tác. Không thể khôi phục.'
                            }
                        ]}
                    />
                </div>
            </Modal>

            <Modal
                isOpen={previewModal.isOpen}
                onClose={() => setPreviewModal({ ...previewModal, isOpen: false })}
                title={`Preview: ${previewModal.recipient?.email || ''}`}
                size="lg"
            >
                <div className="space-y-4">
                    <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Tiêu đề (Personalized Subject)</p>
                        <p className="text-sm font-bold text-slate-700">{previewModal.loading ? '...' : previewModal.subject}</p>
                    </div>
                    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-inner h-[500px]">
                        {previewModal.loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-3 animate-pulse">
                                <RefreshCw className="w-8 h-8 animate-spin" />
                                <p className="text-xs font-bold uppercase tracking-widest">Đang tạo nội dung preview...</p>
                            </div>
                        ) : (
                            <iframe
                                srcDoc={previewModal.content}
                                className="w-full h-full border-none"
                                title={isZns ? "ZNS Preview" : "Email Preview"}
                            />
                        )}
                    </div>
                </div>
            </Modal>
        </TabTransition>
    );
};



export default CampaignDeliveryDetailsTab;