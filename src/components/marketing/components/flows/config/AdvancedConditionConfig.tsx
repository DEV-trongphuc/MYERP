import * as React from 'react';
import { useState, useEffect } from 'react';
import { Plus, Trash2, AlertCircle, Layers, Globe, Smartphone, Monitor, User, MapPin, Calendar, List, X, GitMerge, ChevronDown } from 'lucide-react';
import Select from '../../common/Select';
// Actually, let's use raw HTML elements with Tailwind for granular control over "mini" size requested.

import { Flow } from '../../../types';

interface AdvancedConditionConfigProps {
    config: Record<string, any>;
    onChange: (newConfig: Record<string, any>) => void;
    flow?: Flow;
    stepId?: string;
    disabled?: boolean;
}

// --- CONSTANTS ---

const FIELD_TYPES = {
    STRING: 'string',
    NUMBER: 'number',
    DATE: 'date',
    ENUM: 'enum',
    ARRAY: 'array', // Tags
    LIST: 'list' // Special for "In List" check? No, field is string, operator is 'in_list'
};

const FIELDS = [
    { value: 'email', label: 'Email', icon: Monitor, type: FIELD_TYPES.STRING },
    { value: 'phone_number', label: 'Số điện thoại', icon: Smartphone, type: FIELD_TYPES.STRING },
    { value: 'first_name', label: 'Tên (First Name)', icon: User, type: FIELD_TYPES.STRING },
    { value: 'last_name', label: 'Họ (Last Name)', icon: User, type: FIELD_TYPES.STRING },
    { value: 'tags', label: 'Thẻ (Tags)', icon: Layers, type: FIELD_TYPES.ARRAY },
    { value: 'company_name', label: 'Công ty', icon: Monitor, type: FIELD_TYPES.STRING },
    { value: 'job_title', label: 'Chức danh', icon: User, type: FIELD_TYPES.STRING },
    { value: 'source', label: 'Nguồn gốc (Source)', icon: Globe, type: FIELD_TYPES.STRING },
    { value: 'salesperson', label: 'Nhân viên phụ trách', icon: User, type: FIELD_TYPES.STRING },
    { value: 'lead_score', label: 'Điểm Lead Score', icon: Monitor, type: FIELD_TYPES.NUMBER },
    { value: 'status', label: 'Trạng thái', icon: Monitor, type: FIELD_TYPES.ENUM, options: ['active', 'unsubscribed', 'lead', 'customer', 'bounced', 'complained'] },
    { value: 'verified', label: 'Đã xác thực', icon: Monitor, type: FIELD_TYPES.ENUM, options: ['1', '0'] },
    { value: 'os', label: 'Hệ điều hành (OS)', icon: Monitor, type: FIELD_TYPES.ENUM, options: ['Windows', 'MacOS', 'Linux', 'Android', 'iOS'] },
    { value: 'device', label: 'Thiết bị (Device)', icon: Smartphone, type: FIELD_TYPES.ENUM, options: ['Desktop', 'Mobile', 'Tablet'] },
    { value: 'browser', label: 'Trình duyệt', icon: Globe, type: FIELD_TYPES.ENUM, options: ['Chrome', 'Firefox', 'Safari', 'Edge'] },
    { value: 'address', label: 'Địa chỉ', icon: MapPin, type: FIELD_TYPES.STRING },
    { value: 'gender', label: 'Giới tính', icon: User, type: FIELD_TYPES.ENUM, options: ['Male', 'Female', 'Other'] },
    { value: 'joined_at', label: 'Ngày tham gia', icon: Calendar, type: FIELD_TYPES.DATE },
    { value: 'date_of_birth', label: 'Ngày sinh', icon: Calendar, type: FIELD_TYPES.DATE },
    { value: 'anniversary_date', label: 'Ngày kỷ niệm', icon: Calendar, type: FIELD_TYPES.DATE },
    { value: 'last_activity_at', label: 'Lần hoạt động cuối', icon: Calendar, type: FIELD_TYPES.DATE },
    { value: 'web_activity', label: 'Hành động Website', icon: Globe, type: FIELD_TYPES.STRING },
    { value: 'custom_field', label: 'Trường tùy chỉnh', icon: User, type: FIELD_TYPES.STRING },
];

const OPERATORS_BY_TYPE: Record<string, any[]> = {
    [FIELD_TYPES.STRING]: [
        { value: 'equals', label: 'Bằng (Is)' },
        { value: 'is_not', label: 'Khác (Is not)' },
        { value: 'contains', label: 'Chứa (Contains)' },
        { value: 'not_contains', label: 'Không chứa' },
        { value: 'starts_with', label: 'Bắt đầu bằng' },
        { value: 'ends_with', label: 'Kết thúc bằng' },
        { value: 'in_list', label: 'Trong danh sách (In List)', icon: List }, // NEW
        { value: 'is_set', label: 'Có giá trị' },
        { value: 'is_not_set', label: 'Trống' },
    ],
    [FIELD_TYPES.NUMBER]: [
        { value: 'equals', label: '=' },
        { value: 'greater_than', label: '>' },
        { value: 'less_than', label: '<' },
        { value: 'is_set', label: 'Có giá trị' },
        { value: 'is_not_set', label: 'Trống' },
    ],
    [FIELD_TYPES.DATE]: [
        { value: 'is_on', label: 'Chính xác ngày' },
        { value: 'is_before', label: 'Trước ngày' },
        { value: 'is_after', label: 'Sau ngày' },
        { value: 'is_set', label: 'Còngày' },
        { value: 'is_not_set', label: 'Chưa có ngày' },
    ],
    [FIELD_TYPES.ENUM]: [
        { value: 'equals', label: 'Là (Is)' },
        { value: 'is_not', label: 'Không là (Is not)' },
        { value: 'is_set', label: 'Đã nhập' },
        { value: 'is_not_set', label: 'Chưa nhập' },
    ],
    [FIELD_TYPES.ARRAY]: [ // Tags
        { value: 'contains', label: 'Có chứa Tag' },
        { value: 'not_contains', label: 'Không chứa Tag' },
        { value: 'is_set', label: 'Có Tag bất kỳ' },
        { value: 'is_not_set', label: 'Không có Tag nào' },
    ]
};

const AdvancedConditionConfig: React.FC<AdvancedConditionConfigProps> = ({ config, onChange, disabled }) => {
    const branches = config.branches || [];
    const [errors, setErrors] = useState<string[]>([]);

    // Simple UUID fallback for older browsers
    const generateId = () => {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    };

    // Auto-patch missing IDs
    useEffect(() => {
        if (disabled) return;
        let hasChanges = false;
        const patchedBranches = branches.map((b: any) => {
            if (!b.id) {
                hasChanges = true;
                return { ...b, id: generateId() };
            }
            return b;
        });
        if (hasChanges) onChange({ ...config, branches: patchedBranches });
    }, [JSON.stringify(branches)]);

    // Validation
    useEffect(() => {
        const errs: string[] = [];
        branches.forEach((b: any, bIdx: number) => {
            (b.conditions || []).forEach((c: any, cIdx: number) => {
                if (!['is_set', 'is_not_set'].includes(c.operator) && (!c.value || (typeof c.value === 'string' && !c.value.trim()))) {
                    errs.push(`Nhánh "${b.label || bIdx + 1}" - ĐK ${cIdx + 1}: Thiếu giá trị.`);
                }
            });
        });
        setErrors(errs);
    }, [JSON.stringify(config)]);


    // --- HANDLERS ---

    const handleAddBranch = () => {
        if (disabled) return;
        const newBranch = {
            id: generateId(),
            label: `Nhánh ${branches.length + 1}`,
            stepId: null,
            conditions: [{ field: 'email', operator: 'contains', value: '' }]
        };
        onChange({ ...config, branches: [...branches, newBranch] });
    };

    const handleRemoveBranch = (index: number) => {
        if (disabled) return;
        const newBranches = [...branches];
        newBranches.splice(index, 1);
        onChange({ ...config, branches: newBranches });
    };

    const updateBranch = (index: number, updates: any) => {
        if (disabled) return;
        const newBranches = [...branches];
        newBranches[index] = { ...newBranches[index], ...updates };
        onChange({ ...config, branches: newBranches });
    };

    const updateCondition = (branchIndex: number, condIndex: number, updates: any) => {
        if (disabled) return;
        const branch = branches[branchIndex];
        const newConditions = [...(branch.conditions || [])];

        // Smart Reset Logic: If Field changes, reset Operator & Value
        if (updates.field && updates.field !== newConditions[condIndex].field) {
            const fieldDef = FIELDS.find(f => f.value === updates.field);
            const defaultOp = OPERATORS_BY_TYPE[fieldDef?.type || FIELD_TYPES.STRING][0].value;
            updates.operator = defaultOp;
            updates.value = '';
        }

        // If Operator changes, reset Value (optional, but good for UX if switching to Date etc)
        if (updates.operator && updates.operator !== newConditions[condIndex].operator) {
            updates.value = ''; // Always clear value on operator change to avoid type mismatch
        }

        newConditions[condIndex] = { ...newConditions[condIndex], ...updates };
        updateBranch(branchIndex, { conditions: newConditions });
    };

    const addCondition = (branchIndex: number) => {
        if (disabled) return;
        const branch = branches[branchIndex];
        const newConditions = [...(branch.conditions || []), { field: 'email', operator: 'contains', value: '' }];
        updateBranch(branchIndex, { conditions: newConditions });
    };

    const removeCondition = (branchIndex: number, condIndex: number) => {
        if (disabled) return;
        const branch = branches[branchIndex];
        const newConditions = [...(branch.conditions || [])];
        newConditions.splice(condIndex, 1);
        updateBranch(branchIndex, { conditions: newConditions });
    };

    // --- RENDERERS ---

    const renderValueInput = (mode: any, operator: string, value: any, onChangeVal: (val: any) => void) => {
        const isSetLike = ['is_set', 'is_not_set'].includes(operator);
        if (isSetLike) return null;

        if (operator === 'in_list') {
            return (
                <textarea
                    value={value}
                    onChange={(e) => onChangeVal(e.target.value)}
                    placeholder="Nhập danh sách..."
                    className="w-full text-[11px] border border-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none min-h-[60px] font-medium text-slate-700 placeholder:text-slate-400 bg-slate-50/50 hover:bg-white transition-all"
                />
            );
        }

        if (mode.type === FIELD_TYPES.DATE) {
            return (
                <div className="relative group w-full min-w-0">
                    <input
                        type="date"
                        value={value}
                        onChange={(e) => onChangeVal(e.target.value)}
                        className="w-full h-8 text-[11px] border border-slate-200 rounded-xl px-2.5 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-700 bg-slate-50/50 hover:bg-white transition-all shadow-sm"
                    />
                </div>
            );
        }

        if (mode.type === FIELD_TYPES.ENUM && mode.options) {
            return (
                <div className="w-full min-w-0">
                    <Select
                        value={value}
                        onChange={onChangeVal}
                        options={mode.options.map((opt: string) => ({ value: opt, label: opt }))}
                        size="sm"
                        variant="filled"
                        placeholder="-- Chọn --"
                    />
                </div>
            );
        }

        return (
            <div className="flex items-center gap-1.5 w-full min-w-0">
                <input
                    type={(mode.type === FIELD_TYPES.NUMBER) ? "number" : "text"}
                    value={value}
                    onChange={(e) => onChangeVal(e.target.value)}
                    placeholder={mode.value === 'web_activity' ? "Keywords..." : "Giá trị..."}
                    className="flex-1 w-full h-8 text-[11px] border border-slate-200 rounded-xl px-3 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-700 placeholder:text-slate-400 bg-slate-50/50 hover:bg-white transition-all shadow-sm truncate"
                />
            </div>
        );
    };

    return (
        <div className="space-y-5 pb-10">
            {errors.length > 0 && (
                <div className="bg-rose-50 border border-rose-100 p-2.5 rounded-xl flex items-start gap-2 text-rose-600 text-[11px] shadow-sm">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <ul className="list-disc pl-4 space-y-0.5">
                        {errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                </div>
            )}

            <div className="space-y-5">
                {branches.map((branch: any, bIdx: number) => (
                    <div key={branch.id} className="relative group/branch bg-white border border-slate-200 rounded-2xl p-3.5 shadow-sm hover:shadow-md hover:border-purple-200 transition-all">
                        {/* Decorative Accent */}
                        <div className="absolute top-3 bottom-3 left-0 w-1 bg-purple-500 rounded-r-full"></div>

                        <div className="flex items-center justify-between mb-3 pl-3">
                            <input
                                type="text"
                                value={branch.label}
                                onChange={(e) => updateBranch(bIdx, { label: e.target.value })}
                                className="text-[11px] font-black uppercase tracking-widest text-purple-900 bg-transparent border-b border-transparent hover:border-purple-200 focus:border-purple-500 focus:outline-none py-1 px-1 min-w-[150px]"
                                placeholder={`NHÁNH ${bIdx + 1}`}
                            />
                            {/* Remove Branch Btn */}
                            <button
                                onClick={() => handleRemoveBranch(bIdx)}
                                className="text-slate-300 hover:text-rose-500 p-1.5 rounded-lg hover:bg-rose-50 transition-all opacity-0 group-hover/branch:opacity-100"
                                title="Xóa nhánh này"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="space-y-2.5 pl-3">
                            {(branch.conditions || []).map((cond: any, cIdx: number) => {
                                const fieldDef = FIELDS.find(f => f.value === cond.field) || FIELDS[0];
                                const ops = OPERATORS_BY_TYPE[fieldDef.type] || OPERATORS_BY_TYPE[FIELD_TYPES.STRING];

                                return (
                                    <div key={cIdx} className="flex items-center gap-2 p-1 relative group/cond">
                                        <div className="w-8 shrink-0 flex justify-center">
                                            <span className={`text-[9px] font-black px-2 py-0.5 rounded-full shadow-sm border ${cIdx === 0 ? 'bg-purple-50 text-purple-600 border-purple-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                                {cIdx === 0 ? 'IF' : 'AND'}
                                            </span>
                                        </div>

                                        <div className="flex-1 min-w-0 grid grid-cols-12 gap-2">
                                            {/* FIELD SELECT */}
                                            <div className="col-span-3 min-w-0">
                                                <Select
                                                    value={cond.field}
                                                    onChange={(val) => updateCondition(bIdx, cIdx, { field: val })}
                                                    options={FIELDS}
                                                    size="sm"
                                                    variant="filled"
                                                />
                                            </div>

                                            {/* OPERATOR SELECT */}
                                            <div className="col-span-3 min-w-0">
                                                <Select
                                                    value={cond.operator}
                                                    onChange={(val) => updateCondition(bIdx, cIdx, { operator: val })}
                                                    options={ops}
                                                    size="sm"
                                                    variant="filled"
                                                />
                                            </div>

                                            {/* VALUE / INPUT AREA */}
                                            <div className="col-span-6 min-w-0 flex gap-2">
                                                {/* CUSTOM FIELD KEY */}
                                                {cond.field === 'custom_field' && (
                                                    <div className="w-1/3 min-w-0">
                                                        <input
                                                            type="text"
                                                            value={cond.key || ''}
                                                            onChange={(e) => updateCondition(bIdx, cIdx, { key: e.target.value })}
                                                            placeholder="Key..."
                                                            className="w-full h-8 text-[11px] border border-slate-200 rounded-xl px-3 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-700 placeholder:text-slate-400 bg-slate-50/50 hover:bg-white transition-all shadow-sm truncate"
                                                        />
                                                    </div>
                                                )}

                                                <div className="flex-1 min-w-0">
                                                    {renderValueInput(fieldDef, cond.operator, cond.value, (val) => updateCondition(bIdx, cIdx, { value: val }))}
                                                </div>

                                                {/* PAGE URL FOR WEB ACTIVITY */}
                                                {cond.field === 'web_activity' && (
                                                    <div className="w-1/3 min-w-0">
                                                        <input
                                                            type="text"
                                                            value={cond.page_url || ''}
                                                            onChange={(e) => updateCondition(bIdx, cIdx, { page_url: e.target.value })}
                                                            placeholder="URL..."
                                                            className="w-full h-8 text-[11px] border border-slate-200 rounded-xl px-2 focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-700 placeholder:text-slate-400 bg-slate-50/50 hover:bg-white transition-all shadow-sm truncate"
                                                        />
                                                    </div>
                                                )}
                                                
                                                {/* LOOKBACK */}
                                                {cond.field === 'web_activity' && (
                                                    <div className="w-12 shrink-0">
                                                        <div className="relative group">
                                                            <select
                                                                value={cond.lookback || 10}
                                                                onChange={(e) => updateCondition(bIdx, cIdx, { lookback: e.target.value })}
                                                                className="w-full h-8 text-[10px] border border-slate-200 rounded-xl pl-1 pr-1 appearance-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 outline-none font-bold text-slate-500 bg-slate-50/50 hover:bg-white transition-all shadow-sm text-center"
                                                                title="Số hành động gần nhất"
                                                            >
                                                                <option value="5">5</option>
                                                                <option value="10">10</option>
                                                                <option value="20">20</option>
                                                                <option value="50">50</option>
                                                            </select>
                                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                                                <ChevronDown className="w-2.5 h-2.5" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => removeCondition(bIdx, cIdx)}
                                            className="text-slate-300 hover:text-rose-500 p-1 opacity-0 group-hover/cond:opacity-100 transition-all ml-1"
                                            title="Xóa điều kiện"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="pl-12 mt-3">
                            <button
                                onClick={() => addCondition(bIdx)}
                                className="text-[10px] text-purple-600 hover:text-purple-700 font-bold flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 transition-all border border-purple-100/50"
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Thêm điều kiện
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <button
                onClick={handleAddBranch}
                className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all flex items-center justify-center gap-2 group"
            >
                <GitMerge className="w-4 h-4 group-hover:scale-110 transition-transform" />
                Thêm Nhánh Mới
            </button>
        </div>
    );
};

export default AdvancedConditionConfig;

