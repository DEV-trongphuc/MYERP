import React, { useState, useEffect, useRef } from 'react';
import { fetchAPI } from '../utils/api';
import api from '../api/axios';
import { 
  FileText, Calendar, CheckCircle, ShieldCheck, PenTool,
  Clock, DollarSign, Award, Percent, HelpCircle, Plus, Send,
  ChevronLeft, ChevronRight, XCircle, CheckCircle2, Download, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useLanguage } from '../contexts/LanguageContext';
import { CustomSelect } from '../components/ui/CustomSelect';
import { EmptyCard } from '../components/ui/EmptyCard';
import { Avatar } from '../components/ui/Avatar';
import { ApprovalDetailDrawer } from './Approvals';
import { CustomModal } from '../components/ui/CustomModal';
import { AnimatePresence } from 'framer-motion';

export default function MyPayslips() {
  const { t } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<'payslip' | 'leaves' | 'advances'>('payslip');

  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeNote, setDisputeNote] = useState('');
  const [sendingDispute, setSendingDispute] = useState(false);

  const getPeriodLabel = (periodStr: string) => {
    const parts = periodStr.split('-');
    if (parts.length < 2) return periodStr;
    const year = parts[0];
    const period = parts[1];
    if (period === '13') return `${t('Lương tháng 13')} - ${t('Năm')} ${year}`;
    if (period === 'MID') return `${t('Thưởng giữa năm')} - ${t('Năm')} ${year}`;
    if (period === 'YEND') return `${t('Thưởng cuối năm')} - ${t('Năm')} ${year}`;
    return `${t('Tháng')} ${period}/${year}`;
  };

  const getTitleLabel = (periodStr: string) => {
    const parts = periodStr.split('-');
    if (parts.length < 2) return t('BẢNG THANH TOÁN TIỀN LƯƠNG');
    const period = parts[1];
    if (period === '13') return t('PHIẾU THANH TOÁN LƯƠNG THÁNG 13');
    if (period === 'MID') return t('PHIẾU THANH TOÁN TIỀN THƯỞNG GIỮA NĂM');
    if (period === 'YEND') return t('PHIẾU THANH TOÁN TIỀN THƯỞNG CUỐI NĂM');
    return t('BẢNG THANH TOÁN TIỀN LƯƠNG & PHỤ CẤP');
  };

  const periodOptions = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1];
    const options: { value: string; label: string }[] = [];
    
    years.forEach(yr => {
      // Special periods
      options.push({ value: `${yr}-YEND`, label: `${t('Thưởng cuối năm')} - ${yr}` });
      options.push({ value: `${yr}-13`, label: `${t('Lương tháng 13')} - ${yr}` });
      options.push({ value: `${yr}-MID`, label: `${t('Thưởng giữa năm')} - ${yr}` });
      
      // 12 standard months
      for (let m = 12; m >= 1; m--) {
        const val = `${yr}-${String(m).padStart(2, '0')}`;
        options.push({
          value: val,
          label: `${t('Tháng')} ${String(m).padStart(2, '0')}/${yr}`
        });
      }
    });
    
    return options;
  }, [t]);
  
  // Custom states for multi-level approval & CCs
  const [users, setUsers] = useState<any[]>([]);
  const [leaveApproverId, setLeaveApproverId] = useState<string | number>('');
  const [leaveApproverId2, setLeaveApproverId2] = useState<string | number>('');
  const [leaveRelatedUserIds, setLeaveRelatedUserIds] = useState<any[]>([]);

  const [advanceApproverId, setAdvanceApproverId] = useState<string | number>('');
  const [advanceApproverId2, setAdvanceApproverId2] = useState<string | number>('');
  const [advanceRelatedUserIds, setAdvanceRelatedUserIds] = useState<any[]>([]);

  // Tab 1: Payslip states
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [allPayslips, setAllPayslips] = useState<any[]>([]);
  const [payslip, setPayslip] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Company configuration states
  const [companyName, setCompanyName] = useState('CÔNG TY CỔ PHẦN CÔNG NGHỆ IDEAS');
  const [companyAddress, setCompanyAddress] = useState('Tòa nhà IDEAS, 123 Đường Láng, Đống Đa, Hà Nội');
  const [companyPhone, setCompanyPhone] = useState('024 1234 5678');
  const [companyTaxId, setCompanyTaxId] = useState('0101234567');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');

  useEffect(() => {
    fetchAPI('get_settings').then(res => {
      if (res && res.success && res.data) {
        if (res.data.company_name) setCompanyName(res.data.company_name);
        if (res.data.company_address) setCompanyAddress(res.data.company_address);
        if (res.data.company_phone) setCompanyPhone(res.data.company_phone);
        if (res.data.company_tax_id) setCompanyTaxId(res.data.company_tax_id);
        if (res.data.company_logo_url) setCompanyLogoUrl(res.data.company_logo_url);
      }
    }).catch(() => {});
  }, []);

  // Tab 2: Leaves states
  const [leavesList, setLeavesList] = useState<any[]>([]);
  const [leaveType, setLeaveType] = useState('annual');
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveTotalDays, setLeaveTotalDays] = useState(1.0);
  const [leaveReason, setLeaveReason] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Tab 3: Advances states
  const [advancesList, setAdvancesList] = useState<any[]>([]);
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceReason, setAdvanceReason] = useState('');
  const [submittingAdvance, setSubmittingAdvance] = useState(false);
  const [selectedTimelineItem, setSelectedTimelineItem] = useState<any | null>(null);

  // Fetch users list
  useEffect(() => {
    fetchAPI('users?all=1').then(res => {
      setUsers(res?.data || []);
    }).catch(() => {});
  }, []);

  const userOptions = React.useMemo(() => {
    return users.map((u: any) => ({
      value: u.id,
      label: u.full_name || u.username,
      avatar: u.avatar_url || u.avatar,
      sublabel: u.role ? String(u.role).toUpperCase() : ''
    }));
  }, [users]);

  const approver2Options = React.useMemo(() => {
    return [
      { value: '', label: t('Không có (Chỉ duyệt 1 cấp)') },
      ...userOptions
    ];
  }, [userOptions, t]);

  const loadAllPayslips = async () => {
    try {
      const res = await fetchAPI('hrm/payroll?month_year=all');
      setAllPayslips(res?.data || []);
    } catch (err) {
      setAllPayslips([]);
    }
  };

  useEffect(() => {
    loadAllPayslips();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'payslip') {
      loadPayslip();
    } else if (activeSubTab === 'leaves') {
      loadLeaves();
    } else if (activeSubTab === 'advances') {
      loadAdvances();
    }
  }, [activeSubTab, selectedMonth]);

  useEffect(() => {
    if (allPayslips.length > 0) {
      const yearPrefix = `${selectedYear}-`;
      const available = allPayslips.filter(p => p.month_year.startsWith(yearPrefix));
      if (available.length > 0) {
        const sorted = [...available].sort((a, b) => b.month_year.localeCompare(a.month_year));
        if (!available.some(p => p.month_year === selectedMonth)) {
          setSelectedMonth(sorted[0].month_year);
        }
      } else {
        if (!selectedMonth.startsWith(yearPrefix)) {
          setSelectedMonth(`${selectedYear}-12`);
        }
      }
    }
  }, [allPayslips, selectedYear]);

  const loadPayslip = async () => {
    try {
      const res = await fetchAPI(`hrm/payroll?month_year=${selectedMonth}`);
      if (res && res.success && Array.isArray(res.data) && res.data.length > 0) {
        setPayslip((prev: any) => {
          if (!prev?.id) return res.data[0];
          return res.data.find((p: any) => p.id === prev.id) || res.data[0];
        });
      } else {
        setPayslip(null);
      }
    } catch (err: any) {
      setPayslip(null);
    }
  };

  const loadLeaves = async () => {
    try {
      const res = await fetchAPI('hrm/leaves');
      setLeavesList(res?.data || []);
    } catch (err: any) {
      setLeavesList([]);
    }
  };

  const loadAdvances = async () => {
    try {
      const res = await fetchAPI('hrm/advances');
      setAdvancesList(res?.data || []);
    } catch (err: any) {
      setAdvancesList([]);
    }
  };

  // --- LEAVE SUBMISSION ---
  const handleRequestLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStart || !leaveEnd || !leaveReason.trim()) {
      toast.error(t('Vui lòng điền đầy đủ thông tin đăng ký phép!'));
      return;
    }
    if (!leaveApproverId) {
      toast.error(t('Vui lòng chọn Người duyệt cấp 1!'));
      return;
    }
    setSubmittingLeave(true);
    try {
      await fetchAPI('hrm/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: leaveStart,
          end_date: leaveEnd,
          total_days: leaveTotalDays,
          reason: leaveReason,
          approver_id: leaveApproverId,
          approver_id_2: leaveApproverId2 || null,
          related_user_ids: leaveRelatedUserIds
        })
      });
      toast.success(t('Gửi đơn xin nghỉ phép thành công!'));
      setLeaveReason('');
      setLeaveTotalDays(1.0);
      setLeaveApproverId('');
      setLeaveApproverId2('');
      setLeaveRelatedUserIds([]);
      loadLeaves();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi gửi đơn nghỉ phép'));
    } finally {
      setSubmittingLeave(false);
    }
  };

  // --- ADVANCE SUBMISSION ---
  const handleRequestAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (advanceAmount <= 0 || !advanceReason.trim()) {
      toast.error(t('Vui lòng điền số tiền và lý do tạm ứng hợp lệ!'));
      return;
    }
    if (!advanceApproverId) {
      toast.error(t('Vui lòng chọn Người duyệt cấp 1!'));
      return;
    }
    setSubmittingAdvance(true);
    try {
      await fetchAPI('hrm/advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: advanceAmount,
          reason: advanceReason,
          approver_id: advanceApproverId,
          approver_id_2: advanceApproverId2 || null,
          related_user_ids: advanceRelatedUserIds
        })
      });
      toast.success(t('Gửi đề xuất tạm ứng lương thành công!'));
      setAdvanceAmount(0);
      setAdvanceReason('');
      setAdvanceApproverId('');
      setAdvanceApproverId2('');
      setAdvanceRelatedUserIds([]);
      loadAdvances();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi gửi yêu cầu tạm ứng'));
    } finally {
      setSubmittingAdvance(false);
    }
  };

  // --- SIGNATURE DRAWING PAD ---
  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e && e.touches.length > 0 ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    const scaleX = canvas.width / (rect.width || 1);
    const scaleY = canvas.height / (rect.height || 1);
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = 'var(--color-primary, #3b82f6)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleConfirmPayslip = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      toast.error(t('Vui lòng vẽ chữ ký của bạn trước khi xác nhận!'));
      return;
    }

    setSubmitting(true);
    const signatureUrl = canvas.toDataURL('image/png');

    try {
      await fetchAPI('hrm/payroll/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payslip.id,
          signature_url: signatureUrl
        })
      });
      toast.success(t('Đã ký nhận và xác nhận phiếu lương thành công!'));
      setPayslip((prev: any) => prev ? { ...prev, status: 'confirmed', signature_url: signatureUrl } : null);
      loadAllPayslips();
      loadPayslip();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi xác nhận phiếu lương'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendDispute = async () => {
    if (!disputeNote.trim()) {
      toast.error(t('Vui lòng nhập nội dung ghi chú yêu cầu thay đổi!'));
      return;
    }
    if (!payslip) return;

    setSendingDispute(true);
    try {
      await fetchAPI('hrm/payroll/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: payslip.id,
          action: 'dispute',
          note: disputeNote
        })
      });
      toast.success(t('Đã gửi yêu cầu thay đổi phiếu lương thành công!'));
      setPayslip((prev: any) => prev ? { ...prev, status: 'disputed', note: disputeNote } : null);
      setDisputeModalOpen(false);
      setDisputeNote('');
      setIsModalOpen(false);
      loadAllPayslips();
      loadPayslip();
    } catch (err: any) {
      toast.error(err?.message || t('Lỗi khi gửi yêu cầu'));
    } finally {
      setSendingDispute(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2];

  // Calculate year-to-date payroll stats
  const yearPrefix = `${selectedYear}-`;
  const payslipsForSelectedYear = allPayslips.filter(p => p.month_year.startsWith(yearPrefix));

  const totalNet = payslipsForSelectedYear.reduce((sum, p) => sum + Number(p.net_salary || 0), 0);
  const avgNet = payslipsForSelectedYear.length > 0 ? totalNet / payslipsForSelectedYear.length : 0;
  
  const totalInsurance = payslipsForSelectedYear.reduce((sum, p) => 
    sum + Number(p.insurance_bhxh || 0) + Number(p.insurance_bhyt || 0) + Number(p.insurance_bhtn || 0), 0);
    
  const totalBonus = payslipsForSelectedYear.reduce((sum, p) => 
    sum + Number(p.kpi_bonus || 0) + Number(p.diligence_bonus || 0) + Number(p.overtime_salary || 0), 0);
    
  const totalTax = payslipsForSelectedYear.reduce((sum, p) => sum + Number(p.tax_pit || 0), 0);

  return (
    <div>
      
      {/* Title */}
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">
            {t('Phiếu lương')}
          </h1>
          <p className="page-subtitle">
            {t('Tra cứu phiếu lương, đăng ký lịch nghỉ phép và tạm ứng thu nhập nhanh chóng.')}
          </p>
        </div>
        
        {activeSubTab === 'payslip' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0, whiteSpace: 'nowrap' }} className="no-print">
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-text-muted)', whiteSpace: 'nowrap', display: 'inline-block' }}>{t('Chọn năm')}:</span>
            <div style={{ width: '120px' }}>
              <CustomSelect
                options={years.map(yr => ({ value: yr, label: yr.toString() }))}
                value={selectedYear}
                onChange={val => setSelectedYear(Number(val))}
              />
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: PAYSLIP */}
      {activeSubTab === 'payslip' && (
        <div>
          {/* Stat Cards Grid (4 columns matching App UI) */}
          <div 
            style={{ 
              display: 'grid', 
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', 
              gap: isMobile ? '8px' : '16px', 
              marginBottom: isMobile ? '1rem' : '2rem' 
            }} 
            className="no-print"
          >
            {/* Stat Card 1: Tổng Thực Nhận */}
            <div style={{
              background: 'var(--color-surface, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: isMobile ? '12px' : '16px',
              padding: isMobile ? '12px 14px' : '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
              minHeight: isMobile ? '95px' : '135px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{ fontSize: isMobile ? '0.625rem' : '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('TỔNG THỰC NHẬN')}
                  </span>
                  <div style={{
                    width: isMobile ? '24px' : '32px',
                    height: isMobile ? '24px' : '32px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <DollarSign size={isMobile ? 13 : 16} />
                  </div>
                </div>
                <strong style={{ fontSize: isMobile ? '1.1rem' : '1.625rem', fontWeight: 900, color: 'var(--color-text, #1e293b)', display: 'block', lineHeight: 1.2 }}>
                  {formatCurrency(totalNet)}
                </strong>
              </div>
              <div style={{ marginTop: isMobile ? '6px' : '12px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                <span style={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
                  {t('TB')}: <strong style={{ color: 'var(--color-text, #1e293b)' }}>{formatCurrency(avgNet)}</strong>{!isMobile && ` / ${t('tháng')}`}
                </span>
              </div>
            </div>

            {/* Stat Card 2: Tổng Bảo Hiểm */}
            <div style={{
              background: 'var(--color-surface, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: isMobile ? '12px' : '16px',
              padding: isMobile ? '12px 14px' : '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
              minHeight: isMobile ? '95px' : '135px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{ fontSize: isMobile ? '0.625rem' : '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('BẢO HIỂM')}
                  </span>
                  <div style={{
                    width: isMobile ? '24px' : '32px',
                    height: isMobile ? '24px' : '32px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <ShieldCheck size={isMobile ? 13 : 16} />
                  </div>
                </div>
                <strong style={{ fontSize: isMobile ? '1.1rem' : '1.625rem', fontWeight: 900, color: 'var(--color-text, #1e293b)', display: 'block', lineHeight: 1.2 }}>
                  {formatCurrency(totalInsurance)}
                </strong>
              </div>
              <div style={{ marginTop: isMobile ? '6px' : '12px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                <span style={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
                  {t('BHXH, BHYT')}
                </span>
              </div>
            </div>

            {/* Stat Card 3: Tổng Thưởng */}
            <div style={{
              background: 'var(--color-surface, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: isMobile ? '12px' : '16px',
              padding: isMobile ? '12px 14px' : '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
              minHeight: isMobile ? '95px' : '135px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{ fontSize: isMobile ? '0.625rem' : '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('TỔNG THƯỞNG')}
                  </span>
                  <div style={{
                    width: isMobile ? '24px' : '32px',
                    height: isMobile ? '24px' : '32px',
                    borderRadius: '8px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    color: '#3b82f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Award size={isMobile ? 13 : 16} />
                  </div>
                </div>
                <strong style={{ fontSize: isMobile ? '1.1rem' : '1.625rem', fontWeight: 900, color: 'var(--color-text, #1e293b)', display: 'block', lineHeight: 1.2 }}>
                  {formatCurrency(totalBonus)}
                </strong>
              </div>
              <div style={{ marginTop: isMobile ? '6px' : '12px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                <span style={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }}></span>
                  {t('KPI & Thưởng')}
                </span>
              </div>
            </div>

            {/* Stat Card 4: Tổng Thuế TNCN */}
            <div style={{
              background: 'var(--color-surface, #ffffff)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: isMobile ? '12px' : '16px',
              padding: isMobile ? '12px 14px' : '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.02), 0 1px 2px rgba(0,0,0,0.04)',
              minHeight: isMobile ? '95px' : '135px'
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                  <span style={{ fontSize: isMobile ? '0.625rem' : '0.72rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('THUẾ TNCN')}
                  </span>
                  <div style={{
                    width: isMobile ? '24px' : '32px',
                    height: isMobile ? '24px' : '32px',
                    borderRadius: '8px',
                    background: 'rgba(245, 158, 11, 0.1)',
                    color: '#f59e0b',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <Percent size={isMobile ? 13 : 16} />
                  </div>
                </div>
                <strong style={{ fontSize: isMobile ? '1.1rem' : '1.625rem', fontWeight: 900, color: 'var(--color-text, #1e293b)', display: 'block', lineHeight: 1.2 }}>
                  {formatCurrency(totalTax)}
                </strong>
              </div>
              <div style={{ marginTop: isMobile ? '6px' : '12px', borderTop: '1px solid #f1f5f9', paddingTop: '6px' }}>
                <span style={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }}></span>
                  {t('Năm')} {selectedYear}
                </span>
              </div>
            </div>
          </div>

          {/* Main container for Month Cards */}
          <div className="card" style={{
            padding: '24px',
            background: 'var(--color-surface, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            borderRadius: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            marginBottom: '2rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }} className="no-print">
              <FileText size={18} style={{ color: 'var(--color-primary, #3b82f6)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text, #1e293b)' }}>
                {t('Danh sách phiếu lương')}
              </h3>
            </div>

            {/* 12-Month Cards Layout (6 cards per row) */}
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)', 
                gap: '12px'
              }} 
              className="no-print"
            >
              {Array.from({ length: 12 }).map((_, idx) => {
                const m = idx + 1;
                const mStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
                const payslipForMonth = allPayslips.find(p => p.month_year === mStr);
                const isAvailable = !!payslipForMonth;
                const isSelected = selectedMonth === mStr;

                return (
                  <div
                    key={mStr}
                    onClick={() => {
                      if (isAvailable) {
                        setSelectedMonth(mStr);
                        setIsModalOpen(true);
                      }
                    }}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '10px',
                      background: isSelected 
                        ? 'var(--color-surface, #ffffff)' 
                        : isAvailable 
                          ? 'var(--color-surface, #ffffff)' 
                          : 'var(--color-bg-light, #f8fafc)',
                      border: isSelected 
                        ? '2px solid var(--color-primary, #3b82f6)' 
                        : isAvailable
                          ? '1px solid var(--color-border, #e2e8f0)'
                          : '1px solid var(--color-border-light, #f1f5f9)',
                      cursor: isAvailable ? 'pointer' : 'default',
                      opacity: isAvailable ? 1 : 0.5,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected 
                        ? 'var(--shadow-md)'
                        : isAvailable
                          ? 'var(--shadow-sm)'
                          : 'none',
                      pointerEvents: isAvailable ? 'auto' : 'none'
                    }}
                    className={isAvailable ? 'hover-translate-y' : ''}
                  >
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 700, 
                      color: isSelected ? 'var(--color-primary, #3b82f6)' : 'var(--color-text-muted, #64748b)' 
                    }}>
                      Tháng {m}
                    </span>
                    {isAvailable ? (
                      <>
                        <span style={{ 
                          fontSize: '0.8rem', 
                          fontWeight: 800, 
                          color: isSelected ? 'var(--color-primary, #3b82f6)' : 'var(--color-text, #1e293b)',
                          marginTop: '2px'
                        }}>
                          {formatCurrency(payslipForMonth.net_salary)}
                        </span>
                        <span style={{ 
                          fontSize: '0.6rem', 
                          fontWeight: 700, 
                          color: payslipForMonth.status === 'confirmed' ? '#10b981' : '#f59e0b',
                          background: payslipForMonth.status === 'confirmed' ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.06)',
                          padding: '1px 6px',
                          borderRadius: '12px',
                          marginTop: '2px',
                          border: `1px solid ${payslipForMonth.status === 'confirmed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`
                        }}>
                          {payslipForMonth.status === 'confirmed' ? 'Đã ký' : 'Chờ ký'}
                        </span>
                      </>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontStyle: 'italic', marginTop: '2px' }}>
                        Chưa có
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Special Periods */}
              {['MID', '13', 'YEND'].map(suffix => {
                const key = `${selectedYear}-${suffix}`;
                const payslipForPeriod = allPayslips.find(p => p.month_year === key);
                if (!payslipForPeriod) return null;
                const isSelected = selectedMonth === key;
                const label = suffix === '13' ? 'Lương T13' : suffix === 'MID' ? 'Thưởng Giữa Năm' : 'Thưởng Cuối Năm';

                return (
                  <div
                    key={key}
                    onClick={() => {
                      setSelectedMonth(key);
                      setIsModalOpen(true);
                    }}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '10px',
                      background: isSelected 
                        ? 'var(--color-surface, #ffffff)' 
                        : 'var(--color-surface, #ffffff)',
                      border: isSelected 
                        ? '2px solid var(--color-primary, #3b82f6)' 
                        : '1px solid var(--color-border, #e2e8f0)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected 
                        ? 'var(--shadow-md)'
                        : 'var(--shadow-sm)'
                    }}
                    className="hover-translate-y"
                  >
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 700, 
                      color: isSelected ? 'var(--color-primary, #3b82f6)' : 'var(--color-text-muted, #64748b)',
                      textAlign: 'center'
                    }}>
                      {label}
                    </span>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: 800, 
                      color: isSelected ? 'var(--color-primary, #3b82f6)' : 'var(--color-text, #1e293b)',
                      marginTop: '2px'
                    }}>
                      {formatCurrency(payslipForPeriod.net_salary)}
                    </span>
                    <span style={{ 
                      fontSize: '0.6rem', 
                      fontWeight: 700, 
                      color: payslipForPeriod.status === 'confirmed' ? '#10b981' : '#f59e0b',
                      background: payslipForPeriod.status === 'confirmed' ? 'rgba(16, 185, 129, 0.06)' : 'rgba(245, 158, 11, 0.06)',
                      padding: '1px 6px',
                      borderRadius: '12px',
                      marginTop: '2px',
                      border: `1px solid ${payslipForPeriod.status === 'confirmed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'}`
                    }}>
                      {payslipForPeriod.status === 'confirmed' ? 'Đã ký' : 'Chờ ký'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Detailed Payslip Modal */}
      <CustomModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={t("Chi tiết Phiếu lương")}
        width="860px"
      >
        <div style={{ padding: '4px' }}>
          {payslip ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{
                background: payslip.status === 'confirmed' ? 'rgba(16, 185, 129, 0.08)' : payslip.status === 'sent' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(107, 114, 128, 0.08)',
                border: `1px solid ${payslip.status === 'confirmed' ? 'rgba(16, 185, 129, 0.3)' : payslip.status === 'sent' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(107, 114, 128, 0.3)'}`,
                borderRadius: '12px',
                padding: '1rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                {payslip.status === 'confirmed' ? (
                  <ShieldCheck size={20} style={{ color: '#10b981' }} />
                ) : (
                  <Clock size={20} style={{ color: '#3b82f6' }} />
                )}
                <div style={{ flex: 1 }}>
                  <strong style={{ fontSize: '0.9rem', color: payslip.status === 'confirmed' ? '#10b981' : '#3b82f6' }}>
                    {payslip.status === 'confirmed' ? t('Bảng lương đã ký nhận thành công!') : payslip.status === 'sent' ? t('Phiếu lương đang chờ bạn ký xác nhận') : t('Phiếu lương nháp (chưa công bố)')}
                  </strong>
                  <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    {payslip.status === 'confirmed' 
                      ? `${t('Đã xác nhận lúc')}: ${new Date(payslip.confirmed_at).toLocaleString('vi-VN')}` 
                      : t('Vui lòng kiểm tra kỹ chi tiết trước khi ký số xác nhận lương Net.')}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="no-print">
                <button
                  onClick={() => window.print()}
                  className="btn danger sm"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    background: 'var(--color-danger, #ef4444)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#dc2626'}
                  onMouseLeave={e => e.currentTarget.style.background = '#ef4444'}
                >
                  <Download size={14} /> {t('In / Xuất PDF')}
                </button>
              </div>

              <div id="payslip-print-area" className="card" style={{
                padding: '1.25rem 2rem',
                background: '#ffffff',
                color: '#1e293b',
                border: '1px solid var(--color-border-light)',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
                position: 'relative',
                width: '100%',
                boxSizing: 'border-box'
              }}>
                <style>{`
                  @media print {
                    body * { visibility: hidden !important; }
                    #payslip-print-area, #payslip-print-area * { visibility: visible !important; }
                    #payslip-print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; padding: 20mm !important; }
                  }
                `}</style>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', borderBottom: '2px solid var(--color-primary)', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {companyLogoUrl ? (
                      <img src={companyLogoUrl} alt="Logo" style={{ height: 36, maxWidth: 90, objectFit: 'contain' }} />
                    ) : (
                      <div style={{ background: 'var(--color-primary)', color: 'white', padding: '6px 10px', borderRadius: '8px', fontWeight: 900, fontSize: '0.85rem' }}>
                        {companyName.split(' ').slice(-2).map(w => w[0]).join('').toUpperCase()}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <strong style={{ fontSize: '0.825rem', color: '#1e293b', textTransform: 'uppercase' }}>{companyName}</strong>
                      <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{t('Địa chỉ')}: {companyAddress}</span>
                      <div style={{ display: 'flex', gap: '15px', fontSize: '0.7rem', color: '#64748b', marginTop: 1 }}>
                        <span>{t('SĐT')}: {companyPhone}</span>
                        <span>{t('MST')}: {companyTaxId}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.7rem', color: '#64748b' }}>
                    <strong>{t('MÃ PHIẾU')}: PL-{payslip.id}-{selectedMonth}</strong>
                    <span>{t('Ngày in')}: {new Date().toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginBottom: '1rem', paddingBottom: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, textTransform: 'uppercase', color: '#1e293b' }}>
                    {getTitleLabel(selectedMonth)}
                  </h2>
                  <p style={{ fontSize: '0.825rem', color: '#64748b', marginTop: 4, fontWeight: 600 }}>
                    {t('Kỳ thanh toán')}: {getPeriodLabel(selectedMonth)}
                  </p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', marginTop: '0.75rem', textAlign: 'left', fontSize: '0.825rem', border: '1px solid var(--color-border-light)', borderRadius: '10px', padding: '0.5rem 1rem', background: '#f8fafc' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>{t('Nhân viên')}:</span> <strong>{payslip.employee_name}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>{t('Chức vụ')}:</span> <strong>{payslip.job_title || 'Tư vấn viên'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>{t('Số ngày công làm việc')}:</span> <strong>{payslip.work_days_actual} / {payslip.work_days_required}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>{t('Đi muộn')}:</span> <strong style={{ color: payslip.lateness_minutes > 0 ? '#ef4444' : 'inherit' }}>{payslip.lateness_minutes} {t('phút')}</strong>
                    </div>
                  </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.75rem', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border-light)', color: '#1e293b', background: '#f8fafc', fontWeight: 700 }}>
                      <th style={{ padding: '6px 12px', textAlign: 'left' }}>{t('Khoản mục')}</th>
                      <th style={{ padding: '6px 12px', textAlign: 'center' }}>{t('Thông số')}</th>
                      <th style={{ padding: '6px 12px', textAlign: 'right' }}>{t('Cộng (Thu nhập)')}</th>
                      <th style={{ padding: '6px 12px', textAlign: 'right' }}>{t('Trừ (Khấu trừ)')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '6px 12px', fontWeight: 600 }}>{t('Lương thực tế theo ngày công')}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'center', color: '#64748b' }}>{payslip.work_days_actual} / {payslip.work_days_required} {t('ngày công')}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(payslip.salary_basic_calculated)}</td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                    </tr>
                    {Number(payslip.kpi_bonus || 0) > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{t('Lương thưởng doanh số KPI')}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'center', color: '#64748b' }}>—</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatCurrency(payslip.kpi_bonus)}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                      </tr>
                    )}
                    {Number(payslip.overtime_salary || 0) > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{t('Lương tăng ca')}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'center', color: '#64748b' }}>{payslip.overtime_days || 0} {t('ngày')} (x1.5)</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatCurrency(payslip.overtime_salary)}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                      </tr>
                    )}
                    {Number(payslip.diligence_bonus || 0) > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{t('Thưởng chuyên cần')}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'center', color: '#64748b' }}>—</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatCurrency(payslip.diligence_bonus)}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                      </tr>
                    )}
                    {Number(payslip.allowance_total || 0) > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{t('Phụ cấp (Ăn trưa, Xăng xe, Điện thoại)')}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'center', color: '#64748b' }}>—</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600 }}>{formatCurrency(payslip.allowance_total)}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                      </tr>
                    )}
                    {(Number(payslip.insurance_bhxh || 0) + Number(payslip.insurance_bhyt || 0) + Number(payslip.insurance_bhtn || 0)) > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{t('Khấu trừ Bảo hiểm (BHXH, BHYT, BHTN)')}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'center', color: '#64748b' }}>{payslip.has_insurance === 1 ? t('Có tham gia') : t('Không')}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>-{formatCurrency(Number(payslip.insurance_bhxh || 0) + Number(payslip.insurance_bhyt || 0) + Number(payslip.insurance_bhtn || 0))}</td>
                      </tr>
                    )}
                    {Number(payslip.lateness_penalty || 0) > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{t('Khấu trừ đi trễ')}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'center', color: '#64748b' }}>{payslip.lateness_minutes} {t('phút')}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>-{formatCurrency(payslip.lateness_penalty)}</td>
                      </tr>
                    )}
                    {Number(payslip.tax_pit || 0) > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{t('Thuế Thu nhập Cá nhân (PIT)')}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'center', color: '#64748b' }}>—</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>-{formatCurrency(payslip.tax_pit)}</td>
                      </tr>
                    )}
                    {Number(payslip.advance_deduction || 0) > 0 && (
                      <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td style={{ padding: '6px 12px', fontWeight: 600 }}>{t('Khấu trừ tạm ứng')}</td>
                        <td style={{ padding: '6px 12px', textAlign: 'center', color: '#64748b' }}>—</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#94a3b8' }}>—</td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', color: '#ef4444', fontWeight: 600 }}>-{formatCurrency(payslip.advance_deduction)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div style={{ marginTop: '1rem', borderTop: '2px double #cbd5e1', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.85rem', textTransform: 'uppercase' }}>{t('THỰC LĨNH CHUYỂN KHOẢN (NET PAY)')}</strong>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--color-primary)' }}>{formatCurrency(payslip.net_salary)}</strong>
                </div>
                {payslip.status === 'confirmed' && payslip.signature_url && (
                  <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', marginBottom: 4 }}>{t('Đã xác nhận & ký nhận online')}</span>
                    <img src={payslip.signature_url} alt="Signature" style={{ width: '120px', height: '48px', objectFit: 'contain', borderBottom: '1px solid #64748b' }} />
                    <strong style={{ fontSize: '0.78rem', marginTop: 4 }}>{payslip.employee_name}</strong>
                  </div>
                )}
                {payslip.status === 'disputed' && payslip.note && (
                  <div style={{ marginTop: '1rem', padding: '8px 12px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444', fontSize: '0.8rem' }}>
                    <strong>⚠️ {t('Đã gửi yêu cầu thay đổi:')}</strong> {payslip.note}
                  </div>
                )}
              </div>
              {payslip.status === 'sent' && (
                <div className="card" style={{ padding: '1rem', borderRadius: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.5rem' }}>
                    <PenTool size={15} style={{ color: 'var(--color-primary)' }} />
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700 }}>{t('Ký nhận Phiếu Lương trực tuyến')}</h4>
                  </div>
                  <div style={{ border: '1px dashed var(--color-border)', borderRadius: 8, background: 'var(--color-bg-secondary)', overflow: 'hidden', position: 'relative', height: 120 }}>
                    <canvas ref={canvasRef} width={500} height={120} style={{ width: '100%', height: '100%', cursor: 'crosshair', backgroundColor: 'white', backgroundImage: 'radial-gradient(#e2e8f0 1.2px, transparent 1.2px)', backgroundSize: '20px 20px' }} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: '0.75rem' }}>
                    <button onClick={clearCanvas} className="btn secondary" style={{ padding: '5px 12px', fontSize: '0.78rem' }}>{t('Vẽ lại')}</button>
                    <button
                      onClick={() => setDisputeModalOpen(true)}
                      disabled={submitting}
                      className="btn outline"
                      style={{ padding: '5px 14px', fontSize: '0.78rem', color: '#ef4444' }}
                    >
                      <AlertCircle size={13} />
                      {t('Yêu cầu thay đổi')}
                    </button>
                    <button onClick={handleConfirmPayslip} disabled={submitting} className="btn primary" style={{ padding: '5px 18px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={13} />
                      {submitting ? t('Đang ký...') : t('Ký xác nhận lương')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </CustomModal>

      {/* Dispute Modal */}
      <CustomModal
        isOpen={disputeModalOpen}
        onClose={() => setDisputeModalOpen(false)}
        title={t("Yêu cầu thay đổi / Khiếu nại")}
        width="500px"
      >
        <div style={{ padding: '10px' }}>
          <textarea
            value={disputeNote}
            onChange={(e) => setDisputeNote(e.target.value)}
            placeholder={t('Vui lòng nhập lý do yêu cầu thay đổi...')}
            style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--color-border)' }}
            rows={4}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '1rem' }}>
            <button onClick={() => setDisputeModalOpen(false)} className="btn secondary">{t('Hủy')}</button>
            <button onClick={handleSendDispute} disabled={sendingDispute} className="btn primary">
              {sendingDispute ? t('Đang gửi...') : t('Gửi yêu cầu')}
            </button>
          </div>
        </div>
      </CustomModal>

      {/* Progress Timeline Drawer */}
      <AnimatePresence>
        {selectedTimelineItem && (
          <ApprovalDetailDrawer
            item={selectedTimelineItem}
            onClose={() => setSelectedTimelineItem(null)}
            users={users}
            t={t}
            onApprove={async () => {}}
            onReject={() => {}}
            isAdmin={false}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


