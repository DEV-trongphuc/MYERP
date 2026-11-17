import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Mail,
  Calendar,
  Paperclip,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Plus,
  Clock,
  Users,
  FileText,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { API_BASE } from '../../config/env';
import { getCachedTenantBootstrap, getTenantOrganizationName } from '../../contexts/TenantConfigContext';
import {
  STANDARD_PROGRAM_NAMES,
  resolveCurriculumSubjects,
} from './StudentAcademicWorkspace';

const API_URL = API_BASE;

function buildAcademicApiUrl(rawUrl: string): string {
  const idx = rawUrl.indexOf('/academic/');
  if (idx === -1) return rawUrl;
  const base = rawUrl.slice(0, idx);
  const rest = rawUrl.slice(idx + 1); // "academic/..."
  const [actionPart, qsPart] = rest.split('?');
  return `${base}/api.php?action=${encodeURIComponent(actionPart)}${qsPart ? `&${qsPart}` : ''}`;
}

async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token =
    localStorage.getItem('Ideas_token') ||
    localStorage.getItem('access_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('auth_token') ||
    '';
  const headers = new Headers(options.headers || {});
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(buildAcademicApiUrl(url), { ...options, headers });
}

const getDefaultAcademicCc = () => getCachedTenantBootstrap()?.organization?.academic_cc_emails || '';

export const AFTERNOON_SLOTS = [
  '13:30-14:00',
  '14:00-14:30',
  '14:30-15:00',
  '15:00-15:30',
  '15:30-16:00',
  '16:00-16:30',
];

export const EVENING_SLOTS = [
  '19:00-19:30',
  '19:30-20:00',
  '20:00-20:30',
  '20:30-21:00',
  '21:00-21:30',
];

export const DAY_KEYS: Array<{ key: string; label: string; vnLabel: string }> = [
  { key: 'mon', label: 'Mon', vnLabel: 'Thứ 2' },
  { key: 'tue', label: 'Tue', vnLabel: 'Thứ 3' },
  { key: 'wed', label: 'Wed', vnLabel: 'Thứ 4' },
  { key: 'thu', label: 'Thu', vnLabel: 'Thứ 5' },
  { key: 'fri', label: 'Fri', vnLabel: 'Thứ 6' },
  { key: 'sat', label: 'Sat', vnLabel: 'Thứ 7' },
  { key: 'sun', label: 'Sun', vnLabel: 'CN' },
];

function buildDefaultAvailableMatrix(): Record<string, string[]> {
  const all = [...AFTERNOON_SLOTS, ...EVENING_SLOTS];
  return {
    mon: [...all],
    tue: [...all],
    wed: [...AFTERNOON_SLOTS],
    thu: [...all],
    fri: [...all],
    sat: [...AFTERNOON_SLOTS],
    sun: [],
  };
}

interface LecturerInvitationAnd1on1ModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'invitation' | '1on1';
  lecturer?: {
    id?: number;
    name?: string;
    email?: string;
    phone?: string;
    degree_title?: string;
    teaching_subjects?: string;
  } | null;
  courses?: any[];
  existingFiles?: Array<{ id: number; original_name: string; file_url?: string }>;
  campaignId?: number | null;
  campaignName?: string;
  zIndex?: number;
}

export const LecturerInvitationAnd1on1Modal: React.FC<
  LecturerInvitationAnd1on1ModalProps
> = ({
  isOpen,
  onClose,
  initialTab = 'invitation',
  lecturer,
  courses = [],
  existingFiles = [],
  campaignId,
  campaignName,
  zIndex = 2147483646,
}) => {
  const [activeTab, setActiveTab] = useState<'invitation' | '1on1'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  // --- TAB 1: LECTURER CONTRACT & INVITATION EMAIL STATE ---
  const [templateKey, setTemplateKey] = useState<
    'contract_invitation' | 'schedule_confirmation' | 'mentoring_1on1_invite'
  >('contract_invitation');
  const [toEmail, setToEmail] = useState<string>(lecturer?.email || '');
  const [ccEmails, setCcEmails] = useState<string>(getDefaultAcademicCc());
  const [subject, setSubject] = useState<string>('');
  const [courseName, setCourseName] = useState<string>(
    campaignName ||
      courses?.[0]?.course_name ||
      courses?.[0]?.name ||
      'MSC - AI'
  );
  const [subjectName, setSubjectName] = useState<string>(
    courses?.[0]?.subject_name ||
      lecturer?.teaching_subjects ||
      'Artificial Intelligence and Machine Learning'
  );
  const [showHtmlEditor, setShowHtmlEditor] = useState<boolean>(false);
  const [mentoringProgram, setMentoringProgram] = useState<string>('MSC - AI');
  const [scheduleSummary, setScheduleSummary] = useState<string>(
    'Theo lịch đào tạo đính kèm (Buổi chiều 13:30 - 16:30 / Buổi tối 19:00 - 21:30)'
  );
  const [remunerationNote, setRemunerationNote] = useState<string>(
    'Theo quy chế thù lao Giảng viên & Hợp đồng dịch vụ giảng dạy đính kèm.'
  );
  const [meetingLink, setMeetingLink] = useState<string>('https://zoom.us/j/ideas-class');
  const [bodyHtml, setBodyHtml] = useState<string>('');
  const [selectedCloudFileIds, setSelectedCloudFileIds] = useState<number[]>([]);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const [sendingEmail, setSendingEmail] = useState<boolean>(false);
  const [emailNotice, setEmailNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const localFileInputRef = useRef<HTMLInputElement | null>(null);

  // --- TAB 2: 1-ON-1 MENTORING 30-MIN CONFIG STATE ---
  const [configsList, setConfigsList] = useState<any[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState<boolean>(false);
  const [savingConfig, setSavingConfig] = useState<boolean>(false);
  const [selectedConfigId, setSelectedConfigId] = useState<number>(0);
  const [configForm, setConfigForm] = useState<{
    title: string;
    subject_name: string;
    lecturer_name: string;
    lecturer_email: string;
    lecturer_phone: string;
    week_label: string;
    week_start_date: string;
    week_end_date: string;
    slot_duration: number;
    meeting_link: string;
    cc_emails: string;
    notes_vn: string;
    notes_en: string;
    available_slots: Record<string, string[]>;
    booking_code: string;
    public_url: string;
  }>(() => {
    const today = new Date();
    const day = today.getDay();
    const diffToMon = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    const nextMon = new Date(today);
    nextMon.setDate(today.getDate() + diffToMon);
    const nextSun = new Date(nextMon);
    nextSun.setDate(nextMon.getDate() + 6);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const fmtShort = (d: Date) =>
      `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

    return {
      title: `Class Schedule (${fmtShort(nextMon)} - ${fmtShort(nextSun)}) - Hướng dẫn 1:1`,
      subject_name:
        courses?.[0]?.subject_name ||
        lecturer?.teaching_subjects ||
        'BBA/MBA Capstone & Thesis 1:1 Mentoring',
      lecturer_name: lecturer?.name || 'Giảng viên Hướng dẫn',
      lecturer_email: lecturer?.email || '',
      lecturer_phone: lecturer?.phone || '',
      week_label: `Class Schedule (${fmtShort(nextMon)} - ${fmtShort(nextSun)})`,
      week_start_date: fmt(nextMon),
      week_end_date: fmt(nextSun),
      slot_duration: 30,
      meeting_link: 'https://zoom.us/j/ideas-1on1',
      cc_emails: getDefaultAcademicCc(),
      notes_vn:
        '1. Xem lịch trống trong tuần để chọn các khung giờ phù hợp.\n2. Đăng ký trực tiếp khung giờ 30 phút bên dưới.\n3. Học viên phải đăng ký lịch ít nhất 1 ngày trước buổi hướng dẫn để Ban Học vụ IDEAS có thời gian sắp xếp với Giảng viên.',
      notes_en:
        '1. Check the weekly schedule for available 30-minute time slots.\n2. Select and register your preferred slot directly.\n3. Students must register at least 1 day in advance to allow IDEAS sufficient time to coordinate with the instructor.',
      available_slots: buildDefaultAvailableMatrix(),
      booking_code: '',
      public_url: '',
    };
  });
  const [configBookings, setConfigBookings] = useState<any[]>([]);
  const [configNotice, setConfigNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (lecturer?.email) setToEmail(lecturer.email);
  }, [lecturer]);

  // Build HTML template for Lecturer Email
  const generateEmailTemplateHtml = useCallback(
    (
      tpl: 'contract_invitation' | 'schedule_confirmation' | 'mentoring_1on1_invite',
      oneOnOneUrl?: string
    ) => {
      const gvTitle = lecturer?.degree_title ? `${lecturer.degree_title} ` : 'Thầy/Cô ';
      const gvName = lecturer?.name || 'Quý Giảng viên';

      // Build schedule rows from courses if available
      const courseRowsHtml =
        Array.isArray(courses) && courses.length > 0
          ? courses
              .slice(0, 8)
              .map(
                (c, i) => `
            <tr>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;">${i + 1}</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:700;color:#0f172a;">${
                c.subject_name || c.name || subjectName
              }</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;">${
                c.course_name || c.campaign_name || courseName
              }</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;">${
                c.sessions_count || c.credits || 6
              } buổi</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;">${
                c.start_date || 'Theo lịch phân công'
              }</td>
            </tr>`
              )
              .join('')
          : `
            <tr>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;">1</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:700;color:#0f172a;">${subjectName}</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;">${courseName}</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;text-align:center;">Theo chương trình</td>
              <td style="padding:8px 10px;border:1px solid #cbd5e1;">${scheduleSummary}</td>
            </tr>`;

      const scheduleTable = `
        <table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;">
          <thead>
            <tr style="background:#0f172a;color:#ffffff;">
              <th style="padding:9px 10px;border:1px solid #0f172a;width:40px;">#</th>
              <th style="padding:9px 10px;border:1px solid #0f172a;text-align:left;">Môn học / Chuyên đề</th>
              <th style="padding:9px 10px;border:1px solid #0f172a;text-align:left;">Chương trình / Khóa</th>
              <th style="padding:9px 10px;border:1px solid #0f172a;width:90px;">Thời lượng</th>
              <th style="padding:9px 10px;border:1px solid #0f172a;text-align:left;">Lịch dự kiến</th>
            </tr>
          </thead>
          <tbody>
            ${courseRowsHtml}
          </tbody>
        </table>
      `;

      const link1on1Block =
        oneOnOneUrl || configForm.public_url
          ? `<div style="margin:14px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #BD1D2D;border-radius:8px;">
              <div style="font-weight:700;color:#991b1b;margin-bottom:4px;">📅 Link Lịch Hướng dẫn 1:1 (Khung 30 phút tự động đồng bộ Calendar):</div>
              <a href="${oneOnOneUrl || configForm.public_url}" style="color:#BD1D2D;font-weight:700;word-break:break-all;">${
                oneOnOneUrl || configForm.public_url
              }</a>
            </div>`
          : '';

      const orgBrand = getTenantOrganizationName('IDEAS');
      const orgSupportEm = getCachedTenantBootstrap()?.organization?.support_email || getDefaultAcademicCc().split(',')[0]?.trim() || '';
      if (tpl === 'contract_invitation') {
        setSubject(
          `[${orgBrand}] Thư Mời Giảng & Hợp Đồng Giảng Dạy - ${subjectName} (${gvTitle}${gvName})`
        );
        setBodyHtml(`<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.65;color:#1e293b;">
  <p>Kính gửi <strong>${gvTitle}${gvName}</strong>,</p>
  <p>Lời đầu tiên, <strong>Ban Học vụ — ${orgBrand}</strong> xin gửi lời chào trân trọng và lời chúc sức khỏe, thành công đến Quý Thầy/Cô.</p>
  <p>Căn cứ vào kế hoạch đào tạo chương trình <strong>${courseName}</strong>, ${orgBrand} trân trọng kính mời <strong>${gvTitle}${gvName}</strong> tham gia giảng dạy và hướng dẫn chuyên môn với thông tin chi tiết như sau:</p>
  ${scheduleTable}
  <ul style="padding-left:20px;margin:12px 0;">
    <li><strong>Hình thức giảng dạy / Link lớp học:</strong> <a href="${meetingLink}" style="color:#BD1D2D;">${meetingLink}</a></li>
    <li><strong>Chế độ thù lao & Hợp đồng:</strong> ${remunerationNote}</li>
    <li><strong>Hồ sơ đính kèm:</strong> Hợp đồng mời giảng & Tài liệu hướng dẫn giảng dạy (đính kèm trong email này).</li>
  </ul>
  ${link1on1Block}
  <p>Quý Thầy/Cô vui lòng xem xét dự thảo <strong>Hợp đồng mời giảng</strong> đính kèm và phản hồi xác nhận lại giúp Ban Học vụ để ${orgBrand} hoàn tất thủ tục đào tạo cho lớp.</p>
  <p>Mọi thông tin hỗ trợ học thuật và kỹ thuật lớp học, Quý Thầy/Cô có thể liên hệ trực tiếp Ban Học vụ qua email này.</p>
  <p>Trân trọng cảm ơn sự đồng hành của Quý Thầy/Cô,<br/>
  <strong>Ban Học vụ — ${orgBrand}</strong><br/>
  Email: ${getDefaultAcademicCc() || orgSupportEm}</p>
</div>`);
      } else if (tpl === 'schedule_confirmation') {
        setSubject(
          `[${orgBrand}] Thông Báo Lịch Giảng Dạy Chính Thức - ${subjectName} (${gvTitle}${gvName})`
        );
        setBodyHtml(`<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.65;color:#1e293b;">
  <p>Kính gửi <strong>${gvTitle}${gvName}</strong>,</p>
  <p>Ban Học vụ — ${orgBrand} xin trân trọng gửi đến Quý Thầy/Cô lịch giảng dạy chính thức của học phần <strong>${subjectName}</strong> thuộc chương trình <strong>${courseName}</strong>:</p>
  ${scheduleTable}
  <p><strong>Link phòng học trực tuyến (Zoom):</strong> <a href="${meetingLink}" style="color:#BD1D2D;">${meetingLink}</a></p>
  ${link1on1Block}
  <p>Bộ phận Kỹ thuật${orgSupportEm ? ` (<code>${orgSupportEm}</code>)` : ''} và Học vụ sẽ mở lớp trước 15 phút để đón tiếp Thầy/Cô và học viên.</p>
  <p>Trân trọng,<br/><strong>Ban Học vụ — ${orgBrand}</strong></p>
</div>`);
      } else {
        setSubject(
          `[${orgBrand}] Lịch Hướng Dẫn 1:1 (Slot 30 Phút) & Danh Sách Đăng Ký - ${subjectName}`
        );
        setBodyHtml(`<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.65;color:#1e293b;">
  <p>Kính gửi <strong>${gvTitle}${gvName}</strong>,</p>
  <p>Ban Học vụ — IDEAS đã khởi tạo <strong>Form Đăng ký Hướng dẫn 1:1 (Mỗi ca 30 phút)</strong> cho môn <strong>${subjectName}</strong> theo khung giờ của Thầy/Cô.</p>
  ${link1on1Block}
  <p>Ngay khi Học viên chọn khung giờ trống trên bảng đăng ký:</p>
  <ol>
    <li>Khung giờ đó sẽ tự động khóa lại để không bị trùng lịch.</li>
    <li>Lịch hẹn sẽ tự động được tạo trên <strong>Calendar của hệ thống & Google Calendar (.ics)</strong>.</li>
    <li>Hệ thống sẽ gửi thông báo xác nhận ngay lập tức đến email của Thầy/Cô và Học viên.</li>
  </ol>
  <p>Trân trọng cảm ơn Quý Thầy/Cô,<br/><strong>Ban Học vụ — IDEAS</strong></p>
</div>`);
      }
    },
    [
      lecturer,
      courses,
      courseName,
      subjectName,
      scheduleSummary,
      remunerationNote,
      meetingLink,
      configForm.public_url,
    ]
  );

  useEffect(() => {
    if (isOpen) {
      generateEmailTemplateHtml(templateKey);
    }
  }, [isOpen, templateKey, generateEmailTemplateHtml]);

  // Fetch existing 1:1 configs
  const fetch1on1Configs = useCallback(async () => {
    setLoadingConfigs(true);
    try {
      const params = new URLSearchParams();
      if (lecturer?.id) params.set('lecturer_company_id', String(lecturer.id));
      if (campaignId) params.set('campaign_id', String(campaignId));
      const res = await apiFetch(`${API_URL}/academic/1on1-configs?${params.toString()}`);
      const json = await res.json();
      const list = Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.data?.configs)
          ? json.data.configs
          : [];
      if (json.success && list.length >= 0) {
        setConfigsList(list);
        if (list.length > 0 && !selectedConfigId) {
          const first = list[0];
          setSelectedConfigId(Number(first.id));
          setConfigForm((prev) => ({
            ...prev,
            title: first.title || prev.title,
            subject_name: first.subject_name || prev.subject_name,
            lecturer_name: first.lecturer_name || prev.lecturer_name,
            lecturer_email: first.lecturer_email || prev.lecturer_email,
            lecturer_phone: first.lecturer_phone || prev.lecturer_phone,
            week_label: first.week_label || prev.week_label,
            week_start_date: first.week_start_date || prev.week_start_date,
            week_end_date: first.week_end_date || prev.week_end_date,
            slot_duration: Number(first.slot_duration || 30),
            meeting_link: first.meeting_link || prev.meeting_link,
            cc_emails: first.cc_emails || getDefaultAcademicCc(),
            notes_vn: first.notes_vn || prev.notes_vn,
            notes_en: first.notes_en || prev.notes_en,
            available_slots:
              first.available_slots && typeof first.available_slots === 'object'
                ? first.available_slots
                : prev.available_slots,
            booking_code: first.booking_code || '',
            public_url: first.public_url || '',
          }));
          // Also fetch bookings for this config
          if (first.booking_code) {
            fetchPublicScheduleDetails(first.booking_code);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load 1on1 configs:', err);
    } finally {
      setLoadingConfigs(false);
    }
  }, [lecturer?.id, campaignId, selectedConfigId]);

  const fetchPublicScheduleDetails = async (code: string) => {
    try {
      const res = await apiFetch(`${API_URL}/academic/public-1on1/${code}`);
      const json = await res.json();
      if (json.success && json.data) {
        setConfigBookings(Array.isArray(json.data.booked_slots) ? json.data.booked_slots : []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetch1on1Configs();
    }
  }, [isOpen, fetch1on1Configs]);

  const handleSendInvitationEmail = async () => {
    if (!toEmail.trim()) {
      setEmailNotice({ type: 'error', text: 'Vui lòng nhập địa chỉ Email của Giảng viên.' });
      return;
    }
    setSendingEmail(true);
    setEmailNotice(null);
    try {
      const companyId = lecturer?.id || 0;
      const fd = new FormData();
      fd.append('to_email', toEmail.trim());
      fd.append('cc_emails', ccEmails.trim());
      fd.append('subject', subject.trim());
      fd.append('body_html', bodyHtml);
      fd.append('template_type', templateKey);
      fd.append('course_name', courseName);
      fd.append('subject_name', subjectName);
      fd.append('schedule_summary', scheduleSummary);
      fd.append('remuneration_note', remunerationNote);
      fd.append('meeting_link', meetingLink);
      fd.append('attachment_file_ids', JSON.stringify(selectedCloudFileIds));
      localFiles.forEach((f) => {
        fd.append('attachments[]', f);
      });

      const res = await apiFetch(
        `${API_URL}/academic/lecturer/${companyId}/send-invitation-email`,
        {
          method: 'POST',
          body: fd,
        }
      );
      const json = await res.json();
      if (json.success) {
        setEmailNotice({
          type: 'success',
          text:
            json.message ||
            `Đã gửi Email Hợp đồng & Mời giảng tới ${toEmail} (CC Học vụ) thành công!`,
        });
        setLocalFiles([]);
      } else {
        setEmailNotice({
          type: 'error',
          text: json.message || 'Không thể gửi email mời giảng.',
        });
      }
    } catch (err: any) {
      setEmailNotice({
        type: 'error',
        text: err?.message || 'Lỗi kết nối khi gửi email mời giảng.',
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const toggleSlotAvailability = (dayKey: string, slotRange: string) => {
    setConfigForm((prev) => {
      const daySlots = Array.isArray(prev.available_slots[dayKey])
        ? [...prev.available_slots[dayKey]]
        : [];
      const exists = daySlots.includes(slotRange);
      const nextDaySlots = exists
        ? daySlots.filter((s) => s !== slotRange)
        : [...daySlots, slotRange];
      return {
        ...prev,
        available_slots: {
          ...prev.available_slots,
          [dayKey]: nextDaySlots,
        },
      };
    });
  };

  const toggleEntireDayColumn = (dayKey: string) => {
    const allSlots = [...AFTERNOON_SLOTS, ...EVENING_SLOTS];
    setConfigForm((prev) => {
      const current = Array.isArray(prev.available_slots[dayKey])
        ? prev.available_slots[dayKey]
        : [];
      const next = current.length === allSlots.length ? [] : [...allSlots];
      return {
        ...prev,
        available_slots: {
          ...prev.available_slots,
          [dayKey]: next,
        },
      };
    });
  };

  const handleSave1on1Config = async () => {
    setSavingConfig(true);
    setConfigNotice(null);
    try {
      const res = await apiFetch(`${API_URL}/academic/1on1-configs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedConfigId || undefined,
          campaign_id: campaignId || null,
          lecturer_company_id: lecturer?.id || null,
          lecturer_name: configForm.lecturer_name,
          lecturer_email: configForm.lecturer_email || toEmail,
          lecturer_phone: configForm.lecturer_phone,
          title: configForm.title,
          subject_name: configForm.subject_name,
          week_label: configForm.week_label,
          week_start_date: configForm.week_start_date,
          week_end_date: configForm.week_end_date,
          slot_duration: 30,
          available_slots: configForm.available_slots,
          meeting_link: configForm.meeting_link,
          cc_emails: configForm.cc_emails,
          notes_vn: configForm.notes_vn,
          notes_en: configForm.notes_en,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setSelectedConfigId(Number(json.data.id));
        setConfigForm((prev) => ({
          ...prev,
          booking_code: json.data.booking_code,
          public_url: json.data.public_url,
        }));
        setConfigNotice({
          type: 'success',
          text: 'Đã lưu Bảng đăng ký Hướng dẫn 1:1 (Slot 30 phút)! Bấm Copy Link để gửi cho Học viên.',
        });
        fetch1on1Configs();
      } else {
        setConfigNotice({
          type: 'error',
          text: json.message || 'Không thể lưu cấu hình lịch 1:1.',
        });
      }
    } catch (err: any) {
      setConfigNotice({
        type: 'error',
        text: err?.message || 'Lỗi kết nối khi lưu cấu hình 1:1.',
      });
    } finally {
      setSavingConfig(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1040px',
          maxHeight: '92vh',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(189, 29, 45, 0.1)',
                color: '#BD1D2D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {activeTab === 'invitation' ? <Mail size={18} /> : <Calendar size={18} />}
            </div>
            <div>
              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                ĐIỀU PHỐI GIẢNG VIÊN & LỊCH HƯỚNG DẪN 1:1 —{' '}
                <span style={{ color: '#BD1D2D' }}>
                  {lecturer?.name || configForm.lecturer_name || 'Phòng Học Vụ IDEAS'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                Gửi Email Hợp đồng mời giảng đính kèm lịch dạy & Tạo Form đăng ký Hướng dẫn 1:1
                (Khung 30 phút tự tạo Calendar + Google Calendar .ics)
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Segmented Tab Switcher */}
            <div
              style={{
                display: 'inline-flex',
                padding: '3px',
                borderRadius: '10px',
                background: '#e2e8f0',
                gap: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('invitation')}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === 'invitation' ? '#ffffff' : 'transparent',
                  color: activeTab === 'invitation' ? '#BD1D2D' : '#475569',
                  fontWeight: activeTab === 'invitation' ? 700 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow:
                    activeTab === 'invitation' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <Mail size={14} />
                1. Gửi Mail Hợp Đồng & Mời Giảng
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('1on1')}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === '1on1' ? '#ffffff' : 'transparent',
                  color: activeTab === '1on1' ? '#BD1D2D' : '#475569',
                  fontWeight: activeTab === '1on1' ? 700 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: activeTab === '1on1' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <Calendar size={14} />
                2. Form Đăng Ký Hướng Dẫn 1:1 (Slot 30p)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#475569',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div style={{ padding: '18px 20px', overflowY: 'auto', flex: 1 }}>
          {activeTab === 'invitation' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {emailNotice && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: emailNotice.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${
                      emailNotice.type === 'success' ? '#a7f3d0' : '#fecaca'
                    }`,
                    color: emailNotice.type === 'success' ? '#047857' : '#b91c1c',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {emailNotice.type === 'success' ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  <span>{emailNotice.text}</span>
                </div>
              )}

              {/* Template Selector Row */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: '#475569' }}>
                  Mẫu Email học vụ:
                </span>
                <div
                  style={{
                    display: 'inline-flex',
                    padding: '3px',
                    borderRadius: '10px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    gap: '2px',
                    flexWrap: 'wrap',
                  }}
                >
                  {[
                    {
                      key: 'contract_invitation',
                      label: 'Thư mời giảng & Hợp đồng',
                      icon: <FileText size={13} />,
                    },
                    {
                      key: 'schedule_confirmation',
                      label: 'Thông báo lịch giảng dạy',
                      icon: <Calendar size={13} />,
                    },
                    {
                      key: 'mentoring_1on1_invite',
                      label: 'Thư mời hướng dẫn 1:1',
                      icon: <Users size={13} />,
                    },
                  ].map((tpl) => {
                    const isActive = templateKey === tpl.key;
                    return (
                      <button
                        key={tpl.key}
                        type="button"
                        onClick={() => setTemplateKey(tpl.key as any)}
                        style={{
                          height: '30px',
                          padding: '0 12px',
                          borderRadius: '7px',
                          border: 'none',
                          background: isActive ? '#ffffff' : 'transparent',
                          color: isActive ? '#BD1D2D' : '#64748b',
                          fontSize: '0.75rem',
                          fontWeight: isActive ? 700 : 600,
                          boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        {tpl.icon}
                        <span>{tpl.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recipient & Course Info Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                  gap: '10px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    Email Giảng viên (To) *
                  </label>
                  <input
                    type="email"
                    placeholder="email.giangvien@domain.com"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    CC Mặc định (Học vụ & IT)
                  </label>
                  <input
                    type="text"
                    value={ccEmails}
                    onChange={(e) => setCcEmails(e.target.value)}
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.78rem',
                      background: '#f8fafc',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    Chương trình đào tạo
                  </label>
                  <select
                    value={
                      STANDARD_PROGRAM_NAMES.find(
                        (p) => p.toLowerCase() === String(courseName || '').trim().toLowerCase()
                      ) || courseName
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      setCourseName(val);
                      const subs = resolveCurriculumSubjects(val);
                      if (subs.length > 0) {
                        setSubjectName(subs[0].name);
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '36px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    {STANDARD_PROGRAM_NAMES.map((progKey, idx) => (
                      <option key={progKey} value={progKey}>
                        {idx + 1}/ {progKey}
                      </option>
                    ))}
                    {!STANDARD_PROGRAM_NAMES.some(
                      (p) => p.toLowerCase() === String(courseName || '').trim().toLowerCase()
                    ) &&
                      courseName && <option value={courseName}>{courseName}</option>}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    Môn học / Chuyên đề
                  </label>
                  {(() => {
                    const progSubjects = resolveCurriculumSubjects(courseName);
                    if (progSubjects.length > 0) {
                      return (
                        <select
                          value={
                            progSubjects.some((s) => s.name === subjectName)
                              ? subjectName
                              : progSubjects[0]?.name || ''
                          }
                          onChange={(e) => {
                            if (e.target.value) setSubjectName(e.target.value);
                          }}
                          style={{
                            width: '100%',
                            height: '36px',
                            padding: '0 10px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            color: '#0f172a',
                          }}
                        >
                          {progSubjects.map((s, idx) => (
                            <option key={s.code} value={s.name}>
                              {idx + 1}. {s.name}
                            </option>
                          ))}
                        </select>
                      );
                    }
                    return (
                      <input
                        type="text"
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        placeholder="Nhập tên môn học / chuyên đề..."
                        style={{
                          width: '100%',
                          height: '36px',
                          padding: '0 10px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.8rem',
                        }}
                      />
                    );
                  })()}
                </div>
              </div>

              {/* Subject line */}
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#475569',
                    marginBottom: '4px',
                  }}
                >
                  Tiêu đề Email (Subject) *
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{
                    width: '100%',
                    height: '36px',
                    padding: '0 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    color: '#0f172a',
                  }}
                />
              </div>

              {/* Contract & File Attachments Section */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    <Paperclip size={15} color="#BD1D2D" />
                    <span>Đính kèm File Hợp đồng mời giảng / Đề cương môn học</span>
                  </div>

                  <div>
                    <input
                      ref={localFileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const files = Array.from(e.target.files || []);
                        if (files.length > 0) {
                          setLocalFiles((prev) => [...prev, ...files]);
                        }
                        e.target.value = '';
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => localFileInputRef.current?.click()}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '7px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Plus size={13} /> Chọn file từ máy tính
                    </button>
                  </div>
                </div>

                {/* Existing Lecturer Cloud Files */}
                {Array.isArray(existingFiles) && existingFiles.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div
                      style={{
                        fontSize: '0.71rem',
                        color: '#64748b',
                        marginBottom: '4px',
                        fontWeight: 600,
                      }}
                    >
                      Hoặc chọn Hợp đồng có sẵn trong Hồ sơ Giảng viên:
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {existingFiles.map((ef) => {
                        const checked = selectedCloudFileIds.includes(Number(ef.id));
                        return (
                          <label
                            key={ef.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              border: checked
                                ? '1.5px solid #BD1D2D'
                                : '1px solid #cbd5e1',
                              background: checked ? '#fef2f2' : '#ffffff',
                              fontSize: '0.73rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedCloudFileIds((prev) =>
                                  checked
                                    ? prev.filter((id) => id !== Number(ef.id))
                                    : [...prev, Number(ef.id)]
                                );
                              }}
                            />
                            <FileText size={13} color="#BD1D2D" />
                            <span>{ef.original_name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Selected Local Files */}
                {localFiles.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                    {localFiles.map((lf, idx) => (
                      <span
                        key={`${lf.name}-${idx}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#047857',
                          fontSize: '0.73rem',
                          fontWeight: 700,
                        }}
                      >
                        <Paperclip size={12} />
                        <span>
                          {lf.name} ({(lf.size / 1024).toFixed(0)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setLocalFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: '#b91c1c',
                            cursor: 'pointer',
                            fontWeight: 800,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Full-Width Email Preview with Optional Toggle to Edit Source */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px',
                  }}
                >
                  <label
                    style={{
                      fontSize: '0.73rem',
                      fontWeight: 700,
                      color: '#334155',
                    }}
                  >
                    Xem trước nội dung Thư mời giảng & Bảng lịch dạy
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowHtmlEditor((v) => !v)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: showHtmlEditor ? '#0f172a' : '#ffffff',
                      color: showHtmlEditor ? '#ffffff' : '#475569',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {showHtmlEditor ? 'Xem bản hiển thị (Preview)' : 'Chỉnh sửa nội dung'}
                  </button>
                </div>

                {showHtmlEditor ? (
                  <textarea
                    rows={10}
                    value={bodyHtml}
                    onChange={(e) => setBodyHtml(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.78rem',
                      fontFamily: 'monospace',
                      resize: 'vertical',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      maxHeight: '260px',
                      overflowY: 'auto',
                      padding: '16px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                    }}
                    dangerouslySetInnerHTML={{ __html: bodyHtml }}
                  />
                )}
              </div>

              {/* Send Action Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingTop: '10px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Khi gửi, lịch sử Email và File hợp đồng sẽ được lưu tự động vào Nhật ký Giảng
                  viên.
                </div>
                <button
                  type="button"
                  disabled={sendingEmail}
                  onClick={handleSendInvitationEmail}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#BD1D2D',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: sendingEmail ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Đang gửi Email...</span>
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      <span>Gửi Email Hợp đồng & Mời giảng</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* TAB 2: 1-ON-1 MENTORING 30-MIN MATRIX CONFIG */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {configNotice && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: configNotice.type === 'success' ? '#ecfdf5' : '#fef2f2',
                    border: `1px solid ${
                      configNotice.type === 'success' ? '#a7f3d0' : '#fecaca'
                    }`,
                    color: configNotice.type === 'success' ? '#047857' : '#b91c1c',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  {configNotice.type === 'success' ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <AlertCircle size={16} />
                  )}
                  <span>{configNotice.text}</span>
                </div>
              )}

              {/* Public Link Banner if created */}
              {configForm.public_url && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: '#0f172a',
                    color: '#ffffff',
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        color: '#94a3b8',
                        fontWeight: 700,
                      }}
                    >
                      Đường dẫn Form đăng ký Hướng dẫn 1:1 gửi cho Học viên
                    </div>
                    <div
                      style={{
                        fontSize: '0.84rem',
                        fontWeight: 700,
                        color: '#f8fafc',
                        marginTop: '2px',
                        wordBreak: 'break-all',
                      }}
                    >
                      {configForm.public_url}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(configForm.public_url);
                        setConfigNotice({
                          type: 'success',
                          text: 'Đã sao chép đường dẫn Form đăng ký Hướng dẫn 1:1.',
                        });
                      }}
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#BD1D2D',
                        color: '#ffffff',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Copy size={14} /> Sao chép Link
                    </button>
                    <a
                      href={configForm.public_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        padding: '7px 14px',
                        borderRadius: '8px',
                        border: '1px solid #475569',
                        background: '#1e293b',
                        color: '#ffffff',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <ExternalLink size={14} /> Mở xem Form
                    </a>
                  </div>
                </div>
              )}

              {/* Metadata Inputs — Compact 5-Column Grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '10px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    Chương trình đào tạo
                  </label>
                  <select
                    value={mentoringProgram}
                    onChange={(e) => {
                      const nextProg = e.target.value;
                      setMentoringProgram(nextProg);
                      const subs = resolveCurriculumSubjects(nextProg);
                      if (subs.length > 0) {
                        const defaultSub = subs[subs.length - 1]?.name || subs[0].name;
                        setConfigForm((prev) => ({
                          ...prev,
                          subject_name: defaultSub,
                          title: `${prev.week_label} - ${defaultSub}`,
                        }));
                      }
                    }}
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 8px',
                      borderRadius: '7px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  >
                    {STANDARD_PROGRAM_NAMES.map((progKey, idx) => (
                      <option key={progKey} value={progKey}>
                        {idx + 1}/ {progKey}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    Môn học / Học phần 1:1
                  </label>
                  {(() => {
                    const subs = resolveCurriculumSubjects(mentoringProgram);
                    if (subs.length > 0) {
                      return (
                        <select
                          value={
                            subs.some((s) => s.name === configForm.subject_name)
                              ? configForm.subject_name
                              : ''
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val) {
                              setConfigForm((prev) => ({
                                ...prev,
                                subject_name: val,
                                title: `${prev.week_label} - ${val}`,
                              }));
                            }
                          }}
                          style={{
                            width: '100%',
                            height: '34px',
                            padding: '0 8px',
                            borderRadius: '7px',
                            border: '1px solid #cbd5e1',
                            background: '#ffffff',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            color: '#0f172a',
                          }}
                        >
                          <option value={configForm.subject_name}>
                            {configForm.subject_name}
                          </option>
                          {subs.map((s, idx) => (
                            <option key={s.code} value={s.name}>
                              {idx + 1}. {s.name}
                            </option>
                          ))}
                        </select>
                      );
                    }
                    return (
                      <input
                        type="text"
                        value={configForm.subject_name}
                        onChange={(e) =>
                          setConfigForm((prev) => ({ ...prev, subject_name: e.target.value }))
                        }
                        style={{
                          width: '100%',
                          height: '34px',
                          padding: '0 8px',
                          borderRadius: '7px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.78rem',
                        }}
                      />
                    );
                  })()}
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    Tuần áp dụng (Từ Thứ 2)
                  </label>
                  <input
                    type="date"
                    value={configForm.week_start_date}
                    onChange={(e) => {
                      const startStr = e.target.value;
                      let endStr = configForm.week_end_date;
                      if (startStr) {
                        const d = new Date(`${startStr}T00:00:00`);
                        if (!Number.isNaN(d.getTime())) {
                          d.setDate(d.getDate() + 6);
                          endStr = d.toISOString().slice(0, 10);
                        }
                      }
                      setConfigForm((prev) => ({
                        ...prev,
                        week_start_date: startStr,
                        week_end_date: endStr,
                      }));
                    }}
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 8px',
                      borderRadius: '7px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.78rem',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    Email Giảng viên nhận lịch
                  </label>
                  <input
                    type="email"
                    placeholder="lecturer@domain.com"
                    value={configForm.lecturer_email}
                    onChange={(e) =>
                      setConfigForm((prev) => ({ ...prev, lecturer_email: e.target.value }))
                    }
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 8px',
                      borderRadius: '7px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.78rem',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#475569',
                      marginBottom: '4px',
                    }}
                  >
                    Link phòng họp Zoom / Meet
                  </label>
                  <input
                    type="text"
                    value={configForm.meeting_link}
                    onChange={(e) =>
                      setConfigForm((prev) => ({ ...prev, meeting_link: e.target.value }))
                    }
                    style={{
                      width: '100%',
                      height: '34px',
                      padding: '0 8px',
                      borderRadius: '7px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.78rem',
                    }}
                  />
                </div>
              </div>

              {/* Interactive 30-Minute Weekly Slot Matrix */}
              <div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                    Bảng phân bổ khung giờ 30 phút (Bấm vào từng ô hoặc tiêu đề Thứ để Mở / Khóa lịch)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.73rem', color: '#475569' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '3px',
                          background: '#ecfdf5',
                          border: '1.5px solid #10b981',
                        }}
                      />
                      <span>Trống (Mở cho Học viên đăng ký)</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <span
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '3px',
                          background: '#f1f5f9',
                          border: '1.5px solid #94a3b8',
                        }}
                      />
                      <span>Bận (Khóa khung giờ)</span>
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    overflowX: 'auto',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: '0.75rem',
                      textAlign: 'center',
                    }}
                  >
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <th
                          colSpan={9}
                          style={{
                            padding: '8px 12px',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            color: '#0f172a',
                            textAlign: 'left',
                          }}
                        >
                          {configForm.week_label} — <span style={{ color: '#BD1D2D' }}>{configForm.subject_name}</span>
                        </th>
                      </tr>
                      <tr style={{ background: '#f1f5f9', color: '#334155' }}>
                        <th style={{ padding: '7px 8px', border: '1px solid #e2e8f0', width: '84px', fontWeight: 700 }}>
                          Ca
                        </th>
                        <th style={{ padding: '7px 8px', border: '1px solid #e2e8f0', width: '100px', fontWeight: 700 }}>
                          Khung giờ
                        </th>
                        {DAY_KEYS.map((d) => (
                          <th
                            key={d.key}
                            onClick={() => toggleEntireDayColumn(d.key)}
                            style={{
                              padding: '7px 8px',
                              border: '1px solid #e2e8f0',
                              cursor: 'pointer',
                              userSelect: 'none',
                              fontWeight: 700,
                              color: '#0f172a',
                            }}
                            title="Bấm để Bật/Tắt toàn bộ cột ngày này"
                          >
                            <div>{d.label}</div>
                            <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 500 }}>
                              {d.vnLabel}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {/* Afternoon 6 slots */}
                      {AFTERNOON_SLOTS.map((slot, sIdx) => (
                        <tr key={`aft-${slot}`} style={{ background: '#ffffff' }}>
                          {sIdx === 0 && (
                            <td
                              rowSpan={AFTERNOON_SLOTS.length}
                              style={{
                                border: '1px solid #e2e8f0',
                                fontWeight: 700,
                                color: '#0f172a',
                                background: '#f8fafc',
                              }}
                            >
                              <div>Chiều</div>
                              <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 500 }}>
                                13:30 - 16:30
                              </div>
                            </td>
                          )}
                          <td
                            style={{
                              padding: '5px 8px',
                              border: '1px solid #e2e8f0',
                              fontWeight: 700,
                              color: '#334155',
                              background: '#f8fafc',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {slot}
                          </td>
                          {DAY_KEYS.map((d) => {
                            const isAvail =
                              Array.isArray(configForm.available_slots[d.key]) &&
                              configForm.available_slots[d.key].includes(slot);
                            return (
                              <td
                                key={`${d.key}-${slot}`}
                                onClick={() => toggleSlotAvailability(d.key, slot)}
                                style={{
                                  padding: '5px 6px',
                                  border: '1px solid #e2e8f0',
                                  background: isAvail ? '#ffffff' : '#f1f5f9',
                                  cursor: 'pointer',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    background: isAvail ? '#ecfdf5' : '#e2e8f0',
                                    color: isAvail ? '#047857' : '#475569',
                                  }}
                                >
                                  {isAvail ? 'Trống' : 'Bận'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}

                      {/* Clean Subtle Separator Row */}
                      <tr>
                        <td
                          colSpan={9}
                          style={{
                            height: '6px',
                            background: '#e2e8f0',
                            padding: 0,
                          }}
                        />
                      </tr>

                      {/* Evening 5 slots */}
                      {EVENING_SLOTS.map((slot, sIdx) => (
                        <tr key={`eve-${slot}`} style={{ background: '#ffffff' }}>
                          {sIdx === 0 && (
                            <td
                              rowSpan={EVENING_SLOTS.length}
                              style={{
                                border: '1px solid #e2e8f0',
                                fontWeight: 700,
                                color: '#0f172a',
                                background: '#f8fafc',
                              }}
                            >
                              <div>Tối</div>
                              <div style={{ fontSize: '0.66rem', color: '#64748b', fontWeight: 500 }}>
                                19:00 - 21:30
                              </div>
                            </td>
                          )}
                          <td
                            style={{
                              padding: '5px 8px',
                              border: '1px solid #e2e8f0',
                              fontWeight: 700,
                              color: '#334155',
                              background: '#f8fafc',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {slot}
                          </td>
                          {DAY_KEYS.map((d) => {
                            const isAvail =
                              Array.isArray(configForm.available_slots[d.key]) &&
                              configForm.available_slots[d.key].includes(slot);
                            return (
                              <td
                                key={`${d.key}-${slot}`}
                                onClick={() => toggleSlotAvailability(d.key, slot)}
                                style={{
                                  padding: '5px 6px',
                                  border: '1px solid #e2e8f0',
                                  background: isAvail ? '#ffffff' : '#f1f5f9',
                                  cursor: 'pointer',
                                }}
                              >
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    background: isAvail ? '#ecfdf5' : '#e2e8f0',
                                    color: isAvail ? '#047857' : '#475569',
                                  }}
                                >
                                  {isAvail ? 'Trống' : 'Bận'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Booked Students List */}
              {configBookings.length > 0 && (
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      marginBottom: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Users size={15} color="#BD1D2D" />
                    <span>Danh sách Học viên đã đăng ký khung giờ 1:1 ({configBookings.length} ca)</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {configBookings.map((b, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '8px',
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.74rem',
                        }}
                      >
                        <strong style={{ color: '#BD1D2D' }}>
                          {b.booking_date} ({b.slot_range})
                        </strong>{' '}
                        — <span style={{ fontWeight: 700, color: '#0f172a' }}>{b.student_name}</span>
                        {b.topic && <span style={{ color: '#64748b' }}> • {b.topic}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Save Config Action Footer */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  paddingTop: '10px',
                  borderTop: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Khi Học viên đăng ký, hệ thống tự động tạo lịch trên Calendar, gửi file{' '}
                  <code>.ics</code> Google Calendar và thông báo cho Giảng viên.
                </div>
                <button
                  type="button"
                  disabled={savingConfig}
                  onClick={handleSave1on1Config}
                  style={{
                    padding: '9px 18px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#BD1D2D',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: savingConfig ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '7px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {savingConfig ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} />
                      <span>Lưu lịch & Lấy link đăng ký</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default LecturerInvitationAnd1on1Modal;
