import { CrmSendTemplateEmailModal, CrmBulkMarketingModal } from '../components/crm/CrmMarketingModals';
import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Pagination } from '../components/ui/Pagination';
import { Plus, GripVertical, Pencil, Trash2, Calendar, Target, DollarSign, MessageSquare, Building2, Briefcase, BarChart3, Loader2, Search, Filter, Users, User, CheckCircle2, Phone, Mail, LayoutGrid, List, Clock, Download, Upload, RefreshCw, X, AlertCircle, AlertTriangle, ShieldAlert, ChevronRight, ChevronLeft, ChevronDown, MoreHorizontal, Columns, ArrowDownUp, GraduationCap, Tag as TagIcon, SlidersHorizontal, ArrowRight, Flag, Layers, RotateCcw, Globe, GitBranch, Ticket, ClipboardList, Flame, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar } from '../components/ui/Avatar';
import { triggerFullConfetti } from '../utils/confettiHelper';
import { useUIStore } from '../store/uiStore';
import { ImportExportModal } from '../components/ui/ImportExportModal';
import { ColumnCustomizer, type ColumnDef } from '../components/ui/ColumnCustomizer';
import { pushOverlay } from '../utils/overlayStack';

const CustomerProfileDrawer = lazy(() => import('./CustomerProfileDrawer').then(module => ({ default: module.CustomerProfileDrawer })));
const CompanyDrawer = lazy(() => import('./CompanyDrawer').then(module => ({ default: module.CompanyDrawer })));
const DealDrawer = lazy(() => import('./DealDrawer').then(module => ({ default: module.DealDrawer })));
import api from '../api/axios';
import { downloadExportFile } from '../utils/exportHelper';
import { useAuthStore } from '../store/authStore';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { useDebounce } from '../hooks/useDebounce';
import { VietnameseDateInput } from '../components/ui/VietnameseDateInput';
import { isAcademic } from '../utils/roleUtils';
const LEAD_SOURCES = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google Ads' },
  { value: 'gioi_thieu', label: 'Giới thiệu' },
  { value: 'ca_nhan', label: 'Cá nhân tự khai thác' },
  { value: 'website', label: 'Website' },
  { value: 'zalo', label: 'Zalo' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'hotline', label: 'Hotline' },
  { value: 'event', label: 'Sự kiện / Hội thảo' },
  { value: 'other', label: 'Khác' }
];

const FMT = (n: number) => {
  const num = Number(n || 0);
  if (!num) return '0 đ';
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'T';
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  return (num / 1e3).toFixed(0) + 'K';
};

const FMT_VND = (n: any) => {
  const num = Math.round(Number(n || 0));
  if (!num) return '0 đ';
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
};

const isNewLeadStage = (stage: any) => {
  if (!stage) return false;
  return (
    stage.system_slug === 'new_lead' ||
    String(stage.id) === '31' ||
    /^01\b|new\s*lead/i.test(String(stage.name || ''))
  );
};

const formatAdmissionDate = (dateStr?: string | null) => {
  if (!dateStr) return '';
  const s = String(dateStr).trim();
  if (!s || s.startsWith('0000')) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s.slice(0, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};

const parseCardTags = (rawTags: any): string[] => {
  if (!rawTags) return [];
  const list = typeof rawTags === 'string'
    ? rawTags.split(',').map((t: string) => t.trim()).filter(Boolean)
    : (Array.from(Array.isArray(rawTags) ? rawTags.map((t: any) => String(t?.name || t || '').trim()).filter(Boolean) : []));
  const cleanRegex = /^\d+\.\s*(status\s*-\s*)?/i;
  return Array.from(new Set(list.map((t: string) => t.replace(cleanRegex, '').trim()).filter(Boolean)));
};

const cleanNoteText = (text?: string | null) => {
  if (!text) return '';
  return String(text)
    .replace(/\s*\n?\(?Giai đoạn:.*$/si, '')
    .replace(/\s*\|\s*Lý do lost:.*$/si, '')
    .replace(/\s*\|\s*Độ nóng:.*$/si, '')
    .trim();
};

const formatLocalDate = (d: Date) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const computeDateRange = (dateFilterType: string, filterDateFrom: string, filterDateTo: string): { from: string; to: string } => {
  if (!dateFilterType) return { from: '', to: '' };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (dateFilterType === 'today') {
    const s = formatLocalDate(today);
    return { from: s, to: s };
  }
  if (dateFilterType === 'yesterday') {
    const y = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
    const s = formatLocalDate(y);
    return { from: s, to: s };
  }
  if (dateFilterType === 'last_7_days' || dateFilterType === 'this_week') {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
    return { from: formatLocalDate(start), to: formatLocalDate(today) };
  }
  if (dateFilterType === 'last_30_days') {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
    return { from: formatLocalDate(start), to: formatLocalDate(today) };
  }
  if (dateFilterType === 'this_month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: formatLocalDate(start), to: formatLocalDate(end) };
  }
  if (dateFilterType === 'last_month') {
    const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const end = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: formatLocalDate(start), to: formatLocalDate(end) };
  }
  if (dateFilterType === 'this_year') {
    const start = new Date(today.getFullYear(), 0, 1);
    const end = new Date(today.getFullYear(), 11, 31);
    return { from: formatLocalDate(start), to: formatLocalDate(end) };
  }
  if (dateFilterType === 'custom') {
    return { from: filterDateFrom || '', to: filterDateTo || '' };
  }
  return { from: '', to: '' };
};

const DEFAULT_PIPELINE_COLUMNS: ColumnDef[] = [
  { id: 'name', label: 'Họ tên / Khách hàng', visible: true },
  { id: 'contact', label: 'Liên hệ (SĐT / Email)', visible: true },
  { id: 'program', label: 'Tên chương trình', visible: true },
  { id: 'admission_date', label: 'Ngày nhập học', visible: true },
  { id: 'stage', label: 'Trạng thái Pipeline', visible: true },
  { id: 'last_interaction', label: 'Tương tác gần nhất / Ghi chú', visible: true },
  { id: 'tags', label: 'Phân loại (Tags)', visible: true },
  { id: 'value', label: 'Dự kiến doanh thu', visible: true },
  { id: 'total_deposit', label: 'Thực thu / Đã cọc', visible: false },
  { id: 'owner', label: 'Sale phụ trách', visible: true },
  { id: 'source', label: 'Nguồn dữ liệu', visible: false },
  { id: 'campaign', label: 'Chiến dịch', visible: false },
  { id: 'company', label: 'Công ty', visible: false },
  { id: 'created_at', label: 'Ngày tạo', visible: true },
  { id: 'updated_at', label: 'Ngày cập nhật', visible: false },
];

const PIPELINE_COLS_STORAGE_KEY = 'myerp_pipeline_columns_v2';

export interface CustomSchemaRule {
  id?: string;
  field: string;
  operator: string;
  value: string;
  valueTo?: string;
}

const CONTACT_SCHEMA_FIELDS: Array<{ value: string; label: string; sublabel?: string; type: 'text' | 'number' | 'date' }> = [
  { value: 'full_name', label: 'Họ tên (full_name)', sublabel: 'Hồ sơ cơ bản', type: 'text' },
  { value: 'phone', label: 'SĐT chính (phone)', sublabel: 'Liên hệ', type: 'text' },
  { value: 'mobile', label: 'SĐT phụ (mobile)', sublabel: 'Liên hệ', type: 'text' },
  { value: 'phone2', label: 'SĐT 2 (phone2)', sublabel: 'Liên hệ', type: 'text' },
  { value: 'zalo_phone', label: 'Zalo (zalo_phone)', sublabel: 'Liên hệ', type: 'text' },
  { value: 'email', label: 'Email (email)', sublabel: 'Liên hệ', type: 'text' },
  { value: 'student_id', label: 'Mã học viên (student_id)', sublabel: 'Định danh & Học vụ', type: 'text' },
  { value: 'citizen_id', label: 'CCCD/CMND (citizen_id)', sublabel: 'Định danh', type: 'text' },
  { value: 'passport', label: 'Hộ chiếu (passport)', sublabel: 'Định danh', type: 'text' },
  { value: 'gender', label: 'Giới tính (gender)', sublabel: 'Nhân khẩu học', type: 'text' },
  { value: 'birthday', label: 'Ngày sinh (birthday)', sublabel: 'Nhân khẩu học', type: 'date' },
  { value: 'address', label: 'Địa chỉ (address)', sublabel: 'Địa lý', type: 'text' },
  { value: 'ward', label: 'Phường/Xã (ward)', sublabel: 'Địa lý', type: 'text' },
  { value: 'district', label: 'Quận/Huyện (district)', sublabel: 'Địa lý', type: 'text' },
  { value: 'city', label: 'Tỉnh/Thành (city)', sublabel: 'Địa lý', type: 'text' },
  { value: 'preferred_location', label: 'Khu vực ưu tiên (preferred_location)', sublabel: 'Địa lý', type: 'text' },
  { value: 'company', label: 'Công ty (company)', sublabel: 'Nghề nghiệp', type: 'text' },
  { value: 'job_title', label: 'Chức vụ (job_title)', sublabel: 'Nghề nghiệp', type: 'text' },
  { value: 'department', label: 'Phòng ban (department)', sublabel: 'Nghề nghiệp', type: 'text' },
  { value: 'industry', label: 'Ngành nghề (industry)', sublabel: 'Nghề nghiệp', type: 'text' },
  { value: 'tax_code', label: 'Mã số thuế (tax_code)', sublabel: 'Nghề nghiệp', type: 'text' },
  { value: 'customer_type', label: 'Loại KH (customer_type)', sublabel: 'Phân loại', type: 'text' },
  { value: 'program', label: 'Chương trình (program)', sublabel: 'Học vụ & Đào tạo', type: 'text' },
  { value: 'major', label: 'Chuyên ngành (major)', sublabel: 'Học vụ & Đào tạo', type: 'text' },
  { value: 'expected_intake', label: 'Kỳ nhập học (expected_intake)', sublabel: 'Học vụ & Đào tạo', type: 'text' },
  { value: 'admission_date', label: 'Ngày nhập học (admission_date)', sublabel: 'Học vụ & Đào tạo', type: 'date' },
  { value: 'study_status', label: 'Trạng thái học tập (study_status)', sublabel: 'Học vụ & Đào tạo', type: 'text' },
  { value: 'source', label: 'Nguồn (source)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'platform', label: 'Nền tảng (platform)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'form_name', label: 'Tên Form (form_name)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'utm_source', label: 'UTM Source (utm_source)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'utm_campaign', label: 'UTM Campaign (utm_campaign)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'utm_medium', label: 'UTM Medium (utm_medium)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'utm_content', label: 'UTM Content (utm_content)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'temperature', label: 'Nhiệt độ Lead (temperature)', sublabel: 'Đánh giá & Chăm sóc', type: 'text' },
  { value: 'lead_score', label: 'Điểm Lead (lead_score)', sublabel: 'Đánh giá & Chăm sóc', type: 'number' },
  { value: 'win_probability', label: 'Xác suất chốt (win_probability)', sublabel: 'Đánh giá & Chăm sóc', type: 'number' },
  { value: 'ttl1_completed', label: 'Đã TVL1 (ttl1_completed)', sublabel: 'Đánh giá & Chăm sóc', type: 'text' },
  { value: 'next_action', label: 'Hành động tiếp theo (next_action)', sublabel: 'Đánh giá & Chăm sóc', type: 'text' },
  { value: 'next_followup_date', label: 'Ngày hẹn theo dõi (next_followup_date)', sublabel: 'Đánh giá & Chăm sóc', type: 'date' },
  { value: 'expected_decision_date', label: 'Ngày dự kiến chốt (expected_decision_date)', sublabel: 'Đánh giá & Chăm sóc', type: 'date' },
  { value: 'nurture_reason', label: 'Lý do nuôi dưỡng (nurture_reason)', sublabel: 'Đánh giá & Chăm sóc', type: 'text' },
  { value: 'lost_reason', label: 'Lý do hủy (lost_reason)', sublabel: 'Đánh giá & Chăm sóc', type: 'text' },
  { value: 'expected_revenue', label: 'Doanh thu kỳ vọng (expected_revenue)', sublabel: 'Tài chính', type: 'number' },
  { value: 'budget', label: 'Ngân sách (budget)', sublabel: 'Tài chính', type: 'number' },
  { value: 'total_spent', label: 'Tổng chi tiêu (total_spent)', sublabel: 'Tài chính', type: 'number' },
  { value: 'notes', label: 'Ghi chú (notes)', sublabel: 'Ghi chú & Phân loại', type: 'text' },
  { value: 'tags', label: 'Tags (tags)', sublabel: 'Ghi chú & Phân loại', type: 'text' },
  { value: 'created_at', label: 'Ngày tạo (created_at)', sublabel: 'Mốc thời gian', type: 'date' },
  { value: 'updated_at', label: 'Ngày cập nhật (updated_at)', sublabel: 'Mốc thời gian', type: 'date' },
  { value: 'last_contact', label: 'Ngày liên hệ cuối (last_contact)', sublabel: 'Mốc thời gian', type: 'date' },
  // Omnichannel & Automation 360°
  { value: 'engagement_score', label: 'Điểm Tương Tác Số (engagement_score)', sublabel: 'Omnichannel & Automation', type: 'number' },
  { value: 'stats_email_sent', label: 'Số Email đã gửi (stats_email_sent)', sublabel: 'Omnichannel & Automation', type: 'number' },
  { value: 'stats_email_opened', label: 'Số lần mở Email (stats_email_opened)', sublabel: 'Omnichannel & Automation', type: 'number' },
  { value: 'stats_email_clicked', label: 'Số lần click Email (stats_email_clicked)', sublabel: 'Omnichannel & Automation', type: 'number' },
  { value: 'web_pageviews_count', label: 'Số lượt xem trang Web (web_pageviews_count)', sublabel: 'Omnichannel & Automation', type: 'number' },
  { value: 'last_web_visit_at', label: 'Lần truy cập Web gần nhất (last_web_visit_at)', sublabel: 'Omnichannel & Automation', type: 'date' },
  { value: 'last_email_open_at', label: 'Lần mở Email gần nhất (last_email_open_at)', sublabel: 'Omnichannel & Automation', type: 'date' },
  { value: 'active_flow_count', label: 'Số luồng Automation đang chạy (active_flow_count)', sublabel: 'Omnichannel & Automation', type: 'number' },
  { value: 'active_flow_names', label: 'Tên luồng Automation đang chạy (active_flow_names)', sublabel: 'Omnichannel & Automation', type: 'text' },
  { value: 'active_voucher_code', label: 'Mã Voucher đang sở hữu (active_voucher_code)', sublabel: 'Omnichannel & Automation', type: 'text' },
  { value: 'survey_completed_count', label: 'Số bài Khảo sát đã làm (survey_completed_count)', sublabel: 'Omnichannel & Automation', type: 'number' },
  { value: 'marketing_status', label: 'Trạng thái nhận Email Marketing (marketing_status)', sublabel: 'Omnichannel & Automation', type: 'text' },
];

const SCHEMA_OPERATORS: Array<{ value: CustomSchemaRule['operator']; label: string }> = [
  { value: 'contains', label: 'Chứa (Contains)' },
  { value: 'not_contains', label: 'Không chứa (Not Contains)' },
  { value: 'eq', label: 'Bằng (=)' },
  { value: 'neq', label: 'Khác (!=)' },
  { value: 'gt', label: 'Lớn hơn (>)' },
  { value: 'gte', label: 'Lớn hơn hoặc bằng (>=)' },
  { value: 'lt', label: 'Nhỏ hơn (<)' },
  { value: 'lte', label: 'Nhỏ hơn hoặc bằng (<=)' },
  { value: 'between', label: 'Trong khoảng (Between)' },
  { value: 'is_empty', label: 'Đang trống / Chưa có' },
  { value: 'is_not_empty', label: 'Đã có dữ liệu' },
];

const INTERACTION_TYPE_OPTIONS = [
  { value: 'all', label: 'Tất cả loại tương tác' },
  { value: 'call', label: 'Gọi điện (Call)' },
  { value: 'note', label: 'Ghi chú chăm sóc (Note)' },
  { value: 'meeting', label: 'Hẹn gặp (Meeting)' },
  { value: 'email', label: 'Email' },
  { value: 'task', label: 'Công việc (Task)' },
];

const FINANCIAL_STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái đặt cọc / học phí' },
  { value: 'has_deposit', label: 'Đã đặt cọc' },
  { value: 'approved_deposit', label: 'Đã duyệt cọc' },
  { value: 'pending_deposit', label: 'Chờ duyệt cọc' },
  { value: 'no_deposit', label: 'Chưa đặt cọc' },
  { value: 'has_so', label: 'Đã lên đơn SO' },
  { value: 'high_value_deposit', label: 'Cọc giá trị cao' },
  { value: 'overdue_milestone', label: 'Quá hạn đóng phí' },
];

const COMMON_CITY_OPTIONS = [
  { value: 'all', label: 'Tất cả Tỉnh / Thành phố' },
  { value: 'TP.HCM', label: 'TP.HCM' },
  { value: 'Hà Nội', label: 'Hà Nội' },
  { value: 'Đà Nẵng', label: 'Đà Nẵng' },
  { value: 'Cần Thơ', label: 'Cần Thơ' },
  { value: 'Hải Phòng', label: 'Hải Phòng' },
  { value: 'Bình Dương', label: 'Bình Dương' },
  { value: 'Đồng Nai', label: 'Đồng Nai' },
  { value: 'Bà Rịa - Vũng Tàu', label: 'Bà Rịa - Vũng Tàu' },
  { value: 'Khánh Hòa', label: 'Khánh Hòa' },
  { value: 'Lâm Đồng', label: 'Lâm Đồng' },
  { value: 'Đắk Lắk', label: 'Đắk Lắk' },
  { value: 'An Giang', label: 'An Giang' },
  { value: 'Kiên Giang', label: 'Kiên Giang' },
  { value: 'Long An', label: 'Long An' },
  { value: 'Tiền Giang', label: 'Tiền Giang' },
];

const csvToMulti = (csv: string): string[] => {
  if (!csv || !csv.trim()) return ['all'];
  const parts = csv.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : ['all'];
};

const multiToCsv = (val: any, currentCsv = ''): string => {
  if (Array.isArray(val)) {
    const cleaned = val.map(v => String(v).trim()).filter(v => v && v !== 'all');
    return Array.from(new Set(cleaned)).join(',');
  }
  const s = String(val || '').trim();
  if (!s || s === 'all') return '';
  const existing = currentCsv ? currentCsv.split(',').map(x => x.trim()).filter(Boolean) : [];
  if (!existing.includes(s)) existing.push(s);
  return existing.join(',');
};

const ensureOptionsWithSelected = (baseOpts: Array<{ value: string; label: string; [k: string]: any }>, csv: string) => {
  if (!csv) return baseOpts;
  const existingVals = new Set(baseOpts.map(o => String(o.value)));
  const extra = csv
    .split(',')
    .map(s => s.trim())
    .filter(s => s && s !== 'all' && !existingVals.has(s))
    .map(s => ({ value: s, label: s }));
  return extra.length > 0 ? [...baseOpts, ...extra] : baseOpts;
};

interface HoveredDealCardData {
  item: any;
  stage: any;
  rect: DOMRect;
}

const DealsFloatingTooltip = React.memo<{
  triggerRef: React.MutableRefObject<((data: HoveredDealCardData | null) => void) | null>;
  pipelineView: 'deals' | 'contacts' | 'companies';
  stages: any[];
}>(({ triggerRef, pipelineView, stages }) => {
  const [hoveredCard, setHoveredCard] = useState<HoveredDealCardData | null>(null);

  useEffect(() => {
    triggerRef.current = setHoveredCard;
    return () => {
      triggerRef.current = null;
    };
  }, [triggerRef]);

  if (!hoveredCard) return null;

  const { item, stage, rect } = hoveredCard;
  const itemName = pipelineView === 'contacts'
    ? (item.full_name || '').trim()
    : (pipelineView === 'companies' ? item.name : item.title);
  const stageObj = stage || stages.find(s => String(s.id) === String(item.stage_id));
  const isNewLead = isNewLeadStage(stageObj) || /^01\b|new\s*lead/i.test(String(item.stage_name || ''));
  const stageName = stageObj?.name || item.stage_name || '01 – New Lead';
  const prog = (item.program || item.project_name || '').trim();
  const admDate = formatAdmissionDate(item.admission_date);
  const tags = parseCardTags(item.tags);
  const interactionNote = cleanNoteText(item.last_interaction);
  const initialNote = cleanNoteText(item.notes);
  const expectedRev = Number(item.expected_revenue) || Number(item.value) || 0;
  const totalDep = Number(item.total_deposit) || Number(item.actual_revenue) || 0;

  const tooltipWidth = 360;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = rect.right + 12;
  if (left + tooltipWidth > vw - 16) {
    left = Math.max(16, rect.left - tooltipWidth - 12);
  }
  const top = Math.max(16, Math.min(rect.top, vh - 340));

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top,
        left,
        width: tooltipWidth,
        zIndex: 9999,
        pointerEvents: 'none',
        background: '#ffffff',
        color: '#0f172a',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        boxShadow: '0 14px 34px rgba(15, 23, 42, 0.14)',
        padding: '0.95rem 1.05rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.6rem',
        fontSize: '0.78rem'
      }}
    >
      {/* Header: Name + Stage Badge + Owner */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.25 }}>
            {itemName || 'Khách hàng'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
            Sale phụ trách: <strong style={{ color: '#0f172a' }}>{item.owner_name || 'Chưa phân bổ'}</strong>
          </div>
        </div>
        <span style={isNewLead ? {
          background: '#dc2626',
          color: '#ffffff',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 99,
          fontSize: 11,
          whiteSpace: 'nowrap',
          flexShrink: 0
        } : {
          background: stageObj?.color ? `${stageObj.color}18` : '#f1f5f9',
          color: stageObj?.color || '#2563eb',
          fontWeight: 700,
          padding: '2px 8px',
          borderRadius: 99,
          fontSize: 11,
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}>
          {stageName}
        </span>
      </div>

      {/* Contact: Phone & Email */}
      {(item.phone || item.email) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '0.76rem', color: '#0f172a' }}>
          {item.phone && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Phone size={12} style={{ color: '#64748b' }} />
              <strong>{item.phone}</strong>
            </span>
          )}
          {item.email && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
              <Mail size={12} style={{ color: '#64748b' }} />
              <span>{item.email}</span>
            </span>
          )}
        </div>
      )}

      {/* Program & Admission Date */}
      {(prog || admDate) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {prog && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.73rem',
              fontWeight: 700,
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb'
            }}>
              <GraduationCap size={12} style={{ flexShrink: 0 }} />
              <span>Chương trình: {prog}</span>
            </span>
          )}
          {admDate && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '0.73rem',
              fontWeight: 700,
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#059669'
            }}>
              <Calendar size={12} style={{ flexShrink: 0 }} />
              <span>Nhập học: {admDate}</span>
            </span>
          )}
        </div>
      )}

      {/* All Tags & Source / Campaign */}
      {(tags.length > 0 || item.source || item.campaign_name || item.utm_campaign) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {tags.map((tg, idx) => (
                <span key={idx} style={{
                  padding: '2px 7px',
                  borderRadius: '6px',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  background: '#f1f5f9',
                  color: '#334155'
                }}>
                  #{tg}
                </span>
              ))}
            </div>
          )}
          {(item.source || item.campaign_name || item.utm_campaign) && (
            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
              {item.source && <span>Nguồn: <strong style={{ color: '#0f172a' }}>{item.source}</strong></span>}
              {(item.campaign_name || item.utm_campaign) && (
                <span> · Chiến dịch: <strong style={{ color: '#0f172a' }}>{item.campaign_name || item.utm_campaign}</strong></span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Full Multi-line Interaction Note & Initial Note */}
      <div style={{
        background: '#f8fafc',
        borderRadius: '8px',
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#2563eb', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MessageSquare size={12} style={{ flexShrink: 0 }} />
              <span>Tương tác gần nhất</span>
            </span>
            {(item.last_interaction_at || item.last_contact) && (
              <span style={{ fontWeight: 500, color: '#64748b' }}>
                {String(item.last_interaction_at || item.last_contact).slice(0, 16)}
              </span>
            )}
          </div>
          <div style={{ fontSize: '0.75rem', color: '#0f172a', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4, maxHeight: '140px', overflow: 'hidden' }}>
            {interactionNote || 'Chưa có ghi chú tương tác'}
          </div>
        </div>
        {initialNote && initialNote !== interactionNote && (
          <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '5px' }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>
              Ghi chú hồ sơ:
            </div>
            <div style={{ fontSize: '0.74rem', color: '#334155', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.35, maxHeight: '90px', overflow: 'hidden' }}>
              {initialNote}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Expected Revenue & Total Deposit */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '0.45rem', fontSize: '0.74rem', color: '#64748b' }}>
        <span>Dự kiến: <strong style={{ color: 'var(--color-primary)' }}>{FMT_VND(expectedRev)}</strong></span>
        <span>Đã cọc: <strong style={{ color: '#059669' }}>{FMT_VND(totalDep)}</strong></span>
      </div>
    </div>,
    document.body
  );
});

export const DealsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useUIStore();
  const currentUser = useAuthStore.getState().user;
  const [showImportExport, setShowImportExport] = useState(false);
  const [showCrmEmailModal, setShowCrmEmailModal] = useState(false);
  const [crmBulkMarketingModal, setCrmBulkMarketingModal] = useState<{ isOpen: boolean; mode: 'list' | 'flow' }>({ isOpen: false, mode: 'list' });
  const [pipelineView, setPipelineView] = useState<'deals' | 'contacts' | 'companies'>('contacts');
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');
  const [activeStageFilter, setActiveStageFilter] = useState<string | number>('all');
  const [stages, setStages] = useState<any[]>([]);
  const stagesRef = React.useRef<any[]>([]);
  React.useEffect(() => {
    stagesRef.current = stages;
  }, [stages]);
  const [items, setItems] = useState<Record<number, any[]>>({});
  const [stageRevenues, setStageRevenues] = useState<Record<number, number>>({});
  const [totalExpectedRevenue, setTotalExpectedRevenue] = useState<number>(0);
  const [loadingMoreStage, setLoadingMoreStage] = useState<Record<number, boolean>>({});
  const tooltipTriggerRef = useRef<((data: HoveredDealCardData | null) => void) | null>(null);
  const setHoveredCard = (data: HoveredDealCardData | null) => {
    tooltipTriggerRef.current?.(data);
  };

  const [columns, setColumns] = useState<ColumnDef[]>(() => {
    try {
      const saved = localStorage.getItem(PIPELINE_COLS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map(parsed.map((c: any) => [c.id, Boolean(c.visible)]));
          return DEFAULT_PIPELINE_COLUMNS.map(def => ({
            ...def,
            visible: map.has(def.id) ? Boolean(map.get(def.id)) : def.visible
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load pipeline columns', e);
    }
    return DEFAULT_PIPELINE_COLUMNS;
  });
  const [showColumns, setShowColumns] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PIPELINE_COLS_STORAGE_KEY, JSON.stringify(columns));
    } catch {}
  }, [columns]);

  const visibleColsMap = useMemo(() => Object.fromEntries(columns.map(c => [c.id, c.visible])), [columns]);

  const kanbanScrollRef = React.useRef<HTMLDivElement>(null);
  const [stageVisibleLimits, setStageVisibleLimits] = useState<Record<string, number>>({});
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = () => {
    if (kanbanScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = kanbanScrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
    }
  };

  const scrollKanban = (direction: 'left' | 'right') => {
    if (kanbanScrollRef.current) {
      const scrollAmount = direction === 'left' ? -360 : 360;
      kanbanScrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
      setTimeout(updateScrollState, 350);
    }
  };

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<any[]>([]);

  useEffect(() => {
    const timer = setTimeout(updateScrollState, 100);
    return () => clearTimeout(timer);
  }, [stages, items, loading, viewMode]);

  useEffect(() => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser && ['manager', 'admin', 'superadmin', 'super_admin', 'director', 'sale_admin', 'saleadmin', 'marketing'].includes(currentUser.role)) {
      api.get('/teams').then(res => {
        setTeams(res.data.data || res.data || []);
      }).catch(() => {});
    }
  }, []);

  const getEffectiveTeamId = () => {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser) return null;
    const isMarketing = currentUser.role === 'marketing' || 
      Number((currentUser as any).team_id) === 3 || 
      String((currentUser as any).job_title || '').toLowerCase().includes('marketing') ||
      String((currentUser as any).team_name || '').toLowerCase().includes('marketing');
    if (
      isMarketing ||
      isAcademic(currentUser) ||
      ['admin', 'superadmin', 'super_admin', 'director', 'sale_admin', 'saleadmin', 'accountant', 'hr', 'academic', 'hoc_vu', 'hoc_thuat', 'dao_tao', 'tro_giang', 'teacher', 'giang_vien', 'giao_vien', 'tutor', 'viewer'].includes(currentUser.role || '')
    ) {
      return null;
    }
    const nonSalesTeamIds = [1, 2, 3, 5, 99983];
    if (currentUser.role === 'manager') {
      const managedTeam = teams.find(t => Number(t.leader_id) === Number(currentUser.id));
      const candidateTeamId = Number(managedTeam?.id || (currentUser as any)?.team_id || 0);
      if (!candidateTeamId || nonSalesTeamIds.includes(candidateTeamId)) return null;
      return candidateTeamId;
    }
    const myTeamId = Number((currentUser as any)?.team_id || 0);
    if (!myTeamId || nonSalesTeamIds.includes(myTeamId)) return null;
    return myTeamId;
  };

  const effectiveTeamId = useMemo(() => {
    return getEffectiveTeamId();
  }, [teams]);
  
  // Drawers
  const [showContactDrawer, setShowContactDrawer] = useState(false);
  const [showCompanyDrawer, setShowCompanyDrawer] = useState(false);
  const [showDealDrawer, setShowDealDrawer] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [selectedContactInitialTab, setSelectedContactInitialTab] = useState<string>('info');
  const [selectedCompany, setSelectedCompany] = useState<any>(null);
  const [selectedDeal, setSelectedDeal] = useState<any>(null);
  
  const [dragging, setDragging] = useState<{ id: number, fromStage: number } | null>(null);
  const [transitionModal, setTransitionModal] = useState<{ 
    isOpen: boolean; 
    itemId: number; 
    toStage: number; 
    fromStage: number; 
    note: string;
    isCancellation?: boolean;
    hasRevenue?: 'yes' | 'no' | null;
  } | null>(null);
  const [isConfirmingTransition, setIsConfirmingTransition] = useState(false);
  const [stagePickerItem, setStagePickerItem] = useState<{ id: number, fromStageId: number } | null>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [activeStageMobile, setActiveStageMobile] = useState<string | number>('');

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setViewMode('kanban');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (stages.length > 0 && !activeStageMobile) {
      setActiveStageMobile(stages[0].id);
    }
  }, [stages]);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm.trim(), 300);
  const [dateField, setDateField] = useState<'created_at' | 'updated_at' | 'last_contact' | 'admission_date' | 'deposit_date' | 'next_followup_date' | 'birthday'>('created_at');
  const [dateFilterType, setDateFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [admissionFrom, setAdmissionFrom] = useState('');
  const [admissionTo, setAdmissionTo] = useState('');
  const [filterLeadStatus, setFilterLeadStatus] = useState<string>(''); // '' (Đang chăm sóc), 'active', 'nurture', 'lost', 'all' or comma-separated
  const [filterLeadStatusOp, setFilterLeadStatusOp] = useState<'in' | 'not_in'>('in');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterTeam, setFilterTeam] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterStageOp, setFilterStageOp] = useState<'in' | 'not_in'>('in');
  const [filterProject, setFilterProject] = useState('');
  const [filterCampaign, setFilterCampaign] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterInteractionStatus, setFilterInteractionStatus] = useState<string>(''); // '' | 'uncontacted' | 'contacted'

  // Deep Interaction & Care Cadence Filters
  const [staleDays, setStaleDays] = useState('');
  const [interactedWithinDays, setInteractedWithinDays] = useState('');
  const [interactionType, setInteractionType] = useState('');
  const [minCallCount, setMinCallCount] = useState('');
  const [maxCallCount, setMaxCallCount] = useState('');
  const [noteKeyword, setNoteKeyword] = useState('');

  // Demographics, Academic & Financial Filters
  const [gender, setGender] = useState('');
  const [city, setCity] = useState('');
  const [ageMin, setAgeMin] = useState('');
  const [ageMax, setAgeMax] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [company, setCompany] = useState('');
  const [financialFilter, setFinancialFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [studyStatus, setStudyStatus] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [expectedIntake, setExpectedIntake] = useState('');

  // Omnichannel & Automation 360° Filters
  const [engagementStatus, setEngagementStatus] = useState('');
  const [automationFlow, setAutomationFlow] = useState('');
  const [voucherStatus, setVoucherStatus] = useState('');
  const [minEngagementScore, setMinEngagementScore] = useState('');
  const [maxEngagementScore, setMaxEngagementScore] = useState('');

  // Dynamic Schema Rule Builder (100% DB Schema)
  const [customRules, setCustomRules] = useState<CustomSchemaRule[]>([]);
  const [customRulesLogic, setCustomRulesLogic] = useState<'AND' | 'OR'>('AND');

  const validCustomRules = useMemo(() => {
    return (customRules || []).filter(
      r => r.field && (r.operator === 'is_empty' || r.operator === 'is_not_empty' || String(r.value || '').trim() !== '')
    );
  }, [customRules]);

  const debouncedExtraFilterSig = useDebounce(
    JSON.stringify({
      filterTeam,
      staleDays: staleDays.trim(),
      interactedWithinDays: interactedWithinDays.trim(),
      interactionType,
      minCallCount: minCallCount.trim(),
      maxCallCount: maxCallCount.trim(),
      noteKeyword: noteKeyword.trim(),
      gender,
      city,
      ageMin: ageMin.trim(),
      ageMax: ageMax.trim(),
      jobTitle: jobTitle.trim(),
      company: company.trim(),
      financialFilter,
      minAmount: minAmount.trim(),
      maxAmount: maxAmount.trim(),
      studyStatus,
      studentCode: studentCode.trim(),
      expectedIntake: expectedIntake.trim(),
      engagementStatus,
      automationFlow,
      voucherStatus,
      minEngagementScore: minEngagementScore.trim(),
      maxEngagementScore: maxEngagementScore.trim(),
      validCustomRules,
      customRulesLogic,
      filterStageOp,
      filterLeadStatusOp
    }),
    300
  );

  const [sortBy, setSortBy] = useState<'updated_desc' | 'created_desc' | 'interaction_desc' | 'value_desc' | 'name_asc'>('updated_desc');

  const [projects, setProjects] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [dbTags, setDbTags] = useState<any[]>([]);
  
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [showTimelinePopover, setShowTimelinePopover] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const timelinePopoverRef = useRef<HTMLDivElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (timelinePopoverRef.current && !timelinePopoverRef.current.contains(e.target as Node)) {
        setShowTimelinePopover(false);
      }
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setShowExportDropdown(false);
      }
    };
    if (showTimelinePopover || showExportDropdown) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [showTimelinePopover, showExportDropdown]);
  
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [targetStageId, setTargetStageId] = useState<string>('');
  
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(() => {
    return Number(localStorage.getItem('Ideas_deals_page_size')) || 50;
  });
  const [total, setTotal] = useState(0);
  const [stageTotals, setStageTotals] = useState<Record<number, number>>({});
  const [allowPipelineBackward, setAllowPipelineBackward] = useState<boolean>(false);
  const [allowPipelineSkip, setAllowPipelineSkip] = useState<boolean>(false);

  // All filtering is done on the Backend API — do not re-filter in JS with UTC date bugs
  const filteredItems = items;

  const getVisibleItems = () => {
    return Object.values(filteredItems)
      .flat()
      .filter(item => activeStageFilter === 'all' || Boolean(debouncedSearch) || String(item.stage_id) === String(activeStageFilter));
  };

  const totalVisibleCount = total;
  const pagedItems = getVisibleItems();

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePageAll = () => {
    const pageIds = pagedItems.map(v => v.id);
    const allPageSelected = pageIds.every(id => selected.has(id));
    
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach(id => next.delete(id));
      else pageIds.forEach(id => next.add(id));
      return next;
    });
  };

  const selectAllEntireQuery = () => {
    setSelected(new Set(getVisibleItems().map(v => v.id)));
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  const exportInFlightRef = useRef(false);
  const bulkMoveInFlightRef = useRef(false);
  const confirmTransitionInFlightRef = useRef(false);
  const saveDealInFlightRef = useRef(false);

  const buildFilterParams = () => {
    const effectiveStage = filterStage || (viewMode === 'list' && activeStageFilter !== 'all' ? String(activeStageFilter) : '');
    const params: Record<string, any> = {
      search: debouncedSearch || undefined,
      owner_id: filterAssignee || undefined,
      owners: filterAssignee || undefined,
      stage_id: debouncedSearch ? undefined : (effectiveStage || undefined),
      stages: debouncedSearch ? undefined : (effectiveStage || undefined),
      stage_op: effectiveStage ? filterStageOp : undefined,
      project_id: filterProject || undefined,
      projects: filterProject || undefined,
      campaign_id: filterCampaign || undefined,
      campaigns: filterCampaign || undefined,
      source: filterSource || undefined,
      sources: filterSource || undefined,
      tag: filterTag || undefined,
      tags: filterTag || undefined,
    };

    if (filterAssignee === 'unassigned') {
      params.unassigned = 1;
    }

    if (filterLeadStatus) {
      params.lead_status = filterLeadStatus;
      params.lead_status_op = filterLeadStatusOp;
      const parts = filterLeadStatus.split(',').map(s => s.trim());
      if (parts.includes('lost') || parts.includes('all')) {
        params.show_lost = 1;
        params.include_lost = 1;
      }
    }

    if (filterInteractionStatus === 'uncontacted') {
      params.uncontacted = 1;
      params.interaction_status = 'uncontacted';
    } else if (filterInteractionStatus === 'contacted') {
      params.interaction_status = 'contacted';
    }

    // Deep Interaction & Care Cadence params
    if (staleDays.trim()) params.stale_days = staleDays.trim();
    if (interactedWithinDays.trim()) params.interacted_within_days = interactedWithinDays.trim();
    if (interactionType) params.interaction_type = interactionType;
    if (minCallCount.trim()) params.min_call_count = minCallCount.trim();
    if (maxCallCount.trim()) params.max_call_count = maxCallCount.trim();
    if (noteKeyword.trim()) params.note_keyword = noteKeyword.trim();

    // Demographics, Academic & Financial params
    if (gender) params.gender = gender;
    if (city) {
      params.cities = city;
      params.city = city;
    }
    if (ageMin.trim()) params.age_min = ageMin.trim();
    if (ageMax.trim()) params.age_max = ageMax.trim();
    if (jobTitle.trim()) {
      params.job_titles = jobTitle.trim();
      params.job_title = jobTitle.trim();
    }
    if (company.trim()) {
      params.companies = company.trim();
      params.company = company.trim();
    }
    if (financialFilter) {
      params.financial_filter = financialFilter;
      params.deposit_status = financialFilter;
    }
    if (minAmount.trim()) {
      params.min_deposit = minAmount.trim();
      params.min_amount = minAmount.trim();
    }
    if (maxAmount.trim()) {
      params.max_deposit = maxAmount.trim();
      params.max_amount = maxAmount.trim();
    }
    if (studyStatus) params.study_status = studyStatus;
    if (studentCode.trim()) params.student_code = studentCode.trim();
    if (expectedIntake.trim()) params.expected_intake = expectedIntake.trim();

    // Omnichannel & Automation 360° params
    if (engagementStatus) params.engagement_status = engagementStatus;
    if (automationFlow) params.automation_flow = automationFlow;
    if (voucherStatus) params.voucher_status = voucherStatus;
    if (minEngagementScore.trim()) params.min_engagement_score = minEngagementScore.trim();
    if (maxEngagementScore.trim()) params.max_engagement_score = maxEngagementScore.trim();

    // Dynamic Schema Rules (100% DB Schema)
    if (validCustomRules.length > 0) {
      params.custom_rules = JSON.stringify(validCustomRules);
      params.custom_rules_logic = customRulesLogic || 'AND';
    }

    if (debouncedSearch && pipelineView === 'contacts') {
      params.all_pipeline = 1;
      params.show_lost = 1;
    }

    const teamId = getEffectiveTeamId();
    if (teamId) {
      params.team_id = teamId;
    } else if (filterTeam) {
      params.team_id = filterTeam;
      params.teams = filterTeam;
    }

    if (dateFilterType) {
      const { from, to } = computeDateRange(dateFilterType, filterDateFrom, filterDateTo);
      if (dateField === 'admission_date') {
        params.date_field = 'admission_date';
        if (from) { params.from = from; params.admission_from = from; }
        if (to) { params.to = to; params.admission_to = to; }
      } else {
        params.date_field = dateField;
        if (from) params.from = from;
        if (to) params.to = to;
      }
    }

    if (admissionFrom) params.admission_from = admissionFrom;
    if (admissionTo) params.admission_to = admissionTo;

    if (sortBy === 'created_desc') {
      params.sort = 'created_at';
      params.order = 'DESC';
    } else if (sortBy === 'interaction_desc') {
      params.sort = 'last_contact';
      params.order = 'DESC';
    } else if (sortBy === 'value_desc') {
      params.sort = 'expected_revenue';
      params.order = 'DESC';
    } else if (sortBy === 'name_asc') {
      params.sort = 'full_name';
      params.order = 'ASC';
    } else {
      params.sort = 'updated_at';
      params.order = 'DESC';
    }

    return params;
  };

  const bulkExport = async (exportMode: 'filtered' | 'full' = 'filtered') => {
    if (isExporting || exportInFlightRef.current) return;
    exportInFlightRef.current = true;
    setIsExporting(true);
    const type = pipelineView === 'contacts' ? 'contact' : (pipelineView === 'companies' ? 'company' : 'deal');
    const filterParams = exportMode === 'filtered' ? buildFilterParams() : {};
    const params: Record<string, any> = {
      type,
      export_mode: exportMode,
      ...filterParams,
    };

    const teamId = getEffectiveTeamId();
    if (teamId) {
      params.team_id = teamId;
    }

    addToast(
      exportMode === 'full'
        ? 'Đang xuất toàn bộ dữ liệu Pipeline...'
        : 'Đang tải xuống dữ liệu Export theo bộ lọc hiện tại...',
      'info'
    );
    try {
      await downloadExportFile({
        endpoint: '/export',
        params,
        defaultFilename: `export_${type}_${exportMode}_${Date.now()}.csv`,
        onSuccess: () => {
          addToast('Tải xuống dữ liệu thành công!', 'success');
        },
      });
    } catch (err: any) {
      addToast(err?.message || 'Xuất dữ liệu thất bại', 'error');
    } finally {
      exportInFlightRef.current = false;
      setIsExporting(false);
    }
  };

  const bulkMove = async () => {
    if (!targetStageId || isBulkMoving || bulkMoveInFlightRef.current) return;
    bulkMoveInFlightRef.current = true;
    setIsBulkMoving(true);
    try {
      const ids = Array.from(selected);
      // In a real app, this would be one API call
      await Promise.all(ids.map(id => api.patch(`/${pipelineView}/${id}/stage`, { stage_id: targetStageId, note: 'Bulk move' })));
      
      fetchData(); // Refresh all
      
      addToast(`Đã chuyển ${selected.size} thẻ sang giai đoạn mới`, 'success');
      setSelected(new Set());
      setShowBulkMove(false);
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi chuyển giai đoạn', 'error');
    } finally {
      bulkMoveInFlightRef.current = false;
      setIsBulkMoving(false);
    }
  };

  const fetchUsers = async () => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser && (currentUser.role === 'sale' || currentUser.role === 'sales')) {
      return;
    }
    try {
      const r = await api.get('/users');
      let list = r.data.data || [];
      const teamId = getEffectiveTeamId();
      if (currentUser?.role === 'manager' && teamId) {
        list = list.filter((u: any) => String(u.team_id) === String(teamId));
      }
      setAllUsers(list);
    } catch (e: any) {
      console.error("Failed to fetch users", e);
    }
  };

  const fetchStages = async () => {
    try {
      const r = await api.get('/pipeline-stages');
      const stagesData = r.data.data || [];
      const sorted = [...stagesData].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      setStages(sorted);
    } catch (e: any) {
      setStages([]);
    }
  };

  const fetchProjects = async () => {
    try {
      const currentUser = useAuthStore.getState().user;
      const isRosterRestricted = ['sale', 'sales', 'manager', 'director'].includes(currentUser?.role || '');
      const bypassProj = isRosterRestricted ? '' : '?bypass_roster=1';
      const r = await api.get(`/projects${bypassProj}`);
      setProjects(r.data.data || []);
    } catch (e) {
      console.error("Failed to fetch projects", e);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const r = await api.get('/marketing-campaigns');
      setCampaigns(r.data.data?.items || r.data.data || []);
    } catch (e) {
      console.error("Failed to fetch campaigns", e);
    }
  };

  const fetchSources = async () => {
    try {
      const r = await api.get('api.php?action=get_unique_sources');
      if (r.data?.success) {
        setSources(r.data.data || []);
      }
    } catch (e) {
      console.error("Failed to fetch sources", e);
    }
  };

  const fetchAbortRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
    };
  }, []);

  const fetchData = async () => {
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    fetchAbortRef.current = new AbortController();
    const signal = fetchAbortRef.current.signal;

    setLoading(true);
    setHoveredCard(null);
    try {
      const endpoint = pipelineView === 'contacts' ? '/contacts' : (pipelineView === 'companies' ? '/companies' : '/deals');
      const params = buildFilterParams();

      if (viewMode === 'kanban') {
        if (pipelineView === 'contacts') {
          const kanbanParams = {
            ...params,
            kanban: 1,
            limit_per_stage: 30
          };
          const res = await api.get('/contacts', { params: kanbanParams, signal });
          const respData = res.data?.data || res.data || {};
          let groupedData = respData.grouped || {};
          let totals = respData.stage_totals || respData.stageTotals || {};
          let totalCount = respData.total ?? 0;
          const revenues = respData.stage_revenues || respData.stageRevenues || res.data?.stageRevenues || {};
          const totRev = respData.total_revenue ?? respData.totalRevenue ?? res.data?.totalRevenue ?? 0;

          if (!respData.grouped && Array.isArray(respData.items)) {
            groupedData = {};
            respData.items.forEach((item: any) => {
              const sid = item.stage_id || 0;
              if (!groupedData[sid]) groupedData[sid] = [];
              groupedData[sid].push(item);
            });
          }

          setItems(groupedData);
          setStageTotals(totals);
          setTotal(Number(totalCount) || 0);
          setStageRevenues(revenues);
          setTotalExpectedRevenue(Number(totRev) || 0);
        } else {
          const promises = stages.map(async (stage) => {
            const stageParams = {
              ...params,
              page: 1,
              limit: 30,
              stage_id: stage.id,
              skip_counts: 1
            };
            const res = await api.get(endpoint, { params: stageParams, signal });
            const stageItems = res.data?.data?.items || res.data?.data || [];
            const stageTotal = res.data?.data?.total !== undefined ? Number(res.data.data.total) : stageItems.length;
            const stageRev = stageItems.reduce((s: number, d: any) => s + (Number(d.expected_revenue) || Number(d.value) || 0), 0);
            return { stageId: stage.id, items: stageItems, total: stageTotal, revenue: stageRev };
          });

          const results = await Promise.all(promises);
          const grouped: Record<number, any[]> = {};
          const totals: Record<number, number> = {};
          const revenues: Record<number, number> = {};
          let totalCount = 0;
          let sumRev = 0;
          results.forEach(res => {
            grouped[res.stageId] = res.items;
            totals[res.stageId] = res.total;
            revenues[res.stageId] = res.revenue;
            totalCount += res.total;
            sumRev += res.revenue;
          });

          setItems(grouped);
          setStageTotals(totals);
          setStageRevenues(revenues);
          setTotalExpectedRevenue(sumRev);
          setTotal(totalCount);
        }
      } else {
        const tableParams = {
          ...params,
          page,
          limit
        };
        const r = await api.get(endpoint, { params: tableParams, signal });
        const respData = r.data?.data || r.data || {};
        const dataItems: any[] = respData.items || [];

        const grouped: Record<number, any[]> = {};
        dataItems.forEach((d: any) => {
          const sid = (!d.stage_id || d.stage_id === '0' || d.stage_id === 0)
            ? (stagesRef.current.length > 0 ? stagesRef.current[0].id : 0)
            : d.stage_id;
          if (!grouped[sid]) grouped[sid] = [];
          grouped[sid].push(d);
        });

        setItems(grouped);
        setTotal(respData.total ?? dataItems.length);
        if (respData.stage_counts || respData.stage_totals) {
          setStageTotals(respData.stage_totals || respData.stage_counts);
        }
        if (respData.stage_revenues || respData.stageRevenues || r.data?.stageRevenues) {
          setStageRevenues(respData.stage_revenues || respData.stageRevenues || r.data?.stageRevenues);
        }
        if (respData.total_revenue !== undefined || respData.totalRevenue !== undefined || r.data?.totalRevenue !== undefined) {
          setTotalExpectedRevenue(Number(respData.total_revenue ?? respData.totalRevenue ?? r.data?.totalRevenue) || 0);
        }
      }
    } catch (e: any) {
      if (e.name === 'CanceledError' || e.name === 'AbortError' || e.code === 'ERR_CANCELED' || e.message === 'canceled') {
        return;
      }
      console.error("Failed to fetch data", e);
      setItems({});
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  };

  const handleLoadMoreStage = async (stageId: number) => {
    const currentStageItems = items[stageId] || [];
    const totalInStage = stageTotals[stageId] ?? currentStageItems.length;
    const currentVisible = stageVisibleLimits[stageId] || 15;
    const nextVisible = currentVisible + 15;

    setStageVisibleLimits(prev => ({
      ...prev,
      [stageId]: nextVisible
    }));

    if (nextVisible >= currentStageItems.length && currentStageItems.length < totalInStage) {
      if (loadingMoreStage[stageId]) return;
      setLoadingMoreStage(prev => ({ ...prev, [stageId]: true }));
      try {
        const currentFilterParams = buildFilterParams();
        if (pipelineView === 'contacts') {
          const res = await api.get('/contacts', {
            params: {
              ...currentFilterParams,
              kanban: 1,
              kanban_stage_id: stageId,
              kanban_offset: currentStageItems.length,
              limit_per_stage: 30
            }
          });
          const respData = res.data?.data || res.data || {};
          const newCards: any[] = respData.grouped?.[stageId] || respData.items || [];
          if (newCards.length > 0) {
            setItems(prev => {
              const existing = prev[stageId] || [];
              const existingIds = new Set(existing.map((c: any) => c.id));
              const uniqueNew = newCards.filter((c: any) => !existingIds.has(c.id));
              return {
                ...prev,
                [stageId]: [...existing, ...uniqueNew]
              };
            });
            setStageVisibleLimits(prev => ({
              ...prev,
              [stageId]: Math.max(prev[stageId] || 15, currentStageItems.length + newCards.length)
            }));
          }
        } else {
          const endpoint = pipelineView === 'companies' ? '/companies' : '/deals';
          const nextPage = Math.floor(currentStageItems.length / 30) + 1;
          const res = await api.get(endpoint, {
            params: {
              ...currentFilterParams,
              stage_id: stageId,
              page: nextPage,
              limit: 30,
              skip_counts: 1
            }
          });
          const newCards: any[] = res.data?.data?.items || res.data?.data || [];
          if (newCards.length > 0) {
            setItems(prev => {
              const existing = prev[stageId] || [];
              const existingIds = new Set(existing.map((c: any) => c.id));
              const uniqueNew = newCards.filter((c: any) => !existingIds.has(c.id));
              return {
                ...prev,
                [stageId]: [...existing, ...uniqueNew]
              };
            });
            setStageVisibleLimits(prev => ({
              ...prev,
              [stageId]: Math.max(prev[stageId] || 15, currentStageItems.length + newCards.length)
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load more stage cards:', err);
      } finally {
        setLoadingMoreStage(prev => ({ ...prev, [stageId]: false }));
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const loadDealsMetadata = async () => {
      try {
        const currentUser = useAuthStore.getState().user;
        const isRosterRestricted = ['sale', 'sales', 'manager', 'director'].includes(currentUser?.role || '');
        const bypassProj = isRosterRestricted ? '' : '?bypass_roster=1';
        const isSale = currentUser && (currentUser.role === 'sale' || currentUser.role === 'sales');

        const [
          projResult,
          campResult,
          srcResult,
          stageResult,
          userResult,
          settingResult,
          tagResult
        ] = await Promise.allSettled([
          api.get(`/projects${bypassProj}`, { signal: controller.signal }),
          api.get('/marketing-campaigns', { signal: controller.signal }),
          api.get('api.php?action=get_unique_sources', { signal: controller.signal }),
          api.get('/pipeline-stages', { signal: controller.signal }),
          !isSale ? api.get('/users', { signal: controller.signal }) : Promise.resolve(null),
          api.get('/api.php?action=get_settings', { signal: controller.signal }),
          api.get('/tags', { signal: controller.signal })
        ]);

        if (controller.signal.aborted) return;

        if (projResult.status === 'fulfilled' && projResult.value) {
          setProjects(projResult.value.data?.data || []);
        }
        if (campResult.status === 'fulfilled' && campResult.value) {
          setCampaigns(campResult.value.data?.data?.items || campResult.value.data?.data || []);
        }
        if (srcResult.status === 'fulfilled' && srcResult.value?.data?.success) {
          setSources(srcResult.value.data.data || []);
        }
        if (stageResult.status === 'fulfilled' && stageResult.value) {
          const stagesData = stageResult.value.data?.data || [];
          const sorted = [...stagesData].sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
          setStages(sorted);
        }
        if (userResult.status === 'fulfilled' && userResult.value) {
          let list = userResult.value.data?.data || [];
          const teamId = getEffectiveTeamId();
          if (currentUser?.role === 'manager' && teamId) {
            list = list.filter((u: any) => String(u.team_id) === String(teamId));
          }
          setAllUsers(list);
        }
        if (settingResult.status === 'fulfilled' && settingResult.value?.data?.success && settingResult.value.data.data) {
          const d = settingResult.value.data.data;
          setAllowPipelineBackward(d.allow_pipeline_backward === '1' || d.allow_pipeline_backward === 1);
          setAllowPipelineSkip(d.allow_pipeline_skip === '1' || d.allow_pipeline_skip === 1);
        }
        if (tagResult.status === 'fulfilled' && tagResult.value) {
          const arr = tagResult.value.data && Array.isArray(tagResult.value.data.data)
            ? tagResult.value.data.data
            : (Array.isArray(tagResult.value.data) ? tagResult.value.data : []);
          setDbTags(arr);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          console.error("Error loading Deals metadata:", err);
        }
      }
    };
    loadDealsMetadata();
    return () => controller.abort();
  }, [pipelineView, teams]);

  useEffect(() => {
    const controller = new AbortController();
    const urlParams = new URLSearchParams(location.search);
    const targetId = urlParams.get('open_deal_id') || urlParams.get('id') || urlParams.get('deal_id');
    if (targetId) {
      const did = Number(targetId);
      if (did) {
        api.get(`/deals/${did}`, { signal: controller.signal }).then(res => {
          if (!controller.signal.aborted && res.data.success && res.data.data) {
            const deal = res.data.data;
            const highlightNoteId = urlParams.get('highlight_note_id');
            if (highlightNoteId && deal.contact_id) {
              navigate(`/contacts?open_contact_id=${deal.contact_id}&highlight_note_id=${highlightNoteId}`);
              return;
            }
            setSelectedDeal(deal);
            setShowDealDrawer(true);
          }
        }).catch(err => {
          if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
          console.error("Error loading deep link deal:", err);
        }).finally(() => {
          if (!controller.signal.aborted) {
            const newParams = new URLSearchParams(window.location.search);
            newParams.delete('id');
            newParams.delete('deal_id');
            newParams.delete('open_deal_id');
            const cleanUrl = window.location.pathname + (newParams.toString() ? '?' + newParams.toString() : '');
            window.history.replaceState({}, '', cleanUrl);
          }
        });
      }
    }
    return () => controller.abort();
  }, [location.search, navigate]);

  useEffect(() => {
    let activeController: AbortController | null = null;
    const handleOpenDealDrawer = (e: any) => {
      const did = Number(e.detail?.id || e.detail?.dealId);
      if (did) {
        if (activeController) activeController.abort();
        const controller = new AbortController();
        activeController = controller;
        api.get(`/deals/${did}`, { signal: controller.signal }).then(res => {
          if (!controller.signal.aborted && res.data.success && res.data.data) {
            setSelectedDeal(res.data.data);
            setShowDealDrawer(true);
          }
        }).catch(err => {
          if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
          console.error("Error opening deal drawer from event:", err);
        });
      }
    };
    window.addEventListener('open-deal-drawer', handleOpenDealDrawer);
    return () => {
      if (activeController) activeController.abort();
      window.removeEventListener('open-deal-drawer', handleOpenDealDrawer);
    };
  }, []);

  const stageIdsKey = useMemo(() => stages.map(s => s.id).join(','), [stages]);

  useEffect(() => {
    if (stages.length > 0) fetchData();
  }, [
    stageIdsKey,
    pipelineView,
    page,
    limit,
    debouncedSearch,
    filterLeadStatus,
    filterAssignee,
    filterStage,
    activeStageFilter,
    filterProject,
    filterCampaign,
    filterSource,
    filterTag,
    filterInteractionStatus,
    dateField,
    dateFilterType,
    filterDateFrom,
    filterDateTo,
    admissionFrom,
    admissionTo,
    sortBy,
    viewMode,
    effectiveTeamId,
    debouncedExtraFilterSig
  ]);

  useEffect(() => {
    const handleRefresh = () => {
      if (stages.length > 0) {
        fetchData();
      }
    };
    window.addEventListener('lead-claimed', handleRefresh);
    window.addEventListener('lead-added', handleRefresh);
    window.addEventListener('contact-updated', handleRefresh);
    return () => {
      window.removeEventListener('lead-claimed', handleRefresh);
      window.removeEventListener('lead-added', handleRefresh);
      window.removeEventListener('contact-updated', handleRefresh);
    };
  }, [stages]);

  useEffect(() => {
    setPage(1);
    setStageVisibleLimits({});
    setSelected(new Set());
  }, [
    debouncedSearch,
    filterLeadStatus,
    filterAssignee,
    filterStage,
    activeStageFilter,
    filterProject,
    filterCampaign,
    filterSource,
    filterTag,
    filterInteractionStatus,
    dateField,
    dateFilterType,
    filterDateFrom,
    filterDateTo,
    admissionFrom,
    admissionTo,
    sortBy,
    pipelineView,
    debouncedExtraFilterSig
  ]);

  useEffect(() => {
    setSelected(new Set());
  }, [page]);

  const hasLocalModalOpen = Boolean(transitionModal?.isOpen || showBulkMove || stagePickerItem !== null || showFilterPanel);
  const escapeHandlerRef = useRef<() => void>(() => {});
  escapeHandlerRef.current = () => {
    if (stagePickerItem !== null) {
      setStagePickerItem(null);
      return;
    }
    if (transitionModal?.isOpen) {
      setTransitionModal(null);
      return;
    }
    if (showBulkMove) {
      setShowBulkMove(false);
      return;
    }
    if (showFilterPanel) {
      setShowFilterPanel(false);
      return;
    }
  };

  useEffect(() => {
    if (hasLocalModalOpen) {
      return pushOverlay('deals-page-modal', () => escapeHandlerRef.current(), 200000);
    }
  }, [hasLocalModalOpen]);

  const updateItemLocally = (updated: any) => {
    if (!updated) return;
    setItems(prev => {
      const next: Record<number, any[]> = {};
      Object.keys(prev).forEach(sid => {
        next[sid as any] = (prev[sid as any] || []).map((it: any) =>
          it.id === updated.id ? { ...it, ...updated } : it
        );
      });
      return next;
    });
  };

  const openStageTransitionModal = (itemId: number, fromStage: number, toStage: number) => {
    const fromStageObj = stages.find(s => s.id === fromStage);
    const toStageObj = stages.find(s => s.id === toStage);
    const isFromDeposit = fromStageObj?.name?.toLowerCase()?.includes('cọc') || fromStageObj?.name?.toLowerCase()?.includes('deposit');
    const isToSuccess = toStageObj?.name?.toLowerCase()?.includes('hợp đồng') || toStageObj?.name?.toLowerCase()?.includes('won') || toStageObj?.name?.toLowerCase()?.includes('thành công') || toStageObj?.is_won;
    const isCancellation = isFromDeposit && !isToSuccess;

    const fromIdx = stages.findIndex(s => s.id === fromStage);
    const toIdx = stages.findIndex(s => s.id === toStage);
    const isBackward = fromIdx !== -1 && toIdx !== -1 && toIdx < fromIdx;

    if (isBackward && !isCancellation && !allowPipelineBackward) {
      addToast("Không thể di chuyển ngược giai đoạn trên Pipeline.", "error");
      return;
    }

    if (fromStageObj?.system_slug === 'hoc_vien' && isBackward) {
      addToast("Không thể chuyển lùi giai đoạn khi khách hàng đã là Học viên chính thức.", "error");
      return;
    }

    const isForwardSkip = (fromIdx !== -1 && toIdx !== -1 && toIdx > fromIdx + 1);
    if (isForwardSkip && !allowPipelineSkip) {
      addToast("Không được phép nhảy cóc giai đoạn. Tiến trình chuyển giai đoạn phải đi tuần tự từng bước.", "error");
      return;
    }

    setTransitionModal({
      isOpen: true,
      itemId,
      fromStage,
      toStage,
      note: '',
      isCancellation,
      hasRevenue: null
    });
  };

  const handleDrop = (toStage: number) => {
    if (!dragging || dragging.fromStage === toStage) return;
    openStageTransitionModal(dragging.id, dragging.fromStage, toStage);
    setDragging(null);
  };

  const handleConfirmTransition = async () => {
    if (!transitionModal || isConfirmingTransition || confirmTransitionInFlightRef.current) return;

    if (transitionModal.isCancellation) {
      if (!transitionModal.hasRevenue) {
        addToast('Vui lòng xác nhận trạng thái doanh thu thực tế.', 'warning');
        return;
      }
      if (transitionModal.hasRevenue === 'yes') {
        addToast('Không thể chuyển trạng thái. Quy định yêu cầu giữ nguyên Đặt cọc do đã có doanh thu.', 'error');
        return;
      }
    }

    if (!transitionModal.note.trim()) { addToast('Vui lòng nhập ghi chú bắt buộc (Audit Trail)', 'warning'); return; }

    confirmTransitionInFlightRef.current = true;
    try {
      setIsConfirmingTransition(true);
      const itemId = transitionModal.itemId;
      const fromStageId = transitionModal.fromStage;
      const toStageId = transitionModal.toStage;
      
      const sourceItems = items[fromStageId] || [];
      const itemToMove = sourceItems.find(d => d.id === itemId);
      
      if (itemToMove) {
        const updatedItem = { 
          ...itemToMove, 
          stage_id: toStageId, 
          pipeline_status: stages.find(s => s.id === toStageId)?.system_slug || itemToMove.pipeline_status 
        };
        
        setItems(prev => {
          const next = { ...prev };
          next[fromStageId] = (prev[fromStageId] || []).filter(d => d.id !== itemId);
          next[toStageId] = [updatedItem, ...(prev[toStageId] || [])];
          return next;
        });
        
        setStageTotals(prev => ({
          ...prev,
          [fromStageId]: Math.max(0, (prev[fromStageId] || 0) - 1),
          [toStageId]: (prev[toStageId] || 0) + 1
        }));
      }

      const endpoint = pipelineView === 'contacts' ? `/contacts/${itemId}/stage` : (pipelineView === 'companies' ? `/companies/${itemId}/stage` : `/deals/${itemId}/stage`);
      await api.patch(endpoint, { 
        stage_id: toStageId,
        note: transitionModal.isCancellation 
          ? `[Bể cọc - Không doanh thu] ${transitionModal.note}`
          : transitionModal.note
      });
      
      const toStage = stages.find(s => s.id === toStageId);
      if (toStage?.is_won) {
        triggerFullConfetti();
        addToast(`TUYỆT VỜI! Chúc mừng bạn đã chốt thành công "${pipelineView === 'contacts' ? itemToMove?.full_name : (pipelineView === 'companies' ? itemToMove?.name : itemToMove?.title)}"`, 'success');
      } else {
        addToast('Đã chuyển trạng thái & lưu Audit Log', 'success');
      }
    } catch (err: any) { 
      addToast(err.response?.data?.message || 'Lỗi khi di chuyển thẻ', 'error'); 
      fetchData();
    } finally {
      confirmTransitionInFlightRef.current = false;
      setIsConfirmingTransition(false);
      setTransitionModal(null);
    }
  };

  const handleSaveDeal = async (formData?: any) => {
    if (saveDealInFlightRef.current) return;
    saveDealInFlightRef.current = true;
    try {
      if (selectedDeal && formData) {
        await api.put(`/deals/${selectedDeal.id}`, formData);
        addToast('Đã cập nhật cơ hội thành công', 'success');
      }
      setShowDealDrawer(false);
      fetchData();
    } catch (err: any) {
      addToast(err.response?.data?.message || 'Lỗi khi lưu cơ hội', 'error');
    } finally {
      saveDealInFlightRef.current = false;
    }
  };

  const totalRevenue = Object.values(filteredItems).flat().reduce((sum, d) => sum + (Number(d.expected_revenue) || Number(d.value) || 0), 0);

  const activeFilterCount = useMemo(() => {
    return [
      filterLeadStatus,
      filterAssignee,
      filterTeam,
      filterStage,
      filterProject,
      filterCampaign,
      filterSource,
      filterTag,
      filterInteractionStatus,
      staleDays.trim(),
      interactedWithinDays.trim(),
      interactionType,
      (minCallCount.trim() || maxCallCount.trim()) ? 'call_count' : '',
      noteKeyword.trim(),
      gender,
      city,
      (ageMin.trim() || ageMax.trim()) ? 'age' : '',
      jobTitle.trim(),
      company.trim(),
      financialFilter,
      (minAmount.trim() || maxAmount.trim()) ? 'amount' : '',
      studyStatus,
      studentCode.trim(),
      expectedIntake.trim(),
      engagementStatus,
      automationFlow,
      voucherStatus,
      (minEngagementScore.trim() || maxEngagementScore.trim()) ? 'engagement_score' : '',
      validCustomRules.length > 0 ? 'custom_rules' : '',
      dateFilterType ? 'date' : '',
      (admissionFrom || admissionTo) ? 'admission' : '',
    ].filter(Boolean).length;
  }, [
    filterLeadStatus,
    filterAssignee,
    filterTeam,
    filterStage,
    filterProject,
    filterCampaign,
    filterSource,
    filterTag,
    filterInteractionStatus,
    staleDays,
    interactedWithinDays,
    interactionType,
    minCallCount,
    maxCallCount,
    noteKeyword,
    gender,
    city,
    ageMin,
    ageMax,
    jobTitle,
    company,
    financialFilter,
    minAmount,
    maxAmount,
    studyStatus,
    studentCode,
    expectedIntake,
    engagementStatus,
    automationFlow,
    voucherStatus,
    minEngagementScore,
    maxEngagementScore,
    validCustomRules,
    dateFilterType,
    admissionFrom,
    admissionTo
  ]);

  const hasActiveFilters = Boolean(searchTerm.trim() || activeFilterCount > 0);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterLeadStatus('');
    setFilterLeadStatusOp('in');
    setFilterAssignee('');
    setFilterTeam('');
    setFilterStage('');
    setFilterStageOp('in');
    setActiveStageFilter('all');
    setFilterProject('');
    setFilterCampaign('');
    setFilterSource('');
    setFilterTag('');
    setFilterInteractionStatus('');
    setStaleDays('');
    setInteractedWithinDays('');
    setInteractionType('');
    setMinCallCount('');
    setMaxCallCount('');
    setNoteKeyword('');
    setGender('');
    setCity('');
    setAgeMin('');
    setAgeMax('');
    setJobTitle('');
    setCompany('');
    setFinancialFilter('');
    setMinAmount('');
    setMaxAmount('');
    setStudyStatus('');
    setStudentCode('');
    setExpectedIntake('');
    setEngagementStatus('');
    setAutomationFlow('');
    setVoucherStatus('');
    setMinEngagementScore('');
    setMaxEngagementScore('');
    setCustomRules([]);
    setCustomRulesLogic('AND');
    setDateField('created_at');
    setDateFilterType('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setAdmissionFrom('');
    setAdmissionTo('');
    setPage(1);
  };

  const getTimelineLabel = () => {
    const presetLabels: Record<string, string> = {
      today: 'Hôm nay',
      yesterday: 'Hôm qua',
      last_7_days: '7 ngày qua',
      this_week: '7 ngày qua',
      last_30_days: '30 ngày qua',
      this_month: 'Tháng này',
      last_month: 'Tháng trước',
      this_year: 'Năm nay',
      custom: `${filterDateFrom || '...'} → ${filterDateTo || '...'}`
    };
    const fieldLabels: Record<string, string> = {
      created_at: 'Tạo',
      updated_at: 'Cập nhật',
      last_contact: 'Liên hệ',
      admission_date: 'Nhập học',
      deposit_date: 'Đặt cọc',
      next_followup_date: 'Hẹn gọi lại',
      birthday: 'Sinh nhật'
    };
    if (!dateFilterType && (admissionFrom || admissionTo)) {
      return `Nhập học: ${admissionFrom || '...'} → ${admissionTo || '...'}`;
    }
    if (!dateFilterType) return 'Thời gian';
    return `${fieldLabels[dateField] || 'Thời gian'}: ${presetLabels[dateFilterType] || dateFilterType}`;
  };

  const filteredCampaigns = useMemo(() => {
    if (!filterProject) return campaigns;
    const selectedProjIds = new Set(filterProject.split(',').map(s => s.trim()).filter(Boolean));
    if (selectedProjIds.size === 0) return campaigns;
    return campaigns.filter((c: any) => !c.project_id || selectedProjIds.has(String(c.project_id)));
  }, [campaigns, filterProject]);

  const mergedSourceOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: { value: string; label: string }[] = [];
    const addOpt = (val: string, lbl?: string) => {
      const clean = String(val || '').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      list.push({ value: clean, label: lbl || clean });
    };
    LEAD_SOURCES.forEach(s => addOpt(s.value, s.label));
    sources.forEach(s => addOpt(String(s), String(s)));
    return list;
  }, [sources]);

  const tagOptions = useMemo(() => {
    const names = new Set<string>();
    dbTags.forEach((t: any) => {
      if (t?.name) names.add(String(t.name).trim());
    });
    Object.values(items).flat().forEach((it: any) => {
      parseCardTags(it?.tags).forEach(t => names.add(t));
    });
    return Array.from(names).filter(Boolean).map(t => ({ value: t, label: t }));
  }, [dbTags, items]);

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header" style={{ marginBottom: '1rem', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={24} color="var(--color-primary)" />
            Pipeline Khách hàng
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.9375rem', marginTop: '4px' }}>
            <strong>{total || Object.values(items).flat().length}</strong> thẻ đang quản lý · Tổng giá trị dự kiến: <strong style={{ color: 'var(--color-primary)', fontSize: '1.25rem', marginLeft: '4px' }}>{FMT(totalExpectedRevenue || totalRevenue)}</strong>
          </p>
        </div>

        {!isMobile && currentUser?.role !== 'viewer' && currentUser?.role !== 'sale' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              className="btn outline sm"
              onClick={() => setShowImportExport(true)}
              title="Nhập dữ liệu từ Excel/CSV"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <Upload size={14} />
              <span>Nhập dữ liệu</span>
            </button>

            <div ref={exportDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                className="btn outline sm"
                onClick={() => setShowExportDropdown(prev => !prev)}
                disabled={isExporting}
                title="Xuất dữ liệu ra Excel/CSV"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  background: showExportDropdown ? 'var(--color-bg-light)' : undefined,
                  borderColor: showExportDropdown ? 'var(--color-primary)' : undefined
                }}
              >
                {isExporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                <span>{isExporting ? 'Đang xuất...' : 'Xuất dữ liệu'}</span>
                <ChevronDown size={13} style={{ opacity: 0.7, transform: showExportDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
              </button>

              <AnimatePresence>
                {showExportDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      width: '270px',
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '10px',
                      boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.12))',
                      padding: '6px',
                      zIndex: 1000,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportDropdown(false);
                        bulkExport('filtered');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '8px 10px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.15s'
                      }}
                      className="hover-bg-alt"
                    >
                      <Filter size={15} style={{ marginTop: 2, color: 'var(--color-primary)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Xuất theo bộ lọc đang xem</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Khớp 100% với bộ lọc đang xem</div>
                      </div>
                    </button>
                    <div style={{ height: 1, background: 'var(--color-border-light)', margin: '2px 0' }} />
                    <button
                      type="button"
                      onClick={() => {
                        setShowExportDropdown(false);
                        bulkExport('full');
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        padding: '8px 10px',
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background-color 0.15s'
                      }}
                      className="hover-bg-alt"
                    >
                      <Download size={15} style={{ marginTop: 2, color: 'var(--color-success)', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>Xuất toàn bộ</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: 2 }}>Toàn bộ dữ liệu đầy đủ 100% trường</div>
                      </div>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      <ImportExportModal 
        isOpen={showImportExport} 
        onClose={() => setShowImportExport(false)} 
        entityName={pipelineView === 'deals' ? 'Cơ hội' : (pipelineView === 'contacts' ? 'Liên hệ' : 'Công ty')}
        onExport={() => {
          bulkExport('filtered');
        }}
      />

      <ColumnCustomizer
        isOpen={showColumns}
        onClose={() => setShowColumns(false)}
        columns={columns}
        onChange={newCols => setColumns(newCols)}
        {...({ onReset: () => setColumns(DEFAULT_PIPELINE_COLUMNS) } as any)}
      />

      {/* Unified Filter Bar / Bulk Action Bar (Synchronized with ContactsPage.tsx) */}
      <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '0.75rem', position: 'relative' }}>
        <AnimatePresence mode="wait">
          {selected.size > 0 ? (
            <motion.div 
              key="bulk-actions"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              style={{ display: 'flex', alignItems: 'center', gap: '1rem', width: '100%' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'var(--color-primary)', color: 'white', padding: '0.5rem 1.25rem', borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 12px rgba(163, 20, 34,0.2)' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{selected.size} đã chọn</span>
                {selected.size > 0 && selected.size < totalVisibleCount && (
                  <button className="btn ghost sm" style={{ color: 'white', textDecoration: 'underline', padding: '0 4px' }} onClick={selectAllEntireQuery}>
                    Chọn tất cả {totalVisibleCount} thẻ
                  </button>
                )}
              </div>
              
              <div style={{ flex: 1 }} />
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn ghost sm" style={{ color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => bulkExport('filtered')} disabled={isExporting}>
                  {isExporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                  <span>{isExporting ? 'Đang xuất...' : 'Xuất CSV'}</span>
                </button>
                <button className="btn outline sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setShowCrmEmailModal(true)}>
                  <Mail size={14} /> Gửi Email
                </button>
                <button className="btn outline sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={() => setCrmBulkMarketingModal({ isOpen: true, mode: 'list' })}>
                  <Sparkles size={14} /> Thêm vào List / Flow
                </button>
                <button className="btn primary sm" onClick={() => setShowBulkMove(true)}>
                  <RefreshCw size={14} /> Chuyển Giai đoạn
                </button>
                <button className="btn ghost sm" onClick={() => setSelected(new Set())}>
                  <X size={16} /> Hủy
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="filters"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              {/* Toolbar Row */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: isMobile ? 'nowrap' : 'wrap', width: '100%' }}>
                {/* 1. Search Input */}
                <div className="filter-search" style={{ flex: 1, minWidth: isMobile ? 0 : '260px', position: 'relative', height: '38px', borderRadius: '8px', border: '1px solid var(--color-border)', boxSizing: 'border-box', paddingRight: '2.5rem' }}>
                  <Search size={14} style={{ color:'var(--color-text-muted)', marginLeft: '4px' }}/>
                  <input 
                    placeholder="Tìm tên (có/không dấu), SĐT, email toàn hệ thống..." 
                    value={searchTerm} 
                    onChange={e => { setSearchTerm(e.target.value); setPage(1); }} 
                    style={{ paddingRight: '0.5rem', height: '100%' }} 
                  />
                  <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                    <AnimatePresence>
                      {searchTerm && (
                        <motion.button 
                          initial={{ opacity: 0, scale: 0.8 }} 
                          animate={{ opacity: 1, scale: 1 }} 
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                          className="btn-icon-bare" 
                          onClick={() => setSearchTerm('')} 
                          style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'transparent' }}
                          title="Xóa tìm kiếm"
                        >
                          <X size={14} style={{ color: 'var(--color-text-muted)' }}/>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* 2. Quick Time & Admission Date Popover */}
                {!isMobile && (
                  <div ref={timelinePopoverRef} style={{ position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => setShowTimelinePopover(prev => !prev)}
                      style={{
                        height: '38px',
                        padding: '0 0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                        border: (dateFilterType || admissionFrom || admissionTo) ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                        borderRadius: '8px',
                        background: 'var(--color-surface)',
                        color: (dateFilterType || admissionFrom || admissionTo) ? 'var(--color-primary)' : 'var(--color-text)',
                        fontWeight: (dateFilterType || admissionFrom || admissionTo) ? 700 : 600,
                        fontSize: '0.825rem',
                        transition: 'all 0.2s',
                        boxShadow: 'var(--shadow-sm)',
                        outline: 'none',
                        whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                      title="Lọc theo mốc thời gian hoặc ngày nhập học"
                    >
                      {dateField === 'admission_date' || admissionFrom || admissionTo ? (
                        <GraduationCap size={15} style={{ color: 'var(--color-primary)' }} />
                      ) : (
                        <Calendar size={15} style={{ color: dateFilterType ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
                      )}
                      <span>{getTimelineLabel()}</span>
                      <ChevronDown size={14} style={{ transform: showTimelinePopover ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                    </button>

                    <AnimatePresence>
                      {showTimelinePopover && (
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.96 }}
                          transition={{ duration: 0.15 }}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 6px)',
                            left: 0,
                            zIndex: 1000,
                            width: '360px',
                            background: 'var(--color-surface)',
                            border: '1px solid var(--color-border)',
                            borderRadius: '14px',
                            boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
                            padding: '1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.875rem'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={15} color="var(--color-primary)" /> Lọc mốc thời gian
                            </span>
                            {(dateFilterType || filterDateFrom || filterDateTo || admissionFrom || admissionTo) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDateFilterType('');
                                  setFilterDateFrom('');
                                  setFilterDateTo('');
                                  setAdmissionFrom('');
                                  setAdmissionTo('');
                                }}
                                style={{ fontSize: '0.72rem', color: 'var(--color-danger)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                              >
                                Xóa lọc ngày
                              </button>
                            )}
                          </div>

                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px', display: 'block' }}>Trường thời gian:</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '5px' }}>
                              {[
                                { id: 'created_at', label: 'Ngày tạo' },
                                { id: 'updated_at', label: 'Ngày cập nhật' },
                                { id: 'last_contact', label: 'Liên hệ cuối' },
                                { id: 'admission_date', label: 'Ngày nhập học' },
                                { id: 'deposit_date', label: 'Ngày đặt cọc' },
                                { id: 'next_followup_date', label: 'Ngày hẹn gọi lại' },
                                { id: 'birthday', label: 'Sinh nhật' }
                              ].map(f => {
                                const isSel = dateField === f.id;
                                return (
                                  <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => setDateField(f.id as any)}
                                    style={{
                                      padding: '6px 8px',
                                      fontSize: '0.74rem',
                                      fontWeight: isSel ? 700 : 500,
                                      borderRadius: '6px',
                                      border: isSel ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                      background: isSel ? 'rgba(189, 29, 45, 0.06)' : 'var(--color-surface)',
                                      color: isSel ? 'var(--color-primary)' : 'var(--color-text)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {f.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          <div>
                            <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px', display: 'block' }}>Khoảng thời gian nhanh:</label>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' }}>
                              {[
                                { id: '', label: 'Tất cả' },
                                { id: 'today', label: 'Hôm nay' },
                                { id: 'yesterday', label: 'Hôm qua' },
                                { id: 'last_7_days', label: '7 ngày qua' },
                                { id: 'last_30_days', label: '30 ngày qua' },
                                { id: 'this_month', label: 'Tháng này' },
                                { id: 'last_month', label: 'Tháng trước' },
                                { id: 'this_year', label: 'Năm nay' },
                                { id: 'custom', label: 'Tùy chỉnh' }
                              ].map(p => {
                                const isSel = dateFilterType === p.id;
                                return (
                                  <button
                                    key={p.id || 'all'}
                                    type="button"
                                    onClick={() => {
                                      setDateFilterType(p.id);
                                      if (p.id !== 'custom') {
                                        setShowTimelinePopover(false);
                                      }
                                    }}
                                    style={{
                                      padding: '6px 6px',
                                      fontSize: '0.74rem',
                                      fontWeight: isSel ? 700 : 500,
                                      borderRadius: '6px',
                                      border: isSel ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                      background: isSel ? 'var(--color-primary)' : 'var(--color-surface)',
                                      color: isSel ? '#ffffff' : 'var(--color-text)',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    {p.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {dateFilterType === 'custom' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.75rem', width: '64px', color: 'var(--color-text-muted)' }}>Từ ngày:</span>
                                <div style={{ flex: 1 }}>
                                  <VietnameseDateInput size="sm" value={filterDateFrom} onChange={val => setFilterDateFrom(val)} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.75rem', width: '64px', color: 'var(--color-text-muted)' }}>Đến ngày:</span>
                                <div style={{ flex: 1 }}>
                                  <VietnameseDateInput size="sm" value={filterDateTo} onChange={val => setFilterDateTo(val)} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                                <button type="button" className="btn sm primary" onClick={() => setShowTimelinePopover(false)}>
                                  Áp dụng
                                </button>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* 3. Bộ lọc Button with Active Filter Count Badge */}
                <button 
                  onClick={() => setShowFilterPanel(!showFilterPanel)}
                  style={{
                    width: isMobile ? '36px' : 'auto',
                    height: isMobile ? '36px' : '38px',
                    padding: isMobile ? '0' : '0 0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    border: (showFilterPanel || activeFilterCount > 0) ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: '8px',
                    background: showFilterPanel ? 'var(--color-bg-light)' : 'var(--color-surface)',
                    color: (showFilterPanel || activeFilterCount > 0) ? 'var(--color-primary)' : 'var(--color-text)',
                    fontSize: '0.825rem',
                    fontWeight: 600,
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'all 0.2s',
                    outline: 'none',
                    position: 'relative',
                    flexShrink: 0
                  }}
                  title="Bộ lọc chuyên sâu"
                >
                  <SlidersHorizontal size={14} />
                  {!isMobile && <span>Bộ lọc</span>}
                  {activeFilterCount > 0 && (
                    <span
                      style={{
                        background: 'var(--color-primary)',
                        color: '#ffffff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '99px',
                        minWidth: '18px',
                        height: '18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '0 5px',
                        lineHeight: 1
                      }}
                    >
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* 4. Sắp xếp Dropdown */}
                {!isMobile && (
                  <div style={{ width: 175, flexShrink: 0 }}>
                    <CustomSelect
                      value={sortBy}
                      onChange={v => setSortBy(v as any)}
                      options={[
                        { value: 'updated_desc', label: 'Mới cập nhật', icon: <ArrowDownUp size={14} /> },
                        { value: 'created_desc', label: 'Mới tạo', icon: <ArrowDownUp size={14} /> },
                        { value: 'interaction_desc', label: 'Tương tác gần nhất', icon: <ArrowDownUp size={14} /> },
                        { value: 'value_desc', label: 'Giá trị cao nhất', icon: <ArrowDownUp size={14} /> },
                        { value: 'name_asc', label: 'Tên A-Z', icon: <ArrowDownUp size={14} /> }
                      ]}
                    />
                  </div>
                )}

                {/* 5. View Toggle (Icon-only matching ContactsPage) */}
                {!isMobile && (
                  <div style={{
                    display: 'flex',
                    background: 'var(--color-border-light)',
                    border: '1px solid var(--color-border)',
                    padding: '2px',
                    borderRadius: '8px',
                    gap: '2px',
                    alignItems: 'center',
                    height: '38px',
                    boxSizing: 'border-box',
                    flexShrink: 0
                  }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('kanban')}
                      title="Dạng bảng (Kanban)"
                      style={{
                        padding: 0,
                        height: '32px',
                        width: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        border: 'none',
                        outline: 'none',
                        boxShadow: viewMode === 'kanban' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        background: viewMode === 'kanban' ? 'var(--color-surface)' : 'transparent',
                        color: viewMode === 'kanban' ? 'var(--color-text)' : 'var(--color-text-light)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <LayoutGrid size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      title="Dạng danh sách"
                      style={{
                        padding: 0,
                        height: '32px',
                        width: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                        border: 'none',
                        outline: 'none',
                        boxShadow: viewMode === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        background: viewMode === 'list' ? 'var(--color-surface)' : 'transparent',
                        color: viewMode === 'list' ? 'var(--color-text)' : 'var(--color-text-light)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <List size={16} />
                    </button>
                  </div>
                )}

                {/* 6. Tùy chỉnh cột Button */}
                {!isMobile && (
                  <button
                    type="button"
                    onClick={() => setShowColumns(true)}
                    title="Tùy chỉnh cột hiển thị"
                    style={{
                      height: '38px',
                      width: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <Columns size={16} />
                  </button>
                )}
              </div>

              {/* Active Filter Pills Bar */}
              {hasActiveFilters && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '6px',
                  padding: '6px 10px',
                  background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '10px',
                  fontSize: '0.78rem'
                }}>
                  <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
                    <Filter size={12} /> Đang lọc:
                  </span>
                  {filterLeadStatus && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>
                        Trạng thái Lead{filterLeadStatusOp === 'not_in' ? ' (Loại trừ)' : ''}:{' '}
                        {csvToMulti(filterLeadStatus).map(st => st === 'active' ? 'Hoạt động' : st === 'nurture' ? 'Nuôi dưỡng' : st === 'lost' ? 'Data Lost' : 'Tất cả').join(', ')}
                      </span>
                      <button type="button" onClick={() => { setFilterLeadStatus(''); setFilterLeadStatusOp('in'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterAssignee && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.1)', color: '#0284c7', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>
                        Sale: {csvToMulti(filterAssignee).map(id => id === 'unassigned' ? 'Chưa phân bổ' : (allUsers.find(u => String(u.id) === String(id))?.full_name || id)).join(', ')}
                      </span>
                      <button type="button" onClick={() => setFilterAssignee('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterTeam && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.1)', color: '#0284c7', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>
                        Đội nhóm: {csvToMulti(filterTeam).map(id => teams.find(t => String(t.id) === String(id))?.name || id).join(', ')}
                      </span>
                      <button type="button" onClick={() => setFilterTeam('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterStage && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>
                        Giai đoạn{filterStageOp === 'not_in' ? ' (Loại trừ)' : ''}:{' '}
                        {csvToMulti(filterStage).map(id => stages.find(s => String(s.id) === String(id))?.name || id).join(', ')}
                      </span>
                      <button type="button" onClick={() => { setFilterStage(''); setFilterStageOp('in'); setActiveStageFilter('all'); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterProject && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>
                        Chương trình: {csvToMulti(filterProject).map(id => projects.find(p => String(p.id) === String(id))?.name || id).join(', ')}
                      </span>
                      <button type="button" onClick={() => setFilterProject('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterCampaign && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.1)', color: '#db2777', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>
                        Chiến dịch: {csvToMulti(filterCampaign).map(id => campaigns.find(c => String(c.id) === String(id))?.name || id).join(', ')}
                      </span>
                      <button type="button" onClick={() => setFilterCampaign('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterSource && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Nguồn: {filterSource}</span>
                      <button type="button" onClick={() => setFilterSource('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterTag && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.74rem' }}>
                      <TagIcon size={11} />
                      <span>Tag: {filterTag}</span>
                      <button type="button" onClick={() => setFilterTag('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {filterInteractionStatus && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Tương tác: {filterInteractionStatus === 'uncontacted' ? 'Chưa liên hệ' : 'Đã liên hệ'}</span>
                      <button type="button" onClick={() => setFilterInteractionStatus('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {staleDays.trim() && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Chưa tương tác ≥ {staleDays.trim()} ngày</span>
                      <button type="button" onClick={() => setStaleDays('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {interactedWithinDays.trim() && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Tương tác trong {interactedWithinDays.trim()} ngày qua</span>
                      <button type="button" onClick={() => setInteractedWithinDays('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {interactionType && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.1)', color: '#0284c7', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Kênh TT: {interactionType}</span>
                      <button type="button" onClick={() => setInteractionType('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {(minCallCount.trim() || maxCallCount.trim()) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.1)', color: '#0284c7', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Số lần gọi: {minCallCount.trim() || '0'} → {maxCallCount.trim() || '∞'}</span>
                      <button type="button" onClick={() => { setMinCallCount(''); setMaxCallCount(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {noteKeyword.trim() && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Ghi chú: "{noteKeyword.trim()}"</span>
                      <button type="button" onClick={() => setNoteKeyword('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {gender && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Giới tính: {gender}</span>
                      <button type="button" onClick={() => setGender('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {city && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Tỉnh/TP: {city}</span>
                      <button type="button" onClick={() => setCity('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {(ageMin.trim() || ageMax.trim()) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Độ tuổi: {ageMin.trim() || '0'} - {ageMax.trim() || '∞'}</span>
                      <button type="button" onClick={() => { setAgeMin(''); setAgeMax(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {jobTitle.trim() && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Nghề nghiệp: {jobTitle.trim()}</span>
                      <button type="button" onClick={() => setJobTitle('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {company.trim() && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Đơn vị: {company.trim()}</span>
                      <button type="button" onClick={() => setCompany('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {financialFilter && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Tài chính: {FINANCIAL_STATUS_OPTIONS.find(o => o.value === financialFilter)?.label || financialFilter}</span>
                      <button type="button" onClick={() => setFinancialFilter('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {(minAmount.trim() || maxAmount.trim()) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Số tiền: {minAmount.trim() || '0'} → {maxAmount.trim() || '∞'}</span>
                      <button type="button" onClick={() => { setMinAmount(''); setMaxAmount(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {studyStatus && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Học vụ: {studyStatus}</span>
                      <button type="button" onClick={() => setStudyStatus('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {studentCode.trim() && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Mã HV: {studentCode.trim()}</span>
                      <button type="button" onClick={() => setStudentCode('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {expectedIntake.trim() && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Khóa dự kiến: {expectedIntake.trim()}</span>
                      <button type="button" onClick={() => setExpectedIntake('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {validCustomRules.length > 0 && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.12)', color: '#7c3aed', fontWeight: 600, fontSize: '0.74rem' }}>
                      <span>Điều kiện nâng cao ({validCustomRules.length} quy tắc {customRulesLogic})</span>
                      <button type="button" onClick={() => setCustomRules([])} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {dateFilterType && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontWeight: 600, fontSize: '0.74rem' }}>
                      <Calendar size={12} />
                      <span>{getTimelineLabel()}</span>
                      <button type="button" onClick={() => { setDateFilterType(''); setFilterDateFrom(''); setFilterDateTo(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  {(admissionFrom || admissionTo) && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', color: '#b45309', fontWeight: 600, fontSize: '0.74rem' }}>
                      <GraduationCap size={12} />
                      <span>Ngày nhập học: {admissionFrom || '...'} → {admissionTo || '...'}</span>
                      <button type="button" onClick={() => { setAdmissionFrom(''); setAdmissionTo(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'inherit' }}><X size={12} /></button>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleClearFilters}
                    style={{
                      marginLeft: 'auto',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'rgba(220, 38, 38, 0.06)',
                      color: '#dc2626',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <X size={12} /> Xóa tất cả
                  </button>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right-Side Slide-Over Drawer for Advanced Filters (Synchronized with ContactsPage.tsx) */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showFilterPanel && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 2147483640, display: 'flex', justifyContent: 'flex-end', overflow: 'hidden' }}>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowFilterPanel(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(15, 23, 42, 0.55)',
                  backdropFilter: 'blur(3px)',
                  zIndex: 2147483639
                }}
              />

              {/* Drawer Panel */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 260 }}
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: '540px',
                  height: '100%',
                  background: 'var(--color-surface, #ffffff)',
                  boxShadow: '-8px 0 36px rgba(0, 0, 0, 0.28)',
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 2147483640,
                  overflow: 'hidden'
                }}
              >
                {/* Drawer Header */}
                <div style={{
                  padding: '1.25rem 1.5rem',
                  borderBottom: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--color-surface)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      background: 'rgba(37, 99, 235, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--color-primary, #2563eb)'
                    }}>
                      <SlidersHorizontal size={18} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>Bộ lọc chuyên sâu</h3>
                      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Tùy chỉnh tiêu chí lọc danh sách khách hàng</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearFilters}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          background: 'transparent',
                          color: 'var(--color-danger, #ef4444)',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <RotateCcw size={12} /> Đặt lại
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowFilterPanel(false)}
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>

                {/* Drawer Body */}
                <div style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1.25rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem'
                }}>
                  {/* Card 1: Học vụ & Mốc thời gian */}
                  <div style={{
                    padding: '1.1rem',
                    borderRadius: '14px',
                    background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.875rem' }}>
                      <GraduationCap size={16} color="var(--color-text, #0f172a)" /> Học vụ & Mốc thời gian
                    </div>

                    {/* Khoảng ngày nhập học */}
                    <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Khoảng ngày nhập học</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '8px' }}>
                        {[
                          { id: 'this_month', label: 'Tháng này' },
                          { id: 'next_month', label: 'Tháng sau' },
                          { id: 'this_quarter', label: 'Quý này' },
                          { id: 'this_year', label: 'Năm nay' }
                        ].map(p => {
                          const now = new Date();
                          const y = now.getFullYear();
                          const m = now.getMonth();
                          let pFrom = '';
                          let pTo = '';
                          if (p.id === 'this_month') {
                            pFrom = formatLocalDate(new Date(y, m, 1));
                            pTo = formatLocalDate(new Date(y, m + 1, 0));
                          } else if (p.id === 'next_month') {
                            pFrom = formatLocalDate(new Date(y, m + 1, 1));
                            pTo = formatLocalDate(new Date(y, m + 2, 0));
                          } else if (p.id === 'this_quarter') {
                            const qStart = Math.floor(m / 3) * 3;
                            pFrom = formatLocalDate(new Date(y, qStart, 1));
                            pTo = formatLocalDate(new Date(y, qStart + 3, 0));
                          } else if (p.id === 'this_year') {
                            pFrom = formatLocalDate(new Date(y, 0, 1));
                            pTo = formatLocalDate(new Date(y, 11, 31));
                          }
                          const isSelected = Boolean(pFrom && admissionFrom === pFrom && admissionTo === pTo);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setAdmissionFrom('');
                                  setAdmissionTo('');
                                } else {
                                  setAdmissionFrom(pFrom);
                                  setAdmissionTo(pTo);
                                }
                              }}
                              style={{
                                padding: '6px 4px',
                                fontSize: '0.72rem',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '6px',
                                border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: 'var(--color-surface, #ffffff)',
                                color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                cursor: 'pointer'
                              }}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Từ ngày</label>
                          <input
                            type="date"
                            className="form-input"
                            value={admissionFrom}
                            onChange={e => setAdmissionFrom(e.target.value)}
                            style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Đến ngày</label>
                          <input
                            type="date"
                            className="form-input"
                            value={admissionTo}
                            onChange={e => setAdmissionTo(e.target.value)}
                            style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Lọc theo ngày */}
                    <div>
                      <div style={{ marginBottom: '0.75rem' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Lọc theo ngày</label>
                        <CustomSelect
                          value={dateField}
                          onChange={v => setDateField(v as any)}
                          options={[
                            { value: 'created_at', label: 'Ngày tạo' },
                            { value: 'updated_at', label: 'Ngày cập nhật' },
                            { value: 'last_contact', label: 'Ngày tương tác cuối' },
                            { value: 'admission_date', label: 'Ngày nhập học' },
                            { value: 'deposit_date', label: 'Ngày đặt cọc' },
                            { value: 'next_followup_date', label: 'Ngày hẹn gọi lại' },
                            { value: 'birthday', label: 'Sinh nhật' }
                          ]}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '8px' }}>
                        {[
                          { id: 'today', label: 'Hôm nay' },
                          { id: 'last_7_days', label: '7 ngày' },
                          { id: 'this_month', label: 'Tháng này' },
                          { id: 'last_30_days', label: '30 ngày' }
                        ].map(p => {
                          const isSel = dateFilterType === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                if (isSel) {
                                  setDateFilterType('');
                                  setFilterDateFrom('');
                                  setFilterDateTo('');
                                } else {
                                  const range = computeDateRange(p.id, '', '');
                                  setDateFilterType(p.id);
                                  setFilterDateFrom(range.from);
                                  setFilterDateTo(range.to);
                                }
                              }}
                              style={{
                                padding: '5px 4px',
                                fontSize: '0.72rem',
                                fontWeight: isSel ? 700 : 500,
                                borderRadius: '6px',
                                border: isSel ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: '#ffffff',
                                color: isSel ? 'var(--color-primary)' : 'var(--color-text)',
                                cursor: 'pointer'
                              }}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Từ ngày</label>
                          <input
                            type="date"
                            className="form-input"
                            value={filterDateFrom}
                            onChange={e => {
                              setFilterDateFrom(e.target.value);
                              setDateFilterType(e.target.value || filterDateTo ? 'custom' : '');
                            }}
                            style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Đến ngày</label>
                          <input
                            type="date"
                            className="form-input"
                            value={filterDateTo}
                            onChange={e => {
                              setFilterDateTo(e.target.value);
                              setDateFilterType(filterDateFrom || e.target.value ? 'custom' : '');
                            }}
                            style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Tiến trình & Trạng thái Lead */}
                  <div style={{
                    padding: '1.1rem',
                    borderRadius: '14px',
                    background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.875rem' }}>
                      <Layers size={16} color="var(--color-text, #0f172a)" /> Tiến trình & Trạng thái Lead
                    </div>

                    {/* Loại đối tượng */}
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Loại đối tượng</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                        {[
                          { id: 'contacts', label: 'Khách hàng / HV' },
                          { id: 'companies', label: 'Doanh nghiệp' },
                          { id: 'deals', label: 'Cơ hội (Deals)' }
                        ].map(opt => {
                          const isSelected = pipelineView === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setPipelineView(opt.id as any);
                                setPage(1);
                              }}
                              style={{
                                padding: '7px 8px',
                                fontSize: '0.76rem',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '8px',
                                border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: 'var(--color-surface, #ffffff)',
                                color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                cursor: 'pointer'
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Trạng thái Lead (Multi-select + Include/Exclude) */}
                    <div style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>Trạng thái Lead (Chọn nhiều)</label>
                        <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                          {([
                            { id: 'in', label: 'Bao gồm' },
                            { id: 'not_in', label: 'Loại trừ' }
                          ] as const).map(op => (
                            <button
                              key={op.id}
                              type="button"
                              onClick={() => setFilterLeadStatusOp(op.id)}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                fontWeight: filterLeadStatusOp === op.id ? 700 : 500,
                                border: 'none',
                                background: filterLeadStatusOp === op.id ? 'var(--color-primary)' : 'var(--color-surface)',
                                color: filterLeadStatusOp === op.id ? '#fff' : 'var(--color-text-muted)',
                                cursor: 'pointer'
                              }}
                            >
                              {op.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                        {[
                          { id: 'all', label: 'Tất cả', color: 'var(--color-primary)' },
                          { id: 'active', label: 'Hoạt động', color: '#10b981' },
                          { id: 'nurture', label: 'Nuôi dưỡng', color: '#d97706' },
                          { id: 'lost', label: 'Data Lost', color: '#ef4444' }
                        ].map(st => {
                          const selectedParts = csvToMulti(filterLeadStatus);
                          const isSelected = st.id === 'all'
                            ? selectedParts.includes('all')
                            : (st.id === 'active' && filterLeadStatus === '' ? true : selectedParts.includes(st.id));
                          return (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                if (st.id === 'all') {
                                  setFilterLeadStatus(selectedParts.includes('all') ? '' : 'all');
                                  return;
                                }
                                const current = selectedParts.filter(p => p !== 'all');
                                let next: string[];
                                if (current.includes(st.id)) {
                                  next = current.filter(p => p !== st.id);
                                } else {
                                  next = [...current, st.id];
                                }
                                setFilterLeadStatus(next.join(','));
                              }}
                              style={{
                                padding: '7px 6px',
                                fontSize: '0.76rem',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '8px',
                                border: isSelected ? `1.5px solid ${st.color}` : '1px solid var(--color-border)',
                                background: 'var(--color-surface, #ffffff)',
                                color: isSelected ? st.color : 'var(--color-text)',
                                cursor: 'pointer'
                              }}
                            >
                              {st.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Giai đoạn Pipeline (Multi-select + Include/Exclude) */}
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>Giai đoạn Pipeline (Chọn nhiều)</label>
                        <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                          {([
                            { id: 'in', label: 'Bao gồm' },
                            { id: 'not_in', label: 'Loại trừ' }
                          ] as const).map(op => (
                            <button
                              key={op.id}
                              type="button"
                              onClick={() => setFilterStageOp(op.id)}
                              style={{
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                fontWeight: filterStageOp === op.id ? 700 : 500,
                                border: 'none',
                                background: filterStageOp === op.id ? 'var(--color-primary)' : 'var(--color-surface)',
                                color: filterStageOp === op.id ? '#fff' : 'var(--color-text-muted)',
                                cursor: 'pointer'
                              }}
                            >
                              {op.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <CustomSelect
                        multiple={true}
                        placeholder="Tất cả giai đoạn"
                        options={ensureOptionsWithSelected(
                          stages.map(s => ({ value: String(s.id), label: s.name })),
                          filterStage
                        )}
                        value={csvToMulti(filterStage)}
                        onChange={v => {
                          const csv = multiToCsv(v);
                          setFilterStage(csv);
                          const arr = csvToMulti(csv);
                          setActiveStageFilter(arr.length === 1 ? (Number(arr[0]) || arr[0]) : 'all');
                        }}
                        searchable
                      />
                    </div>
                  </div>

                  {/* Card 3: Lịch sử Tương tác & Chăm sóc chuyên sâu */}
                  <div style={{
                    padding: '1.1rem',
                    borderRadius: '14px',
                    background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.875rem' }}>
                      <Clock size={16} color="var(--color-text, #0f172a)" /> Lịch sử Tương tác & Chăm sóc chuyên sâu
                    </div>

                    {/* Trạng thái tương tác */}
                    <div style={{ marginBottom: '0.875rem' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Trạng thái tương tác</label>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                        {[
                          { id: '', label: 'Tất cả' },
                          { id: 'uncontacted', label: 'Chưa liên hệ' },
                          { id: 'contacted', label: 'Đã liên hệ' }
                        ].map(opt => {
                          const isSelected = filterInteractionStatus === opt.id;
                          return (
                            <button
                              key={opt.id || 'all'}
                              type="button"
                              onClick={() => setFilterInteractionStatus(opt.id)}
                              style={{
                                padding: '7px 8px',
                                fontSize: '0.78rem',
                                fontWeight: isSelected ? 700 : 500,
                                borderRadius: '8px',
                                border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                background: 'var(--color-surface, #ffffff)',
                                color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                cursor: 'pointer'
                              }}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Stale days & Interacted within days */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Chưa tương tác quá (ngày)</label>
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          placeholder="VD: 3, 7, 14..."
                          value={staleDays}
                          onChange={e => setStaleDays(e.target.value)}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Có tương tác trong (ngày qua)</label>
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          placeholder="VD: 1, 7, 30..."
                          value={interactedWithinDays}
                          onChange={e => setInteractedWithinDays(e.target.value)}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                    </div>

                    {/* Kênh / Loại tương tác */}
                    <div style={{ marginBottom: '0.875rem' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Kênh / Loại tương tác (Chọn nhiều)</label>
                      <CustomSelect
                        multiple={true}
                        placeholder="Tất cả kênh tương tác"
                        options={ensureOptionsWithSelected(INTERACTION_TYPE_OPTIONS, interactionType)}
                        value={csvToMulti(interactionType)}
                        onChange={v => setInteractionType(multiToCsv(v))}
                        searchable
                      />
                    </div>

                    {/* Số lần gọi & Từ khóa ghi chú */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Số lần gọi tối thiểu</label>
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          placeholder="Từ (VD: 1)"
                          value={minCallCount}
                          onChange={e => setMinCallCount(e.target.value)}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Số lần gọi tối đa</label>
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          placeholder="Đến (VD: 5)"
                          value={maxCallCount}
                          onChange={e => setMaxCallCount(e.target.value)}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Từ khóa trong ghi chú chăm sóc</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Tìm nội dung trong lịch sử ghi chú / cuộc gọi..."
                        value={noteKeyword}
                        onChange={e => setNoteKeyword(e.target.value)}
                        style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                      />
                    </div>
                  </div>

                  {/* Card 4: Phụ trách & Nguồn dữ liệu */}
                  <div style={{
                    padding: '1.1rem',
                    borderRadius: '14px',
                    background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.875rem' }}>
                      <Users size={16} color="var(--color-text, #0f172a)" /> Phụ trách & Nguồn dữ liệu
                    </div>

                    {/* Sale phụ trách */}
                    {currentUser?.role !== 'sale' && currentUser?.role !== 'sales' && (
                      <div style={{ marginBottom: '0.875rem' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Sale phụ trách (Chọn nhiều)</label>
                        <CustomSelect
                          multiple={true}
                          placeholder="Tất cả Sale"
                          options={ensureOptionsWithSelected([
                            { value: 'unassigned', label: 'Chưa phân bổ (Kho chung)' },
                            ...allUsers.map(u => ({
                              value: String(u.id),
                              label: u.full_name,
                              avatar: u.avatar_url,
                              sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                            }))
                          ], filterAssignee)}
                          value={csvToMulti(filterAssignee)}
                          onChange={v => setFilterAssignee(multiToCsv(v))}
                          showAvatars
                          searchable
                        />
                      </div>
                    )}

                    {/* Đội nhóm Sale */}
                    {teams.length > 0 && !effectiveTeamId && (
                      <div style={{ marginBottom: '0.875rem' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Đội nhóm Sale (Chọn nhiều)</label>
                        <CustomSelect
                          multiple={true}
                          placeholder="Tất cả đội nhóm"
                          options={ensureOptionsWithSelected(
                            teams.map((t: any) => ({ value: String(t.id), label: t.name })),
                            filterTeam
                          )}
                          value={csvToMulti(filterTeam)}
                          onChange={v => setFilterTeam(multiToCsv(v))}
                          searchable
                        />
                      </div>
                    )}

                    {/* Dự án & Chiến dịch */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Chương trình / Dự án</label>
                        <CustomSelect
                          multiple={true}
                          placeholder="Tất cả chương trình"
                          options={ensureOptionsWithSelected(
                            projects.map(p => ({ value: String(p.id), label: p.name })),
                            filterProject
                          )}
                          value={csvToMulti(filterProject)}
                          onChange={v => {
                            setFilterProject(multiToCsv(v));
                            setFilterCampaign('');
                          }}
                          searchable
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Chiến dịch</label>
                        <CustomSelect
                          multiple={true}
                          placeholder="Tất cả chiến dịch"
                          options={ensureOptionsWithSelected(
                            filteredCampaigns.map(c => ({ value: String(c.id), label: c.name })),
                            filterCampaign
                          )}
                          value={csvToMulti(filterCampaign)}
                          onChange={v => setFilterCampaign(multiToCsv(v))}
                          searchable
                        />
                      </div>
                    </div>

                    {/* Nguồn & Phân loại Tag */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Nguồn khách hàng</label>
                        <CustomSelect
                          multiple={true}
                          placeholder="Tất cả nguồn"
                          options={ensureOptionsWithSelected(mergedSourceOptions, filterSource)}
                          value={csvToMulti(filterSource)}
                          onChange={v => setFilterSource(multiToCsv(v))}
                          searchable
                          allowCustomInput
                          customInputLabel="Thêm nguồn khác"
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Phân loại (Tag)</label>
                        <CustomSelect
                          multiple={true}
                          placeholder="Tất cả Tag"
                          options={ensureOptionsWithSelected(tagOptions, filterTag)}
                          value={csvToMulti(filterTag)}
                          onChange={v => setFilterTag(multiToCsv(v))}
                          searchable
                          allowCustomInput
                          customInputLabel="Thêm Tag cần lọc"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Nhân khẩu học, Học tập & Tài chính */}
                  <div style={{
                    padding: '1.1rem',
                    borderRadius: '14px',
                    background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.875rem' }}>
                      <Briefcase size={16} color="var(--color-text, #0f172a)" /> Nhân khẩu học, Học tập & Tài chính
                    </div>

                    {/* Giới tính & Tỉnh/Thành phố */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Giới tính</label>
                        <CustomSelect
                          value={gender}
                          onChange={v => setGender(v as string)}
                          options={[
                            { value: '', label: 'Tất cả giới tính' },
                            { value: 'Nam', label: 'Nam' },
                            { value: 'Nữ', label: 'Nữ' },
                            { value: 'Khác', label: 'Khác' }
                          ]}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Tỉnh / Thành phố</label>
                        <CustomSelect
                          multiple={true}
                          placeholder="Tất cả Tỉnh/TP"
                          options={ensureOptionsWithSelected(COMMON_CITY_OPTIONS, city)}
                          value={csvToMulti(city)}
                          onChange={v => setCity(multiToCsv(v))}
                          searchable
                          allowCustomInput
                          customInputLabel="Thêm Tỉnh/TP"
                        />
                      </div>
                    </div>

                    {/* Độ tuổi */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Độ tuổi từ</label>
                        <input
                          type="number"
                          min={0}
                          max={120}
                          className="form-input"
                          placeholder="VD: 18"
                          value={ageMin}
                          onChange={e => setAgeMin(e.target.value)}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Độ tuổi đến</label>
                        <input
                          type="number"
                          min={0}
                          max={120}
                          className="form-input"
                          placeholder="VD: 35"
                          value={ageMax}
                          onChange={e => setAgeMax(e.target.value)}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                    </div>

                    {/* Nghề nghiệp & Đơn vị/Trường học */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Nghề nghiệp / Chức danh</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="VD: Sinh viên, Kỹ sư..."
                          value={jobTitle}
                          onChange={e => setJobTitle(e.target.value)}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Công ty / Trường học</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="Tên trường hoặc đơn vị..."
                          value={company}
                          onChange={e => setCompany(e.target.value)}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                    </div>

                    {/* Tình trạng Tài chính / Đặt cọc & Khoảng tiền */}
                    <div style={{ marginBottom: '0.875rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Tình trạng Tài chính / Đặt cọc</label>
                      <CustomSelect
                        value={financialFilter}
                        onChange={v => setFinancialFilter(v as string)}
                        options={FINANCIAL_STATUS_OPTIONS}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Số tiền / Giá trị từ (VNĐ)</label>
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          placeholder="VD: 5000000"
                          value={minAmount}
                          onChange={e => setMinAmount(e.target.value)}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Số tiền / Giá trị đến (VNĐ)</label>
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          placeholder="VD: 50000000"
                          value={maxAmount}
                          onChange={e => setMaxAmount(e.target.value)}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                    </div>

                    {/* Tình trạng học vụ, Mã HV, Khóa dự kiến */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Tình trạng học vụ</label>
                        <CustomSelect
                          value={studyStatus}
                          onChange={v => setStudyStatus(v as string)}
                          options={[
                            { value: '', label: 'Tất cả' },
                            { value: 'studying', label: 'Đang học' },
                            { value: 'reserved', label: 'Bảo lưu' },
                            { value: 'completed', label: 'Hoàn thành' },
                            { value: 'dropped', label: 'Nghỉ học' }
                          ]}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Mã học viên</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="VD: HV001..."
                          value={studentCode}
                          onChange={e => setStudentCode(e.target.value)}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Khóa dự kiến</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="VD: K25, T10..."
                          value={expectedIntake}
                          onChange={e => setExpectedIntake(e.target.value)}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Card 5B: Hành trình số & Automation 360° */}
                  <div style={{
                    padding: '1.1rem',
                    borderRadius: '14px',
                    background: 'var(--color-bg-alt, rgba(37, 99, 235, 0.03))',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.875rem' }}>
                      <Sparkles size={15} color="#2563eb" /> Hành trình số & Automation 360°
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Tương tác số (Digital Engagement)</label>
                        <CustomSelect
                          value={engagementStatus || 'all'}
                          onChange={v => setEngagementStatus(v === 'all' ? '' : (v as string))}
                          options={[
                            { value: 'all', label: 'Tất cả tín hiệu' },
                            { value: 'email_opened', label: 'Đã mở Email (stats_email_opened > 0)' },
                            { value: 'email_clicked', label: 'Đã click link Email (stats_email_clicked > 0)' },
                            { value: 'web_visited_7d', label: 'Đã truy cập Web 7 ngày qua' },
                            { value: 'survey_completed', label: 'Đã làm Khảo sát / Quiz' },
                            { value: 'voucher_issued', label: 'Đang có Voucher' }
                          ]}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Luồng Automation</label>
                        <CustomSelect
                          value={automationFlow || 'all'}
                          onChange={v => setAutomationFlow(v === 'all' ? '' : (v as string))}
                          options={[
                            { value: 'all', label: 'Tất cả luồng' },
                            { value: 'active_any', label: 'Đang chạy bất kỳ luồng nào' },
                            { value: 'completed_any', label: 'Đã hoàn thành luồng' },
                            { value: 'none', label: 'Chưa vào luồng' }
                          ]}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Trạng thái Voucher</label>
                        <CustomSelect
                          value={voucherStatus || 'all'}
                          onChange={v => setVoucherStatus(v === 'all' ? '' : (v as string))}
                          options={[
                            { value: 'all', label: 'Tất cả' },
                            { value: 'has_active', label: 'Có Voucher chưa dùng' },
                            { value: 'redeemed', label: 'Đã sử dụng Voucher' },
                            { value: 'none', label: 'Chưa cấp Voucher' }
                          ]}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Điểm Tương Tác Số (Engagement)</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          <input
                            type="number"
                            min={0}
                            className="form-input"
                            placeholder="Từ điểm..."
                            value={minEngagementScore}
                            onChange={e => setMinEngagementScore(e.target.value)}
                            style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                          />
                          <input
                            type="number"
                            min={0}
                            className="form-input"
                            placeholder="Đến..."
                            value={maxEngagementScore}
                            onChange={e => setMaxEngagementScore(e.target.value)}
                            style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card 6: Bộ lọc theo trường dữ liệu (100% DB Schema) */}
                  <div style={{
                    padding: '1.1rem',
                    borderRadius: '14px',
                    background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                    border: '1px solid var(--color-border-light)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        <BarChart3 size={16} color="var(--color-text, #0f172a)" /> Bộ lọc theo trường dữ liệu (100% DB Schema)
                      </div>

                      <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        {([
                          { id: 'AND', label: 'Thỏa tất cả (AND)' },
                          { id: 'OR', label: 'Thỏa một trong (OR)' }
                        ] as const).map(lg => (
                          <button
                            key={lg.id}
                            type="button"
                            onClick={() => setCustomRulesLogic(lg.id)}
                            style={{
                              padding: '3px 8px',
                              fontSize: '0.7rem',
                              fontWeight: customRulesLogic === lg.id ? 700 : 500,
                              border: 'none',
                              background: customRulesLogic === lg.id ? 'var(--color-primary)' : 'var(--color-surface)',
                              color: customRulesLogic === lg.id ? '#fff' : 'var(--color-text-muted)',
                              cursor: 'pointer'
                            }}
                          >
                            {lg.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {customRules.length === 0 ? (
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                        Chưa có điều kiện tùy chỉnh. Bấm nút bên dưới để lọc bất kỳ trường dữ liệu nào trong bảng khách hàng (CCCD, hộ chiếu, điểm GPA/IELTS, quận/huyện, người giới thiệu...).
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '0.75rem' }}>
                        {customRules.map((rule, idx) => {
                          const hideValue = rule.operator === 'is_empty' || rule.operator === 'is_not_empty';
                          return (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '6px',
                                padding: '8px',
                                borderRadius: '10px',
                                background: 'var(--color-surface, #ffffff)',
                                border: '1px solid var(--color-border)'
                              }}
                            >
                              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '6px', alignItems: 'center' }}>
                                <CustomSelect
                                  value={rule.field}
                                  onChange={v => {
                                    const next = [...customRules];
                                    next[idx] = { ...next[idx], field: v as string };
                                    setCustomRules(next);
                                  }}
                                  options={CONTACT_SCHEMA_FIELDS}
                                  searchable
                                />
                                <CustomSelect
                                  value={rule.operator}
                                  onChange={v => {
                                    const next = [...customRules];
                                    next[idx] = { ...next[idx], operator: v as string };
                                    setCustomRules(next);
                                  }}
                                  options={SCHEMA_OPERATORS}
                                />
                                <button
                                  type="button"
                                  onClick={() => setCustomRules(customRules.filter((_, i) => i !== idx))}
                                  title="Xóa điều kiện"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--color-border)',
                                    background: 'transparent',
                                    color: 'var(--color-danger, #ef4444)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                              {!hideValue && (
                                <input
                                  type="text"
                                  className="form-input"
                                  placeholder={rule.operator === 'in' || rule.operator === 'not_in' ? 'Nhập danh sách giá trị, cách nhau bằng dấu phẩy...' : 'Nhập giá trị cần đối chiếu...'}
                                  value={rule.value}
                                  onChange={e => {
                                    const next = [...customRules];
                                    next[idx] = { ...next[idx], value: e.target.value };
                                    setCustomRules(next);
                                  }}
                                  style={{ height: '34px', fontSize: '0.8rem', borderRadius: '8px' }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => setCustomRules([...customRules, { field: 'full_name', operator: 'contains', value: '' }])}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px dashed var(--color-primary)',
                        background: 'rgba(189, 29, 45, 0.04)',
                        color: 'var(--color-primary)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Plus size={14} /> Thêm điều kiện lọc trường dữ liệu
                    </button>
                  </div>
                </div>

                {/* Drawer Footer */}
                <div style={{
                  padding: '1rem 1.5rem',
                  borderTop: '1px solid var(--color-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--color-surface)',
                  gap: '0.75rem'
                }}>
                  <button
                    type="button"
                    className="btn outline"
                    onClick={handleClearFilters}
                    style={{ borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Đặt lại
                  </button>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn outline"
                      onClick={() => setShowFilterPanel(false)}
                      style={{ borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem' }}
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      className="btn primary"
                      onClick={() => setShowFilterPanel(false)}
                      style={{ borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <CheckCircle2 size={16} /> Áp dụng bộ lọc
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {viewMode === 'list' && (
        <div 
          className="custom-scrollbar" 
          style={{ 
            display: 'flex', 
            gap: '0.25rem', 
            overflowX: 'auto', 
            padding: '4px 6px 12px 6px', 
            alignItems: 'center',
            background: 'var(--color-bg-light)',
            borderRadius: '10px',
            border: '1px solid var(--color-border)',
            marginBottom: '1rem'
          }}
        >
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', paddingLeft: '10px', paddingRight: '6px' }}>Giai đoạn:</span>
          
          <button
            onClick={() => {
              setActiveStageFilter('all');
              setFilterStage('');
            }}
            style={{
              padding: '6px 14px', 
              borderRadius: '6px', 
              fontSize: '0.8125rem', 
              fontWeight: 700, 
              cursor: 'pointer', 
              whiteSpace: 'nowrap', 
              transition: 'all 0.2s',
              border: activeStageFilter === 'all' ? '1px solid var(--color-text)' : '1px solid var(--color-border)',
              background: activeStageFilter === 'all' ? 'var(--color-text)' : 'var(--color-surface)',
              color: activeStageFilter === 'all' ? 'var(--color-surface)' : 'var(--color-text)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: activeStageFilter === 'all' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
            }}
          >
            Tất cả ({total})
          </button>

          <div style={{ width: '1px', height: '22px', background: 'var(--color-border)', margin: '0 0.5rem', flexShrink: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'nowrap' }}>
            {stages.map((stage, idx) => {
              const count = stageTotals[stage.id] !== undefined ? stageTotals[stage.id] : (filteredItems[stage.id] || []).length;
              const isActive = String(activeStageFilter) === String(stage.id);
              const isNewLead = isNewLeadStage(stage);
              return (
                <React.Fragment key={stage.id}>
                  {idx > 0 && (
                    <ChevronRight size={14} style={{ color: 'var(--color-text-muted)', opacity: 0.6, flexShrink: 0 }} />
                  )}
                  <button
                    onClick={() => {
                      if (isActive) {
                        setActiveStageFilter('all');
                        setFilterStage('');
                      } else {
                        setActiveStageFilter(stage.id);
                        setFilterStage(String(stage.id));
                      }
                    }}
                    style={{
                      padding: '6px 14px', 
                      borderRadius: '6px', 
                      fontSize: '0.8125rem', 
                      fontWeight: 700, 
                      cursor: 'pointer', 
                      whiteSpace: 'nowrap', 
                      transition: 'all 0.2s',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      opacity: count === 0 && !isActive ? 0.55 : 1,
                      border: `1px solid ${isActive ? (isNewLead ? '#dc2626' : (stage.color || 'var(--color-primary)')) : 'var(--color-border)'}`,
                      background: isActive ? (isNewLead ? '#dc262615' : `${stage.color || 'var(--color-primary)'}12`) : 'var(--color-surface)',
                      color: isActive ? (isNewLead ? '#dc2626' : (stage.color || 'var(--color-text)')) : 'var(--color-text-light)',
                      boxShadow: isActive ? `0 2px 4px ${stage.color || 'var(--color-primary)'}15` : 'none'
                    }}
                  >
                    <span 
                      style={{ 
                        width: '8px', 
                        height: '8px', 
                        borderRadius: '50%', 
                        background: isNewLead ? '#dc2626' : (stage.color || 'var(--color-primary)'),
                        display: 'inline-block',
                        flexShrink: 0
                      }} 
                    />
                    {stage.name}
                    <span 
                      style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 700, 
                        color: isNewLead ? '#ffffff' : (isActive ? 'inherit' : 'var(--color-text-muted)'),
                        background: isNewLead ? '#dc2626' : (isActive ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.04)'),
                        padding: '1px 6px',
                        borderRadius: '99px',
                        marginLeft: '2px',
                        boxShadow: isNewLead ? '0 2px 5px rgba(220,38,38,0.3)' : 'none'
                      }}
                    >
                      {count}
                    </span>
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {isMobile && viewMode === 'kanban' && (
        <div className="no-scrollbar" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', padding: '0.75rem 1rem', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border-light)', marginBottom: '0.75rem', flexShrink: 0 }}>
          {stages.map(stage => {
            const isActive = activeStageMobile === stage.id;
            const count = stageTotals[stage.id] ?? (filteredItems[stage.id] || []).length;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStageMobile(stage.id)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '99px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  border: `1px solid ${isActive ? stage.color || 'var(--color-primary)' : 'var(--color-border)'}`,
                  background: isActive ? `${stage.color || 'var(--color-primary)'}15` : 'var(--color-surface)',
                  color: isActive ? stage.color || 'var(--color-primary)' : 'var(--color-text-light)',
                }}
              >
                {stage.name} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area */}
      {viewMode === 'kanban' ? (
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {!isMobile && (
            <>
              <button
                className="no-active-scale"
                onClick={() => scrollKanban('left')}
                disabled={!canScrollLeft}
                title="Cuộn sang trái"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 15,
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: canScrollLeft ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(8px)',
                  border: canScrollLeft ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)',
                  boxShadow: canScrollLeft ? '0 4px 14px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canScrollLeft ? 'pointer' : 'not-allowed',
                  color: canScrollLeft ? 'var(--color-text)' : 'var(--color-text-muted)',
                  opacity: canScrollLeft ? 0.9 : 0.35,
                  pointerEvents: canScrollLeft ? 'auto' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                className="no-active-scale"
                onClick={() => scrollKanban('right')}
                disabled={!canScrollRight}
                title="Cuộn sang phải"
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 15,
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: canScrollRight ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.4)',
                  backdropFilter: 'blur(8px)',
                  border: canScrollRight ? '1px solid var(--color-border)' : '1px solid var(--color-border-light)',
                  boxShadow: canScrollRight ? '0 4px 14px rgba(0,0,0,0.1)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: canScrollRight ? 'pointer' : 'not-allowed',
                  color: canScrollRight ? 'var(--color-text)' : 'var(--color-text-muted)',
                  opacity: canScrollRight ? 0.9 : 0.35,
                  pointerEvents: canScrollRight ? 'auto' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <div
            ref={kanbanScrollRef}
            onScroll={() => {
              updateScrollState();
              setHoveredCard(null);
            }}
            className="card custom-scrollbar"
            style={{ 
              display: 'flex', 
              gap: isMobile ? '0.75rem' : '1.25rem', 
              overflowX: 'auto', 
              padding: isMobile ? '0.75rem' : '1.25rem', 
              paddingBottom: '1.5rem', 
              height: 'calc(100vh - 260px)',
              minHeight: '500px',
              flex: 1, 
              alignItems: 'stretch', 
              scrollSnapType: 'x mandatory',
              background: `
                linear-gradient(to right, var(--color-surface) 30%, transparent),
                linear-gradient(to left, var(--color-surface) 30%, transparent) 100% 0,
                linear-gradient(to right, rgba(0, 0, 0, 0.08), transparent),
                linear-gradient(to left, rgba(0, 0, 0, 0.08), transparent) 100% 0
              `,
              backgroundRepeat: 'no-repeat',
              backgroundSize: '32px 100%, 32px 100%, 12px 100%, 12px 100%',
              backgroundAttachment: 'local, local, scroll, scroll'
            }}
          >
            {loading ? (
              <>
                {(isMobile ? [1] : [1, 2, 3, 4]).map(i => (
                  <div key={i} style={{ minWidth: isMobile ? '100%' : 320, width: isMobile ? '100%' : 320, flexShrink: 0, background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border-light)', overflow: 'hidden', height: '100%' }}>
                    <div style={{ padding: '1rem 1.25rem', borderBottom: '3px solid var(--color-border)' }}>
                      <div style={{ height: 18, width: 120, background: '#e9ecef', borderRadius: 6, marginBottom: 8 }} />
                      <div style={{ height: 14, width: 60, background: '#f1f3f5', borderRadius: 6 }} />
                    </div>
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {[1, 2].map(j => (
                        <div key={j} style={{ background: '#f8f9fa', borderRadius: 'var(--radius-lg)', padding: '1.25rem', animation: 'pulse 1.5s ease-in-out infinite' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
                            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#e9ecef' }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ height: 14, width: '70%', background: '#dee2e6', borderRadius: 4, marginBottom: 6 }} />
                              <div style={{ height: 11, width: '50%', background: '#e9ecef', borderRadius: 4 }} />
                            </div>
                          </div>
                          <div style={{ height: 11, width: '60%', background: '#e9ecef', borderRadius: 4, marginBottom: 6 }} />
                          <div style={{ height: 11, width: '80%', background: '#e9ecef', borderRadius: 4 }} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            ) : stages.map(stage => {
              if (isMobile && activeStageMobile !== stage.id) return null;
              const stageItems = filteredItems[stage.id] || [];
              const stageRev = stageItems.reduce((s, d) => s + (Number(d.expected_revenue) || Number(d.value) || 0), 0);
              const totalInStage = stageTotals[stage.id] ?? stageItems.length;
              const visibleLimit = stageVisibleLimits[stage.id] || 15;
              const visibleStageItems = stageItems.slice(0, visibleLimit);
              const hasMore = totalInStage > visibleStageItems.length;
              const isNewLeadCol = isNewLeadStage(stage);

              return (
                <div key={stage.id}
                  style={{ 
                    minWidth: isMobile ? '100%' : 320, width: isMobile ? '100%' : 320, flexShrink: 0, 
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex', flexDirection: 'column', maxHeight: '100%', height: '100%',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    scrollSnapAlign: 'center'
                  }}
                  onDragOver={e => { 
                    e.preventDefault(); 
                    e.currentTarget.style.background = 'var(--color-primary-light)'; 
                    e.currentTarget.style.border = '2px dashed var(--color-primary)';
                    e.currentTarget.style.transform = 'scale(1.01)';
                  }}
                  onDragLeave={e => { 
                    e.currentTarget.style.background = 'var(--color-surface)'; 
                    e.currentTarget.style.border = '1px solid var(--color-border)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                  onDrop={e => { 
                    e.currentTarget.style.background = 'var(--color-surface)'; 
                    e.currentTarget.style.border = '1px solid var(--color-border)';
                    e.currentTarget.style.transform = 'scale(1)';
                    handleDrop(stage.id); 
                  }}
                >
                  {/* Stage Header */}
                  <div style={{ padding: '1rem 1.25rem', borderBottom: `3px solid ${isNewLeadCol ? '#dc2626' : (stage.color || 'var(--color-primary)')}`, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)' }}>{stage.name}</h3>
                        <span style={isNewLeadCol ? {
                          background: '#dc2626',
                          color: '#ffffff',
                          padding: '2px 8px',
                          borderRadius: '99px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          boxShadow: '0 2px 6px rgba(220,38,38,0.35)'
                        } : {
                          background: 'var(--color-bg)',
                          color: 'var(--color-text-muted)',
                          padding: '2px 8px',
                          borderRadius: '99px',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}>
                          {totalInStage}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', fontWeight: 600 }}>
                      {FMT(stageRevenues[stage.id] ?? stageRev)}
                    </div>
                  </div>

                  {/* Cards Container */}
                  <div
                    style={{ padding: '0.875rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
                    onScroll={(e) => {
                      setHoveredCard(null);
                      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
                      if (scrollHeight - scrollTop - clientHeight < 60 && hasMore && !loadingMoreStage[stage.id]) {
                        handleLoadMoreStage(stage.id);
                      }
                    }}
                  >
                    <AnimatePresence>
                      {visibleStageItems.map(item => {
                        const itemName = pipelineView === 'contacts' ? (item.full_name || '').trim() : (pipelineView === 'companies' ? item.name : item.title);
                        const isItemOwner = Number(currentUser?.id) === Number(item.owner_id || item.created_by);
                        const isPrivileged = currentUser?.role && ['admin', 'superadmin', 'super_admin', 'manager', 'director', 'assistant'].includes(currentUser.role);
                        const canDrag = (isItemOwner || isPrivileged) && currentUser?.role !== 'viewer';
                        const cardProgram = (item.program || item.project_name || '').trim();
                        const cardAdmission = formatAdmissionDate(item.admission_date);
                        const cardTags = parseCardTags(item.tags);
                        const cardNote = cleanNoteText(item.last_interaction) || cleanNoteText(item.notes);
                        const hasOmniSignals = Boolean(
                          item.last_web_visit_at ||
                          Number(item.web_pageviews_count || 0) > 0 ||
                          Number(item.stats_email_opened || 0) > 0 ||
                          Number(item.active_flow_count || 0) > 0 ||
                          item.active_voucher_code ||
                          Number(item.survey_completed_count || 0) > 0 ||
                          Number(item.engagement_score || 0) > 0
                        );
                        const openJourney360 = (e: React.MouseEvent) => {
                          e.stopPropagation();
                          setHoveredCard(null);
                          setSelectedContactInitialTab('journey360');
                          setSelectedContact(item);
                          setShowContactDrawer(true);
                        };

                        return (
                        <motion.div key={item.id}
                          draggable={canDrag}
                          onDragStart={() => {
                            setHoveredCard(null);
                            if (canDrag) setDragging({ id: item.id, fromStage: stage.id });
                          }}
                          onDragEnd={() => setDragging(null)}
                          onMouseEnter={(e) => {
                            if (!isMobile) {
                              setHoveredCard({ item, stage, rect: e.currentTarget.getBoundingClientRect() });
                            }
                          }}
                          onMouseLeave={() => setHoveredCard(null)}
                          initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                          style={{ 
                            background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '0.85rem 0.95rem', 
                            boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-border-light)', 
                            cursor: canDrag ? 'grab' : 'default', userSelect: 'none', position: 'relative'
                          }}
                          onClick={() => {
                            setHoveredCard(null);
                            if (pipelineView === 'deals') { setSelectedDeal(item); setShowDealDrawer(true); }
                            else if (pipelineView === 'contacts') { setSelectedContactInitialTab('info'); setSelectedContact(item); setShowContactDrawer(true); }
                            else { setSelectedCompany(item); setShowCompanyDrawer(true); }
                          }}
                          whileHover={{ y: -2, boxShadow: '0 8px 16px rgba(0,0,0,0.08)' }}
                          whileTap={{ cursor: 'grabbing' }}
                        >
                          {/* Header: Avatar and Name */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.65rem' }}>
                            <Avatar name={itemName} src={item.avatar_url} size={36} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <h4 style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-text)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {itemName || 'Chưa đặt tên'}
                              </h4>
                              {item.company_name && (
                                <p style={{ fontSize: '0.72rem', color: 'var(--color-text-light)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                                  <Building2 size={11} style={{ flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.company_name}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          
                          {/* Body: Contact Info */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.65rem' }}>
                            {item.phone && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                                <Phone size={12} style={{ color: 'var(--color-text-light)', flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: 'var(--color-text)' }}>{item.phone}</span>
                              </div>
                            )}
                            {item.email && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                                <Mail size={12} style={{ color: 'var(--color-text-light)', flexShrink: 0 }} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.email}</span>
                              </div>
                            )}
                          </div>

                          {/* Rich Compact Badges: Program, Admission Date, Tags */}
                          {(cardProgram || cardAdmission || cardTags.length > 0) && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '0.65rem' }}>
                              {cardProgram && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  background: 'rgba(37, 99, 235, 0.1)',
                                  color: '#2563eb',
                                  maxWidth: '100%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  <GraduationCap size={11} style={{ flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cardProgram}</span>
                                </span>
                              )}
                              {cardAdmission && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 7px',
                                  borderRadius: '6px',
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  background: 'rgba(16, 185, 129, 0.1)',
                                  color: '#059669',
                                  whiteSpace: 'nowrap'
                                }}>
                                  <Calendar size={11} style={{ flexShrink: 0 }} />
                                  <span>{cardAdmission}</span>
                                </span>
                              )}
                              {cardTags.slice(0, 3).map((tag, idx) => (
                                <span key={idx} style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontSize: '0.66rem',
                                  fontWeight: 600,
                                  background: 'rgba(100, 116, 139, 0.12)',
                                  color: 'var(--color-text)',
                                  maxWidth: '140px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  #{tag}
                                </span>
                              ))}
                              {cardTags.length > 3 && (
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontSize: '0.66rem',
                                  fontWeight: 700,
                                  background: 'rgba(59, 130, 246, 0.12)',
                                  color: '#2563eb'
                                }}>
                                  +{cardTags.length - 3}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Omnichannel Signal Pills */}
                          {hasOmniSignals && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '0.65rem' }}>
                              {(item.last_web_visit_at || Number(item.web_pageviews_count || 0) > 0) && (
                                <span
                                  onClick={openJourney360}
                                  title="Xem phiên truy cập Web trong Hành trình 360°"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 }}
                                >
                                  <Globe size={9} />
                                  Web ({item.web_pageviews_count || 1})
                                </span>
                              )}
                              {Number(item.stats_email_opened || 0) > 0 && (
                                <span
                                  onClick={openJourney360}
                                  title="Xem lịch sử mở & click Email trong Hành trình 360°"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 }}
                                >
                                  <Mail size={9} />
                                  Mở: {item.stats_email_opened}{Number(item.stats_email_clicked || 0) > 0 ? ` • Click: ${item.stats_email_clicked}` : ''}
                                </span>
                              )}
                              {Number(item.active_flow_count || 0) > 0 && (
                                <span
                                  onClick={openJourney360}
                                  title={item.active_flow_names ? `Đang chạy Flow: ${item.active_flow_names}` : 'Xem luồng Automation đang chạy'}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 }}
                                >
                                  <GitBranch size={9} />
                                  Flow ({item.active_flow_count})
                                </span>
                              )}
                              {item.active_voucher_code && (
                                <span
                                  onClick={openJourney360}
                                  title={`Mã Voucher: ${item.active_voucher_code}`}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 }}
                                >
                                  <Ticket size={9} />
                                  {item.active_voucher_code}
                                </span>
                              )}
                              {Number(item.survey_completed_count || 0) > 0 && (
                                <span
                                  onClick={openJourney360}
                                  title="Xem câu trả lời Khảo sát / Quiz"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 }}
                                >
                                  <ClipboardList size={9} />
                                  KS ({item.survey_completed_count})
                                </span>
                              )}
                              {Number(item.engagement_score || 0) > 0 && (
                                <span
                                  onClick={openJourney360}
                                  title="Điểm tương tác số Omnichannel"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 }}
                                >
                                  <Flame size={9} />
                                  +{item.engagement_score} pts
                                </span>
                              )}
                            </div>
                          )}

                          {/* Recent Interaction / Note Preview Box */}
                          {cardNote && (
                            <div style={{
                              marginBottom: '0.65rem',
                              padding: '6px 8px',
                              borderRadius: '8px',
                              background: 'var(--color-bg-alt, rgba(0,0,0,0.03))',
                              fontSize: '0.73rem',
                              color: 'var(--color-text-muted)',
                              lineHeight: 1.35,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '5px'
                            }}>
                              <MessageSquare size={12} style={{ flexShrink: 0, marginTop: '2px', color: 'var(--color-text-light)' }} />
                              <span style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                wordBreak: 'break-word'
                              }}>
                                {cardNote}
                              </span>
                            </div>
                          )}
                          
                          {/* Footer: Pipeline Update Time & Owner */}
                          <div style={{ borderTop: '1px dashed var(--color-border)', paddingTop: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-text-light)' }} title="Cập nhật Pipeline lần cuối">
                               <Clock size={12} />
                               <span>{item.updated_at ? item.updated_at.substring(0,10) : (item.created_at?.substring(0,10) || '')}</span>
                             </div>
                             <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--color-text-muted)' }} title={item.owner_name || 'Sale phụ trách'}>
                               <Avatar name={item.owner_name} src={item.owner_avatar} size={16} />
                               <span>{item.owner_name?.split(' ').pop() || 'Sale'}</span>
                              </div>
                           </div>
                           {isMobile && (
                             <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--color-border-light)', paddingTop: '0.5rem' }}>
                               <button
                                 className="btn outline sm"
                                 style={{ width: '100%', height: '32px', fontSize: '0.75rem', padding: '0 8px', borderRadius: '8px', fontWeight: 700 }}
                                 onClick={(e) => {
                                   e.stopPropagation();
                                   setStagePickerItem({ id: item.id, fromStageId: stage.id });
                                 }}
                               >
                                 Chuyển giai đoạn...
                               </button>
                             </div>
                           )}
                         </motion.div>
                       )})}
                    </AnimatePresence>
                    {hasMore && (
                      <button
                        className="btn ghost sm"
                        disabled={Boolean(loadingMoreStage[stage.id])}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          color: 'var(--color-primary)',
                          background: 'var(--color-primary-light, rgba(59, 130, 246, 0.08))',
                          border: '1px dashed var(--color-primary)',
                          borderRadius: '8px',
                          cursor: loadingMoreStage[stage.id] ? 'wait' : 'pointer',
                          marginTop: '0.25rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                        onClick={() => handleLoadMoreStage(stage.id)}
                      >
                        {loadingMoreStage[stage.id] && <Loader2 size={13} className="spin" />}
                        <span>
                          {loadingMoreStage[stage.id]
                            ? 'Đang tải thêm thẻ...'
                            : `Xem thêm thẻ (Còn ${Math.max(0, totalInStage - visibleStageItems.length)} thẻ)`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card-panel" style={{ flex: 1, overflow: 'auto', background: 'var(--color-surface)', padding: 0 }}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center" style={{ minHeight: 300 }}><Loader2 className="spin" size={32} /></div>
          ) : (
            <table className="table" style={{ width: '100%', minWidth: 960 }}>
              <thead>
                <tr style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)' }}>
                  <th style={{ width: 44, padding: '0.85rem 1rem', borderBottom: '1px solid var(--color-border)' }}>
                    <CustomCheckbox checked={pagedItems.every(item => selected.has(item.id)) && pagedItems.length > 0} onChange={togglePageAll} />
                  </th>
                  {visibleColsMap['name'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Họ tên / Khách hàng
                    </th>
                  )}
                  {visibleColsMap['contact'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Liên hệ (SĐT / Email)
                    </th>
                  )}
                  {visibleColsMap['program'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Tên chương trình
                    </th>
                  )}
                  {visibleColsMap['admission_date'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Ngày nhập học
                    </th>
                  )}
                  {visibleColsMap['stage'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Trạng thái Pipeline
                    </th>
                  )}
                  {visibleColsMap['last_interaction'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Tương tác gần nhất / Ghi chú
                    </th>
                  )}
                  {visibleColsMap['tags'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Phân loại (Tags)
                    </th>
                  )}
                  {visibleColsMap['value'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Dự kiến doanh thu
                    </th>
                  )}
                  {visibleColsMap['total_deposit'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Thực thu / Đã cọc
                    </th>
                  )}
                  {visibleColsMap['owner'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Sale phụ trách
                    </th>
                  )}
                  {visibleColsMap['source'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Nguồn dữ liệu
                    </th>
                  )}
                  {visibleColsMap['campaign'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Chiến dịch
                    </th>
                  )}
                  {visibleColsMap['company'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Công ty
                    </th>
                  )}
                  {visibleColsMap['created_at'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Ngày tạo
                    </th>
                  )}
                  {visibleColsMap['updated_at'] && (
                    <th style={{ padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Ngày cập nhật
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pagedItems.map(item => {
                  const itemName = pipelineView === 'contacts' ? (item.full_name || '').trim() : (pipelineView === 'companies' ? item.name : item.title);
                  const stage = stages.find(s => String(s.id) === String(item.stage_id));
                  const isNewLead = isNewLeadStage(stage) || /^01\b|new\s*lead/i.test(String(item.stage_name || ''));
                  const progName = (item.program || item.project_name || '').trim();
                  const admStr = formatAdmissionDate(item.admission_date);
                  const rowTags = parseCardTags(item.tags);
                  const noteStr = cleanNoteText(item.last_interaction) || cleanNoteText(item.notes);
                  const hasOmniSignals = Boolean(
                    item.last_web_visit_at ||
                    Number(item.web_pageviews_count || 0) > 0 ||
                    Number(item.stats_email_opened || 0) > 0 ||
                    Number(item.active_flow_count || 0) > 0 ||
                    item.active_voucher_code ||
                    Number(item.survey_completed_count || 0) > 0 ||
                    Number(item.engagement_score || 0) > 0
                  );
                  const openJourney360 = (e: React.MouseEvent) => {
                    e.stopPropagation();
                    setHoveredCard(null);
                    setSelectedContactInitialTab('journey360');
                    setSelectedContact(item);
                    setShowContactDrawer(true);
                  };

                  return (
                    <tr 
                      key={item.id} 
                      onMouseEnter={(e) => {
                        if (!isMobile) {
                          setHoveredCard({ item, stage, rect: e.currentTarget.getBoundingClientRect() });
                        }
                      }}
                      onMouseLeave={() => setHoveredCard(null)}
                      onClick={() => {
                        setHoveredCard(null);
                        if (pipelineView === 'contacts') { setSelectedContactInitialTab('info'); setSelectedContact(item); setShowContactDrawer(true); }
                        else if (pipelineView === 'companies') { setSelectedCompany(item); setShowCompanyDrawer(true); }
                        else { setSelectedDeal(item); setShowDealDrawer(true); }
                      }}
                      className="table-row-hover"
                      style={{ cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}
                    >
                      <td style={{ padding: '0.85rem 1rem' }} onClick={e => e.stopPropagation()}>
                        <CustomCheckbox checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} />
                      </td>
                      {visibleColsMap['name'] && (
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <Avatar name={itemName} src={item.avatar_url} size={32} />
                            <div>
                              <p style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '0.85rem' }}>{itemName || '—'}</p>
                              {item.company_name && <p style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>{item.company_name}</p>}
                              {hasOmniSignals && (
                                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                  {(item.last_web_visit_at || Number(item.web_pageviews_count || 0) > 0) && (
                                    <span
                                      onClick={openJourney360}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 }}
                                    >
                                      <Globe size={9} />
                                      Web ({item.web_pageviews_count || 1})
                                    </span>
                                  )}
                                  {Number(item.stats_email_opened || 0) > 0 && (
                                    <span
                                      onClick={openJourney360}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 }}
                                    >
                                      <Mail size={9} />
                                      Mở: {item.stats_email_opened}
                                    </span>
                                  )}
                                  {Number(item.active_flow_count || 0) > 0 && (
                                    <span
                                      onClick={openJourney360}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 }}
                                    >
                                      <GitBranch size={9} />
                                      Flow ({item.active_flow_count})
                                    </span>
                                  )}
                                  {item.active_voucher_code && (
                                    <span
                                      onClick={openJourney360}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 }}
                                    >
                                      <Ticket size={9} />
                                      {item.active_voucher_code}
                                    </span>
                                  )}
                                  {Number(item.survey_completed_count || 0) > 0 && (
                                    <span
                                      onClick={openJourney360}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 }}
                                    >
                                      <ClipboardList size={9} />
                                      KS ({item.survey_completed_count})
                                    </span>
                                  )}
                                  {Number(item.engagement_score || 0) > 0 && (
                                    <span
                                      onClick={openJourney360}
                                      style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '1px 5px', borderRadius: '4px', background: 'var(--color-bg-subtle, rgba(0,0,0,0.03))', color: 'var(--color-text-muted, #64748b)', border: '1px solid var(--color-border, rgba(0,0,0,0.08))', fontSize: '0.6rem', fontWeight: 600, cursor: 'pointer', lineHeight: 1.2 }}
                                    >
                                      <Flame size={9} />
                                      +{item.engagement_score} pts
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      )}
                      {visibleColsMap['contact'] && (
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          {item.phone && <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}><Phone size={12} className="text-light"/> {item.phone}</div>}
                          {item.email && <div style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}><Mail size={12} className="text-light"/> {item.email}</div>}
                          {!item.phone && !item.email && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>}
                        </td>
                      )}
                      {visibleColsMap['program'] && (
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          {progName ? (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: '6px',
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              background: 'rgba(37, 99, 235, 0.08)',
                              color: '#2563eb'
                            }}>
                              <GraduationCap size={12} style={{ flexShrink: 0 }} />
                              <span>{progName}</span>
                            </span>
                          ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>}
                        </td>
                      )}
                      {visibleColsMap['admission_date'] && (
                        <td style={{ padding: '0.85rem 0.75rem', whiteSpace: 'nowrap' }}>
                          {admStr ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>
                              <Calendar size={12} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                              <span>{admStr}</span>
                            </span>
                          ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>}
                        </td>
                      )}
                      {visibleColsMap['stage'] && (
                        <td style={{ padding: '0.85rem 0.75rem', whiteSpace: 'nowrap' }}>
                          <span style={isNewLead ? {
                            background: '#dc2626',
                            color: '#ffffff',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 99,
                            fontSize: 11,
                            display: 'inline-flex',
                            alignItems: 'center'
                          } : {
                            padding: '4px 10px',
                            borderRadius: '99px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: stage ? `${stage.color || 'var(--color-primary)'}15` : 'var(--color-bg)',
                            color: stage ? stage.color || 'var(--color-primary)' : 'var(--color-text-muted)'
                          }}>
                            {stage?.name || item.stage_name || '01 – New Lead'}
                          </span>
                        </td>
                      )}
                      {visibleColsMap['last_interaction'] && (
                        <td style={{ padding: '0.85rem 0.75rem', maxWidth: 260 }}>
                          {noteStr ? (
                            <div style={{
                              fontSize: '0.76rem',
                              color: 'var(--color-text)',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.35
                            }}>
                              {noteStr}
                            </div>
                          ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.76rem', fontStyle: 'italic' }}>Chưa có tương tác</span>}
                        </td>
                      )}
                      {visibleColsMap['tags'] && (
                        <td style={{ padding: '0.85rem 0.75rem' }}>
                          {rowTags.length > 0 ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: 180 }}>
                              {rowTags.slice(0, 3).map((tg, i) => (
                                <span key={i} style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 600, background: 'rgba(37,99,235,0.1)', color: '#2563eb' }}>
                                  #{tg}
                                </span>
                              ))}
                              {rowTags.length > 3 && (
                                <span style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 700, background: 'rgba(100,116,139,0.12)', color: 'var(--color-text)' }}>
                                  +{rowTags.length - 3}
                                </span>
                              )}
                            </div>
                          ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>—</span>}
                        </td>
                      )}
                      {visibleColsMap['value'] && (
                        <td style={{ padding: '0.85rem 0.75rem', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: '0.85rem' }}>{FMT(Number(item.expected_revenue) || Number(item.value) || 0)}</span>
                        </td>
                      )}
                      {visibleColsMap['total_deposit'] && (
                        <td style={{ padding: '0.85rem 0.75rem', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700, color: '#059669', fontSize: '0.85rem' }}>{FMT_VND(item.total_deposit || item.actual_revenue || 0)}</span>
                        </td>
                      )}
                      {visibleColsMap['owner'] && (
                        <td style={{ padding: '0.85rem 0.75rem', whiteSpace: 'nowrap' }}>
                          {item.owner_name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Avatar name={item.owner_name} src={item.owner_avatar} size={24} />
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>{item.owner_name}</span>
                            </div>
                          ) : <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>Chưa giao</span>}
                        </td>
                      )}
                      {visibleColsMap['source'] && (
                        <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-text)' }}>
                          {item.source || '—'}
                        </td>
                      )}
                      {visibleColsMap['campaign'] && (
                        <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-text)' }}>
                          {item.campaign_name || item.utm_campaign || '—'}
                        </td>
                      )}
                      {visibleColsMap['company'] && (
                        <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.8rem', color: 'var(--color-text)' }}>
                          {item.company_name || '—'}
                        </td>
                      )}
                      {visibleColsMap['created_at'] && (
                        <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {item.created_at ? String(item.created_at).slice(0, 10) : '—'}
                        </td>
                      )}
                      {visibleColsMap['updated_at'] && (
                        <td style={{ padding: '0.85rem 0.75rem', fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                          {item.updated_at ? String(item.updated_at).slice(0, 10) : '—'}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '1rem', borderTop: '1px solid var(--color-border-light)', background: 'var(--color-bg-light)', width: '100%' }}>
            <Pagination
              total={total}
              page={page}
              pageSize={limit}
              onChange={setPage}
              showSizeChanger
              onPageSizeChange={size => {
                setLimit(size);
                localStorage.setItem('Ideas_deals_page_size', String(size));
                setPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* Single Floating Hover Tooltip for Kanban Cards & List Rows (Light Surface, No Badge Border, Lucide Icons) */}
      <DealsFloatingTooltip triggerRef={tooltipTriggerRef} pipelineView={pipelineView} stages={stages} />

      {showContactDrawer && (
        <Suspense fallback={null}>
          <CustomerProfileDrawer 
            isOpen={showContactDrawer}
            onClose={() => {
              setShowContactDrawer(false);
              setSelectedContactInitialTab('info');
            }}
            contact={selectedContact}
            initialTab={selectedContactInitialTab as any}
            onUpdate={(updated) => { updateItemLocally(updated); fetchData(); }}
          />
        </Suspense>
      )}

      {showCompanyDrawer && (
        <Suspense fallback={null}>
          <CompanyDrawer
            isOpen={showCompanyDrawer}
            onClose={() => setShowCompanyDrawer(false)}
            entity={selectedCompany}
            onSave={() => fetchData()}
          />
        </Suspense>
      )}

      {showDealDrawer && (
        <Suspense fallback={null}>
          <DealDrawer
            isOpen={showDealDrawer}
            onClose={() => setShowDealDrawer(false)}
            deal={selectedDeal}
            onSave={handleSaveDeal}
            stages={stages}
          />
        </Suspense>
      )}

      {/* Transition Modal */}
      {createPortal(
        <AnimatePresence>
          {transitionModal && transitionModal.isOpen && (
            <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 11000 }} onClick={() => setTransitionModal(null)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                onClick={e => e.stopPropagation()}
                style={{ background: 'var(--color-surface)', width: '90%', maxWidth: transitionModal.isCancellation ? '580px' : '520px', borderRadius: '12px', padding: '1.75rem', boxShadow: 'var(--shadow-2xl)', border: '1px solid var(--color-border)' }}
              >
                {transitionModal.isCancellation ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem', color: 'var(--color-danger)' }}>
                      <AlertTriangle size={22} />
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>Xác Nhận Nghiệp Vụ Bể Cọc</h3>
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', lineHeight: 1.4 }}>
                      Bạn đang di chuyển Deal này ra khỏi giai đoạn <strong>{stages.find(s => s.id === transitionModal.fromStage)?.name}</strong> (Báo bể cọc). 
                      Vui lòng xác nhận tình trạng doanh thu thực tế của Deal:
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '1.5rem' }}>
                      {/* Option 1: No Revenue */}
                      <button
                        type="button"
                        onClick={() => setTransitionModal({ ...transitionModal, hasRevenue: 'no' })}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '12px 16px',
                          border: `1.5px solid ${transitionModal.hasRevenue === 'no' ? 'var(--color-primary)' : 'var(--color-border-light)'}`,
                          background: transitionModal.hasRevenue === 'no' ? 'var(--color-primary-light)' : 'transparent',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          width: '100%'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--color-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {transitionModal.hasRevenue === 'no' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)' }} />}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: transitionModal.hasRevenue === 'no' ? 'var(--color-primary)' : 'var(--color-text)' }}>Chưa phát sinh doanh thu</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingLeft: '24px' }}>
                          Khách hàng hủy cọc trước khi công ty thực thu bất kỳ dòng tiền/phí môi giới nào. Lead sẽ bị hạ cấp và khởi động lại bảo mật.
                        </span>
                      </button>

                      {/* Option 2: Has Revenue */}
                      <button
                        type="button"
                        onClick={() => setTransitionModal({ ...transitionModal, hasRevenue: 'yes' })}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          padding: '12px 16px',
                          border: `1.5px solid ${transitionModal.hasRevenue === 'yes' ? 'var(--color-danger)' : 'var(--color-border-light)'}`,
                          background: transitionModal.hasRevenue === 'yes' ? 'rgba(239, 68, 68, 0.04)' : 'transparent',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.2s',
                          width: '100%'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{
                            width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--color-danger)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {transitionModal.hasRevenue === 'yes' && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-danger)' }} />}
                          </div>
                          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: transitionModal.hasRevenue === 'yes' ? 'var(--color-danger)' : 'var(--color-text)' }}>Đã có doanh thu (Đóng đợt 1)</span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingLeft: '24px' }}>
                          Công ty đã thu phí đợt 1 thành công. Theo quy định, khách hàng phải được giữ nguyên trạng thái Đặt Cọc.
                        </span>
                      </button>
                    </div>

                    {transitionModal.hasRevenue === 'yes' && (
                      <div className="vibrate-alert" style={{
                        background: 'rgba(239, 68, 68, 0.08)',
                        border: '1.5px solid rgba(239, 68, 68, 0.2)',
                        borderRadius: '12px',
                        padding: '12px 16px',
                        marginBottom: '1.5rem',
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'flex-start'
                      }}>
                        <ShieldAlert size={18} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: '2px' }} />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--color-danger)' }}>Hành động bị chặn!</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--color-danger)', lineHeight: 1.35 }}>
                            Không cho phép hạ cấp trạng thái. Do giao dịch đã đóng đợt 1, hệ thống bắt buộc giữ nguyên Deal ở cột Đặt Cọc.
                          </span>
                        </div>
                      </div>
                    )}

                    {transitionModal.hasRevenue === 'no' && (
                      <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                        <label className="form-label">Lý do bể cọc (Audit Trail) <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <textarea 
                          className="form-input" 
                          rows={3} 
                          placeholder="Nhập lý do chi tiết để lưu lịch sử kiểm tra..."
                          value={transitionModal.note}
                          onChange={e => setTransitionModal({ ...transitionModal, note: e.target.value })}
                          style={{ minHeight: '90px', padding: '10px 14px', lineHeight: 1.4, resize: 'vertical' }}
                          autoFocus
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {(() => {
                      const fromIndex = stages.findIndex(s => s.id === transitionModal.fromStage);
                      const toIndex = stages.findIndex(s => s.id === transitionModal.toStage);
                      const skipped = (fromIndex !== -1 && toIndex !== -1 && toIndex > fromIndex + 1)
                        ? stages.slice(fromIndex + 1, toIndex).map(s => s.name)
                        : (fromIndex !== -1 && toIndex !== -1 && fromIndex > toIndex + 1)
                        ? stages.slice(toIndex + 1, fromIndex).map(s => s.name)
                        : [];
                      const toStageObj = stages.find(s => s.id === transitionModal.toStage);
                      return (
                        <>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.5rem' }}>Cập nhật Pipeline Deal</h3>
                          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span>Từ</span>
                            <strong>{stages.find(s => s.id === transitionModal.fromStage)?.name}</strong>
                            <ArrowRight size={14} />
                            <strong style={{ color: toStageObj?.color || 'var(--color-primary)' }}>{toStageObj?.name}</strong>
                          </p>

                          {(toStageObj?.definition || toStageObj?.exit_criteria) && (
                            <div style={{ background: 'var(--color-bg-alt)', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '10px 14px', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {toStageObj.definition && (
                                <div style={{ fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 700, color: 'var(--color-text)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <Flag size={13} />
                                    <span>Milestone:</span>
                                  </span>
                                  <span style={{ color: 'var(--color-text-muted)' }}>{toStageObj.definition}</span>
                                </div>
                              )}
                              {toStageObj.exit_criteria && (
                                <div style={{ fontSize: '0.8125rem', color: '#059669', background: 'rgba(16, 185, 129, 0.08)', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <CheckCircle2 size={13} />
                                    <span>Exit Criteria:</span>
                                  </strong>
                                  <span>{toStageObj.exit_criteria}</span>
                                </div>
                              )}
                            </div>
                          )}

                          {skipped.length > 0 && (
                            <div style={{
                              background: 'rgba(239, 68, 68, 0.08)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              borderRadius: '12px',
                              padding: '1rem',
                              marginBottom: '1.25rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)', fontWeight: 700, fontSize: '0.875rem' }}>
                                <AlertCircle size={16} /> Nhảy cóc giai đoạn!
                              </div>
                              <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
                                Bạn đang di chuyển qua nhiều giai đoạn. Bỏ qua các bước: <strong style={{ color: 'var(--color-text)' }}>{skipped.join(', ')}</strong>.
                              </p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    
                    <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label className="form-label" style={{ margin: 0 }}>Ghi chú Audit Trail <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Gợi ý nhanh 1-chạm:</span>
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                        {[
                          'Đã gọi trao đổi nhu cầu',
                          'Đã gửi báo giá & tài liệu',
                          'Hẹn lịch tư vấn 1-1',
                          'Khách hẹn chốt tuần này',
                          'Chưa liên hệ được - Hẹn gọi lại'
                        ].map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => setTransitionModal({ ...transitionModal, note: chip })}
                            style={{
                              fontSize: '0.75rem',
                              padding: '4px 10px',
                              borderRadius: '16px',
                              border: transitionModal.note === chip ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: transitionModal.note === chip ? 'var(--color-primary-light, rgba(189,29,45,0.08))' : 'var(--color-bg-subtle, rgba(0,0,0,0.02))',
                              color: transitionModal.note === chip ? 'var(--color-primary)' : 'var(--color-text)',
                              cursor: 'pointer',
                              fontWeight: transitionModal.note === chip ? 600 : 500,
                              transition: 'all 0.15s ease'
                            }}
                          >
                            + {chip}
                          </button>
                        ))}
                      </div>
                      <textarea 
                        className="form-input" 
                        rows={3} 
                        placeholder="Ghi chú bắt buộc lý do chuyển..."
                        value={transitionModal.note}
                        onChange={e => setTransitionModal({ ...transitionModal, note: e.target.value })}
                        style={{ minHeight: '90px', padding: '12px 16px', lineHeight: 1.5, resize: 'vertical' }}
                        autoFocus
                      />
                    </div>
                  </>
                )}
                
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button className="btn outline" onClick={() => setTransitionModal(null)} disabled={isConfirmingTransition}>Hủy</button>
                  <button 
                    className="btn primary" 
                    onClick={handleConfirmTransition}
                    disabled={
                      isConfirmingTransition ||
                      (transitionModal.isCancellation 
                        ? (transitionModal.hasRevenue === 'yes' || !transitionModal.hasRevenue || !transitionModal.note.trim())
                        : !transitionModal.note.trim())
                    }
                  >
                    {isConfirmingTransition ? 'Đang lưu...' : 'Lưu cập nhật'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      <CrmSendTemplateEmailModal
        isOpen={showCrmEmailModal}
        onClose={() => setShowCrmEmailModal(false)}
        contacts={Object.values(items).flat().filter((it: any) => selected.has(it.id)).map((it: any) => ({
          ...it,
          id: Number(it.contact_id || it.id),
          full_name: it.full_name || it.contact_name || it.title || it.name,
          email: it.email || it.contact_email,
          phone: it.phone || it.contact_phone,
          program: it.program || it.project_name,
          stage_name: it.stage_name,
        }))}
        onSuccess={() => {
          setSelected(new Set());
        }}
      />
      <CrmBulkMarketingModal
        isOpen={crmBulkMarketingModal.isOpen}
        onClose={() => setCrmBulkMarketingModal(prev => ({ ...prev, isOpen: false }))}
        initialMode={crmBulkMarketingModal.mode}
        contactIds={Object.values(items).flat().filter((it: any) => selected.has(it.id)).map((it: any) => Number(it.contact_id || it.id)).filter(Boolean)}
        contacts={Object.values(items).flat().filter((it: any) => selected.has(it.id)).map((it: any) => ({
          ...it,
          id: Number(it.contact_id || it.id),
          full_name: it.full_name || it.contact_name || it.title || it.name,
          email: it.email || it.contact_email,
          phone: it.phone || it.contact_phone,
          program: it.program || it.project_name,
          stage_name: it.stage_name,
        }))}
        onSuccess={() => {
          setSelected(new Set());
        }}
      />

      {/* Bulk Move Modal */}
      {createPortal(
        <AnimatePresence>
          {showBulkMove && (
            <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setShowBulkMove(false)}>
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                style={{ background: 'var(--color-surface)', width: '100%', maxWidth: '400px', borderRadius: '24px', padding: '2rem', boxShadow: 'var(--shadow-2xl)' }}
                onClick={e => e.stopPropagation()}
              >
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '1.5rem' }}>Chuyển {selected.size} thẻ sang...</h3>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label">Chọn giai đoạn đích</label>
                  <CustomSelect 
                    options={stages.map(s => ({ value: String(s.id), label: s.name }))} 
                    value={targetStageId} 
                    onChange={v => setTargetStageId(v as string)} 
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button className="btn outline" style={{ flex: 1 }} onClick={() => setShowBulkMove(false)} disabled={isBulkMoving}>Hủy</button>
                  <button className="btn primary" style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }} onClick={bulkMove} disabled={!targetStageId || isBulkMoving}>
                    {isBulkMoving && <Loader2 size={15} className="spin" />}
                    <span>{isBulkMoving ? 'Đang chuyển...' : 'Xác nhận chuyển'}</span>
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Stage Picker for Mobile Quick Move */}
      {createPortal(
        <AnimatePresence>
          {stagePickerItem && (
            <div className="overlay-backdrop" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 11000 }} onClick={() => setStagePickerItem(null)}>
              <motion.div 
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                onClick={e => e.stopPropagation()}
                style={{ background: 'var(--color-surface)', width: '100%', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '1.5rem', maxHeight: '80vh', overflowY: 'auto' }}
              >
                <h3 style={{ fontSize: '1.125rem', fontWeight: 800, marginBottom: '1rem', textAlign: 'center' }}>Chọn giai đoạn mới</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {stages.filter(s => s.id !== stagePickerItem.fromStageId).map(s => (
                    <button
                      key={s.id}
                      className="btn outline"
                      style={{ width: '100%', justifyContent: 'flex-start', borderLeftWidth: '6px', borderLeftColor: s.color || 'var(--color-primary)' }}
                      onClick={() => {
                        openStageTransitionModal(stagePickerItem.id, stagePickerItem.fromStageId, s.id);
                        setStagePickerItem(null);
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
                <button className="btn ghost" style={{ width: '100%', marginTop: '1rem', fontWeight: 700 }} onClick={() => setStagePickerItem(null)}>Đóng</button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

    </div>
  );
};
