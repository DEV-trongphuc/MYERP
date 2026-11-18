import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  useTenantConfig,
  getCachedTenantBootstrap,
  renderTenantOnboardingTemplate,
} from '../../contexts/TenantConfigContext';
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

export function getTenantProgramOptions(): Array<{
  id: string;
  label: string;
  school: string;
  docLink: string;
  keywords: string[];
}> {
  const dbProgs = getCachedTenantBootstrap()?.academic_programs;
  if (Array.isArray(dbProgs) && dbProgs.length > 0) {
    return dbProgs.map((p) => ({
      id: p.program_code,
      label: p.school_name ? `${p.name} - ${p.school_name}` : p.name,
      school: p.school_name || '',
      docLink: p.doc_folder_url || '',
      keywords: Array.isArray(p.match_keywords) ? p.match_keywords : [],
    }));
  }
  return [
    {
      id: 'mba_standard',
      label: 'Chương trình Đào tạo Tiêu chuẩn',
      school: '',
      docLink: '',
      keywords: [],
    },
  ];
}

export const detectAcademicProgram = (programStr: string): string => {
  const opts = getTenantProgramOptions();
  const p = (programStr || '').trim().toLowerCase();
  if (p) {
    for (const opt of opts) {
      if (p === opt.id.toLowerCase()) return opt.id;
      if (opt.keywords.some((kw) => kw && p.includes(String(kw).toLowerCase()))) {
        return opt.id;
      }
    }
  }
  return opts[0]?.id || 'mba_standard';
};

export const getAcademicEmailDefaultSubject = (programKey = 'mba_standard'): string => {
  return renderTenantOnboardingTemplate({ programCode: programKey }).subject;
};

export const getAcademicEmailDefaultContent = (studentName: string, programKey = 'mba_standard'): string => {
  return renderTenantOnboardingTemplate({ programCode: programKey, studentName }).html;
};

export const StudentOnboardingEmailModal: React.FC<StudentOnboardingEmailModalProps> = ({
  isOpen,
  onClose,
  preselectedStudent = null,
  studentsList = [],
  addToast,
  onSuccess,
}) => {
  const { user: currentUser } = useAuth();
  const { config: tenantConfig } = useTenantConfig();

  const programOptions = useMemo(() => {
    const dbProgs = tenantConfig?.academic_programs;
    if (Array.isArray(dbProgs) && dbProgs.length > 0) {
      return dbProgs.map((p) => ({
        id: p.program_code,
        label: p.school_name ? `${p.name} - ${p.school_name}` : p.name,
        school: p.school_name || '',
        docLink: p.doc_folder_url || '',
        keywords: Array.isArray(p.match_keywords) ? p.match_keywords : [],
      }));
    }
    return getTenantProgramOptions();
  }, [tenantConfig?.academic_programs]);

  const [selectedStudentId, setSelectedStudentId] = useState<number | string>(preselectedStudent?.id || '');
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);

  const [activeTab, setActiveTab] = useState<'preview' | 'edit' | 'zalo'>('preview');
  const [academicProgram, setAcademicProgram] = useState('mba_standard');
  const [isSending, setIsSending] = useState(false);
  const [copiedZalo, setCopiedZalo] = useState(false);

  const staffName = (currentUser?.full_name || (currentUser as any)?.name || 'Chuyên viên CTSV').trim();
  const defaultCc = tenantConfig?.organization?.academic_cc_emails || '';

  const [emailForm, setEmailForm] = useState({
    recipient_name: '',
    to_email: '',
    cc_email: defaultCc,
    subject: '',
    content: '',
    zalo_text: '',
  });

  const filteredStudents = useMemo(() => {
    if (!Array.isArray(studentsList) || studentsList.length === 0) return [];
    const q = studentSearch.trim().toLowerCase();
    if (!q) return studentsList.slice(0, 10);
    return studentsList
      .filter((s) => {
        const name = (s.full_name || s.name || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const phone = (s.phone || '').toLowerCase();
        return name.includes(q) || email.includes(q) || phone.includes(q);
      })
      .slice(0, 15);
  }, [studentsList, studentSearch]);

  useEffect(() => {
    if (!isOpen) return;

    const student =
      preselectedStudent ||
      (selectedStudentId && Array.isArray(studentsList)
        ? studentsList.find((s) => String(s.id) === String(selectedStudentId))
        : null);
    const sName = (student?.full_name || student?.name || '').trim();
    const sEmail = (student?.email || '').trim();
    const rawProg = student?.program || student?.product_name || student?.course || '';
    const progKey = detectAcademicProgram(rawProg);
    const rendered = renderTenantOnboardingTemplate({
      programCode: progKey,
      studentName: sName,
      staffName,
    });

    setSelectedStudentId(student?.id || '');
    setAcademicProgram(progKey);
    setActiveTab('preview');
    setEmailForm({
      recipient_name: sName,
      to_email: sEmail,
      cc_email: rendered.ccEmails || defaultCc,
      subject: rendered.subject,
      content: rendered.html,
      zalo_text: rendered.zaloText,
    });
  }, [isOpen, preselectedStudent, studentsList, staffName, defaultCc]);

  const handleProgramChange = useCallback(
    (progKey: string) => {
      setAcademicProgram(progKey);
      const sName = emailForm.recipient_name.trim();
      const rendered = renderTenantOnboardingTemplate({
        programCode: progKey,
        studentName: sName,
        staffName,
      });
      setEmailForm((prev) => ({
        ...prev,
        cc_email: rendered.ccEmails || prev.cc_email || defaultCc,
        subject: rendered.subject,
        content: rendered.html,
        zalo_text: rendered.zaloText,
      }));
    },
    [emailForm.recipient_name, staffName, defaultCc]
  );

  const handleSelectStudent = (s: any) => {
    const sName = (s.full_name || s.name || '').trim();
    const sEmail = (s.email || '').trim();
    const progKey = detectAcademicProgram(s.program || s.product_name || '');
    const rendered = renderTenantOnboardingTemplate({
      programCode: progKey,
      studentName: sName,
      staffName,
    });
    setSelectedStudentId(s.id);
    setAcademicProgram(progKey);
    setStudentSearch(`${sName} - ${sEmail}`);
    setShowStudentDropdown(false);
    setEmailForm((prev) => ({
      ...prev,
      recipient_name: sName,
      to_email: sEmail,
      cc_email: rendered.ccEmails || prev.cc_email || defaultCc,
      subject: rendered.subject,
      content: rendered.html,
      zalo_text: rendered.zaloText,
    }));
  };

  const handleSendEmail = async () => {
    if (isSending) return;
    if (!emailForm.to_email?.trim()) {
      if (addToast) addToast('Vui lòng nhập email người nhận.', 'error');
      return;
    }
    if (!emailForm.subject?.trim()) {
      if (addToast) addToast('Vui lòng nhập tiêu đề email.', 'error');
      return;
    }
    if (!emailForm.content?.trim()) {
      if (addToast) addToast('Vui lòng nhập nội dung email.', 'error');
      return;
    }

    setIsSending(true);
    try {
      const studentId = selectedStudentId || preselectedStudent?.id;
      if (studentId) {
        await api.post(`/contacts/${studentId}/send-academic-email`, {
          to_email: emailForm.to_email.trim(),
          cc_email: emailForm.cc_email.trim(),
          subject: emailForm.subject.trim(),
          content: emailForm.content.trim(),
          program: academicProgram,
        });
      } else {
        await api.post('/marketing-campaigns/send-quick-email', {
          to_email: emailForm.to_email.trim(),
          cc_email: emailForm.cc_email.trim(),
          subject: emailForm.subject.trim(),
          content_html: emailForm.content.trim(),
        });
      }

      if (addToast) addToast('Đã gửi Thư tiếp nhận học viên thành công.', 'success');
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
    const fallbackZalo = renderTenantOnboardingTemplate({
      programCode: academicProgram,
      studentName: emailForm.recipient_name,
      staffName,
    }).zaloText;
    const textToCopy = emailForm.zalo_text || fallbackZalo;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedZalo(true);
      setTimeout(() => setCopiedZalo(false), 2500);
      if (addToast) addToast('Đã sao chép mẫu Tin nhắn Zalo Tiếp nhận.', 'success');
    });
  };

  if (!isOpen) return null;

  const orgName = tenantConfig?.organization?.name || 'MYERP';
  const orgLogo = tenantConfig?.organization?.logo_url || '/LOGO.webp';
  const orgHotline = tenantConfig?.organization?.support_hotline || '';
  const orgEmail = tenantConfig?.organization?.support_email || '';

  return createPortal(
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
        padding: '16px',
      }}
      onClick={(e) => {
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
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
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
                color: '#BD1D2D',
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
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
              gap: '8px',
            }}
          >
            <Sparkles size={16} strokeWidth={1.75} style={{ color: '#BD1D2D', flexShrink: 0 }} />
            <div>Hệ thống sẽ gửi email chính thức tới học viên và tự động ghi nhật ký tương tác với tên của bạn.</div>
          </div>

          {!preselectedStudent && Array.isArray(studentsList) && studentsList.length > 0 && (
            <div style={{ position: 'relative' }}>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Chọn Học viên từ danh sách
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Gõ tên hoặc email học viên để tìm nhanh..."
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setShowStudentDropdown(true);
                  }}
                  onFocus={() => setShowStudentDropdown(true)}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.82rem',
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
                    boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  }}
                >
                  {filteredStudents.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => handleSelectStudent(s)}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '0.8rem',
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

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              <GraduationCap size={14} color="#BD1D2D" />
              Chương trình đào tạo áp dụng mẫu tiếp nhận <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={academicProgram}
              onChange={(e) => handleProgramChange(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: '8px',
                border: '1.5px solid #BD1D2D',
                background: '#fef2f2',
                color: '#BD1D2D',
                fontSize: '0.82rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {Array.isArray(programOptions) &&
                programOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Họ và tên học viên
              </label>
              <input
                type="text"
                placeholder="VD: Nguyễn Văn A"
                value={emailForm.recipient_name}
                onChange={(e) => {
                  const val = e.target.value;
                  const rendered = renderTenantOnboardingTemplate({
                    programCode: academicProgram,
                    studentName: val,
                    staffName,
                  });
                  setEmailForm((prev) => ({
                    ...prev,
                    recipient_name: val,
                    content: rendered.html,
                    zalo_text: rendered.zaloText,
                  }));
                }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Email người nhận (To) <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="email"
                placeholder="hocvien@domain.com"
                value={emailForm.to_email}
                onChange={(e) => setEmailForm((prev) => ({ ...prev, to_email: e.target.value }))}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.82rem',
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
              placeholder={defaultCc || 'cc1@domain.com, cc2@domain.com'}
              value={emailForm.cc_email}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, cc_email: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
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
              onChange={(e) => setEmailForm((prev) => ({ ...prev, subject: e.target.value }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '0.82rem',
                fontWeight: 600,
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
              {activeTab === 'zalo' ? 'Nội dung tin nhắn Zalo tiếp nhận' : 'Nội dung email'}
            </span>

            <div
              style={{
                display: 'inline-flex',
                background: '#f1f5f9',
                padding: '3px',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                gap: '2px',
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === 'preview' ? '#ffffff' : 'transparent',
                  color: activeTab === 'preview' ? '#BD1D2D' : '#64748b',
                  fontWeight: activeTab === 'preview' ? 700 : 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: activeTab === 'preview' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <Eye size={12} />
                Xem trước HTML
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === 'edit' ? '#ffffff' : 'transparent',
                  color: activeTab === 'edit' ? '#BD1D2D' : '#64748b',
                  fontWeight: activeTab === 'edit' ? 700 : 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: activeTab === 'edit' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <Pencil size={12} />
                Chỉnh sửa HTML
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('zalo')}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '7px',
                  border: 'none',
                  background: activeTab === 'zalo' ? '#ffffff' : 'transparent',
                  color: activeTab === 'zalo' ? '#BD1D2D' : '#64748b',
                  fontWeight: activeTab === 'zalo' ? 700 : 600,
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: activeTab === 'zalo' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <MessageSquare size={12} />
                Mẫu Tin Zalo CTSV
              </button>
            </div>
          </div>

          {activeTab === 'preview' ? (
            <div
              style={{
                maxHeight: '380px',
                overflowY: 'auto',
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                borderRadius: '12px',
                padding: '16px',
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
                  boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                }}
              >
                <div
                  style={{
                    background: 'linear-gradient(135deg, #BD1D2D 0%, #8C111E 100%)',
                    padding: '20px 24px',
                    color: '#ffffff',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderBottom: '1px solid rgba(255,255,255,0.2)',
                      paddingBottom: '10px',
                      marginBottom: '10px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={orgLogo}
                        alt={orgName}
                        style={{
                          height: '32px',
                          width: 'auto',
                          maxWidth: '140px',
                          objectFit: 'contain',
                          display: 'block',
                        }}
                        onError={(e: any) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#ffffff' }}>{orgName}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', background: 'rgba(0,0,0,0.2)', padding: '3px 8px', borderRadius: '4px', color: '#ffffff' }}>
                      Academic Department
                    </span>
                  </div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#ffffff' }}>{emailForm.subject}</div>
                </div>

                <div style={{ padding: '24px', fontSize: '0.875rem', lineHeight: '1.65', color: '#334155' }}>
                  <div dangerouslySetInnerHTML={{ __html: emailForm.content }} />
                </div>

                <div
                  style={{
                    background: '#f8fafc',
                    borderTop: '1px solid #e2e8f0',
                    padding: '16px 24px',
                    fontSize: '0.75rem',
                    color: '#64748b',
                  }}
                >
                  <div style={{ fontWeight: 700, color: '#334155' }}>Ban Học vụ — {orgName}</div>
                  {(orgHotline || orgEmail) && (
                    <div>
                      {orgHotline && (
                        <>
                          Hotline / Zalo: <strong style={{ color: '#BD1D2D' }}>{orgHotline}</strong>
                        </>
                      )}
                      {orgHotline && orgEmail ? ' | ' : ''}
                      {orgEmail && <>Email: {orgEmail}</>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'edit' ? (
            <textarea
              value={emailForm.content}
              onChange={(e) => setEmailForm((prev) => ({ ...prev, content: e.target.value }))}
              style={{
                width: '100%',
                minHeight: '260px',
                fontFamily: 'Consolas, Monaco, monospace',
                fontSize: '0.8125rem',
                lineHeight: '1.5',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
              }}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '0.78rem', color: '#334155', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px' }}>
                Mẫu tin nhắn Zalo tiếp nhận học viên đã được tự động điền tên học viên &amp; CTSV. Bấm nút <strong>Copy Tin nhắn Zalo</strong> để gửi qua Zalo.
              </div>
              <textarea
                value={emailForm.zalo_text}
                onChange={(e) => setEmailForm((prev) => ({ ...prev, zalo_text: e.target.value }))}
                style={{
                  width: '100%',
                  minHeight: '200px',
                  fontSize: '0.84rem',
                  lineHeight: '1.6',
                  padding: '12px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                }}
              />
            </div>
          )}
        </div>

        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <button
            type="button"
            onClick={handleCopyZalo}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#0f172a',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {copiedZalo ? <Check size={14} color="#059669" /> : <Copy size={14} />}
            <span>{copiedZalo ? 'Đã sao chép' : 'Copy Tin nhắn Zalo Tiếp nhận'}</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                background: '#ffffff',
                color: '#64748b',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
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
                padding: '8px 16px',
                borderRadius: '8px',
                border: 'none',
                background: '#BD1D2D',
                color: '#ffffff',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: isSending ? 'not-allowed' : 'pointer',
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
    </div>,
    document.body
  );
};
