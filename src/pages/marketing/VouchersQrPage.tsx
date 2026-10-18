import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LinksQRView, { type LinksQRHandle } from '../../components/marketing/views/LinksQR';
import { QrCode, Plus, Gift, LayoutGrid, List, CalendarClock, Ticket, Settings2, Trash2, BookOpen, Code, CheckCircle2, Sparkles } from 'lucide-react';
import Tabs from '../../components/marketing/components/common/Tabs';
import PageHero from '../../components/marketing/components/common/PageHero';
import StatCard from '../../components/marketing/components/common/StatCard';
import SearchBox from '../../components/marketing/components/common/SearchBox';
import Button from '../../components/marketing/components/common/Button';
import { MktPage, MktPanel, MktToolbar, MktEmpty, MktStatGrid, MktSegmented } from '../../components/marketing/components/dashboard/MktLayout';
import { api } from '../../components/marketing/services/storageAdapter';
import toast from 'react-hot-toast';
import { VoucherCampaign } from '../../components/marketing/types';
import VoucherCampaignModal from '../../components/marketing/components/vouchers/VoucherCampaignModal';
import VoucherCodeManager from '../../components/marketing/components/vouchers/VoucherCodeManager';
import VoucherGuideModal from '../../components/marketing/components/vouchers/VoucherGuideModal';
import VoucherApiEmbedModal from '../../components/marketing/components/vouchers/VoucherApiEmbedModal';
import ConfirmModal from '../../components/marketing/components/common/ConfirmModal';
import { useTheme } from '../../components/marketing/contexts/ThemeContext';

const BRAND = '#BD1D2D';

const Vouchers: React.FC = () => {
    const { isDark } = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const linksRef = useRef<LinksQRHandle>(null);

    const [campaigns, setCampaigns] = useState<VoucherCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('all');
    const initialModule = new URLSearchParams(location.search).get('tab') === 'links-qr' ? 'links-qr' : 'vouchers';
    const [moduleTab, setModuleTab] = useState<'vouchers' | 'links-qr'>(initialModule);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    useEffect(() => {
        const tabParam = new URLSearchParams(location.search).get('tab');
        if (tabParam === 'links-qr') setModuleTab('links-qr');
        else if (tabParam === 'vouchers') setModuleTab('vouchers');
    }, [location.search]);

    const handleModuleChange = (nextTab: 'vouchers' | 'links-qr') => {
        setModuleTab(nextTab);
        const search = nextTab === 'links-qr' ? '?tab=links-qr' : '';
        navigate({ pathname: location.pathname, search }, { replace: true });
    };

    const [isOriginModalOpen, setOriginModalOpen] = useState(false);
    const [editingCampaign, setEditingCampaign] = useState<Partial<VoucherCampaign> | undefined>();
    const [selectedCampaignForCodes, setSelectedCampaignForCodes] = useState<VoucherCampaign | null>(null);
    const [selectedCampaignForApi, setSelectedCampaignForApi] = useState<VoucherCampaign | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<VoucherCampaign | null>(null);
    const [isGuideModalOpen, setGuideModalOpen] = useState(false);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await api.get<VoucherCampaign[]>('voucher_campaigns');
            if (res.success && Array.isArray(res.data)) {
                setCampaigns(res.data);
            }
        } catch (error) {
            console.error(error);
            toast.error('Lỗi tải danh sách Voucher');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const kpiStats = useMemo(() => {
        const totalCampaigns = campaigns.length;
        const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
        const totalIssued = campaigns.reduce((sum, c) => {
            const raw = c.stats?.totalGenerated ?? (c.stats as any)?.total_generated ?? (c as any).total_codes ?? (c as any).totalGenerated ?? 0;
            const n = Number(raw);
            return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
        const totalRedeemed = campaigns.reduce((sum, c) => {
            const raw = c.stats?.totalRedeemed ?? (c.stats as any)?.total_redeemed ?? (c as any).redeemed_codes ?? (c as any).totalRedeemed ?? 0;
            const n = Number(raw);
            return sum + (Number.isFinite(n) ? n : 0);
        }, 0);
        return { totalCampaigns, activeCampaigns, totalIssued, totalRedeemed };
    }, [campaigns]);

    const filteredCampaigns = useMemo(() => {
        const q = searchTerm.trim().toLowerCase();
        return campaigns.filter(c => {
            const matchesTab = activeTab === 'all' || c.status === activeTab;
            const matchesSearch = !q ||
                (c.name || '').toLowerCase().includes(q) ||
                (c.staticCode || '').toLowerCase().includes(q) ||
                (c.prefixList || '').toLowerCase().includes(q) ||
                ((c as any).codePrefix || (c as any).code_prefix || '').toLowerCase().includes(q) ||
                (c.description || '').toLowerCase().includes(q);
            return matchesTab && matchesSearch;
        });
    }, [campaigns, activeTab, searchTerm]);

    const handleCreateOrUpdateCampaign = async (campaignData: Partial<VoucherCampaign>) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const url = 'voucher_campaigns';
            const finalData = { ...campaignData };
            const res = await api.post<VoucherCampaign>(url, finalData);
            if (res.success) {
                toast.success(campaignData.id ? 'Đã cập nhật chiến dịch!' : 'Tạo Voucher thành công!');
                setOriginModalOpen(false);
                if (campaignData.id) {
                    setCampaigns(prev => prev.map(c => c.id === campaignData.id ? { ...c, ...res.data } : c));
                } else {
                    setCampaigns(prev => [...prev, res.data]);
                }
            } else {
                toast.error((res as any).message || 'Lỗi khi lưu chiến dịch!');
            }
        } catch {
            toast.error('Lỗi kết nối');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatus = async (campaign: VoucherCampaign) => {
        if (isToggling) return;
        setIsToggling(true);
        const newStatus = campaign.status === 'active' ? 'draft' : 'active';
        setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: newStatus } : c));
        try {
            const res = await api.post('voucher_campaigns', { ...campaign, status: newStatus });
            if (res.success) {
                toast.success('Đã chuyển trạng thái thành công');
            } else {
                setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: campaign.status } : c));
                toast.error('Lỗi khi đổi trạng thái');
            }
        } catch {
            setCampaigns(prev => prev.map(c => c.id === campaign.id ? { ...c, status: campaign.status } : c));
            toast.error('Lỗi kết nối');
        } finally {
            setIsToggling(false);
        }
    };

    const confirmDelete = (campaign: VoucherCampaign) => {
        setDeleteTarget(campaign);
    };

    const executeDelete = async () => {
        if (!deleteTarget || isDeleting) return;
        setIsDeleting(true);
        const snapshot = [...campaigns];
        setCampaigns(prev => prev.filter(c => c.id !== deleteTarget.id));
        setDeleteTarget(null);
        try {
            const res = await api.delete(`voucher_campaigns/${deleteTarget.id}`);
            if (res.success) {
                toast.success('Đã xóa chiến dịch!');
            } else {
                setCampaigns(snapshot);
                toast.error('Lỗi khi xóa!');
            }
        } catch {
            setCampaigns(snapshot);
            toast.error('Lỗi kết nối');
        } finally {
            setIsDeleting(false);
        }
    };

    const openCreateModal = () => {
        setEditingCampaign(undefined);
        setOriginModalOpen(true);
    };

    const moduleSwitcher = (
        <div
            role="tablist"
            aria-label="Chuyển phân hệ Voucher và Mã QR"
            className="inline-flex items-center gap-1 p-1 rounded-[var(--radius-lg)] bg-[var(--color-bg)] border border-[var(--color-border)]"
        >
            <button
                type="button"
                role="tab"
                aria-selected={moduleTab === 'vouchers'}
                onClick={() => handleModuleChange('vouchers')}
                className={`h-8 px-3.5 rounded-[var(--radius-md)] text-xs font-semibold inline-flex items-center gap-2 transition-colors ${
                    moduleTab === 'vouchers'
                        ? 'bg-[var(--color-primary)] text-white shadow-[var(--shadow-xs)]'
                        : 'bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
            >
                <Ticket className="w-4 h-4 shrink-0" />
                <span>Chiến dịch Voucher & Học bổng</span>
            </button>
            <button
                type="button"
                role="tab"
                aria-selected={moduleTab === 'links-qr'}
                onClick={() => handleModuleChange('links-qr')}
                className={`h-8 px-3.5 rounded-[var(--radius-md)] text-xs font-semibold inline-flex items-center gap-2 transition-colors ${
                    moduleTab === 'links-qr'
                        ? 'bg-[var(--color-primary)] text-white shadow-[var(--shadow-xs)]'
                        : 'bg-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
            >
                <QrCode className="w-4 h-4 shrink-0" />
                <span>Rút gọn Link & QR Sự kiện</span>
            </button>
        </div>
    );

    const firstLoad = loading && campaigns.length === 0;

    return (
        <MktPage className="pb-12">
            <PageHero
                title="Voucher & Mã QR Sự kiện"
                subtitle="Quản lý mã giảm giá, học bổng, rút gọn link và mã QR sự kiện tích hợp trực tiếp vào chiến dịch Email/Zalo."
                actions={
                    moduleTab === 'vouchers'
                        ? [
                              { label: 'Hướng dẫn chi tiết', icon: BookOpen, onClick: () => setGuideModalOpen(true), primary: false },
                              { label: 'Tạo Voucher mới', icon: Plus, onClick: openCreateModal, primary: true },
                          ]
                        : [
                              { label: 'Hướng dẫn sử dụng', icon: BookOpen, onClick: () => linksRef.current?.openGuide(), primary: false },
                              { label: 'Tạo Link mới', icon: Plus, onClick: () => linksRef.current?.openCreate(), primary: true },
                          ]
                }
            >
                {moduleSwitcher}
            </PageHero>

            {/* 4 KPI StatCards in ONE row on desktop */}
            <MktStatGrid cols={4}>
                <StatCard
                    loading={firstLoad}
                    title="Tổng chiến dịch"
                    value={kpiStats.totalCampaigns.toLocaleString('vi-VN')}
                    icon={<Gift />}
                    color="#a31422"
                    breakdown="Chương trình Voucher & Mã ưu đãi"
                />
                <StatCard
                    loading={firstLoad}
                    title="Đang hoạt động"
                    value={kpiStats.activeCampaigns.toLocaleString('vi-VN')}
                    icon={<Sparkles />}
                    color="#10b981"
                    breakdown="Sẵn sàng cấp phát mã tự động"
                />
                <StatCard
                    loading={firstLoad}
                    title="Tổng mã phát hành"
                    value={kpiStats.totalIssued.toLocaleString('vi-VN')}
                    icon={<Ticket />}
                    color="#3b82f6"
                    breakdown="Mã đã cấp cho khách hàng"
                />
                <StatCard
                    loading={firstLoad}
                    title="Đã sử dụng (Redeem)"
                    value={kpiStats.totalRedeemed.toLocaleString('vi-VN')}
                    icon={<CheckCircle2 />}
                    color="#f59e0b"
                    breakdown="Đã quy đổi ưu đãi thành công"
                />
            </MktStatGrid>

            {moduleTab === 'links-qr' ? (
                <LinksQRView
                    ref={linksRef}
                    toolbarLeft={
                        <div className="flex items-center gap-2">
                            <QrCode className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                            <span className="text-sm font-bold text-[var(--color-text)]">Rút gọn Link & Mã QR Sự kiện</span>
                        </div>
                    }
                />
            ) : (
                <>
                    <MktPanel>
                        <MktToolbar
                            left={
                                <Tabs
                                    variant="segmented"
                                    activeId={activeTab}
                                    onChange={setActiveTab}
                                    items={[
                                        { id: 'all', label: 'Tất cả', icon: LayoutGrid, count: campaigns.length },
                                        { id: 'active', label: 'Đang chạy', icon: Ticket, count: campaigns.filter(c => c.status === 'active').length },
                                        { id: 'draft', label: 'Bản nháp', icon: Settings2, count: campaigns.filter(c => c.status === 'draft').length },
                                        { id: 'expired', label: 'Hết hạn', icon: CalendarClock, count: campaigns.filter(c => c.status === 'expired').length },
                                    ]}
                                />
                            }
                            right={
                                <>
                                    <SearchBox
                                        value={searchTerm}
                                        onChange={setSearchTerm}
                                        placeholder="Tìm kiếm voucher, mã tiền tố..."
                                        className="w-64"
                                    />
                                    <MktSegmented<'grid' | 'list'>
                                        value={viewMode}
                                        onChange={setViewMode}
                                        options={[
                                            { id: 'grid', icon: LayoutGrid, title: 'Giao diện dạng thẻ' },
                                            { id: 'list', icon: List, title: 'Giao diện danh sách' },
                                        ]}
                                    />
                                </>
                            }
                        />

                        <div className="p-4 lg:p-5">
                            {loading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {[1, 2, 3, 4, 5, 6].map(i => (
                                        <div key={i} className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex flex-col gap-4">
                                            <div className="flex justify-between items-center">
                                                <div className="w-11 h-11 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[14px]" />
                                                <div className="w-24 h-6 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-full" />
                                            </div>
                                            <div className="space-y-2">
                                                <div className="h-4 w-3/4 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[8px]" />
                                                <div className="h-3 w-1/2 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[6px]" />
                                            </div>
                                            <div className="h-16 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                                            <div className="flex gap-2">
                                                <div className="h-9 flex-1 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                                                <div className="h-9 flex-[2] animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : filteredCampaigns.length === 0 ? (
                                <MktEmpty
                                    icon={Gift}
                                    title={campaigns.length === 0 ? 'Chưa có chiến dịch Voucher nào' : 'Không tìm thấy chiến dịch phù hợp'}
                                    description={
                                        campaigns.length === 0
                                            ? 'Khởi tạo chiến dịch quà tặng hoặc mã giảm giá để tri ân khách hàng và tăng tỷ lệ chuyển đổi.'
                                            : 'Thử điều chỉnh bộ lọc trạng thái hoặc từ khóa tìm kiếm.'
                                    }
                                    actionLabel={campaigns.length === 0 ? 'Tạo chiến dịch Voucher ngay' : undefined}
                                    onAction={campaigns.length === 0 ? openCreateModal : undefined}
                                />
                            ) : (
                                <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4' : 'flex flex-col gap-3'}>
                                    {filteredCampaigns.map(campaign => {
                                        const rewardLabel = campaign.rewards && campaign.rewards.length > 1
                                            ? `Gói đa quà tặng (${campaign.rewards.length} món)`
                                            : campaign.rewards && campaign.rewards.length === 1
                                                ? (campaign.rewards[0].discountType === 'percentage'
                                                    ? `Giảm ${campaign.rewards[0].discountValue}%`
                                                    : campaign.rewards[0].discountType === 'fixed_amount'
                                                        ? `Giảm ${campaign.rewards[0].discountValue?.toLocaleString('vi-VN')}đ`
                                                        : campaign.rewards[0].giftTitle || 'Quà tặng')
                                                : 'Chưa cấu hình ưu đãi';

                                        return (
                                            <div
                                                key={campaign.id}
                                                className={
                                                    viewMode === 'grid'
                                                        ? 'group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-5 flex flex-col hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-md)] transition-all relative overflow-hidden'
                                                        : 'group bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[var(--radius-lg)] p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)] transition-all relative overflow-hidden'
                                                }
                                            >
                                                {viewMode === 'grid' ? (
                                                    <>
                                                        <div className="flex justify-between items-center mb-3">
                                                            <div className="w-11 h-11 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center shrink-0 relative overflow-hidden">
                                                                {campaign.thumbnailUrl ? (
                                                                    <img src={campaign.thumbnailUrl} alt={campaign.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Gift className="w-5 h-5" />
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                                <label className="relative inline-flex items-center cursor-pointer mr-1" title={campaign.status === 'active' ? 'Tạm dừng chiến dịch' : 'Kích hoạt chiến dịch'}>
                                                                    <input type="checkbox" className="sr-only peer" checked={campaign.status === 'active'} onChange={() => handleToggleStatus(campaign)} />
                                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                                                                    <span className={`ml-2 text-[11px] font-semibold ${campaign.status === 'active' ? 'text-emerald-600' : 'text-[var(--color-text-muted)]'}`}>
                                                                        {campaign.status === 'active' ? 'Hoạt động' : 'Đang tắt'}
                                                                    </span>
                                                                </label>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setEditingCampaign(campaign); setOriginModalOpen(true); }}
                                                                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-bg)]"
                                                                    title="Chỉnh sửa"
                                                                >
                                                                    <Settings2 className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => confirmDelete(campaign)}
                                                                    className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors p-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--color-bg)]"
                                                                    title="Xóa bỏ"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <h3 className="text-sm font-bold text-[var(--color-text)] line-clamp-1 mb-1">{campaign.name}</h3>
                                                        <p className="text-xs text-[var(--color-text-muted)] line-clamp-2 mb-4 min-h-[2rem]">
                                                            {campaign.description || 'Không có mô tả.'}
                                                        </p>

                                                        <div className="mt-auto">
                                                            <div className="bg-[var(--color-bg)] border border-[var(--color-border-light)] rounded-[var(--radius-md)] p-3 flex flex-col gap-1.5 mb-4 text-xs">
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-medium text-[var(--color-text-muted)]">Loại mã</span>
                                                                    <span className="font-bold text-[var(--color-text)] uppercase">{campaign.codeType}</span>
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="font-medium text-[var(--color-text-muted)]">Ưu đãi</span>
                                                                    <span className="font-bold text-[var(--color-primary)] truncate max-w-[180px]">{rewardLabel}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="md"
                                                                    icon={Code}
                                                                    onClick={() => setSelectedCampaignForApi(campaign)}
                                                                    className="flex-1"
                                                                >
                                                                    API
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="primary"
                                                                    size="md"
                                                                    icon={LayoutGrid}
                                                                    onClick={() => setSelectedCampaignForCodes(campaign)}
                                                                    className="flex-[2]"
                                                                >
                                                                    Quản lý mã
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center shrink-0 relative overflow-hidden">
                                                                {campaign.thumbnailUrl ? (
                                                                    <img src={campaign.thumbnailUrl} alt={campaign.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <Gift className="w-5 h-5" />
                                                                )}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <h3 className="text-sm font-bold text-[var(--color-text)] truncate">{campaign.name}</h3>
                                                                <p className="text-xs text-[var(--color-text-muted)] truncate">{campaign.description || 'Không có mô tả...'}</p>
                                                            </div>
                                                        </div>

                                                        <div className="hidden lg:flex flex-col items-end shrink-0 border-l border-[var(--color-border-light)] pl-5 w-48">
                                                            <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">{campaign.codeType}</span>
                                                            <span className="text-xs font-bold text-[var(--color-primary)] truncate max-w-full">{rewardLabel}</span>
                                                        </div>

                                                        <div className="flex items-center justify-end gap-2 shrink-0 ml-auto md:ml-0">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                icon={Code}
                                                                onClick={() => setSelectedCampaignForApi(campaign)}
                                                                title="Lấy mã nhúng API"
                                                            >
                                                                API
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="primary"
                                                                size="sm"
                                                                icon={LayoutGrid}
                                                                onClick={() => setSelectedCampaignForCodes(campaign)}
                                                            >
                                                                Quản lý mã
                                                            </Button>

                                                            <div className="w-px h-6 bg-[var(--color-border-light)] mx-1 hidden sm:block" />

                                                            <div className="flex gap-1 items-center">
                                                                <label className="relative inline-flex items-center cursor-pointer mr-1" title={campaign.status === 'active' ? 'Tạm dừng' : 'Kích hoạt'}>
                                                                    <input type="checkbox" className="sr-only peer" checked={campaign.status === 'active'} onChange={() => handleToggleStatus(campaign)} />
                                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500" />
                                                                </label>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => { setEditingCampaign(campaign); setOriginModalOpen(true); }}
                                                                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1.5"
                                                                    title="Sửa"
                                                                >
                                                                    <Settings2 className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => confirmDelete(campaign)}
                                                                    className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors p-1.5"
                                                                    title="Xóa"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </MktPanel>

                    {isOriginModalOpen && (
                        <VoucherCampaignModal
                            isOpen={isOriginModalOpen}
                            onClose={() => setOriginModalOpen(false)}
                            onSave={handleCreateOrUpdateCampaign}
                            initialData={editingCampaign}
                        />
                    )}

                    {selectedCampaignForCodes && (
                        <VoucherCodeManager
                            isOpen={!!selectedCampaignForCodes}
                            onClose={() => setSelectedCampaignForCodes(null)}
                            campaign={selectedCampaignForCodes}
                        />
                    )}

                    {selectedCampaignForApi && (
                        <VoucherApiEmbedModal
                            isOpen={!!selectedCampaignForApi}
                            onClose={() => setSelectedCampaignForApi(null)}
                            campaign={selectedCampaignForApi}
                        />
                    )}

                    <VoucherGuideModal
                        isOpen={isGuideModalOpen}
                        onClose={() => setGuideModalOpen(false)}
                    />

                    <ConfirmModal
                        isOpen={!!deleteTarget}
                        onClose={() => setDeleteTarget(null)}
                        onConfirm={executeDelete}
                        title="Cảnh báo xóa chiến dịch"
                        message={
                            <div className="space-y-4">
                                <p className={`text-sm leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-650'}`}>
                                    Khách hàng sẽ <span className="font-bold text-rose-600">không thể nhận phần thưởng</span> nếu nhấp vào nút trong Email chứa Voucher này nữa!
                                </p>
                                <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl p-4 border border-amber-200/40">
                                    <p className="text-xs font-medium text-amber-800 dark:text-amber-500">
                                        Vui lòng chuyển qua mục Chiến dịch (Email/Zalo) và xóa hoặc thay thế khối Voucher lỗi trước khi bấm nút xóa tại đây.
                                    </p>
                                </div>
                            </div>
                        }
                        confirmText="Vẫn Xóa"
                        cancelText="Suy nghĩ lại"
                        variant="danger"
                        isLoading={isDeleting}
                        isDarkTheme={isDark}
                    />
                </>
            )}
        </MktPage>
    );
};

export default Vouchers;
