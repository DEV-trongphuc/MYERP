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
  Calendar,
  Video,
  FileText,
  Paperclip,
  Download,
  Plus,
  Trash2,
  ExternalLink,
  GraduationCap,
  BookOpen,
  Award,
  AlertCircle,
  Clock,
  UserCheck,
  Building,
  Phone,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { API_BASE } from '../../config/env';
import { cleanSubjectNameWithoutCode } from './SubjectAnnouncementModal';
import { getCachedTenantBootstrap, getTenantOrganizationName, getTenantFrontendUrl, getTenantLogoUrl, getTenantInternalDomain } from '../../contexts/TenantConfigContext';
const getDefaultAcademicCc = () => getCachedTenantBootstrap()?.organization?.academic_cc_emails || '';
import { STANDARD_PROGRAM_NAMES, resolveCurriculumSubjects } from './StudentAcademicWorkspace';

const API_URL = API_BASE;

function buildAcademicApiUrl(rawUrl: string): string {
  const idx = rawUrl.indexOf('/academic/');
  if (idx === -1) return rawUrl;
  const base = rawUrl.slice(0, idx);
  const rest = rawUrl.slice(idx + 1);
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

export type TmgProgramKey = 'mba_umef' | 'bba_topup' | 'dba' | 'msc_ai' | 'fintech';

export interface TmgProgramOption {
  id: TmgProgramKey;
  label: string;
  shortLabel: string;
  badge: string;
  university: string;
  programInfoText: string;
  targetAudienceText: string;
}

export const TMG_PROGRAM_OPTIONS: TmgProgramOption[] = [
  {
    id: 'mba_umef',
    label: 'EMBA / MBA — Đại học Swiss UMEF (Thụy Sĩ)',
    shortLabel: 'Swiss UMEF MBA',
    badge: 'Swiss UMEF (Thụy Sĩ)',
    university: 'Swiss UMEF University (Geneva, Switzerland)',
    programInfoText:
      'Chương trình MBA/EMBA của Đại học Swiss UMEF (Thụy Sĩ) tại IDEAS là khóa học quản trị cao cấp dành riêng cho các nhà lãnh đạo, quản lý cấp cao và chủ doanh nghiệp tại Việt Nam. Với định hướng ứng dụng thực tiễn, chương trình tập trung tối ưu hóa tư duy chiến lược và năng lực điều hành trong môi trường kinh doanh toàn cầu.',
    targetAudienceText:
      'Đối tượng học viên của nhóm này là những người đã đi làm, dày dặn kinh nghiệm (trung bình từ 5-10 năm quản lý), có nền tảng kiến thức thực tế phong phú và khả năng đọc hiểu tiếng Anh chuyên ngành. Họ tham gia khóa học với mục tiêu cập nhật các xu hướng quản trị hiện đại, giải quyết các bài toán thực tế của doanh nghiệp và mở rộng mạng lưới kết nối lãnh đạo. Vì vậy, học viên mong muốn các buổi học có tính tương tác cao, tập trung vào thảo luận tình huống (case studies) và chia sẻ kinh nghiệm thực tiễn hơn là lý thuyết thuần túy.',
  },
  {
    id: 'bba_topup',
    label: 'Cử nhân Quản trị Kinh doanh — BBA / Top Up',
    shortLabel: 'BBA / Top Up',
    badge: 'BBA Quốc Tế',
    university: 'Swiss UMEF / Đối tác Quốc tế',
    programInfoText:
      'Chương trình Cử nhân Quản trị Kinh doanh (BBA / Top Up) tại IDEAS là chương trình đào tạo chuyển tiếp quốc tế, trang bị kiến thức chuyên sâu về quản trị điều hành, tài chính, marketing số và đổi mới sáng tạo.',
    targetAudienceText:
      'Học viên gồm sinh viên năm cuối và các chuyên viên trẻ đi làm mong muốn chuẩn hóa bằng cấp cử nhân quốc tế. Học viên năng động, mong muốn tiếp cận phương pháp học tập kết hợp case study và bài tập ứng dụng dự án thực chiến.',
  },
  {
    id: 'dba',
    label: 'Tiến sĩ Quản trị Kinh doanh — DBA (Seminar & Phase)',
    shortLabel: 'DBA (Tiến sĩ)',
    badge: 'NCS Tiến sĩ',
    university: 'Đại học Quốc tế / IDEAS',
    programInfoText:
      'Chương trình Tiến sĩ Quản trị Kinh doanh (DBA) dành riêng cho các chuyên gia nghiên cứu, cố vấn chiến lược và lãnh đạo cấp cao. Định hướng nghiên cứu giải quyết các thách thức kinh tế và quản trị vĩ mô.',
    targetAudienceText:
      'Nghiên cứu sinh là các nhà nghiên cứu, giảng viên đại học hoặc lãnh đạo doanh nghiệp lớn, có tư duy lý luận vững vàng. Các buổi Seminar tập trung vào phương pháp luận nghiên cứu khoa học, phân tích định lượng/định tính và hoàn thiện luận án tiến sĩ.',
  },
  {
    id: 'msc_ai',
    label: 'Thạc sĩ Trí tuệ Nhân tạo — MSc AI in Business',
    shortLabel: 'MSc AI',
    badge: 'MSc AI',
    university: 'Swiss UMEF / IDEAS',
    programInfoText:
      'Chương trình Thạc sĩ Trí tuệ Nhân tạo (MSc AI) kết hợp giữa khoa học máy tính và quản trị kinh doanh, giúp học viên ứng dụng các mô hình học máy, Generative AI và tự động hóa vào quy trình doanh nghiệp.',
    targetAudienceText:
      'Học viên là kỹ sư công nghệ, trưởng nhóm kỹ thuật, quản lý sản phẩm hoặc lãnh đạo chuyển đổi số mong muốn nắm bắt công nghệ AI mũi nhọn và dẫn dắt các dự án số hóa thực tế.',
  },
  {
    id: 'fintech',
    label: 'Thạc sĩ Tài chính Công nghệ — Master of Fintech',
    shortLabel: 'Master Fintech',
    badge: 'Fintech',
    university: 'Đối tác Quốc tế / IDEAS',
    programInfoText:
      'Chương trình Thạc sĩ Công nghệ Tài chính (Master of Fintech) đào tạo chuyên sâu về ngân hàng số, thanh toán điện tử, blockchain và an toàn thông tin tài chính.',
    targetAudienceText:
      'Học viên công tác tại ngân hàng, công ty tài chính, bảo hiểm và quỹ đầu tư, định hướng tối ưu hóa hiệu quả tài chính bằng giải pháp công nghệ hiện đại.',
  },
];

export interface ScheduleSessionItem {
  id: string;
  name: string; // "HD1", "HD2", "Buổi 1"
  dateStr: string; // "Chủ nhật, 13/09/2026"
  timeStr: string; // "8:30 - 11:30 & 13:30 - 16:30"
  mode: 'online' | 'offline';
  zoomLink: string;
  meetingId: string;
  passcode: string;
  location: string;
}

export interface LecturerInvitationModalProps {
  isOpen: boolean;
  onClose: () => void;
  subject?: any;
  allSubjects?: any[];
  campaign?: {
    id?: number | string;
    name?: string;
    project_id?: number | string;
    project_name?: string;
  } | null;
  programName?: string;
  lecturer?: {
    id?: number | string;
    name?: string;
    email?: string;
    phone?: string;
    degree_title?: string;
    teaching_subjects?: string;
  } | null;
  addToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const LecturerInvitationModal: React.FC<LecturerInvitationModalProps> = ({
  isOpen,
  onClose,
  subject,
  allSubjects = [],
  campaign,
  programName,
  lecturer,
  addToast,
}) => {
  // Detect program
  const initialProgKey = useMemo<TmgProgramKey>(() => {
    const raw = `${programName || ''} ${campaign?.name || ''} ${subject?.program_name || ''}`.toLowerCase();
    if (raw.includes('bba') || raw.includes('top up') || raw.includes('cử nhân')) return 'bba_topup';
    if (raw.includes('dba') || raw.includes('tiến sĩ') || raw.includes('seminar')) return 'dba';
    if (raw.includes('msc') || raw.includes('ai') || raw.includes('trí tuệ')) return 'msc_ai';
    if (raw.includes('fintech') || raw.includes('tài chính')) return 'fintech';
    return 'mba_umef';
  }, [programName, campaign?.name, subject?.program_name]);

  const [selectedProgramKey, setSelectedProgramKey] = useState<TmgProgramKey>(initialProgKey);

  useEffect(() => {
    setSelectedProgramKey(initialProgKey);
  }, [initialProgKey]);

  const activeProgram = useMemo(() => {
    return (
      TMG_PROGRAM_OPTIONS.find((p) => p.id === selectedProgramKey) ||
      TMG_PROGRAM_OPTIONS[0]
    );
  }, [selectedProgramKey]);

  // Lecturer state
  const [lecturerTitle, setLecturerTitle] = useState<string>('Cô');
  const [lecturerName, setLecturerName] = useState<string>(
    subject?.lecturer_name || subject?.school_lecturer || lecturer?.name || 'Dương Thị Viên An'
  );
  const [lecturerEmail, setLecturerEmail] = useState<string>(
    lecturer?.email || subject?.lecturer_email || ''
  );
  const [lecturerPhone, setLecturerPhone] = useState<string>(
    lecturer?.phone || subject?.lecturer_phone || ''
  );

  // Subject and Month/Year
  const cleanSubj = useMemo(() => {
    const raw = subject?.subject_name || subject?.name || 'Accounting for Managers';
    return cleanSubjectNameWithoutCode(raw);
  }, [subject]);

  const [subjectName, setSubjectName] = useState<string>(cleanSubj);
  useEffect(() => {
    setSubjectName(cleanSubj);
  }, [cleanSubj]);

  const defaultMonthYear = useMemo(() => {
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const mm = String(nextMonth.getMonth() + 1).padStart(2, '0');
    const yyyy = nextMonth.getFullYear();
    return `${mm}.${yyyy}`;
  }, []);

  const [batchMonthYear, setBatchMonthYear] = useState<string>('09.2026');

  // Teaching Plan deadline
  const [teachingPlanDeadline, setTeachingPlanDeadline] = useState<string>('21/08/2026');

  // Schedule sessions
  const [sessions, setSessions] = useState<ScheduleSessionItem[]>([
    {
      id: 'hd1',
      name: 'HD1',
      dateStr: 'Chủ nhật, 13/09/2026',
      timeStr: '8:30 - 11:30 & 13:30 - 16:30',
      mode: 'online',
      zoomLink: 'https://zoom.us/j/3069097520',
      meetingId: '306 909 7520',
      passcode: 'umef@812',
      location: 'Trực tuyến qua Zoom Meeting',
    },
    {
      id: 'hd2',
      name: 'HD2',
      dateStr: 'Chủ nhật, 20/09/2026',
      timeStr: '8:30 - 11:30 & 13:30 - 16:30',
      mode: 'online',
      zoomLink: 'https://zoom.us/j/3069097520',
      meetingId: '306 909 7520',
      passcode: 'umef@812',
      location: 'Trực tuyến qua Zoom Meeting',
    },
  ]);

  // Section 1 details
  const [teachingLanguage, setTeachingLanguage] = useState<string>('tiếng Việt là chủ yếu');
  const [teachingObjectives, setTeachingObjectives] = useState<string>(
    'Tập trung overview lại kiến thức của môn học mà Học viên đã được học trong các tuần (có thể nội dung sẽ hơi giống như một số buổi học của trường UMEF, Thầy/Cô có thể chọn các ví dụ thực tế khác để làm đa dạng bài giảng), hướng dẫn bài tập (Quiz/ Final exam) kết hợp mở rộng ứng dụng thực tế...'
  );
  const [teachingMaterialLink, setTeachingMaterialLink] = useState<string>(
    'https://drive.google.com/drive/folders/ideas-materials'
  );

  // Section 2 details (Contract & Remuneration)
  const [contractInstruction, setContractInstruction] = useState<string>(
    'File Hợp đồng Chuyên đề được đính kèm bên dưới, nhờ Thầy/Cô kiểm tra qua các thông tin, nếu file đã hoàn thiện, nhờ Thầy/Cô chèn chữ ký điện tử và gửi lại file Hợp đồng (có chữ ký) tại email này.'
  );
  const [remunerationNote, setRemunerationNote] = useState<string>(
    'Sau khi Lớp chuyên đề kết thúc, bộ phận Kế toán sẽ tiến hành thanh toán thù lao như các thông tin trong bản hợp đồng.'
  );

  // Section 3: Program description (synced with activeProgram or editable)
  const [programInfo, setProgramInfo] = useState<string>(activeProgram.programInfoText);
  const [targetAudience, setTargetAudience] = useState<string>(activeProgram.targetAudienceText);

  useEffect(() => {
    setProgramInfo(activeProgram.programInfoText);
    setTargetAudience(activeProgram.targetAudienceText);
  }, [activeProgram]);

  // Section 4: Academic support contact
  const [academicContactName, setAcademicContactName] = useState<string>('Huyền Trâm');
  const [academicContactZalo, setAcademicContactZalo] = useState<string>('0839901719');
  const [ccEmails, setCcEmails] = useState<string>(() => getDefaultAcademicCc());

  // Attachments
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [attachTmgDocxTemplate, setAttachTmgDocxTemplate] = useState<boolean>(true);
  const [attachTeachingPlanTemplate, setAttachTeachingPlanTemplate] = useState<boolean>(true);
  const [attachSyllabus, setAttachSyllabus] = useState<boolean>(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Email subject line computed
  const emailSubject = useMemo(() => {
    return `IDEAS_Thư mời giảng chuyên đề ${subjectName} ${batchMonthYear}`;
  }, [subjectName, batchMonthYear]);

  // Sending state & notice
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendNotice, setSendNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Handle add session
  const handleAddSession = () => {
    const nextIdx = sessions.length + 1;
    const newSession: ScheduleSessionItem = {
      id: `hd${nextIdx}`,
      name: `HD${nextIdx}`,
      dateStr: `Chủ nhật, ...`,
      timeStr: '8:30 - 11:30 & 13:30 - 16:30',
      mode: 'online',
      zoomLink: 'https://zoom.us/j/3069097520',
      meetingId: '306 909 7520',
      passcode: 'umef@812',
      location: 'Trực tuyến qua Zoom Meeting',
    };
    setSessions([...sessions, newSession]);
  };

  const handleRemoveSession = (idx: number) => {
    if (sessions.length <= 1) return;
    setSessions(sessions.filter((_, i) => i !== idx));
  };

  const handleUpdateSession = (
    idx: number,
    field: keyof ScheduleSessionItem,
    val: string
  ) => {
    setSessions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  // Generate Email HTML
  const generateEmailHtml = useCallback(() => {
    const honorific = lecturerTitle.trim();
    const gvFull = `${honorific} ${lecturerName.trim()}`;
    const honorificLower = honorific.toLowerCase();

    // Schedule rows
    const scheduleRowsHtml = sessions
      .map(
        (s) => `
        <tr>
          <td style="padding:12px 14px;border:1px solid #cbd5e1;background:#f8fafc;vertical-align:top;width:45%;">
            <div style="font-weight:700;color:#991b1b;font-size:14px;margin-bottom:4px;">${s.name}: ${s.dateStr}</div>
            <div style="font-size:13px;color:#334155;font-weight:600;">🕒 ${s.timeStr}</div>
          </td>
          <td style="padding:12px 14px;border:1px solid #cbd5e1;vertical-align:top;">
            <div style="font-weight:700;color:#0f172a;margin-bottom:4px;">${
              s.mode === 'online' ? 'Lớp học online' : 'Lớp học Offline'
            }</div>
            ${
              s.mode === 'online'
                ? `<div>Link: <a href="${s.zoomLink}" style="color:#BD1D2D;font-weight:700;text-decoration:underline;" target="_blank">Tại đây</a>.</div>
                   <div style="font-size:13px;color:#475569;margin-top:2px;">Meeting ID: <strong>${s.meetingId}</strong></div>
                   <div style="font-size:13px;color:#475569;">Passcode: <strong>${s.passcode}</strong></div>`
                : `<div style="font-size:13px;color:#475569;">Địa điểm: <strong>${s.location}</strong></div>`
            }
          </td>
        </tr>
      `
      )
      .join('');

    return `
      <div style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:720px;margin:0 auto;background:#ffffff;color:#1e293b;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.08);line-height:1.65;font-size:14px;">
        
        <!-- HEADER BRAND -->
        <div style="background:linear-gradient(135deg, #BD1D2D 0%, #8C111E 100%);padding:22px 28px;color:#ffffff;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;">
                <div style="font-size:20px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;color:#ffffff;">IDEAS</div>
                <div style="font-size:13px;opacity:0.92;margin-top:2px;color:#ffffff;">${activeProgram.university}</div>
              </td>
              <td style="text-align:right;vertical-align:middle;">
                <span style="background:rgba(255,255,255,0.18);padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;border:1px solid rgba(255,255,255,0.3);display:inline-block;">
                  ${activeProgram.badge}
                </span>
              </td>
            </tr>
          </table>
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.2);font-size:17px;font-weight:700;">
            ${emailSubject}
          </div>
        </div>

        <!-- BODY CONTENT -->
        <div style="padding:28px 30px;">
          
          <!-- SALUTATION -->
          <p style="font-size:15px;margin-top:0;margin-bottom:14px;">
            Dear <strong>${gvFull}</strong>,
          </p>

          <p style="margin-bottom:16px;">
            Như đã trao đổi thông tin trước đó, IDEAS xin phép gửi đến ${honorificLower} thư mời giảng chuyên đề <strong>${subjectName}</strong> với lịch trình như sau:
          </p>

          <!-- SCHEDULE TABLE -->
          <table style="width:100%;border-collapse:collapse;margin:18px 0;border:1px solid #cbd5e1;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#0f172a;color:#ffffff;">
                <th style="padding:10px 14px;border:1px solid #0f172a;text-align:left;font-size:13px;width:45%;">Thời gian</th>
                <th style="padding:10px 14px;border:1px solid #0f172a;text-align:left;font-size:13px;">Link zoom / Địa điểm</th>
              </tr>
            </thead>
            <tbody>
              ${scheduleRowsHtml}
            </tbody>
          </table>

          <p style="margin:16px 0;font-style:italic;color:#475569;">
            Ngoài ra, về tài liệu môn học, Hội đồng chuyên môn sẽ cung cấp và trao đổi với ${honorificLower} cùng luồng email này. (Nếu có cập nhật)
          </p>

          <!-- SECTION 1 -->
          <div style="margin:22px 0 16px 0;padding-left:14px;border-left:4px solid #BD1D2D;">
            <div style="font-size:15px;font-weight:700;color:#0f172a;">1. Cấu trúc & mục tiêu giảng dạy:</div>
          </div>
          <ul style="padding-left:22px;margin:8px 0;color:#334155;">
            <li style="margin-bottom:6px;"><strong>Về ngôn ngữ:</strong> ${teachingLanguage}.</li>
            <li style="margin-bottom:6px;"><strong>Về cấu trúc:</strong> tuân thủ theo cấu trúc được thể hiện trong Syllabus của môn học.</li>
            <li style="margin-bottom:6px;">
              <strong>Về mục tiêu giảng dạy:</strong><br/>
              ${teachingObjectives}
            </li>
            <li style="margin-bottom:6px;">
              <strong>Tài liệu môn học:</strong> <a href="${teachingMaterialLink}" style="color:#BD1D2D;font-weight:700;text-decoration:underline;" target="_blank">TẠI ĐÂY</a> và sẽ được cập nhật sớm nhất nếu như có bất kỳ điều chỉnh hay bổ sung.
            </li>
          </ul>

          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px 16px;margin:12px 0;">
            <div style="font-weight:700;color:#991b1b;margin-bottom:4px;">⚠️ Lưu ý quan trọng:</div>
            <div style="color:#7f1d1d;font-size:13.5px;line-height:1.6;">
              • ${honorific} vui lòng gửi <strong>“Teaching Plan”</strong> để Hội đồng chuyên môn IDEAS review/ trao đổi (nếu cần), nhằm quản lý nội dung, đảm bảo kiến thức được truyền tải đủ, đúng trọng tâm, không bị bỏ sót các phần quan trọng. <strong>Nhờ ${honorificLower} hỗ trợ gửi trước ${teachingPlanDeadline}</strong>.<br/>
              • Học vụ đính kèm template teaching plan để ${honorificLower} cập nhật nội dung.
            </div>
          </div>

          <!-- SECTION 2 -->
          <div style="margin:22px 0 16px 0;padding-left:14px;border-left:4px solid #BD1D2D;">
            <div style="font-size:15px;font-weight:700;color:#0f172a;">2. Hợp đồng Chuyên đề:</div>
          </div>
          <p style="margin:8px 0;color:#334155;">
            ${contractInstruction}
          </p>
          <p style="margin:8px 0;color:#334155;">
            ${remunerationNote}
          </p>

          <!-- SECTION 3 -->
          <div style="margin:22px 0 16px 0;padding-left:14px;border-left:4px solid #BD1D2D;">
            <div style="font-size:15px;font-weight:700;color:#0f172a;">3. Thông tin chương trình học:</div>
          </div>
          <p style="margin:8px 0;color:#334155;text-align:justify;">
            ${programInfo}
          </p>
          <p style="margin:8px 0;color:#334155;text-align:justify;">
            ${targetAudience}
          </p>

          <!-- SECTION 4 / FOOTER SUPPORT -->
          <div style="margin-top:24px;padding:14px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;">
            <div style="color:#334155;">
              Nếu cần thêm thông tin để củng cố bài giảng, chuẩn bị tốt cho buổi dạy, ${honorific} vui lòng phản hồi trực tiếp qua email hoặc liên hệ đội ngũ hỗ trợ qua zalo. (<strong>Liên hệ nhanh qua Zalo ${academicContactName} – ${academicContactZalo}</strong>)
            </div>
          </div>

          <!-- SIGNATURE -->
          <div style="margin-top:24px;color:#1e293b;">
            <p style="margin:0 0 4px 0;">Cảm ơn ${honorificLower},</p>
            <p style="margin:0;font-weight:700;color:#BD1D2D;font-size:15px;">Ban Học vụ — ${getTenantOrganizationName()}</p>
            <p style="margin:4px 0 0 0;font-size:12.5px;color:#64748b;">
              Email: ${getDefaultAcademicCc() || getCachedTenantBootstrap()?.organization?.support_email || ''}<br/>
              Website: <a href="${getTenantFrontendUrl()}" style="color:#BD1D2D;text-decoration:none;">${getTenantFrontendUrl()}</a>
            </p>
          </div>

          <!-- ATTACHMENT LIST SUMMARY -->
          <div style="margin-top:24px;padding-top:16px;border-top:1px dashed #cbd5e1;">
            <div style="font-size:12.5px;font-weight:700;color:#475569;text-transform:uppercase;margin-bottom:8px;">
              📎 Danh mục hồ sơ & tài liệu đính kèm:
            </div>
            <div style="font-size:13px;color:#334155;">
              ${attachTmgDocxTemplate ? '<div>1. File Hợp đồng Giảng dạy Chuyên đề (TMG)</div>' : ''}
              ${attachTeachingPlanTemplate ? '<div>2. Mẫu Template Teaching Plan chuẩn IDEAS</div>' : ''}
              ${attachSyllabus ? `<div>3. Syllabus & Hướng dẫn Đánh giá học phần ${subjectName}</div>` : ''}
              ${attachedFiles.map((f, i) => `<div>${i + 4}. ${f.name} (${(f.size / 1024).toFixed(1)} KB)</div>`).join('')}
            </div>
          </div>

        </div>
      </div>
    `;
  }, [
    lecturerTitle,
    lecturerName,
    activeProgram,
    emailSubject,
    subjectName,
    sessions,
    teachingLanguage,
    teachingObjectives,
    teachingMaterialLink,
    teachingPlanDeadline,
    contractInstruction,
    remunerationNote,
    programInfo,
    targetAudience,
    academicContactName,
    academicContactZalo,
    attachTmgDocxTemplate,
    attachTeachingPlanTemplate,
    attachSyllabus,
    attachedFiles,
  ]);

  // Export as Word-compatible .doc file
  const handleDownloadDoc = () => {
    const htmlContent = generateEmailHtml();
    const docHtml = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${emailSubject}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #333333; padding: 6px 10px; }
          .header-brand { background: #BD1D2D; color: #ffffff; padding: 15px; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff' + docHtml], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const safeName = `TMG_${subjectName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${lecturerName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${batchMonthYear}.doc`;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    if (addToast) addToast(`Đã xuất file Word: ${safeName}`, 'success');
  };

  // Download official docx template
  const handleDownloadOriginalDocx = () => {
    const link = document.createElement('a');
    link.href = '/templates/Mau_Thu_Moi_Giang_TMG_IDEAS.docx';
    link.download = `Mau_Thu_Moi_Giang_TMG_IDEAS.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (addToast) addToast('Đang tải file mẫu gốc TMG DOCX chuẩn...', 'info');
  };

  // Copy HTML
  const handleCopyHtml = async () => {
    try {
      await navigator.clipboard.writeText(generateEmailHtml());
      setCopiedType('html');
      setTimeout(() => setCopiedType(null), 2500);
      if (addToast) addToast('Đã sao chép toàn bộ HTML Email vào Clipboard.', 'success');
    } catch {
      // fallback
    }
  };

  // Send Email via API
  const handleSendEmail = async () => {
    if (!lecturerEmail.trim()) {
      setSendNotice({
        type: 'error',
        text: 'Vui lòng nhập địa chỉ Email của Giảng viên để gửi thư mời.',
      });
      return;
    }

    setIsSending(true);
    setSendNotice(null);

    try {
      const companyId = Number(subject?.lecturer_id || lecturer?.id || 0);
      const fd = new FormData();
      fd.append('to_email', lecturerEmail.trim());
      fd.append('cc_emails', ccEmails.trim());
      fd.append('subject', emailSubject);
      fd.append('body_html', generateEmailHtml());
      fd.append('template_type', 'tmg_lecturer_invitation');
      fd.append('course_name', activeProgram.label);
      fd.append('subject_name', subjectName);
      fd.append('lecturer_name', `${lecturerTitle} ${lecturerName}`);

      // Add attached files
      attachedFiles.forEach((f) => {
        fd.append('attachments[]', f);
      });

      // If user checked template TMG DOCX, we can fetch public/templates/Mau_Thu_Moi_Giang_TMG_IDEAS.docx and append as Blob
      if (attachTmgDocxTemplate) {
        try {
          const docRes = await fetch('/templates/Mau_Thu_Moi_Giang_TMG_IDEAS.docx');
          if (docRes.ok) {
            const docBlob = await docRes.blob();
            const docFile = new File(
              [docBlob],
              `TMG_${subjectName.replace(/\s+/g, '_')}_${batchMonthYear}.docx`,
              {
                type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              }
            );
            fd.append('attachments[]', docFile);
          }
        } catch (eDoc) {
          console.warn('Could not auto-attach local TMG template:', eDoc);
        }
      }

      const res = await apiFetch(
        `${API_URL}/academic/lecturer/${companyId}/send-invitation-email`,
        {
          method: 'POST',
          body: fd,
        }
      );
      const json = await res.json();

      if (json.success) {
        setSendNotice({
          type: 'success',
          text:
            json.message ||
            `Đã gửi thành công Thư mời giảng & Hợp đồng tới ${lecturerEmail} (CC Học vụ: ${ccEmails}).`,
        });
        if (addToast) {
          addToast(
            `Đã gửi Thư mời giảng chuyên đề ${subjectName} tới GV ${lecturerName} thành công.`,
            'success'
          );
        }
      } else {
        setSendNotice({
          type: 'error',
          text: json.message || 'Không thể gửi email mời giảng. Vui lòng thử lại.',
        });
      }
    } catch (err: any) {
      setSendNotice({
        type: 'error',
        text: err?.message || 'Lỗi kết nối máy chủ khi gửi email mời giảng.',
      });
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="lecturer-invitation-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: 'rgba(15, 23, 42, 0.68)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1320px',
          maxHeight: '94vh',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* HEADER */}
        <div
          style={{
            padding: '16px 20px',
            background: '#BD1D2D',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <img
              src="/Logo_IDEAS_white.png"
              alt="IDEAS"
              style={{
                height: '32px',
                width: 'auto',
                maxWidth: '140px',
                objectFit: 'contain',
                filter: 'brightness(0) invert(1)',
                display: 'block',
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).src = getTenantLogoUrl('/LOGO.webp');
                (e.target as HTMLImageElement).style.filter = 'brightness(0) invert(1)';
              }}
            />
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.25)', paddingLeft: '14px' }}>
              <div style={{ fontSize: '15px', fontWeight: 800, letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>THƯ MỜI GIẢNG CHUYÊN ĐỀ & HỢP ĐỒNG GIẢNG DẠY (TMG)</span>
                <span
                  style={{
                    background: 'rgba(255,255,255,0.2)',
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 700,
                  }}
                >
                  DOCX Mẫu Chuẩn IDEAS
                </span>
              </div>
              <div style={{ fontSize: '12px', opacity: 0.88 }}>
                Áp dụng cho Giảng viên hướng dẫn môn học, đính kèm Teaching Plan & Hợp đồng dịch vụ đào tạo
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleDownloadOriginalDocx}
              style={{
                background: 'rgba(255,255,255,0.15)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
              title="Tải về file Word mẫu gốc TMG DOCX"
            >
              <Download className="w-3.5 h-3.5 text-amber-300" />
              <span>Tải Mẫu Gốc (DOCX)</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                color: '#ffffff',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PROGRAM SELECTOR PILLS */}
        <div
          style={{
            padding: '10px 22px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflowX: 'auto',
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>
            Chương trình đào tạo:
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            {TMG_PROGRAM_OPTIONS.map((prog) => {
              const active = prog.id === selectedProgramKey;
              return (
                <button
                  key={prog.id}
                  type="button"
                  onClick={() => setSelectedProgramKey(prog.id)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: active ? 700 : 600,
                    border: active ? '1px solid #BD1D2D' : '1px solid #cbd5e1',
                    background: active ? '#fef2f2' : '#ffffff',
                    color: active ? '#BD1D2D' : '#475569',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                    boxShadow: active ? '0 1px 3px rgba(189,29,45,0.1)' : 'none',
                  }}
                >
                  {prog.shortLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* MAIN 2-COLUMN WORKSPACE */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: '50% 50%',
            overflow: 'hidden',
          }}
        >
          {/* LEFT COLUMN: EDIT FORM */}
          <div
            style={{
              padding: '20px 22px',
              overflowY: 'auto',
              borderRight: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* LECTURER & SUBJECT OVERVIEW CARD */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#BD1D2D', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GraduationCap className="w-4 h-4" />
                <span>1. Thông tin Giảng viên & Môn học</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Danh xưng
                  </label>
                  <select
                    value={lecturerTitle}
                    onChange={(e) => setLecturerTitle(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '7px 8px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      background: '#ffffff',
                      color: '#0f172a',
                    }}
                  >
                    <option value="Cô">Cô</option>
                    <option value="Thầy">Thầy</option>
                    <option value="TS.">TS.</option>
                    <option value="PGS.TS.">PGS.TS.</option>
                    <option value="GS.TS.">GS.TS.</option>
                    <option value="ThS.">ThS.</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Họ và tên Giảng viên
                  </label>
                  <input
                    type="text"
                    value={lecturerName}
                    onChange={(e) => setLecturerName(e.target.value)}
                    placeholder="VD: Dương Thị Viên An"
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#0f172a',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Email Giảng viên (To Email) *
                  </label>
                  <input
                    type="email"
                    value={lecturerEmail}
                    onChange={(e) => setLecturerEmail(e.target.value)}
                    placeholder={`giangvien@${getTenantInternalDomain() || 'university.edu'}`}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    SĐT / Zalo Giảng viên
                  </label>
                  <input
                    type="text"
                    value={lecturerPhone}
                    onChange={(e) => setLecturerPhone(e.target.value)}
                    placeholder="VD: 0909123456"
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      color: '#0f172a',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Tên Môn học / Chuyên đề
                  </label>
                  <input
                    type="text"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="VD: Accounting for Managers"
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 700,
                      color: '#0f172a',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Tháng / Đợt (MM.YYYY)
                  </label>
                  <input
                    type="text"
                    value={batchMonthYear}
                    onChange={(e) => setBatchMonthYear(e.target.value)}
                    placeholder="VD: 09.2026"
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 600,
                      textAlign: 'center',
                      color: '#0f172a',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* SCHEDULE BUILDER CARD */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#BD1D2D', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Calendar className="w-4 h-4" />
                  <span>2. Bảng Lịch trình Giảng dạy (HD1, HD2...)</span>
                </div>
                <button
                  type="button"
                  onClick={handleAddSession}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#0f172a',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Plus className="w-3 h-3 text-[#BD1D2D]" />
                  <span>Thêm buổi</span>
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {sessions.map((s, idx) => (
                  <div
                    key={s.id || idx}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      background: '#f8fafc',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 800, color: '#991b1b', fontSize: '13px' }}>
                        Buổi {s.name}
                      </span>
                      {sessions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveSession(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            padding: '2px',
                          }}
                          title="Xóa buổi này"
                        >
                          <Trash2 className="w-3.5 h-3.5 hover:text-red-600" />
                        </button>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px' }}>
                          Ngày giảng dạy
                        </label>
                        <input
                          type="text"
                          value={s.dateStr}
                          onChange={(e) => handleUpdateSession(idx, 'dateStr', e.target.value)}
                          placeholder="VD: Chủ nhật, 13/09/2026"
                          style={{
                            width: '100%',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            fontWeight: 600,
                            background: '#ffffff',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px' }}>
                          Khung giờ giảng dạy
                        </label>
                        <input
                          type="text"
                          value={s.timeStr}
                          onChange={(e) => handleUpdateSession(idx, 'timeStr', e.target.value)}
                          placeholder="8:30 - 11:30 & 13:30 - 16:30"
                          style={{
                            width: '100%',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            background: '#ffffff',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div>
                        <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px' }}>
                          Zoom Meeting ID
                        </label>
                        <input
                          type="text"
                          value={s.meetingId}
                          onChange={(e) => handleUpdateSession(idx, 'meetingId', e.target.value)}
                          placeholder="306 909 7520"
                          style={{
                            width: '100%',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            background: '#ffffff',
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10.5px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '2px' }}>
                          Passcode Zoom
                        </label>
                        <input
                          type="text"
                          value={s.passcode}
                          onChange={(e) => handleUpdateSession(idx, 'passcode', e.target.value)}
                          placeholder="umef@812"
                          style={{
                            width: '100%',
                            padding: '5px 8px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12px',
                            background: '#ffffff',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TEACHING DETAILS & DEADLINE CARD */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#BD1D2D', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen className="w-4 h-4" />
                <span>3. Cấu trúc, Mục tiêu & Teaching Plan</span>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  Ngôn ngữ giảng dạy
                </label>
                <input
                  type="text"
                  value={teachingLanguage}
                  onChange={(e) => setTeachingLanguage(e.target.value)}
                  placeholder="tiếng Việt là chủ yếu"
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#0f172a',
                  }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  Mục tiêu giảng dạy chuyên đề
                </label>
                <textarea
                  rows={3}
                  value={teachingObjectives}
                  onChange={(e) => setTeachingObjectives(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    lineHeight: 1.5,
                    color: '#0f172a',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                    Link Drive Tài liệu môn học (TẠI ĐÂY)
                  </label>
                  <input
                    type="text"
                    value={teachingMaterialLink}
                    onChange={(e) => setTeachingMaterialLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      color: '#0f172a',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', display: 'block', marginBottom: '4px' }}>
                    Hạn gửi Teaching Plan
                  </label>
                  <input
                    type="text"
                    value={teachingPlanDeadline}
                    onChange={(e) => setTeachingPlanDeadline(e.target.value)}
                    placeholder="21/08/2026"
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: '8px',
                      border: '1px solid #f87171',
                      background: '#fff5f5',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#991b1b',
                      textAlign: 'center',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ATTACHMENTS & CONTRACT CARD */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#BD1D2D', textTransform: 'uppercase', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Paperclip className="w-4 h-4" />
                <span>4. Đính kèm Hợp đồng & Tài liệu</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#0f172a', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={attachTmgDocxTemplate}
                    onChange={(e) => setAttachTmgDocxTemplate(e.target.checked)}
                    style={{ accentColor: '#BD1D2D', width: '15px', height: '15px' }}
                  />
                  <span>Đính kèm <strong>File Hợp đồng Mời giảng (TMG_*.docx)</strong></span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#0f172a', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={attachTeachingPlanTemplate}
                    onChange={(e) => setAttachTeachingPlanTemplate(e.target.checked)}
                    style={{ accentColor: '#BD1D2D', width: '15px', height: '15px' }}
                  />
                  <span>Đính kèm <strong>Mẫu Template Teaching Plan IDEAS</strong></span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px', color: '#0f172a', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={attachSyllabus}
                    onChange={(e) => setAttachSyllabus(e.target.checked)}
                    style={{ accentColor: '#BD1D2D', width: '15px', height: '15px' }}
                  />
                  <span>Ghi chú đính kèm <strong>Syllabus Môn học</strong></span>
                </label>
              </div>

              {/* Upload extra local files */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files);
                      setAttachedFiles((prev) => [...prev, ...newFiles]);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#475569',
                    width: '100%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Plus className="w-4 h-4 text-[#BD1D2D]" />
                  <span>Tải thêm file đính kèm từ máy tính (DOCX / PDF / Excel)...</span>
                </button>

                {attachedFiles.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {attachedFiles.map((file, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '4px 8px',
                          background: '#f1f5f9',
                          borderRadius: '6px',
                          fontSize: '11.5px',
                        }}
                      >
                        <span style={{ color: '#0f172a', fontWeight: 600 }}>{file.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ color: '#64748b' }}>{(file.size / 1024).toFixed(1)} KB</span>
                          <button
                            type="button"
                            onClick={() => setAttachedFiles(attachedFiles.filter((_, idx) => idx !== i))}
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                          >
                            <Trash2 className="w-3.5 h-3.5 hover:text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RECIPIENTS & CC CARD */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#BD1D2D', textTransform: 'uppercase', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Mail className="w-4 h-4" />
                <span>5. Cấu hình gửi Email & CC Học vụ</span>
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '4px' }}>
                  CC Bộ phận Học vụ & IT Lớp học
                </label>
                <input
                  type="text"
                  value={ccEmails}
                  onChange={(e) => setCcEmails(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '11.5px',
                    color: '#0f172a',
                  }}
                />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: LIVE HTML EMAIL PREVIEW */}
          <div
            style={{
              padding: '20px 22px',
              overflowY: 'auto',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} strokeWidth={1.75} color="#BD1D2D" />
                <span>Bản xem trước Email (Live WYSIWYG)</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={handleCopyHtml}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: copiedType === 'html' ? '#16a34a' : '#475569',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {copiedType === 'html' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                      <span>Đã chép HTML</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép HTML</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* PREVIEW CONTAINER */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
                overflowX: 'auto',
              }}
              dangerouslySetInnerHTML={{ __html: generateEmailHtml() }}
            />
          </div>
        </div>

        {/* FOOTER ACTIONS */}
        <div
          style={{
            padding: '12px 22px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={handleDownloadDoc}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                color: '#1e293b',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              }}
              title="Xuất nội dung thư và hợp đồng thành file Word (.doc)"
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Xuất File Word (.doc)</span>
            </button>

            {sendNotice && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  color: sendNotice.type === 'success' ? '#16a34a' : '#dc2626',
                  background: sendNotice.type === 'success' ? '#f0fdf4' : '#fef2f2',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${sendNotice.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
                }}
              >
                {sendNotice.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <AlertCircle className="w-4 h-4" />
                )}
                <span>{sendNotice.text}</span>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#475569',
                cursor: 'pointer',
              }}
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={isSending}
              onClick={handleSendEmail}
              style={{
                background: isSending ? '#94a3b8' : '#BD1D2D',
                border: 'none',
                color: '#ffffff',
                padding: '8px 20px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isSending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background-color 0.16s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang gửi thư mời & hợp đồng...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Gửi Thư Mời Giảng & Hợp Đồng</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
