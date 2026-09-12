import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, Sparkles, FileText, Image as ImageIcon, AlertCircle, 
  Check, ArrowLeft, RefreshCw, ShieldCheck, CreditCard, Award,
  Loader2, UploadCloud, Plus
} from 'lucide-react';
import api from '../../api/axios';

interface ExtractIdDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  docs: any[];
  contactId: number | string;
  onApplyData: (data: {
    full_name?: string;
    citizen_id?: string;
    passport?: string;
    birthday?: string;
    gender?: string;
    address?: string;
    nationality?: string;
    issue_date?: string;
    expiry_date?: string;
    issue_place?: string;
  }) => void;
  effectiveZIndex?: number;
}

const resolveAttachmentUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url;
  
  let cleanPath = url.replace(/^\/+/, '');
  if (cleanPath.includes('storage/uploads/')) {
    cleanPath = cleanPath.replace('storage/uploads/', 'uploads/');
  }
  if (cleanPath.startsWith('backend/')) {
    cleanPath = cleanPath.substring('backend/'.length);
  }
  if (cleanPath.startsWith('deposits/')) {
    cleanPath = 'uploads/' + cleanPath;
  }
  
  const apiBase = import.meta.env.VITE_API_URL || 'https://myerp.ideas.edu.vn/backend/api.php';
  let baseUrl = apiBase.split('api.php')[0].replace(/\/+$/, '');
  if (!baseUrl.startsWith('http')) {
    baseUrl = 'https://myerp.ideas.edu.vn/backend';
  }
  return `${baseUrl}/${cleanPath}`;
};

const formatDateToVi = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '';
  const clean = dateStr.trim();
  const m = clean.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (m) {
    const day = m[3].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    return `${day}/${month}/${m[1]}`;
  }
  return clean;
};

const DocThumbnail: React.FC<{ doc: any; isSuggested?: boolean }> = ({ doc, isSuggested }) => {
  const [imgError, setImgError] = useState(false);
  const rawPath = doc.url || doc.file_path || '';
  const isImg = (/\.(jpe?g|png|webp)($|\?)/i.test(rawPath) || /\.(jpe?g|png|webp)$/i.test(doc.name || '')) && !imgError;
  const fullUrl = resolveAttachmentUrl(rawPath);

  if (isImg && fullUrl) {
    return (
      <div style={{
        width: '42px',
        height: '42px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.1)',
        background: '#0f172a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
      }}>
        <img 
          src={fullUrl} 
          alt={doc.name} 
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
      </div>
    );
  }

  return (
    <div style={{
      width: '42px',
      height: '42px',
      borderRadius: '8px',
      background: isSuggested ? 'rgba(56, 189, 248, 0.12)' : 'rgba(239, 68, 68, 0.1)',
      color: isSuggested ? '#0284c7' : '#ef4444',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }}>
      {isImg ? <ImageIcon size={20} /> : <FileText size={20} />}
    </div>
  );
};

export const ExtractIdDocumentModal: React.FC<ExtractIdDocumentModalProps> = ({
  isOpen,
  onClose,
  docs,
  contactId,
  onApplyData,
  effectiveZIndex = 2147483600
}) => {
  const [step, setStep] = useState<'select' | 'scanning' | 'review' | 'error'>('select');
  const [selectedDoc, setSelectedDoc] = useState<any>(null);
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [internalDocs, setInternalDocs] = useState<any[]>(docs || []);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(true);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [extractedData, setExtractedData] = useState<any>({
    document_type: '',
    full_name: '',
    citizen_id: '',
    passport: '',
    birthday: '',
    gender: '',
    nationality: '',
    place_of_birth: '',
    place_of_origin: '',
    address: '',
    issue_date: '',
    expiry_date: '',
    issue_place: ''
  });

  // Dynamic status text during scanning
  const scanStages = [
    'Đang kết nối và tải tệp tài liệu...',
    'AI Gemini Vision đang quét nhận diện tài liệu...',
    'Đang bóc tách Họ tên, Số CCCD, Số Hộ chiếu...',
    'Trích xuất Ngày sinh, Giới tính, Quê quán & Địa chỉ...',
    'Đang chuẩn hóa và hoàn thiện dữ liệu...'
  ];

  useEffect(() => {
    if (step === 'scanning') {
      const interval = setInterval(() => {
        setLoadingTextIndex(prev => (prev + 1) % scanStages.length);
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [step]);

  // Fetch all documents for this contact when modal opens
  const fetchCustomerDocs = async () => {
    if (!contactId) {
      setIsLoadingDocs(false);
      return;
    }
    setIsLoadingDocs(true);
    try {
      const res = await api.get(`/cloud-files?contact_id=${contactId}&limit=1000`);
      const raw = res.data?.data?.items || [];
      const mapped = raw.map((d: any) => ({
        id: d.id,
        name: d.name,
        date: new Date(d.created_at).toLocaleDateString('vi-VN'),
        size: (() => {
          const bytes = Number(d.file_size || 0);
          if (!bytes) return '0 B';
          const k = 1024;
          const sizes = ['B', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        })(),
        type: d.name.split('.').pop() || 'file',
        url: d.file_path,
        file_path: d.file_path,
        category: d.category
      }));
      setInternalDocs(mapped);
    } catch (e) {
      console.error("Error fetching customer docs in modal:", e);
      if (docs && docs.length > 0) {
        setInternalDocs(docs);
      }
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // Reset state and fetch docs when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setSelectedDoc(null);
      setErrorMessage('');
      setLoadingTextIndex(0);
      fetchCustomerDocs();
    }
  }, [isOpen, contactId]);

  // Upload new file directly from computer
  const handleUploadNewFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !contactId) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext || '')) {
      alert('Vui lòng chọn tệp hình ảnh (JPG, PNG, WEBP) hoặc file PDF.');
      return;
    }

    setIsUploading(true);
    try {
      const fData = new FormData();
      fData.append('file', file);
      fData.append('name', file.name);
      fData.append('category', 'Hồ sơ & Định danh');
      fData.append('visibility', 'shared');
      fData.append('contact_id', contactId.toString());

      const res = await api.post('/cloud-files', fData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.success || res.status === 200 || res.status === 201) {
        const newFile = res.data.data;
        const mappedNew = {
          id: newFile.id,
          name: newFile.name || file.name,
          date: new Date().toLocaleDateString('vi-VN'),
          size: file.size ? `${(file.size / 1024).toFixed(1)} KB` : '—',
          type: ext,
          url: newFile.file_path || newFile.path,
          file_path: newFile.file_path || newFile.path,
          category: 'Hồ sơ & Định danh'
        };
        setInternalDocs(prev => [mappedNew, ...prev]);
        setSelectedDoc(mappedNew);
      }
    } catch (err) {
      console.error("Error uploading file in extract modal:", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  // Filter valid files (images and pdfs) from internalDocs
  const validDocs = internalDocs.filter(doc => {
    if (doc.isLink) return false;
    const name = (doc.name || '').toLowerCase();
    const url = (doc.url || doc.file_path || '').toLowerCase();
    return /\.(jpe?g|png|webp|pdf)$/i.test(name) || /\.(jpe?g|png|webp|pdf)$/i.test(url);
  });

  // Separate suggested ID/Passport files from others
  const isIdRelated = (name: string) => {
    const lower = name.toLowerCase();
    return lower.includes('passport') || 
           lower.includes('cccd') || 
           lower.includes('cmnd') || 
           lower.includes('can cuoc') || 
           lower.includes('ho chieu') || 
           lower.includes('hộ chiếu') ||
           lower.includes('căn cước') ||
           lower.includes('dinh danh');
  };

  const suggestedDocs = validDocs.filter(d => isIdRelated(d.name || ''));
  const otherDocs = validDocs.filter(d => !isIdRelated(d.name || ''));

  // Handle start AI scan
  const handleStartScan = async (docToScan = selectedDoc) => {
    if (!docToScan) return;
    setSelectedDoc(docToScan);
    setStep('scanning');
    setErrorMessage('');

    try {
      const res = await api.post('/cloud-files/extract-id-document', {
        file_id: docToScan.id,
        file_url: docToScan.url || docToScan.file_path
      });

      if (res.data?.success && res.data?.data?.is_valid) {
        const d = res.data.data.data;
        const bday = formatDateToVi(d.birthday || '');
        const addr = (d.address || '').trim() || (d.place_of_birth || '').trim() || (d.place_of_origin || '').trim();
        setExtractedData({
          document_type: res.data.data.document_type || 'passport',
          full_name: d.full_name || '',
          citizen_id: d.citizen_id || '',
          passport: d.passport || '',
          birthday: bday,
          gender: d.gender === 'male' ? 'male' : (d.gender === 'female' ? 'female' : (d.gender || '')),
          nationality: d.nationality || 'Việt Nam',
          place_of_birth: d.place_of_birth || '',
          place_of_origin: d.place_of_origin || '',
          address: addr,
          issue_date: formatDateToVi(d.issue_date || ''),
          expiry_date: formatDateToVi(d.expiry_date || ''),
          issue_place: d.issue_place || ''
        });
        setStep('review');
      } else {
        setErrorMessage(res.data?.message || 'Tài liệu không phải là CCCD hoặc Hộ chiếu (Passport) hợp lệ.');
        setStep('error');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || 
                    err.response?.data?.data?.invalid_reason || 
                    'Không thể trích xuất tài liệu. Vui lòng thử lại với ảnh hoặc PDF rõ nét hơn.';
      setErrorMessage(msg);
      setStep('error');
    }
  };

  // Apply to profile
  const handleApply = () => {
    onApplyData({
      full_name: extractedData.full_name?.trim(),
      citizen_id: extractedData.citizen_id?.trim(),
      passport: extractedData.passport?.trim(),
      birthday: extractedData.birthday?.trim(),
      gender: extractedData.gender,
      address: extractedData.address?.trim(),
      nationality: extractedData.nationality?.trim(),
      issue_date: extractedData.issue_date?.trim(),
      expiry_date: extractedData.expiry_date?.trim(),
      issue_place: extractedData.issue_place?.trim()
    });
    onClose();
  };

  const rawSelectedUrl = selectedDoc?.url || selectedDoc?.file_path || '';
  const selectedFileUrl = resolveAttachmentUrl(rawSelectedUrl);
  const isSelectedImage = /\.(jpe?g|png|webp)($|\?)/i.test(rawSelectedUrl) || /\.(jpe?g|png|webp)$/i.test(selectedDoc?.name || '');

  return createPortal(
    <div 
      className="overlay-backdrop animate-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: effectiveZIndex + 60,
        background: 'rgba(0, 0, 0, 0.78)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{
          background: 'var(--color-surface, #ffffff)',
          color: 'var(--color-text, #1e293b)',
          borderRadius: '20px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
          border: '1px solid var(--color-border, #e2e8f0)',
          width: '95vw',
          maxWidth: '960px',
          maxHeight: '90vh',
          minHeight: step === 'select' ? '540px' : undefined,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--color-border-light, #f1f5f9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.05) 0%, rgba(168, 85, 247, 0.05) 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
              flexShrink: 0
            }}>
              <Sparkles size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                Trích xuất Passport / CCCD bằng AI
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: 'var(--color-text-muted, #64748b)' }}>
                {step === 'select' && 'Chọn tệp ảnh hoặc PDF từ tab Hồ sơ & Tài liệu của khách hàng (hoặc tải trực tiếp từ máy)'}
                {step === 'scanning' && 'Đang quét và phân tích dữ liệu định danh bằng Vision AI...'}
                {step === 'review' && 'Kiểm tra & chỉnh sửa thông tin trích xuất trước khi điền vào hồ sơ'}
                {step === 'error' && 'Kết quả kiểm tra tài liệu định danh'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            className="hover-lift"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '22px 26px', overflowY: 'auto', flex: 1 }}>

          {/* STEP 1: SELECT FILE */}
          {step === 'select' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              
              {/* Action Banner & Direct Upload Button */}
              <div style={{
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                borderRadius: '14px',
                padding: '12px 18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.84rem', color: '#4f46e5', flex: 1, minWidth: '260px' }}>
                  <ShieldCheck size={20} style={{ flexShrink: 0 }} />
                  <span>
                    Chỉ chấp nhận <strong>CCCD/CMND hoặc Hộ chiếu (Passport)</strong> dạng ảnh hoặc PDF. AI sẽ tự động từ chối nếu không đúng định danh.
                  </span>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '0.84rem',
                      fontWeight: 700,
                      cursor: isUploading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                      transition: 'all 0.2s ease'
                    }}
                    className="hover-lift"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Đang tải lên...
                      </>
                    ) : (
                      <>
                        <UploadCloud size={16} />
                        Tải tệp từ máy tính
                      </>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    style={{ display: 'none' }}
                    onChange={handleUploadNewFile}
                  />
                </div>
              </div>

              {/* SKELETON LOADING KHI ĐANG TẢI DANH SÁCH TỆP */}
              {isLoadingDocs ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '6px' }}>
                  <style>{`
                    @keyframes shimmerWave {
                      0% { background-position: -200% 0; }
                      100% { background-position: 200% 0; }
                    }
                    .shimmer-wave-effect {
                      background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 35%, #cbd5e1 50%, #e2e8f0 65%, #f1f5f9 100%) !important;
                      background-size: 250% 100% !important;
                      animation: shimmerWave 1.4s ease-in-out infinite !important;
                    }
                  `}</style>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#6366f1', fontSize: '0.85rem', fontWeight: 600 }}>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Đang tải danh sách tài liệu từ hồ sơ khách hàng...</span>
                  </div>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '12px'
                  }}>
                    {[1, 2, 3, 4, 5, 6].map(i => (
                      <div
                        key={i}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '12px',
                          border: '1px solid var(--color-border-light, #e2e8f0)',
                          background: 'var(--color-surface, #ffffff)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)'
                        }}
                      >
                        <div
                          className="shimmer-wave-effect"
                          style={{
                            width: '42px',
                            height: '42px',
                            borderRadius: '8px',
                            flexShrink: 0
                          }}
                        />
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div
                            className="shimmer-wave-effect"
                            style={{
                              height: '14px',
                              width: `${60 + (i % 3) * 15}%`,
                              borderRadius: '6px'
                            }}
                          />
                          <div
                            className="shimmer-wave-effect"
                            style={{
                              height: '10px',
                              width: '42%',
                              borderRadius: '6px'
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : validDocs.length === 0 ? (
                <div style={{
                  padding: '48px 20px',
                  textAlign: 'center',
                  background: 'var(--color-bg, #f8fafc)',
                  borderRadius: '16px',
                  border: '1px dashed var(--color-border, #cbd5e1)',
                  margin: '10px 0'
                }}>
                  <div style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 14px'
                  }}>
                    <AlertCircle size={32} />
                  </div>
                  <h4 style={{ margin: '0 0 8px', fontSize: '1.05rem', fontWeight: 700 }}>
                    Chưa có tệp ảnh hoặc PDF trong hồ sơ
                  </h4>
                  <p style={{ margin: '0 auto 20px', fontSize: '0.88rem', color: 'var(--color-text-muted)', maxWidth: '460px' }}>
                    Khách hàng này chưa có tệp ảnh (JPG, PNG) hoặc file PDF nào. Bạn có thể bấm nút dưới đây để tải trực tiếp từ máy tính lên.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                      color: '#ffffff',
                      border: 'none',
                      padding: '10px 22px',
                      borderRadius: '10px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)'
                    }}
                    className="hover-lift"
                  >
                    <UploadCloud size={18} />
                    Tải tệp CCCD / Hộ chiếu lên ngay
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                  {/* Danh sách file đề xuất CCCD / Passport */}
                  {suggestedDocs.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: '#6366f1',
                        marginBottom: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <CreditCard size={14} />
                        Đề xuất CCCD / Passport ({suggestedDocs.length})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                        {suggestedDocs.map(doc => {
                          const isSelected = selectedDoc?.id === doc.id;
                          return (
                            <div
                              key={doc.id}
                              onClick={() => setSelectedDoc(doc)}
                              style={{
                                border: isSelected ? '2px solid #6366f1' : '1px solid rgba(99, 102, 241, 0.25)',
                                background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--color-surface, #ffffff)',
                                borderRadius: '12px',
                                padding: '10px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: isSelected ? '0 4px 14px rgba(99, 102, 241, 0.18)' : 'none'
                              }}
                              className="hover-lift"
                            >
                              <DocThumbnail doc={doc} isSuggested={true} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: '0.84rem',
                                  fontWeight: 700,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  color: isSelected ? '#4f46e5' : 'var(--color-text)'
                                }}>
                                  {doc.name}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                  {doc.size || 'Tài liệu'} • {doc.date || ''}
                                </div>
                              </div>
                              {isSelected && (
                                <div style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: '#6366f1',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <Check size={12} strokeWidth={3} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Danh sách các tài liệu khác */}
                  {otherDocs.length > 0 && (
                    <div>
                      <div style={{
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--color-text-muted)',
                        marginBottom: '8px',
                        marginTop: suggestedDocs.length > 0 ? '8px' : '0'
                      }}>
                        Các tài liệu ảnh / PDF khác ({otherDocs.length})
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                        {otherDocs.map(doc => {
                          const isSelected = selectedDoc?.id === doc.id;
                          const isImg = /\.(jpe?g|png|webp)($|\?)/i.test(doc.url || doc.file_path || '') || /\.(jpe?g|png|webp)$/i.test(doc.name || '');
                          return (
                            <div
                              key={doc.id}
                              onClick={() => setSelectedDoc(doc)}
                              style={{
                                border: isSelected ? '2px solid #6366f1' : '1px solid var(--color-border-light, #e2e8f0)',
                                background: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'var(--color-surface, #ffffff)',
                                borderRadius: '12px',
                                padding: '10px 12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                boxShadow: isSelected ? '0 4px 14px rgba(99, 102, 241, 0.18)' : 'none'
                              }}
                              className="hover-lift"
                            >
                              <DocThumbnail doc={doc} isSuggested={false} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  fontSize: '0.84rem',
                                  fontWeight: 600,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}>
                                  {doc.name}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                  {doc.size || 'Tài liệu'} • {doc.date || ''}
                                </div>
                              </div>
                              {isSelected && (
                                <div style={{
                                  width: '20px',
                                  height: '20px',
                                  borderRadius: '50%',
                                  background: '#6366f1',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0
                                }}>
                                  <Check size={12} strokeWidth={3} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: SCANNING ANIMATION */}
          {step === 'scanning' && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px 0 16px'
            }}>
              {/* Khung máy quét tài liệu */}
              <div 
                className="ai-scanner-frame"
                style={{
                  width: '320px',
                  height: '220px',
                  background: '#0f172a',
                  border: '2px solid rgba(99, 102, 241, 0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px',
                  position: 'relative'
                }}
              >
                {/* Tia quét Laser */}
                <div className="ai-scan-laser" />

                {/* 4 Góc nhắm HUD */}
                <div style={{ position: 'absolute', top: '8px', left: '8px', width: '16px', height: '16px', borderTop: '3px solid #38bdf8', borderLeft: '3px solid #38bdf8' }} />
                <div style={{ position: 'absolute', top: '8px', right: '8px', width: '16px', height: '16px', borderTop: '3px solid #38bdf8', borderRight: '3px solid #38bdf8' }} />
                <div style={{ position: 'absolute', bottom: '8px', left: '8px', width: '16px', height: '16px', borderBottom: '3px solid #38bdf8', borderLeft: '3px solid #38bdf8' }} />
                <div style={{ position: 'absolute', bottom: '8px', right: '8px', width: '16px', height: '16px', borderBottom: '3px solid #38bdf8', borderRight: '3px solid #38bdf8' }} />

                {/* Preview file đang quét */}
                {isSelectedImage && selectedFileUrl ? (
                  <img 
                    src={selectedFileUrl} 
                    alt="Document scanning" 
                    onError={(e) => {
                      (e.target as HTMLElement).style.opacity = '0';
                    }}
                    style={{
                      maxWidth: '90%',
                      maxHeight: '90%',
                      objectFit: 'contain',
                      borderRadius: '8px',
                      opacity: 0.85,
                      transition: 'opacity 0.2s'
                    }} 
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                    <FileText size={56} style={{ color: '#818cf8', marginBottom: '8px' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1f5f9', padding: '0 16px' }}>
                      {selectedDoc?.name}
                    </div>
                  </div>
                )}
              </div>

              {/* Text trạng thái quét */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#6366f1',
                fontWeight: 700,
                fontSize: '0.98rem',
                marginBottom: '8px'
              }}>
                <RefreshCw size={18} className="animate-spin" />
                <span>{scanStages[loadingTextIndex]}</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Đang xử lý tệp: <strong>{selectedDoc?.name}</strong>
              </p>
            </div>
          )}

          {/* STEP 3: REVIEW & CONFIRM */}
          {step === 'review' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: isSelectedImage && selectedFileUrl ? '280px 1fr' : '1fr',
              gap: '24px'
            }}>
              {/* Cột trái: Ảnh tài liệu đối chiếu */}
              {isSelectedImage && selectedFileUrl && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}>
                  <div style={{
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--color-text-muted)'
                  }}>
                    Tài liệu gốc đối chiếu
                  </div>
                  <div style={{
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    background: '#0f172a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    maxHeight: '380px'
                  }}>
                    <img 
                      src={selectedFileUrl} 
                      alt="Source document" 
                      onError={(e) => {
                        (e.target as HTMLElement).style.opacity = '0';
                      }}
                      style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: '380px',
                        objectFit: 'contain'
                      }} 
                    />
                  </div>
                  <div style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: extractedData.document_type === 'passport' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
                    color: extractedData.document_type === 'passport' ? '#059669' : '#4f46e5',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}>
                    <Award size={14} />
                    {extractedData.document_type === 'passport' ? 'Hộ chiếu (Passport)' : 'Căn cước công dân (CCCD)'}
                  </div>
                </div>
              )}

              {/* Cột phải: Form thông tin bóc tách */}
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px'
                }}>
                  <div style={{
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: '#6366f1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Sparkles size={14} />
                    Thông tin trích xuất (Có thể chỉnh sửa nếu cần)
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  {/* Họ tên */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-text-muted)' }}>
                      Họ và tên *
                    </label>
                    <input 
                      type="text"
                      className="form-input"
                      value={extractedData.full_name || ''}
                      onChange={e => setExtractedData({ ...extractedData, full_name: e.target.value })}
                      placeholder="NGUYEN VAN A"
                      style={{ fontWeight: 700, textTransform: 'uppercase' }}
                    />
                  </div>

                  {/* Số CCCD / CMND */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-text-muted)' }}>
                      Số CCCD / CMND
                    </label>
                    <input 
                      type="text"
                      className="form-input"
                      value={extractedData.citizen_id || ''}
                      onChange={e => setExtractedData({ ...extractedData, citizen_id: e.target.value })}
                      placeholder="00120000xxxx"
                    />
                  </div>

                  {/* Số Passport */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-text-muted)' }}>
                      Số Passport (Hộ chiếu)
                    </label>
                    <input 
                      type="text"
                      className="form-input"
                      value={extractedData.passport || ''}
                      onChange={e => setExtractedData({ ...extractedData, passport: e.target.value })}
                      placeholder="C1234567"
                    />
                  </div>

                  {/* Ngày sinh */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-text-muted)' }}>
                      Ngày sinh (DD/MM/YYYY)
                    </label>
                    <input 
                      type="text"
                      className="form-input"
                      value={extractedData.birthday || ''}
                      onChange={e => setExtractedData({ ...extractedData, birthday: e.target.value })}
                      placeholder="03/08/1980"
                    />
                  </div>

                  {/* Giới tính */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-text-muted)' }}>
                      Giới tính
                    </label>
                    <select 
                      className="form-input"
                      value={extractedData.gender || ''}
                      onChange={e => setExtractedData({ ...extractedData, gender: e.target.value })}
                    >
                      <option value="">-- Chọn giới tính --</option>
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                    </select>
                  </div>

                  {/* Quốc tịch */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-text-muted)' }}>
                      Quốc tịch
                    </label>
                    <input 
                      type="text"
                      className="form-input"
                      value={extractedData.nationality || ''}
                      onChange={e => setExtractedData({ ...extractedData, nationality: e.target.value })}
                      placeholder="Việt Nam"
                    />
                  </div>

                  {/* Ngày cấp */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-text-muted)' }}>
                      Ngày cấp (DD/MM/YYYY)
                    </label>
                    <input 
                      type="text"
                      className="form-input"
                      value={extractedData.issue_date || ''}
                      onChange={e => setExtractedData({ ...extractedData, issue_date: e.target.value })}
                      placeholder="30/09/2025"
                    />
                  </div>

                  {/* Nơi thường trú / Địa chỉ */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px', color: 'var(--color-text-muted)' }}>
                      Nơi thường trú / Địa chỉ
                    </label>
                    <textarea 
                      className="form-input"
                      rows={2}
                      value={extractedData.address || ''}
                      onChange={e => setExtractedData({ ...extractedData, address: e.target.value })}
                      placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố..."
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: ERROR / INVALID DOCUMENT */}
          {step === 'error' && (
            <div style={{
              padding: '36px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.2)'
              }}>
                <AlertCircle size={32} />
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', fontWeight: 800, color: '#b91c1c' }}>
                Tài liệu không hợp lệ!
              </h3>
              <p style={{
                margin: '0 auto 20px',
                fontSize: '0.9rem',
                color: 'var(--color-text)',
                maxWidth: '480px',
                lineHeight: 1.5
              }}>
                {errorMessage || 'Tệp bạn vừa chọn không phải là Căn cước công dân (CCCD) hoặc Hộ chiếu (Passport) hợp lệ. Hệ thống không thể trích xuất thông tin.'}
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setStep('select')}
                  style={{
                    background: 'var(--color-surface, #ffffff)',
                    color: 'var(--color-text, #1e293b)',
                    border: '1px solid var(--color-border, #cbd5e1)',
                    padding: '8px 18px',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  className="hover-lift"
                >
                  <ArrowLeft size={16} />
                  Chọn lại tài liệu khác
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--color-border-light, #f1f5f9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--color-bg, #f8fafc)'
        }}>
          {step === 'select' && (
            <>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                {selectedDoc ? (
                  <span>Đã chọn: <strong style={{ color: '#4f46e5' }}>{selectedDoc.name}</strong></span>
                ) : (
                  <span>Vui lòng chọn 1 tài liệu CCCD/Passport để tiếp tục</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    background: 'transparent',
                    border: '1px solid var(--color-border, #cbd5e1)',
                    color: 'var(--color-text-muted)',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={!selectedDoc}
                  onClick={() => handleStartScan()}
                  style={{
                    background: selectedDoc 
                      ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' 
                      : 'var(--color-border, #e2e8f0)',
                    color: selectedDoc ? '#ffffff' : 'var(--color-text-muted)',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '10px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    cursor: selectedDoc ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: selectedDoc ? '0 4px 14px rgba(99, 102, 241, 0.3)' : 'none',
                    transition: 'all 0.2s'
                  }}
                  className={selectedDoc ? 'hover-lift' : ''}
                >
                  <Sparkles size={16} />
                  Bắt đầu trích xuất AI
                </button>
              </div>
            </>
          )}

          {step === 'review' && (
            <>
              <button
                type="button"
                onClick={() => setStep('select')}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  color: 'var(--color-text-muted)',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <ArrowLeft size={16} />
                Chọn tài liệu khác
              </button>
              <button
                type="button"
                onClick={handleApply}
                style={{
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '9px 22px',
                  borderRadius: '10px',
                  fontSize: '0.88rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.35)'
                }}
                className="hover-lift"
              >
                <Check size={18} strokeWidth={2.5} />
                Xác nhận & Tự động điền vào hồ sơ
              </button>
            </>
          )}

          {step === 'scanning' && (
            <div style={{ width: '100%', textAlign: 'center', fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              Vui lòng giữ nguyên cửa sổ trong khi AI đang xử lý...
            </div>
          )}

          {step === 'error' && (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--color-border, #cbd5e1)',
                  color: 'var(--color-text-muted)',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
