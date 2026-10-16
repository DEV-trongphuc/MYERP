import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GitMerge, Trash2, RotateCcw, Copy, Send, Users, Snowflake, Cake, Layers, AlertCircle, FileInput, Tag, ShoppingCart, Link, CheckCircle, ListPlus, BellRing } from 'lucide-react';
import { Flow, Campaign, FormDefinition, PurchaseEvent, CustomEvent, Segment } from '../../types';
import { Avatar } from '../../../../components/ui/Avatar';

interface FlowCardProps {
    flow: Flow;
    linkedCampaign?: Campaign;
    linkedForm?: FormDefinition;
    linkedPurchaseEvent?: PurchaseEvent;
    linkedCustomEvent?: CustomEvent;
    onClick: () => void;
    onDelete: (permanent?: boolean) => void;
    onDuplicate?: (flow: Flow) => void;
    onRestore?: () => void;
    onOpenCampaign?: (campaign: Campaign) => void;
    onOpenForm?: (form: FormDefinition) => void;
    onOpenPurchase?: (event: PurchaseEvent) => void;

    onOpenCustomEvent?: (event: CustomEvent) => void;
    onOpenList?: (list: any) => void;
    onOpenSegment?: (segment: Segment) => void;
    onOpenTag?: (tag: string) => void;
    linkedSegment?: Segment;
    linkedList?: any;
    linkedTag?: string;
    isList?: boolean;
    selected?: boolean;
    onToggleSelect?: () => void;
}


const FlowCard = React.memo<FlowCardProps>((
    { flow, linkedCampaign, linkedForm, linkedPurchaseEvent, linkedCustomEvent, linkedSegment, linkedList, linkedTag, isList,
    selected, onToggleSelect,
    onClick, onDelete, onDuplicate, onRestore,
    onOpenCampaign, onOpenForm, onOpenList, onOpenSegment, onOpenTag, onOpenPurchase, onOpenCustomEvent }
) => {
    const navigate = useNavigate();
    const isArchived = flow.status === 'archived';
    const isActive = flow.status === 'active';
    const enrolled = (flow.stats?.enrolled) || 0;

    const completionRate = enrolled > 0
        ? Math.round(((flow.stats?.completed || 0) / enrolled) * 100)
        : 0;

    // [PERF-F3] Backend list view strips steps to trigger only — use step_count if provided
    const stepCount = (flow as any).step_count ?? flow.steps?.length ?? 0;
    const trigger = flow.steps?.find(s => s.type === 'trigger');
    const triggerConfig = trigger?.config || {};
    const triggerType = triggerConfig.type || 'segment';

    const theme = React.useMemo(() => {
        if (isArchived) return {
            icon: GitMerge,
            accent: 'slate' as const,
            gradientMain: 'from-slate-100 to-slate-200 text-slate-500 dark:text-slate-400',
            label: 'Đã xóa'
        };

        if (triggerType === 'date' && triggerConfig.dateField === 'lastActivity') {
            return {
                icon: Snowflake,
                accent: 'blue' as const,
                gradientMain: 'from-blue-500 to-indigo-600',
                label: `Ngủ đông > ${triggerConfig.inactiveAmount || 30} ngày`
            };
        }

        if (triggerType === 'date' && triggerConfig.dateField === 'dateOfBirth') {
            return {
                icon: Cake,
                accent: 'pink' as const,
                gradientMain: 'from-pink-400 to-rose-500',
                label: 'Sinh nhật'
            };
        }

        if (triggerType === 'form') {
            let formName = linkedForm ? linkedForm.name : (triggerConfig.targetId ? `Form ${triggerConfig.targetId.substring(0, 6)}...` : 'Form không xác định');
            let accent = 'yellow';
            let gradient = 'from-[#f59e0b] to-[#d97706]';

            if (!linkedForm && triggerConfig.targetId) {
                accent = 'rose';
                gradient = 'from-rose-400 to-red-500';
                formName = `Form đã xóa [${(triggerConfig.targetId || '').substring(0, 6)}]`;
            }

            return {
                icon: FileInput,
                accent: accent as any,
                gradientMain: gradient,
                label: formName,
                isLink: !!linkedForm,
                onLinkClick: () => linkedForm && onOpenForm?.(linkedForm)
            };
        }

        if (triggerType === 'purchase') {
            let label = linkedPurchaseEvent ? linkedPurchaseEvent.name : 'Sự kiện mua hàng';
            let accent = 'pink';
            let gradient = 'from-pink-400 to-rose-500';

            if (!linkedPurchaseEvent && triggerConfig.targetId) {
                label = `Event Mua [${(triggerConfig.targetId || '').substring(0, 6)}] đã xóa`;
                accent = 'rose';
                gradient = 'from-rose-400 to-red-500';
            }

            return {
                icon: ShoppingCart,
                accent: accent as any,
                gradientMain: gradient,
                label: label,
                isLink: !!linkedPurchaseEvent,
                onLinkClick: () => linkedPurchaseEvent && onOpenPurchase?.(linkedPurchaseEvent)
            };
        }

        if (triggerType === 'custom_event') {
            let label = linkedCustomEvent ? linkedCustomEvent.name : 'Sự kiện tùy chỉnh';
            let accent = 'violet';
            let gradient = 'from-blue-400 to-fuchsia-500';

            if (!linkedCustomEvent && triggerConfig.targetId) {
                label = `Event [${(triggerConfig.targetId || '').substring(0, 6)}] đã xóa`;
                accent = 'rose';
                gradient = 'from-rose-400 to-red-500';
            }

            return {
                icon: GitMerge,
                accent: accent as any,
                gradientMain: gradient,
                label: label,
                isLink: !!linkedCustomEvent,
                onLinkClick: () => linkedCustomEvent && onOpenCustomEvent?.(linkedCustomEvent)
            };
        }

        if (triggerType === 'campaign') {
            const campaignName = linkedCampaign ? linkedCampaign.name : (triggerConfig.targetId ? 'Chiến dịch đã xóa' : 'Chưa chọn chiến dịch');
            return {
                icon: Send,
                accent: 'violet' as const,
                gradientMain: 'from-blue-500 to-purple-600',
                label: campaignName,
                isLink: !!linkedCampaign,
                onLinkClick: () => linkedCampaign && onOpenCampaign?.(linkedCampaign)
            };
        }

        if (triggerType === 'tag') {
            return {
                icon: Tag,
                accent: 'teal' as const,
                gradientMain: 'from-teal-400 to-emerald-500',
                label: `Được gắn tag: ${linkedTag || triggerConfig.targetId || ''}`,
                isLink: !!linkedTag,
                onLinkClick: () => linkedTag && onOpenTag?.(linkedTag)
            };
        }

        if (triggerType === 'date' && triggerConfig.dateField === 'custom_field_date') {
            const fieldKey = triggerConfig.customFieldKey || 'custom field';
            const offsetType = triggerConfig.offsetType || 'on';
            const offsetValue = triggerConfig.offsetValue ?? 0;
            const offsetLabel = offsetType === 'before'
                ? `${offsetValue} ngày trước [${fieldKey}]`
                : offsetType === 'after'
                    ? `${offsetValue} ngày sau [${fieldKey}]`
                    : `Đúng ngày [${fieldKey}]`;
            return {
                icon: BellRing,
                accent: 'violet' as const,
                gradientMain: 'from-blue-500 to-purple-700',
                label: offsetLabel
            };
        }

        if (triggerType === 'segment') {
            const isListSubtype = triggerConfig.targetSubtype === 'list' || triggerConfig.targetSubtype === 'sync' || !!linkedList;

            if (isListSubtype) {
                const resolved  = !!linkedList;
                const label     = resolved
                    ? linkedList.name
                    : (triggerConfig.targetId ? 'Đang tải...' : 'Chưa chọn danh sách');
                const hasTarget = resolved || !!triggerConfig.targetId;
                return {
                    icon: ListPlus,
                    accent: 'emerald' as const,
                    gradientMain: 'from-emerald-600 to-teal-700',
                    label,
                    isLink: hasTarget,
                    onLinkClick: () => {
                        if (linkedList && onOpenList) {
                            onOpenList(linkedList);
                        } else if (triggerConfig.targetId) {
                            navigate(`/marketing/audience?list_id=${triggerConfig.targetId}`);
                        }
                    }
                };
            }

            const resolved  = !!linkedSegment;
            const label     = resolved
                ? linkedSegment!.name
                : (triggerConfig.targetId ? 'Đang tải...' : 'Chưa chọn phân khúc');
            const hasTarget = resolved || !!triggerConfig.targetId;
            return {
                icon: Layers,
                accent: 'amber' as const,
                gradientMain: 'from-amber-400 to-orange-500',
                label,
                isLink: hasTarget,
                onLinkClick: () => {
                    if (linkedSegment && onOpenSegment) {
                        onOpenSegment(linkedSegment);
                    } else if (triggerConfig.targetId) {
                        navigate(`/marketing/audience?segment_id=${triggerConfig.targetId}`);
                    }
                }
            };
        }

        // Default fallback
        return {
            icon: Users,
            accent: 'violet' as const,
            gradientMain: 'from-blue-500 to-fuchsia-500',
            label: 'Dựa trên phân khúc'
        };
    }, [isArchived, triggerType, triggerConfig, linkedCampaign, linkedForm, linkedPurchaseEvent, linkedCustomEvent, linkedSegment, linkedList, linkedTag, onOpenCampaign, onOpenForm, onOpenList, onOpenSegment, onOpenTag, onOpenPurchase, onOpenCustomEvent]);

    const Icon = theme.icon;
    const creatorName = (flow.config as any)?.creator?.name || 'Hệ thống';
    const creatorPicture = (flow.config as any)?.creator?.picture || '/imgs/ICON.png';
    const formattedCreatedAt = React.useMemo(() => {
        if (!flow.createdAt) return 'Chưa rõ';
        const d = new Date(flow.createdAt);
        if (isNaN(d.getTime())) return 'Chưa rõ';
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }, [flow.createdAt]);

    const StatusPill = () => {
        if (isArchived) return <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[11px] font-semibold border border-slate-200">Đã lưu trữ</span>;
        if (isActive) return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full text-[11px] font-semibold border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />Đang chạy</span>;
        if (flow.status === 'draft') return <span className="inline-flex items-center px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[11px] font-semibold border border-slate-200">Bản nháp</span>;
        return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full text-[11px] font-semibold border border-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Tạm dừng</span>;
    };

    const hasWarning = stepCount < 2; // Needs at least trigger + 1 action

    if (isList) {
        return (
            <tr
                onClick={onClick}
                className={`border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer ${isArchived && !selected ? 'opacity-70' : ''}`}
            >
                {isArchived && (
                    <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {onToggleSelect && (
                            <input
                                type="checkbox"
                                checked={selected}
                                onChange={onToggleSelect}
                                className="w-4 h-4 rounded accent-[var(--color-primary)] border-[var(--color-border)]"
                            />
                        )}
                    </td>
                )}
                <td className="px-4 py-3 min-w-[240px]">
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="w-9 h-9 shrink-0 rounded-[var(--radius-md)] flex items-center justify-center"
                            style={{ backgroundColor: 'rgba(189, 29, 45, 0.1)', color: 'var(--color-primary)' }}
                        >
                            <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold text-[var(--color-text)] truncate">{flow.name}</span>
                                {hasWarning && !isArchived && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold shrink-0">
                                        <AlertCircle className="w-3 h-3" /> Thiếu bước
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-[var(--color-text-muted)]">
                                {(theme as any).isLink ? (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); (theme as any).onLinkClick?.(); }}
                                        className="inline-flex items-center gap-1 text-[var(--color-primary)] hover:underline font-medium truncate max-w-[240px]"
                                    >
                                        <Link className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{theme.label}</span>
                                    </button>
                                ) : (
                                    <span className="truncate max-w-[240px]">{theme.label}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                    <StatusPill />
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--color-text)]">
                    {stepCount}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-[var(--color-text)]">
                    {enrolled.toLocaleString('vi-VN')}
                </td>
                <td className="px-4 py-3 min-w-[140px]">
                    <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-[var(--color-border-light)] rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all"
                                style={{ width: `${Math.min(100, completionRate)}%` }}
                            />
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-[var(--color-text)]">{completionRate}%</span>
                    </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                        <Avatar src={creatorPicture} name={creatorName} size={32} />
                        <span className="text-xs font-medium text-[var(--color-text)] truncate max-w-[120px]">{creatorName}</span>
                    </div>
                </td>
                <td className="px-4 py-3 text-xs text-[var(--color-text-muted)] whitespace-nowrap tabular-nums">
                    {formattedCreatedAt}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center justify-end gap-1.5">
                        {isArchived ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onRestore?.()}
                                    className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-emerald-600 hover:bg-emerald-50 transition-colors"
                                    title="Khôi phục"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(true)}
                                    className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Xóa vĩnh viễn"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onDuplicate?.(flow)}
                                    className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] transition-colors"
                                    title="Nhân bản"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(false)}
                                    className="w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Thùng rác"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <div
            onClick={onClick}
            className={`group relative bg-[var(--color-surface)] border rounded-[var(--radius-lg)] h-full flex flex-col justify-between p-4 transition-all duration-200 cursor-pointer overflow-hidden ${
                isArchived
                    ? selected
                        ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary-light)]'
                        : 'border-[var(--color-border)] opacity-70'
                    : hasWarning
                        ? 'border-amber-300 hover:border-amber-400 hover:shadow-[var(--shadow-md)]'
                        : 'border-[var(--color-border)] hover:border-[var(--color-primary-light)] hover:shadow-[var(--shadow-md)]'
            }`}
        >
            <div>
                <div className="flex justify-between items-start gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                        {onToggleSelect && isArchived && (
                            <div className="z-30 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="checkbox"
                                    checked={selected}
                                    onChange={onToggleSelect}
                                    className="w-4 h-4 rounded accent-[var(--color-primary)] border-[var(--color-border)]"
                                />
                            </div>
                        )}
                        <div
                            className="w-10 h-10 rounded-[var(--radius-md)] flex items-center justify-center shrink-0"
                            style={{ backgroundColor: 'rgba(189, 29, 45, 0.1)', color: 'var(--color-primary)' }}
                        >
                            <Icon className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {hasWarning && !isArchived && (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200 text-[10px] font-semibold">
                                <AlertCircle className="w-3 h-3" />
                                <span>Thiếu bước</span>
                            </span>
                        )}
                        <StatusPill />
                    </div>
                </div>

                <div>
                    <h3 className="text-[15px] font-bold text-[var(--color-text)] leading-snug mb-1 line-clamp-2">
                        {flow.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
                        {(theme as any).isLink ? (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); (theme as any).onLinkClick?.(); }}
                                className="inline-flex items-center gap-1.5 text-[var(--color-primary)] bg-[var(--color-primary-light)] px-2 py-0.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer font-semibold max-w-full"
                            >
                                <Link className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[200px]">{theme.label}</span>
                            </button>
                        ) : (
                            <span className="truncate max-w-[220px]">{theme.label}</span>
                        )}
                    </div>
                </div>
            </div>

            <div className="pt-3 mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--color-bg)] rounded-[var(--radius-md)] border border-[var(--color-border-light)]">
                    <div className="flex flex-col items-center justify-center py-1.5 px-1">
                        <div className="flex items-center gap-1 mb-0.5">
                            <Layers className="w-3 h-3 text-[var(--color-text-muted)]" />
                            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase">Bước</span>
                        </div>
                        <span className="text-xs font-bold tabular-nums text-[var(--color-text)]">{stepCount}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center py-1.5 px-1 border-l border-[var(--color-border-light)]">
                        <div className="flex items-center gap-1 mb-0.5">
                            <Users className="w-3 h-3 text-[var(--color-primary)]" />
                            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase">Tham gia</span>
                        </div>
                        <span className="text-xs font-bold tabular-nums text-[var(--color-text)]">{enrolled.toLocaleString('vi-VN')}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center py-1.5 px-1 border-l border-[var(--color-border-light)]">
                        <div className="flex items-center gap-1 mb-0.5">
                            <CheckCircle className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase">Hoàn thành</span>
                        </div>
                        <span className={`text-xs font-bold tabular-nums ${completionRate > 0 ? 'text-emerald-600' : 'text-[var(--color-text-muted)]'}`}>{completionRate}%</span>
                    </div>
                </div>

                {/* Creator Footer + Quick Actions */}
                <div className="pt-2.5 border-t border-[var(--color-border-light)] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <Avatar src={creatorPicture} name={creatorName} size={24} />
                        <div className="flex flex-col min-w-0">
                            <span className="text-[11px] text-[var(--color-text)] font-semibold truncate max-w-[120px]">
                                {creatorName}
                            </span>
                            <span className="text-[10px] text-[var(--color-text-muted)] tabular-nums">
                                {formattedCreatedAt}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        {isArchived ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onRestore?.()}
                                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-emerald-600 hover:bg-emerald-50 transition-colors"
                                    title="Khôi phục"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(true)}
                                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Xóa vĩnh viễn"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => onDuplicate?.(flow)}
                                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] transition-colors"
                                    title="Nhân bản"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                    title="Thùng rác"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});


export default FlowCard;
