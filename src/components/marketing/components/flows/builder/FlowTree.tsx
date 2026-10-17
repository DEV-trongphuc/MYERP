import React, { memo, useState, useRef } from 'react';
import { FlowStep, Flow, FormDefinition } from '../../../types';
import { AddBtn, ErrorConnector } from './FlowTools';
import {
    ActionNode, WaitNode, ConditionNode, TriggerNode, LinkNode, GhostNode,
    SplitTestNode, RemoveNode, ListActionNode, ZaloZNSNode, CrmActionNode, AdvancedConditionNode
} from '../nodes/FlowNodes';
import { StraightConnector, BranchConnector, MultiBranchConnector } from './FlowConnector';
import { Flag } from 'lucide-react';

interface FlowTreeProps {
    stepId?: string;
    parentId?: string;
    parentType?: string;
    branch?: 'yes' | 'no' | 'A' | 'B';
    flow: Flow;
    allFlows: Flow[];
    allForms?: FormDefinition[];
    isViewMode?: boolean;
    draggedStepId: string | null;
    onEditStep: (step: FlowStep) => void;
    onAddStep: (parentId: string, branch?: 'yes' | 'no' | 'A' | 'B', isInsert?: boolean) => void;
    onQuickAddWait: (parentId: string, branch?: 'yes' | 'no' | 'A' | 'B') => void;
    onSwapSteps: (sourceId: string, targetId: string) => void;
    setDraggedStepId: (id: string | null) => void;
    depth?: number;
    pathIds?: string;
    hasPendingEmail?: boolean;
    isReportMode?: boolean;
    realtimeDistribution?: Record<string, { count: number; avg_wait: number }>;
    onReportClick?: (stepId: string, type: string) => void;
}

const FlowTreeInner = memo(({
    step, nextPathIds,
    parentId, parentType, branch,
    flow, allFlows, allForms = [], isViewMode = false, draggedStepId,
    onEditStep, onAddStep, onQuickAddWait, onSwapSteps, setDraggedStepId,
    depth = 0, hasPendingEmail = false,
    isReportMode, realtimeDistribution, onReportClick
}: any) => {
    const [isDragHovering, setIsDragHovering] = useState(false);
    const dragEnterCount = useRef(0);

    const isCondition = step.type === 'condition';
    const steps = flow?.steps || [];
    const isSplitTest = step.type === 'split_test';
    const isLink = step.type === 'link_flow';
    const isRemove = step.type === 'remove_action';
    const isSending = ['action', 'zalo_zns', 'zalo_cs'].includes(step.type);
    const isWaiting = ['wait', 'condition'].includes(step.type);

    const hasSpamError = hasPendingEmail && isSending;
    const nextPendingEmail = isSending ? true : (isWaiting ? false : hasPendingEmail);

    const isRedundant = () => {
        if (isViewMode) return false;

        const areStepsIdentical = (s1: FlowStep, s2: FlowStep) => {
            if (s1.type !== s2.type) return false;
            return JSON.stringify(s1.config) === JSON.stringify(s2.config);
        };

        if (step.type === 'condition' && step.yesStepId && step.noStepId) {
            const yesStep = steps.find((s: FlowStep) => s.id === step.yesStepId);
            const noStep = steps.find((s: FlowStep) => s.id === step.noStepId);
            if (yesStep && noStep && areStepsIdentical(yesStep, noStep)) return true;
        }

        if (step.type === 'split_test' && step.pathAStepId && step.pathBStepId) {
            const stepA = steps.find((s: FlowStep) => s.id === step.pathAStepId);
            const stepB = steps.find((s: FlowStep) => s.id === step.pathBStepId);
            if (stepA && stepB && areStepsIdentical(stepA, stepB)) return true;
        }

        return false;
    };

    const getReportStats = () => {
        if (!isReportMode || !realtimeDistribution) return null;

        let waiting = realtimeDistribution[step.id]?.count || 0;

        const parentStep = parentId ? steps.find((s: FlowStep) => s.id === parentId) : null;
        if (parentStep && parentStep.type === 'wait') {
            waiting += realtimeDistribution[parentStep.id]?.count || 0;
        }

        const processed = (step as any).stats?.processed || 0;
        let totalProcessed = processed;
        if (step.type === 'condition') {
            totalProcessed = Math.max(processed, ((step as any).stats?.matched || 0) + ((step as any).stats?.timed_out || 0));
        }

        const failed = (step as any).stats?.failed || 0;

        return {
            waiting,
            processed: totalProcessed,
            failed,
            total: waiting + totalProcessed + failed
        };
    };

    const reportStats = getReportStats();
    const hasWarning = isRedundant();

    const commonProps = React.useMemo(() => ({
        step,
        isDraggable: step.type !== 'trigger' && !isViewMode,
        isDragTarget: isDragHovering,
        hasError: hasSpamError,
        hasWarning,
        isViewMode,
        allForms,
        isReportMode,
        reportStats,
        onClick: () => isReportMode ? onReportClick?.(step.id, step.type) : onEditStep(step),
        onDragStart: (e: React.DragEvent) => {
            if (step.type === 'trigger' || isViewMode) return;
            setDraggedStepId(step.id);
            e.dataTransfer.setData('text/plain', step.id);
            e.dataTransfer.effectAllowed = 'move';
            e.stopPropagation();
        },
        onDragEnter: (e: React.DragEvent) => {
            if (draggedStepId && draggedStepId !== step.id && !isViewMode) {
                e.preventDefault();
                dragEnterCount.current += 1;
                if (dragEnterCount.current === 1) setIsDragHovering(true);
            }
        },
        onDragOver: (e: React.DragEvent) => {
            if (draggedStepId && draggedStepId !== step.id && !isViewMode) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            }
        },
        onDragLeave: () => {
            if (draggedStepId && !isViewMode) {
                dragEnterCount.current -= 1;
                if (dragEnterCount.current <= 0) {
                    dragEnterCount.current = 0;
                    setIsDragHovering(false);
                }
            }
        },
        onDrop: (e: React.DragEvent) => {
            if (isViewMode) return;
            e.preventDefault();
            e.stopPropagation();
            dragEnterCount.current = 0;
            setIsDragHovering(false);
            const sourceId = e.dataTransfer.getData('text/plain');
            if (sourceId && sourceId !== step.id) {
                onSwapSteps(sourceId, step.id);
                setDraggedStepId(null);
            }
        }
    }), [step, isDragHovering, hasSpamError, hasWarning, isViewMode, allForms, isReportMode, reportStats, draggedStepId, onReportClick, onEditStep, setDraggedStepId, onSwapSteps]);

    const nextProps = React.useMemo(() => ({
        flow, allFlows, allForms, isViewMode, draggedStepId,
        onEditStep, onAddStep, onQuickAddWait, onSwapSteps, setDraggedStepId,
        depth: depth + 1, pathIds: nextPathIds, hasPendingEmail: nextPendingEmail,
        isReportMode, realtimeDistribution, onReportClick
    }), [flow, allFlows, allForms, isViewMode, draggedStepId, onEditStep, onAddStep, onQuickAddWait, onSwapSteps, setDraggedStepId, depth, nextPathIds, nextPendingEmail, isReportMode, realtimeDistribution, onReportClick]);

    const CONNECTOR_HEIGHT = 100;

    const handleDropOnAdd = (e: React.DragEvent, pId: string) => {
        if (isViewMode) return;
        e.preventDefault();
        e.stopPropagation();
        const sourceId = e.dataTransfer.getData('text/plain');
        if (sourceId && sourceId !== pId) {
            onSwapSteps(sourceId, pId);
            setDraggedStepId(null);
        }
    };

    return (
        <div className="flex flex-col items-center relative animate-in fade-in duration-500 w-max min-w-full">
            {parentId && !hasSpamError && (!branch || parentType === 'advanced_condition') && !isViewMode && (
                <AddBtn
                    onClick={() => onAddStep(parentId, branch as any, true)}
                    onQuickWait={() => onQuickAddWait(parentId, branch as any)}
                    isDropTarget={!!draggedStepId}
                    onDrop={(e) => handleDropOnAdd(e, parentId)}
                    isReportMode={isReportMode}
                />
            )}

            {hasSpamError && parentId && !isViewMode && (
                <ErrorConnector parentId={parentId} branch={branch as any} onQuickFix={onQuickAddWait} isReportMode={isReportMode} />
            )}

            {parentId && hasSpamError && isViewMode && (
                <StraightConnector height={40} isError={true} />
            )}

            {!parentId && !isViewMode && <div className="h-6" />}
            {parentId && !hasSpamError && isViewMode && !branch && <StraightConnector height={40} />}

            <div className="z-[50] relative" id={`step-node-${step.id}`}>
                {(() => {
                    switch (step.type) {
                        case 'trigger': return <TriggerNode {...commonProps} />;
                        case 'wait': return <WaitNode {...commonProps} />;
                        case 'condition': return <ConditionNode {...commonProps} />;
                        case 'split_test': return <SplitTestNode {...commonProps} />;
                        case 'link_flow': return <LinkNode {...commonProps} allFlows={allFlows} hasError={!step.config.linkedFlowId} />;
                        case 'remove_action': return <RemoveNode {...commonProps} />;
                        case 'list_action': return <ListActionNode {...commonProps} />;
                        case 'zalo_zns': return <ZaloZNSNode {...commonProps} />;
                        case 'crm_action': return <CrmActionNode {...commonProps} />;
                        case 'advanced_condition': return <AdvancedConditionNode {...commonProps} />;
                        default: return <ActionNode {...commonProps} />;
                    }
                })()}
            </div>

            <div className="w-full flex flex-col items-center">
                {isRemove ? (
                    <div className="mt-2 flex flex-col items-center opacity-30">
                        <Flag className="w-5 h-5 text-rose-400" />
                        <span className="text-[9px] font-black text-rose-400 uppercase mt-0.5">Terminated</span>
                    </div>
                ) : isLink ? (
                    step.config.linkedFlowId && (
                        <div className="flex flex-col items-center">
                            <StraightConnector height={40} />
                            <GhostNode variant="link" label={`Kịch bản: ${allFlows.find((f: Flow) => f.id === step.config.linkedFlowId)?.name || '...'}`} />
                        </div>
                    )
                ) : (isCondition || isSplitTest) ? (
                    <div className="flex flex-col items-center w-full relative">
                        <div className="relative flex flex-nowrap w-max" style={{ paddingTop: CONNECTOR_HEIGHT }}>
                            <BranchConnector
                                height={CONNECTOR_HEIGHT}
                                dashed={true}
                                leftColor={isCondition ? '#10b981' : '#8b5cf6'}
                                rightColor={isCondition ? '#f43f5e' : '#8b5cf6'}
                            />

                            <div className="flex-1 flex flex-col items-center relative px-20 min-w-[300px]">
                                <div className={`absolute top-[-50px] z-20 px-4 py-1.5 rounded-full shadow-lg text-[10px] font-bold uppercase tracking-widest border transform -translate-y-1/2 ring-4 ${isCondition ? 'bg-emerald-50 border-emerald-200 text-emerald-600 ring-emerald-50/50' : 'bg-white border-blue-200 text-blue-500 ring-blue-50/50'}`}>
                                    {isCondition ? 'IF' : 'NHÁNH A'}
                                </div>
                                {isCondition ? (
                                    step.yesStepId ? <FlowTree stepId={step.yesStepId} parentId={step.id} parentType={step.type} branch="yes" {...nextProps} /> :
                                        !isViewMode && (
                                            <div className="flex flex-col items-center mt-4">
                                                <AddBtn isDropTarget={!!draggedStepId} onDrop={(e) => handleDropOnAdd(e, step.id)} onClick={() => onAddStep(step.id, 'yes')} onQuickWait={() => onQuickAddWait(step.id, 'yes')} branch="yes" isReportMode={isReportMode} />
                                                <div className={`flex flex-col items-center mt-4 ${isReportMode ? 'opacity-10' : 'opacity-30'}`}>
                                                    <Flag className="w-5 h-5 text-slate-300" />
                                                    <span className="text-[9px] font-black text-slate-300 uppercase mt-0.5">End</span>
                                                </div>
                                            </div>
                                        )
                                ) : (
                                    step.pathAStepId ? <FlowTree stepId={step.pathAStepId} parentId={step.id} parentType={step.type} branch="A" {...nextProps} /> :
                                        !isViewMode && (
                                            <div className="flex flex-col items-center mt-4">
                                                <AddBtn isDropTarget={!!draggedStepId} onDrop={(e) => handleDropOnAdd(e, step.id)} onClick={() => onAddStep(step.id, 'A')} onQuickWait={() => onQuickAddWait(step.id, 'A')} branch="A" isReportMode={isReportMode} />
                                                <div className={`flex flex-col items-center mt-4 ${isReportMode ? 'opacity-10' : 'opacity-30'}`}>
                                                    <Flag className="w-5 h-5 text-slate-300" />
                                                    <span className="text-[9px] font-black text-slate-300 uppercase mt-0.5">End</span>
                                                </div>
                                            </div>
                                        )
                                )}
                            </div>

                            <div className="flex-1 flex flex-col items-center relative px-20 min-w-[300px]">
                                <div className={`absolute top-[-50px] z-20 px-4 py-1.5 rounded-full shadow-lg text-[10px] font-bold uppercase tracking-widest border transform -translate-y-1/2 ring-4 ${isCondition ? 'bg-rose-50 border-rose-200 text-rose-500 ring-rose-50/50' : 'bg-white border-slate-200 text-slate-400 ring-slate-50/50'}`}>
                                    {isCondition ? 'ELSE' : 'NHÁNH B'}
                                </div>
                                {isCondition ? (
                                    step.noStepId ? <FlowTree stepId={step.noStepId} parentId={step.id} parentType={step.type} branch="no" {...nextProps} /> :
                                        !isViewMode && (
                                            <div className="flex flex-col items-center mt-4">
                                                <AddBtn isDropTarget={!!draggedStepId} onDrop={(e) => handleDropOnAdd(e, step.id)} onClick={() => onAddStep(step.id, 'no')} onQuickWait={() => onQuickAddWait(step.id, 'no')} branch="no" isReportMode={isReportMode} />
                                                <div className={`flex flex-col items-center mt-4 ${isReportMode ? 'opacity-10' : 'opacity-30'}`}>
                                                    <Flag className="w-5 h-5 text-slate-300" />
                                                    <span className="text-[9px] font-black text-slate-300 uppercase mt-0.5">End</span>
                                                </div>
                                            </div>
                                        )
                                ) : (
                                    step.pathBStepId ? <FlowTree stepId={step.pathBStepId} parentId={step.id} parentType={step.type} branch="B" {...nextProps} /> :
                                        !isViewMode && (
                                            <div className="flex flex-col items-center mt-4">
                                                <AddBtn isDropTarget={!!draggedStepId} onDrop={(e) => handleDropOnAdd(e, step.id)} onClick={() => onAddStep(step.id, 'B')} onQuickWait={() => onQuickAddWait(step.id, 'B')} branch="B" isReportMode={isReportMode} />
                                                <div className={`flex flex-col items-center mt-4 ${isReportMode ? 'opacity-10' : 'opacity-30'}`}>
                                                    <Flag className="w-5 h-5 text-slate-300" />
                                                    <span className="text-[9px] font-black text-slate-300 uppercase mt-0.5">End</span>
                                                </div>
                                            </div>
                                        )
                                )}
                            </div>
                        </div>
                    </div>
                ) : (step.type === 'advanced_condition') ? (
                    <div className="flex flex-col items-center w-full relative">
                        <div className="relative flex flex-nowrap w-max" style={{ paddingTop: CONNECTOR_HEIGHT }}>
                            <MultiBranchConnector
                                height={CONNECTOR_HEIGHT}
                                branches={(step.config.branches || []).length + 1}
                            />

                            {/* Render Branches */}
                            {(step.config.branches || []).map((b: any, index: number) => {
                                const branchStepId = b.nextStepId || b.stepId;
                                return (
                                    <div key={b.id || index} className="flex flex-col items-center px-4 relative min-w-[300px] flex-1">
                                        <div className="absolute" style={{ marginTop: -CONNECTOR_HEIGHT / 2, zIndex: 10 }}>
                                            <div className="bg-white border border-blue-100 text-blue-600 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                                                {b.label}
                                            </div>
                                        </div>
                                        {branchStepId ? (
                                            <FlowTree
                                                {...nextProps}
                                                stepId={branchStepId}
                                                parentId={step.id}
                                                parentType={step.type}
                                                branch={b.id as any}
                                            />
                                        ) : (
                                            <div className="pt-10">
                                                <AddBtn
                                                    onClick={() => onAddStep(step.id, b.id, false)}
                                                    onQuickWait={() => onQuickAddWait(step.id, b.id)}
                                                    isDropTarget={false}
                                                    isReportMode={isReportMode}
                                                />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Default Branch */}
                            <div className="flex flex-col items-center px-4 relative min-w-[300px] flex-1">
                                <div className="absolute" style={{ marginTop: -CONNECTOR_HEIGHT / 2, zIndex: 10 }}>
                                    <div className="bg-slate-50 border border-slate-100 text-slate-400 text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm whitespace-nowrap">
                                        Mặc định
                                    </div>
                                </div>
                                {step.config.defaultStepId ? (
                                    <FlowTree
                                        {...nextProps}
                                        stepId={step.config.defaultStepId}
                                        parentId={step.id}
                                        parentType={step.type}
                                    />
                                ) : (
                                    <div className="pt-10">
                                        <AddBtn
                                            onClick={() => onAddStep(step.id, undefined, false)}
                                            onQuickWait={() => onQuickAddWait(step.id, undefined)}
                                            isDropTarget={false}
                                            isReportMode={isReportMode}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center w-full">
                        {step.nextStepId ? (
                            <FlowTree stepId={step.nextStepId} parentId={step.id} parentType={step.type} {...nextProps} />
                        ) : (
                            !isViewMode && (
                                <div className="flex flex-col items-center">
                                    <AddBtn
                                        isDropTarget={!!draggedStepId}
                                        onDrop={(e) => handleDropOnAdd(e, step.id)}
                                        onClick={() => onAddStep(step.id)}
                                        onQuickWait={() => onQuickAddWait(step.id)}
                                        isReportMode={isReportMode}
                                    />
                                    <div className={`mt-2 flex flex-col items-center ${isReportMode ? 'opacity-10' : 'opacity-20'}`}>
                                        <Flag className="w-5 h-5 text-slate-400" />
                                        <span className="text-[9px] font-black text-slate-400 uppercase mt-0.5">End</span>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                )}
            </div>
        </div>
    );
});

const FlowTree: React.FC<FlowTreeProps> = memo((props) => {
    const { stepId, flow, depth = 0, pathIds = '' } = props;
    if (!stepId) return null;
    const steps = flow.steps || [];
    const step = steps.find((s: any) => s.id === stepId);
    if (!step) return null;

    const visitedIds = pathIds ? pathIds.split(',') : [];
    const isActuallyLoop = visitedIds.includes(stepId);
    if (depth >= 50 || isActuallyLoop) {
        return (
            <div className="flex flex-col items-center">
                <StraightConnector height={40} isError={true} />
                <GhostNode label={isActuallyLoop ? 'CẢNH BÁO: Phát hiện vòng lặp' : 'CẢNH BÁO: Quá tải độ sâu'} />
                <div className="text-[9px] text-rose-500 font-bold mt-1">
                    {isActuallyLoop ? `Bước này kết nối ngược lại bước [${step.label}]` : 'Kịch bản quá dài hoặc vượt quá giới hạn 50 tầng'}
                </div>
            </div>
        );
    }

    const nextPathIds = pathIds ? `${pathIds},${stepId}` : stepId;
    return <FlowTreeInner {...props} step={step} nextPathIds={nextPathIds} />;
});

export default FlowTree;
