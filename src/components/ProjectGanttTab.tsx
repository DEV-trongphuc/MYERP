import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { fetchAPI } from '../utils/api';
import { Calendar, RefreshCw, Plus, Link2, Clock, CheckCircle2, ChevronRight, User, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ProjectGanttTabProps {
  projectId: number;
}

interface Task {
  id: number;
  subject: string;
  start_date: string | null;
  due_date: string | null;
  status: 'planned' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  progress: number;
  user_id: number | null;
  user_name?: string;
  predecessor_id?: number | null;
  lag_days?: number;
}

export const ProjectGanttTab: React.FC<ProjectGanttTabProps> = ({ projectId }) => {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [predecessorId, setPredecessorId] = useState<string>('');
  const [lagDays, setLagDays] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'days' | 'weeks'>('days');

  // Load danh sách công việc của dự án
  const loadTasks = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/activities?type=task&related_type=project&related_id=${projectId}`);
      const list = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      
      // Load thông tin phụ thuộc cho từng task
      const updatedList = await Promise.all(list.map(async (task: any) => {
        try {
          const depRes = await api.get(`/activities/${task.id}/dependencies`);
          const deps = depRes.data || [];
          if (deps.length > 0) {
            return {
              ...task,
              predecessor_id: deps[0].predecessor_id,
              lag_days: deps[0].lag_days
            };
          }
        } catch (e) {}
        return task;
      }));

      setTasks(updatedList);
    } catch (e: any) {
      setError(t('Không thể tải danh sách công việc'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      loadTasks();
    }
  }, [projectId]);

  // Cập nhật ngày bắt đầu/kết thúc của task
  const handleUpdateDates = async (taskId: number, newStart: string, newDue: string) => {
    try {
      await api.put(`/activities/${taskId}`, {
        start_date: newStart,
        due_date: newDue
      });
      await loadTasks(); // Tải lại để cập nhật lịch trình dây chuyền tự động từ backend
    } catch (e: any) {
      alert(e.response?.data?.message || t('Lỗi khi cập nhật ngày'));
    }
  };

  // Thiết lập mối quan hệ phụ thuộc
  const handleSaveDependency = async () => {
    if (!selectedTaskId) return;
    try {
      const payload = predecessorId 
        ? { predecessors: [{ predecessor_id: Number(predecessorId), dependency_type: 'FS', lag_days: Number(lagDays) }] }
        : { predecessors: [] };

      await api.post(`/activities/${selectedTaskId}/dependencies`, payload);
      alert(t('Cập nhật mối quan hệ phụ thuộc thành công!'));
      setSelectedTaskId(null);
      setPredecessorId('');
      setLagDays(0);
      await loadTasks();
    } catch (e: any) {
      alert(e.response?.data?.message || t('Lỗi khi thiết lập phụ thuộc'));
    }
  };

  // Tính toán thời gian bắt đầu và kết thúc chung của dự án để vẽ timeline
  const getTimelineRange = () => {
    const dates = tasks
      .flatMap(t => [t.start_date, t.due_date])
      .filter(Boolean)
      .map(d => new Date(d!).getTime());

    if (dates.length === 0) {
      const today = new Date();
      const nextMonth = new Date();
      nextMonth.setMonth(today.getMonth() + 1);
      return { start: today, end: nextMonth };
    }

    const minTime = Math.min(...dates);
    const maxTime = Math.max(...dates);
    
    // Thêm biên 3 ngày trước và sau
    const start = new Date(minTime - 3 * 86400 * 1000);
    const end = new Date(maxTime + 7 * 86400 * 1000);
    return { start, end };
  };

  const { start: timelineStart, end: timelineEnd } = getTimelineRange();
  const totalDays = Math.ceil((timelineEnd.getTime() - timelineStart.getTime()) / (86400 * 1000));

  // Tạo mảng các ngày để vẽ header timeline
  const getTimelineDays = () => {
    const days = [];
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(timelineStart.getTime() + i * 86400 * 1000);
      days.push(date);
    }
    return days;
  };

  const timelineDays = getTimelineDays();

  // Helper render thanh Bar của Task
  const renderTaskBar = (task: Task) => {
    if (!task.start_date || !task.due_date) return null;
    
    const taskStart = new Date(task.start_date).getTime();
    const taskDue = new Date(task.due_date).getTime();
    
    const leftPercent = ((taskStart - timelineStart.getTime()) / (timelineEnd.getTime() - timelineStart.getTime())) * 100;
    const widthPercent = ((taskDue - taskStart) / (timelineEnd.getTime() - timelineStart.getTime())) * 100;

    const priorityColors = {
      high: 'linear-gradient(135deg, #ef4444, #f87171)',
      medium: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
      low: 'linear-gradient(135deg, #10b981, #34d399)'
    };

    return (
      <div style={{ position: 'relative', width: '100%', height: '44px', display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            position: 'absolute',
            left: `${leftPercent}%`,
            width: `${widthPercent}%`,
            minWidth: '24px',
            height: '24px',
            background: priorityColors[task.priority] || priorityColors.medium,
            borderRadius: '6px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center'
          }}
          onClick={() => {
            setSelectedTaskId(task.id);
            setPredecessorId(task.predecessor_id ? String(task.predecessor_id) : '');
            setLagDays(task.lag_days || 0);
          }}
          title={`${task.subject} (${task.progress}%)`}
        >
          {/* Progress Bar nội bộ */}
          <div
            style={{
              width: `${task.progress}%`,
              height: '100%',
              background: 'rgba(255, 255, 255, 0.25)',
              transition: 'width 0.4s ease'
            }}
          />
        </div>
      </div>
    );
  };

  // Helper dịch chuyển ngày của task
  const shiftTaskDays = (task: Task, days: number) => {
    if (!task.start_date || !task.due_date) return;
    const newStart = new Date(new Date(task.start_date).getTime() + days * 86400 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    const newDue = new Date(new Date(task.due_date).getTime() + days * 86400 * 1000).toISOString().replace('T', ' ').substring(0, 19);
    handleUpdateDates(task.id, newStart, newDue);
  };

  return (
    <div style={{
      background: 'var(--color-surface)',
      border: '1px solid var(--color-border-light)',
      borderRadius: '16px',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.25rem',
      boxShadow: 'var(--shadow-sm)'
    }}>
      {/* Header Panel */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '3px', height: '14px', background: 'var(--color-primary)', borderRadius: '1.5px' }} />
          <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('Sơ đồ tiến độ Gantt & Ràng buộc công việc')}
          </h4>
        </div>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={() => setViewMode(viewMode === 'days' ? 'weeks' : 'days')}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: '1px solid var(--color-border-light)',
              background: 'var(--color-surface-hover)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Calendar size={13} />
            {viewMode === 'days' ? t('Chế độ Tuần') : t('Chế độ Ngày')}
          </button>

          <button
            onClick={loadTasks}
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              fontWeight: 700,
              borderRadius: '8px',
              border: '1px solid var(--color-border-light)',
              background: 'var(--color-surface-hover)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={13} className={loading ? 'spin-anim' : ''} />
            {t('Tải lại')}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <RefreshCw size={24} className="spin-anim" style={{ color: 'var(--color-primary)' }} />
        </div>
      ) : error ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-danger)', fontSize: '0.85rem' }}>{error}</div>
      ) : tasks.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          {t('Dự án này chưa có công việc (tasks) nào để vẽ sơ đồ.')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Main Gantt Grid Container */}
          <div style={{ 
            overflowX: 'auto', 
            border: '1px solid var(--color-border-light)', 
            borderRadius: '12px',
            background: 'var(--color-background-base)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
              {/* Timeline Table Header */}
              <thead>
                <tr style={{ background: 'var(--color-surface-hover)', borderBottom: '1px solid var(--color-border-light)' }}>
                  <th style={{ padding: '12px', width: '280px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', borderRight: '1px solid var(--color-border-light)' }}>
                    {t('TÊN CÔNG VIỆC')}
                  </th>
                  <th style={{ padding: '12px', width: '140px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', borderRight: '1px solid var(--color-border-light)' }}>
                    {t('THỜI GIAN')}
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)' }}>
                    {t('SƠ ĐỒ TIẾN ĐỘ (TIMELINE)')}
                  </th>
                </tr>
              </thead>

              {/* Timeline Table Body */}
              <tbody>
                {tasks.map(task => {
                  const isSelected = selectedTaskId === task.id;
                  return (
                    <tr 
                      key={task.id} 
                      style={{ 
                        borderBottom: '1px solid var(--color-border-light)',
                        background: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                        transition: 'background 0.2s ease'
                      }}
                    >
                      {/* Cột 1: Thông tin Task */}
                      <td style={{ 
                        padding: '10px 12px', 
                        borderRight: '1px solid var(--color-border-light)',
                        verticalAlign: 'middle'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            {task.subject}
                          </span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                            <span style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              background: task.status === 'done' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: task.status === 'done' ? 'var(--color-success)' : 'var(--color-danger)',
                              fontWeight: 700
                            }}>
                              {task.status === 'done' ? t('Hoàn thành') : t('Chưa xong')}
                            </span>
                            {task.predecessor_id && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--color-primary)' }}>
                                <Link2 size={10} />
                                {t('Phụ thuộc')}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Điều chỉnh Ngày & Giờ */}
                      <td style={{ 
                        padding: '10px 12px', 
                        borderRight: '1px solid var(--color-border-light)',
                        fontSize: '0.75rem',
                        color: 'var(--color-text)'
                      }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button 
                              onClick={() => shiftTaskDays(task, -1)}
                              style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--color-border-light)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}
                              title={t('Lùi lại 1 ngày')}
                            >
                              -1d
                            </button>
                            <span style={{ fontFamily: 'monospace', fontSize: '0.7rem' }}>
                              {task.start_date ? new Date(task.start_date).toLocaleDateString('vi-VN') : 'N/A'}
                            </span>
                            <button 
                              onClick={() => shiftTaskDays(task, 1)}
                              style={{ padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--color-border-light)', background: 'var(--color-surface)', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 'bold' }}
                              title={t('Tịnh tiến 1 ngày')}
                            >
                              +1d
                            </button>
                          </div>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>
                            đến {task.due_date ? new Date(task.due_date).toLocaleDateString('vi-VN') : 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Cột 3: Gantt Timeline Bar */}
                      <td style={{ padding: '0 12px', position: 'relative', overflow: 'hidden' }}>
                        {renderTaskBar(task)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Ràng buộc Tiến độ (Dependency Configuration Panel) */}
          {selectedTaskId && (
            <div style={{
              background: 'var(--color-surface-hover)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '12px',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              animation: 'fadeIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h5 style={{ margin: 0, fontSize: '0.825rem', fontWeight: 800, color: 'var(--color-text)' }}>
                  🔗 {t('Cấu hình Ràng buộc Phụ thuộc của Công việc')}
                </h5>
                <button
                  onClick={() => setSelectedTaskId(null)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}
                >
                  {t('Hủy')}
                </button>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                {/* Chọn Task Tiền Nhiệm */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                    {t('Công việc tiền nhiệm (Predecessor)')}
                  </label>
                  <select
                    value={predecessorId}
                    onChange={(e) => setPredecessorId(e.target.value)}
                    style={{
                      padding: '8px',
                      fontSize: '0.75rem',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border-light)',
                      background: 'var(--color-surface)',
                      color: 'var(--color-text)'
                    }}
                  >
                    <option value="">{t('-- Không có --')}</option>
                    {tasks
                      .filter(t => t.id !== selectedTaskId)
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.subject}</option>
                      ))}
                  </select>
                </div>

                {/* Thiết lập Lag Days */}
                {predecessorId && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '120px' }}>
                    <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                      {t('Lag Days (Ngày chờ)')}
                    </label>
                    <input
                      type="number"
                      value={lagDays}
                      onChange={(e) => setLagDays(Number(e.target.value))}
                      style={{
                        padding: '8px',
                        fontSize: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border-light)',
                        background: 'var(--color-surface)',
                        color: 'var(--color-text)'
                      }}
                      min={0}
                    />
                  </div>
                )}

                <button
                  onClick={handleSaveDependency}
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--color-primary)',
                    color: 'white',
                    cursor: 'pointer',
                    height: '35px'
                  }}
                >
                  {t('Lưu Ràng Buộc')}
                </button>
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={11} style={{ color: 'var(--color-warning)' }} />
                <span>{t('Ghi chú: Khi công việc tiền nhiệm thay đổi ngày hoàn thành, công việc này và toàn bộ các công việc phụ thuộc phía sau sẽ tự động tịnh tiến lịch trình tương ứng.')}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
