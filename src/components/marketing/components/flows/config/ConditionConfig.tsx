import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { GitMerge, Clock, MailOpen, MousePointer2, MessageSquare, UserMinus, AlertTriangle, Search, CheckSquare, Square, RefreshCw, Unlink, MailCheck, Bell, Link } from 'lucide-react';
import { Flow } from '../../../types';
import { api } from '../../../services/storageAdapter';
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

const ConditionConfig: React.FC<ConditionConfigProps> = ({ config, onChange, flow, stepId, disabled }) => {
    const [availableLinks, setAvailableLinks] = useState<any[]>([]);
    const [parentEmailStep, setParentEmailStep] = useState<any>(null);
    const [scanning, setScanning] = useState(false);
    const [surveyData, setSurveyData] = useState<any>(null);
    const [isLoadingSurvey, setIsLoadingSurvey] = useState(false);
    const linkContainerRef = useRef<HTMLDivElement>(null);

    // Convert old single linkTarget to array if needed
    const selectedLinks: string[] = Array.isArray(config.linkTargets)
        ? config.linkTargets
        : (config.linkTarget ? [config.linkTarget] : []);

    const unitOptions = [
        { value: 'hours', label: 'Giờ' },
        { value: 'days', label: 'Ngày' },
        { value: 'weeks', label: 'Tuần' },
    ];

    useEffect(() => {
        if (!flow || !stepId) return;

        const findParentSource = (currentId: string, visited: Set<string>): any => {
            if (visited.has(currentId)) return null;
            visited.add(currentId);
            // Find steps that point TO currentId
            const parentCandidates = flow.steps.filter(s =>
                s.nextStepId === currentId || s.yesStepId === currentId || s.noStepId === currentId || s.pathAStepId === currentId || s.pathBStepId === currentId
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

        // [NEW] Persist targetStepId for backend tracking
        if (parentEmail && config.targetStepId !== parentEmail.id && !disabled) {
            onChange({ ...config, targetStepId: parentEmail.id });
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
                    // For ZNS, we don't have standard email templates, but might have link args.
                    // IMPORTANT: If parent is ZNS, we might need to fetch ZNS template specific content or just allow 'clicked' without specific links scan for now.
                    // For now, let's keep it simple. If it's ZNS, we might not find links easily unless we parse arguments.
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
                // UPDATED REGEX: Supports attributes before href, and multiline content [\s\S]
                const regex = /<a\s+[^>]*?href\s*=\s*["']([^"']+)["'][^>]*?>([\s\S]*?)<\/a>/gi;

                let match;
                let idx = 0;
                while ((match = regex.exec(htmlToCheck)) !== null) {
                    const url = match[1];
                    // Strip HTML tags from label and trim whitespace/newlines
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

    // [NEW] Fetch survey data if the parent step is a survey trigger
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

    useEffect(() => {
        if (config.waitUnit === 'minutes') {
            onChange({ ...config, waitUnit: 'hours', waitDuration: 1 });
        }
    }, [config.waitUnit]);

    const handleTypeChange = (val: string) => {
        if (disabled) return;
        const updates: Record<string, any> = {
            ...config,
            conditionType: val,
            linkTargets: val === 'clicked' ? selectedLinks : []
        };

        // UX Defaults:
        // - Delivery/Sent checks should be fast (1 hour).
        // - ZNS interactions (Click/Reply) are usually faster than email, default to 1 Day.
        // - Email interactions default to 3 Days.
        if (['delivered', 'zns_delivered', 'zns_failed'].includes(val)) {
            updates.waitDuration = 1;
            updates.waitUnit = 'hours';
        } else if (['zns_clicked', 'zns_replied'].includes(val)) {
            updates.waitDuration = 1;
            updates.waitUnit = 'days';
        } else {
            updates.waitDuration = 3;
            updates.waitUnit = 'days';
        }
        onChange(updates);

        // Auto-scroll to link selection if clicked
        if (val === 'clicked' || val === 'zns_clicked') {
            setTimeout(() => {
                linkContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    };

    const toggleLink = (url: string) => {
        if (disabled) return;
        let newTargets: string[] = [];

        if (selectedLinks.length === 0) {
            // If currently "Any" (empty), and user clicks a specific link, 
            // switch to specific mode with ONLY that link selected.
            newTargets = [url];
        } else if (selectedLinks.includes(url)) {
            newTargets = selectedLinks.filter(l => l !== url);
        } else {
            newTargets = [...selectedLinks, url];
            // If all are selected, revert to "Any" (empty array) for cleaner state
            if (newTargets.length === availableLinks.length) {
                newTargets = [];
            }
        }
        onChange({ ...config, linkTargets: newTargets });
    };

    const toggleAllLinks = () => {
        if (disabled) return;
        if (selectedLinks.length > 0) {
            onChange({ ...config, linkTargets: [] }); // Clear all = Match ANY (Behavior definition)
        } else {
            // Select specifically all found links (Restrictive)
            onChange({ ...config, linkTargets: availableLinks.map(l => l.url) });
        }
    };

    const getActionDescription = () => {
        switch (config.conditionType) {
            case 'opened': return 'mở mail';
            case 'clicked': return 'click link';
            case 'delivered': return 'nhận được mail/tin';
            case 'unsubscribed': return 'Hủy đăng ký';
            default: return 'tương tác';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-32">
            {!parentEmailStep ? (
                <div className="p-8 bg-rose-50 border-2 border-dashed border-rose-200 rounded-[32px] text-center space-y-4">
                    <Unlink className="w-8 h-8 mx-auto text-rose-500" />
                    <p className="text-sm font-black text-rose-700 uppercase">Thiếu nguồn kết nối</p>
                    <p className="text-xs text-rose-500">Vui lòng nối bước này SAU Tác vụ/Trigger theo dõi hành vi (VD: Gửi Email, Zalo ZNS, Làm khảo sát).</p>
                </div>
            ) : (
                <>
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

                    {parentEmailStep?.config?.type === 'survey' ? (
                        <>
                            <Radio
                                label="Kiểm tra điều kiện khảo sát:"
                                options={[
                                    { id: 'survey_score', label: 'Điểm số Trắc nghiệm', icon: CheckSquare, desc: 'Lọc theo khoảng điểm' },
                                    { id: 'survey_answer', label: 'Khớp Câu trả lời', icon: MousePointer2, desc: 'Dựa trên nội dung trả lời' },
                                    { id: 'survey_screen', label: 'Màn hình Kết thúc', icon: MailCheck, desc: 'Cắn đích ở màn hình nào' },
                                ]}
                                value={config.conditionType || 'survey_score'}
                                onChange={handleTypeChange}
                                disabled={disabled}
                            />
                            
                            {config.conditionType === 'survey_score' && (
                                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-[28px] space-y-3 mt-4">
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
                                <div className="p-5 bg-indigo-50 border border-indigo-200 rounded-[28px] space-y-3 mt-4">
                                    <label className="text-[10px] font-black uppercase text-indigo-700 tracking-widest">Logic câu trả lời</label>
                                    
                                    {/* Select Question */}
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

                                    {/* Select Answer */}
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
                                            )
                                        } else {
                                            return (
                                                <Input
                                                    placeholder="Nội dung khớp (VD: Có)"
                                                    value={config.answerMatch || ''}
                                                    onChange={(e) => onChange({ ...config, answerMatch: e.target.value })}
                                                    disabled={disabled}
                                                />
                                            )
                                        }
                                    })()}
                                    <p className="text-[10px] text-indigo-600 italic">Nếu người dùng trả lời khớp nội dung này, rẽ nhánh TRUE (Màu xanh).</p>
                                </div>
                            )}

                            {config.conditionType === 'survey_screen' && (
                                <div className="p-5 bg-blue-50 border border-blue-200 rounded-[28px] space-y-3 mt-4">
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
                                    <p className="text-[10px] text-blue-600 italic">Kiểm tra xem người dùng có được đưa tới đúng màn hình này khi kết thúc khảo sát không (Do rẽ nhánh nhảy trang Survey).</p>
                                </div>
                            )}
                        </>
                    ) : (
                        <Radio
                            label="Hành động kiểm tra:"
                            options={parentEmailStep?.type === 'zalo_zns' ? [
                                { id: 'zns_delivered', label: 'Đã nhận (Gửi thành công)', icon: CheckSquare, desc: 'Tin nhắn đã gửi thành công' },
                                { id: 'zns_clicked', label: 'Khách Click Link', icon: MousePointer2, desc: 'Theo dõi chuyển đổi link ZNS' },
                                { id: 'zns_replied', label: 'Khách Phản hồi', icon: MessageSquare, desc: 'Khách chat lại với OA' },
                                { id: 'zns_failed', label: 'Gửi thất bại', icon: AlertTriangle, desc: 'Gửi lại (Hết quota, sai số...)' },
                            ] : [
                                { id: 'delivered', label: 'Đã nhận (Delivered)', icon: MailCheck, desc: 'Nếu KHÔNG -> Chuyển nhánh ELSE' },
                                { id: 'opened', label: 'Khách Đã mở Email', icon: MailOpen, desc: 'Theo dõi tỷ lệ đọc' },
                                { id: 'clicked', label: 'Khách Click Link', icon: MousePointer2, desc: 'Theo dõi chuyển đổi' },
                                ...((parentEmailStep?.type === 'trigger' && parentEmailStep?.config?.type === 'campaign') ? [
                                    { id: 'received_reminder', label: 'Đã nhận Reminder', icon: Bell, desc: 'Đã nhận Email Nhắc nhở' },
                                    { id: 'opened_reminder', label: 'Đã mở Reminder', icon: MailOpen, desc: 'Đã mở Email Nhắc nhở' }
                                ] : []),
                                { id: 'unsubscribed', label: 'Hủy đăng ký', icon: UserMinus, desc: 'Phân loại khách rời đi' },
                            ]}
                            value={config.conditionType || (parentEmailStep?.type === 'zalo_zns' ? 'zns_delivered' : 'opened')}
                            onChange={handleTypeChange}
                            disabled={disabled}
                        />
                    )}

                    {/* Reminder ID Input */}
                    {['received_reminder', 'opened_reminder'].includes(config.conditionType) && (
                        <div className="p-5 bg-amber-50 border border-amber-200 rounded-[28px] space-y-2 mt-4">
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

                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-[28px] space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <Clock className="w-4 h-4 text-slate-500" />
                            <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Thời hạn kiểm tra (Timeout)</span>
                        </div>

                        <div className="flex items-center justify-between gap-4 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm hover:border-slate-200 transition-all cursor-pointer"
                             onClick={() => {
                                 if (disabled) return;
                                 if (config.waitDuration === 0) {
                                     onChange({ ...config, waitDuration: 1, waitUnit: 'hours' });
                                 } else {
                                     onChange({ ...config, waitDuration: 0, waitUnit: 'hours' });
                                 }
                             }}>
                            <div className="flex-1">
                                <p className="text-xs font-bold text-slate-800">Kiểm tra ngay lập tức (Không đợi)</p>
                                <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Đánh giá nhanh dựa trên lịch sử quá khứ. Nếu khách chưa {getActionDescription()}, tự động đi nhánh <strong>ELSE</strong> ngay lập tức.</p>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (disabled) return;
                                    if (config.waitDuration === 0) {
                                        onChange({ ...config, waitDuration: 1, waitUnit: 'hours' });
                                    } else {
                                        onChange({ ...config, waitDuration: 0, waitUnit: 'hours' });
                                    }
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-all duration-300 focus:outline-none ${config.waitDuration === 0 ? 'bg-amber-500' : 'bg-slate-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={disabled}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-md ${config.waitDuration === 0 ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {config.waitDuration !== 0 && (
                            <>
                                <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                                    Nếu sau Thời gian này khách vẫn chưa {getActionDescription()}, hệ thống sẽ đưa khách vào nhánh "ELSE".
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        type="number" min="1"
                                        value={config.waitDuration || 1}
                                        onChange={(e) => onChange({ ...config, waitDuration: parseInt(e.target.value) || 1 })}
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

                    {(config.conditionType === 'clicked' || config.conditionType === 'zns_clicked') && (
                        <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-4 duration-500" ref={linkContainerRef}>
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
                                    {/* Option for ANY Link using a Toggle Switch */}
                                    <div className={`p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${selectedLinks.length === 0 ? 'border-indigo-500 bg-indigo-50/50 shadow-sm ring-4 ring-indigo-500/5' : 'border-slate-100 bg-slate-50/30'}`}>
                                        <div className="flex-1">
                                            <p className="text-xs font-black text-slate-800">Theo dõi BẤT KỲ Link nào (Any)</p>
                                            <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">Hợp lệ nếu khách click vào bất cứ link nào có trong nội dung.</p>
                                        </div>
                                        <button
                                            onClick={() => {
                                                if (disabled) return;
                                                if (selectedLinks.length === 0) {
                                                    // Turning OFF 'Any' -> Select first link if available to enter specific mode
                                                    if (availableLinks.length > 0) {
                                                        onChange({ ...config, linkTargets: [availableLinks[0].url] });
                                                    }
                                                } else {
                                                    // Turning ON 'Any'
                                                    onChange({ ...config, linkTargets: [] });
                                                }
                                            }}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all duration-300 focus:outline-none ${selectedLinks.length === 0 ? 'bg-indigo-600' : 'bg-slate-300'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            disabled={disabled}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-300 shadow-md ${selectedLinks.length === 0 ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {/* Require Warning if mode is Specific but nothing selected */}
                                    {!disabled && selectedLinks.length === availableLinks.length && (
                                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3 animate-in fade-in zoom-in duration-300">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-amber-700 font-bold leading-relaxed lowercase first-letter:uppercase">Đang ở chế độ "Bất kỳ Link nào". Bạn nên chọn một link bất kỳ nếu bạn chỉ muốn theo dõi danh sách cụ thể.</p>
                                        </div>
                                    )}

                                    {/* Link List */}
                                    <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar p-1">
                                        {availableLinks.map((link) => {
                                            const isSelected = selectedLinks.length === 0 || selectedLinks.includes(link.url);
                                            return (
                                                <button
                                                    key={link.id}
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
                            ) : (
                                parentEmailStep.type === 'zalo_zns' ? (
                                    <div className="p-4 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-2xl text-xs font-bold flex items-center gap-2">
                                        <CheckSquare className="w-4 h-4" />
                                        Mặc định theo dõi BẤT KỲ LINK nào trong tin ZNS (Do không thể quét trước nội dung ZNS).
                                    </div>
                                ) : (
                                    <div className="p-4 bg-amber-50 text-amber-700 border border-amber-200 rounded-2xl text-xs font-bold flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4" />
                                        Không tìm thấy Link nào trong nội dung trước đó.
                                    </div>
                                )
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ConditionConfig;