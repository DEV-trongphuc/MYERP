import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Building2, Users, FileText, Calculator, BookOpen, AlertCircle, CheckCircle2,
  Download, Copy, RefreshCw, RotateCcw, ArrowRight, ShieldCheck, DollarSign, Calendar,
  ChevronRight, TrendingUp, TrendingDown, Layers, FileSpreadsheet,
  AlertTriangle, Clock, ArrowDownRight, ArrowUpRight, Check, X, Info, Search,
  ExternalLink, SlidersHorizontal, Landmark, Wallet, Award, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { fetchAPI } from '../../utils/api';

interface LegalParams {
  year: number;
  month: number;
  luong_co_so: number;
  vung: Record<number, number>;
  rate_nld: { bhxh: number; bhyt: number; bhtn: number };
  rate_dn: { bhxh: number; huu: number; om: number; tnld: number; bhyt: number; bhtn: number; kpcd: number };
  self_deduction: number;
  dep_deduction: number;
  brackets: Array<{ cap: number; rate: number; sub: number }>;
  an_trua_cap: number;
  casual_cap: number;
  cap_bhxh_bhyt: number;
  cap_bhtn_vung1: number;
}

interface OverviewData {
  month: string;
  legal_parameters: LegalParams;
  kpis: {
    active_employees: number;
    resigned_employees: number;
    total_employees: number;
    total_gross: number;
    total_net: number;
    total_tax_pit: number;
    total_advance?: number;
    total_insurance_nld: number;
    total_insurance_dn: number;
    total_insurance_all: number;
    total_kpcd: number;
    total_payslips: number;
    projected_gross?: number;
    projected_net?: number;
    projected_ins_nld?: number;
    projected_ins_dn?: number;
    is_projected?: boolean;
  };
  alerts: {
    contract_alerts: Array<{
      severity: 'bad' | 'warn' | 'info';
      user_id: number;
      full_name: string;
      contract_code: string;
      contract_type: string;
      end_date: string | null;
      days_left: number | null;
      message: string;
    }>;
    missing_info_users: Array<{
      id: number;
      full_name: string;
      email: string;
      miss_fields: string[];
    }>;
  };
  tax_schedule: {
    quarter: number;
    due_monthly: string;
    due_quarterly: string;
    suggested_type: string;
  };
  sop_checklist: Array<{
    id: string;
    title: string;
    done: boolean;
  }>;
}

interface JournalEntry {
  seq: number;
  date: string;
  doc_no: string;
  desc: string;
  debit_acc: string;
  credit_acc: string;
  amount: number;
  type: string;
}

interface LaborRecord {
  stt: number;
  full_name: string;
  gender: string;
  dob: string;
  nationality: string;
  address: string;
  citizen_id: string;
  qualification: string;
  skill_level: string;
  job_title: string;
  contract_type: string;
  contract_start: string;
  contract_end: string;
  termination_reason: string;
  salary: number;
  insurance_book_no: string;
  annual_leave_used: number;
  total_ot_hours: number;
  salary_raise: string;
  training: string;
  discipline: string;
}

interface FinancialData {
  month: string;
  pnl: {
    revenue: number;
    deposit_revenue: number;
    invoice_revenue: number;
    cogs: number;
    gross_profit: number;
    gross_margin_pct: number;
    hrm_cost: number;
    payroll_gross: number;
    insurance_dn: number;
    operating_expense: number;
    marketing_expense: number;
    total_expense: number;
    operating_profit: number;
    cit_tax_20pct: number;
    net_profit: number;
    net_margin_pct: number;
  };
  cashflow: {
    cash_in: number;
    cash_out: number;
    net_cashflow: number;
    is_positive: boolean;
  };
  tax_balance: {
    vat_output: number;
    vat_input: number;
    vat_payable: number;
    vat_deductible: number;
    pit_withheld: number;
    cit_estimated: number;
    total_tax_to_pay: number;
  };
}

const FMT = (n: number | string | null | undefined) => {
  const num = Math.round(Number(n || 0));
  return new Intl.NumberFormat('vi-VN').format(num);
};

/** Dynamic Red / Yellow / Green color coding based on percentage */
const getCompletenessTone = (pct: number) => {
  if (pct >= 80) {
    return {
      bar: '#10b981',
      dot: '#10b981',
      text: '#059669',
      bg: '#ecfdf5'
    };
  }
  if (pct >= 50) {
    return {
      bar: '#f59e0b',
      dot: '#f59e0b',
      text: '#d97706',
      bg: '#fffbeb'
    };
  }
  return {
    bar: '#ef4444',
    dot: '#ef4444',
    text: '#dc2626',
    bg: '#fef2f2'
  };
};

/** Clean flex search box so icon never overlaps placeholder text */
const CleanSearchBox: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  width?: number | string;
}> = ({ value, onChange, placeholder, width = 220 }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '7px',
      width,
      height: '32px',
      padding: '0 10px',
      borderRadius: '8px',
      border: '1px solid var(--color-border)',
      background: 'var(--color-surface, #ffffff)',
      boxSizing: 'border-box'
    }}
  >
    <Search size={13.5} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        border: 'none',
        outline: 'none',
        background: 'transparent',
        width: '100%',
        fontSize: '0.76rem',
        color: 'var(--color-text)',
        padding: 0
      }}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        style={{
          border: 'none',
          background: 'none',
          padding: 0,
          cursor: 'pointer',
          color: 'var(--color-text-muted)',
          display: 'flex',
          alignItems: 'center'
        }}
      >
        <X size={12} />
      </button>
    )}
  </div>
);

export const HrmAccountingAzWorkspace: React.FC<{
  currentMonth?: string;
  onNavigateToPayroll?: () => void;
  onNavigateToProfiles?: () => void;
}> = ({ currentMonth, onNavigateToPayroll, onNavigateToProfiles }) => {
  const [activeSubtab, setActiveSubtab] = useState<'overview' | 'calculator' | 'journal' | 'tax_reports' | 'labor_book'>('overview');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth || new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState<boolean>(false);

  // Dữ liệu Tổng quan
  const [overview, setOverview] = useState<OverviewData | null>(null);

  // Dữ liệu Sổ Nhật Ký Chung
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [journalSummary, setJournalSummary] = useState<any>(null);
  const [journalFilterAcc, setJournalFilterAcc] = useState<string>('all');
  const [journalSearch, setJournalSearch] = useState<string>('');

  // Dữ liệu Báo cáo Tài chính P&L & Thuế
  const [financialData, setFinancialData] = useState<FinancialData | null>(null);

  // Dữ liệu Tờ khai TNCN & XML
  const [taxType, setTaxType] = useState<'Q' | 'M' | 'Y'>('Q');
  const [taxNum, setTaxNum] = useState<number>(() => Math.ceil((new Date().getMonth() + 1) / 3));
  const [taxYear, setTaxYear] = useState<number>(() => new Date().getFullYear());
  const [taxIndicators, setTaxIndicators] = useState<Record<string, number>>({});
  const [generatedXml, setGeneratedXml] = useState<string>('');
  const [xmlFilename, setXmlFilename] = useState<string>('');
  const [xmlModalOpen, setXmlModalOpen] = useState<boolean>(false);

  // Dữ liệu Sổ Quản Lý Lao Động
  const [laborHeaders, setLaborHeaders] = useState<string[]>([]);
  const [laborRecords, setLaborRecords] = useState<LaborRecord[]>([]);
  const [laborSearch, setLaborSearch] = useState<string>('');

  // State Bộ Tính Lương Simulator
  const [simMode, setSimMode] = useState<'gross_to_net' | 'net_to_gross'>('gross_to_net');
  const [simSalary, setSimSalary] = useState<number>(20000000);
  const [simDependents, setSimDependents] = useState<number>(0);
  const [simRegion, setSimRegion] = useState<number>(1);
  const [simYear, setSimYear] = useState<number>(() => new Date().getFullYear());
  const [simContractType, setSimContractType] = useState<string>('labour_resident');
  const [simMeal, setSimMeal] = useState<number>(730000);
  const [simPhone, setSimPhone] = useState<number>(300000);
  const [simTravel, setSimTravel] = useState<number>(500000);
  const [simHasInsurance, setSimHasInsurance] = useState<boolean>(true);
  const [simHasUnion, setSimHasUnion] = useState<boolean>(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [simulating, setSimulating] = useState<boolean>(false);

  // State Máy tính Chế độ (Thai sản / Thôi việc / Mất việc)
  const [benefitType, setBenefitType] = useState<'maternity' | 'severance' | 'job_loss'>('maternity');
  const [benefitAvgSalary, setBenefitAvgSalary] = useState<number>(15000000);
  const [benefitWorkYears, setBenefitWorkYears] = useState<number>(3.5);
  const [benefitUnempYears, setBenefitUnempYears] = useState<number>(2.0);
  const [benefitResult, setBenefitResult] = useState<any>(null);

  // Fetch Overview Data
  const loadOverview = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchAPI(`/hrm/accounting-az/overview?month=${selectedMonth}`);
      if (res && res.data) {
        setOverview(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load accounting overview', err);
      toast.error('Không tải được tổng quan kế toán & lương');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  // Fetch General Journal
  const loadJournal = useCallback(async () => {
    try {
      const res = await fetchAPI(`/hrm/accounting-az/general-journal?month=${selectedMonth}`);
      if (res && res.data) {
        setJournalEntries(Array.isArray(res.data.entries) ? res.data.entries : []);
        setJournalSummary(res.data.summary || null);
      }
    } catch (err) {
      console.error('Failed to load journal', err);
    }
  }, [selectedMonth]);

  // Fetch Financial & Tax Summary
  const loadFinancial = useCallback(async () => {
    try {
      const res = await fetchAPI(`/finance/accounting-az/summary?month=${selectedMonth}`);
      if (res && res.data) {
        setFinancialData(res.data);
      }
    } catch (err) {
      console.error('Failed to load finance summary', err);
    }
  }, [selectedMonth]);

  // Fetch Tax Declaration
  const loadTaxDeclaration = useCallback(async () => {
    try {
      const res = await fetchAPI(`/hrm/accounting-az/tax-declaration?type=${taxType}&num=${taxNum}&year=${taxYear}`);
      if (res && res.data) {
        setTaxIndicators(res.data.indicators || {});
      }
    } catch (err) {
      console.error('Failed to load tax declaration', err);
    }
  }, [taxType, taxNum, taxYear]);

  // Fetch Labor Book
  const loadLaborBook = useCallback(async () => {
    try {
      const res = await fetchAPI(`/hrm/accounting-az/labor-book?year=${taxYear}`);
      if (res && res.data) {
        setLaborHeaders(Array.isArray(res.data.headers) ? res.data.headers : []);
        setLaborRecords(Array.isArray(res.data.records) ? res.data.records : []);
      }
    } catch (err) {
      console.error('Failed to load labor book', err);
    }
  }, [taxYear]);

  // Run Simulator
  const handleSimulate = useCallback(async () => {
    try {
      setSimulating(true);
      const res = await fetchAPI('/hrm/accounting-az/simulate-payroll', {
        method: 'POST',
        body: JSON.stringify({
          salary: simSalary,
          mode: simMode,
          dependents: simDependents,
          region: simRegion,
          year: simYear,
          contract_type: simContractType,
          has_insurance: simHasInsurance,
          has_union: simHasUnion,
          allowance_meal: simMeal,
          allowance_phone: simPhone,
          allowance_travel: simTravel,
        })
      });
      if (res && res.data) {
        setSimResult(res.data);
      }
    } catch (err) {
      console.error('Failed to simulate payroll', err);
      toast.error('Lỗi khi mô phỏng tính lương');
    } finally {
      setSimulating(false);
    }
  }, [simSalary, simMode, simDependents, simRegion, simYear, simContractType, simHasInsurance, simHasUnion, simMeal, simPhone, simTravel]);

  // Calculate Benefit
  const handleCalculateBenefit = useCallback(async () => {
    try {
      const res = await fetchAPI('/hrm/accounting-az/calculate-benefits', {
        method: 'POST',
        body: JSON.stringify({
          benefit_type: benefitType,
          average_salary: benefitAvgSalary,
          work_years: benefitWorkYears,
          unemployment_insured_years: benefitUnempYears,
        })
      });
      if (res && res.data) {
        setBenefitResult(res.data);
      }
    } catch (err) {
      console.error('Failed to calculate benefit', err);
    }
  }, [benefitType, benefitAvgSalary, benefitWorkYears, benefitUnempYears]);

  // Generate HTKK XML
  const handleGenerateXml = async () => {
    try {
      const res = await fetchAPI('/hrm/accounting-az/generate-htkk-xml', {
        method: 'POST',
        body: JSON.stringify({
          type: taxType,
          num: taxNum,
          year: taxYear,
          indicators: taxIndicators,
          company_mst: '0101234567',
          company_name: 'CÔNG TY TNHH MYERP',
          signer: 'NGUYEN VAN A',
          cqt_code: '70711',
          cqt_name: 'CỤC THUẾ THÀNH PHỐ HÀ NỘI',
        })
      });
      if (res && res.data) {
        setGeneratedXml(res.data.xml);
        setXmlFilename(res.data.filename);
        setXmlModalOpen(true);
        toast.success(`Đã tạo tờ khai ${res.data.filename} thành công!`);
      }
    } catch (err) {
      console.error('Failed to generate xml', err);
      toast.error('Lỗi khi xuất XML tờ khai');
    }
  };

  // Download XML
  const handleDownloadXml = () => {
    if (!generatedXml) return;
    const blob = new Blob([generatedXml], { type: 'application/xml;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', xmlFilename || `ToKhai_TNCN_${taxYear}.xml`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã tải tệp XML HTKK về máy tính');
  };

  // Copy XML
  const handleCopyXml = () => {
    if (!generatedXml) return;
    navigator.clipboard.writeText(generatedXml);
    toast.success('Đã sao chép nội dung XML vào Clipboard');
  };

  // Export Journal to Excel
  const handleExportJournalExcel = () => {
    if (!journalEntries || journalEntries.length === 0) {
      toast.error('Chưa có bút toán hạch toán để xuất Excel');
      return;
    }
    const data = journalEntries.map((e, idx) => ({
      'STT': idx + 1,
      'Ngày chứng từ': e.date,
      'Số hiệu chứng từ': e.doc_no,
      'Diễn giải nghiệp vụ': e.desc,
      'Tài khoản Nợ': e.debit_acc,
      'Tài khoản Có': e.credit_acc,
      'Số tiền phát sinh (VNĐ)': e.amount,
      'Phân loại': e.type
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'So_Nhat_Ky_Chung');
    XLSX.writeFile(wb, `So_Nhat_Ky_Chung_${selectedMonth}.xlsx`);
    toast.success('Đã xuất Sổ Nhật Ký Chung ra Excel!');
  };

  // Export Labor Book to Excel
  const handleExportLaborBookExcel = () => {
    if (!laborRecords || laborRecords.length === 0) {
      toast.error('Chưa có hồ sơ lao động để xuất Excel');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(laborRecords);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'So_Quan_Ly_Lao_Dong');
    XLSX.writeFile(wb, `So_Quan_Ly_Lao_Dong_${taxYear}.xlsx`);
    toast.success('Đã xuất Sổ Quản Lý Lao Động (NĐ 145) ra Excel!');
  };

  // Filtered Journal Entries
  const filteredJournalEntries = useMemo(() => {
    let list = Array.isArray(journalEntries) ? journalEntries : [];
    if (journalFilterAcc !== 'all') {
      list = list.filter(e => 
        e.debit_acc.startsWith(journalFilterAcc) || e.credit_acc.startsWith(journalFilterAcc)
      );
    }
    if (journalSearch.trim()) {
      const q = journalSearch.trim().toLowerCase();
      list = list.filter(e =>
        e.doc_no.toLowerCase().includes(q) ||
        e.desc.toLowerCase().includes(q) ||
        e.debit_acc.includes(q) ||
        e.credit_acc.includes(q)
      );
    }
    return list;
  }, [journalEntries, journalFilterAcc, journalSearch]);

  // Filtered Labor Records
  const filteredLaborRecords = useMemo(() => {
    const list = Array.isArray(laborRecords) ? laborRecords : [];
    if (!laborSearch.trim()) return list;
    const q = laborSearch.trim().toLowerCase();
    return list.filter(r =>
      r.full_name.toLowerCase().includes(q) ||
      (r.citizen_id || '').toLowerCase().includes(q) ||
      (r.job_title || '').toLowerCase().includes(q) ||
      (r.contract_type || '').toLowerCase().includes(q)
    );
  }, [laborRecords, laborSearch]);

  // Initial loads
  useEffect(() => {
    loadOverview();
    loadJournal();
    loadFinancial();
  }, [loadOverview, loadJournal, loadFinancial]);

  useEffect(() => {
    if (activeSubtab === 'tax_reports') {
      loadTaxDeclaration();
    } else if (activeSubtab === 'labor_book') {
      loadLaborBook();
      handleCalculateBenefit();
    } else if (activeSubtab === 'calculator' && !simResult) {
      handleSimulate();
    }
  }, [activeSubtab, loadTaxDeclaration, loadLaborBook, handleCalculateBenefit, handleSimulate, simResult]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', width: '100%' }}>
      {/* TOP FILTER & SEGMENT BAR (100% Đồng bộ style Tổng quan lead) */}
      <div
        className="card"
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          {/* Segment Switcher Tray: 5 Phân hệ chính */}
          <div
            className="mobile-horizontal-strip touch-scroll-x"
            style={{
              display: 'flex',
              padding: '3px',
              borderRadius: '10px',
              background: 'var(--color-border-light)',
              border: '1px solid var(--color-border)',
              gap: '2px',
              maxWidth: '100%',
              overflowX: 'auto',
              flexWrap: 'nowrap',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            {[
              { id: 'overview' as const, label: 'Tổng quan A-Z', icon: Layers },
              { id: 'calculator' as const, label: 'Tính Lương Gross ⇄ Net', icon: Calculator },
              { id: 'journal' as const, label: 'Sổ Nhật Ký Chung', icon: FileSpreadsheet },
              { id: 'tax_reports' as const, label: 'Tờ khai TNCN & HTKK XML', icon: TrendingUp },
              { id: 'labor_book' as const, label: 'Sổ QLLĐ (NĐ 145)', icon: BookOpen },
            ].map((tab) => {
              const Icon = tab.icon;
              const isAct = activeSubtab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveSubtab(tab.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    height: '32px',
                    padding: '0 14px',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    borderRadius: '7px',
                    border: 'none',
                    background: isAct ? 'var(--color-surface, #ffffff)' : 'transparent',
                    color: isAct ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text-muted)',
                    fontSize: '0.8rem',
                    fontWeight: isAct ? 700 : 600,
                    cursor: 'pointer',
                    boxShadow: isAct ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Month Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '7px',
              height: '32px',
              padding: '0 10px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface, #ffffff)',
              boxSizing: 'border-box'
            }}
          >
            <Calendar size={13.5} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--color-text)',
                padding: 0
              }}
            />
          </div>

          {/* Quick Account Filter (Only in Journal Tab) */}
          {activeSubtab === 'journal' && (
            <div style={{ minWidth: '180px' }}>
              <select
                value={journalFilterAcc}
                onChange={e => setJournalFilterAcc(e.target.value)}
                style={{
                  height: '32px',
                  padding: '0 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface, #ffffff)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  outline: 'none',
                  width: '100%'
                }}
              >
                <option value="all">Tất cả tài khoản kế toán</option>
                <option value="334">TK 334 (Phải trả NLĐ)</option>
                <option value="338">TK 338 (Bảo hiểm & KPCĐ)</option>
                <option value="3335">TK 3335 (Thuế TNCN)</option>
                <option value="642">TK 642 (Chi phí QLDN)</option>
                <option value="112">TK 112 (Tiền gửi ngân hàng)</option>
                <option value="511">TK 511 (Doanh thu)</option>
                <option value="133">TK 133 (VAT đầu vào)</option>
              </select>
            </div>
          )}
        </div>

        {/* Right side Actions & Quick Navigation */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {onNavigateToPayroll && (
            <button
              type="button"
              className="btn outline sm"
              onClick={onNavigateToPayroll}
              style={{ height: '32px', padding: '0 12px', fontSize: '0.76rem', fontWeight: 600 }}
              title="Mở Bảng tính lương chi tiết"
            >
              <span>Bảng tính lương</span>
              <ChevronRight size={13} />
            </button>
          )}

          {onNavigateToProfiles && (
            <button
              type="button"
              className="btn outline sm"
              onClick={onNavigateToProfiles}
              style={{ height: '32px', padding: '0 12px', fontSize: '0.76rem', fontWeight: 600 }}
              title="Mở Danh sách hồ sơ nhân sự"
            >
              <span>Hồ sơ nhân sự</span>
              <ChevronRight size={13} />
            </button>
          )}

          <button
            type="button"
            className="btn outline sm"
            onClick={() => {
              loadOverview();
              loadJournal();
              loadFinancial();
              if (activeSubtab === 'tax_reports') loadTaxDeclaration();
              if (activeSubtab === 'labor_book') loadLaborBook();
              toast.success('Đã làm mới dữ liệu kế toán & lương');
            }}
            style={{
              height: '32px',
              width: '32px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ACTIVE FILTER CHIPS BAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '6px',
          padding: '8px 12px',
          background: 'var(--color-surface, #ffffff)',
          border: '1px solid var(--color-border-light)',
          borderRadius: '10px',
          fontSize: '0.78rem'
        }}
      >
        <span style={{ color: 'var(--color-text-muted)', fontWeight: 600, marginRight: '4px' }}>Đang hiển thị:</span>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 9px',
            borderRadius: '8px',
            background: 'rgba(189, 29, 45, 0.08)',
            color: 'var(--color-primary, #BD1D2D)',
            fontSize: '0.75rem',
            fontWeight: 600
          }}
        >
          <span>Kỳ tháng: {selectedMonth}</span>
        </span>

        {activeSubtab === 'journal' && journalFilterAcc !== 'all' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 9px',
              borderRadius: '8px',
              background: 'rgba(37, 99, 235, 0.08)',
              color: '#1d4ed8',
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            <span>Tài khoản: TK {journalFilterAcc}</span>
            <button
              type="button"
              onClick={() => setJournalFilterAcc('all')}
              style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
            >
              <X size={12} />
            </button>
          </span>
        )}

        {overview?.kpis.is_projected && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 9px',
              borderRadius: '8px',
              background: 'rgba(245, 158, 11, 0.1)',
              color: '#b45309',
              fontSize: '0.75rem',
              fontWeight: 600
            }}
          >
            <span>Chế độ: Dự toán theo hồ sơ (Chưa chốt lương tháng)</span>
          </span>
        )}

        <button
          type="button"
          onClick={() => {
            setSelectedMonth(new Date().toISOString().slice(0, 7));
            setJournalFilterAcc('all');
            setJournalSearch('');
            setLaborSearch('');
          }}
          style={{
            marginLeft: 'auto',
            border: 'none',
            background: 'transparent',
            color: 'var(--color-danger, #ef4444)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <RotateCcw size={12} />
          <span>Về tháng hiện tại</span>
        </button>
      </div>

      {/* 4 APP-STANDARD KPI CARDS (Đồng bộ chuẩn .stat-card & .dashboard-kpi-grid) */}
      <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
        {/* KPI 1: TỔNG QUỸ LƯƠNG & NHÂN SỰ */}
        <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              TỔNG QUỸ LƯƠNG &amp; NHÂN SỰ
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: 'var(--color-primary, #BD1D2D)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
            {overview ? FMT(overview.kpis.total_gross || overview.kpis.projected_gross) : '—'}{' '}
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>đ</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>• Thực tế: <strong style={{ color: 'var(--color-text)' }}>{overview ? FMT(overview.kpis.total_gross) : 0} đ</strong></span>
            <span>• Dự kiến: <strong style={{ color: 'var(--color-text)' }}>{overview ? FMT(overview.kpis.projected_gross) : 0} đ</strong></span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--color-text-light)', fontWeight: 500 }}>
            Đang làm việc: <strong style={{ color: 'var(--color-text)' }}>{overview?.kpis.active_employees || 0}</strong> nhân sự • {overview?.kpis.total_payslips || 0} phiếu lương
          </div>
        </div>

        {/* KPI 2: BẢO HIỂM BẮT BUỘC & KPCĐ */}
        <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              BẢO HIỂM BẮT BUỘC &amp; KPCĐ (34%)
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(245, 158, 11, 0.1)', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ fontWeight: 800, color: '#b45309' }}>
            {overview ? FMT(overview.kpis.total_insurance_all) : '—'}{' '}
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>đ</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>• DN (23.5%): <strong style={{ color: 'var(--color-text)' }}>{overview ? FMT(overview.kpis.total_insurance_dn) : 0} đ</strong></span>
            <span>• NLĐ (10.5%): <strong style={{ color: 'var(--color-text)' }}>{overview ? FMT(overview.kpis.total_insurance_nld) : 0} đ</strong></span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--color-text-light)', fontWeight: 500 }}>
            BHXH (25.5%) • BHYT (4.5%) • BHTN (2%) • KPCĐ (2%)
          </div>
        </div>

        {/* KPI 3: THỰC LĨNH CHI TRẢ NLĐ */}
        <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              THỰC LĨNH (NET) CHI TRẢ NLĐ
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(16, 185, 129, 0.1)', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ fontWeight: 800, color: '#059669' }}>
            {overview ? FMT(overview.kpis.total_net || overview.kpis.projected_net) : '—'}{' '}
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>đ</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>• Khấu trừ thuế TNCN: <strong style={{ color: 'var(--color-text)' }}>{overview ? FMT(overview.kpis.total_tax_pit) : 0} đ</strong></span>
            <span>• Tạm ứng: <strong style={{ color: 'var(--color-text)' }}>{overview ? FMT(overview.kpis.total_advance) : 0} đ</strong></span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--color-text-light)', fontWeight: 500 }}>
            Lịch chi lương Ngân hàng: Ngày 05 hàng tháng qua UNC
          </div>
        </div>

        {/* KPI 4: TUÂN THỦ BLLĐ & LỊCH THUẾ */}
        <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--color-text-muted)' }}>
              TUÂN THỦ BLLĐ 2019 &amp; LỊCH THUẾ
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(15, 23, 42, 0.06)', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Building2 size={16} />
            </div>
          </div>
          <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
            {overview?.alerts.contract_alerts?.length || 0}{' '}
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>cảnh báo HĐ</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span>• Thiếu CCCD/STK: <strong style={{ color: 'var(--color-text)' }}>{overview?.alerts.missing_info_users?.length || 0}</strong></span>
            <span>• Hạn nộp thuế: <strong style={{ color: 'var(--color-text)' }}>{overview?.tax_schedule.due_quarterly || '—'}</strong></span>
          </div>
          <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--color-text-light)', fontWeight: 500 }}>
            Kỳ kê khai Quý {overview?.tax_schedule.quarter || 1} • Khoản 2 Điều 20 BLLĐ 2019
          </div>
        </div>
      </div>

      {/* SUBTAB 1: TỔNG QUAN & CHU TRÌNH KẾ TOÁN A-Z */}
      {activeSubtab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* ROW 1: BÁO CÁO KINH DOANH (P&L) & CẢNH BÁO BLLĐ 2019 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Card Left: Báo cáo Kết Quả Kinh Doanh & Dòng Tiền */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                    Hiệu Quả Kinh Doanh (P&amp;L) &amp; Dòng Tiền
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                    Tổng hợp từ Đặt cọc, Hóa đơn đã thu, Chi phí vận hành và Quỹ lương kỳ {selectedMonth}
                  </p>
                </div>
                <span style={{ background: '#eff6ff', color: '#1d4ed8', fontSize: '0.72rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>
                  TT200 / TT133
                </span>
              </div>

              {financialData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Metric Rows with Visual Progress Indicators */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>1. Doanh thu thuần (Cọc + Hóa đơn Paid):</span>
                      <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-text)' }}>
                        {FMT(financialData.pnl.revenue)} đ
                      </strong>
                    </div>
                    <div style={{ height: '6px', width: '100%', background: 'var(--color-border-light)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: '100%', background: '#3b82f6', borderRadius: '4px' }} />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>2. Chi phí nhân sự &amp; BHXH DN (23.5%):</span>
                      <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-primary, #BD1D2D)' }}>
                        {FMT(financialData.pnl.hrm_cost)} đ
                      </strong>
                    </div>
                    <div style={{ height: '6px', width: '100%', background: 'var(--color-border-light)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${financialData.pnl.revenue > 0 ? Math.min(100, Math.round((financialData.pnl.hrm_cost / financialData.pnl.revenue) * 100)) : 0}%`,
                          background: 'var(--color-primary, #BD1D2D)',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>3. Chi phí vận hành &amp; Marketing:</span>
                      <strong style={{ fontFamily: 'JetBrains Mono, monospace', color: '#d97706' }}>
                        {FMT(financialData.pnl.operating_expense + financialData.pnl.marketing_expense)} đ
                      </strong>
                    </div>
                    <div style={{ height: '6px', width: '100%', background: 'var(--color-border-light)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${financialData.pnl.revenue > 0 ? Math.min(100, Math.round(((financialData.pnl.operating_expense + financialData.pnl.marketing_expense) / financialData.pnl.revenue) * 100)) : 0}%`,
                          background: '#f59e0b',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                  </div>

                  {/* Profit Result Box */}
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: financialData.pnl.net_profit >= 0 ? '#f0fdf4' : '#fef2f2',
                      border: financialData.pnl.net_profit >= 0 ? '1px solid #bbf7d0' : '1px solid #fecaca',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: financialData.pnl.net_profit >= 0 ? '#166534' : '#991b1b', textTransform: 'uppercase' }}>
                        LỢI NHUẬN RÒNG SAU THUẾ (TNDN 20%)
                      </div>
                      <div style={{ fontSize: '0.73rem', color: financialData.pnl.net_profit >= 0 ? '#15803d' : '#dc2626' }}>
                        Tỷ suất biên lợi nhuận ròng: <strong>{financialData.pnl.net_margin_pct}%</strong>
                      </div>
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace', color: financialData.pnl.net_profit >= 0 ? '#15803d' : '#dc2626' }}>
                      {FMT(financialData.pnl.net_profit)} đ
                    </div>
                  </div>

                  {/* Cashflow Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingTop: '4px' }}>
                    <span>Dòng tiền vào: <strong>{FMT(financialData.cashflow.cash_in)} đ</strong></span>
                    <span>Dòng tiền ra: <strong>{FMT(financialData.cashflow.cash_out)} đ</strong></span>
                    <span>Net Cashflow: <strong style={{ color: financialData.cashflow.is_positive ? '#059669' : '#dc2626' }}>{FMT(financialData.cashflow.net_cashflow)} đ</strong></span>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  Đang tải số liệu tài chính...
                </div>
              )}
            </div>

            {/* Card Right: Cảnh báo Hợp đồng & Tuân thủ BLLĐ 2019 */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                    Cảnh Báo Hợp Đồng &amp; Tuân Thủ Pháp Lý
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                    Rà soát tự động theo Khoản 2 Điều 20 Bộ Luật Lao Động 2019
                  </p>
                </div>
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: '999px',
                    background: (overview?.alerts.contract_alerts.length || 0) > 0 ? '#fef2f2' : '#ecfdf5',
                    color: (overview?.alerts.contract_alerts.length || 0) > 0 ? '#dc2626' : '#059669',
                    border: (overview?.alerts.contract_alerts.length || 0) > 0 ? '1px solid #fecaca' : '1px solid #a7f3d0'
                  }}
                >
                  {overview?.alerts.contract_alerts.length || 0} cảnh báo
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
                {overview?.alerts.contract_alerts && overview.alerts.contract_alerts.length > 0 ? (
                  overview.alerts.contract_alerts.map((alert, idx) => (
                    <div 
                      key={idx}
                      style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: alert.severity === 'bad' ? '1px solid #fecaca' : alert.severity === 'warn' ? '1px solid #fed7aa' : '1px solid #bfdbfe',
                        background: alert.severity === 'bad' ? '#fff5f5' : alert.severity === 'warn' ? '#fffaf0' : '#eff6ff',
                        fontSize: '0.78rem',
                        lineHeight: '1.4'
                      }}
                    >
                      <div style={{ fontWeight: 700, color: alert.severity === 'bad' ? '#991b1b' : alert.severity === 'warn' ? '#9a3412' : '#1e40af' }}>
                        {alert.full_name} ({alert.contract_code})
                      </div>
                      <div style={{ color: 'var(--color-text)', marginTop: '2px' }}>
                        {alert.message}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{
                    padding: '24px 16px',
                    textAlign: 'center',
                    background: 'var(--color-border-light)',
                    borderRadius: '10px',
                    border: '1px dashed var(--color-border)',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.8rem'
                  }}>
                    <CheckCircle2 size={24} color="#10b981" style={{ margin: '0 auto 6px' }} />
                    Tất cả hợp đồng lao động đều còn hạn và tuân thủ đúng quy định BLLĐ 2019!
                  </div>
                )}

                {/* Missing Info Users */}
                {overview?.alerts.missing_info_users && overview.alerts.missing_info_users.length > 0 && (
                  <div style={{
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    fontSize: '0.78rem'
                  }}>
                    <span style={{ fontWeight: 700, color: '#92400e' }}>
                      Có {overview.alerts.missing_info_users.length} nhân viên còn thiếu thông tin định danh/ngân hàng:
                    </span>
                    <ul style={{ margin: '4px 0 0', paddingLeft: '18px', color: '#78350f' }}>
                      {overview.alerts.missing_info_users.slice(0, 4).map(u => (
                        <li key={u.id}>
                          <strong>{u.full_name}</strong> (thiếu: {u.miss_fields.join(', ')})
                        </li>
                      ))}
                      {overview.alerts.missing_info_users.length > 4 && (
                        <li>...và {overview.alerts.missing_info_users.length - 4} nhân sự khác</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ROW 2: SOP CHECKLIST ĐÓNG KỲ KẾ TOÁN - NHÂN SỰ HÀNG THÁNG (7 BƯỚC) */}
          <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                  Quy Trình SOP Đóng Kỳ Kế Toán &amp; Lương (7 Bước Chuẩn)
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                  Theo dõi tiến độ hoàn thành từ chốt công, lập phiếu lương, hạch toán đến nộp tờ khai thuế kỳ {selectedMonth}
                </p>
              </div>
              <span style={{ fontSize: '0.76rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Hạn chốt lương: <strong>Ngày 05 hàng tháng</strong>
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '10px' }}>
              {overview?.sop_checklist.map((step) => (
                <div
                  key={step.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: step.done ? '#f0fdf4' : 'var(--color-border-light)',
                    border: step.done ? '1px solid #bbf7d0' : '1px solid var(--color-border)',
                    fontSize: '0.79rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {step.done ? (
                      <CheckCircle2 size={16} color="#15803d" />
                    ) : (
                      <Clock size={16} style={{ color: 'var(--color-text-muted)' }} />
                    )}
                    <span style={{ fontWeight: step.done ? 600 : 500, color: step.done ? '#166534' : 'var(--color-text)' }}>
                      {step.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: step.done ? '#dcfce7' : 'var(--color-surface, #ffffff)',
                      color: step.done ? '#15803d' : 'var(--color-text-muted)',
                      border: step.done ? 'none' : '1px solid var(--color-border)'
                    }}
                  >
                    {step.done ? 'Hoàn tất' : 'Chưa chốt'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: BỘ TÍNH LƯƠNG GROSS ⇄ NET & BHXH */}
      {activeSubtab === 'calculator' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem' }}>
          {/* Cột Trái: Bảng Nhập Tham Số */}
          <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                Thông Số Tính Lương Gross ⇄ Net
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                Áp dụng quy chuẩn Luật Thuế TNCN &amp; Mức trần BHXH theo Nghị định 73/2024/NĐ-CP
              </p>
            </div>

            {/* Chuyển đổi Mode Gross -> Net vs Net -> Gross */}
            <div
              style={{
                display: 'inline-flex',
                padding: '3px',
                borderRadius: '10px',
                background: 'var(--color-border-light)',
                border: '1px solid var(--color-border)',
                gap: '2px'
              }}
            >
              <button
                type="button"
                onClick={() => setSimMode('gross_to_net')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  borderRadius: '7px',
                  border: 'none',
                  background: simMode === 'gross_to_net' ? 'var(--color-surface, #ffffff)' : 'transparent',
                  color: simMode === 'gross_to_net' ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text-muted)',
                  fontWeight: simMode === 'gross_to_net' ? 700 : 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: simMode === 'gross_to_net' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                Lương Gross ➔ Net
              </button>
              <button
                type="button"
                onClick={() => setSimMode('net_to_gross')}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  borderRadius: '7px',
                  border: 'none',
                  background: simMode === 'net_to_gross' ? 'var(--color-surface, #ffffff)' : 'transparent',
                  color: simMode === 'net_to_gross' ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text-muted)',
                  fontWeight: simMode === 'net_to_gross' ? 700 : 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  boxShadow: simMode === 'net_to_gross' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                Lương Net ➔ Gross
              </button>
            </div>

            {/* Mức Lương */}
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px' }}>
                {simMode === 'gross_to_net' ? 'Mức lương Gross (VNĐ):' : 'Mức lương Net mong muốn (VNĐ):'}
              </label>
              <input
                type="number"
                value={simSalary}
                onChange={e => setSimSalary(Number(e.target.value) || 0)}
                step="500000"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  fontSize: '1rem',
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  fontFamily: 'JetBrains Mono, monospace',
                  outline: 'none',
                  boxSizing: 'border-box',
                  background: 'var(--color-surface, #ffffff)'
                }}
              />
              <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                Bằng số: <strong style={{ color: 'var(--color-text)' }}>{FMT(simSalary)} VNĐ</strong>
              </div>
            </div>

            {/* Grid 2 Cột: Người phụ thuộc & Vùng */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Người phụ thuộc
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={simDependents}
                  onChange={e => setSimDependents(Math.max(0, parseInt(e.target.value) || 0))}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    outline: 'none',
                    boxSizing: 'border-box',
                    background: 'var(--color-surface, #ffffff)'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Vùng lương tối thiểu
                </label>
                <select
                  value={simRegion}
                  onChange={e => setSimRegion(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    outline: 'none',
                    background: 'var(--color-surface, #ffffff)',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value={1}>Vùng I (4.96M / 5.31M)</option>
                  <option value={2}>Vùng II (4.41M / 4.73M)</option>
                  <option value={3}>Vùng III (3.86M / 4.14M)</option>
                  <option value={4}>Vùng IV (3.45M / 3.68M)</option>
                </select>
              </div>
            </div>

            {/* Quy chuẩn Thuế theo năm & Loại hợp đồng */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Quy chuẩn Thuế TNCN
                </label>
                <select
                  value={simYear}
                  onChange={e => setSimYear(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    outline: 'none',
                    background: 'var(--color-surface, #ffffff)',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value={2025}>Hiện hành (11M + 4.4M, 7 bậc)</option>
                  <option value={2026}>Từ 2026 (15.5M + 6.2M, 5 bậc)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Loại hợp đồng &amp; Cư trú
                </label>
                <select
                  value={simContractType}
                  onChange={e => setSimContractType(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    outline: 'none',
                    background: 'var(--color-surface, #ffffff)',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="labour_resident">HĐLĐ cư trú (Lũy tiến từng phần)</option>
                  <option value="probation_casual">Thử việc / Vãng lai (Khấu trừ 10%)</option>
                  <option value="non_resident">Không cư trú (Khấu trừ 20%)</option>
                </select>
              </div>
            </div>

            {/* Phụ cấp miễn thuế */}
            <div style={{ borderTop: '1px solid var(--color-border-light)', paddingTop: '10px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>
                Phụ cấp hỗ trợ
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '6px' }}>
                <div>
                  <label style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>Phụ cấp ăn trưa (đ)</label>
                  <input
                    type="number"
                    value={simMeal}
                    onChange={e => setSimMeal(Number(e.target.value) || 0)}
                    step="50000"
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.78rem',
                      fontFamily: 'JetBrains Mono, monospace',
                      boxSizing: 'border-box',
                      background: 'var(--color-surface, #ffffff)'
                    }}
                  />
                  <span style={{ fontSize: '0.68rem', color: '#059669' }}>Miễn thuế tối đa 730k (1.2M từ 07/26)</span>
                </div>
                <div>
                  <label style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)' }}>Phụ cấp xăng xe &amp; ĐT (đ)</label>
                  <input
                    type="number"
                    value={simTravel + simPhone}
                    onChange={e => setSimTravel(Number(e.target.value) || 0)}
                    step="50000"
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.78rem',
                      fontFamily: 'JetBrains Mono, monospace',
                      boxSizing: 'border-box',
                      background: 'var(--color-surface, #ffffff)'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Checkboxes: Có đóng BHXH & Có đoàn viên */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={simHasInsurance}
                  onChange={e => setSimHasInsurance(e.target.checked)}
                />
                Tham gia BHXH bắt buộc
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={simHasUnion}
                  onChange={e => setSimHasUnion(e.target.checked)}
                />
                Đoàn viên công đoàn (1%)
              </label>
            </div>

            <button
              type="button"
              onClick={handleSimulate}
              disabled={simulating}
              className="btn primary"
              style={{
                height: '38px',
                padding: '0 16px',
                fontSize: '0.84rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              {simulating ? <RefreshCw size={15} className="animate-spin" /> : <Calculator size={15} />}
              <span>Tính toán chi tiết 3 chiều</span>
            </button>
          </div>

          {/* Cột Phải: Bóc Tách Chi Tiết 3 Chiều */}
          <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                Bóc Tách Chi Phí Lương, Bảo Hiểm &amp; Thuế TNCN
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                Kết quả tính toán chi tiết phía Người lao động và Tổng chi phí Doanh nghiệp
              </p>
            </div>

            {simResult ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 2 Thẻ So Sánh Gross vs Net */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ background: 'var(--color-border-light)', padding: '12px', borderRadius: '10px', border: '1px solid var(--color-border)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>LƯƠNG GROSS</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)', fontFamily: 'JetBrains Mono, monospace' }}>
                      {FMT(simResult.gross)} <small style={{ fontSize: '0.75rem' }}>đ</small>
                    </div>
                  </div>
                  <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '10px', border: '1px solid #bbf7d0' }}>
                    <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 700 }}>THỰC LĨNH NET</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#15803d', fontFamily: 'JetBrains Mono, monospace' }}>
                      {FMT(simResult.net)} <small style={{ fontSize: '0.75rem' }}>đ</small>
                    </div>
                  </div>
                </div>

                {/* Chi Tiết Khấu Trừ Phía Người Lao Động */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px', background: 'var(--color-surface, #ffffff)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px' }}>
                    1. Các khoản trừ vào lương NLĐ: {FMT((simResult.insurance_nld?.total || 0) + (simResult.tax?.pit || 0))} đ
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.78rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                      <span>- BHXH (8%):</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{FMT(simResult.insurance_nld?.bhxh)} đ</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                      <span>- BHYT (1.5%):</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{FMT(simResult.insurance_nld?.bhyt)} đ</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                      <span>- BHTN (1%):</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{FMT(simResult.insurance_nld?.bhtn)} đ</span>
                    </div>
                    {simResult.union_fee > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-text-muted)' }}>
                        <span>- Đoàn phí công đoàn (1%):</span>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{FMT(simResult.union_fee)} đ</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-primary, #BD1D2D)', fontWeight: 700, borderTop: '1px dashed var(--color-border)', paddingTop: '4px' }}>
                      <span>- Thuế TNCN ({simResult.tax?.method || 'Lũy tiến'}):</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{FMT(simResult.tax?.pit)} đ</span>
                    </div>
                  </div>
                </div>

                {/* Căn Cứ Tính Thuế TNCN */}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', padding: '12px', background: 'var(--color-border-light)' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '6px' }}>
                    2. Căn cứ tính thuế TNCN
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.76rem', color: 'var(--color-text-muted)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Thu nhập chịu thuế (TNCT):</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{FMT(simResult.tax?.tnct)} đ</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Giảm trừ gia cảnh (Bản thân + {simDependents} NPT):</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{FMT(simResult.tax?.total_reduction)} đ</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: 'var(--color-text)' }}>
                      <span>Thu nhập tính thuế (TNTT):</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{FMT(simResult.tax?.tntt)} đ</span>
                    </div>
                  </div>
                </div>

                {/* Chi Phí Thực Tế Phía Doanh Nghiệp */}
                <div style={{ border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px', background: '#eff6ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e40af' }}>
                      3. Tổng chi phí Doanh nghiệp phải trả:
                    </span>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#1e3a8a', fontFamily: 'JetBrains Mono, monospace' }}>
                      {FMT(simResult.employer_total_cost)} đ
                    </span>
                  </div>
                  <div style={{ fontSize: '0.73rem', color: '#3b82f6', marginTop: '4px' }}>
                    Gồm Gross {FMT(simResult.gross)} đ + Chi phí BHXH, BHYT, BHTN &amp; KPCĐ DN đóng 23.5% ({FMT(simResult.insurance_dn?.total)} đ)
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
                Đang nạp bộ tính lương...
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: SỔ NHẬT KÝ CHUNG & BÚT TOÁN KÉP (TT200/TT133) */}
      {activeSubtab === 'journal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                  Sổ Nhật Ký Chung Điện Tử (General Journal)
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                  Tự động hạch toán kép toàn bộ lương, BHXH 338, thuế 3335, doanh thu và chi phí kỳ {selectedMonth}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <CleanSearchBox
                  value={journalSearch}
                  onChange={setJournalSearch}
                  placeholder="Tìm số CT, diễn giải, TK..."
                  width={220}
                />

                <button
                  type="button"
                  onClick={handleExportJournalExcel}
                  className="btn outline sm"
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderColor: '#10b981',
                    color: '#059669',
                    background: '#ecfdf5',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={13} />
                  <span>Xuất Excel TT200</span>
                </button>
              </div>
            </div>

            {/* Balanced Nợ/Có Badge */}
            {journalSummary && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#065f46',
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                  <CheckCircle2 size={15} color="#059669" />
                  <span>Cân đối Nợ = Có: {FMT(journalSummary.total_debit)} đ</span>
                </div>
                <div style={{ fontSize: '0.74rem' }}>
                  Tổng cộng: <strong>{filteredJournalEntries.length}</strong> bút toán phát sinh {journalSummary.is_projected ? '(Tạm tính theo hồ sơ)' : '(Chính thức)'}
                </div>
              </div>
            )}

            {/* Bảng Bút Toán Định Khoản Nợ / Có */}
            <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-border-light)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', textAlign: 'left' }}>
                      <th style={{ padding: '9px 12px', fontWeight: 700, width: '40px' }}>#</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700 }}>Ngày ghi sổ</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700 }}>Số chứng từ</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700 }}>Diễn giải nghiệp vụ</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, textAlign: 'center' }}>TK Nợ</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, textAlign: 'center' }}>TK Có</th>
                      <th style={{ padding: '9px 12px', fontWeight: 700, textAlign: 'right' }}>Số tiền (VNĐ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJournalEntries.length > 0 ? (
                      filteredJournalEntries.map((e, idx) => (
                        <tr 
                          key={idx}
                          style={{
                            borderBottom: '1px solid var(--color-border-light)',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{idx + 1}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{e.date}</td>
                          <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text)' }}>{e.doc_no}</td>
                          <td style={{ padding: '8px 12px', color: 'var(--color-text)' }}>{e.desc}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{ background: '#eff6ff', color: '#1d4ed8', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                              {e.debit_acc}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <span style={{ background: '#fef2f2', color: '#b91c1c', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                              {e.credit_acc}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--color-text)', fontFamily: 'JetBrains Mono, monospace' }}>
                            {FMT(e.amount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--color-text-muted)' }}>
                          Chưa có bút toán hạch toán phù hợp với bộ lọc trong tháng {selectedMonth}.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {journalSummary && (
                    <tfoot>
                      <tr style={{ background: 'var(--color-border-light)', fontWeight: 700, borderTop: '2px solid var(--color-border)' }}>
                        <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--color-text)' }}>
                          TỔNG CỘNG ({filteredJournalEntries.length} BÚT TOÁN):
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#1d4ed8' }}>
                          Nợ: {FMT(journalSummary.total_debit)} đ
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#b91c1c' }}>
                          Có: {FMT(journalSummary.total_credit)} đ
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', color: '#059669', fontFamily: 'JetBrains Mono, monospace' }}>
                          Cân bằng 100%
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: TỜ KHAI THUẾ TNCN (XML HTKK) & BÁO CÁO P&L */}
      {activeSubtab === 'tax_reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                  Tờ Khai Khấu Trừ Thuế TNCN (Mẫu 05/KK-TNCN &amp; 05/QTT-TNCN)
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                  Ban hành kèm theo Thông tư 80/2021/TT-BTC — Xuất file XML nạp trực tiếp vào phần mềm HTKK Tổng Cục Thuế
                </p>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  value={taxType}
                  onChange={e => setTaxType(e.target.value as any)}
                  style={{
                    height: '32px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    outline: 'none',
                    background: 'var(--color-surface, #ffffff)'
                  }}
                >
                  <option value="Q">Theo Quý (05/KK)</option>
                  <option value="M">Theo Tháng (05/KK)</option>
                  <option value="Y">Quyết Toán Năm (05/QTT)</option>
                </select>

                {taxType !== 'Y' && (
                  <select
                    value={taxNum}
                    onChange={e => setTaxNum(Number(e.target.value))}
                    style={{
                      height: '32px',
                      padding: '0 10px',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      outline: 'none',
                      background: 'var(--color-surface, #ffffff)'
                    }}
                  >
                    {taxType === 'Q' ? (
                      [1, 2, 3, 4].map(q => <option key={q} value={q}>Quý {q}</option>)
                    ) : (
                      Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>)
                    )}
                  </select>
                )}

                <input
                  type="number"
                  value={taxYear}
                  onChange={e => setTaxYear(Number(e.target.value))}
                  style={{
                    width: '74px',
                    height: '32px',
                    padding: '0 8px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    textAlign: 'center',
                    outline: 'none',
                    background: 'var(--color-surface, #ffffff)'
                  }}
                />

                <button
                  type="button"
                  onClick={handleGenerateXml}
                  className="btn primary"
                  style={{
                    height: '32px',
                    padding: '0 14px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <FileText size={13} />
                  <span>Xuất XML HTKK</span>
                </button>
              </div>
            </div>

            {/* Bảng Chỉ Tiêu Tờ Khai Thuế Chuẩn Bộ Tài Chính */}
            <div className="responsive-table-wrap touch-scroll-x" style={{ border: '1px solid var(--color-border)', borderRadius: '10px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: 'var(--color-border-light)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', textAlign: 'left' }}>
                    <th style={{ padding: '8px 12px', width: '90px', fontWeight: 700 }}>Chỉ tiêu</th>
                    <th style={{ padding: '8px 12px', fontWeight: 700 }}>Nội dung chỉ tiêu kê khai thuế</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', width: '200px', fontWeight: 700 }}>Giá trị tổng hợp</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { id: 'ct16', name: 'Tổng số người lao động', isCount: true },
                    { id: 'ct17', name: 'Trong đó: Cá nhân cư trú có hợp đồng lao động', isCount: true },
                    { id: 'ct18', name: 'Tổng số cá nhân đã khấu trừ thuế [18] = [19] + [20]', isCount: true, bold: true },
                    { id: 'ct19', name: '  - Cá nhân cư trú', isCount: true },
                    { id: 'ct20', name: '  - Cá nhân không cư trú', isCount: true },
                    { id: 'ct21', name: 'Tổng thu nhập chịu thuế (TNCT) trả cho cá nhân [21] = [22] + [23]', bold: true },
                    { id: 'ct22', name: '  - Cá nhân cư trú' },
                    { id: 'ct23', name: '  - Cá nhân không cư trú' },
                    { id: 'ct26', name: 'Tổng TNCT trả cho cá nhân thuộc diện phải khấu trừ thuế [26] = [27] + [28]', bold: true },
                    { id: 'ct27', name: '  - Cá nhân cư trú' },
                    { id: 'ct28', name: '  - Cá nhân không cư trú' },
                    { id: 'ct29', name: 'Tổng số thuế TNCN đã khấu trừ [29] = [30] + [31]', bold: true, highlight: true },
                    { id: 'ct30', name: '  - Cá nhân cư trú' },
                    { id: 'ct31', name: '  - Cá nhân không cư trú' },
                  ].map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--color-border-light)', background: row.highlight ? '#fef2f2' : row.bold ? 'var(--color-border-light)' : 'transparent' }}>
                      <td style={{ padding: '7px 12px', fontWeight: 700, color: 'var(--color-text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                        [{row.id.replace('ct', '')}]
                      </td>
                      <td style={{ padding: '7px 12px', fontWeight: row.bold ? 700 : 400, color: row.highlight ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text)' }}>
                        {row.name}
                      </td>
                      <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: row.highlight ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text)' }}>
                        {row.isCount ? (taxIndicators[row.id] || 0) : `${FMT(taxIndicators[row.id])} đ`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: SỔ QUẢN LÝ LAO ĐỘNG (NĐ 145/2020) & CẨM NANG PHÁP LÝ */}
      {activeSubtab === 'labor_book' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Phân Hệ 1: Sổ Quản Lý Lao Động Nghị Định 145/2020/NĐ-CP */}
          <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                  Sổ Quản Lý Lao Động Điện Tử (Khoản 2 Điều 3 Nghị định 145/2020/NĐ-CP)
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                  Theo dõi danh sách trích ngang, trình độ, chức danh, loại HĐLĐ và biến động lao động năm {taxYear}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <CleanSearchBox
                  value={laborSearch}
                  onChange={setLaborSearch}
                  placeholder="Tìm theo họ tên, CCCD, chức vụ..."
                  width={240}
                />

                <button
                  type="button"
                  onClick={handleExportLaborBookExcel}
                  className="btn outline sm"
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderColor: '#10b981',
                    color: '#059669',
                    background: '#ecfdf5',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Download size={13} />
                  <span>Xuất Excel Sổ QLLĐ</span>
                </button>
              </div>
            </div>

            <div style={{ border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-border-light)', borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>STT</th>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Họ và tên</th>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Giới tính</th>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Ngày sinh</th>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Số CCCD</th>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Chức danh</th>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Loại HĐLĐ</th>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>Ngày bắt đầu</th>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'right' }}>Mức lương</th>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'center' }}>Phép đã nghỉ</th>
                      <th style={{ padding: '8px 10px', whiteSpace: 'nowrap', textAlign: 'center' }}>Giờ làm thêm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLaborRecords.length > 0 ? (
                      filteredLaborRecords.map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                          <td style={{ padding: '6px 10px', color: 'var(--color-text-muted)' }}>{r.stt}</td>
                          <td style={{ padding: '6px 10px', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{r.full_name}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--color-text-muted)' }}>{r.gender}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{r.dob}</td>
                          <td style={{ padding: '6px 10px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--color-text)' }}>{r.citizen_id || '—'}</td>
                          <td style={{ padding: '6px 10px', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>{r.job_title}</td>
                          <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                            <span style={{ background: 'var(--color-border-light)', padding: '2px 6px', borderRadius: '4px', fontSize: '0.73rem', fontWeight: 600 }}>
                              {r.contract_type}
                            </span>
                          </td>
                          <td style={{ padding: '6px 10px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{r.contract_start}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                            {FMT(r.salary)}
                          </td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>{r.annual_leave_used}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'center' }}>{r.total_ot_hours} giờ</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={11} style={{ textAlign: 'center', padding: '28px', color: 'var(--color-text-muted)' }}>
                          Chưa tìm thấy bản ghi sổ quản lý lao động nào.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Phân Hệ 2: Máy Tính Chế Độ Thai Sản & Trợ Cấp Thôi Việc */}
          <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                Máy Tính Chế Độ Thai Sản &amp; Trợ Cấp Thôi Việc / Mất Việc Làm
              </h3>
              <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                Tự động tính quyền lợi theo Điều 46, Điều 47 BLLĐ 2019 và Luật Bảo hiểm Xã hội
              </p>
            </div>

            {/* Mode Selector */}
            <div
              style={{
                display: 'inline-flex',
                padding: '3px',
                borderRadius: '10px',
                background: 'var(--color-border-light)',
                border: '1px solid var(--color-border)',
                gap: '2px',
                flexWrap: 'wrap'
              }}
            >
              {[
                { id: 'maternity', label: 'Chế độ Thai sản (Luật BHXH)' },
                { id: 'severance', label: 'Trợ cấp thôi việc (Điều 46 BLLĐ)' },
                { id: 'job_loss',  label: 'Trợ cấp mất việc làm (Điều 47 BLLĐ)' },
              ].map(b => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBenefitType(b.id as any)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '7px',
                    border: 'none',
                    background: benefitType === b.id ? 'var(--color-surface, #ffffff)' : 'transparent',
                    color: benefitType === b.id ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text-muted)',
                    fontWeight: benefitType === b.id ? 700 : 600,
                    fontSize: '0.78rem',
                    cursor: 'pointer',
                    boxShadow: benefitType === b.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  {b.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                  Lương bình quân 6 tháng liền kề đóng BHXH (đ)
                </label>
                <input
                  type="number"
                  value={benefitAvgSalary}
                  onChange={e => setBenefitAvgSalary(Number(e.target.value) || 0)}
                  step="500000"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    fontFamily: 'JetBrains Mono, monospace',
                    boxSizing: 'border-box',
                    background: 'var(--color-surface, #ffffff)',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                />
              </div>

              {benefitType !== 'maternity' && (
                <>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                      Tổng thời gian làm việc thực tế (năm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={benefitWorkYears}
                      onChange={e => setBenefitWorkYears(Number(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        boxSizing: 'border-box',
                        background: 'var(--color-surface, #ffffff)',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: '4px' }}>
                      Thời gian đã tham gia BHTN (năm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={benefitUnempYears}
                      onChange={e => setBenefitUnempYears(Number(e.target.value) || 0)}
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: '1px solid var(--color-border)',
                        boxSizing: 'border-box',
                        background: 'var(--color-surface, #ffffff)',
                        fontSize: '0.8rem',
                        fontWeight: 600
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button
                type="button"
                onClick={handleCalculateBenefit}
                className="btn primary"
                style={{
                  height: '34px',
                  padding: '0 16px',
                  fontSize: '0.8rem',
                  fontWeight: 700
                }}
              >
                Tính chế độ
              </button>
            </div>

            {benefitResult && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid var(--color-border)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '0.8rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>
                    TỔNG MỨC HƯỞNG CHẾ ĐỘ:
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-primary, #BD1D2D)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {FMT(benefitResult.total_benefit || benefitResult.total_allowance)} đ
                  </span>
                </div>
                {benefitResult.maternity_allowance && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Gồm trợ cấp thai sản 6 tháng: <strong>{FMT(benefitResult.maternity_allowance)} đ</strong> + Trợ cấp 1 lần (2 lần LCS): <strong>{FMT(benefitResult.one_time_allowance)} đ</strong>
                  </div>
                )}
                <div style={{ fontSize: '0.74rem', color: 'var(--color-text-muted)' }}>
                  Căn cứ pháp lý: {benefitResult.notes}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* XML PREVIEW MODAL */}
      {xmlModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15,23,42,0.6)',
          backdropFilter: 'blur(4px)',
          zIndex: 2147483647,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--color-surface, #ffffff)',
            borderRadius: '16px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--color-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text)' }}>
                Tệp XML Kê Khai Thuế HTKK ({xmlFilename})
              </h3>
              <button
                type="button"
                onClick={() => setXmlModalOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
              <pre style={{
                margin: 0,
                padding: '12px',
                background: '#0f172a',
                color: '#38bdf8',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontFamily: 'JetBrains Mono, monospace',
                whiteSpace: 'pre-wrap',
                maxHeight: '400px',
                overflowY: 'auto'
              }}>
                {generatedXml}
              </pre>
            </div>

            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--color-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                type="button"
                onClick={handleCopyXml}
                className="btn outline sm"
                style={{
                  height: '34px',
                  padding: '0 14px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Copy size={13} />
                <span>Sao chép XML</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadXml}
                className="btn primary"
                style={{
                  height: '34px',
                  padding: '0 16px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={13} />
                <span>Tải file XML</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HrmAccountingAzWorkspace;
