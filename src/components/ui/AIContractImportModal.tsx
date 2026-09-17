import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  User,
  GraduationCap,
  FileCheck,
  RefreshCw,
  Clock
} from 'lucide-react';
import { parseContractFile, type ExtractedContractData } from '../../utils/aiContractParser';
import api from '../../api/axios';

interface AIContractImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: ExtractedContractData, uploadedFileUrl?: string, originalFile?: File) => void;
  contacts?: any[];
  projects?: any[];
  currentContact?: any;
  zIndex?: number;
}

export const AIContractImportModal: React.FC<AIContractImportModalProps> = ({
  isOpen,
  onClose,
  onApply,
  contacts = [],
  projects = [],
  currentContact,
  zIndex = 2147483645
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState<number>(0);
  const [extractedData, setExtractedData] = useState<ExtractedContractData | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetState = () => {
    setSelectedFile(null);
    setIsProcessing(false);
    setProcessStep(0);
    setExtractedData(null);
    setUploadedUrl('');
    setErrorMsg('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    const isDocx = file.name.endsWith('.docx') || file.name.endsWith('.doc');
    const isPdf = file.name.endsWith('.pdf');
    if (!isDocx && !isPdf) {
      setErrorMsg('Vui lòng chọn tệp hợp đồng định dạng Word (.docx) hoặc PDF (.pdf).');
      return;
    }

    setSelectedFile(file);
    setErrorMsg('');
    setIsProcessing(true);
    setProcessStep(1);

    try {
      // Step 1: Upload file to server in parallel for UNC attachment
      let serverUrl = '';
      const uploadPromise = (async () => {
        try {
          const fd = new FormData();
          fd.append('file', file);
          const res = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          if (res.data?.data?.url) {
            serverUrl = res.data.data.url;
            setUploadedUrl(serverUrl);
          }
        } catch (uErr) {
          console.warn('Background upload failed, continuing with AI extraction', uErr);
        }
      })();

      // Step 2: Read and parse document structure (DOCX or PDF AI)
      await new Promise(r => setTimeout(r, 600));
      setProcessStep(2);

      await uploadPromise;
      const parsed = await parseContractFile(file, serverUrl);

      // If drawer is already open for a specific student, preserve current student info
      if (currentContact) {
        if (!parsed.studentName || parsed.studentName.length < 3) {
          parsed.studentName = currentContact.name || currentContact.full_name;
        }
        if (!parsed.studentPhone) parsed.studentPhone = currentContact.phone;
        if (!parsed.studentEmail) parsed.studentEmail = currentContact.email;
      }

      // Step 3: Match with CRM
      await new Promise(r => setTimeout(r, 600));
      setProcessStep(3);

      // Step 4: Finalize milestones
      await new Promise(r => setTimeout(r, 500));
      setProcessStep(4);

      setExtractedData(parsed);
      setIsProcessing(false);
    } catch (err: any) {
      console.error('AI Contract Parsing Error:', err);
      setErrorMsg(err.message || 'Không thể trích xuất dữ liệu từ tệp này. Vui lòng thử lại.');
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // Matched CRM contact preview
  const matchedContact = React.useMemo(() => {
    if (currentContact) return currentContact;
    if (!extractedData) return null;
    const phone = extractedData.studentPhone?.replace(/\D/g, '');
    const email = extractedData.studentEmail?.toLowerCase();
    const name = extractedData.studentName?.toLowerCase();

    return contacts.find((c: any) => {
      const cPhone = (c.phone || '').replace(/\D/g, '');
      const cEmail = (c.email || '').toLowerCase();
      const cName = (c.name || c.full_name || '').toLowerCase();

      if (phone && cPhone && (phone.includes(cPhone) || cPhone.includes(phone))) return true;
      if (email && cEmail && email === cEmail) return true;
      if (name && cName && (name.includes(cName) || cName.includes(name))) return true;
      return false;
    });
  }, [extractedData, contacts, currentContact]);

  if (!isOpen) return null;

  const displayStudentName = matchedContact?.name || matchedContact?.full_name || extractedData?.studentName || 'Học viên';

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          padding: '16px'
        }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            background: 'var(--color-surface, #ffffff)',
            borderRadius: '20px',
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 50px -10px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--color-border-light)'
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header - Ideas Deep Brand Red */}
          <div
            style={{
              padding: '1.15rem 1.5rem',
              background: 'linear-gradient(135deg, #BD1D2D 0%, #94101e 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Sparkles size={20} color="#ffffff" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  AI Import Hợp Đồng & Lịch Trình
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', background: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
                    Auto-Fill SO
                  </span>
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.9)' }}>
                  Tự động đọc thông tin học viên và các đợt thanh toán từ file Word (.docx) hoặc PDF và điền vào Đơn bán hàng
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              style={{
                background: 'rgba(255, 255, 255, 0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title="Đóng"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal Content */}
          <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {errorMsg && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  color: '#dc2626',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* View 1: Upload Dropzone */}
            {!isProcessing && !extractedData && (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed rgba(189, 29, 45, 0.35)',
                  background: 'rgba(189, 29, 45, 0.02)',
                  borderRadius: '16px',
                  padding: '2.5rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  textAlign: 'center',
                  gap: '12px',
                  transition: 'all 0.2s ease'
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".docx,.doc,.pdf"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />

                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: 'rgba(189, 29, 45, 0.08)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#BD1D2D',
                    marginBottom: '2px'
                  }}
                >
                  <Upload size={28} />
                </div>

                <div>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    Kéo thả hoặc nhấn để chọn file Hợp đồng Word hoặc PDF
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    Hỗ trợ tệp <strong>.DOCX, .DOC, .PDF</strong> (Hợp đồng đào tạo IDEAS-DBA ESTIAM, MBA, v.v.)
                  </p>
                </div>

                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '5px 12px',
                    borderRadius: '20px',
                    background: 'rgba(189, 29, 45, 0.08)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: '#BD1D2D'
                  }}
                >
                  <Sparkles size={12} />
                  <span>Trích xuất tự động thông tin học viên & các đợt thanh toán vào SO</span>
                </div>
              </div>
            )}

            {/* View 2: High-Tech Document Scanning Animation */}
            {isProcessing && (
              <div
                style={{
                  padding: '2rem 1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '1.25rem',
                  background: 'var(--color-bg-secondary)',
                  borderRadius: '16px',
                  border: '1px solid var(--color-border-light)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Visual Contract Document with Laser Scanning Bar */}
                <div
                  style={{
                    width: '90px',
                    height: '115px',
                    background: 'var(--color-surface)',
                    borderRadius: '10px',
                    border: '1.5px solid rgba(189, 29, 45, 0.35)',
                    boxShadow: '0 8px 20px rgba(189, 29, 45, 0.15)',
                    position: 'relative',
                    overflow: 'hidden',
                    padding: '10px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  {/* Mock text lines inside document */}
                  <div style={{ width: '45%', height: '5px', background: 'rgba(189, 29, 45, 0.4)', borderRadius: '3px' }} />
                  <div style={{ width: '85%', height: '4px', background: 'var(--color-border)', borderRadius: '2px' }} />
                  <div style={{ width: '70%', height: '4px', background: 'var(--color-border)', borderRadius: '2px' }} />
                  <div style={{ width: '90%', height: '4px', background: 'var(--color-border)', borderRadius: '2px' }} />
                  <div style={{ width: '60%', height: '4px', background: 'var(--color-border)', borderRadius: '2px' }} />
                  <div style={{ width: '80%', height: '4px', background: 'var(--color-border)', borderRadius: '2px' }} />
                  <div style={{ width: '50%', height: '4px', background: 'var(--color-border)', borderRadius: '2px', marginTop: 'auto' }} />

                  {/* Red Laser Scanning Beam */}
                  <motion.div
                    animate={{ y: [-15, 120] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      height: '2.5px',
                      background: 'linear-gradient(90deg, transparent 0%, #BD1D2D 50%, transparent 100%)',
                      boxShadow: '0 0 10px #BD1D2D, 0 0 4px #BD1D2D',
                      zIndex: 10
                    }}
                  />
                </div>

                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)' }}>
                    AI đang phân tích hợp đồng...
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {selectedFile?.name} ({(Number(selectedFile?.size || 0) / 1024).toFixed(1)} KB)
                  </p>
                </div>

                {/* Clean Stepper Progress */}
                <div style={{ width: '100%', maxWidth: '380px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {[
                    { step: 1, label: 'Đọc cấu trúc văn bản hợp đồng & bảng biểu' },
                    { step: 2, label: 'Trích xuất thông tin học viên & đối soát CRM' },
                    { step: 3, label: 'Bóc tách các đợt thanh toán & chuẩn hóa ngày' },
                    { step: 4, label: 'Tải lên & gắn hợp đồng vào mục Minh chứng UNC' }
                  ].map(s => {
                    const isDone = processStep > s.step;
                    const isCurrent = processStep === s.step;
                    return (
                      <div
                        key={s.step}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '5px 10px',
                          borderRadius: '6px',
                          background: isCurrent ? 'rgba(189, 29, 45, 0.08)' : 'transparent',
                          color: isDone ? '#10b981' : isCurrent ? '#BD1D2D' : 'var(--color-text-muted)',
                          fontSize: '0.75rem',
                          fontWeight: isCurrent ? 700 : 500
                        }}
                      >
                        {isDone ? (
                          <CheckCircle2 size={15} color="#10b981" />
                        ) : isCurrent ? (
                          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ffffff' }} />
                          </div>
                        ) : (
                          <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700 }}>
                            {s.step}
                          </div>
                        )}
                        <span>{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* View 3: Simplified, Milestones-Focused Result View */}
            {!isProcessing && extractedData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Concise Summary Bar */}
                <div
                  style={{
                    background: 'rgba(189, 29, 45, 0.04)',
                    border: '1px solid rgba(189, 29, 45, 0.2)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>
                        {displayStudentName}
                      </strong>
                      <span className="badge sm success" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                        {extractedData.programName}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                      Tổng: <strong style={{ color: '#BD1D2D', fontSize: '0.85rem' }}>{Number(extractedData.totalAmount || 0).toLocaleString('vi-VN')} đ</strong> • {extractedData.milestones.length} đợt thanh toán
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setExtractedData(null);
                      setSelectedFile(null);
                    }}
                    style={{
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <RefreshCw size={11} /> Chọn file khác
                  </button>
                </div>

                {/* Milestones Clean List / Table */}
                <div style={{ border: '1px solid var(--color-border-light)', borderRadius: '12px', overflow: 'hidden', background: 'var(--color-surface)' }}>
                  <div
                    style={{
                      padding: '8px 14px',
                      background: 'var(--color-bg-secondary)',
                      borderBottom: '1px solid var(--color-border-light)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      textTransform: 'uppercase',
                      color: 'var(--color-text-muted)',
                      letterSpacing: '0.04em'
                    }}
                  >
                    <span>Lịch trình các đợt thanh toán ({extractedData.milestones.length} đợt)</span>
                    <span style={{ color: '#BD1D2D' }}>Chuẩn ngày dd.mm.yyyy</span>
                  </div>

                  <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                    {extractedData.milestones.map((m, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 14px',
                          borderBottom: idx < extractedData.milestones.length - 1 ? '1px solid var(--color-border-light)' : 'none',
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.01)',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '24px',
                              height: '24px',
                              borderRadius: '6px',
                              background: 'rgba(189, 29, 45, 0.08)',
                              color: '#BD1D2D',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 800
                            }}
                          >
                            {idx + 1}
                          </span>
                          <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{m.name}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Calendar size={12} /> {m.expected_pay_date}
                          </span>
                          <strong style={{ color: 'var(--color-text)', minWidth: '105px', textAlign: 'right' }}>
                            {Number(m.amount).toLocaleString('vi-VN')} đ
                          </strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div
            style={{
              padding: '10px 1.5rem',
              borderTop: '1px solid var(--color-border-light)',
              background: 'var(--color-surface)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px'
            }}
          >
            <button
              type="button"
              className="btn secondary sm"
              onClick={handleClose}
              style={{ padding: '8px 16px', borderRadius: '8px' }}
            >
              Hủy
            </button>

            {extractedData && (
              <button
                type="button"
                className="btn primary sm"
                onClick={() => {
                  onApply(extractedData, uploadedUrl, selectedFile || undefined);
                  handleClose();
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #BD1D2D 0%, #94101e 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(189, 29, 45, 0.3)'
                }}
              >
                <Sparkles size={15} />
                <span>Áp dụng vào Đơn bán hàng (SO)</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
