
import { EXTERNAL_ASSET_BASE } from '../../../utils/config';
import React, { useState, useMemo, useEffect, memo, useRef } from 'react';
import {
    Users, CheckCircle2, Mail, MousePointerClick, Activity, Filter,
    X, Target, Zap, Search, Download, UserPlus, Tag, ListPlus,
    MoreHorizontal, MailOpen, ChevronRight, ChevronDown, ChevronUp, Check, Plus, Save,
    FastForward, UserMinus, RefreshCcw, ArrowRightLeft, Loader2,
    Clock, History, CalendarClock, Layers, FileInput, Calendar, Send,
    GitMerge, Beaker, Link as LinkIcon, Trash2, AlertOctagon, ShoppingCart, List, UserCheck,
    Play, Pause, Eraser, FileDown, ExternalLink, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Flow, Subscriber } from '../../../types';
import { api } from '../../../services/storageAdapter';
import Skeleton from '../../common/Skeleton';
import Card from '../../common/Card';
import Badge from '../../common/Badge';
import toast from 'react-hot-toast';
import StepErrorModal from '../modals/StepErrorModal';
import StepUnsubscribeModal from '../modals/StepUnsubscribeModal';
import StepParticipantsModal from '../modals/StepParticipantsModal';
import ConfirmModal from '../../common/ConfirmModal';
import FlowSimulateModal from '../modals/FlowSimulateModal';
import { generateFlowStepLabels } from '../../../utils/flowLabeling';

const FlowAnalyticsTab: React.FC<{ 
    flow: Flow; 
    onSelectSubscriber?: (subscriber: any) => void;
}> = memo(({ flow, onSelectSubscriber }) => {
    const navigate = useNavigate();
    const containerRef = useRef<HTMLDivElement>(null);

    const [modalParticipants, setModalParticipants] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [currentFlow, setCurrentFlow] = useState<Flow>(flow); // Local copy for fresh stats
    const [loadingList, setLoadingList] = useState(false);
    // NEW: Track active branch for each split step
    const [activeBranches, setActiveBranches] = useState<Record<string, string>>({});

    // Inactive Users State
    const [isInactiveModalOpen, setIsInactiveModalOpen] = useState(false);
    const [inactiveUsers, setInactiveUsers] = useState<any[]>([]);
    const [inactivePagination, setInactivePagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    const [loadingInactive, setLoadingInactive] = useState(false);
    // NEW: Track completed user stats by branch (leaf node id -> count)
    const [completedBranchStats, setCompletedBranchStats] = useState<Record<string, number>>({});
    // NEW: Real-time Waiting Distribution from Backend (Updated to support Bottleneck Detection)
    const [realtimeDistribution, setRealtimeDistribution] = useState<Record<string, { count: number, avg_wait: number }>>({});
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
    const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
    const [selectedBranchFilter, setSelectedBranchFilter] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showOpens, setShowOpens] = useState(false);
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);
    // NEW: Execution Log State
    const [logPage, setLogPage] = useState(1);
    const [logPagination, setLogPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
    const [logSearchTerm, setLogSearchTerm] = useState('');
    const [debouncedLogSearch, setDebouncedLogSearch] = useState('');
    const [logTypeFilter, setLogTypeFilter] = useState('');
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [isLoadingMoreLogs, setIsLoadingMoreLogs] = useState(false);

    // Error and Unsubscribe Modal States
    const [errorModal, setErrorModal] = useState({ isOpen: false, stepId: '', stepLabel: '', users: [] });
    const [unsubscribeModal, setUnsubscribeModal] = useState({ isOpen: false, stepId: '', stepLabel: '', users: [] });

    // Confirmation Modal State
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => { } });

    const [isLogFilterOpen, setIsLogFilterOpen] = useState(false);
    const logFilterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (logFilterRef.current && !logFilterRef.current.contains(event.target as Node)) {
                setIsLogFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const logTypeOptions = [
        { id: '', label: 'Tất cả', icon: Filter, color: 'text-slate-400' },
        { id: 'open', label: 'Mở email', icon: MailOpen, color: 'text-emerald-500' },
        { id: 'click', label: 'Click link', icon: MousePointerClick, color: 'text-amber-500' },
        { id: 'sent', label: 'Đã gửi', icon: Send, color: 'text-blue-500' },
        { id: 'failed', label: 'Lỗi gửi', icon: AlertOctagon, color: 'text-rose-500' },
        { id: 'unsubscribe', label: 'Hủy đăng ký', icon: UserMinus, color: 'text-orange-500' },
        { id: 'enter_flow', label: 'Tham gia', icon: Plus, color: 'text-indigo-500' },
        { id: 'complete_flow', label: 'Hoàn thành', icon: Check, color: 'text-emerald-500' },
    ];

    const currentLogFilter = logTypeOptions.find(opt => opt.id === logTypeFilter) || logTypeOptions[0];

    // Participants Modal State
    const [isParticipantsModalOpen, setIsParticipantsModalOpen] = useState(false);
    const [isSimulateModalOpen, setIsSimulateModalOpen] = useState(false);
    const [modalTab, setModalTab] = useState<'waiting' | 'opened' | 'failed' | 'unsubscribed' | 'all' | 'clicks' | 'all_touched' | 'report' | 'zns_sent' | 'zns_clicked' | 'zns_replied' | 'zns_failed'>('all_touched');

    const triggerStep = useMemo(() => currentFlow.steps.find(s => s.type === 'trigger'), [currentFlow.steps]);

    // Safe access to stats with defaults
    const rawStats = currentFlow.stats || { enrolled: 0, completed: 0, totalSent: 0, totalOpened: 0, uniqueOpened: 0, totalClicked: 0, totalFailed: 0, totalUnsubscribed: 0, totalZaloClicked: 0, uniqueZaloClicked: 0 };

    // [FIX] Tổng gửi/mở/lỗi phải cộng từ TỪNG step action thay vì dùng stat_total_sent
    // stat_total_sent chỉ lưu campaign stats (campaign gốc), không gồm email steps trong flow
    const stepAggregated = useMemo(() => {
        const actionSteps = currentFlow.steps.filter((s: any) => s.type === 'action' || s.type === 'zalo_zns');
        return actionSteps.reduce((acc: any, s: any) => {
            const st = s.stats || {};
            acc.totalSent += (st.sent || 0);
            acc.totalFailed += (st.failed || 0);
            acc.totalOpened += (st.opened || 0);
            acc.uniqueOpened += (st.unique_opened || 0);
            acc.totalClicked += (st.clicked || 0);
            return acc;
        }, { totalSent: 0, totalFailed: 0, totalOpened: 0, uniqueOpened: 0, totalClicked: 0 });
    }, [currentFlow.steps]);

    // Sử dụng step-aggregated cho send/open/fail; enrolled/completed/unsub lấy từ rawStats (backend tính đúng)
    const stats = {
        ...rawStats,
        totalSent: stepAggregated.totalSent > 0 ? stepAggregated.totalSent : rawStats.totalSent,
        totalFailed: stepAggregated.totalFailed > 0 ? stepAggregated.totalFailed : rawStats.totalFailed,
        totalOpened: stepAggregated.totalOpened > 0 ? stepAggregated.totalOpened : rawStats.totalOpened,
        uniqueOpened: stepAggregated.uniqueOpened > 0 ? stepAggregated.uniqueOpened : rawStats.uniqueOpened,
        totalClicked: stepAggregated.totalClicked > 0 ? stepAggregated.totalClicked : rawStats.totalClicked,
    };

    // Calculate Rates
    const realOpenRate = (stats.totalSent || 0) > 0
        ? Math.round(((stats.uniqueOpened || 0) / stats.totalSent) * 100)
        : 0;

    const errorRate = (stats.totalSent || 0) > 0
        ? ((stats.totalFailed || 0) / ((stats.totalSent || 0) + (stats.totalFailed || 0)) * 100).toFixed(1)
        : "0.0";

    const completionRate = (stats.enrolled || 0) > 0
        ? Math.round(((stats.completed || 0) / stats.enrolled) * 100)
        : 0;


    // Memoize labels for unified usage
    const flowLabels = useMemo(() => generateFlowStepLabels(currentFlow), [currentFlow]);

    // --- HELPER: GET VISUAL STYLE FOR NODE ---
    const getNodeStyle = (step: any) => {
        const type = step.type;
        const config = step.config || {};

        // 1. TRIGGER STYLES
        if (type === 'trigger') {
            const tType = config.type || 'segment';
            switch (tType) {
                case 'segment': return (config.targetSubtype === 'list' || config.targetSubtype === 'sync') ? { icon: ListPlus, gradient: 'from-emerald-500 to-teal-600', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'List Trigger' } : { icon: Layers, gradient: 'from-orange-500 to-[#BD1D2D]', inlineGradient: 'linear-gradient(135deg, #f97316 0%, #BD1D2D 100%)', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', label: 'Segment Trigger' };
                case 'form': return { icon: FileInput, gradient: 'from-[#BD1D2D] to-[#991522]', inlineGradient: 'linear-gradient(135deg, #BD1D2D 0%, #f97316 100%)', text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-500/10', label: 'Form Trigger' };
                case 'purchase': return { icon: ShoppingCart, gradient: 'from-pink-500 to-rose-600', text: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-500/10', label: 'Purchase Trigger' };
                case 'custom_event': return { icon: Zap, gradient: 'from-blue-500 to-indigo-600', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', label: 'Custom Event' };
                case 'tag': return { icon: Tag, gradient: 'from-emerald-500 to-teal-600', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'Tag Trigger' };
                case 'date': return { icon: Calendar, gradient: 'from-blue-500 to-indigo-600', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', label: 'Date Event' };
                case 'campaign': return { icon: Send, gradient: 'from-blue-500 to-purple-600', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', label: 'Campaign Trigger' };
                default: return { icon: Zap, gradient: 'from-slate-700 to-slate-900', text: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-800', label: 'Trigger' };
            }
        }

        // 2. ACTION STYLES
        switch (type) {
            case 'action': return { icon: Mail, gradient: 'from-blue-600 to-indigo-700', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', label: 'Email' };
            case 'zalo_zns': return {
                icon: ({ className }: { className?: string }) => (
                    <img
                        src={`${EXTERNAL_ASSET_BASE}/imgs/zalolog.png`}
                        alt="Zalo"
                        className={className}
                    />
                ),
                gradient: 'from-blue-400 to-blue-600',
                text: 'text-blue-600 dark:text-blue-400',
                bg: 'bg-blue-50 dark:bg-blue-500/10',
                label: 'Zalo ZNS'
            };
            case 'wait': return { icon: Clock, gradient: 'from-amber-400 to-orange-500', inlineGradient: 'linear-gradient(135deg, #fbbf24 0%, #f97316 100%)', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10', label: 'Delay' };
            case 'condition': return { icon: GitMerge, gradient: 'from-indigo-500 to-purple-600', text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10', label: 'Condition' };
            case 'advanced_condition': return { icon: GitMerge, gradient: 'from-indigo-500 to-purple-600', text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-500/10', label: 'Adv. Condition' };
            case 'split_test': return { icon: Beaker, gradient: 'from-blue-500 to-fuchsia-600', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', label: 'A/B Test' };
            case 'update_tag': return { icon: Tag, gradient: 'from-emerald-500 to-emerald-700', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'Update Tag' };
            case 'list_action': return { icon: List, gradient: 'from-orange-500 to-orange-700', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-500/10', label: 'List Action' };
            case 'link_flow': return { icon: LinkIcon, gradient: 'from-slate-700 to-slate-900', text: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-800', label: 'Jump Flow' };
            case 'remove_action': return { icon: UserMinus, gradient: 'from-rose-500 to-red-600', text: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-500/10', label: 'Clean Up' };
            default: return { icon: CheckCircle2, gradient: 'from-slate-400 to-slate-500', text: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800', label: 'Step' };
        }
    };

    // CHUYỂN ĐỔI DỮ LIỆU THỰC TẾ SANG FUNNEL (REAL-TIME LOGIC)
    const funnelData = useMemo(() => {
        // 1. TOPOLOGICAL SORT: Get steps in execution order (Start -> End)
        const sortedSteps: any[] = [];
        const trigger = currentFlow.steps.find(s => s.type === 'trigger');

        if (trigger) {
            const queue = [trigger.id];
            const visited = new Set<string>();

            while (queue.length > 0) {
                const currentId = queue.shift()!;
                if (visited.has(currentId)) continue;
                visited.add(currentId);

                const step = currentFlow.steps.find(s => s.id === currentId);
                if (step) {
                    sortedSteps.push(step);
                    // Add children to queue
                    if (step.nextStepId) queue.push(step.nextStepId);
                    if (step.yesStepId) queue.push(step.yesStepId);
                if (step.noStepId) queue.push(step.noStepId);
                if (step.pathAStepId) queue.push(step.pathAStepId);
                if (step.pathBStepId) queue.push(step.pathBStepId);
                if (step.type === 'advanced_condition') {
                    if (Array.isArray(step.config?.branches)) {
                        step.config.branches.forEach((b: any) => { if (b?.stepId) queue.push(b.stepId); });
                    }
                    if (step.config?.defaultStepId) queue.push(step.config.defaultStepId);
                }
                }
            }
        } else {
            // Fallback if no trigger (shouldn't happen in valid flow)
            sortedSteps.push(...currentFlow.steps);
        }

        // Filter for Action Steps from the SORTED steps - ADD zalo_zns
        const actionSteps = sortedSteps.filter(s => ['action', 'zalo_zns', 'update_tag', 'condition', 'wait', 'list_action', 'remove_action'].includes(s.type));

        // 2. Tạo Map index để biết thứ tự bước
        const stepIndexMap: Record<string, number> = {};
        actionSteps.forEach((s, idx) => { stepIndexMap[s.id] = idx; });

        // 3. (REMOVED REDUNDANT DISTRIBUTION LOGIC)
        // Distribution is now handled by realtimeDistribution fetch for accuracy and performance.

        // Build Parent Map for Branch Labeling (Kept existing)
        const parentMap: Record<string, { id: string, branch: string }> = {};
        currentFlow.steps.forEach(s => {
            if (s.nextStepId) parentMap[s.nextStepId] = { id: s.id, branch: 'next' };
            if (s.yesStepId) parentMap[s.yesStepId] = { id: s.id, branch: 'yes' };
            if (s.noStepId) parentMap[s.noStepId] = { id: s.id, branch: 'no' };
            if (s.pathAStepId) parentMap[s.pathAStepId] = { id: s.id, branch: 'A' };
            if (s.pathBStepId) parentMap[s.pathBStepId] = { id: s.id, branch: 'B' };
        });

        // 3.5 Use native wait counts
        const shiftedWaiting = new Map<string, number>();
        currentFlow.steps.forEach(s => {
            shiftedWaiting.set(s.id, realtimeDistribution[s.id]?.count || 0);
        });

        // Shift wait counts from wait steps to their immediate next steps
        currentFlow.steps.forEach(s => {
            if (s.type === 'wait' && s.nextStepId) {
                const waitCount = shiftedWaiting.get(s.id) || 0;
                if (waitCount > 0) {
                    const currentNextCount = shiftedWaiting.get(s.nextStepId) || 0;
                    shiftedWaiting.set(s.nextStepId, currentNextCount + waitCount);
                    shiftedWaiting.set(s.id, 0); // Hide from wait step itself
                }
            }
        });

        // 4. Build Funnel Data (Recursive Traversal)
        const finalFunnel: any[] = [];

        const traverse = (stepId: string) => {
            const step = currentFlow.steps.find(s => s.id === stepId);
            if (!step) return;

            // Add current step
            const idx = stepIndexMap[step.id] ?? -1;

            if (['trigger', 'action', 'zalo_zns', 'update_tag', 'condition', 'wait', 'list_action', 'remove_action', 'split_test', 'advanced_condition'].includes(step.type)) {
                const sStats = (step as any).stats || { sent: 0, opened: 0, processed: 0, matched: 0, timed_out: 0, path_a: 0, path_b: 0, waiting: 0, zns_sent: 0, zns_failed: 0 };
                const waitingData = realtimeDistribution[step.id];
                const waitingHere = shiftedWaiting.get(step.id) ?? 0; // USE SHIFTED COUNT
                const avgWaitSeconds = waitingData?.avg_wait || 0;

                // SHOW: Waiting + Processed (Approx total who touched this step)
                // Fix for Condition: 'processed' might not be populated or distributed correctly - use matched+timed_out
                let processedHere = (sStats.processed || 0);
                if (step.type === 'condition') {
                    // For Condition, "processed" is effectively the sum of those who went 'Yes' (matched) and 'No' (timed_out)
                    const totalMatched = (sStats.matched || 0);
                    const totalTimedOut = (sStats.timed_out || 0);
                    // Use the greater of 'processed' or sum of paths to be safe, or just sum of paths
                    processedHere = Math.max(processedHere, totalMatched + totalTimedOut);
                }
                const displayUserCount = waitingHere + processedHere;

                let displayRate = 0;
                let detailStat = null;

                // Calc stats...
                if (step.type === 'action') {
                    const stepSent = sStats.sent || 0;
                    const stepOpened = sStats.unique_opened || sStats.opened || 0;
                    displayRate = stepSent > 0 ? Math.round((stepOpened / stepSent) * 100) : 0;
                } else if (step.type === 'zalo_zns') {
                    // [FIX P11-H3] Use zns_sent / zns_clicked from stepStats — both now mapped
                    // correctly by flows.php (P10-H1 fixed click routing, P11-H3 separated per-step).
                    // Previously sStats.zns_clicked was always undefined (ZNS clicks merged into generic 'clicked').
                    const znsSent = sStats.zns_sent || sStats.sent || 0;
                    const znsClicked = sStats.zns_clicked || 0;
                    displayRate = znsSent > 0 ? Math.round((znsClicked / znsSent) * 100) : 0;
                    detailStat = `Sent: ${znsSent}${znsClicked > 0 ? ` / Clicks: ${znsClicked}` : ''}`;
                } else if (step.type === 'condition') {
                    const totalCond = (sStats.matched || 0) + (sStats.timed_out || 0);

                    if (totalCond > 0) {
                        displayRate = Math.round(((sStats.matched || 0) / totalCond) * 100);
                        detailStat = `${sStats.matched} IF / ${sStats.timed_out} ELSE`;
                    }
                } else if (step.type === 'advanced_condition') {
                    const branchStats = sStats.branchStats || {};
                    const totalProcessed = sStats.processed || Object.values(branchStats).reduce((a: any, b: any) => a + b, 0); // Approx
                    // For Advance Condition, rate isn't as simple as Yes/No. 
                    // Let's show the breakdown in detailStat
                    const parts = Object.entries(branchStats).map(([k, v]) => `${k}: ${v}`);
                    detailStat = parts.length > 0 ? parts.join(' | ') : 'No data';
                    // Fallback visual rate? Maybe just show total processed
                    displayRate = 100; // Just to fill bar or hide it
                } else if (step.type === 'split_test') {
                    const totalSplit = (sStats.path_a || 0) + (sStats.path_b || 0);
                    if (totalSplit > 0) {
                        displayRate = Math.round(((sStats.path_a || 0) / totalSplit) * 100);
                        detailStat = `A(${sStats.path_a}) / B(${sStats.path_b})`;
                    }
                }

                const labelInfo = flowLabels[step.id];
                const stepDisplayLabel = labelInfo ? labelInfo.stepNumberLabel : 'Step';
                const style = getNodeStyle(step);

                // Determine if this step is "Truly Stuck"
                let isTrulyStuck = false;
                if (avgWaitSeconds > 3600 * 24) {
                    if (step.type === 'wait') {
                        // For relative delays, only flag if > duration + 24h
                        if (step.config?.type === 'delay') {
                            const durationData = parseInt(step.config?.duration || '0');
                            const unitData = step.config?.unit;
                            const limit = durationData * (unitData === 'days' ? 86400 : (unitData === 'hours' ? 3600 : 60));
                            isTrulyStuck = limit > 0 && avgWaitSeconds > limit + 3600 * 24;
                        } else { isTrulyStuck = false; }
                    } else if (step.type === 'condition') {
                        const durationData = parseInt(step.config?.waitDuration || '0');
                        const unitData = step.config?.waitUnit;
                        const limit = durationData * (unitData === 'days' ? 86400 : (unitData === 'hours' ? 3600 : 60));
                        isTrulyStuck = avgWaitSeconds > limit + 3600 * 24;
                    } else {
                        isTrulyStuck = true;
                    }
                }

                finalFunnel.push({
                    id: step.id,
                    type: step.type,
                    stepLabel: style.label,
                    stepNumberLabel: stepDisplayLabel,
                    label: step.label,
                    users: displayUserCount,
                    waiting: waitingHere,
                    processedHere: processedHere,
                    rate: displayRate,
                    detailStat: detailStat,
                    config: step.config,
                    style: style,
                    hasBranches: (step.type === 'condition' || step.type === 'split_test' || step.type === 'advanced_condition'),
                    activeBranch: activeBranches[step.id], // Current active branch
                    avgWaitSeconds: avgWaitSeconds,
                    isTrulyStuck: isTrulyStuck
                });
            }

            // Recurse based on type and active branch
            let nextStepId: string | undefined = undefined;

            if (step.type === 'condition') {
                const currentBranch = activeBranches[step.id] || 'yes';
                nextStepId = currentBranch === 'yes' ? step.yesStepId : step.noStepId;
            } else if (step.type === 'split_test') {
                const currentBranch = activeBranches[step.id] || 'A';
                nextStepId = currentBranch === 'A' ? step.pathAStepId : step.pathBStepId;
            } else if (step.type === 'advanced_condition') {
                // Find branch ID that matches activeBranches selection
                const branches = step.config.branches || [];
                const currentBranchId = activeBranches[step.id];

                if (currentBranchId) {
                    if (currentBranchId === 'fallback') {
                        nextStepId = step.config.defaultStepId;
                    } else {
                        const branch = branches.find((b: any) => b.id === currentBranchId);
                        if (branch) nextStepId = branch.stepId;
                        else if (step.config.defaultStepId) nextStepId = step.config.defaultStepId; // Fallback safety
                    }
                } else {
                    // Default to first branch if nothing selected
                    if (branches.length > 0) {
                        nextStepId = branches[0].stepId;
                    } else {
                        nextStepId = step.config.defaultStepId;
                    }
                }
            } else {
                nextStepId = step.nextStepId;
            }

            // Check for termination
            if (nextStepId) {
                traverse(nextStepId);
            } else {
                // BRANCH TERMINATION -> Add "Completed" node for this branch
                // [FIX] Use min(total_completed, last_step_processed) for most accurate display.
                // Reasoning:
                //   - stats.completed = 444 (authoritative, but can exceed step.stats due to buffer lag)
                //   - byBranch[step.id] = 439 (undercounts due to step_id mismatch on exit paths)
                //   - step.stats.processed = 440 (definitive: exactly how many passed through last step)
                // → min(444, 440) = 440: matches Qua count, never shows more completed than passed through.
                const lastStepStats = (step as any).stats || {};
                const lastStepProcessed = lastStepStats.processed || lastStepStats.sent || 0;
                const totalCompleted = stats.completed || 0;
                const byBranchCount = completedBranchStats[step.id] || 0;
                // Priority: Use byBranchCount if available. Otherwise use lastStepProcessed. Cap at totalCompleted.
                // This prevents empty branches (0 Qua) from incorrectly displaying the entire flow's total completions.
                const completedCount = Math.min(byBranchCount > 0 ? byBranchCount : lastStepProcessed, totalCompleted);
                finalFunnel.push({
                    id: `end_${step.id}`,
                    type: 'completed',
                    stepLabel: 'Kết thúc',
                    stepNumberLabel: 'END',
                    label: "Hoàn thành Flow",
                    users: completedCount,
                    waiting: 0,
                    rate: 100,
                    detailStat: `Hoàn tất: ${completedCount}`,
                    config: {},
                    style: { icon: CheckCircle2, gradient: 'from-emerald-500 to-teal-600', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10', label: 'Completed' }
                });
            }

        };

        const triggerStart = currentFlow.steps.find(s => s.type === 'trigger');
        if (triggerStart) {
            traverse(triggerStart.id);
        }

        // =========================================================================================
        // POST-PROCESSING: BACK-PROPAGATE TRAFFIC (INFER COUNTS FROM LEAVES UP TO ROOT)
        // This fixes "0 Processed" issues for system steps where logs were previously missing.
        // Concept: Traffic(S) = Waiting(S) + Sum(Traffic(Children))
        // =========================================================================================

        const funnelMap = new Map();
        finalFunnel.forEach(item => funnelMap.set(item.id, item));
        const computedTraffic = new Map<string, number>();

        // Iterate sorted steps in REVERSE (Bottom-Up)
        for (let i = sortedSteps.length - 1; i >= 0; i--) {
            const step = sortedSteps[i];
            const funnelItem = funnelMap.get(step.id);

            // 1. Initial Traffic = Waiting count at this step
            let myTraffic = funnelItem ? funnelItem.waiting : 0;

            // 2. Add Traffic from Children (Who must have passed through here)
            const childrenIds: string[] = [];
            if (step.nextStepId) childrenIds.push(step.nextStepId);
            if (step.yesStepId) childrenIds.push(step.yesStepId);
            if (step.noStepId) childrenIds.push(step.noStepId);
            if (step.pathAStepId) childrenIds.push(step.pathAStepId);
            if (step.pathBStepId) childrenIds.push(step.pathBStepId);
            if (step.config?.branches) {
                step.config.branches.forEach((b: any) => { if (b.stepId) childrenIds.push(b.stepId); });
            }
            if (step.config?.defaultStepId) childrenIds.push(step.config.defaultStepId);

            let childrenTraffic = 0;
            childrenIds.forEach(childId => {
                // Add computed traffic from child
                // [FIX] Use a global map for traffic to ensure we count all branches
                childrenTraffic += computedTraffic.get(childId) || 0;
            });

            // 3. Add Traffic from completions recorded exactly at this step (very important for all branches)
            // This ensures that people who end at this step (on ANY branch) are counted in the parent's total traffic.
            const completionsHere = completedBranchStats[step.id] || 0;
            myTraffic += completionsHere;

            myTraffic += childrenTraffic;
            computedTraffic.set(step.id, myTraffic);

            // 4. Update Funnel Item with inferred counts
            if (funnelItem) {
                // People who entered this step = Total traffic computed above
                const totalEntered = myTraffic;

                funnelItem.processedHere = Math.max(funnelItem.processedHere, totalEntered - funnelItem.waiting);
                funnelItem.users = funnelItem.waiting + funnelItem.processedHere;

                // Calculation for Drop-off
                // Traffic Moved Forward (to ANY branch) + Traffic Completed (Target reached)
                const totalSuccess = childrenTraffic + completionsHere;
                const totalEffectiveIn = funnelItem.processedHere;

                // Only show drop-off if there's significant data and it's not a terminal step
                if (totalEffectiveIn > 5 && childrenIds.length > 0) {
                    const dropRate = 1 - (totalSuccess / totalEffectiveIn);
                    // Only flag if drop rate is significant (> 1%)
                    if (dropRate > 0.01) {
                        funnelItem.dropOffRate = dropRate;
                    } else {
                        delete funnelItem.dropOffRate;
                    }
                }
            }

        }

        return finalFunnel;
    }, [currentFlow.steps, stats, activeBranches, flowLabels, completedBranchStats, realtimeDistribution]);

    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

    const selectedStepType = useMemo(() => {
        if (!selectedStepId) return null;
        return currentFlow.steps.find(s => s.id === selectedStepId)?.type;
    }, [selectedStepId, currentFlow.steps]);

    const handleToggleOpens = (val: boolean) => {
        setShowOpens(val);
        // fetchParticipants will be triggered by useEffect
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        refreshFlow();
        fetchLogs(1, true, debouncedLogSearch, logTypeFilter);
        // Removed fetchParticipants(1) from here, it's handled by the unified effect below
    }, [flow.id]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedLogSearch(logSearchTerm);
        }, 400);
        return () => clearTimeout(timer);
    }, [logSearchTerm]);

    useEffect(() => {
        if (flow.id) {
            fetchLogs(1, true, debouncedLogSearch, logTypeFilter);
        }
    }, [debouncedLogSearch, logTypeFilter]);

    // Unified effect for participants - Handles initial load and all filter changes
    useEffect(() => {
        // For Report and Clicks tabs, we still fetch to get the total count for the modal header
        // while the tabs handle their own detailed data fetching.

        // Map modalTab to API params
        let typeParam: string | null = null;
        let statusParam: string | null = selectedStatus;

        if (!selectedStatus && selectedStepId) {
            if (modalTab === 'opened') typeParam = 'opens';
            else if (modalTab === 'failed') statusParam = 'failed';
            else if (modalTab === 'unsubscribed') statusParam = 'unsubscribed';
            else if (modalTab === 'waiting') statusParam = null;
            else if (modalTab === 'report') statusParam = 'all_touched';
            else if (modalTab === 'all_touched') statusParam = 'all_touched';
            else if (modalTab === 'clicks') typeParam = 'clicks';
            // ZNS Logic
            else if (modalTab === 'zns_sent') typeParam = 'zns_sent'; // API must support type=zns_sent
            else if (modalTab === 'zns_clicked') typeParam = 'click_zns';
            else if (modalTab === 'zns_replied') typeParam = 'reply_zns';
            else if (modalTab === 'zns_failed') typeParam = 'zns_failed';
        }

        fetchParticipants(1, selectedStepId, statusParam, debouncedSearchTerm, typeParam, selectedBranchFilter);
    }, [flow.id, selectedStepId, selectedStatus, debouncedSearchTerm, modalTab, selectedBranchFilter]);

    // Sync local flow changes (steps/config) from parent to ensure report shows unsaved steps
    useEffect(() => {
        setCurrentFlow(prev => ({
            ...prev,
            steps: flow.steps,
            config: flow.config,
            name: flow.name
        }));
    }, [flow]);

    const refreshFlow = async () => {
        // [FIX] Fetch flow data + completed stats + distribution ALL in parallel.
        // Previously: flow data was set first, then fetchLogs fetched stats separately.
        // This caused a window where step.stats.processed (from flow) was newer than
        // completedBranchStats (from fetchLogs), showing e.g. "440 Qua / 439 Hoàn thành".
        // Fix: single Promise.all ensures all state updates use data from the same moment.
        const [flowRes, statsRes, distRes] = await Promise.all([
            api.get<Flow>(`flows/${flow.id}`),
            api.get<any>(`flows?id=${flow.id}&route=completed-users`),
            api.get<any>(`flows?id=${flow.id}&route=distribution`)
        ]);

        if (flowRes.success) setCurrentFlow(flowRes.data);
        if (statsRes.success && statsRes.data) setCompletedBranchStats(statsRes.data.byBranch || {});
        if (distRes.success && distRes.data) setRealtimeDistribution(distRes.data);

        // Fetch logs only (skip stats re-fetch since we just set them above)
        fetchLogs(1, false, debouncedLogSearch);
    };

    const fetchParticipants = async (page = 1, stepId?: string | null, status?: string | null, search?: string, type?: string | null, branchFilter?: string | null) => {
        setLoadingList(true);
        let url = '';

        // [SHIFTING FIX] If we are looking for 'waiting' users for a specific step,
        // we must also include users who are at any 'wait' step that leads to this step.
        let effectiveStepId = stepId;
        if (stepId && (!status || status === 'waiting')) {
            const sources = [stepId];
            const findWaitSources = (targetId: string) => {
                currentFlow.steps.forEach(s => {
                    if (s.type === 'wait' && s.nextStepId === targetId && !sources.includes(s.id)) {
                        sources.push(s.id);
                        findWaitSources(s.id);
                    }
                });
            };
            findWaitSources(stepId);
            effectiveStepId = sources.join(',');
        }

        if (status === 'failed') {
            url = `flows?id=${flow.id}&route=step-errors&page=${page}&limit=10`;
            if (effectiveStepId) url += `&step_id=${effectiveStepId}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
        } else if (status === 'unsubscribed') {
            url = `flows?id=${flow.id}&route=step-unsubscribes&page=${page}&limit=10`;
            if (effectiveStepId) url += `&step_id=${effectiveStepId}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
        } else {
            url = `flows?id=${flow.id}&route=participants&page=${page}&limit=10`;
            if (effectiveStepId) url += `&step_id=${effectiveStepId}`;
            if (status) url += `&status=${status}`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (type) url += `&type=${type}`;
            if (branchFilter) url += `&branch=${encodeURIComponent(branchFilter)}`;
        }

        const res = await api.get<any>(url);
        if (res.success) {
            if (res.data.data && Array.isArray(res.data.data)) {

                // Mormalize data structure difference between endpoints if any
                // route=participants returns { data: [], pagination: {} }
                // route=step-errors usually returns array directly or similar structure?
                // Based on previous code: `setErrorModal({ ..., users: res.data })` implies it returned an array directly.
                // Let's handle both.

                setModalParticipants(res.data.data);
                setPagination(res.data.pagination);
            } else if (Array.isArray(res.data)) {
                // If endpoint returns direct array (like likely step-errors does based on old code)
                setModalParticipants(res.data);
                setPagination({ page: 1, limit: 10, total: res.data.length, totalPages: 1 });
            } else {
                setModalParticipants([]);
                setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
            }
        } else {
            setModalParticipants([]);
            setPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
        }
        setLoadingList(false);
    };

    // Auto-search effect moved to unified participant effect above

    const handleClearFilter = () => {
        setSelectedStepId(null);
        setSelectedStatus(null);
        setSearchTerm('');
        setDebouncedSearchTerm(''); // Clear immediately
        setShowOpens(false);
    };

    const handleStepClick = (stepId: string, type: string, initialTab?: string) => {
        setSelectedStepId(stepId);
        setSelectedStatus(null);
        setSearchTerm(''); // Clear search on step change
        setDebouncedSearchTerm(''); // Clear immediately to avoid lag/double-fetch
        setIsParticipantsModalOpen(true); // Open Modal

        // Smart Default Tab
        if (initialTab) {
            setModalTab(initialTab as any);
        } else if (type === 'zalo_zns') {
            setModalTab('zns_sent');
        } else {
            setModalTab('all_touched');
        }

        const isEmailStep = type === 'action';
        setShowOpens(isEmailStep); // Keep for legacy, but UI uses Modal now

        if (type === 'completed') {
            // Extract real step ID from "end_{stepId}"
            const realStepId = stepId.startsWith('end_') ? stepId.replace('end_', '') : stepId;
            setSelectedStepId(realStepId);
            setSelectedStatus('completed');
            setShowOpens(false);
            setIsParticipantsModalOpen(true);
        }
    };

    const fetchLogs = async (page = 1, reset = false, search = '', type = '') => {
        if (reset) {
            setLoadingLogs(true);
            setLogPage(1);
        } else {
            setIsLoadingMoreLogs(true);
        }

        const limit = 50;
        let url = `flows?id=${flow.id}&route=history&page=${page}&limit=${limit}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (type) url += `&type=${encodeURIComponent(type)}`;

        // Parallel Fetch for Stats and History
        // Only fetch stats on first load or manual refresh
        const statsPromises = reset ? [
            api.get<any>(`flows?id=${flow.id}&route=completed-users`),
            api.get<any>(`flows?id=${flow.id}&route=distribution`)
        ] : [];

        try {
            const [historyRes, ...statsResults] = await Promise.all([
                api.get<any[]>(url),
                ...statsPromises
            ]);

            if (reset && statsResults.length === 2) {
                const [statsRes, distRes] = statsResults;
                if (statsRes.success && statsRes.data) {
                    setCompletedBranchStats(statsRes.data.byBranch || {});
                }
                if (distRes.success && distRes.data) {
                    setRealtimeDistribution(distRes.data);
                }
            }

            if (historyRes.success) {
                // Handle both response formats: direct array or { data: [], pagination: {} }
                const logsData = Array.isArray(historyRes.data)
                    ? historyRes.data
                    : ((historyRes.data as any)?.data && Array.isArray((historyRes.data as any).data) ? (historyRes.data as any).data : []);

                const paginationData = (historyRes.data as any)?.pagination || { page, limit, total: logsData.length, totalPages: Math.ceil(logsData.length / limit) };

                setLogs(logsData);
                setLogPagination(paginationData);
                setLogPage(page);
            } else if (reset) {
                setLogs([]);
                setLogPagination({ page: 1, limit: 10, total: 0, totalPages: 1 });
            }
        } catch (error) {
            console.error('Failed to fetch logs:', error);
        } finally {
            setLoadingLogs(false);
            setIsLoadingMoreLogs(false);
        }
    };

    const handleRefreshLogs = () => {
        fetchLogs(1, true, debouncedLogSearch, logTypeFilter);
        refreshFlow();
    };

    const getStepName = (stepId: string) => {
        if (flowLabels[stepId]) return flowLabels[stepId].fullLabel;
        const s = currentFlow.steps.find(x => x.id === stepId);
        return s ? s.label : 'Unknown Step';
    };

    const formatTime = (iso: string) => {
        if (!iso) return '--';
        return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    };

    const calculateTimeRemaining = (dateStr: string) => {
        if (!dateStr) return '';
        const target = new Date(dateStr).getTime();
        const now = new Date().getTime();
        const diff = target - now;

        if (diff <= 0) return 'Sắp chạy ngay';

        const totalMinutes = Math.floor(diff / (1000 * 60));
        const days = Math.floor(totalMinutes / (60 * 24));
        const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
        const minutes = totalMinutes % 60;

        if (days > 0) {
            return `Còn ${days} ngày ${hours}h ${minutes}p`;
        }
        if (hours > 0) return `Còn ${hours}h ${minutes}p`;
        return `Còn ${minutes} phút`;
    };

    // Grouping Logic: Group consecutive logs from the same user
    const groupedLogs = useMemo(() => {
        const groups: any[] = [];
        let currentGroup: any = null;

        logs.forEach((log, index) => {
            if (!currentGroup) {
                currentGroup = {
                    id: `group-${index}`,
                    email: log.email,
                    main: log,
                    subs: [],
                    isExpanded: expandedGroups.has(`group-${index}`)
                };
            } else if (currentGroup.email === log.email) {
                currentGroup.subs.push(log);
            } else {
                groups.push(currentGroup);
                currentGroup = {
                    id: `group-${index}`,
                    email: log.email,
                    main: log,
                    subs: [],
                    isExpanded: expandedGroups.has(`group-${index}`)
                };
            }
        });

        if (currentGroup) groups.push(currentGroup);
        return groups;
    }, [logs, expandedGroups]);

    const toggleGroup = (groupId: string) => {
        setExpandedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupId)) next.delete(groupId);
            else next.add(groupId);
            return next;
        });
    };

    // Fetch step errors
    const fetchStepErrors = async (stepId: string, stepLabel: string) => {
        const res = await api.get<any>(`flows?id=${flow.id}&route=step-errors&step_id=${stepId}`);
        if (res.success && res.data) {
            // API returns { data: [], pagination: {} } — extract inner data array
            const usersArray = Array.isArray(res.data)
                ? res.data
                : (Array.isArray(res.data.data) ? res.data.data : []);
            setErrorModal({ isOpen: true, stepId, stepLabel, users: usersArray });
        } else {
            setErrorModal({ isOpen: true, stepId, stepLabel, users: [] });
        }
    };


    // Fetch step unsubscribes
    const fetchStepUnsubscribes = async (stepId: string, stepLabel: string) => {
        const res = await api.get<any>(`flows?id=${flow.id}&route=step-unsubscribes&step_id=${stepId}`);
        if (res.success && res.data) {
            const usersArray = Array.isArray(res.data)
                ? res.data
                : (Array.isArray(res.data.data) ? res.data.data : []);
            setUnsubscribeModal({ isOpen: true, stepId, stepLabel, users: usersArray });
        } else {

            setUnsubscribeModal({ isOpen: true, stepId, stepLabel, users: [] });
        }
    };

    // Show toast helper
    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        if (type === 'success') toast.success(message);
        else if (type === 'error') toast.error(message);
        else toast(message);
    };

    // Quick Actions
    const handleExportReport = async () => {
        showToast('Đang xuất Báo cáo...', 'info');
        const res = await api.post(`flows?id=${flow.id}&route=export-analytics`, {});
        if (res.success) {
            showToast('Xuất Báo cáo thành công!');
        } else {
            showToast('Lỗi khi xuất Báo cáo', 'error');
        }
    };

    const handleExportLogs = async () => {
        showToast('Đang tạo file xuất...', 'info');
        try {
            const isLocal =
                window.location.hostname === 'localhost' ||
                window.location.hostname === '127.0.0.1' ||
                window.location.port !== '';
            const phpFile = 'flows';
            const finalQueryParams = `?id=${flow.id}&route=export-history&search=${encodeURIComponent(logSearchTerm)}&type=${encodeURIComponent(logTypeFilter)}`;
            
            const headers: Record<string, string> = {
                'Accept': 'text/csv'
            };
            
            const savedUser = JSON.parse(
                localStorage.getItem('user') || localStorage.getItem('currentUser') || 'null'
            );
            const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
            const isAdminById = savedUser && (savedUser.id === 1 || savedUser.id === '1');
            const isAdminByRole = savedUser && (
                savedUser.role === 'admin' ||
                savedUser.role === 'super_admin' ||
                savedUser.is_admin == 1 ||
                savedUser.isAdmin === true
            );
            if (isAuthenticated || isAdminById || isAdminByRole) {
                headers['X-Autoflow-Auth'] = '1';
            }
            if (isLocal && savedUser && savedUser.id) {
                headers['X-Local-Dev-User'] = String(savedUser.id);
            }

            const url = `${api.baseUrl}/${phpFile}.php${finalQueryParams}`;
            const response = await fetch(url, {
                method: 'GET',
                headers,
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}`);
            }

            const blob = await response.blob();
            const downloadUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = `flow-history-${currentFlow.name || 'export'}-${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(downloadUrl);
            showToast('Xuất lịch sử thành công!');
        } catch (err) {
            console.error('Failed to export history:', err);
            showToast('Lỗi khi xuất lịch sử', 'error');
        }
    };

    const fetchInactiveUsers = async (page = 1) => {
        setLoadingInactive(true);
        setIsInactiveModalOpen(true);
        try {
            const res = await api.get(`flows?id=${flow.id}&route=inactive-users&page=${page}&limit=10`);
            if (res.success) {
                setInactiveUsers((res.data as any).users || []);
                if ((res.data as any).pagination) {
                    setInactivePagination((res.data as any).pagination);
                }
            } else {
                showToast('Không thể tải danh sách', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Lỗi kết nối', 'error');
        } finally {
            setLoadingInactive(false);
        }
    };

    const handleCleanFailedUsers = () => {
        setConfirmModal({
            isOpen: true,
            title: 'Xác nhận dọn dẹp',
            message: 'Bạn có chắc muốn xóa tất cả người dùng bị lỗi khỏi flow này?',
            onConfirm: async () => {
                setConfirmModal({ ...confirmModal, isOpen: false });
                showToast('Đang dọn dẹp...', 'info');
                const res = await api.post(`flows?id=${flow.id}&route=clean-failed`, {});
                if (res.success) {
                    showToast('Đã dọn dẹp người dùng bị lỗi!');
                    refreshFlow();
                } else {
                    showToast('Lỗi khi dọn dẹp', 'error');
                }
            }
        });
    };

    const StatItem = ({ label, value, icon: Icon, color, subText, trendText, trendType, onClick }: any) => {
        const hexColor = (() => {
            if (color === 'bg-blue-600') return '#3b82f6';
            if (color === 'bg-indigo-600') return '#8b5cf6';
            if (color === 'bg-[#2563eb]') return '#f59e0b';
            if (color === 'bg-rose-500') return '#ec4899';
            return '#64748b';
        })();

        const decorSvg = (() => {
            if (hexColor === '#3b82f6') {
                return (
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" stroke-dasharray="4 4" />
                        <circle cx="35" cy="45" r="15" fill="currentColor" fillOpacity="0.2" />
                        <circle cx="65" cy="45" r="15" fill="currentColor" fillOpacity="0.4" />
                        <circle cx="50" cy="70" r="18" fill="currentColor" fillOpacity="0.6" />
                    </svg>
                );
            }
            if (hexColor === '#8b5cf6') {
                return (
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <path d="M10 50 Q 50 10 90 50 T 90 90" stroke="currentColor" strokeWidth="2" stroke-dasharray="3 3" />
                        <circle cx="10" cy="50" r="6" fill="currentColor" />
                        <circle cx="50" cy="10" r="6" fill="currentColor" />
                        <circle cx="90" cy="50" r="6" fill="currentColor" />
                        <path d="M50 10 L 90 50" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                );
            }
            if (hexColor === '#f59e0b') {
                return (
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                        <rect x="20" y="20" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.6" />
                        <rect x="20" y="42" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.4" />
                        <rect x="20" y="64" width="60" height="15" rx="7.5" fill="currentColor" fillOpacity="0.2" />
                    </svg>
                );
            }
            return (
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
                    <path d="M50 35 V 65 M35 50 H 65" stroke="currentColor" strokeWidth="3" stroke-linecap="round" />
                </svg>
            );
        })();

        const isTrendSuccess = trendType === 'success';

        return (
            <div
                onClick={onClick}
                className={`hover-lift bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex flex-col justify-between hover:border-[var(--color-primary-light)] transition-all duration-300 relative overflow-hidden min-h-[145px] group ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
            >
                {decorSvg && (
                    <div className="decor-svg" style={{ color: hexColor }}>
                        {decorSvg}
                    </div>
                )}
                <div className="relative z-10 flex flex-col justify-between h-full w-full">
                    <div>
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[10px] md:text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest leading-none">{label}</p>
                            <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{ backgroundColor: `${hexColor}15`, color: hexColor }}>
                                <Icon className="w-4 h-4" />
                            </div>
                        </div>
                        <p className="text-xl md:text-2xl font-black text-slate-850 dark:text-slate-100 tracking-tight mt-3 mb-1.5 leading-none">{value}</p>
                    </div>
                    <div className="mt-2 space-y-1">
                        {subText && (
                            <div className="text-[10px] text-slate-450 dark:text-slate-500 font-bold flex items-center flex-wrap gap-x-2 gap-y-0.5">
                                {subText}
                            </div>
                        )}
                        {trendText && (
                            <div className="text-[11px] font-bold mt-1 flex items-center gap-1.5">
                                <span className="flex items-center gap-0.5 px-2 py-0.5 rounded-full" style={{ 
                                    backgroundColor: isTrendSuccess ? 'rgba(16, 185, 129, 0.08)' : 'rgba(244, 63, 94, 0.08)',
                                    color: isTrendSuccess ? '#10b981' : '#f43f5e'
                                }}>
                                    {trendText.includes(':') ? trendText.split(':')[0] : trendText}
                                </span>
                                {trendText.includes(':') && (
                                    <span className="text-slate-400 font-bold dark:text-slate-500">{trendText.split(':')[1]}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    // --- BOTTLENECK INDICATOR COMPONENT ---
    const BottleneckBadge = ({ type, value, tooltip }: { type: 'time' | 'drop', value: string, tooltip?: string }) => (
        <div
            title={tooltip}
            className={`absolute -top-3 -right-3 z-50 px-3 py-1.5 rounded-full shadow-lg border flex items-center gap-2 animate-pulse cursor-help ${type === 'time' ? 'bg-amber-600 border-amber-400 text-white' : 'bg-orange-500 border-orange-400 text-white'
                }`}
        >
            <AlertOctagon className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{value}</span>
        </div>
    );

    return (
        <div ref={containerRef} className="p-3 md:p-6 lg:px-8 lg:pb-8 lg:pt-4 space-y-4 md:space-y-8 max-w-[1400px] mx-auto animate-in fade-in duration-500 relative pb-20">

            {/* Clean SaaS ERP Performance Header Banner */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-5 md:p-6 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* Left: Main Performance */}
                    <div className="lg:col-span-5 lg:border-r border-[var(--color-border-light)] lg:pr-6">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-[14px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-800/40">
                                    <Activity className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base md:text-lg font-bold text-[var(--color-text)]">Hiệu suất vận hành</h3>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${currentFlow.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} title={currentFlow.status === 'active' ? 'Active' : 'Paused'}></span>
                                        <span className="text-[10px] font-mono font-semibold text-[var(--color-text-muted)]">
                                            ID: {currentFlow.id}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsSimulateModalOpen(true)}
                                className="h-8 px-3 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] hover:bg-[var(--color-surface)] text-xs font-semibold text-[var(--color-text)] flex items-center gap-1.5 transition-colors shadow-xs"
                            >
                                <Beaker className="w-3.5 h-3.5 text-blue-500" />
                                <span>FLOW TEST</span>
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] tracking-wider mb-0.5">Tỷ lệ hoàn tất</p>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-2xl font-black text-[var(--color-text)]">{completionRate}%</span>
                                        <span className="text-xs text-[var(--color-text-muted)] font-medium">({stats.completed}/{stats.enrolled})</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] tracking-wider mb-0.5">Tỷ lệ mở TB</p>
                                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{realOpenRate}%</span>
                                </div>
                            </div>

                            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${completionRate}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>

                    {/* Middle: Key Figures & Link */}
                    <div className="lg:col-span-7 flex flex-col gap-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="p-3 rounded-[14px] bg-[var(--color-bg)] border border-[var(--color-border-light)] text-center sm:text-left">
                                <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] tracking-wider mb-1">Đã gửi</p>
                                <div className="flex items-center justify-center sm:justify-start gap-2">
                                    <div className="w-7 h-7 rounded-[8px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                                        <Mail className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-base font-bold text-[var(--color-text)] tabular-nums">{(stats.totalSent || 0).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="p-3 rounded-[14px] bg-[var(--color-bg)] border border-[var(--color-border-light)] text-center sm:text-left">
                                <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] tracking-wider mb-1">Đã mở</p>
                                <div className="flex items-center justify-center sm:justify-start gap-2">
                                    <div className="w-7 h-7 rounded-[8px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center shrink-0">
                                        <MailOpen className="w-3.5 h-3.5" />
                                    </div>
                                    <span className="text-base font-bold text-[var(--color-text)] tabular-nums">{(stats.totalOpened || 0).toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="p-3 rounded-[14px] bg-[var(--color-bg)] border border-[var(--color-border-light)] text-center sm:text-left">
                                <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] tracking-wider mb-1">Gửi lỗi</p>
                                <div className="flex items-center justify-center sm:justify-start gap-2">
                                    <div className="w-7 h-7 rounded-[8px] bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
                                        <AlertOctagon className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={`text-base font-bold tabular-nums ${(stats.totalFailed || 0) > 0 ? 'text-rose-600' : 'text-[var(--color-text)]'}`}>
                                        {(stats.totalFailed || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                            <div className="p-3 rounded-[14px] bg-[var(--color-bg)] border border-[var(--color-border-light)] text-center sm:text-left">
                                <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)] tracking-wider mb-1">Hủy đăng ký</p>
                                <div className="flex items-center justify-center sm:justify-start gap-2">
                                    <div className="w-7 h-7 rounded-[8px] bg-orange-50 dark:bg-orange-950/40 text-orange-600 flex items-center justify-center shrink-0">
                                        <UserMinus className="w-3.5 h-3.5" />
                                    </div>
                                    <span className={`text-base font-bold tabular-nums ${(stats.totalUnsubscribed || 0) > 0 ? 'text-orange-600' : 'text-[var(--color-text)]'}`}>
                                        {(stats.totalUnsubscribed || 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Campaign Link */}
                        {triggerStep?.config?.type === 'campaign' && triggerStep.config.targetId && (
                            <div className="flex items-center gap-3 p-3 bg-[var(--color-bg)] border border-[var(--color-border-light)] rounded-[14px]">
                                <div className="w-9 h-9 bg-rose-50 dark:bg-rose-950/40 text-rose-600 rounded-[10px] flex items-center justify-center shrink-0">
                                    <Send className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-wider">Chiến dịch gốc</p>
                                    <p className="text-xs font-bold text-[var(--color-text)] truncate">Truy cập Báo cáo chi tiết</p>
                                </div>
                                <button
                                    onClick={() => navigate('/marketing/campaigns', { state: { openCampaignId: triggerStep.config.targetId } })}
                                    className="h-8 px-3 bg-[var(--color-surface)] border border-[var(--color-border)] hover:bg-[var(--color-bg)] rounded-[10px] text-xs font-semibold text-[var(--color-text)] transition-all flex items-center gap-1.5 shadow-xs"
                                >
                                    <span>Báo cáo</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                <StatItem
                    label="Khách hàng"
                    value={(stats.enrolled || 0).toLocaleString()}
                    icon={Users}
                    color="bg-blue-600"
                    subText={
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span>Hoàn thành: {(stats.completed || 0).toLocaleString()}</span>
                        </span>
                    }
                    trendText={`▲ Tỷ lệ hoàn tất: ${completionRate}%`}
                    trendType="success"
                />
                <StatItem
                    label="Lượt mở duy nhất"
                    value={(stats.uniqueOpened || 0).toLocaleString()}
                    icon={UserCheck}
                    color="bg-indigo-600"
                    subText={
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></span>
                            <span>Tổng mở: {(stats.totalOpened || 0).toLocaleString()}</span>
                        </span>
                    }
                    trendText={`▲ Tỷ lệ mở TB: ${realOpenRate}%`}
                    trendType="success"
                    onClick={() => {
                        if (triggerStep?.config?.type === 'campaign' && triggerStep.config.targetId) {
                            navigate('/marketing/campaigns', { state: { openCampaignId: triggerStep.config.targetId } });
                        }
                    }}
                />
                <StatItem
                    label="Lượt Click"
                    value={(stats.totalClicked || 0).toLocaleString()}
                    icon={MousePointerClick}
                    color="bg-[#2563eb]"
                    subText={
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"></span>
                            <span>Tổng gửi: {(stats.totalSent || 0).toLocaleString()}</span>
                        </span>
                    }
                    trendText={`▲ Tỷ lệ click TB: ${stats.totalSent > 0 ? Math.round((stats.totalClicked / stats.totalSent) * 100) : 0}%`}
                    trendType="success"
                    onClick={() => {
                        if (triggerStep?.config?.type === 'campaign' && triggerStep.config.targetId) {
                            navigate('/marketing/campaigns', { state: { openCampaignId: triggerStep.config.targetId } });
                        }
                    }}
                />
                <StatItem
                    label="Tỷ lệ lỗi"
                    value={errorRate + '%'}
                    icon={AlertOctagon}
                    color="bg-rose-500"
                    subText={
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
                                <span>Lỗi: {(stats.totalFailed || 0).toLocaleString()}</span>
                            </span>
                            {stats.totalUnsubscribed > 0 && (
                                <span className="flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></span>
                                    <span>Hủy: {(stats.totalUnsubscribed || 0).toLocaleString()}</span>
                                </span>
                            )}
                        </div>
                    }
                    trendText={`${parseFloat(errorRate) > 5 ? '▲' : '▼'} Tỷ lệ lỗi: ${errorRate}%`}
                    trendType={parseFloat(errorRate) > 5 ? 'danger' : 'success'}
                />
            </div>



            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-10">
                <div className="lg:col-span-2 space-y-8">

                    {/* JOURNEY VISUALIZATION */}
                    <Card className="rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-md shadow-slate-100/40 dark:shadow-none overflow-hidden bg-white dark:bg-slate-900" noPadding>
                        <div className="px-5 md:px-8 py-4 md:py-5 border-b border-slate-100 dark:border-slate-800/60 flex flex-col md:flex-row md:justify-between md:items-center bg-slate-50/50 dark:bg-slate-950/20 gap-3">
                            <div>
                                <h3 className="text-xs md:text-sm font-bold text-slate-800 dark:text-slate-200">Hành trình Khách hàng</h3>
                                <p className="text-[9px] md:text-[10px] text-slate-400 mt-0.5 uppercase tracking-widest font-bold">Cumulative Flow Analytics</p>
                            </div>
                            <button
                                onClick={() => fetchInactiveUsers()}
                                className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                            >
                                <UserMinus className="w-3.5 h-3.5 text-slate-400" />
                                KHÔNG TƯƠNG TÁC
                            </button>
                        </div>

                        <div className="p-4 md:p-8">
                            {funnelData.length > 0 ? (
                                <div className="relative pl-6 md:pl-8 border-l border-slate-100 dark:border-slate-800/80 space-y-8">
                                    {funnelData.map((item, idx) => {
                                        const Icon = item.style.icon;
                                        const dotColorClass = (() => {
                                            if (item.users === 0) return 'bg-slate-200 dark:bg-slate-800';
                                            switch (item.type) {
                                                case 'completed': return 'bg-emerald-500 dark:bg-emerald-400';
                                                case 'trigger': return 'bg-orange-500 dark:bg-orange-400';
                                                case 'action': return 'bg-blue-600 dark:bg-blue-500';
                                                case 'zalo_zns': return 'bg-blue-500 dark:bg-blue-400';
                                                case 'wait': return 'bg-amber-500 dark:bg-amber-400';
                                                case 'condition':
                                                case 'advanced_condition': return 'bg-indigo-500 dark:bg-indigo-400';
                                                case 'split_test': return 'bg-blue-500 dark:bg-blue-400';
                                                case 'update_tag': return 'bg-emerald-500 dark:bg-emerald-400';
                                                case 'list_action': return 'bg-orange-500 dark:bg-orange-400';
                                                case 'remove_action': return 'bg-rose-500 dark:bg-rose-400';
                                                default: return 'bg-indigo-500 dark:bg-indigo-400';
                                            }
                                        })();
                                        return (
                                            <div key={idx} className="relative group">
                                                {/* Timeline Connector Dot (Top Aligned to step icon) */}
                                                 <div 
                                                     className={`absolute -left-[21px] md:-left-[33px] top-[26px] md:top-[30px] w-3 h-3 md:w-4 md:h-4 rounded-full border-2 border-white dark:border-slate-950 shadow-sm z-10 flex items-center justify-center ${item.type === 'wait' && item.users > 0 ? '' : dotColorClass}`}
                                                     style={item.type === 'wait' && item.users > 0 ? { background: '#f59e0b' } : undefined}
                                                 >
                                                     <div className="w-1 md:w-1.5 h-1 md:h-1.5 bg-white dark:bg-slate-950 rounded-full"></div>
                                                 </div>

                                                {/* Step Card */}
                                                <div
                                                    onClick={() => item.type !== 'wait' && handleStepClick(item.id, item.type)}
                                                    className={`flex flex-col border rounded-xl transition-all duration-300 group 
                                                        ${item.type === 'wait' ? 'p-2 md:p-3 border-dashed bg-slate-100/50 dark:bg-slate-800/20 opacity-90 cursor-default' : 'bg-white dark:bg-slate-900 p-3 md:p-4 cursor-pointer'} 
                                                        ${(selectedStepId === item.id || (selectedStatus === 'completed' && item.type === 'completed'))
                                                            ? 'border-amber-500 dark:border-amber-400 shadow-md ring-4 ring-amber-500/10 dark:ring-amber-400/5'
                                                            : (item.type === 'wait' ? 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20' : 'border-slate-100 dark:border-slate-800/50 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700/60')
                                                        }`}
                                                >
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-4">

                                                        <div className="flex items-center flex-1 min-w-0 gap-3 md:gap-4">
                                                            <div className={`${item.type === 'wait' ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg flex items-center justify-center shadow-sm bg-gradient-to-br ${item.style.gradient} text-white shrink-0`} style={item.style.inlineGradient ? { background: item.style.inlineGradient } : undefined}>
                                                                <Icon className={`${item.type === 'wait' ? 'w-4 h-4' : 'w-5 h-5'}`} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex flex-wrap items-center gap-1.5 md:gap-2 mb-1">
                                                                    <span className={`text-[8px] md:text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${item.style.bg} ${item.style.text}`}>
                                                                        {item.stepNumberLabel}: {item.style.label}
                                                                    </span>
                                                                    {item.waiting > 0 && (
                                                                        <span className="flex items-center gap-1 text-[8px] md:text-[9px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-1.5 py-0.5 rounded-md animate-pulse">
                                                                            <div className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-amber-600 dark:bg-amber-400"></div>
                                                                            Chờ: {item.waiting}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <h4 className={`${item.type === 'wait' ? 'text-[10px] md:text-xs' : 'text-xs md:text-sm'} font-bold text-slate-800 dark:text-slate-200 truncate`} title={item.label}>{item.label}</h4>
                                                            </div>
                                                        </div>

                                                        {/* BOTTLENECK INDICATORS */}
                                                        {item.isTrulyStuck && (
                                                            <BottleneckBadge
                                                                type="time"
                                                                value="Stuck > 24h"
                                                                tooltip="Cảnh báo: Khách hàng đang bị nghẽn tại bước này quá 24h so với thời gian xử lý dự kiến. Bỏ qua cảnh báo này nếu logic của bạn là đúng."
                                                            />
                                                        )}


                                                        {/* Right: Stats */}
                                                        <div className="flex items-center shrink-0 justify-between sm:justify-end gap-4 md:gap-8 text-right">
                                                            <div className="flex flex-col sm:flex-row gap-2 md:gap-3 items-end sm:items-center">
                                                                {item.type === 'completed' ? (
                                                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 shadow-none">
                                                                        <CheckCircle2 size={13} className="text-emerald-500 dark:text-emerald-400" />
                                                                        <span className="text-[11px] md:text-xs font-bold">{(item as any).users?.toLocaleString() || 0} Hoàn thành</span>
                                                                    </div>
                                                                ) : item.type === 'wait' ? null : (
                                                                    <>
                                                                        <div className="flex items-center gap-1.5" title="Đang ở đây (Waiting)">
                                                                            <div
                                                                                onClick={(e) => { e.stopPropagation(); handleStepClick(item.id, item.type, 'waiting'); }}
                                                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50/60 dark:bg-amber-500/5 border border-amber-200/40 dark:border-amber-500/20 transition-all hover:bg-amber-500 hover:border-amber-500 dark:hover:bg-amber-500 group/pill cursor-pointer text-amber-700 dark:text-amber-400 hover:text-white dark:hover:text-white"
                                                                            >
                                                                                <Clock size={12} className="text-amber-500 dark:text-amber-400 group-hover/pill:text-white" />
                                                                                <span className="text-[11px] md:text-xs font-bold group-hover/pill:text-white">
                                                                                    {(item as any).waiting?.toLocaleString() || 0} <span className="font-normal text-amber-600 dark:text-amber-500 group-hover/pill:text-white/80 hidden xl:inline">Chờ</span>
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="flex items-center gap-1.5" title="Đã đi qua (Processed)">
                                                                            <div
                                                                                onClick={(e) => { e.stopPropagation(); handleStepClick(item.id, item.type, 'all_touched'); }}
                                                                                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-200/40 dark:border-emerald-500/20 transition-all hover:bg-emerald-500 hover:border-emerald-500 dark:hover:bg-emerald-500 group/pill2 cursor-pointer text-emerald-700 dark:text-emerald-400 hover:text-white dark:hover:text-white"
                                                                            >
                                                                                <FastForward size={12} className="text-emerald-500 dark:text-emerald-400 group-hover/pill2:text-white" />
                                                                                <span className="text-[11px] md:text-xs font-bold group-hover/pill2:text-white">
                                                                                    {(item as any).processedHere?.toLocaleString() || 0} <span className="font-normal text-emerald-600 dark:text-emerald-500 group-hover/pill2:text-white/80 hidden xl:inline">Qua</span>
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>

                                                            {/* Contextual Metric based on Type */}
                                                            <div className="w-16 md:w-20">
                                                                {item.type === 'action' && (
                                                                    <>
                                                                        <div className="flex justify-end items-center gap-1 mb-1">
                                                                            <MailOpen className="w-3 h-3 text-slate-400" />
                                                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Unique Open</span>
                                                                        </div>
                                                                        <div className="text-sm font-bold text-[#2563eb]">{item.rate}%</div>
                                                                    </>
                                                                )}
                                                                {item.type === 'condition' && (
                                                                    <>
                                                                        <div className="flex justify-end items-center gap-1 mb-1">
                                                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Wait: {item.config.waitDuration}{item.config.waitUnit === 'days' ? 'd' : (item.config.waitUnit === 'hours' ? 'h' : 'm')}</span>
                                                                        </div>
                                                                        <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{item.detailStat || '--'}</div>
                                                                    </>
                                                                )}
                                                                {item.type === 'split_test' && (
                                                                    <>
                                                                        <div className="flex justify-end items-center gap-1 mb-1">
                                                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Split</span>
                                                                        </div>
                                                                        <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{item.detailStat || '--'}</div>
                                                                    </>
                                                                )}
                                                                {item.type === 'advanced_condition' && (
                                                                    <>
                                                                        <div className="flex justify-end items-center gap-1 mb-1">
                                                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Results</span>
                                                                        </div>
                                                                        <div className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 truncate max-w-[120px]" title={item.detailStat}>
                                                                            {item.detailStat || '--'}
                                                                        </div>
                                                                    </>
                                                                )}
                                                                {item.type === 'wait' && (
                                                                    <div className="flex flex-col items-end opacity-60">
                                                                        <Clock className="w-4 h-4 text-slate-300 mb-1" />
                                                                        <span className="text-[10px] font-bold text-slate-400">Delay</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Error and Unsubscribe Badges */}
                                                    {(item.type === 'action' || item.type === 'zalo_zns') && item.id !== 'virtual_completed' && (
                                                        (() => {
                                                            const failed = (currentFlow.steps.find(s => s.id === item.id) as any)?.stats?.failed || 0;
                                                            const unsubscribed = (currentFlow.steps.find(s => s.id === item.id) as any)?.stats?.unsubscribed || 0;

                                                            if (failed === 0 && unsubscribed === 0) {
                                                                return (
                                                                    <div className="flex items-center gap-1.5 mt-2 ml-14 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 opacity-60">
                                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                                        <span>Hoạt động tốt</span>
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                    <div className="flex items-center gap-2 mt-2 ml-14">
                                                                    {failed > 0 && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                fetchStepErrors(item.id, item.label);
                                                                            }}
                                                                            className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-md border border-rose-200 dark:border-rose-500/20 transition-colors"
                                                                        >
                                                                            <AlertOctagon className="w-3 h-3" />
                                                                            Lỗi ({failed})
                                                                        </button>
                                                                    )}
                                                                    {unsubscribed > 0 && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                fetchStepUnsubscribes(item.id, item.label);
                                                                            }}
                                                                            className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/10 hover:bg-orange-100 dark:hover:bg-orange-500/20 rounded-md border border-orange-200 dark:border-orange-500/20 transition-colors"
                                                                        >
                                                                            <UserMinus className="w-3 h-3" />
                                                                            Hủy ({unsubscribed})
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()
                                                    )}
                                                </div>

                                                {/* Branch Switching UI */}
                                                {item.hasBranches && (
                                                    <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex bg-white dark:bg-slate-950 rounded-lg shadow-md border border-slate-100 dark:border-slate-800/80 p-0.5 transition-all z-20">
                                                        {item.type === 'advanced_condition' ? (
                                                            <div className="flex items-center gap-1 px-2">
                                                                {(item.config.branches || []).map((b: any, i: number) => (
                                                                    <button
                                                                        key={b.id || i}
                                                                        onClick={(e) => { e.stopPropagation(); setActiveBranches(prev => ({ ...prev, [item.id]: b.id })); }}
                                                                        className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-colors whitespace-nowrap ${item.activeBranch === b.id || (!item.activeBranch && i === 0 && item.activeBranch !== 'fallback') ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                                                                    >
                                                                        {b.label || `Branch ${i + 1}`}
                                                                    </button>
                                                                ))}
                                                                {/* Fallback Branch Button */}
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setActiveBranches(prev => ({ ...prev, [item.id]: 'fallback' })); }}
                                                                    className={`px-2 py-0.5 text-[9px] font-bold rounded-md transition-colors whitespace-nowrap ${item.activeBranch === 'fallback' ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                                                                >
                                                                    Mặc định (Fallback)
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setActiveBranches(prev => ({ ...prev, [item.id]: item.type === 'split_test' ? 'A' : 'yes' })); }}
                                                                    className={`px-3 min-w-[45px] py-0.5 text-[9px] font-bold rounded-md transition-all flex items-center justify-center ${item.activeBranch === 'yes' || item.activeBranch === 'A' || (!item.activeBranch) ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                                                                >
                                                                    {item.type === 'split_test' ? 'Path A' : 'IF'}
                                                                </button>
                                                                <button
                                                                    onClick={(e) => { e.stopPropagation(); setActiveBranches(prev => ({ ...prev, [item.id]: item.type === 'split_test' ? 'B' : 'no' })); }}
                                                                    className={`px-3 min-w-[45px] py-0.5 text-[9px] font-bold rounded-md transition-all flex items-center justify-center ${item.activeBranch === 'no' || item.activeBranch === 'B' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400'}`}
                                                                >
                                                                    {item.type === 'split_test' ? 'Path B' : 'ELSE'}
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-20 opacity-40">
                                    <Activity className="w-12 h-12 mx-auto mb-4" />
                                    <p className="text-xs font-bold uppercase tracking-widest">Chưa có dữ liệu vận hành</p>
                                </div>
                            )}
                        </div>
                    </Card >


                </div >

                <div className="lg:col-span-1">
                    <div className="sticky top-4 flex flex-col" style={{ maxHeight: 'calc(100vh - 80px)' }}>
                        <Card className="rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-md shadow-slate-200/10 dark:shadow-none bg-white dark:bg-slate-900 overflow-hidden flex-1 min-h-0 flex flex-col" title="Live Events" noPadding>
                            <div className="px-4 py-3.5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-950/20 sticky top-0 z-10">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1 bg-indigo-50 text-indigo-600 rounded-lg">
                                            <Activity className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">Nhật ký</span>

                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="relative" ref={logFilterRef}>
                                            <button
                                                onClick={() => setIsLogFilterOpen(!isLogFilterOpen)}
                                                className={`
                                                    flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-all duration-300
                                                    ${isLogFilterOpen 
                                                        ? 'bg-white dark:bg-slate-800 border-indigo-400 shadow-lg shadow-indigo-500/10' 
                                                        : 'bg-white/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700/60 hover:border-slate-300'}
                                                `}
                                            >
                                                <currentLogFilter.icon className={`w-3 h-3 ${currentLogFilter.color}`} />
                                                <span className="text-[9px] font-bold text-slate-600 dark:text-slate-300">
                                                    {currentLogFilter.label}
                                                </span>
                                                <ChevronDown className={`w-2.5 h-2.5 text-slate-400 transition-transform duration-300 ${isLogFilterOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            <AnimatePresence>
                                                {isLogFilterOpen && (
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                                        exit={{ opacity: 0, y: 5, scale: 0.95 }}
                                                        className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-2xl p-1 z-[100] overflow-hidden"
                                                    >
                                                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                                            {logTypeOptions.map((opt) => (
                                                                <button
                                                                    key={opt.id}
                                                                    onClick={() => {
                                                                        setLogTypeFilter(opt.id);
                                                                        setIsLogFilterOpen(false);
                                                                    }}
                                                                    className={`
                                                                        w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[9px] font-bold transition-all
                                                                        ${logTypeFilter === opt.id 
                                                                            ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                                                                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}
                                                                    `}
                                                                >
                                                                    <opt.icon className={`w-3 h-3 ${opt.color}`} />
                                                                    {opt.label}
                                                                    {logTypeFilter === opt.id && (
                                                                        <Check className="w-2.5 h-2.5 ml-auto" />
                                                                    )}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                        <div className="relative group/search">
                                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-400 group-focus-within/search:text-indigo-500 transition-colors" />
                                            <input
                                                type="text"
                                                placeholder="Tìm kiếm email..."
                                                value={logSearchTerm}
                                                onChange={(e) => setLogSearchTerm(e.target.value)}
                                                className="pl-7 pr-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-lg text-[9px] w-28 focus:w-44 focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-400 transition-all outline-none"
                                            />
                                        </div>
                                        <button 
                                            onClick={handleExportLogs} 
                                            title="Xuất nhật ký CSV"
                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-all"
                                        >
                                            <FileDown className="w-3 h-3" />
                                        </button>
                                        <button onClick={handleRefreshLogs} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-all">
                                            <RefreshCcw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                                {loadingLogs ? (
                                    <div className="space-y-3 p-4">
                                        {[...Array(5)].map((_, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                <Skeleton variant="rounded" width={24} height={24} className="shrink-0" />
                                                <div className="flex-1 space-y-2">
                                                    <div className="flex justify-between">
                                                        <Skeleton variant="text" width="40%" height={10} />
                                                        <Skeleton variant="text" width="20%" height={10} />
                                                    </div>
                                                    <Skeleton variant="text" width="90%" height={14} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : logs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 opacity-40">
                                        <div className="w-12 h-12 bg-slate-50 dark:bg-slate-950 rounded-full flex items-center justify-center mb-3">
                                            <History className="w-6 h-6 text-slate-300" />
                                        </div>
                                        <p className="text-[10px] font-bold uppercase text-slate-400">Chưa có sự kiện nào</p>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-50">
                                        {groupedLogs.map((group) => {
                                            return (
                                                <div key={group.id} className="relative">
                                                    <LogItem
                                                         log={group.main}
                                                         isGroupItem={false}
                                                         hasSubs={group.subs.length > 0}
                                                         isExpanded={group.isExpanded}
                                                         onToggle={() => toggleGroup(group.id)}
                                                         subCount={group.subs.length}
                                                         onSelectSubscriber={onSelectSubscriber}
                                                     />
                                                    {group.isExpanded && group.subs.length > 0 && (
                                                        <div className="animate-in slide-in-from-top-1 duration-200">
                                                            {group.subs.map((sub: any, subIndex: number) => (
                                                                <LogItem key={subIndex} log={sub} isGroupItem={true} onSelectSubscriber={onSelectSubscriber} />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            {/* Pagination UI — sticky bottom */}
                            {logs.length > 0 && logPagination.totalPages > 1 && (
                                <div className="sticky bottom-0 px-4 py-3 border-t border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/30 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <div className="text-[9px] text-slate-500 dark:text-slate-400 font-bold">
                                            Trang {logPagination.page} / {logPagination.totalPages} • Tổng {logPagination.total} sự kiện
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => fetchLogs(logPagination.page - 1, true, debouncedLogSearch)}
                                                disabled={logPagination.page <= 1 || loadingLogs}
                                                className="px-3 py-1.5 text-[9px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-lg hover:bg-slate-50 dark:bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                                            >
                                                <ChevronDown className="w-3 h-3 rotate-90" />
                                                Trước
                                            </button>
                                            <button
                                                onClick={() => fetchLogs(logPagination.page + 1, true, debouncedLogSearch)}
                                                disabled={logPagination.page >= logPagination.totalPages || loadingLogs}
                                                className="px-3 py-1.5 text-[9px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-lg hover:bg-slate-50 dark:bg-slate-950 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                                            >
                                                Sau
                                                <ChevronDown className="w-3 h-3 -rotate-90" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </Card>
                    </div>{/* end sticky wrapper */}
                </div>
            </div >


            {/* Error Modal */}
            {errorModal.isOpen && (
                <StepErrorModal
                    isOpen={errorModal.isOpen}
                    onClose={() => setErrorModal({ ...errorModal, isOpen: false })}
                    stepLabel={errorModal.stepLabel}
                    stepId={errorModal.stepId}
                    flowId={currentFlow.id}
                    users={errorModal.users}
                    availableSteps={currentFlow.steps}
                    exitConditions={currentFlow.config?.exitConditions || []}
                    onResolved={async () => {
                        await refreshFlow();
                        fetchStepErrors(errorModal.stepId, errorModal.stepLabel);
                    }}
                    onExport={() => showToast('Đã xuất danh sách lỗi')}
                />
            )}

            {/* Unsubscribe Modal */}
            {unsubscribeModal.isOpen && (
                <StepUnsubscribeModal
                    isOpen={unsubscribeModal.isOpen}
                    onClose={() => setUnsubscribeModal({ ...unsubscribeModal, isOpen: false })}
                    stepLabel={unsubscribeModal.stepLabel}
                    stepId={unsubscribeModal.stepId}
                    users={unsubscribeModal.users}
                    onExport={() => showToast('Đã xuất danh sách Hủy đăng ký')}
                />
            )}

            {/* Confirmation Modal */}
            {confirmModal.isOpen && (
                <ConfirmModal
                    isOpen={confirmModal.isOpen}
                    onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                    onConfirm={confirmModal.onConfirm}
                    title={confirmModal.title}
                    message={confirmModal.message}
                    variant="warning"
                />
            )}

            {/* Step Participants Modal */}
            {isParticipantsModalOpen && (
                <StepParticipantsModal
                    isOpen={isParticipantsModalOpen}
                    onClose={() => {
                        setIsParticipantsModalOpen(false);
                        setSelectedBranchFilter(null);
                    }}
                    title={selectedStatus === 'completed' ? 'Danh sách Hoàn thành' : `Danh sách tại: ${selectedStepId ? getStepName(selectedStepId) : '...'}`}
                    participants={modalParticipants}
                    loading={loadingList}
                    pagination={pagination}
                    activeBranchFilter={selectedBranchFilter}
                    onBranchClick={setSelectedBranchFilter}
                    onPageChange={(page) => {
                        let typeParam: string | null = null;
                        let statusParam: string | null = selectedStatus;
                        if (!selectedStatus && selectedStepId) {
                            if (modalTab === 'opened') typeParam = 'opens';
                            else if (modalTab === 'failed') typeParam = 'failed_email';
                            else if (modalTab === 'unsubscribed') typeParam = 'unsubscribe';
                            else if (modalTab === 'waiting') statusParam = 'waiting';
                            else if (modalTab === 'all_touched') statusParam = 'all_touched';
                            else if (modalTab === 'clicks') typeParam = 'clicks';
                            else if (modalTab === 'zns_sent') typeParam = 'zns_sent';
                            else if (modalTab === 'zns_clicked') typeParam = 'click_zns';
                            else if (modalTab === 'zns_replied') typeParam = 'reply_zns';
                            else if (modalTab === 'zns_failed') typeParam = 'zns_failed';
                        }
                        fetchParticipants(page, selectedStepId, statusParam, searchTerm, typeParam, selectedBranchFilter);
                    }}
                    onRefresh={() => {
                        let typeParam: string | null = null;
                        let statusParam: string | null = selectedStatus;
                        if (!selectedStatus && selectedStepId) {
                            if (modalTab === 'opened') typeParam = 'opens';
                            else if (modalTab === 'failed') typeParam = 'failed_email';
                            else if (modalTab === 'unsubscribed') typeParam = 'unsubscribe';
                            else if (modalTab === 'waiting') statusParam = 'waiting';
                            else if (modalTab === 'all_touched') statusParam = 'all_touched';
                            else if (modalTab === 'clicks') typeParam = 'clicks';
                            else if (modalTab === 'zns_sent') typeParam = 'zns_sent';
                            else if (modalTab === 'zns_clicked') typeParam = 'click_zns';
                            else if (modalTab === 'zns_replied') typeParam = 'reply_zns';
                            else if (modalTab === 'zns_failed') typeParam = 'zns_failed';
                        }
                        fetchParticipants(pagination.page, selectedStepId, statusParam, searchTerm, typeParam, selectedBranchFilter);
                        refreshFlow();
                    }}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    getStepName={getStepName}
                    activeTab={modalTab}
                    onTabChange={setModalTab}
                    stepType={selectedStatus === 'completed' ? 'completed' : (selectedStepType || undefined)}
                    stepConfig={currentFlow.steps.find((s: any) => s.id === selectedStepId)?.config}
                    flowId={currentFlow.id}
                    stepId={selectedStepId || undefined}
                    stepData={currentFlow.steps.find((s: any) => s.id === selectedStepId)}
                    onActionComplete={refreshFlow}
                    onSelectSubscriber={onSelectSubscriber}
                />
            )}

            {/* Inactive Users Modal */}
            {isInactiveModalOpen && (
                <StepParticipantsModal
                    isOpen={isInactiveModalOpen}
                    onClose={() => setIsInactiveModalOpen(false)}
                    title="Không tương tác (Inactive)"
                    participants={inactiveUsers}
                    loading={loadingInactive}
                    pagination={inactivePagination}
                    onPageChange={(page) => fetchInactiveUsers(page)}
                    onRefresh={() => fetchInactiveUsers(inactivePagination.page)}
                    searchTerm=""
                    onSearchChange={() => { }}
                    getStepName={getStepName}
                    activeTab="inactive"
                    onTabChange={() => { }}
                    stepType="inactive"
                    flowId={currentFlow.id}
                    onActionComplete={refreshFlow}
                    onSelectSubscriber={onSelectSubscriber}
                />
            )}

            {isSimulateModalOpen && (
                <FlowSimulateModal
                    isOpen={isSimulateModalOpen}
                    onClose={() => setIsSimulateModalOpen(false)}
                    flow={currentFlow}
                />
            )}

        </div >
    );
});

// --- SUB-COMPONENT: LOG ITEM ---
const LogItem: React.FC<{
    log: any;
    isGroupItem?: boolean;
    hasSubs?: boolean;
    isExpanded?: boolean;
    onToggle?: () => void;
    subCount?: number;
    onSelectSubscriber?: (subscriber: any) => void;
}> = ({ log, isGroupItem = false, hasSubs = false, isExpanded = false, onToggle, subCount = 0, onSelectSubscriber }) => {
    const type = log.type || '';
    let icon = <Activity className="w-3.5 h-3.5" />;
    let colorClass = 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800/60';

    if (type.includes('email') || type.includes('sent')) {
        icon = <MailOpen className="w-3.5 h-3.5" />;
        colorClass = 'text-blue-600 bg-blue-50 border-blue-100';
    }
    if (type.includes('open')) {
        icon = <MailOpen className="w-3.5 h-3.5" />;
        colorClass = 'text-blue-600 bg-blue-50 border-blue-100';
    }
    if (type.includes('click')) {
        icon = <MousePointerClick className="w-3.5 h-3.5" />;
        colorClass = 'text-emerald-600 bg-emerald-50 border-emerald-100';
    }
    if (type.includes('fail') || type.includes('error')) {
        icon = <AlertOctagon className="w-3.5 h-3.5" />;
        colorClass = 'text-rose-600 bg-rose-50 border-rose-100';
    }
    if (type === 'enter_flow') {
        icon = <Play className="w-3.5 h-3.5 ml-0.5" />;
        colorClass = 'text-indigo-600 bg-indigo-50 border-indigo-100';
    }
    if (type === 'unsubscribe') {
        icon = <UserMinus className="w-3.5 h-3.5" />;
        colorClass = 'text-orange-600 bg-orange-50 border-orange-100';
    }
    if (type === 'frequency_cap_reached') {
        icon = <Clock className="w-3.5 h-3.5" />;
        colorClass = 'text-amber-600 bg-amber-50 border-amber-100';
    }

    const initials = (() => {
        const fName = log.first_name || '';
        const lName = log.last_name || '';
        const name = `${fName} ${lName}`.trim();
        if (name) {
            const parts = name.split(/\s+/);
            if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
            if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
        }
        return (log.email || 'UN').substring(0, 2).toUpperCase();
    })();

    const avatarBg = (() => {
        const fName = log.first_name || '';
        const lName = log.last_name || '';
        const email = log.email || '';
        const colors = [
            'bg-rose-500', 'bg-pink-500', 'bg-purple-500', 'bg-blue-500',
            'bg-indigo-500', 'bg-blue-500', 'bg-sky-500', 'bg-cyan-500',
            'bg-teal-500', 'bg-emerald-500', 'bg-amber-500', 'bg-orange-500'
        ];
        const str = `${fName} ${lName} ${email}`;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % colors.length;
        return colors[index];
    })();

    const fullName = `${log.first_name || ''} ${log.last_name || ''}`.trim() || 'Chưa đặt tên';

    return (
        <div className={`group px-3 py-3 hover:bg-slate-50 dark:bg-slate-950 transition-all cursor-default border-b border-slate-50/50 ${isGroupItem ? 'bg-slate-50 dark:bg-slate-950/40 ml-4 border-l border-slate-200 dark:border-slate-700/60' : ''}`}>
            <div className="flex items-center gap-2.5">
                {/* Avatar / Icon Container */}
                {!isGroupItem ? (
                    <div className="relative shrink-0 select-none">
                        {log.avatar ? (
                            <img src={log.avatar} alt="" className="w-7 h-7 rounded-full object-cover shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                            <div className={`w-7 h-7 rounded-full ${avatarBg} flex items-center justify-center text-white font-bold text-[10px] uppercase shadow-sm`}>
                                {initials}
                            </div>
                        )}
                        {/* Status Icon badge */}
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-white dark:border-slate-900 bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
                            {React.cloneElement(icon as React.ReactElement<any>, { className: `w-2 h-2 ${colorClass.split(' ')[0]}` })}
                        </div>
                    </div>
                ) : (
                    <div className={`shrink-0 w-5 h-5 rounded-md flex items-center justify-center border shadow-none transition-transform group-hover:scale-105 ${colorClass.replace('bg-', 'bg-opacity-10 ')}`}>
                        {React.cloneElement(icon as React.ReactElement<any>, { className: "w-2.5 h-2.5 opacity-80" })}
                    </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 flex items-center justify-between min-w-0">
                    <div className="flex flex-col min-w-0 gap-0.5">
                        {!isGroupItem ? (
                            <div 
                                className="flex flex-col cursor-pointer group/email"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (onSelectSubscriber) {
                                        onSelectSubscriber({
                                            id: log.subscriber_id || log.id,
                                            email: log.email
                                        });
                                    }
                                }}
                            >
                                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 group-hover/email:text-blue-600 group-hover/email:underline truncate max-w-[160px]">
                                    {fullName}
                                </span>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500 truncate max-w-[160px]">
                                    {log.email}
                                </span>
                            </div>
                        ) : (
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 truncate max-w-[140px]">
                                {log.email}
                            </span>
                        )}
                        <span className={`text-[8px] font-black uppercase tracking-tight ${colorClass.split(' ')[0]} opacity-60 whitespace-nowrap self-start mt-0.5`}>
                            {type.replace(/_/g, ' ')}
                        </span>
                        {log.details && (
                            <span className="text-[9px] text-slate-400 truncate opacity-0 group-hover:opacity-100 transition-opacity max-w-[120px]" title={log.details}>
                                {log.details.replace(/^(?:Zalo\s+)?Click(?:ed)?\s+(?:link(?:\/button)?|button)(?:\s*\([^)]*\))*:\s*/i, 'Click: ')}
                            </span>
                        )}
                    </div>

                    {/* Metadata & Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                        {!isGroupItem && hasSubs && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggle?.(); }}
                                className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-black transition-all ${isExpanded ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 dark:text-slate-400 hover:bg-slate-200'}`}
                            >
                                {subCount}
                                {isExpanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                            </button>
                        )}
                        <span className="text-[9px] text-slate-400 font-mono tabular-nums opacity-60 group-hover:opacity-100 transition-opacity whitespace-nowrap min-w-[70px] text-right">
                            {new Date(log.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FlowAnalyticsTab;

