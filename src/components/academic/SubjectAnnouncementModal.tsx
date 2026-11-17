import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Mail,
  Send,
  Loader2,
  Copy,
  CheckCircle2,
  Sparkles,
  Users,
  Eye,
  Pencil,
  MessageSquare,
  GraduationCap,
  Calendar,
  Video,
  Link2,
  UserCheck,
  Search,
  RefreshCw,
  Bold,
  Italic,
  Underline,
  RotateCcw,
  Globe,
  BookOpen,
  Award,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Check,
  Upload,
  FileSpreadsheet,
  Trash2
} from 'lucide-react';
import { pushOverlay } from '../../utils/overlayStack';
import { API_BASE } from '../../config/env';
import { getCachedTenantBootstrap, getTenantAiPlatformUrl, getTenantLogoUrl } from '../../contexts/TenantConfigContext';

const API_URL = API_BASE;

function buildAcademicApiUrl(rawUrl: string): string {
  const idx = rawUrl.indexOf('/academic/');
  if (idx === -1) return rawUrl;
  const base = rawUrl.slice(0, idx);
  const rest = rawUrl.slice(idx + 1);
  const [actionPart, qsPart] = rest.split('?');
  return `${base}/api.php?action=${encodeURIComponent(actionPart)}${qsPart ? `&${qsPart}` : ''}`;
}

async function academicFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(buildAcademicApiUrl(url), init);
}

export interface SubjectAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject: any;
  allSubjects?: any[];
  campaign?: {
    id?: number | string;
    name?: string;
    project_id?: number | string;
    project_name?: string;
  } | null;
  programName?: string;
  companiesList?: any[];
  consultants?: any[];
  preselectedStudent?: {
    id?: number | string;
    full_name?: string;
    email?: string;
    program?: string;
  } | null;
  onSubjectUpdated?: (updatedFields: { ai_agent_link?: string; school_lecturer?: string }) => void;
  addToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export type TbcdTemplateKey = 'mba_standard' | 'mba_high' | 'msc_ai' | 'bba' | 'estiam';

export const TBCD_TEMPLATE_OPTIONS: Array<{
  id: TbcdTemplateKey;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
}> = [
  {
    id: 'mba_standard',
    label: 'EMBA / MBA — Nhóm Standard (Swiss Time & VN Time)',
    shortLabel: 'EMBA/MBA Standard',
    badge: 'Swiss & VN Time',
    description: '1. Lịch UMEF (Swiss Time) + 2. Lớp chuyên đề IDEAS (VN Time) + Zoom + AI Agent (Tùy chọn Bản Việt hoặc Bản Anh riêng biệt)'
  },
  {
    id: 'mba_high',
    label: 'EMBA / MBA — Nhóm High (Giờ Việt Nam | UMEF + Lớp chuyên đề IDEAS)',
    shortLabel: 'EMBA/MBA High',
    badge: 'Giờ Việt Nam',
    description: '1. Lịch UMEF (Session 1..N Giờ VN) + 2. Bảng Lớp chuyên đề IDEAS (Giờ VN) + Zoom + AI Agent'
  },
  {
    id: 'msc_ai',
    label: 'Thạc sĩ Trí tuệ nhân tạo — MSc AI (UMEF + IDEAS)',
    shortLabel: 'MSc AI',
    badge: 'MSc AI',
    description: '1. Professor on Zoom Meeting (Session 1..N) + 2. Bảng Lớp chuyên đề IDEAS + Zoom + AI Agent'
  },
  {
    id: 'bba',
    label: 'Cử nhân Quản trị Kinh doanh — BBA / Top Up (Lớp Swiss UMEF + HD IDEAS)',
    shortLabel: 'BBA / Top Up',
    badge: 'Swiss UMEF',
    description: '1. Bảng Lớp Swiss UMEF + 2. Danh sách HD 1..N Lớp chuyên đề IDEAS + Zoom + AI Agent'
  },
  {
    id: 'estiam',
    label: 'Tiến sĩ Quản trị Kinh doanh — DBA (Lịch Seminar & Phase Nghiên cứu sinh)',
    shortLabel: 'DBA (Seminar/Phase)',
    badge: 'Nghiên cứu sinh DBA',
    description: 'Bảng Lịch học Seminar & Phase Nghiên cứu (Ngày học, GS Hướng dẫn, Nội dung Seminar/Phase, Zoom) dành riêng cho NCS Tiến sĩ'
  }
];

export interface DbaSeminarOption {
  id: string;
  code: string;
  titleVI: string;
  titleEN: string;
  lecturer: string;
  timeStr: string;
  descVI: string;
  descEN: string;
}

export const DBA_SEMINAR_OPTIONS: DbaSeminarOption[] = [
  {
    id: 'sem1',
    code: 'Seminar 1',
    titleVI: 'Seminar 1: Doctoral Research Orientation & Thesis Topic Development',
    titleEN: 'Seminar 1: Doctoral Research Orientation & Thesis Topic Development',
    lecturer: 'Dr. Phạm Quang Vinh',
    timeStr: 'Thứ 7, 14:00 – 17:00 (VN Time)',
    descVI: 'Xây dựng và định hướng đề tài nghiên cứu cấp độ tiến sĩ:\n- Xác định chính thức tên đề tài\n- Problem statement sơ bộ',
    descEN: 'Doctoral research orientation and thesis topic development:\n- Finalize dissertation title\n- Preliminary problem statement'
  },
  {
    id: 'sem2',
    code: 'Seminar 2',
    titleVI: 'Seminar 2: Literature Review & Theoretical Conceptual Framework',
    titleEN: 'Seminar 2: Literature Review & Theoretical Conceptual Framework',
    lecturer: 'Dr. Phạm Quang Vinh',
    timeStr: 'Thứ 7, 14:00 – 17:00 (VN Time)',
    descVI: 'Tổng quan tài liệu nghiên cứu chuyên sâu & Xây dựng khung khái niệm lý thuyết cho luận án tiến sĩ',
    descEN: 'Advanced literature review and theoretical framework design for doctoral dissertation'
  },
  {
    id: 'sem3',
    code: 'Seminar 3',
    titleVI: 'Seminar 3: Doctoral Research Methodologies (Qualitative & Quantitative)',
    titleEN: 'Seminar 3: Doctoral Research Methodologies (Qualitative & Quantitative)',
    lecturer: 'Prof. / Dr. Hướng dẫn',
    timeStr: 'Thứ 7, 14:00 – 17:00 (VN Time)',
    descVI: 'Phương pháp luận nghiên cứu: Định tính, định lượng & Thiết kế công cụ thu thập dữ liệu',
    descEN: 'Doctoral research methodologies: Qualitative, quantitative and data collection design'
  },
  {
    id: 'sem4',
    code: 'Seminar 4',
    titleVI: 'Seminar 4: Advanced Data Analysis & Research Defense Preparation',
    titleEN: 'Seminar 4: Advanced Data Analysis & Research Defense Preparation',
    lecturer: 'Prof. / Dr. Hướng dẫn',
    timeStr: 'Thứ 7, 14:00 – 17:00 (VN Time)',
    descVI: 'Phân tích dữ liệu nâng cao, kiểm định mô hình & Chuẩn bị bảo vệ Đề cương nghiên cứu',
    descEN: 'Advanced data analytics, model validation and research proposal defense preparation'
  },
  {
    id: 'phase1',
    code: 'Phase 1',
    titleVI: 'Phase 1: Doctoral Research Proposal Defense',
    titleEN: 'Phase 1: Doctoral Research Proposal Defense',
    lecturer: 'Hội đồng Khoa học IDEAS',
    timeStr: 'Thứ 7, 09:00 – 12:00 (VN Time)',
    descVI: 'Bảo vệ Đề cương Nghiên cứu Luận án Tiến sĩ trước Hội đồng Khoa học',
    descEN: 'Doctoral dissertation research proposal defense before the Academic Board'
  },
  {
    id: 'phase2',
    code: 'Phase 2',
    titleVI: 'Phase 2: Interim Empirical Progress & Fieldwork Review',
    titleEN: 'Phase 2: Interim Empirical Progress & Fieldwork Review',
    lecturer: 'Hội đồng Khoa học IDEAS',
    timeStr: 'Thứ 7, 09:00 – 12:00 (VN Time)',
    descVI: 'Báo cáo tiến độ thu thập dữ liệu thực địa và kết quả nghiên cứu giữa kỳ',
    descEN: 'Fieldwork data collection progress report and interim findings review'
  },
  {
    id: 'phase3',
    code: 'Phase 3',
    titleVI: 'Phase 3: Doctoral Dissertation Pre-Defense',
    titleEN: 'Phase 3: Doctoral Dissertation Pre-Defense',
    lecturer: 'Hội đồng Khoa học IDEAS',
    timeStr: 'Thứ 7, 14:00 – 17:00 (VN Time)',
    descVI: 'Bảo vệ thử luận án tiến sĩ (Pre-Defense Review) trước Hội đồng Khoa học',
    descEN: 'Doctoral dissertation pre-defense before the International Academic Board'
  },
  {
    id: 'phase4',
    code: 'Phase 4',
    titleVI: 'Phase 4: Final Doctoral Dissertation Defense',
    titleEN: 'Phase 4: Final Doctoral Dissertation Defense',
    lecturer: 'Hội đồng Đánh giá Luận án Quốc tế',
    timeStr: 'Thứ 7, 14:00 – 17:00 (VN Time)',
    descVI: 'Lễ bảo vệ chính thức Luận án Tiến sĩ Quản trị Kinh doanh',
    descEN: 'Official Doctoral Dissertation Defense Ceremony'
  }
];

const getDefaultAcademicCc = () => getCachedTenantBootstrap()?.organization?.academic_cc_emails || '';

export function cleanSubjectNameWithoutCode(raw: string): string {
  if (!raw) return '';
  let s = raw.trim();
  // 1. Strip leading numbering like '1. ', '01 - '
  s = s.replace(/^\d+[\.\-_/:\s]+/i, '').trim();
  // 2. Strip 'Môn ' / 'Môn học '
  s = s.replace(/^(môn\s+h[ọo]c\s+|môn\s+)/i, '').trim();
  // 3. Strip subject code patterns like 'BBA-01 - ', 'MBA-HS-05: ', 'E0723 - ', 'E0311 ', 'ISTEC-01 - '
  s = s.replace(/^[A-Z]{1,6}(?:[-_][A-Z0-9]+)+\s*[-_:]*\s*/i, '').trim();
  s = s.replace(/^[A-Z]\d{3,5}\s*[-_:]*\s*/i, '').trim();
  s = s.replace(/^[A-Z0-9_-]{2,10}\s*[-_:]\s*/i, '').trim();
  // 4. Strip leftover punctuation at start
  s = s.replace(/^[-_:.\s]+/, '').trim();
  return s || raw;
}

export function detectTbcdTemplate(rawStr: string): TbcdTemplateKey {
  const s = (rawStr || '').trim().toLowerCase();
  if (
    s.includes('estiam') ||
    s.includes('dba') ||
    s.includes('paris education') ||
    s.includes('tiến sĩ') ||
    s.includes('tien si') ||
    s.includes('seminar') ||
    s.includes('phase')
  ) {
    return 'estiam';
  }
  if (s.includes('msc') || s.includes('ai') || s.includes('trí tuệ')) {
    return 'msc_ai';
  }
  if (s.includes('bba') || s.includes('top up') || s.includes('topup') || s.includes('cử nhân') || s.includes('bachelor')) {
    return 'bba';
  }
  if (s.includes('high') || s.includes('nâng cao') || s.includes('hq')) {
    return 'mba_high';
  }
  return 'mba_standard';
}

function extractClassOrCohortCode(
  campaignName?: string,
  progName?: string,
  subCode?: string
): string {
  const combined = `${campaignName || ''} ${progName || ''} ${subCode || ''}`;
  const intakeMatch = combined.match(/intake\s*\d+|in\s*\d+/i);
  if (intakeMatch) return intakeMatch[0].toUpperCase();

  const kCodeMatch = combined.match(/\b(K\d{2,4})\b/i);
  if (kCodeMatch) return kCodeMatch[1].toUpperCase();

  if (/estiam/i.test(combined) || /dba/i.test(combined)) {
    return 'INTAKE 1';
  }
  return '';
}

function formatDateDdMmYyyy(dateStr?: string): string {
  if (!dateStr) return 'dd/mm/yyyy';
  const clean = String(dateStr).trim().slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return clean;
}

function getDayOfWeekVN(dateStr?: string): string {
  if (!dateStr) return 'Chủ nhật';
  try {
    const clean = String(dateStr).trim().slice(0, 10);
    const [y, m, d] = clean.split('-').map(Number);
    if (!y || !m || !d) return 'Chủ nhật';
    const dt = new Date(y, m - 1, d);
    const days = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return days[dt.getDay()] || 'Chủ nhật';
  } catch {
    return 'Chủ nhật';
  }
}

function getDayOfWeekEN(dateStr?: string): string {
  if (!dateStr) return 'Sunday';
  try {
    const clean = String(dateStr).trim().slice(0, 10);
    const [y, m, d] = clean.split('-').map(Number);
    if (!y || !m || !d) return 'Sunday';
    const dt = new Date(y, m - 1, d);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[dt.getDay()] || 'Sunday';
  } catch {
    return 'Sunday';
  }
}

function extractMonthYearInfo(subject: any): {
  monthNum: string;
  yearNum: string;
  monthYearVN: string;
  monthYearEN: string;
  monthYearFullEN: string;
} {
  const monthNamesShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthNamesFull = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const candidateDates: string[] = [];
  if (Array.isArray(subject?.host_sessions)) {
    subject.host_sessions.forEach((s: any) => {
      if (s?.date) candidateDates.push(String(s.date).trim().slice(0, 10));
    });
  }
  if (Array.isArray(subject?.seminars)) {
    subject.seminars.forEach((sem: any) => {
      if (sem?.date) candidateDates.push(String(sem.date).trim().slice(0, 10));
    });
  }
  if (subject?.start_date) {
    candidateDates.push(String(subject.start_date).trim().slice(0, 10));
  }

  const validDates = candidateDates.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const baseDate = validDates[0] || new Date().toISOString().slice(0, 10);
  const [yStr, mStr] = baseDate.split('-');
  const mIdx = Math.max(0, Math.min(11, (parseInt(mStr, 10) || 1) - 1));
  const mm = String(mIdx + 1).padStart(2, '0');
  const yyyy = yStr || String(new Date().getFullYear());

  return {
    monthNum: mm,
    yearNum: yyyy,
    monthYearVN: `${mm}/${yyyy}`,
    monthYearEN: `${monthNamesShort[mIdx]} ${yyyy}`,
    monthYearFullEN: `${monthNamesFull[mIdx]} ${yyyy}`
  };
}

export const SubjectAnnouncementModal: React.FC<SubjectAnnouncementModalProps> = ({
  isOpen,
  onClose,
  subject,
  allSubjects = [],
  campaign,
  programName,
  companiesList = [],
  consultants = [],
  preselectedStudent = null,
  onSubjectUpdated,
  addToast,
}) => {
  const notify = useCallback(
    (msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
      if (addToast) addToast(msg, type);
      else alert(msg);
    },
    [addToast]
  );

  const [remoteLecturersMap, setRemoteLecturersMap] = useState<Record<string, string>>({});
  const [remoteCourseSubjects, setRemoteCourseSubjects] = useState<any[]>([]);
  const [activeSubject, setActiveSubject] = useState<any>(subject);

  useEffect(() => {
    if (subject) {
      setActiveSubject({
        ...subject,
        code: subject.code || subject.subject_code || '',
        name: subject.name || subject.subject_name || '',
      });
      setSelectedEmails([]);
    }
  }, [subject]);

  const availableSubjects = useMemo(() => {
    const merged: any[] = [];
    const seen = new Set<string>();
    const pushSub = (s: any) => {
      if (!s) return;
      const code = String(s.code || s.subject_code || '').trim();
      const name = String(s.name || s.subject_name || '').trim();
      if (!code && !name) return;
      const key = `${code.toLowerCase()}__${name.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push({
        ...s,
        code,
        name,
      });
    };
    remoteCourseSubjects.forEach(pushSub);
    (Array.isArray(allSubjects) ? allSubjects : []).forEach(pushSub);
    if (activeSubject) pushSub(activeSubject);
    return merged;
  }, [remoteCourseSubjects, allSubjects, activeSubject]);

  const resolveLecturerNameById = useCallback(
    (lecturerId: any): string => {
      if (!lecturerId) return '';
      const strId = String(lecturerId).trim();
      if (remoteLecturersMap[strId]) return remoteLecturersMap[strId];
      const foundComp = companiesList.find(c => String(c.id) === strId);
      if (foundComp) return foundComp.name || foundComp.full_name || '';
      const foundCons = consultants.find(c => String(c.id) === strId);
      if (foundCons) return foundCons.name || foundCons.full_name || '';
      return strId;
    },
    [companiesList, consultants, remoteLecturersMap]
  );

  // Template, Language & Dynamic Overrides State
  const [templateKey, setTemplateKey] = useState<TbcdTemplateKey>('mba_standard');
  const [language, setLanguage] = useState<'vi' | 'en'>('vi');
  const [activeTab, setActiveTab] = useState<'preview' | 'edit' | 'zalo'>('preview');

  // Class / Cohort Code (e.g. E0723, INTAKE 1, E0311, E1413)
  const [classCode, setClassCode] = useState<string>('');

  // DBA Seminar selection
  const [selectedDbaSeminarId, setSelectedDbaSeminarId] = useState<string>('sem1');
  const [customSubjectTitle, setCustomSubjectTitle] = useState<string>('');

  const [schoolLecturer, setSchoolLecturer] = useState('');
  const [seminarLecturer, setSeminarLecturer] = useState('');
  const [aiAgentLink, setAiAgentLink] = useState('');
  const [zoomLink, setZoomLink] = useState('');
  const [zoomId, setZoomId] = useState('');
  const [zoomPass, setZoomPass] = useState('');

  const [emailSubject, setEmailSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [zaloText, setZaloText] = useState('');
  const [ccEmails, setCcEmails] = useState(getDefaultAcademicCc());
  const [customEmailsInput, setCustomEmailsInput] = useState('');

  // Track if user manually typed in preview
  const [isUserEdited, setIsUserEdited] = useState(false);
  const previewContentRef = useRef<HTMLDivElement>(null);

  // Stepper & Confirmation State
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const handleSafeClose = useCallback(() => {
    if (isUserEdited) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [isUserEdited, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    setStep(1);
    setShowDiscardConfirm(false);
    document.body.style.overflow = 'hidden';

    const unregister = pushOverlay(
      'subject-announcement-modal',
      () => {
        handleSafeClose();
        return true;
      },
      2147483646
    );

    return () => {
      document.body.style.overflow = '';
      if (typeof unregister === 'function') unregister();
    };
  }, [isOpen, handleSafeClose]);

  // Enrolled Students Recipients State
  const [students, setStudents] = useState<any[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [recipientScope, setRecipientScope] = useState<'campaign' | 'all'>('campaign');
  const [completionFilter, setCompletionFilter] = useState<'pending' | 'completed' | 'all'>('pending');
  const [uploadedRecipients, setUploadedRecipients] = useState<Array<{ email: string; name?: string }>>([]);
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [isParsingUpload, setIsParsingUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSending, setIsSending] = useState(false);
  const inFlightRef = useRef(false);

  // Initialize from activeSubject & campaign
  useEffect(() => {
    if (!isOpen || !activeSubject) return;

    const rawProgContext = [
      programName,
      campaign?.name,
      campaign?.project_name,
      preselectedStudent?.program,
      activeSubject?.code,
      activeSubject?.name
    ]
      .filter(Boolean)
      .join(' ');
    const detected = detectTbcdTemplate(rawProgContext);
    setTemplateKey(detected);
    setActiveTab('preview');
    setIsUserEdited(false);
    setUploadedRecipients([]);
    setUploadedFileName('');

    // Initial class code detection
    const extractedCode = extractClassOrCohortCode(campaign?.name, programName, activeSubject?.code);
    setClassCode(extractedCode);

    // Resolve school lecturer (Prof.)
    const hostSessions = Array.isArray(activeSubject.host_sessions) ? activeSubject.host_sessions : [];
    const firstHostLect = hostSessions.find((s: any) => s?.lecturer_name)?.lecturer_name || '';
    const resolvedFirstHostLect = firstHostLect ? resolveLecturerNameById(firstHostLect) : '';
    const mainLect = resolveLecturerNameById(activeSubject.lecturer_id || activeSubject.lecturer_name);
    const initialSchoolLect =
      activeSubject.school_lecturer ||
      resolvedFirstHostLect ||
      mainLect ||
      (detected === 'estiam' ? 'Dr. Phạm Quang Vinh' : 'Prof. Dr. Christopher Rezvani');

    // Resolve seminar lecturer (Giảng viên hướng dẫn IDEAS)
    const seminars = Array.isArray(activeSubject.seminars) ? activeSubject.seminars : [];
    const firstSemLectId = seminars.find((s: any) => s?.lecturer_id)?.lecturer_id || '';
    const resolvedSemLect = firstSemLectId ? resolveLecturerNameById(firstSemLectId) : '';
    const initialSeminarLect =
      resolvedSemLect ||
      mainLect ||
      (detected === 'estiam' ? 'Dr. Phạm Quang Vinh' : detected === 'bba' ? 'Mr. Trần Hoàng Hiệp' : 'Mr. Dương Trần Minh Đoàn');

    // Resolve Zoom info
    const zLink =
      activeSubject.zoom_link ||
      activeSubject.seminar_zoom_link ||
      activeSubject.school_zoom_link ||
      (detected === 'estiam' ? 'https://us02web.zoom.us/j/83058208278?pwd=m152xJcs2YF6fCblB4CtYrrAiP26a4.1' : 'https://us02web.zoom.us/j/9682569703?pwd=wfPSvJV11NXl6rKHjwEeN4sI98AZTk.1');
    const zId =
      activeSubject.zoom_id ||
      activeSubject.seminar_zoom_id ||
      activeSubject.school_zoom_id ||
      (detected === 'estiam' ? '830 5820 8278' : '968 256 9703');
    const zPass =
      activeSubject.zoom_pass ||
      activeSubject.seminar_zoom_pass ||
      activeSubject.school_zoom_pass ||
      (detected === 'estiam' ? 'ideas@812' : 'umef@812');

    const initialAiLink = activeSubject.ai_agent_link || getTenantAiPlatformUrl();

    setSchoolLecturer(initialSchoolLect);
    setSeminarLecturer(initialSeminarLect);
    setZoomLink(zLink);
    setZoomId(zId);
    setZoomPass(zPass);
    setAiAgentLink(initialAiLink);
    setCcEmails(getDefaultAcademicCc());

    if (preselectedStudent?.email) {
      setCustomEmailsInput(preselectedStudent.email);
    } else {
      setCustomEmailsInput('');
    }
  }, [isOpen, activeSubject, campaign, programName, preselectedStudent, resolveLecturerNameById]);

  // Fetch recipients
  const fetchRecipients = useCallback(async () => {
    if (!isOpen) return;
    const cid = Number(campaign?.id || 0);
    const pid = Number(campaign?.project_id || 0);
    const prog = (programName || campaign?.project_name || campaign?.name || preselectedStudent?.program || '').trim();
    if (!cid && !pid && !prog) {
      setStudents([]);
      return;
    }

    setLoadingRecipients(true);
    try {
      const token =
        localStorage.getItem('Ideas_token') ||
        localStorage.getItem('access_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('auth_token') ||
        '';
      const qs = new URLSearchParams();
      if (cid > 0) qs.set('campaign_id', String(cid));
      if (pid > 0) qs.set('project_id', String(pid));
      if (prog) qs.set('program', prog);
      if (activeSubject?.id || activeSubject?.subject_id) qs.set('subject_id', String(activeSubject.id || activeSubject.subject_id));
      if (activeSubject?.code || activeSubject?.subject_code) qs.set('subject_code', String(activeSubject.code || activeSubject.subject_code));
      if (activeSubject?.name || activeSubject?.subject_name) qs.set('subject_name', String(activeSubject.name || activeSubject.subject_name));

      const res = await academicFetch(`${API_URL}/academic/subject-announcement/recipients?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const json = await res.json();
      if (res.ok && json?.data) {
        if (json.data.lecturers_map && typeof json.data.lecturers_map === 'object') {
          setRemoteLecturersMap(json.data.lecturers_map);
        }
        if (Array.isArray(json.data.course_subjects) && json.data.course_subjects.length > 0) {
          const cSubs = json.data.course_subjects;
          setRemoteCourseSubjects(cSubs);
        }
        if (Array.isArray(json.data.students)) {
          const list = json.data.students;
          setStudents(list);
          const directCount = Number(json.data.direct_campaign_count || 0);
          const defaultScope = directCount > 0 ? 'campaign' : 'all';
          setRecipientScope(defaultScope);

          if (preselectedStudent?.email) {
            setSelectedEmails([preselectedStudent.email.trim().toLowerCase()]);
          } else {
            // Default: Only pre-select students who have NOT completed this subject yet
            const initialSelected = list
              .filter((st: any) => (defaultScope === 'campaign' ? st.in_campaign : true))
              .filter((st: any) => !st.is_subject_completed)
              .map((st: any) => String(st.email || '').trim().toLowerCase())
              .filter((em: string) => em.includes('@'));
            setSelectedEmails(Array.from(new Set(initialSelected)));
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch subject announcement recipients:', err);
    } finally {
      setLoadingRecipients(false);
    }
  }, [
    isOpen,
    campaign?.id,
    campaign?.project_id,
    campaign?.project_name,
    campaign?.name,
    programName,
    preselectedStudent?.email,
    preselectedStudent?.program,
    activeSubject?.id,
    activeSubject?.subject_id,
    activeSubject?.code,
    activeSubject?.subject_code,
    activeSubject?.name,
    activeSubject?.subject_name
  ]);

  useEffect(() => {
    if (isOpen) {
      fetchRecipients();
    }
  }, [isOpen, fetchRecipients]);

  // Build Output Generator (Pure VI vs Pure EN, Logo & IDEAS only)
  const buildTemplateOutput = useCallback(
    (
      tpl: TbcdTemplateKey,
      lang: 'vi' | 'en',
      subObj: any,
      overrides: {
        schoolLect: string;
        semLect: string;
        zLink: string;
        zId: string;
        zPass: string;
        aiLink: string;
        cohortCode: string;
        customTitle: string;
        dbaSemId: string;
      }
    ): { subject: string; html: string; zalo: string } => {
      const sCode = String(subObj?.code || '').trim();
      const rawName = overrides.customTitle.trim() || String(subObj?.name || 'Môn học').trim();
      const sName = cleanSubjectNameWithoutCode(rawName);
      const cohortStr = overrides.cohortCode.trim();

      const { monthYearVN, monthYearEN } = extractMonthYearInfo(subObj);
      const hostSessions: any[] = Array.isArray(subObj?.host_sessions) ? subObj.host_sessions : [];
      const seminars: any[] = Array.isArray(subObj?.seminars) ? subObj.seminars : [];

      const profDisplay = overrides.schoolLect.replace(/^Prof\.?\s*/i, '').trim() || 'Dr. Christopher Rezvani';
      const semLectDisplay = overrides.semLect.trim() || 'Mr. Dương Trần Minh Đoàn';
      const zLink = overrides.zLink.trim() || 'https://zoom.us/';
      const zId = overrides.zId.trim() || '968 256 9703';
      const zPass = overrides.zPass.trim() || 'umef@812';
      const aiLink = overrides.aiLink.trim() || getTenantAiPlatformUrl();

      const tableStyle = 'width:100%;border-collapse:collapse;margin:14px 0 18px 0;font-size:13.5px;';
      const thStyle = 'background:#f8fafc;color:#0f172a;font-weight:700;padding:10px 12px;border:1px solid #cbd5e1;text-align:left;';
      const tdStyle = 'padding:10px 12px;border:1px solid #cbd5e1;vertical-align:top;color:#1e293b;line-height:1.55;';

      const formatSeminarCompactRange = (sem: any) => {
        const count = Number(sem?.sessions_count || 2);
        const s1Start = sem?.session1_start || '08:30';
        const s1End = sem?.session1_end || '11:30';
        const s2End = sem?.session2_end || '16:30';
        return count === 2 ? `${s1Start} - ${s2End}` : `${s1Start} - ${s1End}`;
      };

      // =========================================================================
      // TEMPLATE 1: DBA (SEMINAR & PHASE) - NO "MÔN", PURE SEMINAR TERMINOLOGY
      // =========================================================================
      if (tpl === 'estiam') {
        const dbaSem = DBA_SEMINAR_OPTIONS.find(s => s.id === overrides.dbaSemId) || DBA_SEMINAR_OPTIONS[0];
        const semTitle = overrides.customTitle.trim() || (lang === 'vi' ? dbaSem.titleVI : dbaSem.titleEN);
        const intakeLabel = cohortStr || 'DBA ESTIAM INTAKE 1';
        const semLect = overrides.semLect.trim() || dbaSem.lecturer;
        const semTime = dbaSem.timeStr;
        const semDesc = lang === 'vi' ? dbaSem.descVI.replace(/\n/g, '<br/>') : dbaSem.descEN.replace(/\n/g, '<br/>');

        if (lang === 'vi') {
          const subj = `IDEAS_Thông báo lịch ${semTitle}_${intakeLabel}`;
          const html = `<p>Thân gửi Quý Anh/Chị Nghiên cứu sinh,</p>
<p>IDEAS xin thông báo lịch <strong>${semTitle}</strong> với thông tin chi tiết như sau:</p>

<table style="${tableStyle}">
  <thead>
    <tr>
      <th style="${thStyle}width:30%;">Ngày học</th>
      <th style="${thStyle}width:24%;">Giảng viên</th>
      <th style="${thStyle}width:28%;">Nội dung</th>
      <th style="${thStyle}width:18%;">Địa điểm</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">
        <strong>${semTime}</strong>
      </td>
      <td style="${tdStyle}">
        <strong>${semLect}</strong>
      </td>
      <td style="${tdStyle}">
        ${semDesc}
      </td>
      <td style="${tdStyle}">
        <strong>ONLINE ZOOMEETING</strong><br/>
        Link: <a href="${zLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">Tại đây</a><br/>
        Meeting ID: <strong>${zId}</strong><br/>
        Passcode: <strong>${zPass}</strong>
      </td>
    </tr>
  </tbody>
</table>

<p>Nếu có vấn đề phát sinh nào khác, quý anh chị học viên vui lòng liên hệ Trợ lý chương trình để được hỗ trợ kịp thời.</p>
<p style="margin-top:20px;">Trân trọng,<br/><strong>IDEAS</strong></p>`;

          const zalo = `📢 ${subj}
----------------------------------
Thân gửi Quý Anh/Chị Nghiên cứu sinh,
IDEAS xin thông báo lịch ${semTitle} với thông tin chi tiết:
📅 Thời gian: ${semTime}
👨‍🏫 Giảng viên / GS Hướng dẫn: ${semLect}
📖 Nội dung: ${dbaSem.descVI.replace(/\n/g, ' ')}
🔗 Link Zoom: ${zLink}
🆔 Meeting ID: ${zId} | Passcode: ${zPass}

Trân trọng,
IDEAS`;
          return { subject: subj, html, zalo };
        } else {
          // English Version
          const subj = `IDEAS_Schedule for ${semTitle}_${intakeLabel}`;
          const html = `<p>Dear Students / Doctoral Candidates,</p>
<p>IDEAS would like to announce the schedule for <strong>${semTitle}</strong> with detailed information as follows:</p>

<table style="${tableStyle}">
  <thead>
    <tr>
      <th style="${thStyle}width:30%;">Date &amp; Time</th>
      <th style="${thStyle}width:24%;">Supervisor / Professor</th>
      <th style="${thStyle}width:28%;">Seminar Content</th>
      <th style="${thStyle}width:18%;">Location</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">
        <strong>${semTime}</strong>
      </td>
      <td style="${tdStyle}">
        <strong>${semLect}</strong>
      </td>
      <td style="${tdStyle}">
        ${semDesc}
      </td>
      <td style="${tdStyle}">
        <strong>ONLINE ZOOMEETING</strong><br/>
        Link: <a href="${zLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">Access Zoom</a><br/>
        Meeting ID: <strong>${zId}</strong><br/>
        Passcode: <strong>${zPass}</strong>
      </td>
    </tr>
  </tbody>
</table>

<p>Should there be any other inquiries, students are kindly requested to contact the Program Assistant for timely support.</p>
<p style="margin-top:20px;">Sincerely,<br/><strong>IDEAS</strong></p>`;

          const zalo = `📢 ${subj}
----------------------------------
Dear Doctoral Candidates,
IDEAS would like to announce the schedule for ${semTitle}:
📅 Date & Time: ${semTime}
👨‍🏫 Supervisor: ${semLect}
📖 Seminar Content: ${dbaSem.descEN.replace(/\n/g, ' ')}
🔗 Zoom Link: ${zLink}
🆔 Meeting ID: ${zId} | Passcode: ${zPass}

Sincerely,
IDEAS`;
          return { subject: subj, html, zalo };
        }
      }

      // =========================================================================
      // TEMPLATE 2: BBA / TOP UP
      // =========================================================================
      if (tpl === 'bba') {
        const cohortSuffix = cohortStr ? ` ${cohortStr}` : '';
        if (lang === 'vi') {
          const subj = `IDEAS_Thông báo lịch học môn ${sName}${cohortSuffix} ${monthYearVN}`;
          const html = `<p>Thân gửi Quý anh chị học viên,</p>
<p>IDEAS xin gửi thông báo lịch học môn <strong>${sName}</strong> với thông tin cụ thể như sau:</p>

<p><strong style="color:#BD1D2D;font-size:15px;">1. Lịch học với trường UMEF:</strong></p>
<table style="${tableStyle}">
  <thead>
    <tr>
      <th colspan="4" style="background:#BD1D2D;color:#ffffff;font-weight:700;padding:10px 12px;border:1px solid #BD1D2D;text-align:center;">Lớp Swiss UMEF</th>
    </tr>
    <tr>
      <th style="${thStyle}width:30%;">Ngày học</th>
      <th style="${thStyle}width:20%;">Giờ học</th>
      <th style="${thStyle}width:28%;">Nội dung</th>
      <th style="${thStyle}width:22%;">Lưu ý</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">
        Lesson 1 &bull; Chủ Nhật, 18/10/2026<br/>
        Lesson 2 &bull; Chủ Nhật, 01/11/2026
      </td>
      <td style="${tdStyle}"><strong>15:00 – 18:00</strong><br/>(VN time)</td>
      <td style="${tdStyle}">
        <strong>${sName}</strong><br/>
        Prof. <strong>${profDisplay}</strong>
      </td>
      <td style="${tdStyle}">
        Lớp tập trung vào môn ${sName} giúp học viên nắm vững kiến thức cốt lõi và phương pháp học tập hiệu quả.
      </td>
    </tr>
  </tbody>
</table>

<p><strong style="color:#BD1D2D;font-size:15px;">2. Lịch học với IDEAS:</strong></p>
<p style="margin:4px 0 8px 0;">Giảng viên: <strong>${semLectDisplay}</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>HD 1:</strong> Chủ nhật, 8:30 – 11:30</li>
  <li><strong>HD 2:</strong> Chủ nhật, 8:30 – 11:30</li>
  <li><strong>HD 3:</strong> Chủ nhật, 8:30 – 11:30</li>
  <li><strong>HD 4:</strong> Chủ nhật, 8:30 – 11:30</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">3. Thông Tin Zoom Meeting (Cho cả UMEF &amp; IDEAS):</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Link:</strong> <a href="${zLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${zLink}</a></li>
  <li><strong>Meeting ID:</strong> ${zId}</li>
  <li><strong>Passcode:</strong> ${zPass}</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">4. Công cụ AI Tương tác Hỗ trợ Học viên:</strong></p>
<p>Nhằm nâng cao chất lượng trải nghiệm và hỗ trợ tối đa cho học viên, IDEAS trân trọng giới thiệu Trợ lý AI Tương tác hỗ trợ môn học 24/7:</p>
<p>👉 <strong>Truy cập AI Agent tại đây:</strong> <a href="${aiLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${aiLink}</a></p>

<p><strong style="color:#BD1D2D;">Quý anh chị học viên lưu ý:</strong></p>
<ul style="padding-left:20px;line-height:1.75;">
  <li>Lớp sẽ học ONLINE với giảng viên của trường Swiss UMEF. Đây là lớp học chính thức, quý anh chị học viên cố gắng sắp xếp tham dự đầy đủ.</li>
  <li>Đối với các bài tập quiz có giới hạn số lần làm bài trên hệ thống LMS, học viên cần lưu ý hoàn thành bài tập đúng hạn theo quy định.</li>
  <li>Lớp hướng dẫn của IDEAS sẽ được tổ chức ONLINE với thời gian như trên. Bản record các buổi học sẽ được cập nhật trên LMS.</li>
</ul>
<p>Nếu có vấn đề phát sinh nào khác, quý anh chị học viên vui lòng liên hệ Trợ lý chương trình để được hỗ trợ kịp thời.</p>
<p style="margin-top:20px;">Trân trọng,<br/><strong>IDEAS</strong></p>`;

          const zalo = `📢 ${subj}
----------------------------------
Thân gửi Quý Anh/Chị Học viên,
IDEAS xin gửi thông báo lịch học môn ${sName} (${monthYearVN}):
1️⃣ Lịch Swiss UMEF: Lesson 1 & 2 (15:00 – 18:00 VN Time) | Prof. ${profDisplay}
2️⃣ Lịch học với IDEAS: Giảng viên ${semLectDisplay} (Chủ nhật, 8:30 – 11:30)
🔗 Link Zoom: ${zLink}
🆔 Meeting ID: ${zId} | Passcode: ${zPass}
🤖 Trợ lý AI Hỗ trợ Môn học: ${aiLink}

Trân trọng,
IDEAS`;
          return { subject: subj, html, zalo };
        } else {
          // English Version
          const subj = `IDEAS_Class Schedule for ${sName}${cohortSuffix} ${monthYearEN}`;
          const html = `<p>Dear Students,</p>
<p>IDEAS would like to announce the class schedule for <strong>${sName}</strong> as follows:</p>

<p><strong style="color:#BD1D2D;font-size:15px;">1. Swiss UMEF Class Schedule:</strong></p>
<table style="${tableStyle}">
  <thead>
    <tr>
      <th colspan="4" style="background:#BD1D2D;color:#ffffff;font-weight:700;padding:10px 12px;border:1px solid #BD1D2D;text-align:center;">Swiss UMEF Live Class</th>
    </tr>
    <tr>
      <th style="${thStyle}width:30%;">Day</th>
      <th style="${thStyle}width:20%;">Time</th>
      <th style="${thStyle}width:28%;">Content</th>
      <th style="${thStyle}width:22%;">Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">
        Lesson 1 &bull; Sunday, 18/10/2026<br/>
        Lesson 2 &bull; Sunday, 01/11/2026
      </td>
      <td style="${tdStyle}"><strong>15:00 – 18:00</strong><br/>(VN time)</td>
      <td style="${tdStyle}">
        <strong>${sName}</strong><br/>
        Prof. <strong>${profDisplay}</strong>
      </td>
      <td style="${tdStyle}">
        Focuses on core subject concepts and effective learning methodologies.
      </td>
    </tr>
  </tbody>
</table>

<p><strong style="color:#BD1D2D;font-size:15px;">2. IDEAS Guidance Class Schedule:</strong></p>
<p style="margin:4px 0 8px 0;">Instructor: <strong>${semLectDisplay}</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Session 1:</strong> Sunday, 8:30 – 11:30</li>
  <li><strong>Session 2:</strong> Sunday, 8:30 – 11:30</li>
  <li><strong>Session 3:</strong> Sunday, 8:30 – 11:30</li>
  <li><strong>Session 4:</strong> Sunday, 8:30 – 11:30</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">3. Zoom Meeting Information (For both UMEF &amp; IDEAS):</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Link:</strong> <a href="${zLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${zLink}</a></li>
  <li><strong>Meeting ID:</strong> ${zId}</li>
  <li><strong>Passcode:</strong> ${zPass}</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">4. Interactive AI Learning Assistant:</strong></p>
<p>👉 <strong>Access your AI Study Assistant:</strong> <a href="${aiLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${aiLink}</a></p>

<p><strong style="color:#BD1D2D;">Important Notices for Students:</strong></p>
<ul style="padding-left:20px;line-height:1.75;">
  <li>Live classes with Swiss UMEF are official required sessions. Please make sure to attend on time.</li>
  <li>Check quiz submission deadlines on UMEF Moodle/LMS.</li>
</ul>
<p>Should there be any issues, please contact the Program Assistant for support.</p>
<p style="margin-top:20px;">Sincerely,<br/><strong>IDEAS</strong></p>`;

          const zalo = `📢 ${subj}
----------------------------------
Dear Students,
IDEAS would like to announce the class schedule for ${sName} (${monthYearEN}):
1️⃣ Swiss UMEF Live Class: Lesson 1 & 2 (15:00 – 18:00 VN Time) | Prof. ${profDisplay}
2️⃣ IDEAS Guidance: Instructor ${semLectDisplay} (Sunday, 8:30 – 11:30)
🔗 Zoom Link: ${zLink}
🆔 Meeting ID: ${zId} | Passcode: ${zPass}
🤖 AI Learning Assistant: ${aiLink}

Sincerely,
IDEAS`;
          return { subject: subj, html, zalo };
        }
      }

      // =========================================================================
      // TEMPLATE 3: MSC AI
      // =========================================================================
      if (tpl === 'msc_ai') {
        const cohortSuffix = cohortStr ? ` ${cohortStr}` : '';
        if (lang === 'vi') {
          const subj = `IDEAS_Thông báo lịch học môn ${sName}${cohortSuffix} ${monthYearVN}`;
          const html = `<p>Thân gửi Quý anh chị học viên,</p>
<p>IDEAS xin gửi thông báo lịch học môn <strong>${sName}</strong> với thông tin cụ thể như sau:</p>

<p><strong style="color:#BD1D2D;font-size:15px;">1. Lịch học với trường UMEF:</strong></p>
<p style="margin:6px 0;">Professor on Zoom Meeting: <strong>${profDisplay}</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Session 1:</strong> Thứ 3, 20:00 – 22:00</li>
  <li><strong>Session 2:</strong> Thứ 5, 20:00 – 22:00</li>
  <li><strong>Session 3:</strong> Thứ 3, 20:00 – 22:00</li>
  <li><strong>Session 4:</strong> Thứ 5, 20:00 – 22:00</li>
  <li><strong>Session 5:</strong> Thứ 3, 20:00 – 22:00</li>
  <li><strong>Session 6:</strong> Thứ 5, 20:00 – 22:00</li>
  <li><strong>Session 7:</strong> Thứ 3, 20:00 – 22:00</li>
  <li><strong>Session 8:</strong> Thứ 5, 20:00 – 22:00</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">2. Lịch học với IDEAS:</strong></p>
<table style="${tableStyle}">
  <thead>
    <tr>
      <th colspan="3" style="background:#BD1D2D;color:#ffffff;font-weight:700;padding:10px 12px;border:1px solid #BD1D2D;text-align:center;">Lớp chuyên đề IDEAS</th>
    </tr>
    <tr>
      <th style="${thStyle}width:34%;">Thời gian</th>
      <th style="${thStyle}width:38%;">Nội dung</th>
      <th style="${thStyle}width:28%;">Lưu ý</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">
        <strong>Chủ nhật</strong><br/>13:30 – 16:30
      </td>
      <td style="${tdStyle}">
        Lớp chuyên đề <strong>${sName}</strong><br/>
        Giảng viên: <strong>${semLectDisplay}</strong>
      </td>
      <td style="${tdStyle}">
        Lớp chuyên đề của IDEAS tập trung vào môn ${sName}, nhằm hướng dẫn và bổ sung kiến thức chuyên sâu cho học viên ngoài các buổi học chính thức với trường UMEF.
      </td>
    </tr>
  </tbody>
</table>

<p><strong style="color:#BD1D2D;font-size:15px;">3. Thông Tin Zoom Meeting (Cho cả UMEF &amp; IDEAS):</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Link:</strong> <a href="${zLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${zLink}</a></li>
  <li><strong>Meeting ID:</strong> ${zId}</li>
  <li><strong>Passcode:</strong> ${zPass}</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">4. Công cụ AI Tương tác Hỗ trợ Môn học:</strong></p>
<p>👉 <strong>Truy cập AI Agent tại đây:</strong> <a href="${aiLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${aiLink}</a></p>

<p><strong style="color:#BD1D2D;">Quý anh chị học viên lưu ý:</strong></p>
<ul style="padding-left:20px;line-height:1.75;">
  <li>Lớp học online với trường UMEF là các buổi học chính thức, quý học viên cố gắng tham dự đầy đủ.</li>
  <li>Đặt tên khi đăng nhập vào Zoom theo cú pháp: <strong>[HỌ VÀ TÊN – MSHV]</strong>.</li>
</ul>
<p>Trân trọng,<br/><strong>IDEAS</strong></p>`;

          const zalo = `📢 ${subj}
----------------------------------
Thân gửi Quý Anh/Chị Học viên,
IDEAS xin gửi thông báo lịch học môn ${sName} (${monthYearVN}):
1️⃣ UMEF Live class: Prof. ${profDisplay} (Thứ 3 & Thứ 5, 20:00 – 22:00)
2️⃣ Lớp chuyên đề IDEAS: Giảng viên ${semLectDisplay} (Chủ nhật, 13:30 – 16:30)
🔗 Link Zoom: ${zLink}
🆔 Meeting ID: ${zId} | Passcode: ${zPass}
🤖 Trợ lý AI Hỗ trợ: ${aiLink}

Trân trọng,
IDEAS`;
          return { subject: subj, html, zalo };
        } else {
          // English Version
          const subj = `IDEAS_Class Schedule for ${sName}${cohortSuffix} ${monthYearEN}`;
          const html = `<p>Dear Students,</p>
<p>IDEAS would like to announce the class schedule for <strong>${sName}</strong> as follows:</p>

<p><strong style="color:#BD1D2D;font-size:15px;">1. Swiss UMEF Class Schedule:</strong></p>
<p style="margin:6px 0;">Professor on Zoom Meeting: <strong>${profDisplay}</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Session 1:</strong> Tuesday, 20:00 – 22:00</li>
  <li><strong>Session 2:</strong> Thursday, 20:00 – 22:00</li>
  <li><strong>Session 3:</strong> Tuesday, 20:00 – 22:00</li>
  <li><strong>Session 4:</strong> Thursday, 20:00 – 22:00</li>
  <li><strong>Session 5:</strong> Tuesday, 20:00 – 22:00</li>
  <li><strong>Session 6:</strong> Thursday, 20:00 – 22:00</li>
  <li><strong>Session 7:</strong> Tuesday, 20:00 – 22:00</li>
  <li><strong>Session 8:</strong> Thursday, 20:00 – 22:00</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">2. Class Schedule with IDEAS:</strong></p>
<table style="${tableStyle}">
  <thead>
    <tr>
      <th colspan="3" style="background:#BD1D2D;color:#ffffff;font-weight:700;padding:10px 12px;border:1px solid #BD1D2D;text-align:center;">IDEAS Seminar Class</th>
    </tr>
    <tr>
      <th style="${thStyle}width:34%;">Time</th>
      <th style="${thStyle}width:38%;">Content</th>
      <th style="${thStyle}width:28%;">Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">
        <strong>Sunday</strong><br/>13:30 – 16:30
      </td>
      <td style="${tdStyle}">
        Seminar Class <strong>${sName}</strong><br/>
        Instructor: <strong>${semLectDisplay}</strong>
      </td>
      <td style="${tdStyle}">
        Supplementary guidance and deep-dive support for students alongside the official Swiss UMEF lectures.
      </td>
    </tr>
  </tbody>
</table>

<p><strong style="color:#BD1D2D;font-size:15px;">3. Zoom Meeting Information:</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Link:</strong> <a href="${zLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${zLink}</a></li>
  <li><strong>Meeting ID:</strong> ${zId}</li>
  <li><strong>Passcode:</strong> ${zPass}</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">4. Interactive AI Learning Assistant:</strong></p>
<p>👉 <strong>Access AI Learning Assistant:</strong> <a href="${aiLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${aiLink}</a></p>

<p>Sincerely,<br/><strong>IDEAS</strong></p>`;

          const zalo = `📢 ${subj}
----------------------------------
Dear Students,
IDEAS announces the class schedule for ${sName} (${monthYearEN}):
1️⃣ UMEF Live Class: Prof. ${profDisplay} (Tue & Thu, 20:00 – 22:00)
2️⃣ IDEAS Seminar: Instructor ${semLectDisplay} (Sunday, 13:30 – 16:30)
🔗 Zoom Link: ${zLink}
🆔 Meeting ID: ${zId} | Passcode: ${zPass}

Sincerely,
IDEAS`;
          return { subject: subj, html, zalo };
        }
      }

      // =========================================================================
      // TEMPLATE 4: EMBA / MBA NHÓM HIGH (GIỜ VIỆT NAM)
      // =========================================================================
      if (tpl === 'mba_high') {
        const cohortSuffix = cohortStr ? ` ${cohortStr}` : '';
        if (lang === 'vi') {
          const subj = `IDEAS _ Thông báo lịch học môn ${sName}${cohortSuffix} ${monthYearVN}`;
          const html = `<p>Thân gửi Quý anh chị học viên,</p>
<p>IDEAS xin thông báo lịch học môn <strong>${sName}</strong> của trường Swiss UMEF như sau:</p>

<p><strong style="color:#BD1D2D;font-size:15px;">1. Lịch học với trường UMEF _ Giờ Việt Nam:</strong></p>
<p style="margin:6px 0;"><strong>Prof. Dr. ${profDisplay}</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Session 1:</strong> Thứ Tư, 20:00 – 22:00</li>
  <li><strong>Session 2:</strong> Thứ Sáu, 20:00 – 22:00</li>
  <li><strong>Session 3:</strong> Thứ Tư, 20:00 – 22:00</li>
  <li><strong>Session 4:</strong> Thứ Sáu, 20:00 – 22:00</li>
  <li><strong>Session 5:</strong> Thứ Bảy, 20:00 – 22:00</li>
  <li><strong>Session 6:</strong> Thứ Bảy, 20:00 – 22:00</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">2. Lịch học với IDEAS – Giờ Việt Nam:</strong></p>
<table style="${tableStyle}">
  <thead>
    <tr>
      <th colspan="3" style="background:#BD1D2D;color:#ffffff;font-weight:700;padding:10px 12px;border:1px solid #BD1D2D;text-align:center;">Lớp chuyên đề IDEAS</th>
    </tr>
    <tr>
      <th style="${thStyle}width:35%;">Thời gian</th>
      <th style="${thStyle}width:42%;">Nội dung</th>
      <th style="${thStyle}width:23%;">Địa điểm</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">
        <strong>Chủ Nhật</strong><br/>8:30 – 11:30 &amp; 13:30 – 16:30
      </td>
      <td style="${tdStyle}">
        Hướng dẫn IDEAS: <strong>${sName}</strong><br/>
        Giảng viên: <strong>${semLectDisplay}</strong>
      </td>
      <td style="${tdStyle}">
        Lớp chuyên đề của IDEAS tập trung vào môn ${sName}, nhằm hướng dẫn và bổ sung kiến thức cho học viên ngoài các buổi học chính thức với trường UMEF.
      </td>
    </tr>
  </tbody>
</table>

<p><strong style="color:#BD1D2D;font-size:15px;">3. Thông Tin Zoom Meeting (Cho cả UMEF &amp; IDEAS):</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Link:</strong> <a href="${zLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${zLink}</a></li>
  <li><strong>Meeting ID:</strong> ${zId}</li>
  <li><strong>Passcode:</strong> ${zPass}</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">4. Công cụ AI Tương tác Hỗ trợ Học viên:</strong></p>
<p>👉 <strong>Truy cập AI Agent tại đây:</strong> <a href="${aiLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${aiLink}</a></p>

<p><strong style="color:#BD1D2D;">Quý học viên lưu ý:</strong></p>
<ul style="padding-left:20px;line-height:1.75;">
  <li>Học viên cần tham gia đầy đủ các buổi học với trường Swiss UMEF và IDEAS để đảm bảo thời lượng môn học.</li>
  <li>Đặt tên khi đăng nhập vào Zoom: <strong>[HỌ VÀ TÊN – MSHV]</strong>.</li>
</ul>
<p>Nếu có vấn đề phát sinh nào khác, quý anh chị học viên vui lòng liên hệ Trợ lý chương trình để được hỗ trợ kịp thời.</p>
<p style="margin-top:20px;">Trân trọng,<br/><strong>IDEAS</strong></p>`;

          const zalo = `📢 ${subj}
----------------------------------
Thân gửi Quý Anh/Chị Học viên,
IDEAS xin thông báo lịch học môn ${sName} (${monthYearVN}):
1️⃣ Lịch UMEF (Giờ VN): Prof. Dr. ${profDisplay} (Thứ Tư, Sáu, Bảy, 20:00 – 22:00)
2️⃣ Lớp chuyên đề IDEAS: Giảng viên ${semLectDisplay} (Chủ Nhật, 8:30 – 11:30 & 13:30 – 16:30)
🔗 Link Zoom: ${zLink}
🆔 Meeting ID: ${zId} | Passcode: ${zPass}
🤖 Trợ lý AI Hỗ trợ: ${aiLink}

Trân trọng,
IDEAS`;
          return { subject: subj, html, zalo };
        } else {
          // English Version
          const subj = `IDEAS_Class Schedule for ${sName}${cohortSuffix} ${monthYearEN}`;
          const html = `<p>Dear Students,</p>
<p>IDEAS would like to announce the class schedule for <strong>${sName}</strong> offered by Swiss UMEF as follows:</p>

<p><strong style="color:#BD1D2D;font-size:15px;">1. Swiss UMEF Schedule (Vietnam Time):</strong></p>
<p style="margin:6px 0;"><strong>Prof. Dr. ${profDisplay}</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Session 1:</strong> Wednesday, 20:00 – 22:00</li>
  <li><strong>Session 2:</strong> Friday, 20:00 – 22:00</li>
  <li><strong>Session 3:</strong> Wednesday, 20:00 – 22:00</li>
  <li><strong>Session 4:</strong> Friday, 20:00 – 22:00</li>
  <li><strong>Session 5:</strong> Saturday, 20:00 – 22:00</li>
  <li><strong>Session 6:</strong> Saturday, 20:00 – 22:00</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">2. IDEAS Seminar Schedule (Vietnam Time):</strong></p>
<table style="${tableStyle}">
  <thead>
    <tr>
      <th colspan="3" style="background:#BD1D2D;color:#ffffff;font-weight:700;padding:10px 12px;border:1px solid #BD1D2D;text-align:center;">IDEAS Guidance Class</th>
    </tr>
    <tr>
      <th style="${thStyle}width:35%;">Time</th>
      <th style="${thStyle}width:42%;">Content</th>
      <th style="${thStyle}width:23%;">Location</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">
        <strong>Sunday</strong><br/>8:30 – 11:30 &amp; 13:30 – 16:30
      </td>
      <td style="${tdStyle}">
        IDEAS Guidance: <strong>${sName}</strong><br/>
        Instructor: <strong>${semLectDisplay}</strong>
      </td>
      <td style="${tdStyle}">Online via Zoom</td>
    </tr>
  </tbody>
</table>

<p><strong style="color:#BD1D2D;font-size:15px;">3. Zoom Meeting Information:</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Link:</strong> <a href="${zLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${zLink}</a></li>
  <li><strong>Meeting ID:</strong> ${zId}</li>
  <li><strong>Passcode:</strong> ${zPass}</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">4. Interactive AI Learning Assistant:</strong></p>
<p>👉 <strong>Access AI Learning Assistant:</strong> <a href="${aiLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${aiLink}</a></p>

<p>Sincerely,<br/><strong>IDEAS</strong></p>`;

          const zalo = `📢 ${subj}
----------------------------------
Dear Students,
IDEAS announces class schedule for ${sName} (${monthYearEN}):
1️⃣ UMEF Schedule (VN Time): Prof. Dr. ${profDisplay} (20:00 – 22:00)
2️⃣ IDEAS Seminar: Instructor ${semLectDisplay} (Sunday, 8:30 – 11:30 & 13:30 – 16:30)
🔗 Zoom Link: ${zLink}
🆔 Meeting ID: ${zId} | Passcode: ${zPass}

Sincerely,
IDEAS`;
          return { subject: subj, html, zalo };
        }
      }

      // =========================================================================
      // TEMPLATE 5 (DEFAULT): EMBA / MBA NHÓM STANDARD (SWISS TIME + VN TIME)
      // =========================================================================
      const cohortSuffix = cohortStr ? ` ${cohortStr}` : '';
      if (lang === 'vi') {
        const subj = `IDEAS Thông báo lịch học ${sName}${cohortSuffix} ${monthYearVN}`;
        const html = `<p>Thân gửi Quý anh chị học viên,</p>
<p>IDEAS xin thông báo lịch học môn <strong>${sName}</strong> của trường Swiss UMEF như sau:</p>

<p><strong style="color:#BD1D2D;font-size:15px;">1. Lịch học với trường UMEF – Swiss Time:</strong></p>
<table style="${tableStyle}">
  <thead>
    <tr>
      <th colspan="4" style="background:#BD1D2D;color:#ffffff;font-weight:700;padding:10px 12px;border:1px solid #BD1D2D;text-align:center;">Lớp Swiss UMEF</th>
    </tr>
    <tr>
      <th style="${thStyle}width:28%;">Ngày học</th>
      <th style="${thStyle}width:28%;">Giờ học</th>
      <th style="${thStyle}width:24%;">Nội dung</th>
      <th style="${thStyle}width:20%;">Địa điểm</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">
        Lesson 1 &bull; Thứ 7<br/>
        Lesson 2 &bull; Thứ 7
      </td>
      <td style="${tdStyle}">
        <strong>17:15 – 18:15 &amp; 18:30 – 19:30</strong> (Swiss time)<br/>
        <em>~ 23:15 – 01:30 (VN time)</em>
      </td>
      <td style="${tdStyle}">
        <strong>${sName}</strong><br/>
        Prof. <strong>${profDisplay}</strong>
      </td>
      <td style="${tdStyle}">
        ONLINE<br/>
        Học viên truy cập LMS UMEF để biết thêm thông tin chi tiết.
      </td>
    </tr>
  </tbody>
</table>
<p style="font-size:13px;color:#475569;"><em>*Lưu ý: Đối với lịch học với trường Swiss UMEF giảng viên phụ trách chính trên LMS/Moodle và lớp Zoom Meeting có thể sẽ là 2 giảng viên khác nhau. Tùy một số môn sẽ có trường hợp chỉ 1 giảng viên phụ trách cho cả LMS và lớp Zoom Meeting.</em></p>

<p><strong style="color:#BD1D2D;font-size:15px;">2. Lịch học với IDEAS – VN Time:</strong></p>
<table style="${tableStyle}">
  <thead>
    <tr>
      <th colspan="3" style="background:#BD1D2D;color:#ffffff;font-weight:700;padding:10px 12px;border:1px solid #BD1D2D;text-align:center;">Lớp chuyên đề IDEAS</th>
    </tr>
    <tr>
      <th style="${thStyle}width:35%;">Thời gian</th>
      <th style="${thStyle}width:42%;">Nội dung</th>
      <th style="${thStyle}width:23%;">Địa điểm</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">
        <strong>Chủ Nhật</strong><br/>8:30 – 11:30 &amp; 13:30 – 16:30
      </td>
      <td style="${tdStyle}">
        Hướng dẫn IDEAS: <strong>${sName}</strong><br/>
        Giảng viên hướng dẫn: <strong>${semLectDisplay}</strong>
      </td>
      <td style="${tdStyle}">
        Lớp chuyên đề của IDEAS tập trung vào môn ${sName}, nhằm hướng dẫn và bổ sung kiến thức cho học viên ngoài các buổi học chính thức với trường UMEF.
      </td>
    </tr>
  </tbody>
</table>

<p><strong style="color:#BD1D2D;font-size:15px;">3. Thông Tin Zoom Meeting (Cho cả UMEF &amp; IDEAS):</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Link:</strong> <a href="${zLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">Tại đây</a></li>
  <li><strong>Meeting ID:</strong> ${zId}</li>
  <li><strong>Passcode:</strong> ${zPass}</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">4. Công cụ AI Tương tác Hỗ trợ Học viên:</strong></p>
<p>👉 <strong>Truy cập AI Agent tại đây:</strong> <a href="${aiLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${aiLink}</a></p>

<p><strong style="color:#BD1D2D;">Quý học viên lưu ý:</strong></p>
<ul style="padding-left:20px;line-height:1.75;">
  <li>Để đảm bảo quý học viên không bỏ sót thời lượng lớp học, cảm phiền học viên cùng với IDEAS kiểm tra múi giờ chính xác giữa giờ Thụy Sĩ (Swiss Time) và giờ Việt Nam (VN Time) trước khi bắt đầu lớp học 4 tiếng, anh chị có thể sử dụng trang web <a href="https://time.is/compare" target="_blank" rel="noreferrer" style="color:#BD1D2D;">https://time.is/compare</a> để kiểm tra.</li>
  <li>Học viên lưu ý đối với các bài tập quiz có giới hạn số lần làm bài, cần hoàn thành bài tập theo quy định của từng môn học trên LMS.</li>
</ul>
<p>Nếu có vấn đề phát sinh nào khác, quý anh chị học viên vui lòng liên hệ Trợ lý chương trình để được hỗ trợ kịp thời.</p>
<p style="margin-top:20px;">Trân trọng,<br/><strong>IDEAS</strong></p>`;

        const zalo = `📢 ${subj}
----------------------------------
Thân gửi Quý Anh/Chị Học viên,
IDEAS xin thông báo lịch học môn ${sName} (${monthYearVN}):
1️⃣ Swiss UMEF Live Class: 17:15 – 19:30 Swiss Time (~ 23:15 – 01:30 VN Time) | Prof. ${profDisplay}
2️⃣ Lớp chuyên đề IDEAS: Giảng viên ${semLectDisplay} (Chủ Nhật, 8:30 – 11:30 & 13:30 – 16:30)
🔗 Link Zoom: ${zLink}
🆔 Meeting ID: ${zId} | Passcode: ${zPass}
🤖 Trợ lý AI Hỗ trợ: ${aiLink}

Trân trọng,
IDEAS`;
        return { subject: subj, html, zalo };
      } else {
        // English Version
        const subj = `IDEAS_Class Schedule for ${sName}${cohortSuffix} ${monthYearEN}`;
        const html = `<p>Dear Students,</p>
<p>IDEAS would like to announce the class schedule for <strong>${sName}</strong> offered by Swiss UMEF as follows:</p>

<p><strong style="color:#BD1D2D;font-size:15px;">1. Swiss UMEF Schedule – Swiss Time:</strong></p>
<table style="${tableStyle}">
  <thead>
    <tr>
      <th colspan="4" style="background:#BD1D2D;color:#ffffff;font-weight:700;padding:10px 12px;border:1px solid #BD1D2D;text-align:center;">Swiss UMEF Live Class</th>
    </tr>
    <tr>
      <th style="${thStyle}width:28%;">Day</th>
      <th style="${thStyle}width:28%;">Time</th>
      <th style="${thStyle}width:24%;">Content</th>
      <th style="${thStyle}width:20%;">Location</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">
        Lesson 1 &bull; Saturday<br/>
        Lesson 2 &bull; Saturday
      </td>
      <td style="${tdStyle}">
        <strong>17:15 – 18:15 &amp; 18:30 – 19:30</strong> (Swiss time)<br/>
        <em>~ 23:15 – 01:30 (VN time)</em>
      </td>
      <td style="${tdStyle}">
        <strong>${sName}</strong><br/>
        Prof. <strong>${profDisplay}</strong>
      </td>
      <td style="${tdStyle}">
        ONLINE<br/>
        Students can access the UMEF LMS system for more details.
      </td>
    </tr>
  </tbody>
</table>

<p><strong style="color:#BD1D2D;font-size:15px;">2. IDEAS Guidance Class Schedule – VN Time:</strong></p>
<table style="${tableStyle}">
  <thead>
    <tr>
      <th colspan="3" style="background:#BD1D2D;color:#ffffff;font-weight:700;padding:10px 12px;border:1px solid #BD1D2D;text-align:center;">IDEAS Seminar Class</th>
    </tr>
    <tr>
      <th style="${thStyle}width:35%;">Time</th>
      <th style="${thStyle}width:42%;">Content</th>
      <th style="${thStyle}width:23%;">Location</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="${tdStyle}">
        <strong>Sunday</strong><br/>8:30 – 11:30 &amp; 13:30 – 16:30
      </td>
      <td style="${tdStyle}">
        IDEAS Guidance: <strong>${sName}</strong><br/>
        Instructor: <strong>${semLectDisplay}</strong>
      </td>
      <td style="${tdStyle}">Online via Zoom</td>
    </tr>
  </tbody>
</table>

<p><strong style="color:#BD1D2D;font-size:15px;">3. Zoom Meeting Information (For both UMEF &amp; IDEAS):</strong></p>
<ul style="padding-left:20px;line-height:1.8;">
  <li><strong>Link:</strong> <a href="${zLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">Join Zoom</a></li>
  <li><strong>Meeting ID:</strong> ${zId}</li>
  <li><strong>Passcode:</strong> ${zPass}</li>
</ul>

<p><strong style="color:#BD1D2D;font-size:15px;">4. Interactive AI Learning Assistant:</strong></p>
<p>👉 <strong>Access AI Learning Assistant:</strong> <a href="${aiLink}" target="_blank" rel="noreferrer" style="color:#BD1D2D;font-weight:700;">${aiLink}</a></p>

<p><strong style="color:#BD1D2D;">Important Notices for Students:</strong></p>
<ul style="padding-left:20px;line-height:1.75;">
  <li>To ensure you do not miss any class time, please verify the exact time zone difference between Swiss Time and Vietnam Time at <a href="https://time.is/compare" target="_blank" rel="noreferrer" style="color:#BD1D2D;">https://time.is/compare</a> 4 hours before class starts.</li>
  <li>Please complete quizzes and assignments on UMEF LMS according to the schedule.</li>
</ul>
<p>Should there be any other issues, please contact the Program Assistant for support.</p>
<p style="margin-top:20px;">Sincerely,<br/><strong>IDEAS</strong></p>`;

        const zalo = `📢 ${subj}
----------------------------------
Dear Students,
IDEAS announces class schedule for ${sName} (${monthYearEN}):
1️⃣ Swiss UMEF: 17:15 – 19:30 Swiss Time (~ 23:15 – 01:30 VN Time) | Prof. ${profDisplay}
2️⃣ IDEAS Seminar: Instructor ${semLectDisplay} (Sunday, 8:30 – 11:30 & 13:30 – 16:30)
🔗 Zoom Link: ${zLink}
🆔 Meeting ID: ${zId} | Passcode: ${zPass}

Sincerely,
IDEAS`;
        return { subject: subj, html, zalo };
      }
    },
    []
  );

  // Regenerate output whenever relevant dependencies change (unless user manually modified text in preview)
  const regenerateTemplate = useCallback(() => {
    if (!activeSubject) return;
    const generated = buildTemplateOutput(templateKey, language, activeSubject, {
      schoolLect: schoolLecturer,
      semLect: seminarLecturer,
      zLink: zoomLink,
      zId: zoomId,
      zPass: zoomPass,
      aiLink: aiAgentLink,
      cohortCode: classCode,
      customTitle: customSubjectTitle,
      dbaSemId: selectedDbaSeminarId
    });
    setEmailSubject(generated.subject);
    setBodyHtml(generated.html);
    setZaloText(generated.zalo);
  }, [
    activeSubject,
    templateKey,
    language,
    schoolLecturer,
    seminarLecturer,
    zoomLink,
    zoomId,
    zoomPass,
    aiAgentLink,
    classCode,
    customSubjectTitle,
    selectedDbaSeminarId,
    buildTemplateOutput
  ]);

  useEffect(() => {
    if (!isOpen || !activeSubject) return;
    if (!isUserEdited) {
      regenerateTemplate();
    }
  }, [isOpen, activeSubject, templateKey, language, schoolLecturer, seminarLecturer, zoomLink, zoomId, zoomPass, aiAgentLink, classCode, customSubjectTitle, selectedDbaSeminarId, isUserEdited, regenerateTemplate]);

  // Recipient filtering
  const filteredStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter(st => {
      if (recipientScope === 'campaign' && !st.in_campaign) return false;
      if (completionFilter === 'pending' && st.is_subject_completed) return false;
      if (completionFilter === 'completed' && !st.is_subject_completed) return false;
      if (!q) return true;
      return (
        String(st.full_name || '').toLowerCase().includes(q) ||
        String(st.email || '').toLowerCase().includes(q) ||
        String(st.student_id || '').toLowerCase().includes(q) ||
        String(st.phone || '').toLowerCase().includes(q)
      );
    });
  }, [students, recipientScope, studentSearch, completionFilter]);

  const finalRecipientEmails = useMemo(() => {
    const set = new Set<string>();
    selectedEmails.forEach(em => {
      const clean = em.trim().toLowerCase();
      if (clean && clean.includes('@')) set.add(clean);
    });
    uploadedRecipients.forEach(item => {
      const clean = item.email.trim().toLowerCase();
      if (clean && clean.includes('@')) set.add(clean);
    });
    if (customEmailsInput.trim()) {
      customEmailsInput
        .split(/[,;\s]+/)
        .map(s => s.trim().toLowerCase())
        .filter(s => s.includes('@'))
        .forEach(em => set.add(em));
    }
    return Array.from(set);
  }, [selectedEmails, uploadedRecipients, customEmailsInput]);

  const handleUploadRecipientsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setIsParsingUpload(true);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames?.[0];
      if (!firstSheetName) {
        notify('File không có dữ liệu sheet hợp lệ!', 'warning');
        return;
      }
      const ws = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      if (!Array.isArray(rows) || rows.length === 0) {
        notify('File rỗng, không có dữ liệu để đọc!', 'warning');
        return;
      }

      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const parsedMap = new Map<string, { email: string; name?: string }>();

      // Detect likely name column index from header row if present
      const headerRow = Array.isArray(rows[0]) ? rows[0].map(c => String(c || '').trim().toLowerCase()) : [];
      const nameColIdx = headerRow.findIndex(h =>
        h.includes('tên') || h.includes('name') || h.includes('họ và tên') || h.includes('student')
      );

      rows.forEach((row, rIdx) => {
        if (!Array.isArray(row)) return;
        const rowEmails: string[] = [];
        row.forEach(cell => {
          const text = String(cell ?? '').trim();
          if (!text) return;
          const matches = text.match(emailRegex);
          if (matches) {
            matches.forEach(m => rowEmails.push(m.toLowerCase()));
          }
        });
        if (rowEmails.length === 0) return;

        let candidateName = '';
        if (rIdx > 0 && nameColIdx >= 0 && row[nameColIdx]) {
          const rawName = String(row[nameColIdx]).trim();
          if (rawName && !rawName.includes('@')) candidateName = rawName;
        } else {
          // Fallback: first non-numeric, non-email text cell in row
          for (const cell of row) {
            const txt = String(cell ?? '').trim();
            if (txt && !txt.includes('@') && !/^\d+$/.test(txt) && txt.length >= 2) {
              candidateName = txt;
              break;
            }
          }
        }

        rowEmails.forEach(em => {
          if (!parsedMap.has(em)) {
            parsedMap.set(em, { email: em, name: candidateName || undefined });
          }
        });
      });

      const list = Array.from(parsedMap.values());
      if (list.length === 0) {
        notify('Không tìm thấy địa chỉ email hợp lệ nào trong file!', 'warning');
        return;
      }

      setUploadedRecipients(list);
      setUploadedFileName(file.name);
      notify(`Đã tải lên ${list.length} email hợp lệ từ file "${file.name}"`, 'success');
    } catch (err) {
      console.error('Upload recipients parse error:', err);
      notify('Không thể đọc file danh sách. Vui lòng kiểm tra định dạng .xlsx, .xls hoặc .csv!', 'error');
    } finally {
      setIsParsingUpload(false);
    }
  };

  const handleToggleStudentEmail = (email: string) => {
    const clean = String(email || '').trim().toLowerCase();
    if (!clean) return;
    setSelectedEmails(prev =>
      prev.includes(clean) ? prev.filter(e => e !== clean) : [...prev, clean]
    );
  };

  const handleSelectAllVisible = () => {
    const visibleValid = filteredStudents
      .map(s => String(s.email || '').trim().toLowerCase())
      .filter(e => e.includes('@'));
    const allSelected = visibleValid.length > 0 && visibleValid.every(e => selectedEmails.includes(e));
    if (allSelected) {
      setSelectedEmails(prev => prev.filter(e => !visibleValid.includes(e)));
    } else {
      setSelectedEmails(prev => Array.from(new Set([...prev, ...visibleValid])));
    }
  };

  const handleProceedToStep3 = () => {
    if (finalRecipientEmails.length === 0) {
      notify('Cần chọn ít nhất 1 người nhận trước khi chuyển sang bước phát hành', 'warning');
      return;
    }
    setStep(3);
  };

  const handleSendAnnouncement = async () => {
    if (inFlightRef.current || isSending) return;
    if (finalRecipientEmails.length === 0) {
      notify('Vui lòng chọn ít nhất 1 học viên hoặc nhập email người nhận!', 'warning');
      return;
    }
    if (!emailSubject.trim()) {
      notify('Tiêu đề email không được để trống!', 'warning');
      return;
    }
    if (!bodyHtml.trim()) {
      notify('Nội dung email không được để trống!', 'warning');
      return;
    }

    inFlightRef.current = true;
    setIsSending(true);
    try {
      const token =
        localStorage.getItem('Ideas_token') ||
        localStorage.getItem('access_token') ||
        localStorage.getItem('token') ||
        localStorage.getItem('auth_token') ||
        '';
      const matchedContactIds = students
        .filter(s => finalRecipientEmails.includes(String(s.email || '').trim().toLowerCase()))
        .map(s => Number(s.id))
        .filter(id => id > 0);

      const res = await academicFetch(`${API_URL}/academic/subject-announcement/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          campaign_id: Number(campaign?.id || 0),
          subject_id: activeSubject?.id || activeSubject?.subject_id || '',
          subject_code: activeSubject?.code || activeSubject?.subject_code || '',
          subject_name: activeSubject?.name || activeSubject?.subject_name || '',
          template_key: templateKey,
          language,
          class_code: classCode.trim(),
          email_subject: emailSubject.trim(),
          body_html: bodyHtml.trim(),
          recipient_emails: finalRecipientEmails,
          contact_ids: matchedContactIds,
          cc_emails: ccEmails.trim(),
          ai_agent_link: aiAgentLink.trim(),
          school_lecturer: schoolLecturer.trim()
        })
      });
      const json = await res.json();
      if (res.ok && (json?.success !== false)) {
        notify(
          json?.message || `Đã gửi Thông báo Chuyên đề / Lịch học thành công tới ${finalRecipientEmails.length} học viên!`,
          'success'
        );
        if (onSubjectUpdated) {
          onSubjectUpdated({
            ai_agent_link: aiAgentLink.trim(),
            school_lecturer: schoolLecturer.trim()
          });
        }
        onClose();
      } else {
        notify(json?.message || 'Có lỗi xảy ra khi gửi email thông báo.', 'error');
      }
    } catch (err: any) {
      notify(err?.message || 'Lỗi kết nối máy chủ khi gửi thông báo.', 'error');
    } finally {
      setIsSending(false);
      inFlightRef.current = false;
    }
  };

  if (!isOpen || !activeSubject) return null;

  const hostCount = Array.isArray(activeSubject.host_sessions) ? activeSubject.host_sessions.length : 0;
  const semCount = Array.isArray(activeSubject.seminars) ? activeSubject.seminars.length : 0;
  const activeSubKey = `${String(activeSubject.code || '').toLowerCase()}__${String(activeSubject.name || '').toLowerCase()}`;

  return createPortal(
    <div
      className="subject-announcement-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483646,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={e => {
        if (e.target === e.currentTarget) handleSafeClose();
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1240px',
          maxHeight: '94vh',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '14px 20px',
            background: 'linear-gradient(135deg, #BD1D2D 0%, #8C111E 100%)',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <img
              src="/Logo_IDEAS_white.png"
              alt="IDEAS"
              style={{
                height: '32px',
                width: 'auto',
                maxWidth: '140px',
                objectFit: 'contain',
                filter: 'brightness(0) invert(1)',
                display: 'block'
              }}
              onError={e => {
                (e.target as HTMLImageElement).src = getTenantLogoUrl('/LOGO.webp');
                (e.target as HTMLImageElement).style.filter = 'brightness(0) invert(1)';
              }}
            />
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.25)', paddingLeft: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.02rem', fontWeight: 800, letterSpacing: '0.01em' }}>
                  Thông Báo Chuyên Đề &amp; Lịch Học Môn
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255,255,255,0.2)'
                  }}
                >
                  {templateKey === 'estiam' ? 'DBA Nghiên cứu sinh' : cleanSubjectNameWithoutCode(activeSubject.name)}
                </span>
              </div>
              <div style={{ fontSize: '0.76rem', opacity: 0.9, marginTop: '1px' }}>
                Tự động điền dữ liệu Học vụ &bull; Soạn trực tiếp trên giao diện &bull; Chọn riêng Bản Tiếng Việt / Tiếng Anh
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSafeClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 3-STEP GUIDED STEPPER NAVIGATION */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '12px 24px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          {/* Step 1 button */}
          <button
            type="button"
            onClick={() => setStep(1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 800,
                background: step === 1 ? '#BD1D2D' : step > 1 ? '#10b981' : '#f1f5f9',
                color: step === 1 || step > 1 ? '#ffffff' : '#64748b'
              }}
            >
              {step > 1 ? <Check size={14} /> : '1'}
            </div>
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: step === 1 ? 800 : 600,
                color: step === 1 ? '#BD1D2D' : '#64748b'
              }}
            >
              1. Cấu hình môn &amp; phòng học
            </span>
          </button>

          <div style={{ width: '40px', height: '2px', background: step > 1 ? '#10b981' : '#e2e8f0' }} />

          {/* Step 2 button */}
          <button
            type="button"
            onClick={() => setStep(2)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 800,
                background: step === 2 ? '#BD1D2D' : step > 2 ? '#10b981' : '#f1f5f9',
                color: step === 2 || step > 2 ? '#ffffff' : '#64748b'
              }}
            >
              {step > 2 ? <Check size={14} /> : '2'}
            </div>
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: step === 2 ? 800 : 600,
                color: step === 2 ? '#BD1D2D' : '#64748b'
              }}
            >
              2. Đối tượng nhận thông báo
            </span>
          </button>

          <div style={{ width: '40px', height: '2px', background: step > 2 ? '#10b981' : '#e2e8f0' }} />

          {/* Step 3 button */}
          <button
            type="button"
            onClick={() => {
              if (finalRecipientEmails.length > 0) {
                setStep(3);
              } else {
                notify('Cần chọn ít nhất 1 người nhận trước khi chuyển sang bước phát hành', 'warning');
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              cursor: finalRecipientEmails.length > 0 ? 'pointer' : 'not-allowed',
              padding: '4px 8px',
              opacity: finalRecipientEmails.length > 0 ? 1 : 0.6
            }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.75rem',
                fontWeight: 800,
                background: step === 3 ? '#BD1D2D' : '#f1f5f9',
                color: step === 3 ? '#ffffff' : '#64748b'
              }}
            >
              3
            </div>
            <span
              style={{
                fontSize: '0.82rem',
                fontWeight: step === 3 ? 800 : 600,
                color: step === 3 ? '#BD1D2D' : '#64748b'
              }}
            >
              3. Soạn thảo &amp; Xem trước đa kênh
            </span>
          </button>
        </div>

        {/* STEP 1: CẤU HÌNH MÔN & PHÒNG HỌC */}
        {step === 1 && (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '18px 22px',
              display: 'grid',
              gridTemplateColumns: 'minmax(330px, 1fr) minmax(330px, 1fr)',
              gap: '18px',
              background: '#f8fafc'
            }}
          >
            {/* 1. MẪU TBCĐ & CHƯƠNG TRÌNH */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em'
                }}
              >
                <GraduationCap size={15} color="#BD1D2D" />
                1. Mẫu Thông Báo Theo Chương Trình:
              </label>

              <select
                value={templateKey}
                onChange={e => {
                  setTemplateKey(e.target.value as TbcdTemplateKey);
                  setIsUserEdited(false);
                }}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1.5px solid #BD1D2D',
                  background: '#fef2f2',
                  color: '#BD1D2D',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {TBCD_TEMPLATE_OPTIONS.map((opt, idx) => (
                  <option key={opt.id} value={opt.id}>
                    {idx + 1}/ {opt.label}
                  </option>
                ))}
              </select>

              {/* 2. CHỌN MÔN HỌC (CHO CÁC HỆ ĐẠI HỌC/THẠC SĨ) HOẶC CHỌN SEMINAR (CHO DBA) */}
              {templateKey === 'estiam' ? (
                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      marginTop: '6px',
                      marginBottom: '4px'
                    }}
                  >
                    <Award size={14} color="#BD1D2D" />
                    Chọn Seminar / Phase Nghiên cứu sinh DBA:
                  </label>
                  <select
                    value={selectedDbaSeminarId}
                    onChange={e => {
                      const semId = e.target.value;
                      setSelectedDbaSeminarId(semId);
                      setSelectedEmails([]);
                      const found = DBA_SEMINAR_OPTIONS.find(s => s.id === semId);
                      if (found) {
                        setCustomSubjectTitle(language === 'vi' ? found.titleVI : found.titleEN);
                        setSeminarLecturer(found.lecturer);
                      }
                      setIsUserEdited(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {DBA_SEMINAR_OPTIONS.map((sem, idx) => (
                      <option key={sem.id} value={sem.id}>
                        {idx + 1}. {sem.titleVI}
                      </option>
                    ))}
                  </select>
                </div>
              ) : availableSubjects.length > 0 ? (
                <div>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 800,
                      color: '#0f172a',
                      marginTop: '6px',
                      marginBottom: '4px'
                    }}
                  >
                    <BookOpen size={14} color="#BD1D2D" />
                    Chọn Môn học / Chuyên đề ({availableSubjects.length} môn):
                  </label>
                  <select
                    value={activeSubKey}
                    onChange={e => {
                      const val = e.target.value;
                      const found = availableSubjects.find(
                        s => `${String(s.code || '').toLowerCase()}__${String(s.name || '').toLowerCase()}` === val
                      );
                      if (found) {
                        setActiveSubject(found);
                        setSelectedEmails([]);
                        setCustomSubjectTitle(found.name || '');
                        setIsUserEdited(false);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1.5px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {availableSubjects.map((s, idx) => {
                      const k = `${String(s.code || '').toLowerCase()}__${String(s.name || '').toLowerCase()}`;
                      return (
                        <option key={`${k}-${idx}`} value={k}>
                          {idx + 1}. {cleanSubjectNameWithoutCode(s.name)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              ) : null}

              {/* MÃ LỚP / KHÓA HỌC (INTAKE / COHORT) */}
              <div>
                <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#475569', display: 'block', marginTop: '6px', marginBottom: '3px' }}>
                  Mã lớp / Khóa học (VD: E0723, INTAKE 1, E0311, E1413...)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={classCode}
                  onChange={e => {
                    setClassCode(e.target.value);
                    setIsUserEdited(false);
                  }}
                  placeholder="Nhập mã lớp (VD: E0723 hoặc để trống nếu không có)"
                  style={{ fontSize: '0.8rem', padding: '6px 10px', fontWeight: 700, color: '#0f172a' }}
                />
              </div>
            </div>

            {/* 2. DỮ LIỆU ĐỘNG TỰ ĐIỀN */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em'
                  }}
                >
                  <Sparkles size={14} color="#BD1D2D" />
                  2. Thông tin Giảng viên &amp; Zoom:
                </span>
                <span style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 700 }}>
                  ● Đồng bộ tự động
                </span>
              </div>

              {templateKey !== 'estiam' && (
                <div>
                  <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                    Giảng viên Trường Quốc tế (Prof. trên Zoom/LMS)
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={schoolLecturer}
                    onChange={e => {
                      setSchoolLecturer(e.target.value);
                      setIsUserEdited(false);
                    }}
                    placeholder="VD: Prof. Dr. Christopher Rezvani..."
                    style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                  />
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.72rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                  {templateKey === 'estiam' ? 'Giảng viên / GS Hướng dẫn Seminar:' : 'Giảng viên Hướng dẫn Lớp Chuyên đề IDEAS:'}
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={seminarLecturer}
                  onChange={e => {
                    setSeminarLecturer(e.target.value);
                    setIsUserEdited(false);
                  }}
                  placeholder="VD: Dr. Phạm Quang Vinh / Thầy Dương Trần Minh Đoàn..."
                  style={{ fontSize: '0.8rem', padding: '6px 10px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '0.71rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                    Zoom Meeting ID
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={zoomId}
                    onChange={e => {
                      setZoomId(e.target.value);
                      setIsUserEdited(false);
                    }}
                    style={{ fontSize: '0.78rem', padding: '5px 8px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.71rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                    Zoom Passcode
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={zoomPass}
                    onChange={e => {
                      setZoomPass(e.target.value);
                      setIsUserEdited(false);
                    }}
                    style={{ fontSize: '0.78rem', padding: '5px 8px' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.71rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                  Link phòng họp Zoom
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={zoomLink}
                  onChange={e => {
                    setZoomLink(e.target.value);
                    setIsUserEdited(false);
                  }}
                  style={{ fontSize: '0.78rem', padding: '5px 8px' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.71rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '2px' }}>
                  Link AI Agent Hỗ trợ Học tập (Mục 4)
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={aiAgentLink}
                  onChange={e => {
                    setAiAgentLink(e.target.value);
                    setIsUserEdited(false);
                  }}
                  placeholder={getTenantAiPlatformUrl() || 'https://...'}
                  style={{ fontSize: '0.78rem', padding: '5px 8px' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: ĐỐI TƯỢNG NHẬN THÔNG BÁO */}
        {step === 2 && (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: '#f8fafc'
            }}
          >
            {/* 3. DANH SÁCH NGƯỜI NHẬN */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '7px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.76rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em'
                  }}
                >
                  <Users size={14} color="#BD1D2D" />
                  3. Người nhận ({finalRecipientEmails.length} email)
                </span>
                <button
                  type="button"
                  onClick={handleSelectAllVisible}
                  style={{
                    fontSize: '0.71rem',
                    fontWeight: 700,
                    color: '#BD1D2D',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  Chọn / Bỏ chọn tất cả
                </button>
              </div>

              {/* Filter Subtabs: Chưa học môn này (Nên gửi) vs Đã hoàn thành vs Tất cả */}
              {students.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{
                    display: 'flex',
                    background: '#f1f5f9',
                    borderRadius: '8px',
                    padding: '2px',
                    gap: '2px',
                    border: '1px solid #e2e8f0'
                  }}>
                    <button
                      type="button"
                      onClick={() => setCompletionFilter('pending')}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        fontSize: '0.71rem',
                        fontWeight: completionFilter === 'pending' ? 800 : 600,
                        borderRadius: '6px',
                        border: 'none',
                        background: completionFilter === 'pending' ? '#ffffff' : 'transparent',
                        color: completionFilter === 'pending' ? '#BD1D2D' : '#64748b',
                        boxShadow: completionFilter === 'pending' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      🎯 Chưa học ({students.filter((s: any) => !s.is_subject_completed).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompletionFilter('completed')}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        fontSize: '0.71rem',
                        fontWeight: completionFilter === 'completed' ? 800 : 600,
                        borderRadius: '6px',
                        border: 'none',
                        background: completionFilter === 'completed' ? '#ffffff' : 'transparent',
                        color: completionFilter === 'completed' ? '#15803d' : '#64748b',
                        boxShadow: completionFilter === 'completed' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      ✅ Đã xong ({students.filter((s: any) => s.is_subject_completed).length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompletionFilter('all')}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        fontSize: '0.71rem',
                        fontWeight: completionFilter === 'all' ? 800 : 600,
                        borderRadius: '6px',
                        border: 'none',
                        background: completionFilter === 'all' ? '#ffffff' : 'transparent',
                        color: completionFilter === 'all' ? '#0f172a' : '#64748b',
                        boxShadow: completionFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Tất cả ({students.length})
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const validPending = students
                          .filter((s: any) => !s.is_subject_completed)
                          .map(s => String(s.email || '').trim().toLowerCase())
                          .filter(e => e.includes('@'));
                        setSelectedEmails(Array.from(new Set(validPending)));
                        setCustomEmailsInput('');
                      }}
                      style={{
                        flex: 1,
                        padding: '5px 8px',
                        borderRadius: '7px',
                        border: '1.5px solid #BD1D2D',
                        background: '#fef2f2',
                        color: '#BD1D2D',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                      title="Chỉ chọn những học viên chưa hoàn thành môn học này"
                    >
                      🎯 Chọn HV chưa học ({students.filter((s: any) => !s.is_subject_completed).length})
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const allValid = students
                          .map(s => String(s.email || '').trim().toLowerCase())
                          .filter(e => e.includes('@'));
                        setSelectedEmails(Array.from(new Set(allValid)));
                        setCustomEmailsInput('');
                      }}
                      style={{
                        padding: '5px 8px',
                        borderRadius: '7px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#475569',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '4px'
                      }}
                    >
                      <Users size={12} /> Cả lớp ({students.length})
                    </button>

                    {preselectedStudent?.email && (
                      <button
                        type="button"
                        onClick={() => {
                          const clean = preselectedStudent.email!.trim().toLowerCase();
                          setSelectedEmails([clean]);
                          setCustomEmailsInput(clean);
                        }}
                        style={{
                          padding: '5px 8px',
                          borderRadius: '7px',
                          border: selectedEmails.length === 1 && selectedEmails[0] === preselectedStudent.email!.trim().toLowerCase() ? '1.5px solid #334155' : '1px solid #cbd5e1',
                          background: selectedEmails.length === 1 && selectedEmails[0] === preselectedStudent.email!.trim().toLowerCase() ? '#f1f5f9' : '#ffffff',
                          color: '#0f172a',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        👤 1 người
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Warning Banner when subject has 0 enrolled students */}
              {students.length === 0 && !loadingRecipients && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#b45309',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.82rem',
                    fontWeight: 600
                  }}
                >
                  <AlertCircle size={18} />
                  <span>Chưa có học viên nào được ghi danh vào môn học này. Bạn có thể nhập thêm email nhận trực tiếp bên dưới.</span>
                </div>
              )}

              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Tìm theo tên học viên, mã HV, email..."
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  style={{ fontSize: '0.8rem', padding: '6px 8px 6px 32px' }}
                />
              </div>

              {/* Full-height student list */}
              <div
                style={{
                  minHeight: '380px',
                  maxHeight: '480px',
                  overflowY: 'auto',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '8px',
                  background: '#ffffff'
                }}
              >
                {loadingRecipients ? (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.82rem', color: '#64748b' }}>
                    <Loader2 size={16} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
                    Đang tải danh sách học viên...
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', fontSize: '0.82rem', color: '#64748b' }}>
                    Chưa có học viên trong danh sách. Có thể nhập email trực tiếp bên dưới.
                  </div>
                ) : (
                  filteredStudents.map(st => {
                    const em = String(st.email || '').trim().toLowerCase();
                    const hasEmail = em.includes('@');
                    const checked = hasEmail && selectedEmails.includes(em);
                    return (
                      <label
                        key={st.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          cursor: hasEmail ? 'pointer' : 'not-allowed',
                          opacity: hasEmail ? 1 : 0.5,
                          background: checked ? '#fef2f2' : '#ffffff',
                          border: checked ? '1px solid #fecaca' : '1px solid #f1f5f9',
                          marginBottom: '6px',
                          fontSize: '0.8rem',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!hasEmail}
                          onChange={() => handleToggleStudentEmail(em)}
                          style={{ width: '16px', height: '16px', accentColor: '#BD1D2D' }}
                        />
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{st.full_name}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                              {st.student_id ? `[${st.student_id}] ` : ''}{st.email || 'Chưa có email'}
                              {st.intake_cohort ? ` • Khóa: ${st.intake_cohort}` : ''}
                            </div>
                          </div>
                          {st.is_subject_completed ? (
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              color: '#15803d',
                              background: '#dcfce7',
                              border: '1px solid #bbf7d0',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              whiteSpace: 'nowrap'
                            }}>
                              ✅ Đã học ({st.subject_grade_info?.grade_letter || 'Đạt'})
                            </span>
                          ) : (
                            <span style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: '#475569',
                              background: '#f1f5f9',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              whiteSpace: 'nowrap'
                            }}>
                              Chưa học
                            </span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Upload file danh sách người nhận (.xlsx, .xls, .csv) */}
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  background: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      borderRadius: '8px',
                      background: 'rgba(189, 29, 45, 0.08)',
                      color: '#BD1D2D',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <FileSpreadsheet size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f172a' }}>
                        Up file danh sách người nhận (.xlsx, .xls, .csv)
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        Tự động lọc email hợp lệ từ file để gửi thông báo (không cần có sẵn trên hệ thống).
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt"
                      onChange={handleUploadRecipientsFile}
                      style={{ display: 'none' }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isParsingUpload}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '8px',
                        border: '1px solid #BD1D2D',
                        background: '#ffffff',
                        color: '#BD1D2D',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: isParsingUpload ? 'wait' : 'pointer'
                      }}
                    >
                      {isParsingUpload ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {uploadedFileName ? 'Đổi file khác' : 'Chọn file danh sách'}
                    </button>
                    {uploadedRecipients.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadedRecipients([]);
                          setUploadedFileName('');
                        }}
                        title="Xóa danh sách đã tải lên"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '6px 10px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          background: '#ffffff',
                          color: '#64748b',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={13} />
                        Xóa file
                      </button>
                    )}
                  </div>
                </div>

                {uploadedRecipients.length > 0 && (
                  <div style={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '8px 10px'
                  }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>📄 {uploadedFileName}</span>
                      <span style={{ color: '#BD1D2D' }}>Đã nạp {uploadedRecipients.length} email hợp lệ</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '96px', overflowY: 'auto' }}>
                      {uploadedRecipients.map(item => (
                        <span
                          key={item.email}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.7rem',
                            background: '#fef2f2',
                            color: '#991b1b',
                            border: '1px solid #fecaca',
                            borderRadius: '6px',
                            padding: '2px 7px'
                          }}
                        >
                          <span>{item.name ? `${item.name} (${item.email})` : item.email}</span>
                          <button
                            type="button"
                            onClick={() => setUploadedRecipients(prev => prev.filter(r => r.email !== item.email))}
                            style={{ border: 'none', background: 'transparent', color: '#991b1b', cursor: 'pointer', padding: 0, display: 'flex' }}
                            title="Gỡ email này"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
                    Nhập thêm email nhận ngoài danh sách:
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="VD: a@gmail.com, b@gmail.com..."
                    value={customEmailsInput}
                    onChange={e => setCustomEmailsInput(e.target.value)}
                    style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.73rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
                    CC email (Đồng kính gửi):
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="CC email"
                    value={ccEmails}
                    onChange={e => setCcEmails(e.target.value)}
                    style={{ fontSize: '0.78rem', padding: '6px 10px' }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: SOẠN THẢO & XEM TRƯỚC ĐA KÊNH */}
        {step === 3 && (
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '18px 22px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: '#f8fafc'
            }}
          >
            {/* TIÊU ĐỀ EMAIL */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '10px 14px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <label style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f172a' }}>
                  Tiêu đề Email Thông Báo <span style={{ color: '#BD1D2D' }}>*</span>
                </label>
                <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                  {language === 'vi' ? '🇻🇳 Đang ở định dạng Tiếng Việt' : '🇬🇧 Đang ở định dạng Tiếng Anh'}
                </span>
              </div>
              <input
                type="text"
                className="form-input"
                value={emailSubject}
                onChange={e => setEmailSubject(e.target.value)}
                style={{ fontSize: '0.86rem', fontWeight: 700, color: '#0f172a', padding: '7px 10px' }}
              />
            </div>

            {/* KHUNG SOẠN & XEM TRƯỚC */}
            <div
              style={{
                flex: 1,
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                {/* LANGUAGE TOGGLE: VI vs EN (SEPARATED, NO COMBINING) */}
                <div
                  style={{
                    display: 'inline-flex',
                    padding: '3px',
                    borderRadius: '9px',
                    background: '#f1f5f9',
                    border: '1.5px solid #cbd5e1',
                    gap: '2px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('vi');
                      setIsUserEdited(false);
                    }}
                    style={{
                      height: '28px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.76rem',
                      fontWeight: language === 'vi' ? 800 : 600,
                      cursor: 'pointer',
                      background: language === 'vi' ? '#ffffff' : 'transparent',
                      color: language === 'vi' ? '#BD1D2D' : '#64748b',
                      boxShadow: language === 'vi' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>🇻🇳 Bản Tiếng Việt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLanguage('en');
                      setIsUserEdited(false);
                    }}
                    style={{
                      height: '28px',
                      padding: '0 12px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.76rem',
                      fontWeight: language === 'en' ? 800 : 600,
                      cursor: 'pointer',
                      background: language === 'en' ? '#ffffff' : 'transparent',
                      color: language === 'en' ? '#BD1D2D' : '#64748b',
                      boxShadow: language === 'en' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <span>🇬🇧 Bản Tiếng Anh (English)</span>
                  </button>
                </div>

                {/* VIEW TABS */}
                <div
                  style={{
                    display: 'inline-flex',
                    padding: '3px',
                    borderRadius: '9px',
                    background: '#f1f5f9',
                    border: '1px solid #e2e8f0',
                    gap: '2px'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    style={{
                      height: '28px',
                      padding: '0 11px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.74rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      background: activeTab === 'preview' ? '#ffffff' : 'transparent',
                      color: activeTab === 'preview' ? '#BD1D2D' : '#64748b',
                      fontWeight: activeTab === 'preview' ? 700 : 600,
                      boxShadow: activeTab === 'preview' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    <Eye size={12} />
                    Xem trước &amp; Sửa trực tiếp
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('edit')}
                    style={{
                      height: '28px',
                      padding: '0 11px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.74rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      background: activeTab === 'edit' ? '#ffffff' : 'transparent',
                      color: activeTab === 'edit' ? '#BD1D2D' : '#64748b',
                      fontWeight: activeTab === 'edit' ? 700 : 600,
                      boxShadow: activeTab === 'edit' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    <Pencil size={12} />
                    Mã HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('zalo')}
                    style={{
                      height: '28px',
                      padding: '0 11px',
                      borderRadius: '6px',
                      border: 'none',
                      fontSize: '0.74rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                      background: activeTab === 'zalo' ? '#ffffff' : 'transparent',
                      color: activeTab === 'zalo' ? '#BD1D2D' : '#64748b',
                      fontWeight: activeTab === 'zalo' ? 700 : 600,
                      boxShadow: activeTab === 'zalo' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                    }}
                  >
                    <MessageSquare size={12} />
                    Bản Tin Nhắn
                  </button>
                </div>
              </div>

              {/* TOOLBAR FOR DIRECT PREVIEW EDITING */}
              {activeTab === 'preview' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '0.74rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                    <Pencil size={12} color="#BD1D2D" />
                    <span><strong>Soạn trực tiếp:</strong> Bạn có thể click chuột vào bất kỳ đoạn chữ, bảng biểu, ngày giờ nào bên dưới để gõ sửa trực tiếp</span>
                    {isUserEdited && (
                      <span style={{ fontSize: '0.68rem', color: '#16a34a', fontWeight: 800, background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                        ✓ Đã lưu sửa đổi
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <button
                      type="button"
                      onClick={() => document.execCommand('bold', false)}
                      title="In đậm (Ctrl+B)"
                      style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', fontWeight: 800, fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => document.execCommand('italic', false)}
                      title="In nghiêng (Ctrl+I)"
                      style={{ width: '24px', height: '24px', borderRadius: '4px', border: '1px solid #cbd5e1', background: '#ffffff', fontStyle: 'italic', fontWeight: 700, fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserEdited(false);
                        regenerateTemplate();
                        notify('Đã khôi phục lại mẫu tự động ban đầu!', 'info');
                      }}
                      title="Khôi phục lại nội dung mẫu tự động ban đầu"
                      style={{ fontSize: '0.7rem', color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', marginLeft: '6px' }}
                    >
                      Khôi phục mẫu tự động
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'preview' ? (
                <div
                  style={{
                    flex: 1,
                    maxHeight: '500px',
                    overflowY: 'auto',
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    padding: '14px'
                  }}
                >
                  <div
                    style={{
                      maxWidth: '720px',
                      margin: '0 auto',
                      background: '#ffffff',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 12px rgba(15, 23, 42, 0.06)'
                    }}
                  >
                    {/* EMAIL HEADER BANNER: LOGO & IDEAS ONLY (AS REQUESTED) */}
                    <div
                      style={{
                        background: 'linear-gradient(135deg, #BD1D2D 0%, #8C111E 100%)',
                        padding: '16px 20px',
                        color: '#ffffff'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: '1px solid rgba(255,255,255,0.2)',
                          paddingBottom: '8px',
                          marginBottom: '8px'
                        }}
                      >
                        {/* Logo Full White replaces text IDEAS */}
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <img
                            src="/Logo_IDEAS_white.png"
                            alt="IDEAS"
                            style={{
                              height: '34px',
                              width: 'auto',
                              maxWidth: '150px',
                              objectFit: 'contain',
                              filter: 'brightness(0) invert(1)',
                              display: 'block'
                            }}
                            onError={e => {
                              (e.target as HTMLImageElement).src = getTenantLogoUrl('/LOGO.webp');
                              (e.target as HTMLImageElement).style.filter = 'brightness(0) invert(1)';
                            }}
                          />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.7rem', background: 'rgba(0,0,0,0.25)', padding: '2px 7px', borderRadius: '4px', fontWeight: 600 }}>
                            {TBCD_TEMPLATE_OPTIONS.find(t => t.id === templateKey)?.shortLabel}
                          </span>
                          <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.22)', padding: '2px 7px', borderRadius: '4px', fontWeight: 700 }}>
                            {language === 'vi' ? '🇻🇳 Tiếng Việt' : '🇬🇧 English'}
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.35 }}>
                        {emailSubject}
                      </div>
                    </div>

                    {/* DIRECT EDITABLE BODY CONTAINER */}
                    <div
                      ref={previewContentRef}
                      contentEditable={true}
                      suppressContentEditableWarning={true}
                      onBlur={() => {
                        if (previewContentRef.current) {
                          setBodyHtml(previewContentRef.current.innerHTML);
                          setIsUserEdited(true);
                        }
                      }}
                      style={{
                        padding: '20px 22px',
                        fontSize: '0.86rem',
                        lineHeight: 1.65,
                        color: '#1e293b',
                        outline: 'none',
                        cursor: 'text',
                        minHeight: '360px'
                      }}
                      dangerouslySetInnerHTML={{ __html: bodyHtml }}
                    />
                  </div>
                </div>
              ) : activeTab === 'edit' ? (
                <textarea
                  className="form-input"
                  value={bodyHtml}
                  onChange={e => {
                    setBodyHtml(e.target.value);
                    setIsUserEdited(true);
                  }}
                  style={{
                    flex: 1,
                    minHeight: '440px',
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: '0.78rem',
                    lineHeight: 1.55,
                    padding: '12px'
                  }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                  <div
                    style={{
                      fontSize: '0.76rem',
                      color: '#334155',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '6px 10px'
                    }}
                  >
                    Bản tin nhắn văn bản thuần (Plain-Text) dành cho nhóm Zalo / SMS:
                  </div>
                  <textarea
                    className="form-input"
                    value={zaloText}
                    onChange={e => setZaloText(e.target.value)}
                    style={{
                      flex: 1,
                      minHeight: '400px',
                      fontSize: '0.82rem',
                      lineHeight: 1.6,
                      padding: '12px'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL FOOTER */}
        <div
          style={{
            padding: '14px 24px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {step === 1 && (
            <>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Bước 1/3: Cấu hình thông tin môn &amp; phòng học
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={handleSafeClose}
                  style={{ fontWeight: 700, fontSize: '0.82rem' }}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => setStep(2)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 20px',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    background: 'linear-gradient(135deg, #BD1D2D 0%, #8C111E 100%)',
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(189, 29, 45, 0.25)'
                  }}
                >
                  Tiếp tục: Chọn Người Nhận <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={() => setStep(1)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    color: '#334155'
                  }}
                >
                  <ChevronLeft size={16} /> Quay lại: Cấu hình môn
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={handleSafeClose}
                  style={{ fontWeight: 700, fontSize: '0.82rem' }}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleProceedToStep3}
                  disabled={finalRecipientEmails.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '9px 20px',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    background: finalRecipientEmails.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #BD1D2D 0%, #8C111E 100%)',
                    cursor: finalRecipientEmails.length === 0 ? 'not-allowed' : 'pointer',
                    borderRadius: '10px',
                    boxShadow: finalRecipientEmails.length === 0 ? 'none' : '0 4px 12px rgba(189, 29, 45, 0.25)'
                  }}
                >
                  Tiếp tục: Soạn &amp; Xem Trước ({finalRecipientEmails.length}) <ChevronRight size={16} />
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={() => {
                    navigator.clipboard.writeText(zaloText).then(() => {
                      notify('Đã sao chép nội dung tin nhắn Zalo vào Clipboard!', 'success');
                    });
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    fontSize: '0.78rem',
                    color: '#334155',
                    borderColor: '#cbd5e1'
                  }}
                >
                  <Copy size={13} />
                  Copy Bản Tin Nhắn Zalo
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  className="btn outline"
                  onClick={() => setStep(2)}
                  disabled={isSending}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 700,
                    fontSize: '0.82rem',
                    color: '#334155'
                  }}
                >
                  <ChevronLeft size={16} /> Quay lại: Chọn Người Nhận
                </button>
                <button
                  type="button"
                  className="btn outline"
                  onClick={handleSafeClose}
                  disabled={isSending}
                  style={{ fontWeight: 700, fontSize: '0.8rem' }}
                >
                  Đóng
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={handleSendAnnouncement}
                  disabled={isSending || finalRecipientEmails.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 20px',
                    fontWeight: 800,
                    fontSize: '0.84rem',
                    background: finalRecipientEmails.length === 0 ? '#94a3b8' : 'linear-gradient(135deg, #BD1D2D 0%, #8C111E 100%)',
                    cursor: finalRecipientEmails.length === 0 || isSending ? 'not-allowed' : 'pointer',
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(189, 29, 45, 0.25)'
                  }}
                >
                  {isSending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Đang gửi thông báo...
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      Gửi Thông Báo ({finalRecipientEmails.length} học viên)
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* UNSAVED CHANGES CONFIRM DIALOG */}
      {showDiscardConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 2147483647,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={e => {
            if (e.target === e.currentTarget) setShowDiscardConfirm(false);
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: '16px',
              maxWidth: '440px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#BD1D2D'
                }}
              >
                <AlertCircle size={20} />
              </div>
              <div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                  Xác nhận đóng thông báo
                </div>
                <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                  Thay đổi chưa được lưu
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.5, margin: '4px 0' }}>
              Bạn có thay đổi chưa lưu trong thông báo. Bạn có chắc chắn muốn đóng và hủy bỏ các thay đổi không?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                type="button"
                className="btn outline"
                onClick={() => setShowDiscardConfirm(false)}
                style={{ fontSize: '0.82rem', fontWeight: 600, padding: '7px 16px' }}
              >
                Hủy / Tiếp tục soạn
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  setIsUserEdited(false);
                  onClose();
                }}
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  background: '#BD1D2D',
                  borderColor: '#BD1D2D',
                  color: '#ffffff',
                  padding: '7px 16px'
                }}
              >
                Bỏ thay đổi &amp; Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
