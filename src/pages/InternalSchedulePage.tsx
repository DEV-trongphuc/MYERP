import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { fetchAPI } from '../utils/api';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Avatar } from '../components/ui/Avatar';
import { CompanyDrawer } from './CompanyDrawer';
import { 
  Calendar, BookOpen, User, Users, Copy, ExternalLink, 
  ChevronLeft, ChevronRight, Clock, MapPin, 
  AlertCircle, CalendarDays, Award, Briefcase, FileText,
  Video
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

export const InternalSchedulePage: React.FC = () => {
  const [viewType, setViewType] = useState<'course' | 'lecturer'>('lecturer');
  
  // Selection States
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [selectedLecturerId, setSelectedLecturerId] = useState<string>('all');
  
  // Calendar Data States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  // Calendar UI States
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDaySchedules, setSelectedDaySchedules] = useState<any[]>([]);
  const [selectedDayMilestones, setSelectedDayMilestones] = useState<any[]>([]);
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLecturerDrawerOpen, setIsLecturerDrawerOpen] = useState(false);
  const [selectedLecturerEntity, setSelectedLecturerEntity] = useState<any>(null);

  // Load lists
  useEffect(() => {
    const loadData = async () => {
      try {
        const [cRes, compRes] = await Promise.all([
          fetchAPI('campaigns'),
          fetchAPI('companies?limit=2000')
        ]);
        if (cRes?.success) {
          setCampaigns(cRes.data || []);
        }
        if (compRes?.success) {
          setCompanies(compRes.data?.items || compRes.data || []);
        }
      } catch (err) {
        console.error('Error loading options list', err);
      }
    };
    loadData();
  }, []);

  // Fetch schedule on selection change
  useEffect(() => {
    const fetchSchedule = async () => {
      const id = viewType === 'course' ? selectedCampaignId : selectedLecturerId;
      if (!id) {
        setData(null);
        return;
      }
      setLoading(true);
      setError(null);
      
      const param = viewType === 'course' ? `campaign_id=${id}` : `lecturer_id=${id}`;
      try {
        const res = await axios.get(`/backend/api.php?action=public_student_schedule&${param}`);
        if (res.data && res.data.success) {
          setData(res.data.data);
        } else {
          setError(res.data?.message || 'Không thể tải lịch học.');
        }
      } catch (err) {
        console.error(err);
        setError('Đã xảy ra lỗi kết nối.');
      } finally {
        setLoading(false);
      }
    };
    fetchSchedule();
  }, [viewType, selectedCampaignId, selectedLecturerId]);

  // Helpers for calendar calculation
  const getLocalDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getStudentInitials = (name: string) => {
    if (!name) return 'VA';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatDaysPhrase = (days: number) => {
    if (days === 0) return 'hôm nay';
    if (days === 1) return 'ngày mai';
    return `trong ${days} ngày tới`;
  };

  const { student, course, program, lecturers, lecturer } = data || {};
  const subjects = course?.subjects || [];
  const thesisMilestones = course?.thesis_milestones || [];

  const getLecturerName = (lecturerId: any) => {
    if (!lecturerId) return 'Chưa phân công';
    return lecturers?.[lecturerId] || lecturerId;
  };

  const allEvents = React.useMemo(() => {
    const events: any[] = [];
    subjects.forEach((sub: any) => {
      const subLecturer = getLecturerName(sub.lecturer_id);
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
              lecturerId: hs.lecturer_name || sub.lecturer_id || null,
              location: hs.location || 'Online',
              zoom_link: (isShared ? sub.zoom_link : sub.school_zoom_link) || '',
              zoom_id: (isShared ? sub.zoom_id : sub.school_zoom_id) || '',
              zoom_pass: (isShared ? sub.zoom_pass : sub.school_zoom_pass) || ''
            });
          }
        });
      }
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
              lecturerId: sem.lecturer_id || sub.lecturer_id || null,
              location: sem.location || 'Online',
              zoom_link: (isShared ? sub.zoom_link : sub.seminar_zoom_link) || '',
              zoom_id: (isShared ? sub.zoom_id : sub.seminar_zoom_id) || '',
              zoom_pass: (isShared ? sub.zoom_pass : sub.seminar_zoom_pass) || ''
            });
          }
        });
      }
    });

    // Deduplicate merged/shared classes (same date, lecturer, subjectCode, time)
    try {
      const dedupedEvents: any[] = [];
      events.forEach(evt => {
        if (!evt) return;
        const existing = dedupedEvents.find(e => 
          e.date === evt.date && 
          e.lecturer === evt.lecturer && 
          e.subjectCode === evt.subjectCode && 
          e.time === evt.time &&
          e.type === evt.type
        );
        
        if (existing) {
          const getCourseName = (fullName: string) => {
            if (!fullName) return '';
            const match = fullName.match(/\(([^)]+)\)$/);
            return match ? match[1] : '';
          };
          
          const getBaseName = (fullName: string) => {
            if (!fullName) return '';
            return fullName.replace(/\s*\([^)]+\)$/, '').trim();
          };
          
          const course1 = getCourseName(existing.subjectName || '');
          const course2 = getCourseName(evt.subjectName || '');
          const baseName = getBaseName(existing.subjectName || '');
          
          if (course1 && course2 && course1 !== course2) {
            const courses = Array.from(new Set([...course1.split(', '), ...course2.split(', ')]));
            existing.subjectName = `${baseName} (${courses.join(', ')})`;
          } else if (!course1 && course2) {
            existing.subjectName = `${existing.subjectName} (${course2})`;
          }
          
          if (existing.title !== evt.title && evt.title) {
            const titles = Array.from(new Set([existing.title, evt.title].filter(Boolean)));
            existing.title = titles.join(' / ');
          }
        } else {
          dedupedEvents.push({ ...evt });
        }
      });
      return dedupedEvents;
    } catch (err) {
      console.error('Error during events deduplication:', err);
      return events;
    }
  }, [subjects, lecturers]);

  // Calculate nearest class and assignment/milestone
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  let nearestClassDays: number | null = null;
  let nearestClassDateStr: string = '';
  
  let nearestAsmDays: number | null = null;
  let nearestAsmDateStr: string = '';
  let nearestAsmName: string = '';

  allEvents.forEach(evt => {
    if (!evt.date) return;
    const evtDate = new Date(evt.date + 'T00:00:00');
    if (evtDate >= todayDate) {
      const diffTime = evtDate.getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (nearestClassDays === null || diffDays < nearestClassDays) {
        nearestClassDays = diffDays;
        nearestClassDateStr = evt.date;
      }
    }
  });

  const allAssignments: any[] = [];
  subjects.forEach((sub: any) => {
    if (Array.isArray(sub.assignments)) {
      sub.assignments.forEach((asm: any) => {
        if (asm.due_date) {
          allAssignments.push({
            name: `${sub.name}: ${asm.name}`,
            date: asm.due_date.split('T')[0]
          });
        }
      });
    }
  });

  thesisMilestones.forEach((m: any) => {
    if (m.date) {
      allAssignments.push({
        name: `Mốc khóa luận: ${m.title}`,
        date: m.date
      });
    }
  });

  allAssignments.forEach(asm => {
    if (!asm.date) return;
    const asmDate = new Date(asm.date + 'T00:00:00');
    if (asmDate >= todayDate) {
      const diffTime = asmDate.getTime() - todayDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (nearestAsmDays === null || diffDays < nearestAsmDays) {
        nearestAsmDays = diffDays;
        nearestAsmDateStr = asm.date;
        nearestAsmName = asm.name;
      }
    }
  });

  // Calendar cells calculation
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Align to Monday
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const totalDays = getDaysInMonth(year, month);
  const startOffset = getFirstDayOfMonth(year, month);

  const dayCells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) {
    dayCells.push(null);
  }
  for (let i = 1; i <= totalDays; i++) {
    dayCells.push(new Date(year, month, i));
  }

  const eventsByDate: { [key: string]: any[] } = {};
  allEvents.forEach(evt => {
    if (!eventsByDate[evt.date]) eventsByDate[evt.date] = [];
    eventsByDate[evt.date].push(evt);
  });

  const milestonesByDate: { [key: string]: any[] } = {};
  thesisMilestones.forEach((m: any) => {
    if (m.date) {
      if (!milestonesByDate[m.date]) milestonesByDate[m.date] = [];
      milestonesByDate[m.date].push(m);
    }
  });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  const goToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    const dStr = getLocalDateString(date);
    const evts = eventsByDate[dStr] || [];
    const ms = milestonesByDate[dStr] || [];
    setSelectedDateStr(dStr);
    setSelectedDaySchedules(evts);
    setSelectedDayMilestones(ms);
    setIsModalOpen(true);
  };

  // Link copy action
  const getPublicLink = () => {
    const id = viewType === 'course' ? selectedCampaignId : selectedLecturerId;
    if (!id) return '';
    return `${window.location.origin}/public-schedule/${viewType}/${id}`;
  };

  const handleCopyLink = () => {
    const url = getPublicLink();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      toast.success('Đã sao chép link xem lịch học public!');
    }).catch(err => {
      console.error(err);
      toast.error('Lỗi khi sao chép link');
    });
  };

  const handleOpenPublicLink = () => {
    const url = getPublicLink();
    if (url) {
      window.open(url, '_blank');
    }
  };

  return (
    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', background: 'var(--color-bg)', minHeight: '100%' }}>
      
      {/* Selector and Actions Bar */}
      <div style={{ 
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '16px',
        padding: '1.5rem',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)' }}>Quản lý &amp; Xem Lịch học</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>Tra cứu lịch giảng dạy, lớp học và các mốc thời gian</span>
          </div>

          {/* Segment Toggle */}
          <div style={{ display: 'flex', background: 'var(--color-bg-light)', padding: '4px', borderRadius: '10px', border: '1px solid var(--color-border-light)' }}>
            <button
              onClick={() => { setViewType('course'); setData(null); }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: viewType === 'course' ? 'var(--color-primary)' : 'transparent',
                color: viewType === 'course' ? 'white' : 'var(--color-text-muted)',
                fontSize: '0.8rem',
                fontWeight: 750,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Lịch theo Khóa học
            </button>
            <button
              onClick={() => { setViewType('lecturer'); setData(null); }}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: viewType === 'lecturer' ? 'var(--color-primary)' : 'transparent',
                color: viewType === 'lecturer' ? 'white' : 'var(--color-text-muted)',
                fontSize: '0.8rem',
                fontWeight: 750,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Lịch của Giảng viên
            </button>
          </div>
        </div>

        {/* Dropdowns and Action Buttons */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
          <div style={{ width: '320px', maxWidth: '100%' }}>
            {viewType === 'course' ? (
              <CustomSelect
                options={[
                  { value: '', label: '-- Chọn Khóa học / Campaign --' },
                  ...campaigns.filter(c => c.status === 'active').map(c => ({ value: String(c.id), label: c.name }))
                ]}
                value={selectedCampaignId}
                onChange={(val) => setSelectedCampaignId(val as string)}
                placeholder="Chọn khóa học..."
                searchable
              />
            ) : (
              <CustomSelect
                options={[
                  { value: '', label: '-- Chọn Giảng viên --' },
                  { value: 'all', label: 'Tất cả giảng viên (Lịch tổng hợp)', icon: <Users size={14} /> },
                  ...companies.map(c => ({ value: String(c.id), label: c.name }))
                ]}
                value={selectedLecturerId}
                onChange={(val) => setSelectedLecturerId(val as string)}
                placeholder="Chọn giảng viên..."
                searchable
                showAvatars
              />
            )}
          </div>

          {((viewType === 'course' && selectedCampaignId) || (viewType === 'lecturer' && selectedLecturerId)) && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCopyLink}
                className="btn outline sm hover-lift"
                style={{ 
                  borderRadius: '100px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '0.78rem', 
                  fontWeight: 750, 
                  borderColor: 'var(--color-border)',
                  color: 'var(--color-text)',
                  background: '#ffffff',
                  border: '1px solid var(--color-border)',
                  cursor: 'pointer'
                }}
              >
                <Copy size={14} />
                <span>Copy Link Public</span>
              </button>
              <button
                onClick={handleOpenPublicLink}
                className="btn primary sm hover-lift"
                style={{ 
                  borderRadius: '100px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontSize: '0.78rem', 
                  fontWeight: 750, 
                  background: 'var(--color-primary)', 
                  border: 'none',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                <ExternalLink size={14} />
                <span>Xem bản Public</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Calendar View Area */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)' }}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : error ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', padding: '2rem' }}>
          <AlertCircle size={40} style={{ color: '#ef4444', marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{error}</div>
        </div>
      ) : !data ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', background: 'var(--color-surface)', borderRadius: '16px', border: '1px solid var(--color-border-light)', padding: '2rem', textAlign: 'center' }}>
          <CalendarDays size={48} style={{ color: 'var(--color-text-light)', marginBottom: '1rem' }} />
          <div style={{ fontSize: '0.925rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>Vui lòng chọn khóa học hoặc giảng viên ở trên để xem lịch học</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Header Card */}
          <div style={{ 
            background: 'var(--color-surface)', 
            borderRadius: '16px', 
            border: '1px solid var(--color-border-light)', 
            padding: '1.25rem 1.5rem', 
            display: 'flex', 
            flexWrap: 'wrap', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            gap: '1rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            {lecturer ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: '52px', 
                  height: '52px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)', 
                  color: '#ffffff',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: '1.25rem', 
                  fontWeight: 800,
                  border: '2px solid #ffffff',
                  boxShadow: '0 2px 8px rgba(185, 28, 28, 0.2)'
                }}>
                  {getStudentInitials(lecturer.name)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>Giảng viên: {lecturer.name}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-danger)', background: 'var(--color-danger-light)', padding: '2px 8px', borderRadius: '100px' }}>Giảng viên</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={13} /> Hệ thống: <strong style={{ color: 'var(--color-text)' }}>{program?.name}</strong></span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BookOpen size={13} /> Lịch giảng dạy: <strong style={{ color: 'var(--color-text)' }}>Tất cả khóa học</strong></span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ 
                  width: '52px', 
                  height: '52px', 
                  borderRadius: '50%', 
                  background: 'linear-gradient(135deg, #b91c1c 0%, #ef4444 100%)', 
                  color: '#ffffff',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  border: '2px solid #ffffff',
                  boxShadow: '0 2px 8px rgba(185, 28, 28, 0.2)'
                }}>
                  <CalendarDays size={24} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-text)' }}>Khóa học: {course?.name}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-primary)', background: 'var(--color-primary-light)', padding: '2px 8px', borderRadius: '100px' }}>Khóa học</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '0.78rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Briefcase size={13} /> Chương trình: <strong style={{ color: 'var(--color-text)' }}>{program?.name}</strong></span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BookOpen size={13} /> Mã khóa: <strong style={{ color: 'var(--color-text)' }}>{program?.code}</strong></span>
                  </div>
                </div>
              </div>
            )}
            
            {program?.degree_awarding_body && (
              <div style={{ 
                background: 'var(--color-bg-light)', 
                padding: '8px 14px', 
                borderRadius: '10px', 
                border: '1px solid var(--color-border-light)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Award size={16} style={{ color: '#d97706' }} />
                <div>
                  <div style={{ fontSize: '0.625rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Đơn vị</div>
                  <div style={{ fontSize: '0.78rem', fontWeight: 750, color: 'var(--color-text)' }}>{program.degree_awarding_body}</div>
                </div>
              </div>
            )}
          </div>

          {/* Notices Bar */}
          {(nearestClassDays !== null || nearestAsmDays !== null) && (
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
              gap: '1rem' 
            }}>
              {nearestClassDays !== null && (
                <div style={{ 
                  background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', 
                  border: '1px solid #bfdbfe', 
                  borderRadius: '14px', 
                  padding: '0.85rem 1.15rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  boxShadow: 'var(--shadow-xs)'
                }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#3b82f6', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Clock size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>{lecturer ? 'Lịch giảng sắp tới' : 'Lịch học sắp tới'}</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e3a8a', marginTop: '1px' }}>
                      {lecturer ? 'Lịch giảng gần nhất vào ' : 'Lịch học gần nhất của khóa vào '}
                      <span style={{ color: '#2563eb', fontWeight: 800 }}>{formatDaysPhrase(nearestClassDays)}</span> ({nearestClassDateStr.split('-').reverse().join('/')}).
                    </div>
                  </div>
                </div>
              )}

              {nearestAsmDays !== null && (
                <div style={{ 
                  background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', 
                  border: '1px solid #fed7aa', 
                  borderRadius: '14px', 
                  padding: '0.85rem 1.15rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px',
                  boxShadow: 'var(--shadow-xs)'
                }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#ea580c', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={18} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#c2410c', textTransform: 'uppercase' }}>{lecturer ? 'Bài tập & Cột mốc liên quan' : 'Bài tập & Hạn nộp'}</div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#7c2d12', marginTop: '1px' }}>
                      {lecturer ? 'Thời hạn bài tập/mốc liên quan ' : 'Hạn nộp bài tập/mốc gần nhất '}
                      <span style={{ color: '#ea580c', fontWeight: 800 }}>{formatDaysPhrase(nearestAsmDays)}</span> ({nearestAsmDateStr.split('-').reverse().join('/')}): <span style={{ fontWeight: 800 }}>{nearestAsmName}</span>.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Calendar Body */}
          <div style={{ 
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '20px',
            padding: '1.5rem',
            boxShadow: 'var(--shadow-md)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem'
          }}>
            {/* Controller Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={22} style={{ color: 'var(--color-primary)' }} />
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lịch học &amp; Sự kiện</h4>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-bg-light)', borderRadius: '10px', border: '1px solid var(--color-border-light)', padding: '2px' }}>
                  <button 
                    onClick={prevMonth}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text)', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                    className="hover-lift"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text)', padding: '0 12px', minWidth: '130px', textAlign: 'center' }}>
                    Tháng {month + 1} {year}
                  </span>
                  <button 
                    onClick={nextMonth}
                    style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text)', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px' }}
                    className="hover-lift"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
                <button 
                  onClick={goToday}
                  style={{ 
                    border: '1px solid var(--color-border)', 
                    background: '#ffffff', 
                    borderRadius: '10px', 
                    fontSize: '0.78rem', 
                    fontWeight: 750, 
                    padding: '8px 14px', 
                    color: 'var(--color-text)', 
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                  className="hover-lift"
                >
                  Hôm nay
                </button>
              </div>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600, flexWrap: 'wrap' }}>
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
                {/* Calendar Grid Header */}
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
                    const isToday = getLocalDateString(new Date()) === dStr;
                    const dayOfWeek = date.getDay(); // 0 is Sunday, 6 is Saturday
                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                    return (
                      <div 
                        key={idx} 
                        onClick={() => handleDayClick(date)}
                        style={{ 
                          background: isToday ? 'rgba(189, 29, 45, 0.05)' : isWeekend ? '#f8fafc' : '#ffffff', 
                          minHeight: '100px', 
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
                              title={`${evt.lecturer} - ${evt.subjectCode}: ${evt.title} (${evt.time})`}
                            >
                              {selectedLecturerId === 'all' 
                                ? `${evt.lecturer}: ${evt.subjectCode}`
                                : `${evt.subjectCode}: ${evt.title}`}
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
                              Mốc QL: {ms.title}
                            </div>
                          ))}

                          {(dayEvts.length + dayMs.length > 5) && (
                            <div style={{ fontSize: '0.625rem', color: 'var(--color-text-muted)', fontWeight: 700, textAlign: 'right', marginTop: '2px' }}>
                              + {dayEvts.length + dayMs.length - 5} sự kiện
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
        </div>
      )}

      {/* Calendar Day Details Modal */}
      {isModalOpen && selectedDateStr && createPortal(
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2147483600,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--color-surface)',
            borderRadius: '20px',
            width: '90%',
            maxWidth: '620px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-2xl)',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} style={{ color: 'var(--color-primary)' }} />
                <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  Chi tiết ngày {selectedDateStr.split('-').reverse().join('/')}
                </span>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--color-text-muted)', fontWeight: 700 }}
              >
                &times;
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {selectedDaySchedules.length === 0 && selectedDayMilestones.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  Không có sự kiện hoặc lịch học nào trong ngày này.
                </div>
              ) : (
                <>
                  {/* Schedules */}
                  {selectedDaySchedules.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Buổi học &amp; Chuyên đề ({selectedDaySchedules.length})
                      </div>
                       {selectedDaySchedules.map((evt, idx) => {
                         const isPassed = (() => {
                           if (!selectedDateStr) return false;
                           const now = new Date();
                           const [year, month, day] = selectedDateStr.split('-').map(Number);
                           const eventDate = new Date(year, month - 1, day);
                           const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                           
                           if (eventDate < today) return true;
                           if (eventDate > today) return false;
                           
                           if (evt.time) {
                             const parts = evt.time.split('-');
                             if (parts.length === 2) {
                               const endTimeStr = parts[1].trim();
                               const [endHour, endMin] = endTimeStr.split(':').map(Number);
                               if (!isNaN(endHour) && !isNaN(endMin)) {
                                 const eventEndTime = new Date(year, month - 1, day, endHour, endMin);
                                 return now > eventEndTime;
                               }
                             }
                           }
                           return false;
                         })();

                         return (
                           <div key={idx} style={{ 
                             padding: '12px', 
                             background: 'var(--color-bg-light)', 
                             borderRadius: '12px', 
                             border: '1px solid var(--color-border-light)',
                             display: 'flex',
                             flexDirection: 'column',
                             gap: '6px'
                           }}>
                             <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                               <span style={{ 
                                 fontSize: '0.625rem', 
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
                             <div style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--color-text)' }}>{evt.title}</div>
                             <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.72rem', color: 'var(--color-text-light)', borderTop: '1px dashed var(--color-border-light)', paddingTop: '6px', marginTop: '2px' }}>
                               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                 <span>Giờ: <strong style={{ color: 'var(--color-text)' }}>{evt.time}</strong></span>
                                 {isPassed && (
                                   <span style={{ 
                                     fontSize: '0.6rem', 
                                     fontWeight: 800, 
                                     color: '#6b7280', 
                                     background: '#e5e7eb', 
                                     padding: '1px 5px', 
                                     borderRadius: '4px', 
                                     textTransform: 'uppercase'
                                   }}>
                                     Đã kết thúc
                                   </span>
                                 )}
                               </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>Giảng viên:</span>
                              <div 
                                onClick={() => {
                                  if (evt.lecturerId) {
                                    const lecturerEntity = companies.find(c => String(c.id) === String(evt.lecturerId));
                                    if (lecturerEntity) {
                                      setSelectedLecturerEntity(lecturerEntity);
                                      setIsLecturerDrawerOpen(true);
                                    } else {
                                      setSelectedLecturerEntity({ id: Number(evt.lecturerId), name: evt.lecturer });
                                      setIsLecturerDrawerOpen(true);
                                    }
                                  }
                                }}
                                style={{ 
                                  display: 'inline-flex', 
                                  alignItems: 'center', 
                                  gap: '4px', 
                                  cursor: evt.lecturerId ? 'pointer' : 'default',
                                  padding: '2px 8px',
                                  background: 'var(--color-bg-light)',
                                  borderRadius: '20px',
                                  border: '1px solid var(--color-border-light)',
                                  transition: 'all 0.2s'
                                }}
                                className={evt.lecturerId ? "hover-lift" : ""}
                              >
                                 <Avatar name={evt.lecturer} size={16} />
                                 <strong style={{ color: 'var(--color-text)' }}>{evt.lecturer}</strong>
                               </div>
                             </div>
                             <div>Địa điểm: <strong style={{ color: 'var(--color-text)' }}>{evt.location}</strong></div>
                           </div>
                           {evt.zoom_link && (
                             <div style={{ 
                               marginTop: '8px', 
                               background: '#F0F7FF', 
                               border: '1px solid #C2E0FF', 
                               borderRadius: '8px', 
                               padding: '8px 10px', 
                               display: 'flex', 
                               flexDirection: 'column', 
                               gap: '6px'
                             }}>
                               <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                                 <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#0B5CFF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                   <img 
                                     src="https://assets-global.website-files.com/637501ee593ea3846f81d45e/63ea7af9128d3e56379023e6_zoom-logo-in-blue-colors-meetings-app-logotype-illustration-free-png.png" 
                                     style={{ width: '16px', height: '16px', objectFit: 'contain' }} 
                                     alt="Zoom" 
                                   />
                                   Phòng Zoom Trực tuyến
                                   {isPassed && (
                                      <span style={{ 
                                        fontSize: '0.6rem', 
                                        fontWeight: 800, 
                                        color: '#4b5563', 
                                        background: '#e5e7eb', 
                                        padding: '1px 5px', 
                                        borderRadius: '4px', 
                                        marginLeft: '6px',
                                        textTransform: 'uppercase' 
                                      }}>
                                        Đã kết thúc
                                      </span>
                                    )}
                                 </span>
                                 <button
                                   onClick={() => {
                                     const infoText = `Link Zoom: ${evt.zoom_link}\nID: ${evt.zoom_id || ''}\nPass: ${evt.zoom_pass || ''}`;
                                     navigator.clipboard.writeText(infoText)
                                       .then(() => toast.success('Đã copy Link, ID và Pass!'))
                                       .catch(() => {});
                                   }}
                                   style={{
                                     display: 'flex',
                                     alignItems: 'center',
                                     gap: '4px',
                                     background: '#2D8CFF',
                                     color: '#ffffff',
                                     border: 'none',
                                     borderRadius: '6px',
                                     padding: '4px 8px',
                                     fontSize: '0.68rem',
                                     fontWeight: 750,
                                     cursor: 'pointer',
                                     boxShadow: '0 2px 4px rgba(45, 140, 255, 0.2)'
                                   }}
                                   className="hover-lift"
                                 >
                                   Copy thông tin <Copy size={11} />
                                 </button>
                               </div>
                               
                               <div style={{ 
                                 display: 'flex', 
                                 flexDirection: 'column',
                                 gap: '8px', 
                                 fontSize: '0.68rem', 
                                 color: 'var(--color-text)', 
                                 background: '#ffffff', 
                                 padding: '6px 8px', 
                                 borderRadius: '4px', 
                                 border: '1px solid #C2E0FF'
                               }}>
                                 {/* Zoom Link Display */}
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%', wordBreak: 'break-all' }}>
                                   <span style={{ fontWeight: 600, flexShrink: 0 }}>Link:</span>
                                   <a 
                                     href={evt.zoom_link} 
                                     target="_blank" 
                                     rel="noopener noreferrer" 
                                     style={{ color: '#2D8CFF', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}
                                   >
                                     {evt.zoom_link}
                                   </a>
                                   <button 
                                     onClick={() => {
                                       navigator.clipboard.writeText(evt.zoom_link);
                                       toast.success('Đã copy Zoom Link!');
                                     }}
                                     style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', color: 'var(--color-text-muted)', flexShrink: 0 }}
                                   >
                                     <Copy size={11} />
                                   </button>
                                 </div>

                                 {/* ID and Pass row */}
                                 <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px dashed var(--color-border-light)', paddingTop: '6px' }}>
                                   {evt.zoom_id && (
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                       <span>ID: <strong>{evt.zoom_id}</strong></span>
                                       <button 
                                         onClick={() => {
                                           navigator.clipboard.writeText(evt.zoom_id);
                                           toast.success('Đã copy Zoom ID!');
                                         }}
                                         style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', color: 'var(--color-text-muted)' }}
                                       >
                                         <Copy size={11} />
                                       </button>
                                     </div>
                                   )}
                                   {evt.zoom_pass && (
                                     <div style={{ display: 'flex', alignItems: 'center', gap: '4px', borderLeft: '1px solid var(--color-border-light)', paddingLeft: '10px' }}>
                                       <span>Pass: <strong>{evt.zoom_pass}</strong></span>
                                       <button 
                                         onClick={() => {
                                           navigator.clipboard.writeText(evt.zoom_pass);
                                           toast.success('Đã copy Zoom Pass!');
                                         }}
                                         style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px', color: 'var(--color-text-muted)' }}
                                       >
                                         <Copy size={11} />
                                       </button>
                                     </div>
                                   )}
                                 </div>
                               </div>
                             </div>
                           )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Milestones */}
                  {selectedDayMilestones.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                        Cột mốc luận văn ({selectedDayMilestones.length})
                      </div>
                      {selectedDayMilestones.map((ms, idx) => (
                        <div key={idx} style={{ 
                          padding: '12px', 
                          background: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 100%)', 
                          borderRadius: '12px', 
                          border: '1px solid #fed7aa',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}>
                          <div style={{ fontSize: '0.825rem', fontWeight: 800, color: '#c2410c' }}>{ms.title}</div>
                          <div style={{ fontSize: '0.72rem', color: '#7c2d12' }}>{ms.description || 'Không có mô tả chi tiết.'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {isLecturerDrawerOpen && selectedLecturerEntity && (
        <CompanyDrawer
          isOpen={isLecturerDrawerOpen}
          onClose={() => setIsLecturerDrawerOpen(false)}
          entity={selectedLecturerEntity}
          onSave={() => {}}
        />
      )}
    </div>
  );
};
