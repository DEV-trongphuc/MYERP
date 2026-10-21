import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import {
    GitMerge, Clock, MailOpen, MousePointer2, MessageSquare, UserMinus, AlertTriangle,
    CheckSquare, Square, RefreshCw, MailCheck, Bell, Link, Briefcase, PhoneCall,
    Users, Flame, Layers, ShieldCheck, Smartphone, Ticket, ClipboardList, Info
} from 'lucide-react';
import { Flow } from '../../../types';
import { api } from '../../../services/storageAdapter';
import erpApi from '../../../../../api/axios';
import { STANDARD_PIPELINE_STAGES } from '../../../constants/flowConstants';
import Radio from '../../common/Radio';
import Input from '../../common/Input';
import Select from '../../common/Select';
// @ts-ignore: `compileHTML` is a named export from `htmlCompiler`
import { compileHTML } from '../../templates/EmailEditor/utils/htmlCompiler';

interface ConditionConfigProps {
    config: Record<string, any>;
    onChange: (newConfig: Record<string, any>) => void;
    flow?: Flow;
    stepId?: string;
    disabled?: boolean;
}

const MYERP_CONDITION_TYPES = [
    'crm_sale_contacted',
    'crm_assigned_to',
    'crm_stage_is',
    'crm_temperature_is',
    'deposit_paid',
    'erp_is_student',
    'erp_has_certificate',
    'channel_reachability'
];

const ConditionConfig: React.FC<ConditionConfigProps> = ({ config, onChange, flow, stepId, disabled }) => {
    const [availableLinks, setAvailableLinks] = useState<any[]>([]);
    const [parentEmailStep, setParentEmailStep] = useState<any>(null);
    const [scanning, setScanning] = useState(false);
    const [surveyData, setSurveyData] = useState<any>(null);
    const [isLoadingSurvey, setIsLoadingSurvey] = useState(false);
    const linkContainerRef = useRef<HTMLDivElement>(null);

    const [erpStages, setErpStages] = useState<Array<{ id: string; name: string }>>(
        STANDARD_PIPELINE_STAGES.map(s => ({ id: s.value, name: s.label }))
    );
    const [erpUsers, setErpUsers] = useState<Array<{ id: string; name: string; role?: string }>>([]);
    const [erpTeams, setErpTeams] = useState<Array<{ id: string; name: string }>>([]);

    const initialTab: 'myerp' | 'campaign' =
        config.conditionCategory ||
        (MYERP_CONDITION_TYPES.includes(config.conditionType) ? 'myerp' : (parentEmailStep ? 'campaign' : 'myerp'));

    const [activeCategory, setActiveCategory] = useState<'myerp' | 'campaign'>(initialTab);

    // Sync activeCategory when conditionType is already set
    useEffect(() => {
        if (config.conditionCategory && (config.conditionCategory === 'myerp' || config.conditionCategory === 'campaign')) {
            setActiveCategory(config.conditionCategory);
        } else if (MYERP_CONDITION_TYPES.includes(config.conditionType)) {
            setActiveCategory('myerp');
        } else if (config.conditionType) {
            setActiveCategory('campaign');
        }
    }, [config.conditionType, config.conditionCategory]);

    // Fetch MYERP metadata (/pipeline-stages, /users, /teams)
    useEffect(() => {
        const controller = new AbortController();
        const loadErpData = async () => {
            try {
                const [stagesRes, usersRes, teamsRes] = await Promise.allSettled([
                    erpApi.get('/pipeline-stages', { signal: controller.signal }),
                    erpApi.get('/users', { signal: controller.signal }),
                    erpApi.get('/teams', { signal: controller.signal })
                ]);
                if (stagesRes.status === 'fulfilled') {
                    const raw = stagesRes.value?.data?.data || stagesRes.value?.data || [];
                    if (Array.isArray(raw) && raw.length > 0) {
                        const mapped = raw
                            .map((st: any) => ({ id: String(st.id ?? st.stage_id ?? ''), name: String(st.name ?? st.stage_name ?? st.title ?? '') }))
                            .filter(s => s.id && s.name);
                        if (mapped.length > 0) setErpStages(mapped);
                    }
                }
                if (usersRes.status === 'fulfilled') {
                    const raw = usersRes.value?.data?.data || usersRes.value?.data || [];
                    if (Array.isArray(raw)) {
                        setErpUsers(
                            raw
                                .filter((u: any) => u && (u.id || u.full_name || u.name || u.username))
                                .map((u: any) => ({
                                    id: String(u.id ?? ''),
                                    name: String(u.full_name || u.name || u.username || `Sale #${u.id}`),
                                    role: u.role ? String(u.role) : undefined
                                }))
                                .filter(u => u.id)
                        );
                    }
                }
                if (teamsRes.status === 'fulfilled') {
                    const raw = teamsRes.value?.data?.data || teamsRes.value?.data || [];
                    if (Array.isArray(raw)) {
                        setErpTeams(
                            raw
                                .map((t: any) => ({ id: String(t.id ?? ''), name: String(t.name ?? t.team_name ?? `Vòng chia #${t.id}`) }))
                                .filter(t => t.id && t.name)
                        );
                    }
                }
            } catch {
                // Keep defaults
            }
        };
        loadErpData();
        return () => controller.abort();
    }, []);

    // Convert old single linkTarget to array if needed
    const selectedLinks: string[] = Array.isArray(config.linkTargets)
        ? config.linkTargets
        : (config.linkTarget ? [config.linkTarget] : []);

    const unitOptions = [
        { value: 'minutes', label: 'Phút' },
        { value: 'hours', label: 'Giờ' },
        { value: 'days', label: 'Ngày' },
        { value: 'weeks', label: 'Tuần' },
    ];

    useEffect(() => {
        if (!flow || !stepId) return;

        const findParentSource = (currentId: string, visited: Set<string>): any => {
            if (visited.has(currentId)) return null;
            visited.add(currentId);
            const safeSteps = Array.isArray(flow.steps) ? flow.steps : [];
            const parentCandidates = safeSteps.filter(s =>
                s && (
                    s.nextStepId === currentId ||
                    s.yesStepId === currentId ||
                    s.noStepId === currentId ||
                    s.pathAStepId === currentId ||
                    s.pathBStepId === currentId ||
                    s.config?.defaultStepId === currentId ||
                    (Array.isArray(s.config?.branches) && s.config.branches.some((b: any) => b.nextStepId === currentId || b.stepId === currentId))
                )
            );
            for (const parent of parentCandidates) {
                if (parent.type === 'action' || parent.type === 'zalo_zns') return parent;
                if (parent.type === 'trigger' && ['campaign', 'survey'].includes(parent.config?.type)) return parent;
                const foundInBranch = findParentSource(parent.id, visited);
                if (foundInBranch) return foundInBranch;
            }
            return null;
        };

        const parentEmail = findParentSource(stepId, new Set<string>());
        setParentEmailStep(parentEmail);

        if (parentEmail && config.targetStepId !== parentEmail.id && !disabled) {
            onChange({ ...config, targetStepId: parentEmail.id, any_campaign: false });
        } else if (!parentEmail && !config.any_campaign && !disabled) {
            // If no preceding campaign step, default to MYERP condition if conditionType not set
            const patch: Record<string, any> = { ...config, any_campaign: true };
            if (!config.conditionType) {
                patch.conditionCategory = 'myerp';
                patch.conditionType = 'crm_sale_contacted';
                patch.waitDuration = 0;
                patch.waitUnit = 'hours';
            }
            onChange(patch);
        }

        if (parentEmail) {
            setScanning(true);
            const scanLinks = async () => {
                let htmlToCheck = parentEmail.config.customHtml || '';
                let templateId = parentEmail.config.templateId;

                if (parentEmail.type === 'trigger' && parentEmail.config?.type === 'campaign' && parentEmail.config?.targetId) {
                    try {
                        const campRes = await api.get<any>(`campaigns/${parentEmail.config.targetId}`);
                        if (campRes.success) {
                            if (campRes.data.templateId) templateId = campRes.data.templateId;
                            if (campRes.data.contentBody) htmlToCheck = campRes.data.contentBody;
                        }
                    } catch (e) { console.error("Error fetching campaign template", e); }
                }

                if (templateId && templateId !== 'custom-html') {
                    if (parentEmail.type !== 'zalo_zns') {
                        const res = await api.get<any>(`templates/${templateId}`);
                        if (res.success) {
                            const tpl = res.data;
                            if (tpl.blocks) {
                                htmlToCheck = compileHTML(tpl.blocks, tpl.bodyStyle, tpl.name || 'temp');
                            } else {
                                htmlToCheck = tpl.htmlContent || '';
                            }
                        }
                    }
                }

                const links: any[] = [];
                const regex = /<a\s+[^>]*?href\s*=\s*["']([^"']+)["'][^>]*?>([\s\S]*?)<\/a>/gi;

                let match;
                let idx = 0;
                while ((match = regex.exec(htmlToCheck)) !== null) {
                    const url = match[1];
                    const rawLabel = match[2];
                    const label = rawLabel.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim() || url;

                    if (!url.includes('{{unsubscribe_url}}') && !url.startsWith('#') && !url.startsWith('mailto:') && !url.startsWith('tel:')) {
                        links.push({ id: `link-${idx++}`, label: label.substring(0, 50) || url, url: url });
                    }
                }

                const uniqueLinks = Array.from(new Map(links.map(item => [item.url, item])).values());
                setAvailableLinks(uniqueLinks);
                setScanning(false);
            };
            scanLinks();
        } else {
            setAvailableLinks([]);
        }
    }, [flow, stepId]);

    // Fetch survey data if the parent step is a survey trigger
    useEffect(() => {
        if (parentEmailStep?.config?.type === 'survey' && parentEmailStep?.config?.targetId) {
            setIsLoadingSurvey(true);
            api.get<any>(`surveys?action=get&id=${parentEmailStep.config.targetId}`).then(res => {
                if (res.success) setSurveyData(res.data);
                setIsLoadingSurvey(false);
            }).catch(e => {
                console.error("Failed to load survey data for config", e);
                setIsLoadingSurvey(false);
            });
        } else {
            setSurveyData(null);
        }
    }, [parentEmailStep]);

    const handleCategorySwitch = (cat: 'myerp' | 'campaign') => {
        if (disabled) return;
        setActiveCategory(cat);
        if (cat === 'myerp' && !MYERP_CONDITION_TYPES.includes(config.conditionType)) {
            onChange({
                ...config,
                conditionCategory: 'myerp',
                conditionType: 'crm_sale_contacted',
                waitDuration: config.waitDuration ?? 0,
                waitUnit: config.waitUnit || 'hours'
            });
        } else if (cat === 'campaign' && MYERP_CONDITION_TYPES.includes(config.conditionType)) {
            const defaultType = parentEmailStep?.type === 'zalo_zns' ? 'zalo_interacted' : 'opened';
            onChange({
                ...config,
                conditionCategory: 'campaign',
                conditionType: defaultType,
                any_campaign: !parentEmailStep,
                waitDuration: config.waitDuration ?? 1,
                waitUnit: config.waitUnit || 'days'
            });
        }
    };

    const handleTypeChange = (val: string) => {
        if (disabled) return;
        const isMyerp = MYERP_CONDITION_TYPES.includes(val);
        const updates: Record<string, any> = {
            ...config,
            conditionCategory: isMyerp ? 'myerp' : 'campaign',
            conditionType: val,
            any_campaign: !parentEmailStep,
            linkTargets: (val === 'clicked' || val === 'clicked_specific') ? selectedLinks : []
        };

        if (isMyerp) {
            // For MYERP checks, default to instant check (0 hours) if not already set, or preserve user's waitDuration
            if (updates.waitDuration === undefined) {
                updates.waitDuration = 0;
                updates.waitUnit = 'hours';
            }
            if (val === 'crm_assigned_to' && !updates.assignMatchMode) {
                updates.assignMatchMode = 'any_assigned';
            }
            if (val === 'crm_stage_is' && !updates.targetStageId && erpStages[0]) {
                updates.targetStageId = erpStages[0].id;
            }
            if (val === 'crm_temperature_is' && !updates.targetTemperature) {
                updates.targetTemperature = 'hot';
            }
            if (val === 'channel_reachability' && !updates.channelType) {
                updates.channelType = 'has_zalo';
            }
        } else if (['delivered', 'zns_delivered', 'zns_failed'].includes(val)) {
            updates.waitDuration = 1;
            updates.waitUnit = 'hours';
        } else if (['zns_clicked', 'zns_replied', 'zalo_interacted'].includes(val)) {
            updates.waitDuration = 1;
            updates.waitUnit = 'days';
        } else {
            updates.waitDuration = 3;
            updates.waitUnit = 'days';
        }
        onChange(updates);

        if (val === 'clicked' || val === 'clicked_specific' || val === 'zns_clicked') {
            setTimeout(() => {
                linkContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    };

    const toggleLink = (url: string) => {
        if (disabled) return;
        let newTargets: string[] = [];

        if (selectedLinks.length === 0) {
            newTargets = [url];
        } else if (selectedLinks.includes(url)) {
            newTargets = selectedLinks.filter(l => l !== url);
        } else {
            newTargets = [...selectedLinks, url];
            if (newTargets.length === availableLinks.length) {
                newTargets = [];
            }
        }
        onChange({ ...config, linkTargets: newTargets });
    };

    const getActionDescription = () => {
        switch (config.conditionType) {
            case 'crm_sale_contacted': return 'được Sale liên hệ / chăm sóc';
            case 'crm_assigned_to': return 'được phân công đúng Sale / Vòng chia';
            case 'crm_stage_is': return 'chuyển sang Giai đoạn Pipeline mục tiêu';
            case 'crm_temperature_is': return 'đạt mức nhiệt độ Lead mục tiêu';
            case 'deposit_paid': return 'đặt cọc thành công';
            case 'erp_is_student': return 'nhập học chính thức';
            case 'channel_reachability': return 'có kênh liên lạc khả dụng';
            case 'opened': return 'mở mail';
            case 'clicked':
            case 'clicked_specific': return 'click link';
            case 'zalo_interacted': return 'tương tác Zalo ZNS/OA';
            case 'survey_completed': return 'hoàn thành khảo sát';
            case 'voucher_claimed': return 'nhận / sử dụng Voucher';
            case 'delivered': return 'nhận được mail/tin';
            case 'unsubscribed': return 'Hủy đăng ký';
            default: return 'thỏa mãn điều kiện';
        }
    };

    return (
        <div className="space-y-5 animate-in fade-in duration-500 pb-32">
            {/* Category Tabs: Tab 1 (MYERP & Sale) vs Tab 2 (Tương tác Chiến dịch) */}
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/80">
                <button
                    type="button"
                    onClick={() => handleCategorySwitch('myerp')}
                    className={`py-2.5 px-3 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeCategory === 'myerp'
                            ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <span>🏢 Điều kiện MYERP & Sale</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleCategorySwitch('campaign')}
                    className={`py-2.5 px-3 rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        activeCategory === 'campaign'
                            ? 'bg-white text-orange-600 shadow-sm border border-orange-100'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    <span>📧 Tương tác Chiến dịch</span>
                </button>
            </div>

            {/* TAB 1: ĐIỀU KIỆN MYERP & SALE */}
            {activeCategory === 'myerp' && (
                <div className="space-y-4">
                    <Radio
                        label="Chọn điều kiện nghiệp vụ MYERP & Sale cần kiểm tra:"
                        options={[
                            {
                                id: 'crm_sale_contacted',
                                label: 'Sale đã liên hệ khách hàng? (Gọi / Ghi chú / CSKH)',
                                icon: PhoneCall,
                                desc: 'Kiểm tra Sale đã thực hiện cuộc gọi hoặc cập nhật lịch sử chăm sóc sau khi nhận Lead chưa'
                            },
                            {
                                id: 'crm_assigned_to',
                                label: 'Thuộc Vòng chia / Tư vấn viên cụ thể?',
                                icon: Users,
                                desc: 'Kiểm tra hồ sơ đã có Sale phụ trách, thuộc Vòng chia hoặc Sale cụ thể'
                            },
                            {
                                id: 'crm_stage_is',
                                label: 'Đang ở Giai đoạn Pipeline cụ thể?',
                                icon: Layers,
                                desc: 'Kiểm tra giai đoạn chăm sóc hiện tại của hồ sơ trên CRM Pipeline'
                            },
                            {
                                id: 'crm_temperature_is',
                                label: 'Độ nóng Lead là Hot / Warm / Cold?',
                                icon: Flame,
                                desc: 'Phân nhánh theo mức độ quan tâm của khách hàng'
                            },
                            {
                                id: 'deposit_paid',
                                label: 'Đã Đặt cọc thành công (Approved)?',
                                icon: ShieldCheck,
                                desc: 'Kiểm tra xem khách hàng đã phát sinh phiếu đặt cọc được Kế toán duyệt chưa'
                            },
                            {
                                id: 'erp_is_student',
                                label: 'Đã chính thức Nhập học (Enrolled)?',
                                icon: Briefcase,
                                desc: 'Kiểm tra khách đã chuyển thành Học viên chính thức chưa'
                            },
                            {
                                id: 'channel_reachability',
                                label: 'Có kênh liên lạc khả dụng? (Zalo / Email / SĐT)',
                                icon: Smartphone,
                                desc: 'Kiểm tra hồ sơ có gửi được Zalo OA/ZNS, có Email hợp lệ hoặc có SĐT'
                            }
                        ]}
                        value={MYERP_CONDITION_TYPES.includes(config.conditionType) ? config.conditionType : 'crm_sale_contacted'}
                        onChange={handleTypeChange}
                        disabled={disabled}
                    />

                    {/* Sub-config for crm_assigned_to */}
                    {config.conditionType === 'crm_assigned_to' && (
                        <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-3 animate-in slide-in-from-top-2">
                            <label className="text-[10px] font-black uppercase text-indigo-800 tracking-wider block">
                                Tiêu chí kiểm tra phân bổ Sale
                            </label>
                            <select
                                value={config.assignMatchMode || (config.targetOwnerId ? 'specific_owner' : (config.targetTeamId ? 'specific_team' : 'any_assigned'))}
                                onChange={(e) => {
                                    const mode = e.target.value;
                                    onChange({
                                        ...config,
                                        assignMatchMode: mode,
                                        any_assigned: mode === 'any_assigned',
                                        targetOwnerId: mode === 'specific_owner' ? (config.targetOwnerId || erpUsers[0]?.id || '') : '',
                                        targetTeamId: mode === 'specific_team' ? (config.targetTeamId || erpTeams[0]?.id || '') : ''
                                    });
                                }}
                                disabled={disabled}
                                className="w-full h-10 px-3 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                            >
                                <option value="any_assigned">Đã có Sale phụ trách (Không để trống)</option>
                                <option value="specific_team">Thuộc Vòng chia / Team Sale cụ thể</option>
                                <option value="specific_owner">Được phụ trách bởi Tư vấn viên (Sale) cụ thể</option>
                            </select>

                            {(config.assignMatchMode === 'specific_team' || (!config.assignMatchMode && config.targetTeamId)) && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-600 block">Chọn Vòng chia / Team Sale:</label>
                                    <select
                                        value={config.targetTeamId || ''}
                                        onChange={(e) => onChange({ ...config, targetTeamId: e.target.value, assignMatchMode: 'specific_team' })}
                                        disabled={disabled}
                                        className="w-full h-10 px-3 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                    >
                                        <option value="">-- Chọn Vòng chia / Team Sale --</option>
                                        {erpTeams.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {(config.assignMatchMode === 'specific_owner' || (!config.assignMatchMode && config.targetOwnerId)) && (
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-600 block">Chọn Tư vấn viên (Sale):</label>
                                    <select
                                        value={config.targetOwnerId || ''}
                                        onChange={(e) => onChange({ ...config, targetOwnerId: e.target.value, assignMatchMode: 'specific_owner' })}
                                        disabled={disabled}
                                        className="w-full h-10 px-3 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                                    >
                                        <option value="">-- Chọn Tư vấn viên --</option>
                                        {erpUsers.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}{u.role ? ` (${u.role})` : ''}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Sub-config for crm_stage_is */}
                    {config.conditionType === 'crm_stage_is' && (
                        <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-2xl space-y-2 animate-in slide-in-from-top-2">
                            <label className="text-[10px] font-black uppercase text-purple-800 tracking-wider block">
                                Chọn Giai đoạn Pipeline CRM cần kiểm tra
                            </label>
                            <select
                                value={config.targetStageId || config.stageId || ''}
                                onChange={(e) => onChange({ ...config, targetStageId: e.target.value, stageId: e.target.value })}
                                disabled={disabled}
                                className="w-full h-10 px-3 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-purple-500"
                            >
                                <option value="">-- Chọn Giai đoạn Pipeline --</option>
                                {erpStages.map(st => (
                                    <option key={st.id} value={st.id}>{st.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Sub-config for crm_temperature_is */}
                    {config.conditionType === 'crm_temperature_is' && (
                        <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-2 animate-in slide-in-from-top-2">
                            <label className="text-[10px] font-black uppercase text-amber-800 tracking-wider block">
                                Chọn mức Độ nóng Lead (Temperature)
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'hot', label: '🔥 Nóng (Hot)' },
                                    { id: 'warm', label: '🌤️ Ấm (Warm)' },
                                    { id: 'cold', label: '❄️ Lạnh (Cold)' }
                                ].map(temp => {
                                    const currentTemp = config.targetTemperature || config.temperature || 'hot';
                                    const isSelected = currentTemp === temp.id;
                                    return (
                                        <button
                                            key={temp.id}
                                            type="button"
                                            disabled={disabled}
                                            onClick={() => onChange({ ...config, targetTemperature: temp.id, temperature: temp.id })}
                                            className={`py-2.5 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                                                isSelected
                                                    ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                                                    : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-50'
                                            }`}
                                        >
                                            {temp.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Sub-config for channel_reachability */}
                    {config.conditionType === 'channel_reachability' && (
                        <div className="p-4 bg-cyan-50/50 border border-cyan-200 rounded-2xl space-y-2 animate-in slide-in-from-top-2">
                            <label className="text-[10px] font-black uppercase text-cyan-800 tracking-wider block">
                                Chọn Kênh liên lạc cần kiểm tra
                            </label>
                            <select
                                value={config.channelType || 'has_zalo'}
                                onChange={(e) => onChange({ ...config, channelType: e.target.value })}
                                disabled={disabled}
                                className="w-full h-10 px-3 bg-white border border-cyan-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
                            >
                                <option value="has_zalo">Có thể gửi Zalo OA / ZNS (Có Zalo hoặc SĐT hợp lệ)</option>
                                <option value="has_email">Có địa chỉ Email hợp lệ</option>
                                <option value="has_phone">Có Số điện thoại hợp lệ</option>
                            </select>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 2: TƯƠNG TÁC CHIẾN DỊCH (EMAIL / ZALO / SURVEY) */}
            {activeCategory === 'campaign' && (
                <div className="space-y-4">
                    {parentEmailStep ? (
                        <div className="flex items-center justify-between mb-2 px-1">
                            <div className="flex items-center gap-2">
                                <GitMerge className="w-4 h-4 text-indigo-500" />
                                <span className="text-[10px] font-black uppercase text-indigo-500 tracking-widest">Nguồn theo dõi:</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg font-bold text-[10px] border border-indigo-100 shadow-sm">
                                <Link className="w-3 h-3" />
                                <span className="truncate max-w-[180px]">{parentEmailStep.label}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-start gap-2.5">
                            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-blue-800 font-semibold leading-relaxed">
                                Đang kiểm tra trên toàn bộ lịch sử tương tác của khách hàng (Global Campaign History).
                            </p>
                        </div>
                    )}

                    {parentEmailStep?.config?.type === 'survey' ? (
                        <>
                            <Radio
                                label="Kiểm tra điều kiện khảo sát:"
                                options={[
                                    { id: 'survey_score', label: 'Điểm số Trắc nghiệm', icon: CheckSquare, desc: 'Lọc theo khoảng điểm' },
                                    { id: 'survey_answer', label: 'Khớp Câu trả lời', icon: MousePointer2, desc: 'Dựa trên nội dung trả lời' },
                                    { id: 'survey_screen', label: 'Màn hình Kết thúc', icon: MailCheck, desc: 'Cán đích ở màn hình nào' },
                                ]}
                                value={config.conditionType || 'survey_score'}
                                onChange={handleTypeChange}
                                disabled={disabled}
                            />

                            {config.conditionType === 'survey_score' && (
                                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3 mt-4">
                                    <label className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Logic khoảng điểm</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <Select
                                            options={[
                                                { value: '>=', label: 'Lớn hơn hoặc bằng' },
                                                { value: '<=', label: 'Nhỏ hơn hoặc bằng' },
                                                { value: '==', label: 'Bằng chính xác' },
                                                { value: '<', label: 'Nhỏ hơn' },
                                                { value: '>', label: 'Lớn hơn' },
                                            ]}
                                            value={config.scoreOperator || '>='}
                                            onChange={(val) => onChange({ ...config, scoreOperator: val })}
                                            disabled={disabled}
                                        />
                                        <Input
                                            type="number"
                                            placeholder="VD: 50"
                                            value={config.scoreValue || 0}
                                            onChange={(e) => onChange({ ...config, scoreValue: parseInt(e.target.value) || 0 })}
                                            disabled={disabled}
                                        />
                                    </div>
                                    <p className="text-[10px] text-emerald-600 italic">Tổng số điểm của bài khảo sát (được dùng để chấm điểm Test Quiz).</p>
                                </div>
                            )}

                            {config.conditionType === 'survey_answer' && (
                                <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-2xl space-y-3 mt-4">
                                    <label className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">Logic câu trả lời</label>
                                    {surveyData ? (
                                        <div className="relative">
                                            {isLoadingSurvey && <div className="absolute right-3 top-1/2 -translate-y-1/2 p-2"><RefreshCw className="w-4 h-4 animate-spin text-indigo-300" /></div>}
                                            <select
                                                className="w-full h-11 px-4 bg-white border border-indigo-100 rounded-xl font-bold text-sm text-indigo-900 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none"
                                                value={config.questionId || ''}
                                                onChange={(e) => onChange({ ...config, questionId: e.target.value })}
                                                disabled={disabled || isLoadingSurvey}
                                            >
                                                <option value="">-- Chọn câu hỏi cần kiểm tra --</option>
                                                {surveyData.blocks_json?.filter((b: any) => !['section_header', 'page_break', 'divider', 'image_block', 'button_block', 'link_block', 'banner_block'].includes(b.type)).map((b: any) => (
                                                    <option key={b.id} value={b.id}>{b.label || 'Câu hỏi không tên'} ({b.type})</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <Input
                                            placeholder="Nhập ID câu hỏi (VD: question-1)"
                                            value={config.questionId || ''}
                                            onChange={(e) => onChange({ ...config, questionId: e.target.value })}
                                            disabled={disabled}
                                        />
                                    )}

                                    {(() => {
                                        const selectedBlock = surveyData?.blocks_json?.find((b: any) => b.id === config.questionId);
                                        const hasOptions = selectedBlock && ['single_choice', 'dropdown', 'multi_choice'].includes(selectedBlock.type) && selectedBlock.options && selectedBlock.options.length > 0;
                                        if (surveyData && hasOptions) {
                                            return (
                                                <select
                                                    className="w-full h-11 px-4 bg-white border border-indigo-100 rounded-xl font-bold text-sm text-indigo-900 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all appearance-none"
                                                    value={config.answerMatch || ''}
                                                    onChange={(e) => onChange({ ...config, answerMatch: e.target.value })}
                                                    disabled={disabled || isLoadingSurvey}
                                                >
                                                    <option value="">-- Chọn đáp án để khớp --</option>
                                                    {selectedBlock.options.map((opt: any, idx: number) => {
                                                        const label = opt.label || opt.value || opt;
                                                        return <option key={idx} value={label}>{label}</option>;
                                                    })}
                                                </select>
                                            );
                                        } else {
                                            return (
                                                <Input
                                                    placeholder="Nội dung khớp (VD: Có)"
                                                    value={config.answerMatch || ''}
                                                    onChange={(e) => onChange({ ...config, answerMatch: e.target.value })}
                                                    disabled={disabled}
                                                />
                                            );
                                        }
                                    })()}
                                    <p className="text-[10px] text-indigo-600 italic">Nếu người dùng trả lời khớp nội dung này, rẽ nhánh TRUE (Màu xanh).</p>
                                </div>
                            )}

                            {config.conditionType === 'survey_screen' && (
                                <div className="p-5 bg-blue-50 border border-blue-200 rounded-2xl space-y-3 mt-4">
                                    <label className="text-[10px] font-black uppercase text-blue-700 tracking-widest">Màn hình Kết thúc</label>
                                    {surveyData ? (
                                        <div className="relative">
                                            {isLoadingSurvey && <div className="absolute right-3 top-1/2 -translate-y-1/2 p-2"><RefreshCw className="w-4 h-4 animate-spin text-blue-300" /></div>}
                                            <select
                                                className="w-full h-11 px-4 bg-white border border-blue-100 rounded-xl font-bold text-sm text-blue-900 focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all appearance-none"
                                                value={config.endScreenId || 'default'}
                                                onChange={(e) => onChange({ ...config, endScreenId: e.target.value })}
                                                disabled={disabled || isLoadingSurvey}
                                            >
                                                <option value="default">Màn hình Cảm ơn (Mặc định)</option>
                                                {surveyData.thank_you_page?.extraScreens?.map((s: any, idx: number) => (
                                                    <option key={s.id} value={s.id}>{s.name || `Trang đích ${idx + 1}`}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ) : (
                                        <Input
                                            placeholder="Nhập Screen ID (Mặc định = default)"
                                            value={config.endScreenId || ''}
                                            onChange={(e) => onChange({ ...config, endScreenId: e.target.value })}
                                            disabled={disabled}
                                        />
                                    )}
                                    <p className="text-[10px] text-blue-600 italic">Kiểm tra xem người dùng có được đưa tới đúng màn hình này khi kết thúc khảo sát không.</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <Radio
                            label="Hành vi tương tác Chiến dịch cần kiểm tra:"
                            options={parentEmailStep?.type === 'zalo_zns' ? [
                                { id: 'zalo_interacted', label: 'Đã xem / Tương tác Zalo ZNS', icon: MessageSquare, desc: 'Khách đã nhận, click hoặc phản hồi Zalo OA/ZNS' },
                                { id: 'zns_delivered', label: 'Đã nhận (Gửi thành công)', icon: CheckSquare, desc: 'Tin nhắn ZNS đã gửi thành công' },
                                { id: 'zns_clicked', label: 'Khách Click Link ZNS', icon: MousePointer2, desc: 'Theo dõi chuyển đổi link ZNS' },
                                { id: 'zns_replied', label: 'Khách Phản hồi OA', icon: MessageSquare, desc: 'Khách chat lại với Zalo OA' },
                                { id: 'zns_failed', label: 'Gửi ZNS thất bại', icon: AlertTriangle, desc: 'Gửi lại qua Email hoặc tạo Task gọi' },
                            ] : [
                                { id: 'opened', label: 'Đã mở Email (Opened)', icon: MailOpen, desc: 'Theo dõi tỷ lệ đọc Email' },
                                { id: 'clicked', label: 'Đã Click bất kỳ Link (Clicked)', icon: MousePointer2, desc: 'Khách nhấn vào link bất kỳ trong nội dung' },
                                { id: 'clicked_specific', label: 'Click Link cụ thể (Specific URL)', icon: Link, desc: 'Theo dõi một đường dẫn URL mục tiêu cụ thể' },
                                { id: 'zalo_interacted', label: 'Đã xem / Tương tác Zalo ZNS', icon: MessageSquare, desc: 'Kiểm tra lịch sử tương tác Zalo OA / ZNS' },
                                { id: 'survey_completed', label: 'Đã hoàn thành Khảo sát (Survey)', icon: ClipboardList, desc: 'Khách đã nộp biểu mẫu khảo sát' },
                                { id: 'voucher_claimed', label: 'Đã nhận / Sử dụng Voucher', icon: Ticket, desc: 'Khách đã lấy hoặc gạch mã ưu đãi' },
                                { id: 'delivered', label: 'Đã nhận Email (Delivered)', icon: MailCheck, desc: 'Nếu KHÔNG -> Chuyển nhánh ELSE' },
                                ...((parentEmailStep?.type === 'trigger' && parentEmailStep?.config?.type === 'campaign') ? [
                                    { id: 'received_reminder', label: 'Đã nhận Reminder', icon: Bell, desc: 'Đã nhận Email Nhắc nhở' },
                                    { id: 'opened_reminder', label: 'Đã mở Reminder', icon: MailOpen, desc: 'Đã mở Email Nhắc nhở' }
                                ] : []),
                                { id: 'unsubscribed', label: 'Hủy đăng ký (Unsubscribed)', icon: UserMinus, desc: 'Phân loại khách rời đi' },
                            ]}
                            value={config.conditionType || (parentEmailStep?.type === 'zalo_zns' ? 'zalo_interacted' : 'opened')}
                            onChange={handleTypeChange}
                            disabled={disabled}
                        />
                    )}

                    {/* Specific link URL input if clicked_specific and no scanned links */}
                    {config.conditionType === 'clicked_specific' && availableLinks.length === 0 && (
                        <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-2xl space-y-2">
                            <label className="text-[10px] font-black uppercase text-indigo-800 tracking-wider block">
                                Đường dẫn URL cần kiểm tra
                            </label>
                            <Input
                                placeholder="VD: https://.../dang-ky hoặc từ khóa trong URL"
                                value={config.linkTarget || selectedLinks[0] || ''}
                                onChange={(e) => onChange({ ...config, linkTarget: e.target.value, linkTargets: e.target.value ? [e.target.value] : [] })}
                                disabled={disabled}
                            />
                        </div>
                    )}

                    {/* Reminder ID Input */}
                    {['received_reminder', 'opened_reminder'].includes(config.conditionType) && (
                        <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl space-y-2 mt-4">
                            <label className="text-[10px] font-black uppercase text-amber-700 tracking-widest">ID Chiến dịch Reminder</label>
                            <Input
                                placeholder="Nhập ID Reminder (VD: 1, 2...)"
                                value={config.reminderId || ''}
                                onChange={(e) => onChange({ ...config, reminderId: e.target.value })}
                                disabled={disabled}
                            />
                            <p className="text-[10px] text-amber-600 italic">ID này nằm trong cài đặt Reminder của Chiến dịch.</p>
                        </div>
                    )}

                    {(config.conditionType === 'clicked' || config.conditionType === 'clicked_specific' || config.conditionType === 'zns_clicked') && (
                        <div className="space-y-4 pt-2 animate-in fade-in slide-in-from-top-4 duration-500" ref={linkContainerRef}>
                            <div className="flex items-center justify-between px-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Chọn Link cần theo dõi (OR Logic)</p>
                                {scanning && <RefreshCw className="w-3 h-3 animate-spin text-slate-400" />}
                            </div>

                            {scanning ? (
                                <div className="space-y-2">
                                    <div className="h-14 bg-slate-50 animate-pulse rounded-2xl"></div>
                                    <div className="h-14 bg-slate-50 animate-pulse rounded-2xl"></div>
                                </div>
                            ) : availableLinks.length > 0 ? (
                                <>
                                    <div className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${selectedLinks.length === 0 ? 'border-indigo-500 bg-indigo-50/50 shadow-sm ring-4 ring-indigo-500/5' : 'border-slate-100 bg-slate-50/30'}`}>
                                        <div className="flex-1">
                                            <p className="text-xs font-black text-slate-800">Theo dõi BẤT KỲ Link nào (Any)</p>
                                            <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">Hợp lệ nếu khách click vào bất cứ link nào có trong nội dung.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (disabled) return;
                                                if (selectedLinks.length === 0) {
                                                    if (availableLinks.length > 0) {
                                                        onChange({ ...config, linkTargets: [availableLinks[0].url] });
                                                    }
                                                } else {
                                                    onChange({ ...config, linkTargets: [] });
                                                }
                                            }}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none ${selectedLinks.length === 0 ? 'bg-indigo-600' : 'bg-slate-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            disabled={disabled}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-md ${selectedLinks.length === 0 ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar p-1">
                                        {availableLinks.map((link) => {
                                            const isSelected = selectedLinks.length === 0 || selectedLinks.includes(link.url);
                                            return (
                                                <button
                                                    key={link.id}
                                                    type="button"
                                                    onClick={() => toggleLink(link.url)}
                                                    className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left group ${isSelected ? 'border-indigo-200 bg-white shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                    disabled={disabled}
                                                >
                                                    <div className="flex-1 overflow-hidden pr-2">
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            {isSelected ? <CheckSquare className="w-3 h-3 text-indigo-500" /> : <Square className="w-3 h-3 text-slate-300 group-hover:text-slate-400" />}
                                                            <p className={`text-xs font-black truncate transition-colors ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>{link.label}</p>
                                                        </div>
                                                        <p className={`text-[10px] truncate font-mono ml-5 transition-colors ${isSelected ? 'text-indigo-500/70' : 'text-slate-400'}`}>{link.url}</p>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white scale-110 shadow-lg shadow-indigo-200' : 'border-slate-200 bg-slate-50 opacity-0 group-hover:opacity-100'}`}>
                                                        {isSelected && <CheckSquare className="w-3 h-3" />}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    )}
                </div>
            )}

            {/* CHẾ ĐỘ KIỂM TRA TỨC THÌ VS. CHỜ PHẢN HỒI (SHARED FOR BOTH TABS) */}
            <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">
                        Chế độ Kiểm tra tức thì vs. Chờ phản hồi (Timeout)
                    </span>
                </div>

                <div
                    className="flex items-center justify-between gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-200 transition-all cursor-pointer"
                    onClick={() => {
                        if (disabled) return;
                        if (config.waitDuration === 0) {
                            onChange({ ...config, waitDuration: 2, waitUnit: 'hours' });
                        } else {
                            onChange({ ...config, waitDuration: 0, waitUnit: 'hours' });
                        }
                    }}
                >
                    <div className="flex-1">
                        <p className="text-xs font-bold text-slate-800">Kiểm tra ngay lập tức (Chế độ Tức thì)</p>
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                            Đánh giá trạng thái ngay thời điểm chạy tới bước này (rất phù hợp khi đặt sau bước Chờ hoặc ngay sau Trigger). Nếu chưa {getActionDescription()}, rẽ nhánh <strong>KHÔNG (NO)</strong> ngay lập tức.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (disabled) return;
                            if (config.waitDuration === 0) {
                                onChange({ ...config, waitDuration: 2, waitUnit: 'hours' });
                            } else {
                                onChange({ ...config, waitDuration: 0, waitUnit: 'hours' });
                            }
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none ${config.waitDuration === 0 ? 'bg-[var(--color-primary)]' : 'bg-slate-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={disabled}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-md ${config.waitDuration === 0 ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {config.waitDuration !== 0 && (
                    <>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                            Hệ thống sẽ theo dõi tối đa trong khoảng thời gian dưới đây. Ngay khi khách {getActionDescription()}, lập tức chuyển sang nhánh <strong>CÓ (YES)</strong>; nếu hết hạn vẫn chưa đạt sẽ chuyển sang nhánh <strong>KHÔNG (NO)</strong>.
                        </p>
                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                type="number"
                                min="1"
                                value={config.waitDuration || 1}
                                onChange={(e) => onChange({ ...config, waitDuration: Math.max(1, parseInt(e.target.value) || 1) })}
                                disabled={disabled}
                            />
                            <Select
                                options={unitOptions}
                                value={config.waitUnit || 'hours'}
                                onChange={(val) => onChange({ ...config, waitUnit: val })}
                                disabled={disabled}
                                direction="bottom"
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default ConditionConfig;