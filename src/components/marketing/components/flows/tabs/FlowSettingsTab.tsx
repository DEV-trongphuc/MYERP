
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Save, Clock, Settings2, Power, Zap, Shield, Calendar, Target, Users, Globe, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Flow } from '../../../types';
import Card from '../../common/Card';
import Input from '../../common/Input';
import Badge from '../../common/Badge';
import ExitConditions from '../config/ExitConditions';
import BounceHandling from '../config/BounceHandling';
import AdvancedExitTrigger from '../config/AdvancedExitTrigger';
import Button from '../../common/Button';

interface FlowSettingsTabProps {
    flow: Flow;
    onUpdate: (data: Partial<Flow>, isSilent?: boolean, skipApi?: boolean) => void;
}

const FlowSettingsTab: React.FC<FlowSettingsTabProps> = ({ flow, onUpdate }) => {
    const containerRef = useRef<HTMLDivElement>(null);

    const triggerStep = flow.steps.find(s => s.type === 'trigger');

    // Check Form, Purchase, and Custom Event triggers as Priority
    const isPriorityTrigger = ['form', 'purchase', 'custom_event'].includes(triggerStep?.config?.type || '');
    // Determine if the entire flow is archived
    const isFlowArchived = flow.status === 'archived';

    const defaultConfig = useMemo(() => {
        // Default frequency: 'recurring' for Priority triggers, 'one-time' for others
        const defaultFrequency = isPriorityTrigger ? 'recurring' : 'one-time';

        return {
            frequencyCap: 3,
            maxMessagesPerDay: 0,
            activeDays: [0, 1, 2, 3, 4, 5, 6],
            startTime: isPriorityTrigger ? '00:00' : '08:00',
            endTime: isPriorityTrigger ? '23:59' : '22:00',
            exitConditions: ['unsubscribed'],
            type: 'realtime' as const,
            frequency: defaultFrequency as 'one-time' | 'recurring',
            enrollmentCooldownHours: 12,
            allowMultiple: false,
            maxEnrollments: 0,
            bounceBehavior: 'stop' as const,
            advancedExit: {}
        };
    }, [isPriorityTrigger]);

    // --- LOCAL STATE FOR MANUAL SAVE ---
    const [localName, setLocalName] = useState(flow.name);
    const [localDesc, setLocalDesc] = useState(flow.description);
    // Initialize config, ensuring default frequency is applied IF config.frequency is missing
    const [localConfig, setLocalConfig] = useState(() => {
        const merged = { ...defaultConfig, ...(flow.config || {}) };
        // Force the default frequency if the flow config doesn't explicitly have one AND it's a new setup
        if (!flow.config?.frequency) {
            merged.frequency = defaultConfig.frequency;
        }
        return merged;
    });
    const [isModified, setIsModified] = useState(false);

    // Sync state if prop changes externally (e.g. refresh)
    useEffect(() => {
        setLocalName(flow.name);
        setLocalDesc(flow.description);
        setLocalConfig(prev => {
            // We carefully merge to preserve local edits if needed, but here we just resync from props
            // For checking defaults on re-sync:
            const incoming = (flow.config || {}) as Record<string, unknown>;
            // If incoming matches prev (structural equality), keep prev to avoid cursor jumps if possible?
            // But here we prioritize truth from props.
            return {
                ...defaultConfig,
                ...incoming,
                // If existing config has no frequency, use our intelligent default
                frequency: (incoming.frequency as typeof defaultConfig.frequency) || defaultConfig.frequency
            };
        });
        setIsModified(false);
    }, [flow.id, defaultConfig, flow.config]); // Added flow.config dependency

    const handleSave = () => {
        // Prevent saving if flow is archived
        if (isFlowArchived) return;

        onUpdate({
            name: localName,
            description: localDesc,
            config: localConfig
        }, false);
        setIsModified(false);
    };

    // Helper: Update local config AND sync to parent (draft mode - no API)
    // This ensures that if the user hits Global Save (Header), it captures these changes.
    const applyUpdate = (updates: Partial<typeof localConfig>) => {
        if (isFlowArchived) return;

        setLocalConfig(prev => {
            const next = { ...prev, ...updates };
            // Sync to parent immediately (Draft Mode: skipApi=true)
            onUpdate({ config: next }, true, true);
            return next;
        });
        // Note: isModified will be reset to false when the prop updates from parent, 
        // effectively disabling the Local Save button until another change. 
        // This is a tradeoff to support Global Save.
        setIsModified(true);
    };

    const updateConfig = (key: string, value: any) => {
        applyUpdate({ [key]: value });
    };

    const updateConfigs = (updates: Partial<typeof localConfig>) => {
        applyUpdate(updates);
    };

    const handleCapping = (delta: number) => {
        // If flow is archived, prevent changes
        if (isFlowArchived) return;
        const current = localConfig.frequencyCap || 1;
        const next = Math.max(1, Math.min(5, current + delta));
        updateConfig('frequencyCap', next);
    };

    const toggleDay = (dayIdx: number) => {
        // If flow is archived, prevent changes
        if (isFlowArchived) return;
        const currentDays = localConfig.activeDays || [];
        const nextDays = currentDays.includes(dayIdx)
            ? currentDays.filter((d: number) => d !== dayIdx)
            : [...currentDays, dayIdx].sort();
        updateConfig('activeDays', nextDays);
    };

    const timeToPercent = (timeStr: string) => {
        const [h, m] = (timeStr || '00:00').split(':').map(Number);
        return ((h * 60 + m) / 1440) * 100;
    };

    const scheduleBarStyles = useMemo(() => {
        const start = timeToPercent(localConfig.startTime || '00:00');
        const end = timeToPercent(localConfig.endTime || '23:59');
        return {
            left: `${start}%`,
            width: `${Math.max(2, end - start)}%`
        };
    }, [localConfig.startTime, localConfig.endTime]);

    const days = [
        { label: 'T2', id: 0 }, { label: 'T3', id: 1 }, { label: 'T4', id: 2 },
        { label: 'T5', id: 3 }, { label: 'T6', id: 4 }, { label: 'T7', id: 5 }, { label: 'CN', id: 6 },
    ];

    const getPriorityLabel = () => {
        const type = triggerStep?.config?.type;
        if (type === 'purchase') return 'Hành động Mua hàng';
        if (type === 'custom_event') return 'Sự kiện Tùy chỉnh';
        return 'Form Đăng ký';
    };

    return (
        <div ref={containerRef} className="p-5 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300 pb-20">

            {/* PREEMIUM ALERT FOR PRIORITY TRIGGER */}
            {isPriorityTrigger && (
                <div className="mb-8 p-5 bg-gradient-to-br from-yellow-50 to-yellow-50/50 border border-yellow-200 rounded-[28px] flex items-start gap-4 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] -mr-8 -mt-8 group-hover:scale-110 transition-transform duration-700">
                        <Zap className="w-32 h-32 text-yellow-600" />
                    </div>
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl text-yellow-600 shadow-sm border border-yellow-100/50">
                        <Zap className="w-5 h-5 animate-pulse" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-yellow-900 uppercase tracking-[0.1em]">Chế độ ưu tiên (Real-time Transaction)</p>
                        <p className="text-[11px] font-medium text-yellow-800/90 leading-relaxed mt-1.5">
                            Kịch bản này được khởi động bởi <span className="bg-yellow-100/50 px-1.5 py-0.5 rounded-md font-bold text-yellow-900">{getPriorityLabel()}</span>.
                            Hệ thống sẽ <span className="underline decoration-yellow-300 decoration-2 underline-offset-2">bỏ qua</span> các giới hạn về khung giờ và tần suất để đảm bảo phản hồi tức thì cho khách hàng.
                        </p>
                    </div>
                </div>
            )}

            {/* GENERAL CONFIG */}
            <section className="mb-6 space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 shadow-sm"><Settings2 className="w-3.5 h-3.5" /></div>
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 dark:text-slate-200 uppercase tracking-widest">Thông tin chung</h3>
                </div>
                <Card className="rounded-[20px] border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 shadow-sm p-5 bg-white dark:bg-slate-900 dark:bg-slate-900" noPadding>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <Input
                                label="Tên định danh Flow"
                                value={localName}
                                onChange={(e) => {
                                    setLocalName(e.target.value);
                                    // Also sync name to parent if needed? 
                                    // For now focusing on config. 
                                    // But consistency suggests we should sync.
                                    onUpdate({ name: e.target.value }, true, true);
                                }}
                                className="shadow-none border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 focus:border-blue-500"
                                disabled={isFlowArchived} // Disable if archived
                            />
                            <div className="space-y-1.5">
                                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Mô tả / Ghi chú</label>
                                <textarea
                                    className="w-full bg-slate-50 dark:bg-slate-950 dark:bg-slate-950 border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:bg-white dark:bg-slate-900 dark:bg-slate-900 focus:border-blue-500 transition-all min-h-[80px]"
                                    value={localDesc}
                                    onChange={(e) => {
                                        setLocalDesc(e.target.value);
                                        onUpdate({ description: e.target.value }, true, true);
                                    }}
                                    placeholder="Mục tiêu chiến dịch..."
                                    disabled={isFlowArchived} // Disable if archived
                                />
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <h4 className="text-[9px] font-black text-slate-400 mb-3 uppercase tracking-widest ml-1">Loại quy trình</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <button
                                        onClick={() => updateConfig('type', 'realtime')}
                                        className={`p-4 rounded-2xl text-left transition-all border-2 flex items-center gap-4 ${localConfig.type !== 'batch' ? 'bg-blue-50/50 border-blue-500 shadow-sm ring-4 ring-blue-500/5' : 'bg-white dark:bg-slate-900 dark:bg-slate-900 border-slate-100 dark:border-slate-800 dark:border-slate-800/60 hover:border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 hover:bg-slate-50 dark:bg-slate-950 dark:bg-slate-950'}`}
                                        disabled={isFlowArchived}
                                    >
                                        <div className={`p-2.5 rounded-xl shadow-sm transition-all ${localConfig.type !== 'batch' ? 'bg-blue-500 text-white scale-110' : 'bg-slate-100 text-slate-400'}`}>
                                            <Zap className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className={`text-[11px] font-black uppercase tracking-tight ${localConfig.type !== 'batch' ? 'text-blue-900' : 'text-slate-600 dark:text-slate-300 dark:text-slate-300'}`}>Real-time</p>
                                            <p className="text-[10px] text-slate-400 font-medium">Xử lý ngay</p>
                                        </div>
                                    </button>
                                    <button
                                        onClick={() => updateConfig('type', 'batch')}
                                        className={`p-4 rounded-2xl text-left transition-all border-2 flex items-center gap-4 ${localConfig.type === 'batch' ? 'bg-indigo-50/50 border-indigo-500 shadow-sm ring-4 ring-indigo-500/5' : 'bg-white dark:bg-slate-900 dark:bg-slate-900 border-slate-100 dark:border-slate-800 dark:border-slate-800/60 hover:border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 hover:bg-slate-50 dark:bg-slate-950 dark:bg-slate-950'}`}
                                        disabled={isFlowArchived}
                                    >
                                        <div className={`p-2.5 rounded-xl shadow-sm transition-all ${localConfig.type === 'batch' ? 'bg-indigo-500 text-white scale-110' : 'bg-slate-100 text-slate-400'}`}>
                                            <Clock className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className={`text-[11px] font-black uppercase tracking-tight ${localConfig.type === 'batch' ? 'text-indigo-900' : 'text-slate-600 dark:text-slate-300 dark:text-slate-300'}`}>Batch</p>
                                            <p className="text-[10px] text-slate-400 font-medium">Theo tỷ lệ</p>
                                        </div>
                                    </button>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 dark:bg-slate-950/80 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 dark:border-slate-800/60/50">
                                <Globe className="w-4.5 h-4.5 text-slate-400" />
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 dark:text-slate-400 font-medium leading-none">Tự động gắn UTM tag: <span className="font-black text-slate-800 dark:text-slate-200 dark:text-slate-200 tracking-tight">{localName}</span></p>
                            </div>
                        </div>
                    </div>
                </Card>
            </section>

            {/* ENROLLMENT RULES */}
            <section className="mb-6 space-y-3">
                <div className="flex items-center gap-2 px-1">
                    <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg border border-purple-100 shadow-sm"><Users className="w-3.5 h-3.5" /></div>
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 dark:text-slate-200 uppercase tracking-widest">Quy tắc tham gia</h3>
                </div>
                <Card className="rounded-[20px] border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 shadow-sm p-6 bg-white dark:bg-slate-900 dark:bg-slate-900" noPadding>
                    <div className="p-6 space-y-8">
                        {/* Frequency Toggle - Row of 3 spread out */}
                        <div>
                            <h4 className="text-[9px] font-black text-slate-400 mb-4 uppercase tracking-widest ml-1">Tần suất tham gia</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                <button
                                    onClick={() => {
                                        updateConfigs({ frequency: 'one-time', allowMultiple: false });
                                    }}
                                    className={`p-5 rounded-3xl text-left transition-all border-2 flex flex-col gap-4 relative overflow-hidden group ${(localConfig.frequency || 'one-time') === 'one-time' ? 'bg-purple-50/50 border-purple-500 shadow-md ring-4 ring-purple-500/5' : 'bg-white dark:bg-slate-900 dark:bg-slate-900 border-slate-100 dark:border-slate-800 dark:border-slate-800/60 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-950 dark:bg-slate-950/30'}`}
                                    disabled={isFlowArchived}
                                >
                                    <div className={`p-3 rounded-2xl w-fit transition-transform duration-500 group-hover:scale-110 shadow-sm ${(localConfig.frequency || 'one-time') === 'one-time' ? 'bg-purple-600 text-white ring-8 ring-purple-100' : 'bg-slate-100 text-slate-400'}`}>
                                        <Target className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className={`text-[13px] font-black uppercase tracking-tight ${(localConfig.frequency || 'one-time') === 'one-time' ? 'text-purple-900' : 'text-slate-700 dark:text-slate-200 dark:text-slate-200'}`}>Một lần</p>
                                        <p className="text-[11px] text-slate-400 font-medium leading-tight">Chỉ tham gia 1 lần duy nhất trên toàn hệ thống.</p>
                                    </div>
                                    {(localConfig.frequency || 'one-time') === 'one-time' && <div className="absolute top-3 right-3"><CheckCircle2 className="w-5 h-5 text-purple-600" /></div>}
                                </button>

                                <button
                                    onClick={() => {
                                        updateConfigs({ frequency: 'recurring', allowMultiple: false });
                                    }}
                                    className={`p-5 rounded-3xl text-left transition-all border-2 flex flex-col gap-4 relative overflow-hidden group ${localConfig.frequency === 'recurring' && !localConfig.allowMultiple ? 'bg-pink-50/50 border-pink-500 shadow-md ring-4 ring-pink-500/5' : 'bg-white dark:bg-slate-900 dark:bg-slate-900 border-slate-100 dark:border-slate-800 dark:border-slate-800/60 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-950 dark:bg-slate-950/30'}`}
                                    disabled={isFlowArchived}
                                >
                                    <div className={`p-3 rounded-2xl w-fit transition-transform duration-500 group-hover:scale-110 shadow-sm ${localConfig.frequency === 'recurring' && !localConfig.allowMultiple ? 'bg-pink-600 text-white ring-8 ring-pink-100' : 'bg-slate-100 text-slate-400'}`}>
                                        <RefreshCw className="w-6 h-6 border-2 border-transparent" />
                                    </div>
                                    <div>
                                        <p className={`text-[13px] font-black uppercase tracking-tight ${localConfig.frequency === 'recurring' && !localConfig.allowMultiple ? 'text-pink-900' : 'text-slate-700 dark:text-slate-200 dark:text-slate-200'}`}>Lặp lại</p>
                                        <p className="text-[11px] text-slate-400 font-medium leading-tight">Tự động vào lại sau khi kết thúc và qua thời gian chờ.</p>
                                    </div>
                                    {localConfig.frequency === 'recurring' && !localConfig.allowMultiple && <div className="absolute top-3 right-3"><CheckCircle2 className="w-5 h-5 text-pink-600" /></div>}
                                </button>

                                <button
                                    onClick={() => {
                                        updateConfigs({ frequency: 'recurring', allowMultiple: true });
                                    }}
                                    className={`p-5 rounded-3xl text-left transition-all border-2 flex flex-col gap-4 relative overflow-hidden group ${localConfig.allowMultiple ? 'bg-emerald-50/50 border-emerald-500 shadow-md ring-4 ring-emerald-500/5' : 'bg-white dark:bg-slate-900 dark:bg-slate-900 border-slate-100 dark:border-slate-800 dark:border-slate-800/60 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-950 dark:bg-slate-950/30'}`}
                                    disabled={isFlowArchived}
                                >
                                    <div className={`p-3 rounded-2xl w-fit transition-transform duration-500 group-hover:scale-110 shadow-sm ${localConfig.allowMultiple ? 'bg-emerald-600 text-white ring-8 ring-emerald-100' : 'bg-slate-100 text-slate-400'}`}>
                                        <Zap className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <p className={`text-[13px] font-black uppercase tracking-tight ${localConfig.allowMultiple ? 'text-emerald-900' : 'text-slate-700 dark:text-slate-200 dark:text-slate-200'}`}>Liên tục</p>
                                        <p className="text-[11px] text-slate-400 font-medium leading-tight">Luôn mở luồng mới khi phát hiện sự kiện trùng khớp.</p>
                                    </div>
                                    {localConfig.allowMultiple && <div className="absolute top-3 right-3"><CheckCircle2 className="w-5 h-5 text-emerald-600" /></div>}
                                </button>
                            </div>
                        </div>

                        {/* Secondary Settings (Cooldown for Recurring, Max for Continuous) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8 border-t border-slate-100 dark:border-slate-800 dark:border-slate-800/60">
                            {/* Cooldown Settings - Only for "Lặp lại" (recurring without allowMultiple) */}
                            <div className={`${localConfig.frequency !== 'recurring' || localConfig.allowMultiple ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                                <h4 className="text-[9px] font-black text-slate-400 mb-4 uppercase tracking-widest ml-1">Thời gian chờ (Cool-down)</h4>
                                <div className="flex items-center gap-5 bg-slate-50 dark:bg-slate-950 dark:bg-slate-950/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 group relative">
                                    <div className="absolute -top-3 left-6 px-3 bg-white dark:bg-slate-900 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 dark:border-slate-800/60 rounded-full shadow-sm">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Khoảng cách an toàn</span>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-900 dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 dark:border-slate-800/60 group-hover:scale-105 transition-transform duration-300">
                                        <Clock className="w-5 h-5 text-slate-400 group-hover:text-pink-500 transition-colors" />
                                    </div>
                                    <div className="flex-1 flex items-baseline gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            max="720"
                                            value={localConfig.enrollmentCooldownHours ?? 12}
                                            onChange={(e) => updateConfig('enrollmentCooldownHours', parseInt(e.target.value) || 0)}
                                            className="w-20 bg-white dark:bg-slate-900 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 rounded-2xl px-2 py-3 text-xl font-black text-slate-800 dark:text-slate-200 dark:text-slate-200 outline-none focus:border-pink-500 text-center shadow-lg shadow-slate-200/50 transition-all"
                                            disabled={isFlowArchived || localConfig.frequency !== 'recurring' || localConfig.allowMultiple}
                                        />
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Tiếng</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold max-w-[120px] leading-tight text-right">Tối thiểu giữa 2 lần tham gia.</p>
                                </div>
                            </div>

                            {/* Max Enrollments - Only for "Liên tục" (allowMultiple = true) */}
                            <div className={`${!localConfig.allowMultiple ? 'opacity-30 grayscale pointer-events-none' : ''}`}>
                                <h4 className="text-[9px] font-black text-slate-400 mb-4 uppercase tracking-widest ml-1">Giới hạn số lần (Max)</h4>
                                <div className="flex items-center gap-5 bg-slate-50 dark:bg-slate-950 dark:bg-slate-950/50 p-5 rounded-3xl border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 group relative">
                                    <div className="absolute -top-3 left-6 px-3 bg-white dark:bg-slate-900 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 dark:border-slate-800/60 rounded-full shadow-sm">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Hạn mức quy trình</span>
                                    </div>
                                    <div className="p-3 bg-white dark:bg-slate-900 dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 dark:border-slate-800/60 group-hover:scale-105 transition-transform duration-300">
                                        <Target className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                                    </div>
                                    <div className="flex-1 flex items-baseline gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            value={localConfig.maxEnrollments ?? 0}
                                            onChange={(e) => updateConfig('maxEnrollments', parseInt(e.target.value) || 0)}
                                            className="w-20 bg-white dark:bg-slate-900 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 rounded-2xl px-2 py-3 text-xl font-black text-slate-800 dark:text-slate-200 dark:text-slate-200 outline-none focus:border-emerald-500 text-center shadow-lg shadow-slate-200/50 transition-all"
                                            disabled={isFlowArchived || !localConfig.allowMultiple}
                                        />
                                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Lần</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-bold max-w-[120px] leading-tight text-right text-balance">
                                        {localConfig.maxEnrollments > 0 ? `Đã giới hạn ${localConfig.maxEnrollments} lần.` : 'Không giới hạn tham gia.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </Card>
            </section>

            {/* SCHEDULING - ALWAYS VISIBLE BUT DISABLED FOR PRIORITY TRIGGERS */}
            <section className={`mb-6 space-y-3 transition-opacity ${(isFlowArchived) ? 'opacity-50 pointer-events-none grayscale' : ''} ${isPriorityTrigger ? 'opacity-70' : ''}`}>
                <div className="flex items-center gap-2 px-1">
                    <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 shadow-sm"><Calendar className="w-3.5 h-3.5" /></div>
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 dark:text-slate-200 uppercase tracking-widest">Lịch trình gửi</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="rounded-[20px] border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 shadow-sm p-5 bg-white dark:bg-slate-900 dark:bg-slate-900 md:col-span-1" noPadding>
                        <div className="p-5 flex flex-col h-full justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Shield className="w-4 h-4 text-slate-400" />
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-200 uppercase">Tần suất (Cap)</h4>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium leading-tight">Giới hạn số email tối đa gửi cho 1 người / 24h.</p>
                            </div>
                            <div className="flex items-center gap-2 mt-4 bg-slate-50 dark:bg-slate-950 dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-800 dark:border-slate-800/60">
                                <button onClick={() => handleCapping(-1)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:text-slate-300 dark:text-slate-300 shadow-sm active:scale-90 transition-all font-bold text-lg disabled:opacity-50" disabled={isFlowArchived || isPriorityTrigger}>-</button>
                                <div className="flex-1 text-center">
                                    <span className="text-xl font-black text-slate-800 dark:text-slate-200 dark:text-slate-200">{isPriorityTrigger ? '∞' : localConfig.frequencyCap}</span>
                                </div>
                                <button onClick={() => handleCapping(1)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:text-slate-300 dark:text-slate-300 shadow-sm active:scale-90 transition-all font-bold text-lg disabled:opacity-50" disabled={isFlowArchived || isPriorityTrigger}>+</button>
                            </div>
                        </div>
                    </Card>

                    {/* Max Messages Per Day */}
                    <Card className="rounded-[20px] border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 shadow-sm p-5 bg-white dark:bg-slate-900 dark:bg-slate-900 md:col-span-1" noPadding>
                        <div className="p-5 flex flex-col h-full justify-between">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-4 h-4 text-slate-400" />
                                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-200 uppercase">Max Tin / Ngày</h4>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium leading-tight">Giới hạn tổng tin nhắn (email + Zalo + Meta) / ngày. Để <b>0</b> là không giới hạn.</p>
                            </div>
                            <div className="flex items-center gap-2 mt-4 bg-slate-50 dark:bg-slate-950 dark:bg-slate-950 p-2 rounded-xl border border-slate-100 dark:border-slate-800 dark:border-slate-800/60">
                                <button
                                    onClick={() => updateConfig('maxMessagesPerDay', Math.max(0, (localConfig.maxMessagesPerDay ?? 0) - 1))}
                                    className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:text-slate-300 dark:text-slate-300 shadow-sm active:scale-90 transition-all font-bold text-lg disabled:opacity-50"
                                    disabled={isFlowArchived || isPriorityTrigger}
                                >-</button>
                                <div className="flex-1 text-center">
                                    <span className="text-xl font-black text-slate-800 dark:text-slate-200 dark:text-slate-200">{isPriorityTrigger ? '∞' : (localConfig.maxMessagesPerDay ?? 0) || '∞'}</span>
                                </div>
                                <button
                                    onClick={() => updateConfig('maxMessagesPerDay', (localConfig.maxMessagesPerDay ?? 0) + 1)}
                                    className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 dark:text-slate-400 hover:border-slate-400 hover:text-slate-600 dark:text-slate-300 dark:text-slate-300 shadow-sm active:scale-90 transition-all font-bold text-lg disabled:opacity-50"
                                    disabled={isFlowArchived || isPriorityTrigger}
                                >+</button>
                            </div>
                        </div>
                    </Card>

                    <Card className="rounded-[20px] border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 shadow-sm md:col-span-2 bg-white dark:bg-slate-900 dark:bg-slate-900" noPadding>
                        <div className="p-5 space-y-5">
                            {/* Time Range */}
                            <div className="bg-slate-50 dark:bg-slate-950 dark:bg-slate-950 rounded-xl p-4 border border-slate-100 dark:border-slate-800 dark:border-slate-800/60">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Khung giờ vàng</span>
                                    <Badge variant='warning' className="text-[8px] px-1.5 py-0">GMT+7</Badge>
                                </div>
                                <div className="h-2 bg-slate-200 rounded-full relative overflow-hidden mb-4">
                                    <div
                                        className="absolute h-full rounded-full shadow-sm bg-emerald-500"
                                        style={scheduleBarStyles}
                                    ></div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <input
                                            type="time"
                                            value={localConfig.startTime}
                                            onChange={(e) => updateConfig('startTime', e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-200 focus:border-slate-400 outline-none text-center disabled:opacity-60 disabled:bg-slate-50 dark:bg-slate-950 dark:bg-slate-950"
                                            disabled={isFlowArchived}
                                        />
                                    </div>
                                    <span className="text-slate-300 font-black">-</span>
                                    <div className="flex-1">
                                        <input
                                            type="time"
                                            value={localConfig.endTime}
                                            onChange={(e) => updateConfig('endTime', e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-slate-200 focus:border-slate-400 outline-none text-center disabled:opacity-60 disabled:bg-slate-50 dark:bg-slate-950 dark:bg-slate-950"
                                            disabled={isFlowArchived}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Active Days */}
                            <div>
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block ml-1">Ngày hoạt động</label>
                                <div className="flex gap-1.5">
                                    {days.map((day) => {
                                        const isActive = (localConfig.activeDays || []).includes(day.id);
                                        return (
                                            <button
                                                key={day.id}
                                                onClick={() => toggleDay(day.id)}
                                                className={`
                                            flex-1 py-2.5 rounded-lg text-[10px] font-bold border transition-all shadow-sm
                                            ${isActive
                                                        ? 'bg-emerald-500 border-emerald-600 text-white shadow-emerald-200'
                                                        : 'bg-white dark:bg-slate-900 dark:bg-slate-900 border-slate-100 dark:border-slate-800 dark:border-slate-800/60 text-slate-400 hover:border-slate-300'}
                                        `}
                                                disabled={isFlowArchived}
                                            >
                                                {day.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </section>

            {/* SMART INTERRUPTS */}
            <section className={`mb-8 space-y-3 ${isFlowArchived ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                <div className="flex items-center gap-2 px-1">
                    <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 shadow-sm"><Power className="w-3.5 h-3.5" /></div>
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 dark:text-slate-200 uppercase tracking-widest">Quy tắc ngắt luồng</h3>
                </div>
                <Card className="rounded-[20px] border border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60 shadow-sm p-5 bg-white dark:bg-slate-900 dark:bg-slate-900" noPadding>
                    <div className="p-5">

                        {/* EXIT CONDITIONS */}
                        <ExitConditions
                            conditions={localConfig.exitConditions || []}
                            onChange={(c) => updateConfig('exitConditions', c)}
                            disabled={isFlowArchived}
                        />

                        <div className="mt-8">
                            <BounceHandling
                                value={localConfig.bounceBehavior || 'stop'}
                                onChange={(val) => {
                                    updateConfig('bounceBehavior', val);
                                    // FORCE 'bounced' into exitConditions if not present (since this setting implies it's handled)
                                    // Logic: If user sets behavior, they expect bounce checking. 
                                    const currentExits = localConfig.exitConditions || [];
                                    if (!currentExits.includes('bounced')) {
                                        updateConfig('exitConditions', [...currentExits, 'bounced']);
                                    }
                                }}
                                disabled={isFlowArchived}
                            />
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 dark:border-slate-800/60">
                            <AdvancedExitTrigger
                                config={localConfig.advancedExit || {}}
                                onChange={(cfg) => updateConfig('advancedExit', cfg)}
                                disabled={isFlowArchived}
                            />
                        </div>
                    </div>
                </Card>
            </section>

            {/* MANUAL SAVE BUTTON AREA */}
            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700/60 dark:border-slate-700/60">
                <Button
                    size="lg"
                    onClick={handleSave}
                    icon={Save}
                    disabled={!isModified || isFlowArchived} // Disable if not modified OR archived
                    className={`
                px-8 h-12 rounded-xl shadow-xl transition-all
                ${isModified && !isFlowArchived
                            ? 'bg-slate-900 text-white hover:bg-black shadow-slate-300'
                            : 'bg-slate-100 text-slate-400 shadow-none cursor-not-allowed'}
            `}
                >
                    {isModified ? 'Lưu cấu hình' : 'Đã đồng bộ'}
                </Button>
            </div>
        </div >
    );
};

export default FlowSettingsTab;
