
import { EXTERNAL_ASSET_BASE } from '../../../utils/config';
import React, { memo } from 'react';
import { Zap, Mail, Clock, GitMerge, Tag, Link as LinkIcon, MoreHorizontal, AlertOctagon, AlertTriangle, Beaker, Hourglass, MousePointer2, MailOpen, MessageSquare, UserMinus, Filter, ShoppingCart, Layers, Cake, Snowflake, Send, Plus, Minus, Trash2, List, ListPlus, Paperclip, FileInput, ArrowRight } from 'lucide-react';
import { FlowStep, Flow, FormDefinition } from '../../../types';

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
    onClick?: () => void;
    onDragStart?: (e: React.DragEvent) => void;
    onDragEnter?: (e: React.DragEvent) => void;
    onDragOver?: (e: React.DragEvent) => void;
    onDragLeave?: (e: React.DragEvent) => void;
    onDrop?: (e: React.DragEvent) => void;
    isReportMode?: boolean;
    reportStats?: { total: number, waiting: number, processed: number, failed?: number } | null;
}

const QuickEdit = ({ onClick }: { onClick: () => void }) => (
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-50">
        <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="p-1.5 bg-white/80 backdrop-blur-md border border-slate-100 rounded-full shadow-sm text-slate-400 hover:text-amber-600 hover:shadow-md transform hover:scale-110 transition-all">
            <MoreHorizontal className="w-4 h-4" />
        </button>
    </div>
);

const ValidationBadge = ({ type, title }: { type: 'error' | 'warning', title?: string }) => (
    <div title={title} className={`absolute -top-2.5 -right-2.5 p-1.5 rounded-full shadow-xl z-[60] animate-bounce ring-4 ring-white ${type === 'error' ? 'bg-rose-600 text-white' : 'bg-amber-400 text-white'
        }`}>
        {type === 'error'
            ? <AlertOctagon className="w-4 h-4" />
            : <AlertTriangle className="w-4 h-4" />
        }
    </div>
);

export const GhostNode = memo(({ label, variant = 'default' }: { label: string; variant?: 'default' | 'link' | 'warning' }) => {
    if (variant === 'link') {
        return (
            <div className="px-5 py-2 rounded-2xl bg-blue-50/30 border border-blue-100/70 border-dashed text-blue-600 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm animate-in fade-in zoom-in duration-500">
                <ArrowRight className="w-3.5 h-3.5 animate-pulse" />
                {label}
            </div>
        );
    }
    return (
        <div className={`px-5 py-2.5 rounded-2xl border-2 border-dashed text-[10px] font-bold uppercase tracking-widest animate-in fade-in zoom-in duration-500 ${
            variant === 'warning'
                ? 'bg-rose-50 border-rose-200 text-rose-500'
                : 'bg-slate-50 border-slate-200 text-slate-400'
        }`}>
            {label}
        </div>
    );
});

const ReportOverlay = ({ stats }: { stats: { total: number, waiting: number, processed: number, failed?: number } }) => (
    <div className="absolute -bottom-[2px] left-[15%] right-[15%] translate-y-full flex items-center justify-center bg-white px-4 py-2 rounded-b-xl border-x border-b border-slate-100 shadow-[0_12px_30px_-5px_rgba(0,0,0,0.12)] z-[100] animate-in slide-in-from-top-1 duration-300">
        <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Total</span>
                <span className="text-[11px] font-black text-slate-800 leading-none">{stats.total.toLocaleString()}</span>
            </div>
            <div className="w-px h-5 bg-slate-50"></div>
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold text-amber-500 uppercase mb-0.5">Wait</span>
                <span className="text-[11px] font-black text-slate-800 leading-none">{stats.waiting.toLocaleString()}</span>
            </div>
            <div className="w-px h-5 bg-slate-50"></div>
            <div className="flex flex-col items-center">
                <span className="text-[9px] font-bold text-rose-500 uppercase mb-0.5">Fail</span>
                <span className="text-[11px] font-black text-slate-800 leading-none">{(stats.failed ?? 0).toLocaleString()}</span>
            </div>
        </div>
    </div>
);

export const TriggerNode: React.FC<NodeProps> = memo(({ step, onClick, isViewMode, allForms = [], isReportMode, reportStats }) => {
    const hasFilter = !!step.config.filterSegmentId;
    const triggerType = step.config.type || 'segment';
    const isFormDeleted = triggerType === 'form' && step.config.targetId && !allForms.find(f => f.id === step.config.targetId);

    const getTriggerStyle = () => {
        if (isFormDeleted) return { icon: AlertOctagon, color: 'from-rose-500 to-red-700', label: 'LỖI LIÊN KẾT' };
        switch (triggerType) {
            case 'segment': return (step.config.targetSubtype === 'list' || step.config.targetSubtype === 'sync') ? { icon: ListPlus, color: 'from-emerald-500 to-teal-600', label: 'List Entry' } : { icon: Layers, color: 'from-amber-400 to-amber-600', label: 'Segment Entry' };
            case 'form': return { icon: FileInput, color: 'from-[#f59e0b] to-[#d97706]', label: 'Form Submit' };
            case 'purchase': return { icon: ShoppingCart, color: 'from-pink-500 to-rose-600', label: 'Purchase Event' };
            case 'tag': return { icon: Tag, color: 'from-emerald-500 to-teal-600', label: 'Tag Added' };
            case 'birthday': return { icon: Cake, color: 'from-pink-400 to-rose-500', label: 'Birthday Event' };
            case 'colddown': return { icon: Snowflake, color: 'from-sky-400 to-blue-500', label: 'Cool-down Entry' };
            default: return { icon: Zap, color: 'from-amber-400 to-amber-600', label: 'Trigger' };
        }
    };

    const { icon: Icon, color, label } = getTriggerStyle();

    return (
        <div onClick={(e) => { e.stopPropagation(); if (!isViewMode) onClick?.(); }} className={`flow-interactive relative z-20 group ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}>
            <div className={`flex items-center gap-3 bg-gradient-to-br ${color} text-white rounded-[24px] px-5 py-3.5 shadow-xl ${!isViewMode ? 'transition-all hover:scale-105 hover:-translate-y-1' : ''}`}>
                <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></div>
                <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest opacity-80 leading-none mb-1">{label}</p>
                    <p className="text-sm font-black leading-tight">{step.label}</p>
                    {isFormDeleted && <p className="text-[9px] opacity-90 font-bold mt-0.5">Form đã bị xóa</p>}
                </div>
            </div>
            {!isViewMode && <QuickEdit onClick={onClick || (() => { })} />}
            {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
        </div>
    );
});

export const ActionNode: React.FC<NodeProps> = memo(({ step, hasError, hasWarning, onClick, isDraggable, isDragTarget, onDragStart, onDragEnter, onDragOver, onDragLeave, onDrop, isViewMode, isReportMode, reportStats }) => {
    const isTag = step.type === 'update_tag';
    const tagAction = step.config.action || 'add';
    const tags = step.config.tags || [];
    const incomplete = isTag ? tags.length === 0 : (!step.config.subject || (!step.config.templateId && !step.config.customHtml));

    return (
        <div draggable={isDraggable && !isViewMode} onDragStart={onDragStart} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onClick={(e) => { e.stopPropagation(); if (!isViewMode) onClick?.(); }}
            className={`flow-interactive relative w-[260px] p-5 rounded-[28px] bg-white z-20 group transition-all duration-300 border border-slate-100 ${isDragTarget ? 'scale-[1.04] !border-blue-400 ring-2 ring-blue-300 shadow-lg' : ''} ${isViewMode ? 'shadow-sm' : 'hover:shadow-xl hover:-translate-y-1.5 cursor-pointer'}`}>
            <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${isTag ? (tagAction === 'remove' ? 'bg-gradient-to-br from-rose-400 to-rose-600' : 'bg-gradient-to-br from-emerald-400 to-emerald-600') : 'bg-gradient-to-br from-blue-400 to-indigo-500'} text-white`}>
                    {isTag ? <Tag className="w-5 h-5" /> : <Mail className="w-5 h-5" />}
                </div>
                <div className="flex-1 overflow-hidden pt-0.5">
                    <p className={`text-[9px] font-bold uppercase tracking-widest leading-none mb-2 ${isTag ? (tagAction === 'remove' ? 'text-rose-600' : 'text-emerald-600') : 'text-blue-600'}`}>
                        {isTag ? (tagAction === 'remove' ? 'Remove Tag' : 'Add Tag') : 'Send Email'}
                    </p>
                    <p className="text-sm font-bold text-slate-800 truncate leading-tight">{step.label}</p>
                    {!isTag && (
                        <div className="space-y-1 mt-2">
                            <div className={`text-[10px] truncate px-2 py-1 rounded-lg border ${incomplete ? 'bg-rose-50 border-rose-100 text-rose-600 font-bold' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                                {step.config.subject || (isViewMode ? 'No Subject' : 'Chưa cấu hình')}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            {!isViewMode && (incomplete || hasError) && <ValidationBadge type="error" />}
            {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
            {!isViewMode && <QuickEdit onClick={onClick || (() => { })} />}
        </div>
    );
});

export const RemoveNode: React.FC<NodeProps> = memo(({ step, onClick, isViewMode, isDraggable, isDragTarget, onDragStart, onDragEnter, onDragOver, onDragLeave, onDrop, isReportMode, reportStats }) => {
    const actionType = step.config.actionType || 'unsubscribe';
    const isDelete = actionType === 'delete_contact';
    return (
        <div draggable={isDraggable && !isViewMode} onDragStart={onDragStart} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onClick={(e) => { e.stopPropagation(); if (!isViewMode) onClick?.(); }}
            className={`flow-interactive relative w-[240px] p-4 rounded-[24px] bg-white z-20 group transition-all border border-rose-100 ${isDragTarget ? 'scale-[1.04] !border-blue-400' : ''}`}>
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${isDelete ? 'bg-gradient-to-br from-rose-500 to-red-700 text-white' : 'bg-rose-50 text-rose-600'}`}>
                    {isDelete ? <Trash2 className="w-5 h-5" /> : <UserMinus className="w-5 h-5" />}
                </div>
                <div>
                    <p className="text-[9px] font-bold text-rose-500 uppercase tracking-widest leading-none mb-1">{isDelete ? 'Delete Forever' : 'Unsubscribe'}</p>
                    <p className="text-xs font-bold text-slate-800">{step.label}</p>
                </div>
            </div>
            {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
            {!isViewMode && <QuickEdit onClick={onClick || (() => { })} />}
        </div>
    );
});

export const WaitNode: React.FC<NodeProps> = memo(({ step, onClick, isViewMode, isDraggable, isDragTarget, onDragStart, onDragEnter, onDragOver, onDragLeave, onDrop }) => {
    const incomplete = !step.config.duration || !step.config.unit;
    const unitMap: any = { minutes: 'phút', hours: 'giờ', days: 'ngày', weeks: 'tuần' };
    return (
        <div draggable={isDraggable && !isViewMode} onDragStart={onDragStart} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onClick={(e) => { e.stopPropagation(); if (!isViewMode) onClick?.(); }}
            className={`flow-interactive relative z-20 group ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}>
            <div className={`flex items-center gap-4 bg-white border rounded-full pl-2 pr-8 py-2 shadow-lg transition-all w-fit min-w-[200px] ${incomplete ? 'border-rose-200 ring-4 ring-rose-50' : 'border-slate-100 hover:border-amber-400'}`}>
                <div 
                    className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-lg ${incomplete ? 'bg-rose-100 text-rose-600' : 'text-white'}`}
                    style={incomplete ? {} : { background: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)' }}
                >
                    <Clock className="w-6 h-6" />
                </div>
                <div className="flex flex-col overflow-hidden">
                    <span className="text-[8px] font-bold uppercase text-slate-400 tracking-[0.2em] leading-none mb-1.5">Wait Delay</span>
                    <span className={`text-sm font-bold truncate ${incomplete ? 'text-rose-600' : 'text-slate-900'}`}>{incomplete ? 'Chưa cấu hình' : step.label}</span>
                </div>
            </div>
            {!isViewMode && incomplete && <ValidationBadge type="error" />}
            {!isViewMode && <QuickEdit onClick={onClick || (() => { })} />}
        </div>
    );
});

export const ConditionNode: React.FC<NodeProps> = memo(({ step, onClick, isViewMode, hasWarning, isReportMode, reportStats }) => {
    const incomplete = !step.config.conditionType || step.config.waitDuration === undefined;
    const unitMap: any = { minutes: 'phút', hours: 'giờ', days: 'ngày', weeks: 'tuần' };
    const getActionInfo = () => {
        switch (step.config.conditionType) {
            case 'opened': return { label: 'Đã mở Email?', icon: MailOpen };
            case 'clicked': return { label: 'Đã click Link?', icon: MousePointer2 };
            case 'replied': return { label: 'Đã phản hồi?', icon: MessageSquare };
            case 'unsubscribed': return { label: 'Hủy đăng ký', icon: UserMinus };
            default: return { label: 'Đang theo dõi...', icon: Hourglass };
        }
    };
    const { label: actionText, icon: Icon } = getActionInfo();

    return (
        <div onClick={(e) => { e.stopPropagation(); if (!isViewMode) onClick?.(); }}
            className={`flow-interactive relative z-20 group w-[240px] bg-white border rounded-[28px] shadow-lg overflow-hidden transition-all ${incomplete ? 'border-rose-200' : 'border-slate-100 hover:border-indigo-200'}`}>
            <div className="p-1 bg-slate-50 border-b border-slate-100 flex gap-1">
                <div className="h-1.5 flex-1 rounded-full bg-emerald-400"></div>
                <div className="h-1.5 flex-1 rounded-full bg-rose-400"></div>
            </div>
            <div className="p-5">
                <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg"><GitMerge className="w-5 h-5" /></div>
                    <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg">Logic</p>
                </div>
                <p className="text-sm font-bold text-slate-800 leading-tight mb-3">{step.label}</p>
                {!incomplete ? (
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100">
                        <Icon className="w-3.5 h-3.5 text-amber-600" />
                        <span>Wait: {step.config.waitDuration} {unitMap[step.config.waitUnit] || 'giờ'}</span>
                    </div>
                ) : <div className="text-[10px] text-rose-600 font-bold bg-rose-50 px-3 py-2 rounded-xl text-center">Chưa cấu hình</div>}
            </div>
            {!isViewMode && incomplete && <ValidationBadge type="error" />}
            {!isViewMode && hasWarning && !incomplete && <ValidationBadge type="warning" title="CẢNH BÁO: Cả hai nhánh đều dẫn đến hành động giống hệt nhau." />}
            {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
            {!isViewMode && <QuickEdit onClick={onClick || (() => { })} />}
        </div>
    );
});

export const SplitTestNode: React.FC<NodeProps> = memo(({ step, onClick, isViewMode, hasWarning, isReportMode, reportStats }) => {
    const ratioA = step.config.ratioA || 50;
    const ratioB = step.config.ratioB || 50;
    return (
        <div onClick={(e) => { e.stopPropagation(); if (!isViewMode) onClick?.(); }}
            className={`flow-interactive relative z-20 group w-[220px] bg-white border border-slate-100 rounded-[28px] shadow-lg overflow-hidden transition-all ${!isViewMode ? 'hover:border-blue-300 hover:-translate-y-1.5' : ''}`}>
            <div className="w-full h-1 bg-gradient-to-r from-blue-500 to-purple-400"></div>
            <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-fuchsia-600 flex items-center justify-center text-white shadow-lg"><Beaker className="w-5 h-5" /></div>
                    <div>
                        <p className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">A/B Test</p>
                        <p className="text-xs font-bold text-slate-800">Chia nhóm</p>
                    </div>
                </div>
                <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden mb-3">
                    <div className="absolute left-0 top-0 h-full bg-blue-500" style={{ width: `${ratioA}%` }}></div>
                </div>
                <div className="flex justify-between text-xs font-bold">
                    <div className="text-blue-600">A: {ratioA}%</div>
                    <div className="text-slate-400">B: {ratioB}%</div>
                </div>
            </div>
            {!isViewMode && hasWarning && <ValidationBadge type="warning" title="CẢNH BÁO: Cả hai nhánh A/B đều dẫn đến hành động giống hệt nhau." />}
            {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
            {!isViewMode && <QuickEdit onClick={onClick || (() => { })} />}
        </div>
    );
});

export const LinkNode: React.FC<NodeProps> = memo(({ step, onClick, hasError, isViewMode, isReportMode, reportStats, allFlows = [] }) => {
    const linkedFlow = allFlows.find(f => f.id === step.config.linkedFlowId);
    const flowLabel = linkedFlow ? linkedFlow.name : 'Chưa liên kết kịch bản';

    return (
        <div onClick={(e) => { e.stopPropagation(); if (!isViewMode) onClick?.(); }} className={`flow-interactive relative z-20 group ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}>
            <div className={`pl-2 pr-6 py-2.5 rounded-full border flex items-center gap-3 transition-all duration-300 ${
                hasError
                    ? 'bg-rose-50 border-rose-200 text-rose-600 shadow-lg shadow-rose-500/5 hover:-translate-y-0.5'
                    : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 border-blue-500/30 text-white shadow-[0_10px_25px_-5px_rgba(99,102,241,0.35)] hover:shadow-[0_15px_30px_-5px_rgba(99,102,241,0.5)] hover:-translate-y-0.5 hover:scale-[1.03]'
            }`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                    hasError
                        ? 'bg-rose-100 text-rose-600'
                        : 'bg-white/15 text-white ring-2 ring-white/10 shadow-inner group-hover:bg-white/25 group-hover:scale-105'
                }`}>
                    <LinkIcon className="w-4 h-4" />
                </div>
                <div className="text-left">
                    <span className={`text-[8px] font-bold uppercase tracking-widest block ${hasError ? 'text-rose-400' : 'text-blue-200/90'}`}>Chuyển tiếp</span>
                    <span className="text-xs font-extrabold tracking-tight block max-w-[200px] truncate">{flowLabel}</span>
                </div>
            </div>
            {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
            {!isViewMode && <QuickEdit onClick={onClick || (() => { })} />}
        </div>
    );
});

export const ListActionNode: React.FC<NodeProps> = memo(({ step, onClick, isViewMode, isDraggable, isDragTarget, onDragStart, onDragEnter, onDragOver, onDragLeave, onDrop, isReportMode, reportStats }) => {
    const action = step.config.action || 'add';
    return (
        <div draggable={isDraggable && !isViewMode} onDragStart={onDragStart} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onClick={(e) => { e.stopPropagation(); if (!isViewMode) onClick?.(); }}
            className={`flow-interactive relative w-[260px] p-5 rounded-[28px] bg-white z-20 group transition-all border border-slate-100 ${isViewMode ? 'shadow-sm' : 'hover:shadow-xl hover:-translate-y-1.5 cursor-pointer'}`}>
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center shadow-lg"><List className="w-5 h-5" /></div>
                <div className="flex-1 overflow-hidden pt-0.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest leading-none mb-2 text-orange-600">{action === 'add' ? 'Add to List' : 'Remove from List'}</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{step.label}</p>
                </div>
            </div>
            {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
            {!isViewMode && <QuickEdit onClick={onClick || (() => { })} />}
        </div>
    );
});

export const ZaloZNSNode: React.FC<NodeProps> = memo(({ step, hasError, hasWarning, onClick, isDraggable, isDragTarget, onDragStart, onDragEnter, onDragOver, onDragLeave, onDrop, isViewMode, isReportMode, reportStats }) => {
    const incomplete = !step.config.zalo_oa_id || !step.config.template_id;
    return (
        <div draggable={isDraggable && !isViewMode} onDragStart={onDragStart} onDragEnter={onDragEnter} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            onClick={(e) => { e.stopPropagation(); if (!isViewMode) onClick?.(); }}
            className={`flow-interactive relative w-[260px] p-5 rounded-[28px] bg-white z-20 group transition-all border border-slate-100 ${isViewMode ? 'shadow-sm' : 'hover:shadow-xl hover:-translate-y-1.5 cursor-pointer'}`}>
            <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center shadow-lg"><img src={`${EXTERNAL_ASSET_BASE}/imgs/zalolog.png`} alt="Zalo" className="w-6 h-6" /></div>
                <div className="flex-1 overflow-hidden pt-0.5">
                    <p className="text-[9px] font-bold uppercase tracking-widest leading-none mb-2 text-blue-600">Zalo Template</p>
                    <p className="text-sm font-bold text-slate-800 truncate">{step.label === 'Bước mới' ? 'Gửi tin ZNS' : step.label}</p>
                    <div className="space-y-1 mt-2">
                        <div className={`text-[10px] truncate px-2 py-1 rounded-lg border ${incomplete ? 'bg-rose-50 border-rose-100 text-rose-600 font-bold' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                            {step.config.template_id ? `Template: ${step.config.template_id}` : 'Chưa cấu hình'}
                        </div>
                    </div>
                </div>
            </div>
            {!isViewMode && (incomplete || hasError) && <ValidationBadge type="error" />}
            {!isViewMode && hasWarning && !(incomplete || hasError) && <ValidationBadge type="warning" title="Template ZNS cần kiểm tra lại" />}
            {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
            {!isViewMode && <QuickEdit onClick={onClick || (() => { })} />}
        </div>
    );
});

export const AdvancedConditionNode: React.FC<NodeProps> = memo(({ step, onClick, isViewMode, hasWarning, isReportMode, reportStats }) => {
    const branches = step.config.branches || [];
    return (
        <div onClick={(e) => { e.stopPropagation(); if (!isViewMode) onClick?.(); }} className={`relative group z-30 ${isViewMode ? 'cursor-default' : 'cursor-pointer'}`}>
            {!isViewMode && <QuickEdit onClick={() => onClick?.()} />}
            {hasWarning && <ValidationBadge type="warning" />}
            <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl shadow-xl transition-all bg-gradient-to-br from-blue-600 to-fuchsia-600 text-white ring-4 ring-white ${!isViewMode ? 'hover:scale-110' : ''}`}><GitMerge className="w-8 h-8 rotate-90" /></div>
            <div className="absolute top-0 left-16 ml-3 w-40 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50">
                <div className="bg-slate-800 text-white text-[10px] p-2 rounded-lg font-bold shadow-xl">
                    <p className="uppercase tracking-widest text-slate-400 mb-1">Advanced Split</p>
                    {branches.map((b: any, i: number) => <div key={i} className="flex justify-between text-slate-300"><span>{b.label}</span><span>→</span></div>)}
                </div>
            </div>
            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap"><span className="bg-white/90 backdrop-blur px-2 py-0.5 rounded-full text-[10px] font-black text-slate-600 shadow-sm border border-slate-100">{step.label}</span></div>
            {isReportMode && reportStats && <ReportOverlay stats={reportStats} />}
        </div>
    );
});
