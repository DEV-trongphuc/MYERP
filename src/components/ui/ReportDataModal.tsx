import React, { useState } from 'react';
import { CustomModal } from './CustomModal';
import { AlertTriangle, Send, Loader2, Info, CheckCircle2, ShieldAlert, Sparkles, User, Phone, Mail, Layers } from 'lucide-react';
import { fetchAPI } from '../../utils/api';
import toast from 'react-hot-toast';
import { useLanguage } from '../../contexts/LanguageContext';

export interface ReportReasonOption {
  id: string;
  label: string;
  description: string;
  badge?: string;
  badgeColor?: string;
}

export const REPORT_REASONS: ReportReasonOption[] = [
  {
    id: 'invalid_phone',
    label: 'Sai số điện thoại / Số ảo',
    description: 'Số không liên lạc được, thiếu số, thuê bao không tồn tại hoặc nghe máy xác nhận không phải tên khách hàng.',
    badge: 'Sai thông tin',
    badgeColor: '#ef4444'
  },
  {
    id: 'duplicate_mine',
    label: 'Trùng của tôi (< 6 tháng)',
    description: 'Data bị trùng lặp với số điện thoại của chính bạn đã được chia/chăm sóc trong vòng 6 tháng gần nhất.',
    badge: 'Trùng lặp',
    badgeColor: '#f59e0b'
  },
  {
    id: 'duplicate_other',
    label: 'Trùng của Sale khác',
    description: 'Data bị trùng lặp với khách hàng đang được đồng nghiệp khác phụ trách chăm sóc tích cực.',
    badge: 'Trùng lặp',
    badgeColor: '#f59e0b'
  },
  {
    id: 'spam_junk',
    label: 'Spam ảo / Junk lead',
    description: 'Khách hàng vừa gọi cuộc 1 đã báo không đăng ký, cháu chắt nghịch máy, bấm nhầm hoặc đăng ký ảo.',
    badge: 'Spam / Rác',
    badgeColor: '#ec4899'
  },
  {
    id: 'unqualified',
    label: 'Khác / Data Unqualified',
    description: 'Data không đúng đối tượng tuyển sinh (chưa tốt nghiệp CĐ/ĐH, khác chuyên ngành, không có tiếng Anh...).',
    badge: 'Không đạt chuẩn',
    badgeColor: '#8b5cf6'
  }
];

interface ReportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: any;
  onSuccess?: () => void;
}

export const ReportDataModal: React.FC<ReportDataModalProps> = ({
  isOpen,
  onClose,
  contact,
  onSuccess
}) => {
  const { t } = useLanguage();
  const [selectedReasonId, setSelectedReasonId] = useState<string>(REPORT_REASONS[0].id);
  const [customNote, setCustomNote] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  if (!contact) return null;

  const fullName = contact.full_name || contact.name || 'Khách hàng';
  const phone = contact.phone || contact.mobile || contact.phone2 || '—';
  const email = contact.email || '—';
  const source = contact.source || contact.lead_source || 'Chiến dịch Marketing';
  const roundName = contact.round_name || 'Vòng chia số';
  const ownerName = contact.owner_name || contact.consultant_name || 'Bạn';

  const selectedReason = REPORT_REASONS.find(r => r.id === selectedReasonId) || REPORT_REASONS[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!selectedReasonId) {
      toast.error(t('Vui lòng chọn lý do báo cáo data lỗi'));
      return;
    }

    setSubmitting(true);
    try {
      const fullDescription = `${selectedReason.label}${customNote.trim() ? ` — Ghi chú: ${customNote.trim()}` : ''}`;
      
      const payload: any = {
        subject: 'Báo lỗi data',
        customer_name: fullName,
        customer_phone: phone !== '—' ? phone : undefined,
        customer_email: email !== '—' ? email : undefined,
        contact_id: contact.id,
        related_contacts: [contact.id],
        category: 'data_error',
        priority: 'urgent',
        description: fullDescription
      };

      const res = await fetchAPI('/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res && res.success !== false) {
        setSubmittedSuccess(true);
        toast.success(t('Đã gửi báo cáo data lỗi thành công! Đang chờ Quản lý duyệt bù vòng.'));
        setTimeout(() => {
          setSubmittedSuccess(false);
          onSuccess?.();
          onClose();
        }, 1500);
      } else {
        toast.error(res?.message || t('Không thể gửi báo cáo data lỗi. Vui lòng thử lại.'));
      }
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi kết nối khi gửi báo cáo.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={() => {
        if (!submitting) {
          setSubmittedSuccess(false);
          onClose();
        }
      }}
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
          <ShieldAlert size={20} color="#dc2626" />
          <span style={{ fontWeight: 800 }}>{t('BÁO CÁO DATA LỖI & YÊU CẦU BÙ VÒNG')}</span>
        </span>
      }
      width="100%"
      maxWidth="560px"
      zIndex={2000000050}
    >
      {submittedSuccess ? (
        <div style={{ textAlign: 'center', padding: '2rem 1rem' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(16, 185, 129, 0.15)',
            color: '#10b981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem auto'
          }}>
            <CheckCircle2 size={36} />
          </div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)', margin: '0 0 8px 0' }}>
            {t('Gửi báo cáo thành công!')}
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.5 }}>
            {t('Ticket đã được gửi tới Quản lý xét duyệt. Khi được duyệt, hệ thống sẽ tự động kích hoạt lượt bù vòng ưu tiên cho bạn.')}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
          {/* Contact summary card */}
          <div style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border-light)', paddingBottom: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('Thông tin data')}
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#dc2626',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '2px 8px',
                borderRadius: '6px'
              }}>
                {roundName}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-text)' }}>
                <User size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fullName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 650, color: '#d97706' }}>
                <Phone size={14} style={{ color: '#d97706', flexShrink: 0 }} />
                <span>{phone}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                <Layers size={13} style={{ flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                <span style={{ fontWeight: 600 }}>Sale:</span>
                <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{ownerName}</span>
              </div>
            </div>
          </div>

          {/* Reason selector */}
          <div>
            <label style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)', display: 'block', marginBottom: '8px' }}>
              {t('Chọn lý do báo lỗi')} <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {REPORT_REASONS.map((r) => {
                const isSelected = selectedReasonId === r.id;
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReasonId(r.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: isSelected ? '1.5px solid #dc2626' : '1px solid var(--color-border)',
                      background: isSelected ? 'rgba(239, 68, 68, 0.04)' : 'var(--color-surface)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <input
                      type="radio"
                      name="reportReason"
                      checked={isSelected}
                      onChange={() => setSelectedReasonId(r.id)}
                      style={{ marginTop: '3px', accentColor: '#dc2626', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelected ? '#dc2626' : 'var(--color-text)' }}>
                          {r.label}
                        </span>
                        {r.badge && (
                          <span style={{
                            fontSize: '0.625rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: `${r.badgeColor || '#dc2626'}15`,
                            color: r.badgeColor || '#dc2626',
                            lineHeight: 1.2
                          }}>
                            {r.badge}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '3px 0 0 0', lineHeight: 1.4 }}>
                        {r.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detailed Note */}
          <div>
            <label style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
              {t('Ghi chú chi tiết')} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--color-text-muted)' }}>({t('Không bắt buộc')})</span>
            </label>
            <textarea
              rows={3}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder={t('Mô tả thêm tình trạng cuộc gọi, phản hồi của khách, hoặc thông tin đối soát...')}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
                color: 'var(--color-text)',
                fontSize: '0.825rem',
                lineHeight: 1.5,
                outline: 'none',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Compensation alert notice */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            background: 'rgba(59, 130, 246, 0.08)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: '8px',
            fontSize: '0.78rem',
            color: 'var(--color-text)'
          }}>
            <Info size={16} style={{ color: '#2563eb', flexShrink: 0 }} />
            <span>
              {t('Sau khi gửi, Quản lý sẽ kiểm tra đối soát. Nếu data lỗi hợp lệ, hệ thống sẽ đưa bạn vào danh sách')} <strong>{t('Ưu tiên Bù vòng')}</strong> {t('để nhận data bù ở lượt tiếp theo.')}
            </span>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn outline"
              onClick={onClose}
              disabled={submitting}
              style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: 600 }}
            >
              {t('Hủy')}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn danger"
              style={{
                padding: '8px 20px',
                borderRadius: '8px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.25)',
                color: 'white',
                border: 'none',
                cursor: submitting ? 'not-allowed' : 'pointer'
              }}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="spin" />
                  <span>{t('Đang gửi...')}</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>{t('Gửi Báo Cáo & Bù Vòng')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </CustomModal>
  );
};
