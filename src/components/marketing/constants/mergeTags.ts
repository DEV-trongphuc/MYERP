export interface MergeTagDefinition {
    key: string;
    tag: string;
    label: string;
    group: string;
    sampleValue?: string;
    isBuiltInBasic?: boolean;
}

export interface MergeTagGroup {
    id: string;
    label: string;
    tags: MergeTagDefinition[];
}

export const MYERP_MERGE_TAG_GROUPS: MergeTagGroup[] = [
    {
        id: 'contact',
        label: 'Hồ sơ Khách hàng / Học viên',
        tags: [
            { key: 'full_name', tag: '{{full_name}}', label: 'Họ và tên đầy đủ', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'Nguyễn Văn An', isBuiltInBasic: true },
            { key: 'first_name', tag: '{{first_name}}', label: 'Tên gọi (First Name)', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'An', isBuiltInBasic: true },
            { key: 'last_name', tag: '{{last_name}}', label: 'Họ & Tên đệm (Last Name)', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'Nguyễn Văn', isBuiltInBasic: true },
            { key: 'email', tag: '{{email}}', label: 'Địa chỉ Email', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'an.nguyen@ideas.edu.vn', isBuiltInBasic: true },
            { key: 'phone', tag: '{{phone}}', label: 'Số điện thoại', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: '0901234567', isBuiltInBasic: true },
            { key: 'gender', tag: '{{gender}}', label: 'Giới tính / Xưng hô', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'Anh/Chị' },
            { key: 'birthday', tag: '{{birthday}}', label: 'Ngày sinh nhật', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: '15/08/1992' },
            { key: 'job_title', tag: '{{job_title}}', label: 'Chức danh / Nghề nghiệp', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'Giám đốc Điều hành' },
            { key: 'company', tag: '{{company}}', label: 'Công ty / Đơn vị công tác', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'IDEAS Institute' },
            { key: 'address', tag: '{{address}}', label: 'Địa chỉ chi tiết', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: '215 Điện Biên Phủ' },
            { key: 'city', tag: '{{city}}', label: 'Tỉnh / Thành phố', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'TP. Hồ Chí Minh' },
            { key: 'district', tag: '{{district}}', label: 'Quận / Huyện', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'Quận Bình Thạnh' },
            { key: 'ward', tag: '{{ward}}', label: 'Phường / Xã', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'Phường 15' },
            { key: 'crm_contact_id', tag: '{{crm_contact_id}}', label: 'Mã hồ sơ CRM', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'CRM-1024' },
            { key: 'student_code', tag: '{{student_code}}', label: 'Mã học viên (Student Code)', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'HV-2026-089' },
            { key: 'student_id', tag: '{{student_id}}', label: 'Mã học viên (Student ID)', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'HV-2026-089' },
            { key: 'class_name', tag: '{{class_name}}', label: 'Tên Lớp học / Khóa học', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'Swiss MBA - K26' },
            { key: 'class_code', tag: '{{class_code}}', label: 'Mã Lớp học', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'SMBA-K26' },
            { key: 'program', tag: '{{program}}', label: 'Chương trình quan tâm / theo học', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'Swiss MBA' },
            { key: 'study_status', tag: '{{study_status}}', label: 'Trạng thái học tập', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'Đang theo học' },
            { key: 'certificate_code', tag: '{{certificate_code}}', label: 'Mã chứng chỉ / Bằng tốt nghiệp', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'CERT-2026-0099' },
            { key: 'stage_name', tag: '{{stage_name}}', label: 'Giai đoạn phễu CRM', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'Đã tư vấn chuyên sâu' },
            { key: 'source', tag: '{{source}}', label: 'Nguồn khách hàng', group: 'Hồ sơ Khách hàng / Học viên', sampleValue: 'Website IDEAS' },
        ],
    },
    {
        id: 'consultant',
        label: 'Tư vấn viên Phụ trách (Sale)',
        tags: [
            { key: 'consultant_name', tag: '{{consultant_name}}', label: 'Tên Tư vấn viên phụ trách', group: 'Tư vấn viên Phụ trách (Sale)', sampleValue: 'Chuyên viên Tư vấn IDEAS' },
            { key: 'consultant_phone', tag: '{{consultant_phone}}', label: 'SĐT Tư vấn viên', group: 'Tư vấn viên Phụ trách (Sale)', sampleValue: '028 3925 3399' },
            { key: 'consultant_email', tag: '{{consultant_email}}', label: 'Email Tư vấn viên', group: 'Tư vấn viên Phụ trách (Sale)', sampleValue: 'admissions@ideas.edu.vn' },
            { key: 'consultant_title', tag: '{{consultant_title}}', label: 'Chức danh Tư vấn viên', group: 'Tư vấn viên Phụ trách (Sale)', sampleValue: 'Chuyên viên Tư vấn Tuyển sinh' },
            { key: 'team_name', tag: '{{team_name}}', label: 'Đội ngũ / Phòng ban tư vấn', group: 'Tư vấn viên Phụ trách (Sale)', sampleValue: 'Ban Tuyển sinh Quốc tế' },
        ],
    },
    {
        id: 'deal_deposit',
        label: 'Giao dịch, Đặt cọc & Học phí (MYERP)',
        tags: [
            { key: 'deal_title', tag: '{{deal_title}}', label: 'Tên giao dịch / Khóa đăng ký', group: 'Giao dịch, Đặt cọc & Học phí (MYERP)', sampleValue: 'Hồ sơ nhập học Swiss MBA' },
            { key: 'deal_value', tag: '{{deal_value}}', label: 'Giá trị khóa học / Giao dịch', group: 'Giao dịch, Đặt cọc & Học phí (MYERP)', sampleValue: '165.000.000 ₫' },
            { key: 'deposit_amount', tag: '{{deposit_amount}}', label: 'Số tiền đặt cọc', group: 'Giao dịch, Đặt cọc & Học phí (MYERP)', sampleValue: '20.000.000 ₫' },
            { key: 'deposit_status', tag: '{{deposit_status}}', label: 'Trạng thái đặt cọc', group: 'Giao dịch, Đặt cọc & Học phí (MYERP)', sampleValue: 'Đã xác nhận' },
            { key: 'deposit_code', tag: '{{deposit_code}}', label: 'Mã phiếu đặt cọc', group: 'Giao dịch, Đặt cọc & Học phí (MYERP)', sampleValue: 'DEP-2026-001' },
            { key: 'tuition_remaining', tag: '{{tuition_remaining}}', label: 'Học phí / Công nợ còn lại', group: 'Giao dịch, Đặt cọc & Học phí (MYERP)', sampleValue: '15.000.000 ₫' },
        ],
    },
    {
        id: 'system',
        label: 'Hệ thống & Chiến dịch',
        tags: [
            { key: 'today', tag: '{{today}}', label: 'Ngày hiện tại', group: 'Hệ thống & Chiến dịch', isBuiltInBasic: true },
            { key: 'time', tag: '{{time}}', label: 'Giờ hiện tại', group: 'Hệ thống & Chiến dịch', isBuiltInBasic: true },
            { key: 'year', tag: '{{year}}', label: 'Năm hiện tại', group: 'Hệ thống & Chiến dịch', isBuiltInBasic: true },
            { key: 'campaign_name', tag: '{{campaign_name}}', label: 'Tên chiến dịch', group: 'Hệ thống & Chiến dịch', sampleValue: 'Chiến dịch Tuyển sinh IDEAS' },
            { key: 'unsubscribe_url', tag: '{{unsubscribe_url}}', label: 'Link Hủy đăng ký nhận tin', group: 'Hệ thống & Chiến dịch', isBuiltInBasic: true },
        ],
    },
];

export const MYERP_MERGE_TAGS: MergeTagDefinition[] = MYERP_MERGE_TAG_GROUPS.flatMap((g) => g.tags);

export const MYERP_MERGE_TAG_LABELS: Record<string, string> = MYERP_MERGE_TAGS.reduce((acc, item) => {
    acc[item.key] = item.label;
    return acc;
}, {
    current_date: 'Ngày hiện tại',
    current_time: 'Giờ hiện tại',
    current_year: 'Năm hiện tại',
    company_name: 'Công ty / Đơn vị công tác',
    phone_number: 'Số điện thoại',
    unsubscribe_link: 'Link Hủy đăng ký nhận tin',
    cert_no: 'Mã chứng chỉ (Cert No)',
    cert_link: 'Link chứng chỉ (Cert Link)',
    cert_img: 'Ảnh chứng chỉ (Cert Image)',
    website: 'Website',
} as Record<string, string>);

export const BUILT_IN_BASIC_MERGE_TAG_KEYS = new Set<string>([
    'full_name', 'fullname', 'name',
    'first_name', 'firstname',
    'last_name', 'lastname',
    'email',
    'phone', 'phone_number', 'phonenumber',
    'today', 'current_date', 'date',
    'time', 'current_time',
    'year', 'current_year',
    'unsubscribe_url', 'unsubscribe_link',
    'subscriber_id', 'id',
]);
