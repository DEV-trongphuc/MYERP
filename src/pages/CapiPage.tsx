import React, { useEffect, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { fetchAPI } from '../utils/api';
import {
  Activity,
  Calendar,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Code,
  Database,
  Eye,
  FileText,
  Info,
  Link2,
  MessageCircle,
  Play,
  RefreshCw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Target,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { CustomModal } from '../components/ui/CustomModal';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Skeleton } from '../components/ui/Skeleton';
import { useUIStore } from '../store/uiStore';
import { ensureArray, extractArray } from '../utils/safeArray';

interface CapiLog {
  id: number;
  contact_id: number | null;
  pixel_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_source: string | null;
  stage_name: string | null;
  event_name: string;
  action_source: string | null;
  meta_lead_id: string | null;
  event_id: string | null;
  trigger_stage: string | null;
  trigger_mode: string | null;
  event_value: number | null;
  emq_signals: number;
  response_status: number;
  response_body: string;
  sent_payload: string;
  sent_at: string;
}

interface PipelineStageItem {
  id: number;
  system_slug: string;
  name: string;
  color: string;
  order_index: number;
  is_won: number;
  is_lost: number;
}

interface CapiSummary {
  total_events: number;
  success_events: number;
  failed_events: number;
  purchase_value_vnd: number;
  avg_emq_signals: number;
}

interface BackfillPreview {
  window_days: number;
  source_mode: string;
  min_quality_stage: string;
  eligible_7d_count: number;
  older_than_7d_count: number;
  by_event: Record<string, number>;
  candidates: Array<{
    contact_id: number;
    full_name: string;
    source: string;
    stage_name: string;
    stage_slug: string;
    target_event: string;
    event_value: number;
    has_meta_lead: boolean;
    updated_at: string;
  }>;
}

interface AudiencePreview {
  ad_account_id: string;
  page_id: string;
  crm_pools: {
    vip_enrolled?: { name: string; count: number; total_value_vnd?: number };
    fb_quality?: { name: string; count: number };
    all_quality?: { name: string; count: number };
    junk_lost?: { name: string; count: number };
    enrolled?: { name: string; count: number };
    phone_farm?: { name: string; count: number; meta_audience_id?: string | null; last_synced_at?: string | null };
  };
  live_audiences: Array<{
    id: string;
    name: string;
    subtype: string;
    approximate_count_lower_bound?: number;
    approximate_count_upper_bound?: number;
    is_value_based?: boolean;
  }>;
  live_error?: string | null;
}

interface PhoneFarmStats {
  total_blocked: number;
  by_source: Array<{ source_label: string; count: number; latest_at: string }>;
  last_imported_at: string | null;
  meta_audience_id: string | null;
  last_synced_at: string | null;
}

interface TargetAdSet {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  campaign_id: string;
  campaign_name: string;
  optimization_goal: string;
  daily_budget: number;
  flexible_layers: number;
  custom_audiences_count: number;
  excluded_audiences_count: number;
  phone_farm_excluded?: boolean;
  advantage_audience: boolean;
  geo_conflict_bug: boolean;
  has_pixel_promoted_object: boolean;
  playbook_compliant: boolean;
}

const CARD_STYLE: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E2E8F0',
  borderRadius: '16px',
  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)',
};

const formatVnd = (n: number): string =>
  new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(Math.round(n || 0)) + ' ₫';

export default function CapiPage() {
  const { addToast } = useUIStore();
  const [activeTab, setActiveTab] = useState<'logs' | 'config' | 'growth'>('logs');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings state
  const [pixelId, setPixelId] = useState('583807401361847');
  const [webPixelId, setWebPixelId] = useState('661260709828887');
  const [adAccountId, setAdAccountId] = useState('1852318231510577');
  const [tokenPreview, setTokenPreview] = useState('');
  const [tokenSource, setTokenSource] = useState('dashboard_meta_ads');
  const [customTokenInput, setCustomTokenInput] = useState('');
  const [sourceMode, setSourceMode] = useState<'all_quality' | 'meta_only'>('all_quality');
  const [minStageSlug, setMinStageSlug] = useState('needed');
  const [dualPixelEnabled, setDualPixelEnabled] = useState(true);
  const [testEventCode, setTestEventCode] = useState('');
  const [stages, setStages] = useState<PipelineStageItem[]>([]);
  const [triggers, setTriggers] = useState<Record<string, string>>({});

  // Diagnostics & Test Pixel
  const [testingPixel, setTestingPixel] = useState<'crm' | 'web' | null>(null);
  const [lastTestResult, setLastTestResult] = useState<any>(null);

  // Backfill, Audiences & AdSets state
  const [backfillPreview, setBackfillPreview] = useState<BackfillPreview | null>(null);
  const [runningBackfill, setRunningBackfill] = useState(false);
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [syncingAudiences, setSyncingAudiences] = useState(false);
  const [phoneFarmStats, setPhoneFarmStats] = useState<PhoneFarmStats | null>(null);
  const [importingPhoneFarm, setImportingPhoneFarm] = useState(false);
  const [phoneFarmProgress, setPhoneFarmProgress] = useState('');
  const [syncingPhoneFarm, setSyncingPhoneFarm] = useState(false);
  const [shieldingAdsetId, setShieldingAdsetId] = useState<string | null>(null);
  const phoneFarmFileInputRef = useRef<HTMLInputElement | null>(null);
  const [adsets, setAdsets] = useState<TargetAdSet[]>([]);
  const [loadingGrowth, setLoadingGrowth] = useState(false);
  const [optimizingId, setOptimizingId] = useState<string | null>(null);

  // Logs state
  const [logs, setLogs] = useState<CapiLog[]>([]);
  const [summary, setSummary] = useState<CapiSummary>({
    total_events: 0,
    success_events: 0,
    failed_events: 0,
    purchase_value_vnd: 0,
    avg_emq_signals: 0,
  });
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [logSearch, setLogSearch] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [retryingIds, setRetryingIds] = useState<Record<number, boolean>>({});
  const [viewPayload, setViewPayload] = useState<CapiLog | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const actionLockRef = useRef(false);

  const capiEventOptions = [
    { value: 'Skip', label: 'Không gửi (Quality Skip)', icon: <X size={14} style={{ color: '#64748b' }} /> },
    { value: 'Lead', label: 'Lead (Nhu cầu đạt chuẩn)', icon: <Search size={14} style={{ color: '#334155' }} /> },
    { value: 'ViewContent', label: 'ViewContent (Khớp CTĐT)', icon: <Eye size={14} style={{ color: '#475569' }} /> },
    { value: 'Schedule', label: 'Schedule (Tư vấn / Đề xuất)', icon: <Calendar size={14} style={{ color: '#334155' }} /> },
    { value: 'SubmitApplication', label: 'SubmitApplication (Hồ sơ)', icon: <FileText size={14} style={{ color: '#0f172a' }} /> },
    { value: 'CompleteRegistration', label: 'CompleteRegistration', icon: <CheckCircle size={14} style={{ color: '#334155' }} /> },
    { value: 'Contact', label: 'Contact (Liên hệ)', icon: <MessageCircle size={14} style={{ color: '#475569' }} /> },
    { value: 'Purchase', label: 'Purchase (Đặt cọc / Nhập học VNĐ)', icon: <Zap size={14} style={{ color: '#BD1D2D' }} /> },
  ];

  const loadCoreData = async (statusFilter = logStatusFilter) => {
    setLoading(true);
    try {
      const [resSet, resLogs] = await Promise.all([
        fetchAPI('capi/settings'),
        fetchAPI(`capi/logs?limit=150&status=${encodeURIComponent(statusFilter)}`),
      ]);

      if (resSet.success && resSet.data) {
        const d = resSet.data;
        setPixelId(d.meta_pixel_id || '583807401361847');
        setWebPixelId(d.meta_web_pixel_id || '661260709828887');
        setAdAccountId(d.meta_ad_account_id || '1852318231510577');
        setTokenPreview(d.token_preview || '');
        setTokenSource(d.token_source || 'dashboard_meta_ads');
        setSourceMode(d.capi_source_mode === 'meta_only' ? 'meta_only' : 'all_quality');
        setMinStageSlug(d.capi_quality_min_stage || 'needed');
        setDualPixelEnabled(d.capi_dual_pixel_enabled !== false);
        setTestEventCode(d.capi_test_event_code || '');
        setStages(Array.isArray(d.pipeline_stages) ? d.pipeline_stages : []);
        setTriggers(d.capi_event_triggers && typeof d.capi_event_triggers === 'object' ? d.capi_event_triggers : {});
      }

      if (resLogs.success && resLogs.data) {
        const rawLogs = Array.isArray(resLogs.data.logs) ? resLogs.data.logs : Array.isArray(resLogs.data) ? resLogs.data : [];
        setLogs(rawLogs);
        if (resLogs.data.summary) {
          setSummary(resLogs.data.summary);
        }
      }
    } catch (e: any) {
      addToast(e.message || 'Không thể tải cấu hình Meta CAPI', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadGrowthData = async () => {
    setLoadingGrowth(true);
    try {
      const [resBf, resAud, resAs, resPf] = await Promise.all([
        fetchAPI('capi/backfill/preview?days=7&limit=150'),
        fetchAPI('capi/audiences/preview'),
        fetchAPI('capi/adsets'),
        fetchAPI('capi/phone-farm/stats'),
      ]);
      if (resBf.success && resBf.data) setBackfillPreview(resBf.data);
      if (resAud.success && resAud.data) setAudiencePreview(resAud.data);
      if (resAs.success && resAs.data) {
        setAdsets(Array.isArray(resAs.data.adsets) ? resAs.data.adsets : []);
      }
      if (resPf.success && resPf.data) {
        setPhoneFarmStats(resPf.data);
      }
    } catch (e: any) {
      addToast(e.message || 'Không thể tải dữ liệu Backfill & Playbook', 'error');
    } finally {
      setLoadingGrowth(false);
    }
  };

  useEffect(() => {
    loadCoreData();
  }, []);

  useEffect(() => {
    if (activeTab === 'growth' && !backfillPreview && !audiencePreview && !loadingGrowth) {
      loadGrowthData();
    }
  }, [activeTab]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        meta_pixel_id: pixelId,
        meta_web_pixel_id: webPixelId,
        meta_ad_account_id: adAccountId,
        capi_source_mode: sourceMode,
        capi_quality_min_stage: minStageSlug,
        capi_dual_pixel_enabled: dualPixelEnabled ? 1 : 0,
        capi_test_event_code: testEventCode,
        capi_event_triggers: triggers,
      };
      if (customTokenInput.trim() !== '') {
        payload.capi_access_token = customTokenInput.trim();
      }
      const res = await fetchAPI('capi/settings', { method: 'POST', body: JSON.stringify(payload) });
      if (res.success) {
        addToast('Đã lưu cấu hình Meta CAPI & Quality Gate', 'success');
        setCustomTokenInput('');
        await loadCoreData();
      } else {
        addToast(res.message || 'Lỗi lưu cấu hình CAPI', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi kết nối', 'error');
    } finally {
      setSaving(false);
      actionLockRef.current = false;
    }
  };

  const handleClearCustomToken = async () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setSaving(true);
    try {
      const res = await fetchAPI('capi/settings', {
        method: 'POST',
        body: JSON.stringify({ capi_access_token: '' }),
      });
      if (res.success) {
        addToast('Đã chuyển sang Token Dashboard Meta Ads tự động', 'success');
        await loadCoreData();
      }
    } finally {
      setSaving(false);
      actionLockRef.current = false;
    }
  };

  const handleTestPixel = async (pixelType: 'crm' | 'web') => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setTestingPixel(pixelType);
    try {
      const res = await fetchAPI('capi/test', {
        method: 'POST',
        body: JSON.stringify({
          pixel_type: pixelType,
          pixel_id: pixelType === 'crm' ? pixelId : webPixelId,
          test_event_code: testEventCode || 'MYERP_HEALTHCHECK',
          event_name: 'Lead',
        }),
      });
      setLastTestResult(res);
      if (res.success) {
        addToast(res.message || 'Pixel hoạt động bình thường (HTTP 200)', 'success');
        loadCoreData();
      } else {
        addToast(res.message || 'Test Pixel thất bại', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi kiểm tra Pixel', 'error');
    } finally {
      setTestingPixel(null);
      actionLockRef.current = false;
    }
  };

  const handleRunBackfill = async () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setRunningBackfill(true);
    try {
      const res = await fetchAPI('capi/backfill/run', {
        method: 'POST',
        body: JSON.stringify({ days: 7, limit: 150 }),
      });
      if (res.success) {
        addToast(res.message || 'Đã chạy Backfill 7 ngày thành công', 'success');
        await Promise.all([loadGrowthData(), loadCoreData()]);
      } else {
        addToast(res.message || 'Backfill thất bại', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi chạy Backfill', 'error');
    } finally {
      setRunningBackfill(false);
      actionLockRef.current = false;
    }
  };

  const handleSyncAudiences = async () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setSyncingAudiences(true);
    try {
      const res = await fetchAPI('capi/audiences/sync', {
        method: 'POST',
        body: JSON.stringify({ page_id: '860714080649450' }),
      });
      if (res.success) {
        addToast('Đồng bộ Custom Audiences & Lookalike lên Meta thành công', 'success');
        await loadGrowthData();
      } else {
        addToast(res.message || 'Lỗi đồng bộ Audience', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi kết nối Meta Marketing API', 'error');
    } finally {
      setSyncingAudiences(false);
      actionLockRef.current = false;
    }
  };

  const handleOptimizeAdSet = async (adsetId: string) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setOptimizingId(adsetId);
    try {
      const res = await fetchAPI(`capi/adsets/${adsetId}/optimize`, {
        method: 'POST',
        body: JSON.stringify({ sync_audiences_first: false }),
      });
      if (res.success) {
        addToast(res.message || `Đã tối ưu AdSet ${adsetId} theo Playbook`, 'success');
        await loadGrowthData();
      } else {
        addToast(res.message || 'Lỗi tối ưu AdSet', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi cập nhật AdSet', 'error');
    } finally {
      setOptimizingId(null);
      actionLockRef.current = false;
    }
  };

  const normalizeClientPhone = (raw: string): string | null => {
    let digits = String(raw || '').replace(/\D+/g, '');
    if (!digits || digits.length < 9 || digits.length > 15) return null;
    if (digits.startsWith('8484') && digits.length >= 13 && digits.length <= 14) {
      digits = '84' + digits.slice(4);
    }
    if (digits.startsWith('840') && digits.length >= 11) {
      digits = '84' + digits.slice(3);
    } else if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 11) {
      digits = '84' + digits.slice(1);
    } else if (!digits.startsWith('0') && !digits.startsWith('84') && digits.length === 9) {
      digits = '84' + digits;
    }
    if (digits.length < 10 || digits.length > 15) return null;
    return digits;
  };

  const handleImportPhoneFarmFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || actionLockRef.current) return;
    actionLockRef.current = true;
    setImportingPhoneFarm(true);
    setPhoneFarmProgress('Đang đọc file Excel/CSV...');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const uniquePhones = new Set<string>();
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;
        const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, raw: false });
        if (!Array.isArray(rows)) continue;
        for (const row of rows) {
          if (!Array.isArray(row)) continue;
          for (const cell of row) {
            if (cell === null || cell === undefined) continue;
            const rawStr = String(cell).trim();
            if (!rawStr) continue;
            const parts = rawStr.split(/[,;\s/]+/);
            for (const p of parts) {
              const norm = normalizeClientPhone(p);
              if (norm) uniquePhones.add(norm);
            }
          }
        }
      }

      const phoneList = Array.from(uniquePhones);
      if (phoneList.length === 0) {
        addToast('Không tìm thấy số điện thoại hợp lệ trong file đã chọn.', 'warning');
        return;
      }

      const cleanLabel = file.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'PhoneFarm_Upload';
      const CHUNK_SIZE = 20000;
      const totalChunks = Math.ceil(phoneList.length / CHUNK_SIZE);
      for (let i = 0; i < totalChunks; i++) {
        setPhoneFarmProgress(`Đang nạp khiên chặn CRM (${i + 1}/${totalChunks})...`);
        const chunk = phoneList.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        const res = await fetchAPI('capi/phone-farm/import', {
          method: 'POST',
          body: JSON.stringify({
            phones: chunk,
            source_label: cleanLabel,
            reason: 'phone_farm_fraud',
            sync_to_meta: false,
          }),
        });
        if (!res.success) {
          throw new Error(res.message || `Lỗi nạp lô ${i + 1}`);
        }
      }

      setPhoneFarmProgress(`Đang đẩy ${phoneList.length.toLocaleString('vi-VN')} SĐT lên Custom Audience MBA ${adAccountId}...`);
      const syncRes = await fetchAPI('capi/phone-farm/sync-meta', {
        method: 'POST',
        body: JSON.stringify({ force_reupload: false, apply_to_active_adsets: true }),
      });
      if (!syncRes.success) {
        throw new Error(syncRes.message || 'Nạp DB thành công nhưng đồng bộ Meta thất bại');
      }

      addToast(`Đã chặn ${phoneList.length.toLocaleString('vi-VN')} SĐT Phone Farm trên CAPI & MBA ${adAccountId}`, 'success');
      await loadGrowthData();
    } catch (err: any) {
      addToast(err.message || 'Lỗi xử lý tệp Phone Farm', 'error');
    } finally {
      if (phoneFarmFileInputRef.current) {
        phoneFarmFileInputRef.current.value = '';
      }
      setPhoneFarmProgress('');
      setImportingPhoneFarm(false);
      actionLockRef.current = false;
    }
  };

  const handleSyncPhoneFarmToMeta = async () => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setSyncingPhoneFarm(true);
    try {
      const res = await fetchAPI('capi/phone-farm/sync-meta', {
        method: 'POST',
        body: JSON.stringify({ force_reupload: false, apply_to_active_adsets: true }),
      });
      if (res.success) {
        addToast(res.message || 'Đã đồng bộ tệp Phone Farm & gắn khiên chặn lên AdSet Active', 'success');
        await loadGrowthData();
      } else {
        addToast(res.message || 'Lỗi đồng bộ Phone Farm lên Meta', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi kết nối Meta API', 'error');
    } finally {
      setSyncingPhoneFarm(false);
      actionLockRef.current = false;
    }
  };

  const handleShieldAdSet = async (adsetId: string) => {
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    setShieldingAdsetId(adsetId);
    try {
      const res = await fetchAPI(`capi/adsets/${adsetId}/exclude-phone-farm`, { method: 'POST' });
      if (res.success) {
        addToast(res.message || `Đã gắn khiên chặn Phone Farm cho AdSet ${adsetId}`, 'success');
        await loadGrowthData();
      } else {
        addToast(res.message || 'Không thể gắn khiên chặn Phone Farm', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi cập nhật AdSet', 'error');
    } finally {
      setShieldingAdsetId(null);
      actionLockRef.current = false;
    }
  };

  const handleRetryLog = async (logId: number) => {
    if (retryingIds[logId]) return;
    setRetryingIds(prev => ({ ...prev, [logId]: true }));
    try {
      const res = await fetchAPI(`capi/retry/${logId}`, { method: 'POST' });
      if (res.success) {
        addToast('Gửi lại sự kiện CAPI thành công', 'success');
        loadCoreData();
      } else {
        addToast(res.message || 'Retry thất bại', 'error');
      }
    } catch (err: any) {
      addToast(err.message || 'Lỗi kết nối', 'error');
    } finally {
      setRetryingIds(prev => ({ ...prev, [logId]: false }));
    }
  };

  const successRate =
    summary.total_events > 0
      ? ((summary.success_events / summary.total_events) * 100).toFixed(1)
      : '0.0';

  const minStageOrder = (() => {
    const found = (Array.isArray(stages) ? stages : []).find(s => s.system_slug === minStageSlug);
    return found ? found.order_index : 3;
  })();

  const minStageOptions = (Array.isArray(stages) ? stages : [])
    .filter(s => s.order_index >= 0 && !s.is_lost)
    .map(s => ({
      value: s.system_slug,
      label: s.name,
    }));

  if (loading && stages.length === 0) {
    return (
      <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <Skeleton style={{ height: '68px', borderRadius: '16px' }} />
        <div className="dashboard-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <Skeleton style={{ height: '124px', borderRadius: '16px' }} />
          <Skeleton style={{ height: '124px', borderRadius: '16px' }} />
          <Skeleton style={{ height: '124px', borderRadius: '16px' }} />
          <Skeleton style={{ height: '124px', borderRadius: '16px' }} />
        </div>
        <Skeleton style={{ height: '380px', borderRadius: '16px' }} />
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h1 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Meta Conversions API (CAPI) & Tối ưu tệp học Ads
            </h1>
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 12px',
                borderRadius: '8px',
                border: '1px solid #E2E8F0',
                background: '#FFFFFF',
                color: '#334155',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Info size={14} style={{ color: '#BD1D2D' }} /> Nguyên tắc Quality CAPI
            </button>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.84rem', color: '#64748B' }}>
            Chặn rác từ gốc (từ chối New Lead / Spam), bắn Dual-Pixel & đồng bộ VIP Value-Based Lookalike lên MBA 577 (`act_{adAccountId}`).
          </p>
        </div>

        {/* Subtab Segmented Control (Chapter V DNA) */}
        <div
          style={{
            display: 'inline-flex',
            padding: '4px',
            borderRadius: '10px',
            background: '#F1F5F9',
            border: '1px solid #E2E8F0',
            gap: '2px',
          }}
        >
          {[
            { id: 'logs', label: `Nhật ký (${summary.total_events})` },
            { id: 'config', label: 'Quality Gate & Dual Pixel' },
            { id: 'growth', label: 'Backfill 7d & Playbook MBA 577' },
          ].map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  height: '32px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  border: 'none',
                  background: active ? '#FFFFFF' : 'transparent',
                  color: active ? '#BD1D2D' : '#64748B',
                  fontWeight: active ? 700 : 600,
                  fontSize: '0.8125rem',
                  fontVariantNumeric: 'tabular-nums',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4 KPI Cards (Chapter V DNA) */}
      <div
        className="dashboard-kpi-grid"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}
      >
        <div className="stat-card" style={{ ...CARD_STYLE, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', fontSize: '0.73rem', fontWeight: 700, letterSpacing: '0.04em', color: '#64748b' }}>
              TỔNG SỰ KIỆN ĐÃ BẮN
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Activity size={17} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', margin: '8px 0' }}>
            {summary.total_events.toLocaleString('vi-VN')}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5, fontVariantNumeric: 'tabular-nums' }}>
            <div>• Thành công: <strong style={{ color: '#0f172a' }}>{summary.success_events}</strong></div>
            <div>• Thất bại: <strong style={{ color: '#0f172a' }}>{summary.failed_events}</strong></div>
          </div>
        </div>

        <div className="stat-card" style={{ ...CARD_STYLE, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', fontSize: '0.73rem', fontWeight: 700, letterSpacing: '0.04em', color: '#64748b' }}>
              TỶ LỆ ĐỒNG BỘ 2XX
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(189, 29, 45, 0.08)', color: '#BD1D2D', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={17} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.85rem', fontWeight: 700, color: '#BD1D2D', fontVariantNumeric: 'tabular-nums', margin: '8px 0' }}>
            {successRate}%
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
            <div>• Ngưỡng lọc: <strong style={{ color: '#0f172a' }}>{minStageSlug}+</strong></div>
            <div>• Nguồn: <strong style={{ color: '#0f172a' }}>{sourceMode === 'all_quality' ? 'Toàn kênh' : 'Chỉ Meta'}</strong></div>
          </div>
        </div>

        <div className="stat-card" style={{ ...CARD_STYLE, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', fontSize: '0.73rem', fontWeight: 700, letterSpacing: '0.04em', color: '#64748b' }}>
              TÍN HIỆU KHỚP (EMQ)
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(15, 23, 42, 0.06)', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={17} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.85rem', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', margin: '8px 0' }}>
            {summary.avg_emq_signals} tín hiệu
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5, fontVariantNumeric: 'tabular-nums' }}>
            <div>• CRM Pixel: <strong style={{ color: '#0f172a' }}>{pixelId}</strong></div>
            <div>• Web Pixel: <strong style={{ color: '#0f172a' }}>{webPixelId}</strong></div>
          </div>
        </div>

        <div className="stat-card" style={{ ...CARD_STYLE, padding: '16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="stat-label" style={{ textTransform: 'uppercase', fontSize: '0.73rem', fontWeight: 700, letterSpacing: '0.04em', color: '#64748b' }}>
              DOANH THU PURCHASE CAPI
            </span>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(15, 23, 42, 0.06)', color: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={17} />
            </div>
          </div>
          <div className="stat-value" style={{ fontSize: '1.65rem', fontWeight: 700, color: '#0f172a', fontVariantNumeric: 'tabular-nums', margin: '8px 0' }}>
            {formatVnd(summary.purchase_value_vnd)}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748b', lineHeight: 1.5 }}>
            <div>• Tiền tệ: <strong style={{ color: '#0f172a' }}>VNĐ</strong></div>
            <div>• Token: <strong style={{ color: '#0f172a' }}>{tokenSource === 'dashboard_meta_ads' ? 'Dashboard Ads' : 'Custom'}</strong></div>
          </div>
        </div>
      </div>

      {/* TAB 1: CONFIG & 14-STAGE QUALITY MATRIX */}
      {activeTab === 'config' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px', alignItems: 'start' }}>
          <form onSubmit={handleSaveSettings} style={{ ...CARD_STYLE, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  1. Dual-Pixel, Token & Ngưỡng lọc chất lượng
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '4px 0 0' }}>
                  Mặc định dùng Token Dashboard Meta Ads đang hoạt động ổn định.
                </p>
              </div>
              <button
                type="submit"
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#BD1D2D',
                  color: '#FFFFFF',
                  fontWeight: 600,
                  fontSize: '0.84rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving ? <RefreshCw size={15} className="spin" /> : <Save size={15} />}
                Lưu cấu hình
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    CRM Pixel ID (Chính)
                  </label>
                  <input
                    className="form-input"
                    value={pixelId}
                    onChange={e => setPixelId(e.target.value)}
                    placeholder="583807401361847"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Web Landing Pixel ID
                  </label>
                  <input
                    className="form-input"
                    value={webPixelId}
                    onChange={e => setWebPixelId(e.target.value)}
                    placeholder="661260709828887"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Ad Account ID (MBA 577)
                  </label>
                  <input
                    className="form-input"
                    value={adAccountId}
                    onChange={e => setAdAccountId(e.target.value)}
                    placeholder="1852318231510577"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Test Event Code (tuỳ chọn)
                  </label>
                  <input
                    className="form-input"
                    value={testEventCode}
                    onChange={e => setTestEventCode(e.target.value)}
                    placeholder="VD: TEST12345 (để trống khi chạy thật)"
                  />
                </div>
              </div>

              {/* Token Status & Optional Override */}
              <div style={{ padding: '12px 16px', borderRadius: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0F172A' }}>
                    Access Token đang dùng: <span style={{ color: '#BD1D2D' }}>{tokenSource === 'dashboard_meta_ads' ? 'Dashboard Meta Ads (Tự động)' : 'Token ghi đè riêng'}</span>
                  </span>
                  {tokenSource !== 'dashboard_meta_ads' && (
                    <button
                      type="button"
                      onClick={handleClearCustomToken}
                      style={{ fontSize: '0.75rem', fontWeight: 600, color: '#BD1D2D', background: 'transparent', border: 'none', cursor: 'pointer' }}
                    >
                      Dùng lại Token Dashboard
                    </button>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#475569', marginBottom: '8px' }}>
                  {tokenPreview || 'Chưa có token'}
                </div>
                <input
                  type="password"
                  className="form-input"
                  value={customTokenInput}
                  onChange={e => setCustomTokenInput(e.target.value)}
                  placeholder="Để trống để dùng Token Dashboard Meta Ads, hoặc dán token khác để ghi đè..."
                />
              </div>

              {/* Quality Gates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Ngưỡng stage tối thiểu được bắn CAPI
                  </label>
                  <CustomSelect
                    options={minStageOptions}
                    value={minStageSlug}
                    onChange={v => setMinStageSlug(String(v))}
                    width="100%"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Phạm vi nguồn Lead
                  </label>
                  <CustomSelect
                    options={[
                      { value: 'all_quality', label: 'Tất cả nguồn đạt chuẩn (All Quality)', icon: <Users size={14} /> },
                      { value: 'meta_only', label: 'Chỉ Lead có nguồn Meta / FB / Web Pixel', icon: <Link2 size={14} /> },
                    ]}
                    value={sourceMode}
                    onChange={v => setSourceMode(v === 'meta_only' ? 'meta_only' : 'all_quality')}
                    width="100%"
                  />
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', fontWeight: 600, color: '#0F172A', cursor: 'pointer', paddingTop: '4px' }}>
                <input
                  type="checkbox"
                  checked={dualPixelEnabled}
                  onChange={e => setDualPixelEnabled(e.target.checked)}
                />
                Bật định tuyến Dual-Pixel (Lead Web có `_fbc`/`_fbp` → Web Pixel {webPixelId}; Lead Ads/CRM → CRM Pixel {pixelId})
              </label>

              {/* Quick Live Test Buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', borderTop: '1px solid #F1F5F9', paddingTop: '16px' }}>
                <button
                  type="button"
                  disabled={testingPixel !== null}
                  onClick={() => handleTestPixel('crm')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    color: '#0F172A',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  <Send size={14} style={{ color: '#BD1D2D' }} />
                  {testingPixel === 'crm' ? 'Đang test...' : `Test CRM Pixel (${pixelId})`}
                </button>
                <button
                  type="button"
                  disabled={testingPixel !== null}
                  onClick={() => handleTestPixel('web')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: '#F8FAFC',
                    color: '#0F172A',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  <Send size={14} style={{ color: '#334155' }} />
                  {testingPixel === 'web' ? 'Đang test...' : `Test Web Pixel (${webPixelId})`}
                </button>
              </div>

              {lastTestResult && (
                <div style={{ padding: '12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0', fontSize: '0.78rem' }}>
                  <div style={{ fontWeight: 600, color: lastTestResult.success ? '#10b981' : '#BD1D2D' }}>
                    {lastTestResult.message}
                  </div>
                  <pre style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#475569', overflowX: 'auto' }}>
                    {JSON.stringify(lastTestResult.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </form>

          {/* 14-Stage Pipeline Trigger Matrix */}
          <div style={{ ...CARD_STYLE, padding: '20px' }}>
            <div style={{ marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                2. Ma trận chuyển đổi 14 giai đoạn tuyển sinh
              </h2>
              <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '4px 0 0' }}>
                Các giai đoạn dưới <strong>{minStageSlug}</strong> hoặc Lost/Junk tự động bị khoá <code>Skip</code> để thuật toán Meta chỉ học tệp chất lượng.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(Array.isArray(stages) ? stages : []).map(st => {
                const belowGate = st.is_lost === 1 || (st.order_index >= 0 && st.order_index < minStageOrder);
                const currVal = belowGate ? 'Skip' : (triggers[st.system_slug] || 'Skip');
                return (
                  <div
                    key={st.system_slug}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '10px',
                      background: belowGate ? '#F8FAFC' : '#FFFFFF',
                      border: '1px solid #E2E8F0',
                      opacity: belowGate ? 0.78 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '999px',
                          background: belowGate ? '#CBD5E1' : st.color || '#BD1D2D',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {st.name}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'monospace' }}>
                          {st.system_slug}
                        </div>
                      </div>
                    </div>

                    {belowGate ? (
                      <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#64748B', padding: '4px 8px', borderRadius: '6px', background: '#F1F5F9' }}>
                        Khóa Skip (Dưới ngưỡng)
                      </span>
                    ) : (
                      <CustomSelect
                        options={capiEventOptions}
                        value={currVal}
                        onChange={val => setTriggers(prev => ({ ...prev, [st.system_slug]: String(val) }))}
                        width="235px"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: BACKFILL 7D, AUDIENCES & PLAYBOOK ADSETS */}
      {activeTab === 'growth' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
            {/* Card 1: 7-Day CAPI Backfill */}
            <div style={{ ...CARD_STYLE, padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Bắn bù CAPI (Cửa sổ 7 ngày Meta)
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '4px 0 0' }}>
                    Meta chỉ chấp nhận `event_time` ≤ 7 ngày qua CAPI; Lead chất lượng &gt; 7 ngày được nạp qua Custom Audience bên cạnh.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loadingGrowth || runningBackfill}
                  onClick={handleRunBackfill}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#BD1D2D',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: runningBackfill ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Play size={14} />
                  {runningBackfill ? 'Đang bắn bù...' : 'Chạy Backfill 7d'}
                </button>
              </div>

              {loadingGrowth && !backfillPreview ? (
                <Skeleton style={{ height: '160px', borderRadius: '12px' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                        Đủ điều kiện bắn CAPI (≤ 7 ngày)
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#BD1D2D', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                        {backfillPreview?.eligible_7d_count ?? 0}
                      </div>
                    </div>
                    <div style={{ padding: '12px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                        Lead lịch sử (&gt; 7 ngày → Audience)
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0F172A', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                        {(backfillPreview?.older_than_7d_count ?? 0).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  </div>

                  {backfillPreview && Array.isArray(backfillPreview.candidates) && backfillPreview.candidates.length > 0 && (
                    <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                            <th style={{ padding: '8px 12px' }}>Khách hàng</th>
                            <th style={{ padding: '8px 12px' }}>Stage</th>
                            <th style={{ padding: '8px 12px' }}>Sự kiện</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ensureArray(backfillPreview?.candidates).slice(0, 20).map(c => (
                            <tr key={c.contact_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0F172A' }}>{c.full_name}</td>
                              <td style={{ padding: '8px 12px', color: '#475569' }}>{c.stage_name}</td>
                              <td style={{ padding: '8px 12px', fontWeight: 600, color: '#BD1D2D', fontVariantNumeric: 'tabular-nums' }}>
                                {c.target_event} {c.event_value > 0 ? `(${formatVnd(c.event_value)})` : ''}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Card 2: Playbook Custom Audiences & Lookalike */}
            <div style={{ ...CARD_STYLE, padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                    Đồng bộ tệp VIP & Lookalike (`act_{adAccountId}`)
                  </h2>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '4px 0 0' }}>
                    Đẩy toàn bộ Lead FB chất lượng & Học viên đóng phí (VNĐ Value-Based) lên làm Seed & Exclusion chuẩn Playbook.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loadingGrowth || syncingAudiences}
                  onClick={handleSyncAudiences}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#0F172A',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: syncingAudiences ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Database size={14} />
                  {syncingAudiences ? 'Đang đồng bộ...' : 'Đồng bộ lên Meta'}
                </button>
              </div>

              {loadingGrowth && !audiencePreview ? (
                <Skeleton style={{ height: '160px', borderRadius: '12px' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem' }}>
                  {[
                    {
                      label: 'Seed Học viên VIP (Value-Based VNĐ)',
                      count: audiencePreview?.crm_pools?.vip_enrolled?.count ?? 0,
                      extra: formatVnd(audiencePreview?.crm_pools?.vip_enrolled?.total_value_vnd ?? 0),
                    },
                    {
                      label: 'Seed Lead Facebook Chất lượng (Needed+)',
                      count: audiencePreview?.crm_pools?.fb_quality?.count ?? 0,
                    },
                    {
                      label: 'Seed Toàn kênh Chất lượng (Needed+)',
                      count: audiencePreview?.crm_pools?.all_quality?.count ?? 0,
                    },
                    {
                      label: 'Exclusion: Lead Rác / Lost CRM',
                      count: audiencePreview?.crm_pools?.junk_lost?.count ?? 0,
                    },
                    {
                      label: 'Exclusion: Phone Farm / Tệp Rác',
                      count: audiencePreview?.crm_pools?.phone_farm?.count ?? phoneFarmStats?.total_blocked ?? 0,
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '10px',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#0F172A' }}>{item.label}</span>
                      <span style={{ fontWeight: 700, color: idx === 0 ? '#BD1D2D' : '#334155', fontVariantNumeric: 'tabular-nums' }}>
                        {item.count.toLocaleString('vi-VN')} {item.extra ? `• ${item.extra}` : ''}
                      </span>
                    </div>
                  ))}
                  {audiencePreview?.live_error && (
                    <div style={{ fontSize: '0.76rem', color: '#BD1D2D' }}>{audiencePreview.live_error}</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Card 2b: Phone Farm Blacklist Shield */}
          <div style={{ ...CARD_STYLE, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Khiên chặn Phone Farm & Click ảo phá quảng cáo (`act_{adAccountId}`)
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '4px 0 0' }}>
                  Chặn kép 2 lớp: (1) Loại trừ trực tiếp khỏi tất cả AdSet đang chạy trên Meta Ads và (2) Chặn bắn CAPI ở tầng Quality Gate để không làm nhiễm Pixel.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  ref={phoneFarmFileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt"
                  onChange={handleImportPhoneFarmFile}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  disabled={importingPhoneFarm || syncingPhoneFarm}
                  onClick={() => phoneFarmFileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: importingPhoneFarm ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Upload size={14} />
                  {importingPhoneFarm ? (phoneFarmProgress || 'Đang xử lý...') : 'Nạp Excel/CSV Phone Farm'}
                </button>
                <button
                  type="button"
                  disabled={importingPhoneFarm || syncingPhoneFarm || !(phoneFarmStats?.total_blocked)}
                  onClick={handleSyncPhoneFarmToMeta}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    border: 'none',
                    background: '#BD1D2D',
                    color: '#FFFFFF',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: syncingPhoneFarm || !(phoneFarmStats?.total_blocked) ? 'not-allowed' : 'pointer',
                    opacity: !(phoneFarmStats?.total_blocked) ? 0.6 : 1,
                  }}
                >
                  <ShieldCheck size={14} />
                  {syncingPhoneFarm ? 'Đang đẩy Meta...' : 'Đồng bộ & Chặn AdSet Active'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginTop: '16px' }}>
              <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                  SĐT Phone Farm đã chặn
                </div>
                <div style={{ fontSize: '1.45rem', fontWeight: 700, color: '#BD1D2D', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                  {(phoneFarmStats?.total_blocked ?? audiencePreview?.crm_pools?.phone_farm?.count ?? 0).toLocaleString('vi-VN')}
                </div>
              </div>
              <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                  Meta Exclusion Audience ID
                </div>
                <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0F172A', marginTop: '8px', fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
                  {phoneFarmStats?.meta_audience_id || audiencePreview?.crm_pools?.phone_farm?.meta_audience_id || 'Chưa đồng bộ'}
                </div>
                {(phoneFarmStats?.last_synced_at || audiencePreview?.crm_pools?.phone_farm?.last_synced_at) && (
                  <div style={{ fontSize: '0.71rem', color: '#64748B', marginTop: '4px', fontVariantNumeric: 'tabular-nums' }}>
                    Cập nhật: {phoneFarmStats?.last_synced_at || audiencePreview?.crm_pools?.phone_farm?.last_synced_at}
                  </div>
                )}
              </div>
              <div style={{ padding: '12px 16px', borderRadius: '10px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase' }}>
                  Nguồn Blacklist đã nạp
                </div>
                <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '8px', fontVariantNumeric: 'tabular-nums' }}>
                  {Array.isArray(phoneFarmStats?.by_source) && phoneFarmStats.by_source.length > 0
                    ? phoneFarmStats.by_source.slice(0, 3).map(s => `${s.source_label}: ${s.count.toLocaleString('vi-VN')}`).join(' • ')
                    : 'Chưa có tệp nào được nạp'}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Live AdSets Playbook 02B Readiness Table */}
          <div style={{ ...CARD_STYLE, padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Tối ưu Target 2 tầng (`AND`) & Loại trừ trên MBA 577 (`act_{adAccountId}`)
                </h2>
                <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '4px 0 0' }}>
                  Áp dụng công thức Master Playbook Ngành 02B (MBA / DBA / CEO 26-50, lọc clone tuổi đời thiết bị 19-25M+, loại trừ Lưu bài viết 365d, Rác/Học viên & Phone Farm).
                </p>
              </div>
              <button
                type="button"
                onClick={loadGrowthData}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid #E2E8F0',
                  background: '#FFFFFF',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={14} className={loadingGrowth ? 'spin' : ''} /> Làm mới
              </button>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 12px' }}>Chiến dịch / Nhóm QC (AdSet)</th>
                    <th style={{ padding: '10px 12px' }}>Trạng thái</th>
                    <th style={{ padding: '10px 12px' }}>Cấu trúc Playbook</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {(Array.isArray(adsets) ? adsets : []).map(as => (
                    <tr key={as.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ fontWeight: 700, color: '#0F172A' }}>{as.campaign_name || as.name}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748B', fontFamily: 'monospace' }}>
                          AdSet: {as.name} ({as.id}) • {as.optimization_goal}
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: 700, color: as.effective_status === 'ACTIVE' ? '#10b981' : '#64748B' }}>
                          {as.effective_status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#334155' }}>
                        <div>
                          Layers: <strong>{as.flexible_layers}</strong> • LAL: <strong>{as.custom_audiences_count}</strong> • Exclude: <strong>{as.excluded_audiences_count}</strong>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: as.playbook_compliant ? '#10b981' : '#BD1D2D', fontWeight: 700 }}>
                          {as.playbook_compliant ? 'Chuẩn 2-Layer Playbook' : 'Chưa bật 2-Layer đầy đủ'} •{' '}
                          <span style={{ color: as.phone_farm_excluded ? '#10b981' : '#BD1D2D' }}>
                            {as.phone_farm_excluded ? 'Đã chặn Phone Farm' : 'Chưa chặn Phone Farm'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {!as.phone_farm_excluded && (
                          <button
                            type="button"
                            disabled={shieldingAdsetId === as.id}
                            onClick={() => handleShieldAdSet(as.id)}
                            style={{
                              padding: '6px 10px',
                              borderRadius: '8px',
                              border: '1px solid #E2E8F0',
                              background: '#FFFFFF',
                              color: '#BD1D2D',
                              fontWeight: 700,
                              fontSize: '0.75rem',
                              cursor: shieldingAdsetId === as.id ? 'not-allowed' : 'pointer',
                              marginRight: '6px',
                            }}
                          >
                            {shieldingAdsetId === as.id ? 'Đang chặn...' : 'Chặn Phone Farm'}
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={optimizingId === as.id}
                          onClick={() => handleOptimizeAdSet(as.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '8px',
                            border: 'none',
                            background: as.playbook_compliant ? '#F1F5F9' : '#BD1D2D',
                            color: as.playbook_compliant ? '#0F172A' : '#FFFFFF',
                            fontWeight: 700,
                            fontSize: '0.76rem',
                            cursor: optimizingId === as.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          {optimizingId === as.id ? 'Đang tối ưu...' : 'Áp dụng Playbook 02B'}
                        </button>
                      </td>
                    </tr>
                  ))}
                  {(!adsets || adsets.length === 0) && (
                    <tr>
                      <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#64748B' }}>
                        Không có dữ liệu AdSet từ tài khoản `act_{adAccountId}`.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: LOGS TABLE */}
      {activeTab === 'logs' && (() => {
        const LOGS_PER_PAGE = 50;
        const safeLogs = Array.isArray(logs) ? logs : [];
        const q = logSearch.trim().toLowerCase();
        const filteredLogs = q
          ? safeLogs.filter((l) =>
              (l.contact_name || '').toLowerCase().includes(q) ||
              (l.contact_source || '').toLowerCase().includes(q) ||
              (l.event_name || '').toLowerCase().includes(q) ||
              (l.pixel_id || '').toLowerCase().includes(q) ||
              (l.trigger_stage || '').toLowerCase().includes(q)
            )
          : safeLogs;
        const totalLogCount = filteredLogs.length;
        const totalLogPages = Math.max(1, Math.ceil(totalLogCount / LOGS_PER_PAGE));
        const currentLogPage = Math.min(logPage, totalLogPages);
        const pagedLogs = filteredLogs.slice(
          (currentLogPage - 1) * LOGS_PER_PAGE,
          currentLogPage * LOGS_PER_PAGE
        );

        return (
        <div style={{ ...CARD_STYLE, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: '#FFFFFF' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Nhật ký sự kiện Meta CAPI (Realtime / Backfill / Test)
            </h2>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', pointerEvents: 'none' }} />
                <input
                  type="text"
                  value={logSearch}
                  onChange={(e) => {
                    setLogSearch(e.target.value);
                    setLogPage(1);
                  }}
                  placeholder="Tìm tên KH, nguồn, sự kiện..."
                  style={{
                    height: '32px',
                    padding: '0 12px 0 32px',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontSize: '0.78rem',
                    width: '220px',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'inline-flex', padding: '4px', borderRadius: '10px', background: '#F1F5F9', border: '1px solid #E2E8F0', gap: '2px' }}>
                {(['all', 'success', 'failed'] as const).map(st => {
                  const isActive = logStatusFilter === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        setLogStatusFilter(st);
                        setLogPage(1);
                        loadCoreData(st);
                      }}
                      style={{
                        height: '28px',
                        padding: '0 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isActive ? '#FFFFFF' : 'transparent',
                        color: isActive ? '#BD1D2D' : '#64748B',
                        fontSize: '0.76rem',
                        fontWeight: isActive ? 700 : 600,
                        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {st === 'all' ? 'Tất cả' : st === 'success' ? 'Thành công (2xx)' : 'Lỗi'}
                    </button>
                  );
                })}
              </div>
              <div style={{ height: '32px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '4px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: '0.78rem', color: '#64748B', fontWeight: 500 }}>
                Tổng cộng: <strong style={{ color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{totalLogCount}</strong> sự kiện
              </div>
            </div>
          </div>

          <div className="table-wrap custom-scrollbar" style={{ maxHeight: '460px', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F8FAFC' }}>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textAlign: 'left', color: '#64748B' }}>
                  <th style={{ padding: '12px 16px', background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap' }}>Khách hàng / Nguồn</th>
                  <th style={{ padding: '12px 16px', background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap' }}>Sự kiện & Giá trị</th>
                  <th style={{ padding: '12px 16px', background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap' }}>Pixel & Action</th>
                  <th style={{ padding: '12px 16px', background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap' }}>EMQ</th>
                  <th style={{ padding: '12px 16px', background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap' }}>HTTP</th>
                  <th style={{ padding: '12px 16px', background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 2, whiteSpace: 'nowrap' }}>Thời gian</th>
                  <th style={{ padding: '12px 16px', background: '#F8FAFC', position: 'sticky', top: 0, zIndex: 2, textAlign: 'right', whiteSpace: 'nowrap' }}>Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {pagedLogs.map(log => {
                  const ok = log.response_status >= 200 && log.response_status < 300;
                  return (
                    <tr
                      key={log.id}
                      style={{ borderBottom: '1px solid #F1F5F9', transition: 'background-color 0.15s ease' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fff9fa'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar name={log.contact_name || 'Khách hàng'} size={34} style={{ flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '0.84rem', lineHeight: 1.3 }}>
                              {log.contact_name || 'N/A'}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                              {log.contact_source || 'N/A'} {log.trigger_stage ? `• ${log.trigger_stage}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 700, color: log.event_name === 'Purchase' ? '#BD1D2D' : '#0F172A' }}>
                          {log.event_name}
                        </div>
                        {log.event_value && Number(log.event_value) > 0 ? (
                          <div style={{ fontSize: '0.74rem', color: '#10b981', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                            {formatVnd(Number(log.event_value))}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.74rem', color: '#334155', whiteSpace: 'nowrap' }}>
                        <div style={{ fontFamily: 'monospace', fontWeight: 600 }}>{log.pixel_id || pixelId}</div>
                        <div style={{ color: '#64748B' }}>{log.action_source || 'system_generated'}</div>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>{log.emq_signals || 0}</span>{' '}
                        <span style={{ fontSize: '0.73rem', color: '#64748B' }}>tín hiệu</span>
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '999px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            fontVariantNumeric: 'tabular-nums',
                            background: ok ? 'rgba(16, 185, 129, 0.12)' : 'rgba(189, 29, 45, 0.1)',
                            color: ok ? '#047857' : '#BD1D2D',
                          }}
                        >
                          HTTP {log.response_status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#475569', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontSize: '0.76rem' }}>
                        {log.sent_at}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setViewPayload(log)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 10px',
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0',
                            background: '#FFFFFF',
                            color: '#334155',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            marginRight: !ok ? '6px' : 0,
                          }}
                        >
                          <Code size={13} />
                          <span>JSON</span>
                        </button>
                        {!ok && (
                          <button
                            type="button"
                            disabled={Boolean(retryingIds[log.id])}
                            onClick={() => handleRetryLog(log.id)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '8px',
                              border: 'none',
                              background: '#BD1D2D',
                              color: '#FFFFFF',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {retryingIds[log.id] ? 'Đang gửi...' : 'Retry'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {pagedLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#64748B' }}>
                      {safeLogs.length > 0
                        ? 'Không tìm thấy sự kiện CAPI nào khớp với từ khóa tìm kiếm.'
                        : 'Chưa có sự kiện CAPI nào được ghi nhận. Hãy cấu hình và bấm Test Pixel hoặc chạy Backfill 7 ngày.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {totalLogCount > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', flexShrink: 0, flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '0.8125rem', color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
                Hiển thị <span style={{ fontWeight: 700, color: '#0F172A' }}>{(currentLogPage - 1) * LOGS_PER_PAGE + 1}</span> - <span style={{ fontWeight: 700, color: '#0F172A' }}>{Math.min(currentLogPage * LOGS_PER_PAGE, totalLogCount)}</span> trên <span style={{ fontWeight: 700, color: '#0F172A' }}>{totalLogCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setLogPage(Math.max(currentLogPage - 1, 1))}
                  disabled={currentLogPage === 1}
                  style={{ padding: '6px', borderRadius: 6, border: '1px solid #E2E8F0', background: currentLogPage === 1 ? '#F8FAFC' : '#FFFFFF', color: currentLogPage === 1 ? '#94A3B8' : '#0F172A', cursor: currentLogPage === 1 ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronLeft size={16} />
                </button>
                <div style={{ display: 'flex', gap: 4 }}>
                  {Array.from({ length: Math.min(5, totalLogPages) }, (_, i) => {
                    let startPage = 1;
                    if (totalLogPages > 5 && currentLogPage > 3) {
                      startPage = Math.min(currentLogPage - 2, totalLogPages - 4);
                    }
                    const pageNum = startPage + i;
                    const isCurrent = currentLogPage === pageNum;
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => setLogPage(pageNum)}
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          fontSize: '0.8125rem',
                          fontWeight: 600,
                          border: isCurrent ? 'none' : '1px solid #E2E8F0',
                          background: isCurrent ? '#BD1D2D' : '#FFFFFF',
                          color: isCurrent ? '#FFFFFF' : '#0F172A',
                          cursor: 'pointer',
                        }}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setLogPage(Math.min(currentLogPage + 1, totalLogPages))}
                  disabled={currentLogPage === totalLogPages}
                  style={{ padding: '6px', borderRadius: 6, border: '1px solid #E2E8F0', background: currentLogPage === totalLogPages ? '#F8FAFC' : '#FFFFFF', color: currentLogPage === totalLogPages ? '#94A3B8' : '#0F172A', cursor: currentLogPage === totalLogPages ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      {/* Modal View JSON Payload */}
      <CustomModal
        isOpen={Boolean(viewPayload)}
        onClose={() => setViewPayload(null)}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Code size={16} /> Payload CAPI #{viewPayload?.id} ({viewPayload?.event_name})
          </span>
        }
        width="740px"
      >
        {viewPayload && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Sent Payload (Đã băm PII SHA-256)
              </div>
              <pre style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', fontSize: '0.74rem', overflowX: 'auto', maxHeight: '260px' }}>
                {(() => {
                  try {
                    return JSON.stringify(JSON.parse(viewPayload.sent_payload), null, 2);
                  } catch {
                    return viewPayload.sent_payload;
                  }
                })()}
              </pre>
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
                Meta Graph API Response (HTTP {viewPayload.response_status})
              </div>
              <pre style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px', fontSize: '0.74rem', overflowX: 'auto', maxHeight: '180px' }}>
                {viewPayload.response_body}
              </pre>
            </div>
          </div>
        )}
      </CustomModal>

      {/* Quality CAPI Documentation Modal */}
      <CustomModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="Kiến trúc Meta CAPI chất lượng cao — Viện IDEAS (MBA 577)"
        width="720px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.84rem', color: '#334155', lineHeight: 1.6 }}>
          <div>
            <strong>1. Ngưỡng lọc chất lượng `04 - Needed`+:</strong> Tuyệt đối không bắn `Lead` hay `CompleteRegistration` cho các lead mới nhập thô (`01 - New Lead` → `03 - Connected`) hay lead rác/sai số, tránh thuật toán Meta tìm thêm clone.
          </div>
          <div>
            <strong>2. Dual-Pixel Routing:</strong> Lead Form Meta Ads (`meta_lead_id`) & Lead đa kênh chất lượng (`all_quality`) bắn qua CRM Pixel <code>{pixelId}</code> (<code>system_generated</code>); Web Landing Page có `_fbc`/`_fbp` bắn qua Web Pixel <code>{webPixelId}</code>.
          </div>
          <div>
            <strong>3. Value-Based Lookalike & 7-Day Compliance:</strong> Sự kiện CAPI hỗ trợ backfill tối đa 7 ngày; toàn bộ dữ liệu Học viên đã nhập học/đặt cọc từ trước đến nay (VNĐ) được đồng bộ làm <strong>VIP Value-Based Lookalike 1% & 1%-3%</strong> cùng các tệp loại trừ Lead Rác, Học viên cũ và Người lưu bài viết Page 365 ngày.
          </div>
        </div>
      </CustomModal>
    </div>
  );
}
