import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { Plus, Search, Phone, PhoneOff, Mail, Eye, EyeOff, Clock, Ban, CheckCircle2, Trash2, X, Download, Upload, ChevronDown, Users, Tag as TagIcon, UserCheck, RefreshCw, Filter, LayoutGrid, List, ArrowDownUp, Columns, Building2, Briefcase, Loader2, User, UserPlus, Calendar, AlertTriangle, AlertCircle, CheckSquare, Layers, MoreHorizontal, ChevronRight, ChevronLeft, GraduationCap, SlidersHorizontal, RotateCcw, Sparkles, BarChart3, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, getColorFromName } from '../components/ui/Avatar';
import { useUIStore } from '../store/uiStore';
const CustomerProfileDrawer = lazy(() => import('./CustomerProfileDrawer').then(module => ({ default: module.CustomerProfileDrawer })));
import { LeadScoreRing } from '../components/ui/LeadScoreRing';
import { TagDisplay } from '../components/ui/TagInput';
import { Pagination } from '../components/ui/Pagination';
import { ColumnCustomizer, type ColumnDef } from '../components/ui/ColumnCustomizer';
import { ImportExportModal } from '../components/ui/ImportExportModal';
import { QuickAddLeadModal } from '../components/QuickAddLeadModal';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomCheckbox } from '../components/ui/CustomCheckbox';
import { Skeleton, TableSkeleton } from '../components/ui/Skeleton';
import { PhoneLink } from '../components/ui/PhoneLink';
import { PeriodFilter, getDateRange } from '../components/ui/PeriodFilter';
import { AddressSelect } from '../components/ui/AddressSelect';
import type { Period, DateRange } from '../components/ui/PeriodFilter';
import { CopyButton } from '../components/ui/CopyButton';
import { Tooltip } from '../components/ui/Tooltip';
import api from '../api/axios';
import { fetchAPI } from '../utils/api';
import { downloadExportFile } from '../utils/exportHelper';
import { useDebounce } from '../hooks/useDebounce';
import { useAuth } from '../contexts/AuthContext';
import { isAcademic, isManagement, isExecutive } from '../utils/roleUtils';
import { calculateLeadScore, getLeadHeatTier } from '../utils/leadScoring';
import { SalesLeadPerformanceDeck } from '../components/Dashboard/SalesLeadPerformanceDeck';
import { ReportDataModal } from '../components/ui/ReportDataModal';
import { TableContextMenu } from '../components/ui/TableContextMenu';
import { pushOverlay, removeOverlay } from '../utils/overlayStack';

const PAGE_SIZE = 10;

const STATUS_LABEL: Record<string,string> = { lead:'Lead mới', qualified:'Tiềm năng', customer:'Học viên', churned:'Đã rời' };
const STATUS_CLASS: Record<string,string> = { lead:'info', qualified:'warning', customer:'success', churned:'danger' };

const cleanInteractionText = (text: string) => {
  if (!text) return text;
  return text
    .replace(/\s*\n?\(?Giai đoạn:.*$/si, '')
    .replace(/\s*\|\s*Lý do lost:.*$/si, '')
    .replace(/\s*\|\s*Độ nóng:.*$/si, '')
    .trim();
};

const getInteractionTime = (lastInteractionAt: string | null, lastContact: string | null, createdAt: string, distributedAt?: string | null) => {
  const parseTime = (t: string | null | undefined) => {
    if (!t) return 0;
    const ms = new Date(t).getTime();
    return isNaN(ms) ? 0 : ms;
  };
  // Ưu tiên thời điểm của nhật ký tương tác thực tế hoặc last_contact
  const maxMs = Math.max(parseTime(lastInteractionAt), parseTime(lastContact));
  if (maxMs > 0) {
    return new Date(maxMs).toISOString();
  }
  // Nếu chưa từng có tương tác, hiển thị theo thời điểm phân bổ hoặc ngày tạo lead
  const fallbackMs = Math.max(parseTime(distributedAt), parseTime(createdAt));
  return fallbackMs > 0 ? new Date(fallbackMs).toISOString() : (lastContact || createdAt);
};

const isLeadUncontacted = (c: any) => {
  if (!c) return false;

  const interactionText = cleanInteractionText(c.last_interaction);
  const hasInteraction = Boolean(
    interactionText && 
    interactionText !== 'Chưa có tương tác' && 
    interactionText !== '—' && 
    !interactionText.startsWith('Tái phân bổ') && 
    !interactionText.startsWith('Giao lại')
  );

  // Nếu đã có tương tác thực tế hoặc có thời điểm liên lạc -> không phải chưa tương tác
  if (hasInteraction || c.last_contact || c.last_interaction_at) {
    return false;
  }

  // Lead hoàn toàn chưa có bất kỳ tương tác nào
  return true;
};

const renderInteractionInfo = (c: any, onReportClick?: (c: any) => void) => {
  const interactionTime = getInteractionTime(c.last_interaction_at, c.last_contact, c.created_at, c.distributed_at);
  const timeText = formatTimeAgo(interactionTime);
  const isUncontacted = isLeadUncontacted(c);
  const isReassigned = Boolean(
    c.notes?.includes('Tái phân bổ') || 
    c.notes?.includes('giao lại') || 
    c.notes?.includes('Giao lại') ||
    c.round_name?.toLowerCase().includes('giao lại') ||
    c.round_name?.toLowerCase().includes('tái phân')
  );
  const isReminder = Boolean(
    !isReassigned && (
      c.notes?.includes('nhắc lại') || 
      c.notes?.includes('Nhắc lại') || 
      c.notes?.includes('đăng ký lại') || 
      c.notes?.includes('Đăng ký lại') || 
      c.dl_status === 'duplicate' ||
      c.dl_status === 'reminder' ||
      c.round_name?.toLowerCase().includes('nhắc lại')
    )
  );
  const isReportedError = Boolean(c.is_error_ticket || c.report_status === 'pending' || c.report_status === 'approved' || c.report_status === 'approved_no_comp');
  const isEligibleForReport = Boolean(c.log_id && c.dl_status !== 'databank_claim') || Boolean(c.round_name && c.dl_status !== 'databank_claim' && c.source !== 'ca_nhan' && c.source !== 'cold_call');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
        Tương tác: {timeText}
      </span>
      {isUncontacted && (
        <span style={{ 
          fontSize: '0.625rem', 
          fontWeight: 700, 
          padding: '1px 5px', 
          borderRadius: '4px', 
          background: 'rgba(239, 68, 68, 0.12)', 
          color: '#dc2626',
          lineHeight: '1.2'
        }}>
          Chưa tương tác
        </span>
      )}
      {isReassigned && (
        <span style={{ 
          fontSize: '0.625rem', 
          fontWeight: 700, 
          padding: '1px 5px', 
          borderRadius: '4px', 
          background: 'rgba(245, 158, 11, 0.12)', 
          color: '#d97706',
          lineHeight: '1.2'
        }}>
          Giao lại
        </span>
      )}
      {isReminder && (
        <span style={{ 
          fontSize: '0.625rem', 
          fontWeight: 700, 
          padding: '1px 5px', 
          borderRadius: '4px', 
          background: 'rgba(236, 72, 153, 0.14)', 
          color: '#db2777',
          lineHeight: '1.2'
        }}>
          Nhắc lại
        </span>
      )}
      {isReportedError && (
        <span style={{ 
          fontSize: '0.625rem', 
          fontWeight: 700, 
          padding: '1px 5px', 
          borderRadius: '4px', 
          background: 'rgba(239, 68, 68, 0.15)', 
          color: '#dc2626',
          lineHeight: '1.2',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '2px'
        }}>
          <AlertCircle size={9} /> Đã báo lỗi
        </span>
      )}
    </div>
  );
};

const getContactStage = (c: any, stages: any[]) => {
  if (c.lost_reason || c.status === 'lost') {
    return { isLost: true, isNewLead: false, color: '#dc2626', bgColor: 'rgba(239, 68, 68, 0.08)' };
  }

  const stagesToUse = (stages && stages.length > 0) ? stages : DEFAULT_PIPELINE_STAGES;

  // 1. Direct lookup in pipelineStages: match stage_id first, then pipeline_status, then stage_name
  const foundById = c.stage_id
    ? stagesToUse.find((s: any) => String(s.id) === String(c.stage_id))
    : null;
  const foundBySlug = !foundById && c.pipeline_status
    ? stagesToUse.find((s: any) => String(s.id) === String(c.pipeline_status) || s.system_slug === c.pipeline_status)
    : null;
  const foundByName = !foundById && !foundBySlug && c.stage_name
    ? stagesToUse.find((s: any) => s.name?.toLowerCase() === c.stage_name.toLowerCase() || s.name?.includes(c.stage_name) || c.stage_name.includes(s.name))
    : null;
  const found = foundById || foundBySlug || foundByName;

  // 2. Check notes or last_interaction for explicit transfer: [Chuyển Pipeline sang: ...]
  let extractedStage: any = null;
  const match = (c.notes || c.last_interaction || '').match(/\[Chuyển Pipeline sang:\s*([^\]]+)\]/i);
  if (match && match[1]) {
    const extractedName = match[1].trim().toLowerCase();
    extractedStage = stagesToUse.find((s: any) => s.name?.toLowerCase() === extractedName || s.name?.toLowerCase().includes(extractedName));
  }

  const targetStage = found || extractedStage;
  const isEnrolled = c.pipeline_status === 'enrolled' || c.stage_name === 'Học viên' || c.stage_name === '14 – Enrolled' || targetStage?.system_slug === 'enrolled' || c.status === 'customer';

  if (isEnrolled) {
    return {
      name: c.stage_name || targetStage?.name || '14 – Enrolled',
      color: '#db2777',
      bgColor: '#db277712',
      isEnrolled: true,
      isNewLead: false
    };
  }

  if (c.status === 'churned') {
    return {
      name: 'Đã rời',
      color: '#dc2626',
      bgColor: 'rgba(239, 68, 68, 0.08)',
      isEnrolled: false,
      isNewLead: false
    };
  }

  const name = targetStage?.name || c.stage_name || stagesToUse[0]?.name || '01 – New Lead';
  const isNewLead = Boolean(
    targetStage?.system_slug === 'new_lead' ||
    String(targetStage?.id) === '31' ||
    String(c.stage_id) === '31' ||
    /^01\b|new\s*lead/i.test(name)
  );
  const color = isNewLead ? '#dc2626' : (targetStage?.color || c.stage_color || stagesToUse[0]?.color || '#2563eb');

  return {
    name,
    color,
    bgColor: `${color}12`,
    isEnrolled: false,
    isNewLead
  };
};

const calcScore = (c: any, rules: any, decayDays = 5) => {
  return calculateLeadScore(c, rules, decayDays).score;
};

const formatTimeAgo = (dateStr?: string) => {
  if (!dateStr) return '—';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  if (isNaN(diffMs)) return '—';
  if (diffMs < 0) return 'Vừa xong';
  
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Vừa xong';
  if (diffMins < 60) return `${diffMins} phút trước`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} giờ trước`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} ngày trước`;
};

const SEGMENTS = [];

const SOURCE_OPTIONS = [
  { value: '', label: 'Tất cả nguồn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'google', label: 'Google Ads' },
  { value: 'gioi_thieu', label: 'Giới thiệu' },
  { value: 'ca_nhan', label: 'Cá nhân tự khai thác' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Khác' }
];

export interface CustomSchemaRule {
  id?: string;
  field: string;
  operator: string;
  value: string;
  valueTo?: string;
}

const CONTACT_SCHEMA_FIELDS: Array<{ value: string; label: string; sublabel?: string; type: 'text' | 'number' | 'date' }> = [
  // Cơ bản & Định danh
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
  // Địa lý
  { value: 'address', label: 'Địa chỉ (address)', sublabel: 'Địa lý', type: 'text' },
  { value: 'ward', label: 'Phường/Xã (ward)', sublabel: 'Địa lý', type: 'text' },
  { value: 'district', label: 'Quận/Huyện (district)', sublabel: 'Địa lý', type: 'text' },
  { value: 'city', label: 'Tỉnh/Thành (city)', sublabel: 'Địa lý', type: 'text' },
  { value: 'preferred_location', label: 'Khu vực ưu tiên (preferred_location)', sublabel: 'Địa lý', type: 'text' },
  // Nghề nghiệp & Doanh nghiệp
  { value: 'company', label: 'Công ty (company)', sublabel: 'Nghề nghiệp', type: 'text' },
  { value: 'job_title', label: 'Chức vụ (job_title)', sublabel: 'Nghề nghiệp', type: 'text' },
  { value: 'department', label: 'Phòng ban (department)', sublabel: 'Nghề nghiệp', type: 'text' },
  { value: 'industry', label: 'Ngành nghề (industry)', sublabel: 'Nghề nghiệp', type: 'text' },
  { value: 'tax_code', label: 'Mã số thuế (tax_code)', sublabel: 'Nghề nghiệp', type: 'text' },
  { value: 'customer_type', label: 'Loại KH (customer_type)', sublabel: 'Phân loại', type: 'text' },
  // Học vụ & Đào tạo
  { value: 'program', label: 'Chương trình (program)', sublabel: 'Học vụ & Đào tạo', type: 'text' },
  { value: 'major', label: 'Chuyên ngành (major)', sublabel: 'Học vụ & Đào tạo', type: 'text' },
  { value: 'expected_intake', label: 'Kỳ nhập học (expected_intake)', sublabel: 'Học vụ & Đào tạo', type: 'text' },
  { value: 'admission_date', label: 'Ngày nhập học (admission_date)', sublabel: 'Học vụ & Đào tạo', type: 'date' },
  { value: 'study_status', label: 'Trạng thái học tập (study_status)', sublabel: 'Học vụ & Đào tạo', type: 'text' },
  // Marketing & Nguồn
  { value: 'source', label: 'Nguồn (source)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'platform', label: 'Nền tảng (platform)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'form_name', label: 'Tên Form (form_name)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'utm_source', label: 'UTM Source (utm_source)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'utm_campaign', label: 'UTM Campaign (utm_campaign)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'utm_medium', label: 'UTM Medium (utm_medium)', sublabel: 'Marketing & Nguồn', type: 'text' },
  { value: 'utm_content', label: 'UTM Content (utm_content)', sublabel: 'Marketing & Nguồn', type: 'text' },
  // Chăm sóc & Đánh giá Lead
  { value: 'temperature', label: 'Nhiệt độ Lead (temperature)', sublabel: 'Đánh giá & Chăm sóc', type: 'text' },
  { value: 'lead_score', label: 'Điểm Lead (lead_score)', sublabel: 'Đánh giá & Chăm sóc', type: 'number' },
  { value: 'win_probability', label: 'Xác suất chốt (win_probability)', sublabel: 'Đánh giá & Chăm sóc', type: 'number' },
  { value: 'ttl1_completed', label: 'Đã TVL1 (ttl1_completed)', sublabel: 'Đánh giá & Chăm sóc', type: 'text' },
  { value: 'next_action', label: 'Hành động tiếp theo (next_action)', sublabel: 'Đánh giá & Chăm sóc', type: 'text' },
  { value: 'next_followup_date', label: 'Ngày hẹn theo dõi (next_followup_date)', sublabel: 'Đánh giá & Chăm sóc', type: 'date' },
  { value: 'expected_decision_date', label: 'Ngày dự kiến chốt (expected_decision_date)', sublabel: 'Đánh giá & Chăm sóc', type: 'date' },
  { value: 'nurture_reason', label: 'Lý do nuôi dưỡng (nurture_reason)', sublabel: 'Đánh giá & Chăm sóc', type: 'text' },
  { value: 'lost_reason', label: 'Lý do hủy (lost_reason)', sublabel: 'Đánh giá & Chăm sóc', type: 'text' },
  // Tài chính & Ghi chú
  { value: 'expected_revenue', label: 'Doanh thu kỳ vọng (expected_revenue)', sublabel: 'Tài chính', type: 'number' },
  { value: 'budget', label: 'Ngân sách (budget)', sublabel: 'Tài chính', type: 'number' },
  { value: 'total_spent', label: 'Tổng chi tiêu (total_spent)', sublabel: 'Tài chính', type: 'number' },
  { value: 'notes', label: 'Ghi chú (notes)', sublabel: 'Ghi chú & Phân loại', type: 'text' },
  { value: 'tags', label: 'Tags (tags)', sublabel: 'Ghi chú & Phân loại', type: 'text' },
  // Thời gian hệ thống
  { value: 'created_at', label: 'Ngày tạo (created_at)', sublabel: 'Mốc thời gian', type: 'date' },
  { value: 'updated_at', label: 'Ngày cập nhật (updated_at)', sublabel: 'Mốc thời gian', type: 'date' },
  { value: 'last_contact', label: 'Ngày liên hệ cuối (last_contact)', sublabel: 'Mốc thời gian', type: 'date' },
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

const STUDY_STATUS_OPTIONS = [
  { value: 'all', label: 'Tất cả trạng thái học tập' },
  { value: 'studying', label: 'Đang học' },
  { value: 'completed', label: 'Đã hoàn thành' },
  { value: 'reserved', label: 'Bảo lưu' },
  { value: 'suspended', label: 'Tạm ngưng' },
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
  { value: 'Thừa Thiên Huế', label: 'Thừa Thiên Huế' },
  { value: 'Nghệ An', label: 'Nghệ An' },
  { value: 'Thanh Hóa', label: 'Thanh Hóa' },
  { value: 'Quảng Ninh', label: 'Quảng Ninh' },
  { value: 'Bắc Ninh', label: 'Bắc Ninh' },
];

const DATE_FIELD_LABELS: Record<string, string> = {
  created_at: 'Ngày tạo',
  updated_at: 'Ngày cập nhật',
  last_contact: 'Ngày tương tác cuối',
  admission_date: 'Ngày nhập học',
  deposit_date: 'Ngày đặt cọc',
  next_followup_date: 'Ngày hẹn gọi lại',
  birthday: 'Ngày sinh',
};

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

const FMT_VND = (n: any) => {
  const num = Math.round(Number(n || 0));
  if (!num) return '—';
  if (num >= 1e9) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(num / 1e9) + ' Tỷ đ';
  }
  if (num >= 1e6) {
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(num / 1e6) + ' Tr đ';
  }
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
};
const AGO_DAYS = (d: string) => d ? Math.floor((Date.now()-new Date(d).getTime())/86400000) : 999;

const DEFAULT_PIPELINE_STAGES = [
  { id: '31', name: '01 – New Lead', system_slug: 'new_lead', color: '#f97316', order_index: 1 },
  { id: '32', name: '02 – Contact Attempted', system_slug: 'contact_attempted', color: '#eab308', order_index: 2 },
  { id: '33', name: '03 – Connected', system_slug: 'connected', color: '#8b5cf6', order_index: 3 },
  { id: '34', name: '04 – Needed', system_slug: 'needed', color: '#ef4444', order_index: 4 },
  { id: '35', name: '05 – Discovery Completed', system_slug: 'discovery_completed', color: '#0d9488', order_index: 5 },
  { id: '36', name: '06 – Program Matched', system_slug: 'program_matched', color: '#0284c7', order_index: 6 },
  { id: '37', name: '07 – Proposal Sent', system_slug: 'proposal_sent', color: '#d97706', order_index: 7 },
  { id: '38', name: '08 – Evaluation / Objection', system_slug: 'evaluation_objection', color: '#ea580c', order_index: 8 },
  { id: '39', name: '09 – Application Started', system_slug: 'application_started', color: '#f59e0b', order_index: 9 },
  { id: '40', name: '10 – Application Completed', system_slug: 'application_completed', color: '#4338ca', order_index: 10 },
  { id: '41', name: '11 – Admission Approved', system_slug: 'admission_approved', color: '#65a30d', order_index: 11 },
  { id: '42', name: '12 – Offer / Scholarship Accepted', system_slug: 'offer_accepted', color: '#16a34a', order_index: 12 },
  { id: '43', name: '13 – Deposit / Tuition Payment', system_slug: 'deposit_tuition_payment', color: '#059669', order_index: 13 },
  { id: '44', name: '14 – Enrolled', system_slug: 'enrolled', color: '#db2777', order_index: 14 }
];

const ContactsFloatingTooltip = React.memo(({
  triggerRef,
  pipelineStages
}: {
  triggerRef: React.MutableRefObject<((val: { contact: any; rect: DOMRect } | null) => void) | null>;
  pipelineStages: any[];
}) => {
  const [hoveredCell, setHoveredCell] = useState<{ contact: any; rect: DOMRect } | null>(null);
  triggerRef.current = setHoveredCell;

  if (typeof document === 'undefined' || !hoveredCell) return null;

  const hc = hoveredCell.contact;
  const rect = hoveredCell.rect;
  const stageInfo = getContactStage(hc, pipelineStages);
  const lastNote = cleanInteractionText(hc.last_interaction || '');
  const initialNote = cleanInteractionText(hc.notes || '');
  const rawTags = typeof hc.tags === 'string'
    ? hc.tags.split(',').map((t: string) => t.replace(/^\d+\.\s*(status\s*-\s*)?/i, '').trim()).filter(Boolean)
    : (Array.isArray(hc.tags) ? hc.tags : []);
  const uniqueTags = Array.from(new Set(rawTags)) as string[];
  let displayProg = (hc.program || hc.project_name || '').trim();
  if (!displayProg && uniqueTags.length > 0) {
    const progTag = uniqueTags.find((t: string) => {
      const lt = t.toLowerCase();
      return lt.includes('mba') || lt.includes('bba') || lt.includes('dba') || lt.includes('msc') || lt.includes('umef') || lt.includes('emba');
    });
    if (progTag) displayProg = progTag;
  }
  const admDateStr = hc.admission_date ? (() => {
    const d = new Date(hc.admission_date);
    if (isNaN(d.getTime())) return String(hc.admission_date).slice(0, 10);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  })() : '';

  const tooltipWidth = 350;
  let left = rect.left + rect.width / 2 - tooltipWidth / 2;
  if (left < 12) left = 12;
  if (typeof window !== 'undefined' && left + tooltipWidth > window.innerWidth - 12) {
    left = window.innerWidth - tooltipWidth - 12;
  }
  const showAbove = typeof window !== 'undefined' && rect.bottom + 240 > window.innerHeight;
  const top = showAbove ? Math.max(12, rect.top - 10) : rect.bottom + 8;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top,
        left,
        transform: showAbove ? 'translateY(-100%)' : 'none',
        width: tooltipWidth,
        zIndex: 99999,
        pointerEvents: 'none',
        background: '#ffffff',
        color: '#0f172a',
        borderRadius: '14px',
        padding: '12px 14px',
        boxShadow: '0 14px 34px rgba(15, 23, 42, 0.14)',
        border: '1px solid #e2e8f0',
        fontSize: '0.75rem',
        lineHeight: 1.45
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ fontWeight: 800, fontSize: '0.84rem', color: '#0f172a' }}>
          {hc.full_name || hc.name || 'Khách hàng'}
        </div>
        <span
          style={{
            fontSize: '0.68rem',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: '999px',
            background: stageInfo.isNewLead ? '#dc2626' : `${stageInfo.color}18`,
            color: stageInfo.isNewLead ? '#ffffff' : stageInfo.color,
            whiteSpace: 'nowrap'
          }}
        >
          {stageInfo.name}
        </span>
      </div>

      {(displayProg || admDateStr) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
          {displayProg && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontWeight: 700,
              background: 'rgba(37, 99, 235, 0.1)',
              color: '#2563eb'
            }}>
              <GraduationCap size={12} style={{ flexShrink: 0 }} />
              <span>{displayProg}</span>
            </span>
          )}
          {admDateStr && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontWeight: 700,
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#059669'
            }}>
              <Calendar size={12} style={{ flexShrink: 0 }} />
              <span>{admDateStr}</span>
            </span>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px', marginBottom: '8px' }}>
        <div>
          <span style={{ color: '#64748b', fontSize: '0.68rem' }}>Phụ trách: </span>
          <strong style={{ color: '#0f172a' }}>{hc.owner_name || 'Chưa giao'}</strong>
        </div>
        <div>
          <span style={{ color: '#64748b', fontSize: '0.68rem' }}>Nguồn: </span>
          <strong style={{ color: '#0f172a' }}>{hc.source || '—'}</strong>
        </div>
      </div>

      {uniqueTags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
          {uniqueTags.map((t, idx) => (
            <span
              key={idx}
              style={{
                fontSize: '0.65rem',
                fontWeight: 600,
                padding: '2px 7px',
                borderRadius: '6px',
                background: '#f1f5f9',
                color: '#334155'
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '8px 10px' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#2563eb', marginBottom: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <MessageSquare size={12} style={{ flexShrink: 0 }} />
          <span>Tương tác / Ghi chú gần nhất</span>
        </div>
        <div style={{ color: '#0f172a', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '140px', overflow: 'hidden' }}>
          {lastNote || initialNote || 'Chưa có ghi chú tương tác'}
        </div>
        {lastNote && initialNote && initialNote !== lastNote && (
          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #e2e8f0', fontSize: '0.7rem', color: '#334155' }}>
            <span style={{ color: '#64748b', fontWeight: 600 }}>Ghi chú gốc: </span>
            {initialNote}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
});

interface ContactsPageProps {
  defaultSegment?: string;
}

export const ContactsPage: React.FC<ContactsPageProps> = ({ defaultSegment = 'tiem_nang' }) => {
  const { user } = useAuth();
  const isSale = ['sale', 'sales'].includes(String(user?.role).toLowerCase());
  const canAddOrAssign = useMemo(() => {
    const role = (user?.role as string) || '';
    return (
      user?.email === 'dinhthanh@ideas.edu.vn' ||
      role === 'marketing' ||
      role === 'admin' ||
      role === 'manager' ||
      role === 'director' ||
      role === 'leader'
    );
  }, [user]);
  const navigate = useNavigate();
  const isManagerOrAbove = useMemo(() => isManagement(user) || isExecutive(user), [user]);
  const [activeMainTab, setActiveMainTab] = useState<'list' | 'performance'>('list');
  const { addToast, showConfirm, closeConfirm } = useUIStore();
  const [uncontactedCount, setUncontactedCount] = useState(() => {
    return Number(sessionStorage.getItem('sale-uncontacted-count')) || 0;
  });
  const [initialMetadataLoaded, setInitialMetadataLoaded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; item: any } | null>(null);

  useEffect(() => {
    const handleUncontactedCountChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setUncontactedCount(Number(detail) || 0);
    };

    window.addEventListener('uncontacted-count-changed', handleUncontactedCountChanged);
    return () => {
      window.removeEventListener('uncontacted-count-changed', handleUncontactedCountChanged);
    };
  }, []);

  useEffect(() => {
    // Preload CustomerProfileDrawer in idle background so drawer opens instantaneously
    const timer = setTimeout(() => {
      import('./CustomerProfileDrawer');
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const [contacts, setContacts] = useState<any[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [studentSubTab, setStudentSubTab] = useState<'le_phi' | 'chinh_thuc' | 'nop_ho_so'>(() => {
    const tab = searchParams.get('tab');
    return (tab === 'chinh_thuc' || tab === 'le_phi' || tab === 'nop_ho_so') ? tab : 'chinh_thuc';
  });

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'chinh_thuc' || tab === 'le_phi' || tab === 'nop_ho_so') {
      setStudentSubTab(tab);
    } else {
      setStudentSubTab('chinh_thuc');
    }
  }, [searchParams]);

  const [studentCounts, setStudentCounts] = useState<{ nop_ho_so?: number; le_phi?: number; chinh_thuc?: number }>({});
  const fetchStudentCounts = async () => {
    try {
      const res = await api.get('/contacts/student-counts');
      if (res.data?.success && res.data?.data) {
        setStudentCounts(res.data.data);
        window.dispatchEvent(new CustomEvent('student-badge-updated', { detail: res.data.data }));
      }
    } catch {
      // silent
    }
  };

  const [scoringRules, setScoringRules] = useState<any>(null);
  const [decayDays, setDecayDays] = useState<number>(5);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [search, setSearch] = useState(() => searchParams.get('search') || searchParams.get('q') || '');
  const debouncedSearch = useDebounce(search.trim(), 300); // 300ms debounce
  const [pageSize, setPageSize] = useState<number>(() => {
    return Number(localStorage.getItem('Ideas_contacts_page_size')) || 50;
  });

  useEffect(() => {
    const q = searchParams.get('search') || searchParams.get('q');
    if (q !== null && q !== undefined && q !== search) {
      setSearch(q);
    }
  }, [searchParams]);

  const openContactId = searchParams.get('open_contact_id') || searchParams.get('id');
  const drawerFetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (drawerFetchAbortRef.current) {
        drawerFetchAbortRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (openContactId) {
      const cid = Number(openContactId);
      if (cid) {
        if (drawerFetchAbortRef.current) {
          drawerFetchAbortRef.current.abort();
        }
        const ctrl = new AbortController();
        drawerFetchAbortRef.current = ctrl;
        api.get(`/contacts/${cid}`, { signal: ctrl.signal }).then(res => {
          if (ctrl.signal.aborted) return;
          if (res.data.success && res.data.data) {
            useUIStore.getState().closeCustomerDrawer();
            setProfileContact(res.data.data);
          }
        }).catch(err => {
          if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
          console.error("Error loading auto-open contact:", err);
        }).finally(() => {
          if (ctrl.signal.aborted) return;
          const newParams = new URLSearchParams(searchParams);
          newParams.delete('open_contact_id');
          newParams.delete('id');
          setSearchParams(newParams, { replace: true });
        });
      }
    }
  }, [openContactId]);

  // Global event listener for instant drawer opening when notification or chat link is clicked
  useEffect(() => {
    const handleOpenContactDrawer = (e: any) => {
      const cid = Number(e.detail?.id || e.detail?.contactId);
      if (cid && !isNaN(cid) && cid > 0) {
        if (drawerFetchAbortRef.current) {
          drawerFetchAbortRef.current.abort();
        }
        const ctrl = new AbortController();
        drawerFetchAbortRef.current = ctrl;
        api.get(`/contacts/${cid}`, { signal: ctrl.signal }).then(res => {
          if (ctrl.signal.aborted) return;
          if (res.data.success && res.data.data) {
            useUIStore.getState().closeCustomerDrawer();
            setProfileContact(res.data.data);
          }
        }).catch(err => {
          if (err?.name === 'AbortError' || err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') return;
          console.error("Error opening contact drawer from event:", err);
        });
      }
    };
    window.addEventListener('open-contact-drawer', handleOpenContactDrawer);
    window.addEventListener('open-global-customer', handleOpenContactDrawer);
    return () => {
      window.removeEventListener('open-contact-drawer', handleOpenContactDrawer);
      window.removeEventListener('open-global-customer', handleOpenContactDrawer);
    };
  }, []);

  const isUserAcademic = isAcademic(user);
  const [segment, setSegment] = useState(() => {
    if (isUserAcademic) return 'customer';
    return searchParams.get('segment') || defaultSegment;
  });

  useEffect(() => {
    if (isUserAcademic && segment !== 'customer') {
      setSegment('customer');
    }
  }, [isUserAcademic, segment]);

  useEffect(() => {
    if (segment === 'customer') {
      fetchStudentCounts();
    }
  }, [segment]);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [page, setPage] = useState(1);
  const [profileContact, setProfileContact] = useState<any>(null);
  const [showImportExport, setShowImportExport] = useState(false);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setShowExportDropdown(false);
      }
    };
    if (showExportDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showExportDropdown]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ full_name: '', email: '', phone: '', company_name: '', job_title: '', status: 'lead', source: 'other', owner_id: '', city: '', ward: '', address: '' });
  const [creating, setCreating] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkAssignTargetUserId, setBulkAssignTargetUserId] = useState<string>('');
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);

  // Quick Filter state (Lost & Nurture & Uncontacted)
  const [showLost, setShowLost] = useState<boolean>(false);
  const [quickLeadStatus, setQuickLeadStatus] = useState<string>(''); // '' (all/active), 'nurture', 'lost'
  const [filterUncontacted, setFilterUncontacted] = useState<boolean>(() => {
    const uc = searchParams.get('uncontacted');
    return uc === '1' || uc === 'true' || searchParams.get('status') === 'not_contacted';
  });
  const [filterMultiProgram, setFilterMultiProgram] = useState<boolean>(() => {
    const mp = searchParams.get('multi_program');
    return mp === '1' || mp === 'true' || mp === '2';
  });

  // Advanced Filter state
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  useEffect(() => {
    if (!showAdvancedFilters) {
      removeOverlay('contacts-advanced-filters');
      return;
    }
    pushOverlay('contacts-advanced-filters', () => setShowAdvancedFilters(false), 120);
    return () => {
      removeOverlay('contacts-advanced-filters');
    };
  }, [showAdvancedFilters]);

  const [filterStatus, setFilterStatus] = useState('');
  const [filterStageOp, setFilterStageOp] = useState<'in' | 'not_in'>('in');
  const [filterLeadStatus, setFilterLeadStatus] = useState('');
  const [filterLeadStatusOp, setFilterLeadStatusOp] = useState<'in' | 'not_in'>('in');
  const [filterShowLost, setFilterShowLost] = useState(false);
  const [filterSource, setFilterSource] = useState('');
  const [filterDataType, setFilterDataType] = useState('');
  const [filterOwnerId, setFilterOwnerId] = useState('');
  const [filterTeamId, setFilterTeamId] = useState('');
  const [filterProjectId, setFilterProjectId] = useState('');
  const [filterCampaignId, setFilterCampaignId] = useState('');
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [filterTag, setFilterTag] = useState('');
  const [dynamicSources, setDynamicSources] = useState<string[]>([]);

  // Deep Interaction & Care Cadence Filters
  const [filterInteractionStatus, setFilterInteractionStatus] = useState<'' | 'uncontacted' | 'contacted'>('');
  const [filterStaleDays, setFilterStaleDays] = useState('');
  const [filterInteractedWithinDays, setFilterInteractedWithinDays] = useState('');
  const [filterInteractionType, setFilterInteractionType] = useState('');
  const [filterMinCallCount, setFilterMinCallCount] = useState('');
  const [filterMaxCallCount, setFilterMaxCallCount] = useState('');
  const [filterNoteKeyword, setFilterNoteKeyword] = useState('');

  // Demographics, Academic & Financial Filters
  const [filterGender, setFilterGender] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterAgeMin, setFilterAgeMin] = useState('');
  const [filterAgeMax, setFilterAgeMax] = useState('');
  const [filterJobTitle, setFilterJobTitle] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterFinancialStatus, setFilterFinancialStatus] = useState('');
  const [filterMinDeposit, setFilterMinDeposit] = useState('');
  const [filterMaxDeposit, setFilterMaxDeposit] = useState('');
  const [filterStudyStatus, setFilterStudyStatus] = useState('');
  const [filterStudentCode, setFilterStudentCode] = useState('');
  const [filterExpectedIntake, setFilterExpectedIntake] = useState('');

  // Dynamic Schema Rule Builder (100% DB Schema)
  const [customRules, setCustomRules] = useState<CustomSchemaRule[]>([]);
  const [customRulesLogic, setCustomRulesLogic] = useState<'AND' | 'OR'>('AND');

  const [dateFilterType, setDateFilterType] = useState<'range' | 'before' | 'after'>('range');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [filterBeforeDate, setFilterBeforeDate] = useState('');
  const [filterAfterDate, setFilterAfterDate] = useState('');
  const [projects, setProjects] = useState<any[]>([]);
  const [pipelineStages, setPipelineStages] = useState<any[]>(DEFAULT_PIPELINE_STAGES);
  const [teams, setTeams] = useState<any[]>([]);

  const mergedSourceOptions = useMemo(() => {
    const base = SOURCE_OPTIONS.map(s => s.value === '' ? { value: 'all', label: s.label } : s);
    const existingLower = new Set(base.map(b => String(b.value).toLowerCase()));
    const extra: Array<{ value: string; label: string }> = [];
    dynamicSources.forEach(src => {
      const clean = String(src || '').trim();
      if (clean && !existingLower.has(clean.toLowerCase())) {
        existingLower.add(clean.toLowerCase());
        extra.push({ value: clean, label: clean });
      }
    });
    return [...base, ...extra];
  }, [dynamicSources]);

  // Quick Admission Date Filter state & Popovers
  const [filterAdmissionPreset, setFilterAdmissionPreset] = useState<string>('');
  const [filterAdmissionFrom, setFilterAdmissionFrom] = useState<string>('');
  const [filterAdmissionTo, setFilterAdmissionTo] = useState<string>('');
  const [showAdmissionPopover, setShowAdmissionPopover] = useState(false);
  const [showTimelinePopover, setShowTimelinePopover] = useState(false);
  const admissionPopoverRef = useRef<HTMLDivElement>(null);
  const timelinePopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsidePopover = (e: MouseEvent) => {
      if (admissionPopoverRef.current && !admissionPopoverRef.current.contains(e.target as Node)) {
        setShowAdmissionPopover(false);
      }
      if (timelinePopoverRef.current && !timelinePopoverRef.current.contains(e.target as Node)) {
        setShowTimelinePopover(false);
      }
    };
    if (showAdmissionPopover || showTimelinePopover) {
      document.addEventListener('mousedown', handleOutsidePopover);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsidePopover);
    };
  }, [showAdmissionPopover, showTimelinePopover]);

  // Quick Pipeline Stage Tabs (1-Click Switching)
  const [quickPipelineStage, setQuickPipelineStage] = useState<string>('all');
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});

  const PIPELINE_TABS = useMemo(() => {
    const tabs: Array<{ id: string; slug?: string; label: string; color: string }> = [
      { id: 'all', label: 'Tất cả', color: '#64748b' }
    ];

    const stagesToUse = (pipelineStages && pipelineStages.length > 0) ? pipelineStages : DEFAULT_PIPELINE_STAGES;
    const sorted = [...stagesToUse].sort((a, b) => (Number(a.order_index) || 0) - (Number(b.order_index) || 0));
    sorted.forEach(s => {
      tabs.push({
        id: String(s.id),
        slug: s.system_slug,
        label: s.name,
        color: s.color || '#3b82f6'
      });
    });

    tabs.push(
      { id: 'nurture', slug: 'nurture', label: 'Chăm sóc lại (Nurture)', color: '#0284c7' },
      { id: 'lost', slug: 'lost', label: 'Không tiềm năng (Lost)', color: '#ef4444' }
    );

    return tabs;
  }, [pipelineStages]);

  const getTotalActiveCount = () => {
    if (stageCounts && typeof stageCounts['all'] !== 'undefined') {
      return Number(stageCounts['all']);
    }
    if (quickPipelineStage === 'all' && total > 0) {
      return total;
    }
    if (stageCounts && Object.keys(stageCounts).length > 0) {
      let sum = 0;
      const stagesToUse = (pipelineStages && pipelineStages.length > 0) ? pipelineStages : DEFAULT_PIPELINE_STAGES;
      stagesToUse.forEach(s => {
        sum += Number(stageCounts[String(s.id)] ?? (s.system_slug ? stageCounts[s.system_slug] : undefined) ?? 0);
      });
      return sum > 0 ? sum : total;
    }
    return total;
  };

  const getTabCount = (tab: { id: string; slug?: string }) => {
    if (tab.id === 'all') {
      return getTotalActiveCount();
    }
    if (tab.id === 'nurture') {
      return Number(stageCounts['nurture'] ?? 0);
    }
    if (tab.id === 'lost') {
      return Number(stageCounts['lost'] ?? 0);
    }
    if (stageCounts[tab.id] !== undefined) {
      return Number(stageCounts[tab.id]);
    }
    if (tab.slug && stageCounts[tab.slug] !== undefined) {
      return Number(stageCounts[tab.slug]);
    }
    return 0;
  };

  const handleSelectQuickTab = (tabId: string) => {
    setQuickPipelineStage(prev => prev === tabId ? 'all' : tabId);
    setPage(1);
  };

  const pipelineScrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const isPipelineDownRef = React.useRef(false);
  const pipelineStartXRef = React.useRef(0);
  const pipelineScrollLeftRef = React.useRef(0);
  const hasPipelineDraggedRef = React.useRef(false);

  const checkPipelineScroll = React.useCallback(() => {
    if (pipelineScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = pipelineScrollRef.current;
      setCanScrollLeft(scrollLeft > 6);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 6);
    }
  }, []);

  useEffect(() => {
    checkPipelineScroll();
    const handleResize = () => checkPipelineScroll();
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(checkPipelineScroll, 200);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [checkPipelineScroll, PIPELINE_TABS, stageCounts]);

  const scrollPipeline = (direction: 'left' | 'right') => {
    if (pipelineScrollRef.current) {
      const scrollAmount = Math.max(pipelineScrollRef.current.clientWidth * 0.6, 260);
      pipelineScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
      setTimeout(checkPipelineScroll, 320);
    }
  };

  const handlePipelineMouseDown = (e: React.MouseEvent) => {
    if (!pipelineScrollRef.current) return;
    isPipelineDownRef.current = true;
    hasPipelineDraggedRef.current = false;
    pipelineStartXRef.current = e.pageX - pipelineScrollRef.current.getBoundingClientRect().left;
    pipelineScrollLeftRef.current = pipelineScrollRef.current.scrollLeft;
  };

  const handlePipelineMouseLeave = () => {
    isPipelineDownRef.current = false;
  };

  const handlePipelineMouseUp = () => {
    isPipelineDownRef.current = false;
  };

  const handlePipelineMouseMove = (e: React.MouseEvent) => {
    if (!isPipelineDownRef.current || !pipelineScrollRef.current) return;
    const x = e.pageX - pipelineScrollRef.current.getBoundingClientRect().left;
    const walk = (x - pipelineStartXRef.current);
    if (Math.abs(walk) > 4) {
      hasPipelineDraggedRef.current = true;
    }
    pipelineScrollRef.current.scrollLeft = pipelineScrollLeftRef.current - walk;
    checkPipelineScroll();
  };

  const handlePipelineWheel = (e: React.WheelEvent) => {
    if (pipelineScrollRef.current) {
      if (e.deltaY !== 0 && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        pipelineScrollRef.current.scrollLeft += e.deltaY;
        checkPipelineScroll();
      }
    }
  };

  const getEffectiveTeamId = () => {
    const isMarketing = user?.role === 'marketing' || 
      Number((user as any)?.team_id) === 3 || 
      String((user as any)?.job_title || '').toLowerCase().includes('marketing') ||
      String((user as any)?.team_name || '').toLowerCase().includes('marketing');
    if (
      isMarketing ||
      isAcademic(user) ||
      ['admin', 'superadmin', 'super_admin', 'director', 'sale_admin', 'saleadmin', 'accountant', 'hr', 'academic', 'hoc_vu', 'hoc_thuat', 'dao_tao', 'tro_giang', 'teacher', 'giang_vien', 'giao_vien', 'tutor', 'viewer'].includes(user?.role || '')
    ) {
      return null;
    }
    const nonSalesTeamIds = [1, 2, 3, 5, 99983];
    if (user?.role === 'manager') {
      const managedTeam = teams.find(t => Number(t.leader_id) === Number(user.id));
      const candidateTeamId = Number(managedTeam?.id || (user as any)?.team_id || 0);
      if (!candidateTeamId || nonSalesTeamIds.includes(candidateTeamId)) return null;
      return candidateTeamId;
    }
    const myTeamId = Number((user as any)?.team_id || 0);
    if (!myTeamId || nonSalesTeamIds.includes(myTeamId)) return null;
    return myTeamId;
  };

  const [activeFilters, setActiveFilters] = useState({
    status: '',
    stageOp: 'in' as 'in' | 'not_in',
    leadStatus: '',
    leadStatusOp: 'in' as 'in' | 'not_in',
    showLost: false,
    source: '',
    ownerId: '',
    teamId: '',
    projectId: '',
    campaignId: '',
    tag: '',
    interactionStatus: '' as '' | 'uncontacted' | 'contacted',
    staleDays: '',
    interactedWithinDays: '',
    interactionType: '',
    minCallCount: '',
    maxCallCount: '',
    noteKeyword: '',
    gender: '',
    city: '',
    ageMin: '',
    ageMax: '',
    jobTitle: '',
    company: '',
    financialStatus: '',
    minDeposit: '',
    maxDeposit: '',
    studyStatus: '',
    studentCode: '',
    expectedIntake: '',
    customRules: [] as CustomSchemaRule[],
    customRulesLogic: 'AND' as 'AND' | 'OR',
    dateField: 'created_at' as 'created_at' | 'updated_at' | 'last_contact' | 'admission_date' | 'deposit_date' | 'next_followup_date' | 'birthday',
    dateType: 'range' as 'range' | 'before' | 'after',
    fromDate: '',
    toDate: '',
    beforeDate: '',
    afterDate: '',
    dateActive: false,
    admissionFrom: '',
    admissionTo: '',
    admissionPreset: '',
    admissionActive: false,
    dataType: '',
    multiProgram: searchParams.get('multi_program') === '1' || searchParams.get('multi_program') === 'true' || searchParams.get('multi_program') === '2'
  });

  const validCustomRulesCount = useMemo(() => {
    return (activeFilters.customRules || []).filter(r => r.field && (r.operator === 'is_empty' || r.operator === 'is_not_empty' || String(r.value || '').trim() !== '')).length;
  }, [activeFilters.customRules]);

  const activeFiltersCount = useMemo(() => {
    return [
      activeFilters.status,
      activeFilters.leadStatus,
      activeFilters.showLost ? 'show_lost' : '',
      activeFilters.source,
      activeFilters.ownerId,
      activeFilters.teamId,
      activeFilters.projectId,
      activeFilters.campaignId,
      activeFilters.tag,
      activeFilters.dataType,
      activeFilters.interactionStatus,
      activeFilters.staleDays,
      activeFilters.interactedWithinDays,
      activeFilters.interactionType,
      (activeFilters.minCallCount || activeFilters.maxCallCount) ? 'call_count' : '',
      activeFilters.noteKeyword,
      activeFilters.gender,
      activeFilters.city,
      (activeFilters.ageMin || activeFilters.ageMax) ? 'age' : '',
      activeFilters.jobTitle,
      activeFilters.company,
      activeFilters.financialStatus,
      (activeFilters.minDeposit || activeFilters.maxDeposit) ? 'deposit_amount' : '',
      activeFilters.studyStatus,
      activeFilters.studentCode,
      activeFilters.expectedIntake,
      validCustomRulesCount > 0 ? 'custom_rules' : '',
      activeFilters.dateActive ? 'date' : '',
      activeFilters.admissionActive ? 'admission' : '',
      activeFilters.multiProgram ? 'multi_program' : '',
      filterUncontacted ? 'uncontacted' : ''
    ].filter(val => {
      if (typeof val === 'string') return val.trim() !== '';
      return !!val;
    }).length;
  }, [activeFilters, filterUncontacted, validCustomRulesCount]);

  useEffect(() => {
    const statusParam = searchParams.get('status');
    const uncontactedParam = searchParams.get('uncontacted');
    if (statusParam === 'not_contacted' || uncontactedParam === '1' || uncontactedParam === 'true') {
      setFilterUncontacted(true);
      const newParams = new URLSearchParams(searchParams);
      if (statusParam === 'not_contacted') newParams.delete('status');
      if (uncontactedParam) newParams.delete('uncontacted');
      setSearchParams(newParams, { replace: true });
    }
    const mpParam = searchParams.get('multi_program');
    if (mpParam === '1' || mpParam === 'true' || mpParam === '2') {
      setFilterMultiProgram(true);
      setActiveFilters(prev => ({ ...prev, multiProgram: true }));
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('multi_program');
      setSearchParams(newParams, { replace: true });
    }

    const projectIdParam = searchParams.get('project_id');
    if (projectIdParam) {
      setFilterProjectId(projectIdParam);
      setActiveFilters(prev => ({ ...prev, projectId: projectIdParam }));
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('project_id');
      setSearchParams(newParams, { replace: true });
    }

    const campaignIdParam = searchParams.get('campaign_id');
    if (campaignIdParam) {
      setFilterCampaignId(campaignIdParam);
      setActiveFilters(prev => ({ ...prev, campaignId: campaignIdParam }));
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('campaign_id');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (showCreateModal && user) {
      setCreateForm(prev => ({
        ...prev,
        owner_id: isSale ? String(user.id || '') : ''
      }));
    }
  }, [showCreateModal, user, isSale]);

  // New Enterprise Features State
  const [viewMode, setViewMode] = useState<'list' | 'card'>(() => window.innerWidth <= 991 ? 'card' : 'list');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 991);
  const [showMobileActions, setShowMobileActions] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 991);
      if (window.innerWidth <= 991) {
        setViewMode('card');
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const [sortBy, setSortBy] = useState<'newest' | 'score_desc' | 'deal_desc' | 'interaction_desc'>('newest');
  
  // Date filter
  const [datePeriod, setDatePeriod] = useState<Period>('this_month');
  const [dateRange, setDateRange] = useState<DateRange>({ from: '', to: '' });
  const [filterDateField, setFilterDateField] = useState<'created_at' | 'updated_at' | 'last_contact' | 'admission_date' | 'deposit_date' | 'next_followup_date' | 'birthday'>('created_at');
  const [dateFilterActive, setDateFilterActive] = useState(false);
  
  const storageKey = `contacts_page_columns_v7_${segment === 'customer' ? 'student' : 'lead'}_${isSale ? 'sale' : 'admin'}`;

  const getDefaultContactColumns = (seg: string, saleRole: boolean): ColumnDef[] => [
    { id: 'student_code', label: 'Mã HV / Nhập học', visible: seg === 'customer' },
    { id: 'name', label: 'Họ tên', visible: true },
    { id: 'email', label: 'Email', visible: true },
    { id: 'phone', label: 'SĐT', visible: true },
    { id: 'company', label: 'Công ty', visible: false },
    { id: 'tags', label: 'Phân loại (Tags)', visible: seg !== 'customer' },
    { id: 'program', label: 'Tên chương trình', visible: seg === 'customer' },
    { id: 'last_note', label: 'Nhật ký (gần nhất)', visible: seg !== 'customer' },
    { id: 'admission_date', label: 'Ngày nhập học', visible: false },
    { id: 'status', label: 'Trạng thái', visible: true },
    { id: 'contact', label: 'Liên lạc cuối', visible: false },
    { id: 'deal', label: 'Deal hiện tại', visible: false },
    { id: 'total_deposit', label: 'Thực thu / Đã đóng', visible: false },
    { id: 'owner', label: 'Sale phụ trách', visible: true },
    { id: 'distribution', label: 'Nguồn phân bổ', visible: false },
    { id: 'ticket_action', label: 'Helpdesk (Ticket)', visible: false },
    { id: 'updated_at', label: 'Ngày cập nhật', visible: false },
    { id: 'created_at', label: 'Ngày tạo', visible: !saleRole },
    { id: 'score', label: 'Lead Score', visible: false },
    { id: 'source', label: 'Nguồn khách hàng', visible: false },
    { id: 'campaign', label: 'Chiến dịch', visible: false },
    { id: 'city', label: 'Khu vực / Thành phố', visible: false },
    { id: 'job_title', label: 'Chức danh', visible: false },
    { id: 'birthday', label: 'Ngày sinh', visible: false },
    { id: 'temperature', label: 'Nhiệt độ', visible: false },
    { id: 'total_spent', label: 'Doanh thu / Đóng phí', visible: false },
  ];

  const loadColumnsForKey = (key: string, seg: string, saleRole: boolean): ColumnDef[] => {
    const defaults = getDefaultContactColumns(seg, saleRole);
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const savedMap = new Map(parsed.map((c: any) => [c.id, c]));
          const merged: ColumnDef[] = parsed
            .filter((c: any) => defaults.some(d => d.id === c.id))
            .map((c: any) => {
              const def = defaults.find(d => d.id === c.id)!;
              return { id: def.id, label: def.label, visible: Boolean(c.visible) };
            });
          defaults.forEach(def => {
            if (!savedMap.has(def.id)) {
              merged.push(def);
            }
          });
          return merged;
        }
      }
    } catch (e) {
      console.error('Failed to parse saved columns', e);
    }
    return defaults;
  };

  const loadedStorageKeyRef = useRef(storageKey);
  const [columns, setColumns] = useState<ColumnDef[]>(() => loadColumnsForKey(storageKey, segment, isSale));

  useEffect(() => {
    if (loadedStorageKeyRef.current !== storageKey) {
      loadedStorageKeyRef.current = storageKey;
      setColumns(loadColumnsForKey(storageKey, segment, isSale));
    }
  }, [storageKey, segment, isSale]);

  useEffect(() => {
    if (loadedStorageKeyRef.current === storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(columns));
      } catch {}
    }
  }, [columns, storageKey]);

  const [showColumns, setShowColumns] = useState(false);
  const hoveredCellTriggerRef = useRef<((val: { contact: any; rect: DOMRect } | null) => void) | null>(null);
  const setHoveredCell = React.useCallback((val: { contact: any; rect: DOMRect } | null) => {
    hoveredCellTriggerRef.current?.(val);
  }, []);
  const [dbTags, setDbTags] = useState<any[]>([]);

  const visibleColsMap = useMemo(() => Object.fromEntries(columns.map(c => [c.id, c.visible])), [columns]);
  const dbTagsMap = useMemo(() => new Map(dbTags.map((t: any) => [String(t.name || '').trim().toLowerCase(), t])), [dbTags]);

  useEffect(() => {
    api.get('/tags')
      .then(r => {
        const arr = r.data && Array.isArray(r.data.data) 
          ? r.data.data 
          : (Array.isArray(r.data) ? r.data : []);
        setDbTags(arr);
      })
      .catch(() => {});
  }, []);

  // Report data / Ticket states (Fair Share & Compensation)
  const [reportingContact, setReportingContact] = useState<any | null>(null);

  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (segment === 'customer' && !loading) {
      setStudentCounts(prev => ({
        ...prev,
        [studentSubTab]: total
      }));
    }
  }, [total, studentSubTab, loading, segment]);

  const fetchAbortRef = React.useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (fetchAbortRef.current) {
        fetchAbortRef.current.abort();
      }
    };
  }, []);

  const applyActiveFiltersToParams = (params: Record<string, any>, isSearching: boolean) => {
    if (!isSearching) {
      if (quickPipelineStage && quickPipelineStage !== 'all') {
        if (quickPipelineStage === 'nurture') {
          params.lead_status = 'nurture';
        } else if (quickPipelineStage === 'lost') {
          params.lead_status = 'lost';
          params.show_lost = 1;
          params.include_lost = 1;
        } else {
          params.stage_id = quickPipelineStage;
          params.stage = quickPipelineStage;
          const stagesToUse = (pipelineStages && pipelineStages.length > 0) ? pipelineStages : DEFAULT_PIPELINE_STAGES;
          const stObj = stagesToUse.find(s => String(s.id) === String(quickPipelineStage) || s.system_slug === quickPipelineStage);
          if (stObj?.system_slug) {
            params.stage_slug = stObj.system_slug;
          }
        }
      }

      if (filterUncontacted || activeFilters.interactionStatus === 'uncontacted') {
        params.uncontacted = 1;
        params.interaction_status = 'uncontacted';
      } else if (activeFilters.interactionStatus === 'contacted') {
        params.interaction_status = 'contacted';
      }

      if (activeFilters.multiProgram) {
        params.multi_program = 1;
      }

      if (activeFilters.status) {
        params.stages = activeFilters.status;
        if (/^\d+(,\d+)*$/.test(activeFilters.status)) {
          params.stage_id = activeFilters.status;
          if (activeFilters.stageOp) params.stage_op = activeFilters.stageOp;
        } else {
          params.status = activeFilters.status;
          params.stage = activeFilters.status;
          if (activeFilters.stageOp) {
            params.status_op = activeFilters.stageOp;
            params.stage_op = activeFilters.stageOp;
          }
        }
      }

      const effectiveLeadStatus = quickLeadStatus || activeFilters.leadStatus;
      const effectiveLeadStatusOp = quickLeadStatus ? 'in' : (activeFilters.leadStatusOp || 'in');

      if (effectiveLeadStatus) {
        params.lead_status = effectiveLeadStatus;
        params.lead_status_op = effectiveLeadStatusOp;
      }

      const hasLostInStatus = effectiveLeadStatus ? effectiveLeadStatus.split(',').map(s => s.trim()).includes('lost') : false;
      if (showLost || activeFilters.showLost || hasLostInStatus || quickPipelineStage === 'lost') {
        params.show_lost = 1;
        params.include_lost = 1;
      }
    }

    if (activeFilters.source) {
      params.source = activeFilters.source;
      params.sources = activeFilters.source;
      params.source_type = activeFilters.source;
    }
    if (activeFilters.ownerId) {
      params.owner_id = activeFilters.ownerId;
      params.owners = activeFilters.ownerId;
      if (activeFilters.ownerId === 'unassigned') {
        params.unassigned = 1;
      }
    }
    if (activeFilters.projectId) {
      params.project_id = activeFilters.projectId;
      params.projects = activeFilters.projectId;
      if (!activeFilters.projectId.includes(',')) {
        const matchedProj = projects.find((p: any) => String(p.id) === String(activeFilters.projectId));
        if (matchedProj?.name) params.program = matchedProj.name;
      }
    }
    if (activeFilters.campaignId) {
      params.campaign_id = activeFilters.campaignId;
      params.campaigns = activeFilters.campaignId;
    }
    if (activeFilters.tag) {
      params.tag = activeFilters.tag;
      params.tags = activeFilters.tag;
    }
    if (activeFilters.dataType) params.data_type = activeFilters.dataType;

    // Deep Interaction & Care Cadence params
    if (activeFilters.staleDays) params.stale_days = activeFilters.staleDays;
    if (activeFilters.interactedWithinDays) params.interacted_within_days = activeFilters.interactedWithinDays;
    if (activeFilters.interactionType) params.interaction_type = activeFilters.interactionType;
    if (activeFilters.minCallCount) params.min_call_count = activeFilters.minCallCount;
    if (activeFilters.maxCallCount) params.max_call_count = activeFilters.maxCallCount;
    if (activeFilters.noteKeyword) params.note_keyword = activeFilters.noteKeyword;

    // Demographics, Academic & Financial params
    if (activeFilters.gender) params.gender = activeFilters.gender;
    if (activeFilters.city) {
      params.cities = activeFilters.city;
      params.city = activeFilters.city;
    }
    if (activeFilters.ageMin) params.age_min = activeFilters.ageMin;
    if (activeFilters.ageMax) params.age_max = activeFilters.ageMax;
    if (activeFilters.jobTitle) {
      params.job_titles = activeFilters.jobTitle;
      params.job_title = activeFilters.jobTitle;
    }
    if (activeFilters.company) {
      params.companies = activeFilters.company;
      params.company = activeFilters.company;
    }
    if (activeFilters.financialStatus) {
      params.financial_filter = activeFilters.financialStatus;
      params.deposit_status = activeFilters.financialStatus;
    }
    if (activeFilters.minDeposit) params.min_deposit = activeFilters.minDeposit;
    if (activeFilters.maxDeposit) params.max_deposit = activeFilters.maxDeposit;
    if (activeFilters.studyStatus) params.study_status = activeFilters.studyStatus;
    if (activeFilters.studentCode) params.student_code = activeFilters.studentCode;
    if (activeFilters.expectedIntake) params.expected_intake = activeFilters.expectedIntake;

    // Dynamic Schema Rules (100% DB Schema)
    const validRules = (activeFilters.customRules || []).filter(
      r => r.field && (r.operator === 'is_empty' || r.operator === 'is_not_empty' || String(r.value || '').trim() !== '')
    );
    if (validRules.length > 0) {
      params.custom_rules = JSON.stringify(validRules);
      params.custom_rules_logic = activeFilters.customRulesLogic || 'AND';
    }

    if (activeFilters.dateActive) {
      params.date_field = activeFilters.dateField;
      params.date_mode = activeFilters.dateField;
      params.date_type = activeFilters.dateType;
      if (activeFilters.dateType === 'range') {
        if (activeFilters.fromDate) params.from = activeFilters.fromDate;
        if (activeFilters.toDate) params.to = activeFilters.toDate;
      } else if (activeFilters.dateType === 'before') {
        if (activeFilters.beforeDate) params.to = activeFilters.beforeDate;
      } else if (activeFilters.dateType === 'after') {
        if (activeFilters.afterDate) params.from = activeFilters.afterDate;
      }
    }

    if (activeFilters.admissionActive) {
      if (activeFilters.admissionFrom) params.admission_from = activeFilters.admissionFrom;
      if (activeFilters.admissionTo) params.admission_to = activeFilters.admissionTo;
    }

    const effectiveTeam = activeFilters.teamId || getEffectiveTeamId();
    if (effectiveTeam) {
      params.team_id = effectiveTeam;
      if (activeFilters.teamId) params.teams = activeFilters.teamId;
    }
  };

  const fetchData = async (isSilent = false) => {
    if (fetchAbortRef.current) {
      fetchAbortRef.current.abort();
    }
    fetchAbortRef.current = new AbortController();
    const signal = fetchAbortRef.current.signal;

    if (!isSilent) setLoading(true);
    try {
      const isSearching = Boolean(debouncedSearch);

      const params: any = { 
        page, 
        limit: pageSize, 
        search: debouncedSearch, 
        sort: sortBy === 'score_desc' ? 'lead_score' : (sortBy === 'deal_desc' ? 'open_deal_value' : (sortBy === 'interaction_desc' ? 'last_contact' : 'created_at')),
        order: 'DESC'
      };

      if (isSearching) {
        // When searching, scan across ALL pipelines, stages, and segments (leads, students, applications, nurture, lost)
        params.all_pipeline = 1;
        params.show_lost = 1;
      } else {
        params.segment = segment;
        if (segment === 'customer') {
          params.student_sub_tab = studentSubTab;
        }
      }

      applyActiveFiltersToParams(params, isSearching);

      const r = await api.get('/contacts', { params, signal });
      const data = r.data.data;
      const items = data.items || [];
      const uniqueItems = Array.from(new Map(items.map((c: any) => [c.id, c])).values());
      setContacts(uniqueItems.map((c: any) => ({ ...c, score: calcScore(c, scoringRules, decayDays) })));
      setTotal(data.total || items.length);
      if (data.stage_counts && Object.keys(data.stage_counts).length > 0) {
        setStageCounts(data.stage_counts);
      }
    } catch (e: any) {
      if (e.name === 'CanceledError' || e.code === 'ERR_CANCELED' || e.message === 'canceled') {
        return; // Request was aborted due to rapid filter switch, ignore silently
      }
      setContacts([]);
      setTotal(0);
      addToast('Không thể lấy danh sách liên hệ', 'error');
    } finally {
      if (!isSilent && !signal.aborted) setLoading(false);
    }
  };

  const fetchDataRef = useRef(fetchData);
  fetchDataRef.current = fetchData;

  const prevFilterSignatureRef = useRef('');
  const currentFilterSignature = JSON.stringify([debouncedSearch, sortBy, activeFilters, segment, studentSubTab, showLost, quickLeadStatus, quickPipelineStage, filterUncontacted]);

  useEffect(() => {
    const filtersChanged = prevFilterSignatureRef.current !== '' && prevFilterSignatureRef.current !== currentFilterSignature;
    prevFilterSignatureRef.current = currentFilterSignature;

    // Clear stale bulk selection when search or filters or page changes to prevent accidental cross-page operations (DEF-UX-07)
    setSelected(new Set());

    // If filters changed and we are on a page > 1, skip this fetch and let setPage(1) trigger the clean single fetch (DEF-UX-04)
    if (filtersChanged && page > 1) {
      setPage(1);
      return;
    }

    fetchData();
  }, [page, pageSize, debouncedSearch, sortBy, activeFilters, segment, studentSubTab, showLost, quickLeadStatus, quickPipelineStage, filterUncontacted]);

  // Recalculate lead scores instantly in RAM when scoringRules finishes loading
  useEffect(() => {
    if (scoringRules && contacts.length > 0) {
      setContacts(prev => prev.map(c => ({ ...c, score: calcScore(c, scoringRules, decayDays) })));
    }
  }, [scoringRules, decayDays]);

  // Auto fallback to last available page if current page becomes empty after deletions
  useEffect(() => {
    if (total > 0 && page > 1) {
      const maxPage = Math.ceil(total / pageSize);
      if (page > maxPage) {
        setPage(maxPage);
      }
    }
  }, [total, page, pageSize]);

  useEffect(() => {
    const handleRefresh = () => {
      if (initialMetadataLoaded) {
        fetchDataRef.current(true);
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
  }, [initialMetadataLoaded]);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const isManagerOrAdmin = user && ['manager', 'admin', 'superadmin', 'director'].includes(user.role);
        
        const [
          projResult,
          stageResult,
          campaignResult,
          teamsResult,
          usersResult,
          settingsResult,
          sourcesResult
        ] = await Promise.allSettled([
          api.get('/projects?bypass_roster=1'),
          api.get('/pipeline-stages'),
          api.get('/marketing-campaigns'),
          isManagerOrAdmin ? api.get('/teams') : Promise.resolve(null),
          api.get('/users?all=1'),
          api.get('/api.php?action=get_settings'),
          api.get('/api.php?action=get_unique_sources')
        ]);

        if (projResult.status === 'fulfilled' && projResult.value) {
          const d = projResult.value.data?.data;
          setProjects(Array.isArray(d) ? d : (d?.items || []));
        }
        if (stageResult.status === 'fulfilled' && stageResult.value) {
          const d = stageResult.value.data?.data;
          const list = Array.isArray(d) ? d : (d?.items || []);
          if (list.length > 0) {
            setPipelineStages(list);
          }
        }
        if (campaignResult.status === 'fulfilled' && campaignResult.value) {
          const d = campaignResult.value.data?.data;
          setCampaigns(Array.isArray(d) ? d : (d?.items || []));
        }
        if (teamsResult.status === 'fulfilled' && teamsResult.value) {
          const d = teamsResult.value.data?.data || teamsResult.value.data || [];
          setTeams(Array.isArray(d) ? d : []);
        }
        if (usersResult.status === 'fulfilled' && usersResult.value) {
          const d = usersResult.value.data?.data;
          const list = Array.isArray(d) ? d : (d?.items || []);
          setUsers(list);
        }
        if (settingsResult.status === 'fulfilled' && settingsResult.value) {
          const sData = settingsResult.value.data?.data;
          if (settingsResult.value.data?.success && sData) {
            if (sData.lead_scoring_rules) {
              try {
                setScoringRules(JSON.parse(sData.lead_scoring_rules));
              } catch(e) {}
            }
            if (sData.temperature_decay_days) {
              const parsedDays = parseInt(sData.temperature_decay_days, 10);
              if (!isNaN(parsedDays) && parsedDays > 0) {
                setDecayDays(parsedDays);
              }
            }
          }
        }
        if (sourcesResult.status === 'fulfilled' && sourcesResult.value) {
          const srcData = sourcesResult.value.data?.data ?? sourcesResult.value.data;
          if (Array.isArray(srcData)) {
            setDynamicSources(srcData.map((x: any) => typeof x === 'string' ? x : (x?.source || '')).filter(Boolean));
          }
        }
      } catch (err) {
        console.error("Error loading metadata:", err);
      } finally {
        setInitialMetadataLoaded(true);
      }
    };
    
    if (user) {
      loadMetadata();
    }
  }, [user]);

  const formatDateDMY = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dStr;
  };

  const getAdmissionPresetRange = (preset: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    if (preset === 'this_month') {
      const end = new Date(year, month + 1, 0);
      return {
        from: `${year}-${String(month + 1).padStart(2, '0')}-01`,
        to: `${year}-${String(month + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      };
    }
    if (preset === 'next_month') {
      const nextM = month + 1;
      const targetYear = nextM > 11 ? year + 1 : year;
      const targetMonth = nextM > 11 ? 0 : nextM;
      const end = new Date(targetYear, targetMonth + 1, 0);
      return {
        from: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-01`,
        to: `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      };
    }
    if (preset === 'this_quarter') {
      const qStartMonth = Math.floor(month / 3) * 3;
      const qEndMonth = qStartMonth + 2;
      const end = new Date(year, qEndMonth + 1, 0);
      return {
        from: `${year}-${String(qStartMonth + 1).padStart(2, '0')}-01`,
        to: `${year}-${String(qEndMonth + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
      };
    }
    if (preset === 'this_year') {
      return {
        from: `${year}-01-01`,
        to: `${year}-12-31`
      };
    }
    return { from: '', to: '' };
  };

  const applyQuickAdmissionPreset = (preset: string) => {
    if (!preset) {
      setFilterAdmissionPreset('');
      setFilterAdmissionFrom('');
      setFilterAdmissionTo('');
      setActiveFilters(prev => ({
        ...prev,
        admissionPreset: '',
        admissionFrom: '',
        admissionTo: '',
        admissionActive: false
      }));
      setShowAdmissionPopover(false);
      setShowTimelinePopover(false);
      return;
    }
    const { from, to } = getAdmissionPresetRange(preset);
    setFilterAdmissionPreset(preset);
    setFilterAdmissionFrom(from);
    setFilterAdmissionTo(to);
    setActiveFilters(prev => ({
      ...prev,
      admissionPreset: preset,
      admissionFrom: from,
      admissionTo: to,
      admissionActive: true
    }));
    setShowAdmissionPopover(false);
    setShowTimelinePopover(false);
  };

  const applyCustomAdmissionRange = () => {
    if (!filterAdmissionFrom && !filterAdmissionTo) {
      applyQuickAdmissionPreset('');
      return;
    }
    setFilterAdmissionPreset('custom');
    setActiveFilters(prev => ({
      ...prev,
      admissionPreset: 'custom',
      admissionFrom: filterAdmissionFrom,
      admissionTo: filterAdmissionTo,
      admissionActive: true
    }));
    setShowAdmissionPopover(false);
    setShowTimelinePopover(false);
  };

  const getAdmissionDisplayLabel = () => {
    if (!activeFilters.admissionActive) return '';
    if (activeFilters.admissionPreset === 'this_month') return 'Tháng này';
    if (activeFilters.admissionPreset === 'next_month') return 'Tháng sau';
    if (activeFilters.admissionPreset === 'this_quarter') return 'Quý này';
    if (activeFilters.admissionPreset === 'this_year') return 'Năm nay';
    if (activeFilters.admissionFrom && activeFilters.admissionTo) {
      if (activeFilters.admissionFrom === activeFilters.admissionTo) return formatDateDMY(activeFilters.admissionFrom);
      return `${formatDateDMY(activeFilters.admissionFrom)} - ${formatDateDMY(activeFilters.admissionTo)}`;
    }
    if (activeFilters.admissionFrom) return `Từ ${formatDateDMY(activeFilters.admissionFrom)}`;
    if (activeFilters.admissionTo) return `Đến ${formatDateDMY(activeFilters.admissionTo)}`;
    return 'Đang lọc';
  };

  const toLocalYMD = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const applyQuickTimelinePreset = (preset: string) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const todayStr = toLocalYMD(now);

    let from = '';
    let to = todayStr;

    if (preset === 'today') {
      from = todayStr;
    } else if (preset === 'last_7_days') {
      const d7 = new Date(now.getTime() - 7 * 86400000);
      from = toLocalYMD(d7);
    } else if (preset === 'this_month') {
      const end = new Date(year, month + 1, 0);
      from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      to = `${year}-${String(month + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    } else if (preset === 'last_30_days') {
      const d30 = new Date(now.getTime() - 30 * 86400000);
      from = toLocalYMD(d30);
    }

    setFilterFromDate(from);
    setFilterToDate(to);
    setDateFilterType('range');
    setActiveFilters(prev => ({
      ...prev,
      dateField: filterDateField as any,
      dateType: 'range',
      fromDate: from,
      toDate: to,
      beforeDate: '',
      afterDate: '',
      dateActive: true
    }));
    setShowTimelinePopover(false);
  };

  const applyCustomTimelineRange = () => {
    if (!filterFromDate && !filterToDate) {
      removeActiveFilterTag('date');
      setShowTimelinePopover(false);
      return;
    }
    setActiveFilters(prev => ({
      ...prev,
      dateField: filterDateField as any,
      dateType: 'range',
      fromDate: filterFromDate,
      toDate: filterToDate,
      beforeDate: '',
      afterDate: '',
      dateActive: true
    }));
    setShowTimelinePopover(false);
  };

  const getTimelineDisplayLabel = () => {
    if (!activeFilters.dateActive) return '';
    if (activeFilters.fromDate && activeFilters.toDate) {
      if (activeFilters.fromDate === activeFilters.toDate) return formatDateDMY(activeFilters.fromDate);
      return `${formatDateDMY(activeFilters.fromDate)} - ${formatDateDMY(activeFilters.toDate)}`;
    }
    if (activeFilters.fromDate) return `Từ ${formatDateDMY(activeFilters.fromDate)}`;
    if (activeFilters.toDate) return `Đến ${formatDateDMY(activeFilters.toDate)}`;
    if (activeFilters.beforeDate) return `Trước ${formatDateDMY(activeFilters.beforeDate)}`;
    if (activeFilters.afterDate) return `Sau ${formatDateDMY(activeFilters.afterDate)}`;
    return 'Đang lọc';
  };

  const getStageName = (statusId: string) => {
    if (!statusId) return '';
    return statusId
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .map(id => {
        if (id === 'not_contacted') return 'Chưa liên hệ';
        const found = pipelineStages.find(s => String(s.id) === id || s.system_slug === id);
        return found?.name || id;
      })
      .join(', ');
  };

  const getLeadStatusLabel = (csv: string) => {
    if (!csv) return '';
    const map: Record<string, string> = {
      active: 'Đang hoạt động',
      nurture: 'Nuôi dưỡng',
      lost: 'Không tiềm năng (Lost)'
    };
    return csv.split(',').map(s => s.trim()).filter(Boolean).map(s => map[s] || s).join(', ');
  };

  const removeActiveFilterTag = (key: string) => {
    if (key === 'admission') {
      setFilterAdmissionPreset('');
      setFilterAdmissionFrom('');
      setFilterAdmissionTo('');
      setActiveFilters(prev => ({ ...prev, admissionPreset: '', admissionFrom: '', admissionTo: '', admissionActive: false }));
    } else if (key === 'date') {
      setFilterFromDate('');
      setFilterToDate('');
      setFilterBeforeDate('');
      setFilterAfterDate('');
      setActiveFilters(prev => ({ ...prev, fromDate: '', toDate: '', beforeDate: '', afterDate: '', dateActive: false }));
    } else if (key === 'status') {
      setFilterStatus('');
      setActiveFilters(prev => ({ ...prev, status: '' }));
    } else if (key === 'leadStatus') {
      setFilterLeadStatus('');
      setActiveFilters(prev => ({ ...prev, leadStatus: '' }));
    } else if (key === 'ownerId') {
      setFilterOwnerId('');
      setActiveFilters(prev => ({ ...prev, ownerId: '' }));
    } else if (key === 'teamId') {
      setFilterTeamId('');
      setActiveFilters(prev => ({ ...prev, teamId: '' }));
    } else if (key === 'projectId') {
      setFilterProjectId('');
      setActiveFilters(prev => ({ ...prev, projectId: '' }));
    } else if (key === 'campaignId') {
      setFilterCampaignId('');
      setActiveFilters(prev => ({ ...prev, campaignId: '' }));
    } else if (key === 'source') {
      setFilterSource('');
      setActiveFilters(prev => ({ ...prev, source: '' }));
    } else if (key === 'dataType') {
      setFilterDataType('');
      setActiveFilters(prev => ({ ...prev, dataType: '' }));
    } else if (key === 'tag') {
      setFilterTag('');
      setActiveFilters(prev => ({ ...prev, tag: '' }));
    } else if (key === 'interactionStatus') {
      setFilterInteractionStatus('');
      setActiveFilters(prev => ({ ...prev, interactionStatus: '' }));
    } else if (key === 'staleDays') {
      setFilterStaleDays('');
      setActiveFilters(prev => ({ ...prev, staleDays: '' }));
    } else if (key === 'interactedWithinDays') {
      setFilterInteractedWithinDays('');
      setActiveFilters(prev => ({ ...prev, interactedWithinDays: '' }));
    } else if (key === 'interactionType') {
      setFilterInteractionType('');
      setActiveFilters(prev => ({ ...prev, interactionType: '' }));
    } else if (key === 'callCount') {
      setFilterMinCallCount('');
      setFilterMaxCallCount('');
      setActiveFilters(prev => ({ ...prev, minCallCount: '', maxCallCount: '' }));
    } else if (key === 'noteKeyword') {
      setFilterNoteKeyword('');
      setActiveFilters(prev => ({ ...prev, noteKeyword: '' }));
    } else if (key === 'gender') {
      setFilterGender('');
      setActiveFilters(prev => ({ ...prev, gender: '' }));
    } else if (key === 'city') {
      setFilterCity('');
      setActiveFilters(prev => ({ ...prev, city: '' }));
    } else if (key === 'age') {
      setFilterAgeMin('');
      setFilterAgeMax('');
      setActiveFilters(prev => ({ ...prev, ageMin: '', ageMax: '' }));
    } else if (key === 'jobTitle') {
      setFilterJobTitle('');
      setActiveFilters(prev => ({ ...prev, jobTitle: '' }));
    } else if (key === 'company') {
      setFilterCompany('');
      setActiveFilters(prev => ({ ...prev, company: '' }));
    } else if (key === 'financialStatus') {
      setFilterFinancialStatus('');
      setActiveFilters(prev => ({ ...prev, financialStatus: '' }));
    } else if (key === 'depositAmount') {
      setFilterMinDeposit('');
      setFilterMaxDeposit('');
      setActiveFilters(prev => ({ ...prev, minDeposit: '', maxDeposit: '' }));
    } else if (key === 'studyStatus') {
      setFilterStudyStatus('');
      setActiveFilters(prev => ({ ...prev, studyStatus: '' }));
    } else if (key === 'studentCode') {
      setFilterStudentCode('');
      setActiveFilters(prev => ({ ...prev, studentCode: '' }));
    } else if (key === 'expectedIntake') {
      setFilterExpectedIntake('');
      setActiveFilters(prev => ({ ...prev, expectedIntake: '' }));
    } else if (key === 'customRules') {
      setCustomRules([]);
      setActiveFilters(prev => ({ ...prev, customRules: [] }));
    } else if (key === 'multiProgram') {
      setFilterMultiProgram(false);
      setActiveFilters(prev => ({ ...prev, multiProgram: false }));
    } else if (key === 'showLost') {
      setFilterShowLost(false);
      setActiveFilters(prev => ({ ...prev, showLost: false }));
    } else if (key === 'uncontacted') {
      setFilterUncontacted(false);
    }
  };

  const handleApplyFilters = () => {
    setPage(1);
    const hasAdmission = Boolean(filterAdmissionFrom || filterAdmissionTo || filterAdmissionPreset);
    const dateActive = 
      (dateFilterType === 'range' && (filterFromDate || filterToDate)) ||
      (dateFilterType === 'before' && filterBeforeDate) ||
      (dateFilterType === 'after' && filterAfterDate);

    setActiveFilters({
      status: filterStatus,
      stageOp: filterStageOp,
      leadStatus: filterLeadStatus,
      leadStatusOp: filterLeadStatusOp,
      showLost: filterShowLost,
      source: filterSource,
      ownerId: filterOwnerId,
      teamId: filterTeamId,
      projectId: filterProjectId,
      campaignId: filterCampaignId,
      tag: filterTag.trim(),
      interactionStatus: filterInteractionStatus,
      staleDays: filterStaleDays.trim(),
      interactedWithinDays: filterInteractedWithinDays.trim(),
      interactionType: filterInteractionType,
      minCallCount: filterMinCallCount.trim(),
      maxCallCount: filterMaxCallCount.trim(),
      noteKeyword: filterNoteKeyword.trim(),
      gender: filterGender,
      city: filterCity,
      ageMin: filterAgeMin.trim(),
      ageMax: filterAgeMax.trim(),
      jobTitle: filterJobTitle.trim(),
      company: filterCompany.trim(),
      financialStatus: filterFinancialStatus,
      minDeposit: filterMinDeposit.trim(),
      maxDeposit: filterMaxDeposit.trim(),
      studyStatus: filterStudyStatus,
      studentCode: filterStudentCode.trim(),
      expectedIntake: filterExpectedIntake.trim(),
      customRules: customRules.map(r => ({ ...r })),
      customRulesLogic,
      dateField: filterDateField as any,
      dateType: dateFilterType,
      fromDate: filterFromDate,
      toDate: filterToDate,
      beforeDate: filterBeforeDate,
      afterDate: filterAfterDate,
      dateActive: !!dateActive,
      admissionFrom: filterAdmissionFrom,
      admissionTo: filterAdmissionTo,
      admissionPreset: filterAdmissionPreset,
      admissionActive: !!hasAdmission,
      dataType: filterDataType,
      multiProgram: filterMultiProgram
    });
    setShowAdvancedFilters(false);
  };

  const handleResetFilters = () => {
    setFilterUncontacted(false);
    setFilterMultiProgram(false);
    setFilterDataType('');
    setFilterStatus('');
    setFilterStageOp('in');
    setFilterLeadStatus('');
    setFilterLeadStatusOp('in');
    setFilterShowLost(false);
    setShowLost(false);
    setQuickLeadStatus('');
    setFilterSource('');
    setFilterOwnerId('');
    setFilterTeamId('');
    setFilterProjectId('');
    setFilterCampaignId('');
    setFilterTag('');
    setFilterInteractionStatus('');
    setFilterStaleDays('');
    setFilterInteractedWithinDays('');
    setFilterInteractionType('');
    setFilterMinCallCount('');
    setFilterMaxCallCount('');
    setFilterNoteKeyword('');
    setFilterGender('');
    setFilterCity('');
    setFilterAgeMin('');
    setFilterAgeMax('');
    setFilterJobTitle('');
    setFilterCompany('');
    setFilterFinancialStatus('');
    setFilterMinDeposit('');
    setFilterMaxDeposit('');
    setFilterStudyStatus('');
    setFilterStudentCode('');
    setFilterExpectedIntake('');
    setCustomRules([]);
    setCustomRulesLogic('AND');
    setFilterDateField('created_at');
    setDateFilterType('range');
    setFilterFromDate('');
    setFilterToDate('');
    setFilterBeforeDate('');
    setFilterAfterDate('');
    setFilterAdmissionPreset('');
    setFilterAdmissionFrom('');
    setFilterAdmissionTo('');
    setPage(1);
    setActiveFilters({
      status: '',
      stageOp: 'in',
      leadStatus: '',
      leadStatusOp: 'in',
      showLost: false,
      source: '',
      ownerId: '',
      teamId: '',
      projectId: '',
      campaignId: '',
      tag: '',
      interactionStatus: '',
      staleDays: '',
      interactedWithinDays: '',
      interactionType: '',
      minCallCount: '',
      maxCallCount: '',
      noteKeyword: '',
      gender: '',
      city: '',
      ageMin: '',
      ageMax: '',
      jobTitle: '',
      company: '',
      financialStatus: '',
      minDeposit: '',
      maxDeposit: '',
      studyStatus: '',
      studentCode: '',
      expectedIntake: '',
      customRules: [],
      customRulesLogic: 'AND',
      dateField: 'created_at',
      dateType: 'range',
      fromDate: '',
      toDate: '',
      beforeDate: '',
      afterDate: '',
      dateActive: false,
      admissionFrom: '',
      admissionTo: '',
      admissionPreset: '',
      admissionActive: false,
      dataType: '',
      multiProgram: false
    });
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCreateModal && !creating) {
        setShowCreateModal(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showCreateModal, creating]);

  const paged = useMemo(() => {
    if (segment === 'tiem_nang' && !debouncedSearch && quickPipelineStage === 'all' && !activeFilters.status) {
      return contacts.filter(c => {
        const isEnrolled = c.stage_id === 44 || c.pipeline_status === 'enrolled' || c.status === 'customer' || c.stage_name === '14 – Enrolled' || c.stage_name === 'Học viên';
        return !isEnrolled;
      });
    }
    return contacts;
  }, [contacts, segment, debouncedSearch, quickPipelineStage, activeFilters.status]);

  const toggleSelect = (id: number) => setSelected(p => { 
    const n = new Set(p); 
    if (n.has(id)) n.delete(id); 
    else n.add(id); 
    return n; 
  });
  const toggleAll = () => setSelected(selected.size===paged.length ? new Set() : new Set(paged.map(c=>c.id)));

  const bulkDeleteInFlightRef = useRef(false);
  const bulkExportInFlightRef = useRef(false);
  const createContactInFlightRef = useRef(false);

  const bulkDelete = () => {
    if (bulkDeleteInFlightRef.current) return;
    showConfirm({
      title: `Xóa ${selected.size} liên hệ?`,
      message: `Bạn có chắc chắn muốn xóa vĩnh viễn các liên hệ đã chọn? Thao tác này không thể hoàn tác.`,
      isDanger: true,
      impactInfo: `Cảnh báo: Thao tác này sẽ xóa vĩnh viễn ${selected.size} liên hệ và toàn bộ lịch sử giao dịch liên quan.`,
      requireWordMatch: selected.size > 10 ? 'DELETE' : undefined,
      confirmText: 'Xác nhận xóa vĩnh viễn',
      onConfirm: async () => {
        if (bulkDeleteInFlightRef.current) return;
        bulkDeleteInFlightRef.current = true;
        try {
          await api.post('/contacts/bulk-delete', { ids: Array.from(selected) });
          setContacts(p => p.filter(c => !selected.has(c.id)));
          addToast(`Đã xóa ${selected.size} liên hệ thành công`, 'success');
          setSelected(new Set());
        } catch (e: any) {
          addToast(e.response?.data?.message || 'Lỗi khi xóa liên hệ', 'error');
        } finally {
          bulkDeleteInFlightRef.current = false;
          closeConfirm();
        }
      }
    });
  };

  const contextStatuses = useMemo(() => {
    const stagesToUse = (pipelineStages && pipelineStages.length > 0) ? pipelineStages : DEFAULT_PIPELINE_STAGES;
    const list = stagesToUse.map(s => ({
      id: String(s.id),
      label: s.name,
      color: s.color || '#3b82f6'
    }));
    list.push(
      { id: 'nurture', label: 'Chăm sóc lại (Nurture)', color: '#0284c7' },
      { id: 'lost', label: 'Không tiềm năng (Lost)', color: '#ef4444' }
    );
    return list;
  }, [pipelineStages]);

  const handleContextChangeStatus = async (item: any, newStatus: string) => {
    try {
      if (newStatus === 'nurture' || newStatus === 'lost') {
        await api.put(`/contacts/${item.id}`, { lead_status: newStatus });
        setContacts(prev => prev.map(c => c.id === item.id ? { ...c, lead_status: newStatus } : c));
      } else {
        await api.put(`/contacts/${item.id}`, { stage_id: Number(newStatus) });
        const stageObj = pipelineStages.find(s => String(s.id) === String(newStatus));
        setContacts(prev => prev.map(c => c.id === item.id ? { 
          ...c, 
          stage_id: Number(newStatus),
          stage_name: stageObj?.name || c.stage_name,
          stage_color: stageObj?.color || c.stage_color
        } : c));
      }
      addToast('Đã cập nhật trạng thái liên hệ!', 'success');
    } catch (err: any) {
      addToast(err?.response?.data?.message || 'Không thể cập nhật trạng thái', 'error');
    }
  };

  const handleContextDelete = (item: any) => {
    showConfirm({
      title: `Xóa liên hệ ${item.full_name || item.name || '#' + item.id}?`,
      message: 'Bạn có chắc chắn muốn xóa liên hệ này? Thao tác không thể hoàn tác.',
      isDanger: true,
      confirmText: 'Xác nhận xóa',
      onConfirm: async () => {
        try {
          await api.delete(`/contacts/${item.id}`);
          setContacts(prev => prev.filter(c => c.id !== item.id));
          addToast('Đã xóa liên hệ thành công', 'success');
        } catch (err: any) {
          addToast(err?.response?.data?.message || 'Lỗi khi xóa liên hệ', 'error');
        } finally {
          closeConfirm();
        }
      }
    });
  };

  const bulkExport = async (mode: 'filtered' | 'full' = 'filtered') => {
    if (bulkExportInFlightRef.current || isExporting) return;
    bulkExportInFlightRef.current = true;
    setIsExporting(true);
    const isStudent = segment === 'customer';
    const isSearching = mode === 'filtered' && Boolean(debouncedSearch);
    const params: Record<string, any> = {
      type: 'contact',
      export_mode: mode,
      ...(!isSearching ? {
        segment: segment || 'all',
        ...(isStudent && studentSubTab ? { student_sub_tab: studentSubTab } : {})
      } : {})
    };

    if (mode === 'filtered') {
      if (isSearching) {
        params.search = debouncedSearch;
        params.all_pipeline = 1;
        params.show_lost = 1;
        params.include_lost = 1;
      }
      applyActiveFiltersToParams(params, isSearching);
    }

    const filenamePrefix = isStudent 
      ? (studentSubTab === 'chinh_thuc' ? 'danh_sach_hoc_vien_chinh_thuc' : studentSubTab === 'le_phi' ? 'danh_sach_le_phi_ho_so' : studentSubTab === 'nop_ho_so' ? 'danh_sach_nop_ho_so' : 'danh_sach_hoc_vien')
      : 'danh_sach_lien_he';
    const defaultFilename = mode === 'full' ? `${filenamePrefix}_tat_ca_truong_${Date.now()}.csv` : `${filenamePrefix}_${Date.now()}.csv`;

    addToast(
      mode === 'full' 
        ? `Đang xuất toàn bộ dữ liệu ${isStudent ? 'học viên' : 'liên hệ'} (đầy đủ 100% trường)...` 
        : `Đang xuất dữ liệu ${isStudent ? 'học viên' : 'liên hệ'} theo bộ lọc đang xem...`, 
      'info'
    );
    try {
      await downloadExportFile({
        endpoint: '/export',
        params,
        defaultFilename,
        onSuccess: () => {
          addToast(
            mode === 'full' 
              ? `Tải xuống toàn bộ dữ liệu ${isStudent ? 'học viên' : 'liên hệ'} thành công!` 
              : `Tải xuống danh sách ${isStudent ? 'học viên' : 'liên hệ'} theo bộ lọc thành công!`, 
            'success'
          );
        },
      });
    } catch (err: any) {
      addToast(err?.message || 'Xuất danh sách thất bại. Vui lòng thử lại sau.', 'error');
    } finally {
      bulkExportInFlightRef.current = false;
      setIsExporting(false);
    }
  };
  const bulkTag = () => {
    if (selected.size === 0) return;
    showConfirm({
      title: 'Gán Tag hàng loạt',
      message: `Nhập tên tag cần gắn cho ${selected.size} liên hệ đã chọn:`,
      confirmText: 'Gắn Tag',
      cancelText: 'Hủy',
      requirePromptInput: true,
      promptPlaceholder: 'Nhập tên tag (ví dụ: VIP, Tiềm năng, Cần gọi lại)...',
      onConfirm: async (tagName) => {
        const cleanTag = (tagName || '').trim();
        if (!cleanTag) {
          addToast('Vui lòng nhập tên tag', 'error');
          return;
        }
        try {
          const contactIds = Array.from(selected);
          for (const cid of contactIds) {
            try {
              await api.post(`/contacts/${cid}/tags`, { name: cleanTag });
            } catch {}
          }
          addToast(`Đã gắn tag "${cleanTag}" cho ${contactIds.length} liên hệ`, 'success');
          setSelected(new Set());
          fetchData(true);
        } catch (err: any) {
          addToast('Lỗi khi gắn tag: ' + err.message, 'error');
        }
      }
    });
  };

  const bulkEmail = () => {
    if (selected.size === 0) return;
    const emails = contacts.filter(c => selected.has(c.id) && c.email).map(c => c.email);
    if (emails.length === 0) {
      addToast('Không có liên hệ nào trong danh sách đã chọn có địa chỉ Email!', 'warning');
      return;
    }
    window.open(`mailto:${emails.join(',')}`);
  };

  const bulkAssign = () => {
    if (selected.size === 0) return;
    setBulkAssignTargetUserId('');
    setShowBulkAssignModal(true);
  };

  const handleExecuteBulkAssign = async () => {
    if (!bulkAssignTargetUserId) {
      addToast('Vui lòng chọn nhân sự phụ trách', 'error');
      return;
    }
    setIsBulkAssigning(true);
    try {
      const contactIds = Array.from(selected);
      let successCount = 0;
      for (const cid of contactIds) {
        try {
          await api.post(`/contacts/${cid}/assign`, { owner_id: Number(bulkAssignTargetUserId) });
          successCount++;
        } catch (err) {}
      }
      addToast(`Đã điều chuyển thành công ${successCount}/${contactIds.length} khách hàng!`, 'success');
      setShowBulkAssignModal(false);
      setSelected(new Set());
      fetchData(true);
    } catch (e: any) {
      addToast('Lỗi khi điều chuyển: ' + (e.response?.data?.message || e.message), 'error');
    } finally {
      setIsBulkAssigning(false);
    }
  };

  const handleCreateContact = async () => {
    if (createContactInFlightRef.current || creating) return;
    if (!createForm.full_name.trim()) { addToast('Vui lòng nhập họ tên', 'error'); return; }
    
    // Yêu cầu ít nhất email hoặc số điện thoại (trừ nguồn Giới thiệu và Cá nhân tự khai thác)
    const isReferralOrPersonal = createForm.source === 'gioi_thieu' || createForm.source === 'ca_nhan';
    if (!isReferralOrPersonal && !createForm.email.trim() && !createForm.phone.trim()) {
      addToast('Vui lòng cung cấp ít nhất Email hoặc Số điện thoại (trừ nguồn Giới thiệu / Cá nhân)', 'error');
      return;
    }

    createContactInFlightRef.current = true;
    setCreating(true);
    try {
      const r = await api.post('/contacts', createForm);
      const newContact = r.data.data;
      if (newContact && newContact.id) {
        setContacts(prev => [newContact, ...prev.filter(c => c && c.id !== newContact.id)]);
      }
      setShowCreateModal(false);
      setCreateForm({ full_name: '', email: '', phone: '', company_name: '', job_title: '', status: 'lead', source: 'other', owner_id: '', city: '', ward: '', address: '' });
      addToast('Đã thêm liên hệ mới thành công', 'success');
      window.dispatchEvent(new CustomEvent('notification-trigger'));
    } catch (e: any) {
      addToast(e.response?.data?.message || 'Không thể tạo liên hệ', 'error');
    } finally {
      createContactInFlightRef.current = false;
      setCreating(false);
    }
  };

  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: contacts.length, hot: 0, customer: 0, has_deal: 0, no_contact: 0, new_week: 0 };
    contacts.forEach(c => {
      if (!c) return;
      const days = AGO_DAYS(c.last_contact);
      if (c.score >= 80) counts.hot++;
      if (c.status === 'customer') counts.customer++;
      if ((c.open_deal_value || 0) > 0) counts.has_deal++;
      if (days > 30) counts.no_contact++;
      if (days <= 7) counts.new_week++;
    });
    return counts;
  }, [contacts]);

  return (
    <div className="page-container contacts-page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: isMobile ? '0.75rem' : '1.5rem' }}>
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 className="page-title" style={{ margin: 0 }}>{segment === 'customer' ? (studentSubTab === 'le_phi' ? 'Lệ phí hồ sơ' : studentSubTab === 'nop_ho_so' ? 'Nộp hồ sơ' : 'Học viên chính thức') : 'Tiềm năng'}</h1>
              {activeMainTab === 'list' && (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', fontWeight: 600, marginTop: '2px' }}>
                  {loading ? '(...)' : `(${total} liên hệ)`}
                </span>
              )}
            </div>

            {isManagerOrAbove && segment === 'tiem_nang' && (
              <div style={{
                display: 'inline-flex',
                background: 'var(--color-border-light)',
                border: '1px solid var(--color-border)',
                padding: '2px',
                borderRadius: '9px',
                gap: '2px'
              }}>
                <button
                  type="button"
                  onClick={() => setActiveMainTab('list')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 12px',
                    borderRadius: '7px',
                    border: 'none',
                    background: activeMainTab === 'list' ? 'var(--color-surface)' : 'transparent',
                    color: activeMainTab === 'list' ? 'var(--color-text)' : 'var(--color-text-muted)',
                    fontWeight: activeMainTab === 'list' ? 700 : 500,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: activeMainTab === 'list' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Users size={14} />
                  <span>Danh sách Tiềm năng</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMainTab('performance')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 12px',
                    borderRadius: '7px',
                    border: 'none',
                    background: activeMainTab === 'performance' ? 'var(--color-surface)' : 'transparent',
                    color: activeMainTab === 'performance' ? 'var(--color-primary, #bd1d2d)' : 'var(--color-text-muted)',
                    fontWeight: activeMainTab === 'performance' ? 700 : 500,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: activeMainTab === 'performance' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <BarChart3 size={14} />
                  <span>Dashboard Hiệu suất</span>
                  <span style={{
                    fontSize: '0.65rem',
                    padding: '1px 5px',
                    borderRadius: '6px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: 'var(--color-primary, #bd1d2d)',
                    fontWeight: 700
                  }}>
                    Manager
                  </span>
                </button>
              </div>
            )}
          </div>
          {segment === 'customer' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className={`btn ${studentSubTab === 'chinh_thuc' ? 'primary' : 'outline'} sm`}
                onClick={() => {
                  setSearchParams({ tab: 'chinh_thuc' });
                  setPage(1);
                }}
                style={{
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: studentSubTab === 'chinh_thuc' ? 700 : 500,
                  padding: '6px 14px'
                }}
              >
                Học viên chính thức {studentCounts.chinh_thuc !== undefined ? `(${studentCounts.chinh_thuc})` : ''}
              </button>
              <button
                type="button"
                className={`btn ${studentSubTab === 'le_phi' ? 'primary' : 'outline'} sm`}
                onClick={() => {
                  setSearchParams({ tab: 'le_phi' });
                  setPage(1);
                }}
                style={{
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: studentSubTab === 'le_phi' ? 700 : 500,
                  padding: '6px 14px'
                }}
              >
                Lệ phí hồ sơ {studentCounts.le_phi !== undefined ? `(${studentCounts.le_phi})` : ''}
              </button>
              <button
                type="button"
                className={`btn ${studentSubTab === 'nop_ho_so' ? 'primary' : 'outline'} sm`}
                onClick={() => {
                  setSearchParams({ tab: 'nop_ho_so' });
                  setPage(1);
                }}
                style={{
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: studentSubTab === 'nop_ho_so' ? 700 : 500,
                  padding: '6px 14px'
                }}
              >
                Nộp hồ sơ {studentCounts.nop_ho_so !== undefined ? `(${studentCounts.nop_ho_so})` : ''}
              </button>
            </div>
          )}
        </div>
        
        {/* Render header action buttons */}
        {activeMainTab === 'list' && (
          <div className="flex gap-2" style={{ alignItems: 'center' }}>
            {canAddOrAssign && (
            <>
              <button 
                className="btn primary sm" 
                onClick={() => setShowCreateModal(true)} 
                title="Thêm data mới"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 700 }}
              >
                <Plus size={15} />
                <span>Thêm data</span>
              </button>
              <button 
                className="btn outline sm" 
                onClick={() => window.dispatchEvent(new CustomEvent('open-quick-add-lead'))} 
                title="Giao data / chia data nhanh cho Sales"
                style={{ 
                  display: 'inline-flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  whiteSpace: 'nowrap',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  background: 'rgba(219, 39, 119, 0.08)',
                  borderColor: 'rgba(219, 39, 119, 0.3)',
                  color: '#be185d'
                }}
              >
                <UserCheck size={15} />
                <span>Giao data</span>
              </button>
            </>
          )}
          {!isMobile && (
            <>
              {user?.role !== 'viewer' && !isSale && (
                <button 
                  className="btn outline sm" 
                  onClick={() => setShowImportExport(true)} 
                  title="Nhập dữ liệu từ Excel/CSV"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap', borderRadius: '8px', padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  <Upload size={14} />
                  <span className="hide-on-mobile">Nhập dữ liệu</span>
                </button>
              )}
              {user?.role !== 'viewer' && user?.role !== 'sale' && (
                <div style={{ position: 'relative' }} ref={exportDropdownRef}>
                  <button 
                    className="btn outline sm" 
                    onClick={() => setShowExportDropdown(!showExportDropdown)} 
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
                          <div style={{ marginTop: '2px', color: 'var(--color-primary)' }}>
                            <Filter size={15} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>Xuất theo bộ lọc đang xem</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Xuất chuẩn theo các tiêu chí & bộ lọc trên màn hình</div>
                          </div>
                        </button>

                        <div style={{ height: '1px', background: 'var(--color-border-light)', margin: '2px 0' }} />

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
                          <div style={{ marginTop: '2px', color: 'var(--color-success)' }}>
                            <Download size={15} />
                          </div>
                          <div>
                            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text)' }}>Xuất toàn bộ dữ liệu</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>Tất cả 100% trường khách hàng (hồ sơ, đào tạo, CRM...)</div>
                          </div>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </div>
        )}
      </div>

      {activeMainTab === 'performance' && isManagerOrAbove && segment === 'tiem_nang' ? (
        <SalesLeadPerformanceDeck embedInPage="contacts" />
      ) : (
        <>
          {/* QUICK STATUS TABS (1 hàng ngang kéo chuột / lướt xem đầy đủ dữ liệu có nút next/prev) */}
          {segment !== 'customer' && (
        <div style={{ position: 'relative', marginBottom: '0.85rem' }}>
          {/* Nút cuộn sang trái */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollPipeline('left')}
              title="Cuộn sang trái"
              style={{
                position: 'absolute',
                left: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--color-primary, #BD1D2D)',
                border: 'none',
                boxShadow: '0 2px 8px rgba(189, 29, 45, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#ffffff',
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Vùng tabs 1 hàng ngang kéo chuột mượt mà */}
          <div
            ref={pipelineScrollRef}
            onScroll={checkPipelineScroll}
            onMouseDown={handlePipelineMouseDown}
            onMouseLeave={handlePipelineMouseLeave}
            onMouseUp={handlePipelineMouseUp}
            onMouseMove={handlePipelineMouseMove}
            onWheel={handlePipelineWheel}
            className="no-scrollbar"
            style={{
              display: 'flex',
              flexWrap: 'nowrap',
              alignItems: 'center',
              gap: '8px',
              padding: isMobile ? '8px 10px' : '10px 14px',
              background: 'var(--color-surface)',
              borderRadius: '12px',
              border: '1px solid var(--color-border)',
              boxShadow: 'var(--shadow-sm)',
              overflowX: 'auto',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch',
              cursor: isPipelineDownRef.current ? 'grabbing' : 'grab',
              userSelect: 'none'
            }}
          >
            {PIPELINE_TABS.map((tab) => {
              const isActive = quickPipelineStage === tab.id || (Boolean(tab.slug) && quickPipelineStage === tab.slug);
              const count = getTabCount(tab);
              const isNewLeadTab = String(tab.id) === '31' || tab.slug === 'new_lead' || /^01\b|new\s*lead/i.test(String(tab.label || ''));
              const activeColor = isNewLeadTab ? '#dc2626' : tab.color;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (!hasPipelineDraggedRef.current) {
                      handleSelectQuickTab(tab.id);
                    }
                  }}
                  title={`${tab.label}: ${count.toLocaleString('vi-VN')} liên hệ`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: isMobile ? '5px 10px' : '6px 13px',
                    borderRadius: '20px',
                    fontSize: isMobile ? '0.72rem' : '0.77rem',
                    fontWeight: isActive || isNewLeadTab ? 700 : 500,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                    border: isActive ? `1.5px solid ${activeColor}` : (isNewLeadTab ? '1.5px solid rgba(220, 38, 38, 0.35)' : '1px solid var(--color-border)'),
                    background: isActive ? `${activeColor}18` : 'var(--color-bg)',
                    color: isActive ? activeColor : 'var(--color-text)',
                    boxShadow: isActive ? `0 2px 8px ${activeColor}28` : 'none'
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: activeColor,
                      flexShrink: 0
                    }}
                  />
                  <span>{tab.label}</span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '10px',
                      background: isNewLeadTab ? '#dc2626' : (isActive ? tab.color : 'var(--color-bg-light)'),
                      color: isNewLeadTab ? '#ffffff' : (isActive ? '#ffffff' : 'var(--color-text-muted)'),
                      boxShadow: isNewLeadTab ? '0 2px 6px rgba(220, 38, 38, 0.35)' : 'none',
                      marginLeft: '2px',
                      minWidth: '18px',
                      textAlign: 'center',
                      lineHeight: '1.4'
                    }}
                  >
                    {loading && !Object.keys(stageCounts).length ? '...' : (count > 999 ? count.toLocaleString('vi-VN') : count)}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Nút cuộn sang phải */}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollPipeline('right')}
              title="Cuộn sang phải"
              style={{
                position: 'absolute',
                right: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                background: 'var(--color-primary, #BD1D2D)',
                border: 'none',
                boxShadow: '0 2px 8px rgba(189, 29, 45, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#ffffff',
                transition: 'all 0.15s ease'
              }}
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      {/* Search + filter row */}
      <div className={isMobile ? "" : "card"} style={{ padding: isMobile ? '0' : '0.75rem 1rem', marginBottom:'0.75rem', display:'flex', gap:'0.75rem', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', background: isMobile ? 'transparent' : undefined, border: isMobile ? 'none' : undefined, boxShadow: isMobile ? 'none' : undefined }}>
        {isMobile ? (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center', width: '100%', position: 'relative' }}>
            <div className="filter-search" style={{ flex: 1, position: 'relative', height: '36px', borderRadius: '8px', border: '1px solid var(--color-border)', boxSizing: 'border-box', padding: 0, display: 'flex', alignItems: 'center', marginBottom: 0 }}>
              <Search size={12} style={{ color:'var(--color-text-muted)', marginLeft: '8px', marginRight: '4px', flexShrink: 0 }}/>
              <input 
                placeholder="Tìm tên (có/không dấu), SĐT, email toàn hệ thống..." 
                value={search} 
                onChange={e=>{setSearch(e.target.value);setPage(1);}} 
                style={{ border: 'none', background: 'transparent', outline: 'none', padding: '0 8px', height: '100%', fontSize: '0.75rem', flex: 1, minWidth: 0 }}
              />
              <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                <AnimatePresence>
                  {search && (
                    <motion.button 
                      initial={{ opacity: 0, scale: 0.8 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.15 }}
                      className="btn-icon-bare" 
                      onClick={() => setSearch('')} 
                      style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'transparent' }}
                    >
                      <X size={12} style={{ color: 'var(--color-text-muted)' }}/>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </div>
 
            {/* More Actions Trigger (...) */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button 
                className="mobile-more-btn"
                onClick={() => setShowMobileActions(!showMobileActions)}
                style={{
                  height: '36px',
                  width: '36px',
                  minWidth: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  background: showMobileActions ? 'var(--color-border-light)' : 'var(--color-surface)',
                  color: 'var(--color-text)',
                  outline: 'none',
                  boxShadow: 'var(--shadow-sm)',
                  padding: 0,
                  boxSizing: 'border-box',
                  transition: 'all 0.2s'
                }}
              >
                <MoreHorizontal size={16} />
              </button>
 
              {/* Mobile Actions Dropdown */}
              <AnimatePresence>
                {showMobileActions && (
                  <>
                    {/* Backdrop to close dropdown */}
                    <div 
                      onClick={() => setShowMobileActions(false)} 
                      style={{ position: 'fixed', inset: 0, zIndex: 998, background: 'transparent' }}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '38px',
                        width: '200px',
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '12px',
                        boxShadow: 'var(--shadow-lg)',
                        padding: '6px',
                        zIndex: 999,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px'
                      }}
                    >
                      {/* Advanced Filter Toggle */}
                      <button
                        onClick={() => {
                          setShowAdvancedFilters(!showAdvancedFilters);
                          setShowMobileActions(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          background: showAdvancedFilters ? 'var(--color-bg-light)' : 'transparent',
                          color: showAdvancedFilters ? 'var(--color-primary)' : 'var(--color-text)',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        <Filter size={12} />
                        <span>Bộ lọc nâng cao</span>
                        {activeFiltersCount > 0 && (
                          <span
                            style={{
                              background: 'var(--color-danger, #ef4444)',
                              color: '#ffffff',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              borderRadius: '50%',
                              minWidth: '16px',
                              height: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0 4px',
                              marginLeft: 'auto',
                              lineHeight: 1
                            }}
                          >
                            {activeFiltersCount}
                          </span>
                        )}
                      </button>

                      {/* Quick Filter: Chưa tương tác */}
                      <button
                        onClick={() => {
                          setFilterUncontacted(!filterUncontacted);
                          setPage(1);
                          setShowMobileActions(false);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          width: '100%',
                          padding: '8px 12px',
                          border: 'none',
                          background: filterUncontacted ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                          color: filterUncontacted ? '#ef4444' : 'var(--color-text)',
                          borderRadius: '8px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        <PhoneOff size={12} style={{ color: filterUncontacted ? '#ef4444' : 'inherit' }} />
                        <span>Chưa tương tác</span>
                        {typeof stageCounts['uncontacted'] === 'number' && (
                          <span
                            style={{
                              background: filterUncontacted ? '#ef4444' : 'var(--color-bg-light)',
                              color: filterUncontacted ? '#ffffff' : 'var(--color-text-muted)',
                              fontSize: '0.65rem',
                              fontWeight: 700,
                              borderRadius: '10px',
                              padding: '1px 6px',
                              marginLeft: 'auto',
                              lineHeight: 1.4
                            }}
                          >
                            {stageCounts['uncontacted']}
                          </span>
                        )}
                      </button>



                      <div style={{ height: '1px', background: 'var(--color-border-light)', margin: '4px 0' }} />
 
                      {/* Sorting Dropdowns inside mobile menu */}
                      <div style={{ padding: '4px 12px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Sắp xếp
                      </div>
                      {(['newest', 'interaction_desc', 'score_desc', 'deal_desc'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => {
                            setSortBy(mode as any);
                            setShowMobileActions(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '6px 12px 6px 24px',
                            border: 'none',
                            background: sortBy === mode ? 'var(--color-bg-light)' : 'transparent',
                            color: sortBy === mode ? 'var(--color-primary)' : 'var(--color-text)',
                            borderRadius: '6px',
                            fontSize: '0.725rem',
                            fontWeight: 600,
                            textAlign: 'left',
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: sortBy === mode ? 'var(--color-primary)' : 'transparent', display: 'inline-block' }} />
                          <span>
                            {mode === 'newest' ? 'Mới nhất' : mode === 'interaction_desc' ? 'Tương tác gần nhất' : mode === 'score_desc' ? 'Theo Score' : 'Theo Deal'}
                          </span>
                        </button>
                      ))}
 
                      <div style={{ height: '1px', background: 'var(--color-border-light)', margin: '4px 0' }} />
 
                      {/* View Mode Toggle inside mobile menu */}
                      <div style={{ padding: '4px 12px', fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Kiểu hiển thị
                      </div>
                      {(['list', 'card'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => {
                            setViewMode(mode);
                            setShowMobileActions(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            width: '100%',
                            padding: '6px 12px 6px 24px',
                            border: 'none',
                            background: viewMode === mode ? 'var(--color-bg-light)' : 'transparent',
                            color: viewMode === mode ? 'var(--color-primary)' : 'var(--color-text)',
                            borderRadius: '6px',
                            fontSize: '0.725rem',
                            fontWeight: 600,
                            textAlign: 'left',
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: viewMode === mode ? 'var(--color-primary)' : 'transparent', display: 'inline-block' }} />
                          <span>{mode === 'list' ? 'Dạng danh sách' : 'Dạng ô vuông'}</span>
                        </button>
                      ))}
                      {canAddOrAssign && (
                        <>
                          <div style={{ height: '1px', background: 'var(--color-border-light)', margin: '4px 0' }} />
                          <button
                            onClick={() => {
                              setShowCreateModal(true);
                              setShowMobileActions(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--color-primary)',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textAlign: 'left',
                              cursor: 'pointer'
                            }}
                          >
                            <Plus size={14} />
                            <span>Thêm data mới</span>
                          </button>
                          <button
                            onClick={() => {
                              window.dispatchEvent(new CustomEvent('open-quick-add-lead'));
                              setShowMobileActions(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              width: '100%',
                              padding: '8px 12px',
                              border: 'none',
                              background: 'transparent',
                              color: '#be185d',
                              borderRadius: '8px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              textAlign: 'left',
                              cursor: 'pointer'
                            }}
                          >
                            <UserCheck size={14} />
                            <span>Giao data cho Sale</span>
                          </button>
                        </>
                      )}

                      {(user?.role as string) !== 'viewer' && (!isSale || user?.role !== 'sale') && (
                        <>
                          <div style={{ height: '1px', background: 'var(--color-border-light)', margin: '4px 0' }} />
                          {/* Import Action */}
                          {(user?.role as string) !== 'viewer' && !isSale && (
                            <button
                              onClick={() => {
                                setShowImportExport(true);
                                setShowMobileActions(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                width: '100%',
                                padding: '8px 12px',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--color-text)',
                                borderRadius: '8px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                textAlign: 'left',
                                cursor: 'pointer'
                              }}
                            >
                              <Upload size={13} />
                              <span>Nhập dữ liệu</span>
                            </button>
                          )}
                          {/* Export Actions */}
                          {(user?.role as string) !== 'viewer' && user?.role !== 'sale' && (
                            <>
                              <button
                                onClick={() => {
                                  bulkExport('filtered');
                                  setShowMobileActions(false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--color-text)',
                                  borderRadius: '8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  textAlign: 'left',
                                  cursor: 'pointer'
                                }}
                              >
                                <Filter size={13} />
                                <span>Xuất theo bộ lọc</span>
                              </button>
                              <button
                                onClick={() => {
                                  bulkExport('full');
                                  setShowMobileActions(false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  width: '100%',
                                  padding: '8px 12px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: 'var(--color-text)',
                                  borderRadius: '8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  textAlign: 'left',
                                  cursor: 'pointer'
                                }}
                              >
                                <Download size={13} />
                                <span>Xuất toàn bộ (100% trường)</span>
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <>
            {/* Row 1: Search and separate Filter Button */}
            <div style={{ display: 'flex', gap: '8px', width: '100%', flex: 1, alignItems: 'center' }}>
              <div className="filter-search" style={{ flex: 1, position: 'relative', width: 'auto', height: '38px', borderRadius: '8px', border: '1px solid var(--color-border)', boxSizing: 'border-box', paddingRight: '2.5rem' }}>
                <Search size={14} style={{ color:'var(--color-text-muted)', marginLeft: '4px' }}/>
                <input 
                  placeholder="Tìm tên (có/không dấu), SĐT, email toàn hệ thống..." 
                  value={search} 
                  onChange={e=>{setSearch(e.target.value);setPage(1);}} 
                  style={{ paddingRight: '0.5rem', height: '100%' }}
                />
                <div style={{ position: 'absolute', right: '0.5rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center' }}>
                  <AnimatePresence>
                    {search && (
                      <motion.button 
                        initial={{ opacity: 0, scale: 0.8 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.15 }}
                        className="btn-icon-bare" 
                        onClick={() => setSearch('')} 
                        style={{ padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'transparent' }}
                        title="Xóa tìm kiếm"
                      >
                        <X size={14} style={{ color: 'var(--color-text-muted)' }}/>
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
 
              {/* Quick Filter: Mốc thời gian & Ngày nhập học */}
              <div ref={timelinePopoverRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (activeFilters.admissionActive) {
                      setFilterDateField('admission_date');
                    }
                    setShowTimelinePopover(prev => !prev);
                  }}
                  style={{
                    height: '38px',
                    padding: '0 0.875rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    border: (activeFilters.dateActive || activeFilters.admissionActive) ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                    borderRadius: '8px',
                    background: 'var(--color-surface, #ffffff)',
                    color: (activeFilters.dateActive || activeFilters.admissionActive) ? 'var(--color-primary)' : 'var(--color-text)',
                    fontWeight: (activeFilters.dateActive || activeFilters.admissionActive) ? 700 : 600,
                    fontSize: '0.85rem',
                    transition: 'all 0.2s',
                    boxShadow: (activeFilters.dateActive || activeFilters.admissionActive) ? '0 2px 6px rgba(225, 29, 72, 0.15)' : 'var(--shadow-sm)',
                    outline: 'none',
                    whiteSpace: 'nowrap',
                    flexShrink: 0
                  }}
                  title="Lọc theo mốc thời gian hoặc ngày nhập học"
                >
                  {activeFilters.admissionActive ? (
                    <GraduationCap size={15} style={{ color: 'var(--color-primary)' }} />
                  ) : (
                    <Calendar size={15} style={{ color: activeFilters.dateActive ? 'var(--color-primary)' : 'var(--color-text-muted)' }} />
                  )}
                  <span>
                    {activeFilters.admissionActive
                      ? `Nhập học: ${getAdmissionDisplayLabel()}`
                      : (activeFilters.dateActive
                          ? `${DATE_FIELD_LABELS[activeFilters.dateField] || 'Thời gian'}: ${getTimelineDisplayLabel()}`
                          : 'Thời gian')}
                  </span>
                  <ChevronDown size={14} style={{ transform: showTimelinePopover ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                {/* Unified Timeline & Admission Popover Menu */}
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
                        background: 'var(--color-surface, #ffffff)',
                        border: '1px solid var(--color-border)',
                        borderRadius: '14px',
                        boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
                        padding: '1rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.875rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Calendar size={16} color="var(--color-primary)" /> Lọc mốc thời gian
                        </span>
                        {(activeFilters.dateActive || activeFilters.admissionActive) && (
                          <button
                            type="button"
                            onClick={() => {
                              removeActiveFilterTag('date');
                              removeActiveFilterTag('admission');
                            }}
                            style={{ fontSize: '0.72rem', color: 'var(--color-danger, #ef4444)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                          >
                            Xóa lọc
                          </button>
                        )}
                      </div>

                      {/* Chọn loại ngày: Lọc theo */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px', display: 'block' }}>Lọc theo:</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px' }}>
                          {[
                            { id: 'created_at', label: 'Ngày tạo' },
                            { id: 'updated_at', label: 'Cập nhật' },
                            { id: 'last_contact', label: 'Tương tác' },
                            { id: 'admission_date', label: 'Nhập học' },
                            { id: 'deposit_date', label: 'Ngày cọc' },
                            { id: 'next_followup_date', label: 'Hẹn gọi' },
                            { id: 'birthday', label: 'Ngày sinh' }
                          ].map(f => {
                            const isSelected = filterDateField === f.id;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setFilterDateField(f.id as any)}
                                style={{
                                  padding: '6px 2px',
                                  fontSize: '0.72rem',
                                  fontWeight: isSelected ? 700 : 500,
                                  borderRadius: '6px',
                                  border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                  background: 'var(--color-surface, #ffffff)',
                                  color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                  cursor: 'pointer',
                                  textAlign: 'center',
                                  whiteSpace: 'nowrap',
                                  transition: 'all 0.15s'
                                }}
                              >
                                {f.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Khoảng thời gian nhanh (Đổi linh hoạt theo filterDateField) */}
                      <div>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '5px', display: 'block' }}>Khoảng thời gian nhanh:</label>
                        {filterDateField === 'admission_date' ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                            {[
                              { id: 'this_month', label: 'Tháng này' },
                              { id: 'next_month', label: 'Tháng sau' },
                              { id: 'this_quarter', label: 'Quý này' },
                              { id: 'this_year', label: 'Năm nay' }
                            ].map(p => {
                              const isSelected = filterAdmissionPreset === p.id && activeFilters.admissionActive;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => applyQuickAdmissionPreset(p.id)}
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: '0.78rem',
                                    fontWeight: isSelected ? 700 : 500,
                                    borderRadius: '8px',
                                    border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                    background: 'var(--color-surface, #ffffff)',
                                    color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s'
                                  }}
                                >
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                            {[
                              { id: 'today', label: 'Hôm nay' },
                              { id: 'last_7_days', label: '7 ngày qua' },
                              { id: 'this_month', label: 'Tháng này' },
                              { id: 'last_30_days', label: '30 ngày qua' }
                            ].map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => applyQuickTimelinePreset(p.id)}
                                style={{
                                  padding: '6px 10px',
                                  fontSize: '0.78rem',
                                  fontWeight: 500,
                                  borderRadius: '8px',
                                  border: '1px solid var(--color-border)',
                                  background: 'var(--color-surface, #ffffff)',
                                  color: 'var(--color-text)',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s'
                                }}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Custom Date Range */}
                      <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '0.75rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '6px', display: 'block' }}>Hoặc nhập ngày cụ thể:</label>
                        {filterDateField === 'admission_date' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.75rem', width: '55px', color: 'var(--color-text-muted)', flexShrink: 0 }}>Từ ngày:</span>
                              <input
                                type="date"
                                className="form-input"
                                value={filterAdmissionFrom}
                                onChange={e => {
                                  setFilterAdmissionFrom(e.target.value);
                                  setFilterAdmissionPreset('custom');
                                }}
                                style={{ height: '34px', fontSize: '0.8rem', borderRadius: '8px', flex: 1 }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.75rem', width: '55px', color: 'var(--color-text-muted)', flexShrink: 0 }}>Đến ngày:</span>
                              <input
                                type="date"
                                className="form-input"
                                value={filterAdmissionTo}
                                onChange={e => {
                                  setFilterAdmissionTo(e.target.value);
                                  setFilterAdmissionPreset('custom');
                                }}
                                style={{ height: '34px', fontSize: '0.8rem', borderRadius: '8px', flex: 1 }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.75rem', width: '55px', color: 'var(--color-text-muted)', flexShrink: 0 }}>Từ ngày:</span>
                              <input
                                type="date"
                                className="form-input"
                                value={filterFromDate}
                                onChange={e => setFilterFromDate(e.target.value)}
                                style={{ height: '34px', fontSize: '0.8rem', borderRadius: '8px', flex: 1 }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ fontSize: '0.75rem', width: '55px', color: 'var(--color-text-muted)', flexShrink: 0 }}>Đến ngày:</span>
                              <input
                                type="date"
                                className="form-input"
                                value={filterToDate}
                                onChange={e => setFilterToDate(e.target.value)}
                                style={{ height: '34px', fontSize: '0.8rem', borderRadius: '8px', flex: 1 }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
                        <button
                          type="button"
                          className="btn sm outline"
                          onClick={() => setShowTimelinePopover(false)}
                          style={{ padding: '5px 10px', fontSize: '0.75rem', borderRadius: '6px' }}
                        >
                          Đóng
                        </button>
                        <button
                          type="button"
                          className="btn sm primary"
                          onClick={() => {
                            if (filterDateField === 'admission_date') {
                              applyCustomAdmissionRange();
                            } else {
                              applyCustomTimelineRange();
                            }
                          }}
                          style={{ padding: '5px 12px', fontSize: '0.75rem', borderRadius: '6px', fontWeight: 600 }}
                        >
                          Áp dụng
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Nút mở Drawer Bộ lọc nâng cao */}
              <button 
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                style={{
                  height: '38px',
                  padding: '0 0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  cursor: 'pointer',
                  border: activeFiltersCount > 0 ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                  borderRadius: '8px',
                  background: 'var(--color-surface, #ffffff)',
                  color: activeFiltersCount > 0 ? 'var(--color-primary)' : 'var(--color-text)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s',
                  boxShadow: activeFiltersCount > 0 ? '0 2px 8px rgba(37, 99, 235, 0.15)' : 'var(--shadow-sm)',
                  outline: 'none',
                  position: 'relative',
                  flexShrink: 0
                }}
                title="Mở bảng bộ lọc chuyên sâu"
              >
                <SlidersHorizontal size={14} />
                <span>Bộ lọc</span>
                {activeFiltersCount > 0 && (
                  <span
                    style={{
                      background: 'var(--color-primary, #2563eb)',
                      color: '#ffffff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: '50%',
                      minWidth: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      marginLeft: '2px',
                      lineHeight: 1
                    }}
                  >
                    {activeFiltersCount}
                  </span>
                )}
              </button>


            </div>
 
            {/* Row 2: Sort Select & View Mode switchers */}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: isMobile ? 'space-between' : 'flex-end', width: isMobile ? '100%' : 'auto', flexShrink: 0 }}>

              {!isMobile && <div style={{ flex: 1 }} />}
              
              <div style={{ width: isMobile ? '130px' : 170 }}>
                <CustomSelect 
                  value={sortBy} 
                  onChange={val => setSortBy(val as any)} 
                  options={[
                    { value: 'newest', label: 'Mới nhất', icon: <ArrowDownUp size={14} /> },
                    { value: 'interaction_desc', label: 'Tương tác gần nhất', icon: <ArrowDownUp size={14} /> },
                    { value: 'score_desc', label: 'Score', icon: <ArrowDownUp size={14} /> },
                    { value: 'deal_desc', label: 'Deal', icon: <ArrowDownUp size={14} /> }
                  ]} 
                />
              </div>
 
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
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
                    boxSizing: 'border-box'
                  }}>
                    <button 
                      onClick={() => setViewMode('list')} 
                      title="Danh sách"
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
                    <button 
                      onClick={() => setViewMode('card')} 
                      title="Dạng thẻ"
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
                        boxShadow: viewMode === 'card' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        background: viewMode === 'card' ? 'var(--color-surface)' : 'transparent',
                        color: viewMode === 'card' ? 'var(--color-text)' : 'var(--color-text-light)',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      <LayoutGrid size={16} />
                    </button>
                  </div>
                )}
                
                <button 
                  onClick={() => setShowColumns(true)} 
                  title="Tùy chỉnh cột"
                  style={{ 
                    padding: 0, 
                    height: '38px', 
                    width: '38px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    outline: 'none',
                    boxShadow: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <Columns size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Global Search Active Banner */}
      {debouncedSearch && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.625rem 1rem',
          marginBottom: '0.75rem',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(99, 102, 241, 0.08) 100%)',
          border: '1px solid rgba(59, 130, 246, 0.25)',
          fontSize: '0.8125rem',
          color: 'var(--color-primary, #2563eb)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Search size={14} style={{ flexShrink: 0 }} />
            <span>
              Đang rà soát <strong>toàn bộ pipeline, học viên & trạng thái</strong>: &ldquo;<strong>{debouncedSearch}</strong>&rdquo;
            </span>
            <span style={{
              background: 'rgba(59, 130, 246, 0.15)',
              padding: '2px 8px',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: '0.75rem'
            }}>
              {total} kết quả
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setSearch(''); setPage(1); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              background: 'var(--color-surface, #ffffff)',
              color: 'var(--color-primary, #2563eb)',
              fontSize: '0.75rem',
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <X size={12} /> Bỏ tìm kiếm
          </button>
        </div>
      )}

      {/* Active Filter Tags Bar */}
      {activeFiltersCount > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '8px 12px',
          marginBottom: '0.75rem',
          background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
          border: '1px solid var(--color-border-light)',
          borderRadius: '12px',
          fontSize: '0.8rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-text-muted)', fontWeight: 600, marginRight: '4px' }}>
            <Filter size={13} />
            <span>Đang lọc:</span>
          </div>

          {/* Admission date tag */}
          {activeFilters.admissionActive && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', color: 'var(--color-primary, #2563eb)', fontWeight: 600, fontSize: '0.75rem' }}>
              <GraduationCap size={13} />
              <span>Nhập học: {getAdmissionDisplayLabel()}</span>
              <button type="button" onClick={() => removeActiveFilterTag('admission')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--color-primary, #2563eb)' }}><X size={12} /></button>
            </span>
          )}

          {/* Date (Timeline) tag */}
          {activeFilters.dateActive && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontWeight: 600, fontSize: '0.75rem' }}>
              <Calendar size={13} />
              <span>{DATE_FIELD_LABELS[activeFilters.dateField] || 'Thời gian'}: {getTimelineDisplayLabel()}</span>
              <button type="button" onClick={() => removeActiveFilterTag('date')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#059669' }}><X size={12} /></button>
            </span>
          )}

          {/* Stage tag */}
          {activeFilters.status && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>{activeFilters.stageOp === 'not_in' ? 'Loại trừ giai đoạn: ' : 'Giai đoạn: '} {getStageName(activeFilters.status)}</span>
              <button type="button" onClick={() => removeActiveFilterTag('status')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#7c3aed' }}><X size={12} /></button>
            </span>
          )}

          {/* Lead status tag */}
          {activeFilters.leadStatus && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>{activeFilters.leadStatusOp === 'not_in' ? 'Loại trừ TT: ' : 'Trạng thái: '} {getLeadStatusLabel(activeFilters.leadStatus)}</span>
              <button type="button" onClick={() => removeActiveFilterTag('leadStatus')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#d97706' }}><X size={12} /></button>
            </span>
          )}

          {/* Sales owner tag */}
          {activeFilters.ownerId && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.1)', color: '#0284c7', fontWeight: 600, fontSize: '0.75rem' }}>
              <User size={13} />
              <span>
                Phụ trách:{' '}
                {activeFilters.ownerId
                  .split(',')
                  .map(id => id.trim() === 'unassigned' ? 'Chưa phân bổ' : (users.find(u => String(u.id) === id.trim())?.full_name || id))
                  .join(', ')}
              </span>
              <button type="button" onClick={() => removeActiveFilterTag('ownerId')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#0284c7' }}><X size={12} /></button>
            </span>
          )}

          {/* Team tag */}
          {activeFilters.teamId && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(14, 165, 233, 0.1)', color: '#0284c7', fontWeight: 600, fontSize: '0.75rem' }}>
              <Users size={13} />
              <span>
                Đội nhóm:{' '}
                {activeFilters.teamId
                  .split(',')
                  .map(id => teams.find(t => String(t.id) === id.trim())?.name || id)
                  .join(', ')}
              </span>
              <button type="button" onClick={() => removeActiveFilterTag('teamId')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#0284c7' }}><X size={12} /></button>
            </span>
          )}

          {/* Project tag */}
          {activeFilters.projectId && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.1)', color: '#db2777', fontWeight: 600, fontSize: '0.75rem' }}>
              <Building2 size={13} />
              <span>
                Dự án:{' '}
                {activeFilters.projectId
                  .split(',')
                  .map(id => projects.find(p => String(p.id) === id.trim())?.name || id)
                  .join(', ')}
              </span>
              <button type="button" onClick={() => removeActiveFilterTag('projectId')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#db2777' }}><X size={12} /></button>
            </span>
          )}

          {/* Campaign tag */}
          {activeFilters.campaignId && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(236, 72, 153, 0.1)', color: '#db2777', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>
                Chiến dịch:{' '}
                {activeFilters.campaignId
                  .split(',')
                  .map(id => campaigns.find(c => String(c.id) === id.trim())?.name || id)
                  .join(', ')}
              </span>
              <button type="button" onClick={() => removeActiveFilterTag('campaignId')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#db2777' }}><X size={12} /></button>
            </span>
          )}

          {/* Source tag */}
          {activeFilters.source && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>
                Nguồn:{' '}
                {activeFilters.source
                  .split(',')
                  .map(s => mergedSourceOptions.find(o => o.value === s.trim())?.label || s)
                  .join(', ')}
              </span>
              <button type="button" onClick={() => removeActiveFilterTag('source')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#475569' }}><X size={12} /></button>
            </span>
          )}

          {/* Tag filter */}
          {activeFilters.tag && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>
              <TagIcon size={12} />
              <span>Tag: &ldquo;{activeFilters.tag}&rdquo;</span>
              <button type="button" onClick={() => removeActiveFilterTag('tag')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#475569' }}><X size={12} /></button>
            </span>
          )}

          {/* Data type tag */}
          {activeFilters.dataType && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>Loại data: {activeFilters.dataType === 'distributed' ? 'Được chia' : (activeFilters.dataType === 'personal' ? 'Cá nhân' : 'Lỗi/Ticket')}</span>
              <button type="button" onClick={() => removeActiveFilterTag('dataType')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#475569' }}><X size={12} /></button>
            </span>
          )}

          {/* Interaction status */}
          {activeFilters.interactionStatus && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', fontWeight: 600, fontSize: '0.75rem' }}>
              <Phone size={12} />
              <span>{activeFilters.interactionStatus === 'uncontacted' ? 'Chưa liên hệ' : 'Đã liên hệ'}</span>
              <button type="button" onClick={() => removeActiveFilterTag('interactionStatus')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#dc2626' }}><X size={12} /></button>
            </span>
          )}

          {/* Stale days */}
          {activeFilters.staleDays && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.1)', color: '#d97706', fontWeight: 600, fontSize: '0.75rem' }}>
              <Clock size={12} />
              <span>Bỏ quên &gt; {activeFilters.staleDays} ngày</span>
              <button type="button" onClick={() => removeActiveFilterTag('staleDays')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#d97706' }}><X size={12} /></button>
            </span>
          )}

          {/* Interacted within days */}
          {activeFilters.interactedWithinDays && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontWeight: 600, fontSize: '0.75rem' }}>
              <Clock size={12} />
              <span>Tương tác trong {activeFilters.interactedWithinDays} ngày</span>
              <button type="button" onClick={() => removeActiveFilterTag('interactedWithinDays')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#059669' }}><X size={12} /></button>
            </span>
          )}

          {/* Interaction type */}
          {activeFilters.interactionType && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>Loại TT: {activeFilters.interactionType}</span>
              <button type="button" onClick={() => removeActiveFilterTag('interactionType')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#2563eb' }}><X size={12} /></button>
            </span>
          )}

          {/* Call count */}
          {(activeFilters.minCallCount || activeFilters.maxCallCount) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>Số lần gọi: {activeFilters.minCallCount || '0'} - {activeFilters.maxCallCount || '∞'}</span>
              <button type="button" onClick={() => removeActiveFilterTag('callCount')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#2563eb' }}><X size={12} /></button>
            </span>
          )}

          {/* Note keyword */}
          {activeFilters.noteKeyword && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(59, 130, 246, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '0.75rem' }}>
              <MessageSquare size={12} />
              <span>Nhật ký chứa: &ldquo;{activeFilters.noteKeyword}&rdquo;</span>
              <button type="button" onClick={() => removeActiveFilterTag('noteKeyword')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#2563eb' }}><X size={12} /></button>
            </span>
          )}

          {/* Gender */}
          {activeFilters.gender && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>Giới tính: {activeFilters.gender === 'unknown' ? 'Chưa rõ' : activeFilters.gender}</span>
              <button type="button" onClick={() => removeActiveFilterTag('gender')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#7c3aed' }}><X size={12} /></button>
            </span>
          )}

          {/* City */}
          {activeFilters.city && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>Tỉnh/Thành: {activeFilters.city}</span>
              <button type="button" onClick={() => removeActiveFilterTag('city')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#7c3aed' }}><X size={12} /></button>
            </span>
          )}

          {/* Age */}
          {(activeFilters.ageMin || activeFilters.ageMax) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(139, 92, 246, 0.1)', color: '#7c3aed', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>Độ tuổi: {activeFilters.ageMin || '0'} - {activeFilters.ageMax || '∞'}</span>
              <button type="button" onClick={() => removeActiveFilterTag('age')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#7c3aed' }}><X size={12} /></button>
            </span>
          )}

          {/* Job Title */}
          {activeFilters.jobTitle && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>
              <Briefcase size={12} />
              <span>Nghề nghiệp: {activeFilters.jobTitle}</span>
              <button type="button" onClick={() => removeActiveFilterTag('jobTitle')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#475569' }}><X size={12} /></button>
            </span>
          )}

          {/* Company */}
          {activeFilters.company && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(100, 116, 139, 0.1)', color: '#475569', fontWeight: 600, fontSize: '0.75rem' }}>
              <Building2 size={12} />
              <span>Đơn vị: {activeFilters.company}</span>
              <button type="button" onClick={() => removeActiveFilterTag('company')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#475569' }}><X size={12} /></button>
            </span>
          )}

          {/* Financial status */}
          {activeFilters.financialStatus && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>
                Tài chính:{' '}
                {activeFilters.financialStatus
                  .split(',')
                  .map(s => FINANCIAL_STATUS_OPTIONS.find(o => o.value === s.trim())?.label || s)
                  .join(', ')}
              </span>
              <button type="button" onClick={() => removeActiveFilterTag('financialStatus')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#059669' }}><X size={12} /></button>
            </span>
          )}

          {/* Deposit amount */}
          {(activeFilters.minDeposit || activeFilters.maxDeposit) && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.1)', color: '#059669', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>Tiền cọc: {activeFilters.minDeposit || '0'} - {activeFilters.maxDeposit || '∞'}</span>
              <button type="button" onClick={() => removeActiveFilterTag('depositAmount')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#059669' }}><X size={12} /></button>
            </span>
          )}

          {/* Study status */}
          {activeFilters.studyStatus && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>
                Học tập:{' '}
                {activeFilters.studyStatus
                  .split(',')
                  .map(s => STUDY_STATUS_OPTIONS.find(o => o.value === s.trim())?.label || s)
                  .join(', ')}
              </span>
              <button type="button" onClick={() => removeActiveFilterTag('studyStatus')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#2563eb' }}><X size={12} /></button>
            </span>
          )}

          {/* Student code */}
          {activeFilters.studentCode && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>Mã HV: {activeFilters.studentCode}</span>
              <button type="button" onClick={() => removeActiveFilterTag('studentCode')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#2563eb' }}><X size={12} /></button>
            </span>
          )}

          {/* Expected intake */}
          {activeFilters.expectedIntake && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb', fontWeight: 600, fontSize: '0.75rem' }}>
              <span>Kỳ nhập học: {activeFilters.expectedIntake}</span>
              <button type="button" onClick={() => removeActiveFilterTag('expectedIntake')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#2563eb' }}><X size={12} /></button>
            </span>
          )}

          {/* Custom Schema Rules */}
          {validCustomRulesCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(225, 29, 72, 0.1)', color: 'var(--color-primary, #e11d48)', fontWeight: 600, fontSize: '0.75rem' }}>
              <SlidersHorizontal size={12} />
              <span>Trường dữ liệu: {validCustomRulesCount} điều kiện ({activeFilters.customRulesLogic})</span>
              <button type="button" onClick={() => removeActiveFilterTag('customRules')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: 'var(--color-primary, #e11d48)' }}><X size={12} /></button>
            </span>
          )}

          {/* Multi program tag */}
          {activeFilters.multiProgram && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(99, 102, 241, 0.1)', color: '#4f46e5', fontWeight: 600, fontSize: '0.75rem' }}>
              <Layers size={13} />
              <span>Đa chương trình (≥2)</span>
              <button type="button" onClick={() => removeActiveFilterTag('multiProgram')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#4f46e5' }}><X size={12} /></button>
            </span>
          )}

          {/* Show lost tag */}
          {activeFilters.showLost && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', fontWeight: 600, fontSize: '0.75rem' }}>
              <Eye size={13} />
              <span>Bao gồm data Lost</span>
              <button type="button" onClick={() => removeActiveFilterTag('showLost')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#dc2626' }}><X size={12} /></button>
            </span>
          )}

          {/* Uncontacted tag */}
          {filterUncontacted && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#dc2626', fontWeight: 600, fontSize: '0.75rem' }}>
              <PhoneOff size={13} />
              <span>Chưa tương tác</span>
              <button type="button" onClick={() => removeActiveFilterTag('uncontacted')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#dc2626' }}><X size={12} /></button>
            </span>
          )}

          {/* Clear all button */}
          <button
            type="button"
            onClick={handleResetFilters}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '8px',
              background: 'transparent',
              border: 'none',
              color: 'var(--color-danger, #ef4444)',
              fontWeight: 600,
              fontSize: '0.75rem',
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
          >
            <RotateCcw size={12} />
            <span>Xóa tất cả</span>
          </button>
        </div>
      )}

      {/* Slide-Over Drawer for Advanced Filter */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showAdvancedFilters && (
            <div style={{ position: 'fixed', inset: 0, zIndex: 2147483640, display: 'flex', justifyContent: 'flex-end', overflow: 'hidden' }}>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAdvancedFilters(false)}
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
                  maxWidth: '580px',
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
                    <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>Bộ lọc đa tầng chuyên sâu</h3>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Chọn nhiều tiêu chí kết hợp & lọc theo 100% trường dữ liệu</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
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
                    onClick={() => setShowAdvancedFilters(false)}
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
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Khoảng ngày nhập học</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '8px' }}>
                      {[
                        { id: 'this_month', label: 'Tháng này' },
                        { id: 'next_month', label: 'Tháng sau' },
                        { id: 'this_quarter', label: 'Quý này' },
                        { id: 'this_year', label: 'Năm nay' }
                      ].map(p => {
                        const isSelected = filterAdmissionPreset === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setFilterAdmissionPreset('');
                                setFilterAdmissionFrom('');
                                setFilterAdmissionTo('');
                              } else {
                                const { from, to } = getAdmissionPresetRange(p.id);
                                setFilterAdmissionPreset(p.id);
                                setFilterAdmissionFrom(from);
                                setFilterAdmissionTo(to);
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
                          value={filterAdmissionFrom}
                          onChange={e => {
                            setFilterAdmissionFrom(e.target.value);
                            setFilterAdmissionPreset('custom');
                          }}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Đến ngày</label>
                        <input
                          type="date"
                          className="form-input"
                          value={filterAdmissionTo}
                          onChange={e => {
                            setFilterAdmissionTo(e.target.value);
                            setFilterAdmissionPreset('custom');
                          }}
                          style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Khoảng ngày tạo / cập nhật / tương tác / cọc / hẹn gọi / sinh nhật */}
                  <div style={{ marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border-light)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Lọc theo ngày</label>
                        <CustomSelect
                          value={filterDateField}
                          onChange={v => setFilterDateField(v as any)}
                          options={[
                            { value: 'created_at', label: 'Ngày tạo' },
                            { value: 'updated_at', label: 'Ngày cập nhật' },
                            { value: 'last_contact', label: 'Ngày tương tác cuối' },
                            { value: 'admission_date', label: 'Ngày nhập học' },
                            { value: 'deposit_date', label: 'Ngày đặt cọc' },
                            { value: 'next_followup_date', label: 'Ngày hẹn gọi lại' },
                            { value: 'birthday', label: 'Ngày sinh' }
                          ]}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Kiểu lọc</label>
                        <CustomSelect
                          value={dateFilterType}
                          onChange={v => setDateFilterType(v as any)}
                          options={[
                            { value: 'range', label: 'Trong khoảng' },
                            { value: 'before', label: 'Trước ngày' },
                            { value: 'after', label: 'Sau ngày' }
                          ]}
                        />
                      </div>
                    </div>

                    {/* Quick buttons */}
                    {dateFilterType === 'range' && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', marginBottom: '8px' }}>
                        {[
                          { id: 'today', label: 'Hôm nay' },
                          { id: 'last_7_days', label: '7 ngày' },
                          { id: 'this_month', label: 'Tháng này' },
                          { id: 'last_30_days', label: '30 ngày' }
                        ].map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              const now = new Date();
                              const year = now.getFullYear();
                              const month = now.getMonth();
                              const todayStr = toLocalYMD(now);
                              let from = '';
                              let to = todayStr;
                              if (p.id === 'today') from = todayStr;
                              else if (p.id === 'last_7_days') from = toLocalYMD(new Date(now.getTime() - 7 * 86400000));
                              else if (p.id === 'this_month') {
                                from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
                                to = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
                              } else if (p.id === 'last_30_days') from = toLocalYMD(new Date(now.getTime() - 30 * 86400000));
                              setFilterFromDate(from);
                              setFilterToDate(to);
                            }}
                            style={{
                              padding: '5px 4px',
                              fontSize: '0.72rem',
                              fontWeight: 500,
                              borderRadius: '6px',
                              border: '1px solid var(--color-border)',
                              background: '#ffffff',
                              color: 'var(--color-text)',
                              cursor: 'pointer'
                            }}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Inputs ngày */}
                    {dateFilterType === 'range' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Từ ngày</label>
                          <input type="date" className="form-input" value={filterFromDate} onChange={e => setFilterFromDate(e.target.value)} style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Đến ngày</label>
                          <input type="date" className="form-input" value={filterToDate} onChange={e => setFilterToDate(e.target.value)} style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }} />
                        </div>
                      </div>
                    )}
                    {dateFilterType === 'before' && (
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Trước ngày</label>
                        <input type="date" className="form-input" value={filterBeforeDate} onChange={e => setFilterBeforeDate(e.target.value)} style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }} />
                      </div>
                    )}
                    {dateFilterType === 'after' && (
                      <div>
                        <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '2px' }}>Sau ngày</label>
                        <input type="date" className="form-input" value={filterAfterDate} onChange={e => setFilterAfterDate(e.target.value)} style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }} />
                      </div>
                    )}
                  </div>

                  {/* Lọc đa chương trình */}
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Hồ sơ đa chương trình</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setFilterMultiProgram(false)}
                        style={{
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          fontWeight: !filterMultiProgram ? 700 : 500,
                          borderRadius: '8px',
                          border: !filterMultiProgram ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                          background: 'var(--color-surface, #ffffff)',
                          color: !filterMultiProgram ? 'var(--color-primary)' : 'var(--color-text)',
                          cursor: 'pointer'
                        }}
                      >
                        Tất cả hồ sơ
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterMultiProgram(true)}
                        style={{
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          fontWeight: filterMultiProgram ? 700 : 500,
                          borderRadius: '8px',
                          border: filterMultiProgram ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                          background: 'var(--color-surface, #ffffff)',
                          color: filterMultiProgram ? 'var(--color-primary)' : 'var(--color-text)',
                          cursor: 'pointer'
                        }}
                      >
                        Đa chương trình (≥ 2 CT)
                      </button>
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

                  {/* Trạng thái Lead (Multi-select + IN/NOT IN) */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>Trạng thái Lead (Chọn nhiều)</label>
                      <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        {[
                          { op: 'in', label: 'Bao gồm' },
                          { op: 'not_in', label: 'Loại trừ' }
                        ].map(item => (
                          <button
                            key={item.op}
                            type="button"
                            onClick={() => setFilterLeadStatusOp(item.op as 'in' | 'not_in')}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.68rem',
                              fontWeight: filterLeadStatusOp === item.op ? 700 : 500,
                              border: 'none',
                              background: filterLeadStatusOp === item.op ? (item.op === 'not_in' ? '#ef4444' : 'var(--color-primary)') : 'var(--color-surface, #ffffff)',
                              color: filterLeadStatusOp === item.op ? '#ffffff' : 'var(--color-text-muted)',
                              cursor: 'pointer'
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {[
                        { id: '', label: 'Tất cả' },
                        { id: 'active', label: 'Hoạt động', color: '#10b981' },
                        { id: 'nurture', label: 'Nuôi dưỡng', color: '#d97706' },
                        { id: 'lost', label: 'Lost', color: '#ef4444' }
                      ].map(st => {
                        const selectedArr = filterLeadStatus ? filterLeadStatus.split(',').map(x => x.trim()).filter(Boolean) : [];
                        const isSelected = st.id === '' ? selectedArr.length === 0 : selectedArr.includes(st.id);
                        return (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              if (st.id === '') {
                                setFilterLeadStatus('');
                              } else {
                                const next = selectedArr.includes(st.id)
                                  ? selectedArr.filter(x => x !== st.id)
                                  : [...selectedArr, st.id];
                                setFilterLeadStatus(next.join(','));
                                if (next.includes('lost')) {
                                  setFilterShowLost(true);
                                }
                              }
                            }}
                            style={{
                              padding: '7px 6px',
                              fontSize: '0.76rem',
                              fontWeight: isSelected ? 700 : 500,
                              borderRadius: '8px',
                              border: isSelected ? `1.5px solid ${st.id === '' ? 'var(--color-primary)' : (st.color || 'var(--color-primary)')}` : '1px solid var(--color-border)',
                              background: 'var(--color-surface, #ffffff)',
                              color: isSelected ? (st.id === '' ? 'var(--color-primary)' : (st.color || 'var(--color-primary)')) : 'var(--color-text)',
                              cursor: 'pointer'
                            }}
                          >
                            {st.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Giai đoạn Pipeline (Multi-select + IN/NOT IN) */}
                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)' }}>Giai đoạn Pipeline (Chọn nhiều)</label>
                      <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                        {[
                          { op: 'in', label: 'Bao gồm (IN)' },
                          { op: 'not_in', label: 'Loại trừ (NOT IN)' }
                        ].map(item => (
                          <button
                            key={item.op}
                            type="button"
                            onClick={() => setFilterStageOp(item.op as 'in' | 'not_in')}
                            style={{
                              padding: '2px 8px',
                              fontSize: '0.68rem',
                              fontWeight: filterStageOp === item.op ? 700 : 500,
                              border: 'none',
                              background: filterStageOp === item.op ? (item.op === 'not_in' ? '#ef4444' : 'var(--color-primary)') : 'var(--color-surface, #ffffff)',
                              color: filterStageOp === item.op ? '#ffffff' : 'var(--color-text-muted)',
                              cursor: 'pointer'
                            }}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <CustomSelect
                      multiple
                      searchable
                      value={csvToMulti(filterStatus)}
                      onChange={v => setFilterStatus(multiToCsv(v, filterStatus))}
                      options={[
                        { value: 'all', label: 'Tất cả giai đoạn' },
                        { value: 'not_contacted', label: 'Chưa liên hệ' },
                        ...(pipelineStages.length > 0
                          ? pipelineStages.map(s => ({ value: String(s.id), label: s.name }))
                          : [
                              { value: 'new_lead', label: '01 – New Lead' },
                              { value: 'contact_attempted', label: '02 – Contact Attempted' },
                              { value: 'connected', label: '03 – Connected' },
                              { value: 'needed', label: '04 – Needed' },
                              { value: 'discovery_completed', label: '05 – Discovery Completed' },
                              { value: 'program_matched', label: '06 – Program Matched' },
                              { value: 'proposal_sent', label: '07 – Proposal Sent' },
                              { value: 'evaluation_objection', label: '08 – Evaluation / Objection' },
                              { value: 'application_started', label: '09 – Application Started' },
                              { value: 'application_completed', label: '10 – Application Completed' },
                              { value: 'admission_approved', label: '11 – Admission Approved' },
                              { value: 'offer_accepted', label: '12 – Offer / Scholarship Accepted' },
                              { value: 'deposit_tuition_payment', label: '13 – Deposit / Tuition Payment' },
                              { value: 'enrolled', label: '14 – Enrolled' }
                            ]
                        )
                      ]}
                    />
                  </div>

                  {/* Toggle Lost */}
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', padding: '6px 0' }}>
                    <input
                      type="checkbox"
                      checked={filterShowLost}
                      onChange={e => setFilterShowLost(e.target.checked)}
                      style={{ width: '16px', height: '16px', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
                    />
                    <span>Bao gồm data Lost trong kết quả (Mặc định ẩn)</span>
                  </label>
                </div>

                {/* Card 3: Phụ trách & Nguồn dữ liệu */}
                <div style={{
                  padding: '1.1rem',
                  borderRadius: '14px',
                  background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                  border: '1px solid var(--color-border-light)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.875rem' }}>
                    <Users size={16} color="var(--color-text, #0f172a)" /> Phụ trách & Nguồn dữ liệu
                  </div>

                  {/* Sale phụ trách & Đội nhóm Sale */}
                  {!isSale && (
                    <div style={{ display: 'grid', gridTemplateColumns: teams.length > 0 ? '1fr 1fr' : '1fr', gap: '8px', marginBottom: '0.875rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Sale phụ trách (Chọn nhiều)</label>
                        <CustomSelect
                          multiple
                          searchable
                          showAvatars
                          value={csvToMulti(filterOwnerId)}
                          onChange={v => setFilterOwnerId(multiToCsv(v, filterOwnerId))}
                          options={[
                            { value: 'all', label: 'Tất cả sales' },
                            { value: 'unassigned', label: 'Chưa phân bổ (Chưa có Sale)' },
                            ...(() => {
                              let list = users;
                              if (user?.role === 'manager') {
                                const managedTeam = teams.find(t => Number(t.leader_id) === Number(user?.id));
                                const activeTeamId = managedTeam?.id || null;
                                if (activeTeamId) {
                                  list = list.filter((u: any) => String(u.team_id) === String(activeTeamId));
                                }
                              }
                              return list;
                            })().map(u => ({
                              value: String(u.id),
                              label: u.full_name,
                              avatar: u.avatar_url || u.avatar,
                              sublabel: u.email
                            }))
                          ]}
                        />
                      </div>
                      {teams.length > 0 && (
                        <div>
                          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Đội nhóm Sale (Chọn nhiều)</label>
                          <CustomSelect
                            multiple
                            searchable
                            value={csvToMulti(filterTeamId)}
                            onChange={v => setFilterTeamId(multiToCsv(v, filterTeamId))}
                            options={[
                              { value: 'all', label: 'Tất cả đội nhóm' },
                              ...teams.map((t: any) => ({ value: String(t.id), label: t.name }))
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Dự án & Chiến dịch (Multi-select) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Dự án / Chương trình</label>
                      <CustomSelect
                        multiple
                        searchable
                        value={csvToMulti(filterProjectId)}
                        onChange={v => setFilterProjectId(multiToCsv(v, filterProjectId))}
                        options={[
                          { value: 'all', label: 'Tất cả dự án' },
                          ...projects.map(p => ({ value: String(p.id), label: p.name }))
                        ]}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Chiến dịch / Khóa học</label>
                      {(() => {
                        const selectedProjs = filterProjectId ? filterProjectId.split(',').map(s => s.trim()).filter(Boolean) : [];
                        const filteredCamps = selectedProjs.length > 0
                          ? campaigns.filter(c => selectedProjs.includes(String(c.project_id)))
                          : campaigns;
                        return (
                          <CustomSelect
                            multiple
                            searchable
                            value={csvToMulti(filterCampaignId)}
                            onChange={v => setFilterCampaignId(multiToCsv(v, filterCampaignId))}
                            options={[
                              { value: 'all', label: 'Tất cả chiến dịch' },
                              ...filteredCamps.map(c => ({ value: String(c.id), label: c.name }))
                            ]}
                          />
                        );
                      })()}
                    </div>
                  </div>

                  {/* Phân loại nguồn data & Nguồn khách hàng (Multi-select + Dynamic DB Sources) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Phân loại nguồn data</label>
                      <CustomSelect
                        value={filterDataType}
                        onChange={v => setFilterDataType(v)}
                        options={[
                          { value: '', label: 'Tất cả loại data' },
                          { value: 'distributed', label: 'Data được chia' },
                          { value: 'personal', label: 'Data cá nhân' },
                          { value: 'error_ticket', label: 'Data lỗi & Ticket' }
                        ]}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Nguồn khách hàng (Chọn nhiều)</label>
                      <CustomSelect
                        multiple
                        searchable
                        allowCustomInput
                        value={csvToMulti(filterSource)}
                        onChange={v => setFilterSource(multiToCsv(v, filterSource))}
                        options={ensureOptionsWithSelected(mergedSourceOptions, filterSource)}
                      />
                    </div>
                  </div>

                  {/* Phân loại Tag (Multi-select from dbTags + custom input) */}
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Phân loại Tag (Chọn nhiều)</label>
                    <CustomSelect
                      multiple
                      searchable
                      allowCustomInput
                      placeholder="Chọn hoặc nhập tag cần lọc..."
                      value={csvToMulti(filterTag)}
                      onChange={v => setFilterTag(multiToCsv(v, filterTag))}
                      options={ensureOptionsWithSelected(
                        [
                          { value: 'all', label: 'Tất cả phân loại (Tag)' },
                          ...dbTags
                            .map((t: any) => ({ value: String(t.name || '').trim(), label: String(t.name || '').trim() }))
                            .filter((t: any) => Boolean(t.value))
                        ],
                        filterTag
                      )}
                    />
                  </div>
                </div>

                {/* Card 4: Lịch sử Tương tác & Chăm sóc chuyên sâu */}
                <div style={{
                  padding: '1.1rem',
                  borderRadius: '14px',
                  background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                  border: '1px solid var(--color-border-light)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.875rem' }}>
                    <Clock size={16} color="var(--color-text, #0f172a)" /> Lịch sử Tương tác & Chăm sóc chuyên sâu
                  </div>

                  {/* 1. Trạng thái liên hệ */}
                  <div style={{ marginBottom: '0.875rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Trạng thái liên hệ</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                      {[
                        { id: '', label: 'Tất cả' },
                        { id: 'uncontacted', label: 'Chưa liên hệ' },
                        { id: 'contacted', label: 'Đã liên hệ' }
                      ].map(item => {
                        const isSelected = filterInteractionStatus === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => setFilterInteractionStatus(item.id as any)}
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
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Số ngày chưa chăm sóc (Bỏ quên) */}
                  <div style={{ marginBottom: '0.875rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Số ngày chưa chăm sóc (Bỏ quên)</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginBottom: '6px' }}>
                      {['3', '7', '14', '30', '60'].map(d => {
                        const isSelected = filterStaleDays === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setFilterStaleDays(isSelected ? '' : d)}
                            style={{
                              padding: '5px 4px',
                              fontSize: '0.72rem',
                              fontWeight: isSelected ? 700 : 500,
                              borderRadius: '6px',
                              border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: 'var(--color-surface, #ffffff)',
                              color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                              cursor: 'pointer'
                            }}
                          >
                            &gt; {d} ngày
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="number"
                      min={0}
                      className="form-input"
                      placeholder="Hoặc nhập số ngày chưa tương tác (VD: 10)..."
                      value={filterStaleDays}
                      onChange={e => setFilterStaleDays(e.target.value)}
                      style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                    />
                  </div>

                  {/* 3. Đã tương tác trong vòng (X ngày qua) */}
                  <div style={{ marginBottom: '0.875rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Đã tương tác trong vòng</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px', marginBottom: '6px' }}>
                      {['1', '3', '7', '14', '30'].map(d => {
                        const isSelected = filterInteractedWithinDays === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setFilterInteractedWithinDays(isSelected ? '' : d)}
                            style={{
                              padding: '5px 4px',
                              fontSize: '0.72rem',
                              fontWeight: isSelected ? 700 : 500,
                              borderRadius: '6px',
                              border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: 'var(--color-surface, #ffffff)',
                              color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                              cursor: 'pointer'
                            }}
                          >
                            {d} ngày
                          </button>
                        );
                      })}
                    </div>
                    <input
                      type="number"
                      min={0}
                      className="form-input"
                      placeholder="Hoặc nhập số ngày gần đây (VD: 5)..."
                      value={filterInteractedWithinDays}
                      onChange={e => setFilterInteractedWithinDays(e.target.value)}
                      style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                    />
                  </div>

                  {/* 4. Loại tương tác & Số lần gọi */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Loại tương tác</label>
                      <CustomSelect
                        multiple
                        value={csvToMulti(filterInteractionType)}
                        onChange={v => setFilterInteractionType(multiToCsv(v, filterInteractionType))}
                        options={INTERACTION_TYPE_OPTIONS}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Số lần gọi (Từ - Đến)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          placeholder="Từ (0)"
                          value={filterMinCallCount}
                          onChange={e => setFilterMinCallCount(e.target.value)}
                          style={{ height: '38px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          placeholder="Đến"
                          value={filterMaxCallCount}
                          onChange={e => setFilterMaxCallCount(e.target.value)}
                          style={{ height: '38px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. Từ khóa trong nhật ký chăm sóc */}
                  <div>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Từ khóa trong nhật ký chăm sóc</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Nhập nội dung cần tìm trong lịch sử ghi chú / cuộc gọi..."
                      value={filterNoteKeyword}
                      onChange={e => setFilterNoteKeyword(e.target.value)}
                      style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                    />
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
                    <BarChart3 size={16} color="var(--color-text, #0f172a)" /> Nhân khẩu học, Học tập & Tài chính
                  </div>

                  {/* 1. Giới tính */}
                  <div style={{ marginBottom: '0.875rem' }}>
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>Giới tính</label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                      {[
                        { id: '', label: 'Tất cả' },
                        { id: 'Nam', label: 'Nam' },
                        { id: 'Nữ', label: 'Nữ' },
                        { id: 'unknown', label: 'Chưa rõ' }
                      ].map(g => {
                        const isSelected = filterGender === g.id;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setFilterGender(g.id)}
                            style={{
                              padding: '7px 6px',
                              fontSize: '0.76rem',
                              fontWeight: isSelected ? 700 : 500,
                              borderRadius: '8px',
                              border: isSelected ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: 'var(--color-surface, #ffffff)',
                              color: isSelected ? 'var(--color-primary)' : 'var(--color-text)',
                              cursor: 'pointer'
                            }}
                          >
                            {g.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Tỉnh / Thành phố & Độ tuổi */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Tỉnh / Thành phố (Chọn nhiều)</label>
                      <CustomSelect
                        multiple
                        searchable
                        allowCustomInput
                        value={csvToMulti(filterCity)}
                        onChange={v => setFilterCity(multiToCsv(v, filterCity))}
                        options={ensureOptionsWithSelected(COMMON_CITY_OPTIONS, filterCity)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Độ tuổi (Từ - Đến)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          placeholder="Từ (18)"
                          value={filterAgeMin}
                          onChange={e => setFilterAgeMin(e.target.value)}
                          style={{ height: '38px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          placeholder="Đến (45)"
                          value={filterAgeMax}
                          onChange={e => setFilterAgeMax(e.target.value)}
                          style={{ height: '38px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 3. Nghề nghiệp & Công ty */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Nghề nghiệp / Chức danh</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="VD: Giám đốc, Kế toán..."
                        value={filterJobTitle}
                        onChange={e => setFilterJobTitle(e.target.value)}
                        style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Công ty / Trường học</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Nhập tên công ty / trường..."
                        value={filterCompany}
                        onChange={e => setFilterCompany(e.target.value)}
                        style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                      />
                    </div>
                  </div>

                  {/* 4. Tài chính / Đặt cọc & Khoảng tiền cọc */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '0.875rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Tài chính / Đặt cọc</label>
                      <CustomSelect
                        multiple
                        value={csvToMulti(filterFinancialStatus)}
                        onChange={v => setFilterFinancialStatus(multiToCsv(v, filterFinancialStatus))}
                        options={FINANCIAL_STATUS_OPTIONS}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Tiền cọc (VNĐ)</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          placeholder="Từ..."
                          value={filterMinDeposit}
                          onChange={e => setFilterMinDeposit(e.target.value)}
                          style={{ height: '38px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                        <input
                          type="number"
                          min={0}
                          className="form-input"
                          placeholder="Đến..."
                          value={filterMaxDeposit}
                          onChange={e => setFilterMaxDeposit(e.target.value)}
                          style={{ height: '38px', fontSize: '0.8125rem', borderRadius: '8px' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* 5. Trạng thái học tập, Mã HV & Kỳ nhập học */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Trạng thái học tập</label>
                      <CustomSelect
                        multiple
                        value={csvToMulti(filterStudyStatus)}
                        onChange={v => setFilterStudyStatus(multiToCsv(v, filterStudyStatus))}
                        options={STUDY_STATUS_OPTIONS}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Mã học viên</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="VD: HV2026..."
                        value={filterStudentCode}
                        onChange={e => setFilterStudentCode(e.target.value)}
                        style={{ height: '38px', fontSize: '0.8125rem', borderRadius: '8px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '4px' }}>Kỳ nhập học</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="VD: Fall 2026..."
                        value={filterExpectedIntake}
                        onChange={e => setFilterExpectedIntake(e.target.value)}
                        style={{ height: '38px', fontSize: '0.8125rem', borderRadius: '8px' }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card 6: Bộ lọc nâng cao theo trường dữ liệu (100% DB Schema) */}
                <div style={{
                  padding: '1.1rem',
                  borderRadius: '14px',
                  background: 'var(--color-bg-alt, rgba(0,0,0,0.02))',
                  border: '1px solid var(--color-border-light)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text, #0f172a)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      <SlidersHorizontal size={16} color="var(--color-text, #0f172a)" /> Bộ lọc theo trường dữ liệu (100% DB Schema)
                    </div>
                    <div style={{ display: 'inline-flex', borderRadius: '6px', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                      {[
                        { id: 'AND', label: 'Thỏa mãn TẤT CẢ (AND)' },
                        { id: 'OR', label: 'Thỏa mãn BẤT KỲ (OR)' }
                      ].map(logic => (
                        <button
                          key={logic.id}
                          type="button"
                          onClick={() => setCustomRulesLogic(logic.id as 'AND' | 'OR')}
                          style={{
                            padding: '3px 8px',
                            fontSize: '0.68rem',
                            fontWeight: customRulesLogic === logic.id ? 700 : 500,
                            border: 'none',
                            background: customRulesLogic === logic.id ? 'var(--color-primary)' : 'var(--color-surface, #ffffff)',
                            color: customRulesLogic === logic.id ? '#ffffff' : 'var(--color-text-muted)',
                            cursor: 'pointer'
                          }}
                        >
                          {logic.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {customRules.length === 0 ? (
                    <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
                      Cho phép truy vấn trực tiếp trên toàn bộ 51 trường dữ liệu gốc của bảng liên hệ (CCCD, hộ chiếu, chuyên ngành, UTM, điểm Lead, doanh thu kỳ vọng, lý do hủy...).
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '0.875rem' }}>
                      {customRules.map((rule, idx) => {
                        const fieldDef = CONTACT_SCHEMA_FIELDS.find(f => f.value === rule.field);
                        const inputType = fieldDef?.type === 'date' ? 'date' : fieldDef?.type === 'number' ? 'number' : 'text';
                        const hideValue = rule.operator === 'is_empty' || rule.operator === 'is_not_empty';
                        return (
                          <div
                            key={rule.id}
                            style={{
                              padding: '0.75rem',
                              borderRadius: '10px',
                              background: 'var(--color-surface, #ffffff)',
                              border: '1px solid var(--color-border)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '8px'
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                Điều kiện #{idx + 1} {idx > 0 ? `(${customRulesLogic})` : ''}
                              </span>
                              <button
                                type="button"
                                onClick={() => setCustomRules(prev => prev.filter(r => r.id !== rule.id))}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--color-danger, #ef4444)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  padding: 0
                                }}
                              >
                                <Trash2 size={13} /> Xóa
                              </button>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '8px' }}>
                              <CustomSelect
                                searchable
                                value={rule.field}
                                onChange={val => setCustomRules(prev => prev.map(r => r.id === rule.id ? { ...r, field: val } : r))}
                                options={CONTACT_SCHEMA_FIELDS}
                              />
                              <CustomSelect
                                value={rule.operator}
                                onChange={val => setCustomRules(prev => prev.map(r => r.id === rule.id ? { ...r, operator: val as any } : r))}
                                options={SCHEMA_OPERATORS}
                              />
                            </div>
                            {!hideValue && (
                              rule.operator === 'between' ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                  <input
                                    type={inputType}
                                    className="form-input"
                                    placeholder="Từ giá trị..."
                                    value={rule.value}
                                    onChange={e => setCustomRules(prev => prev.map(r => r.id === rule.id ? { ...r, value: e.target.value } : r))}
                                    style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                                  />
                                  <input
                                    type={inputType}
                                    className="form-input"
                                    placeholder="Đến giá trị..."
                                    value={rule.valueTo || ''}
                                    onChange={e => setCustomRules(prev => prev.map(r => r.id === rule.id ? { ...r, valueTo: e.target.value } : r))}
                                    style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                                  />
                                </div>
                              ) : (
                                <input
                                  type={inputType}
                                  className="form-input"
                                  placeholder="Nhập giá trị cần đối chiếu..."
                                  value={rule.value}
                                  onChange={e => setCustomRules(prev => prev.map(r => r.id === rule.id ? { ...r, value: e.target.value } : r))}
                                  style={{ height: '36px', fontSize: '0.8125rem', borderRadius: '8px' }}
                                />
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setCustomRules(prev => [
                        ...prev,
                        {
                          id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                          field: 'full_name',
                          operator: 'contains',
                          value: '',
                          valueTo: ''
                        }
                      ])
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px dashed var(--color-primary)',
                      background: 'rgba(37, 99, 235, 0.04)',
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
                    <Plus size={14} /> Thêm điều kiện trường dữ liệu
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
                  onClick={handleResetFilters}
                  style={{ borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem' }}
                >
                  Đặt lại
                </button>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn outline"
                    onClick={() => setShowAdvancedFilters(false)}
                    style={{ borderRadius: '10px', fontWeight: 600, fontSize: '0.85rem' }}
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    className="btn primary"
                    onClick={handleApplyFilters}
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

      <ColumnCustomizer 
        isOpen={showColumns} 
        onClose={() => setShowColumns(false)} 
        columns={columns} 
        onChange={(newCols) => setColumns(newCols)} 
        {...({ onReset: () => setColumns(getDefaultContactColumns(segment, isSale)) } as any)}
      />

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {isMultiSelectMode && selected.size > 0 && (
          <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{ position:'sticky', top:68, zIndex:100, marginBottom:'0.75rem', padding:'0.75rem 1.25rem', background:'var(--color-primary)', borderRadius:'var(--radius-xl)', display:'flex', alignItems:'center', gap:'0.75rem', boxShadow:'0 8px 24px rgba(163, 20, 34,0.3)' }}>
            <span style={{ color:'white', fontWeight:700, fontSize:'0.875rem' }}>{selected.size} đã chọn</span>
            <div style={{ flex:1 }}/>
            {[
              { label:'Email', action:bulkEmail },
              { label:'Tag',   action:bulkTag   },
              ...(!isSale ? [
                { label:'Gán',  action:bulkAssign},
                { label:'Xuất', action: () => bulkExport('filtered') },
              ] : [])
            ].map(b=>(
              <button key={b.label} onClick={b.action}
                style={{ padding:'0.375rem 0.875rem', background:'rgba(255,255,255,0.18)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'var(--radius-lg)', color:'white', fontWeight:600, fontSize:'0.8125rem', cursor:'pointer' }}>
                {b.label}
              </button>
            ))}
            {!['viewer'].includes(user?.role || '') && (
              <button onClick={bulkDelete}
                style={{ padding:'0.375rem 0.875rem', background:'rgba(239,68,68,0.8)', border:'none', borderRadius:'var(--radius-lg)', color:'white', fontWeight:700, fontSize:'0.8125rem', cursor:'pointer' }}>
                Xóa
              </button>
            )}
            <button onClick={() => setSelected(new Set())} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.7)', cursor:'pointer' }}><X size={16}/></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      {loading ? (
        isMobile ? (
          <div style={{ padding: '0.5rem 0' }}>
            <div className="grid-cards-responsive">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: '16px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                    <Skeleton width={42} height={42} borderRadius="50%" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      <Skeleton width="60%" height={14} />
                      <Skeleton width="45%" height={11} style={{ marginTop: '4px' }} />
                    </div>
                  </div>
                  <div style={{ color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.3 }}>
                    <ChevronRight size={18} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card">
            <TableSkeleton rows={6} cols={6} />
          </div>
        )
      ) : (
        <div className={isMobile ? "" : "card"} style={{ overflow: 'visible', background: isMobile ? 'transparent' : undefined, border: isMobile ? 'none' : undefined, padding: isMobile ? 0 : undefined, boxShadow: isMobile ? 'none' : undefined }}>
          {viewMode === 'list' ? (

            <div className="table-wrap" style={{ maxHeight: 'calc(100vh - 340px)', overflowY: 'auto' }}>
              <style>{`
                .table-wrap th {
                  padding: 0.75rem 0.75rem !important;
                  vertical-align: middle !important;
                }
                .table-wrap td {
                  padding: 0.95rem 0.75rem !important;
                  vertical-align: middle !important;
                }
                .table-wrap .table-row-hover:hover {
                  background: rgba(0, 0, 0, 0.012) !important;
                }
                [data-theme="dark"] .table-wrap .table-row-hover:hover {
                  background: rgba(255, 255, 255, 0.02) !important;
                }
                .table-wrap th {
                  font-size: 0.7rem !important;
                  font-weight: 700 !important;
                  color: var(--color-text-light) !important;
                  text-transform: uppercase !important;
                  letter-spacing: 0.5px !important;
                }
                .table-wrap td p {
                  font-size: 0.8125rem !important;
                  margin: 0 !important;
                }
                .table-wrap td p + p {
                  font-size: 0.7rem !important;
                  margin-top: 1px !important;
                }
                .table-wrap td a {
                  font-size: 0.8125rem !important;
                }
                .table-wrap td .badge, .table-wrap td .stage-badge {
                  font-size: 0.72rem !important;
                  padding: 3px 9px !important;
                  border-radius: 9999px !important;
                  font-weight: 600 !important;
                  display: inline-flex !important;
                  align-items: center !important;
                  white-space: nowrap !important;
                  line-height: 1.25 !important;
                  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03) !important;
                  letter-spacing: 0.01em !important;
                }
                .table-wrap td span {
                  font-size: 0.8125rem !important;
                }
                .table-wrap td span.text-muted, .table-wrap td span + span {
                  font-size: 0.7rem !important;
                }
              `}</style>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--color-bg)', boxShadow: '0 1px 0 var(--color-border)' }}>
                  <tr>
                    {isMultiSelectMode && (
                      <th style={{ width: 44, padding: '1rem', borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                        <CustomCheckbox 
                          checked={selected.size === paged.length && paged.length > 0} 
                          onChange={toggleAll} 
                        />
                      </th>
                    )}
                    {visibleColsMap['student_code'] && (
                      <th style={{ width: '135px', maxWidth: '155px', padding: '0.85rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                        Mã HV / Nhập học
                      </th>
                    )}
                    {visibleColsMap['name'] && (
                      <th style={{ width: isSale ? '300px' : '290px', maxWidth: isSale ? '360px' : '350px', padding: '0.85rem 0.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>
                        Họ tên
                      </th>
                    )}
                    {(visibleColsMap['email'] || visibleColsMap['phone']) && (
                      <th style={{ width: '260px', maxWidth: '320px', padding: '0.85rem 0.75rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Liên lạc</th>
                    )}
                    {visibleColsMap['company'] && (
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Công ty</th>
                    )}
                    {visibleColsMap['tags'] && (
                      <th style={{ width: '150px', maxWidth: '175px', padding: '0.85rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                        Tags
                      </th>
                    )}
                    {visibleColsMap['program'] && (
                      <th style={{ width: '190px', maxWidth: '240px', padding: '0.85rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                        Tên chương trình
                      </th>
                    )}
                    {visibleColsMap['last_note'] && (
                      <th style={{ width: '230px', maxWidth: '280px', padding: '0.85rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                        Nhật ký (gần nhất)
                      </th>
                    )}
                    {visibleColsMap['admission_date'] && (
                      <th style={{ width: '140px', maxWidth: '160px', padding: '0.85rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                        Ngày nhập học
                      </th>
                    )}
                    {visibleColsMap['status'] && (
                      <th style={{ width: '135px', maxWidth: '150px', padding: '0.85rem 0.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                        Trạng thái
                      </th>
                    )}
                    {visibleColsMap['contact'] && (
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>Liên lạc cuối</th>
                    )}
                    {visibleColsMap['deal'] && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>Deal đang mở</th>}
                    {visibleColsMap['total_deposit'] && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>Thực thu / Đã đóng</th>}
                    {visibleColsMap['owner'] && (
                      <th style={{ width: (isSale && !visibleColsMap['last_note']) ? '250px' : '180px', maxWidth: (isSale && !visibleColsMap['last_note']) ? '280px' : '200px', padding: '0.85rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                        {(isSale && !visibleColsMap['last_note']) ? 'Tương tác gần nhất' : 'Sale phụ trách'}
                      </th>
                    )}
                    {visibleColsMap['distribution'] && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Phân bổ</th>}
                    {visibleColsMap['ticket_action'] && <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Helpdesk</th>}
                    {visibleColsMap['updated_at'] && (
                      <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>Cập nhật</th>
                    )}
                    {visibleColsMap['created_at'] && (
                      <th style={{ width: '130px', maxWidth: '160px', padding: '0.85rem 0.6rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                        {segment === 'customer' ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>Ngày chốt</span>
                            <Tooltip content="Ngày chuyển pipeline" position="bottom">
                              <AlertCircle size={14} style={{ color: 'var(--color-text-muted)', cursor: 'help' }} />
                            </Tooltip>
                          </div>
                        ) : 'Ngày tạo'}
                      </th>
                    )}
                    {visibleColsMap['score'] && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Score</th>}
                    {visibleColsMap['source'] && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>Nguồn khách</th>}
                    {visibleColsMap['campaign'] && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>Chiến dịch</th>}
                    {visibleColsMap['city'] && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>Khu vực</th>}
                    {visibleColsMap['job_title'] && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Chức danh</th>}
                    {visibleColsMap['birthday'] && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Ngày sinh</th>}
                    {visibleColsMap['temperature'] && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Nhiệt độ</th>}
                    {visibleColsMap['total_spent'] && <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--color-border)' }}>Doanh thu</th>}
                    {/* Hiding actions column header */}
                  </tr>
                </thead>

                <tbody>
                  {paged.map(c => {
                    const days = AGO_DAYS(c.last_contact);
                    const fullName = c.full_name || '';
                    const isUncontacted = isLeadUncontacted(c);
                    return (
                      <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                         style={{ transition: 'background 0.2s', cursor: 'pointer' }}
                         className="table-row-hover"
                         title={isUncontacted ? 'Lead mới giao hoặc giao lại chưa có tương tác mới' : undefined}
                         onClick={() => setProfileContact(c)}
                         onContextMenu={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           setContextMenu({ x: e.clientX, y: e.clientY, item: c });
                         }}>
                        {isMultiSelectMode && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
                            <CustomCheckbox 
                              checked={selected.has(c.id)} 
                              onChange={() => toggleSelect(c.id)} 
                            />
                          </td>
                        )}
                        {visibleColsMap['student_code'] && (
                          <td
                            style={{ width: '135px', maxWidth: '155px', padding: '0.85rem 0.6rem', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}
                            onMouseEnter={(e) => setHoveredCell({ contact: c, rect: e.currentTarget.getBoundingClientRect() })}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, fontFamily: 'monospace', padding: '2px 7px', borderRadius: '6px', background: 'rgba(100, 116, 139, 0.1)', color: 'var(--color-text-muted)' }}>
                                {c.student_code || c.student_id || ('KH' + String(c.id).padStart(6, '0'))}
                              </span>
                              {c.admission_date ? (() => {
                                const d = new Date(c.admission_date);
                                const pad = (n: number) => String(n).padStart(2, '0');
                                const formatted = isNaN(d.getTime())
                                  ? String(c.admission_date).slice(0, 10)
                                  : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                                return (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                    <Calendar size={11} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                    <span>{formatted}</span>
                                  </span>
                                );
                              })() : (
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa có ngày NH</span>
                              )}
                            </div>
                          </td>
                        )}
                        {visibleColsMap['name'] && (() => {
                          const refName = c.referrer_name 
                            || (c.company_tier === 'referrer' ? c.company_name : '')
                            || ((c.source === 'gioi_thieu' || c.source === 'ref' || c.source === 'referral') ? c.company_name : '')
                            || c.partner_name 
                            || '';
                          const isReferred = Boolean(c.partner_id || c.referrer_name || c.referrer_id || c.source === 'ref' || c.source === 'referral' || c.source === 'gioi_thieu' || refName);
                          return (
                          <td style={{ width: isSale ? '300px' : '290px', maxWidth: isSale ? '360px' : '350px', padding: '0.85rem 0.5rem', borderBottom: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Avatar name={fullName} src={c.avatar_url || c.avatar || c.photo} size={32} />
                              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                                <p style={{ fontWeight: 700, fontSize: '0.825rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center' }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={fullName}>{fullName}</span>
                                  {isReferred ? (
                                    <span title={refName ? `Khách hàng giới thiệu bởi: ${refName}` : 'Khách hàng được giới thiệu (Ref)'} style={{ display: 'inline-flex', marginLeft: '5px', color: refName ? getColorFromName(refName) : '#0284c7', flexShrink: 0 }}>
                                      <UserPlus size={13} />
                                    </span>
                                  ) : c.dl_status === 'databank_claim' || c.source === 'databank' ? (
                                    <span title="Khách hàng từ Databank" style={{ display: 'inline-flex', marginLeft: '4px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                                      <Layers size={12} />
                                    </span>
                                  ) : (!c.dl_status && c.source !== 'databank') || (c.source === 'ca_nhan' || c.source === 'gioi_thieu') ? (
                                    <span title="Khách hàng cá nhân" style={{ display: 'inline-flex', marginLeft: '4px', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                                      <User size={12} />
                                    </span>
                                  ) : null}
                                  {Number(c.linked_profiles_count) >= 2 && (
                                    <span 
                                      title={`Khách hàng có ${c.linked_profiles_count} chương trình/hồ sơ liên kết`} 
                                      style={{ 
                                        display: 'inline-flex', 
                                        alignItems: 'center', 
                                        gap: '2px', 
                                        marginLeft: '6px', 
                                        padding: '1px 5px', 
                                        borderRadius: '4px', 
                                        background: 'rgba(139, 92, 246, 0.12)', 
                                        color: '#7c3aed', 
                                        fontSize: '0.625rem', 
                                        fontWeight: 700, 
                                        flexShrink: 0,
                                        lineHeight: 1.2
                                      }}
                                    >
                                      <Layers size={10} />
                                      {c.linked_profiles_count}
                                    </span>
                                  )}
                                </p>
                                {visibleColsMap['company'] && c.company_name && (
                                  <p style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {c.company_name} {c.job_title ? `• ${c.job_title}` : ''}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          );
                        })()}
                        {(visibleColsMap['email'] || visibleColsMap['phone']) && (() => {
                          const refName = c.referrer_name 
                            || (c.company_tier === 'referrer' ? c.company_name : '')
                            || ((c.source === 'gioi_thieu' || c.source === 'ref' || c.source === 'referral') ? c.company_name : '')
                            || c.partner_name 
                            || '';
                          const refAvatar = c.referrer_avatar || c.partner_avatar || '';
                          const isReferred = Boolean(c.partner_id || c.referrer_name || c.referrer_id || c.source === 'ref' || c.source === 'referral' || c.source === 'gioi_thieu' || refName);
                          const hasPhone = Boolean(visibleColsMap['phone'] && (c.phone || c.mobile || c.phone2));
                          const hasEmail = Boolean(visibleColsMap['email'] && c.email);

                          return (
                          <td style={{ width: '260px', maxWidth: '320px', padding: '0.85rem 0.75rem', borderBottom: '1px solid var(--color-border)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxWidth: '310px', overflow: 'hidden' }}>
                              {hasPhone && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <PhoneLink phone={c.phone || c.mobile || c.phone2} style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)' }} />
                                  </div>
                                </div>
                              )}
                              {hasEmail && (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                                  <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.email}>{c.email}</span>
                                </div>
                              )}
                              {isReferred && (() => {
                                const refColor = refName ? getColorFromName(refName) : '#0284c7';
                                return (
                                  <div 
                                    style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '4px', 
                                      marginTop: (hasPhone || hasEmail) ? '3px' : '0',
                                      padding: '1px 6px 1px 2px',
                                      borderRadius: '12px',
                                      background: `${refColor}12`,
                                      width: 'fit-content',
                                      maxWidth: '100%',
                                      boxSizing: 'border-box'
                                    }} 
                                    title={refName ? `Người giới thiệu: ${refName}` : 'Khách hàng được giới thiệu (Ref)'}
                                  >
                                    {refName ? (
                                      <>
                                        <Avatar name={refName} src={refAvatar} size={16} />
                                        <span style={{ 
                                          fontSize: '0.6rem', 
                                          fontWeight: 700, 
                                          color: refColor, 
                                          opacity: 0.85, 
                                          transform: 'scale(0.82)', 
                                          transformOrigin: 'left center', 
                                          display: 'inline-block', 
                                          flexShrink: 0,
                                          lineHeight: 1,
                                          marginRight: '-2px'
                                        }}>
                                          REF:
                                        </span>
                                        <span style={{ 
                                          fontSize: '0.72rem', 
                                          fontWeight: 550, 
                                          color: 'var(--color-text)', 
                                          overflow: 'hidden', 
                                          textOverflow: 'ellipsis', 
                                          whiteSpace: 'nowrap',
                                          lineHeight: 1.2
                                        }}>
                                          {refName}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <UserPlus size={11} style={{ color: refColor, flexShrink: 0, marginLeft: '2px' }} />
                                        <span style={{ 
                                          fontSize: '0.6rem', 
                                          fontWeight: 700, 
                                          color: refColor, 
                                          opacity: 0.85, 
                                          transform: 'scale(0.82)', 
                                          transformOrigin: 'left center', 
                                          display: 'inline-block', 
                                          lineHeight: 1 
                                        }}>
                                          REF
                                        </span>
                                      </>
                                    )}
                                  </div>
                                );
                              })()}
                              {!hasPhone && !hasEmail && !isReferred && (
                                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>
                              )}
                            </div>
                          </td>
                          );
                        })()}

                        {visibleColsMap['company'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{c.company_name || '—'}</p>
                            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{c.job_title || ''}</p>
                          </td>
                        )}

                        {visibleColsMap['tags'] && (
                          <td
                            style={{ width: '150px', maxWidth: '175px', padding: '0.85rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}
                            onMouseEnter={(e) => setHoveredCell({ contact: c, rect: e.currentTarget.getBoundingClientRect() })}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {(() => {
                              const rawTagList = typeof c.tags === 'string' 
                                ? c.tags.split(',').map((t: string) => t.trim()).filter(Boolean) 
                                : (Array.isArray(c.tags) ? c.tags : []);

                              const cleanRegex = /^\d+\.\s*(status\s*-\s*)?/i;
                              const cleanedTags = rawTagList.map((tag: string) => {
                                return tag.replace(cleanRegex, '').trim();
                              }).filter(Boolean);

                              const uniqueTags = Array.from(new Set(cleanedTags));

                              if (uniqueTags.length === 0) return <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>;
                              
                              return (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '175px' }}>
                                  {uniqueTags.map((tag: string, idx: number) => {
                                    const lowerTag = tag.toLowerCase();
                                    const isProgramTag = lowerTag.includes('mba') || 
                                                         lowerTag.includes('bba') || 
                                                         lowerTag.includes('dba') || 
                                                         lowerTag.includes('msc') || 
                                                         lowerTag.includes('umef') || 
                                                         lowerTag.includes('emba');

                                    const matchedDbTag = dbTagsMap.get(lowerTag);
                                    
                                    let bg = matchedDbTag?.color || '#2563eb';
                                    let color = '#ffffff';

                                    if (isProgramTag) {
                                      bg = '#3b82f6'; // Force blue for program/course tags
                                    }

                                    return (
                                      <span 
                                        key={idx} 
                                        style={{ 
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          fontSize: '0.52rem', 
                                          fontWeight: 600, 
                                          padding: '2px 8px', 
                                          borderRadius: '10px', 
                                          background: bg,
                                          color: color,
                                          whiteSpace: 'nowrap',
                                          lineHeight: '1.2',
                                          boxSizing: 'border-box'
                                        }}
                                      >
                                        {tag}
                                      </span>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </td>
                        )}

                        {visibleColsMap['program'] && (
                          <td
                            style={{ width: '190px', maxWidth: '240px', padding: '0.85rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}
                            onMouseEnter={(e) => setHoveredCell({ contact: c, rect: e.currentTarget.getBoundingClientRect() })}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {(() => {
                              let displayProg = (c.program || c.project_name || '').trim();
                              if (!displayProg && c.tags) {
                                const rawTags = typeof c.tags === 'string' 
                                  ? c.tags.split(',').map((t: string) => t.trim()).filter(Boolean) 
                                  : (Array.isArray(c.tags) ? c.tags : []);
                                const progTag = rawTags.find((t: string) => {
                                  const lt = t.toLowerCase();
                                  return lt.includes('mba') || lt.includes('bba') || lt.includes('dba') || lt.includes('msc') || lt.includes('umef') || lt.includes('emba');
                                });
                                if (progTag) {
                                  displayProg = progTag.replace(/^\d+\.\s*(status\s*-\s*)?/i, '').trim();
                                }
                              }

                              if (!displayProg) {
                                return <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>;
                              }

                              return (
                                <span 
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    background: 'rgba(37, 99, 235, 0.08)',
                                    color: '#2563eb',
                                    maxWidth: '220px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis'
                                  }}
                                >
                                  <GraduationCap size={13} style={{ flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayProg}</span>
                                </span>
                              );
                            })()}
                          </td>
                        )}

                        {visibleColsMap['last_note'] && (
                          <td
                            style={{ width: '230px', maxWidth: '280px', padding: '0.85rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}
                            onMouseEnter={(e) => setHoveredCell({ contact: c, rect: e.currentTarget.getBoundingClientRect() })}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {(() => {
                              const noteText = cleanInteractionText(c.last_interaction || c.notes || '');
                              if (!noteText) {
                                return <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa có nhật ký</span>;
                              }
                              return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '180px', maxWidth: '265px' }}>
                                  <div
                                    style={{
                                      fontSize: '0.76rem',
                                      color: 'var(--color-text)',
                                      fontWeight: 500,
                                      lineHeight: 1.4,
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      wordBreak: 'break-word'
                                    }}
                                  >
                                    {noteText}
                                  </div>
                                  {(c.last_interaction_at || c.last_contact) && (
                                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                      <Clock size={10} style={{ flexShrink: 0 }} />
                                      <span>{formatTimeAgo(c.last_interaction_at || c.last_contact)}</span>
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        )}

                        {visibleColsMap['admission_date'] && (
                          <td
                            style={{ width: '140px', maxWidth: '160px', padding: '0.85rem 0.6rem', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}
                            onMouseEnter={(e) => setHoveredCell({ contact: c, rect: e.currentTarget.getBoundingClientRect() })}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {c.admission_date ? (() => {
                              const d = new Date(c.admission_date);
                              if (isNaN(d.getTime())) {
                                return <span style={{ fontSize: '0.8125rem', color: 'var(--color-text)' }}>{String(c.admission_date).slice(0, 10)}</span>;
                              }
                              const pad = (n: number) => String(n).padStart(2, '0');
                              return (
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                                  <Calendar size={13} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
                                  <span>{`${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`}</span>
                                </div>
                              );
                            })() : (
                              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>
                            )}
                          </td>
                        )}

                        {visibleColsMap['status'] && (
                          <td style={{ width: '135px', maxWidth: '150px', padding: '0.85rem 0.5rem', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                            {c.is_error_ticket ? (
                              <span 
                                className="stage-badge"
                                style={{ 
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                                  color: '#dc2626', 
                                  borderRadius: '9999px',
                                  padding: '3.5px 12px',
                                  fontSize: '0.76rem',
                                  fontWeight: 650,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  lineHeight: '1.2'
                                }}
                              >
                                Ticket lỗi
                              </span>
                            ) : c.status === 'pending_approval' ? (
                              <span 
                                className="stage-badge"
                                style={{ 
                                  backgroundColor: '#fef3c7', 
                                  color: '#d97706', 
                                  borderRadius: '9999px',
                                  padding: '3.5px 12px',
                                  fontSize: '0.76rem',
                                  fontWeight: 650,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  lineHeight: '1.2'
                                }}
                              >
                                Tạm giữ
                              </span>
                            ) : c.lead_status === 'nurture' ? (
                              <span 
                                className="stage-badge" 
                                style={{ 
                                  backgroundColor: 'rgba(2, 132, 199, 0.12)', 
                                  color: '#0284c7', 
                                  borderRadius: '9999px',
                                  padding: '3.5px 12px',
                                  fontSize: '0.76rem',
                                  fontWeight: 650,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  lineHeight: '1.2'
                                }}
                              >
                                Nurture
                              </span>
                            ) : c.lead_status === 'lost' ? (
                              <span 
                                className="stage-badge" 
                                style={{ 
                                  backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                                  color: '#dc2626', 
                                  borderRadius: '9999px',
                                  padding: '3.5px 12px',
                                  fontSize: '0.76rem',
                                  fontWeight: 650,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  lineHeight: '1.2'
                                }}
                              >
                                Lost
                              </span>
                            ) : (() => {
                              const stageInfo = getContactStage(c, pipelineStages);
                              if (stageInfo.isLost) {
                                return (
                                  <span 
                                    className="stage-badge" 
                                    style={{ 
                                      backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                                      color: '#dc2626', 
                                      borderRadius: '9999px',
                                      padding: '3.5px 12px',
                                      fontSize: '0.76rem',
                                      fontWeight: 650,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      lineHeight: '1.2'
                                    }}
                                  >
                                    Lost
                                  </span>
                                );
                              }
                              if (segment === 'customer' && studentSubTab === 'chinh_thuc' && c.study_status) {
                                const stMap: Record<string, { label: string; color: string; bg: string }> = {
                                  studying: { label: 'Đang học', color: '#16a34a', bg: '#dcfce7' },
                                  dang_hoc: { label: 'Đang học', color: '#16a34a', bg: '#dcfce7' },
                                  completed: { label: 'Đã hoàn thành', color: '#2563eb', bg: '#dbeafe' },
                                  reserved: { label: 'Bảo lưu', color: '#d97706', bg: '#fef3c7' },
                                  bao_luu: { label: 'Bảo lưu', color: '#d97706', bg: '#fef3c7' },
                                  suspended: { label: 'Tạm ngưng', color: '#dc2626', bg: '#fee2e2' },
                                  tam_ngung: { label: 'Tạm ngưng', color: '#dc2626', bg: '#fee2e2' }
                                };
                                const stMeta = stMap[String(c.study_status).toLowerCase()];
                                if (stMeta) {
                                  return (
                                    <span
                                      className="stage-badge"
                                      style={{
                                        backgroundColor: stMeta.bg,
                                        color: stMeta.color,
                                        borderRadius: '9999px',
                                        padding: '3.5px 12px',
                                        fontSize: '0.76rem',
                                        fontWeight: 700,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        lineHeight: '1.2'
                                      }}
                                    >
                                      {stMeta.label}
                                    </span>
                                  );
                                }
                              }
                              return (
                                <span 
                                  className="stage-badge" 
                                  style={{ 
                                    backgroundColor: stageInfo.isNewLead ? '#dc2626' : `${stageInfo.color}15`, 
                                    color: stageInfo.isNewLead ? '#ffffff' : stageInfo.color, 
                                    borderRadius: '9999px',
                                    padding: '3.5px 12px',
                                    fontSize: '0.76rem',
                                    fontWeight: stageInfo.isNewLead ? 700 : 650,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: '1.2'
                                  }}
                                >
                                  {stageInfo.name}
                                </span>
                              );
                            })()}
                          </td>
                        )}

                        {visibleColsMap['contact'] && (
                          <td
                            style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}
                            onMouseEnter={(e) => setHoveredCell({ contact: c, rect: e.currentTarget.getBoundingClientRect() })}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            <span style={{ fontSize: '0.8125rem', color: days > 30 ? 'var(--color-danger)' : days > 14 ? 'var(--color-warning)' : 'var(--color-text-muted)', fontWeight: days > 30 ? 700 : 400 }}>
                              {c.last_contact ? (days === 0 ? 'Hôm nay' : days === 1 ? 'Hôm qua' : `${days} ngày trước`) : '—'}
                            </span>
                          </td>
                        )}
                        {visibleColsMap['deal'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: (c.open_deal_value || 0) > 0 ? 'var(--color-primary)' : 'var(--color-text-muted)' }}>
                              {FMT_VND(c.open_deal_value || 0)}
                            </span>
                          </td>
                        )}
                        {visibleColsMap['total_deposit'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: Number(c.total_deposit || c.actual_revenue || 0) > 0 ? '#16a34a' : 'var(--color-text-muted)' }}>
                              {FMT_VND(Number(c.total_deposit || c.actual_revenue || 0))}
                            </span>
                          </td>
                        )}
                        {visibleColsMap['owner'] && (
                          <td
                            style={{ width: (isSale && !visibleColsMap['last_note']) ? '250px' : '210px', maxWidth: (isSale && !visibleColsMap['last_note']) ? '280px' : '240px', padding: '0.85rem 0.6rem', borderBottom: '1px solid var(--color-border)' }}
                            onMouseEnter={(e) => setHoveredCell({ contact: c, rect: e.currentTarget.getBoundingClientRect() })}
                            onMouseLeave={() => setHoveredCell(null)}
                          >
                            {isSale && !visibleColsMap['last_note'] ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {renderInteractionInfo(c, setReportingContact)}
                                <div 
                                  className="custom-scrollbar"
                                  onClick={e => e.stopPropagation()}
                                  style={{ 
                                    fontSize: '0.725rem', 
                                    color: c.last_interaction ? 'var(--color-text)' : 'var(--color-text-muted)',
                                    fontWeight: c.last_interaction ? 500 : 400,
                                    minWidth: '170px',
                                    maxWidth: '270px',
                                    maxHeight: '70px',
                                    overflowY: 'auto',
                                    whiteSpace: 'normal',
                                    wordBreak: 'break-word',
                                    lineHeight: '1.4',
                                    paddingRight: '4px'
                                  }}
                                >
                                  {cleanInteractionText(c.last_interaction) || 'Chưa có tương tác'}
                                </div>
                              </div>
                            ) : c.owner_name ? (() => {
                              const collabs = (c.collaborator_ids || '')
                                .split(',')
                                .map((s: string) => s.trim())
                                .filter(Boolean)
                                .map((id: string) => users.find(u => String(u.id) === String(id)))
                                .filter(Boolean);
                              const notePreview = visibleColsMap['last_note'] ? '' : cleanInteractionText(c.last_interaction || c.notes || '');
                              
                              if (collabs.length > 0) {
                                return (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                      <div style={{ position: 'relative', zIndex: 3 }}>
                                        <Avatar name={c.owner_name} src={c.owner_avatar} size={32} title={`Chủ sở hữu: ${c.owner_name}`} />
                                      </div>
                                      {collabs.map((col, idx) => (
                                        <div key={col.id} style={{ marginLeft: '-8px', position: 'relative', zIndex: 2 - idx }}>
                                          <Avatar name={col.full_name} src={col.avatar_url || col.avatar} size={32} title={`Hợp tác: ${col.full_name}`} />
                                        </div>
                                      ))}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {c.owner_name}
                                        <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>
                                          (+{collabs.length})
                                        </span>
                                      </span>
                                      {renderInteractionInfo(c, setReportingContact)}
                                      {notePreview && (
                                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', maxWidth: '165px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                          <MessageSquare size={10} style={{ flexShrink: 0 }} />
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{notePreview}</span>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                  <Avatar name={c.owner_name} src={c.owner_avatar} size={32} />
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{c.owner_name}</span>
                                    {renderInteractionInfo(c, setReportingContact)}
                                    {notePreview && (
                                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', maxWidth: '165px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                        <MessageSquare size={10} style={{ flexShrink: 0 }} />
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{notePreview}</span>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })() : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                                  <User size={16} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                                  <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Chưa giao</span>
                                  {renderInteractionInfo(c, setReportingContact)}
                                  {!visibleColsMap['last_note'] && cleanInteractionText(c.last_interaction || c.notes || '') && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', maxWidth: '165px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      <MessageSquare size={10} style={{ flexShrink: 0 }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{cleanInteractionText(c.last_interaction || c.notes || '')}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        )}
                        {visibleColsMap['distribution'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            {c.log_id && c.dl_status !== 'databank_claim' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                                    {c.round_name || 'Chia data'}
                                  </span>
                                  {c.is_error_ticket || c.report_status === 'pending' || c.report_status === 'approved' ? (
                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#dc2626' }}>
                                      {c.report_status === 'approved' ? 'Đã bù' : 'Đã báo lỗi'}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setReportingContact(c);
                                      }}
                                      style={{
                                        fontSize: '0.65rem',
                                        fontWeight: 650,
                                        padding: '1px 6px',
                                        borderRadius: '4px',
                                        background: 'rgba(239, 68, 68, 0.08)',
                                        color: '#dc2626',
                                        border: '1px solid rgba(239, 68, 68, 0.2)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '3px'
                                      }}
                                      title="Báo cáo data lỗi để bù vòng"
                                    >
                                      <AlertTriangle size={10} /> Báo lỗi
                                    </button>
                                  )}
                                </div>
                                <span style={{ fontSize: '0.725rem', color: 'var(--color-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                  {c.distributed_at ? new Date(c.distributed_at).toLocaleString('vi-VN') : '—'}
                                </span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                                {c.dl_status === 'databank_claim' ? 'Claim Databank' : 'Cá nhân'}
                              </span>
                            )}
                          </td>
                        )}
                        {visibleColsMap['ticket_action'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            {c.log_id && c.dl_status !== 'databank_claim' ? (
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                                {c.report_status === 'pending' && (
                                  <span className="badge warning" title="Ticket chờ duyệt">
                                    Chờ duyệt
                                  </span>
                                )}
                                {c.report_status === 'approved' && (
                                  <span className="badge success" title="Ticket đã duyệt bù">
                                    Đã bù
                                  </span>
                                )}
                                {c.report_status === 'approved_no_comp' && (
                                  <span className="badge" style={{ background: '#dbeafe', color: '#2563eb' }} title="Ticket duyệt lỗi không bù">
                                    Lỗi không bù
                                  </span>
                                )}
                                {c.report_status === 'rejected' && (
                                  <span className="badge danger" title="Từ chối">
                                    Từ chối
                                  </span>
                                )}
                                {(!c.report_status || c.report_status === 'rejected') && (
                                  <button onClick={() => setReportingContact(c)} className="btn sm danger" style={{ height: 28, padding: '0 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                    <AlertTriangle size={11} /> Báo lỗi
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>—</span>
                            )}
                          </td>
                        )}
                        {visibleColsMap['updated_at'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{c.updated_at ? new Date(c.updated_at).toLocaleDateString('vi-VN') : '—'}</p>
                          </td>
                        )}
                        {visibleColsMap['created_at'] && (
                          <td style={{ width: '130px', maxWidth: '160px', padding: '0.85rem 0.6rem', borderBottom: '1px solid var(--color-border)', whiteSpace: 'nowrap' }}>
                            {(segment === 'customer' ? (c.closed_date || c.created_at) : c.created_at) ? (() => {
                              const d = new Date(segment === 'customer' ? (c.closed_date || c.created_at) : c.created_at);
                              const pad = (n: number) => String(n).padStart(2, '0');
                              const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                              const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                              return (
                                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: 1.35 }}>
                                  <div style={{ fontWeight: 600 }}>{dateStr}</div>
                                  <div style={{ fontSize: '0.725rem', opacity: 0.85 }}>{timeStr}</div>
                                  {(() => {
                                    const latestActivityAt = c.distributed_at || c.updated_at;
                                    if (!latestActivityAt) return null;
                                    const distDate = new Date(latestActivityAt).toLocaleDateString('vi-VN');
                                    const createDate = c.created_at ? new Date(c.created_at).toLocaleDateString('vi-VN') : '';
                                    if (createDate && distDate !== createDate) {
                                      return (
                                        <div style={{ fontSize: '0.675rem', color: '#d97706', fontWeight: 600, marginTop: '2px', whiteSpace: 'nowrap' }}>
                                          {c.distributed_at ? 'Giao lại: ' : 'Cập nhật: '}{distDate}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              );
                            })() : '—'}
                          </td>
                        )}
                        {/* Removed interaction column */}
                        {visibleColsMap['score'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: c.score >= 80 ? 'var(--color-success)' : c.score >= 60 ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
                              {c.score}
                            </span>
                          </td>
                        )}
                        {visibleColsMap['source'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text)' }}>
                            {c.source || '—'}
                          </td>
                        )}
                        {visibleColsMap['campaign'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                            {c.campaign_name || c.utm_campaign || '—'}
                          </td>
                        )}
                        {visibleColsMap['city'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                            {c.city || c.district || '—'}
                          </td>
                        )}
                        {visibleColsMap['job_title'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text)' }}>
                            {c.job_title || '—'}
                          </td>
                        )}
                        {visibleColsMap['birthday'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem', color: 'var(--color-text)' }}>
                            {c.birthday ? new Date(c.birthday).toLocaleDateString('vi-VN') : '—'}
                          </td>
                        )}
                        {visibleColsMap['temperature'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
                            {(() => {
                              const temp = String(c.temperature).toLowerCase();
                              let label = 'Neutral';
                              let color = '#6b7280';
                              let bg = 'rgba(107, 114, 128, 0.1)';
                              if (temp === 'hot') { label = 'Hot'; color = '#ef4444'; bg = 'rgba(239, 68, 68, 0.1)'; }
                              else if (temp === 'warm') { label = 'Warm'; color = '#f97316'; bg = 'rgba(249, 115, 22, 0.1)'; }
                              else if (temp === 'cool') { label = 'Cool'; color = '#3b82f6'; bg = 'rgba(59, 130, 246, 0.1)'; }
                              else if (temp === 'cold') { label = 'Cold'; color = '#6b7280'; bg = 'rgba(107, 114, 128, 0.1)'; }
                              return (
                                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 650, color, background: bg }}>
                                  {label}
                                </span>
                              );
                            })()}
                          </td>
                        )}
                        {visibleColsMap['total_spent'] && (
                          <td style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)', fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            {FMT_VND(c.total_spent || 0)}
                          </td>
                        )}
                        {/* Hiding row actions cell */}
                      </motion.tr>
                    );
                  })}
                </tbody>
              </table>
              {total === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <Users size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                  <p style={{ fontWeight: 600 }}>Không tìm thấy liên hệ nào</p>
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: isMobile ? '0.5rem 0' : '1rem', background: 'transparent' }}>
              <div className="grid-cards-responsive">
                {paged.map(c => {
                  const days = AGO_DAYS(c.last_contact);
                  const fullName = c.full_name || '';
                  return (
                    <motion.div 
                      key={c.id} 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => setProfileContact(c)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ x: e.clientX, y: e.clientY, item: c });
                      }}
                      style={{ 
                        background: 'var(--color-surface)',
                        border: '1px solid var(--color-border-light)', 
                        borderRadius: '16px',
                        padding: isMobile ? '12px 16px' : '1.25rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: isMobile ? 'row' : 'column',
                        alignItems: isMobile ? 'center' : 'stretch',
                        justifyContent: 'space-between',
                        gap: isMobile ? '12px' : '0',
                        overflow: 'hidden'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.boxShadow = '0 12px 24px rgba(0, 0, 0, 0.08)';
                        e.currentTarget.style.transform = 'translateY(-4px)';
                        e.currentTarget.style.borderColor = 'var(--color-primary-light)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.03)';
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.borderColor = 'var(--color-border-light)';
                      }}
                    >
                      {isMobile ? (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            {isMultiSelectMode ? (
                              <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
                                <CustomCheckbox 
                                  checked={selected.has(c.id)} 
                                  onChange={() => toggleSelect(c.id)} 
                                />
                              </div>
                            ) : (
                              <div style={{ flexShrink: 0 }}>
                                <Avatar name={fullName} src={c.avatar_url || c.avatar || c.photo} size={42} />
                              </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--color-text)', lineHeight: 1.2 }}>
                                  {fullName}
                                </span>
                                {Number(c.linked_profiles_count) >= 2 && (
                                  <span 
                                    title={`Khách hàng có ${c.linked_profiles_count} chương trình/hồ sơ liên kết`} 
                                    style={{ 
                                      display: 'inline-flex', 
                                      alignItems: 'center', 
                                      gap: '2px', 
                                      padding: '1px 5px', 
                                      borderRadius: '4px', 
                                      background: 'rgba(139, 92, 246, 0.12)', 
                                      color: '#7c3aed', 
                                      fontSize: '0.625rem', 
                                      fontWeight: 700, 
                                      lineHeight: 1.2
                                    }}
                                  >
                                    <Layers size={10} />
                                    {c.linked_profiles_count}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                Điện thoại: {c.phone || '—'}
                              </span>
                            </div>
                          </div>
                          <div style={{ color: 'var(--color-text-light)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                            <ChevronRight size={18} />
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Top Accent line colored by Status */}
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            height: '4px',
                            background: (c.pipeline_status === 'hoc_vien' || c.stage_name === 'Học viên') ? '#ec4899' : (c.stage_color || (
                                        c.status === 'lead' ? 'var(--color-primary)' :
                                        c.status === 'qualified' ? 'var(--color-warning)' :
                                        c.status === 'customer' ? 'var(--color-success)' :
                                        'var(--color-text-muted)'
                                        ))
                          }} />

                          {/* Header Section */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', width: '100%' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                                <Avatar name={fullName} size={42} />
                                <div>
                                  <h3 style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--color-text)', marginBottom: '2px', lineHeight: 1.2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                    <span>{fullName}</span>
                                    {c.dl_status === 'databank_claim' || c.source === 'databank' ? (
                                      <span title="Khách hàng từ Databank" style={{ display: 'inline-flex', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                                        <Layers size={14} />
                                      </span>
                                    ) : (!c.dl_status && c.source !== 'databank') || (c.source === 'ca_nhan' || c.source === 'gioi_thieu') ? (
                                      <span title="Khách hàng cá nhân" style={{ display: 'inline-flex', color: 'var(--color-text-muted)', flexShrink: 0 }}>
                                        <User size={14} />
                                      </span>
                                    ) : null}
                                    {Number(c.linked_profiles_count) >= 2 && (
                                      <span 
                                        title={`Khách hàng có ${c.linked_profiles_count} chương trình/hồ sơ liên kết`} 
                                        style={{ 
                                          display: 'inline-flex', 
                                          alignItems: 'center', 
                                          gap: '2px', 
                                          padding: '1px 5px', 
                                          borderRadius: '4px', 
                                          background: 'rgba(139, 92, 246, 0.12)', 
                                          color: '#7c3aed', 
                                          fontSize: '0.625rem', 
                                          fontWeight: 700, 
                                          lineHeight: 1.2
                                        }}
                                      >
                                        <Layers size={10} />
                                        {c.linked_profiles_count}
                                      </span>
                                    )}
                                  </h3>
                                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <Building2 size={11} /> {c.company_name || 'Khách hàng cá nhân'}
                                  </p>
                                </div>
                              </div>
                              <div onClick={e => e.stopPropagation()} style={{ marginRight: '-4px', marginTop: '-4px' }}>
                                <CustomCheckbox 
                                  checked={selected.has(c.id)} 
                                  onChange={() => toggleSelect(c.id)} 
                                />
                              </div>
                            </div>

                            {/* Contact Details Quick View */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '1rem', padding: '0.625rem', background: 'var(--color-bg)', borderRadius: '10px' }}>
                              {c.phone && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--color-text)', fontWeight: 600 }}>
                                  <Phone size={12} style={{ color: 'var(--color-text-muted)' }} />
                                  <span>{c.phone}</span>
                                </div>
                              )}
                              {c.email && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  <Mail size={12} style={{ color: 'var(--color-text-muted)' }} />
                                  <span>{c.email}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Status Badges & Score */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                              {c.report_status === 'approved' || c.report_status === 'approved_no_comp' ? (
                                <span 
                                  className="badge" 
                                  style={{ 
                                    borderRadius: '8px', 
                                    padding: '4px 8px', 
                                    fontSize: '0.72rem', 
                                    fontWeight: 700,
                                    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                                    color: 'var(--color-danger)'
                                  }}
                                >
                                  Ticket lỗi
                                </span>
                              ) : c.lead_status === 'nurture' ? (
                                <span 
                                  className="stage-badge" 
                                  style={{ 
                                    borderRadius: '9999px', 
                                    padding: '3.5px 12px', 
                                    fontSize: '0.74rem', 
                                    fontWeight: 650,
                                    backgroundColor: 'rgba(2, 132, 199, 0.12)', 
                                    color: '#0284c7', 
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    lineHeight: '1.2'
                                  }}
                                >
                                  Nurture
                                </span>
                              ) : (() => {
                                const stageInfo = getContactStage(c, pipelineStages);
                                if (stageInfo.isLost) {
                                  return (
                                    <span 
                                      className="stage-badge" 
                                      style={{ 
                                        borderRadius: '9999px', 
                                        padding: '3.5px 12px', 
                                        fontSize: '0.74rem', 
                                        fontWeight: 650,
                                        backgroundColor: 'rgba(239, 68, 68, 0.12)', 
                                        color: '#dc2626', 
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        lineHeight: '1.2'
                                      }}
                                    >
                                      Lost
                                    </span>
                                  );
                                }
                                return (
                                  <span 
                                    className="stage-badge" 
                                    style={{ 
                                      borderRadius: '9999px', 
                                      padding: '3.5px 12px', 
                                      fontSize: '0.74rem', 
                                      fontWeight: stageInfo.isNewLead ? 700 : 650,
                                      backgroundColor: stageInfo.isNewLead ? '#dc2626' : `${stageInfo.color}15`, 
                                      color: stageInfo.isNewLead ? '#ffffff' : stageInfo.color, 
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      lineHeight: '1.2'
                                    }}
                                  >
                                    {stageInfo.name}
                                  </span>
                                );
                              })()}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Đánh giá:</span>
                                <span style={{ 
                                  fontSize: '0.75rem', 
                                  padding: '2px 8px', 
                                  background: c.score >= 80 ? 'rgba(16, 185, 129, 0.1)' : c.score >= 60 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(107, 114, 128, 0.1)', 
                                  color: c.score >= 80 ? 'var(--color-success)' : c.score >= 60 ? 'var(--color-warning)' : 'var(--color-text-muted)',
                                  borderRadius: '6px', 
                                  fontWeight: 700 
                                }}>
                                  {c.score} pts
                                </span>
                              </div>
                            </div>

                            {/* Footer Grid */}
                            <div
                              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', paddingTop: '0.875rem', borderTop: '1px solid var(--color-border-light)' }}
                              onMouseEnter={(e) => setHoveredCell({ contact: c, rect: e.currentTarget.getBoundingClientRect() })}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              {segment === 'customer' ? (
                                <>
                                  <div>
                                    <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '2px', letterSpacing: '0.02em' }}>Chương trình</p>
                                    <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {c.program || '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '2px', letterSpacing: '0.02em' }}>Ngày nhập học</p>
                                    <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                      {c.admission_date ? (() => {
                                        const d = new Date(c.admission_date);
                                        if (isNaN(d.getTime())) return String(c.admission_date).slice(0, 10);
                                        const pad = (n: number) => String(n).padStart(2, '0');
                                        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                                      })() : '—'}
                                    </p>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '2px', letterSpacing: '0.02em' }}>Ngày tạo</p>
                                    <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                      {c.created_at ? (() => {
                                        const d = new Date(c.created_at);
                                        const pad = (n: number) => String(n).padStart(2, '0');
                                        return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
                                      })() : '—'}
                                    </p>
                                  </div>
                                  <div>
                                    <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'var(--color-text-muted)', fontWeight: 700, marginBottom: '2px', letterSpacing: '0.02em' }}>Tương tác cuối</p>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                                      {renderInteractionInfo(c, setReportingContact)}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </motion.div>
                  );
                })}
              </div>
              {total === 0 && (
                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <Users size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
                  <p style={{ fontWeight: 600 }}>Không tìm thấy liên hệ nào</p>
                </div>
              )}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '0.75rem', marginTop: '0.75rem', width: '100%' }}>
            <Pagination
              total={total}
              page={page}
              pageSize={pageSize}
              onChange={setPage}
              showSizeChanger
              onPageSizeChange={size => {
                setPageSize(size);
                localStorage.setItem('Ideas_contacts_page_size', String(size));
                setPage(1);
              }}
            />
          </div>
        </div>
      )}
        </>
      )}

      {/* 360° Profile Drawer */}
      {profileContact && (
        <Suspense fallback={null}>
          <CustomerProfileDrawer
            isOpen={!!profileContact}
            onClose={() => {
              setProfileContact(null);
              fetchData(true);
            }}
            contact={profileContact}
            onUpdate={updated => {
              if (updated === null) {
                setContacts(p => p.filter(c => c.id !== profileContact?.id));
                setProfileContact(null);
                fetchData();
                return;
              }
              setContacts(p => {
                const exists = p.some(c => c.id === updated?.id);
                if (exists) {
                  return p.map(c => c.id === updated?.id ? { ...c, ...updated, score: calcScore(updated, scoringRules, decayDays) } : c);
                } else {
                  return [{ ...updated, score: calcScore(updated, scoringRules, decayDays) }, ...p];
                }
              });
              setProfileContact(updated);
            }}
          />
        </Suspense>
      )}
      
      <ReportDataModal
        isOpen={Boolean(reportingContact)}
        contact={reportingContact}
        onClose={() => setReportingContact(null)}
        onSuccess={() => {
          setReportingContact(null);
          fetchData(true);
        }}
      />

      <ImportExportModal 
        isOpen={showImportExport} 
        onClose={() => setShowImportExport(false)} 
        entityName="Liên hệ" 
        onExport={(format) => {
          bulkExport();
        }}
      />

      {showBulkAssignModal && (
        <CustomModal
          isOpen={showBulkAssignModal}
          onClose={() => !isBulkAssigning && setShowBulkAssignModal(false)}
          title={`Điều chuyển ${selected.size} khách hàng đã chọn`}
          width={480}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0 }}>
              Chọn nhân sự kinh doanh / tư vấn viên để nhận bàn giao <strong>{selected.size}</strong> khách hàng đã chọn:
            </p>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600 }}>Nhân sự nhận bàn giao</label>
              <CustomSelect
                options={users.filter(u => u.is_active !== 0).map(u => ({
                  value: String(u.id),
                  label: u.full_name || u.name,
                  avatar: u.avatar || u.avatar_url,
                  sublabel: [u.phone, u.role].filter(Boolean).join(' - ')
                }))}
                value={bulkAssignTargetUserId}
                onChange={val => setBulkAssignTargetUserId(String(val))}
                placeholder="Chọn nhân sự phụ trách..."
                searchable
                showAvatars
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn secondary"
                disabled={isBulkAssigning}
                onClick={() => setShowBulkAssignModal(false)}
              >
                Hủy
              </button>
              <button
                type="button"
                className="btn primary"
                disabled={isBulkAssigning || !bulkAssignTargetUserId}
                onClick={handleExecuteBulkAssign}
              >
                {isBulkAssigning ? 'Đang điều chuyển...' : 'Xác nhận điều chuyển'}
              </button>
            </div>
          </div>
        </CustomModal>
      )}

      {/* Quick Create Contact Modal - Enhanced UI */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showCreateModal && (
            <motion.div 
            className="overlay-backdrop" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={() => !creating && setShowCreateModal(false)} 
            style={{ zIndex: 1000 }}
          >
            <motion.div
              className="modal-sheet"
              initial={isMobile ? { opacity: 0, y: '100%' } : { opacity: 0, scale: 0.95, y: 20 }}
              animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 }}
              exit={isMobile ? { opacity: 0, y: '100%' } : { opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
              onClick={e => e.stopPropagation()}
              style={isMobile ? { 
                position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
                maxWidth: '100vw', zIndex: 1010, overflow: 'hidden', borderRadius: 0,
                display: 'flex', flexDirection: 'column'
              } : { 
                width: 780, 
                maxWidth: 'calc(100vw - 2rem)', zIndex: 1010, overflow: 'visible',
                margin: 'auto'
              }}
            >
              {/* Header */}
              <div className="modal-header" style={{ padding: isMobile ? '1.25rem' : '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.75rem' : '1.25rem' }}>
                  <div style={{ width: isMobile ? 40 : 52, height: isMobile ? 40 : 52, borderRadius: '16px', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={isMobile ? 20 : 26} style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>Thêm Liên hệ mới</h3>
                    <p style={{ fontSize: isMobile ? '0.75rem' : '0.875rem', color: 'var(--color-text-light)', marginTop: 2 }}>{isMobile ? 'Nhập thông tin để quản lý khách hàng' : 'Nhập thông tin cơ bản để bắt đầu quản lý khách hàng'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCreateModal(false)} 
                  className="btn-icon-bare" 
                  disabled={creating}
                ><X size={isMobile ? 20 : 24} /></button>
              </div>

              {/* Body */}
              <div className="modal-body" style={{ padding: isMobile ? '1.25rem' : '2.5rem', overflowY: 'auto' }}>
                {/* Name row */}
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Họ tên <span style={{ color: 'var(--color-danger)' }}>*</span></label>
                  <input className="form-input lg" placeholder="Nhập đầy đủ họ tên" value={createForm.full_name} onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))} autoFocus />
                </div>

                {/* Contact row */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1rem' : '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Số điện thoại</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input lg" style={{ paddingRight: '2.75rem' }} placeholder="09xx xxx xxx" value={createForm.phone} onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))} />
                      <Phone size={18} style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', opacity: 0.7, pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Email liên hệ</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input lg" style={{ paddingRight: '2.75rem' }} type="email" placeholder="email@congty.com" value={createForm.email} onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))} />
                      <Mail size={18} style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', opacity: 0.7, pointerEvents: 'none' }} />
                    </div>
                  </div>
                </div>

                {/* Company + Job */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1rem' : '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Công ty / Tổ chức</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input lg" style={{ paddingRight: '2.75rem' }} placeholder="Tên công ty..." value={createForm.company_name} onChange={e => setCreateForm(f => ({ ...f, company_name: e.target.value }))} />
                      <Building2 size={18} style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', opacity: 0.7, pointerEvents: 'none' }} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Chức vụ</label>
                    <div style={{ position: 'relative' }}>
                      <input className="form-input lg" style={{ paddingRight: '2.75rem' }} placeholder="VD: Giám đốc, Kế toán..." value={createForm.job_title} onChange={e => setCreateForm(f => ({ ...f, job_title: e.target.value }))} />
                      <Briefcase size={18} style={{ position: 'absolute', right: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', opacity: 0.7, pointerEvents: 'none' }} />
                    </div>
                  </div>
                </div>

                {/* Status + Source */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: isMobile ? '1rem' : '1.5rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Trạng thái Lead</label>
                    <CustomSelect 
                      options={[
                        { value: 'lead', label: 'Lead mới (Chưa xử lý)' },
                        { value: 'qualified', label: 'Đủ điều kiện (Qualified)' },
                        { value: 'customer', label: 'Học viên (Closed Won)' }
                      ]} 
                      value={createForm.status} 
                      onChange={val => setCreateForm(f => ({ ...f, status: val.toString() }))} 
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>Phụ trách bởi (Sale)</label>
                    {isSale ? (
                      <input 
                        className="form-input lg" 
                        value={user?.name || user?.username || ''} 
                        readOnly 
                        disabled 
                        style={{ background: 'var(--color-bg)', cursor: 'not-allowed' }}
                      />
                    ) : (
                      <CustomSelect 
                        options={users.map(u => ({ 
                          value: u.id, 
                          label: u.full_name || u.name, 
                          avatar: u.avatar_url,
                          sublabel: [u.phone, u.email, u.role].filter(Boolean).join(' - ')
                        }))}
                        value={createForm.owner_id}
                        onChange={val => setCreateForm(f => ({ ...f, owner_id: val.toString() }))}
                        placeholder="Chọn sale phụ trách..."
                        searchable
                        showAvatars
                      />
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>Nguồn khách hàng</label>
                  <CustomSelect 
                    options={[
                      { value: 'website', label: 'Đăng ký từ Website' },
                      { value: 'gioi_thieu', label: 'Được giới thiệu' },
                      { value: 'ca_nhan', label: 'Cá nhân tự khai thác' },
                      { value: 'social', label: 'Mạng xã hội (FB/Zalo)' },
                      { value: 'cold_call', label: 'Telesale / Cold Call' },
                      { value: 'event', label: 'Sự kiện / Workshop' },
                      { value: 'other', label: 'Nguồn khác' }
                    ]} 
                    value={createForm.source} 
                    onChange={val => setCreateForm(f => ({ ...f, source: val.toString() }))} 
                  />
                </div>
                <div className="form-group" style={{ marginTop: isMobile ? '1rem' : '1.5rem' }}>
                  <AddressSelect 
                    label="Địa chỉ khách hàng"
                    value={createForm.address || ''}
                    onChange={addr => setCreateForm(f => ({ ...f, address: addr }))}
                    placeholder="Chọn địa chỉ..."
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="modal-footer" style={{ padding: isMobile ? '1rem 1.25rem' : '1.5rem 2.5rem' }}>
                <button className={`btn outline ${isMobile ? 'sm' : 'lg'}`} onClick={() => setShowCreateModal(false)} disabled={creating}>Hủy bỏ</button>
                <button 
                  className={`btn primary ${isMobile ? 'sm' : 'lg'}`} 
                  onClick={handleCreateContact} 
                  disabled={creating} 
                  style={{ minWidth: isMobile ? 140 : 200, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                >
                  {creating ? <Loader2 size={20} className="spin" /> : <Plus size={20} />}
                  {creating ? 'Đang khởi tạo...' : 'Tạo Liên hệ'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    , document.body)}
      {/* Solid Dark Context Menu on Right Click */}
      <TableContextMenu
        isOpen={!!contextMenu}
        x={contextMenu?.x || 0}
        y={contextMenu?.y || 0}
        item={contextMenu?.item ? {
          ...contextMenu.item,
          name: contextMenu.item.full_name || contextMenu.item.name,
          phone: contextMenu.item.phone || contextMenu.item.mobile
        } : null}
        onClose={() => setContextMenu(null)}
        onOpenProfile={(item) => setProfileContact(item)}
        availableStatuses={contextStatuses}
        onChangeStatus={handleContextChangeStatus}
        onDelete={canAddOrAssign ? handleContextDelete : undefined}
      />

      {/* Rich Floating Hover Tooltip for Interaction Note, Program, Admission Date & Tags (Light Surface, No Badge Border, Lucide Icons) */}
      <ContactsFloatingTooltip triggerRef={hoveredCellTriggerRef} pipelineStages={pipelineStages} />
    </div>
  );
};
