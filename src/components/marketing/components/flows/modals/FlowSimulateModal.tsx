import { EXTERNAL_ASSET_BASE } from '../../../utils/config';
import * as React from 'react';
import { useState } from 'react';
import {
    Play, X, User, Tag, Mail, MousePointerClick, Activity,
    GitMerge, CheckCircle2, Zap, Clock, ArrowRight, Beaker,
    Layers, FileInput, ShoppingCart, Calendar, Send, UserMinus, List, ListPlus, Link as LinkIcon,
    Code
} from 'lucide-react';
import Input from '../../common/Input';
import { Flow } from '../../../types';
import Modal from '../../common/Modal';

interface FlowSimulateModalProps {
    isOpen: boolean;
    onClose: () => void;
    flow: Flow;
    isDarkTheme?: boolean;
}

const getNodeStyle = (step: any) => {
    const type = step.type;
    const config = step.config || {};

    if (type === 'trigger') {
        const tType = config.type || 'segment';
        switch (tType) {
            case 'segment': return config.targetSubtype === 'list' ? { icon: List, gradient: 'from-orange-500 to-[#ca7900]', text: 'text-orange-600', bg: 'bg-orange-50', label: 'Kích hoạt: Danh sách' } : { icon: Layers, gradient: 'from-orange-500 to-[#ca7900]', text: 'text-orange-600', bg: 'bg-orange-50', label: 'Kích hoạt: Phân khúc' };
            case 'form': return { icon: FileInput, gradient: 'from-[#f59e0b] to-[#d97706]', text: 'text-yellow-600', bg: 'bg-yellow-50', label: 'Kích hoạt: Biểu mẫu' };
            case 'purchase': return { icon: ShoppingCart, gradient: 'from-pink-500 to-rose-600', text: 'text-pink-600', bg: 'bg-pink-50', label: 'Kích hoạt: Đơn hàng' };
            case 'custom_event': return { icon: Zap, gradient: 'from-blue-500 to-indigo-600', text: 'text-blue-600', bg: 'bg-blue-50', label: 'Sự kiện tùy chỉnh' };
            case 'tag': return { icon: Tag, gradient: 'from-emerald-500 to-teal-600', text: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Kích hoạt: Gắn thẻ' };
            case 'date': return { icon: Calendar, gradient: 'from-blue-500 to-indigo-600', text: 'text-blue-600', bg: 'bg-blue-50', label: 'Sự kiện: Ngày tháng' };
            case 'campaign': return { icon: Send, gradient: 'from-blue-500 to-purple-600', text: 'text-blue-600', bg: 'bg-blue-50', label: 'Kích hoạt: Chiến dịch' };
            default: return { icon: Zap, gradient: 'from-slate-700 to-slate-900', text: 'text-slate-600', bg: 'bg-slate-50', label: 'Điểm bắt đầu' };
        }
    }

    switch (type) {
        case 'action': return { icon: Mail, gradient: 'from-blue-600 to-indigo-700', text: 'text-blue-600', bg: 'bg-blue-50', label: 'Gửi Email' };
        case 'zalo_zns': return {
            icon: ({ className }: { className?: string }) => (
                <img
                    src={`${EXTERNAL_ASSET_BASE}/imgs/zalolog.png`}
                    alt="Zalo"
                    className={className}
                />
            ),
            gradient: 'from-blue-400 to-blue-600',
            text: 'text-blue-600',
            bg: 'bg-blue-50',
            label: 'Zalo ZNS'
        };
        case 'wait': return { icon: Clock, gradient: 'from-amber-400 to-orange-500', text: 'text-amber-600', bg: 'bg-amber-50', label: 'Chờ đợi' };
        case 'condition': return { icon: GitMerge, gradient: 'from-indigo-500 to-purple-600', text: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Điều kiện' };
        case 'advanced_condition': return { icon: GitMerge, gradient: 'from-indigo-500 to-purple-600', text: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Điều kiện nâng cao' };
        case 'split_test': return { icon: Beaker, gradient: 'from-blue-500 to-fuchsia-600', text: 'text-blue-600', bg: 'bg-blue-50', label: 'Thử nghiệm A/B' };
        case 'update_tag': return { icon: Tag, gradient: 'from-emerald-500 to-emerald-700', text: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Cập nhật thẻ' };
        case 'list_action': return { icon: List, gradient: 'from-orange-500 to-orange-700', text: 'text-orange-600', bg: 'bg-orange-50', label: 'Thao tác danh sách' };
        case 'link_flow': return { icon: LinkIcon, gradient: 'from-slate-700 to-slate-900', text: 'text-slate-600', bg: 'bg-slate-50', label: 'Chuyển kịch bản' };
        case 'remove_action': return { icon: UserMinus, gradient: 'from-rose-500 to-red-600', text: 'text-rose-600', bg: 'bg-rose-50', label: 'Xóa khỏi luồng' };
        default: return { icon: CheckCircle2, gradient: 'from-slate-400 to-slate-500', text: 'text-slate-500', bg: 'bg-slate-50', label: 'Bước xử lý' };
    }
};

const FlowSimulateModal: React.FC<FlowSimulateModalProps> = ({ isOpen, onClose, flow, isDarkTheme }) => {
    const [mockSubscriber, setMockSubscriber] = useState<any>({
        email: 'khachhang@example.com',
        first_name: 'Nguyễn',
        last_name: 'Văn A',
        gender: 'male',
        order_count: '5',
        tags: 'vip, loyaly',
        attributes: '{"date_of_birth": "1995-05-15", "city": "Ho Chi Minh", "loyal": true}',
        hasOpened: true,
        hasClicked: false,
        hasReplied: false,
        hasZnsClicked: false
    });

    const [simulationResult, setSimulationResult] = useState<any[] | null>(null);

    const formatSimTime = (date: Date) => {
        return date.toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const runSimulation = () => {
        const path: any[] = [];
        let currentStepId = flow.steps.find(s => s.type === 'trigger')?.id;
        const visited = new Set<string>();
        let safetyCounter = 0;

        // Start time for simulation (Now)
        let simTime = new Date();

        const subscriberTags = (mockSubscriber.tags || '').split(',').map((t: string) => t.trim().toLowerCase());
        let parsedAttrs: Record<string, any> = {};
        try { parsedAttrs = JSON.parse(mockSubscriber.attributes || '{}'); } catch (e) { console.error("Invalid mock attributes"); }
        const fullMockData = { ...mockSubscriber, ...parsedAttrs };

        while (currentStepId && safetyCounter < 100) {
            safetyCounter++;
            if (visited.has(currentStepId)) break;
            visited.add(currentStepId);

            const step = flow.steps.find(s => s.id === currentStepId);
            if (!step) break;

            let nextId: string | undefined = undefined;
            let branchTaken = '';
            let reasoning = '';
            let stepTimeLabel = formatSimTime(new Date(simTime));

            if (step.type === 'condition') {
                const condType = step.config?.conditionType || 'opened';
                let matched = false;

                switch (condType) {
                    case 'opened': matched = mockSubscriber.hasOpened; reasoning = matched ? 'Đã mở Email' : 'Chưa mở Email'; break;
                    case 'clicked': matched = mockSubscriber.hasClicked; reasoning = matched ? 'Đã nhấn Link' : 'Chưa nhấn Link'; break;
                    case 'replied': matched = mockSubscriber.hasReplied; reasoning = matched ? 'Đã phản hồi' : 'Chưa phản hồi'; break;
                    case 'zns_clicked': matched = mockSubscriber.hasZnsClicked; reasoning = matched ? 'Đã nhấn Zalo ZNS' : 'Chưa nhấn Zalo ZNS'; break;
                    case 'tag_match':
                        const targetTag = step.config?.tag?.toLowerCase();
                        matched = subscriberTags.includes(targetTag);
                        reasoning = matched ? `Có thẻ "${targetTag}"` : `Không có thẻ "${targetTag}"`;
                        break;
                    case 'attribute_match':
                        const key = step.config?.attributeKey;
                        const op = step.config?.operator;
                        const val = step.config?.value;
                        const subVal = fullMockData[key];
                        if (op === 'equals') matched = String(subVal) === String(val);
                        else if (op === 'contains') matched = String(subVal).includes(String(val));
                        else if (op === 'exists') matched = subVal !== undefined && subVal !== null && subVal !== '';
                        reasoning = `Thuộc tính "${key}" (${subVal}) ${op} "${val}" → ${matched ? 'Khớp' : 'Không khớp'}`;
                        break;
                }

                branchTaken = matched ? 'ĐÚNG (YES)' : 'SAI (NO)';
                nextId = matched ? (step.yesStepId || step.config?.yesPath) : (step.noStepId || step.config?.noPath);
            } else if (step.type === 'advanced_condition') {
                const branches = step.config?.branches || [];
                const defaultStepId = step.config?.defaultStepId;
                let matchedBranch: any = null;

                for (const branch of branches) {
                    let isBranchMatch = true;
                    const conditions = branch.conditions || [];

                    if (conditions.length === 0) continue;

                    for (const cond of conditions) {
                        const field = cond.field;
                        const op = cond.operator;
                        const val = String(cond.value || '').toLowerCase();
                        let actualVal = fullMockData[field];

                        // Special field mapping
                        if (field === 'tags') actualVal = subscriberTags;

                        let condMatch = false;
                        if (Array.isArray(actualVal)) {
                            // Process Array values

                            const arr = actualVal.map(v => String(v).toLowerCase());
                            if (op === 'contains') condMatch = arr.includes(val);
                            else if (op === 'not_contains') condMatch = !arr.includes(val);
                            else if (op === 'is_set') condMatch = arr.length > 0;
                            else if (op === 'is_not_set') condMatch = arr.length === 0;
                        } else {
                            const checkVal = String(actualVal || '').toLowerCase();
                            switch (op) {
                                case 'equals': condMatch = checkVal === val; break;
                                case 'is_not': condMatch = checkVal !== val; break;
                                case 'contains': condMatch = checkVal.includes(val); break;
                                case 'not_contains': condMatch = !checkVal.includes(val); break;
                                case 'starts_with': condMatch = checkVal.startsWith(val); break;
                                case 'ends_with': condMatch = checkVal.endsWith(val); break;
                                case 'is_set': condMatch = actualVal !== undefined && actualVal !== null && actualVal !== ''; break;
                                case 'is_not_set': condMatch = actualVal === undefined || actualVal === null || actualVal === ''; break;
                                case 'is_on':
                                case 'is_before':
                                case 'is_after':
                                    if (actualVal && val) {
                                        const d1 = new Date(actualVal).setHours(0, 0, 0, 0);
                                        const d2 = new Date(val).setHours(0, 0, 0, 0);
                                        if (op === 'is_on') condMatch = d1 === d2;
                                        else if (op === 'is_before') condMatch = d1 < d2;
                                        else if (op === 'is_after') condMatch = d1 > d2;
                                    }
                                    break;
                            }
                        }

                        if (!condMatch) {
                            isBranchMatch = false;
                            break;
                        }
                    }

                    if (isBranchMatch) {
                        matchedBranch = branch;
                        break;
                    }
                }

                if (matchedBranch) {
                    branchTaken = matchedBranch.label || 'Khớp điều kiện';
                    reasoning = `Khớp nhánh: ${branchTaken}`;
                    nextId = matchedBranch.stepId;
                } else {
                    branchTaken = 'MẶC ĐỊNH (DEFAULT)';
                    reasoning = 'Không khớp nhánh nào → Đi theo nhánh mặc định';
                    nextId = defaultStepId;
                }
            } else if (step.type === 'split_test') {
                const random = Math.random() < 0.5 ? 'A' : 'B';
                branchTaken = `NHÁNH ${random}`;
                reasoning = `Phân nhánh ngẫu nhiên Path ${random}`;
                nextId = random === 'A' ? step.pathAStepId : step.pathBStepId;
            } else if (step.type === 'wait') {
                const mode = step.config?.mode || 'duration';
                const oldTime = new Date(simTime);

                if (mode === 'until') {
                    const targetTime = step.config?.untilTime || '09:00';
                    const targetDay = step.config?.untilDay; // 0-6 or empty

                    let [hours, minutes] = targetTime.split(':').map(Number);
                    simTime.setHours(hours, minutes || 0, 0, 0);

                    if (targetDay !== undefined && targetDay !== '') {
                        const currentDay = simTime.getDay();
                        let daysToWait = (Number(targetDay) - currentDay + 7) % 7;
                        if (daysToWait === 0 && simTime <= oldTime) daysToWait = 7;
                        simTime.setDate(simTime.getDate() + daysToWait);
                    } else {
                        if (simTime <= oldTime) simTime.setDate(simTime.getDate() + 1);
                    }
                    reasoning = `Đợi đến ${targetTime}${targetDay ? ` Thứ ${Number(targetDay) === 0 ? 'CN' : Number(targetDay) + 1}` : ' hàng ngày'}`;
                } else if (mode === 'until_attribute') {
                    const attrKey = step.config?.attributeKey || 'date_of_birth';
                    const offsetType = step.config?.offsetType || 'before';
                    const offsetValue = parseInt(step.config?.offsetValue || 0);

                    const rawDate = fullMockData[attrKey];
                    if (rawDate) {
                        const attrDate = new Date(rawDate);
                        simTime.setMonth(attrDate.getMonth(), attrDate.getDate());
                        simTime.setHours(9, 0, 0, 0);

                        if (offsetType === 'before') simTime.setDate(simTime.getDate() - offsetValue);
                        else simTime.setDate(simTime.getDate() + offsetValue);

                        if (simTime <= oldTime) simTime.setFullYear(simTime.getFullYear() + 1);
                        reasoning = `Dựa theo "${attrKey}": ${offsetValue} ngày ${offsetType === 'before' ? 'trước' : 'sau'}`;
                    } else {
                        reasoning = `Không tìm thấy thuộc tính "${attrKey}" → Tiếp tục ngay`;
                    }
                } else {
                    const unit = step.config?.unit || 'hours';
                    // Robust duration parsing with defaults matched to WaitConfig
                    const defaultDur = unit === 'minutes' ? 10 : 1;
                    const dur = parseInt(String(step.config?.duration ?? defaultDur)) || defaultDur;

                    if (unit === 'minutes') simTime.setMinutes(simTime.getMinutes() + dur);
                    else if (unit === 'hours') simTime.setHours(simTime.getHours() + dur);
                    else if (unit === 'days') simTime.setDate(simTime.getDate() + dur);
                    else if (unit === 'weeks') simTime.setDate(simTime.getDate() + dur * 7);

                    reasoning = `Đợi ${dur} ${unit === 'minutes' ? 'phút' : (unit === 'hours' ? 'giờ' : (unit === 'days' ? 'ngày' : 'tuần'))}`;
                }

                stepTimeLabel = `${formatSimTime(oldTime)} → ${formatSimTime(new Date(simTime))}`;
                nextId = step.nextStepId;
            } else if (step.type === 'trigger') {
                reasoning = 'Bắt đầu hành trình';
                nextId = step.nextStepId;
            } else {
                nextId = step.nextStepId;
            }

            path.push({ ...step, branchTaken, reasoning, simTimestamp: stepTimeLabel });
            currentStepId = nextId;
        }

        setSimulationResult(path);
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="xl"
            noHeader
            noPadding
            noScroll
            isDarkTheme={isDarkTheme}
        >
            <div className={`w-full h-full flex flex-col overflow-hidden ${isDarkTheme ? 'bg-[#11151d] text-slate-100' : 'bg-white text-slate-800'}`}>
                {/* Header */}
                <div className={`px-6 py-5 border-b flex justify-between items-center shrink-0 ${isDarkTheme ? 'bg-[#11151d] border-slate-800/80' : 'bg-slate-50/80 border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl text-white shadow-lg shadow-blue-500/20 flex items-center justify-center">
                            <Beaker className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>Kịch bản Mô phỏng</h2>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Kiểm tra Luồng & Thời gian chờ</p>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all shadow-sm border ${isDarkTheme ? 'bg-slate-800 hover:bg-slate-700 border-slate-700/60 text-slate-400' : 'bg-white hover:bg-slate-100 border-slate-100 text-slate-400'}`}>
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* Left: Configuration */}
                    <div className={`w-[320px] border-r p-6 overflow-y-auto space-y-6 ${isDarkTheme ? 'border-slate-800 bg-[#161b24]/30' : 'border-slate-100 bg-slate-50/20'}`}>
                        <div className="space-y-4">
                            <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center justify-between">
                                <div className="flex items-center gap-2"><User className="w-3.5 h-3.5 text-blue-600" /> Hồ sơ khách mẫu</div>
                                <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold ${isDarkTheme ? 'text-blue-400 bg-blue-950/40' : 'text-blue-500 bg-blue-50'}`}>Hồ sơ Simulation</span>
                            </h3>
                            <div className="grid grid-cols-1 gap-3">
                                <Input
                                    label="Họ tên"
                                    value={mockSubscriber.first_name}
                                    onChange={(e) => setMockSubscriber({ ...mockSubscriber, first_name: e.target.value })}
                                    isDarkTheme={isDarkTheme}
                                />
                                <Input
                                    label="Email"
                                    value={mockSubscriber.email}
                                    onChange={(e) => setMockSubscriber({ ...mockSubscriber, email: e.target.value })}
                                    isDarkTheme={isDarkTheme}
                                />
                                <Input
                                    label="Thẻ (Ngăn cách bởi dấu phẩy)"
                                    placeholder="vip, lead, hot..."
                                    value={mockSubscriber.tags}
                                    onChange={(e) => setMockSubscriber({ ...mockSubscriber, tags: e.target.value })}
                                    isDarkTheme={isDarkTheme}
                                />
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                                        <Code className="w-3 h-3" /> Thuộc tính mở rộng (JSON)
                                    </label>
                                    <textarea
                                        className={`w-full h-24 border rounded-xl p-3 text-[11px] font-mono focus:ring-4 focus:ring-blue-500/5 focus:border-blue-400 transition-all outline-none resize-none ${isDarkTheme ? 'bg-slate-950 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-800'}`}
                                        value={mockSubscriber.attributes}
                                        onChange={(e) => setMockSubscriber({ ...mockSubscriber, attributes: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-orange-500" /> Giả lập hành vi
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'hasOpened', label: 'Mở Email', icon: Mail },
                                    { id: 'hasClicked', label: 'Nhấn Link', icon: MousePointerClick },
                                    { id: 'hasReplied', label: 'Phản hồi', icon: Activity },
                                    { id: 'hasZnsClicked', label: 'Nhấn Zalo', icon: Zap },
                                ].map(b => (
                                    <button
                                        key={b.id}
                                        onClick={() => setMockSubscriber({ ...mockSubscriber, [b.id]: !mockSubscriber[b.id] })}
                                        className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border transition-all duration-300 ${mockSubscriber[b.id]
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-500/20'
                                            : `${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'}`
                                            }`}
                                    >
                                        <b.icon className={`w-4 h-4 ${mockSubscriber[b.id] ? 'animate-bounce' : ''}`} />
                                        <span className="text-[9px] font-black uppercase tracking-tighter whitespace-nowrap">{b.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button
                            onClick={runSimulation}
                            className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
                        >
                            <Play className="w-4 h-4 fill-current group-hover:animate-pulse" /> RUN TEST
                        </button>
                    </div>

                    {/* Right: Detailed Path Visualization */}
                    <div className={`flex-1 p-8 overflow-y-auto ${isDarkTheme ? 'bg-[#121620]/30' : 'bg-slate-50/40'}`}>
                        {simulationResult ? (
                            <div className="max-w-2xl mx-auto space-y-6">
                                <div className="flex justify-between items-center px-2">
                                    <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Thời gian thực thi dự kiến</h3>
                                    <span className={`text-[9px] border px-3 py-1 rounded-full font-bold shadow-sm ${isDarkTheme ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-white border-slate-200 text-slate-500'}`}>{simulationResult.length} bước đã xử lý</span>
                                </div>

                                <div className="relative pl-10 space-y-6 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200/60">
                                    {simulationResult.map((step, idx) => {
                                        const style = getNodeStyle(step);
                                        const Icon = style.icon;
                                        return (
                                            <div key={idx} className="relative group animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${idx * 80}ms` }}>
                                                {/* Step Number Badge */}
                                                <div className={`absolute -left-[36px] top-1 w-8 h-8 rounded-full border-[3.5px] shadow-lg flex items-center justify-center text-white text-[10px] font-black z-10 transition-transform ${isDarkTheme ? 'border-[#11151d]' : 'border-white'} ${step.branchTaken ? 'bg-indigo-600' : 'bg-blue-500'}`}>
                                                    {idx + 1}
                                                </div>

                                                {/* Step Content Card */}
                                                <div className={`border rounded-[24px] p-4 shadow-sm transition-all duration-300 group-hover:shadow-md ${step.branchTaken ? (isDarkTheme ? 'bg-indigo-950/20 border-indigo-900/40 ring-4 ring-indigo-950/30' : 'border-indigo-100 ring-4 ring-indigo-50/50 bg-white') : (isDarkTheme ? 'bg-slate-900 border-slate-800' : 'border-slate-100 bg-white')}`}>
                                                    <div className="flex flex-col gap-3">
                                                        <div className="flex items-start justify-between">
                                                            <div className="flex items-start gap-4">
                                                                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-md bg-gradient-to-br ${style.gradient} text-white shrink-0`}>
                                                                    <Icon className="w-5 h-5" />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${style.bg} ${style.text}`}>
                                                                            {style.label}
                                                                        </span>
                                                                        {step.branchTaken && (
                                                                            <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-indigo-600 text-white shadow-sm animate-in zoom-in-75">
                                                                                {step.branchTaken}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <h4 className={`text-sm font-bold tracking-tight ${isDarkTheme ? 'text-slate-200' : 'text-slate-850'}`}>{step.label}</h4>
                                                                </div>
                                                            </div>

                                                            <div className="text-right">
                                                                <div className={`inline-flex items-center gap-1.5 px-3 py-1 border rounded-lg shadow-sm ${isDarkTheme ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                                                    <Clock className="w-3 h-3 text-slate-400" />
                                                                    <span className={`text-[10px] font-black tabular-nums ${isDarkTheme ? 'text-slate-400' : 'text-slate-600'}`}>
                                                                        {step.simTimestamp}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {step.reasoning && (
                                                            <div className={`flex items-start gap-2.5 p-3 rounded-2xl border transition-colors ${isDarkTheme ? 'bg-slate-950/40 border-slate-800/80 group-hover:bg-slate-950/80' : 'bg-slate-50/50 border-slate-50 group-hover:bg-white group-hover:border-slate-100'}`}>
                                                                <div className={`p-1.5 rounded-lg shadow-sm ${isDarkTheme ? 'bg-slate-900' : 'bg-white'}`}>
                                                                    <Beaker className="w-3 h-3 text-indigo-500" />
                                                                </div>
                                                                <p className={`text-[10px] font-semibold leading-relaxed ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>
                                                                    {step.reasoning}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Journey End Point */}
                                    <div className="relative flex items-center gap-4 pl-0 py-4">
                                        <div className={`w-10 h-10 -ml-1 rounded-full border-[4px] shadow-xl flex items-center justify-center text-emerald-600 ${isDarkTheme ? 'bg-emerald-950/30 border-[#11151d]' : 'bg-emerald-50 border-white'}`}>
                                            <CheckCircle2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 block">Hoàn tất mô phỏng</span>
                                            <span className="text-[9px] text-slate-400 font-bold">Dự kiến kết thúc vào mốc Thời gian trên</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-350 space-y-6 animate-in fade-in zoom-in-95 duration-700">
                                <div className="relative">
                                    <div className={`w-24 h-24 rounded-[28px] shadow-xl flex items-center justify-center border ${isDarkTheme ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                        <Beaker className="w-10 h-10 text-blue-500/40 animate-pulse" />
                                    </div>
                                    <div className="absolute -top-3 -right-3 w-8 h-8 bg-orange-400 rounded-xl shadow-lg flex items-center justify-center text-white animate-bounce">
                                        <Zap className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="text-center space-y-1.5">
                                    <p className={`text-sm font-black uppercase tracking-tight ${isDarkTheme ? 'text-slate-300' : 'text-slate-800'}`}>Simulator Standby</p>
                                    <p className="text-[11px] font-medium text-slate-400 max-w-[240px]">Thiết lập hồ sơ và hành vi bên trái, sau đó nhấn "RUN TEST" để xem dòng Thời gian chính xác.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default FlowSimulateModal;
