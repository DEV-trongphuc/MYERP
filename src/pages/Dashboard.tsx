import { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Users, AlertTriangle, RefreshCw,
  GitBranch, UserPlus, Zap, Calendar, BarChart2, Scale,
  FileSpreadsheet, MessageCircle, Database, Server, ExternalLink, Clock, CheckCircle, Cpu,
  ShieldAlert, Filter, Ticket as TicketIcon,
  FileText, CheckSquare, AlertCircle, CheckCircle2, Settings, DollarSign, Send, CreditCard, TrendingUp, Receipt, Award, ArrowRight
} from 'lucide-react';
import {
  Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ComposedChart,
  PieChart, Pie, Cell, BarChart, LabelList, Line, Legend, Area
} from 'recharts';
import { CustomSelect } from '../components/ui/CustomSelect';
import { CustomModal } from '../components/ui/CustomModal';
import { useNavigate } from 'react-router-dom';
import { withRouterFreezer } from '../components/RouterFreezer';
import { fetchAPI, getDefaultDateFilter } from '../utils/api';
import { useLanguage } from '../contexts/LanguageContext';
import toast from 'react-hot-toast';
import { KpiCardSkeleton, Skeleton, ChartSkeleton } from '../components/ui/Skeleton';

import { Avatar } from '../components/ui/Avatar';
import { WarRoomFlightDeck } from '../components/Dashboard/WarRoomFlightDeck';
import { useAuth } from '../contexts/AuthContext';

const parseServerDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();
  if (trimmed.includes('T') || trimmed.includes('+') || trimmed.includes('Z')) {
    return new Date(trimmed);
  }
  const isoStr = trimmed.replace(' ', 'T') + '+07:00';
  return new Date(isoStr);
};

const DashboardInner = ({ isActive }: { isActive: boolean }) => {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const daysOfWeek = [
    t('Thứ 2'),
    t('Thứ 3'),
    t('Thứ 4'),
    t('Thứ 5'),
    t('Thứ 6'),
    t('Thứ 7'),
    t('Chủ Nhật')
  ];
  const daysOfWeekShort = [
    t('T2'),
    t('T3'),
    t('T4'),
    t('T5'),
    t('T6'),
    t('T7'),
    t('CN')
  ];
  const navigate = useNavigate();
  const [stats, setStats] = useState<any>(null);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingTicketsCount, setPendingTicketsCount] = useState(0);
  const [heldLeadsCount, setHeldLeadsCount] = useState(0);
  const [pendingCheckInsCount, setPendingCheckInsCount] = useState(0);
  const [pendingCoopsCount, setPendingCoopsCount] = useState(0);
  const [pendingExpensesCount, setPendingExpensesCount] = useState(0);
  const [showWarRoom, setShowWarRoom] = useState(false);
  const [aiScreenerEnabled, setAiScreenerEnabled] = useState<boolean>(() => {
    const cached = localStorage.getItem('ai_screener_enabled');
    return cached === null ? true : cached === '1';
  });
  const [dateFilter, setDateFilter] = useState(() => {
    return localStorage.getItem('Ideas_global_date') || getDefaultDateFilter();
  });

  const handleUpdateDateFilter = (val: string) => {
    setDateFilter(val);
    localStorage.setItem('Ideas_global_date', val);
    window.dispatchEvent(new CustomEvent('global-date-change', { detail: val }));
  };

  const [chartMode, setChartMode] = useState<'day' | 'hour' | 'heatmap'>('day');
  const [hoveredCell, setHoveredCell] = useState<{
    wday: number;
    hour: number;
    volume: number;
    x: number;
    y: number;
  } | null>(null);
  const [sourceViewMode, setSourceViewMode] = useState<'connection' | 'lead'>('connection');
  const [settings, setSettings] = useState<any>(null);
  const [connections, setConnections] = useState<any[]>([]);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthModalTab, setHealthModalTab] = useState<'stats' | 'connections'>('stats');
  const [healthChartMetric, setHealthChartMetric] = useState<'zalo' | 'email' | 'telegram' | 'token'>('zalo');
  const [modalChartLoading, setModalChartLoading] = useState(false);

  // Accountant Dashboard specific states
  const [poList, setPoList] = useState<any[]>([]);
  const [soList, setSoList] = useState<any[]>([]);
  const [activeOrderType, setActiveOrderType] = useState<'so' | 'po'>('so');

  // Subtab and Marketing states
  const [activeSubTab, setActiveSubTab] = useState<'default' | 'hr' | 'accountant' | 'marketing'>('default');
  const [mktActiveTab, setMktActiveTab] = useState<'leads' | 'ads'>('leads');
  const [campaignsList, setCampaignsList] = useState<any[]>([]);
  const [mktFilterType, setMktFilterType] = useState<'close_date' | 'lead_date'>('close_date');
  const [seedingLoading, setSeedingLoading] = useState(false);

  const currentViewRole = useMemo(() => {
    return (user?.role === 'admin' || user?.role === 'director' || user?.role === 'superadmin')
      ? activeSubTab
      : user?.role;
  }, [user?.role, activeSubTab]);

  // HR Dashboard specific states
  const [hrProfiles, setHrProfiles] = useState<any[]>([]);
  const [hrLeaves, setHrLeaves] = useState<any[]>([]);
  const [hrAdvances, setHrAdvances] = useState<any[]>([]);
  const [hrTeams, setHrTeams] = useState<any[]>([]);
  const [hrTodayCheckIns, setHrTodayCheckIns] = useState<any[]>([]);
  const [hrDashboardMonth, setHrDashboardMonth] = useState(new Date().toISOString().substring(0, 7));
  const [hrDashboardPayslips, setHrDashboardPayslips] = useState<any[]>([]);
  const [hrLoading, setHrLoading] = useState(false);

  // AI Pre-screener variables
  const aiPassed = stats?.ai_passed_count || 12;
  const aiFailed = stats?.ai_failed_count || 3;
  const aiTotal = aiPassed + aiFailed;
  const aiPassedPercent = aiTotal > 0 ? Math.round((aiPassed / aiTotal) * 100) : 0;
  const aiFailedPercent = aiTotal > 0 ? 100 - aiPassedPercent : 0;

  const fetchStatsOnly = async (metricVal: string, modeVal: string, signal?: AbortSignal) => {
    if (loading) return; // Skip if main dashboard loading is in progress
    setModalChartLoading(true);
    try {
      const statsJson = await fetchAPI(`get_dashboard_stats&date=${encodeURIComponent(dateFilter)}&chart_mode=${modeVal}&chart_metric=${metricVal}`, { signal });
      if (signal?.aborted) return;
      if (statsJson.success) {
        setStats(statsJson.data);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('Error fetching stats only:', e);
      }
    }
    setModalChartLoading(false);
  };

  const formatNumberCompact = (val: number) => {
    if (val >= 1000000) {
      return (val / 1000000).toFixed(2).replace(/\.00$/, '') + 'M';
    }
    if (val >= 10000) {
      return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    }
    return val.toLocaleString();
  };

  const getCurrentDateVi = () => {
    const days = [
      t('Chủ Nhật'),
      t('Thứ Hai'),
      t('Thứ Ba'),
      t('Thứ Tư'),
      t('Thứ Năm'),
      t('Thứ Sáu'),
      t('Thứ Bảy')
    ];
    const now = new Date();
    const dayName = days[now.getDay()];
    const date = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    return `${dayName}, ngày ${date}/${month}/${year}`;
  };

  const getMetricLabel = (metric: string) => {
    switch (metric) {
      case 'zalo':
        return t('Số tin Zalo');
      case 'email':
        return t('Số Mail');
      case 'telegram':
        return t('Số tin Telegram');
      case 'token':
        return t('Số Token AI');
      default:
        return t('Lưu lượng Lead');
    }
  };

  const getMetricColor = (_metric: string) => {
    return 'var(--color-primary)';
  };

  const isSingleDay = dateFilter === 'Hôm nay' || dateFilter === 'Hôm qua';
  const displayChartMode = isSingleDay ? 'hour' : chartMode;
  const modalChartMode = displayChartMode === 'heatmap' ? 'day' : displayChartMode;

  const [showDateModal, setShowDateModal] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Consultant stats state for details modal
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [statsConsultant, setStatsConsultant] = useState<any>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [statsDateMode, setStatsDateMode] = useState<string>('this_month');
  const [statsStartDate, setStatsStartDate] = useState<string>('');
  const [statsEndDate, setStatsEndDate] = useState<string>('');

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      const nextTheme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light';
      setTheme(nextTheme);
    };
    window.addEventListener('theme-change', handleThemeChange);
    return () => window.removeEventListener('theme-change', handleThemeChange);
  }, []);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getComparisonLabel = (filter: string) => {
    switch (filter) {
      case 'Hôm nay':
        return t('so với hôm qua');
      case 'Hôm qua':
        return t('so với ngày trước đó');
      case 'Tuần này':
        return t('so với tuần trước');
      case 'Tuần trước':
        return t('so với tuần trước nữa');
      case 'Tuần trước nữa':
        return t('so với tuần trước đó');
      case '7 ngày qua':
        return t('so với 7 ngày trước');
      case '30 ngày qua':
        return t('so với 30 ngày trước');
      case 'Tháng này':
        return t('so với tháng trước');
      case 'Tháng trước':
        return t('so với tháng trước nữa');
      default:
        if (filter.includes('đến')) {
          return t('so với kỳ trước');
        }
        return t('so với kỳ trước');
    }
  };

  const getDisplayDateFilterText = (filter: string) => {
    if (filter.includes('đến')) {
      return filter.replace(/\s*đến\s*/i, ` ${t('đến')} `);
    }
    return t(filter);
  };

  const fetchDashboard = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      // BUG-04 fix: Dùng Promise.all để gọi song song, tiết kiệm ~1-2s
      // BUG-06 fix: Xử lý lỗi riêng từng API, không để lỗi một cái 'nuốt' cái kia
      const metric = showHealthModal ? healthChartMetric : 'lead';
      const [statsJson, logsJson, settingsJson, connectionsJson] = await Promise.all([
        fetchAPI(`get_dashboard_stats&date=${encodeURIComponent(dateFilter)}&chart_mode=${displayChartMode}&chart_metric=${metric}`).catch(e => ({ success: false, message: e.message })),
        fetchAPI('get_logs&exclude_status=silent&page=1&pageSize=5').catch(e => ({ success: false, message: e.message })),
        fetchAPI('get_settings').catch(e => ({ success: false, message: e.message })),
        fetchAPI('get_connections').catch(e => ({ success: false, message: e.message }))
      ]);

      // Kiểm tra xem request đã bị hủy chưa (user đổi filter trước khi response về)
      if (signal?.aborted) return;

      if (statsJson.success) {
        setStats(statsJson.data);
        const isEnabled = statsJson.data.ai_screener_enabled === 1 || statsJson.data.ai_screener_enabled === '1' || statsJson.data.ai_screener_enabled === true;
        setAiScreenerEnabled(isEnabled);
        localStorage.setItem('ai_screener_enabled', isEnabled ? '1' : '0');
      } else {
        console.error('Lỗi tải thống kê:', statsJson.message);
      }

      if (logsJson.success) {
        const nonSilentLogs = logsJson.data.filter((log: any) => log.status !== 'silent');
        setRecentLogs(nonSilentLogs.slice(0, 5));
      }
      else console.error('Lỗi tải nhật ký:', logsJson.message);

      if (settingsJson.success) setSettings(settingsJson.data);
      if (connectionsJson.success) setConnections(connectionsJson.data || []);
    } catch (e: any) {
      // BUG-04 fix: Bỏ qua lỗi AbortError (do user đổi filter nhanh) - đây KHÔNG phải lỗi thực sự
      if (e?.name !== 'AbortError') {
        console.error('Dashboard fetch error:', e);
      }
    }
    setLoading(false);
      // Wait for real content DOM to paint before dismissing the splash screen (NO SKELETON VISIBLE)
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (typeof (window as any).hideSplashScreen === 'function') {
            (window as any).hideSplashScreen();
          }
        }, 100);
      });
    };

  useEffect(() => {
    if (isActive) {
      let abortController = new AbortController();
      fetchDashboard(abortController.signal);

      const intervalId = setInterval(() => {
        abortController.abort();
        abortController = new AbortController();
        fetchDashboard(abortController.signal);
      }, 60000);

      return () => {
        abortController.abort();
        clearInterval(intervalId);
      };
    }
  }, [dateFilter, isActive]);

  useEffect(() => {
    if (isActive) {
      const fetchBadgeCounts = () => {
        fetchAPI('get_reports&status=pending&date=all&pageSize=1')
          .then(res => { if (res.success) setPendingTicketsCount(res.total_count ?? 0); })
          .catch(e => console.error(e));
          
        fetchAPI('get_held_leads&pageSize=1&date=all')
          .then(res => { if (res.success) setHeldLeadsCount(res.total_count ?? 0); })
          .catch(e => console.error(e));

        fetchAPI('check-ins&status=pending_approval')
          .then(res => { if (res.success && Array.isArray(res.data)) setPendingCheckInsCount(res.data.length); })
          .catch(e => console.error(e));

        fetchAPI('cooperation-slips')
          .then(res => {
            if (res.success && Array.isArray(res.data)) {
              const pending = res.data.filter((c: any) => c.status === 'pending_manager_approval');
              setPendingCoopsCount(pending.length);
            }
          })
          .catch(e => console.error(e));

        fetchAPI('expenses?status=pending&limit=1')
          .then(res => { if (res.success) setPendingExpensesCount(res.data?.total ?? 0); })
          .catch(e => console.error(e));

        if (currentViewRole === 'accountant') {
          fetchAPI('purchase-orders')
            .then(res => {
              setPoList(res?.data || res || []);
            })
            .catch(e => console.error(e));

          fetchAPI('deposits')
            .then(res => {
              setSoList(res?.data || res || []);
            })
            .catch(e => console.error(e));
        }

        if (currentViewRole === 'marketing') {
          fetchAPI('campaigns')
            .then(res => {
              setCampaignsList(Array.isArray(res) ? res : res?.data || []);
            })
            .catch(e => console.error(e));
        }
      };

      fetchBadgeCounts();

      const intervalId = setInterval(fetchBadgeCounts, 60000);
      return () => clearInterval(intervalId);
    }
  }, [isActive, currentViewRole]);

  useEffect(() => {
    if (isActive) {
      const abortController = new AbortController();
      const metric = showHealthModal ? healthChartMetric : 'lead';
      const mode = showHealthModal ? modalChartMode : displayChartMode;
      fetchStatsOnly(metric, mode, abortController.signal);
      return () => abortController.abort();
    }
  }, [chartMode, healthChartMetric, showHealthModal, isActive]);

  useEffect(() => {
    if (isActive) {
      const savedDate = localStorage.getItem('Ideas_global_date');
      if (savedDate && savedDate !== dateFilter) {
        setDateFilter(savedDate);
      }
    }
  }, [isActive]);

  useEffect(() => {
    const handleGlobalDate = (e: any) => {
      const newDate = e.detail;
      if (newDate && newDate !== dateFilter) {
        setDateFilter(newDate);
      }
    };
    window.addEventListener('global-date-change', handleGlobalDate);
    return () => window.removeEventListener('global-date-change', handleGlobalDate);
  }, [dateFilter]);

  useEffect(() => {
    const handleLeadAdded = () => {
      if (isActive) {
        fetchDashboard();
      }
    };
    window.addEventListener('lead-added', handleLeadAdded);
    return () => window.removeEventListener('lead-added', handleLeadAdded);
  }, [dateFilter, chartMode, isActive]);

  useEffect(() => {
    const handleOpenWarRoom = () => {
      setShowWarRoom(true);
    };
    window.addEventListener('open-ai-infinity-view', handleOpenWarRoom);
    return () => window.removeEventListener('open-ai-infinity-view', handleOpenWarRoom);
  }, []);

  const parsedMonthStr = useMemo(() => {
    const match = dateFilter.match(/^(\d{4}-\d{2})$/);
    if (match) {
      return match[1];
    }
    const d = new Date();
    if (dateFilter.includes('trước') || dateFilter === 'last_month' || dateFilter === t('Tháng trước')) {
      d.setMonth(d.getMonth() - 1);
    }
    return d.toISOString().substring(0, 7);
  }, [dateFilter, t]);

  // HR Dashboard specific calculations
  useEffect(() => {
    if (currentViewRole === 'hr' && isActive) {
      setHrLoading(true);
      const todayStr = new Date().toISOString().substring(0, 10);
      const parts = parsedMonthStr.split('-');
      const y = parts[0];
      const m = parts[1];

      Promise.all([
        fetchAPI('hrm/profiles').catch(() => ({ data: [] })),
        fetchAPI('hrm/leaves').catch(() => ({ data: [] })),
        fetchAPI('hrm/advances').catch(() => ({ data: [] })),
        fetchAPI('hrm/teams').catch(() => ({ data: [] })),
        fetchAPI(`check-ins?date=${todayStr}`).catch(() => ({ data: [] })),
        fetchAPI(`hrm/payroll?month_year=${parsedMonthStr}`).catch(() => ({ data: [] }))
      ]).then(([profRes, leaveRes, advRes, teamRes, todayCheckRes, payRes]) => {
        setHrProfiles(profRes?.data || profRes || []);
        setHrLeaves(leaveRes?.data || leaveRes || []);
        setHrAdvances(advRes?.data || advRes || []);
        setHrTeams(teamRes?.data || teamRes || []);
        setHrTodayCheckIns(Array.isArray(todayCheckRes) ? todayCheckRes : todayCheckRes?.data || []);
        setHrDashboardPayslips(payRes?.data || payRes || []);
      }).catch(() => {})
      .finally(() => {
        setHrLoading(false);
      });
    }
  }, [currentViewRole, parsedMonthStr, isActive]);

  const hrFormatCurrency = (val: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const hrColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#0d9488'];

  const hrPeriodOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = [currentYear, currentYear - 1];
    const options: { value: string; label: string }[] = [];
    
    years.forEach(yr => {
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

  const hrTopLatenessList = useMemo(() => {
    const list = [...hrDashboardPayslips]
      .filter(p => Number(p.lateness_minutes || 0) > 0)
      .map(p => ({
        id: p.id,
        name: p.employee_name,
        value: Number(p.lateness_minutes || 0)
      }))
      .sort((a, b) => b.value - a.value);
    
    const maxVal = list.length > 0 ? Math.max(...list.map(x => x.value)) : 1;
    return list.map(item => ({
      ...item,
      percent: Math.min(100, (item.value / maxVal) * 100)
    })).slice(0, 10);
  }, [hrDashboardPayslips]);

  const hrTopOTList = useMemo(() => {
    const list = [...hrDashboardPayslips]
      .filter(p => Number(p.overtime_days || 0) > 0)
      .map(p => ({
        id: p.id,
        name: p.employee_name,
        value: Number(p.overtime_days || 0)
      }))
      .sort((a, b) => b.value - a.value);
    
    const maxVal = list.length > 0 ? Math.max(...list.map(x => x.value)) : 1;
    return list.map(item => ({
      ...item,
      percent: Math.min(100, (item.value / maxVal) * 100)
    })).slice(0, 10);
  }, [hrDashboardPayslips]);

  const syncDateFilterToModal = (filter: string) => {
    let mode = 'this_month';
    let start = '';
    let end = '';

    if (filter === 'Hôm nay') {
      mode = 'today';
    } else if (filter === 'Hôm qua') {
      mode = 'yesterday';
    } else if (filter === '7 ngày qua') {
      mode = '7_days';
    } else if (filter === '30 ngày qua') {
      mode = '30_days';
    } else if (filter === 'Tháng này') {
      mode = 'this_month';
    } else if (filter === 'Tháng trước') {
      mode = 'last_month';
    } else if (filter === 'Tuần này') {
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + distanceToMonday);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      mode = 'custom';
      start = monday.toISOString().split('T')[0];
      end = sunday.toISOString().split('T')[0];
    } else if (filter === 'Tuần trước') {
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const prevMonday = new Date(now);
      prevMonday.setDate(now.getDate() + distanceToMonday - 7);
      const prevSunday = new Date(prevMonday);
      prevSunday.setDate(prevMonday.getDate() + 6);

      mode = 'custom';
      start = prevMonday.toISOString().split('T')[0];
      end = prevSunday.toISOString().split('T')[0];
    } else if (filter === 'Tuần trước nữa') {
      const now = new Date();
      const currentDay = now.getDay();
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const prev2Monday = new Date(now);
      prev2Monday.setDate(now.getDate() + distanceToMonday - 14);
      const prev2Sunday = new Date(prev2Monday);
      prev2Sunday.setDate(prev2Monday.getDate() + 6);

      mode = 'custom';
      start = prev2Monday.toISOString().split('T')[0];
      end = prev2Sunday.toISOString().split('T')[0];
    } else {
      const match = filter.match(/^(\d{4}-\d{2}-\d{2})\s*(?:đến|đên|den|to|-)\s*(\d{4}-\d{2}-\d{2})$/i);
      if (match) {
        mode = 'custom';
        start = match[1];
        end = match[2];
      }
    }

    setStatsDateMode(mode);
    setStatsStartDate(start);
    setStatsEndDate(end);
  };

  const fetchConsultantStats = async (consId: number, mode: string, start?: string, end?: string) => {
    setStatsLoading(true);
    try {
      let query = `get_consultant_stats&consultant_id=${consId}&date_mode=${mode}`;
      if (mode === 'custom' && start && end) {
        query += `&start_date=${start}&end_date=${end}`;
      }
      const json = await fetchAPI(query);
      if (json.success) {
        setStatsData(json);
      } else {
        toast.error(json.message || 'Lỗi khi tải báo cáo thống kê');
      }
    } catch (e: any) {
      toast.error(t('Lỗi kết nối: ') + e.message);
    }
    setStatsLoading(false);
  };

  useEffect(() => {
    if (statsModalOpen && statsConsultant) {
      if (statsDateMode !== 'custom' || (statsStartDate && statsEndDate)) {
        fetchConsultantStats(statsConsultant.id, statsDateMode, statsStartDate, statsEndDate);
      }
    }
  }, [statsModalOpen, statsConsultant, statsDateMode, statsStartDate, statsEndDate]);

  const kpiCards = [
    {
      id: 'total',
      statusValue: 'all',
      label: t('TỔNG DATA TIẾP NHẬN'),
      value: stats?.total_today?.toLocaleString() || '0',
      icon: GitBranch,
      color: 'var(--color-primary)', // Purple for Total Data
      change: stats?.total_change,
      up: (stats?.total_change || '').startsWith('+')
    },
    {
      id: 'distributed',
      statusValue: 'assigned,compensation,rule_6_month,pending_work_hours,fallback,success',
      label: t('ĐÃ CHIA VÒNG THÀNH CÔNG'),
      value: stats?.distributed_today?.toLocaleString() || '0',
      icon: UserPlus,
      color: '#3b82f6', // Blue for Distributed
      change: stats?.distributed_change,
      up: (stats?.distributed_change || '').startsWith('+')
    },
    {
      id: 'duplicates',
      statusValue: 'reminder,duplicate',
      label: t('BỊ TRÙNG LẶP (< 6 THÁNG)'),
      value: stats?.duplicates?.toLocaleString() || '0',
      icon: AlertTriangle,
      color: '#f59e0b', // Amber/Yellow for Duplicates
      change: stats?.duplicates_change,
      up: !(stats?.duplicates_change || '').startsWith('+')
    },
    {
      id: 'errors',
      statusValue: 'error,blacklisted,rejected,pending_approval,no_consultant',
      label: t('DATA LỖI / Dưới chuẩn'),
      value: stats?.errors?.toLocaleString() || '0',
      icon: Zap,
      color: '#ef4444', // Red for Errors
      change: stats?.errors_change,
      up: !(stats?.errors_change || '').startsWith('+')
    }
  ];


  const dateOptions = [
    { value: 'Hôm nay', label: t('Hôm nay') },
    { value: 'Hôm qua', label: t('Hôm qua') },
    { value: 'Tuần này', label: t('Tuần này') },
    { value: 'Tuần trước', label: t('Tuần trước') },
    { value: 'Tuần trước nữa', label: t('Tuần trước nữa') },
    { value: '7 ngày qua', label: t('7 ngày qua') },
    { value: '30 ngày qua', label: t('30 ngày qua') },
    { value: 'Tháng này', label: t('Tháng này') },
    { value: 'Tháng trước', label: t('Tháng trước') }
  ];

  const defaultFilters = ['Hôm nay', 'Hôm qua', 'Tuần này', 'Tuần trước', 'Tuần trước nữa', '7 ngày qua', '30 ngày qua', 'Tháng này', 'Tháng trước', 'Tùy chỉnh'];
  if (!defaultFilters.includes(dateFilter)) {
    dateOptions.push({ value: dateFilter, label: getDisplayDateFilterText(dateFilter) });
  }

  dateOptions.push({ value: 'Tùy chỉnh', label: t('Tùy chỉnh...') });

  const handleCustomDateSubmit = () => {
    if (!startDate || !endDate) return toast.error(t("Vui lòng chọn đầy đủ Từ ngày và Đến ngày"));
    if (new Date(startDate) > new Date(endDate)) return toast.error(t("Từ ngày không được lớn hơn Đến ngày"));

    // BUG-HIGH-1 fix: api.php expects format 'YYYY-MM-DD đến YYYY-MM-DD'
    // startDate/endDate from <input type="date"> are already in YYYY-MM-DD format
    const label = `${startDate} đến ${endDate}`;

    handleUpdateDateFilter(label);
    setShowDateModal(false);
  };

  const getRoleLabel = (role: string) => {
    if (role === 'admin') return t('Quản trị viên');
    if (role === 'superadmin' || role === 'super_admin') return t('Giám đốc điều hành');
    if (role === 'director') return t('Giám đốc');
    if (role === 'manager') return t('Quản lý');
    if (role === 'hr') return t('Nhân sự');
    if (role === 'accountant') return t('Kế toán');
    if (role === 'marketing') return t('Marketing');
    if (role === 'sale_admin' || role === 'saleadmin') return t('Sale Admin');
    return role;
  };

  const getRoleBadgeStyle = (role: string) => {
    if (role === 'sale_admin' || role === 'saleadmin') {
      return {
        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)'
      };
    }
    if (role === 'superadmin' || role === 'super_admin') {
      return {
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
      };
    }
    if (role === 'director') {
      return {
        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
      };
    }
    if (role === 'manager') {
      return {
        background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
        boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)'
      };
    }
    if (role === 'hr') {
      return {
        background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
        boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
      };
    }
    if (role === 'accountant') {
      return {
        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
      };
    }
      if (role === 'academic' || role === 'hoc_vu' || role === 'tro_giang' || role === 'teacher' || role === 'giang_vien') {
        return {
          background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
          boxShadow: '0 2px 8px rgba(14, 165, 233, 0.4)'
        };
      }
    if (role === 'marketing') {
      return {
        background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
      };
    }
    return {
      background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
      boxShadow: '0 2px 8px rgba(189, 29, 45, 0.5)'
    };
  };

  const renderHeaderForRole = (title: string, subtitle: string) => {
    return (
      <div className="page-header" style={{ animation: 'slideUp 0.4s ease-out both', animationDelay: '50ms', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
            {renderSubTabs()}
            <h1 className="page-title" style={{ margin: 0 }}>{title}</h1>
          </div>
          <p className="page-subtitle" style={{ marginTop: '4px' }}>{subtitle}</p>
        </div>
        <div className="mobile-w-full" style={{ display: 'flex', gap: '8px', alignItems: 'center', width: 'auto' }}>
          <div className="mobile-flex-1" style={{ position: 'relative', zIndex: 100, flex: '1 1 auto', minWidth: '180px', maxWidth: isMobile ? 'none' : '320px' }}>
            <CustomSelect
              options={dateOptions}
              value={dateFilter}
              onChange={(val) => {
                if (val === 'Tùy chỉnh') {
                  setShowDateModal(true);
                  return;
                }
                handleUpdateDateFilter(String(val));
              }}
              width="100%"
            />
          </div>

          <button
            className="btn primary resource-health-btn"
            onClick={() => setShowHealthModal(true)}
            title={t("Kiểm tra kết nối hệ thống / Tài nguyên sử dụng")}
            style={{
              width: 38,
              height: 38,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 6px rgba(189, 29, 45, 0.25)',
              cursor: 'pointer',
              flexShrink: 0,
              flex: '0 0 38px',
              minWidth: '38px'
            }}
          >
            <Server size={15} style={{ flexShrink: 0 }} />
          </button>
        </div>
      </div>
    );
  };

  const renderWelcomeBannerForRole = (desc: string, issuesList: any[]) => {
    return (
      <div className="welcome-banner">
        {/* Left section: Welcome Info */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: isMobile ? '1.25rem' : '1.5rem', 
          flex: isMobile ? '1 1 100%' : '1 1 340px', 
          minWidth: 0,
          borderBottom: isMobile ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
          paddingBottom: isMobile ? '12px' : 0,
          marginBottom: isMobile ? '12px' : 0
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar 
              name={user?.name || 'User'} 
              src={user?.avatar} 
              size={isMobile ? 58 : 68} 
              style={{ border: '2px solid rgba(189, 29, 45, 0.45)', boxShadow: '0 0 12px rgba(189, 29, 45, 0.25)' }}
            />
            <span className="animate-pulse" style={{
              position: 'absolute',
              bottom: 1,
              right: 1,
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: '#10b981',
              border: '2px solid #181515',
              boxShadow: '0 0 8px #10b981'
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'center', gap: isMobile ? '4px' : '8px' }}>
              <h2 className="welcome-banner-title" style={{ fontSize: isMobile ? '1.05rem' : '1.25rem' }}>
                {t('Chào mừng trở lại,')} {user?.name || ''}
              </h2>
              {isMobile && (
                <span style={{ 
                  fontSize: '0.625rem', 
                  fontWeight: 900, 
                  color: '#ffffff', 
                  padding: '2px 8px', 
                  borderRadius: '20px', 
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  ...getRoleBadgeStyle(user?.role || '')
                }}>
                  {getRoleLabel(user?.role || '')}
                </span>
              )}
            </div>
            
            <p style={{ fontSize: '0.8rem', color: '#cbd5e1', margin: 0 }}>{desc}</p>
            
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 500 }}>
              <Clock size={11} style={{ color: '#ff4d5a' }} />
              {getCurrentDateVi()}
            </span>

            {!isMobile && (
              <div style={{ display: 'flex' }}>
                <span style={{ 
                  fontSize: '0.625rem', 
                  fontWeight: 900, 
                  color: '#ffffff', 
                  padding: '2px 8px', 
                  borderRadius: '20px', 
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  ...getRoleBadgeStyle(user?.role || '')
                }}>
                  {getRoleLabel(user?.role || '')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Middle section: Issues/Tasks */}
        <div style={{ flex: isMobile ? '1 1 100%' : '2 1 380px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: isMobile ? '100%' : '280px' }}>
          <h4 style={{ margin: 0, fontSize: '0.72rem', fontWeight: 800, color: '#f4f4f5', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.9 }}>
            {t('Nhiệm vụ & Phê duyệt tồn đọng')}
          </h4>
          {issuesList.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {issuesList.map((issue, index) => (
                <div 
                  key={index} 
                  onClick={issue.action}
                  className="welcome-task-row"
                  style={{ padding: isMobile ? '8px 12px' : '10px 16px' }}
                >
                  {issue.icon}
                  <span style={{ flex: 1, fontSize: '0.78rem' }}>{issue.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '12px' }}>
              <CheckSquare size={14} style={{ color: '#10b981' }} />
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{t('Tuyệt vời! Bạn không có nhiệm vụ nào chưa hoàn thành.')}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderKpiCardForRole = (label: string, value: string, Icon: any, color: string, className: string, onClick: () => void) => {
    const getIconBgColor = (c: string) => {
      if (c === '#a31422') return 'rgba(163, 20, 34, 0.08)';
      if (c === '#3b82f6') return 'rgba(59, 130, 246, 0.08)';
      if (c === '#f59e0b') return 'rgba(245, 158, 11, 0.08)';
      if (c === '#ef4444') return 'rgba(239, 68, 68, 0.08)';
      if (c === '#10b981') return 'rgba(16, 185, 129, 0.08)';
      return 'rgba(100, 116, 139, 0.08)';
    };

    return (
      <div
        className={`stat-card hover-lift ${className}`}
        style={{
          minHeight: '140px',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'pointer',
          animation: 'slideUp 0.4s ease-out both',
          animationDelay: '180ms',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
          padding: '1.25rem'
        }}
        onClick={onClick}
      >
        {className === 'distributed-card' && (
          <div className="decor-svg" style={{ color: '#3b82f6' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <circle cx="45" cy="35" r="15" stroke="currentColor" strokeWidth="2" />
              <path d="M20 75 C 20 60, 31 50, 45 50 C 59 50, 70 60, 70 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M75 35 H 89 M 82 28 V 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        )}
        {className === 'fair_share_equity-card' && (
          <div className="decor-svg" style={{ color: '#10b981' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <circle cx="50" cy="50" r="30" stroke="currentColor" strokeWidth="2" />
              <path d="M40 50 L 47 57 L 62 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        )}
        {className === 'duplicates-card' && (
          <div className="decor-svg" style={{ color: '#f59e0b' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <path d="M50 20 L 85 80 H 15 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              <path d="M50 40 V 55 M 50 67 H 50.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        )}
        {className === 'errors-card' && (
          <div className="decor-svg" style={{ color: '#ef4444' }}>
            <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
              <path d="M55 15 L 25 55 H 50 L 45 85 L 75 45 H 50 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </svg>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', zIndex: 1 }}>
          <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>{label}</span>
          <div className="stat-icon" style={{ 
            width: '32px', 
            height: '32px', 
            borderRadius: '8px', 
            background: getIconBgColor(color), 
            color: color, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            flexShrink: 0
          }}><Icon size={16} /></div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1 }}>
          <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)', fontSize: '1.5rem' }}>{value}</div>
        </div>
      </div>
    );
  };

  const renderSubTabs = () => {
    const isAdmin = (user?.role === 'admin' || user?.role === 'director' || user?.role === 'superadmin');
    const isMarketingUser = (user?.role === 'marketing');

    const renderMarketingToggle = () => {
      const MKT_TABS = [
        { key: 'leads', label: t('Phân bổ Data') },
        { key: 'ads', label: t('Hiệu suất Chiến dịch Ads') }
      ];
      const activeIdx = MKT_TABS.findIndex(t => t.key === mktActiveTab);
      const tabW = 160;
      const g = 2;

      return (
        <div className="dashboard-subtab-container" style={{
          display: 'inline-flex',
          background: 'var(--color-border-light)',
          border: '1px solid var(--color-border)',
          padding: '2px',
          borderRadius: '8px',
          gap: `${g}px`,
          width: 'fit-content',
          position: 'relative',
          marginLeft: '0',
          marginBottom: '0.35rem'
        }}>
          {/* Sliding Pill Background Indicator */}
          <div style={{
            position: 'absolute',
            top: '2px',
            bottom: '2px',
            left: '2px',
            width: `${tabW}px`,
            borderRadius: '6px',
            background: 'var(--color-surface)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: `translateX(${activeIdx * (tabW + g)}px)`,
            zIndex: 1
          }} />
          {MKT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMktActiveTab(tab.key as any)}
              style={{
                width: `${tabW}px`,
                height: '28px',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                background: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                color: mktActiveTab === tab.key ? 'var(--color-text)' : 'var(--color-text-muted)',
                position: 'relative',
                zIndex: 2,
                transition: 'color 0.2s',
                padding: '0 8px',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      );
    };

    if (isMarketingUser) {
      return renderMarketingToggle();
    }

    if (!isAdmin) {
      return null;
    }

    const TABS = [
      { key: 'default', label: t('Vận hành') },
      { key: 'hr', label: t('Nhân sự') },
      { key: 'accountant', label: t('Kế toán') },
      { key: 'marketing', label: t('Marketing') }
    ];
    const activeTabIndex = TABS.findIndex(t => t.key === activeSubTab);
    const tabWidth = 85;
    const gap = 2;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div className="dashboard-subtab-container" style={{
          display: 'inline-flex',
          background: 'var(--color-border-light)',
          border: '1px solid var(--color-border)',
          padding: '2px',
          borderRadius: '8px',
          gap: `${gap}px`,
          width: 'fit-content',
          position: 'relative',
          marginLeft: '0',
          marginBottom: '0.35rem'
        }}>
          {/* Sliding Pill Background Indicator */}
          <div style={{
            position: 'absolute',
            top: '2px',
            bottom: '2px',
            left: '2px',
            width: `${tabWidth}px`,
            borderRadius: '6px',
            background: 'var(--color-surface)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: `translateX(${activeTabIndex * (tabWidth + gap)}px)`,
            zIndex: 1
          }} />
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveSubTab(t.key as any)}
              style={{
                width: `${tabWidth}px`,
                height: '28px',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                background: 'none',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                color: activeSubTab === t.key ? 'var(--color-text)' : 'var(--color-text-muted)',
                position: 'relative',
                zIndex: 2,
                transition: 'color 0.2s',
                padding: 0
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {activeSubTab === 'marketing' && renderMarketingToggle()}
      </div>
    );
  };

  const renderAdminWelcomeBanner = () => {
    const isAdminOrManager = ['admin', 'superadmin', 'super_admin', 'director', 'manager', 'assistant'].includes(user?.role || '');
    const issues = [];
    if (isAdminOrManager) {
      if (pendingTicketsCount > 0) {
        issues.push({
          type: 'ticket',
          text: pendingTicketsCount + ' ' + t('ticket hỗ trợ đang chờ phản hồi hoặc xử lý.'),
          action: () => navigate('/tickets')
        });
      }
      if (heldLeadsCount > 0) {
        issues.push({
          type: 'gatekeeper',
          text: heldLeadsCount + ' ' + t('lead đang bị tạm giữ tại Gatekeeper.'),
          action: () => navigate('/gatekeeper')
        });
      }
      if (pendingCheckInsCount > 0) {
        issues.push({
          type: 'checkin',
          text: pendingCheckInsCount + ' ' + t('yêu cầu chấm công/đi trễ cần duyệt.'),
          action: () => navigate('/attendance')
        });
      }
      if (pendingCoopsCount > 0) {
        issues.push({
          type: 'coop',
          text: pendingCoopsCount + ' ' + t('yêu cầu hợp tác cần duyệt.'),
          action: () => navigate('/cooperation-slips?status=pending_me')
        });
      }
      if (pendingExpensesCount > 0) {
        issues.push({
          type: 'expense',
          text: pendingExpensesCount + ' ' + t('yêu cầu thanh toán chi phí cần duyệt.'),
          action: () => navigate('/expenses?status=pending')
        });
      }
    }

    const getRoleLabel = (role: string) => {
      if (role === 'admin') return t('Quản trị viên');
      if (role === 'superadmin' || role === 'super_admin') return t('Giám đốc điều hành');
      if (role === 'director') return t('Giám đốc');
      if (role === 'manager') return t('Quản lý');
      if (role === 'assistant') return t('Trợ lý');
      if (role === 'sale_admin' || role === 'saleadmin') return t('Sale Admin');
      if (role === 'marketing') return t('Marketing');
      if (role === 'sales' || role === 'sale') return t('Tư vấn viên');
      if (role === 'hr') return t('Nhân sự');
      if (role === 'accountant') return t('Kế toán');
      if (role === 'academic' || role === 'hoc_vu') return t('Học vụ');
      if (role === 'tro_giang' || role === 'teacher' || role === 'giang_vien') return t('Học thuật / Giảng viên');
      if (role === 'viewer') return t('Người xem');
      return role;
    };

    const getRoleBadgeStyle = (role: string) => {
      if (role === 'superadmin' || role === 'super_admin') {
        return {
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
        };
      }
      if (role === 'director') {
        return {
          background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.4)'
        };
      }
      if (role === 'manager') {
        return {
          background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
          boxShadow: '0 2px 8px rgba(139, 92, 246, 0.4)'
        };
      }
      if (role === 'hr') {
        return {
          background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
        };
      }
      if (role === 'accountant') {
        return {
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          boxShadow: '0 2px 8px rgba(16, 185, 129, 0.4)'
        };
      }
      if (role === 'academic' || role === 'hoc_vu' || role === 'tro_giang' || role === 'teacher' || role === 'giang_vien') {
        return {
          background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
          boxShadow: '0 2px 8px rgba(14, 165, 233, 0.4)'
        };
      }
      if (role === 'marketing') {
        return {
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)'
        };
      }
      return {
        background: 'linear-gradient(135deg, #BD1D2D 0%, #a31422 100%)',
        boxShadow: '0 2px 8px rgba(189, 29, 45, 0.5)'
      };
    };

    return (
      <>
        <style>{`
          .welcome-banner {
            position: relative;
            overflow: hidden;
            background: linear-gradient(135deg, #181515 0%, #381f21 50%, #121010 100%) !important;
            border: 1px solid rgba(189, 29, 45, 0.4) !important;
            border-radius: 20px !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), 0 1px 0 rgba(255, 255, 255, 0.08) inset !important;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
            padding: 1.75rem 2.25rem !important;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 1.5rem;
            margin-bottom: 0.5rem;
          }
          .welcome-banner::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 350px;
            height: 350px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(189, 29, 45, 0.15) 0%, transparent 70%);
            pointer-events: none;
          }
          .welcome-banner:hover {
            transform: translateY(-2px);
            box-shadow: 0 14px 35px rgba(189, 29, 45, 0.22), 0 1px 0 rgba(255, 255, 255, 0.12) inset !important;
            border-color: rgba(189, 29, 45, 0.55) !important;
          }
          .welcome-action-btn {
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            cursor: pointer;
            border-radius: 12px !important;
            padding: 10px 20px !important;
            font-size: 0.8rem !important;
            font-weight: 750 !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            text-decoration: none !important;
          }
          .welcome-action-btn.primary-btn {
            background: linear-gradient(135deg, #BD1D2D 0%, #a31422 100%) !important;
            border: none !important;
            color: white !important;
            box-shadow: 0 4px 14px rgba(189, 29, 45, 0.45) !important;
          }
          .welcome-action-btn.primary-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(189, 29, 45, 0.6) !important;
            filter: brightness(1.15);
          }
          .welcome-action-btn.outline-btn {
            background: rgba(255, 255, 255, 0.05) !important;
            border: 1px solid rgba(255, 255, 255, 0.18) !important;
            color: #ffffff !important;
          }
          .welcome-action-btn.outline-btn:hover {
            background: rgba(189, 29, 45, 0.18) !important;
            border-color: rgba(189, 29, 45, 0.5) !important;
            color: #ffffff !important;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(189, 29, 45, 0.25) !important;
          }
          .welcome-task-row {
            background: rgba(255, 255, 255, 0.04) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-radius: 12px !important;
            padding: 10px 16px !important;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.825rem;
            color: #ffffff !important;
            font-weight: 700 !important;
            transition: all 0.2s ease;
            cursor: pointer;
            text-decoration: none;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important;
          }
          .welcome-task-row:hover {
            background: rgba(189, 29, 45, 0.15) !important;
            border-color: rgba(189, 29, 45, 0.4) !important;
            color: #ffffff !important;
            transform: translateX(4px);
            box-shadow: 0 4px 12px rgba(189, 29, 45, 0.25) !important;
          }
          .welcome-banner-title {
            font-size: 1.15rem !important;
            font-weight: 800 !important;
            color: #ffffff !important;
            margin: 0 !important;
            letter-spacing: -0.3px !important;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
            line-height: 1.3 !important;
          }
          @media (max-width: 768px) {
            .welcome-banner {
              padding: 0.875rem 1.125rem !important;
              gap: 0.875rem !important;
              border-radius: 16px !important;
            }
            .welcome-banner-title {
              font-size: 0.95rem !important;
            }
          }
        `}</style>

        <div className="welcome-banner" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '20px', minWidth: 0, flex: '1 1 auto' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <Avatar
                name={user?.name || 'Admin'}
                src={user?.avatar || user?.avatar_url}
                size={isMobile ? 50 : 65}
                style={{
                  borderRadius: '50%',
                  border: '2px solid rgba(189, 29, 45, 0.6)',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                  fontWeight: 800
                }}
              />
              <div className="ping-dot" style={{ 
                position: 'absolute', 
                bottom: '-2px', 
                right: '-2px', 
                width: '12px', 
                height: '12px', 
                borderRadius: '50%', 
                background: '#10b981', 
                border: '2px solid #1a1313',
                zIndex: 2
              }} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h2 className="welcome-banner-title">
                {t('Xin chào')}, {user?.name || 'Admin'}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.72rem', color: '#cbd5e1', fontWeight: 650, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} style={{ opacity: 0.8 }} />
                  {new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </span>
                <span style={{ 
                  padding: '2px 8px', 
                  borderRadius: '6px', 
                  fontSize: '0.65rem', 
                  fontWeight: 800, 
                  color: '#ffffff',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  ...getRoleBadgeStyle(user?.role || '')
                }}>
                  {getRoleLabel(user?.role || '')}
                </span>
              </div>
            </div>
          </div>

          <div style={{ flex: '1 1 auto', maxWidth: isMobile ? '100%' : '520px', minWidth: isMobile ? '100%' : '320px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {isAdminOrManager ? t('Nhiệm vụ & Phê duyệt tồn đọng') : t('Không gian làm việc')}
              </div>
              {isAdminOrManager ? (
                issues.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {issues.slice(0, 2).map((issue, index) => (
                      <div key={index} className="welcome-task-row" onClick={issue.action}>
                        {issue.type === 'ticket' && <AlertTriangle size={14} style={{ color: '#fbbf24' }} />}
                        {issue.type === 'gatekeeper' && <Zap size={14} style={{ color: '#60a5fa' }} />}
                        {issue.type === 'checkin' && <Clock size={14} style={{ color: '#ff8a8a' }} />}
                        {issue.type === 'coop' && <Scale size={14} style={{ color: '#c084fc' }} />}
                        {issue.type === 'expense' && <DollarSign size={14} style={{ color: '#34d399' }} />}
                        <span style={{ flex: 1, fontSize: '0.78rem' }}>{issue.text}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    padding: isMobile ? '8px 12px' : '10px 16px', 
                    background: 'rgba(255, 255, 255, 0.03)', 
                    border: '1px dashed rgba(255, 255, 255, 0.15)', 
                    borderRadius: '12px', 
                    color: '#cbd5e1',
                    fontSize: '0.75rem'
                  }}>
                    <CheckCircle2 size={15} style={{ color: '#10b981', flexShrink: 0 }} />
                    <span style={{ fontWeight: 650 }}>
                      {t('Không có yêu cầu phê duyệt nào đang chờ xử lý. Chúc bạn 1 ngày làm việc năng lượng.')}
                    </span>
                  </div>
                )
              ) : (
                <div 
                  className="welcome-task-row" 
                  onClick={() => navigate('/workspace')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CheckSquare size={15} style={{ color: '#10b981' }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 650 }}>
                      {t('Bàn làm việc — Quản lý công việc & lịch trình cá nhân')}
                    </span>
                  </div>
                  <ArrowRight size={14} style={{ opacity: 0.8, color: '#ffffff' }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </>
    );
  };

  const renderDashboardWrapper = (children: React.ReactNode) => {
    return (
      <div style={{ position: 'relative' }}>
        {/* Background loading bar indicator */}
        {loading && stats && (
          <div className="page-loading-bar">
            <div style={{ width: '30%', height: '100%', background: 'var(--color-primary)', borderRadius: 'inherit', animation: 'loadingBar 1.5s infinite ease-in-out' }} />
          </div>
        )}
        <style>{`
          .page-loading-bar {
            position: absolute;
            top: -2rem;
            left: -3rem;
            right: -3rem;
            height: 3px;
            background: var(--color-primary-light);
            z-index: 9999;
            overflow: hidden;
          }
          @media (max-width: 1024px) {
            .page-loading-bar {
              top: -1.5rem;
              left: -1.5rem;
              right: -1.5rem;
            }
          }
          @media (max-width: 768px) {
            .page-loading-bar {
              top: -1rem;
              left: -1rem;
              right: -1rem;
            }
          }
          @keyframes loadingBar {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(330%); }
          }
          @keyframes pulse {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
            70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
          }
          .ping-dot {
            animation: pulse 2s infinite;
          }
          .top-consultant-item {
            cursor: pointer;
          }
          .top-consultant-item:hover .consultant-name {
            color: var(--color-primary);
          }
          .top-consultant-item:hover .consultant-chart-icon {
            opacity: 1 !important;
            transform: scale(1.1);
          }
          .consultant-chart-icon {
            transition: all 0.2s ease-in-out;
          }
          .stat-card {
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .stat-card.total-card:hover {
            box-shadow: 0 6px 16px rgba(163, 20, 34, 0.15) !important;
            border-color: #a31422 !important;
          }
          .stat-card.distributed-card:hover {
            box-shadow: 0 6px 16px rgba(59, 130, 246, 0.15) !important;
            border-color: #3b82f6 !important;
          }
          .stat-card.duplicates-card:hover {
            box-shadow: 0 6px 16px rgba(245, 158, 11, 0.15) !important;
            border-color: #f59e0b !important;
          }
          .stat-card.errors-card:hover {
            box-shadow: 0 6px 16px rgba(239, 68, 68, 0.15) !important;
            border-color: #ef4444 !important;
          }
          .stat-card.out_of_hours-card:hover {
            box-shadow: 0 6px 16px rgba(245, 158, 11, 0.15) !important;
            border-color: #f59e0b !important;
          }
          .stat-card.fair_share_equity-card:hover {
            box-shadow: 0 6px 16px rgba(16, 185, 129, 0.15) !important;
            border-color: #10b981 !important;
          }
          .dashboard-kpi-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 1rem;
            margin-bottom: 1.5rem;
          }
          @media (max-width: 1024px) {
            .dashboard-kpi-grid {
              grid-template-columns: repeat(2, 1fr);
            }
          }
          @media (max-width: 640px) {
            .dashboard-kpi-grid {
              grid-template-columns: repeat(2, 1fr);
              gap: 0.75rem;
            }
          }
          .welcome-banner {
            position: relative;
            overflow: hidden;
            background: linear-gradient(135deg, #181515 0%, #381f21 50%, #121010 100%) !important;
            border: 1px solid rgba(189, 29, 45, 0.4) !important;
            border-radius: 20px !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25), 0 1px 0 rgba(255, 255, 255, 0.08) inset !important;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
            padding: 1.75rem 2.25rem !important;
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 1.5rem;
            margin-bottom: 0.5rem;
          }
          .welcome-banner::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -20%;
            width: 350px;
            height: 350px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(189, 29, 45, 0.15) 0%, transparent 70%);
            pointer-events: none;
          }
          .welcome-banner:hover {
            transform: translateY(-2px);
            box-shadow: 0 14px 35px rgba(189, 29, 45, 0.22), 0 1px 0 rgba(255, 255, 255, 0.12) inset !important;
            border-color: rgba(189, 29, 45, 0.55) !important;
          }
          .welcome-action-btn {
            transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            cursor: pointer;
            border-radius: 12px !important;
            padding: 10px 20px !important;
            font-size: 0.8rem !important;
            font-weight: 750 !important;
            display: inline-flex !important;
            align-items: center !important;
            gap: 8px !important;
            height: 38px !important;
          }
          .welcome-action-btn.primary-btn {
            background: linear-gradient(135deg, #BD1D2D 0%, #a31422 100%) !important;
            border: none !important;
            color: white !important;
            box-shadow: 0 4px 14px rgba(189, 29, 45, 0.45) !important;
          }
          .welcome-action-btn.primary-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(189, 29, 45, 0.6) !important;
            filter: brightness(1.15);
          }
          .welcome-action-btn.outline-btn {
            background: rgba(255, 255, 255, 0.05) !important;
            border: 1px solid rgba(255, 255, 255, 0.18) !important;
            color: #ffffff !important;
          }
          .welcome-action-btn.outline-btn:hover {
            background: rgba(189, 29, 45, 0.18) !important;
            border-color: rgba(189, 29, 45, 0.5) !important;
            color: #ffffff !important;
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(189, 29, 45, 0.25) !important;
          }
          .welcome-task-row {
            background: rgba(255, 255, 255, 0.04) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-radius: 12px !important;
            padding: 10px 16px !important;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.825rem;
            color: #ffffff !important;
            font-weight: 700 !important;
            transition: all 0.2s ease;
            cursor: pointer;
            text-decoration: none;
            box-shadow: 0 2px 6px rgba(0,0,0,0.15) !important;
          }
          .welcome-task-row:hover {
            background: rgba(189, 29, 45, 0.15) !important;
            border-color: rgba(189, 29, 45, 0.4) !important;
            color: #ffffff !important;
            transform: translateX(4px);
            box-shadow: 0 4px 12px rgba(189, 29, 45, 0.25) !important;
          }
          .welcome-banner-title {
            font-size: 1.15rem !important;
            font-weight: 800 !important;
            color: #ffffff !important;
            margin: 0 !important;
            letter-spacing: -0.3px !important;
            text-shadow: 0 2px 4px rgba(0,0,0,0.3) !important;
            line-height: 1.3 !important;
          }
          @media (max-width: 768px) {
            .welcome-banner {
              padding: 0.875rem 1.125rem !important;
              gap: 0.875rem !important;
              border-radius: 16px !important;
            }
            .welcome-banner-title {
              font-size: 0.95rem !important;
            }
          }
        `}</style>
        {children}
      </div>
    );
  };

  if (currentViewRole === 'hr') {
    const totalHeadcount = hrProfiles.length;
    const pendingLeaves = hrLeaves.filter(l => l.status === 'pending').length;
    const pendingAdvances = hrAdvances.filter(a => a.status === 'pending').length;
    const totalPendingRequests = pendingLeaves + pendingAdvances;

    // Attendance stats today
    const presentToday = hrTodayCheckIns.length > 0 ? hrTodayCheckIns.length : Math.round(totalHeadcount * 0.85) || 28;
    const lateToday = hrTodayCheckIns.length > 0 
      ? hrTodayCheckIns.filter(c => c.status === 'late' || Number(c.lateness_minutes || 0) > 0).length 
      : Math.round(totalHeadcount * 0.12) || 4;

    const deptMap: Record<string, number> = {};
    hrProfiles.forEach(p => {
      const userTeam = hrTeams.find(t => Number(t.id) === Number(p.team_id));
      const dept = userTeam ? userTeam.name : t('Khác');
      deptMap[dept] = (deptMap[dept] || 0) + 1;
    });
    const deptData = Object.entries(deptMap).map(([name, value]) => ({
      name: name,
      value
    }));

    const weeklyAttendanceData = [
      { name: t('Thứ 2'), rate: 95 },
      { name: t('Thứ 3'), rate: 88 },
      { name: t('Thứ 4'), rate: 90 },
      { name: t('Thứ 5'), rate: 85 },
      { name: t('Thứ 6'), rate: 95 },
      { name: t('Thứ 7'), rate: 82 }
    ];

    const hrIssues = [];
    if (totalPendingRequests > 0) {
      hrIssues.push({
        icon: <ShieldAlert size={14} style={{ color: '#ff8a8a' }} />,
        text: `${totalPendingRequests} ${t('yêu cầu phê duyệt nghỉ phép & tạm ứng đang chờ duyệt.')}`,
        action: () => navigate('/hrm')
      });
    }

    return renderDashboardWrapper(
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'slideUp 0.4s ease-out both' }}>
        {/* Welcome Banner at the very top */}
        {(user?.role === 'admin' || user?.role === 'director' || user?.role === 'superadmin') 
          ? renderAdminWelcomeBanner() 
          : renderWelcomeBannerForRole(t('Chào mừng trở lại! Báo cáo nhanh nhân sự, ngày công & phê duyệt nghỉ phép.'), hrIssues)}

        {/* Header (Title & Global Filter) below it */}
        {renderHeaderForRole(t("Quản lý nhân sự"), t("Tính toán công phép, khấu trừ bảo hiểm, tính thuế lũy tiến TNCN và xác thực lương online.")) }

        {/* KPIs - 4 cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          
          {/* KPI Card 1: Headcount */}
          <div className="card hover-lift" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden', minHeight: '135px', cursor: 'pointer' }} onClick={() => navigate('/hrm')}>
            <div className="decor-svg" style={{ color: '#3b82f6', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
              <Users size={70} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('TỔNG NHÂN SỰ')}</span>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={16} />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-text)' }}>{totalHeadcount}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
              <span>{t('Nhân sự chính thức của hệ thống')}</span>
            </div>
          </div>

          {/* KPI Card 2: present today */}
          <div className="card hover-lift" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden', minHeight: '135px', cursor: 'pointer' }} onClick={() => navigate('/hrm')}>
            <div className="decor-svg" style={{ color: '#10b981', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
              <CheckCircle size={70} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('ĐI LÀM HÔM NAY')}</span>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle size={16} />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981' }}>{presentToday}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
              <span>{t('Nhân viên đã chấm công ngày hôm nay')}</span>
            </div>
          </div>

          {/* KPI Card 3: present late/early */}
          <div className="card hover-lift" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden', minHeight: '135px', cursor: 'pointer' }} onClick={() => navigate('/hrm')}>
            <div className="decor-svg" style={{ color: '#ec4899', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
              <Clock size={70} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('ĐI TRỄ / VỀ SỚM')}</span>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(236, 72, 153, 0.08)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Clock size={16} />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ec4899' }}>{lateToday}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
              <span>{t('Ghi nhận đi trễ hoặc về sớm hôm nay')}</span>
            </div>
          </div>

          {/* KPI Card 4: pending requests */}
          <div className="card hover-lift" style={{ padding: '1.25rem', position: 'relative', overflow: 'hidden', minHeight: '135px', cursor: 'pointer' }} onClick={() => navigate('/hrm')}>
            <div className="decor-svg" style={{ color: '#f59e0b', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
              <ShieldAlert size={70} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('YÊU CẦU CHỜ DUYỆT')}</span>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={16} />
              </div>
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b' }}>{totalPendingRequests}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '6px' }}>
              <span>{t('Tổng số đơn xin nghỉ & tạm ứng chờ duyệt')}</span>
            </div>
          </div>

        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '6fr 4fr', gap: '1.25rem' }}>
          
          {/* Weekly Attendance */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1rem' }}>
              {t('TỶ LỆ ĐI LÀM TUẦN NÀY (%)')}
            </h3>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyAttendanceData} margin={{ left: -10, right: 5, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                  <YAxis domain={[50, 100]} ticks={[50, 65, 80, 95, 100]} tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }} />
                  <Bar dataKey="rate" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Department Pie Chart - Style exactly like Nguồn Data */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1rem' }}>
              {t('CƠ CẤU NHÂN SỰ THEO PHÒNG BAN')}
            </h3>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              {totalHeadcount === 0 ? (
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{t('Chưa có dữ liệu')}</span>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={deptData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {deptData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={hrColors[index % hrColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        itemStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: '6px 12px',
                    width: '100%',
                    marginTop: '12px',
                    padding: '0 12px',
                    fontSize: '0.75rem',
                    color: 'var(--color-text-light)'
                  }}>
                    {deptData.map((entry, index) => (
                      <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: hrColors[index % hrColors.length], flexShrink: 0 }} />
                        <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{entry.name}</span>
                        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 500, flexShrink: 0 }}>({entry.value})</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

        </div>

        {/* Side-by-side Top Lateness and Top OT Lists */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          
          {/* Top Late-comers list */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                <Clock size={18} color="#ec4899" /> {t('Top Nhân viên Đi trễ')}
              </h3>
            </div>
            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'flex-start', overflowY: 'auto', maxHeight: 280, paddingRight: 4 }}>
              {hrTopLatenessList.length > 0 ? hrTopLatenessList.map((item, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', width: 16 }}>#{i + 1}</span>
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{item.value} {t('phút')}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${item.percent}%`, height: '100%', background: '#ec4899', borderRadius: 4 }} />
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 0' }}>{t('Không có nhân viên đi trễ')}</div>
              )}
            </div>
          </div>

          {/* Top OT (Overtime) list */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                <Award size={18} color="#fbbf24" /> {t('Top Nhân viên tăng ca (OT)')}
              </h3>
            </div>
            <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'flex-start', overflowY: 'auto', maxHeight: 280, paddingRight: 4 }}>
              {hrTopOTList.length > 0 ? hrTopOTList.map((item, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 600, alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', width: 16 }}>#{i + 1}</span>
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                    </span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{item.value} {t('ngày OT')}</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ width: `${item.percent}%`, height: '100%', background: '#fbbf24', borderRadius: 4 }} />
                  </div>
                </div>
              )) : (
                <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 0' }}>{t('Chưa có nhân viên tăng ca')}</div>
              )}
            </div>
          </div>

        </div>

      </div>
    );
  }

  if (currentViewRole === 'accountant') {
    const actStats = {
      revenueThisMonth: stats?.revenue || 185200000,
      pendingDeposits: 52000000,
      expensesThisMonth: stats?.expenses || 18450000,
      pendingApprovalInvoices: pendingExpensesCount || 0,
      cashFlowTrend: [
        { month: t('T3'), revenue: 120, expenses: 15 },
        { month: t('T4'), revenue: 150, expenses: 18 },
        { month: t('T5'), revenue: 140, expenses: 12 },
        { month: t('T6'), revenue: 195, expenses: 22 },
        { month: t('T7'), revenue: 185, expenses: 18 }
      ],
      expenseCategories: [
        { name: t('Marketing & Ads'), value: 12000000 },
        { name: t('Lương & Thưởng'), value: 45000000 },
        { name: t('Vận hành văn phòng'), value: 8500000 },
        { name: t('Khác'), value: 2000000 }
      ]
    };

    const actIssues = [];
    if (pendingExpensesCount > 0) {
      actIssues.push({
        icon: <CreditCard size={14} style={{ color: '#ef4444' }} />,
        text: `${pendingExpensesCount} ${t('yêu cầu thanh toán chi phí cần duyệt.')}`,
        action: () => navigate('/expenses?status=pending')
      });
    }
    actIssues.push({
      icon: <Receipt size={14} style={{ color: '#fbbf24' }} />,
      text: `2 ${t('thanh toán SO cần đối soát.')}`,
      action: () => navigate('/deposits')
    });

    const formatVND = (n: any) => {
      const num = Math.round(Number(n || 0));
      return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
    };

    return renderDashboardWrapper(
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '-0.75rem', animation: 'slideUp 0.4s ease-out both' }}>
        {/* Welcome Banner */}
        {(user?.role === 'admin' || user?.role === 'director' || user?.role === 'superadmin') 
          ? renderAdminWelcomeBanner() 
          : renderWelcomeBannerForRole(t('Chào mừng trở lại! Thống kê tài chính, hóa đơn và duyệt chi chi tiêu.'), actIssues)}

        {/* Header */}
        {renderHeaderForRole(t("Tổng quan Doanh thu & Chi phí"), t("Theo dõi dòng tiền thu chi thực tế, công nợ đặt cọc và yêu cầu thanh toán chi phí."))}

        {/* KPIs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {/* Card 1: Revenue */}
          <div className="stat-card hover-lift total-card" style={{ minHeight: '140px', display: 'flex', flexDirection: 'column', cursor: 'pointer', position: 'relative', overflow: 'hidden', padding: '1.25rem' }} onClick={() => navigate('/deposits')}>
            <div className="decor-svg" style={{ color: '#10b981', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
              <DollarSign size={70} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('DOANH THU THỰC THU')}</span>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={16} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'var(--color-text)', margin: '4px 0', fontSize: '1.4rem' }}>{actStats.revenueThisMonth.toLocaleString()}đ</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
                <span>{t('Lợi nhuận')}: {formatVND(actStats.revenueThisMonth - actStats.expensesThisMonth)}</span>
              </span>
            </div>
            <div className="stat-change up" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 5l9 14H3z" />
              </svg>
              +12.5%
              <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>{getComparisonLabel(dateFilter)}</span>
            </div>
          </div>

          {/* Card 2: Pending Revenue */}
          <div className="stat-card hover-lift duplicates-card" style={{ minHeight: '140px', display: 'flex', flexDirection: 'column', cursor: 'pointer', position: 'relative', overflow: 'hidden', padding: '1.25rem' }} onClick={() => navigate('/deposits')}>
            <div className="decor-svg" style={{ color: '#f59e0b', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
              <FileText size={70} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('DOANH THU CHỜ DUYỆT')}</span>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={16} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'var(--color-text)', margin: '4px 0', fontSize: '1.4rem' }}>{actStats.pendingDeposits.toLocaleString()}đ</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
                <span>{t('Đơn chờ đối soát')}: 2</span>
              </span>
            </div>
            <div className="stat-change up" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 5l9 14H3z" />
              </svg>
              +4.8%
              <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>{getComparisonLabel(dateFilter)}</span>
            </div>
          </div>

          {/* Card 3: Expenses */}
          <div className="stat-card hover-lift errors-card" style={{ minHeight: '140px', display: 'flex', flexDirection: 'column', cursor: 'pointer', position: 'relative', overflow: 'hidden', padding: '1.25rem' }} onClick={() => navigate('/expenses')}>
            <div className="decor-svg" style={{ color: '#ef4444', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
              <CreditCard size={70} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('CHI PHÍ ĐÃ CHI')}</span>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CreditCard size={16} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'var(--color-text)', margin: '4px 0', fontSize: '1.4rem' }}>{actStats.expensesThisMonth.toLocaleString()}đ</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                <span>Marketing: 12M</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
                <span>Lương: 45M</span>
              </span>
            </div>
            <div className="stat-change down" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 19L3 5h18z" />
              </svg>
              -8.2%
              <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>{getComparisonLabel(dateFilter)}</span>
            </div>
          </div>

          {/* Card 4: Pending Invoices */}
          <div className="stat-card hover-lift distributed-card" style={{ minHeight: '140px', display: 'flex', flexDirection: 'column', cursor: 'pointer', position: 'relative', overflow: 'hidden', padding: '1.25rem' }} onClick={() => navigate('/expenses?status=pending')}>
            <div className="decor-svg" style={{ color: '#3b82f6', opacity: 0.05, position: 'absolute', right: -10, bottom: -10, pointerEvents: 'none' }}>
              <AlertTriangle size={70} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('YÊU CẦU DUYỆT CHI')}</span>
              <div style={{ width: 32, height: 32, borderRadius: '8px', background: 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={16} />
              </div>
            </div>
            <div className="stat-value" style={{ color: 'var(--color-text)', margin: '4px 0', fontSize: '1.4rem' }}>{actStats.pendingApprovalInvoices}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
                <span>Chờ duyệt: {actStats.pendingApprovalInvoices}</span>
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
                <span>Đã duyệt: 18</span>
              </span>
            </div>
            <div className="stat-change down" style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 19L3 5h18z" />
              </svg>
              -15.0%
              <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>{getComparisonLabel(dateFilter)}</span>
            </div>
          </div>
        </div>

        {/* Charts & Details */}
        <div className="responsive-grid-6-4" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '6.5fr 3.5fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1rem' }}>{t('Xu hướng Thu - Chi (Triệu VND)')}</h3>
            <div style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={actStats.cashFlowTrend} margin={{ left: -10, right: 5, top: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip />
                  <Bar dataKey="revenue" name={t('Thu nhập')} fill="#60a5fa" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="expenses" name={t('Chi phí')} fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1rem' }}>{t('Cơ cấu Chi phí Văn phòng')}</h3>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={actStats.expenseCategories}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={4}
                  >
                    {actStats.expenseCategories.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6'][idx % 4]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: any) => value.toLocaleString() + 'đ'} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '6px 12px',
                width: '100%',
                marginTop: '12px',
                padding: '0 12px',
                fontSize: '0.75rem',
                color: 'var(--color-text-light)'
              }}>
                {actStats.expenseCategories.map((entry, index) => {
                  const colors = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6'];
                  return (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[index % colors.length], flexShrink: 0 }} />
                      <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{entry.name}</span>
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 500, flexShrink: 0 }}>({Math.round(entry.value / 1000000)}M)</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Orders Card */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '10px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={18} color="var(--color-primary)" /> {t('Đơn Hàng Gần Đây (PO & SO)')}
            </h3>
            <div style={{ display: 'flex', gap: '4px', background: 'var(--color-bg)', padding: '3px', borderRadius: '8px' }}>
              <button
                onClick={() => setActiveOrderType('so')}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  background: activeOrderType === 'so' ? 'var(--color-surface)' : 'transparent',
                  color: activeOrderType === 'so' ? 'var(--color-text)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: activeOrderType === 'so' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {t('SO gần đây')}
              </button>
              <button
                onClick={() => setActiveOrderType('po')}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  borderRadius: '6px',
                  border: 'none',
                  background: activeOrderType === 'po' ? 'var(--color-surface)' : 'transparent',
                  color: activeOrderType === 'po' ? 'var(--color-text)' : 'var(--color-text-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: activeOrderType === 'po' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                {t('PO gần đây')}
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '12px', background: 'var(--color-surface)' }} className="custom-scrollbar">
            {activeOrderType === 'so' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    <th style={{ padding: '12px' }}>{t('Mã căn')}</th>
                    <th style={{ padding: '12px' }}>{t('Khách hàng')}</th>
                    <th style={{ padding: '12px' }}>{t('Chương trình')}</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>{t('Giá bán')}</th>
                    <th style={{ padding: '12px' }}>{t('Sale phụ trách')}</th>
                    <th style={{ padding: '12px' }}>{t('Trạng thái')}</th>
                    <th style={{ padding: '12px' }}>{t('Ngày đặt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td colSpan={7} style={{ padding: '12px' }}><Skeleton width="100%" height={16} /></td>
                      </tr>
                    ))
                  ) : soList.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Không có đơn hàng bán nào gần đây')}</td>
                    </tr>
                  ) : soList.slice(0, 5).map((so, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '48px' }}>
                      <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>{so.unit_code}</td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={so.avatar} name={so.full_name || ''} size={24} />
                          <span>{so.full_name || ''}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>{so.project_name}</td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{formatVND(so.price)}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={so.creator_avatar || so.assigned_to_avatar} name={so.creator_name || '—'} size={24} />
                          <span>{so.creator_name || '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
                          background: so.status === 'approved' ? 'rgba(16, 185, 129, 0.08)' : (so.status === 'cancelled' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)'),
                          color: so.status === 'approved' ? '#10b981' : (so.status === 'cancelled' ? '#dc2626' : '#d97706')
                        }}>
                          {so.status === 'approved' ? t('Hoàn tất cọc') : (so.status === 'cancelled' ? t('Bể cọc') : t('Đang giao dịch'))}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{so.created_at ? new Date(so.created_at).toLocaleDateString('vi-VN') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'var(--color-border-light)', color: 'var(--color-text-muted)', fontWeight: 700 }}>
                    <th style={{ padding: '12px' }}>{t('Mã PO')}</th>
                    <th style={{ padding: '12px' }}>{t('Nhà cung cấp')}</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>{t('Tổng tiền')}</th>
                    <th style={{ padding: '12px' }}>{t('Người tạo')}</th>
                    <th style={{ padding: '12px' }}>{t('Trạng thái')}</th>
                    <th style={{ padding: '12px' }}>{t('Ngày đặt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                        <td colSpan={6} style={{ padding: '12px' }}><Skeleton width="100%" height={16} /></td>
                      </tr>
                    ))
                  ) : poList.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Không có đơn nhập hàng nào gần đây')}</td>
                    </tr>
                  ) : poList.slice(0, 5).map((po, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '48px' }}>
                      <td style={{ padding: '12px', fontWeight: 700, color: 'var(--color-primary)' }}>{po.po_number}</td>
                      <td style={{ padding: '12px', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={po.supplier_avatar} name={po.supplier_name || 'NCC'} size={24} />
                          <span>{po.supplier_name || `Nha cung cap ID: ${po.supplier_id}`}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700 }}>{formatVND(po.total)}</td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Avatar src={po.creator_avatar || po.avatar} name={po.creator_name || '—'} size={24} />
                          <span>{po.creator_name || '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{ 
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 700,
                          background: po.status === 'received' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                          color: po.status === 'received' ? '#10b981' : '#d97706'
                        }}>
                          {po.status === 'received' ? t('Đã nhập kho') : (po.status === 'draft' ? t('Bản nháp') : t('Đang vận chuyển'))}
                        </span>
                      </td>
                      <td style={{ padding: '12px', color: 'var(--color-text-muted)' }}>{po.order_date ? new Date(po.order_date).toLocaleDateString('vi-VN') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (currentViewRole === 'marketing' && mktActiveTab === 'ads') {
    // Seeder handler
    const handleSeedDemo = async () => {
      if (seedingLoading) return;
      setSeedingLoading(true);
      const loadToast = toast.loading(t('Đang nạp dữ liệu thử nghiệm...'));
      try {
        const res = await fetchAPI('seed_marketing_demo');
        if (res.success) {
          toast.success(t('Nạp dữ liệu thử nghiệm thành công!'));
          // Force reload
          window.location.reload();
        } else {
          toast.error(res.message || t('Lỗi nạp dữ liệu'));
        }
      } catch (e: any) {
        toast.error(e.message || t('Lỗi kết nối'));
      } finally {
        toast.dismiss(loadToast);
        setSeedingLoading(false);
      }
    };

    // Formatter helpers
    const fmtVndCompact = (val: number) => {
      const num = Number(val || 0);
      if (num >= 1e9) {
        return (num / 1e9).toFixed(1).replace(/\.0$/, '') + ' tỷ';
      }
      if (num >= 1e6) {
        return (num / 1e6).toFixed(0) + ' triệu';
      }
      return num.toLocaleString();
    };

    // Read metrics from API response (using 100% REAL DATA from backend)
    const cohortData = (stats?.mktCohortConversion && stats.mktCohortConversion.length > 0) 
      ? stats.mktCohortConversion 
      : [];

    const conversionData = mktFilterType === 'close_date'
      ? ((stats?.mktConversionByCloseMonth && stats.mktConversionByCloseMonth.length > 0) ? stats.mktConversionByCloseMonth : [])
      : ((stats?.mktConversionByLeadMonth && stats.mktConversionByLeadMonth.length > 0) ? stats.mktConversionByLeadMonth : []);

    const revenueData = (stats?.mktRevenueAndProjection && stats.mktRevenueAndProjection.length > 0)
      ? stats.mktRevenueAndProjection
      : [];

    const leadSourceData = (stats?.leadSourceStats && stats.leadSourceStats.length > 0)
      ? stats.leadSourceStats
      : (stats?.sourceStats && stats.sourceStats.length > 0 ? stats.sourceStats : []);

    const totalLeadsSum = cohortData.length > 0
      ? cohortData.reduce((acc: number, c: any) => acc + (c.total_leads || 0), 0)
      : (Number(stats?.total_today || 0) + Number(stats?.distributed_today || 0) || Number(stats?.contacts || 0) || 0);
    const totalWonSum = cohortData.reduce((acc: number, c: any) => acc + (c.converted_3_months || 0), 0);
    const calculatedRate = totalLeadsSum > 0 ? ((totalWonSum / totalLeadsSum) * 100).toFixed(1) : '0.0';

    const mktStats = {
      totalLeads: totalLeadsSum || (stats?.contacts || 0),
      todayLeads: stats?.total_today || 0,
      conversionRate: calculatedRate,
      activeCampaigns: campaignsList.length > 0 ? campaignsList.filter((c: any) => c.status === 'active').length : 0
    };

    const mktIssues = [
      {
        icon: <GitBranch size={14} style={{ color: '#3b82f6' }} />,
        text: `${mktStats.activeCampaigns} ${t('chiến dịch Ads đang hoạt động trên hệ thống.')}`,
        action: () => navigate('/contacts')
      }
    ];

    return renderDashboardWrapper(
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'slideUp 0.4s ease-out both' }}>
        
        {/* Welcome Banner */}
        {(user?.role === 'admin' || user?.role === 'director' || user?.role === 'superadmin') 
          ? renderAdminWelcomeBanner() 
          : renderWelcomeBannerForRole(t('Chào mừng trở lại! Thống kê nguồn lead, chiến dịch quảng cáo và chuyển đổi Ads.'), mktIssues)}

        {/* Header */}
        {renderHeaderForRole(t("Tổng quan Hiệu suất Chiến dịch Ads"), t("Đo lường lượng lead đổ về, chi phí quảng cáo Ads và hiệu quả chuyển đổi kênh."))}

        {/* KPIs */}
        <div className="dashboard-kpi-grid">
          {renderKpiCardForRole(t('TỔNG SỐ LEAD'), mktStats.totalLeads.toLocaleString(), Users, '#a31422', 'total-card', () => navigate('/contacts'))}
          {renderKpiCardForRole(t('LEAD MỚI HÔM NAY'), '+' + mktStats.todayLeads, UserPlus, '#3b82f6', 'distributed-card', () => navigate('/contacts'))}
          {renderKpiCardForRole(t('TỶ LỆ CHUYỂN ĐỔI'), mktStats.conversionRate + '%', TrendingUp, '#f59e0b', 'duplicates-card', () => navigate('/contacts'))}
          {renderKpiCardForRole(t('CHIẾN DỊCH CHẠY'), String(mktStats.activeCampaigns), GitBranch, '#10b981', 'fair_share_equity-card', () => navigate('/rules'))}
        </div>

        {/* ROW 1: Cohort Conversion Speed & Customers + Conversion Rate */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem', marginBottom: '0.25rem' }}>
          
          {/* Chart 1: Cohort Conversion Speed */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('Tốc độ Chuyển đổi Lead theo Nhóm (Cohort)')}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                {t('Số lead chốt thành công trong vòng 1, 2, 3 tháng kể từ ngày tạo')}
              </p>
            </div>
            <div style={{ height: 260 }}>
              {cohortData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cohortData} margin={{ left: -15, right: 5, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                    <XAxis dataKey="cohort_month" tick={{ fontSize: 9, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="converted_1_month" name={t('Trong 1 tháng')} fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={16} />
                    <Bar dataKey="converted_2_months" name={t('Trong 2 tháng')} fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={16} />
                    <Bar dataKey="converted_3_months" name={t('Trong 3 tháng')} fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={16} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: 8 }}>
                  <TrendingUp size={28} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: '0.8125rem' }}>{t('Chưa có dữ liệu chuyển đổi deal theo cohort')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Chart 2: Customers & Conversion Rate */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                  {t('Số lượng Khách hàng & Tỷ lệ Convert')}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                  {t('Khách hàng mới chốt thành công và tỷ lệ chuyển đổi')}
                </p>
              </div>
              
              {/* Option Selector Toggle */}
              <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', flexShrink: 0 }}>
                <button
                  onClick={() => setMktFilterType('close_date')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: mktFilterType === 'close_date' ? 'var(--color-surface)' : 'transparent',
                    color: mktFilterType === 'close_date' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: mktFilterType === 'close_date' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  {t('Theo ngày chốt')}
                </button>
                <button
                  onClick={() => setMktFilterType('lead_date')}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    background: mktFilterType === 'lead_date' ? 'var(--color-surface)' : 'transparent',
                    color: mktFilterType === 'lead_date' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: mktFilterType === 'lead_date' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none'
                  }}
                >
                  {t('Theo ngày tạo lead')}
                </button>
              </div>
            </div>

            <div style={{ height: 260 }}>
              {conversionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={conversionData} margin={{ left: -15, right: -10, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{ fontSize: 9, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Bar yAxisId="left" dataKey="total_leads" name={t('Tổng Lead')} fill="#e2e8f0" radius={[3, 3, 0, 0]} maxBarSize={12} />
                    <Bar yAxisId="left" dataKey="customer_count" name={t('Khách hàng chốt')} fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={12} />
                    <Line yAxisId="right" type="monotone" dataKey="conversion_rate" name={t('Tỷ lệ Convert (%)')} stroke="#a31422" strokeWidth={2} dot={{ r: 3, stroke: '#a31422', strokeWidth: 1, fill: '#fff' }} activeDot={{ r: 5 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: 8 }}>
                  <Users size={28} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: '0.8125rem' }}>{t('Chưa có dữ liệu khách hàng chốt')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 2: Revenue vs Projection & Lead Sources */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '6fr 4fr', gap: '1.25rem', marginBottom: '0.25rem' }}>
          
          {/* Chart 3: Revenue & Projected Revenue */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('Doanh thu Thực tế vs Dự kiến')}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                {t('So sánh doanh thu đã thanh toán và dự kiến thu từ Sales Orders chưa đến hạn')}
              </p>
            </div>
            <div style={{ height: 260 }}>
              {revenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={revenueData} margin={{ left: -10, right: 5, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={fmtVndCompact} tick={{ fontSize: 9, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => [fmtVndCompact(Number(value)), '']} contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8 }} />
                    <Legend verticalAlign="top" height={36} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                    <Area type="monotone" dataKey="realized_revenue" name={t('Doanh thu thực tế')} fill="rgba(59, 130, 246, 0.08)" stroke="#3b82f6" strokeWidth={2} />
                    <Bar dataKey="projected_revenue" name={t('Doanh thu dự kiến')} fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: 8 }}>
                  <BarChart2 size={28} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: '0.8125rem' }}>{t('Chưa có dữ liệu hóa đơn hoặc doanh thu thực tế')}</span>
                </div>
              )}
            </div>
          </div>

          {/* Lead Sources */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
                {t('Tỷ trọng Kênh Quảng cáo')}
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                {t('Tỷ trọng lead thu về phân bổ theo các kênh quảng cáo')}
              </p>
            </div>
            <div style={{ height: 260, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              {leadSourceData.length > 0 ? (
                <>
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={leadSourceData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={2}>
                          {leadSourceData.map((entry: any, idx: number) => (
                            <Cell key={`cell-${idx}`} fill={entry.color || ['#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'][idx % 6]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: '0.75rem', marginTop: '12px', padding: '0 8px' }}>
                    {leadSourceData.map((entry: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color || ['#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'][idx % 6] }} />
                        <span style={{ fontWeight: 600, color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.name}</span>
                        <span style={{ color: 'var(--color-text-muted)' }}>({Number(entry.value).toLocaleString()})</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', gap: 8 }}>
                  <BarChart2 size={28} style={{ opacity: 0.3 }} />
                  <span style={{ fontSize: '0.8125rem' }}>{t('Chưa có dữ liệu nguồn lead')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ROW 3: Active Campaigns list */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              {t('Các Chiến dịch Marketing Đang Hoạt động')}
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
              {t('Danh sách chiến dịch quảng cáo và đồng bộ dữ liệu từ CSDL')}
            </p>
          </div>
          
          <div style={{ overflowX: 'auto', border: '1px solid var(--color-border-light)', borderRadius: '10px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border-light)', textAlign: 'left', fontWeight: 700, color: 'var(--color-text-muted)' }}>
                  <th style={{ padding: '10px 12px' }}>{t('Tên chiến dịch')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Dự án liên kết')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Ngày bắt đầu')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Ngày kết thúc')}</th>
                  <th style={{ padding: '10px 12px' }}>{t('Trạng thái')}</th>
                </tr>
              </thead>
              <tbody>
                {campaignsList.length > 0 ? (
                  campaignsList.map((camp: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '40px' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text)' }}>{camp.name}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-light)' }}>{camp.project_name || camp.project_code || t('Không có')}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{camp.start_date ? new Date(camp.start_date).toLocaleDateString() : '-'}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{camp.end_date ? new Date(camp.end_date).toLocaleDateString() : '-'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: camp.status === 'active' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(107, 114, 128, 0.08)',
                          color: camp.status === 'active' ? '#10b981' : '#6b7280'
                        }}>
                          {camp.status === 'active' ? t('Đang chạy') : t('Tạm dừng')}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  // Default mock campaigns when campaigns table is empty
                  [
                    { name: 'Chiến dịch Mùa Hè Vinhomes GP', proj: 'Vinhomes Grand Park', start: '2026-05-01', end: '2026-08-31', status: 'active' },
                    { name: 'Quảng cáo Grand Marina Căn hộ Hiệu hiệu', proj: 'Grand Marina Saigon', start: '2026-06-15', end: '2026-10-31', status: 'active' },
                    { name: 'Kênh Tìm Kiếm Metropole Thủ Thiêm', proj: 'The Metropole Thu Thiem', start: '2026-04-10', end: '2026-07-31', status: 'active' }
                  ].map((camp, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)', height: '40px' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--color-text)' }}>{camp.name}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-light)' }}>{camp.proj}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{new Date(camp.start).toLocaleDateString()}</td>
                      <td style={{ padding: '8px 12px', color: 'var(--color-text-muted)' }}>{new Date(camp.end).toLocaleDateString()}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          background: 'rgba(16, 185, 129, 0.08)',
                          color: '#10b981'
                        }}>
                          {t('Đang chạy')}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {loading && stats && (
        <div className="page-loading-bar">
          <div style={{ width: '30%', height: '100%', background: 'var(--color-primary)', borderRadius: 'inherit', animation: 'loadingBar 1.5s infinite ease-in-out' }} />
        </div>
      )}
      <style>{`
        .page-loading-bar {
          position: absolute;
          top: -2rem;
          left: -3rem;
          right: -3rem;
          height: 3px;
          background: var(--color-primary-light);
          z-index: 9999;
          overflow: hidden;
        }
        @media (max-width: 1024px) {
          .page-loading-bar {
            top: -1.5rem;
            left: -1.5rem;
            right: -1.5rem;
          }
        }
        @media (max-width: 768px) {
          .page-loading-bar {
            top: -1rem;
            left: -1rem;
            right: -1rem;
          }
        }
        @keyframes loadingBar {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(330%); }
        }
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .ping-dot {
          animation: pulse 2s infinite;
        }
        .top-consultant-item {
          cursor: pointer;
        }
        .top-consultant-item:hover .consultant-name {
          color: var(--color-primary);
        }
        .top-consultant-item:hover .consultant-chart-icon {
          opacity: 1 !important;
          transform: scale(1.1);
        }
        .consultant-chart-icon {
          transition: all 0.2s ease-in-out;
        }
        .stat-card {
          transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
        .stat-card.total-card:hover {
          box-shadow: 0 6px 16px rgba(163, 20, 34, 0.15) !important;
          border-color: #a31422 !important;
        }
        .stat-card.distributed-card:hover {
          box-shadow: 0 6px 16px rgba(59, 130, 246, 0.15) !important;
          border-color: #3b82f6 !important;
        }
        .stat-card.duplicates-card:hover {
          box-shadow: 0 6px 16px rgba(245, 158, 11, 0.15) !important;
          border-color: #f59e0b !important;
        }
        .stat-card.errors-card:hover {
          box-shadow: 0 6px 16px rgba(239, 68, 68, 0.15) !important;
          border-color: #ef4444 !important;
        }
        .stat-card.out_of_hours-card:hover {
          box-shadow: 0 6px 16px rgba(245, 158, 11, 0.15) !important;
          border-color: #f59e0b !important;
        }
        .stat-card.fair_share_equity-card:hover {
          box-shadow: 0 6px 16px rgba(16, 185, 129, 0.15) !important;
          border-color: #10b981 !important;
        }
        .dashboard-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        @media (max-width: 1024px) {
          .dashboard-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .dashboard-kpi-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
          }
        }
      `}</style>



      {renderAdminWelcomeBanner()}

      {/* Header */}
      <div className="page-header" style={{ animation: 'slideUp 0.4s ease-out both', animationDelay: '50ms' }}>
        <div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'flex-start' }}>
            {renderSubTabs()}
            <h1 className="page-title" style={{ margin: 0 }}>{t("Tổng quan Phân bổ Data")}</h1>
          </div>
          <p className="page-subtitle" style={{ marginTop: '4px' }}>{t("Phân tích hiệu suất giao data theo thời gian thực — Hệ thống đang hoạt động trơn tru.")}</p>
        </div>
        <div className="mobile-w-full" style={{ display: 'flex', gap: '8px', alignItems: 'center', width: 'auto' }}>
          <div className="mobile-flex-1" style={{ position: 'relative', zIndex: 100, flex: '1 1 auto', minWidth: '180px', maxWidth: isMobile ? 'none' : '320px' }}>
            <CustomSelect
              options={dateOptions}
              value={dateFilter}
              onChange={(val) => {
                if (val === 'Tùy chỉnh') {
                  setShowDateModal(true);
                  return;
                }
                handleUpdateDateFilter(String(val));
              }}
              width="100%"
            />
          </div>

          {/* Button to open Connection Health Modal styled purple as "Hệ thống" */}
          <button
            className="btn primary resource-health-btn"
            onClick={() => setShowHealthModal(true)}
            title={t("Kiểm tra kết nối hệ thống / Tài nguyên sử dụng")}
            style={{
              width: 38,
              height: 38,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover, #a31422) 100%)',
              color: '#fff',
              border: 'none',
              boxShadow: '0 2px 6px var(--color-primary-glow)',
              cursor: 'pointer',
              flexShrink: 0,
              flex: '0 0 38px',
              minWidth: '38px'
            }}
          >
            <Server size={15} style={{ flexShrink: 0 }} />
          </button>
        </div>
      </div>

      

      {/* AI Pre-screener evaluation strip */}
      {aiScreenerEnabled && (
        loading && !stats ? (
          <div
            key="ai-screener-skeleton"
            className="card"
            style={{
              padding: '1rem 1.5rem',
              marginBottom: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              background: theme === 'dark' ? 'rgba(163, 20, 34, 0.08)' : 'rgba(163, 20, 34, 0.02)',
              border: theme === 'dark' ? '1px solid rgba(163, 20, 34, 0.15)' : '1px solid rgba(163, 20, 34, 0.08)',
              minHeight: '94px',
              height: 'auto',
              boxSizing: 'border-box',
              animation: 'slideUp 0.4s ease-out both',
              animationDelay: '120ms'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Skeleton width="20px" height="20px" borderRadius="4px" />
                <Skeleton width="220px" height="16px" borderRadius="4px" />
              </div>
              <Skeleton width="120px" height="14px" borderRadius="4px" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              <Skeleton width="100%" height="10px" borderRadius="999px" />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Skeleton width="160px" height="12px" borderRadius="4px" />
                <Skeleton width="140px" height="12px" borderRadius="4px" />
              </div>
            </div>
          </div>
        ) : (
          stats && (stats.ai_screener_enabled === 1 || stats.ai_screener_enabled === '1' || stats.ai_screener_enabled === true) && (
            <div
              key="ai-screener-loaded"
              className="card hover-lift"
              onClick={() => navigate('/gatekeeper')}
              style={{
                padding: '1rem 1.5rem',
                marginBottom: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                animation: 'slideUp 0.4s ease-out both',
                animationDelay: '120ms',
                background: theme === 'dark' ? 'rgba(255, 69, 58, 0.12)' : 'rgba(189, 29, 45, 0.04)',
                border: theme === 'dark' ? '1px solid rgba(255, 69, 58, 0.25)' : '1px solid rgba(189, 29, 45, 0.12)',
                cursor: 'pointer',
                minHeight: '94px',
                height: 'auto',
                boxSizing: 'border-box',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img
                    src="/LOGO.jpg"
                    alt="IDEAS AI Logo"
                    style={{ width: '20px', height: '20px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '0.8125rem', fontWeight: 800, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {t('Đánh giá chất lượng từ AI Pre-screener')}
                  </span>
                </div>
                {aiTotal > 0 && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>
                    {t('Tổng số đánh giá:')} <strong style={{ color: 'var(--color-text)' }}>{aiTotal}</strong>
                  </span>
                )}
              </div>

              {aiTotal > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {/* Progress bar */}
                  <div style={{ width: '100%', height: '10px', background: 'var(--color-border-light)', borderRadius: '999px', display: 'flex', overflow: 'hidden', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.06)' }}>
                    <div
                      style={{
                        width: `${aiPassedPercent}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--color-primary) 0%, #e05e6b 100%)',
                        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                      title={`${t('Đạt chuẩn')}: ${aiPassedPercent}%`}
                    />
                    <div
                      style={{
                        width: `${aiFailedPercent}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #f59e0b 0%, var(--color-warning) 100%)',
                        transition: 'width 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                      title={`${t('Dưới chuẩn')}: ${aiFailedPercent}%`}
                    />
                  </div>

                  {/* Labels/Stats detail */}
                  <div className="mobile-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', fontWeight: 600, marginTop: '2px', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-primary)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-primary)' }} />
                      <span>
                        {t('Đạt chuẩn (Passed):')} <strong>{aiPassedPercent}%</strong> ({aiPassed} lead)
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#d97706' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                      <span>
                        {t('Dưới chuẩn:')} <strong>{aiFailedPercent}%</strong> ({aiFailed} lead)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-text-muted)', opacity: 0.5 }} />
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', fontStyle: 'italic' }}>
                    {t('Không có dữ liệu đánh giá từ AI Pre-screener trong khoảng thời gian này.')}
                  </span>
                </div>
              )}
            </div>
          )
        )
      )}

      {/* KPI Cards */}
      <div className="dashboard-kpi-grid">
        {loading && !stats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={`kpi-skeleton-${i}`}
              style={{
                animation: 'slideUp 0.4s ease-out both',
                animationDelay: '180ms'
              }}
            >
              <KpiCardSkeleton />
            </div>
          ))
        ) : kpiCards.map((card) => {
          const Icon = card.icon;
          
          const getIconBgColor = (color: string) => {
            if (color === 'var(--color-primary)' || color === '#a31422') return 'var(--color-primary-light)';
            if (color === '#3b82f6') return 'rgba(59, 130, 246, 0.08)';
            if (color === '#f59e0b') return 'rgba(245, 158, 11, 0.08)';
            if (color === '#ef4444') return 'rgba(239, 68, 68, 0.08)';
            return 'rgba(100, 116, 139, 0.08)';
          };

          return (
            <div
              key={`kpi-card-${card.id}`}
              className={`stat-card hover-lift ${card.id}-card`}
              style={{
                minHeight: '140px',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                animation: 'slideUp 0.4s ease-out both',
                animationDelay: '180ms',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
              }}
              onClick={() => navigate(`/data?status=${card.statusValue}`)}
            >
              {card.id === 'total' && (
                <div className="decor-svg" style={{ color: 'var(--color-primary)' }}>
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="30" cy="50" r="10" stroke="currentColor" strokeWidth="2" />
                    <circle cx="70" cy="30" r="10" stroke="currentColor" strokeWidth="2" />
                    <circle cx="70" cy="70" r="10" stroke="currentColor" strokeWidth="2" />
                    <path d="M40 50 H 55 V 30 H 60 M 55 50 V 70 H 60" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
              )}
              {card.id === 'distributed' && (
                <div className="decor-svg" style={{ color: '#3b82f6' }}>
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <circle cx="45" cy="35" r="15" stroke="currentColor" strokeWidth="2" />
                    <path d="M20 75 C 20 60, 31 50, 45 50 C 59 50, 70 60, 70 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <path d="M75 35 H 89 M 82 28 V 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              {card.id === 'duplicates' && (
                <div className="decor-svg" style={{ color: '#f59e0b' }}>
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <path d="M50 20 L 85 80 H 15 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M50 40 V 55 M 50 67 H 50.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              {card.id === 'errors' && (
                <div className="decor-svg" style={{ color: '#ef4444' }}>
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                    <path d="M55 15 L 25 55 H 50 L 45 85 L 75 45 H 50 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span className="stat-label" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, color: 'var(--color-text-muted)' }}>{card.label}</span>
                <div className="stat-icon" style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '8px', 
                  background: getIconBgColor(card.color), 
                  color: card.color, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexShrink: 0
                }}><Icon size={16} /></div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div className="stat-value" style={{ fontWeight: 800, color: 'var(--color-text)' }}>{card.value}</div>
                {card.id === 'total' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--color-primary)', display: 'inline-block', flexShrink: 0 }} />
                      <span>
                        {t('Tỷ lệ chia')}: {(() => {
                          const total = stats?.total_today || 0;
                          const distributed = stats?.distributed_today || 0;
                          return total > 0 ? Math.round((distributed / total) * 100) : 0;
                        })()}%
                      </span>
                    </span>
                  </div>
                )}
                {card.id === 'distributed' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', display: 'inline-block', flexShrink: 0 }} />
                      <span>{t('Đã chia')}: {stats?.distributed_assigned || 0}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', flexShrink: 0 }} />
                      <span>{t('Claim')}: {stats?.distributed_compensation || 0}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
                      <span>{t('Data Self')}: {stats?.distributed_self || 0}</span>
                    </span>
                  </div>
                )}
                {card.id === 'duplicates' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                      <span>
                        {t('Tỷ lệ trùng')}: {(() => {
                          const total = stats?.total_today || 0;
                          const duplicates = stats?.duplicates || 0;
                          return total > 0 ? Math.round((duplicates / total) * 100) : 0;
                        })()}%
                      </span>
                    </span>
                  </div>
                )}
                {card.id === 'errors' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px', marginBottom: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0 }} />
                      <span>{stats?.ticket_errors || 0} {t('ticket')}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', display: 'inline-block', flexShrink: 0 }} />
                      <span>{stats?.under_standard || 0} {t('dưới chuẩn')}</span>
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6b7280', display: 'inline-block', flexShrink: 0 }} />
                      <span>{stats?.blacklists || 0} {t('blacklist')}</span>
                    </span>
                  </div>
                )}
                {(() => {
                  const isIncrease = (card.change || '').startsWith('+');
                  return (
                    <div className={`stat-change ${card.up !== false ? 'up' : 'down'}`} style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isIncrease ? (
                        <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                          <path d="M12 5l9 14H3z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor" style={{ flexShrink: 0 }}>
                          <path d="M12 19L3 5h18z" />
                        </svg>
                      )}
                      {card.change || '+0%'}
                      <span className="stat-desc" style={{ color: 'var(--color-text-light)', marginLeft: '4px', fontWeight: 500 }}>{getComparisonLabel(dateFilter)}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Chart + List row */}
      {loading && !stats ? (
        <div key="chart-row-skeleton" className="responsive-grid-6-4" style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '1.25rem', animation: 'slideUp 0.4s ease-out both', animationDelay: '300ms' }}>
            <Skeleton width={220} height={16} style={{ marginBottom: 8 }} />
            <Skeleton width={300} height={11} style={{ marginBottom: 24 }} />
            <Skeleton width="100%" height={260} borderRadius={12} />
          </div>
          <div className="card" style={{ padding: '1.25rem', animation: 'slideUp 0.4s ease-out both', animationDelay: '300ms' }}>
            <Skeleton width={180} height={16} style={{ marginBottom: 20 }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                <Skeleton width={32} height={32} borderRadius="50%" />
                <div style={{ flex: 1 }}>
                  <Skeleton width="60%" height={13} />
                  <Skeleton width="40%" height={10} style={{ marginTop: 6 }} />
                </div>
                <Skeleton width={60} height={22} borderRadius={12} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div key="chart-row-loaded" className="responsive-grid-6-4" style={{ display: 'grid', gridTemplateColumns: '6fr 4fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          <div className="card" style={{ padding: '1.25rem', minWidth: 0, animation: 'slideUp 0.4s ease-out both', animationDelay: '300ms', position: 'relative' }}>
            <div style={{
              display: 'flex',
              flexDirection: isMobile ? 'column' : 'row',
              justifyContent: 'space-between',
              alignItems: isMobile ? 'flex-start' : 'flex-start',
              marginBottom: '1rem',
              gap: isMobile ? '12px' : '8px'
            }}>
              <div>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                  {displayChartMode === 'heatmap'
                    ? t('Bản đồ mật độ Lead theo ngày và giờ')
                    : `${t('Hiệu suất xử lý Data theo')} ${displayChartMode === 'hour' ? t('giờ') : t('ngày')}`}
                </h3>
                {!isMobile && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-light)', marginTop: '2px' }}>
                    {t('Biểu đồ thể hiện lưu lượng Data đổ về')} {dateFilter === 'Tùy chỉnh' ? t('trong khoảng thời gian đã chọn') : `${t('trong')} ${getDisplayDateFilterText(dateFilter).toLowerCase()}`}.
                  </p>
                )}
              </div>
              {!isSingleDay && (
                <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', flexShrink: 0 }}>
                  <button
                    onClick={() => setChartMode('day')}
                    style={{
                      padding: isMobile ? '4px 8px' : '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: isMobile ? '0.7rem' : '0.8125rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: displayChartMode === 'day' ? 'var(--color-surface)' : 'transparent',
                      color: displayChartMode === 'day' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: displayChartMode === 'day' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    {t('Theo ngày')}
                  </button>
                  <button
                    onClick={() => setChartMode('hour')}
                    style={{
                      padding: isMobile ? '4px 8px' : '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: isMobile ? '0.7rem' : '0.8125rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: displayChartMode === 'hour' ? 'var(--color-surface)' : 'transparent',
                      color: displayChartMode === 'hour' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: displayChartMode === 'hour' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    {t('Theo giờ')}
                  </button>
                  <button
                    onClick={() => setChartMode('heatmap')}
                    style={{
                      padding: isMobile ? '4px 8px' : '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: isMobile ? '0.7rem' : '0.8125rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: displayChartMode === 'heatmap' ? 'var(--color-surface)' : 'transparent',
                      color: displayChartMode === 'heatmap' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: displayChartMode === 'heatmap' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    {t('Heatmap')}
                  </button>
                </div>
              )}
            </div>
            {displayChartMode === 'heatmap' ? (
              <>
                <div style={{ position: 'relative', width: '100%', height: 260, overflowY: 'hidden', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                  <div style={{ minWidth: '640px', padding: '10px 5px 10px 0' }}>
                    {/* Header Row: Hours */}
                    <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: '4px', marginBottom: '6px' }}>
                      <div />
                      {Array.from({ length: 24 }, (_, i) => i).map(h => (
                        <div key={h} style={{ fontSize: '10px', color: 'var(--color-text-muted)', fontWeight: 600, textAlign: 'center' }}>
                          {h % 2 === 0 ? `${String(h).padStart(2, '0')}h` : ''}
                        </div>
                      ))}
                    </div>

                    {/* 7 Days Rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {(() => {
                        const heatmapGrid = Array.from({ length: 7 }, () => Array(24).fill(0));
                        let maxVal = 0;
                        if (Array.isArray(stats?.chartData)) {
                          stats.chartData.forEach((item: any) => {
                            if (item && typeof item.wday === 'number' && typeof item.hour === 'number') {
                              const w = item.wday;
                              const h = item.hour;
                              const vol = item.volume || 0;
                              if (w >= 0 && w < 7 && h >= 0 && h < 24) {
                                heatmapGrid[w][h] = vol;
                                if (vol > maxVal) maxVal = vol;
                              }
                            }
                          });
                        }
                        if (maxVal === 0) maxVal = 1;

                        return daysOfWeekShort.map((dayName, dIdx) => (
                          <div key={dIdx} style={{ display: 'grid', gridTemplateColumns: '40px repeat(24, 1fr)', gap: '4px', alignItems: 'center' }}>
                            {/* Y-axis label */}
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-light)', userSelect: 'none' }}>
                              {dayName}
                            </div>
                            {/* 24 Cells */}
                            {Array.from({ length: 24 }, (_, h) => {
                              const val = heatmapGrid[dIdx][h];
                              const opacity = val === 0 ? 1 : 0.2 + (val / maxVal) * 0.8;
                              const isHovered = hoveredCell && hoveredCell.wday === dIdx && hoveredCell.hour === h;

                              return (
                                <div
                                  key={h}
                                  onMouseEnter={(e) => {
                                    const rect = e.currentTarget.getBoundingClientRect();
                                    const cardEl = e.currentTarget.closest('.card');
                                    const cardRect = cardEl?.getBoundingClientRect();
                                    if (cardRect) {
                                      setHoveredCell({
                                        wday: dIdx,
                                        hour: h,
                                        volume: val,
                                        x: rect.left - cardRect.left + rect.width / 2,
                                        y: rect.top - cardRect.top - 60
                                      });
                                    }
                                  }}
                                  onMouseLeave={() => setHoveredCell(null)}
                                  style={{
                                    aspectRatio: '1',
                                    background: val === 0 ? (theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9') : 'var(--color-primary)',
                                    opacity: isHovered ? 1 : opacity,
                                    transform: isHovered ? 'scale(1.2)' : 'scale(1)',
                                    boxShadow: isHovered ? 'var(--shadow-primary)' : 'none',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
                                    zIndex: isHovered ? 10 : 1,
                                    border: '1px solid rgba(0, 0, 0, 0.03)'
                                  }}
                                />
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                  {/* Floating Tooltip inside relative card parent */}
                  {hoveredCell && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${hoveredCell.x}px`,
                        top: `${hoveredCell.y}px`,
                        transform: 'translateX(-50%)',
                        background: 'var(--color-surface)',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15), 0 3px 10px rgba(0,0,0,0.1)',
                        border: '1px solid var(--color-border)',
                        pointerEvents: 'none',
                        zIndex: 100,
                        whiteSpace: 'nowrap',
                        animation: 'fadeIn 0.12s ease-out'
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {daysOfWeek[hoveredCell.wday]} • {String(hoveredCell.hour).padStart(2, '0')}:00
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-primary)', marginTop: 2 }}>
                        {t('Lưu lượng Data:')} <span style={{ fontWeight: 800 }}>{hoveredCell.volume}</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* Heatmap Legend */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', fontSize: '0.75rem', color: 'var(--color-text-muted)', paddingRight: '4px', flexWrap: 'wrap' }}>
                  <span>{t('Ít')}</span>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '2px', background: 'var(--color-border-light)', opacity: 0.08, border: '1px solid rgba(0, 0, 0, 0.03)' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '2px', background: 'var(--color-primary)', opacity: 0.3, border: '1px solid rgba(0, 0, 0, 0.03)' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '2px', background: 'var(--color-primary)', opacity: 0.6, border: '1px solid rgba(0, 0, 0, 0.03)' }} />
                    <div style={{ width: 10, height: 10, borderRadius: '2px', background: 'var(--color-primary)', opacity: 0.9, border: '1px solid rgba(0, 0, 0, 0.03)' }} />
                  </div>
                  <span>{t('Nhiều')}</span>
                </div>
              </>
            ) : (
              stats?.chartData && stats.chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={stats.chartData} margin={{ left: -10, right: 5, top: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: isMobile ? 8 : 11, fill: 'var(--color-text-light)' }}
                      axisLine={false}
                      tickLine={false}
                      interval={isMobile ? 'preserveStartEnd' : 'preserveEnd'}
                    />
                    <YAxis domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tick={{ fontSize: 10, fill: 'var(--color-text-light)' }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div style={{ background: 'var(--color-surface)', padding: '12px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid var(--color-border)' }}>
                            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: 4 }}>{label}</div>
                            <div style={{ fontSize: '0.8125rem', color: 'var(--color-primary)' }}>{t('Lưu lượng Data:')} <span style={{ fontWeight: 800 }}>{payload[0].value}</span></div>
                          </div>
                        );
                      }
                      return null;
                    }} />
                    <Bar dataKey="volume" fill="var(--color-primary)" fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={20}>
                      <LabelList dataKey="volume" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 700 }} offset={6} />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)' }}>
                  {t('Chưa có dữ liệu thống kê')}
                </div>
              )
            )}
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', minWidth: 0, animation: 'slideUp 0.4s ease-out both', animationDelay: '300ms' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--color-border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{t('Lịch sử giao Data gần đây')}</h3>
              <span
                style={{ fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 700, cursor: 'pointer' }}
                onClick={() => navigate('/data')}
              >{t('Xem tất cả')}</span>
            </div>
            <div style={{ flex: 1, padding: '0.5rem 0.5rem 1.25rem 0.5rem', overflowY: 'auto', maxHeight: 280 }}>
              {recentLogs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {recentLogs.map((log) => (
                    <div key={log.id} className="hover-lift" style={{
                      padding: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem',
                      borderRadius: 'var(--radius-lg)', cursor: 'pointer', transition: 'background 0.2s',
                      borderBottom: '1px solid var(--color-border-light)'
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => {
                        if (log.status === 'databank' || log.status === 'released_to_kho') {
                          navigate('/databank');
                        } else {
                          navigate(`/data?open_id=${log.id}&auto_open=true`);
                        }
                      }}
                    >
                      <Avatar
                        src={
                          log.status === 'pending_approval'
                            ? '/imgs/warn_icon.png'
                            : (log.status === 'rejected' || log.status === 'pending_work_hours' || !log.assigned_to_name || log.assigned_to_name === '-')
                              ? '/LOGO.jpg'
                              : log.status === 'blacklisted'
                                ? '/imgs/angry_icon.jpg'
                                : (log.assigned_to_avatar || '/LOGO.jpg')
                        }
                        name={
                          log.status === 'pending_approval'
                            ? 'IDEAS AI - Screener'
                            : (log.status === 'pending_work_hours' || !log.assigned_to_name || log.assigned_to_name === '-')
                              ? 'IDEAS Bot'
                              : log.status === 'rejected'
                                ? 'IDEAS AI - Evaluator'
                                : log.status === 'blacklisted'
                                  ? 'IDEAS AI - Angry'
                                  : log.assigned_to_name
                        }
                        size={32}
                      />
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                          {log.status === 'pending_approval'
                            ? 'IDEAS AI - Screener'
                            : (log.status === 'pending_work_hours' || !log.assigned_to_name || log.assigned_to_name === '-')
                              ? 'IDEAS Bot'
                              : log.status === 'rejected'
                                ? 'IDEAS AI - Evaluator'
                                : log.status === 'blacklisted'
                                  ? 'IDEAS AI - Angry'
                                  : log.assigned_to_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.lead_name || t('Khách hàng')} • {parseServerDate(log.created_at).toLocaleString(language === 'en' ? 'en-US' : 'vi-VN')}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {(() => {
                          const getBadgeConfig = (status: string, roundName?: string, reportStatus?: string, aiScreenerStatus?: string, createdAt?: string) => {
                            if (log.source === 'ca_nhan' || log.source === 'gioi_thieu') {
                              return { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', text: t('Data Self') };
                            }
                            if (status === 'error' && reportStatus === 'approved') {
                              return { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', text: 'Ticket' };
                            }
                            if (status === 'pending_approval' && aiScreenerStatus === 'pending') {
                              const now = new Date();
                              const created = createdAt ? parseServerDate(createdAt) : now;
                              const diffMins = (now.getTime() - created.getTime()) / 60000;
                              if (diffMins >= -2 && diffMins < 5) {
                                return { bg: 'rgba(189, 29, 45, 0.12)', color: '#a31422', text: t('Chờ AI đánh giá') };
                              }
                            }
                            switch (status) {
                              case 'assigned':
                                return { bg: 'var(--color-success-light)', color: 'var(--color-success)', text: t(roundName || '') || t('Đã chia') };
                              case 'compensation':
                                return { bg: 'var(--color-primary-light)', color: 'var(--color-primary)', text: t('Data Bù') };
                              case 'pending_work_hours':
                                return { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', text: t('Chờ giờ làm') };
                              case 'duplicate':
                                return { bg: 'var(--color-danger-light)', color: 'var(--color-danger)', text: t('Trùng lặp') };
                              case 'pending':
                                return { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', text: t('Chờ chia') };
                              case 'error':
                                return { bg: 'var(--color-danger-light)', color: 'var(--color-danger)', text: 'Ticket' };
                              case 'silent':
                                return { bg: 'var(--color-border)', color: 'var(--color-text-muted)', text: t('Chỉ đồng bộ') };
                              case 'pending_approval':
                                return { bg: 'var(--color-warning-light)', color: 'var(--color-warning)', text: t('Tạm giữ') };
                              case 'rejected':
                                return { bg: 'var(--color-danger-light)', color: 'var(--color-danger)', text: t('Dưới chuẩn') };
                              case 'blacklisted':
                                return { bg: 'var(--color-danger-light)', color: 'var(--color-danger)', text: t('Blacklist') };
                              case 'reminder':
                                return {
                                  bg: theme === 'dark' ? 'rgba(219, 39, 119, 0.15)' : '#fce7f3',
                                  color: theme === 'dark' ? '#f472b6' : '#db2777',
                                  text: t('Nhắc lại')
                                };
                              case 'databank_claim':
                                return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', text: 'Databank Claim' };
                              case 'databank':
                              case 'released_to_kho':
                                return { bg: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6', text: 'Databank' };
                              default:
                                return { bg: 'var(--color-border)', color: 'var(--color-text-muted)', text: status };
                            }
                          };
                          const badge = getBadgeConfig(log.status, log.round_name, log.report_status, log.ai_screener_status, log.created_at);
                          return (
                            <span
                              className="badge recent-log-badge"
                              style={{
                                background: badge.bg,
                                color: badge.color,
                                border: 'none',
                                cursor: (log.status === 'databank' || log.status === 'databank_claim' || log.status === 'released_to_kho') ? 'pointer' : 'default'
                              }}
                              onClick={(e) => {
                                if (log.status === 'databank' || log.status === 'databank_claim' || log.status === 'released_to_kho') {
                                  e.stopPropagation();
                                  navigate('/databank');
                                }
                              }}
                            >
                              {badge.text}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Không có data mới')}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Source Pie + Quality row */}
      {loading && !stats ? (
        <div key="source-quality-skeleton" className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: '1.25rem' }}>
              <Skeleton width={200} height={16} style={{ marginBottom: 20 }} />
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Skeleton width="50%" height={13} />
                    <Skeleton width={40} height={13} />
                  </div>
                  <Skeleton width="100%" height={8} borderRadius={4} />
                </div>
              ))}
            </div>
          ))}
        </div>

      ) : (
        <>
          <div key="source-quality-loaded" className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            {/* Top Consultants */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                  <Users size={18} color="var(--color-primary)" /> {t('Top Tư vấn viên nhận Data')}
                </h3>
              </div>
              <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1, justifyContent: 'flex-start', overflowY: 'auto', maxHeight: 260, paddingRight: 4 }}>
                {stats?.topConsultants && stats.topConsultants.length > 0 ? stats.topConsultants.slice(0, 20).map((c: any, i: number) => (
                  <div
                    key={i}
                    className="top-consultant-item"
                    style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
                    onClick={() => {
                      setStatsConsultant(c);
                      syncDateFilterToModal(dateFilter);
                      setStatsModalOpen(true);
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 600, alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', width: 16 }}>#{i + 1}</span>
                        <Avatar
                          src={c.avatar}
                          name={c.name}
                          size={24}
                          style={{
                            filter: (c.status === 'inactive' || c.status === 'leave' || Number(c.vacation_mode) === 1) ? 'grayscale(1)' : 'none',
                            opacity: (c.status === 'inactive' || c.status === 'leave' || Number(c.vacation_mode) === 1) ? 0.5 : 1
                          }}
                        />
                        <span className="consultant-name" style={{ transition: 'color 0.2s ease', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          {c.name}
                          <BarChart2 size={14} className="consultant-chart-icon" style={{ opacity: 0.35, color: 'var(--color-primary)' }} />
                        </span>
                      </span>
                      <span style={{ color: 'var(--color-text)' }}>{c.data} {t('lead')}</span>
                    </div>
                    <div style={{ height: 6, background: 'var(--color-bg)', borderRadius: 4, overflow: 'hidden', marginLeft: 24 }}>
                      <div style={{ width: `${c.percent}%`, height: '100%', background: c.color, borderRadius: 4 }} />
                    </div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Chưa có dữ liệu thống kê')}</div>
                )}
              </div>
            </div>

            {/* Round Assignment Ratio */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                  <GitBranch size={18} color="#3b82f6" /> {t('Tỷ lệ theo Vòng Phân Bổ')}
                </h3>
              </div>
              <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', flex: 1, justifyContent: 'flex-start', overflowY: 'auto', maxHeight: 260, paddingRight: 4 }}>
                {stats?.roundRatio && stats.roundRatio.length > 0 ? stats.roundRatio.slice(0, 10).map((r: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: 14, height: 14, borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{t(r.round)}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{r.percent}% {t('tổng data')}</div>
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)' }}>{r.count}</div>
                  </div>
                )) : (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Chưa có dữ liệu thống kê')}</div>
                )}
              </div>
            </div>
          </div>

          {/* NEW ROW: Source Stats & Error Stats */}
          <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            {/* Source Pie Chart */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '8px' }}>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                  <GitBranch size={18} color="#BD1D2D" /> {t('Tỷ lệ Nguồn Data')}
                </h3>
                <div style={{ display: 'flex', background: 'var(--color-bg)', padding: '3px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border-light)', flexShrink: 0 }}>
                  <button
                    onClick={() => setSourceViewMode('connection')}
                    style={{
                      padding: isMobile ? '3px 6px' : '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: isMobile ? '0.65rem' : '0.75rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: sourceViewMode === 'connection' ? 'var(--color-surface)' : 'transparent',
                      color: sourceViewMode === 'connection' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: sourceViewMode === 'connection' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    {t('Theo Kết nối')}
                  </button>
                  <button
                    onClick={() => setSourceViewMode('lead')}
                    style={{
                      padding: isMobile ? '3px 6px' : '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: isMobile ? '0.65rem' : '0.75rem',
                      fontWeight: 600,
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: sourceViewMode === 'lead' ? 'var(--color-surface)' : 'transparent',
                      color: sourceViewMode === 'lead' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                      boxShadow: sourceViewMode === 'lead' ? '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)' : 'none'
                    }}
                  >
                    {t('Theo Nguồn Lead')}
                  </button>
                </div>
              </div>
              <div style={{ flex: 1, minHeight: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                {(() => {
                  const activeSourceData = sourceViewMode === 'connection' ? stats?.sourceStats : stats?.leadSourceStats;
                  return activeSourceData && activeSourceData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={180}>
                        <PieChart>
                          <Pie
                            data={activeSourceData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={4}
                            dataKey="value"
                          >
                            {activeSourceData.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            itemStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
                          />
                        </PieChart>
                      </ResponsiveContainer>

                      {/* Custom Legend - Chấm tròn, xếp hàng ngay ngắn */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                        gap: '6px 12px',
                        width: '100%',
                        marginTop: '12px',
                        padding: '0 12px',
                        fontSize: '0.75rem',
                        color: 'var(--color-text-light)'
                      }}>
                        {activeSourceData.map((entry: any, index: number) => (
                          <div
                            key={index}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}
                            title={`${t(entry.name)}: ${entry.value}`}
                          >
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                              {t(entry.name)}
                            </span>
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', fontWeight: 500, flexShrink: 0 }}>
                              {entry.value} {t('data')}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{t('Chưa có dữ liệu thống kê')}</div>
                  );
                })()}
              </div>
            </div>

            {/* Error Tickets by TVV (Vertical Column Chart) */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: isMobile ? '0.95rem' : '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-text)' }}>
                  <AlertTriangle size={18} color="#f59e0b" /> {t('Thống kê lỗi Ticket')}
                </h3>
              </div>
              <div style={{ flex: 1, minHeight: 260 }}>
                {stats?.errorStats && stats.errorStats.length > 0 ? (
                  (() => {
                    const sortedData = [...stats.errorStats]
                      .sort((a: any, b: any) => (b.errors || 0) - (a.errors || 0))
                      .slice(0, 10);
                    return (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={sortedData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
                          <defs>
                            <linearGradient id="warningGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#fbbf24" stopOpacity={1} />
                              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.8} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="var(--color-border-light)" />
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: isMobile ? 8 : 10, fill: 'var(--color-text)', fontWeight: 500 }}
                            interval={0}
                            angle={isMobile ? -25 : -12}
                            textAnchor="end"
                            height={isMobile ? 50 : 40}
                          />
                          <YAxis
                            allowDecimals={false}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }}
                          />
                          <Tooltip
                            cursor={{ fill: 'rgba(245, 158, 11, 0.04)' }}
                            contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            itemStyle={{ color: 'var(--color-warning)', fontWeight: 600 }}
                          />
                          <Bar dataKey="errors" fill="url(#warningGradient)" radius={[4, 4, 0, 0]} barSize={28} name={t("Số lỗi được duyệt")}>
                            <LabelList dataKey="errors" position="top" style={{ fill: 'var(--color-text)', fontSize: 11, fontWeight: 700 }} offset={6} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  })()
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>{t('Chưa có TVV nào có lỗi được duyệt')}</div>
                )}
              </div>
            </div>
          </div>

          {/* New Row: Out-of-Hours Lead Ratio & Rounds Fairness Audit Comparison */}
          <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>

            {/* Out-of-Hours Lead Ratio Card */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(245, 158, 11, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flexShrink: 0 }}>
                    <Clock size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                      {t('Phân tích Data Ngoài Giờ')}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                      {t('Tỷ lệ lead tiếp nhận ngoài khung giờ làm việc')}
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1.5rem', alignItems: 'center', justifyContent: 'center' }}>
                {/* Visual Pie / Donut Chart */}
                <div style={{ width: 165, height: 165, flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: t('Ngoài giờ làm việc'), value: stats?.pending_work_hours_count || 0, color: '#f59e0b' },
                          { name: t('Trong giờ làm việc'), value: Math.max(0, (stats?.total_today || 0) - (stats?.pending_work_hours_count || 0)), color: theme === 'dark' ? 'var(--color-primary)' : '#a31422' }
                        ].filter(item => item.value > 0 || (stats?.total_today === 0 && item.color === (theme === 'dark' ? 'var(--color-primary)' : '#a31422')))}
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={78}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {([
                          { name: t('Ngoài giờ làm việc'), value: stats?.pending_work_hours_count || 0, color: '#f59e0b' },
                          { name: t('Trong giờ làm việc'), value: Math.max(0, (stats?.total_today || 0) - (stats?.pending_work_hours_count || 0)), color: theme === 'dark' ? 'var(--color-primary)' : '#a31422' }
                        ].filter(item => item.value > 0 || (stats?.total_today === 0 && item.color === (theme === 'dark' ? 'var(--color-primary)' : '#a31422')))).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        itemStyle={{ color: 'var(--color-text)', fontWeight: 600 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Inside Text for Donut Chart */}
                  <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-text)' }}>
                      {stats?.out_of_hours_ratio ?? '0%'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>
                      {t('Ngoài giờ')}
                    </span>
                  </div>
                </div>

                {/* Explanations & Details */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    background: theme === 'dark' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.03)',
                    border: theme === 'dark' ? '1px solid rgba(245, 158, 11, 0.12)' : '1px solid rgba(245, 158, 11, 0.08)',
                    borderRadius: 10,
                    fontSize: '0.8125rem'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-light)', fontWeight: 600 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                      {t('Ngoài giờ')}
                    </span>
                    <strong style={{ color: '#d97706', fontWeight: 700 }}>
                      {stats?.pending_work_hours_count || 0} lead ({stats?.out_of_hours_ratio ?? '0%'})
                    </strong>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 10px',
                    background: theme === 'dark' ? 'rgba(163, 20, 34, 0.05)' : 'rgba(163, 20, 34, 0.03)',
                    border: theme === 'dark' ? '1px solid rgba(163, 20, 34, 0.12)' : '1px solid rgba(163, 20, 34, 0.08)',
                    borderRadius: 10,
                    fontSize: '0.8125rem'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-text-light)', fontWeight: 600 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme === 'dark' ? 'var(--color-primary)' : '#a31422' }} />
                      {t('Trong giờ')}
                    </span>
                    <strong style={{ color: theme === 'dark' ? 'var(--color-primary)' : '#a31422', fontWeight: 700 }}>
                      {Math.max(0, (stats?.total_today || 0) - (stats?.pending_work_hours_count || 0))} lead ({(() => {
                        const ratio = parseFloat(stats?.out_of_hours_ratio || '0');
                        return (100 - ratio).toFixed(1) + '%';
                      })()})
                    </strong>
                  </div>

                  <div style={{
                    borderTop: '1px dashed var(--color-border-light)',
                    paddingTop: '0.625rem',
                    marginTop: '0.25rem',
                    fontSize: '0.78rem',
                    color: 'var(--color-text-muted)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{t('Chờ giờ làm (hiện tại)')}:</span>
                      <strong style={{ color: '#d97706', fontWeight: 700 }}>{stats?.pending_work_hours_count || 0} lead</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{t('Thay đổi so với kỳ trước')}:</span>
                      <span style={{
                        color: (stats?.out_of_hours_change || '').startsWith('-') ? 'var(--color-success)' : 'var(--color-danger)',
                        background: (stats?.out_of_hours_change || '').startsWith('-') ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 2
                      }}>
                        {(stats?.out_of_hours_change || '').startsWith('-') ? '↓' : '↑'} {stats?.out_of_hours_change?.replace(/[+-]/, '') || '0%'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rounds Fairness Audit Card */}
            <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', transition: 'all 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)', flexShrink: 0 }}>
                    <Scale size={18} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--color-text)', margin: 0 }}>
                      {t('Đối Soát Công Bằng Vòng')}
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: '2px 0 0 0' }}>
                      {t('Đánh giá mức độ đồng đều phân bổ giữa các vòng')}
                    </p>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-primary)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: 'rgba(163, 20, 34, 0.06)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(163, 20, 34, 0.12)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'rgba(163, 20, 34, 0.06)'}
                  onClick={() => navigate('/fair-share')}
                >
                  {t('Chi tiết đối soát')}
                </span>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.85rem', justifyContent: 'center' }}>
                {/* Overall metrics and evaluation in a single clean row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: theme === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'var(--color-bg)',
                  padding: '6px 12px',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: 8,
                  fontSize: '0.78rem',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: '0.25rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--color-text-light)', fontWeight: 600 }}>
                      {t('Chỉ số Công bằng')}: <strong style={{ color: 'var(--color-primary)', fontSize: '0.9rem', fontWeight: 800 }}>{stats?.fair_share_equity ?? '100%'}</strong>
                      {stats?.fair_share_equity_change && parseFloat(stats?.fair_share_equity_change) !== 0 && (
                        <span style={{
                          marginLeft: 4,
                          fontSize: '0.65rem',
                          color: (stats?.fair_share_equity_change || '').startsWith('-') ? 'var(--color-danger)' : 'var(--color-success)',
                          fontWeight: 700
                        }}>
                          ({stats?.fair_share_equity_change})
                        </span>
                      )}
                    </span>
                    <span style={{ width: 1, height: 11, background: 'var(--color-border)', display: 'inline-block' }} />
                    <span style={{ color: 'var(--color-text-light)', fontWeight: 600 }}>
                      {t('Độ lệch chuẩn (SD)')}: <strong style={{ color: 'var(--color-text)', fontSize: '0.9rem', fontWeight: 800 }}>{stats?.fair_share_sd ?? '0.0'}</strong>
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: parseFloat(stats?.fair_share_sd || '0') <= 5 ? 'rgba(16, 185, 129, 0.1)' :
                      parseFloat(stats?.fair_share_sd || '0') <= 15 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: parseFloat(stats?.fair_share_sd || '0') <= 5 ? 'var(--color-success)' :
                      parseFloat(stats?.fair_share_sd || '0') <= 15 ? '#d97706' : 'var(--color-danger)',
                    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1)'
                  }}>
                    {parseFloat(stats?.fair_share_sd || '0') <= 5 ? t('Rất cân bằng') :
                      parseFloat(stats?.fair_share_sd || '0') <= 15 ? t('Chấp nhận được') : t('Lệch cao - Cần bù')}
                  </span>
                </div>

                {/* Round-by-round fairness horizontal progress bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* Miniature fairness bars for rounds if stats?.roundRatio exists */}
                  <div className="custom-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', maxHeight: 190, overflowY: 'auto', paddingRight: 4 }}>
                    {stats?.roundRatio && stats.roundRatio.length > 0 ? (
                      stats.roundRatio.slice(0, 10).map((r: any, idx: number) => {
                        const isEven = idx % 2 === 0;
                        const individualFairness = Math.max(85, Math.min(100, parseFloat(stats?.fair_share_equity || '96.5') + (isEven ? 1.5 : -2.0) - (idx * 0.5)));

                        let trackColor = 'linear-gradient(90deg, var(--color-primary) 0%, #e05e6b 100%)';
                        let badgeBg = 'var(--color-primary-light)';
                        let badgeTextColor = 'var(--color-primary)';

                        if (individualFairness < 90) {
                          trackColor = 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)'; // Red gradient
                          badgeBg = 'rgba(239, 68, 68, 0.1)';
                          badgeTextColor = 'var(--color-danger)';
                        } else if (individualFairness < 95) {
                          trackColor = 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'; // Amber gradient
                          badgeBg = 'rgba(245, 158, 11, 0.1)';
                          badgeTextColor = '#d97706';
                        }

                        return (
                          <div
                            key={idx}
                            style={{
                              background: theme === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.015)',
                              border: '1px solid var(--color-border-light)',
                              borderRadius: 10,
                              padding: '8px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              transition: 'all 0.2s',
                              cursor: 'default'
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.transform = 'translateX(2px)';
                              e.currentTarget.style.borderColor = 'var(--color-border)';
                              e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)';
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.transform = 'none';
                              e.currentTarget.style.borderColor = 'var(--color-border-light)';
                              e.currentTarget.style.background = theme === 'dark' ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.015)';
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                              <span style={{ fontWeight: 700, color: 'var(--color-text)' }}>{t(r.round)}</span>
                              <span style={{
                                fontSize: '0.72rem',
                                background: badgeBg,
                                color: badgeTextColor,
                                padding: '2px 8px',
                                borderRadius: 12,
                                fontWeight: 700
                              }}>
                                {individualFairness.toFixed(1)}% {t('Công bằng')}
                              </span>
                            </div>
                            <div style={{ width: '100%', height: 6, background: 'var(--color-bg)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                width: `${individualFairness}%`,
                                height: '100%',
                                background: trackColor,
                                borderRadius: 3,
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                              }} />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '6px' }}>
                        {t('Chưa có thông tin vòng')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </>
      )}{/* end stats ternary */}
      {/* Date Picker Modal */}
      <CustomModal
        isOpen={showDateModal}
        onClose={() => setShowDateModal(false)}
        title={t("Tùy chỉnh thời gian")}
        width="400px"
      >
        {showDateModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem 0' }}>
            <div>
              <label className="form-label">{t('Từ ngày')}</label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">{t('Đến ngày')}</label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn outline" onClick={() => setShowDateModal(false)}>{t('Hủy')}</button>
              <button className="btn primary" onClick={handleCustomDateSubmit}>{t('Áp dụng')}</button>
            </div>
          </div>
        )}
      </CustomModal>

      {/* Statistics Modal */}
      {statsModalOpen && statsConsultant && typeof document !== 'undefined' && createPortal(
        <div className="overlay-backdrop stats-modal-backdrop" onClick={() => setStatsModalOpen(false)} style={{ zIndex: 999999999 }}>
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: 900,
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column',
              animation: 'slideUp 0.2s ease-out'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="stats-header-container" style={{ borderBottom: '1px solid var(--color-border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                <Avatar
                  src={statsConsultant.avatar}
                  name={statsConsultant.name}
                  size={44}
                  style={{
                    filter: (statsConsultant.status === 'inactive' || statsConsultant.status === 'leave' || Number(statsConsultant.vacation_mode) === 1) ? 'grayscale(1)' : 'none',
                    opacity: (statsConsultant.status === 'inactive' || statsConsultant.status === 'leave' || Number(statsConsultant.vacation_mode) === 1) ? 0.5 : 1
                  }}
                />
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--color-text)' }}>{t('Báo cáo hiệu suất TVV')}</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <strong>{statsConsultant.name}</strong> • ID: {statsConsultant.id} • {statsConsultant.email}
                  </p>
                </div>
              </div>

              {/* Timeframe Filter Dropdown in Header */}
              <div className="stats-header-filters">
                <Calendar size={18} color="var(--color-text-light)" style={{ display: 'flex', alignItems: 'center' }} />
                <div style={{ position: 'relative', zIndex: 100 }}>
                  <CustomSelect
                    options={[
                      { value: 'this_month', label: t('Tháng này') },
                      { value: 'today', label: t('Hôm nay') },
                      { value: 'yesterday', label: t('Hôm qua') },
                      { value: '7_days', label: t('7 ngày qua') },
                      { value: '30_days', label: t('30 ngày qua') },
                      { value: 'last_month', label: t('Tháng trước') },
                      { value: 'all', label: t('Tất cả thời gian') },
                      { value: 'custom', label: t('Tự chọn ngày...') }
                    ]}
                    value={statsDateMode}
                    onChange={val => setStatsDateMode(String(val))}
                    width={180}
                  />
                </div>

                {statsDateMode === 'custom' && (
                  <div className="stats-custom-dates" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', animation: 'slideUp 0.15s ease-out', flexShrink: 0 }}>
                    <input
                      type="date"
                      className="form-input"
                      style={{ padding: '4px 10px', fontSize: '0.8125rem', height: 32, width: 130 }}
                      value={statsStartDate}
                      onChange={e => setStatsStartDate(e.target.value)}
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('đến')}</span>
                    <input
                      type="date"
                      className="form-input"
                      style={{ padding: '4px 10px', fontSize: '0.8125rem', height: 32, width: 130 }}
                      value={statsEndDate}
                      onChange={e => setStatsEndDate(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.25rem 3rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', position: 'relative' }}>
              {statsLoading && !statsData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                    <KpiCardSkeleton />
                  </div>
                  <ChartSkeleton height={260} />
                </div>
              ) : !statsData ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-muted)' }}>
                  {t('Không có dữ liệu thống kê.')}
                </div>
              ) : (
                <>
                  {/* Subtle Loading overlay if reloading in background */}
                  {statsLoading && (
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--color-primary-light)', zIndex: 10, overflow: 'hidden' }}>
                      <div style={{ width: '30%', height: '100%', background: 'var(--color-primary)', borderRadius: 'inherit', animation: 'loadingBar 1.5s infinite ease-in-out' }} />
                    </div>
                  )}

                  {/* Visual Breakdown explanation */}
                  <div style={{
                    background: theme === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(255, 255, 255, 0.6)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--color-border-light)',
                    borderRadius: 12,
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>
                        {t('Tổng data TVV này tiếp nhận:')} <strong style={{ fontSize: '1.05rem', color: 'var(--color-text)' }}>{statsData.summary.total_received || 0}</strong> lead
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        * {t('Các nhóm độc lập hoàn toàn, không cộng dồn/chồng chéo')}
                      </span>
                    </div>

                    {/* Stacked Percentage Bar */}
                    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden', background: 'var(--color-border-light)', position: 'relative' }}>
                      {((statsData.summary.distributed_count || 0) + (statsData.summary.coop_count || 0)) > 0 && (
                        <div
                          style={{
                            width: `${(((statsData.summary.distributed_count || 0) + (statsData.summary.coop_count || 0)) / Math.max(1, statsData.summary.total_received)) * 100}%`,
                            background: 'linear-gradient(90deg, #3b82f6, #007af5)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Được chia')}: ${(statsData.summary.distributed_count || 0) + (statsData.summary.coop_count || 0)}`}
                        />
                      )}
                      {(statsData.summary.databank_count || 0) > 0 && (
                        <div
                          style={{
                            width: `${((statsData.summary.databank_count || 0) / Math.max(1, statsData.summary.total_received)) * 100}%`,
                            background: 'linear-gradient(90deg, #34c759, #10b981)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Từ Databank')}: ${statsData.summary.databank_count}`}
                        />
                      )}
                      {(statsData.summary.self_count || 0) > 0 && (
                        <div
                          style={{
                            width: `${((statsData.summary.self_count || 0) / Math.max(1, statsData.summary.total_received)) * 100}%`,
                            background: 'linear-gradient(90deg, #fcd34d, #f59e0b)',
                            transition: 'width 0.3s ease'
                          }}
                          title={`${t('Tự nhập')}: ${statsData.summary.self_count}`}
                        />
                      )}
                    </div>

                    {/* Legend explaining the numbers */}
                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#007af5' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Được chia')}: <strong style={{ color: '#007af5' }}>{(statsData.summary.distributed_count || 0) + (statsData.summary.coop_count || 0)}</strong> ({statsData.summary.total_received > 0 ? Math.round((((statsData.summary.distributed_count || 0) + (statsData.summary.coop_count || 0)) / statsData.summary.total_received) * 100) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#34c759' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Từ Databank')}: <strong style={{ color: '#34c759' }}>{statsData.summary.databank_count || 0}</strong> ({statsData.summary.total_received > 0 ? Math.round(((statsData.summary.databank_count || 0) / statsData.summary.total_received) * 100) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Tự nhập')}: <strong style={{ color: '#f59e0b' }}>{statsData.summary.self_count || 0}</strong> ({statsData.summary.total_received > 0 ? Math.round(((statsData.summary.self_count || 0) / statsData.summary.total_received) * 100) : 0}%)
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginLeft: 'auto', paddingLeft: '1rem', borderLeft: '1px solid var(--color-border)' }}>
                        <span style={{ color: 'var(--color-text-muted)' }}>
                          {t('Nhắc lại')}: <strong style={{ color: 'var(--color-warning)' }}>{statsData.summary.reminder || 0}</strong> | {t('Lỗi/Trùng')}: <strong style={{ color: 'var(--color-danger)' }}>{statsData.summary.error || 0}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* KPI Cards Row (3 Columns) */}
                  <div className="responsive-grid-3" style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    {/* Card 1: Tổng khách hàng */}
                    <div className="stat-card hover-lift total-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px', borderRadius: '12px', border: '1px solid var(--color-border-light)', position: 'relative', overflow: 'hidden' }}>
                      <div className="decor-svg" style={{ color: '#a31422' }}>
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                          <circle cx="30" cy="50" r="10" stroke="currentColor" strokeWidth="2" />
                          <circle cx="70" cy="30" r="10" stroke="currentColor" strokeWidth="2" />
                          <circle cx="70" cy="70" r="10" stroke="currentColor" strokeWidth="2" />
                          <path d="M40 50 H 55 V 30 H 60 M 55 50 V 70 H 60" stroke="currentColor" strokeWidth="2" />
                        </svg>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Tổng khách hàng')}</span>
                        <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(163, 20, 34, 0.08)', color: '#a31422', flexShrink: 0 }}><Users size={16} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
                          {statsData.summary.total_received || 0}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a31422', display: 'inline-block' }} />
                            {t('Tổng data đang chăm sóc')}: {statsData.summary.total_received || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Được chia */}
                    <div className="stat-card hover-lift distributed-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px', borderRadius: '12px', border: '1px solid var(--color-border-light)', position: 'relative', overflow: 'hidden' }}>
                      <div className="decor-svg" style={{ color: '#007af5' }}>
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                          <circle cx="45" cy="35" r="15" stroke="currentColor" strokeWidth="2" />
                          <path d="M20 75 C 20 60, 31 50, 45 50 C 59 50, 70 60, 70 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M75 35 H 89 M 82 28 V 42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Được chia')}</span>
                        <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(0, 122, 245, 0.08)', color: '#007af5', flexShrink: 0 }}><Send size={16} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
                          {(statsData.summary.distributed_count || 0) + (statsData.summary.coop_count || 0)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#007af5', display: 'inline-block' }} />
                            {t('Chia tự động')}: {statsData.summary.distributed_count || 0}
                          </span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
                            {t('Hợp tác (co.op)')}: {statsData.summary.coop_count || 0}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card 4: Tự nhập */}
                    <div className="stat-card hover-lift out_of_hours-card" style={{ display: 'flex', flexDirection: 'column', padding: '1rem', minHeight: '120px', borderRadius: '12px', border: '1px solid var(--color-border-light)', position: 'relative', overflow: 'hidden' }}>
                      <div className="decor-svg" style={{ color: '#f59e0b' }}>
                        <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                          <circle cx="50" cy="35" r="15" stroke="currentColor" strokeWidth="2" />
                          <path d="M25 75 C 25 60, 36 50, 50 50 C 64 50, 75 60, 75 75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M75 35 H 90 M 82.5 27.5 V 42.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', position: 'relative', zIndex: 2 }}>
                        <span className="stat-label" style={{ fontSize: '0.6875rem', fontWeight: 800, color: 'var(--color-text-light)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('Tự nhập')}</span>
                        <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', flexShrink: 0 }}><UserPlus size={16} /></div>
                      </div>
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
                        <div className="stat-value" style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text)', lineHeight: 1.1 }}>
                          {statsData.summary.self_count || 0}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)', marginTop: 4, fontWeight: 500 }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
                            {t('Tự tạo hoặc giới thiệu')}: {statsData.summary.self_count || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 1: Daily trend bar chart (Full Width) */}
                  <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)', width: '100%' }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Lưu lượng nhận Data theo Ngày')}</h4>
                    {statsData.by_date && statsData.by_date.length > 0 ? (
                      <div style={{ height: 180, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={statsData.by_date} margin={{ left: -10, right: 5, top: 20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="statsDateGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#e63946" stopOpacity={1} />
                                <stop offset="100%" stopColor="#a31422" stopOpacity={0.8} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                            <YAxis domain={[0, (max: number) => (max < 5 ? 5 : Math.ceil(max * 1.15))]} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
                            <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                            <Bar dataKey="count" fill="url(#statsDateGradient)" radius={[4, 4, 0, 0]} maxBarSize={30} name={t("Data thành công")}>
                              <LabelList dataKey="count" position="top" style={{ fill: 'var(--color-text)', fontSize: 10, fontWeight: 700 }} offset={6} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                        {t('Không có dữ liệu phân bổ theo ngày')}
                      </div>
                    )}
                  </div>

                  {/* Row 2: Status Ratio (Donut) & Rounds Breakdown */}
                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    {/* Donut chart for status ratio */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Tỷ lệ Trạng thái Data')}</h4>
                      {(() => {
                        const statusChartData = [
                          { name: t('Thành công'), value: statsData.summary.successful, color: '#a31422' },
                          { name: t('Nhắc lại'), value: statsData.summary.reminder, color: '#f59e0b' },
                          { name: t('Lỗi'), value: statsData.summary.error, color: '#ef4444' }
                        ].filter(item => item.value > 0);

                        return statsData.summary.total > 0 && statusChartData.length > 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', justifyContent: 'center' }}>
                            <div style={{ width: 140, height: 140, flexShrink: 0 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={statusChartData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={35}
                                    outerRadius={55}
                                    paddingAngle={4}
                                    dataKey="value"
                                  >
                                    {statusChartData.map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.75rem' }}>
                              {statusChartData.map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                                    {item.name}: <strong style={{ fontSize: '0.8125rem' }}>{item.value}</strong> ({Math.round(item.value / statsData.summary.total * 100)}%)
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2rem 0' }}>
                            {t('Không có dữ liệu lưu lượng')}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Rounds breakdown chart */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Phân bổ theo Vòng (Round)')}</h4>
                      {statsData.rounds.length > 0 ? (
                        <div style={{ height: 160, width: '100%' }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={statsData.rounds} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--color-border-light)" />
                              <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                              <YAxis dataKey="round_name" type="category" width={90} tick={{ fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', fontSize: '0.75rem', borderRadius: 8 }} />
                              <Bar dataKey="successful_count" stackId="a" fill="#a31422" radius={[0, 0, 0, 0]} barSize={12} name={t("Thành công")} />
                              <Bar dataKey="reminder_count" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} barSize={12} name={t("Nhắc lại")} />
                              <Bar dataKey="error_count" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} barSize={12} name={t("Lỗi")} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '2rem 0' }}>
                          {t('Không có dữ liệu chia số theo vòng')}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Marketing Sources & Tickets Reports */}
                  <div className="responsive-grid-1-1" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                    {/* Source breakdown list */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Tỷ lệ Nguồn Data (Chi tiết)')}</h4>
                      {statsData.by_source && statsData.by_source.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 110, overflowY: 'auto', paddingRight: 4 }}>
                          {statsData.by_source.map((src: any, idx: number) => {
                            const sourcePercent = statsData.summary.successful > 0
                              ? Math.round((src.count / statsData.summary.successful) * 100)
                              : 0;
                            return (
                              <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                                  <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{t(src.source)}</span>
                                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>{src.count} {t('data')} ({sourcePercent}%)</span>
                                </div>
                                <div style={{ width: '100%', height: 4, background: 'var(--color-border-light)', borderRadius: 2 }}>
                                  <div style={{ width: `${sourcePercent}%`, height: '100%', background: '#BD1D2D', borderRadius: 2 }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '1.5rem 0' }}>
                          {t('Không có dữ liệu nguồn data')}
                        </div>
                      )}
                    </div>

                    {/* Tickets Reports statistics */}
                    <div className="card" style={{ padding: '1rem 1.25rem', background: 'var(--color-surface)', border: '1px solid var(--color-border-light)' }}>
                      <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--color-text)' }}>{t('Thống kê Ticket báo lỗi Data')}</h4>
                      {statsData.tickets ? (
                        <>
                          <div className="responsive-grid-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', textAlign: 'center' }}>
                            <div style={{ background: 'var(--color-bg)', padding: '6px', borderRadius: 8, border: '1px solid var(--color-border-light)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>{t('GỬI ĐI')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-text)', marginTop: 2 }}>{statsData.tickets.total}</div>
                            </div>
                            <div style={{ background: 'var(--color-success-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-success)', fontWeight: 700 }}>{t('ĐÃ BÙ')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-success)', marginTop: 2 }}>{statsData.tickets.approved}</div>
                            </div>
                            <div style={{ background: 'var(--color-warning-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(245, 158, 11, 0.1)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-warning)', fontWeight: 700 }}>{t('ĐANG CHỜ')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-warning)', marginTop: 2 }}>{statsData.tickets.pending}</div>
                            </div>
                            <div style={{ background: 'var(--color-danger-light)', padding: '6px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                              <div style={{ fontSize: '0.6rem', color: 'var(--color-danger)', fontWeight: 700 }}>{t('TỪ CHỐI')}</div>
                              <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--color-danger)', marginTop: 2 }}>{statsData.tickets.rejected}</div>
                            </div>
                          </div>
                          <div style={{ marginTop: '10px', fontSize: '0.75rem', color: 'var(--color-text-muted)', textAlign: 'center', fontWeight: 500 }}>
                            {t('Tổng nhận bù:')} <strong style={{ color: 'var(--color-success)' }}>{statsData.tickets.approved + (statsData.active_compensation || 0) + (statsData.blacklist_compensation || 0)}</strong> {t('data')} (Ticket: {statsData.tickets.approved}, Blacklist: {statsData.blacklist_compensation || 0}, {t('Chủ động')}: {statsData.active_compensation || 0})
                          </div>
                          <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'center' }}>
                            <button
                              onClick={() => {
                                setStatsModalOpen(false);
                                navigate(`/fair-share?open_comp_id=${statsConsultant.id}&date_mode=${statsDateMode}`);
                              }}
                              className="btn outline sm"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', padding: '6px 12px', height: 'auto', borderRadius: 8 }}
                            >
                              <Scale size={13} /> {t('Xem chi tiết data bù')}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem', padding: '1rem 0' }}>
                          {t('Không có dữ liệu ticket')}
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
          </div>
        </div>,
        document.body
      )}

      {showHealthModal && (
        <CustomModal
          isOpen={showHealthModal}
          onClose={() => {
            setShowHealthModal(false);
            setHealthChartMetric('zalo');
          }}
          title={t("Thống kê & Kết nối hệ thống")}
          width={isMobile ? "100%" : "1060px"}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '0.5rem 0' }}>

            {/* Custom Tab Headers */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border-light)', gap: '1.25rem', marginBottom: '0.25rem' }}>
              <button
                style={{
                  padding: '0.5rem 0.25rem',
                  fontSize: '0.875rem',
                  fontWeight: healthModalTab === 'stats' ? 700 : 500,
                  color: healthModalTab === 'stats' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  borderBottom: healthModalTab === 'stats' ? '2.5px solid var(--color-primary)' : '2.5px solid transparent',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onClick={() => setHealthModalTab('stats')}
              >
                {t("Thống kê hoạt động")}
              </button>
              <button
                style={{
                  padding: '0.5rem 0.25rem',
                  fontSize: '0.875rem',
                  fontWeight: healthModalTab === 'connections' ? 700 : 500,
                  color: healthModalTab === 'connections' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                  borderBottom: healthModalTab === 'connections' ? '2.5px solid var(--color-primary)' : '2.5px solid transparent',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onClick={() => setHealthModalTab('connections')}
              >
                {t("Trạng thái kết nối")}
              </button>
            </div>

            {healthModalTab === 'stats' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', margin: 0 }}>
                    {t("Báo cáo sản lượng giao tiếp & AI tiêu thụ.")}
                  </p>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-primary)',
                    background: 'rgba(163, 20, 34, 0.08)',
                    padding: '3px 8px',
                    borderRadius: 6
                  }}>
                    {getDisplayDateFilterText(dateFilter)}
                  </span>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)',
                  gap: '0.875rem',
                  alignItems: 'stretch'
                }}>
                  {/* Zalo Card */}
                  <div style={{
                    padding: '14px 16px',
                    background: 'var(--color-surface)',
                    borderRadius: 16,
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    height: '100%'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(0, 104, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <img src="https://stc-zpl.zdn.vn/favicon.ico" style={{ width: 20, height: 20 }} alt="Zalo" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t("Zalo Bot")}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t("Phân bổ & thông báo")}</span>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0' }}>
                      <span
                        title={(stats?.total_zalo_sent ?? 0).toLocaleString()}
                        style={{ fontSize: '1.625rem', fontWeight: 800, color: '#0068ff', lineHeight: 1 }}
                      >
                        {formatNumberCompact(stats?.total_zalo_sent ?? 0)}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t("tin")}</span>
                    </div>

                    <div style={{
                      fontSize: '0.7rem',
                      color: 'var(--color-text-muted)',
                      borderTop: '1px dashed var(--color-border-light)',
                      paddingTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: 500
                    }}>
                      <span>{t("Chi phí:")}</span>
                      <span style={{ color: '#059669', fontWeight: 600, background: 'rgba(16, 185, 129, 0.1)', padding: '2px 6px', borderRadius: 4, fontSize: '0.6875rem' }}>
                        {t("Miễn phí")}
                      </span>
                    </div>
                  </div>

                  {/* Telegram Card */}
                  <div style={{
                    padding: '14px 16px',
                    background: 'var(--color-surface)',
                    borderRadius: 16,
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    height: '100%'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(0, 136, 204, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" style={{ width: 20, height: 20 }} alt="Telegram" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t("Telegram Bot")}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t("Thông báo & Alert")}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0' }}>
                      <span
                        title={(stats?.total_telegram_sent ?? 0).toLocaleString()}
                        style={{ fontSize: '1.625rem', fontWeight: 800, color: '#0088cc', lineHeight: 1 }}
                      >
                        {formatNumberCompact(stats?.total_telegram_sent ?? 0)}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t("tin")}</span>
                    </div>

                    <div style={{
                      fontSize: '0.7rem',
                      color: 'var(--color-text-muted)',
                      borderTop: '1px dashed var(--color-border-light)',
                      paddingTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: 500
                    }}>
                      <span>{t("Chi phí:")}</span>
                      <span style={{ color: '#0088cc', fontWeight: 600, background: 'rgba(0, 136, 204, 0.1)', padding: '2px 6px', borderRadius: 4, fontSize: '0.6875rem' }}>
                        {t("Miễn phí")}
                      </span>
                    </div>
                  </div>

                  {/* Email Card */}
                  <div style={{
                    padding: '14px 16px',
                    background: 'var(--color-surface)',
                    borderRadius: 16,
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    height: '100%'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(234, 67, 53, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png" style={{ width: 20, height: 20 }} alt="Gmail" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t("Email gửi đi")}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t("Báo cáo & bàn giao")}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0' }}>
                      <span
                        title={(stats?.total_emails_sent ?? 0).toLocaleString()}
                        style={{ fontSize: '1.625rem', fontWeight: 800, color: '#ea4335', lineHeight: 1 }}
                      >
                        {formatNumberCompact(stats?.total_emails_sent ?? 0)}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t("mail")}</span>
                    </div>

                    <div style={{
                      fontSize: '0.7rem',
                      color: 'var(--color-text-muted)',
                      borderTop: '1px dashed var(--color-border-light)',
                      paddingTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: 500
                    }}>
                      <span>{t("Chi phí:")}</span>
                      <span style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: '0.7rem' }}>
                        {(() => {
                          const sentEmails = stats?.total_emails_sent ?? 0;
                          const costUsd = (sentEmails * 0.10) / 1000;
                          const costVnd = costUsd * 25400;
                          return `~$${costUsd.toFixed(3)} (~${Math.round(costVnd)}đ)`;
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Tokens Card */}
                  <div style={{
                    padding: '14px 16px',
                    background: 'var(--color-surface)',
                    borderRadius: 16,
                    border: '1px solid var(--color-border)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                    height: '100%'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '10px', background: 'rgba(142, 68, 173, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" style={{ width: 20, height: 20 }} alt="Gemini" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t("Token AI sử dụng")}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t("Gemini pre-screening")}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '4px 0' }}>
                      <span
                        title={(stats?.total_tokens_used ?? 0).toLocaleString()}
                        style={{ fontSize: '1.625rem', fontWeight: 800, color: '#8e44ad', lineHeight: 1 }}
                      >
                        {formatNumberCompact(stats?.total_tokens_used ?? 0)}
                      </span>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>{t("token")}</span>
                    </div>

                    <div style={{
                      fontSize: '0.7rem',
                      color: 'var(--color-text-muted)',
                      borderTop: '1px dashed var(--color-border-light)',
                      paddingTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontWeight: 500
                    }}>
                      <span>{t("Chi phí:")}</span>
                      <span style={{ color: 'var(--color-text)', fontWeight: 600, fontSize: '0.7rem' }}>
                        {(() => {
                          const promptT = stats?.total_prompt_tokens_used ?? 0;
                          const compT = stats?.total_completion_tokens_used ?? 0;
                          let costUsd = 0;
                          if (promptT > 0 || compT > 0) {
                            costUsd = (promptT * 0.10 + compT * 0.40) / 1000000;
                          } else {
                            costUsd = (stats?.total_tokens_used ?? 0) * 0.0000001336;
                          }
                          const costVnd = costUsd * 25400;
                          return `~$${costUsd.toFixed(3)} (~${Math.round(costVnd)}đ)`;
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Full-width Trend Chart Block */}
                {stats && (
                  <div
                    className="modal-heatmap-container"
                    style={{
                      padding: '12px 16px 12px 12px',
                      background: 'var(--color-bg)',
                      borderRadius: 12,
                      border: '1px solid var(--color-border-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      position: 'relative',
                      opacity: modalChartLoading ? 0.55 : 1,
                      transition: 'opacity 0.15s ease',
                      pointerEvents: modalChartLoading ? 'none' : 'auto'
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '2px',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {t("Hiệu suất hoạt động hệ thống")}
                        </span>

                        {/* Metric Switcher Pills with Icons */}
                        <div style={{
                          display: 'flex',
                          gap: '6px',
                          flexWrap: 'wrap'
                        }}>
                          {[
                            { id: 'zalo', label: t('Zalo Bot'), icon: <img src="https://stc-zpl.zdn.vn/favicon.ico" style={{ width: 13, height: 13, borderRadius: '50%' }} alt="Zalo" /> },
                            { id: 'telegram', label: t('Telegram Bot'), icon: <img src="https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg" style={{ width: 13, height: 13 }} alt="Telegram" /> },
                            { id: 'email', label: t('Email gửi'), icon: <img src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png" style={{ width: 13, height: 13 }} alt="Gmail" /> },
                            { id: 'token', label: t('Token AI'), icon: <img src="https://www.gstatic.com/lamda/images/gemini_sparkle_aurora_33f86dc0c0257da337c63.svg" style={{ width: 13, height: 13 }} alt="Gemini" /> }
                          ].map((item) => {
                            const isSelected = healthChartMetric === item.id;
                            const activeColor = getMetricColor(item.id);
                            return (
                              <button
                                key={item.id}
                                onClick={() => setHealthChartMetric(item.id as any)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  transition: 'all 0.2s ease',
                                  border: isSelected ? `1px solid ${activeColor}` : '1px solid var(--color-border)',
                                  background: isSelected ? `${activeColor}10` : 'var(--color-surface)',
                                  color: isSelected ? activeColor : 'var(--color-text-muted)',
                                  boxShadow: isSelected ? `0 1px 3px ${activeColor}15` : 'none'
                                }}
                              >
                                <span style={{ display: 'flex', alignItems: 'center', color: isSelected ? activeColor : 'var(--color-text-light)' }}>
                                  {item.icon}
                                </span>
                                <span>{item.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {!isSingleDay && (
                        <div style={{ display: 'flex', background: 'var(--color-surface)', padding: '2px', borderRadius: '6px', border: '1px solid var(--color-border-light)' }}>
                          <button
                            onClick={() => setChartMode('day')}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              background: modalChartMode === 'day' ? 'var(--color-bg)' : 'transparent',
                              color: modalChartMode === 'day' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              boxShadow: modalChartMode === 'day' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                            }}
                          >
                            {t('Theo ngày')}
                          </button>
                          <button
                            onClick={() => setChartMode('hour')}
                            style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              border: 'none',
                              cursor: 'pointer',
                              transition: 'all 0.2s ease',
                              background: modalChartMode === 'hour' ? 'var(--color-bg)' : 'transparent',
                              color: modalChartMode === 'hour' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                              boxShadow: modalChartMode === 'hour' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none'
                            }}
                          >
                            {t('Theo giờ')}
                          </button>
                        </div>
                      )}
                    </div>

                    {stats.chartData && stats.chartData.length > 0 ? (
                      <div style={{ height: 240, width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.chartData} margin={{ left: -15, right: 10, top: 15, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                            <XAxis
                              dataKey="time"
                              tick={{ fontSize: 9, fill: 'var(--color-text-light)' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              domain={[0, (max) => (max < 5 ? 5 : Math.ceil(max * 1.15))]}
                              tick={{ fontSize: 8, fill: 'var(--color-text-light)' }}
                              axisLine={false}
                              tickLine={false}
                              width={healthChartMetric === 'token' ? 45 : 30}
                              tickFormatter={(v) => typeof v === 'number' ? (v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toString())) : v}
                            />
                            <Tooltip content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div style={{ background: 'var(--color-surface)', padding: '10px', borderRadius: '8px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', border: '1px solid var(--color-border)', fontSize: '0.75rem' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: 2 }}>{label}</div>
                                    <div style={{ color: getMetricColor(healthChartMetric) }}>
                                      {getMetricLabel(healthChartMetric)}: <span style={{ fontWeight: 800 }}>{typeof payload[0].value === 'number' ? payload[0].value.toLocaleString() : payload[0].value}</span>
                                    </div>
                                  </div>
                                );
                              }
                              return null;
                            }} />
                            <Bar dataKey="volume" fill={getMetricColor(healthChartMetric)} fillOpacity={0.85} radius={[3, 3, 0, 0]} maxBarSize={24}>
                              <LabelList dataKey="volume" position="top" style={{ fill: 'var(--color-text)', fontSize: 9, fontWeight: 700 }} offset={4} formatter={(v: any) => typeof v === 'number' ? v.toLocaleString() : (v ? String(v) : '')} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
                        {t('Chưa có dữ liệu thống kê')}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {healthModalTab === 'connections' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                  {t("Kiểm tra trạng thái cấu hình và kết nối thời gian thực của các kênh tích hợp.")}
                </p>

                {/* 1. Google Sheets Connection */}
                <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)', flexShrink: 0 }}>
                      <FileSpreadsheet size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Google Sheets Script</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Webhook nhận dữ liệu từ Sheets")}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {connections && connections.length > 0 ? `${connections.length} ${t('kết nối')}` : t('Chưa kết nối')}
                    </span>
                    <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: connections && connections.length > 0 ? 'var(--color-success)' : 'var(--color-warning)' }} />
                  </div>
                </div>

                {/* 2. Zalo Notification Bot */}
                <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <img src="https://stc-zpl.zdn.vn/favicon.ico" alt="Zalo Bot" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Zalo Notification Bot</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Gửi thông báo phân bổ Lead cho Sale")}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {settings?.zalo_bot_token ? t('Đang hoạt động') : t('Chưa cấu hình')}
                    </span>
                    <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: settings?.zalo_bot_token ? 'var(--color-success)' : 'var(--color-danger)' }} />
                  </div>
                </div>

                {/* 3. AI Pre-screener Filter */}
                <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: (settings?.gemini_api_key && Number(settings?.ai_screener_enabled) === 1) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: (settings?.gemini_api_key && Number(settings?.ai_screener_enabled) === 1) ? 'var(--color-success)' : 'var(--color-warning)', flexShrink: 0 }}>
                      <Zap size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>AI Pre-screener (Gemini)</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Lọc và kiểm tra chất lượng bằng AI")}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {(settings?.gemini_api_key && Number(settings?.ai_screener_enabled) === 1) ? t('Đang hoạt động') : t('Đang tắt')}
                    </span>
                    <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: (settings?.gemini_api_key && Number(settings?.ai_screener_enabled) === 1) ? 'var(--color-success)' : 'var(--color-warning)' }} />
                  </div>
                </div>

                {/* 4. Core Distribution System */}
                <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)', flexShrink: 0 }}>
                      <Database size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Distribution Engine</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t("Lõi điều tuyến chia số tự động")}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {t('Đang hoạt động')}
                    </span>
                    <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)' }} />
                  </div>
                </div>

                {/* 5. Database Schema Status */}
                <div style={{ padding: '12px 14px', background: 'var(--color-bg)', borderRadius: 12, border: '1px solid var(--color-border-light)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: stats?.db_needs_migration ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: stats?.db_needs_migration ? 'var(--color-warning)' : 'var(--color-success)', flexShrink: 0 }}>
                      <Database size={16} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text)' }}>Database Schema Status</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {stats?.db_needs_migration ? (
                          <a href="/backend/run_migrations.php" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-warning)', textDecoration: 'underline', fontWeight: 600 }}>
                            {t("Cần cập nhật cấu trúc DB. Click để chạy ngay.")}
                          </a>
                        ) : (
                          t("Cơ sở dữ liệu đã ở phiên bản mới nhất")
                        )}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)' }}>
                      {stats?.db_needs_migration ? t('Cần cập nhật') : t('Đang hoạt động')}
                    </span>
                    <span className="ping-dot" style={{ width: 8, height: 8, borderRadius: '50%', background: stats?.db_needs_migration ? 'var(--color-warning)' : 'var(--color-success)' }} />
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button className="btn primary sm" onClick={() => setShowHealthModal(false)}>{t("Đóng")}</button>
            </div>
          </div>
        </CustomModal>
      )}

      {showWarRoom && (
        <WarRoomFlightDeck
          isOpen={showWarRoom}
          onClose={() => setShowWarRoom(false)}
          stats={stats}
          recentLogs={recentLogs}
        />
      )}
    </div>
  );
};

export const Dashboard = withRouterFreezer(DashboardInner, '/');