import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileUp,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Calendar,
  AlertCircle,
  ExternalLink,
  Copy,
  Award,
  PauseCircle,
  ChevronDown,
  ChevronUp,
  Send,
  Download,
  GraduationCap,
} from 'lucide-react';
import { ClassGradebookModal } from './ClassGradebookModal';
import { SubjectAnnouncementModal, cleanSubjectNameWithoutCode } from './SubjectAnnouncementModal';
import { LecturerInvitationModal } from './LecturerInvitationModal';
import { API_BASE } from '../../config/env';
import { getCachedTenantBootstrap, useTenantConfig } from '../../contexts/TenantConfigContext';

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

export interface SubjectGradeRow {
  subject_id?: number | null;
  subject_code: string;
  subject_name: string;
  credits: number;
  sessions_count?: number;
  lecturer_name?: string;
  lecturer_id?: string | number;
  start_date?: string | null;
  end_date?: string | null;
  grade_id?: number | null;
  attendance_score: string | number;
  assignment_score: string | number;
  midterm_score?: string | number;
  final_score: string | number;
  letter_grade: string;
  status: 'studying' | 'passed' | 'failed' | 'postponed' | 'exempt';
  note: string;
  is_custom?: boolean;
  host_sessions?: any[];
  seminars?: any[];
  zoom_link?: string;
  zoom_id?: string;
  zoom_pass?: string;
  ai_agent_link?: string;
  school_lecturer?: string;
}

export const STANDARD_PROGRAM_CURRICULUMS: Record<
  string,
  Array<{ code: string; name: string; credits: number }>
> = {
  'MSC - AI': [
    { code: 'MSC-AI-01', name: 'Artificial Intelligence and Machine Learning', credits: 3 },
    { code: 'MSC-AI-02', name: 'Big Data Analytics', credits: 3 },
    { code: 'MSC-AI-03', name: 'Digital and Computer Vision', credits: 3 },
    { code: 'MSC-AI-04', name: 'Cyber-Physical Systems and IoT', credits: 3 },
    { code: 'MSC-AI-05', name: 'Reinforcement Learning and AI Optimization', credits: 3 },
    { code: 'MSC-AI-06', name: 'AI in Business Decision Making', credits: 3 },
    { code: 'MSC-AI-07', name: 'Economic Forecasting and AI-Driven Market Dynamics', credits: 3 },
    { code: 'MSC-AI-08', name: 'Research Methodology', credits: 3 },
    { code: 'MSC-AI-09', name: 'AI Innovation and Entrepreneurship', credits: 3 },
    { code: 'MSC-AI-10', name: 'Advanced Project Management in AI', credits: 3 },
    { code: 'MSC-AI-11', name: 'Change management strategies for AI transition', credits: 3 },
    { code: 'MSC-AI-12', name: 'Global AI policies and regulatory frameworks', credits: 3 },
    { code: 'MSC-AI-13', name: 'CAPSTONE PROJECT', credits: 6 },
  ],
  'EMBA (HIGH _ STAND)': [
    { code: 'EMBA-HS-01', name: 'Accounting for Managers course', credits: 3 },
    { code: 'EMBA-HS-02', name: 'Project management', credits: 3 },
    { code: 'EMBA-HS-03', name: 'Marketing management', credits: 3 },
    { code: 'EMBA-HS-04', name: 'Corporate finance', credits: 3 },
    { code: 'EMBA-HS-05', name: 'Strategy Management', credits: 3 },
    { code: 'EMBA-HS-06', name: 'Entrepreneurship and innovation', credits: 3 },
    { code: 'EMBA-HS-07', name: 'Human capital and talent management', credits: 3 },
    { code: 'EMBA-HS-08', name: 'Digital transformation', credits: 3 },
    { code: 'EMBA-HS-09', name: 'Organizational Behavior', credits: 3 },
    { code: 'EMBA-HS-10', name: 'Leadership Development', credits: 3 },
  ],
  'MBA (HIGH _ STAND)': [
    { code: 'MBA-HS-01', name: 'Accounting for Managers course', credits: 3 },
    { code: 'MBA-HS-02', name: 'Project management', credits: 3 },
    { code: 'MBA-HS-03', name: 'Marketing management', credits: 3 },
    { code: 'MBA-HS-04', name: 'Corporate finance', credits: 3 },
    { code: 'MBA-HS-05', name: 'Strategy Management', credits: 3 },
    { code: 'MBA-HS-06', name: 'Entrepreneurship and innovation', credits: 3 },
    { code: 'MBA-HS-07', name: 'Human capital and talent management', credits: 3 },
    { code: 'MBA-HS-08', name: 'Digital transformation', credits: 3 },
    { code: 'MBA-HS-09', name: 'Organizational Behavior', credits: 3 },
    { code: 'MBA-HS-10', name: 'Leadership Development', credits: 3 },
    { code: 'MBA-HS-11', name: 'AI in Business Decision Making', credits: 3 },
    { code: 'MBA-HS-12', name: 'Research Methodology', credits: 3 },
    { code: 'MBA-HS-13', name: 'MBA THESIS', credits: 6 },
  ],
  BBA: [
    { code: 'BBA-01', name: 'Introduction to Management', credits: 3 },
    { code: 'BBA-02', name: 'Introduction to Finance', credits: 3 },
    { code: 'BBA-03', name: 'Organisational Behaviour', credits: 3 },
    { code: 'BBA-04', name: 'Global Marketing', credits: 3 },
    { code: 'BBA-05', name: 'AI in Business', credits: 3 },
    { code: 'BBA-06', name: 'Project Management', credits: 3 },
    { code: 'BBA-07', name: 'Innovation & Design Thinking', credits: 3 },
    { code: 'BBA-08', name: 'Total Quality Management', credits: 3 },
    { code: 'BBA-09', name: 'Change Management', credits: 3 },
    { code: 'BBA-10', name: 'Management Information Systems', credits: 3 },
    { code: 'BBA-11', name: 'Capstone Project', credits: 6 },
  ],
  ISTEC: [
    { code: 'ISTEC-01', name: 'Strategic Management', credits: 3 },
    { code: 'ISTEC-02', name: 'Leadership & Organizational Behavior', credits: 3 },
    { code: 'ISTEC-03', name: 'Financial Management for Executives', credits: 3 },
    { code: 'ISTEC-04', name: 'Marketing Strategy & Brand Management', credits: 3 },
    { code: 'ISTEC-05', name: 'Business Ethics & Sustainable Development', credits: 3 },
    { code: 'ISTEC-06', name: 'Business Analytics & Decision Making', credits: 3 },
    { code: 'ISTEC-07', name: 'Digital Transformation & AI Strategy', credits: 3 },
    { code: 'ISTEC-08', name: 'Operations & Supply Chain Management', credits: 3 },
    { code: 'ISTEC-09', name: 'Entrepreneurship & Innovation Management', credits: 3 },
    { code: 'ISTEC-10', name: 'Luxury & Premium Brand Management', credits: 3 },
    { code: 'ISTEC-11', name: 'International Business Management', credits: 3 },
    { code: 'ISTEC-12', name: 'Cross-Cultural Management', credits: 3 },
    { code: 'ISTEC-13', name: 'Strategic Marketing in Emerging Markets', credits: 3 },
    { code: 'ISTEC-14', name: 'International Negotiation & Business Development', credits: 3 },
    { code: 'ISTEC-15', name: 'Consulting Project Management', credits: 3 },
    { code: 'ISTEC-16', name: 'MBA THESIS / APPLIED BUSINESS PROJECT', credits: 6 },
  ],
  'MBA IN AI': [
    { code: 'MBA-AI-01', name: 'Marketing Management', credits: 3 },
    { code: 'MBA-AI-02', name: 'Human Capital and Talent Management', credits: 3 },
    { code: 'MBA-AI-03', name: 'Entrepreneurship and Innovation', credits: 3 },
    { code: 'MBA-AI-04', name: 'Corporate Finance', credits: 3 },
    { code: 'MBA-AI-05', name: 'Accounting for Managers', credits: 3 },
    { code: 'MBA-AI-06', name: 'Digital Transformation', credits: 3 },
    { code: 'MBA-AI-07', name: 'Global Strategy', credits: 3 },
    { code: 'MBA-AI-08', name: 'Organizational Behaviour', credits: 3 },
    { code: 'MBA-AI-09', name: 'Leadership Development', credits: 3 },
    { code: 'MBA-AI-10', name: 'AI in Business Decision making', credits: 3 },
    { code: 'MBA-AI-11', name: 'Big Data Analysis', credits: 3 },
    { code: 'MBA-AI-12', name: 'Project Management', credits: 3 },
    { code: 'MBA-AI-13', name: 'Thesis (Luận văn) - 18 ECTS', credits: 18 },
  ],
  'DBA ISTEC (PHASE & SEMINARS)': [
    { code: 'PHASE-1-SEM-01', name: 'Phase 1 — Seminar 1: Doctoral Research Orientation & Thesis Topic Development', credits: 6 },
    { code: 'PHASE-1-SEM-02', name: 'Phase 1 — Seminar 2: Literature Review & Conceptual Framework Development', credits: 6 },
    { code: 'PHASE-1-SEM-03', name: 'Phase 1 — Seminar 3: Advanced Research Methodology & Qualitative Design', credits: 6 },
    { code: 'PHASE-1-SEM-04', name: 'Phase 1 — Seminar 4: Quantitative Research Methods & Statistical Analysis', credits: 6 },
    { code: 'PHASE-1-PROPOSAL', name: 'Phase 1 — Doctoral Research Proposal Defense (Bảo vệ Đề cương Tiến sĩ)', credits: 6 },
    { code: 'PHASE-2-SEM-05', name: 'Phase 2 — Seminar 5: Advanced Epistemology & Epistemological Frameworks', credits: 6 },
    { code: 'PHASE-2-SEM-06', name: 'Phase 2 — Seminar 6: Field Data Collection & Empirical Analysis', credits: 6 },
    { code: 'PHASE-2-PUB', name: 'Phase 2 — International Working Paper / Scientific Publication (Bài báo khoa học)', credits: 6 },
    { code: 'PHASE-3-SEM-07', name: 'Phase 3 — Seminar 7: Doctoral Thesis Writing & Scientific Synthesis', credits: 6 },
    { code: 'PHASE-3-PREDEFENSE', name: 'Phase 3 — Pre-Defense (Bảo vệ Luận án Tiến sĩ cấp cơ sở)', credits: 6 },
    { code: 'PHASE-3-DEFENSE', name: 'Phase 3 — Doctoral Thesis Defense (Bảo vệ Luận án Tiến sĩ chính thức)', credits: 24 },
  ],
  'DBA ESTIAM (PHASE & SEMINARS)': [
    { code: 'PHASE-1-SEM-01', name: 'Phase 1 — Seminar 1: Doctoral Research Orientation & Thesis Topic Development', credits: 6 },
    { code: 'PHASE-1-SEM-02', name: 'Phase 1 — Seminar 2: Literature Review & Conceptual Framework Development', credits: 6 },
    { code: 'PHASE-1-SEM-03', name: 'Phase 1 — Seminar 3: Advanced Research Methodology & Qualitative Design', credits: 6 },
    { code: 'PHASE-1-SEM-04', name: 'Phase 1 — Seminar 4: Quantitative Research Methods & Statistical Analysis', credits: 6 },
    { code: 'PHASE-1-PROPOSAL', name: 'Phase 1 — Doctoral Research Proposal Defense (Bảo vệ Đề cương Tiến sĩ)', credits: 6 },
    { code: 'PHASE-2-SEM-05', name: 'Phase 2 — Seminar 5: Advanced Epistemology & Epistemological Frameworks', credits: 6 },
    { code: 'PHASE-2-SEM-06', name: 'Phase 2 — Seminar 6: Field Data Collection & Empirical Analysis', credits: 6 },
    { code: 'PHASE-2-PUB', name: 'Phase 2 — International Working Paper / Scientific Publication (Bài báo khoa học)', credits: 6 },
    { code: 'PHASE-3-SEM-07', name: 'Phase 3 — Seminar 7: Doctoral Thesis Writing & Scientific Synthesis', credits: 6 },
    { code: 'PHASE-3-PREDEFENSE', name: 'Phase 3 — Pre-Defense (Bảo vệ Luận án Tiến sĩ cấp cơ sở)', credits: 6 },
    { code: 'PHASE-3-DEFENSE', name: 'Phase 3 — Doctoral Thesis Defense (Bảo vệ Luận án Tiến sĩ chính thức)', credits: 24 },
  ],
  'DBA ESTIAM': [
    { code: 'PHASE-1-SEM-01', name: 'Phase 1 — Seminar 1: Doctoral Research Orientation & Thesis Topic Development', credits: 6 },
    { code: 'PHASE-1-SEM-02', name: 'Phase 1 — Seminar 2: Literature Review & Conceptual Framework Development', credits: 6 },
    { code: 'PHASE-1-SEM-03', name: 'Phase 1 — Seminar 3: Advanced Research Methodology & Qualitative Design', credits: 6 },
    { code: 'PHASE-1-SEM-04', name: 'Phase 1 — Seminar 4: Quantitative Research Methods & Statistical Analysis', credits: 6 },
    { code: 'PHASE-1-PROPOSAL', name: 'Phase 1 — Doctoral Research Proposal Defense (Bảo vệ Đề cương Tiến sĩ)', credits: 6 },
    { code: 'PHASE-2-SEM-05', name: 'Phase 2 — Seminar 5: Advanced Epistemology & Epistemological Frameworks', credits: 6 },
    { code: 'PHASE-2-SEM-06', name: 'Phase 2 — Seminar 6: Field Data Collection & Empirical Analysis', credits: 6 },
    { code: 'PHASE-2-PUB', name: 'Phase 2 — International Working Paper / Scientific Publication (Bài báo khoa học)', credits: 6 },
    { code: 'PHASE-3-SEM-07', name: 'Phase 3 — Seminar 7: Doctoral Thesis Writing & Scientific Synthesis', credits: 6 },
    { code: 'PHASE-3-PREDEFENSE', name: 'Phase 3 — Pre-Defense (Bảo vệ Luận án Tiến sĩ cấp cơ sở)', credits: 6 },
    { code: 'PHASE-3-DEFENSE', name: 'Phase 3 — Doctoral Thesis Defense (Bảo vệ Luận án Tiến sĩ chính thức)', credits: 24 },
  ],
};

export const STANDARD_PROGRAM_NAMES = Object.keys(STANDARD_PROGRAM_CURRICULUMS);

export function matchStandardProgramKey(programName?: string | null): string | null {
  const raw = String(programName || '').trim();
  if (!raw) return null;
  for (const key of STANDARD_PROGRAM_NAMES) {
    if (raw.toLowerCase() === key.toLowerCase()) return key;
  }
  const upper = raw.toUpperCase();
  // Check DBA / Doctor / Tiến sĩ FIRST before generic school names (e.g. ISTEC / ESTIAM)
  if (
    upper.includes('DBA') ||
    upper.includes('DOCTOR') ||
    upper.includes('TIẾN SĨ') ||
    upper.includes('TIEN SI') ||
    upper.includes('SEMINAR')
  ) {
    if (upper.includes('ISTEC')) return 'DBA ISTEC (PHASE & SEMINARS)';
    return 'DBA ESTIAM (PHASE & SEMINARS)';
  }
  if (upper.includes('ISTEC')) return 'ISTEC';
  if (upper.includes('MBA IN AI') || (upper.includes('MBA') && /\bAI\b/.test(upper))) {
    return 'MBA IN AI';
  }
  if (
    upper.includes('MSC') ||
    upper.includes('AI ST') ||
    upper.includes('M.SC') ||
    /\bAI\b/.test(upper)
  ) {
    return 'MSC - AI';
  }
  if (
    upper.includes('BBA') ||
    upper.includes('BACHELOR') ||
    upper.includes('TOP UP') ||
    upper.includes('TOPUP') ||
    upper.includes('CỬ NHÂN') ||
    upper.includes('CU NHAN')
  ) {
    return 'BBA';
  }
  if (upper.includes('EMBA') || upper.includes('EXECUTIVE MBA')) return 'EMBA (HIGH _ STAND)';
  if (
    upper.includes('MBA') ||
    upper.includes('HIGH') ||
    upper.includes('SWISS') ||
    upper.includes('UMEF')
  ) {
    return 'MBA (HIGH _ STAND)';
  }
  return null;
}

export function getTenantCurriculumMap(): Record<string, Array<{ code: string; name: string; credits: number }>> {
  const dbProgs = getCachedTenantBootstrap()?.academic_programs;
  if (Array.isArray(dbProgs) && dbProgs.length > 0) {
    const out: Record<string, Array<{ code: string; name: string; credits: number }>> = { ...STANDARD_PROGRAM_CURRICULUMS };
    dbProgs.forEach((p) => {
      if (p?.name && Array.isArray(p.curriculum) && p.curriculum.length > 0) {
        out[p.name] = p.curriculum;
      }
    });
    return out;
  }
  return STANDARD_PROGRAM_CURRICULUMS;
}

export function resolveCurriculumSubjects(
  programName?: string | null
): Array<{ code: string; name: string; credits: number }> {
  const raw = String(programName || '').trim().toLowerCase();
  const dbProgs = getCachedTenantBootstrap()?.academic_programs;
  if (raw && Array.isArray(dbProgs) && dbProgs.length > 0) {
    const exactOrKeyword = dbProgs.find(
      (p) =>
        String(p.name || '').toLowerCase() === raw ||
        String(p.program_code || '').toLowerCase() === raw ||
        (Array.isArray(p.match_keywords) && p.match_keywords.some((kw) => kw && raw.includes(String(kw).toLowerCase())))
    );
    if (exactOrKeyword && Array.isArray(exactOrKeyword.curriculum) && exactOrKeyword.curriculum.length > 0) {
      return exactOrKeyword.curriculum;
    }
  }
  const key = matchStandardProgramKey(programName);
  if (!key) return [];
  return STANDARD_PROGRAM_CURRICULUMS[key] || [];
}

interface StudentAcademicWorkspaceProps {
  contactId: number | string;
  studentName: string;
  studentCode?: string;
  studentEmail?: string;
  studentPhone?: string;
  programName?: string;
  campaignId?: number | null;
  studyStatus?: string;
  /** 'full' renders both Studying Gradebook & Postpone tabs; 'postpone_inline' renders compact postpone uploader */
  mode?: 'full' | 'postpone_inline';
  defaultSection?: 'grades' | 'postpone';
  defaultCollapsed?: boolean;
  onProgramChange?: (newProgram: string) => void;
  onPostponeSaved?: (data: {
    postpone_reason: string;
    postpone_from_date: string;
    postpone_to_date: string;
    postpone_remind_date: string;
    duration_months?: number | null;
    deferred_subjects?: string;
    form_file_url?: string;
    form_file_name?: string;
  }) => void;
  onGradesSaved?: () => void;
  onOpenOnboardingEmail?: () => void;
}

const STATUS_META: Record<
  string,
  { label: string; bg: string; color: string; border: string }
> = {
  studying: {
    label: 'Đang học',
    bg: '#eff6ff',
    color: '#1d4ed8',
    border: '#bfdbfe',
  },
  passed: {
    label: 'Hoàn thành',
    bg: '#ecfdf5',
    color: '#047857',
    border: '#a7f3d0',
  },
  failed: {
    label: 'Chưa đạt',
    bg: '#fef2f2',
    color: '#b91c1c',
    border: '#fecaca',
  },
  postponed: {
    label: 'Bảo lưu',
    bg: '#fffbeb',
    color: '#b45309',
    border: '#fde68a',
  },
  exempt: {
    label: 'Miễn giảm',
    bg: '#f1f5f9',
    color: '#334155',
    border: '#cbd5e1',
  },
};

/**
 * Official IDEAS / Swiss UMEF 6.0 ECTS Grading Scale:
 * - A (Excellent):    5.25 – 6.00 => passed
 * - B (Very Good):    4.75 – 5.24 => passed
 * - C (Good):         4.50 – 4.74 => passed
 * - D (Satisfactory): 4.25 – 4.49 => passed
 * - E (Pass):         4.00 – 4.24 => passed (Minimum passing grade for ECTS credits)
 * - F (Fail):         < 4.00      => failed (3.50 - <4.00: Retake; < 3.50: Redo)
 */
export function computeAutoLetter(scoreRaw: string | number): string {
  const n = typeof scoreRaw === 'number' ? scoreRaw : parseFloat(String(scoreRaw).replace(',', '.'));
  if (Number.isNaN(n)) return '';
  const score6 = n > 10 ? Math.round((n / 100) * 6 * 100) / 100 : n > 6 ? Math.round((n / 10) * 6 * 100) / 100 : n;
  if (score6 >= 5.25) return 'A';
  if (score6 >= 4.75) return 'B';
  if (score6 >= 4.50) return 'C';
  if (score6 >= 4.25) return 'D';
  if (score6 >= 4.00) return 'E';
  return 'F';
}

export const StudentAcademicWorkspace: React.FC<StudentAcademicWorkspaceProps> = ({
  contactId,
  studentName,
  studentCode,
  studentEmail,
  studentPhone,
  programName,
  campaignId,
  studyStatus = 'studying',
  mode = 'full',
  defaultSection,
  defaultCollapsed = false,
  onProgramChange,
  onPostponeSaved,
  onGradesSaved,
  onOpenOnboardingEmail,
}) => {
  const normalizedStatus = String(studyStatus || 'studying').toLowerCase();
  const [activeSubTab, setActiveSubTab] = useState<'grades' | 'postpone'>(
    defaultSection || (normalizedStatus === 'postpone' ? 'postpone' : 'grades')
  );
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  // Sync tab when student studyStatus switches to postpone
  useEffect(() => {
    if (defaultSection) {
      setActiveSubTab(defaultSection);
    } else if (normalizedStatus === 'postpone') {
      setActiveSubTab('postpone');
    }
  }, [normalizedStatus, defaultSection]);

  // --- Grades State ---
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [savingGrades, setSavingGrades] = useState(false);
  const [resolvedCampaignId, setResolvedCampaignId] = useState<number>(campaignId || 0);
  const [resolvedCourseName, setResolvedCourseName] = useState<string>(programName || '');
  const [subjects, setSubjects] = useState<SubjectGradeRow[]>(() => {
    const initialSubs = resolveCurriculumSubjects(programName);
    return initialSubs.map((s) => ({
      subject_id: null,
      subject_code: s.code,
      subject_name: s.name,
      credits: s.credits || 3,
      sessions_count: 0,
      lecturer_name: '',
      attendance_score: '',
      assignment_score: '',
      final_score: '',
      letter_grade: '',
      status: 'studying',
      note: '',
    }));
  });
  const [summary, setSummary] = useState<{
    total_subjects: number;
    passed_count: number;
    studying_count: number;
    postponed_count: number;
    failed_count: number;
    gpa_10: number | null;
    completion_pct: number;
  }>(() => {
    const initialSubs = resolveCurriculumSubjects(programName);
    return {
      total_subjects: initialSubs.length,
      passed_count: 0,
      studying_count: initialSubs.length,
      postponed_count: 0,
      failed_count: 0,
      gpa_10: null,
      completion_pct: 0,
    };
  });
  const [gradeSaveNotice, setGradeSaveNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [showClassGradebookModal, setShowClassGradebookModal] = useState(false);
  const [tbcdModalSubject, setTbcdModalSubject] = useState<any | null>(null);
  const [tmgModalSubject, setTmgModalSubject] = useState<any | null>(null);

  // Download Excel/CSV Grade Template (Thang điểm 6.0 chuẩn ECTS)
  const handleDownloadProgramGradeTemplate = useCallback(() => {
    const curProg = resolvedCourseName || programName || 'BBA';
    const currSubjects = resolveCurriculumSubjects(curProg);
    const subList = currSubjects.length > 0 ? currSubjects : subjects;
    const firstSub = subList[0];
    const cleanFirstSubName = firstSub
      ? cleanSubjectNameWithoutCode((firstSub as any).name || (firstSub as any).subject_name || 'Introduction to Management')
      : 'Introduction to Management';

    const headers = [
      'Contact_ID',
      'Ma_Hoc_Vien',
      'Ho_Ten',
      'Email',
      'So_Dien_Thoai',
      'Diem_Quiz_50 (0-6)',
      'Diem_Final_50 (0-6)',
      `${cleanFirstSubName} - Diem_TK (Thang 6)`,
      'Ghi_Chu'
    ];

    const csvRows: string[] = [headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(',')];

    // Current student row
    const stCode = studentCode || 'SV001';
    const stName = studentName || 'Học viên';
    const stEmail = studentEmail || '';
    const stPhone = studentPhone || '';
    const matchSub = subjects[0];
    const studentCells = [
      String(contactId || ''),
      stCode,
      stName,
      stEmail,
      stPhone,
      matchSub?.attendance_score !== undefined && matchSub?.attendance_score !== '' ? String(matchSub.attendance_score) : '',
      matchSub?.assignment_score !== undefined && matchSub?.assignment_score !== '' ? String(matchSub.assignment_score) : '',
      matchSub?.final_score !== undefined && matchSub?.final_score !== '' ? String(matchSub.final_score) : '',
      matchSub?.note || ''
    ];
    csvRows.push(studentCells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));

    // Sample row to demonstrate 6.0 ECTS grading scale
    const sampleCells = [
      '0',
      'SV-DEMO',
      'Học viên Mẫu (Ví dụ - Thang điểm 6.0)',
      'demo.student@example.com',
      '0901234567',
      '5.50',
      '5.50',
      '5.50',
      'A (Excellent)'
    ];
    csvRows.push(sampleCells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeSub = cleanFirstSubName.replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `Bang_Diem_Mon_${safeSub}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [resolvedCourseName, programName, subjects, contactId, studentCode, studentName, studentEmail, studentPhone]);
  const [booking1on1Url, setBooking1on1Url] = useState<string>('');
  const prevProgramRef = useRef<string>(programName || '');

  // Helper to apply curriculum subjects immediately (0ms Instant Open) while keeping any existing grades
  const applyInstantCurriculumSubjects = useCallback((progName: string) => {
    const curriculum = resolveCurriculumSubjects(progName);
    if (curriculum.length === 0) return;
    setResolvedCourseName(progName);
    setIsCollapsed(false);
    setActiveSubTab('grades');
    setSubjects((prev) => {
      const existingByCode = new Map<string, SubjectGradeRow>();
      const existingByName = new Map<string, SubjectGradeRow>();
      prev.forEach((row) => {
        if (row.subject_code) existingByCode.set(row.subject_code.trim().toLowerCase(), row);
        if (row.subject_name) existingByName.set(row.subject_name.trim().toLowerCase(), row);
      });
      const nextRows: SubjectGradeRow[] = curriculum.map((c) => {
        const matched =
          existingByCode.get(c.code.toLowerCase()) ||
          existingByName.get(c.name.toLowerCase());
        return {
          subject_id: matched?.subject_id ?? null,
          subject_code: c.code,
          subject_name: c.name,
          credits: c.credits || 3,
          sessions_count: matched?.sessions_count || 0,
          lecturer_name: matched?.lecturer_name || '',
          lecturer_id: matched?.lecturer_id || '',
          start_date: matched?.start_date || null,
          end_date: matched?.end_date || null,
          grade_id: matched?.grade_id ?? null,
          attendance_score: matched?.attendance_score ?? '',
          assignment_score: matched?.assignment_score ?? '',
          midterm_score: matched?.midterm_score ?? '',
          final_score: matched?.final_score ?? '',
          letter_grade: matched?.letter_grade || '',
          status: matched?.status || 'studying',
          note: matched?.note || '',
          host_sessions: matched?.host_sessions || [],
          seminars: matched?.seminars || [],
          zoom_link: matched?.zoom_link || '',
          zoom_id: matched?.zoom_id || '',
          zoom_pass: matched?.zoom_pass || '',
          ai_agent_link: matched?.ai_agent_link || '',
          school_lecturer: matched?.school_lecturer || '',
        };
      });
      const passed = nextRows.filter((r) => r.status === 'passed' || r.status === 'exempt').length;
      setSummary((s) => ({
        ...s,
        total_subjects: nextRows.length,
        passed_count: passed,
        studying_count: Math.max(0, nextRows.length - passed),
        completion_pct: nextRows.length > 0 ? Math.round((passed / nextRows.length) * 1000) / 10 : 0,
      }));
      return nextRows;
    });
  }, []);

  // --- Postpone State ---
  const [loadingPostpone, setLoadingPostpone] = useState(false);
  const [ocrUploading, setOcrUploading] = useState(false);
  const [savingPostpone, setSavingPostpone] = useState(false);
  const [remindLeadDays, setRemindLeadDays] = useState<number>(14);
  const [postponeForm, setPostponeForm] = useState<{
    postpone_reason: string;
    postpone_from_date: string;
    postpone_to_date: string;
    postpone_remind_date: string;
    duration_months: string;
    deferred_subjects: string;
    form_file_url: string;
    form_file_name: string;
    admin_note: string;
    send_email_now: boolean;
    cc_emails: string;
  }>({
    postpone_reason: '',
    postpone_from_date: new Date().toISOString().slice(0, 10),
    postpone_to_date: '',
    postpone_remind_date: '',
    duration_months: '',
    deferred_subjects: '',
    form_file_url: '',
    form_file_name: '',
    admin_note: '',
    send_email_now: false,
    cc_emails: getCachedTenantBootstrap()?.organization?.academic_cc_emails || '',
  });
  const [postponeHistory, setPostponeHistory] = useState<any[]>([]);
  const [postponeNotice, setPostponeNotice] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch student grades
  const fetchStudentGrades = useCallback(async (overrideProgram?: string) => {
    if (!contactId) return;
    const effectiveProg = (overrideProgram !== undefined ? overrideProgram : (programName || '')).trim();
    const instantSubs = resolveCurriculumSubjects(effectiveProg);
    if (instantSubs.length === 0) {
      setLoadingGrades(true);
    }
    try {
      const params = new URLSearchParams();
      if (campaignId) params.set('campaign_id', String(campaignId));
      if (effectiveProg) params.set('program', effectiveProg);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(`${API_URL}/academic/student-grades/${contactId}${qs}`);
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.campaign_id) setResolvedCampaignId(Number(json.data.campaign_id));
        if (effectiveProg) {
          setResolvedCourseName(effectiveProg);
        } else if (json.data.course?.name || json.data.student?.program) {
          setResolvedCourseName(json.data.course?.name || json.data.student?.program || '');
        }
        const rawSubjects = Array.isArray(json.data.subjects) ? json.data.subjects : [];
        if (rawSubjects.length > 0) {
          setSubjects(
            rawSubjects.map((s: any) => ({
              subject_id: s.subject_id ?? null,
              subject_code: s.subject_code || '',
              subject_name: s.subject_name || '',
              credits: Number(s.credits || 3),
              sessions_count: Number(s.sessions_count || 0),
              lecturer_name: s.lecturer_name || '',
              lecturer_id: s.lecturer_id || '',
              start_date: s.start_date || null,
              end_date: s.end_date || null,
              grade_id: s.grade_id ?? null,
              attendance_score: s.attendance_score ?? '',
              assignment_score: s.assignment_score ?? '',
              midterm_score: s.midterm_score ?? '',
              final_score: s.final_score ?? '',
              letter_grade: s.letter_grade || '',
              status: s.status || 'studying',
              note: s.note || '',
              host_sessions: Array.isArray(s.host_sessions) ? s.host_sessions : [],
              seminars: Array.isArray(s.seminars) ? s.seminars : [],
              zoom_link: s.zoom_link || '',
              zoom_id: s.zoom_id || '',
              zoom_pass: s.zoom_pass || '',
              ai_agent_link: s.ai_agent_link || '',
              school_lecturer: s.school_lecturer || '',
            }))
          );
          if (json.data.summary) {
            setSummary(json.data.summary);
          }
        } else if (instantSubs.length > 0) {
          applyInstantCurriculumSubjects(effectiveProg);
        }
      }
    } catch (err) {
      console.error('Failed to load student grades:', err);
    } finally {
      setLoadingGrades(false);
    }
  }, [contactId, campaignId, programName, applyInstantCurriculumSubjects]);

  // Automatically expand and populate curriculum subjects when programName prop changes
  useEffect(() => {
    const trimmed = String(programName || '').trim();
    if (trimmed && trimmed !== prevProgramRef.current) {
      prevProgramRef.current = trimmed;
      applyInstantCurriculumSubjects(trimmed);
      if (mode === 'full') {
        fetchStudentGrades(trimmed);
      }
    }
  }, [programName, mode, applyInstantCurriculumSubjects, fetchStudentGrades]);

  // Fetch postpone history & active record
  const fetchPostponeInfo = useCallback(async () => {
    if (!contactId) return;
    setLoadingPostpone(true);
    try {
      const res = await apiFetch(`${API_URL}/academic/postpone/${contactId}`);
      const json = await res.json();
      if (json.success && json.data) {
        const records = Array.isArray(json.data.records)
          ? json.data.records
          : Array.isArray(json.data.history)
            ? json.data.history
            : [];
        setPostponeHistory(records);
        const latest = records[0] || json.data.latest || null;
        const snap = json.data.current_snapshot || {};
        if (latest || snap.postpone_from_date || snap.postpone_reason) {
          setPostponeForm((prev) => ({
            ...prev,
            postpone_reason: latest?.postpone_reason || snap.postpone_reason || prev.postpone_reason,
            postpone_from_date:
              latest?.postpone_from_date || snap.postpone_from_date || prev.postpone_from_date,
            postpone_to_date:
              latest?.postpone_to_date || snap.postpone_to_date || prev.postpone_to_date,
            postpone_remind_date:
              latest?.postpone_remind_date ||
              snap.postpone_remind_date ||
              prev.postpone_remind_date,
            duration_months:
              latest?.duration_months != null ? String(latest.duration_months) : prev.duration_months,
            deferred_subjects: latest?.deferred_subjects || prev.deferred_subjects,
            form_file_url: latest?.form_file_url || prev.form_file_url,
            form_file_name: latest?.form_file_name || prev.form_file_name,
            admin_note: latest?.admin_note || prev.admin_note,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load postpone info:', err);
    } finally {
      setLoadingPostpone(false);
    }
  }, [contactId]);

  // Fetch 1-on-1 config link if available
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const qs = resolvedCampaignId ? `?campaign_id=${resolvedCampaignId}` : '';
        const res = await apiFetch(`${API_URL}/academic/1on1-configs${qs}`);
        const json = await res.json();
        if (!cancelled && json.success && Array.isArray(json.data) && json.data.length > 0) {
          setBooking1on1Url(json.data[0].public_url || '');
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolvedCampaignId]);

  useEffect(() => {
    if (mode === 'full') {
      fetchStudentGrades();
    }
    fetchPostponeInfo();
  }, [fetchStudentGrades, fetchPostponeInfo, mode]);

  // Auto-recalculate postpone_remind_date whenever postpone_to_date or remindLeadDays changes
  const recalcRemindDate = (toDateStr: string, daysBefore: number) => {
    if (!toDateStr) return '';
    const d = new Date(`${toDateStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - daysBefore);
    return d.toISOString().slice(0, 10);
  };

  const handleToDateChange = (newToDate: string) => {
    const remind = recalcRemindDate(newToDate, remindLeadDays);
    setPostponeForm((prev) => ({
      ...prev,
      postpone_to_date: newToDate,
      postpone_remind_date: remind || prev.postpone_remind_date,
    }));
  };

  const handleDurationMonthsChange = (monthsStr: string) => {
    const m = parseInt(monthsStr, 10);
    let nextTo = postponeForm.postpone_to_date;
    let nextRemind = postponeForm.postpone_remind_date;
    if (!Number.isNaN(m) && m > 0 && postponeForm.postpone_from_date) {
      const fromD = new Date(`${postponeForm.postpone_from_date}T00:00:00`);
      if (!Number.isNaN(fromD.getTime())) {
        fromD.setMonth(fromD.getMonth() + m);
        nextTo = fromD.toISOString().slice(0, 10);
        nextRemind = recalcRemindDate(nextTo, remindLeadDays);
      }
    }
    setPostponeForm((prev) => ({
      ...prev,
      duration_months: monthsStr,
      postpone_to_date: nextTo,
      postpone_remind_date: nextRemind,
    }));
  };

  const handleUploadPostponeFormOcr = async (file: File) => {
    if (!file || !contactId) return;
    setOcrUploading(true);
    setPostponeNotice(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('remind_days_before', String(remindLeadDays));
      const res = await apiFetch(`${API_URL}/academic/postpone/${contactId}/ocr`, {
        method: 'POST',
        body: fd,
      });
      const json = await res.json();
      if (json.success && json.data) {
        const ext = json.data;
        setPostponeForm((prev) => ({
          ...prev,
          postpone_reason: ext.postpone_reason || prev.postpone_reason,
          postpone_from_date: ext.postpone_from_date || prev.postpone_from_date,
          postpone_to_date: ext.postpone_to_date || prev.postpone_to_date,
          postpone_remind_date: ext.postpone_remind_date || prev.postpone_remind_date,
          duration_months:
            ext.duration_months != null ? String(ext.duration_months) : prev.duration_months,
          deferred_subjects: ext.deferred_subjects || prev.deferred_subjects,
          form_file_url: ext.form_file_url || prev.form_file_url,
          form_file_name: ext.form_file_name || file.name,
          admin_note: ext.summary_note || prev.admin_note,
        }));
        setPostponeNotice({
          type: 'success',
          text:
            json.message ||
            'AI OCR đã đọc Đơn bảo lưu, tự động điền thông tin và tính ngày Email Remind.',
        });
      } else {
        setPostponeNotice({
          type: 'error',
          text: json.message || 'Không thể trích xuất tự động, vui lòng kiểm tra lại file.',
        });
      }
    } catch (err: any) {
      setPostponeNotice({
        type: 'error',
        text: err?.message || 'Lỗi kết nối khi tải lên Đơn bảo lưu.',
      });
    } finally {
      setOcrUploading(false);
    }
  };

  const handleSavePostpone = async () => {
    if (!contactId) return;
    setSavingPostpone(true);
    setPostponeNotice(null);
    try {
      const res = await apiFetch(`${API_URL}/academic/postpone/${contactId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: resolvedCampaignId || campaignId || null,
          program_name: resolvedCourseName || programName || '',
          postpone_reason: postponeForm.postpone_reason,
          postpone_from_date: postponeForm.postpone_from_date,
          postpone_to_date: postponeForm.postpone_to_date,
          postpone_remind_date: postponeForm.postpone_remind_date,
          duration_months: postponeForm.duration_months
            ? parseInt(postponeForm.duration_months, 10)
            : null,
          deferred_subjects: postponeForm.deferred_subjects,
          form_file_url: postponeForm.form_file_url,
          form_file_name: postponeForm.form_file_name,
          admin_note: postponeForm.admin_note,
          send_email_now: postponeForm.send_email_now,
          cc_emails: postponeForm.cc_emails,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setPostponeNotice({
          type: 'success',
          text:
            json.message ||
            'Đã lưu hồ sơ Bảo lưu và lên lịch nhắc Email Remind cho Học vụ thành công.',
        });
        fetchPostponeInfo();
        if (onPostponeSaved) {
          onPostponeSaved({
            postpone_reason: postponeForm.postpone_reason,
            postpone_from_date: postponeForm.postpone_from_date,
            postpone_to_date: postponeForm.postpone_to_date,
            postpone_remind_date: postponeForm.postpone_remind_date,
            duration_months: postponeForm.duration_months
              ? parseInt(postponeForm.duration_months, 10)
              : null,
            deferred_subjects: postponeForm.deferred_subjects,
            form_file_url: postponeForm.form_file_url,
            form_file_name: postponeForm.form_file_name,
          });
        }
      } else {
        setPostponeNotice({
          type: 'error',
          text: json.message || 'Lỗi khi lưu thông tin bảo lưu.',
        });
      }
    } catch (err: any) {
      setPostponeNotice({
        type: 'error',
        text: err?.message || 'Lỗi kết nối khi lưu hồ sơ bảo lưu.',
      });
    } finally {
      setSavingPostpone(false);
    }
  };

  // --- Grade Row Handlers ---
  const handleGradeChange = (
    idx: number,
    field: keyof SubjectGradeRow,
    value: string | number
  ) => {
    setSubjects((prev) => {
      const next = [...prev];
      const row = { ...next[idx], [field]: value };
      if (field === 'attendance_score' || field === 'assignment_score') {
        const qStr = String(field === 'attendance_score' ? value : (row.attendance_score ?? '')).trim().replace(',', '.');
        const fStr = String(field === 'assignment_score' ? value : (row.assignment_score ?? '')).trim().replace(',', '.');
        if (qStr !== '' && fStr !== '' && !Number.isNaN(Number(qStr)) && !Number.isNaN(Number(fStr))) {
          const avg6 = Math.round(((Number(qStr) * 0.5) + (Number(fStr) * 0.5)) * 100) / 100;
          row.final_score = String(avg6);
          row.letter_grade = computeAutoLetter(avg6);
          row.status = avg6 >= 4.0 ? 'passed' : 'failed';
        }
      }
      if (field === 'final_score') {
        const num = parseFloat(String(value).replace(',', '.'));
        if (!Number.isNaN(num)) {
          const score6 = num > 10 ? (num / 100) * 6 : num > 6 ? (num / 10) * 6 : num;
          row.letter_grade = computeAutoLetter(num);
          row.status = score6 >= 4.0 ? 'passed' : 'failed';
        }
      }
      next[idx] = row;
      return next;
    });
  };

  const handleAddSubjectRow = () => {
    setSubjects((prev) => [
      ...prev,
      {
        subject_id: null,
        subject_code: `SUB-${String(prev.length + 1).padStart(2, '0')}`,
        subject_name: '',
        credits: 3,
        sessions_count: 6,
        lecturer_name: '',
        attendance_score: '',
        assignment_score: '',
        final_score: '',
        letter_grade: '',
        status: 'studying',
        note: '',
        is_custom: true,
      },
    ]);
  };

  const handleQuickSelectProgram = (targetProgram: string) => {
    prevProgramRef.current = targetProgram;
    applyInstantCurriculumSubjects(targetProgram);
    if (onProgramChange) {
      onProgramChange(targetProgram);
    }
    fetchStudentGrades(targetProgram);
  };

  const handleSaveStudentGrades = async () => {
    if (!contactId) return;
    setSavingGrades(true);
    setGradeSaveNotice(null);
    try {
      const validRows = subjects.filter((s) => String(s.subject_name || '').trim() !== '');
      const res = await apiFetch(`${API_URL}/academic/student-grades/${contactId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign_id: resolvedCampaignId || campaignId || 0,
          grades: validRows,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setGradeSaveNotice({
          type: 'success',
          text: json.message || 'Đã lưu bảng điểm môn học thành công.',
        });
        fetchStudentGrades();
        if (onGradesSaved) onGradesSaved();
      } else {
        setGradeSaveNotice({
          type: 'error',
          text: json.message || 'Không thể lưu bảng điểm.',
        });
      }
    } catch (err: any) {
      setGradeSaveNotice({
        type: 'error',
        text: err?.message || 'Lỗi kết nối khi lưu bảng điểm.',
      });
    } finally {
      setSavingGrades(false);
    }
  };

  // Render Postpone Section (reusable in both full workspace & postpone modal)
  const renderPostponeSection = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Upload Form Bảo Lưu + AI OCR Banner */}
      <div
        style={{
          padding: '16px',
          borderRadius: '12px',
          border: '1px dashed #f59e0b',
          background: '#fffbeb',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', flex: '1 1 280px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: '#f59e0b',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Sparkles size={18} strokeWidth={1.75} />
          </div>
          <div>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#92400e' }}>
              Upload Form Bảo Lưu Học Viên Đã Điền (Tự Động Trích Xuất & Tính Ngày Email Remind)
            </div>
            <div style={{ fontSize: '0.75rem', color: '#78350f', marginTop: '2px' }}>
              Hỗ trợ file <strong>Word (.docx), PDF, hoặc Ảnh chụp đơn</strong>. Hệ thống tự động
              lưu vào Hồ sơ & Tài liệu, đọc Lý do, Thời hạn bảo lưu và tính ngày nhắc gửi Email
              Remind.
            </div>
            {postponeForm.form_file_name && (
              <div
                style={{
                  marginTop: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: '#ffffff',
                  border: '1px solid #fcd34d',
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  color: '#b45309',
                }}
              >
                Đã đính kèm: {postponeForm.form_file_name}
                {postponeForm.form_file_url && (
                  <a
                    href={postponeForm.form_file_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#1d4ed8', textDecoration: 'underline', marginLeft: '4px' }}
                  >
                    Xem file
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUploadPostponeFormOcr(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={ocrUploading}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: 'none',
              background: '#d97706',
              color: '#ffffff',
              fontSize: '0.78rem',
              fontWeight: 700,
              cursor: ocrUploading ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(217, 119, 6, 0.25)',
            }}
          >
            {ocrUploading ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Đang đọc đơn bằng AI...
              </>
            ) : (
              <>
                <FileUp size={15} />
                Tải Form Bảo Lưu & Tự Điền
              </>
            )}
          </button>
        </div>
      </div>

      {postponeNotice && (
        <div
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            background: postponeNotice.type === 'success' ? '#ecfdf5' : '#fef2f2',
            border: `1px solid ${postponeNotice.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
            color: postponeNotice.type === 'success' ? '#047857' : '#b91c1c',
            fontSize: '0.78rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          {postponeNotice.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{postponeNotice.text}</span>
        </div>
      )}

      {/* Form Fields Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: '10px',
          background: '#f8fafc',
          padding: '12px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
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
            Ngày bắt đầu bảo lưu *
          </label>
          <input
            type="date"
            value={postponeForm.postpone_from_date}
            onChange={(e) =>
              setPostponeForm((prev) => ({ ...prev, postpone_from_date: e.target.value }))
            }
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem',
              background: '#fff',
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
            Số tháng bảo lưu
          </label>
          <div style={{ display: 'flex', gap: '4px' }}>
            <input
              type="number"
              min={1}
              max={24}
              placeholder="VD: 6"
              value={postponeForm.duration_months}
              onChange={(e) => handleDurationMonthsChange(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px',
                borderRadius: '7px',
                border: '1px solid #cbd5e1',
                fontSize: '0.8rem',
                background: '#fff',
              }}
            />
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleDurationMonthsChange(String(m))}
                style={{
                  padding: '0 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background:
                    postponeForm.duration_months === String(m) ? '#0f172a' : '#ffffff',
                  color: postponeForm.duration_months === String(m) ? '#ffffff' : '#334155',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {m}T
              </button>
            ))}
          </div>
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
            Hạn kết thúc bảo lưu (Quay lại học) *
          </label>
          <input
            type="date"
            value={postponeForm.postpone_to_date}
            onChange={(e) => handleToDateChange(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem',
              background: '#fff',
            }}
          />
        </div>

        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '4px',
            }}
          >
            <label style={{ fontSize: '0.72rem', fontWeight: 800, color: '#BD1D2D' }}>
              Ngày Email Remind tự động
            </label>
            <div style={{ display: 'flex', gap: '3px' }}>
              {[7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setRemindLeadDays(d);
                    if (postponeForm.postpone_to_date) {
                      setPostponeForm((prev) => ({
                        ...prev,
                        postpone_remind_date: recalcRemindDate(prev.postpone_to_date, d),
                      }));
                    }
                  }}
                  style={{
                    padding: '1px 5px',
                    borderRadius: '4px',
                    border: '1px solid #fecaca',
                    background: remindLeadDays === d ? '#BD1D2D' : '#fff',
                    color: remindLeadDays === d ? '#fff' : '#BD1D2D',
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                  title={`Nhắc trước ${d} ngày khi hết hạn bảo lưu`}
                >
                  -{d}n
                </button>
              ))}
            </div>
          </div>
          <input
            type="date"
            value={postponeForm.postpone_remind_date}
            onChange={(e) =>
              setPostponeForm((prev) => ({ ...prev, postpone_remind_date: e.target.value }))
            }
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '7px',
              border: '1.5px solid #fca5a5',
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#991b1b',
              background: '#fef2f2',
            }}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
            Lý do bảo lưu (Tự động trích xuất từ đơn)
          </label>
          <input
            type="text"
            placeholder="VD: Bận công tác nước ngoài / Lý do sức khỏe & gia đình..."
            value={postponeForm.postpone_reason}
            onChange={(e) =>
              setPostponeForm((prev) => ({ ...prev, postpone_reason: e.target.value }))
            }
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem',
              background: '#fff',
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
            Các môn học bảo lưu / Ghi chú môn còn nợ
          </label>
          <input
            type="text"
            placeholder="VD: Strategic Management, Financial Management..."
            value={postponeForm.deferred_subjects}
            onChange={(e) =>
              setPostponeForm((prev) => ({ ...prev, deferred_subjects: e.target.value }))
            }
            style={{
              width: '100%',
              padding: '7px 10px',
              borderRadius: '7px',
              border: '1px solid #cbd5e1',
              fontSize: '0.8rem',
              background: '#fff',
            }}
          />
        </div>
      </div>

      {/* Email Confirmation & Save Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          padding: '10px 12px',
          borderRadius: '9px',
          background: '#f1f5f9',
          border: '1px solid #e2e8f0',
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.76rem',
            fontWeight: 600,
            color: '#1e293b',
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={postponeForm.send_email_now}
            onChange={(e) =>
              setPostponeForm((prev) => ({ ...prev, send_email_now: e.target.checked }))
            }
          />
          <Mail size={14} color="#BD1D2D" />
          <span>
            Gửi ngay Email xác nhận Bảo lưu & Lịch Remind cho Học viên ({studentEmail || 'chưa có email'}) + CC Học vụ
          </span>
        </label>

        <button
          type="button"
          disabled={savingPostpone}
          onClick={handleSavePostpone}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: '#BD1D2D',
            color: '#fff',
            fontSize: '0.78rem',
            fontWeight: 700,
            cursor: savingPostpone ? 'not-allowed' : 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {savingPostpone ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Save size={14} />
              Lưu Bảo Lưu & Đặt Lịch Email Remind
            </>
          )}
        </button>
      </div>
    </div>
  );

  if (mode === 'postpone_inline') {
    return renderPostponeSection();
  }

  return (
    <div
      style={{
        marginTop: '14px',
        padding: '14px 16px',
        borderRadius: '14px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
      }}
    >
      {/* Header with Segmented Control & Quick Class Actions */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          marginBottom: isCollapsed ? 0 : '12px',
          paddingBottom: isCollapsed ? 0 : '10px',
          borderBottom: isCollapsed ? 'none' : '1px solid #f1f5f9',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'rgba(189, 29, 45, 0.08)',
              color: '#BD1D2D',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BookOpen size={16} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 800, color: '#0f172a' }}>
                DANH SÁCH MÔN HỌC, BẢNG ĐIỂM & BẢO LƯU HỌC VỤ
              </span>
              {summary.gpa_10 !== null && (
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: 'rgba(189, 29, 45, 0.08)',
                    color: '#BD1D2D',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                  }}
                >
                  GPA: {summary.gpa_10}/6.0
                </span>
              )}
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '6px',
                  background: '#f1f5f9',
                  color: '#334155',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                }}
              >
                Hoàn thành: {summary.passed_count}/{summary.total_subjects} môn ({summary.completion_pct}%)
              </span>
            </div>
            <div style={{ fontSize: '0.73rem', color: '#64748b', marginTop: '1px' }}>
              Chương trình: <strong style={{ color: '#0f172a' }}>{resolvedCourseName || programName || 'Chưa gán lớp'}</strong>
              {postponeForm.postpone_remind_date && (
                <span style={{ marginLeft: '10px', color: '#b45309', fontWeight: 700 }}>
                  • Ngày Email Remind Bảo lưu: {postponeForm.postpone_remind_date}
                </span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Canonical Segmented Subtab */}
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '10px',
              background: '#f1f5f9',
              border: '1px solid #e2e8f0',
              gap: '2px',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setActiveSubTab('grades');
                setIsCollapsed(false);
              }}
              style={{
                height: '30px',
                padding: '0 12px',
                borderRadius: '7px',
                border: 'none',
                background: activeSubTab === 'grades' ? '#ffffff' : 'transparent',
                color: activeSubTab === 'grades' ? '#BD1D2D' : '#64748b',
                fontWeight: activeSubTab === 'grades' ? 700 : 600,
                fontSize: '0.75rem',
                boxShadow: activeSubTab === 'grades' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Award size={13} />
              Môn học & Chỉnh điểm ({subjects.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSubTab('postpone');
                setIsCollapsed(false);
              }}
              style={{
                height: '30px',
                padding: '0 12px',
                borderRadius: '7px',
                border: 'none',
                background: activeSubTab === 'postpone' ? '#ffffff' : 'transparent',
                color: activeSubTab === 'postpone' ? '#BD1D2D' : '#64748b',
                fontWeight: activeSubTab === 'postpone' ? 700 : 600,
                fontSize: '0.75rem',
                boxShadow: activeSubTab === 'postpone' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <PauseCircle size={13} />
              Form Bảo lưu & Email Remind
            </button>
          </div>

          {/* Bulk Class Gradebook Button */}
          <button
            type="button"
            onClick={() => setShowClassGradebookModal(true)}
            style={{
              height: '32px',
              padding: '0 12px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#0f172a',
              color: '#ffffff',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Up điểm 1 lần cho cả lớp (Ma trận hoặc Import Excel/CSV)"
          >
            <FileSpreadsheet size={14} />
            Bảng điểm lớp
          </button>

          <button
            type="button"
            onClick={() => setIsCollapsed((c) => !c)}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '7px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title={isCollapsed ? 'Mở rộng' : 'Thu gọn'}
          >
            {isCollapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
          </button>
        </div>
      </div>

      {!isCollapsed && activeSubTab === 'grades' && (
        <div>
          {/* Sleek Single-Line Executive Toolbar: Program Selector + 6.0 Scale Hint + Compact Actions */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '8px 12px',
              marginBottom: '10px',
              borderRadius: '10px',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
            }}
          >
            {(() => {
              const activeMatchKey = matchStandardProgramKey(resolvedCourseName || programName || '') || '';
              return (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        color: '#475569',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Lộ trình:
                    </span>
                    <select
                      value={activeMatchKey}
                      onChange={(e) => {
                        if (e.target.value) {
                          handleQuickSelectProgram(e.target.value);
                        }
                      }}
                      style={{
                        height: '30px',
                        width: 'auto',
                        minWidth: '170px',
                        maxWidth: '220px',
                        padding: '0 10px',
                        borderRadius: '7px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      <option value="">— Chọn Chương trình ({STANDARD_PROGRAM_NAMES.length} CT) —</option>
                      {STANDARD_PROGRAM_NAMES.map((progKey, pIdx) => {
                        const subCount = (STANDARD_PROGRAM_CURRICULUMS[progKey] || []).length;
                        return (
                          <option key={progKey} value={progKey}>
                            {pIdx + 1}/ {progKey} ({subCount} môn)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => {
                        const firstSubj = subjects[0] || {
                          subject_code: 'M01',
                          subject_name: resolvedCourseName || programName || 'Môn học Chuyên đề',
                        };
                        setTbcdModalSubject({
                          ...firstSubj,
                          code: firstSubj.subject_code,
                          name: firstSubj.subject_name,
                        });
                      }}
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        borderRadius: '7px',
                        border: '1px solid #fecaca',
                        background: '#fef2f2',
                        color: '#BD1D2D',
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap',
                      }}
                      title="Mở trình Gửi Thông báo Chuyên đề & Lịch học môn tự động điền từ Học vụ"
                    >
                      <Send size={12} />
                      Gửi TBCĐ Môn
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const firstSubj = subjects[0] || {
                          subject_code: 'M01',
                          subject_name: resolvedCourseName || programName || 'Accounting for Managers',
                        };
                        setTmgModalSubject({
                          ...firstSubj,
                          program_name: resolvedCourseName || programName || 'Swiss UMEF MBA/EMBA',
                          campaign_name: resolvedCourseName || programName || '',
                        });
                      }}
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        borderRadius: '7px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: '0.73rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap',
                      }}
                      title="Mở trình Gửi Thư Mời Giảng & Hợp Đồng Giảng Dạy (TMG chuẩn IDEAS)"
                    >
                      <GraduationCap size={13} color="#BD1D2D" />
                      Mời Giảng Viên (TMG)
                    </button>

                    <button
                      type="button"
                      onClick={handleDownloadProgramGradeTemplate}
                      style={{
                        height: '30px',
                        padding: '0 10px',
                        borderRadius: '7px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#334155',
                        fontSize: '0.73rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        whiteSpace: 'nowrap',
                      }}
                      title="Tải File Excel / CSV mẫu theo môn học (Thang điểm 6.0)"
                    >
                      <Download size={12} color="#15803d" />
                      Tải Mẫu Điểm (.CSV)
                    </button>
                  </div>
                </>
              );
            })()}
          </div>

          {gradeSaveNotice && (
            <div
              style={{
                marginBottom: '10px',
                padding: '9px 12px',
                borderRadius: '8px',
                background: gradeSaveNotice.type === 'success' ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${gradeSaveNotice.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
                color: gradeSaveNotice.type === 'success' ? '#047857' : '#b91c1c',
                fontSize: '0.78rem',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{gradeSaveNotice.text}</span>
              <button
                type="button"
                onClick={() => setGradeSaveNotice(null)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>
          )}

          {loadingGrades ? (
            <div
              style={{
                padding: '24px',
                textAlign: 'center',
                color: '#64748b',
                fontSize: '0.8rem',
              }}
            >
              <Loader2 size={18} className="animate-spin" style={{ display: 'inline', marginRight: '6px' }} />
              Đang tải danh sách môn học & bảng điểm...
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                <table
                  style={{
                    width: '100%',
                    tableLayout: 'fixed',
                    borderCollapse: 'collapse',
                    fontSize: '0.75rem',
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        background: '#f8fafc',
                        borderBottom: '1px solid #e2e8f0',
                        color: '#475569',
                        textAlign: 'left',
                      }}
                    >
                      <th style={{ padding: '7px 4px', fontWeight: 700, width: '28px', textAlign: 'center', overflow: 'visible', textOverflow: 'clip' }}>#</th>
                      <th style={{ padding: '7px 8px', fontWeight: 700, width: '24%', overflow: 'visible', textOverflow: 'clip' }}>
                        Môn học / Chuyên đề
                      </th>
                      <th style={{ padding: '7px 6px', fontWeight: 700, width: '17%', overflow: 'visible', textOverflow: 'clip' }}>
                        Giảng viên
                      </th>
                      <th style={{ padding: '7px 2px', fontWeight: 700, width: '68px', textAlign: 'center', overflow: 'visible', textOverflow: 'clip', whiteSpace: 'nowrap' }}>
                        Quiz 50%
                      </th>
                      <th style={{ padding: '7px 2px', fontWeight: 700, width: '68px', textAlign: 'center', overflow: 'visible', textOverflow: 'clip', whiteSpace: 'nowrap' }}>
                        Final 50%
                      </th>
                      <th style={{ padding: '7px 2px', fontWeight: 700, width: '72px', textAlign: 'center', color: '#BD1D2D', overflow: 'visible', textOverflow: 'clip', whiteSpace: 'nowrap' }}>
                        Điểm TK
                      </th>
                      <th style={{ padding: '7px 2px', fontWeight: 700, width: '68px', textAlign: 'center', overflow: 'visible', textOverflow: 'clip', whiteSpace: 'nowrap' }}>
                        Điểm chữ
                      </th>
                      <th style={{ padding: '7px 4px', fontWeight: 700, width: '96px', overflow: 'visible', textOverflow: 'clip', whiteSpace: 'nowrap' }}>
                        Trạng thái
                      </th>
                      <th style={{ padding: '7px 6px', fontWeight: 700, width: '11%', overflow: 'visible', textOverflow: 'clip' }}>
                        Ghi chú
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.length === 0 ? (
                      <tr>
                        <td
                          colSpan={9}
                          style={{
                            padding: '20px',
                            textAlign: 'center',
                            color: '#64748b',
                          }}
                        >
                          Chưa có môn học nào trong chương trình này. Bấm{' '}
                          <strong>"Thêm môn học"</strong> bên dưới để nhập điểm ngay.
                        </td>
                      </tr>
                    ) : (
                      subjects.map((subj, idx) => {
                        const stMeta = STATUS_META[subj.status] || STATUS_META.studying;
                        return (
                          <tr
                            key={`${subj.subject_code}-${idx}`}
                            style={{
                              borderBottom: '1px solid #f1f5f9',
                              background: idx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                            }}
                          >
                            <td style={{ padding: '6px 4px', color: '#64748b', fontWeight: 600, textAlign: 'center', overflow: 'visible', textOverflow: 'clip' }}>
                              {idx + 1}
                            </td>
                            <td style={{ padding: '6px 6px', overflow: 'hidden' }}>
                              {subj.subject_id || (!subj.is_custom && subj.subject_name) ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {cleanSubjectNameWithoutCode(subj.subject_name)}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setTbcdModalSubject({
                                        ...subj,
                                        code: subj.subject_code,
                                        name: subj.subject_name,
                                      })
                                    }
                                    style={{
                                      padding: '2px 6px',
                                      borderRadius: '5px',
                                      border: '1px solid #fecaca',
                                      background: '#fef2f2',
                                      color: '#BD1D2D',
                                      fontSize: '0.64rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                      whiteSpace: 'nowrap',
                                      flexShrink: 0,
                                    }}
                                    title="Gửi Thông báo Chuyên đề & Lịch học môn này"
                                  >
                                    <Send size={10} />
                                    TBCĐ
                                  </button>
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="Nhập tên môn học..."
                                  value={subj.subject_name}
                                  onChange={(e) =>
                                    handleGradeChange(idx, 'subject_name', e.target.value)
                                  }
                                  style={{
                                    width: '100%',
                                    padding: '5px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.78rem',
                                    fontWeight: 600,
                                  }}
                                />
                              )}
                            </td>
                            <td style={{ padding: '6px 6px', color: '#334155', fontSize: '0.73rem', overflow: 'hidden' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                                  {subj.lecturer_name || <span style={{ color: '#94a3b8' }}>Chưa gán</span>}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTmgModalSubject({
                                      ...subj,
                                      program_name: resolvedCourseName || programName || 'Swiss UMEF MBA/EMBA',
                                      campaign_name: resolvedCourseName || programName || '',
                                    });
                                  }}
                                  style={{
                                    padding: '2px 5px',
                                    borderRadius: '5px',
                                    border: '1px solid #cbd5e1',
                                    background: '#f8fafc',
                                    color: '#0f172a',
                                    fontSize: '0.64rem',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    whiteSpace: 'nowrap',
                                    flexShrink: 0,
                                  }}
                                  title="Gửi Thư Mời Giảng & Hợp Đồng (TMG) cho Giảng viên môn này"
                                >
                                  <GraduationCap size={10} color="#BD1D2D" />
                                  Mời GV
                                </button>
                              </div>
                            </td>
                            <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                max="6"
                                placeholder="0-6"
                                value={subj.attendance_score}
                                onChange={(e) =>
                                  handleGradeChange(idx, 'attendance_score', e.target.value)
                                }
                                style={{
                                  width: '54px',
                                  padding: '4px 4px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  textAlign: 'center',
                                  fontSize: '0.76rem',
                                }}
                              />
                            </td>
                            <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                max="6"
                                placeholder="0-6"
                                value={subj.assignment_score}
                                onChange={(e) =>
                                  handleGradeChange(idx, 'assignment_score', e.target.value)
                                }
                                style={{
                                  width: '54px',
                                  padding: '4px 4px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  textAlign: 'center',
                                  fontSize: '0.76rem',
                                }}
                              />
                            </td>
                            <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                              <input
                                type="number"
                                step="0.25"
                                min="0"
                                max="6"
                                placeholder="0.0-6.0"
                                value={subj.final_score}
                                onChange={(e) =>
                                  handleGradeChange(idx, 'final_score', e.target.value)
                                }
                                style={{
                                  width: '60px',
                                  padding: '4px 4px',
                                  borderRadius: '6px',
                                  border: '1.5px solid #cbd5e1',
                                  textAlign: 'center',
                                  fontSize: '0.78rem',
                                  fontWeight: 800,
                                  color: '#0f172a',
                                  background: '#f8fafc',
                                }}
                              />
                            </td>
                            <td style={{ padding: '5px 4px', textAlign: 'center' }}>
                              <input
                                type="text"
                                placeholder="A-F"
                                value={subj.letter_grade}
                                onChange={(e) =>
                                  handleGradeChange(idx, 'letter_grade', e.target.value.toUpperCase())
                                }
                                style={{
                                  width: '54px',
                                  padding: '4px 3px',
                                  borderRadius: '6px',
                                  border: '1px solid #cbd5e1',
                                  textAlign: 'center',
                                  fontSize: '0.72rem',
                                  fontWeight: 700,
                                }}
                              />
                            </td>
                            <td style={{ padding: '5px 4px' }}>
                              <select
                                value={subj.status}
                                onChange={(e) =>
                                  handleGradeChange(idx, 'status', e.target.value as any)
                                }
                                style={{
                                  width: '92px',
                                  padding: '4px 4px',
                                  borderRadius: '6px',
                                  border: `1px solid ${stMeta.border}`,
                                  background: stMeta.bg,
                                  color: stMeta.color,
                                  fontSize: '0.71rem',
                                  fontWeight: 700,
                                }}
                              >
                                <option value="studying">Đang học</option>
                                <option value="passed">Hoàn thành</option>
                                <option value="failed">Chưa đạt</option>
                                <option value="postponed">Bảo lưu</option>
                                <option value="exempt">Miễn giảm</option>
                              </select>
                            </td>
                            <td style={{ padding: '5px 6px' }}>
                              <input
                                type="text"
                                placeholder="Ghi chú..."
                                value={subj.note}
                                onChange={(e) => handleGradeChange(idx, 'note', e.target.value)}
                                style={{
                                  width: '100%',
                                  padding: '4px 6px',
                                  borderRadius: '6px',
                                  border: '1px solid #e2e8f0',
                                  fontSize: '0.73rem',
                                }}
                              />
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action Bar below Grade Table */}
              <div
                style={{
                  marginTop: '10px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleAddSubjectRow}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '7px',
                      border: '1px dashed #94a3b8',
                      background: '#f8fafc',
                      color: '#334155',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Plus size={14} />
                    Thêm môn học
                  </button>

                  <button
                    type="button"
                    onClick={() => fetchStudentGrades()}
                    style={{
                      padding: '6px 10px',
                      borderRadius: '7px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                      color: '#475569',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <RefreshCw size={13} />
                    Làm mới
                  </button>

                  {booking1on1Url && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '7px',
                        background: '#f1f5f9',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.73rem',
                      }}
                    >
                      <Calendar size={13} color="#BD1D2D" />
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>Form Hướng dẫn 1:1:</span>
                      <a
                        href={booking1on1Url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: '#BD1D2D',
                          fontWeight: 700,
                          textDecoration: 'none',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        Mở Form <ExternalLink size={11} />
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(booking1on1Url);
                          setGradeSaveNotice({
                            type: 'success',
                            text: 'Đã sao chép link Form đăng ký Hướng dẫn 1:1 cho học viên.',
                          });
                        }}
                        style={{
                          border: 'none',
                          background: '#fff',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: '#334155',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                        }}
                      >
                        <Copy size={11} /> Copy
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={savingGrades}
                  onClick={handleSaveStudentGrades}
                  style={{
                    padding: '7px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#BD1D2D',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: savingGrades ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 5px rgba(189, 29, 45, 0.25)',
                  }}
                >
                  {savingGrades ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Đang lưu điểm...
                    </>
                  ) : (
                    <>
                      <Save size={14} />
                      Lưu bảng điểm môn học
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {!isCollapsed && activeSubTab === 'postpone' && renderPostponeSection()}

      {/* Bulk Class Gradebook Modal */}
      {showClassGradebookModal && (
        <ClassGradebookModal
          isOpen={showClassGradebookModal}
          onClose={() => {
            setShowClassGradebookModal(false);
            fetchStudentGrades();
          }}
          initialCampaignId={resolvedCampaignId || campaignId || null}
          initialProgramName={resolvedCourseName || programName || ''}
          onSaved={() => fetchStudentGrades()}
        />
      )}

      {/* Lecturer Invitation & Contract Modal (TMG Chuẩn IDEAS) */}
      {tmgModalSubject && (
        <LecturerInvitationModal
          isOpen={!!tmgModalSubject}
          onClose={() => setTmgModalSubject(null)}
          subject={tmgModalSubject}
          allSubjects={subjects}
          campaign={
            resolvedCampaignId || campaignId
              ? {
                  id: resolvedCampaignId || campaignId || undefined,
                  name: resolvedCourseName || programName || '',
                  project_name: programName || resolvedCourseName || '',
                }
              : null
          }
          programName={resolvedCourseName || programName || ''}
          lecturer={
            tmgModalSubject.lecturer_name
              ? {
                  name: tmgModalSubject.lecturer_name,
                  id: tmgModalSubject.lecturer_id,
                  email: tmgModalSubject.lecturer_email,
                  phone: tmgModalSubject.lecturer_phone,
                }
              : null
          }
          addToast={(msg, type) => {
            setGradeSaveNotice({
              type: type === 'error' ? 'error' : 'success',
              text: msg,
            });
          }}
        />
      )}

      {/* Subject Announcement Modal (Gửi TBCĐ Tự Động) */}
      {tbcdModalSubject && (
        <SubjectAnnouncementModal
          isOpen={!!tbcdModalSubject}
          onClose={() => setTbcdModalSubject(null)}
          subject={tbcdModalSubject}
          allSubjects={subjects.map((s) => ({
            ...s,
            code: s.subject_code,
            name: s.subject_name,
          }))}
          campaign={
            resolvedCampaignId || campaignId
              ? {
                  id: resolvedCampaignId || campaignId || undefined,
                  name: resolvedCourseName || programName || '',
                  project_name: programName || resolvedCourseName || '',
                }
              : null
          }
          programName={resolvedCourseName || programName || ''}
          preselectedStudent={
            studentEmail
              ? {
                  id: contactId,
                  full_name: studentName,
                  email: studentEmail,
                  program: resolvedCourseName || programName || '',
                }
              : null
          }
          addToast={(msg, type) => {
            setGradeSaveNotice({
              type: type === 'error' ? 'error' : 'success',
              text: msg,
            });
          }}
        />
      )}
    </div>
  );
};

export default StudentAcademicWorkspace;
