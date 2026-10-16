import { Mail, Clock, GitMerge, Tag, List, MessageSquare, Beaker, UserMinus, Link as LinkIcon, AlertTriangle, Zap } from 'lucide-react';

export const STEP_DEFINITIONS = [
    {
        id: 'action',
        label: 'Gửi Email',
        desc: 'Gửi bản tin, khuyến mãi.',
        icon: Mail,
        iconName: 'mail',
        color: 'bg-blue-600 text-white shadow-blue-200'
    },
    {
        id: 'wait',
        label: 'Chờ (Wait)',
        desc: 'Tạm dừng quy trình.',
        icon: Clock,
        iconName: 'clock',
        color: 'bg-amber-600 text-white shadow-amber-200'
    },
    {
        id: 'condition',
        label: 'Rẽ nhánh Logic',
        desc: 'Kiểm tra hành vi khách.',
        icon: GitMerge,
        iconName: 'git-merge',
        color: 'bg-indigo-600 text-white shadow-indigo-200',
        requiresAction: true
    },
    {
        id: 'advanced_condition',
        label: 'Rẽ nhánh Nâng cao',
        desc: 'Rẽ nhánh theo OS, Device, City...',
        icon: GitMerge,
        iconName: 'git-merge',
        color: 'bg-blue-600 text-white shadow-blue-200'
    },
    {
        id: 'list_action',
        label: 'Quản lý Danh sách',
        desc: 'Thêm/Gỡ khỏi List.',
        icon: List,
        iconName: 'list',
        color: 'bg-orange-600 text-white shadow-orange-200'
    },
    {
        id: 'update_tag',
        label: 'Gắn Tag khách',
        desc: 'Phân loại tự động.',
        icon: Tag,
        iconName: 'tag',
        color: 'bg-emerald-600 text-white shadow-emerald-200'
    },
    {
        id: 'zalo_zns',
        label: 'Zalo ZNS',
        desc: 'Gửi tin nhắn Zalo ZBS.',
        icon: MessageSquare,
        iconName: 'message-square', // Note: Lucide icon name might differ from implementation expected string if custom icon component used, but typically standardized.
        color: 'bg-blue-600 text-white shadow-blue-200'
    },
    {
        id: 'split_test',
        label: 'A/B Split Test',
        desc: 'Thử nghiệm luồng.',
        icon: Beaker,
        iconName: 'beaker',
        color: 'bg-blue-600 text-white shadow-blue-200'
    },
    {
        id: 'remove_action',
        label: 'Dọn dẹp (Cleanup)',
        desc: 'Hủy đăng ký/Xóa vĩnh viễn.',
        icon: UserMinus,
        iconName: 'user-minus',
        color: 'bg-rose-600 text-white shadow-rose-200'
    },

    {
        id: 'link_flow',
        label: 'Chuyển kịch bản',
        desc: 'Kết nối automation khác.',
        icon: LinkIcon,
        iconName: 'link',
        color: 'bg-slate-700 text-white shadow-slate-200'
    }
];

export const getStepDefinition = (type: string) => {
    return STEP_DEFINITIONS.find(s => s.id === type);
};

export const getStepLabel = (type: string) => {
    return getStepDefinition(type)?.label || 'Bước mới';
};

export const getStepIcon = (type: string) => {
    // Return compatible icon string for FlowNodes legacy support if needed
    return getStepDefinition(type)?.iconName || 'zap';
};
