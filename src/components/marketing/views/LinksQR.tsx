import React, { useState, useEffect, useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { QrCode, Link2, Plus, BarChart2, Edit3, Trash2, CheckCircle2, Globe, ArrowRight, Target, Scan, RefreshCw, FileText, ChevronDown, Check, Search, Lightbulb, Download, Save, Copy, PenLine } from 'lucide-react';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import ConfirmModal from '../components/common/ConfirmModal';
import PageHero from '../components/common/PageHero';
import SearchBox from '../components/common/SearchBox';
import LinkGuideModal from '../components/links/LinkGuideModal';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/storageAdapter';
import toast from 'react-hot-toast';
import { EXTERNAL_ASSET_BASE } from '../utils/config';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart as RechartsBarChart, Bar, Cell } from 'recharts';
import QRCodeStyling from '../shims/qrCodeStyling';
import QRDesignerModal from '../components/links/QRDesignerModal';
import { MktPanel, MktToolbar, MktEmpty, useDebouncedValue, usePageActive } from '../components/dashboard/MktLayout';

const getProxiedUrl = (url: string | undefined): string | undefined => {
    if (!url) return url;
    return url.replace(/^https?:\/\/automation\.ideas\.edu\.vn\/uploadss\//, '/uploadss/');
};

const getRoundedImage = (src: string, radiusPercent: number): Promise<string> => {
    return new Promise((resolve) => {
        if (!src) {
            resolve('');
            return;
        }
        if (radiusPercent <= 0) {
            resolve(src);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = Math.max(img.width, img.height, 512);
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve('');
                return;
            }

            ctx.clearRect(0, 0, size, size);
            const r = (size * Math.min(radiusPercent, 50)) / 100;

            ctx.beginPath();
            ctx.moveTo(r, 0);
            ctx.lineTo(size - r, 0);
            ctx.quadraticCurveTo(size, 0, size, r);
            ctx.lineTo(size, size - r);
            ctx.quadraticCurveTo(size, size, size - r, size);
            ctx.lineTo(r, size);
            ctx.quadraticCurveTo(0, size, 0, size - r);
            ctx.lineTo(0, r);
            ctx.quadraticCurveTo(0, 0, r, 0);
            ctx.closePath();
            ctx.clip();
            
            const imgAspect = img.width / img.height;
            let drawWidth = size;
            let drawHeight = size;
            let xOffset = 0;
            let yOffset = 0;
            
            if (imgAspect > 1) {
                drawWidth = size * imgAspect;
                xOffset = -(drawWidth - size) / 2;
            } else if (imgAspect < 1) {
                drawHeight = size / imgAspect;
                yOffset = -(drawHeight - size) / 2;
            }
            
            ctx.drawImage(img, xOffset, yOffset, drawWidth, drawHeight);
            
            try {
                resolve(canvas.toDataURL('image/png'));
            } catch (err) {
                console.error('Canvas toDataURL failed', err);
                resolve('');
            }
        };
        img.onerror = () => {
            resolve('');
        };
        img.src = src;
    });
};

const QRPreview = ({ configJson, value, size = 300 }: { configJson?: string, value: string, size?: number }) => {
    const ref = useRef<HTMLDivElement>(null);
    const [processedLogo, setProcessedLogo] = useState<string | undefined>(undefined);

    useEffect(() => {
        let isCurrent = true;
        try {
            const config = JSON.parse(configJson || '{}');
            if (!config.logo) {
                setProcessedLogo(undefined);
                return;
            }
            const proxiedUrl = getProxiedUrl(config.logo);
            if (!config.logoRadius || config.logoRadius <= 0) {
                setProcessedLogo(proxiedUrl);
                return;
            }
            getRoundedImage(proxiedUrl || '', config.logoRadius).then(res => {
                if (isCurrent) {
                    setProcessedLogo(res || undefined);
                }
            });
        } catch {
            setProcessedLogo(undefined);
        }
        return () => {
            isCurrent = false;
        };
    }, [configJson]);

    useEffect(() => {
        if (!ref.current) return;
        try {
            const config = JSON.parse(configJson || '{}');
            const qrCode = new QRCodeStyling({
                width: size,
                height: size,
                type: 'canvas',
                data: value,
                image: processedLogo,
                dotsOptions: {
                    color: config.fgGradientEnabled ? undefined : (config.fgColor || '#000000'),
                    gradient: config.fgGradientEnabled ? {
                        type: config.fgGradient.type,
                        rotation: (config.fgGradient.rotation * Math.PI) / 180,
                        colorStops: config.fgGradient.colorStops
                    } : undefined,
                    type: config.pattern || 'square'
                },
                backgroundOptions: {
                    color: config.isTransparent ? 'transparent' : (config.bgGradientEnabled ? undefined : (config.bgColor || '#ffffff')),
                    gradient: (!config.isTransparent && config.bgGradientEnabled) ? {
                        type: config.bgGradient.type,
                        rotation: (config.bgGradient.rotation * Math.PI) / 180,
                        colorStops: config.bgGradient.colorStops
                    } : undefined
                },
                imageOptions: {
                    crossOrigin: 'anonymous',
                    margin: config.logoMargin || 5,
                    imageSize: config.logoSize || 0.3
                },
                cornersSquareOptions: {
                    type: config.eyeFrame || 'square',
                    color: config.eyeFrameColor || '#000000'
                },
                cornersDotOptions: {
                    type: config.eyeBall || 'square',
                    color: config.eyeBallColor || '#000000'
                }
            });
            ref.current.innerHTML = '';
            qrCode.append(ref.current);
        } catch (e) {
            console.error('QR Render Error', e);
        }
    }, [configJson, value, size, processedLogo]);

    return <div ref={ref} className="rounded-xl overflow-hidden shadow-inner bg-slate-50 w-full h-full flex items-center justify-center [&>canvas]:w-full [&>canvas]:h-full" />;
};

export interface ShortLink {
    id: string;
    name: string;
    slug: string;
    target_url: string;
    is_survey_checkin: number;
    survey_id: string | null;
    qr_config_json: string;
    status?: 'active' | 'paused';
    access_pin?: string | null;
    submit_count?: number;
    created_at: string;
    stats?: { clicks: number, unique: number };
}

interface Survey {
    id: string;
    name: string;
}

export interface LinksQRHandle {
    openCreate: () => void;
    openGuide: () => void;
}

interface LinksQRProps {
    /** Rendered at the left of the panel toolbar (module tabs of the host page). */
    toolbarLeft?: React.ReactNode;
}

const LinksQR = forwardRef<LinksQRHandle, LinksQRProps>(({ toolbarLeft }, handleRef) => {
    const { isDark } = useTheme();
    const pageActive = usePageActive('/marketing/vouchers');
    const [links, setLinks] = useState<ShortLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'list' | 'report'>('list');
    const [selectedLink, setSelectedLink] = useState<ShortLink | null>(null);
    const [linkStats, setLinkStats] = useState<{ timeline: any[], devices: any[], os: any[], country?: any[] } | null>(null);
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search, 300);

    // Modal Add
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState<Partial<ShortLink>>({
        name: '', target_url: '', slug: '', is_survey_checkin: 0, survey_id: ''
    });

    const [linkToDelete, setLinkToDelete] = useState<ShortLink | null>(null);
    const [isDeleting, setIsDeleting]         = useState(false);
    const [settingsData, setSettingsData] = useState<Partial<ShortLink>>({});
    const [pinEnabled, setPinEnabled]     = useState(false);
    const [pinLength, setPinLength]       = useState<4|6>(4);
    const [isSurveyPickerOpen, setIsSurveyPickerOpen] = useState(false);
    const [surveySearch, setSurveySearch] = useState('');
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const surveysLoadedRef = useRef(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [isDesignerOpen, setIsDesignerOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    const [isEditingName, setIsEditingName] = useState(false);
    const [editNameValue, setEditNameValue] = useState('');

    const openCreate = () => {
        setFormData({ name: '', target_url: '', slug: '', is_survey_checkin: 0, survey_id: '' });
        setIsAddOpen(true);
    };

    useImperativeHandle(handleRef, () => ({
        openCreate,
        openGuide: () => setIsGuideOpen(true),
    }));

    useEffect(() => {
        fetchLinks();
    }, []);

    // Surveys are only needed by the create modal & report header → lazy load once.
    useEffect(() => {
        if ((isAddOpen || view === 'report') && !surveysLoadedRef.current) {
            surveysLoadedRef.current = true;
            fetchSurveys();
        }
    }, [isAddOpen, view]);

    const filteredLinks = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        if (!q) return links;
        return links.filter(l =>
            (l.name || '').toLowerCase().includes(q) ||
            (l.slug || '').toLowerCase().includes(q) ||
            (l.target_url || '').toLowerCase().includes(q)
        );
    }, [links, debouncedSearch]);

    const fetchLinks = async () => {
        setLoading(true);
        try {
            const res = await api.get<ShortLink[]>('links_qr?action=list');
            if (res.success) setLinks(Array.isArray(res.data) ? res.data : []);
        } catch (e) {
            console.error('[LinksQR] list failed', e);
            toast.error('Không tải được danh sách link');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveName = async () => {
        setIsEditingName(false);
        if (!selectedLink || !editNameValue || editNameValue === (selectedLink.name || selectedLink.slug)) return;
        
        try {
            const res = await api.put(`links_qr?action=update&id=${selectedLink.id}`, { name: editNameValue });
            if (res.success) {
                setSelectedLink({ ...selectedLink, name: editNameValue });
                toast.success('Đã cập nhật tên');
                fetchLinks();
            } else {
                toast.error('Lỗi khi cập nhật tên');
            }
        } catch (e) {
            toast.error('Lỗi hệ thống');
        }
    };

    const handleSaveSettings = async () => {
        if (!selectedLink) return;
        setIsSubmitting(true);
        try {
            const res = await api.put(`links_qr?action=update&id=${selectedLink.id}`, {
                target_url: settingsData.target_url,
                status: settingsData.status,
                access_pin: settingsData.access_pin || ''
            });
            if (res.success) {
                toast.success('Đã lưu cấu hình bảo mật / chuyển hướng');
                const updated = { ...selectedLink, ...settingsData };
                setSelectedLink(updated);
                setIsSettingsOpen(false);
                fetchLinks();
            } else {
                toast.error('Lỗi cập nhật cấu hình');
            }
        } catch (e) {
            toast.error('Bị lỗi trong lúc lưu thiết lập');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!linkToDelete) return;
        setIsDeleting(true);
        const res = await api.delete(`links_qr?action=delete&id=${linkToDelete.id}`);
        if (res.success) {
            setLinks(prev => prev.filter(l => l.id !== linkToDelete.id));
            toast.success("Xóa link thành công");
            if (selectedLink?.id === linkToDelete.id) { setSelectedLink(null); setView('list'); }
        } else {
            toast.error("Lỗi xóa link");
        }
        setIsDeleting(false);
        setLinkToDelete(null);
    };

    const fetchSurveys = async () => {
        const res = await api.get<any[]>('surveys');
        if (res.success) setSurveys(res.data || []);
    };

    const fetchLinkStats = async (id: string) => {
        setLinkStats(null);
        const res = await api.get<{ timeline: any[], devices: any[], os: any[], country?: any[] }>(`links_qr?action=stats&id=${id}`);
        if (res.success) setLinkStats(res.data);
    };

    const handleSave = async () => {
        if (!formData.name || !formData.target_url) {
            toast.error('Nhập đầy đủ Tên và URL đích');
            return;
        }
        if (isSubmitting) return; // [GUARD]
        setIsSubmitting(true);
        try {
            const res = await api.post<ShortLink>('links_qr?action=create', formData);
            if (res.success) {
                toast.success('Đã tạo Short Link');
                setIsAddOpen(false);
                // [OPTIMISTIC UI] Add to list immediately
                setLinks(prev => [...prev, res.data]);
            } else {
                toast.error(res.message || 'Lỗi khi tạo');
            }
        } catch {
            toast.error('Lỗi kết nối');
        } finally {
            setIsSubmitting(false); // [GUARD] Always unlock
        }
    };

    const copyLink = (slug: string) => {
        const link = `${EXTERNAL_ASSET_BASE}/go/${slug}`;
        navigator.clipboard.writeText(link);
        toast.success('Đã Copy Link!');
    };

    const updateQRConfig = (key: string, value: any) => {
        if (!selectedLink) return;
        try {
            const currentConfig = JSON.parse(selectedLink.qr_config_json || '{}');
            const newConfig = { ...currentConfig, [key]: value };
            setSelectedLink({ ...selectedLink, qr_config_json: JSON.stringify(newConfig) });
        } catch (e) {
            console.error('Config error', e);
        }
    };

    const saveQRConfig = async () => {
        if (!selectedLink || isSubmitting) return; // [GUARD]
        setIsSubmitting(true);
        try {
            const res = await api.put(`links_qr?action=update&id=${selectedLink.id}`, { qr_config_json: selectedLink.qr_config_json });
            if (res.success) {
                toast.success('Đã lưu thiết kế QR Code');
                setLinks(prev => prev.map(l => l.id === selectedLink.id ? { ...l, qr_config_json: selectedLink.qr_config_json } : l));
            } else {
                toast.error('Lỗi khi lưu');
            }
        } catch {
            toast.error('Lỗi kết nối');
        } finally {
            setIsSubmitting(false); // [GUARD] Always unlock
        }
    };

    const downloadQR = () => {
        const canvas = document.getElementById('qr-preview') as HTMLCanvasElement;
        if (!canvas) return;
        const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
        let downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `${selectedLink?.name || 'qr-code'}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    return (
        <div className="w-full flex flex-col gap-5 pb-10">
            {view === 'list' && (
                <>
                    {!toolbarLeft && (
                        <PageHero
                            title="Rút gọn Link & Mã QR Sự kiện"
                            subtitle="Tạo link rút gọn nội bộ, thiết kế QR Code chiến dịch và đo lường lượt quét theo thiết bị, vị trí."
                            actions={[
                                { label: 'Hướng dẫn sử dụng', icon: Lightbulb, onClick: () => setIsGuideOpen(true), primary: false },
                                { label: 'Tạo Link mới', icon: Plus, onClick: openCreate, primary: true }
                            ]}
                        />
                    )}

                    <MktPanel>
                        <MktToolbar
                            left={
                                toolbarLeft ?? (
                                    <div className="flex items-center gap-2">
                                        <QrCode className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
                                        <span className="text-sm font-bold text-[var(--color-text)]">
                                            Danh sách Link rút gọn & QR ({filteredLinks.length})
                                        </span>
                                    </div>
                                )
                            }
                            right={
                                <>
                                    <SearchBox
                                        value={search}
                                        onChange={setSearch}
                                        placeholder="Tìm theo tên, slug, URL đích..."
                                        className="w-64"
                                    />
                                    {toolbarLeft && (
                                        <>
                                            <Button variant="outline" size="md" icon={Lightbulb} onClick={() => setIsGuideOpen(true)}>
                                                Hướng dẫn
                                            </Button>
                                            <Button variant="primary" size="md" icon={Plus} onClick={openCreate}>
                                                Tạo Link mới
                                            </Button>
                                        </>
                                    )}
                                </>
                            }
                        />

                        <div className="p-4 lg:p-5">
                            {loading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="h-48 bg-[var(--color-bg)] rounded-[var(--radius-lg)] border border-[var(--color-border-light)] animate-pulse" />
                                    ))}
                                </div>
                            ) : filteredLinks.length === 0 ? (
                                <MktEmpty
                                    icon={QrCode}
                                    title={links.length === 0 ? 'Chưa có liên kết rút gọn nào' : 'Không tìm thấy liên kết phù hợp'}
                                    description={
                                        links.length === 0
                                            ? 'Tạo link rút gọn kèm mã QR sự kiện để theo dõi lượt quét theo thời gian thực, thiết bị và vị trí.'
                                            : 'Thử điều chỉnh từ khóa tìm kiếm hoặc tạo liên kết mới.'
                                    }
                                    actionLabel={links.length === 0 ? 'Tạo Link & QR ngay' : undefined}
                                    onAction={links.length === 0 ? openCreate : undefined}
                                />
                            ) : (
                                <div className="space-y-8">
                                    {Object.entries(filteredLinks.reduce((acc, link) => {
                                        const target = link.target_url;
                                        if (!acc[target]) acc[target] = [];
                                        acc[target].push(link);
                                        return acc;
                                    }, {} as { [key: string]: ShortLink[] })).map(([targetUrl, groupedLinks]) => {
                                        const totalClicks = groupedLinks.reduce((sum, l) => sum + (l.stats?.clicks || 0), 0);

                                        return (
                                            <div key={targetUrl} className="space-y-3">
                                                <div className="flex items-center justify-between px-1">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <h3 className="text-sm font-bold text-[var(--color-text)] truncate">
                                                            {groupedLinks[0].name || groupedLinks[0].slug}
                                                        </h3>
                                                        <span className="text-xs text-[var(--color-text-muted)] font-medium shrink-0">
                                                            ({groupedLinks.length} link)
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-[var(--color-text-muted)] shrink-0">
                                                        Tổng lượt click: <strong className="text-[var(--color-text)]">{totalClicks.toLocaleString()}</strong>
                                                    </span>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                                    {groupedLinks.map(link => (
                                                        <div
                                                            key={link.id}
                                                            className="group bg-[var(--color-surface)] rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4 flex flex-col hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-md)] transition-all relative overflow-hidden"
                                                        >
                                                            <div className="flex items-start gap-3 mb-4">
                                                                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center shrink-0">
                                                                    <QrCode className="w-5 h-5" />
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <h3 className="text-sm font-bold text-[var(--color-text)] truncate mb-1">
                                                                        {link.name || link.slug || 'Chưa đặt tên'}
                                                                    </h3>
                                                                    <a
                                                                        href={link.target_url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-bg)] border border-[var(--color-border-light)] hover:border-[var(--color-primary)] transition-colors"
                                                                        title={link.target_url}
                                                                    >
                                                                        <Link2 className="w-3 h-3 text-[var(--color-primary)] shrink-0" />
                                                                        <span className="text-[11px] font-semibold text-[var(--color-text-light)] truncate max-w-[180px]">
                                                                            {link.target_url}
                                                                        </span>
                                                                    </a>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => { e.stopPropagation(); setLinkToDelete(link); }}
                                                                    className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors p-1 shrink-0"
                                                                    title="Xóa Link"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>

                                                            <div className="bg-[var(--color-bg)] border border-[var(--color-border-light)] rounded-[var(--radius-md)] p-3 flex flex-col gap-1.5 mb-4 mt-auto">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-medium text-[var(--color-text-muted)]">Trạng thái</span>
                                                                    <span className={`font-semibold inline-flex items-center gap-1.5 ${link.status === 'paused' ? 'text-rose-600' : 'text-emerald-600'}`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${link.status === 'paused' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                                                                        {link.status === 'paused' ? 'Tạm khóa' : 'Hoạt động'}
                                                                    </span>
                                                                </div>
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-medium text-[var(--color-text-muted)]">Lượt click</span>
                                                                    <span className="font-bold text-[var(--color-text)]">
                                                                        {(link.stats?.clicks || 0).toLocaleString()} lượt
                                                                    </span>
                                                                </div>
                                                                {link.is_survey_checkin ? (
                                                                    <div className="flex justify-between items-center text-xs pt-1.5 border-t border-[var(--color-border-light)]">
                                                                        <span className="font-medium text-[var(--color-text-muted)] inline-flex items-center gap-1">
                                                                            <FileText className="w-3 h-3 text-[var(--color-primary)]" /> Khảo sát
                                                                        </span>
                                                                        <span className="font-bold text-[var(--color-primary)]">
                                                                            {(link.submit_count || 0).toLocaleString()} phản hồi
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex justify-between items-center text-xs">
                                                                        <span className="font-medium text-[var(--color-text-muted)]">Chế độ</span>
                                                                        <span className="font-semibold text-[var(--color-text-light)]">Chuyển hướng trực tiếp</span>
                                                                    </div>
                                                                )}
                                                                {link.access_pin && (
                                                                    <div className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-[var(--radius-sm)] mt-0.5 self-start inline-flex gap-1 items-center">
                                                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> Bảo vệ bằng PIN
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="flex gap-2">
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    size="md"
                                                                    icon={Copy}
                                                                    onClick={(e) => { e.stopPropagation(); copyLink(link.slug || link.id); }}
                                                                    className="flex-1"
                                                                >
                                                                    Sao chép link
                                                                </Button>
                                                                <Button
                                                                    type="button"
                                                                    variant="primary"
                                                                    size="md"
                                                                    icon={PenLine}
                                                                    onClick={(e) => { e.stopPropagation(); setSelectedLink(link); setView('report'); fetchLinkStats(link.id); }}
                                                                    className="flex-[1.3]"
                                                                >
                                                                    Thiết kế QR
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </MktPanel>
                </>
            )}

            {view === 'report' && selectedLink && (
                <div className="bg-white rounded-[32px] p-8 border border-slate-200 min-h-[800px]">
                    <div className="flex items-start justify-between mb-10">
                        <div className="flex items-center gap-4">
                            <div>
                                <button 
                                    onClick={() => setView('list')}
                                    className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-amber-600 uppercase tracking-widest transition-colors mb-3 group"
                                >
                                    <div className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-amber-100 flex items-center justify-center transition-colors">
                                        <ArrowRight className="w-3 h-3 rotate-180" />
                                    </div>
                                    QUAY LẠI
                                </button>
                                
                                <div className="flex items-center gap-3">
                                    {isEditingName ? (
                                        <input 
                                            type="text" 
                                            value={editNameValue} 
                                            onChange={e => setEditNameValue(e.target.value)} 
                                            onBlur={handleSaveName}
                                            onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                                            className="text-2xl font-black text-slate-800 uppercase tracking-tight bg-slate-50 border border-amber-400 focus:ring-2 focus:ring-amber-200 rounded-xl px-3 py-1 outline-none w-full min-w-[250px]"
                                            autoFocus
                                        />
                                    ) : (
                                        <>
                                            <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{selectedLink.name || selectedLink.slug}</h2>
                                            <button 
                                                onClick={() => { setIsEditingName(true); setEditNameValue(selectedLink.name || selectedLink.slug); }} 
                                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-200 shadow-sm hover:shadow"
                                                title="Sửa tên chiến dịch"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                    <span className="px-3 py-1 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full border border-amber-200/60 uppercase">/go/{selectedLink.slug}</span>
                                    <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                    <span className="text-[11px] text-slate-400 font-mono italic opacity-70">Domain Link Mapping</span>
                                    
                                    {selectedLink.is_survey_checkin && selectedLink.survey_id && (
                                        <>
                                            <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50 border border-indigo-200/60 text-indigo-700 rounded-lg shadow-sm">
                                                <FileText className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                                    Khảo sát: {surveys.find(s => s.id === selectedLink.survey_id)?.name || 'Đã liên kết'}
                                                </span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="hidden md:flex flex-col items-end gap-2">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Target URL (Link gốc)</span>
                            <a 
                                href={selectedLink.target_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="px-4 py-1.5 bg-amber-50/50 hover:bg-amber-50 border border-amber-200/60 rounded-full flex items-center gap-2 max-w-sm cursor-pointer transition-colors group"
                                title="Mở link"
                            >
                                <Globe className="w-3.5 h-3.5 text-amber-600 transition-transform group-hover:rotate-12" />
                                <span className="text-[11px] font-bold text-amber-900 truncate">{selectedLink.target_url}</span>
                            </a>
                            {selectedLink.created_at && (
                                <span className="text-[10px] font-bold text-slate-400 mt-1">
                                    Tạo ngày: {new Date(selectedLink.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                </span>
                            )}
                            <div className="mt-2 flex justify-end">
                                <button 
                                    onClick={() => {
                                        setSettingsData({
                                            target_url: selectedLink.target_url,
                                            status: selectedLink.status || 'active',
                                            access_pin: selectedLink.access_pin || ''
                                        });
                                        const existingPin = selectedLink.access_pin || '';
                                        setPinEnabled(!!existingPin);
                                        setPinLength(existingPin.length === 6 ? 6 : 4);
                                        setIsSettingsOpen(true);
                                    }}
                                    className="px-3 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <Target className="w-3.5 h-3.5" /> NÂNG CAO & BẢO MẬT
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* QR Section - Moved to TOP */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12 items-stretch">
                        {/* Designer Tools */}
                        <div className="lg:col-span-5 flex flex-col">
                            <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100 flex-1 flex flex-col justify-center">
                                <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Tùy chỉnh QR</h3>
                                <p className="text-[11px] text-slate-500 mt-1 font-medium italic">Thiết kế mã QR Campaign trở nên chuyên nghiệp và khác biệt.</p>
                                
                                <div className="mt-8 space-y-4">
                                    <button 
                                        onClick={() => setIsDesignerOpen(true)}
                                        className="w-full flex items-center justify-between p-5 bg-white border-2 border-slate-100 rounded-3xl hover:border-amber-400 hover:shadow-xl hover:shadow-amber-100 transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-[18px] bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-200/50 group-hover:scale-110 transition-transform">
                                                <Edit3 className="w-5 h-5" />
                                            </div>
                                            <div className="text-left">
                                                <span className="block text-[15px] font-black text-slate-800 leading-tight">Chỉnh sửa Design</span>
                                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-0.5">Professional Designer</span>
                                            </div>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center group-hover:bg-amber-500 group-hover:border-amber-500 group-hover:text-white transition-all text-slate-400">
                                            <ArrowRight className="w-4 h-4" />
                                        </div>
                                    </button>

                                    <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-100">
                                        <div className="flex gap-3">
                                            <Lightbulb className="w-5 h-5 text-amber-600 shrink-0" />
                                            <p className="text-[11px] text-amber-700/80 font-bold leading-relaxed">
                                                Lưu ý quan trọng: Hãy chọn màu hoa văn có độ tương phản cao với màu nền để các thiết bị quét nhanh hơn.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Preview Window plain design */}
                        <div 
                            className="lg:col-span-7 flex flex-col items-center justify-center p-8 bg-slate-50/40 rounded-[32px] border border-slate-100 relative overflow-hidden h-full min-h-[400px]"
                            style={{ backgroundImage: `radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)`, backgroundSize: `24px 24px` }}
                        >
                            <div className="bg-white p-12 rounded-[40px] shadow-xl shadow-slate-200/40 flex flex-col items-center border border-slate-100/80 z-10">
                                {(() => {
                                    const cfg = JSON.parse(selectedLink.qr_config_json || '{}');
                                    const hasFrame = cfg.frameId && cfg.frameId !== 'none';
                                    const qrValue = cfg.useDirectLink && selectedLink.target_url ? selectedLink.target_url : `${EXTERNAL_ASSET_BASE}/go/${selectedLink.slug}`;
                                    
                                    return (
                                        <div 
                                            className="transition-all duration-500"
                                            style={{
                                                border: hasFrame ? `10px solid ${cfg.frameColor || '#4f46e5'}` : 'none',
                                                borderRadius: '28px',
                                                padding: hasFrame ? '20px 16px 40px' : '0',
                                                background: hasFrame ? (cfg.frameColor || '#4f46e5') : 'transparent',
                                                position: 'relative'
                                            }}
                                        >
                                            <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                                                <QRPreview 
                                                    configJson={selectedLink.qr_config_json}
                                                    value={qrValue}
                                                    size={240}
                                                />
                                            </div>
                                            {hasFrame && (
                                                <div className="absolute bottom-3 left-0 right-0 text-center">
                                                    <span className="text-[10px] font-black text-white tracking-[0.3em] uppercase">{cfg.frameText || 'SCAN ME!'}</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })()}

                                <div className="mt-8 text-center w-full max-w-[200px]">
                                    <button 
                                        onClick={async () => {
                                            try {
                                                const config = JSON.parse(selectedLink.qr_config_json || '{}');
                                                const proxiedUrl = getProxiedUrl(config.logo);
                                                
                                                let finalLogo = proxiedUrl;
                                                if (config.logo && config.logoRadius && config.logoRadius > 0) {
                                                    finalLogo = await getRoundedImage(proxiedUrl || '', config.logoRadius);
                                                }
 
                                                const qrValue = config.useDirectLink && selectedLink.target_url ? selectedLink.target_url : `${EXTERNAL_ASSET_BASE}/go/${selectedLink.slug}`;
 
                                                const qr = new QRCodeStyling({
                                                    data: qrValue,
                                                    width: 1000,
                                                    height: 1000,
                                                    type: 'canvas',
                                                    margin: 20,
                                                    image: finalLogo,
                                                    dotsOptions: {
                                                        color: config.fgGradientEnabled ? undefined : (config.fgColor || '#000000'),
                                                        gradient: config.fgGradientEnabled && config.fgGradient ? {
                                                            type: config.fgGradient.type,
                                                            rotation: (config.fgGradient.rotation * Math.PI) / 180,
                                                            colorStops: config.fgGradient.colorStops
                                                        } : undefined,
                                                        type: config.pattern || 'square'
                                                    },
                                                    backgroundOptions: {
                                                        color: config.isTransparent ? 'transparent' : (config.bgGradientEnabled ? undefined : (config.bgColor || '#ffffff')),
                                                        gradient: (!config.isTransparent && config.bgGradientEnabled && config.bgGradient) ? {
                                                            type: config.bgGradient.type,
                                                            rotation: (config.bgGradient.rotation * Math.PI) / 180,
                                                            colorStops: config.bgGradient.colorStops
                                                        } : undefined
                                                    },
                                                    imageOptions: {
                                                        crossOrigin: 'anonymous',
                                                        margin: config.logoMargin || 5,
                                                        imageSize: config.logoSize || 0.3
                                                    },
                                                    cornersSquareOptions: {
                                                        type: config.eyeFrame || 'square',
                                                        color: config.eyeFrameColor || '#000000'
                                                    },
                                                    cornersDotOptions: {
                                                        type: config.eyeBall || 'square',
                                                        color: config.eyeBallColor || '#000000'
                                                    }
                                                });
                                                qr.download({ name: `QR_${selectedLink.slug}`, extension: 'png' });
                                            } catch (e) {
                                                console.error('Download QR err', e);
                                            }
                                        }}
                                        className="w-full h-10 bg-[var(--color-primary)] hover:opacity-90 text-white rounded-[var(--radius-md)] text-xs font-semibold transition-all shadow-[var(--shadow-xs)] flex items-center justify-center gap-2"
                                    >
                                        <Download className="w-4 h-4" /> Tải xuống mã QR
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* REPORT - Moved to BOTTOM */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] text-[var(--color-primary)] flex items-center justify-center"><BarChart2 className="w-4 h-4" /></div>
                            <h3 className="text-sm font-bold text-[var(--color-text)]">Thống kê truy cập (Realtime)</h3>
                        </div>

                        {linkStats ? (
                            <div className="flex flex-col gap-6">
                                <div className="bg-[var(--color-surface)] p-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-xs)]">
                                    <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Lượt Click theo mốc thời gian</h4>
                                    <div className="h-[256px] w-full">
                                        {pageActive ? (
                                            <ResponsiveContainer width="100%" height={256} minWidth={0}>
                                                <AreaChart data={linkStats.timeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                                    <defs>
                                                        <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.28}/>
                                                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} dy={10} />
                                                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: '#94a3b8'}} />
                                                    <Tooltip cursor={{ stroke: '#cbd5e1', strokeWidth: 1 }} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '10px 14px' }} />
                                                    <Area type="monotone" dataKey="clicks" stroke="var(--color-primary)" strokeWidth={2.5} fillOpacity={1} fill="url(#colorClicks)" activeDot={{ r: 5, strokeWidth: 0, fill: 'var(--color-primary)' }} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-[var(--color-surface)] p-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-xs)] flex flex-col justify-between">
                                        <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Phân loại Thiết bị</h4>
                                        <div className="h-[180px] w-full">
                                            {linkStats.devices.length && pageActive ? (
                                                <ResponsiveContainer width="100%" height={180} minWidth={0}>
                                                    <RechartsBarChart data={linkStats.devices} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                                                        <XAxis type="number" hide />
                                                        <YAxis dataKey="device_type" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} width={90} />
                                                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                                                        <Bar dataKey="clicks" radius={[0, 8, 8, 0]} barSize={20} label={{ position: 'right', fill: '#BD1D2D', fontSize: 11, fontWeight: 800 }}>
                                                            {linkStats.devices.map((_, index) => (
                                                                <Cell key={`cell-${index}`} fill={['#BD1D2D', '#dc2626', '#f43f5e'][index % 3]} />
                                                            ))}
                                                        </Bar>
                                                    </RechartsBarChart>
                                                </ResponsiveContainer>
                                            ) : <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-xs font-medium">Chưa có dữ liệu thiết bị</div>}
                                        </div>
                                    </div>
                                    <div className="bg-[var(--color-surface)] p-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-xs)] flex flex-col justify-between">
                                        <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Hệ điều hành</h4>
                                        <div className="h-[180px] w-full">
                                            {linkStats.os.length && pageActive ? (
                                                <ResponsiveContainer width="100%" height={180} minWidth={0}>
                                                    <RechartsBarChart data={linkStats.os} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                                                        <XAxis type="number" hide />
                                                        <YAxis dataKey="os" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} width={90} />
                                                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                                                        <Bar dataKey="clicks" radius={[0, 8, 8, 0]} barSize={20} label={{ position: 'right', fill: '#BD1D2D', fontSize: 11, fontWeight: 800 }}>
                                                            {linkStats.os.map((_, index) => (
                                                                <Cell key={`cell-${index}`} fill={['#BD1D2D', '#e11d48', '#fb7185', '#fda4af'][index % 4]} />
                                                            ))}
                                                        </Bar>
                                                    </RechartsBarChart>
                                                </ResponsiveContainer>
                                            ) : <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-xs font-medium">Chưa có dữ liệu hệ điều hành</div>}
                                        </div>
                                    </div>
                                    <div className="bg-[var(--color-surface)] p-5 rounded-[var(--radius-lg)] border border-[var(--color-border)] shadow-[var(--shadow-xs)] flex flex-col justify-between">
                                        <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider mb-4">Quốc gia / Khu vực</h4>
                                        <div className="h-[180px] w-full">
                                            {linkStats.country && linkStats.country.length && pageActive ? (
                                                <ResponsiveContainer width="100%" height={180} minWidth={0}>
                                                    <RechartsBarChart data={linkStats.country} layout="vertical" margin={{ top: 0, right: 40, left: 0, bottom: 0 }}>
                                                        <XAxis type="number" hide />
                                                        <YAxis dataKey="country" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }} width={90} />
                                                        <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: 12, border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                                                        <Bar dataKey="clicks" radius={[0, 8, 8, 0]} barSize={20} label={{ position: 'right', fill: '#0ea5e9', fontSize: 11, fontWeight: 800 }}>
                                                            {linkStats.country.map((_, index) => (
                                                                <Cell key={`cell-${index}`} fill={['#06b6d4', '#0ea5e9', '#3b82f6', '#14b8a6'][index % 4]} />
                                                            ))}
                                                        </Bar>
                                                    </RechartsBarChart>
                                                </ResponsiveContainer>
                                            ) : <div className="h-full flex items-center justify-center text-[var(--color-text-muted)] text-xs font-medium">Chưa có dữ liệu quốc gia</div>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <MktEmpty icon={RefreshCw} title="Đang tải dữ liệu báo cáo..." />
                        )}
                    </div>
                </div>
            )}

            <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Tạo Link Tracking" size="md" isDarkTheme={isDark} footer={<div className="flex justify-between w-full"><Button variant="ghost" onClick={() => setIsAddOpen(false)}>Hủy</Button><Button onClick={handleSave} isLoading={isSubmitting} icon={CheckCircle2}>Tạo Link</Button></div>}>
                <div className="space-y-5 py-2">
                    <Input label="Tên chiến dịch / Link" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="VD: Link báo giá Tết..." autoFocus />
                    <Input label="URL Đích (Redirect)" value={formData.target_url || ''} onChange={e => setFormData({ ...formData, target_url: e.target.value })} placeholder="https://..." />

                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 mt-6">
                        <div className="flex justify-between items-center mb-4 cursor-pointer select-none" onClick={() => setFormData({ ...formData, is_survey_checkin: formData.is_survey_checkin ? 0 : 1 })}>
                            <div>
                                <h5 className="text-sm font-bold text-indigo-900 flex items-center gap-2"><Scan className="w-4 h-4" />Bật "Cổng kiểm soát" (Gateway)</h5>
                                <p className="text-[10px] text-indigo-700/70">Bắt buộc nhập form (Survey) trước khi đi đến Web đích.</p>
                            </div>
                            <div className={`w-10 h-5 rounded-full flex items-center p-0.5 transition-colors ${formData.is_survey_checkin ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'}`}><div className="w-4 h-4 bg-white rounded-full"></div></div>
                        </div>
                        {!!formData.is_survey_checkin && (
                            <div className={`animate-in fade-in slide-in-from-top-2 pt-2 transition-all ${isSurveyPickerOpen ? 'mb-[240px]' : ''}`}>
                                <label className="text-[11px] font-bold text-indigo-900 uppercase tracking-widest block mb-2">Chọn Khảo sát (Form) hiển thị</label>
                                <div className="relative">
                                    <div 
                                        className="w-full flex items-center justify-between p-3 bg-white border-2 border-indigo-200 rounded-2xl cursor-pointer hover:border-indigo-400 transition-colors"
                                        onClick={() => setIsSurveyPickerOpen(!isSurveyPickerOpen)}
                                    >
                                        {formData.survey_id && surveys.find(s => s.id === formData.survey_id) ? (
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg"><FileText className="w-4 h-4" /></div>
                                                <span className="text-sm font-bold text-slate-700">{surveys.find(s => s.id === formData.survey_id)?.name}</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-3 text-slate-400">
                                                <div className="p-1.5 bg-slate-100 rounded-lg"><FileText className="w-4 h-4" /></div>
                                                <span className="text-sm font-medium">-- Chọn Form / Survey --</span>
                                            </div>
                                        )}
                                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                                    </div>

                                    {isSurveyPickerOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsSurveyPickerOpen(false)}></div>
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95">
                                                <div className="p-2 border-b border-slate-100 flex gap-2 items-center bg-slate-50">
                                                    <div className="relative flex-1">
                                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input 
                                                            className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500" 
                                                            placeholder="Tìm nhanh form..." 
                                                            value={surveySearch}
                                                            onChange={(e) => setSurveySearch(e.target.value)}
                                                        />
                                                    </div>
                                                    <Button size="sm" variant="outline" icon={Plus} className="shrink-0 text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => window.open('/', '_blank')}>Tạo Mới</Button>
                                                </div>
                                                <div className="max-h-56 overflow-y-auto custom-scrollbar p-2 space-y-1">
                                                    {surveys.filter(s => s.name.toLowerCase().includes(surveySearch.toLowerCase())).length > 0 ? (
                                                        surveys.filter(s => s.name.toLowerCase().includes(surveySearch.toLowerCase())).map(s => (
                                                            <div 
                                                                key={s.id}
                                                                onClick={() => { setFormData({...formData, survey_id: s.id}); setIsSurveyPickerOpen(false); }}
                                                                className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-colors ${s.id === formData.survey_id ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                                                            >
                                                                <div className="flex items-center gap-3 max-w-[85%]">
                                                                    <div className={`p-1.5 rounded-lg shrink-0 ${s.id === formData.survey_id ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                                                                        <FileText className="w-4 h-4" />
                                                                    </div>
                                                                    <span className={`text-sm truncate ${s.id === formData.survey_id ? 'font-bold text-indigo-900' : 'font-medium text-slate-600'}`}>{s.name}</span>
                                                                </div>
                                                                {s.id === formData.survey_id && <Check className="w-4 h-4 text-indigo-600 shrink-0" />}
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-4 text-center text-slate-400 text-xs">Không tìm thấy form nào</div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            <Modal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} title="Nâng cao & Bảo mật" size="md" isDarkTheme={isDark} footer={<div className="flex justify-between w-full"><Button variant="ghost" onClick={() => setIsSettingsOpen(false)}>Hủy</Button><Button onClick={handleSaveSettings} isLoading={isSubmitting} icon={Save}>Cập nhật lưu</Button></div>}>
                <div className="space-y-6 py-2">
                    <Input 
                        label="URL Đích (Redirect target)" 
                        value={settingsData.target_url || ''} 
                        onChange={e => setSettingsData({ ...settingsData, target_url: e.target.value })} 
                        placeholder="https://..." 
                    />
                    
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between">
                        <div>
                            <h4 className="text-sm font-bold text-slate-800">Trạng thái hoạt động</h4>
                            <p className="text-[11px] text-slate-500">Tạm dừng truy cập cho chiến dịch này.</p>
                        </div>
                        <div 
                            className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${settingsData.status !== 'paused' ? 'bg-emerald-500 justify-end' : 'bg-slate-300 justify-start'}`}
                            onClick={() => setSettingsData({...settingsData, status: settingsData.status === 'paused' ? 'active' : 'paused'})}
                        >
                            <div className="w-4 h-4 bg-white rounded-full shadow-sm"></div>
                        </div>
                    </div>

                    <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 space-y-3">
                        {/* Header + toggle */}
                        <div className="flex items-center justify-between">
                            <div className="flex gap-2 items-center">
                                <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg"><Target className="w-4 h-4" /></div>
                                <div>
                                    <h4 className="text-sm font-bold text-amber-900">Mật khẩu PIN Access</h4>
                                    <p className="text-[11px] text-amber-700/80">Người quét QR phải nhập đúng PIN để mở.</p>
                                </div>
                            </div>
                            {/* Toggle switch */}
                            <div
                                className={`w-12 h-6 rounded-full flex items-center p-1 cursor-pointer transition-colors ${pinEnabled ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'}`}
                                onClick={() => {
                                    const next = !pinEnabled;
                                    setPinEnabled(next);
                                    if (!next) setSettingsData(sd => ({ ...sd, access_pin: '' }));
                                }}
                            >
                                <div className="w-4 h-4 bg-white rounded-full shadow-sm" />
                            </div>
                        </div>

                        {/* PIN config — only when enabled */}
                        {pinEnabled && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-3 pt-2">
                                {/* 4 or 6 digit selector */}
                                <div className="flex gap-2">
                                    {([4, 6] as const).map(len => (
                                        <button
                                            key={len}
                                            onClick={() => {
                                                setPinLength(len);
                                                // Trim or pad existing pin to match new length
                                                const cur = (settingsData.access_pin || '').replace(/\D/g, '');
                                                setSettingsData(sd => ({ ...sd, access_pin: cur.slice(0, len).padEnd(0, '') }));
                                            }}
                                            className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                                                pinLength === len
                                                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                                    : 'bg-white text-amber-700 border-amber-200 hover:border-amber-400'
                                            }`}
                                        >
                                            {len} chữ số
                                        </button>
                                    ))}
                                </div>

                                {/* PIN digit boxes */}
                                <div className="flex gap-2 justify-center py-1">
                                    {Array.from({ length: pinLength }).map((_, idx) => (
                                        <input
                                            key={idx}
                                            id={`pin-box-${idx}`}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            value={(settingsData.access_pin || '')[idx] || ''}
                                            onChange={e => {
                                                const digit = e.target.value.replace(/\D/g, '').slice(-1);
                                                const cur = (settingsData.access_pin || '').padEnd(pinLength, ' ').split('');
                                                cur[idx] = digit;
                                                const newPin = cur.join('').replace(/ /g, '').slice(0, pinLength);
                                                setSettingsData(sd => ({ ...sd, access_pin: newPin }));
                                                // Auto-advance
                                                if (digit && idx < pinLength - 1) {
                                                    document.getElementById(`pin-box-${idx + 1}`)?.focus();
                                                }
                                            }}
                                            onKeyDown={e => {
                                                if (e.key === 'Backspace' && !(settingsData.access_pin || '')[idx] && idx > 0) {
                                                    document.getElementById(`pin-box-${idx - 1}`)?.focus();
                                                }
                                            }}
                                            className="w-12 h-14 text-center text-2xl font-black text-amber-900 bg-white border-2 border-amber-300 rounded-xl outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all shadow-sm"
                                        />
                                    ))}
                                </div>
                                <p className="text-[10px] text-amber-600/70 text-center font-medium">
                                    PIN {pinLength} số — sẽ hiện {pinLength} ô nhập cho người quét QR
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            {/* ── Delete confirm modal ──────────────────────────────────────── */}
            <ConfirmModal
                isOpen={!!linkToDelete}
                onClose={() => setLinkToDelete(null)}
                onConfirm={handleDeleteConfirm}
                title="Xóa link này?"
                message={
                    <>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{linkToDelete?.name || linkToDelete?.slug}</span> sẽ bị xóa vĩnh viễn.
                    </>
                }
                confirmText="Xóa"
                variant="danger"
                isLoading={isDeleting}
                isDarkTheme={isDark}
            />

            <LinkGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
            
            {selectedLink && (
                <QRDesignerModal
                    isOpen={isDesignerOpen}
                    onClose={() => setIsDesignerOpen(false)}
                    linkUrl={`${EXTERNAL_ASSET_BASE}/go/${selectedLink.slug}`}
                    linkName={selectedLink.name}
                    initialConfig={selectedLink.qr_config_json}
                    onSave={async (configJson) => {
                        try {
                            const linkToUpdate = { ...selectedLink, qr_config_json: configJson };
                            setSelectedLink(linkToUpdate);
                            
                            // Persist to database immediately
                            setIsSubmitting(true);
                            const res = await api.put(`links_qr?action=update&id=${selectedLink.id}`, { 
                                qr_config_json: configJson 
                            });
                            
                            if (res.success) {
                                toast.success('Đã lưu thiết kế QR Code chuyên nghiệp');
                                fetchLinks(); // Refresh list to reflect changes
                                setIsDesignerOpen(false);
                            } else {
                                toast.error('Lỗi khi lưu vào hệ thống');
                            }
                        } catch (err) {
                            toast.error('Lỗi lưu cấu hình');
                        } finally {
                            setIsSubmitting(false);
                        }
                    }}
                />
            )}
        </div>
    );
});
LinksQR.displayName = 'LinksQR';

export default LinksQR;
// Dual value declarations for verbatimModuleSyntax compatibility
export const ShortLink: any = undefined;
