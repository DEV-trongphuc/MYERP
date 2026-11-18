import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, BookOpen, Upload, Download, Save, Search, CheckCircle2,
  AlertCircle, Loader2, FileSpreadsheet, Users, Award, Check
} from 'lucide-react';
import api from '../../api/axios';
import { toast } from 'react-hot-toast';
import {
  STANDARD_PROGRAM_NAMES,
  STANDARD_PROGRAM_CURRICULUMS,
  matchStandardProgramKey,
  resolveCurriculumSubjects
} from './StudentAcademicWorkspace';

interface ClassGradebookModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCampaignId?: number | null;
  initialProjectId?: number | null;
  initialProgramName?: string;
  initialSubjectKey?: string;
  campaignsList?: any[];
  projectsList?: any[];
  onSaved?: () => void;
  zIndex?: number;
}

const cleanSubjectNameWithoutCode = (rawName: string): string => {
  const s = String(rawName || '').trim();
  const stripped = s
    .replace(/^\[[A-Z0-9_-]+\]\s*/i, '')
    .replace(/^([A-Z]{2,8}[-_][A-Z0-9_-]+)\s*[-–:]?\s*/i, '')
    .replace(/^\d+[\.\-_/:\s]+/, '')
    .trim();
  return stripped || s;
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
export const inferEctsGrade6 = (scoreStr: string) => {
  const trimmed = String(scoreStr || '').trim().replace(',', '.');
  if (trimmed === '' || isNaN(Number(trimmed))) {
    return null;
  }
  const raw = Number(trimmed);
  const score6 = raw > 10 ? Math.round((raw / 100) * 6 * 100) / 100 : raw > 6 ? Math.round((raw / 10) * 6 * 100) / 100 : raw;
  if (score6 >= 5.25) return { score6, letter: 'A (Excellent)', short: 'A', status: 'passed' };
  if (score6 >= 4.75) return { score6, letter: 'B (Very Good)', short: 'B', status: 'passed' };
  if (score6 >= 4.50) return { score6, letter: 'C (Good)', short: 'C', status: 'passed' };
  if (score6 >= 4.25) return { score6, letter: 'D (Satisfactory)', short: 'D', status: 'passed' };
  if (score6 >= 4.00) return { score6, letter: 'E (Pass)', short: 'E', status: 'passed' };
  const failLabel = score6 >= 3.50 ? 'F (Fail - Retake)' : 'F (Fail - Redo)';
  return { score6, letter: failLabel, short: 'F', status: 'failed' };
};

export const ClassGradebookModal: React.FC<ClassGradebookModalProps> = ({
  isOpen,
  onClose,
  initialCampaignId,
  initialProjectId,
  initialProgramName = '',
  initialSubjectKey,
  campaignsList = [],
  projectsList = [],
  onSaved,
  zIndex = 2147483646
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<number>(Number(initialCampaignId || 0));
  const [selectedProgram, setSelectedProgram] = useState<string>(() => {
    return matchStandardProgramKey(initialProgramName) || initialProgramName || 'BBA';
  });
  const [localCampaigns, setLocalCampaigns] = useState<any[]>(Array.isArray(campaignsList) ? campaignsList : []);
  const initialSubs = useMemo(
    () =>
      resolveCurriculumSubjects(matchStandardProgramKey(initialProgramName) || initialProgramName || 'BBA').map((s, idx) => ({
        index: idx,
        code: s.code,
        name: cleanSubjectNameWithoutCode(s.name),
        key: s.code || s.name
      })),
    [initialProgramName]
  );
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string>(() => {
    if (initialSubjectKey) return initialSubjectKey;
    return initialSubs[0]?.key || 'ALL';
  });
  const [activeMode, setActiveMode] = useState<'grid' | 'import'>('grid');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);

  const [courseInfo, setCourseInfo] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>(initialSubs);
  const [students, setStudents] = useState<any[]>([]);
  // Local editable matrix: { [contactId]: { [subjectKey]: { final_score, letter_grade, status, note, attendance_score, assignment_score } } }
  const [matrix, setMatrix] = useState<Record<number, Record<string, any>>>({});
  const [dirtyCount, setDirtyCount] = useState<number>(0);

  // Import state
  const [importText, setImportText] = useState<string>('');
  const [importPreviewRows, setImportPreviewRows] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    if (Array.isArray(campaignsList) && campaignsList.length > 0) {
      setLocalCampaigns(campaignsList);
    } else if (isOpen && localCampaigns.length === 0) {
      api.get('/campaigns').then(res => {
        const list = Array.isArray(res.data?.data) ? res.data.data : (Array.isArray(res.data?.data?.items) ? res.data.data.items : []);
        if (list.length > 0) {
          setLocalCampaigns(list);
        }
      }).catch(() => {});
    }
  }, [isOpen, campaignsList]);

  useEffect(() => {
    if (isOpen && initialCampaignId && Number(initialCampaignId) > 0) {
      setSelectedCampaignId(Number(initialCampaignId));
    }
  }, [isOpen, initialCampaignId]);

  const loadGradebook = async (campId: number, progOverride?: string) => {
    const effectiveProg = progOverride !== undefined ? progOverride : selectedProgram;
    const fallbackSubs = effectiveProg
      ? resolveCurriculumSubjects(effectiveProg).map((s, idx) => ({
          index: idx,
          code: s.code,
          name: cleanSubjectNameWithoutCode(s.name),
          key: s.code || s.name
        }))
      : [];
    if (fallbackSubs.length > 0) {
      setSubjects(fallbackSubs);
      setSelectedSubjectKey(prev => {
        if (prev === 'ALL') return 'ALL';
        if (fallbackSubs.some(s => s.key === prev)) return prev;
        return fallbackSubs[0]?.key || 'ALL';
      });
    }
    if ((!campId || campId <= 0) && !effectiveProg) return;
    setLoading(true);
    try {
      const res = await api.get(`/academic/class-gradebook/${campId || 0}`, {
        params: {
          project_id: initialProjectId || undefined,
          include_project: 1,
          program: effectiveProg || undefined
        }
      });
      const data = res.data?.data;
      if (data) {
        setCourseInfo(data.campaign || null);
        let rawSubs = Array.isArray(data.subjects) && data.subjects.length > 0 ? data.subjects : fallbackSubs;
        const subs = rawSubs.map((s: any, idx: number) => ({
          ...s,
          index: idx,
          name: cleanSubjectNameWithoutCode(s.name || s.subject_name || ''),
          key: s.key || s.code || s.name
        }));
        const stus = Array.isArray(data.students) ? data.students : [];
        const gMap = data.grades_map || {};
        setSubjects(subs);
        setSelectedSubjectKey(prev => {
          if (prev === 'ALL') return 'ALL';
          if (subs.some((s: any) => s.key === prev)) return prev;
          return subs[0]?.key || 'ALL';
        });
        setStudents(stus);

        const nextMatrix: Record<number, Record<string, any>> = {};
        stus.forEach((st: any) => {
          const cid = Number(st.id);
          nextMatrix[cid] = {};
          const stuGrades = gMap[cid] || {};
          subs.forEach((sub: any) => {
            const existing = stuGrades[sub.code] || stuGrades[sub.name] || {};
            const rawFin = existing.final_score ?? '';
            const inferred = rawFin !== '' ? inferEctsGrade6(String(rawFin)) : null;
            nextMatrix[cid][sub.key] = {
              subject_code: sub.code,
              subject_name: sub.name,
              attendance_score: existing.attendance_score ?? '',
              assignment_score: existing.assignment_score ?? '',
              final_score: rawFin,
              letter_grade: inferred ? inferred.letter : (existing.letter_grade ?? ''),
              status: inferred ? inferred.status : (existing.status ?? 'studying'),
              note: existing.note ?? ''
            };
          });
        });
        setMatrix(nextMatrix);
        setDirtyCount(0);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Không thể tải bảng điểm lớp');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && (selectedCampaignId > 0 || selectedProgram)) {
      loadGradebook(selectedCampaignId, selectedProgram);
    }
  }, [isOpen, selectedCampaignId, selectedProgram]);

  const inferGradeAndStatus = (scoreStr: string) => {
    return inferEctsGrade6(scoreStr);
  };

  const handleCellChange = (contactId: number, subKey: string, field: string, value: string) => {
    setMatrix(prev => {
      const stuRow = { ...(prev[contactId] || {}) };
      const cell = { ...(stuRow[subKey] || {}) };
      cell[field] = value;

      if (field === 'attendance_score' || field === 'assignment_score') {
        const qStr = String(field === 'attendance_score' ? value : (cell.attendance_score ?? '')).trim().replace(',', '.');
        const fStr = String(field === 'assignment_score' ? value : (cell.assignment_score ?? '')).trim().replace(',', '.');
        if (qStr !== '' && fStr !== '' && !isNaN(Number(qStr)) && !isNaN(Number(fStr))) {
          const avg6 = Math.round(((Number(qStr) * 0.5) + (Number(fStr) * 0.5)) * 100) / 100;
          cell.final_score = String(avg6);
          const inferred = inferGradeAndStatus(cell.final_score);
          if (inferred) {
            cell.letter_grade = inferred.letter;
            cell.status = inferred.status;
          }
        }
      }

      if (field === 'final_score') {
        const inferred = inferGradeAndStatus(value);
        if (inferred) {
          cell.letter_grade = inferred.letter;
          cell.status = inferred.status;
        }
      }
      stuRow[subKey] = cell;
      return { ...prev, [contactId]: stuRow };
    });
    setDirtyCount(c => c + 1);
  };

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(st => {
      const name = String(st.full_name || '').toLowerCase();
      const code = String(st.student_id || '').toLowerCase();
      const email = String(st.email || '').toLowerCase();
      const phone = String(st.phone || st.mobile || '').toLowerCase();
      return name.includes(q) || code.includes(q) || email.includes(q) || phone.includes(q);
    });
  }, [students, searchQuery]);

  const visibleSubjects = useMemo(() => {
    if (selectedSubjectKey === 'ALL') return subjects;
    return subjects.filter(s => s.key === selectedSubjectKey);
  }, [subjects, selectedSubjectKey]);

  const handleSaveGrid = async () => {
    if (inFlightRef.current || saving) return;
    inFlightRef.current = true;
    setSaving(true);
    try {
      const rowsPayload = students.map(st => ({
        contact_id: Number(st.id),
        student_id: st.student_id,
        email: st.email,
        phone: st.phone,
        grades: matrix[Number(st.id)] || {}
      }));

      const res = await api.post(`/academic/class-gradebook/${selectedCampaignId}`, {
        rows: rowsPayload
      });
      toast.success(res.data?.message || 'Đã lưu bảng điểm cả lớp thành công.');
      setDirtyCount(0);
      onSaved?.();
      await loadGradebook(selectedCampaignId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi lưu bảng điểm lớp');
    } finally {
      setSaving(false);
      inFlightRef.current = false;
    }
  };

  // Download CSV Template pre-filled with class students & subjects (Per-Subject by default when 1 subject is selected, or All Subjects when 'ALL' is selected)
  const handleDownloadCsvTemplate = () => {
    const isSingleSubject = selectedSubjectKey !== 'ALL' && visibleSubjects.length === 1;
    const targetSub = isSingleSubject ? visibleSubjects[0] : null;
    const cleanTargetSubName = targetSub ? cleanSubjectNameWithoutCode(targetSub.name) : '';

    if (isSingleSubject && targetSub) {
      const headers = [
        'Contact_ID',
        'Ma_Hoc_Vien',
        'Ho_Ten',
        'Email',
        'So_Dien_Thoai',
        'Diem_Quiz_50 (0-6)',
        'Diem_Final_50 (0-6)',
        `${cleanTargetSubName} - Diem_TK (Thang 6)`,
        'Ghi_Chu'
      ];
      const csvRows = [headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',')];
      const demoRow = [
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
      csvRows.push(demoRow.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));

      students.forEach(st => {
        const cid = Number(st.id);
        const cell = matrix[cid]?.[targetSub.key] || {};
        const row = [
          String(cid),
          String(st.student_id || ''),
          String(st.full_name || ''),
          String(st.email || ''),
          String(st.phone || st.mobile || ''),
          String(cell.attendance_score ?? ''),
          String(cell.assignment_score ?? ''),
          String(cell.final_score ?? ''),
          String(cell.note ?? '')
        ];
        csvRows.push(row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
      });

      const bom = '\uFEFF';
      const blob = new Blob([bom + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeSub = cleanTargetSubName.replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Bang_Diem_Mon_${safeSub}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Đã tải file mẫu môn "${cleanTargetSubName}" (Thang điểm 6.0).`);
      return;
    }

    const headers = ['Contact_ID', 'Ma_Hoc_Vien', 'Ho_Ten', 'Email', 'So_Dien_Thoai'];
    subjects.forEach(s => {
      headers.push(cleanSubjectNameWithoutCode(s.name));
    });

    const csvRows = [headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(',')];
    // Add demo sample row on the 6.0 ECTS scale
    const demoRow = ['0', 'SV-DEMO', 'Học viên Mẫu (Ví dụ - Thang 6.0)', 'demo.student@example.com', '0901234567'];
    subjects.forEach((_, sIdx) => {
      const demoScores6 = ['5.50', '5.00', '5.75', '4.75', '4.50', '5.25', '5.50', '6.00', '4.25', '5.00', '5.50'];
      demoRow.push(demoScores6[sIdx % demoScores6.length]);
    });
    csvRows.push(demoRow.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));

    students.forEach(st => {
      const cid = Number(st.id);
      const row = [
        String(cid),
        String(st.student_id || ''),
        String(st.full_name || ''),
        String(st.email || ''),
        String(st.phone || st.mobile || '')
      ];
      subjects.forEach(s => {
        const val = matrix[cid]?.[s.key]?.final_score ?? '';
        row.push(String(val));
      });
      csvRows.push(row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    });

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeCourse = String(selectedProgram || courseInfo?.name || 'Tat_Ca_Mon').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `Bang_Diem_Tat_Ca_Mon_${safeCourse}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Đã tải xuống file mẫu tất cả môn (Thang điểm 6.0).');
  };

  // Parse CSV / TSV text into preview rows
  const parseImportContent = (rawText: string) => {
    setImportText(rawText);
    const lines = rawText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      setImportPreviewRows([]);
      return;
    }

    const detectDelimiter = (headerLine: string) => {
      if (headerLine.includes('\t')) return '\t';
      if (headerLine.split(';').length > headerLine.split(',').length) return ';';
      return ',';
    };

    const delim = detectDelimiter(lines[0]);
    const splitLine = (line: string) => {
      if (delim === '\t') return line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''));
      const result: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === delim && !inQuotes) {
          result.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      result.push(cur.trim());
      return result;
    };

    const headers = splitLine(lines[0]);
    const isSingleSubjectMode = selectedSubjectKey !== 'ALL' && visibleSubjects.length === 1;
    const activeSingleSubject = isSingleSubjectMode ? visibleSubjects[0] : (subjects[0] || null);

    // Detect special single-subject columns (Quiz, Final, Note) vs Subject Score columns
    let quizColIdx = -1;
    let finalExamColIdx = -1;
    let noteColIdx = -1;
    const colToSubject: Record<number, any> = {};

    headers.forEach((h, idx) => {
      if (idx < 2) return;
      const hClean = h.toLowerCase().trim();
      if (['contact_id', 'ma_hoc_vien', 'mã học viên', 'mã hv', 'id student', 'ho_ten', 'họ tên', 'họ và tên', 'email', 'so_dien_thoai', 'số điện thoại', 'sđt'].includes(hClean)) {
        return;
      }
      if (hClean.includes('diem_quiz') || hClean.includes('điểm quiz') || hClean.includes('chuyên cần') || hClean.includes('chuyen_can') || hClean === 'quiz') {
        quizColIdx = idx;
        return;
      }
      if (hClean.includes('diem_final') || hClean.includes('điểm final') || hClean.includes('bài tập') || hClean.includes('bai_tap') || hClean === 'final') {
        finalExamColIdx = idx;
        return;
      }
      if (hClean.includes('ghi_chu') || hClean.includes('ghi chú') || hClean === 'note') {
        noteColIdx = idx;
        return;
      }
      const matchedSub = subjects.find(s => {
        const sCode = String(s.code || '').toLowerCase();
        const sName = cleanSubjectNameWithoutCode(s.name).toLowerCase();
        return (sCode && hClean.includes(sCode)) || (sName && hClean.includes(sName));
      });
      if (matchedSub) {
        colToSubject[idx] = matchedSub;
      } else if (activeSingleSubject && (hClean.includes('diem_tk') || hClean.includes('điểm tk') || hClean.includes('tổng kết') || hClean.includes('tong_ket') || hClean.includes('điểm') || hClean.includes('score') || isSingleSubjectMode)) {
        colToSubject[idx] = activeSingleSubject;
      }
    });

    const parsedRows: any[] = [];
    for (let r = 1; r < lines.length; r++) {
      const cols = splitLine(lines[r]);
      if (cols.length < 2) continue;

      const col0 = cols[0] || '';
      const col1 = cols[1] || '';
      const col2 = cols[2] || '';
      const col3 = cols[3] || '';
      const col4 = cols[4] || '';

      // Skip sample demo row
      if (col1.toUpperCase() === 'SV-DEMO' || col3.toLowerCase().startsWith('demo.student@')) {
        continue;
      }

      // Match student from loaded roster
      let matchedStudent = students.find(st => String(st.id) === col0);
      if (!matchedStudent && col1) {
        matchedStudent = students.find(st => String(st.student_id || '').toLowerCase() === col1.toLowerCase());
      }
      if (!matchedStudent && col3) {
        matchedStudent = students.find(st => String(st.email || '').toLowerCase() === col3.toLowerCase());
      }
      if (!matchedStudent && col0) {
        matchedStudent = students.find(
          st =>
            String(st.student_id || '').toLowerCase() === col0.toLowerCase() ||
            String(st.email || '').toLowerCase() === col0.toLowerCase() ||
            String(st.full_name || '').toLowerCase() === col0.toLowerCase()
        );
      }

      const rowGrades: Record<string, any> = {};
      Object.entries(colToSubject).forEach(([colIdxStr, subObj]) => {
        const rawScoreVal = String(cols[Number(colIdxStr)] ?? '').trim().replace(',', '.');
        const qVal = quizColIdx >= 0 ? String(cols[quizColIdx] ?? '').trim().replace(',', '.') : '';
        const fVal = finalExamColIdx >= 0 ? String(cols[finalExamColIdx] ?? '').trim().replace(',', '.') : '';
        const nVal = noteColIdx >= 0 ? String(cols[noteColIdx] ?? '').trim() : '';

        let effectiveFinal = rawScoreVal;
        if (effectiveFinal === '' && qVal !== '' && fVal !== '' && !isNaN(Number(qVal)) && !isNaN(Number(fVal))) {
          effectiveFinal = String(Math.round(((Number(qVal) * 0.5) + (Number(fVal) * 0.5)) * 100) / 100);
        }

        if (effectiveFinal !== '' || qVal !== '' || fVal !== '') {
          const inferred = effectiveFinal !== '' ? inferGradeAndStatus(effectiveFinal) : null;
          rowGrades[subObj.key] = {
            subject_code: subObj.code,
            subject_name: cleanSubjectNameWithoutCode(subObj.name),
            attendance_score: qVal || undefined,
            assignment_score: fVal || undefined,
            final_score: effectiveFinal,
            letter_grade: inferred?.letter || '',
            status: inferred?.status || 'studying',
            note: nVal || undefined
          };
        }
      });

      // Also handle case where only Quiz & Final columns were present without a separate Diem_TK column
      if (Object.keys(rowGrades).length === 0 && activeSingleSubject && (quizColIdx >= 0 || finalExamColIdx >= 0)) {
        const qVal = quizColIdx >= 0 ? String(cols[quizColIdx] ?? '').trim().replace(',', '.') : '';
        const fVal = finalExamColIdx >= 0 ? String(cols[finalExamColIdx] ?? '').trim().replace(',', '.') : '';
        const nVal = noteColIdx >= 0 ? String(cols[noteColIdx] ?? '').trim() : '';
        let effectiveFinal = '';
        if (qVal !== '' && fVal !== '' && !isNaN(Number(qVal)) && !isNaN(Number(fVal))) {
          effectiveFinal = String(Math.round(((Number(qVal) * 0.5) + (Number(fVal) * 0.5)) * 100) / 100);
        }
        if (effectiveFinal !== '' || qVal !== '' || fVal !== '') {
          const inferred = effectiveFinal !== '' ? inferGradeAndStatus(effectiveFinal) : null;
          rowGrades[activeSingleSubject.key] = {
            subject_code: activeSingleSubject.code,
            subject_name: cleanSubjectNameWithoutCode(activeSingleSubject.name),
            attendance_score: qVal || undefined,
            assignment_score: fVal || undefined,
            final_score: effectiveFinal,
            letter_grade: inferred?.letter || '',
            status: inferred?.status || 'studying',
            note: nVal || undefined
          };
        }
      }

      parsedRows.push({
        contact_id: matchedStudent?.id || (Number(col0) > 0 ? Number(col0) : 0),
        student_id: matchedStudent?.student_id || col1 || col0,
        full_name: matchedStudent?.full_name || col2 || col1,
        email: matchedStudent?.email || col3,
        phone: matchedStudent?.phone || col4,
        matched: !!matchedStudent,
        grades: rowGrades
      });
    }

    setImportPreviewRows(parsedRows);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = String(ev.target?.result || '');
      parseImportContent(content);
      toast.success(`Đã đọc file "${file.name}" thành công.`);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    if (importPreviewRows.length === 0 || saving) return;
    setSaving(true);
    try {
      const res = await api.post(`/academic/class-gradebook/${selectedCampaignId}`, {
        rows: importPreviewRows
      });
      toast.success(res.data?.message || 'Đã import điểm cả lớp thành công.');
      setActiveMode('grid');
      setImportPreviewRows([]);
      setImportText('');
      onSaved?.();
      await loadGradebook(selectedCampaignId);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Lỗi khi import điểm');
    } finally {
      setSaving(false);
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
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1220px',
          maxHeight: '90vh',
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 24px 48px rgba(15, 23, 42, 0.22)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(189, 29, 45, 0.1)',
                color: '#BD1D2D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Award size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.02rem', fontWeight: 800, color: '#0f172a' }}>
                Bảng Điểm Lớp & Cập Nhật Hàng Loạt
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                Nhập điểm trực tiếp theo chương trình học hoặc tải file Excel / CSV lên hệ thống
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Segmented Mode Switcher */}
            <div
              style={{
                display: 'inline-flex',
                padding: '3px',
                borderRadius: '10px',
                background: '#f1f5f9',
                border: '1px solid #e2e8f0',
                gap: '2px'
              }}
            >
              <button
                type="button"
                onClick={() => setActiveMode('grid')}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeMode === 'grid' ? '#ffffff' : 'transparent',
                  color: activeMode === 'grid' ? '#BD1D2D' : '#64748b',
                  fontWeight: activeMode === 'grid' ? 700 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: activeMode === 'grid' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Users size={14} />
                <span>Danh sách học viên ({students.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveMode('import')}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeMode === 'import' ? '#ffffff' : 'transparent',
                  color: activeMode === 'import' ? '#BD1D2D' : '#64748b',
                  fontWeight: activeMode === 'import' ? 700 : 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  boxShadow: activeMode === 'import' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <FileSpreadsheet size={14} />
                <span>Nhập từ Excel / CSV</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            padding: '12px 22px',
            borderBottom: '1px solid #e2e8f0',
            background: '#ffffff',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(160px, 1fr)) auto',
            alignItems: 'end',
            gap: '10px'
          }}
        >
          {/* Standard Program Curriculum Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.03em' }}>
              Chương trình đào tạo
            </label>
            <select
              value={selectedProgram}
              onChange={e => {
                const nextProg = e.target.value;
                setSelectedProgram(nextProg);
                if (nextProg) {
                  const instantSubs = resolveCurriculumSubjects(nextProg).map((s, idx) => ({
                    index: idx,
                    code: s.code,
                    name: cleanSubjectNameWithoutCode(s.name),
                    key: s.code || s.name
                  }));
                  if (instantSubs.length > 0) {
                    setSubjects(instantSubs);
                    setSelectedSubjectKey(instantSubs[0].key);
                  } else {
                    setSelectedSubjectKey('ALL');
                  }
                } else {
                  setSelectedSubjectKey('ALL');
                }
              }}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                fontWeight: 700,
                color: '#0f172a',
                background: '#ffffff'
              }}
            >
              <option value="">Tất cả chương trình</option>
              {STANDARD_PROGRAM_NAMES.map((progKey, idx) => (
                <option key={progKey} value={progKey}>
                  {idx + 1}/ {progKey} ({(STANDARD_PROGRAM_CURRICULUMS[progKey] || []).length} môn)
                </option>
              ))}
            </select>
          </div>

          {/* Course Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.03em' }}>
              Khóa học / Lớp học
            </label>
            <select
              value={selectedCampaignId}
              onChange={e => setSelectedCampaignId(Number(e.target.value))}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#0f172a',
                background: '#ffffff'
              }}
            >
              <option value={0}>Tất cả lớp thuộc chương trình</option>
              {courseInfo && courseInfo.id > 0 && !localCampaigns.some(c => Number(c.id) === Number(courseInfo.id)) && (
                <option value={Number(courseInfo.id)}>{courseInfo.name}</option>
              )}
              {Array.isArray(localCampaigns) &&
                localCampaigns.map(c => (
                  <option key={c.id} value={Number(c.id)}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Subject Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.03em' }}>
              Môn học hiển thị
            </label>
            <select
              value={selectedSubjectKey}
              onChange={e => setSelectedSubjectKey(e.target.value)}
              style={{
                width: '100%',
                height: '36px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#0f172a',
                background: '#ffffff'
              }}
            >
              <option value="ALL">Tất cả môn học ({subjects.length} môn)</option>
              {subjects.map((s, idx) => (
                <option key={s.key} value={s.key}>
                  {idx + 1}. {cleanSubjectNameWithoutCode(s.name)}
                </option>
              ))}
            </select>
          </div>

          {/* Search Student */}
          <div>
            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.03em' }}>
              Tìm học viên
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Tên, Mã HV, Email, SĐT..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  height: '36px',
                  padding: '0 10px 0 30px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={handleDownloadCsvTemplate}
              title={
                selectedSubjectKey !== 'ALL' && visibleSubjects[0]
                  ? `Tải file mẫu Excel/CSV của môn: ${cleanSubjectNameWithoutCode(visibleSubjects[0].name)}`
                  : 'Tải file mẫu Excel/CSV của toàn bộ các môn trong chương trình'
              }
              style={{
                height: '36px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#334155',
                fontWeight: 600,
                fontSize: '0.78rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap'
              }}
            >
              <Download size={14} style={{ color: '#BD1D2D' }} />
              <span>
                {selectedSubjectKey !== 'ALL' && visibleSubjects.length === 1
                  ? 'Tải mẫu môn này (.CSV)'
                  : 'Tải mẫu tất cả môn'}
              </span>
            </button>

            {activeMode === 'grid' && (
              <button
                type="button"
                onClick={handleSaveGrid}
                disabled={saving || loading || students.length === 0}
                style={{
                  height: '36px',
                  padding: '0 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#BD1D2D',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                <span>Lưu điểm cả lớp {dirtyCount > 0 ? `(${dirtyCount} thay đổi)` : ''}</span>
              </button>
            )}
          </div>
        </div>

        {/* 6.0 ECTS Grading Scale Reference Bar */}
        <div
          style={{
            padding: '6px 22px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '6px',
            fontSize: '0.7rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Thang điểm 6.0 (ECTS):
            </span>
            <span style={{ padding: '1px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
              A: 5.25–6.0 (Excellent)
            </span>
            <span style={{ padding: '1px 6px', borderRadius: '4px', background: '#e0f2fe', color: '#0369a1', fontWeight: 700 }}>
              B: 4.75–5.24 (Very Good)
            </span>
            <span style={{ padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#334155', fontWeight: 700 }}>
              C: 4.50–4.74 (Good)
            </span>
            <span style={{ padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontWeight: 700 }}>
              D: 4.25–4.49 (Satisfactory)
            </span>
            <span style={{ padding: '1px 6px', borderRadius: '4px', background: '#fef3c7', color: '#b45309', fontWeight: 700 }}>
              E: 4.00–4.24 (Pass)
            </span>
            <span style={{ padding: '1px 6px', borderRadius: '4px', background: '#fee2e2', color: '#b91c1c', fontWeight: 700 }}>
              F: &lt; 4.00 (3.50–3.99: Retake • &lt; 3.50: Redo)
            </span>
          </div>
          {selectedSubjectKey !== 'ALL' && visibleSubjects[0] && (
            <div style={{ fontWeight: 700, color: '#BD1D2D', whiteSpace: 'nowrap' }}>
              Môn: {cleanSubjectNameWithoutCode(visibleSubjects[0].name)}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 22px' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
              <Loader2 size={28} className="animate-spin" style={{ margin: '0 auto 10px', color: '#BD1D2D' }} />
              <div style={{ fontWeight: 600 }}>Đang tải danh sách học viên & bảng điểm...</div>
            </div>
          ) : activeMode === 'grid' ? (
            students.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <Users size={36} style={{ color: '#94a3b8', margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 700, color: '#334155' }}>Chưa có học viên nào trong khóa học này</div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
                  Vui lòng chọn khóa học khác hoặc gán học viên vào khóa học.
                </div>
              </div>
            ) : subjects.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                <BookOpen size={36} style={{ color: '#94a3b8', margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 700, color: '#334155' }}>Khóa học này chưa cấu hình danh sách môn học</div>
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                      <th style={{ padding: '10px 10px', textAlign: 'left', color: '#475569', fontWeight: 800, position: 'sticky', left: 0, background: '#f8fafc', zIndex: 2, minWidth: '185px' }}>
                        Học viên ({filteredStudents.length})
                      </th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', color: '#475569', fontWeight: 800, minWidth: '115px' }}>
                        Mã Học viên
                      </th>
                      {selectedSubjectKey !== 'ALL' && visibleSubjects.length === 1 ? (
                        <>
                          <th style={{ padding: '10px 6px', textAlign: 'center', color: '#0f172a', fontWeight: 800, width: '112px' }}>
                            Điểm Quiz (50%)
                          </th>
                          <th style={{ padding: '10px 6px', textAlign: 'center', color: '#0f172a', fontWeight: 800, width: '112px' }}>
                            Điểm Final (50%)
                          </th>
                          <th style={{ padding: '10px 6px', textAlign: 'center', color: '#BD1D2D', fontWeight: 800, width: '124px' }}>
                            Điểm TK (Thang 6) *
                          </th>
                          <th style={{ padding: '10px 6px', textAlign: 'center', color: '#0f172a', fontWeight: 800, width: '125px' }}>
                            Điểm chữ (ECTS)
                          </th>
                          <th style={{ padding: '10px 6px', textAlign: 'center', color: '#0f172a', fontWeight: 800, width: '128px' }}>
                            Trạng thái môn
                          </th>
                          <th style={{ padding: '10px 8px', textAlign: 'left', color: '#0f172a', fontWeight: 800, minWidth: '130px' }}>
                            Ghi chú / Nhận xét
                          </th>
                        </>
                      ) : (
                        visibleSubjects.map(sub => (
                          <th
                            key={sub.key}
                            style={{
                              padding: '12px 10px',
                              textAlign: 'center',
                              color: '#0f172a',
                              fontWeight: 800,
                              minWidth: '140px',
                              borderLeft: '1px solid #e2e8f0'
                            }}
                          >
                            <div style={{ fontSize: '0.76rem', color: '#0f172a', fontWeight: 800, lineHeight: 1.3, textTransform: 'uppercase' }}>
                              {cleanSubjectNameWithoutCode(sub.name)}
                            </div>
                          </th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((st, rIdx) => {
                      const cid = Number(st.id);
                      const stuRow = matrix[cid] || {};
                      return (
                        <tr
                          key={cid}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: rIdx % 2 === 0 ? '#ffffff' : '#fcfcfd'
                          }}
                        >
                          <td
                            style={{
                              padding: '8px 12px',
                              position: 'sticky',
                              left: 0,
                              background: rIdx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                              zIndex: 1,
                              borderRight: '1px solid #f1f5f9'
                            }}
                          >
                            <div style={{ fontWeight: 700, color: '#0f172a' }}>{st.full_name}</div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{st.email || st.phone || '—'}</div>
                          </td>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#334155', fontSize: '0.76rem' }}>
                            {st.student_id || '—'}
                          </td>

                          {selectedSubjectKey !== 'ALL' && visibleSubjects.length === 1 ? (
                            (() => {
                              const sub = visibleSubjects[0];
                              const cell = stuRow[sub.key] || {};
                              return (
                                <>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                    <input
                                      type="text"
                                      placeholder="0.0 - 6.0"
                                      value={cell.attendance_score ?? ''}
                                      onChange={e => handleCellChange(cid, sub.key, 'attendance_score', e.target.value)}
                                      style={{ width: '85px', height: '30px', textAlign: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                                    />
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                    <input
                                      type="text"
                                      placeholder="0.0 - 6.0"
                                      value={cell.assignment_score ?? ''}
                                      onChange={e => handleCellChange(cid, sub.key, 'assignment_score', e.target.value)}
                                      style={{ width: '85px', height: '30px', textAlign: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                                    />
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                    <input
                                      type="text"
                                      placeholder="0.0 - 6.0"
                                      value={cell.final_score ?? ''}
                                      onChange={e => handleCellChange(cid, sub.key, 'final_score', e.target.value)}
                                      style={{
                                        width: '95px',
                                        height: '30px',
                                        textAlign: 'center',
                                        borderRadius: '6px',
                                        border: '1.5px solid #BD1D2D',
                                        fontWeight: 800,
                                        color: '#0f172a',
                                        fontSize: '0.82rem',
                                        background: '#fff1f2'
                                      }}
                                    />
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                    <input
                                      type="text"
                                      placeholder="A / B / C / D / E / F"
                                      value={cell.letter_grade ?? ''}
                                      onChange={e => handleCellChange(cid, sub.key, 'letter_grade', e.target.value)}
                                      style={{ width: '130px', height: '30px', textAlign: 'center', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', fontWeight: 700, color: cell.status === 'passed' ? '#15803d' : cell.status === 'failed' ? '#dc2626' : '#0f172a' }}
                                    />
                                  </td>
                                  <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                    <select
                                      value={cell.status || 'studying'}
                                      onChange={e => handleCellChange(cid, sub.key, 'status', e.target.value)}
                                      style={{
                                        height: '30px',
                                        borderRadius: '6px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '0.76rem',
                                        fontWeight: 700,
                                        padding: '0 6px',
                                        color: cell.status === 'passed' ? '#16a34a' : cell.status === 'failed' ? '#dc2626' : '#334155'
                                      }}
                                    >
                                      <option value="studying">Đang học</option>
                                      <option value="passed">Đạt (Pass)</option>
                                      <option value="failed">Học lại (Fail)</option>
                                      <option value="postponed">Bảo lưu môn</option>
                                      <option value="exempt">Miễn giảm</option>
                                    </select>
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <input
                                      type="text"
                                      placeholder="Ghi chú..."
                                      value={cell.note ?? ''}
                                      onChange={e => handleCellChange(cid, sub.key, 'note', e.target.value)}
                                      style={{ width: '100%', height: '30px', padding: '0 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}
                                    />
                                  </td>
                                </>
                              );
                            })()
                          ) : (
                            visibleSubjects.map(sub => {
                              const cell = stuRow[sub.key] || {};
                              const isPassed = cell.status === 'passed';
                              return (
                                <td
                                  key={sub.key}
                                  style={{
                                    padding: '6px 8px',
                                    textAlign: 'center',
                                    borderLeft: '1px solid #f1f5f9'
                                  }}
                                >
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                                    <input
                                      type="text"
                                      placeholder="Điểm..."
                                      value={cell.final_score ?? ''}
                                      onChange={e => handleCellChange(cid, sub.key, 'final_score', e.target.value)}
                                      style={{
                                        width: '86px',
                                        height: '28px',
                                        textAlign: 'center',
                                        borderRadius: '6px',
                                        border: cell.final_score ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                                        background: cell.final_score ? '#f0fdf4' : '#ffffff',
                                        fontWeight: 700,
                                        fontSize: '0.8rem',
                                        color: '#0f172a'
                                      }}
                                    />
                                    {cell.letter_grade && (
                                      <span style={{ fontSize: '0.66rem', fontWeight: 700, color: isPassed ? '#16a34a' : '#64748b' }}>
                                        {cell.letter_grade}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* IMPORT EXCEL / CSV MODE */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  border: '2px dashed #cbd5e1',
                  background: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '16px'
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#0f172a', marginBottom: '4px' }}>
                    Bước 1: Chọn file CSV / Excel điểm theo môn (Thang điểm 6.0) hoặc Dán trực tiếp từ Excel
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {selectedSubjectKey !== 'ALL' && visibleSubjects[0] ? (
                      <>
                        Đang nhập điểm cho môn: <strong style={{ color: '#BD1D2D' }}>{cleanSubjectNameWithoutCode(visibleSubjects[0].name)}</strong> • Hệ thống tự động quy đổi Điểm chữ (A, B, C, D, E, F) theo thang điểm 6.0 chuẩn ECTS.
                      </>
                    ) : (
                      <>
                        Hệ thống tự động nhận diện Học viên theo <strong>Mã Học viên (ID Student)</strong>, <strong>Email</strong>, <strong>Số điện thoại</strong> và quy đổi Điểm chữ theo thang điểm 6.0.
                      </>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: '9px 16px',
                      borderRadius: '8px',
                      border: 'none',
                      background: '#BD1D2D',
                      color: '#ffffff',
                      fontWeight: 700,
                      fontSize: '0.82rem',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Upload size={15} />
                    <span>Chọn file điểm (.CSV) từ máy tính</span>
                  </button>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Hoặc Copy-Paste bảng điểm trực tiếp từ Excel vào ô dưới đây:
                </label>
                <textarea
                  rows={5}
                  placeholder={
                    selectedSubjectKey !== 'ALL' && visibleSubjects[0]
                      ? `Contact_ID\tMa_Hoc_Vien\tHo_Ten\tEmail\tDiem_Quiz_50 (0-6)\tDiem_Final_50 (0-6)\t${cleanSubjectNameWithoutCode(visibleSubjects[0].name)} - Diem_TK (Thang 6)\n1025200\tBBA-25-000337EN\tBÙI THỊ THUẬN\tbui.thuan@gmail.com\t5.50\t5.50\t5.50`
                      : 'Contact_ID\tMa_Hoc_Vien\tHo_Ten\tEmail\tIntroduction to Management\tIntroduction to Finance\n1025200\tBBA-25-000337EN\tBÙI THỊ THUẬN\tbui.thuan@gmail.com\t5.50\t5.00'
                  }
                  value={importText}
                  onChange={e => parseImportContent(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.78rem',
                    fontFamily: 'monospace'
                  }}
                />
              </div>

              {importPreviewRows.length > 0 && (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <div
                    style={{
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: '0.82rem', color: '#0f172a' }}>
                      Xem trước dữ liệu sẽ cập nhật ({importPreviewRows.length} học viên)
                    </span>
                    <button
                      type="button"
                      onClick={handleConfirmImport}
                      disabled={saving}
                      style={{
                        padding: '7px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        background: '#16a34a',
                        color: '#ffffff',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      <span>Xác nhận Up điểm cho {importPreviewRows.length} học viên</span>
                    </button>
                  </div>
                  <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Trạng thái khớp</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Mã HV</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Họ tên</th>
                          <th style={{ padding: '8px 10px', textAlign: 'left' }}>Điểm các môn đọc được</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreviewRows.map((r, i) => (
                          <tr key={i} style={{ borderTop: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 10px' }}>
                              {r.matched ? (
                                <span style={{ color: '#16a34a', fontWeight: 700 }}>✓ Đã khớp hồ sơ</span>
                              ) : (
                                <span style={{ color: '#d97706', fontWeight: 700 }}>Tìm theo Mã/Email</span>
                              )}
                            </td>
                            <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.student_id || '—'}</td>
                            <td style={{ padding: '8px 10px', fontWeight: 700 }}>{r.full_name || '—'}</td>
                            <td style={{ padding: '8px 10px' }}>
                              {Object.values(r.grades || {}).map((g: any, gIdx: number) => (
                                <span
                                  key={gIdx}
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: '6px',
                                    background: '#f1f5f9',
                                    marginRight: '6px',
                                    fontWeight: 600
                                  }}
                                >
                                  {(g.subject_name || g.name || g.subject_code).replace(/^(\d+[\.\-_/:\s]+|[A-Z]{1,6}[-_]?[A-Z0-9]{1,6}[-_:]*\s*)/i, '').trim()}: <strong style={{ color: '#BD1D2D' }}>{g.final_score}</strong>
                                </span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
