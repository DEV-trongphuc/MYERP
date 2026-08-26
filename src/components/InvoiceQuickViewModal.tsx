import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Printer, Loader2 } from 'lucide-react';
import api from '../api/axios';
import { useAuthStore } from '../store/authStore';

const FMT = (n: number) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n);
};

const fmtDate = (d: any) => {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

interface InvoiceQuickViewModalProps {
  invoiceId: number | null;
  onClose: () => void;
}

export const InvoiceQuickViewModal: React.FC<InvoiceQuickViewModalProps> = ({
  invoiceId,
  onClose
}) => {
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchInvoiceDetails = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const r = await api.get(`/invoices/${id}`);
      if (r.data?.success) {
        setPreviewItem(r.data.data);
      }
    } catch (e) {
      console.error('Error fetching invoice details:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (invoiceId) {
      fetchInvoiceDetails(invoiceId);
    } else {
      setPreviewItem(null);
    }
  }, [invoiceId, fetchInvoiceDetails]);

  // ESC key to close modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!invoiceId) return null;

  return createPortal(
    <AnimatePresence>
      <div 
        className="overlay-backdrop" 
        style={{ 
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 2000000020,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={onClose}
      >
        <style>{`
          @media print {
            body {
              background: var(--color-surface) !important;
              color: black !important;
            }
            #root {
              display: none !important;
            }
            .overlay-backdrop {
              position: static !important;
              background: transparent !important;
              display: block !important;
              padding: 0 !important;
              height: auto !important;
              width: auto !important;
              opacity: 1 !important;
              overflow: visible !important;
            }
            .invoice-print-container {
              width: 100% !important;
              max-width: 100% !important;
              margin: 0 !important;
              padding: 0 !important;
              box-shadow: none !important;
              border: none !important;
              border-radius: 0 !important;
              background: var(--color-surface) !important;
              position: static !important;
              transform: none !important;
              overflow: visible !important;
            }
            .invoice-paper-content {
              padding: 0 !important;
              background: var(--color-surface) !important;
            }
            .invoice-info-box {
              border: none !important;
              background: transparent !important;
              padding: 0 !important;
              border-radius: 0 !important;
            }
            .no-print {
              display: none !important;
            }
            .print-no-avatar {
              display: none !important;
            }
            table, thead, tbody, tfoot, tr, th, td {
              border: none !important;
              border-top: none !important;
              border-bottom: none !important;
            }
          }
        `}</style>
        
        {loading ? (
          <div style={{ background: 'var(--color-surface)', padding: '2rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-text)' }}>
            <Loader2 className="spin text-primary" size={20} />
            <span>Đang tải thông tin hóa đơn...</span>
          </div>
        ) : previewItem ? (
          <motion.div
            className="modal-sheet invoice-print-container"
            style={{ 
              width: '90%', 
              maxWidth: 700, 
              zIndex: 2000000030, 
              padding: 0, 
              borderRadius: 'var(--radius-2xl)', 
              margin: 'auto', 
              overflow: 'hidden',
              background: 'var(--color-surface)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
            }}
            initial={{ opacity: 0, scale: 0.96, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="invoice-paper-content" style={{ padding: '2rem', background: 'var(--color-surface)', color: 'var(--color-text)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary)' }}>INVOICE</h2>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Mã số: {previewItem.invoice_number}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ fontWeight: 700 }}>{useAuthStore.getState().user?.tenant_name || 'CRM System'}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Hà Nội, Việt Nam</p>
                </div>
              </div>

              <div className="responsive-grid-1-1 invoice-info-box" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem', padding: '1.5rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--color-border-light)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Khách hàng nhận</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
                    <div 
                      className="print-no-avatar"
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--color-primary), #ef4444)',
                        color: 'white',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1rem',
                        boxShadow: '0 4px 10px rgba(189, 29, 45, 0.15)',
                        flexShrink: 0
                      }}
                    >
                      {previewItem.contact_name ? previewItem.contact_name.trim().split(' ').pop().charAt(0).toUpperCase() : 'K'}
                    </div>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: '0.95rem', margin: 0, color: 'var(--color-text)' }}>{previewItem.contact_name || 'Khách lẻ'}</p>
                      {previewItem.contact_phone && (
                        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '3px 0 0 0', fontWeight: 600 }}>
                          SĐT: {previewItem.contact_phone}
                        </p>
                      )}
                      {previewItem.company_name && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0', fontWeight: 500 }}>
                          {previewItem.company_name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>Thông tin thanh toán</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>Ngày lập: <strong style={{ color: 'var(--color-text)' }}>{fmtDate(previewItem.issue_date || previewItem.created_at)}</strong></p>
                    <p style={{ margin: 0, fontSize: '0.875rem' }}>Hạn thanh toán: <strong style={{ color: 'var(--color-text)' }}>{fmtDate(previewItem.due_date)}</strong></p>
                    <div style={{ marginTop: '6px' }}>
                      {previewItem.status === 'paid' ? (
                        <span className="badge success" style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800 }}>Đã thanh toán</span>
                      ) : previewItem.status === 'overdue' ? (
                        <span className="badge danger" style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800 }}>Quá hạn</span>
                      ) : (
                        <span className="badge warning" style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800 }}>Chờ thanh toán</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '2rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    <th style={{ textAlign: 'left', padding: '12px 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>MÔ TẢ DỊCH VỤ</th>
                    <th style={{ textAlign: 'right', padding: '12px 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>SỐ TIỀN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '16px 0' }}>
                      <p style={{ fontWeight: 600, margin: 0 }}>{previewItem.title}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '4px 0 0 0' }}>Dịch vụ cung cấp trọn gói theo hợp đồng</p>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{FMT(previewItem.total)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--color-border)' }}>
                     <td style={{ padding: '8px 0', fontSize: '0.875rem' }}>Phí vận chuyển ({previewItem.shipping_customer_pay ? 'Khách trả' : 'Shop trả'})</td>
                     <td style={{ textAlign: 'right', fontWeight: 600 }}>{FMT(previewItem.shipping_fee || 0)}</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '16px 0', fontWeight: 700, fontSize: '1.1rem' }}>TỔNG CỘNG</td>
                    <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '1.25rem', color: 'var(--color-primary)' }}>{FMT(previewItem.total)}</td>
                  </tr>
                </tfoot>
              </table>

              {previewItem.notes && (
                <div className="no-print" style={{ padding: '1rem', background: 'var(--color-bg)', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', border: '1px solid var(--color-border-light)', fontSize: '0.8125rem', color: 'var(--color-text-muted)', lineHeight: '1.4' }}>
                  <strong>Ghi chú / Thông tin bổ sung:</strong>
                  <p style={{ margin: '4px 0 0 0' }}>{previewItem.notes}</p>
                </div>
              )}

              <div className="no-print" style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
                <button className="btn ghost" onClick={onClose}>Đóng</button>
                <button className="btn primary" onClick={() => window.print()}><Printer size={16} /> In Hóa Đơn</button>
              </div>
            </div>
          </motion.div>
        ) : (
          <div style={{ background: 'var(--color-surface)', padding: '2rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--color-text)' }}>
            <span>Không tìm thấy thông tin hóa đơn.</span>
            <button className="btn ghost" onClick={onClose}><X size={16} /></button>
          </div>
        )}
      </div>
    </AnimatePresence>,
    document.body
  );
};
