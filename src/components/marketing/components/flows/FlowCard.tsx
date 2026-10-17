import React from 'react';
import { useNavigate } from 'react-router-dom';
import { GitMerge, Trash2, RotateCcw, Copy, Send, Users, Snowflake, Cake, Layers, AlertCircle, FileInput, Tag, ShoppingCart, Link, CheckCircle, ListPlus, BellRing, Bot, Zap, ClipboardList, UserPlus, Mail, Clock, MessageSquare } from 'lucide-react';
import { Flow, Campaign, FormDefinition, PurchaseEvent, CustomEvent, Segment } from '../../types';
import { Avatar } from '../../../../components/ui/Avatar';
import { AppIcon } from '../../../common/AppIcons';

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
    const rawTriggerType = triggerConfig.type || (flow as any).trigger_type || '';
    const flowNameLower = (flow.name || '').toLowerCase();

    const theme = React.useMemo(() => {
        if (isArchived) return {
            icon: GitMerge,
            appIconKey: 'flow_archive',
            accent: 'slate' as const,
            gradientMain: 'from-slate-100 to-slate-200 text-slate-500 dark:text-slate-400',
            iconBg: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
            chipBg: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
            label: 'Đã xóa'
        };

        // 1. AI Capture / Bot Trigger (Theme: rose #f43f5e)
        if (
            rawTriggerType === 'ai_capture' ||
            rawTriggerType === 'ai_chatbot_lead' ||
            rawTriggerType === 'ai' ||
            rawTriggerType === 'bot' ||
            flowNameLower.includes('ai chatbot') ||
            flowNameLower.includes('lead từ ai') ||
            flowNameLower.includes('ai capture')
        ) {
            return {
                icon: Bot,
                appIconKey: 'flow_ai_bot',
                accent: 'rose' as const,
                gradientMain: 'from-rose-500 to-red-600',
                iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/40',
                chipBg: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/40',
                label: 'Lead từ AI Chatbot'
            };
        }

        // 2. Date: Inactivity / Winback (Theme: sky/blue #0284c7)
        if (
            (rawTriggerType === 'date' && triggerConfig.dateField === 'lastActivity') ||
            flowNameLower.includes('inactivity') ||
            flowNameLower.includes('ngủ đông') ||
            flowNameLower.includes('winback')
        ) {
            return {
                icon: Snowflake,
                appIconKey: 'flow_inactivity',
                accent: 'blue' as const,
                gradientMain: 'from-blue-500 to-indigo-600',
                iconBg: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200/80 dark:border-sky-800/40',
                chipBg: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800/40',
                label: `Ngủ đông > ${triggerConfig.inactiveAmount || 30} ngày`
            };
        }

        // 3. Date: Birthday
        if (
            (rawTriggerType === 'date' && triggerConfig.dateField === 'dateOfBirth') ||
            flowNameLower.includes('sinh nhật') ||
            flowNameLower.includes('birthday')
        ) {
            return {
                icon: Cake,
                appIconKey: 'flow_birthday',
                accent: 'pink' as const,
                gradientMain: 'from-pink-400 to-rose-500',
                iconBg: 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400 border border-pink-200/80 dark:border-pink-800/40',
                chipBg: 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-800/40',
                label: 'Sinh nhật'
            };
        }

        // 4. Date: Custom Field Date
        if (rawTriggerType === 'date' && triggerConfig.dateField === 'custom_field_date') {
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
                appIconKey: 'flow_custom_event',
                accent: 'purple' as const,
                gradientMain: 'from-purple-500 to-indigo-600',
                iconBg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/40',
                chipBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800/40',
                label: offsetLabel
            };
        }

        // 5. Purchase Success / Cart (Theme: pink #ec4899)
        if (
            rawTriggerType === 'purchase' ||
            flowNameLower.includes('mua hàng') ||
            flowNameLower.includes('đơn hàng') ||
            flowNameLower.includes('purchase')
        ) {
            let label = linkedPurchaseEvent ? linkedPurchaseEvent.name : 'Sự kiện mua hàng';
            let isDeleted = !linkedPurchaseEvent && triggerConfig.targetId;

            if (isDeleted) {
                label = `Event Mua [${(triggerConfig.targetId || '').substring(0, 6)}] đã xóa`;
            }

            return {
                icon: ShoppingCart,
                appIconKey: 'flow_purchase',
                accent: 'pink' as any,
                gradientMain: 'from-pink-400 to-rose-500',
                iconBg: isDeleted
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/40'
                    : 'bg-pink-50 text-pink-600 dark:bg-pink-950/40 dark:text-pink-400 border border-pink-200/80 dark:border-pink-800/40',
                chipBg: isDeleted
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/40'
                    : 'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/30 dark:text-pink-300 dark:border-pink-800/40',
                label: label,
                isLink: !!linkedPurchaseEvent,
                onLinkClick: () => linkedPurchaseEvent && onOpenPurchase?.(linkedPurchaseEvent)
            };
        }

        // 6. Survey Response / Feedback (Theme: amber #fbbf24)
        if (
            rawTriggerType === 'survey' ||
            flowNameLower.includes('khảo sát') ||
            flowNameLower.includes('survey') ||
            flowNameLower.includes('feedback')
        ) {
            return {
                icon: ClipboardList,
                appIconKey: 'flow_survey',
                accent: 'amber' as any,
                gradientMain: 'from-amber-400 to-yellow-500',
                iconBg: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/40',
                chipBg: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40',
                label: triggerConfig.targetId ? `Khảo sát: ${triggerConfig.targetId}` : 'Phản hồi Khảo sát'
            };
        }

        // 7. Zalo OA Follow (Theme: cyan #06b6d4)
        if (
            rawTriggerType === 'zalo_follow' ||
            rawTriggerType === 'zalo' ||
            flowNameLower.includes('zalo')
        ) {
            return {
                icon: UserPlus,
                appIconKey: 'flow_zalo',
                accent: 'cyan' as any,
                gradientMain: 'from-cyan-500 to-blue-500',
                iconBg: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/40 dark:text-cyan-400 border border-cyan-200/80 dark:border-cyan-800/40',
                chipBg: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:border-cyan-800/40',
                label: 'Quan tâm Zalo OA'
            };
        }

        // 8. Form Submission (Theme: amber #f59e0b)
        if (rawTriggerType === 'form' || flowNameLower.includes('form')) {
            let formName = linkedForm ? linkedForm.name : (triggerConfig.targetId ? `Form ${triggerConfig.targetId.substring(0, 6)}...` : 'Form đăng ký');
            let isDeleted = !linkedForm && triggerConfig.targetId;

            if (isDeleted) {
                formName = `Form đã xóa [${(triggerConfig.targetId || '').substring(0, 6)}]`;
            }

            return {
                icon: FileInput,
                appIconKey: 'flow_form',
                accent: 'amber' as any,
                gradientMain: 'from-amber-500 to-yellow-600',
                iconBg: isDeleted
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/40'
                    : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/40',
                chipBg: isDeleted
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/40'
                    : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/40',
                label: formName,
                isLink: !!linkedForm,
                onLinkClick: () => linkedForm && onOpenForm?.(linkedForm)
            };
        }

        // 9. Custom Event (Theme: violet #8b5cf6, Zap)
        if (rawTriggerType === 'custom_event') {
            let label = linkedCustomEvent ? linkedCustomEvent.name : 'Sự kiện tùy chỉnh';
            let isDeleted = !linkedCustomEvent && triggerConfig.targetId;

            if (isDeleted) {
                label = `Event [${(triggerConfig.targetId || '').substring(0, 6)}] đã xóa`;
            }

            return {
                icon: Zap,
                appIconKey: 'flow_custom_event',
                accent: 'violet' as any,
                gradientMain: 'from-purple-500 to-indigo-600',
                iconBg: isDeleted
                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/40'
                    : 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/40',
                chipBg: isDeleted
                    ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/40'
                    : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800/40',
                label: label,
                isLink: !!linkedCustomEvent,
                onLinkClick: () => linkedCustomEvent && onOpenCustomEvent?.(linkedCustomEvent)
            };
        }

        // 10. Tag Trigger (Theme: emerald #10b981, Tag)
        if (rawTriggerType === 'tag' || flowNameLower.includes('gắn tag') || flowNameLower.includes('nhãn')) {
            return {
                icon: Tag,
                appIconKey: 'flow_tag',
                accent: 'emerald' as const,
                gradientMain: 'from-emerald-500 to-teal-600',
                iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/40',
                chipBg: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/40',
                label: `Tag: ${linkedTag || triggerConfig.targetId || (triggerConfig.tags ? triggerConfig.tags.join(', ') : 'Gắn nhãn')}`,
                isLink: !!linkedTag,
                onLinkClick: () => linkedTag && onOpenTag?.(linkedTag)
            };
        }

        // 11. Campaign Tracking (Theme: violet #8b5cf6, Send)
        if (rawTriggerType === 'campaign') {
            const campaignName = linkedCampaign ? linkedCampaign.name : (triggerConfig.targetId ? 'Chiến dịch đã xóa' : 'Chưa chọn chiến dịch');
            return {
                icon: Send,
                appIconKey: 'flow_mail',
                accent: 'violet' as const,
                gradientMain: 'from-purple-500 to-indigo-600',
                iconBg: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/80 dark:border-purple-800/40',
                chipBg: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800/40',
                label: campaignName,
                isLink: !!linkedCampaign,
                onLinkClick: () => linkedCampaign && onOpenCampaign?.(linkedCampaign)
            };
        }

        // 12. List vs Smart Segment
        const isListSubtype =
            rawTriggerType === 'list' ||
            rawTriggerType === 'added_to_list' ||
            triggerConfig.targetSubtype === 'list' ||
            triggerConfig.targetSubtype === 'sync' ||
            !!linkedList ||
            flowNameLower.includes('danh sách') ||
            flowNameLower.includes('list');

        if (isListSubtype) {
            const resolved  = !!linkedList;
            const label     = resolved
                ? linkedList.name
                : (triggerConfig.targetId ? 'Đang tải...' : 'Gia nhập Danh sách');
            const hasTarget = resolved || !!triggerConfig.targetId;
            return {
                icon: ListPlus,
                appIconKey: 'flow_list',
                accent: 'indigo' as const,
                gradientMain: 'from-indigo-500 to-blue-600',
                iconBg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/40',
                chipBg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800/40',
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

        if (
            rawTriggerType === 'segment' ||
            triggerConfig.targetSubtype === 'segment' ||
            flowNameLower.includes('phân khúc') ||
            flowNameLower.includes('segment')
        ) {
            const resolved  = !!linkedSegment;
            const label     = resolved
                ? linkedSegment!.name
                : (triggerConfig.targetId ? 'Đang tải...' : 'Phân khúc động (Smart)');
            const hasTarget = resolved || !!triggerConfig.targetId;
            return {
                icon: Layers,
                appIconKey: 'flow_smart_segment',
                accent: 'orange' as const,
                gradientMain: 'from-orange-500 to-amber-600',
                iconBg: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/80 dark:border-orange-800/40',
                chipBg: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800/40',
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

        // 13. Keywords for ambiguous names: "trial" / "mail" / "system mail" / "email" / "hệ thống"
        if (
            flowNameLower.includes('trial') ||
            flowNameLower.includes('mail') ||
            flowNameLower.includes('email') ||
            flowNameLower.includes('system') ||
            flowNameLower.includes('hệ thống')
        ) {
            return {
                icon: Mail,
                appIconKey: 'flow_mail',
                accent: 'indigo' as const,
                gradientMain: 'from-indigo-500 to-blue-600',
                iconBg: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/80 dark:border-indigo-800/40',
                chipBg: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-300 dark:border-indigo-800/40',
                label: 'Email tự động'
            };
        }

        // Default fallback (Phân khúc / Smart Segment)
        return {
            icon: Layers,
            appIconKey: 'flow_smart_segment',
            accent: 'orange' as const,
            gradientMain: 'from-orange-500 to-amber-600',
            iconBg: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/80 dark:border-orange-800/40',
            chipBg: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800/40',
            label: 'Phân khúc động (Smart)'
        };
    }, [isArchived, rawTriggerType, triggerConfig, flow.name, flowNameLower, linkedCampaign, linkedForm, linkedPurchaseEvent, linkedCustomEvent, linkedSegment, linkedList, linkedTag, onOpenCampaign, onOpenForm, onOpenList, onOpenSegment, onOpenTag, onOpenPurchase, onOpenCustomEvent, navigate]);

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
                        <AppIcon name={theme.appIconKey} size={36} className="shrink-0 rounded-[10px] shadow-2xs" />
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="font-semibold text-[var(--color-text)] truncate">{flow.name}</span>
                                {hasWarning && !isArchived && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold shrink-0">
                                        <AlertCircle className="w-3 h-3" /> Thiếu bước
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs">
                                {(theme as any).isLink ? (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); (theme as any).onLinkClick?.(); }}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] border transition-colors cursor-pointer font-medium truncate max-w-[240px] hover:opacity-90 ${theme.chipBg}`}
                                    >
                                        <Link className="w-3 h-3 shrink-0" />
                                        <span className="truncate">{theme.label}</span>
                                    </button>
                                ) : (
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] border text-xs truncate max-w-[240px] ${theme.chipBg}`}>{theme.label}</span>
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
            className={`hover-lift group relative bg-[var(--color-surface)] border rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] h-full flex flex-col justify-between transition-all duration-300 cursor-pointer overflow-hidden ${
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
                        <AppIcon name={theme.appIconKey} size={42} className="shrink-0 rounded-[12px] shadow-xs group-hover:scale-105 transition-transform duration-300" />
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
                    <h3 className="text-sm font-bold text-[var(--color-text)] leading-snug mb-1.5 line-clamp-2 group-hover:text-[var(--color-primary)] transition-colors">
                        {flow.name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                        {(theme as any).isLink ? (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); (theme as any).onLinkClick?.(); }}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] border transition-colors cursor-pointer font-medium max-w-full hover:opacity-90 ${theme.chipBg}`}
                                title="Nhấn để xem chi tiết liên kết"
                            >
                                <Link className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[200px]">{theme.label}</span>
                            </button>
                        ) : (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[10px] border text-xs font-medium max-w-[220px] truncate ${theme.chipBg}`}>
                                {theme.label}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="pt-3 mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-1 p-1 bg-[var(--color-bg)] rounded-[14px] border border-[var(--color-border-light)]">
                    <div className="flex flex-col items-center justify-center py-1.5 px-1">
                        <div className="flex items-center gap-1 mb-0.5">
                            <Layers className="w-3 h-3 text-[var(--color-text-muted)]" />
                            <span className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase">Bước</span>
                        </div>
                        <span className="text-xs font-bold tabular-nums text-[var(--color-text)]">{stepCount}</span>
                    </div>
                    <div className="flex flex-col items-center justify-center py-1.5 px-1 border-l border-[var(--color-border-light)]">
                        <div className="flex items-center gap-1 mb-0.5">
                            <Users className="w-3 h-3 text-blue-500" />
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
                                    className="w-7 h-7 flex items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-emerald-600 hover:bg-emerald-50 transition-colors"
                                    title="Khôi phục"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(true)}
                                    className="w-7 h-7 flex items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-rose-600 hover:bg-rose-50 transition-colors"
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
                                    className="w-7 h-7 flex items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] transition-colors"
                                    title="Nhân bản"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onDelete(false)}
                                    className="w-7 h-7 flex items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 transition-colors"
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
