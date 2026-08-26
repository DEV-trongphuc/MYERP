import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'react-router-dom';
import { 
  Calendar as CalendarIcon, 
  User, 
  Briefcase, 
  Clock, 
  MapPin, 
  Video, 
  Award, 
  FileText, 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  CalendarDays,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';

export const PublicSchedulePage: React.FC = () => {
  const { customerId, campaignId, lecturerId } = useParams<{ customerId?: string; campaignId?: string; lecturerId?: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  const getLocalDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDaySchedules, setSelectedDaySchedules] = useState<any[]>([]);
  const [selectedDayMilestones, setSelectedDayMilestones] = useState<any[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!customerId && !campaignId && !lecturerId) {
      setError('Mã liên kết lịch học không hợp lệ.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    let param = '';
    if (customerId && customerId !== 'course' && customerId !== 'lecturer') {
      param = `customer_id=${customerId}`;
    } else if (campaignId) {
      param = `campaign_id=${campaignId}`;
    } else if (lecturerId) {
      param = `lecturer_id=${lecturerId}`;
    }

    axios.get(`/backend/api.php?action=public_student_schedule&${param}`)
      .then(res => {
        if (res.data && res.data.success) {
          setData(res.data.data);
        } else {
          setError(res.data?.message || 'Không thể tải lịch học.');
        }
      })
      .catch(err => {
        console.error(err);
        setError('Đã xảy ra lỗi kết nối. Vui lòng thử lại sau.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [customerId, campaignId, lecturerId]);

  const student = data?.student && data.student.id ? data.student : null;
  const course = data?.course;
  const program = data?.program;
  const lecturers = data?.lecturers || {};
  const lecturer = data?.lecturer;
  const subjects = course?.subjects || [];
  const thesisMilestones = course?.thesis_milestones || [];

  const getLecturerName = (lecturerId: any) => {
    if (!lecturerId) return 'Chưa phân công';
    return lecturers?.[lecturerId] || lecturerId;
  };

  const allEvents = React.useMemo(() => {
    if (!data) return [];
    const events: any[] = [];

    subjects.forEach((sub: any) => {
      const subLecturer = getLecturerName(sub.lecturer_id);

      // 1. Host sessions
      if (Array.isArray(sub.host_sessions)) {
        sub.host_sessions.forEach((hs: any, hsIdx: number) => {
          if (hs.date) {
            const isShared = sub.zoom_shared !== false;
            events.push({
              type: 'school',
              date: hs.date,
              subjectCode: sub.code || 'MÔN HỌC',
              subjectName: sub.name,
              title: hs.name || `Buổi học ${hsIdx + 1}`,
              time: `${hs.time_start || '20:00'} - ${hs.time_end || '22:00'}`,
              lecturer: hs.lecturer_name ? getLecturerName(hs.lecturer_name) : subLecturer,
              location: hs.location || 'Online',
              zoom_link: (isShared ? sub.zoom_link : sub.school_zoom_link) || '',
              zoom_id: (isShared ? sub.zoom_id : sub.school_zoom_id) || '',
              zoom_pass: (isShared ? sub.zoom_pass : sub.school_zoom_pass) || ''
            });
          }
        });
      }

      // 2. Seminars
      if (Array.isArray(sub.seminars)) {
        sub.seminars.forEach((sem: any) => {
          if (sem.date) {
            const isShared = sub.zoom_shared !== false;
            events.push({
              type: 'seminar',
              date: sem.date,
              subjectCode: sub.code || 'MÔN HỌC',
              subjectName: sub.name,
              title: sem.topic || 'Lớp chuyên đề',
              time: sem.time_slot || (sem.time_start && sem.time_end ? `${sem.time_start} - ${sem.time_end}` : 'Chưa cấu hình giờ'),
              lecturer: sem.lecturer_id ? getLecturerName(sem.lecturer_id) : subLecturer,
              location: sem.location || 'Online',
              zoom_link: (isShared ? sub.zoom_link : sub.seminar_zoom_link) || '',
              zoom_id: (isShared ? sub.zoom_id : sub.seminar_zoom_id) || '',
              zoom_pass: (isShared ? sub.zoom_pass : sub.seminar_zoom_pass) || ''
            });
          }
        });
      }

      // 3. Thesis defenses
      if (Array.isArray(sub.thesis_defenses)) {
        sub.thesis_defenses.forEach((def: any) => {
          if (def.date) {
            events.push({
              type: 'thesis',
              date: def.date,
              subjectCode: sub.code || 'MÔN HỌC',
              subjectName: sub.name,
              title: def.title || 'Bảo vệ luận văn',
              time: def.time_slot || (def.time_start && def.time_end ? `${def.time_start} - ${def.time_end}` : 'Chưa cấu hình giờ'),
              lecturer: def.committee_members || subLecturer,
              location: def.location || 'Online',
              zoom_link: def.zoom_link || '',
              zoom_id: def.zoom_id || '',
              zoom_pass: def.zoom_pass || ''
            });
          }
        });
      }
    });

    // Deduplicate merged/shared classes (same date, lecturer, subjectCode, time)
    const dedupedEvents: any[] = [];
    events.forEach(evt => {
      const existing = dedupedEvents.find(e => 
        e.date === evt.date && 
        e.lecturer === evt.lecturer && 
        e.subjectCode === evt.subjectCode && 
        e.time === evt.time &&
        e.type === evt.type
      );
      
      if (existing) {
        const getCourseName = (fullName: string) => {
          const match = fullName.match(/\(([^)]+)\)$/);
          return match ? match[1] : '';
        };
        
        const getBaseName = (fullName: string) => {
          return fullName.replace(/\s*\([^)]+\)$/, '').trim();
        };
        
        const course1 = getCourseName(existing.subjectName);
        const course2 = getCourseName(evt.subjectName);
        const baseName = getBaseName(existing.subjectName);
        
        if (course1 && course2 && course1 !== course2) {
          const courses = Array.from(new Set([...course1.split(', '), ...course2.split(', ')]));
          existing.subjectName = `${baseName} (${courses.join(', ')})`;
        } else if (!course1 && course2) {
          existing.subjectName = `${existing.subjectName} (${course2})`;
        }
        
        if (existing.title !== evt.title) {
          const titles = Array.from(new Set([existing.title, evt.title]));
          existing.title = titles.join(' / ');
        }
      } else {
        dedupedEvents.push({ ...evt });
      }
    });
    return dedupedEvents;
  }, [subjects, lecturers, data]);

  // Calculate nearest class and assignment/milestone
  const calculateNearestDeadlines = () => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    let nearestClassDays: number | null = null;
    let nearestClassDateStr: string = '';
    
    let nearestAsmDays: number | null = null;
    let nearestAsmDateStr: string = '';
    let nearestAsmName: string = '';

    // 1. Find nearest class
    allEvents.forEach(evt => {
      if (!evt.date) return;
      const evtDate = new Date(evt.date + 'T00:00:00');
      evtDate.setHours(0, 0, 0, 0);
      if (evtDate >= todayDate) {
        const diffTime = evtDate.getTime() - todayDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (nearestClassDays === null || diffDays < nearestClassDays) {
          nearestClassDays = diffDays;
          nearestClassDateStr = evt.date;
        }
      }
    });

    // 2. Find nearest assignment / thesis milestone
    subjects.forEach((sub: any) => {
      if (Array.isArray(sub.assignments)) {
        sub.assignments.forEach((asm: any) => {
          if (!asm.due_date) return;
          const dueOnlyDate = asm.due_date.split('T')[0];
          const asmDate = new Date(dueOnlyDate + 'T00:00:00');
          asmDate.setHours(0, 0, 0, 0);
          if (asmDate >= todayDate) {
            const diffTime = asmDate.getTime() - todayDate.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            if (nearestAsmDays === null || diffDays < nearestAsmDays) {
              nearestAsmDays = diffDays;
              nearestAsmDateStr = dueOnlyDate;
              nearestAsmName = asm.name;
            }
          }
        });
      }
    });

    // Check thesis milestones
    thesisMilestones.forEach((ms: any) => {
      if (!ms.due_date) return;
      const msDate = new Date(ms.due_date + 'T00:00:00');
      msDate.setHours(0, 0, 0, 0);
      if (msDate >= todayDate) {
        const diffTime = msDate.getTime() - todayDate.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        if (nearestAsmDays === null || diffDays < nearestAsmDays) {
          nearestAsmDays = diffDays;
          nearestAsmDateStr = ms.due_date;
          nearestAsmName = ms.milestone;
        }
      }
    });

    return { nearestClassDays, nearestClassDateStr, nearestAsmDays, nearestAsmDateStr, nearestAsmName };
  };

  const { nearestClassDays, nearestClassDateStr, nearestAsmDays, nearestAsmDateStr, nearestAsmName } = calculateNearestDeadlines();

  const formatDaysPhrase = (days: number) => {
    if (days === 0) return 'hôm nay';
    if (days === 1) return 'ngày mai';
    return `trong ${days} ngày tới`;
  };

  // Calendar Helper Logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sunday, 1 = Monday, ...
  // Convert Sunday=0 to Sunday=7 for easier alignment with Mon=1 to Sun=7 layout
  const adjustedStartDay = startDayOfWeek === 0 ? 7 : startDayOfWeek;

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create date cells
  const dayCells: (Date | null)[] = [];
  // Empty slots for previous month offset
  for (let i = 1; i < adjustedStartDay; i++) {
    dayCells.push(null);
  }
  // Days of current month
  for (let i = 1; i <= daysInMonth; i++) {
    dayCells.push(new Date(year, month, i));
  }

  // Group events by date string "YYYY-MM-DD"
  const eventsByDate: Record<string, any[]> = {};
  allEvents.forEach(evt => {
    if (!eventsByDate[evt.date]) {
      eventsByDate[evt.date] = [];
    }
    eventsByDate[evt.date].push(evt);
  });

  // Group milestones by date string
  const milestonesByDate: Record<string, any[]> = {};
  thesisMilestones.forEach((ms: any) => {
    if (ms.due_date) {
      if (!milestonesByDate[ms.due_date]) {
        milestonesByDate[ms.due_date] = [];
      }
      milestonesByDate[ms.due_date].push(ms);
    }
  });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    const dStr = getLocalDateString(date);
    const dayEvts = eventsByDate[dStr] || [];
    const dayMs = milestonesByDate[dStr] || [];

    setSelectedDaySchedules(dayEvts);
    setSelectedDayMilestones(dayMs);
    setSelectedDateStr(dStr.split('-').reverse().join('/'));
    setIsModalOpen(true);
  };

  const getStudentInitials = (name: string) => {
    if (!name) return 'HV';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div style={{ 
      flex: 1,
      width: '100%', 
      height: '100vh', 
      overflowY: 'auto',
      background: 'var(--color-bg)', 
      fontFamily: 'Inter, system-ui, sans-serif' 
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        width: '100%', 
        margin: '0 auto', 
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
      {/* 0. Branded Top Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        paddingBottom: '0.75rem',
        borderBottom: '1px solid var(--color-border-light)'
      }}>
        <img 
          src="https://ideas.edu.vn/wp-content/uploads/2026/06/Logo_IDEAS_Slg-optimized.webp" 
          alt="Logo IDEAS" 
          style={{ height: '48px', objectFit: 'contain' }}
        />
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#b91c1c' }}>
            Tri thức Nguyên Bản
          </div>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text-muted)', marginTop: '2px' }}>
            Đồng hành Bản Địa
          </div>
        </div>
      </div>

      {/* 1. Header Student Info Card */}
      <div style={{ 
        background: 'var(--color-surface)', 
        borderRadius: '20px', 
        border: '1px solid var(--color-border-light)', 
        padding: '1.5rem 2rem', 
        display: 'flex', 
        flexWrap: 'wrap', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        gap: '1.5rem',
        boxShadow: 'var(--shadow-md)'
      }}>
        {student ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Circular Avatar */}
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)', 
              color: '#ffffff',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '1.5rem', 
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(185, 28, 28, 0.25)',
              border: '3px solid #ffffff'
            }}>
              {getStudentInitials(student.name)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>{student.name}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-success)', background: 'var(--color-success-light)', padding: '2px 8px', borderRadius: '100px' }}>Học viên</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={14} /> Chương trình: <strong style={{ color: 'var(--color-text)' }}>{program?.name || 'Chưa liên kết'}</strong></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BookOpen size={14} /> Khóa học: <strong style={{ color: 'var(--color-text)' }}>{course?.name || 'Chưa liên kết'}</strong></span>
              </div>
            </div>
          </div>
        ) : lecturer ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Red Theme Avatar for Lecturer */}
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)', 
              color: '#ffffff',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              fontSize: '1.5rem', 
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(185, 28, 28, 0.25)',
              border: '3px solid #ffffff'
            }}>
              {getStudentInitials(lecturer.name)}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>Giảng viên: {lecturer.name}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-danger)', background: 'var(--color-danger-light)', padding: '2px 8px', borderRadius: '100px' }}>Giảng viên</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={14} /> Hệ thống: <strong style={{ color: 'var(--color-text)' }}>{program?.name || 'Chưa liên kết'}</strong></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BookOpen size={14} /> Lịch giảng dạy: <strong style={{ color: 'var(--color-text)' }}>Tất cả khóa học</strong></span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* Calendar Icon Avatar */}
            <div style={{ 
              width: '64px', 
              height: '64px', 
              borderRadius: '50%', 
              background: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)', 
              color: '#ffffff',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              boxShadow: '0 4px 12px rgba(185, 28, 28, 0.25)',
              border: '3px solid #ffffff'
            }}>
              <CalendarDays size={30} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>Lịch học Khóa: {course?.name || 'Chưa thiết lập'}</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '2px 8px', borderRadius: '100px' }}>Toàn khóa</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={14} /> Chương trình: <strong style={{ color: 'var(--color-text)' }}>{program?.name || 'Chưa liên kết'}</strong></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BookOpen size={14} /> Trạng thái: <strong style={{ color: 'var(--color-text)' }}>Đang hoạt động</strong></span>
              </div>
            </div>
          </div>
        )}

        {/* School (Degree Awarding Body) */}
        {program?.degree_awarding_body && (
          <div style={{ 
            background: 'var(--color-bg-light)', 
            padding: '12px 18px', 
            borderRadius: '14px', 
            border: '1px solid var(--color-border-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <Award size={20} style={{ color: '#d97706' }} />
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Trường cấp bằng</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 750, color: 'var(--color-text)' }}>{program.degree_awarding_body}</div>
            </div>
          </div>
        )}
      </div>

      {/* 1.1 Nearest Deadlines Notice Bar */}
      {(nearestClassDays !== null || nearestAsmDays !== null) && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '1rem',
          marginTop: '-0.25rem' 
        }}>
          {nearestClassDays !== null && (
            <div style={{ 
              background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
              border: '1px solid #bfdbfe', 
              borderRadius: '16px', 
              padding: '1rem 1.25rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#3b82f6', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lecturer ? 'Lịch giảng sắp tới' : 'Lịch học sắp tới'}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#1e3a8a', marginTop: '2px' }}>
                  {student ? 'Bạn có lịch học gần nhất vào ' : lecturer ? 'Lịch giảng gần nhất vào ' : 'Lịch học gần nhất của khóa vào '}
                  <span style={{ color: '#2563eb', fontWeight: 800 }}>{formatDaysPhrase(nearestClassDays)}</span> ({nearestClassDateStr.split('-').reverse().join('/')}).
                </div>
              </div>
            </div>
          )}

          {nearestAsmDays !== null && (
            <div style={{ 
              background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', 
              border: '1px solid #fed7aa', 
              borderRadius: '16px', 
              padding: '1rem 1.25rem', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#ea580c', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={20} />
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lecturer ? 'Bài tập & Cột mốc liên quan' : 'Bài tập & Hạn nộp'}</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#7c2d12', marginTop: '2px' }}>
                  {student ? 'Bạn có bài tập/mốc cần hoàn thành ' : lecturer ? 'Thời hạn bài tập/mốc liên quan ' : 'Hạn nộp bài tập/mốc gần nhất '}
                  <span style={{ color: '#ea580c', fontWeight: 800 }}>{formatDaysPhrase(nearestAsmDays)}</span> ({nearestAsmDateStr.split('-').reverse().join('/')}): <span style={{ fontWeight: 800 }}>{nearestAsmName}</span>.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Calendar panel */}
      <div style={{ 
        background: 'var(--color-surface)', 
        borderRadius: '20px', 
        border: '1px solid var(--color-border-light)', 
        padding: '1.5rem', 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '1.25rem',
        boxShadow: 'var(--shadow-md)',
        flex: 1
      }}>
        {/* Calendar Header Controls */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CalendarIcon size={22} style={{ color: 'var(--color-primary)' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 850, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>
              Lịch học & Sự kiện
            </h3>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-light)', borderRadius: '10px', padding: '3px', border: '1px solid var(--color-border-light)' }}>
              <button 
                onClick={handlePrevMonth}
                style={{ background: 'none', border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: 'var(--color-text)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ fontSize: '0.875rem', fontWeight: 750, color: 'var(--color-text)', padding: '0 12px', minWidth: '120px', textAlign: 'center' }}>
                Tháng {month + 1} {year}
              </span>
              <button 
                onClick={handleNextMonth}
                style={{ background: 'none', border: 'none', padding: '6px', borderRadius: '8px', cursor: 'pointer', display: 'flex', color: 'var(--color-text)' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button 
              onClick={handleToday}
              style={{ 
                background: 'var(--color-surface)', 
                border: '1px solid var(--color-border-light)', 
                padding: '7px 16px', 
                borderRadius: '10px', 
                fontSize: '0.85rem', 
                fontWeight: 700, 
                color: 'var(--color-text)', 
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              Hôm nay
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 600, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6' }}></span>
            <span>Lịch học Trường</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }}></span>
            <span>Lớp Chuyên đề (IDEAS)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ea580c' }}></span>
            <span>Mốc Khóa luận</span>
          </div>
        </div>

        {/* Calendar Grid Container */}
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <div 
            className="card calendar-card" 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              padding: 0, 
              minWidth: '700px', 
              overflow: 'hidden',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              background: 'var(--color-surface)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <style>{`
              .class-calendar-day-cell {
                transition: all 0.15s ease-in-out;
              }
              .class-calendar-day-cell:hover {
                box-shadow: inset 0 0 0 1px var(--color-primary) !important;
                background-color: var(--color-bg-light) !important;
              }
            `}</style>
            {/* Days of Week Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              background: 'var(--color-bg-light)',
              borderBottom: '1px solid var(--color-border-light)',
              padding: '10px 0',
              flexShrink: 0
            }}>
              {['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'].map((day, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    textAlign: 'center', 
                    fontSize: '0.75rem', 
                    fontWeight: 800, 
                    color: day === 'CN' ? '#ef4444' : 'var(--color-text-muted)', 
                    textTransform: 'uppercase'
                  }}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
              gridAutoRows: 'minmax(110px, 1fr)',
              background: 'var(--color-border-light)',
              gap: '1px'
            }}>
              {dayCells.map((date, idx) => {
                if (!date) {
                  return (
                    <div key={idx} style={{ background: '#f8fafc', opacity: 0.35, minHeight: '100px' }}></div>
                  );
                }

                const dStr = getLocalDateString(date);
                const dayEvts = eventsByDate[dStr] || [];
                const dayMs = milestonesByDate[dStr] || [];
                const isToday = new Date().toDateString() === date.toDateString();
                const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                return (
                  <div 
                    key={idx} 
                    onClick={() => handleDayClick(date)}
                    style={{ 
                      background: isToday ? 'rgba(189, 29, 45, 0.05)' : isWeekend ? '#f8fafc' : '#ffffff', 
                      minHeight: '110px', 
                      padding: '8px', 
                      border: isToday ? '1.5px solid var(--color-primary)' : 'none',
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '6px',
                      cursor: 'pointer',
                      position: 'relative'
                    }}
                    className="class-calendar-day-cell"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: 800, 
                        color: isToday ? 'white' : 'var(--color-text)',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isToday ? 'var(--color-primary)' : 'none'
                      }}>
                        {date.getDate()}
                      </span>
                    </div>

                    {/* Day Events Indicators */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, overflow: 'hidden' }}>
                      {dayEvts.slice(0, 3).map((evt, eidx) => (
                        <div 
                          key={eidx} 
                          style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: 700, 
                            color: '#ffffff', 
                            background: evt.type === 'school' ? '#3b82f6' : '#ef4444', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {evt.subjectCode}: {evt.title}
                        </div>
                      ))}

                      {dayMs.slice(0, 2).map((ms, eidx) => (
                        <div 
                          key={eidx} 
                          style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: 700, 
                            color: '#ffffff', 
                            background: '#ea580c', 
                            padding: '2px 6px', 
                            borderRadius: '4px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          Mốc KL: {ms.milestone}
                        </div>
                      ))}

                      {/* Show more indicator */}
                      {(dayEvts.length + dayMs.length) > 3 && (
                        <div style={{ fontSize: '0.625rem', color: 'var(--color-text-light)', fontWeight: 800, textAlign: 'center', marginTop: '2px' }}>
                          +{(dayEvts.length + dayMs.length) - 3} sự kiện
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Detailed Day Dialog Modal */}
      {isModalOpen && createPortal(
        <div style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'rgba(15, 23, 42, 0.45)', 
          backdropFilter: 'blur(4px)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          zIndex: 2147483600,
          padding: '1rem',
          animation: 'fadeIn 0.2s ease'
        }}>
          <div style={{ 
            background: 'var(--color-surface)', 
            borderRadius: '20px', 
            border: '1px solid var(--color-border-light)', 
            width: '100%', 
            maxWidth: '520px', 
            maxHeight: '85vh', 
            overflowY: 'auto',
            boxShadow: 'var(--shadow-xl)',
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarDays size={18} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>Chi tiết ngày {selectedDateStr}</span>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '1.25rem', 
                  fontWeight: 600, 
                  color: 'var(--color-text-muted)', 
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Content Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Day Schedules List */}
              {selectedDaySchedules.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Buổi học & Chuyên đề ({selectedDaySchedules.length})
                  </div>
                  {selectedDaySchedules.map((evt, idx) => (
                    <div key={idx} style={{ 
                      padding: '12px 14px', 
                      background: 'var(--color-bg-light)', 
                      borderRadius: '14px', 
                      border: '1px solid var(--color-border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 800, 
                          padding: '2px 8px', 
                          borderRadius: '100px', 
                          color: '#ffffff', 
                          background: evt.type === 'school' ? '#3b82f6' : '#ef4444' 
                        }}>
                          {evt.type === 'school' ? 'Trường' : 'Chuyên đề'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                          {evt.subjectCode} - {evt.subjectName}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)' }}>{evt.title}</div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', color: 'var(--color-text-light)', borderTop: '1px dashed var(--color-border-light)', paddingTop: '8px', marginTop: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Clock size={13} /> Giờ: <strong style={{ color: 'var(--color-text)' }}>{evt.time}</strong></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={13} /> Giảng viên: <strong style={{ color: 'var(--color-text)' }}>{evt.lecturer}</strong></div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={13} /> Địa điểm: <strong style={{ color: 'var(--color-text)' }}>{evt.location}</strong></div>
                      </div>

                      {/* Zoom details if present */}
                      {(evt.zoom_link || evt.zoom_id) && (
                        <div style={{ 
                          padding: '10px', 
                          background: '#f0f9ff', 
                          borderRadius: '10px', 
                          border: '1px solid #e0f2fe', 
                          fontSize: '0.75rem', 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '4px',
                          marginTop: '4px'
                        }}>
                          <div style={{ fontWeight: 850, color: '#0369a1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Video size={13} /> Lớp trực tuyến Zoom
                          </div>
                          {evt.zoom_link && (
                            <div style={{ wordBreak: 'break-all' }}>
                              Link: <a href={evt.zoom_link} target="_blank" rel="noreferrer" style={{ color: '#0284c7', fontWeight: 700, textDecoration: 'underline' }}>{evt.zoom_link}</a>
                            </div>
                          )}
                          {(evt.zoom_id || evt.zoom_pass) && (
                            <div style={{ color: '#0c4a6e' }}>
                              {evt.zoom_id && <>ID: <strong>{evt.zoom_id}</strong></>}
                              {evt.zoom_pass && <>&nbsp;&nbsp;|&nbsp;&nbsp;Pass: <strong>{evt.zoom_pass}</strong></>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Day Milestones List */}
              {selectedDayMilestones.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Mốc tiến độ khóa luận ({selectedDayMilestones.length})
                  </div>
                  {selectedDayMilestones.map((ms, idx) => (
                    <div key={idx} style={{ 
                      padding: '12px 14px', 
                      background: '#fff7ed', 
                      borderRadius: '14px', 
                      border: '1px solid #ffedd5',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 800, color: '#ea580c' }}>
                        <Award size={15} /> Mốc quan trọng
                      </div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#9a3412' }}>{ms.milestone}</div>
                      <div style={{ fontSize: '0.72rem', color: '#c2410c', fontWeight: 600 }}>Hạn nộp: {ms.due_date ? ms.due_date.split('-').reverse().join('/') : ''}</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {selectedDaySchedules.length === 0 && selectedDayMilestones.length === 0 ? (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Không có buổi học, chuyên đề hay mốc lịch trình nào trong ngày này.
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'flex-end', background: 'var(--color-bg-light)', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px' }}>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ 
                  background: 'var(--color-surface)', 
                  border: '1px solid var(--color-border-light)', 
                  padding: '7px 18px', 
                  borderRadius: '10px', 
                  fontSize: '0.85rem', 
                  fontWeight: 700, 
                  color: 'var(--color-text)', 
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Global CSS Styles for fade animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      </div>
    </div>
  );
};
