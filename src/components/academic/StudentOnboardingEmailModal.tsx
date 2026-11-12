import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Mail,
  Send,
  Copy,
  Check,
  Sparkles,
  GraduationCap,
  X,
  Eye,
  Pencil,
  MessageSquare,
  Loader2,
  Users
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../api/axios';

export interface StudentOnboardingEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedStudent?: {
    id?: number | string;
    full_name?: string;
    email?: string;
    phone?: string;
    program?: string;
    project_id?: number | string;
  } | null;
  studentsList?: any[];
  addToast?: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  onSuccess?: () => void;
}

export const ACADEMIC_PROGRAM_OPTIONS = [
  {
    id: 'istec',
    label: 'Trường Kinh doanh ISTEC - Pháp (BBA / MBA / DBA ISTEC)',
    school: 'istec',
    docLink: 'https://drive.google.com/drive/folders/1ZNcaYWUSd79CbLRDpV0LjbRAPeTCnumO?usp=drive_link'
  },
  {
    id: 'estiam',
    label: 'Tiến sĩ Quản trị Kinh doanh - Paris Education / ESTIAM (DBA ESTIAM)',
    school: 'estiam',
    docLink: 'https://drive.google.com/drive/folders/1tBzBTLL9WPT-OOjKWRNz5qFx8YGSptKG?usp=drive_link'
  },
  {
    id: 'msc_ai',
    label: 'Thạc sĩ Khoa học Trí tuệ nhân tạo (MSc AI)',
    school: 'umef',
    docLink: 'https://drive.google.com/drive/folders/1Byi7lmVQsm9sSD-OGKSHli1FfsnsvkXr'
  },
  {
    id: 'mba_standard',
    label: 'Thạc sĩ Quản trị Kinh doanh - Tiêu chuẩn (MBA / EMBA Standard)',
    school: 'umef',
    docLink: 'https://drive.google.com/drive/folders/1dvILnySA3MWKR-LutdrdXyrJPqL6ppcy'
  },
  {
    id: 'bba',
    label: 'Cử nhân Quản trị Kinh doanh (TOP UP)',
    school: 'umef',
    docLink: 'https://drive.google.com/drive/folders/1E1TZMRz5w05xv4wsNvP5vht3ojHeviAw'
  },
  {
    id: 'mba_high',
    label: 'Thạc sĩ Quản trị Kinh doanh - Nâng cao (MBA / EMBA High)',
    school: 'umef',
    docLink: 'https://drive.google.com/drive/folders/1FAJL1opSbPEOx9CL1L1QMiug3mfRdRWX'
  }
];

export const detectAcademicProgram = (programStr: string): string => {
  const p = (programStr || '').trim().toLowerCase();
  if (p.includes('istec')) return 'istec';
  if (p.includes('estiam') || p.includes('paris education') || p.includes('dual dba') || p === 'de') return 'estiam';
  if (p.includes('ai') || p.includes('msc') || p.includes('trí tuệ') || p.includes('tri tue')) return 'msc_ai';
  if (p.includes('top up') || p.includes('topup') || p.includes('bba') || p.includes('cử nhân') || p.includes('cu nhan') || p.includes('bachelor')) return 'bba';
  if (p.includes('high') || p.includes('nâng cao') || p.includes('nang cao') || p.includes('hq')) return 'mba_high';
  return 'mba_standard';
};

export const getAcademicEmailDefaultSubject = (programKey: string = 'mba_standard'): string => {
  if (programKey === 'istec') {
    return '[IDEAS] Thông báo Tiếp nhận học viên & Hướng dẫn học tập - Istec Business School';
  }
  if (programKey === 'estiam') {
    return '[IDEAS] Thông báo Tiếp nhận học viên & Hướng dẫn học tập - Paris Education/ESTIAM';
  }
  return '[IDEAS] Thông báo Tiếp nhận học viên & Hướng dẫn học tập - Swiss UMEF';
};

export const getAcademicEmailDefaultContent = (studentName: string, programKey: string = 'mba_standard'): string => {
  const greeting = studentName ? `Kính gửi Quý Anh/Chị học viên <strong>${studentName}</strong>,` : 'Kính gửi Quý Anh/Chị học viên,';
  const selectedProg = ACADEMIC_PROGRAM_OPTIONS.find(opt => opt.id === programKey) || ACADEMIC_PROGRAM_OPTIONS[3];
  const docFolderLink = selectedProg.docLink;

  if (programKey === 'istec') {
    return `<p>${greeting}</p>
<p>Lời đầu tiên, Ban Công tác Sinh viên IDEAS xin gửi lời chúc mừng và trân trọng cảm ơn Anh/Chị đã tin chọn IDEAS làm người bạn đồng hành trên chặng đường chinh phục tấm bằng từ <strong>Istec Business School</strong>. Chúng tôi cam kết đồng hành và hỗ trợ Anh/Chị xuyên suốt quá trình học tập.</p>

<p><strong style="color: #BD1D2D; font-size: 15px;">A. KÊNH LIÊN LẠC CHÍNH THỨC</strong></p>
<p>1. <strong>Kênh Hỗ trợ Nhanh (Zalo/Hotline):</strong> 098 736 3935<br/>
2. <strong>Kênh Hỗ trợ Học vụ (Email):</strong><br/>
&nbsp;&nbsp;&bull; Tiếp nhận yêu cầu: <a href="mailto:support@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">support@ideas.edu.vn</a><br/>
&nbsp;&nbsp;&bull; CC (Đồng gửi): <a href="mailto:it.dept@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">it.dept@ideas.edu.vn</a>, <a href="mailto:student.notice@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">student.notice@ideas.edu.vn</a>, <a href="mailto:support@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">support@ideas.edu.vn</a> <em>(Vui lòng luôn CC các địa chỉ này để hệ thống ghi nhận và xử lý nhanh nhất)</em></p>

<p><strong style="color: #BD1D2D; font-size: 15px;">B. TÀI KHOẢN HỌC TẬP</strong></p>
<p>Anh/Chị sẽ được cấp 3 tài khoản học tập, sử dụng xuyên suốt chương trình:</p>
<ul style="padding-left: 20px; line-height: 1.8;">
  <li><strong>1. Tài khoản LMS IDEAS</strong> (xem tài liệu, video buổi học, hỗ trợ học thuật): <a href="https://lms.ideas.edu.vn/" target="_blank" rel="noreferrer" style="color: #BD1D2D;">https://lms.ideas.edu.vn/</a> | Video hướng dẫn: <a href="https://drive.google.com/file/d/1wXQtghJSd7CHoek_hPXOfXuVuGuT8bMv/view?usp=sharing" target="_blank" rel="noreferrer" style="color: #BD1D2D; font-weight: 600;">LINK tại đây</a></li>
  <li><strong>2. Tài khoản LMS ISTEC</strong> (làm bài, nộp bài, tính điểm chính thức): <a href="https://istec.education" target="_blank" rel="noreferrer" style="color: #BD1D2D;">https://istec.education</a></li>
  <li><strong>3. Platform IDEAS AI</strong> (công cụ bổ trợ học tập): <a href="https://ai.ideas.edu.vn/" target="_blank" rel="noreferrer" style="color: #BD1D2D;">https://ai.ideas.edu.vn/</a></li>
</ul>
<p><em>(thông tin tài khoản sẽ được gửi trực tiếp đến email cá nhân của học viên đã đăng ký học tập)</em></p>

<p><strong style="color: #BD1D2D; font-size: 15px;">C. TÀI LIỆU ĐÍNH KÈM</strong></p>
<ul style="padding-left: 20px; line-height: 1.8;">
  <li>File giải thích Format APA</li>
  <li>File hướng dẫn sử dụng các hệ thống học tập</li>
  <li>Hướng dẫn sử dụng Zoom Meeting &amp; Format bài làm mẫu</li>
</ul>
<p>Link tổng hợp tài liệu hướng dẫn: <a href="${docFolderLink}" target="_blank" rel="noreferrer" style="color: #BD1D2D; font-weight: 600;">LINK tại đây</a></p>

<p>Nếu có bất kỳ vướng mắc nào, Anh/Chị vui lòng liên hệ CTSV để được hỗ trợ kịp thời. Chúc Anh/Chị có hành trình học tập thật thuận lợi và thành công!</p>

<p style="margin-top: 20px;">Trân trọng,<br/><strong>Ban Công tác Sinh viên IDEAS</strong></p>`;
  }

  if (programKey === 'estiam') {
    return `<p>${greeting}</p>
<p>Lời đầu tiên, Ban Công tác Sinh viên IDEAS xin gửi lời chúc mừng và trân trọng cảm ơn Anh/Chị đã tin chọn IDEAS làm người bạn đồng hành trên chặng đường chinh phục tấm bằng từ <strong>Paris Education/ESTIAM</strong>. Chúng tôi cam kết đồng hành và hỗ trợ Anh/Chị xuyên suốt quá trình học tập và nghiên cứu.</p>

<p><strong style="color: #BD1D2D; font-size: 15px;">A. KÊNH LIÊN LẠC CHÍNH THỨC</strong></p>
<p>1. <strong>Kênh Hỗ trợ Nhanh (Zalo/Hotline):</strong> 098 736 3935<br/>
2. <strong>Kênh Hỗ trợ Học vụ (Email):</strong><br/>
&nbsp;&nbsp;&bull; Tiếp nhận yêu cầu: <a href="mailto:support@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">support@ideas.edu.vn</a><br/>
&nbsp;&nbsp;&bull; CC (Đồng gửi): <a href="mailto:it.dept@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">it.dept@ideas.edu.vn</a>, <a href="mailto:student.notice@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">student.notice@ideas.edu.vn</a>, <a href="mailto:support@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">support@ideas.edu.vn</a> <em>(Vui lòng luôn CC các địa chỉ này để hệ thống ghi nhận và xử lý nhanh nhất)</em></p>

<p><strong style="color: #BD1D2D; font-size: 15px;">B. TÀI KHOẢN HỌC TẬP</strong></p>
<p>Anh/Chị sẽ được cấp 3 tài khoản học tập, sử dụng xuyên suốt chương trình:</p>
<ul style="padding-left: 20px; line-height: 1.8;">
  <li><strong>1. Tài khoản LMS IDEAS</strong> (xem tài liệu, video record buổi học, hỗ trợ học thuật): <a href="https://lms.ideas.edu.vn/" target="_blank" rel="noreferrer" style="color: #BD1D2D;">https://lms.ideas.edu.vn/</a> | Video hướng dẫn: <a href="https://drive.google.com/file/d/1wXQtghJSd7CHoek_hPXOfXuVuGuT8bMv/view?usp=sharing" target="_blank" rel="noreferrer" style="color: #BD1D2D; font-weight: 600;">LINK tại đây</a></li>
  <li><strong>2. Tài khoản học tập Paris Education</strong> (làm bài, nộp bài chính thức): <a href="https://pariseducation-global.org/" target="_blank" rel="noreferrer" style="color: #BD1D2D;">https://pariseducation-global.org/</a></li>
  <li><strong>3. Platform IDEAS AI</strong> (công cụ bổ trợ học tập): <a href="https://ai.ideas.edu.vn/" target="_blank" rel="noreferrer" style="color: #BD1D2D;">https://ai.ideas.edu.vn/</a></li>
</ul>
<p><em>(thông tin tài khoản sẽ được gửi trực tiếp đến email cá nhân của học viên đã đăng ký học tập)</em></p>

<p><strong style="color: #BD1D2D; font-size: 15px;">C. TÀI LIỆU ĐÍNH KÈM</strong></p>
<ul style="padding-left: 20px; line-height: 1.8;">
  <li>File Template format APA</li>
  <li>File hướng dẫn sử dụng các hệ thống học tập</li>
</ul>
<p>Link tổng hợp tài liệu hướng dẫn: <a href="${docFolderLink}" target="_blank" rel="noreferrer" style="color: #BD1D2D; font-weight: 600;">LINK tại đây</a></p>

<p>Nếu có bất kỳ vướng mắc nào, Anh/Chị vui lòng liên hệ CTSV để được hỗ trợ kịp thời. Chúc Anh/Chị có hành trình học tập, nghiên cứu thật thuận lợi và thành công!</p>

<p style="margin-top: 20px;">Trân trọng,<br/><strong>Ban Công tác Sinh viên IDEAS</strong></p>`;
  }

  return `<p>${greeting}</p>
<p>Lời đầu tiên, Ban Công tác Sinh viên IDEAS xin gửi lời chúc mừng và trân trọng cảm ơn Anh/Chị đã tin chọn IDEAS làm người bạn đồng hành trên chặng đường chinh phục tấm bằng từ <strong>Đại học Swiss UMEF</strong>. Chúng tôi cam kết đồng hành và hỗ trợ Anh/Chị xuyên suốt quá trình học tập.</p>

<p><strong style="color: #BD1D2D; font-size: 15px;">A. KÊNH LIÊN LẠC CHÍNH THỨC</strong></p>
<p>1. <strong>Kênh Hỗ trợ Nhanh (Zalo/Hotline):</strong> 098 736 3935<br/>
2. <strong>Kênh Hỗ trợ Học vụ (Email):</strong><br/>
&nbsp;&nbsp;&bull; Tiếp nhận yêu cầu: <a href="mailto:support@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">support@ideas.edu.vn</a><br/>
&nbsp;&nbsp;&bull; CC (Đồng gửi): <a href="mailto:it.dept@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">it.dept@ideas.edu.vn</a>, <a href="mailto:student.notice@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">student.notice@ideas.edu.vn</a>, <a href="mailto:support@ideas.edu.vn" style="color: #BD1D2D; font-weight: 600;">support@ideas.edu.vn</a> <em>(Vui lòng luôn CC các địa chỉ này để hệ thống ghi nhận và xử lý nhanh nhất)</em></p>

<p><strong style="color: #BD1D2D; font-size: 15px;">B. TÀI KHOẢN HỌC TẬP</strong></p>
<p>Anh/Chị sẽ được cấp 3 tài khoản học tập, sử dụng xuyên suốt chương trình:</p>
<ul style="padding-left: 20px; line-height: 1.8;">
  <li><strong>1. Tài khoản LMS IDEAS</strong> (xem tài liệu, video buổi học, hỗ trợ học thuật): <a href="https://lms.ideas.edu.vn/" target="_blank" rel="noreferrer" style="color: #BD1D2D;">https://lms.ideas.edu.vn/</a> | Video hướng dẫn: <a href="https://drive.google.com/file/d/1wXQtghJSd7CHoek_hPXOfXuVuGuT8bMv/view?usp=sharing" target="_blank" rel="noreferrer" style="color: #BD1D2D; font-weight: 600;">LINK tại đây</a></li>
  <li><strong>2. Tài khoản LMS UMEF</strong> (làm bài, nộp bài, tính điểm chính thức): <a href="https://portal.swiss-umef.ch/" target="_blank" rel="noreferrer" style="color: #BD1D2D;">https://portal.swiss-umef.ch/</a></li>
  <li><strong>3. Platform IDEAS AI</strong> (công cụ bổ trợ học tập): <a href="https://ai.ideas.edu.vn/" target="_blank" rel="noreferrer" style="color: #BD1D2D;">https://ai.ideas.edu.vn/</a></li>
</ul>
<p><em>(thông tin tài khoản sẽ được gửi trực tiếp đến email cá nhân của học viên đã đăng ký học tập)</em></p>

<p><strong style="color: #BD1D2D; font-size: 15px;">C. TÀI LIỆU ĐÍNH KÈM</strong></p>
<ul style="padding-left: 20px; line-height: 1.8;">
  <li>File giải thích Format APA</li>
  <li>File hướng dẫn sử dụng các hệ thống học tập</li>
  <li>Hướng dẫn sử dụng Zoom Meeting &amp; Format bài làm mẫu</li>
</ul>
<p>Link tổng hợp tài liệu hướng dẫn: <a href="${docFolderLink}" target="_blank" rel="noreferrer" style="color: #BD1D2D; font-weight: 600;">LINK tại đây</a></p>

<p>Nếu có bất kỳ vướng mắc nào, Anh/Chị vui lòng liên hệ CTSV để được hỗ trợ kịp thời. Chúc Anh/Chị có hành trình học tập thật thuận lợi và thành công!</p>

<p style="margin-top: 20px;">Trân trọng,<br/><strong>Ban Công tác Sinh viên IDEAS</strong></p>`;
};

export const DEFAULT_ACADEMIC_CC_EMAILS = 'it.dept@ideas.edu.vn, student.notice@ideas.edu.vn, support@ideas.edu.vn';

export const StudentOnboardingEmailModal: React.FC<StudentOnboardingEmailModalProps> = ({
  isOpen,
  onClose,
  preselectedStudent = null,
  studentsList = [],
  addToast,
  onSuccess
}) => {
  const { user: currentUser } = useAuth();
  const [selectedStudentId, setSelectedStudentId] = useState<number | string>(preselectedStudent?.id || '');
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  const [activeTab, setActiveTab] = useState<'preview' | 'edit' | 'zalo'>('preview');
  const [academicProgram, setAcademicProgram] = useState('mba_standard');
  const [isSending, setIsSending] = useState(false);
  const [copiedZalo, setCopiedZalo] = useState(false);

  const [emailForm, setEmailForm] = useState({
    recipient_name: '',
    to_email: '',
    cc_email: DEFAULT_ACADEMIC_CC_EMAILS,
    subject: getAcademicEmailDefaultSubject('mba_standard'),
    content: '',
    zalo_text: ''
  });

  const getAcademicZaloOnboardingText = useCallback(
    (studentName: string) => {
      const nameStr = studentName ? `Anh/Chị ${studentName}` : 'Anh/Chị';
      const ctsvName = (currentUser?.full_name || currentUser?.name || 'Chuyên viên CTSV').trim();
      return `Chào ${nameStr}, Em là ${ctsvName} từ Bộ phận Công tác Sinh viên (CTSV) của IDEAS.
Chào mừng Anh/Chị chính thức trở thành Tân Học viên chương trình tại IDEAS. Em xin phép kết nối Zalo để đồng hành và hỗ trợ mình sát sao nhất trong suốt khóa học ạ!
Để bắt đầu hành trình học tập thuận lợi, Anh/Chị lưu ý giúp em các thông tin quan trọng sau nhé:
1. Kênh tiếp nhận hỗ trợ học vụ: support@ideas.edu.vn (CC: it.dept@ideas.edu.vn, student.notice@ideas.edu.vn).
2. Tài khoản học tập và link tài liệu chi tiết đã được gửi tới email cá nhân của Anh/Chị. Anh/Chị kiểm tra hộp thư giúp em nhé!
Nếu có bất kỳ thắc mắc nào, Anh/Chị cứ nhắn em qua Zalo này hoặc hotline 098 736 3935 để được giải đáp ngay ạ. Em chúc Anh/Chị một khóa học thật nhiều niềm vui và thành công!`;
    },
    [currentUser?.full_name, currentUser?.name]
  );

  // Filter students for picker if opened without preselected student
  const filteredStudents = useMemo(() => {
    if (!studentsList || studentsList.length === 0) return [];
    const q = studentSearch.trim().toLowerCase();
    if (!q) return studentsList.slice(0, 10);
    return studentsList
      .filter(s => {
        const name = (s.full_name || s.name || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const phone = (s.phone || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
      })
      .slice(0, 15);
  }, [studentsList, studentSearch]);

  // Sync state when modal opens or preselectedStudent changes
  useEffect(() => {
    if (!isOpen) return;

    const student = preselectedStudent || (selectedStudentId ? studentsList.find(s => String(s.id) === String(selectedStudentId)) : null);
    const sName = (student?.full_name || student?.name || '').trim();
    const sEmail = (student?.email || '').trim();
    const rawProg = student?.program || student?.product_name || student?.course || '';
    const progKey = detectAcademicProgram(rawProg);

    setSelectedStudentId(student?.id || '');
    setAcademicProgram(progKey);
    setActiveTab('preview');
    setEmailForm({
      recipient_name: sName,
      to_email: sEmail,
      cc_email: DEFAULT_ACADEMIC_CC_EMAILS,
      subject: getAcademicEmailDefaultSubject(progKey),
      content: getAcademicEmailDefaultContent(sName, progKey),
      zalo_text: getAcademicZaloOnboardingText(sName)
    });
  }, [isOpen, preselectedStudent, studentsList, getAcademicZaloOnboardingText]);

  const handleProgramChange = (progKey: string) => {
    setAcademicProgram(progKey);
    const sName = emailForm.recipient_name.trim();
    setEmailForm(prev => ({
      ...prev,
      subject: getAcademicEmailDefaultSubject(progKey),
      content: getAcademicEmailDefaultContent(sName, progKey),
      zalo_text: getAcademicZaloOnboardingText(sName)
    }));
  };

  const handleSelectStudent = (s: any) => {
    const sName = (s.full_name || s.name || '').trim();
    const sEmail = (s.email || '').trim();
    const progKey = detectAcademicProgram(s.program || s.product_name || '');
    setSelectedStudentId(s.id);
    setAcademicProgram(progKey);
    setStudentSearch(`${sName} - ${sEmail}`);
    setShowStudentDropdown(false);
    setEmailForm(prev => ({
      ...prev,
      recipient_name: sName,
      to_email: sEmail,
      subject: getAcademicEmailDefaultSubject(progKey),
      content: getAcademicEmailDefaultContent(sName, progKey),
      zalo_text: getAcademicZaloOnboardingText(sName)
    }));
  };

  const handleSendEmail = async () => {
    if (isSending) return;
    if (!emailForm.to_email?.trim()) {
      if (addToast) addToast('Vui lòng nhập email người nhận!', 'error');
      return;
    }
    if (!emailForm.subject?.trim()) {
      if (addToast) addToast('Vui lòng nhập tiêu đề email!', 'error');
      return;
    }
    if (!emailForm.content?.trim()) {
      if (addToast) addToast('Vui lòng nhập nội dung email!', 'error');
      return;
    }

    setIsSending(true);
    try {
      const studentId = selectedStudentId || preselectedStudent?.id;
      if (studentId) {
        // Send via official student academic email endpoint
        await api.post(`/contacts/${studentId}/send-academic-email`, {
          to_email: emailForm.to_email.trim(),
          cc_email: emailForm.cc_email.trim(),
          subject: emailForm.subject.trim(),
          content: emailForm.content.trim(),
          program: academicProgram
        });
      } else {
        // Send via broadcast/mailer helper
        await api.post('/marketing-campaigns/send-quick-email', {
          to_email: emailForm.to_email.trim(),
          cc_email: emailForm.cc_email.trim(),
          subject: emailForm.subject.trim(),
          content_html: emailForm.content.trim()
        });
      }

      if (addToast) addToast('Đã gửi Thư tiếp nhận học viên thành công!', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Lỗi khi gửi email tiếp nhận.';
      if (addToast) addToast(msg, 'error');
    } finally {
      setIsSending(false);
    }
  };

  const handleCopyZalo = () => {
    const textToCopy = emailForm.zalo_text || getAcademicZaloOnboardingText(emailForm.recipient_name);
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedZalo(true);
      setTimeout(() => setCopiedZalo(false), 2500);
      if (addToast) addToast('Đã sao chép mẫu Tin nhắn Zalo Tiếp nhận!', 'success');
    });
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '820px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid #e2e8f0',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff'
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
              <Mail size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                Thư Tiếp Nhận Học Viên &amp; Hướng Dẫn Nhập Học
              </h3>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>
                Gửi email chào mừng tân học viên, cấp kênh học tập LMS &amp; sao chép mẫu tin nhắn Zalo CTSV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '8px',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748b',
              cursor: 'pointer'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Container */}
        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Information banner */}
          <div
            style={{
              padding: '10px 14px',
              background: '#f8fafc',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              fontSize: '0.8rem',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Sparkles size={16} style={{ color: '#BD1D2D', flexShrink: 0 }} />
            <div>
              Hệ thống sẽ gửi email chính thức tới học viên và tự động ghi nhật ký tương tác với tên của bạn.
            </div>
          </div>

          {/* Student Picker if not preselected */}
          {!preselectedStudent && studentsList.length > 0 && (
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Chọn Học viên từ danh sách
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Gõ tên hoặc email học viên để tìm nhanh..."
                  value={studentSearch}
                  onChange={e => {
                    setStudentSearch(e.target.value);
                    setShowStudentDropdown(true);
                  }}
                  onFocus={() => setShowStudentDropdown(true)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem'
                  }}
                />
              </div>

              {showStudentDropdown && filteredStudents.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 20,
                    marginTop: '4px',
                    background: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
                  }}
                >
                  {filteredStudents.map(s => (
                    <div
                      key={s.id}
                      onClick={() => handleSelectStudent(s)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '0.8rem'
                      }}
                      className="hover-bg-alt"
                    >
                      <strong style={{ color: '#0f172a' }}>{s.full_name || s.name}</strong>
                      <span style={{ color: '#64748b', marginLeft: '8px' }}>({s.email || s.phone || 'Chưa có email'})</span>
                      {s.program && <span style={{ color: '#BD1D2D', marginLeft: '8px', fontSize: '0.74rem' }}>[{s.program}]</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Program Select */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              <GraduationCap size={14} color="#BD1D2D" />
              Chương trình đào tạo áp dụng mẫu tiếp nhận <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={academicProgram}
              onChange={e => handleProgramChange(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #BD1D2D',
                background: '#fef2f2',
                color: '#BD1D2D',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {ACADEMIC_PROGRAM_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Name & Email Recipients */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Họ và tên học viên
              </label>
              <input
                type="text"
                placeholder="VD: Nguyễn Văn A"
                value={emailForm.recipient_name}
                onChange={e => {
                  const val = e.target.value;
                  setEmailForm(prev => ({
                    ...prev,
                    recipient_name: val,
                    content: getAcademicEmailDefaultContent(val, academicProgram),
                    zalo_text: getAcademicZaloOnboardingText(val)
                  }));
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Email người nhận (To) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="email"
                placeholder="hocvien@gmail.com"
                value={emailForm.to_email}
                onChange={e => setEmailForm(prev => ({ ...prev, to_email: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem'
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              CC (Đồng gửi)
            </label>
            <input
              type="text"
              value={emailForm.cc_email}
              onChange={e => setEmailForm(prev => ({ ...prev, cc_email: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              Tiêu đề email <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              value={emailForm.subject}
              onChange={e => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                fontWeight: 600
              }}
            />
          </div>

          {/* Subtab Segmented Switcher */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
              {activeTab === 'zalo' ? 'Nội dung tin nhắn Zalo tiếp nhận' : 'Nội dung email'}
            </span>

            <div
              style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                padding: '3px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                gap: '2px'
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'preview' ? '#ffffff' : 'transparent',
                  color: activeTab === 'preview' ? '#BD1D2D' : '#64748b',
                  fontWeight: activeTab === 'preview' ? 700 : 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: activeTab === 'preview' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                <Eye size={12} />
                Xem trước HTML
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'edit' ? '#ffffff' : 'transparent',
                  color: activeTab === 'edit' ? '#BD1D2D' : '#64748b',
                  fontWeight: activeTab === 'edit' ? 700 : 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: activeTab === 'edit' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                <Pencil size={12} />
                Chỉnh sửa HTML
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('zalo')}
                style={{
                  height: '28px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  border: 'none',
                  background: activeTab === 'zalo' ? '#ffffff' : 'transparent',
                  color: activeTab === 'zalo' ? '#0284c7' : '#64748b',
                  fontWeight: activeTab === 'zalo' ? 700 : 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: activeTab === 'zalo' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                }}
              >
                <MessageSquare size={12} />
                Mẫu Tin Zalo CTSV
              </button>
            </div>
          </div>

          {/* Tab Content Display */}
          {activeTab === 'preview' ? (
            <div
              style={{
                maxHeight: '380px',
                overflowY: 'auto',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '16px'
              }}
            >
              <div
                style={{
                  maxWidth: '640px',
                  margin: '0 auto',
                  background: '#ffffff',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.06)'
                }}
              >
                {/* Header Banner */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #BD1D2D 0%, #8C111E 100%)',
                    padding: '20px 24px',
                    color: '#ffffff'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '10px', marginBottom: '10px' }}>
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
                        onError={(e: any) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = 'https://ideas.edu.vn/wp-content/uploads/2026/06/Logo_IDEAS_Slg-optimized.webp';
                          e.currentTarget.style.filter = 'brightness(0) invert(1)';
                        }}
                      />
                    </div>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(0,0,0,0.2)', padding: '3px 8px', borderRadius: '4px', color: '#ffffff' }}>
                      Academic Department
                    </span>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>
                    {emailForm.subject}
                  </div>
                </div>

                {/* Content */}
                <div style={{ padding: '24px', fontSize: '0.875rem', lineHeight: '1.65', color: '#334155' }}>
                  <div dangerouslySetInnerHTML={{ __html: emailForm.content }} />
                </div>

                {/* Footer */}
                <div
                  style={{
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    padding: '16px 24px',
                    fontSize: '0.75rem',
                    color: '#64748b'
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#334155' }}>Ban Học vụ — IDEAS</div>
                  <div>Hotline / Zalo: <strong style={{ color: '#BD1D2D' }}>098 736 3935</strong> | Email: support@ideas.edu.vn</div>
                </div>
              </div>
            </div>
          ) : activeTab === 'edit' ? (
            <textarea
              value={emailForm.content}
              onChange={e => setEmailForm(prev => ({ ...prev, content: e.target.value }))}
              style={{
                width: '100%',
                minHeight: '260px',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '0.8125rem',
                lineHeight: '1.5',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1'
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.78rem', color: '#0369a1', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '8px', padding: '8px 12px' }}>
                Mẫu tin nhắn Zalo tiếp nhận học viên đã được tự động điền tên học viên &amp; CTSV. Bấm nút <strong>Copy Tin nhắn Zalo</strong> để dán trực tiếp gửi qua Zalo!
              </div>
              <textarea
                value={emailForm.zalo_text}
                onChange={e => setEmailForm(prev => ({ ...prev, zalo_text: e.target.value }))}
                style={{
                  width: '100%',
                  minHeight: '200px',
                  fontSize: '0.84rem',
                  lineHeight: '1.6',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1'
                }}
              />
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            flexWrap: 'wrap',
            gap: '10px'
          }}
        >
          <button
            type="button"
            onClick={handleCopyZalo}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #bae6fd',
              background: '#f0f9ff',
              color: '#0284c7',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            {copiedZalo ? <Check size={14} color="#059669" /> : <Copy size={14} />}
            <span>{copiedZalo ? 'Đã sao chép!' : 'Copy Tin nhắn Zalo Tiếp nhận'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#64748b',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSendEmail}
              disabled={isSending}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 18px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #BD1D2D, #8C111E)',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: isSending ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 4px rgba(189, 29, 45, 0.2)'
              }}
            >
              {isSending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Đang gửi...
                </>
              ) : (
                <>
                  <Send size={14} />
                  Gửi Thư Tiếp Nhận
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
