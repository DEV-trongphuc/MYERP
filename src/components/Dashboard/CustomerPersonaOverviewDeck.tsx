import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  LabelList
} from 'recharts';
import {
  Users,
  GraduationCap,
  Briefcase,
  Building2,
  Layers,
  RefreshCw,
  RotateCcw,
  Search,
  Award,
  CheckCircle2,
  UserCheck,
  PieChart,
  BarChart2,
  BarChart3,
  ExternalLink,
  SlidersHorizontal,
  X,
  Check,
  Landmark,
  HeartPulse,
  Cpu,
  HardHat,
  ShoppingBag,
  Factory,
  ShieldCheck,
  BookOpen,
  Calendar
} from 'lucide-react';
import api from '../../api/axios';
import { CustomSelect } from '../ui/CustomSelect';
import { Avatar } from '../ui/Avatar';
import {
  KpiCardSkeleton,
  TableSkeleton,
  ChartSkeleton,
  DonutAndRankedListSkeleton,
  DonutAndBarChartSkeleton,
  LeaderboardCardSkeleton,
  CompletenessGridSkeleton
} from '../ui/Skeleton';

interface BreakdownItem {
  label: string;
  key?: string;
  count: number;
  pct: number;
  variants_count?: number;
  variants?: string[];
}

interface OwnerBreakdownItem {
  owner_id: string;
  label: string;
  email: string;
  avatar: string;
  count: number;
  pct: number;
}

interface MultiCourseStudent {
  primary_id: number;
  full_name: string;
  phone: string;
  email: string;
  gender: string;
  job_title: string;
  company: string;
  owner_name?: string;
  owner_avatar?: string;
  course_count: number;
  school_count: number;
  schools: string[];
  courses: Array<{
    contact_id: number;
    student_id: string;
    school: string;
    intake: string;
    label: string;
  }>;
  contact_ids: number[];
}

interface CompletenessItem {
  field: string;
  label: string;
  filled: number;
  total: number;
  pct: number;
}

interface FilterOptionItem {
  value: string;
  label: string;
  name?: string;
  sublabel?: string;
  avatar?: string | null;
  count?: number;
}

interface PersonaOverviewResponse {
  segment: string;
  summary: {
    total_profiles: number;
    unique_persons: number;
    multi_course_persons: number;
    with_phone: number;
    with_email: number;
    with_gender: number;
    male_count: number;
    female_count: number;
    unknown_gender_count: number;
    avg_age: number;
    with_job_title: number;
    with_company: number;
    with_industry: number;
    with_intake: number;
    with_birthday?: number;
    distinct_companies: number;
    distinct_intakes: number;
    distinct_schools: number;
  };
  by_school_program: BreakdownItem[];
  by_intake: BreakdownItem[];
  by_owner?: OwnerBreakdownItem[];
  by_gender: BreakdownItem[];
  by_age_group: BreakdownItem[];
  by_job_group: BreakdownItem[];
  top_job_titles: BreakdownItem[];
  by_industry: BreakdownItem[];
  top_companies: BreakdownItem[];
  by_city: BreakdownItem[];
  multi_course_students: MultiCourseStudent[];
  data_completeness: CompletenessItem[];
  filter_options: {
    schools: FilterOptionItem[];
    intakes: FilterOptionItem[];
    owners?: FilterOptionItem[];
    job_groups?: FilterOptionItem[];
    industries?: FilterOptionItem[];
  };
}

interface CustomerPersonaOverviewDeckProps {
  defaultSegment?: 'student' | 'lead';
  externalDateFilter?: string;
  onOpenContact?: (contactId: number, fallbackContact?: Record<string, any>) => void;
}

const PALETTE = [
  '#C6333D',
  '#334155',
  '#E11D48',
  '#64748B',
  '#991B1B',
  '#475569',
  '#FB7185',
  '#94A3B8',
  '#1E293B',
  '#CBD5E1'
];

const getIndustryIcon = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes('tài chính') || l.includes('ngân hàng') || l.includes('chứng khoán') || l.includes('bảo hiểm')) {
    return Landmark;
  }
  if (l.includes('y tế') || l.includes('dược') || l.includes('bệnh viện')) {
    return HeartPulse;
  }
  if (l.includes('công nghệ') || l.includes('viễn thông') || l.includes('it')) {
    return Cpu;
  }
  if (l.includes('bất động sản') || l.includes('xây dựng') || l.includes('kiến trúc')) {
    return HardHat;
  }
  if (l.includes('giáo dục') || l.includes('đào tạo')) {
    return BookOpen;
  }
  if (l.includes('sản xuất') || l.includes('công nghiệp') || l.includes('năng lượng')) {
    return Factory;
  }
  if (l.includes('nhà nước') || l.includes('hành chính') || l.includes('công')) {
    return ShieldCheck;
  }
  if (l.includes('thương mại') || l.includes('dịch vụ') || l.includes('bán lẻ') || l.includes('fmcg')) {
    return ShoppingBag;
  }
  return Layers;
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
}> = ({ value, onChange, placeholder, width = 195 }) => (
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

const deckCache = new Map<string, { data: PersonaOverviewResponse; timestamp: number }>();
const SWR_TTL_MS = 45_000;

const buildPersonaCacheKey = (params: {
  seg: 'student' | 'lead';
  owner: string;
  school: string;
  intake: string;
  gender: string;
  jobGroup: string;
  industry: string;
  company?: string;
  multiCourse: boolean;
  dateFilter?: string;
}) =>
  `${params.seg}|${params.owner}|${params.school}|${params.intake}|${params.gender}|${params.jobGroup}|${params.industry}|${params.company || 'all'}|${params.multiCourse ? '1' : '0'}|${params.dateFilter || 'all'}`;

export const CustomerPersonaOverviewDeck: React.FC<CustomerPersonaOverviewDeckProps> = ({
  defaultSegment = 'student',
  externalDateFilter = '',
  onOpenContact
}) => {
  // Always default to 'student' (Học viên)
  const [segmentFilter, setSegmentFilter] = useState<'student' | 'lead'>(defaultSegment || 'student');
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  const [selectedSchool, setSelectedSchool] = useState<string>('all');
  const [selectedIntake, setSelectedIntake] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [selectedJobGroup, setSelectedJobGroup] = useState<string>('all');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [multiCourseOnly, setMultiCourseOnly] = useState<boolean>(false);

  const [showAdvancedDrawer, setShowAdvancedDrawer] = useState<boolean>(false);
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const initialCacheKey = buildPersonaCacheKey({
    seg: defaultSegment || 'student',
    owner: 'all',
    school: 'all',
    intake: 'all',
    gender: 'all',
    jobGroup: 'all',
    industry: 'all',
    company: 'all',
    multiCourse: false,
    dateFilter: externalDateFilter
  });
  const [data, setData] = useState<PersonaOverviewResponse | null>(
    () => deckCache.get(initialCacheKey)?.data ?? null
  );
  const [loading, setLoading] = useState<boolean>(() => !deckCache.has(initialCacheKey));
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const abortPersonaRef = useRef<AbortController | null>(null);

  const [companySearch, setCompanySearch] = useState<string>('');
  const [multiStudentSearch, setMultiStudentSearch] = useState<string>('');
  const [intakeSearch, setIntakeSearch] = useState<string>('');
  const [intakeViewMode, setIntakeViewMode] = useState<'chart' | 'grid'>('chart');
  const [ownerSearch, setOwnerSearch] = useState<string>('');
  const [multiPage, setMultiPage] = useState<number>(1);
  const [courseModalStudent, setCourseModalStudent] = useState<MultiCourseStudent | null>(null);
  const MULTI_PAGE_SIZE = 10;

  const fetchPersonaOverview = useCallback(
    async (
      params: {
        seg: 'student' | 'lead';
        owner: string;
        school: string;
        intake: string;
        gender: string;
        jobGroup: string;
        industry: string;
        company?: string;
        multiCourse: boolean;
        dateFilter?: string;
      },
      forceRefresh = false
    ) => {
      const cacheKey = buildPersonaCacheKey(params);
      const cached = deckCache.get(cacheKey);
      const now = Date.now();

      if (cached) {
        setData(cached.data);
        setLoading(false);
        setError(null);
        if (!forceRefresh && now - cached.timestamp < SWR_TTL_MS) {
          return;
        }
        setIsRefreshing(true);
      } else {
        setLoading(true);
        setError(null);
      }

      if (abortPersonaRef.current) {
        abortPersonaRef.current.abort();
      }
      const controller = new AbortController();
      abortPersonaRef.current = controller;

      try {
        const res = await api.get('/contacts/persona-overview', {
          params: {
            segment: params.seg,
            owner_id: params.owner !== 'all' ? params.owner : undefined,
            program: params.school !== 'all' ? params.school : undefined,
            intake: params.intake !== 'all' ? params.intake : undefined,
            gender: params.gender !== 'all' ? params.gender : undefined,
            job_group: params.jobGroup !== 'all' ? params.jobGroup : undefined,
            industry: params.industry !== 'all' ? params.industry : undefined,
            company: params.company && params.company !== 'all' ? params.company : undefined,
            multi_course: params.multiCourse ? '1' : undefined,
            date_filter: params.dateFilter ? params.dateFilter : undefined,
            refresh: forceRefresh ? '1' : undefined
          },
          signal: controller.signal
        });
        if (controller.signal.aborted) return;
        const payload = res.data?.data || res.data;
        deckCache.set(cacheKey, { data: payload, timestamp: Date.now() });
        setData(payload);
      } catch (err: any) {
        if (err?.name === 'CanceledError' || err?.name === 'AbortError' || controller.signal.aborted) return;
        if (!cached) {
          setError(err?.response?.data?.message || 'Không thể tải dữ liệu tổng quan chân dung khách hàng');
        }
      } finally {
        if (abortPersonaRef.current === controller) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    fetchPersonaOverview({
      seg: segmentFilter,
      owner: selectedOwner,
      school: selectedSchool,
      intake: selectedIntake,
      gender: selectedGender,
      jobGroup: selectedJobGroup,
      industry: selectedIndustry,
      company: selectedCompany,
      multiCourse: multiCourseOnly,
      dateFilter: externalDateFilter
    });
    return () => {
      if (abortPersonaRef.current) {
        abortPersonaRef.current.abort();
      }
    };
  }, [
    fetchPersonaOverview,
    segmentFilter,
    selectedOwner,
    selectedSchool,
    selectedIntake,
    selectedGender,
    selectedJobGroup,
    selectedIndustry,
    selectedCompany,
    multiCourseOnly,
    externalDateFilter
  ]);

  const handleResetAllFilters = () => {
    setSelectedOwner('all');
    setSelectedSchool('all');
    setSelectedIntake('all');
    setSelectedGender('all');
    setSelectedJobGroup('all');
    setSelectedIndustry('all');
    setSelectedCompany('all');
    setMultiCourseOnly(false);
    setMultiPage(1);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedOwner !== 'all') count++;
    if (selectedSchool !== 'all') count++;
    if (selectedIntake !== 'all') count++;
    if (selectedGender !== 'all') count++;
    if (selectedJobGroup !== 'all') count++;
    if (selectedIndustry !== 'all') count++;
    if (selectedCompany !== 'all') count++;
    if (multiCourseOnly) count++;
    return count;
  }, [
    selectedOwner,
    selectedSchool,
    selectedIntake,
    selectedGender,
    selectedJobGroup,
    selectedIndustry,
    selectedCompany,
    multiCourseOnly
  ]);

  const ownerOptions = useMemo(() => {
    const base = [
      {
        value: 'all',
        label: 'Tất cả Sale phụ trách',
        icon: <Users size={14} style={{ color: 'var(--color-primary, #BD1D2D)' }} />
      }
    ];
    if (Array.isArray(data?.filter_options?.owners)) {
      return [
        ...base,
        ...data!.filter_options.owners.map((o) => ({
          value: String(o.value),
          label: o.label,
          avatar: o.avatar || undefined,
          sublabel: o.sublabel || undefined
        }))
      ];
    }
    return base;
  }, [data?.filter_options?.owners]);

  const schoolOptions = useMemo(() => {
    const base = [{ value: 'all', label: 'Tất cả Trường / Chương trình' }];
    if (Array.isArray(data?.filter_options?.schools)) {
      return [...base, ...data!.filter_options.schools];
    }
    return base;
  }, [data?.filter_options?.schools]);

  const intakeOptions = useMemo(() => {
    const base = [{ value: 'all', label: 'Tất cả Khóa học (Intake)' }];
    if (Array.isArray(data?.filter_options?.intakes)) {
      return [...base, ...data!.filter_options.intakes];
    }
    return base;
  }, [data?.filter_options?.intakes]);

  const jobGroupOptions = useMemo(() => {
    const base = [{ value: 'all', label: 'Tất cả Nhóm chức vụ' }];
    if (Array.isArray(data?.filter_options?.job_groups)) {
      return [...base, ...data!.filter_options.job_groups];
    }
    return base;
  }, [data?.filter_options?.job_groups]);

  const industryOptions = useMemo(() => {
    const base = [{ value: 'all', label: 'Tất cả Ngành nghề / Lĩnh vực' }];
    if (Array.isArray(data?.filter_options?.industries)) {
      return [...base, ...data!.filter_options.industries];
    }
    return base;
  }, [data?.filter_options?.industries]);

  const selectedOwnerName = useMemo(() => {
    if (selectedOwner === 'all') return '';
    const found = (data?.filter_options?.owners || []).find((o) => String(o.value) === String(selectedOwner));
    return found?.name || found?.label || selectedOwner;
  }, [data?.filter_options?.owners, selectedOwner]);

  const filteredCompanies = useMemo(() => {
    const list = Array.isArray(data?.top_companies) ? data!.top_companies : [];
    if (!companySearch.trim()) return list;
    const q = companySearch.trim().toLowerCase();
    return list.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        (c.key && c.key.toLowerCase().includes(q)) ||
        (Array.isArray(c.variants) && c.variants.some((v) => v.toLowerCase().includes(q)))
    );
  }, [data?.top_companies, companySearch]);

  const filteredIntakes = useMemo(() => {
    const list = Array.isArray(data?.by_intake) ? data!.by_intake : [];
    if (!intakeSearch.trim()) return list;
    const q = intakeSearch.trim().toLowerCase();
    return list.filter((i) => i.label.toLowerCase().includes(q));
  }, [data?.by_intake, intakeSearch]);

  const chartIntakes = useMemo(() => {
    const list = Array.isArray(data?.by_intake) ? data!.by_intake : [];
    return list.filter((i) => i.label !== 'Chưa gắn Intake').slice(0, 12);
  }, [data?.by_intake]);

  const filteredOwners = useMemo(() => {
    const list = Array.isArray(data?.by_owner) ? data!.by_owner : [];
    if (!ownerSearch.trim()) return list;
    const q = ownerSearch.trim().toLowerCase();
    return list.filter(
      (o) => o.label.toLowerCase().includes(q) || (o.email || '').toLowerCase().includes(q)
    );
  }, [data?.by_owner, ownerSearch]);

  const filteredMultiStudents = useMemo(() => {
    const list = Array.isArray(data?.multi_course_students) ? data!.multi_course_students : [];
    if (!multiStudentSearch.trim()) return list;
    const q = multiStudentSearch.trim().toLowerCase();
    return list.filter(
      (s) =>
        s.full_name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        s.company.toLowerCase().includes(q) ||
        s.job_title.toLowerCase().includes(q) ||
        (s.owner_name || '').toLowerCase().includes(q) ||
        s.courses.some((c) => c.label.toLowerCase().includes(q))
    );
  }, [data?.multi_course_students, multiStudentSearch]);

  const paginatedMultiStudents = useMemo(() => {
    const start = (multiPage - 1) * MULTI_PAGE_SIZE;
    return filteredMultiStudents.slice(start, start + MULTI_PAGE_SIZE);
  }, [filteredMultiStudents, multiPage]);

  const totalMultiPages = Math.max(1, Math.ceil(filteredMultiStudents.length / MULTI_PAGE_SIZE));

  const summary = data?.summary || {
    total_profiles: 0,
    unique_persons: 0,
    multi_course_persons: 0,
    with_phone: 0,
    with_email: 0,
    with_gender: 0,
    male_count: 0,
    female_count: 0,
    unknown_gender_count: 0,
    avg_age: 0,
    with_job_title: 0,
    with_company: 0,
    with_industry: 0,
    with_intake: 0,
    with_birthday: 0,
    distinct_companies: 0,
    distinct_intakes: 0,
    distinct_schools: 0
  };

  const malePct = summary.total_profiles > 0 ? Math.round((summary.male_count / summary.total_profiles) * 1000) / 10 : 0;
  const femalePct = summary.total_profiles > 0 ? Math.round((summary.female_count / summary.total_profiles) * 1000) / 10 : 0;
  const unknownGenderPct = Math.max(0, Math.round((100 - malePct - femalePct) * 10) / 10);
  const intakeFilledPct =
    summary.total_profiles > 0 ? Math.round((summary.with_intake / summary.total_profiles) * 1000) / 10 : 0;

  // Gender Donut SVG geometry (50% left column)
  const genderDonutRadius = 64;
  const genderDonutCircumference = 2 * Math.PI * genderDonutRadius;
  const maleArc = (malePct / 100) * genderDonutCircumference;
  const femaleArc = (femalePct / 100) * genderDonutCircumference;

  // School Donut SVG geometry (50% right column of School Card)
  const schoolDonutRadius = 64;
  const schoolDonutCircumference = 2 * Math.PI * schoolDonutRadius;
  const schoolSegments = useMemo(() => {
    const list = Array.isArray(data?.by_school_program) ? data!.by_school_program : [];
    let accOffset = 0;
    return list.map((item, idx) => {
      const color = item.label === 'Chưa phân loại' ? '#94a3b8' : PALETTE[idx % PALETTE.length];
      const arc = (item.pct / 100) * schoolDonutCircumference;
      const seg = {
        ...item,
        color,
        arc,
        offset: -accOffset
      };
      accOffset += arc;
      return seg;
    });
  }, [data?.by_school_program, schoolDonutCircumference]);

  const topSchool = schoolSegments[0] || null;

  // Average completeness score across 8 fields
  const avgCompletenessPct = useMemo(() => {
    const list = Array.isArray(data?.data_completeness) ? data!.data_completeness : [];
    if (list.length === 0) return 0;
    const sum = list.reduce((acc, c) => acc + Number(c.pct || 0), 0);
    return Math.round((sum / list.length) * 10) / 10;
  }, [data?.data_completeness]);

  const handleOpenStudentProfile = (st: MultiCourseStudent, specificContactId?: number) => {
    const targetId = specificContactId || st.primary_id;
    if (!targetId || !onOpenContact) return;
    onOpenContact(targetId, {
      id: targetId,
      full_name: st.full_name,
      phone: st.phone,
      email: st.email,
      gender: st.gender,
      job_title: st.job_title,
      company: st.company,
      status: segmentFilter === 'student' ? 'customer' : 'lead'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
      {/* Top Filter & Segment Bar */}
      <div
        className="card"
        style={{
          padding: isMobile ? '0.55rem 0.7rem' : '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: isMobile ? 'nowrap' : 'wrap',
          gap: isMobile ? '0.45rem' : '0.75rem'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '0.4rem' : '0.625rem', flexWrap: isMobile ? 'nowrap' : 'wrap', minWidth: 0 }}>
          {/* Clean Segment Switcher: Học viên (Default) vs Tiềm năng */}
          <div
            style={{
              display: 'inline-flex',
              padding: '3px',
              borderRadius: '10px',
              background: 'var(--color-border-light)',
              border: '1px solid var(--color-border)',
              gap: '2px',
              flexShrink: 0
            }}
          >
            {[
              { id: 'student' as const, label: 'Học viên', shortLabel: 'Học viên', icon: GraduationCap },
              { id: 'lead' as const, label: 'Tiềm năng (Lead)', shortLabel: 'Tiềm năng', icon: Users }
            ].map((tab) => {
              const Icon = tab.icon;
              const isAct = segmentFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (segmentFilter !== tab.id) {
                      setSegmentFilter(tab.id);
                      handleResetAllFilters();
                    }
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: isMobile ? '4px' : '6px',
                    height: '32px',
                    padding: isMobile ? '0 9px' : '0 14px',
                    borderRadius: '7px',
                    border: 'none',
                    background: isAct ? 'var(--color-surface, #ffffff)' : 'transparent',
                    color: isAct ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text-muted)',
                    fontSize: isMobile ? '0.74rem' : '0.8rem',
                    fontWeight: isAct ? 700 : 600,
                    cursor: 'pointer',
                    boxShadow: isAct ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <Icon size={14} />
                  <span>{isMobile ? tab.shortLabel : tab.label}</span>
                </button>
              );
            })}
          </div>

          {!isMobile && (
            <>
              {/* Quick Sale / Consultant Filter with Avatar + Search */}
              <div style={{ minWidth: '225px' }}>
                <CustomSelect
                  options={ownerOptions}
                  value={selectedOwner}
                  onChange={(val) => {
                    setSelectedOwner(String(val));
                    setMultiPage(1);
                  }}
                  searchable
                  showAvatars
                  hideSelectedSublabel
                  placeholder="Sale phụ trách..."
                  size="sm"
                  width="100%"
                />
              </div>

              {/* Quick School / Program Filter */}
              <div style={{ minWidth: '210px' }}>
                <CustomSelect
                  options={schoolOptions}
                  value={selectedSchool}
                  onChange={(val) => {
                    setSelectedSchool(String(val));
                    setMultiPage(1);
                  }}
                  searchable
                  size="sm"
                  width="100%"
                />
              </div>

              {/* Quick Intake Filter */}
              <div style={{ minWidth: '185px' }}>
                <CustomSelect
                  options={intakeOptions}
                  value={selectedIntake}
                  onChange={(val) => {
                    setSelectedIntake(String(val));
                    setMultiPage(1);
                  }}
                  searchable
                  size="sm"
                  width="100%"
                />
              </div>
            </>
          )}
        </div>

        {/* Right: Advanced Filter Drawer Trigger + Reset + Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', flexWrap: 'nowrap', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setShowAdvancedDrawer(true)}
            style={{
              height: isMobile ? '34px' : '36px',
              padding: isMobile ? '0 10px' : '0 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              borderRadius: '8px',
              border:
                activeFilterCount > 0
                  ? '1.5px solid var(--color-primary, #BD1D2D)'
                  : '1px solid var(--color-border)',
              background: 'var(--color-surface, #ffffff)',
              color: activeFilterCount > 0 ? 'var(--color-primary, #BD1D2D)' : 'var(--color-text)',
              fontSize: isMobile ? '0.75rem' : '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap'
            }}
            title="Mở bảng Bộ lọc nâng cao"
          >
            <SlidersHorizontal size={14} />
            <span>{isMobile ? 'Bộ lọc' : 'Bộ lọc nâng cao'}</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  background: 'var(--color-primary, #BD1D2D)',
                  color: '#ffffff',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  borderRadius: '999px',
                  minWidth: '18px',
                  height: '18px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 5px'
                }}
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          {!isMobile && activeFilterCount > 0 && (
            <button
              type="button"
              className="btn outline sm"
              onClick={handleResetAllFilters}
              style={{ height: '36px', padding: '0 10px', fontSize: '0.76rem', fontWeight: 600 }}
            >
              <RotateCcw size={13} />
              <span>Đặt lại</span>
            </button>
          )}

          <button
            type="button"
            className="btn outline sm"
            onClick={() =>
              fetchPersonaOverview(
                {
                  seg: segmentFilter,
                  owner: selectedOwner,
                  school: selectedSchool,
                  intake: selectedIntake,
                  gender: selectedGender,
                  jobGroup: selectedJobGroup,
                  industry: selectedIndustry,
                  company: selectedCompany,
                  multiCourse: multiCourseOnly,
                  dateFilter: externalDateFilter
                },
                true
              )
            }
            style={{
              height: isMobile ? '34px' : '36px',
              width: isMobile ? '34px' : '36px',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
            title="Làm mới dữ liệu"
          >
            <RefreshCw size={14} className={loading || isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* SKELETON LOADING WHEN SWITCHING BETWEEN HỌC VIÊN / TIỀM NĂNG OR FILTERING */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            <DonutAndRankedListSkeleton />
            <DonutAndBarChartSkeleton />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            <LeaderboardCardSkeleton rows={5} />
            <ChartSkeleton height={240} />
          </div>
          <CompletenessGridSkeleton items={8} />
          <TableSkeleton rows={6} cols={6} />
        </div>
      ) : error && !data ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontWeight: 700, color: 'var(--color-danger)', marginBottom: '0.5rem' }}>{error}</div>
          <button
            type="button"
            className="btn outline sm"
            onClick={() =>
              fetchPersonaOverview({
                seg: segmentFilter,
                owner: selectedOwner,
                school: selectedSchool,
                intake: selectedIntake,
                gender: selectedGender,
                jobGroup: selectedJobGroup,
                industry: selectedIndustry,
                multiCourse: multiCourseOnly,
                dateFilter: externalDateFilter
              })
            }
          >
            Thử lại
          </button>
        </div>
      ) : (
        <>
          {/* Active Filter Chips Bar */}
          {activeFilterCount > 0 && (
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
              <span style={{ color: 'var(--color-text-muted)', fontWeight: 600, marginRight: '4px' }}>Đang lọc:</span>

              {selectedOwner !== 'all' && (
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
                  <span>Sale: {selectedOwnerName}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedOwner('all')}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {selectedSchool !== 'all' && (
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
                  <span>Trường: {selectedSchool}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSchool('all')}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {selectedIntake !== 'all' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    borderRadius: '8px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    color: '#059669',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  <span>Khóa: {selectedIntake}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedIntake('all')}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {selectedGender !== 'all' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    borderRadius: '8px',
                    background: 'rgba(139, 92, 246, 0.08)',
                    color: '#6d28d9',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  <span>Giới tính: {selectedGender}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedGender('all')}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {selectedJobGroup !== 'all' && (
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
                  <span>Chức vụ: {selectedJobGroup}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedJobGroup('all')}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {selectedIndustry !== 'all' && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    borderRadius: '8px',
                    background: 'rgba(6, 182, 212, 0.1)',
                    color: '#0e7490',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  <span>Ngành nghề: {selectedIndustry}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedIndustry('all')}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {selectedCompany !== 'all' && (
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
                  <span>Đơn vị: {selectedCompany}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedCompany('all')}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              {multiCourseOnly && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    borderRadius: '8px',
                    background: 'rgba(37, 99, 235, 0.1)',
                    color: '#2563eb',
                    fontSize: '0.75rem',
                    fontWeight: 600
                  }}
                >
                  <span>Học nhiều khóa (≥ 2)</span>
                  <button
                    type="button"
                    onClick={() => setMultiCourseOnly(false)}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: 'inherit', display: 'flex' }}
                  >
                    <X size={12} />
                  </button>
                </span>
              )}

              <button
                type="button"
                onClick={handleResetAllFilters}
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
                <span>Xóa tất cả</span>
              </button>
            </div>
          )}

          {/* 4 App-Standard KPI Cards — Basic Brand Red & Executive Slate */}
          <div className="dashboard-kpi-grid" style={{ marginBottom: 0 }}>
            {/* KPI 1: TỔNG HỒ SƠ & HỌC VIÊN */}
            <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                  {segmentFilter === 'student' ? 'TỔNG HỒ SƠ HỌC VIÊN' : 'TỔNG HỒ SƠ TIỀM NĂNG'}
                </span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: 'var(--color-primary, #BD1D2D)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                {summary.total_profiles.toLocaleString('vi-VN')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span>• Cá nhân: <strong style={{ color: 'var(--color-text)' }}>{summary.unique_persons.toLocaleString('vi-VN')}</strong></span>
                <span>• Có SĐT: <strong style={{ color: 'var(--color-text)' }}>{summary.with_phone.toLocaleString('vi-VN')}</strong></span>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--color-text-light)', fontWeight: 500 }}>
                Có Email: {summary.with_email.toLocaleString('vi-VN')} ({summary.total_profiles > 0 ? Math.round((summary.with_email / summary.total_profiles) * 100) : 0}%) • TB {summary.avg_age > 0 ? `${summary.avg_age} tuổi` : '—'}
              </div>
            </div>

            {/* KPI 2: HỌC VIÊN HỌC NHIỀU KHÓA / ĐA CHƯƠNG TRÌNH */}
            <div
              className="stat-card"
              style={{ minHeight: '132px', display: 'flex', flexDirection: 'column', cursor: 'pointer' }}
              onClick={() => {
                const el = document.getElementById('multi-course-students-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                  HỌC NHIỀU KHÓA / ĐA TRƯỜNG
                </span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: 'var(--color-primary, #BD1D2D)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-primary, #BD1D2D)' }}>
                {summary.multi_course_persons.toLocaleString('vi-VN')}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px', fontWeight: 500 }}>
                Học viên đăng ký từ <strong>≥ 2 khóa / chương trình</strong>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--color-primary, #BD1D2D)', fontWeight: 600 }}>
                Bấm để xem danh sách 360° chi tiết →
              </div>
            </div>

            {/* KPI 3: KHÓA ĐÀO TẠO & CHƯƠNG TRÌNH (INTAKE) */}
            <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                  KHÓA ĐÀO TẠO &amp; CHƯƠNG TRÌNH
                </span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(15, 23, 42, 0.06)', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                {summary.distinct_intakes.toLocaleString('vi-VN')}{' '}
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>khóa (Intake)</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span>• Đã gắn Intake: <strong style={{ color: 'var(--color-text)' }}>{summary.with_intake.toLocaleString('vi-VN')} ({intakeFilledPct}%)</strong></span>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Phân bổ trên <strong style={{ color: 'var(--color-text)' }}>{summary.distinct_schools}</strong> Trường / Chương trình đào tạo
              </div>
            </div>

            {/* KPI 4: CHỨC VỤ, CÔNG TY & NGÀNH NGHỀ */}
            <div className="stat-card" style={{ minHeight: '132px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                  CÔNG TY, CHỨC VỤ &amp; NGÀNH
                </span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(15, 23, 42, 0.06)', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Building2 size={16} />
                </div>
              </div>
              <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text, #0f172a)' }}>
                {summary.distinct_companies.toLocaleString('vi-VN')}{' '}
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>công ty</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '6px', fontWeight: 500, display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <span>• Có Công ty: <strong style={{ color: 'var(--color-text)' }}>{summary.with_company.toLocaleString('vi-VN')}</strong></span>
                <span>• Có Chức vụ: <strong style={{ color: 'var(--color-text)' }}>{summary.with_job_title.toLocaleString('vi-VN')}</strong></span>
              </div>
              <div style={{ marginTop: 'auto', paddingTop: '8px', fontSize: '0.73rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                Đã phân nhóm Ngành nghề: <strong style={{ color: 'var(--color-text)' }}>{summary.with_industry.toLocaleString('vi-VN')}</strong> hồ sơ
              </div>
            </div>
          </div>

          {/* ROW 1: TRƯỜNG / CHƯƠNG TRÌNH ĐÀO TẠO & CƠ CẤU GIỚI TÍNH + ĐỘ TUỔI (Basic Brand Style) */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left: Thống Kê Theo Trường / Chương Trình */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                    Thống Kê Theo Trường / Chương Trình
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                    Bấm vào từng trường để lọc nhanh toàn bộ báo cáo
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: 'var(--color-bg-alt, #f8fafc)',
                    border: '1px solid var(--color-border-light, #e2e8f0)',
                    color: 'var(--color-text, #0f172a)',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}
                >
                  {data?.by_school_program?.length || 0} trường
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '1.15fr 0.85fr',
                  gap: '1.2rem',
                  alignItems: 'center'
                }}
              >
                {/* Left: Clean Basic Brand Ranked List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                  {(data?.by_school_program || []).map((item, idx) => {
                    const color = item.label === 'Chưa phân loại' ? '#94a3b8' : PALETTE[idx % PALETTE.length];
                    const isSelected = selectedSchool === item.label;
                    return (
                      <div
                        key={item.label}
                        onClick={() => {
                          setSelectedSchool(isSelected ? 'all' : item.label);
                          setMultiPage(1);
                        }}
                        style={{
                          cursor: 'pointer',
                          padding: '6px 8px',
                          borderRadius: '8px',
                          background: isSelected ? '#f8fafc' : 'transparent',
                          border: isSelected ? '1.5px solid #0f172a' : '1px solid transparent',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span style={{ fontSize: '0.73rem', fontWeight: 700, color: idx === 0 ? '#BD1D2D' : 'var(--color-text-muted)', width: 20 }}>
                              #{idx + 1}
                            </span>
                            <span style={{ width: 8, height: 8, borderRadius: '2px', background: color, flexShrink: 0 }} />
                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: isSelected || idx === 0 ? 700 : 600,
                                color: isSelected ? '#BD1D2D' : 'var(--color-text, #0f172a)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {item.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', fontVariantNumeric: 'tabular-nums' }}>
                              {item.count.toLocaleString('vi-VN')}
                            </span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                              ({item.pct}%)
                            </span>
                          </div>
                        </div>
                        <div style={{ marginLeft: 28, height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.max(3, item.pct)}%`,
                              height: '100%',
                              background: idx === 0 ? '#C6333D' : color,
                              borderRadius: 4,
                              transition: 'width 0.35s ease'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right: Brand & Slate Donut Chart */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.5rem',
                    borderLeft: isMobile ? 'none' : '1px solid var(--color-border-light)'
                  }}
                >
                  <div style={{ position: 'relative', width: 162, height: 162 }}>
                    <svg width="162" height="162" viewBox="0 0 164 164" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="82" cy="82" r={schoolDonutRadius} fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
                      {schoolSegments.map((seg) => (
                        <circle
                          key={seg.label}
                          cx="82"
                          cy="82"
                          r={schoolDonutRadius}
                          fill="transparent"
                          stroke={seg.color}
                          strokeWidth="18"
                          strokeDasharray={`${seg.arc} ${schoolDonutCircumference}`}
                          strokeDashoffset={seg.offset}
                          style={{ cursor: 'pointer', transition: 'all 0.25s ease' }}
                          onClick={() => {
                            setSelectedSchool(selectedSchool === seg.label ? 'all' : seg.label);
                            setMultiPage(1);
                          }}
                        />
                      ))}
                    </svg>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        padding: '0 18px',
                        pointerEvents: 'none'
                      }}
                    >
                      <span style={{ fontSize: '1.22rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', lineHeight: 1.1 }}>
                        {topSchool ? `${topSchool.pct}%` : '0%'}
                      </span>
                      <span
                        style={{
                          fontSize: '0.69rem',
                          color: 'var(--color-text-muted)',
                          fontWeight: 600,
                          marginTop: '3px',
                          maxWidth: '100px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {topSchool ? topSchool.label : 'Trường đào tạo'}
                      </span>
                    </div>
                  </div>

                  {/* Mini Legend Pills below Donut */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 10px', marginTop: '10px' }}>
                    {schoolSegments.slice(0, 4).map((seg) => (
                      <span
                        key={seg.label}
                        onClick={() => {
                          setSelectedSchool(selectedSchool === seg.label ? 'all' : seg.label);
                          setMultiPage(1);
                        }}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.7rem',
                          fontWeight: 600,
                          color: 'var(--color-text-muted)',
                          cursor: 'pointer'
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '2px', background: seg.color }} />
                        <span>{seg.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Cơ Cấu Giới Tính & Độ Tuổi — 50% Brand Donut + 50% Vertical Column BarChart (Like Reference Image 4!) */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                    Cơ Cấu Giới Tính &amp; Độ Tuổi
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                    Tỷ lệ giới tính &amp; biểu đồ phân bố nhóm tuổi học viên
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#0f172a',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}
                >
                  TB: {summary.avg_age > 0 ? `${summary.avg_age} tuổi` : '—'}
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : '0.88fr 1.12fr',
                  gap: '1.1rem',
                  alignItems: 'center',
                  flex: 1
                }}
              >
                {/* Left: Clean Brand & Slate Gender Donut */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingRight: isMobile ? 0 : '0.5rem',
                    borderRight: isMobile ? 'none' : '1px solid var(--color-border-light)'
                  }}
                >
                  <div style={{ position: 'relative', width: 154, height: 154 }}>
                    <svg width="154" height="154" viewBox="0 0 168 168" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="84" cy="84" r={genderDonutRadius} fill="transparent" stroke="#f1f5f9" strokeWidth="18" />
                      {maleArc > 0 && (
                        <circle
                          cx="84"
                          cy="84"
                          r={genderDonutRadius}
                          fill="transparent"
                          stroke="#C6333D"
                          strokeWidth="18"
                          strokeDasharray={`${maleArc} ${genderDonutCircumference}`}
                          strokeDashoffset={0}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedGender(selectedGender === 'Nam' ? 'all' : 'Nam')}
                        />
                      )}
                      {femaleArc > 0 && (
                        <circle
                          cx="84"
                          cy="84"
                          r={genderDonutRadius}
                          fill="transparent"
                          stroke="#334155"
                          strokeWidth="18"
                          strokeDasharray={`${femaleArc} ${genderDonutCircumference}`}
                          strokeDashoffset={-maleArc}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedGender(selectedGender === 'Nữ' ? 'all' : 'Nữ')}
                        />
                      )}
                    </svg>
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        pointerEvents: 'none'
                      }}
                    >
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', lineHeight: 1.1 }}>
                        {summary.with_gender.toLocaleString('vi-VN')}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 600, marginTop: '2px' }}>
                        Có giới tính
                      </span>
                    </div>
                  </div>

                  {/* Clean Minimal Gender Legend */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%', maxWidth: '210px', marginTop: '10px' }}>
                    <div
                      onClick={() => setSelectedGender(selectedGender === 'Nam' ? 'all' : 'Nam')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: selectedGender === 'Nam' ? '#f8fafc' : '#ffffff',
                        border: selectedGender === 'Nam' ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '2px', background: '#C6333D' }} />
                        Nam
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--color-text, #0f172a)', fontVariantNumeric: 'tabular-nums' }}>
                        {summary.male_count.toLocaleString('vi-VN')} <span style={{ color: '#64748b', fontWeight: 500 }}>({malePct}%)</span>
                      </span>
                    </div>

                    <div
                      onClick={() => setSelectedGender(selectedGender === 'Nữ' ? 'all' : 'Nữ')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: selectedGender === 'Nữ' ? '#f8fafc' : '#ffffff',
                        border: selectedGender === 'Nữ' ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '2px', background: '#334155' }} />
                        Nữ
                      </span>
                      <span style={{ fontWeight: 700, color: 'var(--color-text, #0f172a)', fontVariantNumeric: 'tabular-nums' }}>
                        {summary.female_count.toLocaleString('vi-VN')} <span style={{ color: '#64748b', fontWeight: 500 }}>({femalePct}%)</span>
                      </span>
                    </div>

                    {summary.unknown_gender_count > 0 && (
                      <div
                        onClick={() => setSelectedGender(selectedGender === 'Chưa rõ' ? 'all' : 'Chưa rõ')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '3px 10px',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.72rem',
                          color: 'var(--color-text-muted)'
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '2px', background: '#cbd5e1' }} />
                          Chưa rõ
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {summary.unknown_gender_count.toLocaleString('vi-VN')} ({unknownGenderPct}%)
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Vertical Rounded Column BarChart for Age Groups (Exact Reference UI Style!) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', height: '100%', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text, #0f172a)' }}>
                      Phân nhóm Độ tuổi
                    </span>
                    <span style={{ fontSize: '0.71rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                      {(summary.with_birthday || 0).toLocaleString('vi-VN')} có NS
                    </span>
                  </div>

                  <div style={{ width: '100%', height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(data?.by_age_group || []).map((ag) => ({
                          name: ag.label
                            .replace('Dưới 25 tuổi', '<25')
                            .replace('Trên 55 tuổi', '55+')
                            .replace('Chưa có ngày sinh', 'Chưa rõ')
                            .replace(/\s*tuổi$/i, ''),
                          fullLabel: ag.label,
                          count: ag.count,
                          pct: ag.pct
                        }))}
                        margin={{ top: 22, right: 6, left: -24, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 10.5, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(189, 29, 45, 0.05)' }}
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.76rem',
                            boxShadow: '0 4px 12px rgba(15,23,42,0.08)'
                          }}
                          formatter={(val: any, _name: any, props: any) => [
                            `${Number(val).toLocaleString('vi-VN')} HV (${props?.payload?.pct || 0}%)`,
                            props?.payload?.fullLabel || 'Độ tuổi'
                          ]}
                        />
                        <Bar dataKey="count" barSize={24} radius={[6, 6, 2, 2]}>
                          <LabelList
                            dataKey="count"
                            position="top"
                            style={{ fontSize: '10.5px', fontWeight: 800, fill: '#0f172a' }}
                          />
                          {(data?.by_age_group || []).map((entry) => (
                            <Cell
                              key={entry.label}
                              fill={entry.label === 'Chưa có ngày sinh' ? '#94a3b8' : '#C6333D'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ROW 2: TOP TƯ VẤN VIÊN & BIỂU ĐỒ CỘT KHÓA HỌC INTAKE (Reference Image 4 Style!) */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left: Top Tư Vấn Viên / Sale Phụ Trách */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                    Top Tư Vấn Viên / Sale Phụ Trách
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                    Bấm vào Tư vấn viên để lọc toàn bộ chân dung học viên của Sale đó
                  </p>
                </div>
                <CleanSearchBox
                  value={ownerSearch}
                  onChange={setOwnerSearch}
                  placeholder="Tìm tên Sale..."
                  width={175}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                {filteredOwners.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    Không tìm thấy Tư vấn viên phù hợp
                  </div>
                ) : (
                  (() => {
                    const maxOwnerCount = Math.max(1, ...filteredOwners.map((o) => o.count));
                    return filteredOwners.map((ow, i) => {
                      const isSelected = String(selectedOwner) === String(ow.owner_id);
                      const barPct = Math.max(3, Math.round((ow.count / maxOwnerCount) * 100));
                      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : null;
                      const barColor =
                        ow.owner_id === 'unassigned'
                          ? '#94a3b8'
                          : isSelected || i < 3
                          ? '#C6333D'
                          : '#475569';

                      return (
                        <div
                          key={ow.owner_id}
                          onClick={() => {
                            setSelectedOwner(isSelected ? 'all' : String(ow.owner_id));
                            setMultiPage(1);
                          }}
                          style={{
                            cursor: 'pointer',
                            padding: '9px 10px',
                            borderRadius: '8px',
                            border: isSelected ? '1.5px solid #0f172a' : '1px solid #f1f5f9',
                            background: isSelected ? '#f8fafc' : 'transparent',
                            transition: 'all 0.15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '10px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                            <span
                              style={{
                                fontSize: medal ? '1rem' : '0.74rem',
                                fontWeight: 700,
                                color: 'var(--color-text-muted)',
                                width: 24,
                                textAlign: 'center',
                                flexShrink: 0
                              }}
                            >
                              {medal || `#${i + 1}`}
                            </span>
                            <Avatar src={ow.avatar || undefined} name={ow.label} size={30} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  fontSize: '0.82rem',
                                  fontWeight: isSelected || i < 3 ? 700 : 600,
                                  color: isSelected ? '#BD1D2D' : 'var(--color-text, #0f172a)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {ow.label}
                              </div>
                              <div style={{ height: 5, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden', marginTop: 5, maxWidth: '210px' }}>
                                <div
                                  style={{
                                    width: `${barPct}%`,
                                    height: '100%',
                                    background: barColor,
                                    borderRadius: 4,
                                    transition: 'width 0.35s ease'
                                  }}
                                />
                              </div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', fontVariantNumeric: 'tabular-nums' }}>
                              {ow.count.toLocaleString('vi-VN')}
                            </span>
                            <span
                              style={{
                                fontSize: '0.71rem',
                                fontWeight: 700,
                                color: isSelected ? '#BD1D2D' : '#475569',
                                background: isSelected ? 'rgba(189, 29, 45, 0.1)' : '#f1f5f9',
                                padding: '2px 7px',
                                borderRadius: '999px',
                                minWidth: '46px',
                                textAlign: 'center',
                                fontVariantNumeric: 'tabular-nums'
                              }}
                            >
                              {ow.pct}%
                            </span>
                          </div>
                        </div>
                      );
                    });
                  })()
                )}
              </div>
            </div>

            {/* Right: Thống Kê Theo Khóa Học (Intake) — Exact Reference Image 4 BarChart + Segmented Switcher */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                    Thống Kê Theo Khóa Học (Intake)
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                    Biểu đồ lưu lượng học viên theo khóa (kèm tiền tố Trường)
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {/* Segmented Switcher modeled after Reference Image 4 ("Theo ngày | Theo giờ | Heatmap") */}
                  <div
                    style={{
                      display: 'inline-flex',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '9px',
                      padding: '3px',
                      gap: '2px'
                    }}
                  >
                    {[
                      { id: 'chart' as const, label: 'Biểu đồ cột' },
                      { id: 'grid' as const, label: `Tất cả (${summary.distinct_intakes})` }
                    ].map((tab) => {
                      const active = !intakeSearch && intakeViewMode === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setIntakeSearch('');
                            setIntakeViewMode(tab.id);
                          }}
                          style={{
                            border: 'none',
                            background: active ? '#ffffff' : 'transparent',
                            color: active ? '#BD1D2D' : '#64748b',
                            fontWeight: active ? 700 : 600,
                            fontSize: '0.74rem',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            boxShadow: active ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <CleanSearchBox
                    value={intakeSearch}
                    onChange={(val) => {
                      setIntakeSearch(val);
                      if (val) setIntakeViewMode('grid');
                    }}
                    placeholder="Tìm Intake..."
                    width={145}
                  />
                </div>
              </div>

              {/* Mode 1: Clean Brand Red Column Chart with Top Value Labels (Reference Image 4!) */}
              {!intakeSearch && intakeViewMode === 'chart' && chartIntakes.length > 0 ? (
                <>
                  <div style={{ width: '100%', height: 225, marginTop: '4px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartIntakes.map((it) => ({
                          name: it.label
                            .replace(/^([A-Za-z0-9-]+)\s*-\s*Intake\s+/i, '$1 K.')
                            .replace(/^Intake\s+/i, 'K.'),
                          fullLabel: it.label,
                          count: it.count,
                          pct: it.pct
                        }))}
                        margin={{ top: 22, right: 8, left: -22, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: '#475569', fontWeight: 600 }}
                          axisLine={{ stroke: '#e2e8f0' }}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis
                          tick={{ fontSize: 10.5, fill: '#64748b' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          cursor={{ fill: 'rgba(189, 29, 45, 0.05)' }}
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            fontSize: '0.76rem',
                            boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)'
                          }}
                          formatter={(val: any, _name: any, props: any) => [
                            `${Number(val).toLocaleString('vi-VN')} HV (${props?.payload?.pct || 0}%)`,
                            props?.payload?.fullLabel || 'Khóa'
                          ]}
                        />
                        <Bar
                          dataKey="count"
                          barSize={22}
                          radius={[6, 6, 2, 2]}
                          cursor="pointer"
                          onClick={(barData: any) => {
                            const target = barData?.fullLabel;
                            if (target) {
                              setSelectedIntake(selectedIntake === target ? 'all' : target);
                              setMultiPage(1);
                            }
                          }}
                        >
                          <LabelList
                            dataKey="count"
                            position="top"
                            style={{ fontSize: '10.5px', fontWeight: 800, fill: '#0f172a' }}
                          />
                          {chartIntakes.map((entry) => (
                            <Cell
                              key={entry.label}
                              fill={
                                selectedIntake === entry.label
                                  ? '#881320'
                                  : '#C6333D'
                              }
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Subtle Quick-Filter Strip below Chart */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      overflowX: 'auto',
                      paddingBottom: '4px',
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '10px'
                    }}
                  >
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', flexShrink: 0 }}>
                      Lọc nhanh:
                    </span>
                    {filteredIntakes.slice(0, 8).map((item) => {
                      const isSelected = selectedIntake === item.label;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => {
                            if (item.label !== 'Chưa gắn Intake') {
                              setSelectedIntake(isSelected ? 'all' : item.label);
                              setMultiPage(1);
                            }
                          }}
                          style={{
                            border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                            background: isSelected ? '#f1f5f9' : '#f8fafc',
                            color: isSelected ? '#0f172a' : '#334155',
                            borderRadius: '999px',
                            padding: '3px 9px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            flexShrink: 0
                          }}
                        >
                          <span>{item.label}</span>
                          <strong style={{ color: isSelected ? '#0f172a' : '#0f172a' }}>{item.count}</strong>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                /* Mode 2: Full Intake Lookup Grid when "Tất cả" tab or Search is active */
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                    gap: '7px',
                    maxHeight: '295px',
                    overflowY: 'auto',
                    paddingRight: '4px'
                  }}
                >
                  {filteredIntakes.map((item) => {
                    const isSelected = selectedIntake === item.label;
                    const clickable = item.label !== 'Chưa gắn Intake';
                    return (
                      <div
                        key={item.label}
                        onClick={() => {
                          if (clickable) {
                            setSelectedIntake(isSelected ? 'all' : item.label);
                            setMultiPage(1);
                          }
                        }}
                        style={{
                          cursor: clickable ? 'pointer' : 'default',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                          background: isSelected ? '#f8fafc' : '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px',
                          transition: 'all 0.15s ease'
                        }}
                        title={`${item.label}: ${item.count} HV (${item.pct}%)`}
                      >
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: isSelected ? 700 : 600,
                            color: isSelected ? '#0f172a' : 'var(--color-text, #0f172a)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {item.label}
                        </span>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            color: isSelected ? '#0f172a' : '#334155',
                            fontVariantNumeric: 'tabular-nums',
                            flexShrink: 0
                          }}
                        >
                          {item.count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ROW 3: THÁP CẤP BẬC CHỨC VỤ (Horizontal Pyramid Bar Chart) & NHÓM NGÀNH NGHỀ (Basic Brand Spectrum + Ranked List) */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left: Tháp Cấp Bậc Chức Vụ & Quản Lý — Clean Horizontal Bar Pyramid */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                    Tháp Cấp Bậc Chức Vụ &amp; Quản Lý
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                    Bấm vào từng cấp bậc để lọc danh sách học viên
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#0f172a',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}
                >
                  {summary.with_job_title.toLocaleString('vi-VN')} có chức vụ
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {(() => {
                  const jobGroups = data?.by_job_group || [];
                  const maxJgCount = Math.max(1, ...jobGroups.filter((j) => j.label !== 'Chưa cập nhật').map((j) => j.count));
                  return jobGroups.map((jg, idx) => {
                    const isUnassigned = jg.label === 'Chưa cập nhật';
                    const isSelected = selectedJobGroup === jg.label;
                    const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                    const barColor = isUnassigned
                      ? '#cbd5e1'
                      : isSelected || idx === 0
                      ? '#C6333D'
                      : idx === 1
                      ? '#334155'
                      : idx === 2
                      ? '#475569'
                      : '#64748b';
                    const barWidthPct = isUnassigned
                      ? Math.min(100, Math.max(4, jg.pct))
                      : Math.min(100, Math.max(5, Math.round((jg.count / maxJgCount) * 100)));

                    return (
                      <div
                        key={jg.label}
                        onClick={() => {
                          setSelectedJobGroup(isSelected ? 'all' : jg.label);
                          setMultiPage(1);
                        }}
                        style={{
                          cursor: 'pointer',
                          padding: '7px 10px',
                          borderRadius: '8px',
                          border: isSelected ? '1.5px solid #0f172a' : '1px solid transparent',
                          background: isSelected ? '#f8fafc' : 'transparent',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <span style={{ fontSize: idx < 3 ? '0.92rem' : '0.73rem', fontWeight: 700, color: 'var(--color-text-muted)', width: 22, textAlign: 'center', flexShrink: 0 }}>
                              {medal}
                            </span>
                            <span
                              style={{
                                fontSize: '0.82rem',
                                fontWeight: isSelected || idx === 0 ? 700 : 600,
                                color: isSelected ? '#BD1D2D' : 'var(--color-text, #0f172a)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {jg.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                            <span style={{ fontSize: '0.84rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', fontVariantNumeric: 'tabular-nums' }}>
                              {jg.count.toLocaleString('vi-VN')}
                            </span>
                            <span
                              style={{
                                fontSize: '0.71rem',
                                fontWeight: 700,
                                color: isSelected ? '#BD1D2D' : '#475569',
                                background: isSelected ? 'rgba(189, 29, 45, 0.1)' : '#f1f5f9',
                                padding: '1px 7px',
                                borderRadius: '999px',
                                minWidth: '44px',
                                textAlign: 'center',
                                fontVariantNumeric: 'tabular-nums'
                              }}
                            >
                              {jg.pct}%
                            </span>
                          </div>
                        </div>
                        <div style={{ marginLeft: 30, height: 6, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${barWidthPct}%`,
                              height: '100%',
                              background: barColor,
                              borderRadius: 4,
                              transition: 'width 0.35s ease'
                            }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {(data?.top_job_titles || []).length > 0 && (
                <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.8rem', marginTop: 'auto' }}>
                  <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#64748b', marginBottom: '7px' }}>
                    Chức danh phổ biến nhất:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {(data?.top_job_titles || []).slice(0, 10).map((jt) => (
                      <span
                        key={jt.label}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '3px 9px',
                          borderRadius: '999px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          color: '#0f172a',
                          fontSize: '0.73rem',
                          fontWeight: 500
                        }}
                      >
                        <span>{jt.label}</span>
                        <strong style={{ color: '#BD1D2D', fontSize: '0.72rem' }}>
                          {jt.count}
                        </strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Nhóm Ngành Nghề & Lĩnh Vực — Spectrum Bar + Crisp Ranked Cards */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                    Nhóm Ngành Nghề &amp; Lĩnh Vực
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                    Tỷ trọng phân bổ &amp; xếp hạng theo lĩnh vực công tác (bấm vào dòng để lọc)
                  </p>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#0f172a',
                    fontSize: '0.74rem',
                    fontWeight: 700
                  }}
                >
                  {summary.with_industry.toLocaleString('vi-VN')} đã phân ngành
                </span>
              </div>

              {(() => {
                const assignedInds = (data?.by_industry || []).filter((i) => i.label !== 'Chưa cập nhật' && i.count > 0);
                const totalAssigned = assignedInds.reduce((acc, cur) => acc + cur.count, 0) || 1;
                const spectrumColors = ['#C6333D', '#334155', '#E11D48', '#64748B', '#991B1B', '#94A3B8', '#CBD5E1'];
                const topSegments = assignedInds.slice(0, 6);
                const otherCount = assignedInds.slice(6).reduce((acc, cur) => acc + cur.count, 0);

                return (
                  <>
                    {topSegments.length > 0 && (
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div
                          style={{
                            height: 10,
                            width: '100%',
                            borderRadius: 999,
                            overflow: 'hidden',
                            display: 'flex',
                            gap: 2,
                            background: '#e2e8f0'
                          }}
                        >
                          {topSegments.map((seg, sIdx) => {
                            const wPct = Math.max(2, Math.round((seg.count / totalAssigned) * 1000) / 10);
                            return (
                              <div
                                key={seg.label}
                                onClick={() => {
                                  setSelectedIndustry(selectedIndustry === seg.label ? 'all' : seg.label);
                                  setMultiPage(1);
                                }}
                                title={`${seg.label}: ${seg.count} HV (${wPct}% nhóm đã phân ngành)`}
                                style={{
                                  width: `${wPct}%`,
                                  height: '100%',
                                  background: spectrumColors[sIdx % spectrumColors.length],
                                  cursor: 'pointer',
                                  transition: 'width 0.3s ease'
                                }}
                              />
                            );
                          })}
                          {otherCount > 0 && (
                            <div
                              title={`Ngành khác: ${otherCount} HV`}
                              style={{
                                width: `${Math.max(2, Math.round((otherCount / totalAssigned) * 1000) / 10)}%`,
                                height: '100%',
                                background: '#cbd5e1'
                              }}
                            />
                          )}
                        </div>

                        {/* Top 4 in clean 2x2 grid */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                            gap: '8px 16px'
                          }}
                        >
                          {topSegments.slice(0, 4).map((seg, sIdx) => {
                            const isSelected = selectedIndustry === seg.label;
                            return (
                              <div
                                key={seg.label}
                                onClick={() => {
                                  setSelectedIndustry(isSelected ? 'all' : seg.label);
                                  setMultiPage(1);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 6,
                                  cursor: 'pointer',
                                  fontSize: '0.74rem'
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                                  <span
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: 2,
                                      background: spectrumColors[sIdx % spectrumColors.length],
                                      flexShrink: 0
                                    }}
                                  />
                                  <span
                                    style={{
                                      color: isSelected ? '#0f172a' : '#475569',
                                      fontWeight: isSelected ? 700 : 600,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}
                                    title={seg.label}
                                  >
                                    {seg.label}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                  <strong style={{ color: '#0f172a', fontWeight: 700 }}>{seg.count}</strong>
                                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>({seg.pct}%)</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Industry List Rows with crisp cards and bottom progress track (height-matched to left Pyramid card + scroll) */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        maxHeight: '345px',
                        overflowY: 'auto',
                        paddingRight: '4px'
                      }}
                    >
                      {(() => {
                        const industries = data?.by_industry || [];
                        const maxIndCount = Math.max(1, industries[0]?.count || 1);
                        return industries.map((ind, idx) => {
                          const isUnassigned = ind.label === 'Chưa cập nhật';
                          const isSelected = selectedIndustry === ind.label;
                          const IndIcon = getIndustryIcon(ind.label);
                          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                          const pctOfMax = isUnassigned
                            ? Math.min(100, Math.max(4, ind.pct))
                            : Math.min(100, Math.max(4, Math.round((ind.count / maxIndCount) * 100)));

                          return (
                            <div
                              key={ind.label}
                              onClick={() => {
                                setSelectedIndustry(isSelected ? 'all' : ind.label);
                                setMultiPage(1);
                              }}
                              style={{
                                cursor: 'pointer',
                                padding: '10px 12px',
                                borderRadius: 10,
                                background: isSelected ? '#f8fafc' : '#ffffff',
                                border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.02)',
                                display: 'flex',
                                flexDirection: 'column',
                                transition: 'all 0.15s ease'
                              }}
                            >
                              {/* Top line of row */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                                  <span
                                    style={{
                                      fontSize: idx < 3 ? '0.95rem' : '0.73rem',
                                      fontWeight: 700,
                                      color: 'var(--color-text-muted)',
                                      width: 24,
                                      textAlign: 'center',
                                      flexShrink: 0
                                    }}
                                  >
                                    {medal}
                                  </span>
                                  <span
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: 8,
                                      background: '#f8fafc',
                                      color: idx === 0 ? '#C6333D' : '#475569',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0
                                    }}
                                  >
                                    <IndIcon size={14} />
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: isSelected || idx === 0 ? 700 : 600,
                                      color: '#0f172a',
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis'
                                    }}
                                    title={ind.label}
                                  >
                                    {ind.label}
                                  </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                  <span
                                    style={{
                                      fontSize: '13px',
                                      fontWeight: 700,
                                      color: '#0f172a',
                                      fontVariantNumeric: 'tabular-nums'
                                    }}
                                  >
                                    {ind.count.toLocaleString('vi-VN')} HV
                                  </span>
                                  <span
                                    style={{
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      background: '#f1f5f9',
                                      color: '#334155',
                                      fontSize: '11.5px',
                                      fontWeight: 700,
                                      border: 'none',
                                      minWidth: '46px',
                                      textAlign: 'center',
                                      fontVariantNumeric: 'tabular-nums'
                                    }}
                                  >
                                    {ind.pct}%
                                  </span>
                                </div>
                              </div>

                              {/* Bottom line: crisp 5px full-width progress track */}
                              <div
                                style={{
                                  height: 5,
                                  borderRadius: 999,
                                  background: '#f1f5f9',
                                  marginTop: 7,
                                  marginLeft: 32,
                                  overflow: 'hidden'
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.max(4, pctOfMax)}%`,
                                    height: '100%',
                                    borderRadius: 999,
                                    background: isUnassigned
                                      ? '#cbd5e1'
                                      : idx === 0
                                      ? '#C6333D'
                                      : idx < 3
                                      ? '#334155'
                                      : '#94a3b8',
                                    transition: 'width 0.35s ease'
                                  }}
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* ROW 4: TOP CÔNG TY / ĐƠN VỊ CÔNG TÁC & ĐỘ ĐẦY ĐỦ DỮ LIỆU CHÂN DUNG (Basic Brand Style) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: '1.25rem' }}>
            {/* Left: Top Công ty / Đơn vị công tác */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '0.95rem', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                    Top Công Ty / Đơn Vị Công Tác ({summary.distinct_companies})
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                    Các ngân hàng, tập đoàn và doanh nghiệp có nhiều học viên nhất
                  </p>
                </div>
                <CleanSearchBox
                  value={companySearch}
                  onChange={setCompanySearch}
                  placeholder="Tìm tên công ty..."
                  width={185}
                />
              </div>

              {/* Top 1, 2, 3 Medal Podium Cards — Uniform neutral border, NO colored borders/stripes */}
              {!companySearch && filteredCompanies.length >= 3 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '10px' }}>
                  {filteredCompanies.slice(0, 3).map((topComp, idx) => {
                    const podiumMedals = ['🥇', '🥈', '🥉'];
                    const podiumBadges = ['TOP 1', 'TOP 2', 'TOP 3'];
                    const medal = podiumMedals[idx] || `#${idx + 1}`;
                    const badge = podiumBadges[idx] || `TOP ${idx + 1}`;
                    const isSelected = selectedCompany === topComp.label;
                    const tooltipText =
                      topComp.variants && topComp.variants.length > 1
                        ? `${topComp.label} (${topComp.count} HV) — Đã hợp nhất ${topComp.variants.length} đơn vị/chi nhánh:\n• ${topComp.variants.join('\n• ')}`
                        : `${topComp.label}: ${topComp.count} HV`;
                    return (
                      <div
                        key={topComp.label}
                        onClick={() => {
                          setSelectedCompany(isSelected ? 'all' : topComp.label);
                          setMultiPage(1);
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 12,
                          background: isSelected ? '#f8fafc' : '#ffffff',
                          border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          minWidth: 0,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        title={tooltipText}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#334155', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '1rem' }}>{medal}</span>
                            <span>{badge}</span>
                          </span>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: isSelected ? '#BD1D2D' : 'var(--color-text, #0f172a)', fontVariantNumeric: 'tabular-nums' }}>
                            {topComp.count} HV
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            color: isSelected ? '#BD1D2D' : 'var(--color-text, #0f172a)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {topComp.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Remaining Companies Grid (#4 onwards with crisp card border) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                  gap: '8px',
                  maxHeight: '265px',
                  overflowY: 'auto',
                  paddingRight: '4px'
                }}
              >
                {filteredCompanies.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                    Không tìm thấy công ty phù hợp
                  </div>
                ) : (
                  (companySearch ? filteredCompanies : filteredCompanies.slice(3)).map((comp, idx) => {
                    const actualRank = companySearch ? idx + 1 : idx + 4;
                    const rankBadge = actualRank === 1 ? '🥇' : actualRank === 2 ? '🥈' : actualRank === 3 ? '🥉' : `#${actualRank}`;
                    const isSelected = selectedCompany === comp.label;
                    const tooltipText =
                      comp.variants && comp.variants.length > 1
                        ? `${comp.label} (${comp.count} HV) — Đã hợp nhất ${comp.variants.length} đơn vị/chi nhánh:\n• ${comp.variants.join('\n• ')}`
                        : `${comp.label}: ${comp.count} HV`;
                    return (
                      <div
                        key={comp.label}
                        onClick={() => {
                          setSelectedCompany(isSelected ? 'all' : comp.label);
                          setMultiPage(1);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: isSelected ? '1.5px solid #0f172a' : '1px solid #e2e8f0',
                          background: isSelected ? '#f8fafc' : '#ffffff',
                          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.02)',
                          minWidth: 0,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        title={tooltipText}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748b', minWidth: 24, textAlign: 'center', flexShrink: 0 }}>
                            {rankBadge}
                          </span>
                          <span
                            style={{
                              fontSize: '0.8125rem',
                              fontWeight: isSelected ? 700 : 600,
                              color: isSelected ? '#BD1D2D' : 'var(--color-text, #0f172a)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                          >
                            {comp.label}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            color: isSelected ? '#BD1D2D' : '#334155',
                            background: '#f1f5f9',
                            border: 'none',
                            padding: '2px 8px',
                            borderRadius: 6,
                            flexShrink: 0,
                            fontVariantNumeric: 'tabular-nums'
                          }}
                        >
                          {comp.count} HV
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right: Độ Đầy Đủ Dữ Liệu Chân Dung — Dynamic Red / Yellow / Green by Percentage */}
            <div className="card" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                    Độ Đầy Đủ Dữ Liệu Chân Dung
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                    Tỷ lệ điền đầy đủ của 8 trường thông tin trên tập dữ liệu đang lọc
                  </p>
                </div>
                {(() => {
                  const avgTone = getCompletenessTone(avgCompletenessPct);
                  return (
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: '8px',
                        background: avgTone.bg,
                        border: 'none',
                        color: avgTone.text,
                        fontSize: '0.74rem',
                        fontWeight: 700
                      }}
                    >
                      TB: {avgCompletenessPct}% đầy đủ
                    </span>
                  );
                })()}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {(data?.data_completeness || []).map((c) => {
                  const missing = Math.max(0, c.total - c.filled);
                  const tone = getCompletenessTone(c.pct);
                  return (
                    <div
                      key={c.field}
                      style={{
                        padding: '9px 12px',
                        borderRadius: 10,
                        background: '#f8fafc',
                        border: '1px solid #f1f5f9',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: tone.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          <span style={{ color: '#64748b' }}>
                            Có: <strong style={{ color: '#0f172a' }}>{c.filled.toLocaleString('vi-VN')}</strong>
                          </span>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span style={{ color: '#64748b' }}>
                            Thiếu: <strong style={{ color: '#0f172a' }}>{missing.toLocaleString('vi-VN')}</strong>
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              color: tone.text,
                              background: tone.bg,
                              padding: '2px 8px',
                              borderRadius: 6,
                              fontSize: '0.72rem',
                              minWidth: '44px',
                              textAlign: 'center',
                              border: 'none'
                            }}
                          >
                            {c.pct}%
                          </span>
                        </div>
                      </div>
                      <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.max(2, c.pct)}%`,
                            height: '100%',
                            background: tone.bar,
                            borderRadius: 999,
                            transition: 'width 0.35s ease'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ROW 5: DANH SÁCH HỌC VIÊN HỌC NHIỀU KHÓA / NHIỀU CHƯƠNG TRÌNH (Basic Brand Style & Black Student Names!) */}
          <div id="multi-course-students-section" className="card" style={{ padding: '1.35rem' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: 'var(--color-text, #0f172a)', letterSpacing: '-0.01em' }}>
                  Danh Sách Học Viên Học Nhiều Khóa / Nhiều Trường ({filteredMultiStudents.length})
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--color-text-muted, #64748b)' }}>
                  Bấm vào nút <strong>Số khóa</strong> để xem danh sách các khóa đã học, hoặc bấm vào dòng để mở Hồ sơ 360°
                </p>
              </div>

              <CleanSearchBox
                value={multiStudentSearch}
                onChange={(val) => {
                  setMultiStudentSearch(val);
                  setMultiPage(1);
                }}
                placeholder="Tìm tên, SĐT, công ty, trường, Sale..."
                width={270}
              />
            </div>

            <div className="table-wrap" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>#</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>HỌ VÀ TÊN</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>GIỚI TÍNH</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>SỐ KHÓA ĐÃ HỌC</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>CHỨC VỤ &amp; CÔNG TY</th>
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>SALE PHỤ TRÁCH</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>HỒ SƠ</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedMultiStudents.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                        Không có học viên đa khóa nào khớp điều kiện lọc
                      </td>
                    </tr>
                  ) : (
                    paginatedMultiStudents.map((st, idx) => (
                      <tr
                        key={st.primary_id}
                        onClick={() => handleOpenStudentProfile(st)}
                        style={{
                          borderBottom: '1px solid var(--color-border-light)',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(189, 29, 45, 0.03)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                          {(multiPage - 1) * MULTI_PAGE_SIZE + idx + 1}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Avatar name={st.full_name} size={34} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.83rem', color: '#0f172a' }}>
                                {st.full_name}
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                                {[st.phone, st.email].filter(Boolean).join(' • ') || '—'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '0.78rem', fontWeight: 500 }}>
                          {st.gender || '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCourseModalStudent(st);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '8px',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              color: '#0f172a',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              whiteSpace: 'nowrap'
                            }}
                            title="Bấm để xem chi tiết các khóa đã học"
                          >
                            <GraduationCap size={14} style={{ color: '#BD1D2D' }} />
                            <span>{st.course_count} khóa học</span>
                            <span style={{ fontSize: '0.7rem', fontWeight: 600, opacity: 0.85 }}>• Xem chi tiết</span>
                          </button>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>{st.job_title || '—'}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{st.company || '—'}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {st.owner_name ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <Avatar src={st.owner_avatar || undefined} name={st.owner_name} size={24} />
                              <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--color-text, #0f172a)' }}>
                                {st.owner_name}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn outline sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenStudentProfile(st);
                            }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem' }}
                          >
                            <span>Xem 360°</span>
                            <ExternalLink size={12} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {totalMultiPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', fontSize: '0.78rem' }}>
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
                  Trang {multiPage} / {totalMultiPages} ({filteredMultiStudents.length} học viên đa khóa)
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn outline sm"
                    disabled={multiPage <= 1}
                    onClick={() => setMultiPage((p) => Math.max(1, p - 1))}
                  >
                    Trước
                  </button>
                  <button
                    type="button"
                    className="btn outline sm"
                    disabled={multiPage >= totalMultiPages}
                    onClick={() => setMultiPage((p) => Math.min(totalMultiPages, p + 1))}
                  >
                    Sau
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* MODAL CHI TIẾT CÁC KHÓA ĐÃ HỌC CỦA HỌC VIÊN */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {courseModalStudent && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 2147483610,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '16px'
                }}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setCourseModalStudent(null)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(15, 23, 42, 0.55)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)'
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '560px',
                    maxHeight: '85dvh',
                    background: 'var(--color-surface, #ffffff)',
                    borderRadius: '16px',
                    border: '1px solid var(--color-border)',
                    boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    zIndex: 1
                  }}
                >
                  {/* Modal Header */}
                  <div
                    style={{
                      padding: '16px 20px',
                      borderBottom: '1px solid var(--color-border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <Avatar name={courseModalStudent.full_name} size={42} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            {courseModalStudent.full_name}
                          </h3>
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: '#1d4ed8',
                              background: 'rgba(37, 99, 235, 0.1)',
                              padding: '2px 8px',
                              borderRadius: '999px'
                            }}
                          >
                            {courseModalStudent.course_count} khóa học
                          </span>
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                          {[courseModalStudent.phone, courseModalStudent.email].filter(Boolean).join(' • ') || '—'}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCourseModalStudent(null)}
                      className="macos-drawer-close"
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-bg-alt, #f8fafc)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: 'var(--color-text-muted)'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Modal Body: Course Cards */}
                  <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(courseModalStudent.job_title || courseModalStudent.company) && (
                      <div
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: 'var(--color-bg-alt, #f8fafc)',
                          border: '1px solid var(--color-border-light)',
                          fontSize: '0.78rem',
                          color: 'var(--color-text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}
                      >
                        <Briefcase size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                        <span>
                          <strong style={{ color: 'var(--color-text)' }}>{courseModalStudent.job_title || 'Chưa cập nhật chức vụ'}</strong>
                          {courseModalStudent.company ? ` — ${courseModalStudent.company}` : ''}
                        </span>
                      </div>
                    )}

                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: '4px' }}>
                      Danh sách các Trường &amp; Khóa đã đăng ký ({courseModalStudent.courses.length})
                    </div>

                    {courseModalStudent.courses.map((c, cIdx) => (
                      <div
                        key={`${c.contact_id}_${cIdx}`}
                        onClick={() => {
                          const targetStudent = courseModalStudent;
                          setCourseModalStudent(null);
                          handleOpenStudentProfile(targetStudent, c.contact_id);
                        }}
                        style={{
                          padding: '12px 14px',
                          borderRadius: '11px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface, #ffffff)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '8px',
                              background: 'rgba(37, 99, 235, 0.1)',
                              color: '#2563eb',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '0.78rem',
                              flexShrink: 0
                            }}
                          >
                            #{cIdx + 1}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-text)' }}>
                              {c.label}
                            </div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--color-text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {c.school && <span>Trường: <strong>{c.school}</strong></span>}
                              {c.intake && <span>• Khóa: <strong>{c.intake}</strong></span>}
                              {c.student_id && (
                                <span style={{ color: '#2563eb', fontWeight: 600 }}>• Mã HV: {c.student_id}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn outline sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const targetStudent = courseModalStudent;
                            setCourseModalStudent(null);
                            handleOpenStudentProfile(targetStudent, c.contact_id);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', flexShrink: 0 }}
                        >
                          <span>Mở hồ sơ</span>
                          <ExternalLink size={12} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Modal Footer */}
                  <div
                    style={{
                      padding: '12px 20px',
                      borderTop: '1px solid var(--color-border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      gap: '8px',
                      background: 'var(--color-bg-alt, #f8fafc)'
                    }}
                  >
                    <button
                      type="button"
                      className="btn outline sm"
                      onClick={() => setCourseModalStudent(null)}
                    >
                      Đóng
                    </button>
                    <button
                      type="button"
                      className="btn primary sm"
                      onClick={() => {
                        const targetStudent = courseModalStudent;
                        setCourseModalStudent(null);
                        handleOpenStudentProfile(targetStudent);
                      }}
                    >
                      <span>Xem Hồ sơ 360° chính</span>
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* WIDE SLIDE-OVER DRAWER FOR ADVANCED FILTERS (Matching ContactsPage "Bộ lọc đa tầng chuyên sâu") */}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {showAdvancedDrawer && (
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 2147483625,
                  display: 'flex',
                  justifyContent: 'flex-end',
                  overflow: 'hidden'
                }}
              >
                <motion.div
                  className="drawer-backdrop"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowAdvancedDrawer(false)}
                  style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    zIndex: 2147483620
                  }}
                />

                <motion.div
                  className="drawer-panel"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
                  style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: isMobile ? '100%' : 'min(95vw, 780px)',
                    height: '100%',
                    background: 'var(--color-surface, #ffffff)',
                    boxShadow: '-8px 0 36px rgba(0, 0, 0, 0.28)',
                    display: 'flex',
                    flexDirection: 'column',
                    zIndex: 2147483625,
                    overflow: 'hidden'
                  }}
                >
                  {/* Drawer Header */}
                  <div
                    style={{
                      padding: isMobile ? '1rem' : '1.25rem 1.5rem',
                      borderBottom: '1px solid var(--color-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'var(--color-surface)',
                      gap: '8px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '10px',
                          background: 'rgba(189, 29, 45, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-primary, #BD1D2D)'
                        }}
                      >
                        <SlidersHorizontal size={18} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)' }}>
                          Bộ lọc đa tầng chuyên sâu
                        </h3>
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          Lọc chân dung Học viên &amp; Tiềm năng theo Sale phụ trách, Trường, Khóa, Chức vụ &amp; Ngành nghề
                        </p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {activeFilterCount > 0 && (
                        <button
                          type="button"
                          onClick={handleResetAllFilters}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px 10px',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border)',
                            background: 'transparent',
                            color: 'var(--color-danger, #ef4444)',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          <RotateCcw size={12} /> Đặt lại
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowAdvancedDrawer(false)}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '8px',
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)',
                          color: 'var(--color-text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer'
                        }}
                      >
                        <X size={18} />
                      </button>
                    </div>
                  </div>

                  {/* Drawer Body */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: 'auto',
                      padding: '1.25rem 1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '1.1rem',
                      background: '#f8fafc'
                    }}
                  >
                    {/* Card 1: Đối tượng & Sale Phụ Trách */}
                    <div
                      style={{
                        padding: '1.15rem',
                        borderRadius: '14px',
                        background: 'var(--color-surface, #ffffff)',
                        border: '1px solid var(--color-border-light)',
                        boxShadow: '0 1px 2px rgba(15,23,42,0.03)'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          color: 'var(--color-text, #0f172a)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '0.875rem'
                        }}
                      >
                        <Users size={16} /> Đối Tượng &amp; Sale Phụ Trách
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                            Tệp dữ liệu thống kê
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                            {[
                              { id: 'student' as const, label: 'Học viên (Mặc định)' },
                              { id: 'lead' as const, label: 'Tiềm năng (Lead)' }
                            ].map((item) => {
                              const isAct = segmentFilter === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    setSegmentFilter(item.id);
                                    handleResetAllFilters();
                                  }}
                                  style={{
                                    padding: '8px 10px',
                                    fontSize: '0.8rem',
                                    fontWeight: isAct ? 700 : 500,
                                    borderRadius: '8px',
                                    border: isAct ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                    background: 'var(--color-surface, #ffffff)',
                                    color: isAct ? 'var(--color-primary)' : 'var(--color-text)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div>
                          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                            Sale / Tư vấn viên phụ trách (Có Avatar &amp; Tìm kiếm)
                          </label>
                          <CustomSelect
                            options={ownerOptions}
                            value={selectedOwner}
                            onChange={(val) => {
                              setSelectedOwner(String(val));
                              setMultiPage(1);
                            }}
                            searchable
                            showAvatars
                            placeholder="Chọn hoặc tìm tên Sale..."
                            width="100%"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Trường, Khóa học & Đa khóa */}
                    <div
                      style={{
                        padding: '1.15rem',
                        borderRadius: '14px',
                        background: 'var(--color-surface, #ffffff)',
                        border: '1px solid var(--color-border-light)',
                        boxShadow: '0 1px 2px rgba(15,23,42,0.03)'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          color: 'var(--color-text, #0f172a)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '0.875rem'
                        }}
                      >
                        <GraduationCap size={16} /> Học Vụ, Trường &amp; Khóa Học (Intake)
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                            Trường / Chương trình đào tạo
                          </label>
                          <CustomSelect
                            options={schoolOptions}
                            value={selectedSchool}
                            onChange={(val) => {
                              setSelectedSchool(String(val));
                              setMultiPage(1);
                            }}
                            searchable
                            width="100%"
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                            Khóa học / Kỳ nhập học (Intake)
                          </label>
                          <CustomSelect
                            options={intakeOptions}
                            value={selectedIntake}
                            onChange={(val) => {
                              setSelectedIntake(String(val));
                              setMultiPage(1);
                            }}
                            searchable
                            width="100%"
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                          Phân loại Học viên đa khóa / đa chương trình
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setMultiCourseOnly(false);
                              setMultiPage(1);
                            }}
                            style={{
                              padding: '8px 10px',
                              fontSize: '0.8rem',
                              fontWeight: !multiCourseOnly ? 700 : 500,
                              borderRadius: '8px',
                              border: !multiCourseOnly ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: 'var(--color-surface, #ffffff)',
                              color: !multiCourseOnly ? 'var(--color-primary)' : 'var(--color-text)',
                              cursor: 'pointer'
                            }}
                          >
                            Tất cả hồ sơ
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMultiCourseOnly(true);
                              setMultiPage(1);
                            }}
                            style={{
                              padding: '8px 10px',
                              fontSize: '0.8rem',
                              fontWeight: multiCourseOnly ? 700 : 500,
                              borderRadius: '8px',
                              border: multiCourseOnly ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                              background: 'var(--color-surface, #ffffff)',
                              color: multiCourseOnly ? 'var(--color-primary)' : 'var(--color-text)',
                              cursor: 'pointer'
                            }}
                          >
                            Học viên đa khóa (≥ 2 khóa / trường)
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: Nhân khẩu học, Chức vụ & Ngành nghề */}
                    <div
                      style={{
                        padding: '1.15rem',
                        borderRadius: '14px',
                        background: 'var(--color-surface, #ffffff)',
                        border: '1px solid var(--color-border-light)',
                        boxShadow: '0 1px 2px rgba(15,23,42,0.03)'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '0.8125rem',
                          fontWeight: 700,
                          color: 'var(--color-text, #0f172a)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '0.875rem'
                        }}
                      >
                        <Briefcase size={16} /> Nhân Khẩu Học, Chức Vụ &amp; Ngành Nghề
                      </div>

                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                          Giới tính
                        </label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                          {[
                            { id: 'all', label: 'Tất cả' },
                            { id: 'Nam', label: 'Nam' },
                            { id: 'Nữ', label: 'Nữ' },
                            { id: 'Chưa rõ', label: 'Chưa rõ' }
                          ].map((g) => {
                            const isAct = selectedGender === g.id;
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => {
                                  setSelectedGender(g.id);
                                  setMultiPage(1);
                                }}
                                style={{
                                  padding: '8px 10px',
                                  fontSize: '0.8rem',
                                  fontWeight: isAct ? 700 : 500,
                                  borderRadius: '8px',
                                  border: isAct ? '1.5px solid var(--color-primary)' : '1px solid var(--color-border)',
                                  background: 'var(--color-surface, #ffffff)',
                                  color: isAct ? 'var(--color-primary)' : 'var(--color-text)',
                                  cursor: 'pointer'
                                }}
                              >
                                {g.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                            Nhóm chức vụ / Cấp bậc quản lý
                          </label>
                          <CustomSelect
                            options={jobGroupOptions}
                            value={selectedJobGroup}
                            onChange={(val) => {
                              setSelectedJobGroup(String(val));
                              setMultiPage(1);
                            }}
                            searchable
                            width="100%"
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: '6px' }}>
                            Nhóm ngành nghề / Lĩnh vực
                          </label>
                          <CustomSelect
                            options={industryOptions}
                            value={selectedIndustry}
                            onChange={(val) => {
                              setSelectedIndustry(String(val));
                              setMultiPage(1);
                            }}
                            searchable
                            width="100%"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Drawer Footer */}
                  <div
                    style={{
                      padding: '1rem 1.5rem',
                      borderTop: '1px solid var(--color-border)',
                      background: 'var(--color-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}
                  >
                    <button
                      type="button"
                      className="btn outline"
                      onClick={handleResetAllFilters}
                      style={{ borderRadius: '10px', fontWeight: 600 }}
                    >
                      Đặt lại
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        className="btn outline"
                        onClick={() => setShowAdvancedDrawer(false)}
                        style={{ borderRadius: '10px', fontWeight: 600 }}
                      >
                        Đóng
                      </button>
                      <button
                        type="button"
                        className="btn primary"
                        onClick={() => setShowAdvancedDrawer(false)}
                        style={{
                          borderRadius: '10px',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <Check size={16} />
                        <span>Áp dụng bộ lọc ({summary.total_profiles.toLocaleString('vi-VN')} hồ sơ)</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </div>
  );
};

export default CustomerPersonaOverviewDeck;
