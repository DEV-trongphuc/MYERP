import {
    Send, Clock, Split, GitMerge, Tag, Layers, FileInput, BellRing, Sparkles,
    MessageSquare, Briefcase
} from 'lucide-react';

export const STEP_DEFINITIONS = [
    {
        id: 'action',
        type: 'action',
        label: 'Gửi Email',
        desc: 'Tự động gửi email marketing cá nhân hóa.',
        icon: Send,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        group: 'actions'
    },
    {
        id: 'zalo_zns',
        type: 'zalo_zns',
        label: 'Gửi Zalo ZNS',
        desc: 'Gửi tin nhắn thông báo qua Zalo OA tới số điện thoại.',
        icon: MessageSquare,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        group: 'actions'
    },
    {
        id: 'crm_action',
        type: 'crm_action',
        label: 'Tác vụ CRM (MYERP)',
        desc: 'Cập nhật giai đoạn Pipeline, tạo lịch gọi cho Sale hoặc thông báo nội bộ.',
        icon: Briefcase,
        color: 'text-indigo-700',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        group: 'actions'
    },
    {
        id: 'wait',
        type: 'wait',
        label: 'Chờ (Delay)',
        desc: 'Tạm dừng quy trình một khoảng thời gian.',
        icon: Clock,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        group: 'flow'
    },
    {
        id: 'condition',
        type: 'condition',
        label: 'Phân nhánh (If/Else)',
        desc: 'Rẽ nhánh theo hành vi Mở/Click hoặc thuộc tính.',
        icon: GitMerge,
        color: 'text-purple-600',
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        group: 'flow'
    },
    {
        id: 'advanced_condition',
        type: 'advanced_condition',
        label: 'Điều kiện nâng cao (Multi-If)',
        desc: 'Rẽ nhiều nhánh phức tạp với logic AND/OR đa tầng (Hồ sơ, Pipeline CRM, Đa kênh).',
        icon: Split,
        color: 'text-fuchsia-600',
        bg: 'bg-fuchsia-50',
        border: 'border-fuchsia-200',
        group: 'flow'
    },
    {
        id: 'split_test',
        type: 'split_test',
        label: 'Thử nghiệm A/B',
        desc: 'Chia ngẫu nhiên lưu lượng để test hiệu quả.',
        icon: Split,
        color: 'text-indigo-600',
        bg: 'bg-indigo-50',
        border: 'border-indigo-200',
        group: 'flow'
    },
    {
        id: 'update_tag',
        type: 'update_tag',
        label: 'Cập nhật Nhãn (Tag)',
        desc: 'Thêm hoặc gỡ bỏ Tag để phân loại khách hàng.',
        icon: Tag,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        group: 'data'
    },
    {
        id: 'list_action',
        type: 'list_action',
        label: 'Quản lý Danh sách',
        desc: 'Thêm vào hoặc xóa khỏi một Danh sách tĩnh.',
        icon: Layers,
        color: 'text-cyan-600',
        bg: 'bg-cyan-50',
        border: 'border-cyan-200',
        group: 'data'
    },
    {
        id: 'link_flow',
        type: 'link_flow',
        label: 'Chuyển sang Kịch bản khác',
        desc: 'Kết thúc ở đây và kích hoạt một Flow mới.',
        icon: FileInput,
        color: 'text-rose-600',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        group: 'flow'
    },
    {
        id: 'remove_action',
        type: 'remove_action',
        label: 'Xóa / Hủy đăng ký',
        desc: 'Chuyển trạng thái sang Unsubscribed hoặc Xóa vĩnh viễn.',
        icon: BellRing,
        color: 'text-slate-600',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        group: 'data'
    }
];

export type ConditionFieldType =
    | 'text'
    | 'select'
    | 'number'
    | 'boolean'
    | 'tag'
    | 'activity'
    | 'date'
    | 'stage'
    | 'owner';

export interface ConditionFieldOption {
    value: string;
    label: string;
    type: ConditionFieldType;
    group: 'profile' | 'crm_pipeline' | 'erp_academic' | 'behavior';
    options?: Array<{ value: string; label: string } | string>;
    placeholder?: string;
}

export interface ConditionFieldGroup {
    id: 'profile' | 'crm_pipeline' | 'erp_academic' | 'behavior';
    label: string;
    fields: ConditionFieldOption[];
}

export const STANDARD_PIPELINE_STAGES: Array<{ value: string; label: string }> = [
    { value: '1', label: 'Lead mới (New Lead)' },
    { value: '2', label: 'Đã liên hệ (Contacted)' },
    { value: '3', label: 'Đang tư vấn / Quan tâm (Qualified)' },
    { value: '4', label: 'Hẹn tư vấn / Gửi báo giá (Proposal)' },
    { value: '5', label: 'Đặt cọc / Chốt Deal (Won / Deposited)' },
    { value: '6', label: 'Thất bại / Ngừng chăm sóc (Lost)' }
];

export const ADVANCED_CONDITION_FIELD_GROUPS: ConditionFieldGroup[] = [
    {
        id: 'profile',
        label: 'Thông tin Hồ sơ & Nhân khẩu học',
        fields: [
            { value: 'first_name', label: 'Họ & Tên', type: 'text', group: 'profile', placeholder: 'VD: Nguyễn Văn A...' },
            { value: 'email', label: 'Địa chỉ Email', type: 'text', group: 'profile', placeholder: 'VD: @gmail.com...' },
            { value: 'phone_number', label: 'Số điện thoại', type: 'text', group: 'profile', placeholder: 'VD: 090...' },
            { value: 'job_title', label: 'Chức danh / Nghề nghiệp', type: 'text', group: 'profile', placeholder: 'VD: Giám đốc, Sinh viên...' },
            { value: 'company_name', label: 'Tên công ty / Tổ chức', type: 'text', group: 'profile', placeholder: 'VD: Công ty ABC...' },
            {
                value: 'gender',
                label: 'Giới tính',
                type: 'select',
                group: 'profile',
                options: [
                    { value: 'Nam', label: 'Nam' },
                    { value: 'Nữ', label: 'Nữ' },
                    { value: 'Khác', label: 'Khác' }
                ]
            },
            { value: 'city', label: 'Tỉnh / Thành phố', type: 'text', group: 'profile', placeholder: 'VD: Hà Nội, TP.HCM, Đà Nẵng...' },
            { value: 'district', label: 'Quận / Huyện', type: 'text', group: 'profile', placeholder: 'VD: Quận 1, Cầu Giấy...' },
            {
                value: 'country',
                label: 'Quốc gia',
                type: 'select',
                group: 'profile',
                options: [
                    { value: 'Vietnam', label: 'Vietnam (Việt Nam)' },
                    { value: 'United States', label: 'United States (Mỹ)' },
                    { value: 'Australia', label: 'Australia (Úc)' },
                    { value: 'Canada', label: 'Canada' },
                    { value: 'United Kingdom', label: 'United Kingdom (Anh)' },
                    { value: 'Japan', label: 'Japan (Nhật Bản)' },
                    { value: 'South Korea', label: 'South Korea (Hàn Quốc)' },
                    { value: 'Singapore', label: 'Singapore' },
                    { value: 'Germany', label: 'Germany (Đức)' }
                ]
            },
            { value: 'date_of_birth', label: 'Ngày sinh', type: 'date', group: 'profile' },
            { value: 'anniversary_date', label: 'Ngày kỷ niệm', type: 'date', group: 'profile' }
        ]
    },
    {
        id: 'crm_pipeline',
        label: 'Pipeline, Vòng chia & Nghiệp vụ MYERP CRM',
        fields: [
            {
                value: 'crm_team_id',
                label: 'Vòng chia / Nhóm Sale (Team)',
                type: 'select',
                group: 'crm_pipeline',
                placeholder: 'Chọn Vòng chia / Team Sale...'
            },
            {
                value: 'crm_owner_id',
                label: 'Tư vấn viên phụ trách (Sale Owner)',
                type: 'owner',
                group: 'crm_pipeline',
                placeholder: 'Chọn hoặc nhập ID / Tên Sale...'
            },
            {
                value: 'crm_sale_contacted',
                label: 'Sale đã liên hệ (Gọi / Ghi chú / CSKH)',
                type: 'boolean',
                group: 'crm_pipeline'
            },
            {
                value: 'crm_hours_uncontacted',
                label: 'Số giờ chưa được Sale liên hệ',
                type: 'number',
                group: 'crm_pipeline',
                placeholder: 'VD: 2 (giờ)'
            },
            {
                value: 'crm_stage_id',
                label: 'Giai đoạn Pipeline CRM',
                type: 'stage',
                group: 'crm_pipeline',
                options: STANDARD_PIPELINE_STAGES
            },
            {
                value: 'crm_lead_status',
                label: 'Trạng thái Lead (Active / Nurture / Lost)',
                type: 'select',
                group: 'crm_pipeline',
                options: [
                    { value: 'active', label: 'Đang chăm sóc (Active)' },
                    { value: 'nurture', label: 'Nuôi dưỡng (Nurture)' },
                    { value: 'lost', label: 'Thất bại (Lost)' }
                ]
            },
            {
                value: 'crm_temperature',
                label: 'Nhiệt độ Lead (Hot / Warm / Cold)',
                type: 'select',
                group: 'crm_pipeline',
                options: [
                    { value: 'hot', label: 'Nóng (Hot)' },
                    { value: 'warm', label: 'Ấm (Warm)' },
                    { value: 'cold', label: 'Lạnh (Cold)' }
                ]
            },
            {
                value: 'crm_program',
                label: 'Chương trình / Sản phẩm quan tâm',
                type: 'text',
                group: 'crm_pipeline',
                placeholder: 'VD: Du học Úc, IELTS, Định cư...'
            },
            {
                value: 'crm_branch_id',
                label: 'Chi nhánh / Cơ sở (Branch)',
                type: 'select',
                group: 'crm_pipeline',
                placeholder: 'Chọn Chi nhánh...'
            },
            {
                value: 'crm_deposit_status',
                label: 'Trạng thái Đặt cọc (Approved / Pending / None)',
                type: 'select',
                group: 'crm_pipeline',
                options: [
                    { value: 'approved', label: 'Đã đặt cọc (Approved)' },
                    { value: 'pending', label: 'Chờ duyệt cọc (Pending)' },
                    { value: 'none', label: 'Chưa đặt cọc (None)' }
                ]
            },
            {
                value: 'crm_deposit_amount',
                label: 'Số tiền Đặt cọc (VNĐ)',
                type: 'number',
                group: 'crm_pipeline',
                placeholder: 'VD: 10000000'
            },
            {
                value: 'crm_expected_revenue',
                label: 'Doanh thu dự kiến (VNĐ)',
                type: 'number',
                group: 'crm_pipeline',
                placeholder: 'VD: 50000000'
            },
            {
                value: 'source',
                label: 'Nguồn khách hàng (Source)',
                type: 'select',
                group: 'crm_pipeline',
                options: [
                    { value: 'Facebook', label: 'Facebook Ads / Fanpage' },
                    { value: 'Zalo', label: 'Zalo OA / ZNS' },
                    { value: 'Website', label: 'Website / Form đăng ký' },
                    { value: 'Tiktok', label: 'TikTok' },
                    { value: 'Google', label: 'Google Search / Ads' },
                    { value: 'Referral', label: 'Giới thiệu (Referral)' },
                    { value: 'Event', label: 'Sự kiện / Hội thảo' },
                    { value: 'Hotline', label: 'Hotline / Trực tiếp' }
                ]
            },
            {
                value: 'tag',
                label: 'Nhãn Tag ERP / Marketing',
                type: 'tag',
                group: 'crm_pipeline'
            }
        ]
    },
    {
        id: 'erp_academic',
        label: 'Học viên, Lớp học & Tài chính (MYERP)',
        fields: [
            {
                value: 'erp_is_student',
                label: 'Đã là Học viên MYERP',
                type: 'boolean',
                group: 'erp_academic'
            },
            {
                value: 'erp_student_status',
                label: 'Trạng thái Học tập',
                type: 'select',
                group: 'erp_academic',
                options: [
                    { value: 'studying', label: 'Đang theo học (Studying)' },
                    { value: 'graduated', label: 'Đã tốt nghiệp (Graduated)' },
                    { value: 'reserved', label: 'Đang bảo lưu (Reserved)' },
                    { value: 'dropped', label: 'Đã nghỉ học (Dropped)' }
                ]
            },
            {
                value: 'erp_class_id',
                label: 'Lớp đào tạo (MYERP Class)',
                type: 'select',
                group: 'erp_academic',
                placeholder: 'Chọn Lớp đào tạo...'
            },
            {
                value: 'erp_tuition_status',
                label: 'Tình trạng Học phí / Đặt cọc',
                type: 'select',
                group: 'erp_academic',
                options: [
                    { value: 'paid_full', label: 'Đã đóng đủ học phí (Paid Full)' },
                    { value: 'has_debt', label: 'Còn nợ học phí / Chờ thu đợt tiếp (Has Debt)' },
                    { value: 'overdue', label: 'Nợ quá hạn thanh toán (Overdue)' },
                    { value: 'no_deposit', label: 'Chưa phát sinh phiếu thu / đặt cọc' }
                ]
            },
            {
                value: 'erp_deal_status',
                label: 'Trạng thái Cơ hội (Deal)',
                type: 'select',
                group: 'erp_academic',
                options: [
                    { value: 'open', label: 'Đang mở / Đang theo đuổi (Open)' },
                    { value: 'won', label: 'Đã chốt thành công (Won)' },
                    { value: 'lost', label: 'Thất bại (Lost)' },
                    { value: 'none', label: 'Chưa có Deal' }
                ]
            },
            {
                value: 'erp_deal_value',
                label: 'Tổng giá trị Deal (VNĐ)',
                type: 'number',
                group: 'erp_academic',
                placeholder: 'VD: 25000000'
            },
            {
                value: 'erp_sla_uncontacted_hours',
                label: 'Số giờ chưa CSKH (Vi phạm SLA)',
                type: 'number',
                group: 'erp_academic',
                placeholder: 'VD: 24 (giờ)'
            },
            {
                value: 'erp_ticket_status',
                label: 'Trạng thái Ticket Hỗ trợ / Khiếu nại',
                type: 'select',
                group: 'erp_academic',
                options: [
                    { value: 'has_open', label: 'Đang có Ticket chờ xử lý (Open / In Progress)' },
                    { value: 'resolved', label: 'Đã giải quyết xong (Resolved / Closed)' },
                    { value: 'none', label: 'Không có Ticket khiếu nại' }
                ]
            },
            {
                value: 'erp_has_certificate',
                label: 'Đã cấp Chứng chỉ (Certificate)',
                type: 'boolean',
                group: 'erp_academic'
            }
        ]
    },
    {
        id: 'behavior',
        label: 'Hành vi & Tương tác Đa kênh',
        fields: [
            {
                value: 'channel_available',
                label: 'Kênh liên lạc khả dụng',
                type: 'select',
                group: 'behavior',
                options: [
                    { value: 'zalo_oa', label: 'Có Zalo OA / SĐT dùng Zalo' },
                    { value: 'email_valid', label: 'Có Email hợp lệ' },
                    { value: 'phone_valid', label: 'Có Số điện thoại hợp lệ' }
                ]
            },
            {
                value: 'lead_score',
                label: 'Điểm tương tác (Lead Score)',
                type: 'number',
                group: 'behavior',
                placeholder: 'VD: 50'
            },
            {
                value: 'lastActivityDays',
                label: 'Số ngày không tương tác (Ngủ đông)',
                type: 'number',
                group: 'behavior',
                placeholder: 'VD: 30 (ngày)'
            },
            {
                value: 'activity_history',
                label: 'Lịch sử tương tác Đa kênh',
                type: 'activity',
                group: 'behavior',
                options: [
                    { value: 'opened_email', label: 'Đã mở Email chiến dịch' },
                    { value: 'clicked_link', label: 'Đã click Link trong Email' },
                    { value: 'received_zns', label: 'Đã nhận tin nhắn Zalo ZNS' },
                    { value: 'submitted_form', label: 'Đã điền Form đăng ký' },
                    { value: 'purchased', label: 'Đã phát sinh giao dịch / Mua hàng' }
                ]
            },
            {
                value: 'survey_score',
                label: 'Điểm Khảo sát (CSAT / NPS)',
                type: 'number',
                group: 'behavior',
                placeholder: 'VD: 8'
            },
            {
                value: 'web_page_visited',
                label: 'Đã truy cập đường dẫn URL Website',
                type: 'text',
                group: 'behavior',
                placeholder: 'VD: /bang-gia, /dang-ky-tu-van...'
            },
            {
                value: 'is_zalo_follower',
                label: 'Quan tâm Zalo OA (Follower)',
                type: 'boolean',
                group: 'behavior'
            },
            {
                value: 'verified',
                label: 'Xác thực địa chỉ Email',
                type: 'boolean',
                group: 'behavior'
            }
        ]
    }
];

export const ADVANCED_CONDITION_FIELDS: ConditionFieldOption[] =
    ADVANCED_CONDITION_FIELD_GROUPS.flatMap(g => g.fields);

export const OPERATORS_BY_TYPE: Record<string, Array<{ value: string; label: string }>> = {
    text: [
        { value: 'contains', label: 'Chứa (Contains)' },
        { value: 'not_contains', label: 'Không chứa' },
        { value: 'equals', label: 'Bằng chính xác' },
        { value: 'not_equals', label: 'Khác (Not Equals)' },
        { value: 'starts_with', label: 'Bắt đầu bằng' },
        { value: 'is_not_empty', label: 'Đã có thông tin' },
        { value: 'is_empty', label: 'Đang để trống' },
    ],
    select: [
        { value: 'equals', label: 'Là (Equals)' },
        { value: 'not_equals', label: 'Không phải là' },
        { value: 'contains', label: 'Chứa từ khóa' },
        { value: 'is_not_empty', label: 'Đã xác định' },
        { value: 'is_empty', label: 'Chưa xác định' },
    ],
    stage: [
        { value: 'equals', label: 'Đang ở giai đoạn' },
        { value: 'not_equals', label: 'Không ở giai đoạn' },
        { value: 'contains', label: 'Tên giai đoạn chứa' },
        { value: 'is_not_empty', label: 'Đã có giai đoạn Pipeline' },
        { value: 'is_empty', label: 'Chưa xếp vào Pipeline' },
    ],
    owner: [
        { value: 'equals', label: 'Phụ trách bởi' },
        { value: 'not_equals', label: 'Không phụ trách bởi' },
        { value: 'is_not_empty', label: 'Đã có Sale phụ trách' },
        { value: 'is_empty', label: 'Chưa phân bổ Sale' },
    ],
    number: [
        { value: 'greater_than', label: 'Lớn hơn (>)' },
        { value: 'less_than', label: 'Nhỏ hơn (<)' },
        { value: 'equals', label: 'Bằng (=)' },
        { value: 'not_equals', label: 'Khác (!=)' },
    ],
    date: [
        { value: 'is_today', label: 'Là hôm nay ( Sinh nhật / Kỷ niệm )' },
        { value: 'is_this_month', label: 'Trong tháng này' },
        { value: 'before_days', label: 'Cách đây hơn X ngày' },
        { value: 'equals', label: 'Bằng đúng ngày (YYYY-MM-DD)' },
        { value: 'is_not_empty', label: 'Đã có ngày' },
        { value: 'is_empty', label: 'Chưa có ngày' },
    ],
    boolean: [
        { value: 'is_true', label: 'Đã xác thực / Có' },
        { value: 'is_false', label: 'Chưa xác thực / Không' },
    ],
    tag: [
        { value: 'has_tag', label: 'Có gắn nhãn này' },
        { value: 'not_has_tag', label: 'Không có nhãn này' },
    ],
    activity: [
        { value: 'has_done', label: 'Đã thực hiện hành vi' },
        { value: 'not_has_done', label: 'Chưa thực hiện hành vi' },
    ]
};

export const CRM_ACTION_TYPES = [
    {
        id: 'assign_round_robin',
        label: 'Chia Lead theo Vòng chia (Round-Robin / Ca trực)',
        desc: 'Tự động phân bổ hồ sơ khách hàng theo vòng chia ca trực tư vấn viên.'
    },
    {
        id: 'reassign_if_uncontacted',
        label: 'Điều phối lại sang Sale khác nếu chưa liên hệ (SLA)',
        desc: 'Tự động thu hồi từ Sale cũ chưa CSKH và chuyển sang Sale khác trong vòng chia.'
    },
    {
        id: 'update_temperature',
        label: 'Cập nhật Nhiệt độ & Trạng thái Chăm sóc (Hot / Warm / Cold)',
        desc: 'Đổi nhanh độ nóng Lead (Hot/Warm/Cold) và trạng thái chăm sóc (Active/Nurture/Lost).'
    },
    {
        id: 'update_stage',
        label: 'Chuyển giai đoạn Pipeline & Cập nhật Lead',
        desc: 'Tự động đổi Stage, trạng thái chăm sóc hoặc độ nóng (Hot/Warm/Cold) của hồ sơ CRM.'
    },
    {
        id: 'create_task',
        label: 'Tạo công việc / Lịch gọi cho Sale',
        desc: 'Giao lịch gọi điện hoặc task chăm sóc khách hàng trên CRM kèm hạn hoàn thành.'
    },
    {
        id: 'assign_owner',
        label: 'Phân bổ Tư vấn viên phụ trách (Sale Owner)',
        desc: 'Gán tự động hồ sơ khách hàng cho tư vấn viên phụ trách.'
    },
    {
        id: 'notify_owner',
        label: 'Gửi thông báo nội bộ cho Sale phụ trách',
        desc: 'Bắn thông báo tức thì trên hệ thống MYERP cho tư vấn viên đang giữ Lead.'
    },
    {
        id: 'create_support_ticket',
        label: 'Tạo Ticket Hỗ trợ / CSKH Học vụ (MYERP Ticket)',
        desc: 'Khởi tạo tự động phiếu hỗ trợ / khiếu nại trên MYERP gắn với hồ sơ khách hàng & phân công xử lý.'
    }
] as const;

export const FLOW_TEMPLATE_CATEGORIES = [
    { id: 'all', label: 'Tất cả kịch bản' },
    { id: 'myerp_sale', label: '🎯 Chia Lead & Vòng chia Sale' },
    { id: 'pipeline_sla', label: '🔥 Chăm sóc Pipeline & SLA' },
    { id: 'academic_finance', label: '🎓 Đặt cọc, Học phí & Học vụ' },
    { id: 'omnichannel', label: '📧 Marketing Đa kênh (Email/Zalo)' }
] as const;

export const getStepDefinition = (type: string) => {
    return STEP_DEFINITIONS.find(d => d.type === type) || {
        id: 'unknown',
        type: 'unknown',
        label: 'Bước xử lý',
        desc: '',
        icon: Sparkles,
        color: 'text-slate-600',
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        group: 'other'
    };
};

export const getStepLabel = (type: string): string => {
    return getStepDefinition(type).label;
};

export const getStepIcon = (type: string): string => {
    switch (type) {
        case 'action': return 'mail';
        case 'zalo_zns':
        case 'zalo_cs':
        case 'meta_message': return 'message-square';
        case 'wait': return 'clock';
        case 'condition':
        case 'advanced_condition': return 'git-merge';
        case 'split_test': return 'beaker';
        case 'link_flow': return 'link';
        case 'remove_action': return 'user-minus';
        case 'update_tag': return 'tag';
        case 'list_action': return 'list';
        case 'crm_action': return 'briefcase';
        default: return 'zap';
    }
};

