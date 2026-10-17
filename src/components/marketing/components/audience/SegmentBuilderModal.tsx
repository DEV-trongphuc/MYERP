import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Save, Plus, Trash2, Users, Crown, Zap, ShieldCheck, ChevronDown, Check, X, Filter, Sparkles, Copy, Search, Loader2, MessageCircle, Bell, Flame, Briefcase } from 'lucide-react';
import { Segment, Subscriber } from '../../types';
import { api } from '../../services/storageAdapter';
import { getMktPortalRoot } from '../../utils/portalRoot';
import toast from 'react-hot-toast';

import erpApi from '../../../../api/axios';

interface SegmentBuilderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (segment: any) => void;
    initialSegment?: Segment | null;
    subscribers?: Subscriber[];
}

interface SegmentCondition {
    id: string;
    field: string;
    operator: string;
    value: string;
    timeframe?: string;
    targetId?: string;
    by_user_id?: string;
}

interface SegmentGroup {
    id: string;
    conditions: SegmentCondition[];
}

// --- Constants ---

type FieldType = 'text' | 'number' | 'date' | 'birthday' | 'activity_date' | 'select' | 'owner_select' | 'list_select' | 'tags' | 'activity_history' | 'boolean_presence';

const FIELD_DEFINITIONS: Record<string, { type: FieldType; label: string; group?: string; icon?: any }> = {
    // Học viên, Lớp học & Tài chính (MYERP)
    erp_is_student: { type: 'select', label: 'Phân loại Học viên / Lead (MYERP)', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    erp_student_status: { type: 'select', label: 'Trạng thái Học vụ (Đang học / Tốt nghiệp / Bảo lưu)', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    erp_class_id: { type: 'select', label: 'Lớp học / Khóa học (MYERP Class)', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    erp_tuition_status: { type: 'select', label: 'Trạng thái Học phí & Công nợ', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    erp_deal_status: { type: 'select', label: 'Trạng thái Cơ hội (CRM Deal)', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    erp_deal_value: { type: 'number', label: 'Tổng giá trị Deal (VNĐ)', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    erp_sla_uncontacted_hours: { type: 'number', label: 'Quá hạn SLA chưa chăm sóc (Số giờ)', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    erp_ticket_status: { type: 'select', label: 'Trạng thái Ticket Hỗ trợ / Học vụ', group: 'Học viên, Lớp học & Tài chính (MYERP)' },
    erp_has_certificate: { type: 'select', label: 'Chứng chỉ / Bằng tốt nghiệp', group: 'Học viên, Lớp học & Tài chính (MYERP)' },

    // MYERP CRM & Pipeline
    crm_stage_id: { type: 'select', label: 'Giai đoạn Pipeline (CRM Stage)', group: 'MYERP CRM & Pipeline' },
    crm_lead_status: { type: 'select', label: 'Trạng thái Lead CRM', group: 'MYERP CRM & Pipeline' },
    crm_temperature: { type: 'select', label: 'Độ ấm Lead (Temperature)', group: 'MYERP CRM & Pipeline' },
    crm_program: { type: 'text', label: 'Chương trình học / Quan tâm', group: 'MYERP CRM & Pipeline' },
    crm_owner_id: { type: 'owner_select', label: 'Nhân sự Sale phụ trách (CRM Owner)', group: 'MYERP CRM & Pipeline' },
    salesperson: { type: 'owner_select', label: 'Tư vấn viên phụ trách', group: 'MYERP CRM & Pipeline' },
    crm_branch_id: { type: 'select', label: 'Cơ sở / Chi nhánh (Branch)', group: 'MYERP CRM & Pipeline' },
    crm_deposit_status: { type: 'select', label: 'Trạng thái đặt cọc (Deposit)', group: 'MYERP CRM & Pipeline' },
    activity_history: { type: 'activity_history', label: 'Lịch sử Tương tác (Sale / Email / Zalo / Form)', group: 'MYERP CRM & Pipeline' },
    crm_activity_type: { type: 'select', label: 'Loại tương tác CRM (Call / Meeting / Note)', group: 'MYERP CRM & Pipeline' },
    crm_activity_by: { type: 'owner_select', label: 'Nhân sự thực hiện chăm sóc CRM', group: 'MYERP CRM & Pipeline' },
    crm_created_at: { type: 'date', label: 'Ngày tạo Lead CRM', group: 'MYERP CRM & Pipeline' },
    has_email: { type: 'boolean_presence', label: 'Tình trạng có Email', group: 'MYERP CRM & Pipeline' },
    has_phone: { type: 'boolean_presence', label: 'Tình trạng có Số điện thoại', group: 'MYERP CRM & Pipeline' },
    source: { type: 'text', label: 'Nguồn (Source)', group: 'MYERP CRM & Pipeline' },
    tags: { type: 'tags', label: 'Tag (Nhãn Marketing & ERP)', group: 'MYERP CRM & Pipeline' },
    tag: { type: 'tags', label: 'Nhãn (Tag CRM)', group: 'MYERP CRM & Pipeline' },
    list: { type: 'list_select', label: 'Thuộc Danh sách Tĩnh (Static List)', group: 'MYERP CRM & Pipeline' },

    // Profile
    email: { type: 'text', label: 'Email', group: 'Hồ sơ cá nhân' },
    firstName: { type: 'text', label: 'Tên (First Name)', group: 'Hồ sơ cá nhân' },
    lastName: { type: 'text', label: 'Họ & Tên đệm (Last Name)', group: 'Hồ sơ cá nhân' },
    phoneNumber: { type: 'text', label: 'Số điện thoại', group: 'Hồ sơ cá nhân' },
    gender: { type: 'select', label: 'Giới tính', group: 'Hồ sơ cá nhân' },
    dateOfBirth: { type: 'birthday', label: 'Ngày sinh', group: 'Hồ sơ cá nhân' },
    anniversaryDate: { type: 'birthday', label: 'Ngày kỷ niệm', group: 'Hồ sơ cá nhân' },
    jobTitle: { type: 'text', label: 'Chức danh (Job Title)', group: 'Hồ sơ cá nhân' },
    companyName: { type: 'text', label: 'Công ty (Company)', group: 'Hồ sơ cá nhân' },
    city: { type: 'text', label: 'Tỉnh/Thành phố', group: 'Hồ sơ cá nhân' },
    district: { type: 'text', label: 'Quận/Huyện', group: 'Hồ sơ cá nhân' },
    country: { type: 'text', label: 'Quốc gia', group: 'Hồ sơ cá nhân' },
    address: { type: 'text', label: 'Địa chỉ', group: 'Hồ sơ cá nhân' },

    // Engagement & Tech
    status: { type: 'select', label: 'Trạng thái Subscriber', group: 'Tương tác & Kỹ thuật' },
    joinedAt: { type: 'date', label: 'Ngày tham gia', group: 'Tương tác & Kỹ thuật' },
    lastActivity: { type: 'activity_date', label: 'Lần tương tác cuối', group: 'Tương tác & Kỹ thuật' },
    lastActivityDays: { type: 'number', label: 'Ngày không tương tác (Ngủ đông)', group: 'Tương tác & Kỹ thuật' },
    leadScore: { type: 'number', label: 'Điểm tương tác (Lead Score)', group: 'Tương tác & Kỹ thuật' },
    statsSent: { type: 'number', label: 'Đã gửi email (lần)', group: 'Tương tác & Kỹ thuật' },
    statsOpened: { type: 'number', label: 'Đã mở email (lần)', group: 'Tương tác & Kỹ thuật' },
    'stats.emailsOpened': { type: 'number', label: 'Đã mở email (stats)', group: 'Tương tác & Kỹ thuật' },
    statsClicked: { type: 'number', label: 'Đã click link (lần)', group: 'Tương tác & Kỹ thuật' },
    'stats.linksClicked': { type: 'number', label: 'Đã click link (stats)', group: 'Tương tác & Kỹ thuật' },
    web_activity: { type: 'text', label: 'Truy cập trang web / Sự kiện', group: 'Tương tác & Kỹ thuật' },
    os: { type: 'text', label: 'Hệ điều hành (OS)', group: 'Tương tác & Kỹ thuật' },
    device: { type: 'text', label: 'Thiết bị (Device)', group: 'Tương tác & Kỹ thuật' },
    browser: { type: 'text', label: 'Trình duyệt (Browser)', group: 'Tương tác & Kỹ thuật' },
    verified: { type: 'select', label: 'Xác thực (Verified)', group: 'Tương tác & Kỹ thuật' },
    meta_psid: { type: 'text', label: 'Facebook Messenger', group: 'Tương tác & Kỹ thuật' },
};

const OPERATORS_BY_TYPE: Record<FieldType, { value: string, label: string }[]> = {
    text: [
        { value: 'contains', label: 'Chứa' },
        { value: 'equals', label: 'Là' },
        { value: 'starts_with', label: 'Bắt đầu' },
        { value: 'not_contains', label: 'Không chứa' },
        { value: 'is_not_empty', label: 'Có giá trị (*)' },
        { value: 'is_empty', label: 'Không có giá trị (*)' },
    ],
    number: [
        { value: 'greater_than', label: 'Lớn hơn (>)' },
        { value: 'less_than', label: 'Nhỏ hơn (<)' },
        { value: 'equals', label: 'Bằng (=)' },
    ],
    date: [
        { value: 'after', label: 'Sau ngày' },
        { value: 'before', label: 'Trước ngày' },
        { value: 'on', label: 'Đúng ngày' },
        { value: 'within_days', label: 'Trong X ngày qua' },
        { value: 'is_not_empty', label: 'Có giá trị (*)' },
        { value: 'is_empty', label: 'Không có giá trị (*)' },
    ],
    birthday: [
        { value: 'is_today', label: 'Là hôm nay' },
        { value: 'is_this_month', label: 'Trong tháng này' },
        { value: 'before_days', label: 'Còn X ngày nữa' },
        { value: 'on', label: 'Đúng ngày' },
        { value: 'before', label: 'Trước ngày' },
        { value: 'after', label: 'Sau ngày' },
        { value: 'is_not_empty', label: 'Có giá trị (*)' },
        { value: 'is_empty', label: 'Không có giá trị (*)' },
    ],
    activity_date: [
        { value: 'in_the_last', label: 'Trong X ngày qua' },
        { value: 'not_in_the_last', label: 'Ngủ đông quá X ngày' },
        { value: 'after', label: 'Sau ngày' },
        { value: 'before', label: 'Trước ngày' },
        { value: 'is_empty', label: 'Chưa từng tương tác (*)' },
    ],
    select: [
        { value: 'is', label: 'Là' },
        { value: 'is_not', label: 'Không là' },
    ],
    owner_select: [
        { value: 'is', label: 'Là (Phụ trách bởi)' },
        { value: 'is_not', label: 'Không phải là' },
        { value: 'is_empty', label: 'Chưa phân bổ Sale (*)' },
        { value: 'is_not_empty', label: 'Đã có Sale phụ trách (*)' },
    ],
    list_select: [
        { value: 'in_list', label: 'Thuộc danh sách' },
        { value: 'not_in_list', label: 'Không thuộc danh sách' },
    ],
    tags: [
        { value: 'contains', label: 'Có chứa' },
        { value: 'not_contains', label: 'Không chứa' },
    ],
    activity_history: [
        { value: 'has_done', label: 'Đã thực hiện' },
        { value: 'has_not_done', label: 'Chưa từng thực hiện' },
    ],
    boolean_presence: [
        { value: 'is_not_empty', label: 'Có thông tin (*)' },
        { value: 'is_empty', label: 'Chưa có / Trống (*)' },
    ]
};

interface SegmentTemplate {
    id: string;
    name: string;
    icon: any;
    color: string;
    criteria: SegmentGroup[];
}

const SEGMENT_TEMPLATES: SegmentTemplate[] = [
    {
        id: 'vip',
        name: 'Khách hàng VIP',
        icon: Crown,
        color: 'rose',
        criteria: [{
            id: 'g1', conditions: [
                { id: 'c1', field: 'tags', operator: 'contains', value: 'VIP' },
                { id: 'c2', field: 'statsOpened', operator: 'greater_than', value: '10' }
            ]
        }]
    },
    {
        id: 'hot_leads',
        name: 'Lead Nóng CRM',
        icon: Flame,
        color: 'rose',
        criteria: [{
            id: 'g1', conditions: [
                { id: 'c1', field: 'crm_temperature', operator: 'is', value: 'hot' },
                { id: 'c2', field: 'crm_lead_status', operator: 'is', value: 'active' }
            ]
        }]
    },
    {
        id: 'new_leads',
        name: 'Người mới (7 ngày)',
        icon: Sparkles,
        color: 'blue',
        criteria: [{
            id: 'g1', conditions: [
                { id: 'c1', field: 'joinedAt', operator: 'after', value: new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] }
            ]
        }]
    },
    {
        id: 'engaged',
        name: 'Tương tác cao',
        icon: Zap,
        color: 'emerald',
        criteria: [{
            id: 'g1', conditions: [
                { id: 'c1', field: 'statsClicked', operator: 'greater_than', value: '5' }
            ]
        }]
    },
    {
        id: 'deposited',
        name: 'Đã đặt cọc CRM',
        icon: Briefcase,
        color: 'indigo',
        criteria: [{
            id: 'g1', conditions: [
                { id: 'c1', field: 'crm_deposit_status', operator: 'is', value: 'approved' }
            ]
        }]
    },
    {
        id: 'facebook_messenger',
        name: 'Linked Messenger',
        icon: MessageCircle,
        color: 'blue',
        criteria: [{
            id: 'g1', conditions: [
                { id: 'c1', field: 'meta_psid', operator: 'is_not_empty', value: '' }
            ]
        }]
    }
];

// --- Custom UI Components ---

const CompactSelect = ({
    value,
    onChange,
    options,
    placeholder,
    className = ""
}: {
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
    placeholder?: string;
    className?: string;
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const selectedOption = options.find(o => o.value === value);

    const [isVisible, setIsVisible] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        if (isOpen) {
            setIsVisible(true);
            const timer = setTimeout(() => setAnimateIn(true), 10);
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                clearTimeout(timer);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        } else {
            setAnimateIn(false);
            const timer = setTimeout(() => setIsVisible(false), 200);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-3 py-2 rounded-[var(--radius-md)] border cursor-pointer flex items-center justify-between transition-all bg-white text-xs h-[38px] ${isOpen ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/10' : 'border-slate-200 hover:border-slate-300'
                    }`}
            >
                <span className={`truncate font-medium ${selectedOption ? 'text-slate-700' : 'text-slate-400'}`}>
                    {selectedOption?.label || placeholder || 'Chọn...'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {isVisible && (
                <div className={`absolute z-50 w-full mt-1 bg-white rounded-[var(--radius-md)] shadow-xl border border-slate-100 py-1 max-h-56 overflow-y-auto custom-scrollbar transform transition-all duration-200 ${animateIn ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-2'}`}>
                    {options.map(opt => (
                        <div
                            key={opt.value}
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            className={`px-3 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-xs group ${value === opt.value ? 'bg-rose-50 text-[var(--color-primary)] font-bold' : 'text-slate-600'}`}
                        >
                            <span>{opt.label}</span>
                            {value === opt.value && <Check className="w-3 h-3 text-[var(--color-primary)]" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


const SegmentBuilderModal: React.FC<SegmentBuilderModalProps> = ({ isOpen, onClose, onSave, initialSegment }) => {
    // Animation State
    const [isVisible, setIsVisible] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);

    const [name, setName] = useState('');
    const [groups, setGroups] = useState<SegmentGroup[]>([]);
    const [estimatedCount, setEstimatedCount] = useState(0);
    const [autoCleanupDays, setAutoCleanupDays] = useState('0');
    const [notifyOnJoin, setNotifyOnJoin] = useState(false);
    const [notifySubject, setNotifySubject] = useState('');
    const [notifyEmail, setNotifyEmail] = useState('');
    const [notifyCc, setNotifyCc] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Dynamic MYERP & Marketing Metadata
    const [availableLists, setAvailableLists] = useState<{ value: string; label: string }[]>([]);
    const [pipelineStages, setPipelineStages] = useState<{ value: string; label: string }[]>([]);
    const [crmUsers, setCrmUsers] = useState<{ value: string; label: string }[]>([]);
    const [crmBranches, setCrmBranches] = useState<{ value: string; label: string }[]>([]);
    const [erpClasses, setErpClasses] = useState<{ value: string; label: string }[]>([]);
    const [availableTags, setAvailableTags] = useState<{ value: string; label: string }[]>([]);
    const [availableCampaigns, setAvailableCampaigns] = useState<{ value: string; label: string }[]>([]);
    const [availableForms, setAvailableForms] = useState<{ value: string; label: string }[]>([]);
    const [availableSurveys, setAvailableSurveys] = useState<{ value: string; label: string }[]>([]);

    // Initial Load
    useEffect(() => {
        if (isOpen) {
            Promise.allSettled([
                erpApi.get('/pipeline-stages'),
                erpApi.get('/users?all=1'),
                erpApi.get('/branches'),
                erpApi.get('/classes').catch(() => erpApi.get('/projects')),
                erpApi.get('/tags'),
                api.get<any[]>('tags'),
                api.get<any[]>('lists'),
                api.get<any[]>('campaigns'),
                api.get<any[]>('surveys'),
                api.get<any[]>('forms')
            ]).then(([stagesRes, usersRes, branchesRes, classesRes, erpTagsRes, mktTagsRes, listsRes, campaignsRes, surveysRes, formsRes]) => {
                if (stagesRes.status === 'fulfilled' && stagesRes.value?.data) {
                    const raw = stagesRes.value.data?.data ?? stagesRes.value.data;
                    const arr = Array.isArray(raw) ? raw : (raw?.items || []);
                    setPipelineStages(arr.map((s: any) => ({ value: String(s.id), label: s.name || s.title || `Stage #${s.id}` })));
                }
                if (usersRes.status === 'fulfilled' && usersRes.value?.data) {
                    const raw = usersRes.value.data?.data ?? usersRes.value.data;
                    const arr = Array.isArray(raw) ? raw : (raw?.items || []);
                    setCrmUsers(arr.map((u: any) => ({
                        value: String(u.id),
                        label: `${u.full_name || u.name || u.username || `User #${u.id}`}${u.role ? ` (${u.role})` : ''}`
                    })));
                }
                if (branchesRes.status === 'fulfilled' && branchesRes.value?.data) {
                    const raw = branchesRes.value.data?.data ?? branchesRes.value.data;
                    const arr = Array.isArray(raw) ? raw : (raw?.items || []);
                    setCrmBranches(arr.map((b: any) => ({ value: String(b.id), label: b.name || b.branch_name || `Cơ sở #${b.id}` })));
                }
                if (classesRes.status === 'fulfilled' && classesRes.value?.data) {
                    const raw = classesRes.value.data?.data ?? classesRes.value.data;
                    const arr = Array.isArray(raw) ? raw : (raw?.items || []);
                    setErpClasses(arr.map((cl: any) => ({
                        value: String(cl.id || cl.name),
                        label: `${cl.name || cl.title || `Lớp #${cl.id}`}${cl.code ? ` (${cl.code})` : ''}`
                    })));
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
                setAvailableTags(Array.from(tagSet).map(t => ({ value: t, label: t })));

                if (listsRes.status === 'fulfilled' && listsRes.value?.success && Array.isArray(listsRes.value.data)) {
                    setAvailableLists(listsRes.value.data.map((l: any) => ({ value: String(l.id), label: l.name || `List #${l.id}` })));
                }
                if (campaignsRes.status === 'fulfilled' && campaignsRes.value?.success && Array.isArray(campaignsRes.value.data)) {
                    setAvailableCampaigns(campaignsRes.value.data.map((c: any) => ({ value: String(c.id), label: c.name || c.title || `Campaign #${c.id}` })));
                }
                if (surveysRes.status === 'fulfilled' && surveysRes.value?.success && Array.isArray(surveysRes.value.data)) {
                    setAvailableSurveys(surveysRes.value.data.map((s: any) => ({ value: String(s.id), label: s.title || s.name || `Survey #${s.id}` })));
                }
                if (formsRes.status === 'fulfilled' && formsRes.value?.success && Array.isArray(formsRes.value.data)) {
                    setAvailableForms(formsRes.value.data.map((f: any) => ({ value: String(f.id), label: f.name || f.title || `Form #${f.id}` })));
                }
            }).catch(() => {});

            if (initialSegment) {
                setName(initialSegment.name);
                setAutoCleanupDays(initialSegment.autoCleanupDays?.toString() || '0');
                const nj = initialSegment.notifyOnJoin as any;
                setNotifyOnJoin(nj === true || nj === 1 || nj === '1');
                setNotifySubject(initialSegment.notifySubject || '');
                setNotifyEmail(initialSegment.notifyEmail || '');
                setNotifyCc(initialSegment.notifyCc || '');
                try {
                    const parsedCriteria = JSON.parse(initialSegment.criteria);
                    if (Array.isArray(parsedCriteria)) {
                        setGroups(parsedCriteria);
                    } else if (parsedCriteria && Array.isArray(parsedCriteria.groups)) {
                        setGroups(parsedCriteria.groups);
                    } else {
                        resetGroups();
                    }
                } catch {
                    resetGroups();
                }
            } else {
                setName('');
                setAutoCleanupDays('0');
                setNotifyOnJoin(false);
                setNotifySubject('');
                setNotifyEmail('');
                setNotifyCc('');
                resetGroups();
            }
        }
    }, [isOpen, initialSegment]);

    // Animation Effect
    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            document.body.style.overflow = 'hidden';
            setTimeout(() => setAnimateIn(true), 10);
        } else {
            setAnimateIn(false);
            setTimeout(() => {
                setIsVisible(false);
                document.body.style.overflow = 'unset';
            }, 400);
        }
    }, [isOpen]);

    const resetGroups = () => {
        setGroups([{ id: crypto.randomUUID(), conditions: [{ id: crypto.randomUUID(), field: 'tags', operator: 'contains', value: '' }] }]);
    };

    // Estimate Effect
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (!isOpen) return;
            try {
                const res = await api.post<any>('segments?action=preview', {
                    criteria: JSON.stringify(groups),
                    include_crm_contacts: true
                });
                if (res.success && typeof res.data?.count === 'number') {
                    setEstimatedCount(res.data.count);
                    return;
                }
                const fallbackRes = await api.post('segments.php?route=estimate', { criteria: groups });
                if (fallbackRes.success && typeof (fallbackRes.data as any)?.count === 'number') {
                    setEstimatedCount((fallbackRes.data as any).count);
                }
            } catch (e) { console.error(e); }
        }, 500);
        return () => clearTimeout(timer);
    }, [groups, isOpen]);

    // Handlers
    const applyTemplate = (tpl: SegmentTemplate) => {
        setName(tpl.name);
        setGroups(tpl.criteria.map((g) => ({
            ...g,
            id: crypto.randomUUID(),
            conditions: g.conditions.map((c) => ({ ...c, id: crypto.randomUUID() }))
        })));
    };

    const updateConditionPatch = (groupId: string, condId: string, patch: Partial<SegmentCondition>) => {
        setGroups(prev => prev.map(g => {
            if (g.id !== groupId) return g;
            return {
                ...g,
                conditions: g.conditions.map(c => c.id === condId ? { ...c, ...patch } : c)
            };
        }));
    };

    const updateCondition = (groupId: string, condId: string, key: keyof SegmentCondition, val: string) => {
        setGroups(groups.map(g => {
            if (g.id !== groupId) return g;
            return {
                ...g,
                conditions: g.conditions.map(c => {
                    if (c.id !== condId) return c;
                    const updated = { ...c, [key]: val };
                    // Reset value/operator when field changes
                    if (key === 'field') {
                        const type = FIELD_DEFINITIONS[val]?.type || 'text';
                        updated.operator = OPERATORS_BY_TYPE[type]?.[0]?.value || 'contains';
                        updated.value = '';
                        if (val === 'activity_history') {
                            updated.value = 'any_crm_activity';
                            updated.timeframe = 'anytime';
                            updated.targetId = '';
                            updated.by_user_id = '';
                        } else if (val === 'has_email' || val === 'has_phone') {
                            updated.operator = 'is_not_empty';
                            updated.value = '1';
                        }
                    }
                    return updated;
                })
            };
        }));
    };

    const addCondition = (groupId: string) => {
        setGroups(groups.map(g => g.id === groupId ? { ...g, conditions: [...g.conditions, { id: crypto.randomUUID(), field: 'email', operator: 'contains', value: '' }] } : g));
    };

    const removeCondition = (groupId: string, condId: string) => {
        setGroups(groups.map(g => g.id === groupId ? {
            ...g, conditions: g.conditions.filter(c => c.id !== condId)
        } : g).filter(g => g.conditions.length > 0));
    };

    const addGroup = () => {
        setGroups([...groups, {
            id: crypto.randomUUID(),
            conditions: [{ id: crypto.randomUUID(), field: 'email', operator: 'contains', value: '' }]
        }]);
    };

    const handleSave = async () => {
        if (!name.trim()) return toast.error('Vui lòng nhập tên phân khúc');
        setIsLoading(true);
        try {
            await Promise.resolve(onSave({ ...initialSegment, name, criteria: JSON.stringify(groups), count: estimatedCount, autoCleanupDays: parseInt(autoCleanupDays), notifyOnJoin, notifySubject, notifyEmail, notifyCc }));
            onClose();
        } catch (error) {
            toast.error('Có lỗi xảy ra');
        } finally {
            setIsLoading(false);
        }
    };

    const renderInput = (groupId: string, cond: SegmentCondition) => {
        const type = FIELD_DEFINITIONS[cond.field]?.type || 'text';

        // Hide input for unary operators
        if (cond.operator === 'is_empty' || cond.operator === 'is_not_empty' || cond.operator === 'is_today' || cond.operator === 'is_this_month') {
            return (
                <input
                    type="text"
                    disabled
                    value="*"
                    className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-slate-200 bg-slate-50 text-xs font-medium text-slate-400 h-[38px] text-center cursor-not-allowed"
                    placeholder="Tự động khớp"
                />
            );
        }

        if (cond.field === 'crm_stage_id') {
            return (
                <CompactSelect
                    options={pipelineStages}
                    value={cond.value}
                    onChange={(v) => updateCondition(groupId, cond.id, 'value', v)}
                    placeholder="Chọn giai đoạn Pipeline MYERP..."
                />
            );
        }

        if (cond.field === 'crm_owner_id' || cond.field === 'salesperson' || cond.field === 'crm_activity_by') {
            const ownerOptions = [
                { value: 'unassigned', label: '⚠️ Chưa phân bổ Sale (Trống)' },
                ...crmUsers
            ];
            return (
                <CompactSelect
                    options={ownerOptions}
                    value={cond.value}
                    onChange={(v) => {
                        if (v === 'unassigned') {
                            updateConditionPatch(groupId, cond.id, { operator: 'is_empty', value: '' });
                        } else {
                            updateCondition(groupId, cond.id, 'value', v);
                        }
                    }}
                    placeholder="Chọn tư vấn viên MYERP..."
                />
            );
        }

        if (cond.field === 'crm_branch_id') {
            return (
                <CompactSelect
                    options={crmBranches}
                    value={cond.value}
                    onChange={(v) => updateCondition(groupId, cond.id, 'value', v)}
                    placeholder="Chọn cơ sở / chi nhánh..."
                />
            );
        }

        if (cond.field === 'crm_activity_type') {
            return (
                <CompactSelect
                    options={[
                        { value: 'call', label: 'Cuộc gọi tư vấn (Call)' },
                        { value: 'meeting', label: 'Lịch hẹn gặp (Meeting)' },
                        { value: 'note', label: 'Ghi chú chăm sóc (Note)' },
                        { value: 'email', label: 'Gửi Email (Email)' },
                        { value: 'zalo', label: 'Tương tác Zalo (Zalo)' }
                    ]}
                    value={cond.value}
                    onChange={(v) => updateCondition(groupId, cond.id, 'value', v)}
                    placeholder="Chọn loại tương tác..."
                />
            );
        }

        if (cond.field === 'activity_history') {
            const activityOptions = [
                { value: 'any_crm_activity', label: 'Bất kỳ tương tác CRM nào' },
                { value: 'crm_call', label: 'Gọi điện tư vấn (CRM Call)' },
                { value: 'crm_meeting', label: 'Hẹn gặp tư vấn (CRM Meeting)' },
                { value: 'crm_note', label: 'Ghi chú chăm sóc (CRM Note)' },
                { value: 'open_email', label: 'Mở chiến dịch Email (Open Email)' },
                { value: 'click_link', label: 'Click link trong Email' },
                { value: 'submit_form', label: 'Điền Biểu mẫu (Form Submit)' },
                { value: 'complete_survey', label: 'Hoàn thành Khảo sát (Survey)' },
                { value: 'zalo_interaction', label: 'Tương tác Zalo OA / ZNS' }
            ];
            return (
                <div className="space-y-1.5">
                    <CompactSelect
                        options={activityOptions}
                        value={cond.value || 'any_crm_activity'}
                        onChange={(v) => updateConditionPatch(groupId, cond.id, { value: v, targetId: '' })}
                        placeholder="Chọn hành động tương tác..."
                    />
                    <div className="grid grid-cols-2 gap-1.5">
                        <CompactSelect
                            options={[
                                { value: 'anytime', label: 'Mọi thời điểm' },
                                { value: '7d', label: '7 ngày qua' },
                                { value: '30d', label: '30 ngày qua' },
                                { value: '90d', label: '90 ngày qua' }
                            ]}
                            value={cond.timeframe || 'anytime'}
                            onChange={(v) => updateConditionPatch(groupId, cond.id, { timeframe: v })}
                        />
                        {(cond.value === 'open_email' || cond.value === 'click_link') && availableCampaigns.length > 0 ? (
                            <CompactSelect
                                options={[{ value: '', label: 'Mọi chiến dịch Email' }, ...availableCampaigns]}
                                value={cond.targetId || ''}
                                onChange={(v) => updateConditionPatch(groupId, cond.id, { targetId: v })}
                            />
                        ) : cond.value === 'submit_form' && availableForms.length > 0 ? (
                            <CompactSelect
                                options={[{ value: '', label: 'Mọi Biểu mẫu' }, ...availableForms]}
                                value={cond.targetId || ''}
                                onChange={(v) => updateConditionPatch(groupId, cond.id, { targetId: v })}
                            />
                        ) : cond.value === 'complete_survey' && availableSurveys.length > 0 ? (
                            <CompactSelect
                                options={[{ value: '', label: 'Mọi Khảo sát' }, ...availableSurveys]}
                                value={cond.targetId || ''}
                                onChange={(v) => updateConditionPatch(groupId, cond.id, { targetId: v })}
                            />
                        ) : (
                            <CompactSelect
                                options={[{ value: '', label: 'Mọi tư vấn viên' }, ...crmUsers]}
                                value={cond.by_user_id || ''}
                                onChange={(v) => updateConditionPatch(groupId, cond.id, { by_user_id: v })}
                            />
                        )}
                    </div>
                </div>
            );
        }

        if ((cond.field === 'tag' || cond.field === 'tags') && availableTags.length > 0) {
            return (
                <CompactSelect
                    options={availableTags}
                    value={cond.value}
                    onChange={(v) => updateCondition(groupId, cond.id, 'value', v)}
                    placeholder="Chọn nhãn (Tag)..."
                />
            );
        }

        if (cond.field === 'status') {
            return <CompactSelect options={[
                { value: 'active', label: 'Active' },
                { value: 'unsubscribed', label: 'Unsubscribed' },
                { value: 'bounced', label: 'Bounced' },
                { value: 'complained', label: 'Complained' },
                { value: 'lead', label: 'Lead' },
                { value: 'customer', label: 'Customer' }
            ]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} />;
        }
        if (cond.field === 'verified') {
            return <CompactSelect options={[{ value: '1', label: 'Đã xác thực' }, { value: '0', label: 'Chưa xác thực' }]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} />;
        }
        if (cond.field === 'gender') {
            return <CompactSelect options={[
                { value: 'male', label: 'Nam (Male)' },
                { value: 'female', label: 'Nữ (Female)' },
                { value: 'other', label: 'Khác (Other)' }
            ]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} />;
        }
        if (cond.field === 'crm_lead_status') {
            return <CompactSelect options={[
                { value: 'active', label: 'Đang chăm sóc (Active)' },
                { value: 'nurture', label: 'Nuôi dưỡng (Nurture)' },
                { value: 'lost', label: 'Đã mất (Lost)' }
            ]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} />;
        }
        if (cond.field === 'crm_temperature') {
            return <CompactSelect options={[
                { value: 'hot', label: 'Nóng (Hot)' },
                { value: 'warm', label: 'Ấm (Warm)' },
                { value: 'cold', label: 'Lạnh (Cold)' }
            ]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} />;
        }
        if (cond.field === 'crm_deposit_status') {
            return <CompactSelect options={[
                { value: 'approved', label: 'Đã duyệt đặt cọc (Approved)' },
                { value: 'pending', label: 'Chờ duyệt cọc (Pending)' },
                { value: 'none', label: 'Chưa đặt cọc (None)' }
            ]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} />;
        }
        if (cond.field === 'erp_is_student') {
            return <CompactSelect options={[
                { value: 'yes', label: '🎓 Là Học viên chính thức (Enrolled Student)' },
                { value: 'no', label: '👤 Chưa là Học viên (Đang là Lead)' }
            ]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} placeholder="Chọn phân loại..." />;
        }
        if (cond.field === 'erp_student_status') {
            return <CompactSelect options={[
                { value: 'studying', label: '🟢 Đang theo học (Studying)' },
                { value: 'completed', label: '🎓 Đã hoàn thành / Tốt nghiệp (Completed)' },
                { value: 'reserved', label: '⏸️ Bảo lưu (Reserved / Deferred)' },
                { value: 'suspended', label: '⚠️ Tạm ngưng (Suspended)' },
                { value: 'dropped', label: '🔴 Nghỉ học / Bỏ học (Dropped)' }
            ]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} placeholder="Chọn trạng thái học vụ..." />;
        }
        if (cond.field === 'erp_class_id') {
            if (erpClasses.length > 0) {
                return <CompactSelect options={erpClasses} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} placeholder="Chọn lớp học / khóa học..." />;
            }
        }
        if (cond.field === 'erp_tuition_status') {
            return <CompactSelect options={[
                { value: 'paid', label: '✅ Đã hoàn tất học phí (Paid)' },
                { value: 'has_debt', label: '💳 Còn công nợ / Đóng từng đợt (Has Debt)' },
                { value: 'overdue', label: '🚨 Quá hạn đóng học phí (Overdue)' },
                { value: 'unpaid', label: '⏳ Chưa đóng phí (Unpaid)' }
            ]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} placeholder="Chọn trạng thái học phí..." />;
        }
        if (cond.field === 'erp_deal_status') {
            return <CompactSelect options={[
                { value: 'open', label: '⏳ Đang mở / Đang đàm phán (Open Deal)' },
                { value: 'won', label: '🏆 Thành công / Đã chốt (Won Deal)' },
                { value: 'lost', label: '❌ Thất bại / Đã hủy (Lost Deal)' },
                { value: 'no_deal', label: '⚪ Chưa có Deal nào (No Deal)' }
            ]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} placeholder="Chọn trạng thái Deal..." />;
        }
        if (cond.field === 'erp_ticket_status') {
            return <CompactSelect options={[
                { value: 'has_open_ticket', label: '🔴 Đang có Ticket mở / Chờ xử lý (Open)' },
                { value: 'in_progress', label: '🟡 Đang xử lý (In Progress)' },
                { value: 'resolved', label: '🟢 Đã giải quyết / Đã đóng (Resolved)' },
                { value: 'no_ticket', label: '⚪ Chưa từng gửi Ticket' }
            ]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} placeholder="Chọn trạng thái Ticket..." />;
        }
        if (cond.field === 'erp_has_certificate') {
            return <CompactSelect options={[
                { value: 'yes', label: '🏅 Đã cấp chứng chỉ / Bằng tốt nghiệp' },
                { value: 'no', label: '⏳ Chưa cấp chứng chỉ' }
            ]} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} placeholder="Chọn trạng thái chứng chỉ..." />;
        }
        if (cond.field === 'list' && availableLists.length > 0) {
            return <CompactSelect options={availableLists} value={cond.value} onChange={(v) => updateCondition(groupId, cond.id, 'value', v)} placeholder="Chọn danh sách..." />;
        }

        const isNumericOperator = type === 'number' || cond.operator === 'before_days' || cond.operator === 'in_the_last' || cond.operator === 'not_in_the_last' || cond.operator === 'within_days';
        const isDateOperator = (type === 'date' || type === 'birthday' || type === 'activity_date') && !isNumericOperator;

        return (
            <input
                type={isNumericOperator ? 'number' : isDateOperator ? 'date' : 'text'}
                value={cond.value}
                onChange={(e) => updateCondition(groupId, cond.id, 'value', e.target.value)}
                className="w-full px-3 py-2 rounded-[var(--radius-md)] border border-slate-200 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none text-xs font-medium text-slate-700 bg-white h-[38px]"
                placeholder={isNumericOperator ? 'Số ngày / Giá trị...' : 'Giá trị...'}
            />
        );
    };

    if (!isVisible) return null;

    return createPortal(
        <div className="fixed inset-0 z-[110000] flex items-center justify-center p-4">
            <div
                className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ease-out ${animateIn ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <div
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                className={`bg-white rounded-[18px] shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] ring-1 ring-white/20 font-sans overflow-hidden transform transition-all duration-500 relative ${animateIn ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'}`}
            >

                {isLoading && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] z-50 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                            <Loader2 className="w-8 h-8 text-[var(--color-primary)] animate-spin" />
                            <p className="text-xs font-bold text-slate-500 animate-pulse">Đang xử lý...</p>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-[var(--radius-md)] bg-rose-50 text-[var(--color-primary)] flex items-center justify-center border border-rose-100 shadow-sm">
                            <Filter className="w-4.5 h-4.5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 tracking-tight">{initialSegment ? 'Chỉnh sửa Phân Khúc' : 'Tạo Phân Khúc Mới'}</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bộ lọc dữ liệu Khách hàng & CRM</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 pb-8 overflow-y-auto custom-scrollbar space-y-6 flex-1 bg-slate-50/50">

                    {/* Templates */}
                    {!initialSegment && (
                        <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Mẫu có sẵn</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {SEGMENT_TEMPLATES.map(tpl => {
                                    const Icon = tpl.icon;
                                    return (
                                        <button
                                            key={tpl.id}
                                            onClick={() => applyTemplate(tpl)}
                                            className="flex flex-col items-center justify-center p-3 rounded-[14px] border border-slate-100 bg-white hover:border-[var(--color-primary)]/30 hover:shadow-md hover:bg-rose-50/20 transition-all group w-full"
                                        >
                                            <div className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center mb-2 transition-transform group-hover:scale-110 bg-rose-50 text-[var(--color-primary)]">
                                                <Icon className="w-4 h-4" />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-600 group-hover:text-slate-800 text-center leading-tight">{tpl.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Basic Info */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tên phân khúc</label>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="VD: Khách hàng VIP tại TP.HCM..."
                                    className="w-full pl-9 pr-4 py-2 rounded-[var(--radius-md)] border border-slate-200 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none text-xs font-bold text-slate-700 bg-white h-[40px]"
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Lưu trữ tự động</label>
                            <CompactSelect
                                value={autoCleanupDays}
                                onChange={setAutoCleanupDays}
                                options={[
                                    { value: '0', label: 'Không bao giờ' },
                                    { value: '30', label: 'Sau 30 ngày' },
                                    { value: '90', label: 'Sau 90 ngày' }
                                ]}
                                className="h-[40px]"
                            />
                        </div>
                    </div>

                    {/* Features Toggle */}
                    <div className="flex flex-col p-3.5 rounded-[14px] border border-slate-200 bg-white shadow-sm mt-4 transition-all">
                        <div className="flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-[var(--radius-md)] bg-rose-50 flex items-center justify-center transition-colors group-hover:bg-rose-100 border border-rose-100 shadow-sm">
                                    <Bell className={`w-5 h-5 text-[var(--color-primary)] ${notifyOnJoin ? 'animate-pulse' : ''}`} />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800 tracking-tight mb-0.5">Thời gian thực: Báo Cáo Lead Mới</h4>
                                    <p className="text-[11px] font-medium text-slate-500">Tự động push thông báo trực tiếp cho bạn khi có user thỏa mãn điều kiện gia nhập (Join) vào nhánh phân khúc này.</p>
                                </div>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer mr-1">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={notifyOnJoin}
                                    onChange={(e) => setNotifyOnJoin(e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]"></div>
                            </label>
                        </div>

                        {notifyOnJoin && (
                            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                <div className="space-y-1.5 md:col-span-2">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tiêu đề (Subject) <span className="text-[var(--color-primary)]">*</span></label>
                                    <input
                                        value={notifySubject}
                                        onChange={(e) => setNotifySubject(e.target.value)}
                                        placeholder="VD: [Cảnh báo Khách Nóng] Lead mới lọt lưới..."
                                        className="w-full px-4 py-2 rounded-[var(--radius-md)] border border-slate-200 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none text-xs font-medium text-slate-700 bg-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Email nhận <span className="text-[var(--color-primary)]">*</span></label>
                                    <input
                                        value={notifyEmail}
                                        onChange={(e) => setNotifyEmail(e.target.value)}
                                        placeholder="admin@example.com"
                                        className="w-full px-4 py-2 rounded-[var(--radius-md)] border border-slate-200 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none text-xs font-medium text-slate-700 bg-white"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Email CC thêm (Tùy chọn)</label>
                                    <input
                                        value={notifyCc}
                                        onChange={(e) => setNotifyCc(e.target.value)}
                                        placeholder="sale1@example.com, mgr@example.com"
                                        className="w-full px-4 py-2 rounded-[var(--radius-md)] border border-slate-200 focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none text-xs font-medium text-slate-700 bg-white"
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Conditions */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Điều kiện lọc</h4>
                        </div>

                        {groups.map((group, groupIdx) => (
                            <div key={group.id} className="relative animate-in slide-in-from-bottom-2 duration-300">
                                {groupIdx > 0 && (
                                    <div className="flex items-center gap-3 my-3">
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                        <div className="px-3 py-1 bg-rose-50 text-[var(--color-primary)] rounded-full text-[9px] font-bold uppercase tracking-wider border border-rose-100 shadow-sm">HOẶC (OR)</div>
                                        <div className="h-px bg-slate-200 flex-1"></div>
                                    </div>
                                )}

                                <div className="bg-white border border-slate-200 rounded-[14px] p-4 shadow-sm group hover:border-[var(--color-primary)]/40 hover:shadow-md transition-all relative">
                                    {/* Group Actions */}
                                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <button onClick={() => setGroups([...groups, { ...group, id: crypto.randomUUID(), conditions: group.conditions.map(c => ({ ...c, id: crypto.randomUUID() })) }])} className="p-1.5 text-slate-400 hover:text-[var(--color-primary)] hover:bg-rose-50 rounded-[var(--radius-md)] transition-colors" title="Nhân bản">
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                        {groups.length > 1 && (
                                            <button onClick={() => setGroups(groups.filter(g => g.id !== group.id))} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-[var(--radius-md)] transition-colors" title="Xóa nhóm">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        {group.conditions.map((cond, condIdx) => (
                                            <div key={cond.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center relative pl-8 sm:pl-0">
                                                {/* Logic Connector */}
                                                <div className="absolute sm:static left-0 top-3 sm:top-auto w-6 sm:w-10 text-right shrink-0 mr-2">
                                                    {condIdx === 0 ? (
                                                        <span className="text-[10px] font-bold text-slate-400">NẾU</span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-[var(--color-primary)] bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">VÀ</span>
                                                    )}
                                                </div>

                                                <div className="flex-1 grid grid-cols-10 gap-2 w-full">
                                                    <div className="col-span-4">
                                                        <CompactSelect
                                                            options={Object.entries(FIELD_DEFINITIONS).map(([k, v]) => ({ value: k, label: v.label }))}
                                                            value={cond.field}
                                                            onChange={(v) => updateCondition(group.id, cond.id, 'field', v)}
                                                        />
                                                    </div>
                                                    <div className="col-span-2">
                                                        <CompactSelect
                                                            options={OPERATORS_BY_TYPE[FIELD_DEFINITIONS[cond.field]?.type || 'text'] || OPERATORS_BY_TYPE.text}
                                                            value={cond.operator}
                                                            onChange={(v) => updateCondition(group.id, cond.id, 'operator', v)}
                                                        />
                                                    </div>
                                                    <div className="col-span-4 relative group/input">
                                                        {renderInput(group.id, cond)}
                                                        {group.conditions.length > 1 && (
                                                            <button onClick={() => removeCondition(group.id, cond.id)} className="absolute -right-2 -top-2 bg-white text-rose-500 p-1 rounded-full border border-slate-100 shadow-md opacity-0 group-hover/input:opacity-100 transition-all hover:bg-rose-50 hover:scale-110">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="mt-3 pl-12 flex">
                                        <button
                                            onClick={() => addCondition(group.id)}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[10px] font-bold text-[var(--color-primary)] bg-rose-50 hover:bg-rose-100 transition-all border border-rose-100"
                                        >
                                            <Plus className="w-3 h-3" />
                                            Thêm điều kiện (AND)
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <button
                            onClick={addGroup}
                            className="w-full py-3 rounded-[14px] border-2 border-dashed border-slate-300 hover:border-[var(--color-primary)] hover:bg-rose-50/50 text-slate-400 hover:text-[var(--color-primary)] transition-all flex items-center justify-center gap-2 text-xs font-bold group"
                        >
                            <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            Thêm nhóm điều kiện mới (OR)
                        </button>
                    </div>

                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-white shrink-0 sticky bottom-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-[var(--radius-md)] bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Dự kiến</p>
                            <div className="flex items-end gap-1">
                                <span className="text-lg font-black text-slate-800 leading-none">{estimatedCount.toLocaleString()}</span>
                                <span className="text-[10px] font-bold text-slate-500 mb-0.5">khách</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} disabled={isLoading} className="h-9 px-4 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 rounded-[var(--radius-md)] transition-all">
                            Hủy
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isLoading}
                            className={`h-9 px-5 rounded-[var(--radius-md)] text-white text-xs font-semibold shadow-sm flex items-center gap-2 transition-all active:scale-95 ${isLoading ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-[var(--color-primary)] hover:opacity-95'}`}
                        >
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                            {initialSegment ? 'Lưu thay đổi' : 'Tạo phân khúc'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        getMktPortalRoot()
    );
};

export default SegmentBuilderModal;
