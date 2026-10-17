import React, { useState, useEffect, useCallback } from 'react';
import {
    Save, List, Trash2, Plus, Loader2, Filter, Layers, Sparkles,
    Users, CheckCircle2, Flame, DollarSign, UserX, Mail, Globe,
    Calendar, RefreshCw, X, Search, Phone, Building2
} from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import ConfirmModal from '../common/ConfirmModal';
import erpApi from '../../../../api/axios';
import { api as domationApi } from '../../services/storageAdapter';

export interface DeepFilterCondition {
    id: string;
    field: string;
    operator: string;
    value: string;
    timeframe?: string;
    targetId?: string;
    by_user_id?: string;
}

export interface DeepFilterGroup {
    id: string;
    logic: 'AND' | 'OR';
    conditions: DeepFilterCondition[];
}

export interface DeepFilterCriteria {
    logic: 'AND' | 'OR';
    groups: DeepFilterGroup[];
}

export interface ListSavePayload {
    name: string;
    description?: string;
    source: string;
    criteria?: DeepFilterCriteria | string;
    auto_populate?: boolean;
    include_crm_contacts?: boolean;
}

interface ListFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (listData: ListSavePayload, isNew: boolean) => void | Promise<void>;
    onDelete?: (listId: string) => void;
    list?: any;
    isNew?: boolean;
}

const DEEP_FILTER_FIELDS = [
    // Học viên, Lớp học & Tài chính (MYERP)
    { value: 'erp_is_student', label: 'Phân loại Học viên / Lead (MYERP)', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    { value: 'erp_student_status', label: 'Trạng thái Học vụ (Đang học / Tốt nghiệp / Bảo lưu)', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    { value: 'erp_class_id', label: 'Lớp học / Khóa học (MYERP Class)', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    { value: 'erp_tuition_status', label: 'Trạng thái Học phí & Công nợ', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    { value: 'erp_deal_status', label: 'Trạng thái Cơ hội (CRM Deal)', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    { value: 'erp_deal_value', label: 'Tổng giá trị Deal (VNĐ)', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    { value: 'erp_sla_uncontacted_hours', label: 'Quá hạn SLA chưa chăm sóc (Số giờ)', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    { value: 'erp_ticket_status', label: 'Trạng thái Ticket Hỗ trợ / Học vụ', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    { value: 'erp_has_certificate', label: 'Chứng chỉ / Bằng tốt nghiệp', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    // Phễu & Trạng thái CRM
    { value: 'crm_stage_id', label: 'Giai đoạn Pipeline (CRM Stage)', group: 'Phễu & Phân loại CRM' },
    { value: 'crm_lead_status', label: 'Trạng thái Lead (Active / Nurture / Lost)', group: 'Phễu & Phân loại CRM' },
    { value: 'crm_temperature', label: 'Độ nóng Lead (Hot / Warm / Cold)', group: 'Phễu & Phân loại CRM' },
    { value: 'crm_program', label: 'Chương trình học quan tâm', group: 'Phễu & Phân loại CRM' },
    { value: 'source', label: 'Nguồn khách hàng (Source)', group: 'Phễu & Phân loại CRM' },
    { value: 'tag', label: 'Nhãn phân loại (Tag)', group: 'Phễu & Phân loại CRM' },
    // Phụ trách & Chi nhánh
    { value: 'crm_owner_id', label: 'Nhân sự Sale phụ trách', group: 'Phụ trách & Chi nhánh' },
    { value: 'crm_branch_id', label: 'Cơ sở / Chi nhánh', group: 'Phụ trách & Chi nhánh' },
    // Tài chính & Đặt cọc
    { value: 'crm_deposit_status', label: 'Trạng thái Đặt cọc / Đóng phí', group: 'Tài chính & Đặt cọc' },
    { value: 'crm_deposit_amount', label: 'Số tiền đã cọc (VNĐ)', group: 'Tài chính & Đặt cọc' },
    // Nhân khẩu học & Liên hệ
    { value: 'has_email', label: 'Tình trạng Email', group: 'Thông tin Liên hệ & Nhân khẩu' },
    { value: 'has_phone', label: 'Tình trạng Số điện thoại', group: 'Thông tin Liên hệ & Nhân khẩu' },
    { value: 'city', label: 'Tỉnh / Thành phố', group: 'Thông tin Liên hệ & Nhân khẩu' },
    { value: 'district', label: 'Quận / Huyện', group: 'Thông tin Liên hệ & Nhân khẩu' },
    { value: 'gender', label: 'Giới tính', group: 'Thông tin Liên hệ & Nhân khẩu' },
    { value: 'jobTitle', label: 'Nghề nghiệp / Chức vụ', group: 'Thông tin Liên hệ & Nhân khẩu' },
    // Lịch sử tương tác & Thời gian
    { value: 'activity_history', label: 'Lịch sử Tương tác (Sale / Email / Zalo / Form)', group: 'Lịch sử Tương tác & Thời gian' },
    { value: 'lastActivity', label: 'Lần tương tác gần nhất', group: 'Lịch sử Tương tác & Thời gian' },
    { value: 'crm_created_at', label: 'Ngày tạo Lead', group: 'Lịch sử Tương tác & Thời gian' },
];

const ACTIVITY_TYPES = [
    { value: 'any_crm_activity', label: 'Bất kỳ tương tác chăm sóc CRM nào' },
    { value: 'crm_call', label: 'Đã gọi điện tư vấn (Call Log)' },
    { value: 'crm_meeting', label: 'Đã hẹn gặp / Tư vấn trực tiếp (Meeting)' },
    { value: 'crm_note', label: 'Có ghi chú chăm sóc (Sale Note)' },
    { value: 'open_email', label: 'Đã mở chiến dịch Email (Open Email)' },
    { value: 'click_link', label: 'Đã bấm link trong Email (Click Link)' },
    { value: 'zalo_interaction', label: 'Có tương tác Zalo OA / ZNS' },
    { value: 'submit_form', label: 'Đã điền Biểu mẫu (Form Submit)' },
    { value: 'complete_survey', label: 'Đã hoàn thành Khảo sát (Survey)' },
];

const ACTIVITY_TIMEFRAMES = [
    { value: 'anytime', label: 'Bất kỳ lúc nào' },
    { value: '7d', label: 'Trong 7 ngày qua' },
    { value: '30d', label: 'Trong 30 ngày qua' },
    { value: '90d', label: 'Trong 90 ngày qua' },
];

const QUICK_PRESETS = [
    {
        id: 'studying_students',
        label: 'Học viên đang theo học',
        icon: Users,
        color: 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
        condition: { field: 'erp_student_status', operator: 'is', value: 'studying' }
    },
    {
        id: 'tuition_debt',
        label: 'Học viên còn công nợ học phí',
        icon: DollarSign,
        color: 'text-rose-600 bg-rose-50 border-rose-200 hover:bg-rose-100',
        condition: { field: 'erp_tuition_status', operator: 'is', value: 'has_debt' }
    },
    {
        id: 'sla_uncontacted_24h',
        label: 'Lead mới quá hạn SLA 24h chưa chăm sóc',
        icon: UserX,
        color: 'text-amber-700 bg-amber-50 border-amber-200 hover:bg-amber-100',
        condition: { field: 'erp_sla_uncontacted_hours', operator: 'greater_than', value: '24' }
    },
    {
        id: 'graduated_certified',
        label: 'Học viên đã tốt nghiệp / Cấp chứng chỉ',
        icon: CheckCircle2,
        color: 'text-indigo-700 bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
        condition: { field: 'erp_has_certificate', operator: 'is', value: 'yes' }
    },
    {
        id: 'hot_leads',
        label: 'Lead Nóng (Hot)',
        icon: Flame,
        color: 'text-orange-600 bg-orange-50 border-orange-200 hover:bg-orange-100',
        condition: { field: 'crm_temperature', operator: 'is', value: 'hot' }
    },
    {
        id: 'deposited',
        label: 'Đã cọc tiền',
        icon: DollarSign,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200 hover:bg-emerald-100',
        condition: { field: 'crm_deposit_status', operator: 'is', value: 'approved' }
    },
    {
        id: 'unassigned',
        label: 'Chưa phân bổ Sale',
        icon: UserX,
        color: 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100',
        condition: { field: 'crm_owner_id', operator: 'is_empty', value: '' }
    },
    {
        id: 'valid_email',
        label: 'Có Email hợp lệ',
        icon: Mail,
        color: 'text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100',
        condition: { field: 'has_email', operator: 'is_not_empty', value: '1' }
    },
    {
        id: 'fb_leads',
        label: 'Lead Facebook Ads',
        icon: Globe,
        color: 'text-indigo-600 bg-indigo-50 border-indigo-200 hover:bg-indigo-100',
        condition: { field: 'source', operator: 'contains', value: 'Facebook' }
    },
    {
        id: 'recent_30d',
        label: 'Tạo trong 30 ngày qua',
        icon: Calendar,
        color: 'text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100',
        condition: { field: 'crm_created_at', operator: 'within_days', value: '30' }
    }
];

const getOperatorsForField = (field: string) => {
    switch (field) {
        case 'erp_is_student':
        case 'erp_student_status':
        case 'erp_class_id':
        case 'erp_tuition_status':
        case 'erp_deal_status':
        case 'erp_ticket_status':
        case 'erp_has_certificate':
        case 'crm_stage_id':
        case 'crm_lead_status':
        case 'crm_temperature':
        case 'crm_branch_id':
        case 'crm_deposit_status':
        case 'gender':
            return [
                { value: 'is', label: 'Là (Bằng)' },
                { value: 'is_not', label: 'Không phải là' }
            ];
        case 'crm_owner_id':
            return [
                { value: 'is', label: 'Phụ trách bởi' },
                { value: 'is_not', label: 'Không phải phụ trách bởi' },
                { value: 'is_empty', label: 'Chưa phân bổ Sale (Trống)' },
                { value: 'is_not_empty', label: 'Đã có Sale phụ trách' }
            ];
        case 'crm_deposit_amount':
        case 'erp_deal_value':
        case 'erp_sla_uncontacted_hours':
            return [
                { value: 'greater_than', label: 'Lớn hơn hoặc bằng (>=)' },
                { value: 'equals', label: 'Bằng (=)' },
                { value: 'less_than', label: 'Nhỏ hơn (<)' }
            ];
        case 'tag':
            return [
                { value: 'contains', label: 'Có gắn nhãn (Contains)' },
                { value: 'not_contains', label: 'Không gắn nhãn (Not Contains)' }
            ];
        case 'has_email':
        case 'has_phone':
            return [
                { value: 'is_not_empty', label: 'Có thông tin hợp lệ' },
                { value: 'is_empty', label: 'Chưa có (Trống)' }
            ];
        case 'activity_history':
            return [
                { value: 'has_done', label: 'Đã thực hiện / Có phát sinh' },
                { value: 'has_not_done', label: 'Chưa từng thực hiện' }
            ];
        case 'lastActivity':
        case 'crm_created_at':
            return [
                { value: 'within_days', label: 'Trong vòng (X ngày qua)' },
                { value: 'more_than_days', label: 'Quá hạn hơn (X ngày trước)' },
                { value: 'after', label: 'Từ ngày (YYYY-MM-DD)' },
                { value: 'before', label: 'Trước ngày (YYYY-MM-DD)' },
                { value: 'is_empty', label: 'Chưa từng có tương tác' }
            ];
        default:
            return [
                { value: 'contains', label: 'Chứa từ khóa' },
                { value: 'is', label: 'Chính xác là' },
                { value: 'is_not', label: 'Không phải là' },
                { value: 'is_empty', label: 'Đang trống' },
                { value: 'is_not_empty', label: 'Không trống' }
            ];
    }
};

const createDefaultCondition = (): DeepFilterCondition => ({
    id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    field: 'crm_stage_id',
    operator: 'is',
    value: ''
});

const ListFormModal: React.FC<ListFormModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDelete,
    list,
    isNew = false
}) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [source, setSource] = useState('Manual');
    const [creationMode, setCreationMode] = useState<'empty' | 'filter'>('empty');
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Dynamic MYERP & Marketing Metadata
    const [pipelineStages, setPipelineStages] = useState<Array<{ id: string; name: string }>>([]);
    const [consultants, setConsultants] = useState<Array<{ id: string; name: string; role?: string }>>([]);
    const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
    const [erpClasses, setErpClasses] = useState<Array<{ id: string; name: string; code?: string }>>([]);
    const [availableTags, setAvailableTags] = useState<string[]>([]);
    const [programs, setPrograms] = useState<string[]>([]);
    const [campaigns, setCampaigns] = useState<Array<{ id: string; name: string }>>([]);
    const [metaLoading, setMetaLoading] = useState(false);

    // Multi-Group Criteria State
    const [criteria, setCriteria] = useState<DeepFilterCriteria>({
        logic: 'AND',
        groups: [
            {
                id: 'group-1',
                logic: 'AND',
                conditions: [
                    { id: 'cond-init-1', field: 'has_email', operator: 'is_not_empty', value: '1' }
                ]
            }
        ]
    });

    // Live Preview State
    const [previewCount, setPreviewCount] = useState<number>(0);
    const [previewContacts, setPreviewContacts] = useState<any[]>([]);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    // Load MYERP & Marketing metadata on open
    useEffect(() => {
        if (!isOpen) return;
        setName(list?.name || '');
        setDescription(list?.description || '');
        setSource(list?.source || 'Manual');
        setCreationMode('empty');

        const fetchMetadata = async () => {
            setMetaLoading(true);
            try {
                const [stagesRes, usersRes, branchesRes, classesRes, erpTagsRes, mktTagsRes, programsRes, campaignsRes] =
                    await Promise.allSettled([
                        erpApi.get('/pipeline-stages'),
                        erpApi.get('/users?all=1'),
                        erpApi.get('/branches'),
                        erpApi.get('/classes').catch(() => erpApi.get('/projects')),
                        erpApi.get('/tags'),
                        domationApi.get<any[]>('tags'),
                        erpApi.get('/contacts/programs'),
                        domationApi.get<any[]>('campaigns')
                    ]);

                if (stagesRes.status === 'fulfilled' && stagesRes.value?.data) {
                    const raw = stagesRes.value.data?.data ?? stagesRes.value.data;
                    const arr = Array.isArray(raw) ? raw : (raw?.items || []);
                    setPipelineStages(arr.map((s: any) => ({ id: String(s.id), name: s.name || s.title || `Stage #${s.id}` })));
                }

                if (usersRes.status === 'fulfilled' && usersRes.value?.data) {
                    const raw = usersRes.value.data?.data ?? usersRes.value.data;
                    const arr = Array.isArray(raw) ? raw : (raw?.items || []);
                    setConsultants(
                        arr.map((u: any) => ({
                            id: String(u.id),
                            name: u.full_name || u.name || u.username || `User #${u.id}`,
                            role: u.role
                        }))
                    );
                }

                if (branchesRes.status === 'fulfilled' && branchesRes.value?.data) {
                    const raw = branchesRes.value.data?.data ?? branchesRes.value.data;
                    const arr = Array.isArray(raw) ? raw : (raw?.items || []);
                    setBranches(arr.map((b: any) => ({ id: String(b.id), name: b.name || b.branch_name || `Cơ sở #${b.id}` })));
                }

                if (classesRes.status === 'fulfilled' && classesRes.value?.data) {
                    const raw = classesRes.value.data?.data ?? classesRes.value.data;
                    const arr = Array.isArray(raw) ? raw : (raw?.items || []);
                    setErpClasses(
                        arr.map((cl: any) => ({
                            id: String(cl.id || cl.name),
                            name: cl.name || cl.title || `Lớp #${cl.id}`,
                            code: cl.code
                        }))
                    );
                }

                const tagSet = new Set<string>();
                if (erpTagsRes.status === 'fulfilled' && erpTagsRes.value?.data) {
                    const raw = erpTagsRes.value.data?.data ?? erpTagsRes.value.data;
                    const arr = Array.isArray(raw) ? raw : (raw?.items || []);
                    arr.forEach((t: any) => {
                        const tName = typeof t === 'string' ? t : (t?.name || t?.tag);
                        if (tName) tagSet.add(String(tName).trim());
                    });
                }
                if (mktTagsRes.status === 'fulfilled' && mktTagsRes.value?.success && Array.isArray(mktTagsRes.value.data)) {
                    mktTagsRes.value.data.forEach((t: any) => {
                        const tName = typeof t === 'string' ? t : t?.name;
                        if (tName) tagSet.add(String(tName).trim());
                    });
                }
                setAvailableTags(Array.from(tagSet));

                if (programsRes.status === 'fulfilled' && programsRes.value?.data) {
                    const raw = programsRes.value.data?.data ?? programsRes.value.data;
                    if (Array.isArray(raw)) {
                        setPrograms(raw.map((p: any) => typeof p === 'string' ? p : (p?.program || p?.name || '')).filter(Boolean));
                    }
                }

                if (campaignsRes.status === 'fulfilled' && campaignsRes.value?.success && Array.isArray(campaignsRes.value.data)) {
                    setCampaigns(
                        campaignsRes.value.data.map((c: any) => ({
                            id: String(c.id),
                            name: c.name || c.title || `Chiến dịch #${c.id}`
                        }))
                    );
                }
            } catch (err) {
                console.error('Failed to load MYERP metadata in ListFormModal:', err);
            } finally {
                setMetaLoading(false);
            }
        };

        fetchMetadata();
    }, [isOpen, list]);

    // Live Preview Evaluation when in 'filter' mode
    const runLivePreview = useCallback(async (currentCriteria: DeepFilterCriteria) => {
        setIsPreviewLoading(true);
        try {
            const res = await domationApi.post<any>('segments?action=preview', {
                criteria: JSON.stringify(currentCriteria),
                include_crm_contacts: true
            });
            if (res.success && res.data) {
                setPreviewCount(Number(res.data.count || 0));
                setPreviewContacts(Array.isArray(res.data.sample) ? res.data.sample : []);
            } else {
                setPreviewCount(0);
                setPreviewContacts([]);
            }
        } catch (err) {
            console.error('Error previewing static list criteria:', err);
        } finally {
            setIsPreviewLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isOpen || !isNew || creationMode !== 'filter') return;
        const timer = setTimeout(() => {
            runLivePreview(criteria);
        }, 380);
        return () => clearTimeout(timer);
    }, [isOpen, isNew, creationMode, criteria, runLivePreview]);

    const applyPresetChip = (preset: typeof QUICK_PRESETS[number]) => {
        setCriteria(prev => {
            const firstGroup = prev.groups[0] || { id: 'group-1', logic: 'AND' as const, conditions: [] };
            const exists = firstGroup.conditions.some(
                c => c.field === preset.condition.field && c.operator === preset.condition.operator && c.value === preset.condition.value
            );
            if (exists) {
                toast('Điều kiện này đã có trong bộ lọc', { icon: 'ℹ️' });
                return prev;
            }
            const nextCond: DeepFilterCondition = {
                id: `cond-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                field: preset.condition.field,
                operator: preset.condition.operator,
                value: preset.condition.value
            };
            const updatedGroups = [...prev.groups];
            updatedGroups[0] = {
                ...firstGroup,
                conditions: [...firstGroup.conditions, nextCond]
            };
            return { ...prev, groups: updatedGroups };
        });
    };

    const handleAddGroup = () => {
        setCriteria(prev => ({
            ...prev,
            groups: [
                ...prev.groups,
                {
                    id: `group-${Date.now()}`,
                    logic: 'AND',
                    conditions: [createDefaultCondition()]
                }
            ]
        }));
    };

    const handleRemoveGroup = (groupId: string) => {
        if (criteria.groups.length <= 1) return;
        setCriteria(prev => ({
            ...prev,
            groups: prev.groups.filter(g => g.id !== groupId)
        }));
    };

    const handleAddCondition = (groupId: string) => {
        setCriteria(prev => ({
            ...prev,
            groups: prev.groups.map(g =>
                g.id === groupId ? { ...g, conditions: [...g.conditions, createDefaultCondition()] } : g
            )
        }));
    };

    const handleRemoveCondition = (groupId: string, condId: string) => {
        setCriteria(prev => ({
            ...prev,
            groups: prev.groups.map(g => {
                if (g.id !== groupId) return g;
                if (g.conditions.length <= 1) return g;
                return { ...g, conditions: g.conditions.filter(c => c.id !== condId) };
            })
        }));
    };

    const handleUpdateCondition = (groupId: string, condId: string, patch: Partial<DeepFilterCondition>) => {
        setCriteria(prev => ({
            ...prev,
            groups: prev.groups.map(g => {
                if (g.id !== groupId) return g;
                return {
                    ...g,
                    conditions: g.conditions.map(c => {
                        if (c.id !== condId) return c;
                        const updated = { ...c, ...patch };
                        if (patch.field && patch.field !== c.field) {
                            const ops = getOperatorsForField(patch.field);
                            updated.operator = ops[0]?.value || 'is';
                            updated.value = '';
                            if (patch.field === 'has_email' || patch.field === 'has_phone') {
                                updated.operator = 'is_not_empty';
                                updated.value = '1';
                            } else if (patch.field === 'activity_history') {
                                updated.operator = 'has_done';
                                updated.value = 'any_crm_activity';
                                updated.timeframe = 'anytime';
                            }
                        }
                        return updated;
                    })
                };
            })
        }));
    };

    const handleConfirmDelete = () => {
        if (list && onDelete) {
            onDelete(list.id);
        }
        setIsConfirmOpen(false);
        onClose();
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast.error('Vui lòng nhập tên danh sách');
            return;
        }
        setIsLoading(true);
        try {
            if (isNew && creationMode === 'filter') {
                await Promise.resolve(
                    onSave(
                        {
                            name: name.trim(),
                            description: description.trim(),
                            source: 'CRM Deep Filter',
                            criteria,
                            auto_populate: true,
                            include_crm_contacts: true
                        },
                        true
                    )
                );
            } else {
                await Promise.resolve(
                    onSave(
                        {
                            name: name.trim(),
                            description: description.trim(),
                            source: source || 'Manual'
                        },
                        isNew
                    )
                );
            }
            onClose();
        } catch (error) {
            toast.error('Có lỗi xảy ra khi lưu danh sách');
        } finally {
            setIsLoading(false);
        }
    };

    const renderConditionValueInput = (groupId: string, cond: DeepFilterCondition) => {
        if (cond.operator === 'is_empty' || cond.operator === 'is_not_empty') {
            return (
                <div className="h-[38px] px-3 flex items-center text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 rounded-xl italic">
                    Không cần nhập giá trị
                </div>
            );
        }

        const selectClass =
            'w-full h-[38px] px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all';
        const inputClass =
            'w-full h-[38px] px-3 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all';

        switch (cond.field) {
            case 'erp_is_student':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn phân loại Học viên / Lead --</option>
                        <option value="yes">🎓 Là Học viên chính thức (Enrolled Student)</option>
                        <option value="no">👤 Chưa là Học viên (Đang là Lead)</option>
                    </select>
                );

            case 'erp_student_status':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn trạng thái Học vụ --</option>
                        <option value="studying">🟢 Đang theo học (Studying)</option>
                        <option value="completed">🎓 Đã hoàn thành / Tốt nghiệp (Completed)</option>
                        <option value="reserved">⏸️ Bảo lưu (Reserved / Deferred)</option>
                        <option value="suspended">⚠️ Tạm ngưng (Suspended)</option>
                        <option value="dropped">🔴 Nghỉ học / Bỏ học (Dropped)</option>
                    </select>
                );

            case 'erp_class_id':
                return erpClasses.length > 0 ? (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn Lớp học / Khóa học MYERP --</option>
                        {erpClasses.map(cl => (
                            <option key={cl.id} value={cl.id}>
                                {cl.name} {cl.code ? `(${cl.code})` : ''}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        type="text"
                        className={inputClass}
                        placeholder="Nhập tên hoặc mã Lớp học / Khóa học..."
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    />
                );

            case 'erp_tuition_status':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn trạng thái Học phí & Công nợ --</option>
                        <option value="paid">✅ Đã hoàn tất học phí (Paid)</option>
                        <option value="has_debt">💳 Còn công nợ / Đóng từng đợt (Has Debt)</option>
                        <option value="overdue">🚨 Quá hạn đóng học phí (Overdue)</option>
                        <option value="unpaid">⏳ Chưa đóng phí (Unpaid)</option>
                    </select>
                );

            case 'erp_deal_status':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn trạng thái Cơ hội (Deal) --</option>
                        <option value="open">⏳ Đang mở / Đang đàm phán (Open Deal)</option>
                        <option value="won">🏆 Thành công / Đã chốt (Won Deal)</option>
                        <option value="lost">❌ Thất bại / Đã hủy (Lost Deal)</option>
                        <option value="no_deal">⚪ Chưa có Deal nào (No Deal)</option>
                    </select>
                );

            case 'erp_ticket_status':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn trạng thái Ticket Hỗ trợ / Học vụ --</option>
                        <option value="has_open_ticket">🔴 Đang có Ticket mở / Chờ xử lý (Open)</option>
                        <option value="in_progress">🟡 Đang xử lý (In Progress)</option>
                        <option value="resolved">🟢 Đã giải quyết / Đã đóng (Resolved)</option>
                        <option value="no_ticket">⚪ Chưa từng gửi Ticket</option>
                    </select>
                );

            case 'erp_has_certificate':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn trạng thái Chứng chỉ / Bằng tốt nghiệp --</option>
                        <option value="yes">🏅 Đã cấp chứng chỉ / Bằng tốt nghiệp</option>
                        <option value="no">⏳ Chưa cấp chứng chỉ</option>
                    </select>
                );

            case 'crm_stage_id':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn giai đoạn Pipeline --</option>
                        {pipelineStages.map(st => (
                            <option key={st.id} value={st.id}>
                                {st.name}
                            </option>
                        ))}
                    </select>
                );

            case 'crm_lead_status':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn trạng thái Lead --</option>
                        <option value="active">Đang chăm sóc (Active)</option>
                        <option value="nurture">Chăm sóc lại (Nurture)</option>
                        <option value="lost">Không tiềm năng (Lost)</option>
                    </select>
                );

            case 'crm_temperature':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn độ nóng --</option>
                        <option value="hot">🔥 Nóng (Hot Lead)</option>
                        <option value="warm">☀️ Ấm (Warm Lead)</option>
                        <option value="cold">❄️ Lạnh (Cold Lead)</option>
                    </select>
                );

            case 'crm_owner_id':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn nhân sự Sale --</option>
                        {consultants.map(u => (
                            <option key={u.id} value={u.id}>
                                {u.name} {u.role ? `(${u.role})` : ''}
                            </option>
                        ))}
                    </select>
                );

            case 'crm_branch_id':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn Cơ sở / Chi nhánh --</option>
                        {branches.map(b => (
                            <option key={b.id} value={b.id}>
                                {b.name}
                            </option>
                        ))}
                    </select>
                );

            case 'crm_deposit_status':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn trạng thái cọc --</option>
                        <option value="approved">Đã duyệt cọc / Đã thu tiền</option>
                        <option value="pending">Đang chờ kế toán duyệt cọc</option>
                        <option value="none">Chưa đặt cọc</option>
                    </select>
                );

            case 'tag':
                return (
                    <div className="flex gap-1.5">
                        {availableTags.length > 0 ? (
                            <select
                                className={selectClass}
                                value={cond.value}
                                onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                            >
                                <option value="">-- Chọn nhãn (Tag) --</option>
                                {availableTags.map(t => (
                                    <option key={t} value={t}>
                                        {t}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                className={inputClass}
                                placeholder="Nhập tên nhãn (VD: VIP, IELTS...)"
                                value={cond.value}
                                onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                            />
                        )}
                    </div>
                );

            case 'crm_program':
                return programs.length > 0 ? (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn chương trình học --</option>
                        {programs.map(p => (
                            <option key={p} value={p}>
                                {p}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        type="text"
                        className={inputClass}
                        placeholder="Nhập chương trình (VD: IELTS, Du học...)"
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    />
                );

            case 'gender':
                return (
                    <select
                        className={selectClass}
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    >
                        <option value="">-- Chọn giới tính --</option>
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                    </select>
                );

            case 'activity_history':
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <select
                            className={selectClass}
                            value={cond.value || 'any_crm_activity'}
                            onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                        >
                            {ACTIVITY_TYPES.map(act => (
                                <option key={act.value} value={act.value}>
                                    {act.label}
                                </option>
                            ))}
                        </select>
                        <select
                            className={selectClass}
                            value={cond.timeframe || 'anytime'}
                            onChange={e => handleUpdateCondition(groupId, cond.id, { timeframe: e.target.value })}
                        >
                            {ACTIVITY_TIMEFRAMES.map(tf => (
                                <option key={tf.value} value={tf.value}>
                                    {tf.label}
                                </option>
                            ))}
                        </select>
                        {(cond.value === 'open_email' || cond.value === 'click_link') && campaigns.length > 0 ? (
                            <select
                                className={selectClass}
                                value={cond.targetId || ''}
                                onChange={e => handleUpdateCondition(groupId, cond.id, { targetId: e.target.value })}
                            >
                                <option value="">Bất kỳ chiến dịch Email nào</option>
                                {campaigns.map(c => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <select
                                className={selectClass}
                                value={cond.by_user_id || ''}
                                onChange={e => handleUpdateCondition(groupId, cond.id, { by_user_id: e.target.value })}
                            >
                                <option value="">Bởi bất kỳ nhân sự nào</option>
                                {consultants.map(u => (
                                    <option key={u.id} value={u.id}>
                                        Thực hiện bởi: {u.name}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>
                );

            default:
                return (
                    <input
                        type={['crm_deposit_amount', 'erp_deal_value', 'erp_sla_uncontacted_hours'].includes(cond.field) ? 'number' : 'text'}
                        className={inputClass}
                        placeholder={
                            cond.field === 'erp_sla_uncontacted_hours'
                                ? 'Nhập số giờ quá hạn SLA (VD: 24)'
                                : cond.field === 'erp_deal_value'
                                ? 'Nhập tổng giá trị Deal VNĐ (VD: 10000000)'
                                : cond.operator === 'within_days' || cond.operator === 'more_than_days'
                                ? 'Nhập số ngày (VD: 30)'
                                : cond.operator === 'after' || cond.operator === 'before'
                                ? 'YYYY-MM-DD (VD: 2025-01-01)'
                                : 'Nhập giá trị cần lọc...'
                        }
                        value={cond.value}
                        onChange={e => handleUpdateCondition(groupId, cond.id, { value: e.target.value })}
                    />
                );
        }
    };

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={isNew ? 'Khởi tạo Danh sách Tĩnh (Static List)' : 'Chỉnh sửa Danh sách Tĩnh'}
                size={isNew ? 'xl' : 'md'}
                isLoading={isLoading}
                footer={
                    <div className="flex justify-between w-full items-center">
                        <div>
                            {!isNew && onDelete && (
                                <Button
                                    variant="danger"
                                    icon={Trash2}
                                    size="md"
                                    className="bg-red-50 text-red-600 hover:bg-red-100 border-none shadow-none px-3"
                                    onClick={() => setIsConfirmOpen(true)}
                                >
                                    Xóa danh sách
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            <Button variant="ghost" size="md" onClick={onClose} disabled={isLoading}>
                                Hủy bỏ
                            </Button>
                            <Button
                                size="lg"
                                icon={isLoading ? Loader2 : isNew ? Plus : Save}
                                onClick={handleSubmit}
                                disabled={!name.trim() || isLoading}
                            >
                                {isNew
                                    ? creationMode === 'filter'
                                        ? `Tạo & Nạp ${previewCount.toLocaleString('vi-VN')} Khách hàng`
                                        : 'Tạo Danh sách trống'
                                    : 'Lưu thay đổi'}
                            </Button>
                        </div>
                    </div>
                }
            >
                <div className="space-y-6">
                    {/* Header Banner with Emerald Static List Identity */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-emerald-500/10 p-4 rounded-[20px] border border-emerald-500/20">
                        <div className="flex items-center gap-3.5">
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-2xl text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-500/15">
                                <List className="w-6 h-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-extrabold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">
                                        Danh sách Tĩnh (Static Snapshot List)
                                    </p>
                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-600 text-white">
                                        Cố định thành viên
                                    </span>
                                </div>
                                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                                    Lưu trữ danh sách khách hàng cố định để gửi chiến dịch Email Marketing, Zalo ZNS hoặc bàn giao tệp.
                                </p>
                            </div>
                        </div>

                        {isNew && (
                            <div className="flex bg-white/90 dark:bg-slate-900 p-1 rounded-xl border border-emerald-500/20 shadow-xs shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setCreationMode('empty')}
                                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                        creationMode === 'empty'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <List className="w-3.5 h-3.5" />
                                    1. Tạo danh sách trống
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCreationMode('filter')}
                                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                                        creationMode === 'filter'
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Filter className="w-3.5 h-3.5" />
                                    2. Lọc & Nạp nhanh từ MYERP
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Basic List Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input
                            label="Tên danh sách tĩnh *"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            autoFocus
                            placeholder="VD: Danh sách Lead Nóng nhận ưu đãi Học bổng T10..."
                        />
                        <Input
                            label="Mô tả / Ghi chú chiến dịch"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            placeholder="VD: Tệp khách hàng lọc từ CRM phục vụ gửi Email..."
                        />
                    </div>

                    {/* Mode 2: Deep Filter Snapshot Builder */}
                    {isNew && creationMode === 'filter' && (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-2 border-t border-slate-200/80">
                            {/* Left 7 Cols: Preset Chips + Multi-group Condition Builder */}
                            <div className="lg:col-span-7 space-y-4">
                                {/* Quick Preset Chips */}
                                <div className="bg-slate-50/90 border border-slate-200/80 rounded-[20px] p-4 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                                            Gợi ý bộ lọc nhanh (1-Click Preset)
                                        </span>
                                        {metaLoading && (
                                            <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                                <Loader2 className="w-3 h-3 animate-spin" /> Đang đồng bộ danh mục MYERP...
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {QUICK_PRESETS.map(preset => {
                                            const Icon = preset.icon;
                                            return (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => applyPresetChip(preset)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${preset.color}`}
                                                >
                                                    <Icon className="w-3.5 h-3.5" />
                                                    + {preset.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Top Logic Switcher */}
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <Layers className="w-4 h-4 text-emerald-600" />
                                        <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                                            Cấu hình Điều kiện Lọc Chuyên sâu
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                                        <span className="text-[11px] font-bold text-slate-500 px-2">Kết hợp các nhóm:</span>
                                        <button
                                            type="button"
                                            onClick={() => setCriteria(prev => ({ ...prev, logic: 'AND' }))}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                                                criteria.logic === 'AND'
                                                    ? 'bg-emerald-600 text-white shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            VÀ (AND)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCriteria(prev => ({ ...prev, logic: 'OR' }))}
                                            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-all ${
                                                criteria.logic === 'OR'
                                                    ? 'bg-amber-500 text-white shadow-xs'
                                                    : 'text-slate-600 hover:text-slate-900'
                                            }`}
                                        >
                                            HOẶC (OR)
                                        </button>
                                    </div>
                                </div>

                                {/* Condition Groups */}
                                <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                                    {criteria.groups.map((group, gIdx) => (
                                        <div
                                            key={group.id}
                                            className="bg-white border border-slate-200 rounded-[20px] p-4 shadow-xs space-y-3"
                                        >
                                            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 font-extrabold text-[11px] border border-emerald-500/20">
                                                        Nhóm điều kiện #{gIdx + 1}
                                                    </span>
                                                    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-[10px] font-bold">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setCriteria(prev => ({
                                                                    ...prev,
                                                                    groups: prev.groups.map(g =>
                                                                        g.id === group.id ? { ...g, logic: 'AND' } : g
                                                                    )
                                                                }))
                                                            }
                                                            className={`px-2 py-0.5 rounded-md ${
                                                                group.logic === 'AND'
                                                                    ? 'bg-white text-emerald-700 shadow-xs'
                                                                    : 'text-slate-500'
                                                            }`}
                                                        >
                                                            Thỏa tất cả (AND)
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setCriteria(prev => ({
                                                                    ...prev,
                                                                    groups: prev.groups.map(g =>
                                                                        g.id === group.id ? { ...g, logic: 'OR' } : g
                                                                    )
                                                                }))
                                                            }
                                                            className={`px-2 py-0.5 rounded-md ${
                                                                group.logic === 'OR'
                                                                    ? 'bg-white text-amber-600 shadow-xs'
                                                                    : 'text-slate-500'
                                                            }`}
                                                        >
                                                            Thỏa 1 trong các (OR)
                                                        </button>
                                                    </div>
                                                </div>
                                                {criteria.groups.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveGroup(group.id)}
                                                        className="text-slate-400 hover:text-red-500 p-1 rounded-lg transition-colors"
                                                        title="Xóa nhóm điều kiện"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>

                                            <div className="space-y-2.5">
                                                {group.conditions.map(cond => {
                                                    const operators = getOperatorsForField(cond.field);
                                                    return (
                                                        <div
                                                            key={cond.id}
                                                            className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/70"
                                                        >
                                                            {/* Field Selector */}
                                                            <div className="sm:col-span-4">
                                                                <select
                                                                    className="w-full h-[38px] px-2.5 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                                                                    value={cond.field}
                                                                    onChange={e =>
                                                                        handleUpdateCondition(group.id, cond.id, {
                                                                            field: e.target.value
                                                                        })
                                                                    }
                                                                >
                                                                    {Array.from(
                                                                        new Set(DEEP_FILTER_FIELDS.map(f => f.group))
                                                                    ).map(grpLabel => (
                                                                        <optgroup key={grpLabel} label={grpLabel}>
                                                                            {DEEP_FILTER_FIELDS.filter(
                                                                                f => f.group === grpLabel
                                                                            ).map(f => (
                                                                                <option key={f.value} value={f.value}>
                                                                                    {f.label}
                                                                                </option>
                                                                            ))}
                                                                        </optgroup>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            {/* Operator Selector */}
                                                            <div className="sm:col-span-3">
                                                                <select
                                                                    className="w-full h-[38px] px-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                                                                    value={cond.operator}
                                                                    onChange={e =>
                                                                        handleUpdateCondition(group.id, cond.id, {
                                                                            operator: e.target.value
                                                                        })
                                                                    }
                                                                >
                                                                    {operators.map(op => (
                                                                        <option key={op.value} value={op.value}>
                                                                            {op.label}
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>

                                                            {/* Value Selector / Input */}
                                                            <div className="sm:col-span-4">
                                                                {renderConditionValueInput(group.id, cond)}
                                                            </div>

                                                            {/* Remove Condition */}
                                                            <div className="sm:col-span-1 flex justify-end">
                                                                <button
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleRemoveCondition(group.id, cond.id)
                                                                    }
                                                                    disabled={group.conditions.length <= 1}
                                                                    className="p-2 text-slate-400 hover:text-red-500 disabled:opacity-30 rounded-lg transition-colors"
                                                                    title="Xóa điều kiện"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            <div className="pt-1 flex items-center justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() => handleAddCondition(group.id)}
                                                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                                                >
                                                    <Plus className="w-3.5 h-3.5" /> Thêm tiêu chí lọc
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    type="button"
                                    onClick={handleAddGroup}
                                    className="w-full py-2.5 border border-dashed border-emerald-500/40 rounded-2xl text-xs font-bold text-emerald-700 hover:bg-emerald-50/60 transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Plus className="w-4 h-4" /> Thêm Nhóm Điều Kiện Mới (Multi-Group)
                                </button>
                            </div>

                            {/* Right 5 Cols: Live Preview Panel */}
                            <div className="lg:col-span-5 flex flex-col bg-slate-900 text-white rounded-[20px] p-5 border border-slate-800 shadow-lg">
                                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                                Kết quả khớp toàn hệ thống MYERP
                                            </p>
                                            <div className="flex items-baseline gap-2 mt-0.5">
                                                <span className="text-2xl font-black text-emerald-400">
                                                    {isPreviewLoading ? '...' : previewCount.toLocaleString('vi-VN')}
                                                </span>
                                                <span className="text-xs font-semibold text-slate-300">
                                                    Lead / Khách hàng
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => runLivePreview(criteria)}
                                        disabled={isPreviewLoading}
                                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                        title="Làm mới kết quả xem trước"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${isPreviewLoading ? 'animate-spin text-emerald-400' : ''}`} />
                                    </button>
                                </div>

                                <div className="py-3 flex items-center justify-between text-[11px] text-slate-400">
                                    <span>Xem trước mẫu khách hàng khớp điều kiện:</span>
                                    <span className="text-emerald-400 font-semibold">Không giới hạn phân trang</span>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-2 max-h-[340px] pr-1">
                                    {isPreviewLoading ? (
                                        Array.from({ length: 5 }).map((_, idx) => (
                                            <div
                                                key={idx}
                                                className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/60 animate-pulse flex items-center justify-between"
                                            >
                                                <div className="space-y-1.5">
                                                    <div className="h-3.5 w-36 bg-slate-700 rounded" />
                                                    <div className="h-2.5 w-48 bg-slate-700/70 rounded" />
                                                </div>
                                                <div className="h-5 w-16 bg-slate-700 rounded-full" />
                                            </div>
                                        ))
                                    ) : previewContacts.length === 0 ? (
                                        <div className="py-12 text-center space-y-2">
                                            <Search className="w-8 h-8 text-slate-600 mx-auto" />
                                            <p className="text-xs font-bold text-slate-400">
                                                Chưa có khách hàng nào khớp bộ lọc hiện tại
                                            </p>
                                            <p className="text-[11px] text-slate-500">
                                                Hãy thử nới lỏng điều kiện hoặc chuyển sang kết hợp HOẶC (OR).
                                            </p>
                                        </div>
                                    ) : (
                                        previewContacts.map((c: any, idx: number) => {
                                            const fullName =
                                                c.full_name ||
                                                c.name ||
                                                `${c.firstName || ''} ${c.lastName || ''}`.trim() ||
                                                'Khách hàng';
                                            const email = c.email || 'Chưa có email';
                                            const phone = c.phone || c.phoneNumber || '';
                                            const sourceLabel = c.source || 'CRM';
                                            return (
                                                <div
                                                    key={c.id || idx}
                                                    className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/70 hover:border-emerald-500/40 transition-all flex items-center justify-between gap-2"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-bold text-white truncate">
                                                            {fullName}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate mt-0.5">
                                                            <span className="truncate">{email}</span>
                                                            {phone && (
                                                                <>
                                                                    <span>•</span>
                                                                    <span className="text-slate-300 font-medium">
                                                                        {phone}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shrink-0">
                                                        {sourceLabel}
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center gap-2 text-[11px] text-slate-400">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    <span>
                                        Khi bấm <strong>Tạo & Nạp</strong>, hệ thống sẽ tự động nạp toàn bộ{' '}
                                        <strong className="text-white">{previewCount.toLocaleString('vi-VN')}</strong> hồ sơ khớp điều kiện vào Danh sách Tĩnh này.
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </Modal>

            <ConfirmModal
                isOpen={isConfirmOpen}
                onClose={() => setIsConfirmOpen(false)}
                onConfirm={handleConfirmDelete}
                title="Xóa danh sách này?"
                message="CẢNH BÁO: Hành động này sẽ gỡ tất cả thành viên khỏi danh sách này. Không thể hoàn tác."
                variant="danger"
                confirmLabel="Xóa danh sách"
            />
        </>
    );
};

export default ListFormModal;
