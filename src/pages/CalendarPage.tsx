import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, 
  Clock, Phone, Users, Video, FileText, CheckCircle2, MoreHorizontal
} from 'lucide-react';
import api from '../api/axios';
import { useUIStore } from '../store/uiStore';
import { useAuth } from '../contexts/AuthContext';
import { AttendancePageInner } from './AttendancePage';

export const CalendarPage: React.FC = () => {
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { addToast } = useUIStore();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'calendar' | 'attendance'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | number>('');

  const formatVND = (n: any) => {
    const num = Math.round(Number(n || 0));
    if (num >= 1e9) {
      return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(num / 1e9) + ' Tỷ';
    }
    if (num >= 1e6) {
      return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(num / 1e6) + ' Tr';
    }
    return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
  };

  const fetchActivities = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01 00:00:00`;
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()} 23:59:59`;
      
      const params: any = {
        start_date: startDate,
        end_date: endDate,
        limit: 200, // Ensure we get all for the month
        type: 'task,meeting'
      };

      // Chỉ lấy lịch trình cá nhân (user.id) làm mặc định ban đầu. Chỉ lấy tất cả khi selectedUserId === 'all'
      const activeUserId = selectedUserId || user.id;
      if (activeUserId && activeUserId !== 'all') {
        params.user_id = activeUserId;
      }

      const res = await api.get('/activities', { params });
      let fetched = res.data.data?.items || res.data.data || [];

      // Load PO & SO if user is accountant or admin/director
      const isAccountantOrAdmin = user && ['accountant', 'admin', 'superadmin', 'super_admin', 'director'].includes(user.role);
      if (isAccountantOrAdmin) {
        try {
          const [poRes, soRes] = await Promise.all([
            api.get('/purchase-orders').catch(() => ({ data: [] })),
            api.get('/deposits').catch(() => ({ data: [] }))
          ]);

          const poList = poRes.data?.data || poRes.data || [];
          const soList = soRes.data?.data || soRes.data || [];

          // Map POs
          const poEvents = poList
            .filter((po: any) => po.order_date && po.order_date >= startDate.substring(0, 10) && po.order_date <= endDate.substring(0, 10))
            .map((po: any) => ({
              id: `po-${po.id}`,
              subject: `[PO] ${po.po_number} - ${po.supplier_name || 'NCC'} (${formatVND(po.total)})`,
              due_date: po.order_date,
              type: 'po',
              status: po.status === 'received' ? 'done' : 'planned'
            }));

          // Map SOs
          const soEvents = soList
            .filter((so: any) => so.created_at && so.created_at.substring(0, 10) >= startDate.substring(0, 10) && so.created_at.substring(0, 10) <= endDate.substring(0, 10))
            .map((so: any) => ({
              id: `so-${so.id}`,
              subject: `[SO] ${so.unit_code} - ${so.full_name || 'Khách'} (${formatVND(so.price)})`,
              due_date: so.created_at.substring(0, 10),
              type: 'so',
              status: so.status === 'approved' ? 'done' : 'planned'
            }));

          fetched = [...fetched, ...poEvents, ...soEvents];
        } catch (e) {
          console.error('Error fetching PO/SO for calendar', e);
        }
      }

      setActivities(fetched);
    } catch (err: any) {
      addToast('Lỗi khi tải lịch làm việc', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && !selectedUserId) {
      setSelectedUserId(user.id);
    }
  }, [user]);

  useEffect(() => {
    const isPrivileged = user && ['admin', 'superadmin', 'super_admin', 'director'].includes(user.role);
    if (isPrivileged) {
      api.get('/users?all=1')
        .then(res => {
          const d = res.data.data || res.data;
          setUsers(Array.isArray(d) ? d : []);
        })
        .catch(err => console.error('Error fetching users for calendar filter', err));
    }
  }, [user]);

  useEffect(() => {
    if (user?.id) {
      fetchActivities();
    }
  }, [currentDate, selectedUserId, user?.id]);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = new Intl.DateTimeFormat('vi-VN', { month: 'long' }).format(currentDate);

  const days = [];
  const totalDays = daysInMonth(year, month);
  const startOffset = firstDayOfMonth(year, month);

  // Padding for start of month
  for (let i = 0; i < startOffset; i++) {
    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
  }

  // Days of month
  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayActivities = activities.filter(a => a.due_date && a.due_date.startsWith(dateStr));
    const isToday = new Date().toDateString() === new Date(year, month, d).toDateString();

    days.push(
      <div key={d} className={`calendar-day ${isToday ? 'today' : ''}`}>
        <div className="day-header">
           <span className="day-number">{d}</span>
           {dayActivities.length > 0 && <span className="activity-dot"></span>}
        </div>
        <div className="day-content">
           {dayActivities.slice(0, 3).map(a => (
             <div key={a.id} className={`calendar-event ${a.type} ${a.status === 'done' ? 'completed' : ''}`}>
               {a.type === 'call' && <Phone size={10} />}
               {a.type === 'meeting' && <Video size={10} />}
               {a.type === 'task' && <CheckCircle2 size={10} />}
               {(a.type === 'po' || a.type === 'so') && <FileText size={10} />}
               <span className="event-subject">{a.subject}</span>
             </div>
           ))}
           {dayActivities.length > 3 && (
             <div className="more-events">+{dayActivities.length - 3} thêm</div>
           )}
        </div>
      </div>
    );
  }

  const weekDays = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

  return (
    <div className="page-container flex flex-col h-full overflow-hidden">
      <div className="page-header flex-shrink-0">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0 }}>Lịch biểu &amp; Chấm công</h1>
            {['accountant', 'admin', 'superadmin', 'super_admin', 'director'].includes(user?.role || '') && (
              <button
                type="button"
                className="btn secondary sm"
                onClick={() => navigate('/data?view=calendar')}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px', 
                  fontWeight: 600, 
                  padding: '4px 12px',
                  fontSize: '0.78rem',
                  borderRadius: '8px'
                }}
              >
                <CalendarIcon size={13} />
                Xem Lịch trình Tài chính
              </button>
            )}
            
            {/* Tabs for Calendar vs Attendance */}
            {user?.role !== 'accountant' && user?.role !== 'viewer' && (
              <div style={{ display: 'flex', background: 'var(--color-border-light)', padding: '4px', borderRadius: '12px', gap: '4px' }}>
                <button 
                  onClick={() => setActiveTab('calendar')}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: activeTab === 'calendar' ? 'var(--color-surface)' : 'transparent',
                    color: activeTab === 'calendar' ? 'var(--color-primary)' : 'var(--color-text-light)',
                    boxShadow: activeTab === 'calendar' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.2s'
                  }}
                  className={activeTab === 'calendar' ? '' : 'hover-lift'}
                >
                  Lịch biểu công việc
                </button>
                <button 
                  onClick={() => setActiveTab('attendance')}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    background: activeTab === 'attendance' ? 'var(--color-surface)' : 'transparent',
                    color: activeTab === 'attendance' ? 'var(--color-primary)' : 'var(--color-text-light)',
                    boxShadow: activeTab === 'attendance' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                    transition: 'all 0.2s'
                  }}
                  className={activeTab === 'attendance' ? '' : 'hover-lift'}
                >
                  Chấm công & Nghỉ phép
                </button>
              </div>
            )}
          </div>
          <p className="page-subtitle" style={{ marginTop: '0.25rem' }}>
            {activeTab === 'calendar' ? 'Theo dõi các cuộc hẹn, cuộc gọi và nhiệm vụ của bạn' : 'Quản lý thông tin giờ làm, bổ sung công và đăng ký nghỉ phép của bạn'}
          </p>
        </div>
        {activeTab === 'calendar' && (
          <div className="flex gap-3 items-center">
            {['admin', 'superadmin', 'super_admin', 'director'].includes(user?.role || '') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '2px 8px 2px 12px', boxShadow: 'var(--shadow-sm)' }}>
                <Users size={15} style={{ color: 'var(--color-primary)' }} />
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(e.target.value)}
                  style={{
                    padding: '6px 24px 6px 4px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--color-text)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value={user?.id || ''}>Lịch trình cá nhân</option>
                  <option value="all">Tất cả thành viên</option>
                  {users.filter(u => u.id !== user?.id).map(u => (
                    <option key={u.id} value={u.id}>
                      {u.full_name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-1 shadow-sm">
               <button className="btn-icon sm" onClick={prevMonth}><ChevronLeft size={18} /></button>
               <span className="px-4 font-black capitalize" style={{ minWidth: '140px', textAlign: 'center', color: 'var(--color-text)' }}>
                 {monthName} {year}
               </span>
               <button className="btn-icon sm" onClick={nextMonth}><ChevronRight size={18} /></button>
            </div>
            <button className="btn primary"><Plus size={18} /> Thêm công việc</button>
          </div>
        )}
      </div>

      {activeTab === 'calendar' ? (
        <div className="flex-1 overflow-hidden flex flex-col card-panel p-0 bg-[var(--color-surface)] border border-[var(--color-border)] animate-fade" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ overflowX: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ minWidth: isMobile ? '700px' : 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-bg)]">
                {weekDays.map(wd => (
                  <div key={wd} className="py-3 text-center text-xs font-black uppercase tracking-widest" style={{ color: 'var(--color-text-light)' }}>
                    {wd}
                  </div>
                ))}
              </div>
              <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto">
                {days}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-0 animate-fade">
          <AttendancePageInner />
        </div>
      )}

      <style>{`
        .calendar-day {
          min-height: 120px;
          border-right: 1px solid var(--color-border-light);
          border-bottom: 1px solid var(--color-border-light);
          padding: 8px;
          transition: background 0.2s;
        }
        .calendar-day:nth-child(7n) { border-right: none; }
        .calendar-day:hover { background: var(--color-bg); }
        .calendar-day.empty { background: var(--color-bg); opacity: 0.3; }
        .calendar-day.today { background: var(--color-primary-light); }
        .calendar-day.today .day-number {
          background: var(--color-primary);
          color: white;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
        }
        .day-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .day-number { font-weight: 700; font-size: 0.85rem; color: var(--color-text-light); }
        .activity-dot { width: 6px; height: 6px; background: var(--color-primary); border-radius: 50%; }
        
        .day-content { display: flex; flex-direction: column; gap: 4px; }
        .calendar-event {
          padding: 4px 8px;
          border-radius: 6px;
          font-size: 0.7rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .calendar-event.call { background: #e0f2fe; color: #0369a1; border-left: 3px solid #0369a1; }
        .calendar-event.meeting { background: #fef3c7; color: #92400e; border-left: 3px solid #92400e; }
        .calendar-event.task { background: #dcfce7; color: #166534; border-left: 3px solid #166534; }
        .calendar-event.po { background: #e0e7ff; color: #3730a3; border-left: 3px solid #3730a3; }
        .calendar-event.so { background: #ecfdf5; color: #047857; border-left: 3px solid #047857; }
        [data-theme="dark"] .calendar-event.call { background: rgba(59, 130, 246, 0.15); color: #93c5fd; border-left-color: #3b82f6; }
        [data-theme="dark"] .calendar-event.meeting { background: rgba(245, 158, 11, 0.15); color: #fcd34d; border-left-color: #f59e0b; }
        [data-theme="dark"] .calendar-event.task { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; border-left-color: #10b981; }
        [data-theme="dark"] .calendar-event.po { background: rgba(99, 102, 241, 0.15); color: #a5b4fc; border-left-color: #6366f1; }
        [data-theme="dark"] .calendar-event.so { background: rgba(16, 185, 129, 0.15); color: #a7f3d0; border-left-color: #10b981; }
        .calendar-event.completed { opacity: 0.5; text-decoration: line-through; }
        .more-events { font-size: 0.65rem; color: var(--color-text-muted); font-weight: 700; text-align: center; margin-top: 2px; }
      `}</style>
    </div>
  );
};
