import { EXTERNAL_ASSET_BASE } from '../../utils/config';
import React, { useState, useEffect, useCallback } from 'react';
import {
    Send, CheckCircle2, CalendarClock, FileText, Loader2,
    GitMerge, Play, Trash2, ChevronRight, Clock, PieChart, PauseCircle,
    Edit2, Check, X, SearchX, Plus
} from 'lucide-react';
import { Campaign, CampaignStatus } from '../../types';
import { useNavigate } from 'react-router-dom';
import Skeleton from '../common/Skeleton';
import { Avatar } from '../../../ui/Avatar';

/* -------------------------------------------------------------------------- */
/*  Performance health (semantic colours only: emerald / amber / rose)        */
/* -------------------------------------------------------------------------- */
export interface PerformanceHealth {
    tier: 'excellent' | 'good' | 'average' | 'poor' | 'sending' | 'zns';
    /** Solid bar colour class (no gradients). */
    barClass: string;
    textClass: string;
    label: string;
    percentText: string;
}

const HEALTH_STYLE: Record<PerformanceHealth['tier'], { barClass: string; textClass: string }> = {
    excellent: { barClass: 'bg-emerald-500', textClass: 'text-emerald-600' },
    good: { barClass: 'bg-emerald-400', textClass: 'text-emerald-600' },
    average: { barClass: 'bg-amber-500', textClass: 'text-amber-600' },
    poor: { barClass: 'bg-rose-500', textClass: 'text-rose-600' },
    sending: { barClass: 'bg-[var(--color-primary)]', textClass: 'text-[var(--color-primary)]' },
    zns: { barClass: 'bg-[var(--color-text-muted)]', textClass: 'text-[var(--color-text-secondary)]' },
};

const buildHealth = (tier: PerformanceHealth['tier'], label: string, percentText: string): PerformanceHealth => ({
    tier, label, percentText, ...HEALTH_STYLE[tier]
});

/**
 * Multi-tier open-rate grading (thresholds depend on campaign size):
 *  - sent >= 1000 : >=20% excellent, >=12% good, >=6% average, else poor
 *  - sent >= 100  : >=35% excellent, >=20% good, >=10% average, else poor
 *  - sent  < 100  : >=65% excellent, >=35% average, else poor
 */
export function getCampaignPerformanceHealth(
    sentCount: number,
    openedCount: number,
    isSending: boolean,
    totalTargetAudience?: number,
    type?: string,
    _isFlow?: boolean
): PerformanceHealth {
    if (isSending) {
        const pct = totalTargetAudience && totalTargetAudience > 0 ? Math.min(100, Math.round((sentCount / totalTargetAudience) * 100)) : 0;
        return buildHealth('sending', 'Tiến độ gửi', `${pct}%`);
    }
    if (type === 'zalo_zns') {
        // 300đ / tin là đơn giá ZNS ước tính — hiển thị rõ là "ước tính".
        return buildHealth('zns', 'Chi phí ước tính', `${(sentCount * 300).toLocaleString('vi-VN')}đ`);
    }
    if (sentCount <= 0) return buildHealth('poor', 'Tỷ lệ mở', '0%');

    const openRate = Math.round((openedCount / sentCount) * 100);
    const pct = `${openRate}%`;
    let tier: PerformanceHealth['tier'];
    if (sentCount >= 1000) tier = openRate >= 20 ? 'excellent' : openRate >= 12 ? 'good' : openRate >= 6 ? 'average' : 'poor';
    else if (sentCount >= 100) tier = openRate >= 35 ? 'excellent' : openRate >= 20 ? 'good' : openRate >= 10 ? 'average' : 'poor';
    else tier = openRate >= 65 ? 'excellent' : openRate >= 35 ? 'average' : 'poor';
    return buildHealth(tier, 'Tỷ lệ mở', pct);
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */
const fmtDateTime = (iso?: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.toLocaleDateString('vi-VN')} ${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
};

const getCreator = (c: Campaign) => {
    const creator = (c.config as any)?.creator;
    return { name: (creator?.name as string) || 'Hệ thống', picture: creator?.picture as string | undefined };
};

const isEditableStatus = (c: Campaign) => c.status === CampaignStatus.DRAFT || c.status === CampaignStatus.SCHEDULED;

const PILL = 'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap border';

const StatusPill: React.FC<{ c: Campaign; onOpenFlow?: (flowId: string) => void }> = ({ c, onOpenFlow }) => {
    const isSent = c.status === CampaignStatus.SENT;
    if (c.status === CampaignStatus.WAITING_FLOW) {
        return <span className={`${PILL} bg-amber-50 text-amber-700 border-amber-200`}><GitMerge className="w-3 h-3" /> Chờ Flow</span>;
    }
    if (c.status === CampaignStatus.SENDING) {
        return <span className={`${PILL} bg-[var(--color-primary-light)] text-[var(--color-primary)] border-transparent`}><Loader2 className="w-3 h-3 animate-spin" /> Đang gửi</span>;
    }
    if (c.status === CampaignStatus.PAUSED) {
        return <span className={`${PILL} bg-amber-50 text-amber-700 border-amber-200`} title="Chiến dịch đang tạm dừng"><PauseCircle className="w-3 h-3" /> Tạm dừng</span>;
    }
    if (isSent && c.linkedFlow?.id) {
        return (
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenFlow?.(c.linkedFlow!.id); }}
                className={`${PILL} bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition-colors`}
                title={`Đã gửi · Flow: ${c.linkedFlow.name}`}
            >
                <GitMerge className="w-3 h-3" /> Đã gửi · Flow
            </button>
        );
    }
    if (isSent) {
        return <span className={`${PILL} bg-emerald-50 text-emerald-700 border-emerald-200`}><CheckCircle2 className="w-3 h-3" /> Đã gửi</span>;
    }
    if (c.status === CampaignStatus.SCHEDULED) {
        return <span className={`${PILL} bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)]`}><Clock className="w-3 h-3" /> Đã lên lịch</span>;
    }
    return <span className={`${PILL} bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)]`}><FileText className="w-3 h-3" /> Bản nháp</span>;
};

const TypeIcon: React.FC<{ c: Campaign; size?: number }> = ({ c, size = 32 }) => {
    const box = `rounded-[var(--radius-md)] flex items-center justify-center shrink-0 border border-[var(--color-border)] bg-[var(--color-bg)]`;
    if (c.type === 'zalo_zns') {
        return (
            <div className={`${box} p-1.5 bg-[var(--color-surface)]`} style={{ width: size, height: size }}>
                <img src={`${EXTERNAL_ASSET_BASE}/imgs/zalolog.png`} alt="Zalo" className="w-full h-full object-contain" loading="lazy" />
            </div>
        );
    }
    const isSending = c.status === CampaignStatus.SENDING;
    const Icon = isSending ? Loader2
        : c.linkedFlow ? GitMerge
            : c.status === CampaignStatus.SENT ? Send
                : c.status === CampaignStatus.SCHEDULED ? CalendarClock
                    : c.status === CampaignStatus.PAUSED ? PauseCircle
                        : FileText;
    const tone = isSending || c.status === CampaignStatus.SENT || c.linkedFlow ? 'text-[var(--color-primary)]' : 'text-[var(--color-text-muted)]';
    return (
        <div className={box} style={{ width: size, height: size }}>
            <Icon className={`w-4 h-4 ${tone} ${isSending ? 'animate-spin' : ''}`} />
        </div>
    );
};

const PerformanceCell: React.FC<{ c: Campaign }> = ({ c }) => {
    const isSending = c.status === CampaignStatus.SENDING;
    const isSent = c.status === CampaignStatus.SENT;
    if (!isSent && !isSending) return <span className="text-xs text-[var(--color-text-muted)]">—</span>;
    const sentCount = c.stats?.sent || 0;
    const opened = c.stats?.opened || 0;
    const health = getCampaignPerformanceHealth(sentCount, opened, isSending, c.totalTargetAudience, c.type, !!c.linkedFlow);
    const width = isSending
        ? (c.totalTargetAudience ? Math.min((sentCount / c.totalTargetAudience) * 100, 100) : 0)
        : c.type === 'zalo_zns' ? 100 : Math.min(sentCount > 0 ? (opened / sentCount) * 100 : 0, 100);
    const detail = isSending
        ? `${sentCount.toLocaleString('vi-VN')} / ${(c.totalTargetAudience || 0).toLocaleString('vi-VN')}`
        : c.type === 'zalo_zns' ? `${sentCount.toLocaleString('vi-VN')} tin` : `${opened.toLocaleString('vi-VN')} / ${sentCount.toLocaleString('vi-VN')}`;
    return (
        <div className="w-full min-w-[140px]">
            <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">{health.label}</span>
                <span className="text-xs whitespace-nowrap">
                    <span className="text-[var(--color-text-secondary)]">{detail}</span>
                    <span className={`ml-1 font-semibold ${health.textClass}`}>{health.percentText}</span>
                </span>
            </div>
            <div className="h-1.5 w-full bg-[var(--color-bg)] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-[width] duration-500 ${health.barClass}`} style={{ width: `${width}%` }} />
            </div>
        </div>
    );
};

const ScheduleCell: React.FC<{ c: Campaign }> = ({ c }) => {
    const isSent = c.status === CampaignStatus.SENT;
    const isSending = c.status === CampaignStatus.SENDING;
    const primary = isSent ? fmtDateTime(c.sentAt) || 'Đã gửi'
        : c.scheduledAt ? fmtDateTime(c.scheduledAt)
            : isSending ? 'Đang gửi' : 'Chưa đặt lịch';
    const secondary = isSent ? `${(c.stats?.sent || 0).toLocaleString('vi-VN')} ${c.type === 'zalo_zns' ? 'tin nhắn' : 'email'}`
        : isSending && c.scheduledAt ? 'Bắt đầu gửi'
            : c.scheduledAt ? 'Lịch gửi' : '';
    return (
        <div className="min-w-0">
            <div className="text-[13px] text-[var(--color-text)] whitespace-nowrap">{primary}</div>
            {secondary && <div className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{secondary}</div>}
        </div>
    );
};

/* -------------------------------------------------------------------------- */
/*  Inline rename (shared by desktop row + mobile card)                       */
/* -------------------------------------------------------------------------- */
function useInlineRename(c: Campaign, onRename?: CampaignRowProps['onRename']) {
    const [isEditing, setIsEditing] = useState(false);
    const [value, setValue] = useState(c.name);
    const [saving, setSaving] = useState(false);
    useEffect(() => { setValue(c.name); }, [c.name]);

    const start = (e: React.MouseEvent) => { e.stopPropagation(); setValue(c.name); setIsEditing(true); };
    const cancel = (e?: React.MouseEvent) => { e?.stopPropagation(); setValue(c.name); setIsEditing(false); };
    const save = async (e?: React.MouseEvent) => {
        e?.stopPropagation();
        const trimmed = value.trim();
        if (!trimmed || trimmed === c.name) { setIsEditing(false); return; }
        setSaving(true);
        try {
            await onRename?.(c.id, trimmed);
            setIsEditing(false);
        } catch (err) {
            console.error('Rename campaign error:', err);
        } finally {
            setSaving(false);
        }
    };
    return { isEditing, value, setValue, saving, start, cancel, save };
}

const RenameEditor: React.FC<{ r: ReturnType<typeof useInlineRename> }> = ({ r }) => (
    <div className="flex items-center gap-1 min-w-0" onClick={e => e.stopPropagation()}>
        <input
            type="text"
            autoFocus
            value={r.value}
            onChange={e => r.setValue(e.target.value)}
            onKeyDown={e => {
                if ((e.nativeEvent as any).isComposing) return;
                if (e.key === 'Enter') r.save();
                if (e.key === 'Escape') r.cancel();
            }}
            disabled={r.saving}
            className="h-8 px-2.5 text-[13px] bg-[var(--color-surface)] border border-[var(--color-primary)] rounded-[var(--radius-md)] outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] text-[var(--color-text)] flex-1 min-w-[160px]"
            placeholder="Nhập tên chiến dịch..."
        />
        <button type="button" onClick={r.save} disabled={r.saving} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-[var(--radius-sm)]" title="Lưu (Enter)">
            {r.saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={r.cancel} disabled={r.saving} className="p-1.5 text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 rounded-[var(--radius-sm)]" title="Hủy (Esc)">
            <X className="w-3.5 h-3.5" />
        </button>
    </div>
);

/* -------------------------------------------------------------------------- */
/*  Row + card                                                                 */
/* -------------------------------------------------------------------------- */
interface CampaignListProps {
    campaigns: Campaign[];
    /** True only while the very first page is loading (skeleton). */
    loading: boolean;
    /** True while a background refetch is running — stale rows stay visible. */
    refreshing?: boolean;
    onSelect: (campaign: Campaign) => void;
    onEdit: (campaign: Campaign) => void;
    onDelete: (id: string) => void;
    onPlayFlow: (campaign: Campaign) => void;
    onPause?: (id: string) => void;
    onResume?: (id: string) => void;
    onRename?: (id: string, newName: string) => Promise<boolean | void> | void;
    onCreate?: () => void;
    isFiltered?: boolean;
    onClearFilters?: () => void;
}

interface CampaignRowProps {
    c: Campaign;
    onOpen: (campaign: Campaign) => void;
    onDelete: (id: string) => void;
    onPlayFlow: (campaign: Campaign) => void;
    onPause?: (id: string) => void;
    onResume?: (id: string) => void;
    onRename?: (id: string, newName: string) => Promise<boolean | void> | void;
    onOpenFlow: (flowId: string) => void;
}

const ICON_BTN = 'w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

const RowActions: React.FC<Omit<CampaignRowProps, 'onRename' | 'onOpenFlow'>> = ({ c, onOpen, onDelete, onPlayFlow, onPause, onResume }) => {
    const isWaiting = c.status === CampaignStatus.WAITING_FLOW;
    const flowInactive = c.linkedFlow?.status !== 'active';
    return (
        <div className="flex items-center justify-end gap-0.5" onClick={e => e.stopPropagation()}>
            {c.status === CampaignStatus.SENDING && onPause && (
                <button type="button" onClick={() => onPause(c.id)} className={`${ICON_BTN} hover:text-rose-600`} title="Tạm dừng gửi">
                    <PauseCircle className="w-4 h-4" />
                </button>
            )}
            {c.status === CampaignStatus.PAUSED && onResume && (
                <button type="button" onClick={() => onResume(c.id)} className={`${ICON_BTN} hover:text-emerald-600`} title="Tiếp tục gửi">
                    <Play className="w-4 h-4" />
                </button>
            )}
            {isWaiting && (
                <button
                    type="button"
                    onClick={() => onPlayFlow(c)}
                    disabled={flowInactive}
                    className={`${ICON_BTN} hover:text-[var(--color-primary)]`}
                    title={flowInactive ? `Flow "${c.linkedFlow?.name || ''}" chưa kích hoạt` : 'Khởi chạy ngay'}
                >
                    <Play className="w-4 h-4" />
                </button>
            )}
            <button type="button" onClick={() => onDelete(c.id)} className={`${ICON_BTN} hover:text-rose-600`} title="Xóa">
                <Trash2 className="w-4 h-4" />
            </button>
            {!isWaiting && (
                <button type="button" onClick={() => onOpen(c)} className={`${ICON_BTN} hover:text-[var(--color-primary)]`} title={isEditableStatus(c) ? 'Chỉnh sửa' : 'Xem báo cáo'}>
                    <ChevronRight className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

const CampaignTableRow = React.memo<CampaignRowProps>(({ c, onOpen, onDelete, onPlayFlow, onPause, onResume, onRename, onOpenFlow }) => {
    const r = useInlineRename(c, onRename);
    const creator = getCreator(c);
    return (
        <tr
            className="group cursor-pointer border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg)] transition-colors"
            onClick={() => { if (!r.isEditing) onOpen(c); }}
        >
            <td className="px-4 py-3 max-w-0">
                <div className="flex items-center gap-3 min-w-0">
                    <TypeIcon c={c} />
                    <div className="min-w-0 flex-1">
                        {r.isEditing ? <RenameEditor r={r} /> : (
                            <div className="flex items-center gap-1 min-w-0">
                                <p className="font-semibold text-[var(--color-text)] text-sm truncate group-hover:text-[var(--color-primary)] transition-colors" title={c.name} onDoubleClick={r.start}>
                                    {c.name}
                                </p>
                                {onRename && (
                                    <button type="button" onClick={r.start} className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] rounded shrink-0" title="Đổi tên (double-click)">
                                        <Edit2 className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        )}
                        <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5" title={c.subject || ''}>
                            {c.subject || (c.type === 'zalo_zns' ? `Mẫu ZNS: ${c.templateId || '—'}` : 'Chưa có tiêu đề')}
                        </p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={creator.name} src={creator.picture} size={32} />
                    <span className="text-[13px] text-[var(--color-text-secondary)] truncate max-w-[120px]" title={creator.name}>{creator.name}</span>
                </div>
            </td>
            <td className="px-4 py-3"><StatusPill c={c} onOpenFlow={onOpenFlow} /></td>
            <td className="px-4 py-3"><ScheduleCell c={c} /></td>
            <td className="px-4 py-3"><PerformanceCell c={c} /></td>
            <td className="px-4 py-3 text-right">
                <RowActions c={c} onOpen={onOpen} onDelete={onDelete} onPlayFlow={onPlayFlow} onPause={onPause} onResume={onResume} />
            </td>
        </tr>
    );
});
CampaignTableRow.displayName = 'CampaignTableRow';

const CampaignMobileCard = React.memo<CampaignRowProps>(({ c, onOpen, onDelete, onPlayFlow, onPause, onResume, onRename, onOpenFlow }) => {
    const r = useInlineRename(c, onRename);
    const creator = getCreator(c);
    return (
        <div
            className="bg-[var(--color-surface)] p-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] flex flex-col gap-3 active:bg-[var(--color-bg)]"
            onClick={() => { if (!r.isEditing) onOpen(c); }}
        >
            <div className="flex items-start gap-3 min-w-0">
                <TypeIcon c={c} />
                <div className="min-w-0 flex-1">
                    {r.isEditing ? <RenameEditor r={r} /> : (
                        <div className="flex items-center gap-1 min-w-0">
                            <p className="font-semibold text-sm text-[var(--color-text)] truncate" onDoubleClick={r.start}>{c.name}</p>
                            {onRename && (
                                <button type="button" onClick={r.start} className="p-1 text-[var(--color-text-muted)] rounded shrink-0" title="Đổi tên">
                                    <Edit2 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    )}
                    <p className="text-xs text-[var(--color-text-muted)] truncate">{c.subject || (c.type === 'zalo_zns' ? `Mẫu ZNS: ${c.templateId || '—'}` : 'Chưa có tiêu đề')}</p>
                </div>
                <RowActions c={c} onOpen={onOpen} onDelete={onDelete} onPlayFlow={onPlayFlow} onPause={onPause} onResume={onResume} />
            </div>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <Avatar name={creator.name} src={creator.picture} size={24} />
                    <span className="text-xs text-[var(--color-text-secondary)] truncate max-w-[110px]">{creator.name}</span>
                </div>
                <StatusPill c={c} onOpenFlow={onOpenFlow} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <ScheduleCell c={c} />
                <PerformanceCell c={c} />
            </div>
        </div>
    );
});
CampaignMobileCard.displayName = 'CampaignMobileCard';

const SkeletonRow = () => (
    <tr className="border-b border-[var(--color-border-light)]">
        <td className="px-4 py-3">
            <div className="flex items-center gap-3">
                <Skeleton variant="rounded" width={32} height={32} />
                <div className="space-y-1.5 flex-1 min-w-0">
                    <Skeleton variant="text" width="60%" />
                    <Skeleton variant="text" width="35%" />
                </div>
            </div>
        </td>
        <td className="px-4 py-3"><div className="flex items-center gap-2"><Skeleton variant="circular" width={32} height={32} /><Skeleton variant="text" width={70} /></div></td>
        <td className="px-4 py-3"><Skeleton variant="rounded" width={72} height={20} /></td>
        <td className="px-4 py-3"><Skeleton variant="text" width="70%" /></td>
        <td className="px-4 py-3"><Skeleton variant="text" width="80%" /></td>
        <td className="px-4 py-3"><Skeleton variant="circular" width={28} height={28} className="ml-auto" /></td>
    </tr>
);

const TH = 'px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)] bg-[var(--color-bg)] whitespace-nowrap';

const CampaignList: React.FC<CampaignListProps> = ({
    campaigns, loading, refreshing = false, onSelect, onEdit, onDelete, onPlayFlow, onPause, onResume, onRename,
    onCreate, isFiltered = false, onClearFilters
}) => {
    const navigate = useNavigate();

    // Stable callbacks so memoized rows only re-render when their campaign object changes.
    const handleOpen = useCallback((c: Campaign) => {
        if (isEditableStatus(c)) onEdit(c);
        else onSelect(c);
    }, [onEdit, onSelect]);
    const handleOpenFlow = useCallback((flowId: string) => {
        navigate('/marketing/flows', { state: { openFlowId: flowId } });
    }, [navigate]);

    const showSkeleton = loading && campaigns.length === 0;
    const showEmpty = !loading && campaigns.length === 0;

    if (showEmpty) {
        return (
            <div className="flex flex-col items-center justify-center text-center gap-2 px-6 py-14">
                {isFiltered
                    ? <SearchX className="w-10 h-10 text-[var(--color-text-muted)]" strokeWidth={1.5} />
                    : <PieChart className="w-10 h-10 text-[var(--color-text-muted)]" strokeWidth={1.5} />}
                <p className="text-sm font-semibold text-[var(--color-text)]">
                    {isFiltered ? 'Không tìm thấy chiến dịch phù hợp' : 'Chưa có chiến dịch nào'}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] max-w-sm">
                    {isFiltered
                        ? 'Thử thay đổi khoảng thời gian, trạng thái hoặc từ khóa tìm kiếm.'
                        : 'Tạo chiến dịch Email hoặc Zalo ZNS đầu tiên để bắt đầu tiếp cận khách hàng.'}
                </p>
                {isFiltered && onClearFilters ? (
                    <button type="button" onClick={onClearFilters} className="mt-2 h-9 px-4 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity">
                        Xóa bộ lọc
                    </button>
                ) : onCreate ? (
                    <button type="button" onClick={onCreate} className="mt-2 h-9 px-4 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:opacity-90 transition-opacity">
                        <Plus className="w-4 h-4" /> Tạo chiến dịch
                    </button>
                ) : null}
            </div>
        );
    }

    return (
        <div className={`relative transition-opacity ${refreshing ? 'opacity-70' : ''}`} aria-busy={refreshing || loading}>
            {refreshing && <div className="absolute inset-x-0 top-0 h-0.5 bg-[var(--color-primary)] animate-pulse z-20" />}

            {/* Desktop table */}
            <div className="hidden md:block overflow-auto max-h-[calc(100vh-320px)] min-h-[240px]">
                <table className="w-full text-sm border-collapse">
                    <colgroup>
                        <col />
                        <col style={{ width: 180 }} />
                        <col style={{ width: 140 }} />
                        <col style={{ width: 170 }} />
                        <col style={{ width: 220 }} />
                        <col style={{ width: 120 }} />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                        <tr className="border-b border-[var(--color-border)]">
                            <th className={TH}>Chiến dịch</th>
                            <th className={TH}>Người tạo</th>
                            <th className={TH}>Trạng thái</th>
                            <th className={TH}>Lịch trình</th>
                            <th className={TH}>Hiệu quả</th>
                            <th className={`${TH} text-right`}><span className="sr-only">Thao tác</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {showSkeleton
                            ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                            : campaigns.map(c => (
                                <CampaignTableRow
                                    key={c.id}
                                    c={c}
                                    onOpen={handleOpen}
                                    onDelete={onDelete}
                                    onPlayFlow={onPlayFlow}
                                    onPause={onPause}
                                    onResume={onResume}
                                    onRename={onRename}
                                    onOpenFlow={handleOpenFlow}
                                />
                            ))}
                    </tbody>
                </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col gap-3 p-3">
                {showSkeleton
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="p-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] space-y-2">
                            <Skeleton variant="text" width="70%" />
                            <Skeleton variant="text" width="40%" />
                        </div>
                    ))
                    : campaigns.map(c => (
                        <CampaignMobileCard
                            key={c.id}
                            c={c}
                            onOpen={handleOpen}
                            onDelete={onDelete}
                            onPlayFlow={onPlayFlow}
                            onPause={onPause}
                            onResume={onResume}
                            onRename={onRename}
                            onOpenFlow={handleOpenFlow}
                        />
                    ))}
            </div>
        </div>
    );
};

export default React.memo(CampaignList);
