import React, { useState, useEffect, useRef } from 'react';
import {
    Plus, Trash2, GitMerge, ChevronRight, Sparkles, Tag, ChevronDown, Check,
    Layers, Search, User, Briefcase, Activity
} from 'lucide-react';
import { api } from '../../../services/storageAdapter';
import erpApi from '../../../../../api/axios';
import {
    ADVANCED_CONDITION_FIELD_GROUPS,
    ADVANCED_CONDITION_FIELDS,
    OPERATORS_BY_TYPE,
    STANDARD_PIPELINE_STAGES,
    type ConditionFieldOption
} from '../../../constants/flowConstants';

export interface ConditionRule {
    id?: string;
    field: string;
    operator: string;
    value: any;
    targetField?: string;
}

export interface ConditionGroup {
    id?: string;
    logic: 'AND' | 'OR';
    conditions: (ConditionRule | ConditionGroup)[];
    matchType?: 'all' | 'any';
    rules?: ConditionRule[];
}

export interface AdvancedConditionBranch {
    id: string;
    label: string;
    name?: string;
    conditionGroup: ConditionGroup;
    logic?: 'AND' | 'OR';
    matchType?: 'all' | 'any';
    groups?: ConditionGroup[];
    rules?: ConditionRule[];
    nextStepId?: string;
    stepId?: string;
}

interface AdvancedConditionConfigProps {
    config: Record<string, any>;
    onChange: (newConfig: Record<string, any>) => void;
    availableTags?: string[];
    flow?: any;
    stepId?: string;
    disabled?: boolean;
}

const CustomSelect = ({
    value,
    onChange,
    options,
    placeholder = 'Chọn...',
    icon: Icon,
    className = ''
}: {
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    icon?: any;
    className?: string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => String(o.value) === String(value));
    const filteredOptions = searchQuery.trim()
        ? options.filter(
              o =>
                  o.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  String(o.value).toLowerCase().includes(searchQuery.toLowerCase())
          )
        : options;

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between gap-2 bg-white border ${
                    isOpen
                        ? 'border-[var(--color-primary)] ring-2 ring-[#BD1D2D]/10'
                        : 'border-slate-200 hover:border-slate-300'
                } rounded-[var(--radius-md)] px-3 py-2 text-xs font-bold text-slate-700 transition-all shadow-sm`}
            >
                <div className="flex items-center gap-2 truncate">
                    {Icon && (
                        <Icon
                            className={`w-3.5 h-3.5 shrink-0 ${
                                isOpen ? 'text-[var(--color-primary)]' : 'text-slate-400'
                            }`}
                        />
                    )}
                    <span className={selectedOption ? 'text-slate-800 truncate' : 'text-slate-400 truncate'}>
                        {selectedOption ? selectedOption.label : value || placeholder}
                    </span>
                </div>
                <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180 text-[var(--color-primary)]' : ''
                    }`}
                />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-[14px] shadow-xl z-[80] max-h-64 overflow-y-auto custom-scrollbar p-1.5 animate-in fade-in zoom-in-95 duration-150 min-w-[210px]">
                    {options.length > 6 && (
                        <div className="px-2 pb-1.5 mb-1 border-b border-slate-100">
                            <div className="relative">
                                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Tìm nhanh..."
                                    className="w-full pl-7 pr-2 py-1 text-[11px] bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] outline-none focus:border-[var(--color-primary)] font-medium text-slate-700"
                                />
                            </div>
                        </div>
                    )}
                    {filteredOptions.length === 0 ? (
                        <div className="p-3 text-center text-[10px] text-slate-400 italic">Không có dữ liệu phù hợp</div>
                    ) : (
                        filteredOptions.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => {
                                    onChange(opt.value);
                                    setIsOpen(false);
                                    setSearchQuery('');
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] text-left text-xs font-bold transition-colors ${
                                    String(value) === String(opt.value)
                                        ? 'bg-red-50 text-[var(--color-primary)]'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`}
                            >
                                <span className="truncate">{opt.label}</span>
                                {String(value) === String(opt.value) && (
                                    <Check className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 ml-2" />
                                )}
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const GroupedFieldSelect = ({
    value,
    onChange
}: {
    value: string;
    onChange: (val: string) => void;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedField =
        ADVANCED_CONDITION_FIELDS.find(f => f.value === value) || ADVANCED_CONDITION_FIELDS[0];

    const getGroupIcon = (groupId: string) => {
        if (groupId === 'crm_pipeline' || groupId === 'erp_academic') return Briefcase;
        if (groupId === 'behavior') return Activity;
        return User;
    };

    const GroupIcon = getGroupIcon(selectedField?.group || 'profile');

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between gap-2 bg-white border ${
                    isOpen
                        ? 'border-[var(--color-primary)] ring-2 ring-[#BD1D2D]/10'
                        : 'border-slate-200 hover:border-slate-300'
                } rounded-[var(--radius-md)] px-3 py-2 text-xs font-bold text-slate-700 transition-all shadow-sm`}
            >
                <div className="flex items-center gap-2 truncate">
                    <GroupIcon
                        className={`w-3.5 h-3.5 shrink-0 ${
                            isOpen ? 'text-[var(--color-primary)]' : 'text-slate-400'
                        }`}
                    />
                    <span className="text-slate-800 truncate">{selectedField?.label || value}</span>
                </div>
                <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
                        isOpen ? 'rotate-180 text-[var(--color-primary)]' : ''
                    }`}
                />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-[14px] shadow-xl z-[85] max-h-80 overflow-y-auto custom-scrollbar p-2 animate-in fade-in zoom-in-95 duration-150 min-w-[270px]">
                    <div className="px-1.5 pb-2 mb-1.5 border-b border-slate-100 sticky top-0 bg-white z-10">
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Tìm trường Hồ sơ, Pipeline CRM, Đa kênh..."
                                className="w-full pl-8 pr-2.5 py-1.5 text-[11px] bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] outline-none focus:border-[var(--color-primary)] font-medium text-slate-700"
                            />
                        </div>
                    </div>

                    {ADVANCED_CONDITION_FIELD_GROUPS.map(group => {
                        const filteredFields = searchQuery.trim()
                            ? group.fields.filter(
                                  f =>
                                      f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                      f.value.toLowerCase().includes(searchQuery.toLowerCase())
                              )
                            : group.fields;

                        if (filteredFields.length === 0) return null;

                        const IconComp = getGroupIcon(group.id);

                        return (
                            <div key={group.id} className="mb-2 last:mb-0">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/80 rounded-[var(--radius-md)] mb-1">
                                    <IconComp className="w-3 h-3 text-[var(--color-primary)]" />
                                    <span>{group.label}</span>
                                </div>
                                <div className="space-y-0.5">
                                    {filteredFields.map(field => (
                                        <button
                                            key={field.value}
                                            type="button"
                                            onClick={() => {
                                                onChange(field.value);
                                                setIsOpen(false);
                                                setSearchQuery('');
                                            }}
                                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-[var(--radius-md)] text-left text-xs font-bold transition-colors ${
                                                value === field.value
                                                    ? 'bg-red-50 text-[var(--color-primary)]'
                                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                            }`}
                                        >
                                            <span className="truncate">{field.label}</span>
                                            {value === field.value && (
                                                <Check className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0 ml-2" />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export const AdvancedConditionConfig: React.FC<AdvancedConditionConfigProps> = ({
    config,
    onChange,
    availableTags: propTags
}) => {
    const branches: AdvancedConditionBranch[] = config.branches || [];
    const [activeBranchIdx, setActiveBranchIdx] = useState<number>(0);
    const [internalTags, setInternalTags] = useState<string[]>([]);
    const [pipelineStages, setPipelineStages] = useState<Array<{ value: string; label: string }>>(
        STANDARD_PIPELINE_STAGES
    );
    const [crmUsers, setCrmUsers] = useState<Array<{ value: string; label: string }>>([]);
    const [crmTeams, setCrmTeams] = useState<Array<{ value: string; label: string }>>([]);
    const [crmBranches, setCrmBranches] = useState<Array<{ value: string; label: string }>>([]);
    const [erpClasses, setErpClasses] = useState<Array<{ value: string; label: string }>>([]);

    const displayTags = propTags && propTags.length > 0 ? propTags : internalTags;

    useEffect(() => {
        if (!propTags || propTags.length === 0) {
            const fetchTags = async () => {
                try {
                    const res = await api.get<any[]>('/tags');
                    if (res.success && Array.isArray(res.data)) {
                        setInternalTags(res.data.map((t: any) => t.name || String(t)));
                    }
                } catch {
                    // Silent fallback
                }
            };
            fetchTags();
        }
    }, [propTags]);

    useEffect(() => {
        const controller = new AbortController();

        const fetchCrmMeta = async () => {
            try {
                const stageRes = await erpApi.get('/pipeline-stages', { signal: controller.signal });
                const rawStages = stageRes?.data?.data || stageRes?.data || [];
                if (Array.isArray(rawStages) && rawStages.length > 0) {
                    const mappedStages: Array<{ value: string; label: string }> = [];
                    rawStages.forEach((st: any) => {
                        const id = String(st.id ?? st.stage_id ?? '');
                        const name = String(st.name ?? st.stage_name ?? st.title ?? '');
                        if (id && name) {
                            mappedStages.push({
                                value: id,
                                label: `${name} (#${id})`
                            });
                            mappedStages.push({
                                value: name,
                                label: `Theo tên: ${name}`
                            });
                        }
                    });
                    if (mappedStages.length > 0) {
                        setPipelineStages(mappedStages);
                    }
                }
            } catch (err: any) {
                if (err?.name !== 'AbortError' && err?.name !== 'CanceledError') {
                    // Fallback to STANDARD_PIPELINE_STAGES already in state
                }
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
                // Keep empty array, user can still type salesperson name or ID
            }

            try {
                const teamRes = await erpApi.get('/teams', { signal: controller.signal });
                const rawTeams = teamRes?.data?.data || teamRes?.data || [];
                if (Array.isArray(rawTeams) && rawTeams.length > 0) {
                    const mappedTeams = rawTeams
                        .filter((t: any) => t && (t.id || t.name || t.team_name))
                        .map((t: any) => ({
                            value: String(t.id ?? t.name),
                            label: String(t.name ?? t.team_name ?? `Vòng chia #${t.id}`)
                        }));
                    if (mappedTeams.length > 0) {
                        setCrmTeams(mappedTeams);
                    }
                }
            } catch {
                // Silent fallback
            }

            try {
                const branchRes = await erpApi.get('/branches', { signal: controller.signal });
                const rawBranches = branchRes?.data?.data || branchRes?.data || [];
                if (Array.isArray(rawBranches) && rawBranches.length > 0) {
                    const mappedBranches = rawBranches
                        .filter((b: any) => b && (b.id || b.name || b.branch_name))
                        .map((b: any) => ({
                            value: String(b.id ?? b.name),
                            label: String(b.name ?? b.branch_name ?? `Chi nhánh #${b.id}`)
                        }));
                    if (mappedBranches.length > 0) {
                        setCrmBranches(mappedBranches);
                    }
                }
            } catch {
                // Silent fallback
            }

            try {
                let rawClasses: any[] = [];
                try {
                    const classRes = await erpApi.get('/classes', { signal: controller.signal });
                    rawClasses = classRes?.data?.data || classRes?.data || [];
                } catch {
                    const projRes = await erpApi.get('/projects', { signal: controller.signal });
                    rawClasses = projRes?.data?.data || projRes?.data || [];
                }
                if (Array.isArray(rawClasses) && rawClasses.length > 0) {
                    const mappedClasses = rawClasses
                        .filter((cl: any) => cl && (cl.id || cl.name || cl.code))
                        .map((cl: any) => ({
                            value: String(cl.id ?? cl.code ?? cl.name),
                            label: cl.code && cl.name ? `${cl.code} - ${cl.name}` : String(cl.name || cl.code || `Lớp #${cl.id}`)
                        }));
                    if (mappedClasses.length > 0) {
                        setErpClasses(mappedClasses);
                    }
                }
            } catch {
                // Silent fallback
            }
        };

        fetchCrmMeta();
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (branches.length === 0) {
            const defaultBranches: AdvancedConditionBranch[] = [
                {
                    id: `br-${Date.now()}-1`,
                    label: 'Nhánh 1',
                    name: 'Nhánh 1',
                    conditionGroup: {
                        logic: 'AND',
                        conditions: [{ field: 'crm_stage_id', operator: 'equals', value: '1' }]
                    }
                }
            ];
            onChange({ ...config, branches: defaultBranches });
        }
    }, []);

    const updateBranches = (newBranches: AdvancedConditionBranch[]) => {
        onChange({ ...config, branches: newBranches });
    };

    const applySmartPreset = (presetId: 'temperature' | 'team' | 'channel' | 'deposit') => {
        const now = Date.now();
        let nextBranches: AdvancedConditionBranch[] = [];

        if (presetId === 'temperature') {
            nextBranches = [
                {
                    id: `br-${now}-1`,
                    label: 'Nhánh 1: Lead Nóng (Hot)',
                    name: 'Nhánh 1: Lead Nóng (Hot)',
                    conditionGroup: {
                        logic: 'AND',
                        conditions: [{ field: 'crm_temperature', operator: 'equals', value: 'hot' }]
                    }
                },
                {
                    id: `br-${now}-2`,
                    label: 'Nhánh 2: Lead Ấm (Warm)',
                    name: 'Nhánh 2: Lead Ấm (Warm)',
                    conditionGroup: {
                        logic: 'AND',
                        conditions: [{ field: 'crm_temperature', operator: 'equals', value: 'warm' }]
                    }
                }
            ];
        } else if (presetId === 'team') {
            const topTeams = crmTeams.length > 0
                ? crmTeams.slice(0, 3)
                : [
                    { value: '1', label: 'Vòng chia Team Sale 1' },
                    { value: '2', label: 'Vòng chia Team Sale 2' }
                ];
            nextBranches = topTeams.map((tm, idx) => ({
                id: `br-${now}-${idx + 1}`,
                label: `Vòng chia: ${tm.label}`,
                name: `Vòng chia: ${tm.label}`,
                conditionGroup: {
                    logic: 'AND',
                    conditions: [{ field: 'crm_team_id', operator: 'equals', value: tm.value }]
                }
            }));
        } else if (presetId === 'channel') {
            nextBranches = [
                {
                    id: `br-${now}-1`,
                    label: 'Có Zalo / SĐT',
                    name: 'Có Zalo / SĐT',
                    conditionGroup: {
                        logic: 'AND',
                        conditions: [{ field: 'channel_available', operator: 'equals', value: 'zalo_oa' }]
                    }
                },
                {
                    id: `br-${now}-2`,
                    label: 'Chỉ có Email',
                    name: 'Chỉ có Email',
                    conditionGroup: {
                        logic: 'AND',
                        conditions: [{ field: 'channel_available', operator: 'equals', value: 'email_valid' }]
                    }
                }
            ];
        } else if (presetId === 'deposit') {
            nextBranches = [
                {
                    id: `br-${now}-1`,
                    label: 'Đã đặt cọc (Approved)',
                    name: 'Đã đặt cọc (Approved)',
                    conditionGroup: {
                        logic: 'AND',
                        conditions: [{ field: 'crm_deposit_status', operator: 'equals', value: 'approved' }]
                    }
                },
                {
                    id: `br-${now}-2`,
                    label: 'Đang chờ duyệt cọc (Pending)',
                    name: 'Đang chờ duyệt cọc (Pending)',
                    conditionGroup: {
                        logic: 'AND',
                        conditions: [{ field: 'crm_deposit_status', operator: 'equals', value: 'pending' }]
                    }
                }
            ];
        }

        if (nextBranches.length > 0) {
            updateBranches(nextBranches);
            setActiveBranchIdx(0);
        }
    };

    const addBranch = () => {
        if (branches.length >= 8) return;
        const label = `Nhánh ${branches.length + 1}`;
        const newBranch: AdvancedConditionBranch = {
            id: `br-${Date.now()}`,
            label,
            name: label,
            conditionGroup: {
                logic: 'AND',
                conditions: [{ field: 'crm_lead_status', operator: 'equals', value: 'active' }]
            }
        };
        const updated = [...branches, newBranch];
        updateBranches(updated);
        setActiveBranchIdx(updated.length - 1);
    };

    const removeBranch = (idx: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (branches.length <= 1) return;
        const updated = branches.filter((_, i) => i !== idx);
        updateBranches(updated);
        if (activeBranchIdx >= updated.length) {
            setActiveBranchIdx(Math.max(0, updated.length - 1));
        }
    };

    const activeBranch = branches[activeBranchIdx];

    const updateActiveBranch = (updates: Partial<AdvancedConditionBranch>) => {
        if (!activeBranch) return;
        if (updates.label !== undefined && updates.name === undefined) {
            updates.name = updates.label;
        }
        const updated = branches.map((b, i) => (i === activeBranchIdx ? { ...b, ...updates } : b));
        updateBranches(updated);
    };

    const updateGroup = (newGroup: ConditionGroup) => {
        updateActiveBranch({ conditionGroup: newGroup });
    };

    const getFieldDef = (fieldName: string): ConditionFieldOption => {
        return (
            ADVANCED_CONDITION_FIELDS.find(f => f.value === fieldName) ||
            ADVANCED_CONDITION_FIELDS[0]
        );
    };

    const renderConditionGroup = (
        group: ConditionGroup,
        onUpdateGroup: (g: ConditionGroup) => void,
        depth = 0
    ) => {
        const handleLogicToggle = () => {
            onUpdateGroup({ ...group, logic: group.logic === 'AND' ? 'OR' : 'AND' });
        };

        const addRule = () => {
            const newRule: ConditionRule = {
                field: 'crm_stage_id',
                operator: 'equals',
                value: pipelineStages[0]?.value || '1'
            };
            onUpdateGroup({ ...group, conditions: [...group.conditions, newRule] });
        };

        const addSubGroup = () => {
            if (depth >= 1) return;
            const newSubGroup: ConditionGroup = {
                logic: 'OR',
                conditions: [{ field: 'tag', operator: 'has_tag', value: '' }]
            };
            onUpdateGroup({ ...group, conditions: [...group.conditions, newSubGroup] });
        };

        const removeItem = (idx: number) => {
            if (group.conditions.length <= 1 && depth === 0) return;
            const newConds = group.conditions.filter((_, i) => i !== idx);
            onUpdateGroup({ ...group, conditions: newConds });
        };

        const updateItem = (idx: number, newItem: ConditionRule | ConditionGroup) => {
            const newConds = group.conditions.map((c, i) => (i === idx ? newItem : c));
            onUpdateGroup({ ...group, conditions: newConds });
        };

        const renderValueInput = (rule: ConditionRule, idx: number, fieldDef: ConditionFieldOption) => {
            const noValueOperators = ['is_empty', 'is_not_empty', 'is_true', 'is_false', 'is_today', 'is_this_month'];
            if (noValueOperators.includes(rule.operator)) {
                return null;
            }

            if (fieldDef.value === 'crm_team_id') {
                return (
                    <div className="mt-2 space-y-1.5 animate-in fade-in duration-200">
                        {crmTeams.length > 0 && (
                            <CustomSelect
                                value={rule.value}
                                onChange={val => updateItem(idx, { ...rule, value: val })}
                                options={crmTeams}
                                placeholder="-- Chọn Vòng chia / Team Sale --"
                                icon={Briefcase}
                            />
                        )}
                        <input
                            type="text"
                            value={rule.value || ''}
                            onChange={e => updateItem(idx, { ...rule, value: e.target.value })}
                            placeholder="Hoặc nhập ID / Tên Vòng chia (Team Sale)..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:bg-white focus:border-[var(--color-primary)] transition-all"
                        />
                    </div>
                );
            }

            if (fieldDef.value === 'crm_branch_id') {
                return (
                    <div className="mt-2 space-y-1.5 animate-in fade-in duration-200">
                        {crmBranches.length > 0 && (
                            <CustomSelect
                                value={rule.value}
                                onChange={val => updateItem(idx, { ...rule, value: val })}
                                options={crmBranches}
                                placeholder="-- Chọn Chi nhánh / Cơ sở MYERP --"
                                icon={Briefcase}
                            />
                        )}
                        <input
                            type="text"
                            value={rule.value || ''}
                            onChange={e => updateItem(idx, { ...rule, value: e.target.value })}
                            placeholder="Hoặc nhập ID / Tên Chi nhánh..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:bg-white focus:border-[var(--color-primary)] transition-all"
                        />
                    </div>
                );
            }

            if (fieldDef.value === 'erp_class_id') {
                return (
                    <div className="mt-2 space-y-1.5 animate-in fade-in duration-200">
                        {erpClasses.length > 0 && (
                            <CustomSelect
                                value={rule.value}
                                onChange={val => updateItem(idx, { ...rule, value: val })}
                                options={erpClasses}
                                placeholder="-- Chọn Lớp đào tạo MYERP --"
                                icon={Briefcase}
                            />
                        )}
                        <input
                            type="text"
                            value={rule.value || ''}
                            onChange={e => updateItem(idx, { ...rule, value: e.target.value })}
                            placeholder="Hoặc nhập ID / Mã lớp / Tên lớp đào tạo..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:bg-white focus:border-[var(--color-primary)] transition-all"
                        />
                    </div>
                );
            }

            if (fieldDef.type === 'tag') {
                return (
                    <div className="mt-2 animate-in fade-in duration-200">
                        <CustomSelect
                            value={rule.value}
                            onChange={val => updateItem(idx, { ...rule, value: val })}
                            options={displayTags.map(t => ({ value: t, label: `#${t}` }))}
                            placeholder="-- Chọn nhãn Tag ERP / Marketing --"
                            icon={Tag}
                        />
                        <input
                            type="text"
                            value={rule.value || ''}
                            onChange={e => updateItem(idx, { ...rule, value: e.target.value })}
                            placeholder="Hoặc nhập tên nhãn Tag trực tiếp..."
                            className="mt-1.5 w-full bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:bg-white focus:border-[var(--color-primary)] transition-all"
                        />
                    </div>
                );
            }

            if (fieldDef.type === 'stage') {
                return (
                    <div className="mt-2 space-y-1.5 animate-in fade-in duration-200">
                        <CustomSelect
                            value={rule.value}
                            onChange={val => updateItem(idx, { ...rule, value: val })}
                            options={pipelineStages}
                            placeholder="-- Chọn Giai đoạn Pipeline CRM --"
                            icon={Briefcase}
                        />
                        <input
                            type="text"
                            value={rule.value || ''}
                            onChange={e => updateItem(idx, { ...rule, value: e.target.value })}
                            placeholder="Hoặc nhập ID giai đoạn / tên giai đoạn (VD: Đặt cọc, Qualified)..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] px-3 py-1.5 text-[11px] font-bold text-slate-700 outline-none focus:bg-white focus:border-[var(--color-primary)] transition-all"
                        />
                    </div>
                );
            }

            if (fieldDef.type === 'owner') {
                return (
                    <div className="mt-2 space-y-1.5 animate-in fade-in duration-200">
                        {crmUsers.length > 0 && (
                            <CustomSelect
                                value={rule.value}
                                onChange={val => updateItem(idx, { ...rule, value: val })}
                                options={crmUsers}
                                placeholder="-- Chọn Tư vấn viên phụ trách --"
                                icon={User}
                            />
                        )}
                        <input
                            type="text"
                            value={rule.value || ''}
                            onChange={e => updateItem(idx, { ...rule, value: e.target.value })}
                            placeholder={fieldDef.placeholder || 'Nhập ID hoặc tên Sale phụ trách...'}
                            className="w-full bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:bg-white focus:border-[var(--color-primary)] transition-all"
                        />
                    </div>
                );
            }

            if (fieldDef.type === 'select' || fieldDef.type === 'activity') {
                const normalizedOptions = (fieldDef.options || []).map(o =>
                    typeof o === 'string' ? { value: o, label: o } : o
                );
                return (
                    <div className="mt-2 animate-in fade-in duration-200">
                        <CustomSelect
                            value={rule.value}
                            onChange={val => updateItem(idx, { ...rule, value: val })}
                            options={normalizedOptions}
                            placeholder="-- Chọn giá trị --"
                        />
                    </div>
                );
            }

            if (fieldDef.type === 'date') {
                if (rule.operator === 'before_days') {
                    return (
                        <div className="mt-2 flex items-center gap-2 animate-in fade-in duration-200">
                            <input
                                type="number"
                                min={0}
                                value={rule.value || ''}
                                onChange={e => updateItem(idx, { ...rule, value: e.target.value })}
                                placeholder="Nhập số ngày (VD: 7, 30, 365)..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-[var(--color-primary)] transition-all"
                            />
                            <span className="text-[11px] font-bold text-slate-500 shrink-0">ngày trước</span>
                        </div>
                    );
                }
                return (
                    <div className="mt-2 animate-in fade-in duration-200">
                        <input
                            type="date"
                            value={rule.value || ''}
                            onChange={e => updateItem(idx, { ...rule, value: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-[var(--color-primary)] transition-all"
                        />
                    </div>
                );
            }

            return (
                <div className="mt-2 animate-in fade-in duration-200">
                    <input
                        type={fieldDef.type === 'number' ? 'number' : 'text'}
                        value={rule.value || ''}
                        onChange={e => updateItem(idx, { ...rule, value: e.target.value })}
                        placeholder={fieldDef.placeholder || 'Nhập giá trị so sánh...'}
                        className="w-full bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:bg-white focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[#BD1D2D]/10 transition-all placeholder:text-slate-400"
                    />
                </div>
            );
        };

        return (
            <div
                className={`relative rounded-[14px] border transition-all ${
                    depth === 0
                        ? 'bg-slate-50/70 border-slate-200 p-4'
                        : 'bg-white border-indigo-100 p-3.5 mt-3 ml-4 shadow-sm'
                }`}
            >
                {depth > 0 && <div className="absolute -left-4 top-6 w-4 h-0.5 bg-indigo-200" />}

                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleLogicToggle}
                            className={`px-3 py-1 rounded-[var(--radius-md)] text-[10px] font-black uppercase tracking-wider transition-all shadow-sm flex items-center gap-1.5 cursor-pointer border ${
                                group.logic === 'AND'
                                    ? 'bg-red-50 text-[var(--color-primary)] border-red-200 hover:bg-red-100'
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                            }`}
                        >
                            <Layers className="w-3 h-3" />
                            {group.logic === 'AND' ? 'Thỏa mãn TẤT CẢ (AND)' : 'Thỏa mãn BẤT KỲ (OR)'}
                        </button>
                        <span className="text-[10px] text-slate-400 font-bold">
                            {group.logic === 'AND' ? 'Mọi điều kiện phải đúng' : 'Chỉ cần 1 điều kiện đúng'}
                        </span>
                    </div>

                    {depth > 0 && (
                        <button
                            type="button"
                            onClick={() => onUpdateGroup(null as any)}
                            className="text-slate-400 hover:text-rose-500 p-1 rounded-[var(--radius-md)] hover:bg-rose-50 transition-colors"
                            title="Xóa nhóm này"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <div className="space-y-3 relative">
                    {group.conditions.length > 1 && (
                        <div
                            className={`absolute left-2.5 top-4 bottom-4 w-0.5 ${
                                group.logic === 'AND' ? 'bg-red-200' : 'bg-indigo-200'
                            } -z-0`}
                        />
                    )}

                    {group.conditions.map((item, idx) => {
                        const isGroup = 'logic' in item;

                        if (isGroup) {
                            return (
                                <div key={idx} className="relative z-10">
                                    {renderConditionGroup(
                                        item as ConditionGroup,
                                        updatedSubGroup => {
                                            if (!updatedSubGroup) removeItem(idx);
                                            else updateItem(idx, updatedSubGroup);
                                        },
                                        depth + 1
                                    )}
                                </div>
                            );
                        }

                        const rule = item as ConditionRule;
                        const fieldDef = getFieldDef(rule.field);
                        const operators = OPERATORS_BY_TYPE[fieldDef.type] || OPERATORS_BY_TYPE.text;

                        const handleFieldChange = (newFieldVal: string) => {
                            const newDef = getFieldDef(newFieldVal);
                            const newOps = OPERATORS_BY_TYPE[newDef.type] || OPERATORS_BY_TYPE.text;
                            let defaultVal = '';
                            if (newDef.type === 'stage') {
                                defaultVal = pipelineStages[0]?.value || '1';
                            } else if (newDef.options && newDef.options.length > 0) {
                                const firstOpt = newDef.options[0];
                                defaultVal = typeof firstOpt === 'string' ? firstOpt : firstOpt.value;
                            }
                            updateItem(idx, {
                                field: newFieldVal,
                                operator: newOps[0].value,
                                value: defaultVal
                            });
                        };

                        return (
                            <div
                                key={idx}
                                className="relative z-10 flex items-start gap-2 bg-white p-3.5 rounded-[14px] border border-slate-200 shadow-sm hover:border-slate-300 transition-all group"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                        <div className="sm:col-span-7">
                                            <GroupedFieldSelect
                                                value={rule.field}
                                                onChange={handleFieldChange}
                                            />
                                        </div>
                                        <div className="sm:col-span-5">
                                            <CustomSelect
                                                value={rule.operator}
                                                onChange={val =>
                                                    updateItem(idx, { ...rule, operator: val })
                                                }
                                                options={operators}
                                            />
                                        </div>
                                    </div>

                                    {renderValueInput(rule, idx, fieldDef)}
                                </div>

                                {(group.conditions.length > 1 || depth > 0) && (
                                    <button
                                        type="button"
                                        onClick={() => removeItem(idx)}
                                        className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-[var(--radius-md)] transition-all opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2 mt-3 pt-2">
                    <button
                        type="button"
                        onClick={addRule}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:border-[var(--color-primary)] text-slate-600 hover:text-[var(--color-primary)] rounded-[var(--radius-md)] text-[11px] font-bold transition-all shadow-sm"
                    >
                        <Plus className="w-3.5 h-3.5" /> Thêm điều kiện
                    </button>
                    {depth < 1 && (
                        <button
                            type="button"
                            onClick={addSubGroup}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-dashed border-indigo-200 hover:border-indigo-400 text-indigo-600 rounded-[var(--radius-md)] text-[11px] font-bold transition-all"
                        >
                            <GitMerge className="w-3.5 h-3.5" /> Thêm cụm (Group)
                        </button>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300 pb-20">
            {/* Header Info */}
            <div className="p-4 bg-gradient-to-r from-red-50/70 to-indigo-50/60 rounded-[14px] border border-red-100 flex gap-3 items-start">
                <div className="p-2 bg-white rounded-[var(--radius-md)] shadow-sm text-[var(--color-primary)] shrink-0 mt-0.5">
                    <Sparkles className="w-5 h-5" />
                </div>
                <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide mb-1">
                        Phân nhánh Đa điều kiện (MYERP Pipeline & Đa kênh)
                    </h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                        Hệ thống kiểm tra lần lượt từ <b>Nhánh 1</b> sang phải (Hồ sơ, Vòng chia, Giai đoạn Pipeline CRM, Đặt cọc, Điểm tương tác, Zalo/Email). Khách hàng khớp nhánh nào đầu tiên sẽ đi theo nhánh đó; nếu không khớp sẽ vào nhánh <b>Mặc định (Else)</b>.
                    </p>
                </div>
            </div>

            {/* Smart Branch Presets (Chèn nhanh Bộ nhánh thông minh) */}
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-[14px] space-y-2.5">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        ⚡ Chèn nhanh Bộ nhánh thông minh (Smart Branch Presets)
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={() => applySmartPreset('temperature')}
                        className="p-2.5 bg-white hover:bg-amber-50/60 border border-slate-200 hover:border-amber-300 rounded-xl text-left text-[11px] font-bold text-slate-700 hover:text-amber-800 transition-all shadow-sm cursor-pointer"
                    >
                        🔥 Rẽ nhánh theo Nhiệt độ (Hot / Warm / Cold)
                    </button>
                    <button
                        type="button"
                        onClick={() => applySmartPreset('team')}
                        className="p-2.5 bg-white hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-xl text-left text-[11px] font-bold text-slate-700 hover:text-indigo-800 transition-all shadow-sm cursor-pointer"
                    >
                        👥 Rẽ nhánh theo Vòng chia (Team Sale)
                    </button>
                    <button
                        type="button"
                        onClick={() => applySmartPreset('channel')}
                        className="p-2.5 bg-white hover:bg-cyan-50/60 border border-slate-200 hover:border-cyan-300 rounded-xl text-left text-[11px] font-bold text-slate-700 hover:text-cyan-800 transition-all shadow-sm cursor-pointer"
                    >
                        📱 Rẽ nhánh Kênh tối ưu (Zalo OA ➔ Email ➔ Gọi SĐT)
                    </button>
                    <button
                        type="button"
                        onClick={() => applySmartPreset('deposit')}
                        className="p-2.5 bg-white hover:bg-emerald-50/60 border border-slate-200 hover:border-emerald-300 rounded-xl text-left text-[11px] font-bold text-slate-700 hover:text-emerald-800 transition-all shadow-sm cursor-pointer"
                    >
                        🎓 Rẽ nhánh theo Trạng thái Cọc & Nhập học
                    </button>
                </div>
            </div>

            {/* Branch Tabs */}
            <div>
                <div className="flex items-center justify-between mb-2 px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Danh sách Nhánh ({branches.length}/8)
                    </label>
                    <button
                        type="button"
                        onClick={addBranch}
                        disabled={branches.length >= 8}
                        className="text-[11px] font-bold text-[var(--color-primary)] hover:opacity-80 flex items-center gap-1 disabled:opacity-40 cursor-pointer"
                    >
                        <Plus className="w-3.5 h-3.5" /> Thêm nhánh mới
                    </button>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {branches.map((b, idx) => {
                        const isActive = idx === activeBranchIdx;
                        const branchTitle = b.label || b.name || `Nhánh ${idx + 1}`;
                        return (
                            <div
                                key={b.id}
                                onClick={() => setActiveBranchIdx(idx)}
                                className={`group flex items-center gap-2 px-3.5 py-2 rounded-[var(--radius-md)] border text-xs font-bold cursor-pointer transition-all shrink-0 select-none ${
                                    isActive
                                        ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-sm'
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-red-200 hover:bg-red-50/30'
                                }`}
                            >
                                <span>{branchTitle}</span>
                                {branches.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={e => removeBranch(idx, e)}
                                        className={`p-0.5 rounded-full transition-colors ${
                                            isActive
                                                ? 'text-red-100 hover:text-white hover:bg-white/20'
                                                : 'text-slate-300 hover:text-rose-500'
                                        }`}
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                )}
                            </div>
                        );
                    })}

                    <div
                        className="flex items-center gap-1.5 px-3 py-2 rounded-[var(--radius-md)] border border-dashed border-slate-200 bg-slate-50 text-slate-400 text-xs font-bold shrink-0 cursor-not-allowed opacity-80"
                        title="Nhánh này tự động kích hoạt nếu khách hàng không thỏa mãn bất kỳ nhánh nào bên trái."
                    >
                        <span>Mặc định (Else)</span>
                    </div>
                </div>
            </div>

            {/* Active Branch Editor */}
            {activeBranch && (
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-5 animate-in fade-in slide-in-from-right-4 duration-200" key={activeBranch.id}>
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                            Tên hiển thị trên sơ đồ
                        </label>
                        <input
                            type="text"
                            value={activeBranch.label || activeBranch.name || ''}
                            onChange={e => updateActiveBranch({ label: e.target.value, name: e.target.value })}
                            placeholder="VD: Lead Nóng - Đã Đặt Cọc..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] text-sm font-bold text-slate-800 focus:bg-white focus:border-[var(--color-primary)] outline-none transition-all"
                        />
                    </div>

                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                            Cấu hình Logic cho "{activeBranch.label || activeBranch.name || 'Nhánh'}"
                        </label>
                        {renderConditionGroup(
                            activeBranch.conditionGroup || {
                                logic: activeBranch.logic || 'AND',
                                conditions: activeBranch.rules || [{ field: 'crm_stage_id', operator: 'equals', value: '1' }]
                            },
                            updateGroup
                        )}
                    </div>
                </div>
            )}

            {/* Priority Visualizer */}
            <div className="p-3 bg-slate-100 rounded-[14px] flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500 overflow-x-auto">
                <span>Thứ tự ưu tiên:</span>
                {branches.map((b, i) => (
                    <React.Fragment key={b.id}>
                        <span
                            className={`px-2 py-0.5 rounded-[var(--radius-md)] ${
                                i === activeBranchIdx
                                    ? 'bg-red-100 text-[var(--color-primary)] font-black'
                                    : 'bg-white border border-slate-200'
                            }`}
                        >
                            {i + 1}. {b.label || b.name || `Nhánh ${i + 1}`}
                        </span>
                        <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                    </React.Fragment>
                ))}
                <span className="px-2 py-0.5 rounded-[var(--radius-md)] bg-slate-200 text-slate-600">
                    Else (Còn lại)
                </span>
            </div>
        </div>
    );
};

export default AdvancedConditionConfig;

