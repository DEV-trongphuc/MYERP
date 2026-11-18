import { EXTERNAL_ASSET_BASE } from '../../../utils/config';
import React, { memo } from 'react';
import {
    Zap, Mail, Clock, GitMerge, Tag, Link as LinkIcon, MoreHorizontal, AlertOctagon,
    AlertTriangle, Beaker, Hourglass, MousePointer2, MailOpen, MessageSquare, UserMinus,
    ShoppingCart, Layers, Cake, Snowflake, Trash2, List, ListPlus, FileInput, ArrowRight,
    Briefcase, PhoneCall, UserCheck, BellRing, ClipboardList
} from 'lucide-react';
import { FlowStep, Flow, FormDefinition } from '../../../types';
import { STANDARD_PIPELINE_STAGES } from '../../../constants/flowConstants';

interface NodeProps {
    step: FlowStep;
    isGhost?: boolean;
    isDraggable?: boolean;
    isDragTarget?: boolean;
    isViewMode?: boolean;
    hasError?: boolean;
    hasWarning?: boolean;
    allFlows?: Flow[];
    allForms?: FormDefinition[];
    allSurveys?: any[];
    onClick?: () => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnter?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    isReportMode?: boolean;
    reportStats?: { total: number; waiting: number; processed: number; failed?: number } | null;
}

const QuickEdit = ({ onClick }: { onClick: () => void }) => (
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
        <button
            onClick={e => {
                e.stopPropagation();
                onClick();
            }}
            className="p-1.5 bg-white/90 backdrop-blur-md border border-slate-200 rounded-full shadow-sm text-slate-400 hover:text-[var(--color-primary)] hover:shadow-md transition-colors"
        >
            <MoreHorizontal className="w-4 h-4" strokeWidth={1.75} />
        </button>
    </div>
);

const ValidationBadge = ({ type, title }: { type: 'error' | 'warning'; title?: string }) => (
    <div
        title={title}
        className={`absolute -top-2.5 -right-2.5 p-1.5 rounded-full shadow-md z-[60] ring-4 ring-white ${
            type === 'error' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
        }`}
    >
        {type === 'error' ? <AlertOctagon className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
    </div>
);

export const GhostNode = memo(
    ({ label, variant = 'default' }: { label: string; variant?: 'default' | 'link' | 'warning' }) => {
        if (variant === 'link') {
            return (
                <div className="px-5 py-2 rounded-2xl bg-blue-50/60 border border-blue-200 border-dashed text-blue-700 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                    <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {label}
                </div>
            );
        }
        return (
            <div
                className={`px-5 py-2.5 rounded-2xl border-2 border-dashed text-[10px] font-bold uppercase tracking-widest ${
                    variant === 'warning'
                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                        : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
            >
                {label}
            </div>
        );
    }
);

const ReportOverlay = ({
    stats
}: {
    stats: { total: number; waiting: number; processed: number; failed?: number };
}) => (
    <div className="absolute -bottom-[2px] left-[15%] right-[15%] translate-y-full flex items-center justify-center bg-white px-4 py-2 rounded-b-2xl border-x border-b border-slate-200 shadow-md z-[100]">
        <div className="flex items-center gap-6 tabular-nums">
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Total</span>
                <span className="text-[11px] font-bold text-slate-800 leading-none">
                    {stats.total.toLocaleString()}
                </span>
            </div>
            <div className="w-px h-5 bg-slate-200"></div>
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold text-amber-600 uppercase mb-0.5">Wait</span>
                <span className="text-[11px] font-bold text-slate-800 leading-none">
                    {stats.waiting.toLocaleString()}
                </span>
            </div>
            <div className="w-px h-5 bg-slate-200"></div>
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold text-rose-600 uppercase mb-0.5">Fail</span>
                <span className="text-[11px] font-bold text-slate-800 leading-none">
                    {(stats.failed ?? 0).toLocaleString()}
                </span>
            </div>
        </div>
    </div>
);

export const TriggerNode: React.FC<NodeProps> = memo(
    ({ step, onClick, isViewMode, allForms = [], allSurveys = [], isReportMode, reportStats }) => {
        const triggerType = step.config?.type || 'segment';
        const targetId = step.config?.targetId;

        const isFormDeleted =
            triggerType === 'form' &&
            Boolean(targetId) &&
            (allForms && allForms.length > 0
                ? !allForms.find(f => f.id === targetId && !(f as any).deleted_at)
                : false);

        const isSurveyDeleted =
            triggerType === 'survey' &&
            Boolean(targetId) &&
            (allSurveys && allSurveys.length > 0
                ? !allSurveys.find(s => s.id === targetId && !s.deleted_at)
                : false);

        const getTriggerStyle = () => {
            if (isFormDeleted || isSurveyDeleted) return { icon: AlertOctagon, color: 'bg-rose-700 border-rose-800/40', label: 'LỖI LIÊN KẾT' };
            switch (triggerType) {
                case 'erp_event':
                    return { icon: Briefcase, color: 'bg-[#0F172A] border-slate-800', label: 'MYERP Event' };
                case 'segment':
                    return step.config?.targetSubtype === 'list' || step.config?.targetSubtype === 'sync'
                        ? { icon: ListPlus, color: 'bg-emerald-600 border-emerald-700/40', label: 'List Entry' }
                        : { icon: Layers, color: 'bg-[#BD1D2D] border-rose-800/40', label: 'Segment Entry' };
                case 'form':
                    return { icon: FileInput, color: 'bg-[#BD1D2D] border-rose-800/40', label: 'Form Submit' };
                case 'survey':
                    return { icon: ClipboardList, color: 'bg-amber-600 border-amber-700/40', label: 'Khảo sát' };
                case 'purchase':
                    return { icon: ShoppingCart, color: 'bg-[#BD1D2D] border-rose-800/40', label: 'Purchase Event' };
                case 'tag':
                    return { icon: Tag, color: 'bg-emerald-600 border-emerald-700/40', label: 'Tag Added' };
                case 'birthday':
                    return { icon: Cake, color: 'bg-rose-600 border-rose-700/40', label: 'Birthday Event' };
                case 'colddown':
                    return { icon: Snowflake, color: 'bg-sky-600 border-sky-700/40', label: 'Cool-down Entry' };
                default:
                    return { icon: Zap, color: 'bg-[#BD1D2D] border-rose-800/40', label: 'Trigger' };
            }
        };

        const { icon: Icon, color, label } = getTriggerStyle();

        // Metadata Resolution for Survey and Form
        const formMeta = allForms?.find(f => f.id === targetId);
        const formDisplayName = formMeta?.name || (formMeta as any)?.title;

        const surveyMeta = allSurveys?.find(s => s.id === targetId);
        const surveyDisplayName = surveyMeta?.name || surveyMeta?.title;

        // Helper to check if step.label is a raw hash ID or generic placeholder
        const isRawHash = (text?: string, id?: string) => {
            if (!text) return true;
            if (id && text.includes(id)) return true;
            if (id && id.length >= 6 && text.includes(id.substring(0, 6))) return true;
            if (/^[a-f0-9-]{8,}$/i.test(text.trim())) return true;
            if (/^(khảo sát|biểu mẫu|form):\s*[a-f0-9-]{6,}/i.test(text.trim())) return true;
            return false;
        };

        let displayLabel = step.label;
        if (triggerType === 'survey') {
            if (surveyDisplayName) {
                displayLabel = surveyDisplayName;
            } else if (isSurveyDeleted) {
                displayLabel = `Khảo sát đã xóa [${(targetId || '').substring(0, 8)}]`;
            } else if (isRawHash(step.label, targetId)) {
                displayLabel = 'Khảo sát (Không xác định)';
            }
        } else if (triggerType === 'form') {
            if (formDisplayName) {
                displayLabel = formDisplayName;
            } else if (isFormDeleted) {
                displayLabel = `Biểu mẫu đã xóa [${(targetId || '').substring(0, 8)}]`;
            } else if (isRawHash(step.label, targetId)) {
                displayLabel = 'Biểu mẫu (Không xác định)';
            }
        }

        if (!displayLabel) {
            displayLabel = 'Trigger';
        }
        const erpFilters = step.config?.erpFilters || {};
        const filterBadges: string[] = [];
        if (triggerType === 'erp_event' && erpFilters && typeof erpFilters === 'object') {
            if (erpFilters.round_id && erpFilters.round_id !== 'all') {
                filterBadges.push(`Vòng chia #${erpFilters.round_id}`);
            }
            if (erpFilters.team_id && erpFilters.team_id !== 'all') {
                filterBadges.push(`Team #${erpFilters.team_id}`);
            }
            if (Array.isArray(erpFilters.owner_ids) && erpFilters.owner_ids.length > 0) {
                filterBadges.push(`${erpFilters.owner_ids.length} Sale`);
            } else if (erpFilters.owner_id && erpFilters.owner_id !== 'all') {
                filterBadges.push(`Sale #${erpFilters.owner_id}`);
            }
            if (erpFilters.to_stage_id && erpFilters.to_stage_id !== 'all') {
                filterBadges.push(`Tới Stage #${erpFilters.to_stage_id}`);
            } else if (erpFilters.stage_id && erpFilters.stage_id !== 'all') {
                filterBadges.push(`Stage #${erpFilters.stage_id}`);
            }
            if (erpFilters.sla_hours) {
                filterBadges.push(`SLA > ${erpFilters.sla_hours}h`);
            }
            if (erpFilters.temperature && erpFilters.temperature !== 'all') {
                filterBadges.push(`Độ nóng: ${String(erpFilters.temperature).toUpperCase()}`);
            }
            if (erpFilters.branch_id && erpFilters.branch_id !== 'all') {
                filterBadges.push(`Chi nhánh #${erpFilters.branch_id}`);
            }
            if (erpFilters.program && erpFilters.program !== 'all') {
                filterBadges.push(String(erpFilters.program));
            }
        }

        return (
            <div
                onClick={e => {
                    e.stopPropagation();
                    if (!isViewMode) onClick?.();
                }}
                className={`flow-interactive relative z-20 group ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}
            >
                <div
                    className={`flex items-center gap-3.5 ${color} border text-white rounded-2xl px-5 py-4 shadow-md ${
                        !isViewMode ? 'transition-[transform,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] hover:shadow-lg' : ''
                    }`}
                >
                    <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/10 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <div className="max-w-[230px]">
                        <p className="text-[9px] font-bold uppercase tracking-widest opacity-80 leading-none mb-1">
                            {label}
                        </p>
                        <p className="text-sm font-bold leading-tight">{displayLabel}</p>
                        {isFormDeleted && (
                            <div className="flex items-center gap-1 mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    Biểu mẫu đã bị xóa
                                </span>
                            </div>
                        )}
                        {isSurveyDeleted && (
                            <div className="flex items-center gap-1 mt-1">
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded">
                                    <AlertTriangle className="w-3 h-3 shrink-0" />
                                    Khảo sát đã bị xóa
                                </span>
                            </div>
                        )}
                        {filterBadges.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                                {filterBadges.slice(0, 3).map((bText, idx) => (
                                    <span
                                        key={idx}
                                        className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-md backdrop-blur-sm"
                                    >
                                        {bText}
                                    </span>
                                ))}
                                {filterBadges.length > 3 && (
                                    <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-md">
                                        +{filterBadges.length - 3}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
                {!isViewMode && <QuickEdit onClick={onClick || (() => {})} />}
                {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
            </div>
        );
    }
);

export const ActionNode: React.FC<NodeProps> = memo(
    ({
        step,
        hasError,
        onClick,
        isDraggable,
        isDragTarget,
        onDragStart,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        isViewMode,
        isReportMode,
        reportStats
    }) => {
        const isTag = step.type === 'update_tag';
        const tagAction = step.config.action || 'add';
        const tags = step.config.tags || [];
        const incomplete = isTag
            ? tags.length === 0
            : !step.config.subject || (!step.config.templateId && !step.config.customHtml);

        return (
            <div
                draggable={isDraggable && !isViewMode}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={e => {
                    e.stopPropagation();
                    if (!isViewMode) onClick?.();
                }}
                className={`flow-interactive relative w-[260px] p-5 rounded-2xl bg-white z-20 group transition-[box-shadow,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] border border-slate-200 ${
                    isDragTarget ? '!border-blue-400 ring-2 ring-blue-300 shadow-lg' : ''
                } ${isViewMode ? 'shadow-sm' : 'hover:shadow-md hover:border-slate-300 cursor-pointer'}`}
            >
                <div className="flex items-start gap-4">
                    <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                            isTag
                                ? tagAction === 'remove'
                                    ? 'bg-rose-600'
                                    : 'bg-emerald-600'
                                : 'bg-blue-600'
                        } text-white`}
                    >
                        {isTag ? <Tag className="w-5 h-5" strokeWidth={1.75} /> : <Mail className="w-5 h-5" strokeWidth={1.75} />}
                    </div>
                    <div className="flex-1 overflow-hidden pt-0.5">
                        <p
                            className={`text-[9px] font-bold uppercase tracking-widest leading-none mb-2 ${
                                isTag ? (tagAction === 'remove' ? 'text-rose-600' : 'text-emerald-600') : 'text-blue-600'
                            }`}
                        >
                            {isTag ? (tagAction === 'remove' ? 'Remove Tag' : 'Add Tag') : 'Send Email'}
                        </p>
                        <p className="text-sm font-bold text-slate-800 truncate leading-tight">{step.label}</p>
                        {!isTag && (
                            <div className="space-y-1 mt-2">
                                <div
                                    className={`text-[10px] truncate px-2.5 py-1 rounded-lg border ${
                                        incomplete
                                            ? 'bg-rose-50 border-rose-200 text-rose-600 font-bold'
                                            : 'bg-slate-50 border-slate-200 text-slate-500'
                                    }`}
                                >
                                    {step.config.subject || (isViewMode ? 'No Subject' : 'Chưa cấu hình')}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {!isViewMode && (incomplete || hasError) && <ValidationBadge type="error" />}
                {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
                {!isViewMode && <QuickEdit onClick={onClick || (() => {})} />}
            </div>
        );
    }
);

export const RemoveNode: React.FC<NodeProps> = memo(
    ({
        step,
        onClick,
        isViewMode,
        isDraggable,
        isDragTarget,
        onDragStart,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        isReportMode,
        reportStats
    }) => {
        const actionType = step.config.actionType || 'unsubscribe';
        const isDelete = actionType === 'delete_contact';
        return (
            <div
                draggable={isDraggable && !isViewMode}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={e => {
                    e.stopPropagation();
                    if (!isViewMode) onClick?.();
                }}
                className={`flow-interactive relative w-[240px] p-4 rounded-2xl bg-white z-20 group transition-colors border border-rose-200 ${
                    isDragTarget ? '!border-blue-400 ring-2 ring-blue-200' : ''
                }`}
            >
                <div className="flex items-center gap-3">
                    <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                            isDelete ? 'bg-rose-600 text-white' : 'bg-rose-50 border border-rose-200 text-rose-600'
                        }`}
                    >
                        {isDelete ? <Trash2 className="w-5 h-5" strokeWidth={1.75} /> : <UserMinus className="w-5 h-5" strokeWidth={1.75} />}
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest leading-none mb-1">
                            {isDelete ? 'Delete Forever' : 'Unsubscribe'}
                        </p>
                        <p className="text-xs font-bold text-slate-800">{step.label}</p>
                    </div>
                </div>
                {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
                {!isViewMode && <QuickEdit onClick={onClick || (() => {})} />}
            </div>
        );
    }
);

export const WaitNode: React.FC<NodeProps> = memo(
    ({
        step,
        onClick,
        isViewMode,
        isDraggable,
        onDragStart,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop
    }) => {
        const mode = step.config.mode || 'duration';
        const incomplete =
            mode === 'until_date'
                ? !step.config.specificDate || !step.config.untilTime
                : mode === 'until'
                ? !step.config.untilTime
                : mode === 'until_attribute'
                ? !step.config.attributeKey
                : !step.config.duration || !step.config.unit;
        return (
            <div
                draggable={isDraggable && !isViewMode}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={e => {
                    e.stopPropagation();
                    if (!isViewMode) onClick?.();
                }}
                className={`flow-interactive relative z-20 group ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}
            >
                <div
                    className={`flex items-center gap-4 bg-white border rounded-full pl-2 pr-8 py-2 shadow-sm transition-colors w-fit min-w-[200px] ${
                        incomplete
                            ? 'border-rose-200 ring-4 ring-rose-50'
                            : 'border-slate-200 hover:border-slate-300 hover:shadow-md'
                    }`}
                >
                    <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                            incomplete
                                ? 'bg-rose-100 text-rose-600'
                                : 'text-white bg-amber-500'
                        }`}
                    >
                        <Clock className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className={`text-[8px] font-bold uppercase tracking-[0.2em] leading-none mb-1.5 ${incomplete ? 'text-rose-400' : 'text-amber-600'}`}>
                            Wait Delay
                        </span>
                        <span className={`text-sm font-bold truncate ${incomplete ? 'text-rose-600' : 'text-slate-900'}`}>
                            {incomplete ? 'Chưa cấu hình' : step.label}
                        </span>
                    </div>
                </div>
                {!isViewMode && incomplete && <ValidationBadge type="error" />}
                {!isViewMode && <QuickEdit onClick={onClick || (() => {})} />}
            </div>
        );
    }
);

export const ConditionNode: React.FC<NodeProps> = memo(
    ({ step, onClick, isViewMode, hasWarning, isReportMode, reportStats }) => {
        const incomplete = !step.config.conditionType || step.config.waitDuration === undefined;
        const unitMap: any = { minutes: 'phút', hours: 'giờ', days: 'ngày', weeks: 'tuần' };
        const getActionInfo = () => {
            switch (step.config.conditionType) {
                case 'crm_sale_contacted':
                    return { label: 'Sale đã liên hệ?', icon: PhoneCall };
                case 'crm_assigned_to':
                    return { label: 'Phân bổ Sale?', icon: UserCheck };
                case 'crm_stage_is':
                case 'stage_matches':
                    return { label: 'Giai đoạn Pipeline?', icon: Briefcase };
                case 'crm_temperature_is':
                    return { label: 'Độ nóng Lead?', icon: Zap };
                case 'deposit_paid':
                case 'has_deposit':
                    return { label: 'Đã đặt cọc?', icon: ShoppingCart };
                case 'erp_is_student':
                    return { label: 'Đã nhập học?', icon: UserCheck };
                case 'channel_reachability':
                    return { label: 'Kênh khả dụng?', icon: MessageSquare };
                case 'opened':
                    return { label: 'Đã mở Email?', icon: MailOpen };
                case 'clicked':
                case 'clicked_specific':
                    return { label: 'Đã click Link?', icon: MousePointer2 };
                case 'replied':
                    return { label: 'Đã phản hồi?', icon: MessageSquare };
                case 'zalo_interacted':
                    return { label: 'Tương tác Zalo?', icon: MessageSquare };
                case 'survey_completed':
                    return { label: 'Hoàn thành Survey?', icon: FileInput };
                case 'voucher_claimed':
                    return { label: 'Nhận Voucher?', icon: Tag };
                case 'unsubscribed':
                    return { label: 'Hủy đăng ký', icon: UserMinus };
                default:
                    return { label: 'Đang theo dõi...', icon: Hourglass };
            }
        };
        const { icon: Icon, label: actionLabel } = getActionInfo();
        const isInstantCheck = Number(step.config.waitDuration) === 0;

        return (
            <div
                onClick={e => {
                    e.stopPropagation();
                    if (!isViewMode) onClick?.();
                }}
                className={`flow-interactive relative z-20 group w-[240px] bg-white border rounded-2xl shadow-md overflow-hidden transition-colors ${
                    incomplete ? 'border-rose-200' : 'border-slate-200 hover:border-slate-300'
                }`}
            >
                <div className="p-1 bg-slate-50 border-b border-slate-100 flex gap-1">
                    <div className="h-1.5 flex-1 rounded-full bg-emerald-400"></div>
                    <div className="h-1.5 flex-1 rounded-full bg-rose-400"></div>
                </div>
                <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-[#0F172A] flex items-center justify-center text-white shadow-sm">
                            <GitMerge className="w-5 h-5" strokeWidth={1.75} />
                        </div>
                        <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
                            Logic
                        </p>
                    </div>
                    <p className="text-sm font-bold text-slate-800 leading-tight mb-3">{step.label}</p>
                    {!incomplete ? (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                            <Icon className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                            <span className="truncate">
                                {isInstantCheck
                                    ? `Kiểm tra tức thì: ${actionLabel}`
                                    : `Wait: ${step.config.waitDuration} ${unitMap[step.config.waitUnit] || 'giờ'}`}
                            </span>
                        </div>
                    ) : (
                        <div className="text-[10px] text-rose-600 font-bold bg-rose-50 px-3 py-2 rounded-lg text-center">
                            Chưa cấu hình
                        </div>
                    )}
                </div>
                {!isViewMode && incomplete && <ValidationBadge type="error" />}
                {!isViewMode && hasWarning && !incomplete && (
                    <ValidationBadge
                        type="warning"
                        title="CẢNH BÁO: Cả hai nhánh đều dẫn đến hành động giống hệt nhau."
                    />
                )}
                {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
                {!isViewMode && <QuickEdit onClick={onClick || (() => {})} />}
            </div>
        );
    }
);

export const SplitTestNode: React.FC<NodeProps> = memo(
    ({ step, onClick, isViewMode, hasWarning, isReportMode, reportStats }) => {
        const ratioA = step.config.ratioA || 50;
        const ratioB = step.config.ratioB || 50;
        return (
            <div
                onClick={e => {
                    e.stopPropagation();
                    if (!isViewMode) onClick?.();
                }}
                className={`flow-interactive relative z-20 group w-[220px] bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden transition-[box-shadow,border-color] duration-200 ${
                    !isViewMode ? 'hover:border-slate-300 hover:shadow-lg' : ''
                }`}
            >
                <div className="w-full h-1 bg-blue-600"></div>
                <div className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-sm">
                            <Beaker className="w-5 h-5" strokeWidth={1.75} />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest">A/B Test</p>
                            <p className="text-xs font-bold text-slate-800">Chia nhóm</p>
                        </div>
                    </div>
                    <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
                        <div
                            className="absolute left-0 top-0 h-full bg-blue-600"
                            style={{ width: `${ratioA}%` }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-xs font-bold tabular-nums">
                        <div className="text-blue-600">A: {ratioA}%</div>
                        <div className="text-slate-500">B: {ratioB}%</div>
                    </div>
                </div>
                {!isViewMode && hasWarning && (
                    <ValidationBadge
                        type="warning"
                        title="CẢNH BÁO: Cả hai nhánh A/B đều dẫn đến hành động giống hệt nhau."
                    />
                )}
                {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
                {!isViewMode && <QuickEdit onClick={onClick || (() => {})} />}
            </div>
        );
    }
);

export const LinkNode: React.FC<NodeProps> = memo(
    ({ step, onClick, hasError, isViewMode, isReportMode, reportStats, allFlows = [] }) => {
        const linkedFlow = allFlows.find(f => f.id === step.config.linkedFlowId);
        const flowLabel = linkedFlow ? linkedFlow.name : 'Chưa liên kết kịch bản';

        return (
            <div
                onClick={e => {
                    e.stopPropagation();
                    if (!isViewMode) onClick?.();
                }}
                className={`flow-interactive relative z-20 group ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}
            >
                <div
                    className={`pl-2 pr-6 py-2.5 rounded-full border flex items-center gap-3 transition-colors duration-200 ${
                        hasError
                            ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-sm'
                            : 'bg-[#0F172A] border-slate-800 text-white shadow-md hover:bg-slate-800'
                    }`}
                >
                    <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                            hasError
                                ? 'bg-rose-100 text-rose-600'
                                : 'bg-white/10 text-white border border-white/10 group-hover:bg-white/20'
                        }`}
                    >
                        <LinkIcon className="w-4 h-4" strokeWidth={1.75} />
                    </div>
                    <div className="text-left">
                        <span
                            className={`text-[8px] font-bold uppercase tracking-widest block ${
                                hasError ? 'text-rose-500' : 'text-slate-400'
                            }`}
                        >
                            Chuyển tiếp
                        </span>
                        <span className="text-xs font-bold block max-w-[200px] truncate">
                            {flowLabel}
                        </span>
                    </div>
                </div>
                {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
                {!isViewMode && <QuickEdit onClick={onClick || (() => {})} />}
            </div>
        );
    }
);

export const ListActionNode: React.FC<NodeProps> = memo(
    ({
        step,
        onClick,
        isViewMode,
        isDraggable,
        onDragStart,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        isReportMode,
        reportStats
    }) => {
        const action = step.config.action || 'add';
        return (
            <div
                draggable={isDraggable && !isViewMode}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={e => {
                    e.stopPropagation();
                    if (!isViewMode) onClick?.();
                }}
                className={`flow-interactive relative w-[260px] p-5 rounded-2xl bg-white z-20 group transition-[box-shadow,border-color] duration-200 border border-slate-200 ${
                    isViewMode ? 'shadow-sm' : 'hover:shadow-md hover:border-slate-300 cursor-pointer'
                }`}
            >
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-sm">
                        <List className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 overflow-hidden pt-0.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest leading-none mb-2 text-[var(--color-primary)]">
                            {action === 'add' ? 'Add to List' : 'Remove from List'}
                        </p>
                        <p className="text-sm font-bold text-slate-800 truncate">{step.label}</p>
                    </div>
                </div>
                {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
                {!isViewMode && <QuickEdit onClick={onClick || (() => {})} />}
            </div>
        );
    }
);

export const ZaloZNSNode: React.FC<NodeProps> = memo(
    ({
        step,
        hasError,
        hasWarning,
        onClick,
        isDraggable,
        onDragStart,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        isViewMode,
        isReportMode,
        reportStats
    }) => {
        const incomplete = !step.config.zalo_oa_id || !step.config.template_id;
        return (
            <div
                draggable={isDraggable && !isViewMode}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={e => {
                    e.stopPropagation();
                    if (!isViewMode) onClick?.();
                }}
                className={`flow-interactive relative w-[260px] p-5 rounded-2xl bg-white z-20 group transition-[box-shadow,border-color] duration-200 border border-slate-200 ${
                    isViewMode ? 'shadow-sm' : 'hover:shadow-md hover:border-slate-300 cursor-pointer'
                }`}
            >
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
                        <img src={`${EXTERNAL_ASSET_BASE}/imgs/zalolog.png`} alt="Zalo" className="w-6 h-6" />
                    </div>
                    <div className="flex-1 overflow-hidden pt-0.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest leading-none mb-2 text-blue-600">
                            Zalo Template
                        </p>
                        <p className="text-sm font-bold text-slate-800 truncate">
                            {step.label === 'Bước mới' ? 'Gửi tin ZNS' : step.label}
                        </p>
                        <div className="space-y-1 mt-2">
                            <div
                                className={`text-[10px] truncate px-2.5 py-1 rounded-lg border ${
                                    incomplete
                                        ? 'bg-rose-50 border-rose-200 text-rose-600 font-bold'
                                        : 'bg-slate-50 border-slate-200 text-slate-500'
                                }`}
                            >
                                {step.config.template_id ? `Template: ${step.config.template_id}` : 'Chưa cấu hình'}
                            </div>
                        </div>
                    </div>
                </div>
                {!isViewMode && (incomplete || hasError) && <ValidationBadge type="error" />}
                {!isViewMode && hasWarning && !(incomplete || hasError) && (
                    <ValidationBadge type="warning" title="Template ZNS cần kiểm tra lại" />
                )}
                {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
                {!isViewMode && <QuickEdit onClick={onClick || (() => {})} />}
            </div>
        );
    }
);

export const CrmActionNode: React.FC<NodeProps> = memo(
    ({
        step,
        hasError,
        onClick,
        isDraggable,
        isDragTarget,
        onDragStart,
        onDragEnter,
        onDragOver,
        onDragLeave,
        onDrop,
        isViewMode,
        isReportMode,
        reportStats
    }) => {
        const actionType = step.config?.actionType || step.config?.crmActionType || 'update_stage';

        const getActionSummary = () => {
            switch (actionType) {
                case 'update_stage': {
                    const stageLabel =
                        step.config?.stage_name ||
                        STANDARD_PIPELINE_STAGES.find(s => s.value === String(step.config?.stage_id))?.label ||
                        (step.config?.stage_id ? `Stage #${step.config.stage_id}` : 'Cập nhật Lead');
                    const temp = step.config?.temperature ? ` • ${String(step.config.temperature).toUpperCase()}` : '';
                    return {
                        badge: 'MYERP Pipeline',
                        detail: `${stageLabel}${temp}`,
                        icon: Briefcase
                    };
                }
                case 'create_task': {
                    const isCall = (step.config?.task_type || 'call') === 'call';
                    return {
                        badge: isCall ? 'Lịch gọi Sale' : 'Task CRM',
                        detail: step.config?.subject || step.config?.taskSubject || 'Tạo công việc cho Sale',
                        icon: PhoneCall
                    };
                }
                case 'assign_owner': {
                    return {
                        badge: 'Phân bổ Sale',
                        detail: step.config?.owner_name || (step.config?.owner_id || step.config?.ownerId ? `Sale: #${step.config.owner_id || step.config.ownerId}` : 'Chưa chọn Sale'),
                        icon: UserCheck
                    };
                }
                case 'assign_round_robin': {
                    const roundInfo = step.config?.roundId ? `Vòng chia #${step.config.roundId}` : 'Tất cả Sale đang trực';
                    const shiftInfo = step.config?.respectShifts !== false ? ' • Theo ca trực' : '';
                    return {
                        badge: 'Chia Round-Robin',
                        detail: `${roundInfo}${shiftInfo}`,
                        icon: UserCheck
                    };
                }
                case 'reassign_if_uncontacted': {
                    const roundInfo = step.config?.roundId ? `Vòng chia #${step.config.roundId}` : 'Sale khác trong ca';
                    return {
                        badge: 'Thu hồi & Chia lại SLA',
                        detail: `Chuyển sang: ${roundInfo}`,
                        icon: UserCheck
                    };
                }
                case 'update_temperature': {
                    const tempVal = String(step.config?.temperature || 'hot').toUpperCase();
                    return {
                        badge: 'Cập nhật Độ nóng',
                        detail: `Độ nóng: ${tempVal}`,
                        icon: Zap
                    };
                }
                case 'notify_owner': {
                    return {
                        badge: 'Thông báo Sale',
                        detail: step.config?.notifyTitle || step.config?.message || step.config?.body || 'Thông báo nội bộ MYERP',
                        icon: BellRing
                    };
                }
                case 'create_support_ticket': {
                    return {
                        badge: 'Phiếu Hỗ trợ / Học vụ',
                        detail: step.config?.ticket_subject || step.config?.subject || 'Tạo Ticket hỗ trợ MYERP',
                        icon: Briefcase
                    };
                }
                default:
                    return {
                        badge: 'Tác vụ CRM',
                        detail: step.label,
                        icon: Briefcase
                    };
            }
        };

        const { badge, detail, icon: IconComp } = getActionSummary();

        return (
            <div
                draggable={isDraggable && !isViewMode}
                onDragStart={onDragStart}
                onDragEnter={onDragEnter}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={e => {
                    e.stopPropagation();
                    if (!isViewMode) onClick?.();
                }}
                className={`flow-interactive relative w-[260px] p-5 rounded-2xl bg-white z-20 group transition-[box-shadow,border-color] duration-200 border border-slate-200 ${
                    isDragTarget ? '!border-slate-400 ring-2 ring-slate-200 shadow-lg' : ''
                } ${isViewMode ? 'shadow-sm' : 'hover:shadow-md hover:border-slate-300 cursor-pointer'}`}
            >
                <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#0F172A] text-white flex items-center justify-center shrink-0 shadow-sm">
                        <IconComp className="w-5 h-5" strokeWidth={1.75} />
                    </div>
                    <div className="flex-1 overflow-hidden pt-0.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest leading-none mb-2 text-[#BD1D2D]">
                            {badge}
                        </p>
                        <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                            {step.label === 'Bước mới' ? 'Tác vụ CRM (MYERP)' : step.label}
                        </p>
                        <div className="mt-2">
                            <div className="text-[10px] truncate px-2.5 py-1 rounded-lg border bg-slate-50 border-slate-200 text-slate-700 font-semibold">
                                {detail}
                            </div>
                        </div>
                    </div>
                </div>
                {!isViewMode && hasError && <ValidationBadge type="error" />}
                {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
                {!isViewMode && <QuickEdit onClick={onClick || (() => {})} />}
            </div>
        );
    }
);

export const AdvancedConditionNode: React.FC<NodeProps> = memo(
    ({ step, onClick, isViewMode, hasWarning, isReportMode, reportStats }) => {
        const branches = step.config?.branches || (step as any).branches || [];
        return (
            <div
                onClick={e => {
                    e.stopPropagation();
                    if (!isViewMode) onClick?.();
                }}
                className={`relative group z-30 ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}
            >
                {!isViewMode && <QuickEdit onClick={() => onClick?.()} />}
                {hasWarning && <ValidationBadge type="warning" />}
                <div
                    className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl shadow-md transition-colors bg-[#0F172A] border border-slate-700 text-white ring-4 ring-white ${
                        !isViewMode ? 'hover:bg-slate-800' : ''
                    }`}
                >
                    <GitMerge className="w-7 h-7 rotate-90" strokeWidth={1.75} />
                </div>
                <div className="absolute top-0 left-16 ml-3 w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                    <div className="bg-slate-900 text-white text-[10px] p-2.5 rounded-xl font-semibold shadow-xl border border-slate-700">
                        <p className="uppercase tracking-widest text-slate-400 mb-1">Advanced Split</p>
                        {branches.map((b: any, i: number) => (
                            <div key={i} className="flex justify-between text-slate-300 gap-2">
                                <span className="truncate">{b.label || b.name || `Nhánh ${i + 1}`}</span>
                                <span>→</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="bg-white/95 backdrop-blur px-2.5 py-0.5 rounded-full text-[10px] font-bold text-slate-700 shadow-sm border border-slate-200">
                        {step.label}
                    </span>
                </div>
                {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
            </div>
        );
    }
);
