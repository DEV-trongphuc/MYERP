import React, { useEffect, useState } from 'react';
import {
    Briefcase, PhoneCall, CheckSquare, UserCheck, BellRing, Flame, Thermometer,
    Snowflake, Clock, Sparkles, Check, Layers, AlertCircle, RefreshCw, Users
} from 'lucide-react';
import erpApi from '../../../../../api/axios';
import { STANDARD_PIPELINE_STAGES, CRM_ACTION_TYPES } from '../../../constants/flowConstants';

interface CrmActionConfigProps {
    config: Record<string, any>;
    onChange: (newConfig: Record<string, any>) => void;
    disabled?: boolean;
}

export const CrmActionConfig: React.FC<CrmActionConfigProps> = ({ config, onChange }) => {
    const actionType:
        | 'assign_round_robin'
        | 'reassign_if_uncontacted'
        | 'update_temperature'
        | 'update_stage'
        | 'create_task'
        | 'assign_owner'
        | 'notify_owner'
        | 'create_support_ticket' = config.actionType || 'update_stage';

    const [pipelineStages, setPipelineStages] = useState<Array<{ value: string; label: string }>>(
        STANDARD_PIPELINE_STAGES
    );
    const [crmUsers, setCrmUsers] = useState<Array<{ value: string; label: string }>>([]);
    const [crmTeams, setCrmTeams] = useState<Array<{ value: string; label: string }>>([]);

    useEffect(() => {
        const controller = new AbortController();

        const fetchCrmOptions = async () => {
            try {
                const stageRes = await erpApi.get('/pipeline-stages', { signal: controller.signal });
                const rawStages = stageRes?.data?.data || stageRes?.data || [];
                if (Array.isArray(rawStages) && rawStages.length > 0) {
                    const mapped = rawStages
                        .map((st: any) => ({
                            value: String(st.id ?? st.stage_id ?? ''),
                            label: String(st.name ?? st.stage_name ?? st.title ?? '')
                        }))
                        .filter(s => s.value && s.label);
                    if (mapped.length > 0) {
                        setPipelineStages(mapped);
                    }
                }
            } catch {
                // Keep STANDARD_PIPELINE_STAGES fallback
            }

            try {
                const userRes = await erpApi.get('/users', { signal: controller.signal });
                const rawUsers = userRes?.data?.data || userRes?.data || [];
                if (Array.isArray(rawUsers) && rawUsers.length > 0) {
                    const mappedUsers = rawUsers
                        .filter((u: any) => u && (u.id || u.username || u.full_name || u.name))
                        .map((u: any) => {
                            const fullName = u.full_name || u.name || u.username || `User #${u.id}`;
                            const roleBadge = u.role ? ` (${u.role})` : '';
                            return {
                                value: String(u.id ?? fullName),
                                label: `${fullName}${roleBadge}`
                            };
                        });
                    if (mappedUsers.length > 0) {
                        setCrmUsers(mappedUsers);
                    }
                }
            } catch {
                // Keep manual fallback
            }

            try {
                const teamRes = await erpApi.get('/teams', { signal: controller.signal });
                const rawTeams = teamRes?.data?.data || teamRes?.data || [];
                if (Array.isArray(rawTeams) && rawTeams.length > 0) {
                    const mappedTeams = rawTeams
                        .filter((t: any) => t && (t.id || t.name || t.team_name))
                        .map((t: any) => ({
                            value: String(t.id ?? ''),
                            label: String(t.name ?? t.team_name ?? `Vòng chia #${t.id}`)
                        }))
                        .filter(t => t.value && t.label);
                    if (mappedTeams.length > 0) {
                        setCrmTeams(mappedTeams);
                    }
                }
            } catch {
                // Keep manual fallback
            }
        };

        fetchCrmOptions();
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!config.actionType) {
            onChange({
                ...config,
                actionType: 'update_stage',
                stage_id: config.stage_id || STANDARD_PIPELINE_STAGES[0].value,
                lead_status: config.lead_status || 'active',
                temperature: config.temperature || 'warm'
            });
        }
    }, []);

    const handleSelectActionType = (newType: string) => {
        const next: Record<string, any> = { ...config, actionType: newType };
        if (newType === 'assign_round_robin') {
            if (next.respectShifts === undefined) next.respectShifts = true;
            if (next.onlyIfUnassigned === undefined) next.onlyIfUnassigned = false;
        } else if (newType === 'reassign_if_uncontacted') {
            if (!next.note) next.note = 'Quá hạn SLA chưa liên hệ - Tự động điều phối sang Sale khác';
            if (next.respectShifts === undefined) next.respectShifts = true;
        } else if (newType === 'update_temperature') {
            if (!next.temperature) next.temperature = 'hot';
            if (!next.leadStatus && !next.lead_status) {
                next.leadStatus = 'active';
                next.lead_status = 'active';
            }
        } else if (newType === 'update_stage') {
            if (!next.stage_id) next.stage_id = pipelineStages[0]?.value || '1';
            if (!next.lead_status) next.lead_status = 'active';
            if (!next.temperature) next.temperature = 'warm';
        } else if (newType === 'create_task') {
            if (!next.task_type) next.task_type = 'call';
            if (!next.subject) next.subject = 'Gọi tư vấn khách hàng {{full_name}}';
            if (next.due_in_hours === undefined) next.due_in_hours = 24;
        } else if (newType === 'assign_owner') {
            if (next.only_if_unassigned === undefined) next.only_if_unassigned = true;
        } else if (newType === 'notify_owner') {
            if (!next.message && !next.body) {
                next.message = 'Khách hàng {{full_name}} vừa tương tác chiến dịch Marketing. Vui lòng kiểm tra và liên hệ ngay!';
            }
        } else if (newType === 'create_support_ticket') {
            if (!next.ticket_subject && !next.subject) {
                next.ticket_subject = 'Hỗ trợ học viên / khách hàng {{full_name}} ({{student_code}})';
            }
            if (!next.priority) next.priority = 'medium';
            if (next.due_in_hours === undefined) next.due_in_hours = 24;
        }
        onChange(next);
    };

    const insertPlaceholder = (field: 'subject' | 'body' | 'message' | 'ticket_subject' | 'ticket_description', token: string) => {
        const current = String(config[field] || '');
        onChange({ ...config, [field]: `${current}${current ? ' ' : ''}${token}` });
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-200 pb-6">
            {/* Header Info */}
            <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-[14px] flex items-start gap-3">
                <div className="p-2 bg-white rounded-[var(--radius-md)] text-indigo-700 shadow-sm shrink-0">
                    <Briefcase className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wide mb-0.5">
                        Đồng bộ Tác vụ trực tiếp sang MYERP CRM
                    </h4>
                    <p className="text-[11px] text-indigo-700/80 font-medium leading-relaxed">
                        Khi khách hàng đi tới bước này, hệ thống sẽ tự động thực thi nghiệp vụ trên hồ sơ Lead/Contact trong CRM theo thời gian thực.
                    </p>
                </div>
            </div>

            {/* Action Type Selector */}
            <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 px-1">
                    Loại tác vụ CRM cần thực hiện
                </label>
                <div className="grid grid-cols-1 gap-2.5">
                    {CRM_ACTION_TYPES.map(item => {
                        const isSelected = actionType === item.id;
                        const IconComp =
                            item.id === 'assign_round_robin'
                                ? Users
                                : item.id === 'reassign_if_uncontacted'
                                ? RefreshCw
                                : item.id === 'update_temperature'
                                ? Flame
                                : item.id === 'update_stage'
                                ? Layers
                                : item.id === 'create_task'
                                ? PhoneCall
                                : item.id === 'assign_owner'
                                ? UserCheck
                                : item.id === 'create_support_ticket'
                                ? CheckSquare
                                : BellRing;

                        return (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => handleSelectActionType(item.id)}
                                className={`w-full flex items-start gap-3.5 p-3.5 rounded-[14px] border text-left transition-all cursor-pointer ${
                                    isSelected
                                        ? 'bg-red-50/60 border-[var(--color-primary)] ring-2 ring-[#BD1D2D]/10 shadow-sm'
                                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                                }`}
                            >
                                <div
                                    className={`w-9 h-9 rounded-[var(--radius-md)] flex items-center justify-center shrink-0 transition-colors ${
                                        isSelected
                                            ? 'bg-[var(--color-primary)] text-white'
                                            : 'bg-slate-100 text-slate-500'
                                    }`}
                                >
                                    <IconComp className="w-4 h-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <span
                                            className={`text-xs font-black ${
                                                isSelected ? 'text-[var(--color-primary)]' : 'text-slate-800'
                                            }`}
                                        >
                                            {item.label}
                                        </span>
                                        {isSelected && (
                                            <span className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center shrink-0">
                                                <Check className="w-3 h-3 stroke-[3]" />
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-snug">
                                        {item.desc}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* 0A. ASSIGN ROUND-ROBIN CONFIG */}
            {actionType === 'assign_round_robin' && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Chọn Vòng chia / Team Sale đích
                        </label>
                        <select
                            value={config.roundId || config.team_id || ''}
                            onChange={e => {
                                const selectedTeam = crmTeams.find(t => t.value === e.target.value);
                                onChange({
                                    ...config,
                                    roundId: e.target.value,
                                    team_id: e.target.value,
                                    roundName: selectedTeam?.label || ''
                                });
                            }}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-bold text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                        >
                            <option value="">-- Tự động chọn Vòng chia phù hợp --</option>
                            {crmTeams.map(t => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <label className="flex items-start gap-3 p-3.5 rounded-[14px] bg-indigo-50/50 border border-indigo-200 cursor-pointer hover:bg-indigo-50 transition-colors">
                        <input
                            type="checkbox"
                            checked={config.respectShifts !== false}
                            onChange={e => onChange({ ...config, respectShifts: e.target.checked })}
                            className="mt-0.5 w-4 h-4 accent-[#BD1D2D] rounded cursor-pointer"
                        />
                        <div>
                            <div className="text-xs font-black text-slate-800">
                                Chỉ chia cho Tư vấn viên đang trong Ca trực & không nghỉ phép (Vacation Mode)
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                Hệ thống kiểm tra lịch trực hôm nay (`consultant_shifts`) và ưu tiên Sale nhận Lead lâu nhất (Round-Robin).
                            </div>
                        </div>
                    </label>

                    <label className="flex items-start gap-3 p-3.5 rounded-[14px] bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                        <input
                            type="checkbox"
                            checked={Boolean(config.onlyIfUnassigned ?? config.only_if_unassigned)}
                            onChange={e =>
                                onChange({
                                    ...config,
                                    onlyIfUnassigned: e.target.checked,
                                    only_if_unassigned: e.target.checked
                                })
                            }
                            className="mt-0.5 w-4 h-4 accent-[#BD1D2D] rounded cursor-pointer"
                        />
                        <div>
                            <div className="text-xs font-black text-slate-800">
                                Chỉ chia nếu Lead chưa có người phụ trách
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                Bỏ qua nếu hồ sơ đã được gán cho một Tư vấn viên trước đó.
                            </div>
                        </div>
                    </label>
                </div>
            )}

            {/* 0B. REASSIGN IF UNCONTACTED (SLA) CONFIG */}
            {actionType === 'reassign_if_uncontacted' && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Vòng chia / Team Sale điều phối lại
                        </label>
                        <select
                            value={config.roundId || config.team_id || ''}
                            onChange={e => {
                                const selectedTeam = crmTeams.find(t => t.value === e.target.value);
                                onChange({
                                    ...config,
                                    roundId: e.target.value,
                                    team_id: e.target.value,
                                    roundName: selectedTeam?.label || ''
                                });
                            }}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-bold text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                        >
                            <option value="">-- Giữ nguyên Vòng chia của Sale hiện tại --</option>
                            {crmTeams.map(t => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Lý do điều phối lại (Ghi nhận vào Log & Thông báo)
                        </label>
                        <input
                            type="text"
                            value={config.note || ''}
                            onChange={e => onChange({ ...config, note: e.target.value })}
                            placeholder="VD: Quá 2h chưa liên hệ - Tự động điều phối sang Sale khác"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-bold text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                        />
                    </div>

                    <div className="p-3.5 bg-rose-50/70 border border-rose-200 rounded-[14px] flex items-start gap-2.5 text-[11px] font-medium text-rose-800">
                        <RefreshCw className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <span>
                            Hệ thống sẽ tự động loại trừ Tư vấn viên cũ (chưa liên hệ đúng SLA), chọn Tư vấn viên kế tiếp trong ca trực theo chuẩn Round-Robin và gửi thông báo khẩn cho Sale mới.
                        </span>
                    </div>
                </div>
            )}

            {/* 0C. UPDATE TEMPERATURE & STATUS CONFIG */}
            {actionType === 'update_temperature' && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 shadow-sm animate-in fade-in duration-200">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Độ nóng của Lead (Temperature)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'hot', label: '🔥 Nóng (Hot)', icon: Flame, activeClass: 'bg-rose-50 border-rose-500 text-rose-700' },
                                { id: 'warm', label: '🌤️ Ấm (Warm)', icon: Thermometer, activeClass: 'bg-amber-50 border-amber-500 text-amber-700' },
                                { id: 'cold', label: '❄️ Lạnh (Cold)', icon: Snowflake, activeClass: 'bg-sky-50 border-sky-500 text-sky-700' }
                            ].map(temp => {
                                const Icon = temp.icon;
                                const active = (config.temperature || 'hot') === temp.id;
                                return (
                                    <button
                                        key={temp.id}
                                        type="button"
                                        onClick={() => onChange({ ...config, temperature: temp.id })}
                                        className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-[var(--radius-md)] border text-xs font-black transition-all cursor-pointer ${
                                            active
                                                ? `${temp.activeClass} shadow-sm`
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span>{temp.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Trạng thái chăm sóc Lead (Tùy chọn)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'active', label: 'Đang chăm sóc', sub: 'Active' },
                                { id: 'nurture', label: 'Nuôi dưỡng', sub: 'Nurture' },
                                { id: 'lost', label: 'Thất bại', sub: 'Lost' }
                            ].map(st => {
                                const currentSt = config.leadStatus || config.lead_status || 'active';
                                const active = currentSt === st.id;
                                return (
                                    <button
                                        key={st.id}
                                        type="button"
                                        onClick={() => onChange({ ...config, leadStatus: st.id, lead_status: st.id })}
                                        className={`p-2.5 rounded-[var(--radius-md)] border text-center transition-all cursor-pointer ${
                                            active
                                                ? 'bg-red-50 border-[var(--color-primary)] text-[var(--color-primary)] shadow-sm'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                                        }`}
                                    >
                                        <div className="text-xs font-black">{st.label}</div>
                                        <div className="text-[10px] opacity-75 font-bold">{st.sub}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* 1. UPDATE STAGE CONFIG */}
            {actionType === 'update_stage' && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-5 shadow-sm animate-in fade-in duration-200">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Giai đoạn Pipeline đích (Stage)
                        </label>
                        <select
                            value={config.stage_id || ''}
                            onChange={e => {
                                const selected = pipelineStages.find(s => s.value === e.target.value);
                                onChange({
                                    ...config,
                                    stage_id: e.target.value,
                                    stage_name: selected?.label || e.target.value
                                });
                            }}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-bold text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                        >
                            <option value="">-- Giữ nguyên giai đoạn hiện tại --</option>
                            {pipelineStages.map(st => (
                                <option key={st.value} value={st.value}>
                                    {st.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Trạng thái chăm sóc Lead (Lead Status)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'active', label: 'Đang chăm sóc', sub: 'Active', color: 'emerald' },
                                { id: 'nurture', label: 'Nuôi dưỡng', sub: 'Nurture', color: 'indigo' },
                                { id: 'lost', label: 'Thất bại', sub: 'Lost', color: 'rose' }
                            ].map(st => {
                                const active = (config.lead_status || 'active') === st.id;
                                return (
                                    <button
                                        key={st.id}
                                        type="button"
                                        onClick={() => onChange({ ...config, lead_status: st.id })}
                                        className={`p-2.5 rounded-[var(--radius-md)] border text-center transition-all cursor-pointer ${
                                            active
                                                ? 'bg-red-50 border-[var(--color-primary)] text-[var(--color-primary)] shadow-sm'
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                                        }`}
                                    >
                                        <div className="text-xs font-black">{st.label}</div>
                                        <div className="text-[10px] opacity-75 font-bold">{st.sub}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Độ nóng của Lead (Temperature)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'hot', label: 'Nóng (Hot)', icon: Flame, activeClass: 'bg-rose-50 border-rose-500 text-rose-700' },
                                { id: 'warm', label: 'Ấm (Warm)', icon: Thermometer, activeClass: 'bg-amber-50 border-amber-500 text-amber-700' },
                                { id: 'cold', label: 'Lạnh (Cold)', icon: Snowflake, activeClass: 'bg-sky-50 border-sky-500 text-sky-700' }
                            ].map(temp => {
                                const Icon = temp.icon;
                                const active = (config.temperature || 'warm') === temp.id;
                                return (
                                    <button
                                        key={temp.id}
                                        type="button"
                                        onClick={() => onChange({ ...config, temperature: temp.id })}
                                        className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-[var(--radius-md)] border text-xs font-black transition-all cursor-pointer ${
                                            active
                                                ? `${temp.activeClass} shadow-sm`
                                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                                        }`}
                                    >
                                        <Icon className="w-3.5 h-3.5" />
                                        <span>{temp.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* 2. CREATE TASK CONFIG */}
            {actionType === 'create_task' && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Phân loại hoạt động cho Sale
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                            <button
                                type="button"
                                onClick={() => onChange({ ...config, task_type: 'call' })}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-[var(--radius-md)] border text-xs font-black transition-all cursor-pointer ${
                                    (config.task_type || 'call') === 'call'
                                        ? 'bg-red-50 border-[var(--color-primary)] text-[var(--color-primary)] shadow-sm'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                                }`}
                            >
                                <PhoneCall className="w-4 h-4" />
                                <span>Lịch Gọi điện (Call)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => onChange({ ...config, task_type: 'task' })}
                                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-[var(--radius-md)] border text-xs font-black transition-all cursor-pointer ${
                                    config.task_type === 'task'
                                        ? 'bg-red-50 border-[var(--color-primary)] text-[var(--color-primary)] shadow-sm'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                                }`}
                            >
                                <CheckSquare className="w-4 h-4" />
                                <span>Công việc (Task)</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Tiêu đề công việc (Subject)
                            </label>
                            <div className="flex items-center gap-1">
                                {['{{full_name}}', '{{phone}}', '{{program}}'].map(tok => (
                                    <button
                                        key={tok}
                                        type="button"
                                        onClick={() => insertPlaceholder('subject', tok)}
                                        className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-[var(--color-primary)] rounded-[var(--radius-md)] transition-colors"
                                    >
                                        +{tok}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <input
                            type="text"
                            value={config.subject || ''}
                            onChange={e => onChange({ ...config, subject: e.target.value })}
                            placeholder="VD: Gọi tư vấn báo giá cho {{full_name}}"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-bold text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Ghi chú hướng dẫn cho Sale (Body)
                        </label>
                        <textarea
                            rows={3}
                            value={config.body || ''}
                            onChange={e => onChange({ ...config, body: e.target.value })}
                            placeholder="VD: Khách hàng đã mở email & bấm xem học bổng. Sale liên hệ tư vấn lộ trình chi tiết..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-medium text-slate-700 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Hạn hoàn thành (Sau X giờ kể từ lúc tạo)
                        </label>
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="number"
                                    min={1}
                                    max={720}
                                    value={config.due_in_hours ?? 24}
                                    onChange={e =>
                                        onChange({
                                            ...config,
                                            due_in_hours: Math.max(1, parseInt(e.target.value) || 1)
                                        })
                                    }
                                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-black text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                                />
                            </div>
                            <span className="text-xs font-bold text-slate-500">giờ</span>
                            {[2, 4, 24, 48].map(hr => (
                                <button
                                    key={hr}
                                    type="button"
                                    onClick={() => onChange({ ...config, due_in_hours: hr })}
                                    className={`px-2.5 py-2 rounded-[var(--radius-md)] text-[11px] font-black border transition-all cursor-pointer ${
                                        Number(config.due_in_hours ?? 24) === hr
                                            ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)]'
                                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white'
                                    }`}
                                >
                                    {hr}h
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. ASSIGN OWNER CONFIG */}
            {actionType === 'assign_owner' && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Tư vấn viên phụ trách (Sale Consultant)
                        </label>
                        {crmUsers.length > 0 && (
                            <select
                                value={config.owner_id || ''}
                                onChange={e => {
                                    const found = crmUsers.find(u => u.value === e.target.value);
                                    onChange({
                                        ...config,
                                        owner_id: e.target.value,
                                        owner_name: found?.label || e.target.value
                                    });
                                }}
                                className="w-full px-3.5 py-2.5 mb-2 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-bold text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                            >
                                <option value="">-- Chọn Tư vấn viên trong hệ thống --</option>
                                {crmUsers.map(u => (
                                    <option key={u.value} value={u.value}>
                                        {u.label}
                                    </option>
                                ))}
                            </select>
                        )}
                        <input
                            type="text"
                            value={config.owner_id || ''}
                            onChange={e => onChange({ ...config, owner_id: e.target.value })}
                            placeholder="Nhập ID hoặc Username của tư vấn viên..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-bold text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                        />
                    </div>

                    <label className="flex items-start gap-3 p-3.5 rounded-[14px] bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100/70 transition-colors">
                        <input
                            type="checkbox"
                            checked={config.only_if_unassigned !== false}
                            onChange={e =>
                                onChange({ ...config, only_if_unassigned: e.target.checked })
                            }
                            className="mt-0.5 w-4 h-4 accent-[#BD1D2D] rounded cursor-pointer"
                        />
                        <div>
                            <div className="text-xs font-black text-slate-800">
                                Chỉ phân bổ nếu Lead chưa có Sale phụ trách
                            </div>
                            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                Bảo vệ quyền sở hữu Lead hiện tại, không ghi đè Sale đang chăm sóc.
                            </div>
                        </div>
                    </label>
                </div>
            )}

            {/* 4. NOTIFY OWNER CONFIG */}
            {actionType === 'notify_owner' && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Nội dung thông báo gửi cho Sale phụ trách
                            </label>
                            <div className="flex items-center gap-1">
                                {['{{full_name}}', '{{phone}}', '{{email}}'].map(tok => (
                                    <button
                                        key={tok}
                                        type="button"
                                        onClick={() => insertPlaceholder('message', tok)}
                                        className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-[var(--color-primary)] rounded-[var(--radius-md)] transition-colors"
                                    >
                                        +{tok}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <textarea
                            rows={4}
                            value={config.message ?? config.body ?? ''}
                            onChange={e =>
                                onChange({
                                    ...config,
                                    message: e.target.value,
                                    body: e.target.value
                                })
                            }
                            placeholder="VD: Lead {{full_name}} ({{phone}}) vừa tương tác chiến dịch. Hãy gọi tư vấn ngay!"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-medium text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all resize-none"
                        />
                    </div>

                    <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-[14px] flex items-center gap-2.5 text-[11px] font-medium text-amber-800">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                            Thông báo sẽ được gửi tới Tư vấn viên đang phụ trách hồ sơ này trên chuông thông báo MYERP.
                        </span>
                    </div>
                </div>
            )}

            {/* 5. CREATE SUPPORT TICKET CONFIG */}
            {actionType === 'create_support_ticket' && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                Tiêu đề Ticket hỗ trợ (Subject)
                            </label>
                            <div className="flex items-center gap-1 flex-wrap">
                                {['{{full_name}}', '{{student_code}}', '{{class_name}}', '{{tuition_remaining}}'].map(tok => (
                                    <button
                                        key={tok}
                                        type="button"
                                        onClick={() => insertPlaceholder('ticket_subject', tok)}
                                        className="px-1.5 py-0.5 text-[10px] font-bold bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-[var(--color-primary)] rounded-[var(--radius-md)] transition-colors"
                                    >
                                        +{tok}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <input
                            type="text"
                            value={config.ticket_subject ?? config.subject ?? ''}
                            onChange={e =>
                                onChange({
                                    ...config,
                                    ticket_subject: e.target.value,
                                    subject: e.target.value
                                })
                            }
                            placeholder="VD: Hỗ trợ học viên {{full_name}} ({{student_code}}) - Lớp {{class_name}}"
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-bold text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Nội dung chi tiết / Yêu cầu xử lý (Description)
                        </label>
                        <textarea
                            rows={3}
                            value={config.ticket_description ?? config.description ?? ''}
                            onChange={e =>
                                onChange({
                                    ...config,
                                    ticket_description: e.target.value,
                                    description: e.target.value
                                })
                            }
                            placeholder="VD: Học viên {{full_name}} có dư nợ học phí {{tuition_remaining}} hoặc cần phòng Học vụ liên hệ hỗ trợ..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-medium text-slate-700 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all resize-none"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                Mức độ ưu tiên (Priority)
                            </label>
                            <select
                                value={config.priority || 'medium'}
                                onChange={e => onChange({ ...config, priority: e.target.value })}
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-bold text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                            >
                                <option value="low">Thấp (Low)</option>
                                <option value="medium">Trung bình (Medium)</option>
                                <option value="high">Cao (High)</option>
                                <option value="urgent">Khẩn cấp (Urgent)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                                Hạn xử lý SLA (Giờ)
                            </label>
                            <input
                                type="number"
                                min={1}
                                max={720}
                                value={config.due_in_hours ?? 24}
                                onChange={e =>
                                    onChange({
                                        ...config,
                                        due_in_hours: Math.max(1, parseInt(e.target.value) || 24)
                                    })
                                }
                                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-black text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Người xử lý Ticket (Assignee - Để trống sẽ gán cho Sale phụ trách)
                        </label>
                        {crmUsers.length > 0 ? (
                            <select
                                value={config.assignee_id || ''}
                                onChange={e => onChange({ ...config, assignee_id: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-bold text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                            >
                                <option value="">-- Tự động gán cho Sale / Cố vấn phụ trách hồ sơ --</option>
                                {crmUsers.map(u => (
                                    <option key={u.value} value={u.value}>
                                        {u.label}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={config.assignee_id || ''}
                                onChange={e => onChange({ ...config, assignee_id: e.target.value })}
                                placeholder="Nhập ID nhân sự xử lý (Để trống = Sale phụ trách)..."
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-xs font-bold text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CrmActionConfig;

