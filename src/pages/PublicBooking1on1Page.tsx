import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  User,
  Mail,
  Phone,
  BookOpen,
  ExternalLink,
  Download,
  Video,
  Sparkles,
  Lock,
} from 'lucide-react';
import {
  AFTERNOON_SLOTS,
  EVENING_SLOTS,
  DAY_KEYS,
} from '../components/academic/LecturerInvitationAnd1on1Modal';
import { API_BASE } from '../config/env';

const API_URL = API_BASE;

function buildPublicAcademicApiUrl(rawUrl: string): string {
  const idx = rawUrl.indexOf('/academic/');
  if (idx === -1) return rawUrl;
  const base = rawUrl.slice(0, idx);
  const rest = rawUrl.slice(idx + 1);
  const [actionPart, qsPart] = rest.split('?');
  return `${base}/api.php?action=${encodeURIComponent(actionPart)}${qsPart ? `&${qsPart}` : ''}`;
}

export const PublicBooking1on1Page: React.FC = () => {
  const { bookingCode } = useParams<{ bookingCode: string }>();

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [config, setConfig] = useState<any>(null);
  const [bookedSlots, setBookedSlots] = useState<any[]>([]);

  // Selected slot state
  const [selectedCell, setSelectedCell] = useState<{
    dayKey: string;
    dayLabel: string;
    dateStr: string;
    slotRange: string;
  } | null>(null);

  // Student booking form
  const [studentName, setStudentName] = useState<string>('');
  const [studentCode, setStudentCode] = useState<string>('');
  const [studentEmail, setStudentEmail] = useState<string>('');
  const [studentPhone, setStudentPhone] = useState<string>('');
  const [topic, setTopic] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [bookingResult, setBookingResult] = useState<any>(null);

  const fetchSchedule = useCallback(async () => {
    if (!bookingCode) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(buildPublicAcademicApiUrl(`${API_URL}/academic/public-1on1/${bookingCode}`));
      const json = await res.json();
      if (json.success && json.data) {
        setConfig(json.data.config);
        setBookedSlots(Array.isArray(json.data.booked_slots) ? json.data.booked_slots : []);
      } else {
        setError(json.message || 'Không tìm thấy lịch đăng ký hướng dẫn 1:1.');
      }
    } catch (err: any) {
      setError('Không thể kết nối máy chủ. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [bookingCode]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  // Compute exact date for each day column from week_start_date
  const getDayDateInfo = (dayIdx: number): { dateStr: string; shortDisplay: string } => {
    const baseStr = config?.week_start_date;
    if (!baseStr) {
      const now = new Date();
      now.setDate(now.getDate() + dayIdx);
      const iso = now.toISOString().slice(0, 10);
      return {
        dateStr: iso,
        shortDisplay: `${String(now.getDate()).padStart(2, '0')}/${String(
          now.getMonth() + 1
        ).padStart(2, '0')}`,
      };
    }
    const d = new Date(`${baseStr}T00:00:00`);
    if (Number.isNaN(d.getTime())) {
      return { dateStr: baseStr, shortDisplay: '' };
    }
    d.setDate(d.getDate() + dayIdx);
    const iso = d.toISOString().slice(0, 10);
    return {
      dateStr: iso,
      shortDisplay: `${String(d.getDate()).padStart(2, '0')}/${String(
        d.getMonth() + 1
      ).padStart(2, '0')}`,
    };
  };

  const findBookingForCell = (dayKey: string, dateStr: string, slotRange: string) => {
    return bookedSlots.find(
      (b) =>
        (b.booking_date === dateStr || b.day_of_week === dayKey) && b.slot_range === slotRange
    );
  };

  const handleBookSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCell) {
      setSubmitError('Vui lòng bấm chọn 1 khung giờ 30 phút còn trống trên bảng lịch.');
      return;
    }
    if (!studentName.trim()) {
      setSubmitError('Vui lòng nhập Họ và tên Học viên.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(buildPublicAcademicApiUrl(`${API_URL}/academic/public-1on1/${bookingCode}/book`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_name: studentName.trim(),
          student_code: studentCode.trim(),
          student_email: studentEmail.trim(),
          student_phone: studentPhone.trim(),
          booking_date: selectedCell.dateStr,
          day_of_week: selectedCell.dayKey,
          slot_range: selectedCell.slotRange,
          topic: topic.trim(),
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setBookingResult(json.data);
        fetchSchedule();
      } else {
        setSubmitError(
          json.message || 'Khung giờ này vừa có học viên khác đăng ký. Vui lòng chọn khung giờ khác.'
        );
        fetchSchedule();
      }
    } catch (err: any) {
      setSubmitError('Lỗi kết nối khi gửi đăng ký. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div style={{ textAlign: 'center', color: '#334155' }}>
          <Loader2
            size={32}
            className="animate-spin"
            color="#BD1D2D"
            style={{ margin: '0 auto 10px' }}
          />
          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>
            Đang tải Bảng lịch đăng ký Hướng dẫn 1:1...
          </div>
        </div>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            background: '#ffffff',
            padding: '28px',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            textAlign: 'center',
          }}
        >
          <AlertCircle size={40} color="#BD1D2D" style={{ margin: '0 auto 12px' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>
            Không tìm thấy Lịch đăng ký Hướng dẫn 1:1
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {error || 'Đường dẫn đăng ký không tồn tại hoặc đã đóng.'}
          </p>
        </div>
      </div>
    );
  }

  const availMap =
    config.available_slots && typeof config.available_slots === 'object'
      ? config.available_slots
      : {};

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f1f5f9',
        padding: '24px 16px 60px',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ maxWidth: '1240px', margin: '0 auto' }}>
        {/* Top Institute Branding Bar */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            border: '1px solid #e2e8f0',
            padding: '18px 24px',
            marginBottom: '18px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '14px',
            boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '12px',
                background: '#BD1D2D',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                fontSize: '1.1rem',
              }}
            >
              1:1
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#BD1D2D',
                }}
              >
                VIỆN QUỐC TẾ IDEAS • ACADEMIC AFFAIRS PORTAL
              </div>
              <h1
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 800,
                  color: '#0f172a',
                  margin: '2px 0',
                }}
              >
                {config.title || `${config.week_label} — ${config.subject_name}`}
              </h1>
              <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                Giảng viên hướng dẫn:{' '}
                <strong style={{ color: '#0f172a' }}>{config.lecturer_name}</strong> • Môn học:{' '}
                <strong style={{ color: '#0f172a' }}>{config.subject_name}</strong> • Thời lượng:{' '}
                <strong>{config.slot_duration || 30} phút / học viên</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.76rem' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                fontWeight: 700,
                color: '#047857',
              }}
            >
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '3px',
                  background: '#ffffff',
                  border: '2px solid #10b981',
                }}
              />
              Ô Trắng: Khung giờ trống (Bấm chọn)
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                fontWeight: 700,
                color: '#b91c1c',
              }}
            >
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '3px',
                  background: '#fee2e2',
                  border: '1px solid #ef4444',
                }}
              />
              Đã có HV đặt
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                borderRadius: '8px',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                fontWeight: 700,
                color: '#475569',
              }}
            >
              <span
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '3px',
                  background: '#64748b',
                }}
              />
              Ô Xám: Khung giờ bận
            </span>
          </div>
        </div>

        {/* Main 2-Column Layout: Left = Class Schedule 30m Matrix | Right = Instructions & 1-Flow Booking Form */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: '18px',
            alignItems: 'start',
          }}
        >
          {/* LEFT: Weekly 30-Minute Schedule Table (Matching Trâm's exact screenshot) */}
          <div
            style={{
              gridColumn: 'span 1',
              background: '#ffffff',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
            }}
          >
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.76rem',
                  textAlign: 'center',
                }}
              >
                <thead>
                  <tr style={{ background: '#dc2626', color: '#ffffff' }}>
                    <th
                      colSpan={10}
                      style={{
                        padding: '10px',
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {config.week_label || 'Class Schedule'}
                    </th>
                  </tr>
                  <tr style={{ background: '#ffffff', color: '#0f172a', borderBottom: '2px solid #0f172a' }}>
                    <th style={{ padding: '8px 6px', border: '1px solid #cbd5e1', width: '72px' }}>
                      Session
                    </th>
                    <th style={{ padding: '8px 4px', border: '1px solid #cbd5e1', width: '36px' }}>
                      No.
                    </th>
                    <th style={{ padding: '8px 6px', border: '1px solid #cbd5e1', width: '92px' }}>
                      VN Time
                    </th>
                    {DAY_KEYS.map((d, idx) => {
                      const info = getDayDateInfo(idx);
                      return (
                        <th
                          key={d.key}
                          style={{
                            padding: '8px 6px',
                            border: '1px solid #cbd5e1',
                            minWidth: '82px',
                          }}
                        >
                          <div style={{ fontWeight: 800 }}>
                            {d.label}, {info.shortDisplay}
                          </div>
                          <div style={{ fontSize: '0.67rem', color: '#64748b', fontWeight: 600 }}>
                            {d.vnLabel}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {/* AFTERNOON SLOTS */}
                  {AFTERNOON_SLOTS.map((slot, sIdx) => (
                    <tr key={`pub-aft-${slot}`}>
                      {sIdx === 0 && (
                        <td
                          rowSpan={AFTERNOON_SLOTS.length}
                          style={{
                            border: '1px solid #cbd5e1',
                            fontWeight: 800,
                            color: '#0f172a',
                            background: '#f8fafc',
                          }}
                        >
                          Afternoon
                        </td>
                      )}
                      <td
                        style={{
                          padding: '8px 4px',
                          border: '1px solid #cbd5e1',
                          fontWeight: 700,
                          color: '#475569',
                        }}
                      >
                        {sIdx + 1}
                      </td>
                      <td
                        style={{
                          padding: '8px 6px',
                          border: '1px solid #cbd5e1',
                          fontWeight: 700,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {slot.replace('-', ' - ')}
                      </td>
                      {DAY_KEYS.map((d, dIdx) => {
                        const info = getDayDateInfo(dIdx);
                        const dayAvail =
                          Array.isArray(availMap[d.key]) && availMap[d.key].includes(slot);
                        const booked = findBookingForCell(d.key, info.dateStr, slot);
                        const isSelected =
                          selectedCell?.dayKey === d.key && selectedCell?.slotRange === slot;

                        if (!dayAvail) {
                          return (
                            <td
                              key={`${d.key}-${slot}`}
                              style={{
                                padding: '8px 6px',
                                border: '1px solid #cbd5e1',
                                background: '#64748b',
                                color: '#cbd5e1',
                                cursor: 'not-allowed',
                              }}
                              title="Khung giờ Giảng viên bận"
                            />
                          );
                        }

                        if (booked) {
                          return (
                            <td
                              key={`${d.key}-${slot}`}
                              style={{
                                padding: '6px 4px',
                                border: '1px solid #fca5a5',
                                background: '#fef2f2',
                                color: '#991b1b',
                                fontSize: '0.69rem',
                                fontWeight: 700,
                                cursor: 'not-allowed',
                              }}
                              title={`Đã đăng ký bởi: ${booked.student_name}`}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                <Lock size={10} /> Đã đặt
                              </div>
                              <div
                                style={{
                                  fontSize: '0.65rem',
                                  color: '#b91c1c',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '78px',
                                  margin: '0 auto',
                                }}
                              >
                                {booked.student_name}
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={`${d.key}-${slot}`}
                            onClick={() => {
                              setSelectedCell({
                                dayKey: d.key,
                                dayLabel: `${d.vnLabel} (${info.shortDisplay})`,
                                dateStr: info.dateStr,
                                slotRange: slot,
                              });
                              setBookingResult(null);
                              setSubmitError('');
                            }}
                            style={{
                              padding: '8px 6px',
                              border: isSelected
                                ? '2px solid #BD1D2D'
                                : '1px solid #cbd5e1',
                              background: isSelected ? '#fef2f2' : '#ffffff',
                              color: isSelected ? '#BD1D2D' : '#047857',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.12s',
                            }}
                          >
                            {isSelected ? '✓ Đang chọn' : 'Đăng ký'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}

                  {/* RED DIVIDER ROW */}
                  <tr>
                    <td colSpan={10} style={{ height: '14px', background: '#dc2626', padding: 0 }} />
                  </tr>

                  {/* EVENING SLOTS */}
                  {EVENING_SLOTS.map((slot, sIdx) => (
                    <tr key={`pub-eve-${slot}`}>
                      {sIdx === 0 && (
                        <td
                          rowSpan={EVENING_SLOTS.length}
                          style={{
                            border: '1px solid #cbd5e1',
                            fontWeight: 800,
                            color: '#0f172a',
                            background: '#f8fafc',
                          }}
                        >
                          Evening
                        </td>
                      )}
                      <td
                        style={{
                          padding: '8px 4px',
                          border: '1px solid #cbd5e1',
                          fontWeight: 700,
                          color: '#475569',
                        }}
                      >
                        {sIdx + 1}
                      </td>
                      <td
                        style={{
                          padding: '8px 6px',
                          border: '1px solid #cbd5e1',
                          fontWeight: 700,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {slot.replace('-', ' - ')}
                      </td>
                      {DAY_KEYS.map((d, dIdx) => {
                        const info = getDayDateInfo(dIdx);
                        const dayAvail =
                          Array.isArray(availMap[d.key]) && availMap[d.key].includes(slot);
                        const booked = findBookingForCell(d.key, info.dateStr, slot);
                        const isSelected =
                          selectedCell?.dayKey === d.key && selectedCell?.slotRange === slot;

                        if (!dayAvail) {
                          return (
                            <td
                              key={`${d.key}-${slot}`}
                              style={{
                                padding: '8px 6px',
                                border: '1px solid #cbd5e1',
                                background: '#64748b',
                                color: '#cbd5e1',
                                cursor: 'not-allowed',
                              }}
                              title="Khung giờ Giảng viên bận"
                            />
                          );
                        }

                        if (booked) {
                          return (
                            <td
                              key={`${d.key}-${slot}`}
                              style={{
                                padding: '6px 4px',
                                border: '1px solid #fca5a5',
                                background: '#fef2f2',
                                color: '#991b1b',
                                fontSize: '0.69rem',
                                fontWeight: 700,
                                cursor: 'not-allowed',
                              }}
                              title={`Đã đăng ký bởi: ${booked.student_name}`}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px' }}>
                                <Lock size={10} /> Đã đặt
                              </div>
                              <div
                                style={{
                                  fontSize: '0.65rem',
                                  color: '#b91c1c',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '78px',
                                  margin: '0 auto',
                                }}
                              >
                                {booked.student_name}
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={`${d.key}-${slot}`}
                            onClick={() => {
                              setSelectedCell({
                                dayKey: d.key,
                                dayLabel: `${d.vnLabel} (${info.shortDisplay})`,
                                dateStr: info.dateStr,
                                slotRange: slot,
                              });
                              setBookingResult(null);
                              setSubmitError('');
                            }}
                            style={{
                              padding: '8px 6px',
                              border: isSelected
                                ? '2px solid #BD1D2D'
                                : '1px solid #cbd5e1',
                              background: isSelected ? '#fef2f2' : '#ffffff',
                              color: isSelected ? '#BD1D2D' : '#047857',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.12s',
                            }}
                          >
                            {isSelected ? '✓ Đang chọn' : 'Đăng ký'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* RIGHT: Registration Form + Bilingual Steps + Instant Google Calendar Confirmation */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Success Confirmation Card with Google Calendar + .ics */}
            {bookingResult ? (
              <div
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '2px solid #10b981',
                  padding: '22px',
                  boxShadow: '0 8px 24px rgba(16, 185, 129, 0.12)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: '#ecfdf5',
                      color: '#047857',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                      Đăng Ký Lịch Hướng Dẫn 1:1 Thành Công!
                    </h3>
                    <div style={{ fontSize: '0.76rem', color: '#047857', fontWeight: 600 }}>
                      Lịch đã tự động tạo trên Hệ thống & gửi thông báo đến Giảng viên
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    fontSize: '0.82rem',
                    lineHeight: 1.7,
                    marginBottom: '14px',
                  }}
                >
                  <div>
                    • <strong>Học viên:</strong> {bookingResult.student_name}
                  </div>
                  <div>
                    • <strong>Giảng viên hướng dẫn:</strong> {config.lecturer_name}
                  </div>
                  <div>
                    • <strong>Môn học:</strong> {config.subject_name}
                  </div>
                  <div>
                    • <strong>Khung giờ đã khóa:</strong>{' '}
                    <span style={{ color: '#BD1D2D', fontWeight: 800 }}>
                      {bookingResult.booking_date} | {bookingResult.slot_range} (30 phút)
                    </span>
                  </div>
                  {bookingResult.meeting_link && (
                    <div>
                      • <strong>Link lớp hướng dẫn:</strong>{' '}
                      <a
                        href={bookingResult.meeting_link}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: '#1d4ed8', fontWeight: 700 }}
                      >
                        {bookingResult.meeting_link}
                      </a>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                  {bookingResult.google_calendar_url && (
                    <a
                      href={bookingResult.google_calendar_url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        flex: 1,
                        minWidth: '210px',
                        padding: '10px 14px',
                        borderRadius: '9px',
                        background: '#BD1D2D',
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Calendar size={15} />
                      Thêm vào Google Calendar
                    </a>
                  )}
                  {bookingResult.ics_data_uri && (
                    <a
                      href={bookingResult.ics_data_uri}
                      download={`Mentoring-1on1-${bookingResult.booking_date}.ics`}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '9px',
                        background: '#0f172a',
                        color: '#ffffff',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Download size={15} />
                      Tải File Lịch (.ics)
                    </a>
                  )}
                </div>
              </div>
            ) : (
              /* Booking Form Card */
              <form
                onSubmit={handleBookSlot}
                style={{
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  padding: '20px',
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
                }}
              >
                <div
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Sparkles size={17} color="#BD1D2D" />
                  ĐĂNG KÝ KHUNG GIỜ HƯỚNG DẪN 1:1 (30 PHÚT)
                </div>

                {/* Selected Slot Pill */}
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '10px',
                    background: selectedCell ? '#fef2f2' : '#f8fafc',
                    border: `1.5px solid ${selectedCell ? '#BD1D2D' : '#cbd5e1'}`,
                    marginBottom: '12px',
                  }}
                >
                  {selectedCell ? (
                    <div>
                      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#991b1b' }}>
                        KHUNG GIỜ BẠN ĐANG CHỌN:
                      </div>
                      <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#BD1D2D' }}>
                        {selectedCell.dayLabel} • {selectedCell.slotRange} (30 phút)
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.8rem', color: '#475569', fontWeight: 600 }}>
                      Bước 1: Hãy bấm vào một ô <strong>"Đăng ký"</strong> màu trắng trên bảng
                      lịch bên trái để chọn khung giờ 30 phút.
                    </div>
                  )}
                </div>

                {submitError && (
                  <div
                    style={{
                      marginBottom: '12px',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      background: '#fef2f2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                    }}
                  >
                    {submitError}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: '#334155',
                        marginBottom: '4px',
                      }}
                    >
                      Họ và tên Học viên (Full Name) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="VD: Nguyễn Văn A"
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem',
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: '#334155',
                          marginBottom: '4px',
                        }}
                      >
                        Email nhận Lịch Google Calendar *
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="hocvien@gmail.com"
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: 'block',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          color: '#334155',
                          marginBottom: '4px',
                        }}
                      >
                        Số điện thoại / Zalo *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="09xx xxx xxx"
                        value={studentPhone}
                        onChange={(e) => setStudentPhone(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '9px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.82rem',
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: '#334155',
                        marginBottom: '4px',
                      }}
                    >
                      Mã học viên / Chương trình học (Student ID)
                    </label>
                    <input
                      type="text"
                      placeholder="VD: MBA-AI-26-0244"
                      value={studentCode}
                      onChange={(e) => setStudentCode(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem',
                      }}
                    />
                  </div>

                  <div>
                    <label
                      style={{
                        display: 'block',
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: '#334155',
                        marginBottom: '4px',
                      }}
                    >
                      Nội dung / Đề tài cần Giảng viên hướng dẫn 1:1
                    </label>
                    <textarea
                      rows={2}
                      placeholder="VD: Duyệt đề cương Capstone Project / Sửa chương 2..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '0.82rem',
                        resize: 'vertical',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !selectedCell}
                    style={{
                      marginTop: '4px',
                      width: '100%',
                      padding: '11px 16px',
                      borderRadius: '10px',
                      border: 'none',
                      background: selectedCell ? '#BD1D2D' : '#94a3b8',
                      color: '#ffffff',
                      fontSize: '0.86rem',
                      fontWeight: 800,
                      cursor: submitting || !selectedCell ? 'not-allowed' : 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: selectedCell ? '0 4px 12px rgba(189, 29, 45, 0.25)' : 'none',
                    }}
                  >
                    {submitting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Đang khóa lịch & Gửi thông báo cho Giảng viên...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        Xác Nhận Đăng Ký Khung Giờ Này
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* Bilingual Registration Steps Card (Exact Match to Screenshot 4) */}
            <div
              style={{
                background: '#ffffff',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                padding: '18px 20px',
                fontSize: '0.78rem',
                lineHeight: 1.6,
                color: '#1e293b',
              }}
            >
              <div
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  color: '#dc2626',
                  textAlign: 'center',
                  marginBottom: '8px',
                }}
              >
                Các bước đăng ký lịch Hướng dẫn 1:1
              </div>
              <div style={{ whiteSpace: 'pre-line', marginBottom: '10px' }}>
                {config.notes_vn}
              </div>
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.74rem',
                  marginBottom: '12px',
                }}
              >
                <strong>*Lưu ý:</strong> Hình thức hướng dẫn trực tuyến qua Zoom/Google Meet. Ngay
                sau khi bấm xác nhận, lịch hẹn sẽ tự động gắn vào{' '}
                <strong>Google Calendar</strong> của Học viên và Giảng viên.
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '12px 0' }} />

              <div
                style={{
                  fontSize: '0.88rem',
                  fontWeight: 800,
                  color: '#dc2626',
                  textAlign: 'center',
                  marginBottom: '8px',
                }}
              >
                Registration Steps
              </div>
              <div style={{ whiteSpace: 'pre-line' }}>{config.notes_en}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicBooking1on1Page;
