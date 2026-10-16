// components/surveys/constants/questionTypes.ts

import { QuestionTypeDefinition } from '../../../types/survey';

export const QUESTION_TYPE_DEFINITIONS: QuestionTypeDefinition[] = [
  // Cơ bản
  { type: 'short_text',    group: 'Cơ bản',   icon: 'Type',         label: 'Văn bản ngắn',     description: 'Ô nhập 1 dòng' },
  { type: 'long_text',     group: 'Cơ bản',   icon: 'AlignLeft',    label: 'Văn bản dài',      description: 'Textarea nhiều dòng' },
  { type: 'email',         group: 'Cơ bản',   icon: 'Mail',         label: 'Email',            description: 'Nhập email có validate' },
  { type: 'phone',         group: 'Cơ bản',   icon: 'Phone',        label: 'Số điện thoại',    description: 'Format VN tự động' },
  { type: 'number',        group: 'Cơ bản',   icon: 'Hash',         label: 'Số',               description: 'Input số có min/max' },
  { type: 'date',          group: 'Cơ bản',   icon: 'Calendar',     label: 'Ngày tháng',       description: 'Date picker' },
  // Lựa chọn
  { type: 'single_choice', group: 'Lựa chọn', icon: 'CircleDot',    label: 'Chọn 1 đáp án',   description: 'Radio buttons' },
  { type: 'multi_choice',  group: 'Lựa chọn', icon: 'CheckSquare',  label: 'Chọn nhiều',       description: 'Checkboxes' },
  { type: 'dropdown',      group: 'Lựa chọn', icon: 'ChevronDown',  label: 'Dropdown',         description: 'Select box' },
  { type: 'yes_no',        group: 'Lựa chọn', icon: 'ToggleLeft',   label: 'Có / Không',       description: '2 nút lớn' },
  // Đánh giá
  { type: 'star_rating',   group: 'Đánh giá', icon: 'Star',         label: 'Đánh giá sao',     description: '1–5 sao tuỳ chỉnh' },
  { type: 'nps',           group: 'Đánh giá', icon: 'TrendingUp',   label: 'NPS Score',        description: 'Scale 0–10' },
  { type: 'likert',        group: 'Đánh giá', icon: 'BarChart2',    label: 'Thang Likert',     description: 'Mức độ đồng ý' },
  { type: 'slider',        group: 'Đánh giá', icon: 'Sliders',      label: 'Thanh kéo',        description: 'Range slider' },
  { type: 'emoji_rating',  group: 'Đánh giá', icon: 'Smile',        label: 'Emoji cảm xúc',   description: '😠😕😐🙂😁' },
  // Nâng cao
  { type: 'ranking',       group: 'Nâng cao', icon: 'List',         label: 'Xếp hạng',         description: 'Kéo thả thứ tự ưu tiên' },
  { type: 'matrix_single', group: 'Nâng cao', icon: 'Grid',         label: 'Ma trận (1)',      description: 'Bảng hàng × cột' },
  { type: 'matrix_multi',  group: 'Nâng cao', icon: 'LayoutGrid',   label: 'Ma trận (nhiều)', description: 'Chọn nhiều/hàng' },
  { type: 'file_upload',   group: 'Nâng cao', icon: 'Upload',       label: 'Tải tệp lên',      description: 'Ảnh/PDF' },
  // Bố cục
  { type: 'section_header',group: 'Bố cục',   icon: 'Heading2',     label: 'Tiêu đề phần',     description: 'Không có câu trả lời', isLayout: true },
  { type: 'image_block',   group: 'Bố cục',   icon: 'Image',        label: 'Hình ảnh',         description: 'Hiển thị ảnh', isLayout: true },
  { type: 'button_block',  group: 'Bố cục',   icon: 'MousePointer', label: 'Nút bấm',          description: 'CTA button có link', isLayout: true },
  { type: 'link_block',    group: 'Bố cục',   icon: 'Link',         label: 'Đường dẫn',        description: 'Hyperlink text', isLayout: true },
  { type: 'banner_block',  group: 'Bố cục',   icon: 'Layers',       label: 'Banner',           description: 'Ảnh nền + text overlay', isLayout: true },
  { type: 'divider',       group: 'Bố cục',   icon: 'Minus',        label: 'Đường kẻ',         description: 'Phân cách', isLayout: true },
  { type: 'page_break',    group: 'Bố cục',   icon: 'FileText',     label: 'Ngắt trang',       description: 'Chuyển trang', isLayout: true },
];

export const QUESTION_GROUPS = ['Cơ bản', 'Lựa chọn', 'Đánh giá', 'Nâng cao', 'Bố cục'] as const;

export const IS_QUESTION_TYPE = (type: string): boolean =>
  !QUESTION_TYPE_DEFINITIONS.find(q => q.type === type)?.isLayout;

export const DEFAULT_THEME = {
  primaryColor: '#f59e0b',
  backgroundColor: '#f8fafc',
  cardBackground: '#ffffff',
  textColor: '#1e293b',
  fontFamily: "'Inter', 'Roboto', sans-serif",
  borderRadius: '12px',
  coverStyle: 'minimal' as const,
  coverHeight: 'md' as const,
};

export const DEFAULT_SETTINGS = {
  showProgressBar: true,
  progressBarStyle: 'bar' as const,
  allowPartialSubmit: false,
  trackIp: true,
  trackLocation: false,
};

export const DEFAULT_THANK_YOU: import('../../../types/survey').ThankYouPage = {
  title: 'Cảm ơn bạn! 🎉',
  message: 'Phản hồi của bạn đã được ghi nhận và rất quý giá với chúng tôi.',
  emoji: '🎉',
  showSocialShare: false,
};

export function createDefaultBlock(type: import('../../../types/survey').QuestionType): import('../../../types/survey').SurveyBlock {
  const base = {
    id: crypto.randomUUID(),
    type,
    label: QUESTION_TYPE_DEFINITIONS.find(q => q.type === type)?.label ?? 'Câu hỏi',
    required: false,
    style: {},
  };

  switch (type) {
    case 'single_choice':
    case 'multi_choice':
    case 'dropdown':
      return { ...base, allowOther: false, options: [
        { id: crypto.randomUUID(), label: 'Lựa chọn 1', value: '1' },
        { id: crypto.randomUUID(), label: 'Lựa chọn 2', value: '2' },
        { id: crypto.randomUUID(), label: 'Lựa chọn 3', value: '3' },
      ]};
    case 'yes_no':
      return { ...base, options: [
        { id: crypto.randomUUID(), label: 'Có', value: 'yes' },
        { id: crypto.randomUUID(), label: 'Không', value: 'no' },
      ]};
    case 'star_rating':
      return { ...base, minValue: 1, maxValue: 5, ratingIcon: 'star' };
    case 'nps':
      return { ...base, minValue: 0, maxValue: 10, minLabel: 'Hoàn toàn không', maxLabel: 'Chắc chắn có' };
    case 'likert':
      return { ...base, likertLabels: ['Rất không đồng ý', 'Không đồng ý', 'Bình thường', 'Đồng ý', 'Rất đồng ý'] };
    case 'slider':
      return { ...base, minValue: 0, maxValue: 100, step: 1 };
    case 'emoji_rating':
      return { ...base, emojis: ['😠', '😕', '😐', '🙂', '😁'] };
    case 'ranking':
      return { ...base, options: [
        { id: crypto.randomUUID(), label: 'Lựa chọn 1', value: '1' },
        { id: crypto.randomUUID(), label: 'Lựa chọn 2', value: '2' },
        { id: crypto.randomUUID(), label: 'Lựa chọn 3', value: '3' },
      ]};
    case 'matrix_single':
    case 'matrix_multi':
      return { ...base,
        matrixRows: [
          { id: crypto.randomUUID(), label: 'Tiêu chí 1' },
          { id: crypto.randomUUID(), label: 'Tiêu chí 2' },
        ],
        matrixCols: [
          { id: crypto.randomUUID(), label: 'Kém' },
          { id: crypto.randomUUID(), label: 'Bình thường' },
          { id: crypto.randomUUID(), label: 'Tốt' },
          { id: crypto.randomUUID(), label: 'Xuất sắc' },
        ],
      };
    case 'section_header':
      return { ...base, label: 'Tiêu đề phần', headingLevel: 'h2' };
    case 'image_block':
      return { ...base, label: 'Hình ảnh', imageWidth: '100%', imageAlign: 'center' };
    case 'button_block':
      return { ...base, label: 'Nút bấm', buttonText: 'Nhấn vào đây', buttonUrl: '', buttonStyle: 'filled', buttonAlign: 'center', buttonColor: '#f59e0b' };
    case 'link_block':
      return { ...base, label: 'Liên kết', linkText: 'Xem thêm', linkUrl: '', linkAlign: 'left' };
    case 'banner_block':
      return { ...base, label: 'Banner', bannerHeight: 200, bannerOverlay: 'rgba(0,0,0,0.35)', bannerTextColor: '#ffffff' };
    default:
      return base;
  }
}
