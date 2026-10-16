import React, { useState, useEffect } from 'react';
import { Survey } from '../../../types/survey';
import { api } from '../../../services/storageAdapter';
import { Gift, Plus, Trash2 } from 'lucide-react';
import Select from '../../common/Select';

interface Props {
    survey: Survey;
    onUpdateSurvey: (changes: Partial<Survey>) => void;
}

const VoucherConfigurator: React.FC<Props> = ({ survey, onUpdateSurvey }) => {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        api.get<any[]>('voucher_campaigns').then(res => {
            if (res.success) {
                setCampaigns(res.data?.filter(c => c.status === 'active') || []);
            }
        }).finally(() => setLoading(false));
    }, []);

    const config = survey.settings?.voucher_config || { enabled: false };
    const selectedCamp = campaigns.find(c => c.id === config.campaign_id);
    const rewards = selectedCamp?.rewards || [];

    const updateConfig = (changes: Partial<typeof config>) => {
        onUpdateSurvey({
            settings: {
                ...survey.settings!,
                voucher_config: { ...config, ...changes }
            }
        });
    };

    const addMapping = () => {
        const logic_mappings = [...(config.logic_mappings || [])];
        logic_mappings.push({
            condition: { question_id: '', operator: 'equals', value: '' },
            reward_item_id: rewards[0]?.id || ''
        });
        updateConfig({ logic_mappings });
    };

    const updateMapping = (index: number, changes: any) => {
        const logic_mappings = [...(config.logic_mappings || [])];
        logic_mappings[index] = { ...logic_mappings[index], ...changes };
        updateConfig({ logic_mappings });
    };

    const removeMapping = (index: number) => {
        const logic_mappings = [...(config.logic_mappings || [])];
        logic_mappings.splice(index, 1);
        updateConfig({ logic_mappings });
    };

    const questions = survey.blocks.filter(b => !['section_header', 'image_block', 'divider', 'page_break', 'button_block', 'link_block', 'banner_block'].includes(b.type));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Bật tặng Voucher tự động</span>
                <button 
                    onClick={() => updateConfig({ enabled: !config.enabled })} 
                    className={`relative w-9 h-5 rounded-full transition-colors ${config.enabled ? 'bg-amber-500' : 'bg-slate-200'}`}
                >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${config.enabled ? 'left-4' : 'left-0.5'}`} />
                </button>
            </div>

            {config.enabled && (
                <div className="space-y-4 border-t border-slate-100 pt-3">
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Chọn Nhóm Voucher</label>
                        <Select
                            options={[
                                { label: '-- Không chọn --', value: '' },
                                ...campaigns.map(c => ({ label: c.name, value: c.id }))
                            ]}
                            value={config.campaign_id || ''}
                            onChange={v => updateConfig({ campaign_id: v, logic_mappings: [], fallback_reward_item_id: '' })}
                            size="sm"
                            className="!bg-white"
                        />
                        {loading && <p className="text-[10px] text-slate-400 mt-1">Đang tải...</p>}
                    </div>

                    {selectedCamp && (
                        <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100 space-y-3">
                            <div className="flex items-center gap-1.5 text-amber-700 font-medium text-xs mb-2">
                                <Gift className="w-3.5 h-3.5" />
                                <span>Cấu hình điều kiện tặng quà</span>
                            </div>

                            {rewards.length > 1 && (
                                <>
                                    <div className="space-y-2">
                                        {(config.logic_mappings || []).map((mapping, idx) => (
                                            <div key={idx} className="p-2.5 bg-white border border-slate-200 rounded-lg space-y-2 relative">
                                                <button onClick={() => removeMapping(idx)} className="absolute top-2 right-2 text-slate-300 hover:text-red-500">
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                                <div>
                                                    <label className="block text-[9px] text-slate-500 mb-1">Nếu câu hỏi:</label>
                                                    <Select
                                                        options={[{ label: 'Chọn câu hỏi...', value: '' }, ...questions.map(q => ({ label: q.label || '(Không tiêu đề)', value: q.id }))]}
                                                        value={mapping.condition.question_id}
                                                        onChange={v => updateMapping(idx, { condition: { ...mapping.condition, question_id: v } })}
                                                        size="sm"
                                                        className="!text-xs"
                                                    />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="block text-[9px] text-slate-500 mb-1">Toán tử:</label>
                                                        <Select
                                                            options={[
                                                                { label: 'Bằng (Khớp xác)', value: 'equals' },
                                                                { label: 'Chứa từ khóa', value: 'contains' },
                                                                { label: 'Đã trả lời', value: 'is_answered' }
                                                            ]}
                                                            value={mapping.condition.operator}
                                                            onChange={v => updateMapping(idx, { condition: { ...mapping.condition, operator: v } })}
                                                            size="sm"
                                                            className="!text-xs"
                                                        />
                                                    </div>
                                                    {mapping.condition.operator !== 'is_answered' && (
                                                        <div>
                                                            <label className="block text-[9px] text-slate-500 mb-1">Giá trị:</label>
                                                            <input
                                                                type="text"
                                                                value={mapping.condition.value as string}
                                                                onChange={e => updateMapping(idx, { condition: { ...mapping.condition, value: e.target.value } })}
                                                                className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded outline-none focus:border-amber-400"
                                                                placeholder="Nhập..."
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <label className="block text-[9px] text-slate-500 mb-1">Thì tặng phần quà:</label>
                                                    <Select
                                                        options={rewards.map((r: any) => ({ label: `Quà ${r.discountType} (${r.value || ''})`, value: r.id }))}
                                                        value={mapping.reward_item_id || ''}
                                                        onChange={v => updateMapping(idx, { reward_item_id: v })}
                                                        size="sm"
                                                        className="!text-xs"
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button onClick={addMapping} className="flex items-center justify-center w-full gap-1 py-1.5 border border-dashed border-amber-300 rounded-lg text-[10px] text-amber-600 hover:bg-amber-100 font-medium">
                                        <Plus className="w-3 h-3" /> Thêm điều kiện nhận quà
                                    </button>
                                </>
                            )}

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Phần quà mặc định (Fallback)</label>
                                <p className="text-[9px] text-slate-500 mb-1.5 leading-tight">Quà sẽ được tặng nếu không có điều kiện nào khớp (hoặc khi chiến dịch chỉ có 1 phần quà).</p>
                                <Select
                                    options={[
                                        { label: '-- Không tặng gì --', value: '' },
                                        ...rewards.map((r: any) => ({ label: `Quà ${r.discountType} (${r.value || ''})`, value: r.id }))
                                    ]}
                                    value={config.fallback_reward_item_id || ''}
                                    onChange={v => updateConfig({ fallback_reward_item_id: v })}
                                    size="sm"
                                    className="!bg-white"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default VoucherConfigurator;
