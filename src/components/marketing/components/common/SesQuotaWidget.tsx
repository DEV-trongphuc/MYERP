import React, { useEffect, useState, useCallback } from 'react';
import { api } from '../../services/storageAdapter';
import toast from 'react-hot-toast';
import {
    Mail, TrendingDown, AlertTriangle, CheckCircle2, RefreshCw,
    Zap, Shield, Info, ExternalLink, Key, KeyRound, X, Save, CalendarDays
} from 'lucide-react';
import Button from './Button';

interface SesLocalStats {
    sent_24h: number;
    failed_24h: number;
    sent_30d: number;
    bounce_rate: number;
    complaint_rate: number;
    bounce_status: 'good' | 'warning' | 'critical';
    complaint_status: 'good' | 'warning' | 'critical';
}
interface SesAwsQuota {
    max_24h: number;
    sent_24h: number;
    remaining: number;
    max_rate: number;
    usage_pct: number;
    is_fallback?: boolean;
}
interface SesData {
    is_ses: boolean;
    region: string;
    smtp_host: string;
    overall_status: 'good' | 'warning' | 'critical';
    local: SesLocalStats;
    aws: SesAwsQuota | null;
    aws_error: string | null;
    cache_age_min: number | null;
    has_iam_credentials: boolean;
    credential_hint: { issue: string; setup_sql: string } | null;
}

const STATUS_COLOR: Record<string, string> = {
    good: 'text-emerald-500',
    warning: 'text-amber-500',
    critical: 'text-red-500',
};
const STATUS_BG: Record<string, string> = {
    good: 'bg-white dark:bg-slate-800/50 border-slate-100 dark:border-slate-700/50',
    warning: 'bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40',
    critical: 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40',
};
const STATUS_DOT: Record<string, string> = {
    good: 'bg-emerald-500',
    warning: 'bg-amber-400',
    critical: 'bg-red-500',
};
const STATUS_LABEL: Record<string, string> = {
    good: 'Tốt',
    warning: 'Cảnh báo',
    critical: 'Nguy hiểm',
};

interface Props {
    /** 'sidebar' for right-side panel, 'inline' for compact strip inside page */
    mode?: 'sidebar' | 'inline';
    className?: string;
    /** Pass campaign date filter to compute period-accurate quota stats */
    startDate?: string;
    endDate?: string;
    /** Short label shown instead of '30d', e.g. '7d', '30d', 'Tháng' */
    periodLabel?: string;
}

const SesQuotaWidget: React.FC<Props> = ({ mode = 'sidebar', className = '', startDate, endDate, periodLabel }) => {
    const [data, setData] = useState<SesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [showHint, setShowHint] = useState(false);
    const [showIamModal, setShowIamModal] = useState(false);
    const [iamKeys, setIamKeys] = useState({ access: '', secret: '' });
    const [isSavingIam, setIsSavingIam] = useState(false);

    const load = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const params = new URLSearchParams();
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);
            const qs = params.toString() ? `?${params.toString()}` : '';
            const res = await api.get<SesData>(`ses_quota${qs}`);
            if (res.success) setData(res.data);
        } catch (e) {
            console.error('[SesQuotaWidget] Failed to load SES quota:', e);
        }
        setLoading(false);
        setRefreshing(false);
    }, [startDate, endDate]);

    useEffect(() => {
        load();
        // Refresh every 5 minutes
        const t = setInterval(() => load(), 5 * 60 * 1000);
        return () => clearInterval(t);
    }, [load]);

    if (loading) {
        return (
            <div className={`animate-pulse rounded-2xl border border-slate-100 dark:border-slate-800/60 p-4 ${className}`}>
                <div className="h-4 w-24 bg-slate-100 dark:bg-slate-800 rounded mb-3" />
                <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-3 bg-slate-100 dark:bg-slate-800 rounded" />)}
                </div>
            </div>
        );
    }

    const handleSaveIam = async () => {
        setIsSavingIam(true);
        try {
            const res = await api.post('settings', {
                aws_access_key: iamKeys.access,
                aws_secret_key: iamKeys.secret
            });
            if (res.success) {
                toast.success('Đã cập nhật khóa IAM thành công!');
                setShowIamModal(false);
                load(true);
            } else {
                toast.error((res as any).message || 'Không thể lưu khóa IAM.');
            }
        } catch (e) {
            console.error('[SesQuotaWidget] Failed to save IAM keys:', e);
            toast.error('Lỗi kết nối khi lưu khóa.');
        }
        setIsSavingIam(false);
    };

    if (!data) return null;

    const status = data.overall_status;

    // Use period stats from API (respects date filter)
    const sentPeriod = (data.local as any).sent_period ?? data.local.sent_30d;
    const periodDays = (data.local as any).period_days ?? 30;
    const displayLabel = periodLabel ?? `${periodDays}d`;

    // SES Cost: $0.10 per 1000 emails — computed from period
    const estimatedCost = (sentPeriod / 1000) * 0.1;
    const costFormatted = sentPeriod > 0 && estimatedCost < 0.01 ? '<$0.01' : `$${estimatedCost.toFixed(2)}`;

    // ── Inline mode (for Campaigns page — compact horizontal strip) ───────────
    if (mode === 'inline') {
        return (
            <div className={`flex flex-wrap items-center gap-4 px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] text-xs font-bold ${className}`}>
                {/* Status dot */}
                <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${status !== 'good' ? 'animate-pulse' : ''} ${STATUS_DOT[status]}`} />
                    <span className={`uppercase tracking-widest text-[10px] ${STATUS_COLOR[status]}`}>
                        SES {data.region} — {STATUS_LABEL[status]}
                    </span>
                </div>

                <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />

                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-1.5 py-[3px] rounded leading-none">
                            {(data.aws && !data.aws.is_fallback ? data.aws.sent_24h : data.local.sent_24h).toLocaleString()}
                        </span>
                        /24h
                    </span>
                </div>

                <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />

                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                    <span className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 px-1.5 py-[3px] rounded leading-none">
                            {sentPeriod.toLocaleString()}
                        </span>
                        /{displayLabel}
                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-[3px] rounded leading-none ml-1">
                            {costFormatted}
                        </span>
                    </span>
                </div>

                <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />

                <div className={`flex items-center gap-1.5 ${STATUS_COLOR[data.local.bounce_status]}`}>
                    <TrendingDown className="w-3.5 h-3.5" />
                    <span>Bounce {data.local.bounce_rate}%</span>
                </div>

                {data.aws && (
                    <>
                        <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />
                        <div className="flex items-center gap-3">
                            <Zap className={`w-3.5 h-3.5 ${data.aws.usage_pct > 80 ? 'text-red-500' : 'text-slate-400'}`} />
                            <div className="flex flex-col gap-1.5 w-44">
                                <div className="flex justify-between items-center text-[10px] uppercase tracking-widest text-slate-500 leading-none">
                                    <div className="flex items-center gap-1.5">
                                        <span>{data.aws.is_fallback ? 'Nội bộ' : '24h Quota AWS'}</span>
                                        {data.aws.max_rate > 0 && <span className="text-[8px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded leading-none lowercase tracking-normal">{data.aws.max_rate}/s</span>}
                                    </div>
                                    <span className={data.aws.usage_pct > 80 ? 'text-red-500 font-black' : 'font-black'}>{data.aws.usage_pct}%</span>
                                </div>
                                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${data.aws.usage_pct > 80 ? 'bg-red-500' : data.aws.usage_pct > 60 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                        style={{ width: `${Math.min(data.aws.usage_pct, 100)}%` }}
                                    />
                                </div>
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                ({data.aws.remaining.toLocaleString()} left)
                            </span>
                        </div>
                        {(data.aws.is_fallback || data.aws_error) && (
                            <button
                                onClick={() => setShowIamModal(true)}
                                className="ml-2 flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] hover:bg-amber-100 transition-colors uppercase border border-amber-200 border-dashed"
                            >
                                <Info className="w-3 h-3" /> Sửa lỗi khóa (API)
                            </button>
                        )}
                    </>
                )}

                <button
                    onClick={() => load(true)}
                    className="ml-auto text-slate-400 hover:text-slate-600 transition-colors"
                    title="Refresh"
                >
                    <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                </button>

                {/* IAM Setup Modal */}
                {showIamModal && (
                    <div className="fixed inset-0 bg-slate-950/70 z-[9999] flex items-center justify-center p-4">
                        <div className="bg-white dark:bg-slate-900 rounded-[28px] w-full max-w-2xl shadow-2xl overflow-hidden text-left border border-slate-100 dark:border-slate-800 config-modal-entrance">
                            <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
                                <div className="flex items-center gap-4">
                                    <div className="p-2.5 bg-amber-100 text-amber-600 rounded-2xl shadow-sm">
                                        <Key className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 tracking-tight">Kết nối Khóa API (AWS IAM)</h3>
                                        <p className="text-[11px] text-slate-500 font-medium">Lấy số liệu Thời gian thực và tự động mở khóa báo cáo.</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowIamModal(false)} className="text-slate-400 hover:text-slate-600 p-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all"><X className="w-5 h-5" /></button>
                            </div>
                            <div className="p-6 md:p-8 space-y-8">

                                {/* Step-by-Step Guide */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                        Cách lấy khóa (Chỉ 3 bước)
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 rounded-[20px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 relative group">
                                            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center text-sm font-black ring-4 ring-white dark:ring-slate-900 shadow-md">1</div>
                                            <p className="text-[10px] text-slate-400 font-bold mb-1.5 ml-1 mt-1 uppercase tracking-wider">Mở khóa AWS</p>
                                            <a href="https://us-east-1.console.aws.amazon.com/iam/home?#/security_credentials" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 group-hover:underline">
                                                Mở Web IAM <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                            </a>
                                        </div>
                                        <div className="p-4 rounded-[20px] bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 relative">
                                            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center text-sm font-black ring-4 ring-white dark:ring-slate-900 shadow-md">2</div>
                                            <p className="text-[10px] text-slate-400 font-bold mb-1.5 ml-1 mt-1 uppercase tracking-wider">Tạo Khóa mới</p>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">Bấm nút <b className="text-amber-600">Create access key</b>, tích "I understand..."</p>
                                        </div>
                                        <div className="p-4 rounded-[20px] bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/50 relative">
                                            <div className="absolute -top-3 -left-3 w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm font-black ring-4 ring-white dark:ring-slate-900 shadow-md shadow-amber-500/30">3</div>
                                            <p className="text-[10px] text-amber-600 font-bold mb-1.5 ml-1 mt-1 uppercase tracking-wider">Lưu Mật khẩu</p>
                                            <p className="text-xs text-amber-800 dark:text-amber-500 font-bold leading-relaxed">Copy 2 dòng KEY gán xuống khung bên dưới.</p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-slate-400 italic font-medium px-1">*Lưu ý: IAM Secret Key là chuỗi ~40 ký tự. Không phải Mật khẩu SMTP gửi mail bắt đầu bằng B hoặc S.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest mb-2 ml-1">Access Key ID</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <Key className="w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                                            </div>
                                            <input
                                                className="w-full pl-10 pr-4 py-3.5 border-2 border-slate-200 rounded-2xl text-sm font-medium focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 focus:outline-none dark:bg-slate-800 dark:border-slate-700 transition-all placeholder:text-slate-300"
                                                placeholder="AKIA..."
                                                value={iamKeys.access}
                                                onChange={e => setIamKeys(prev => ({ ...prev, access: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest mb-2 ml-1">Secret Access Key</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                                <KeyRound className="w-4 h-4 text-slate-400 group-focus-within:text-amber-500 transition-colors" />
                                            </div>
                                            <input
                                                className="w-full pl-10 pr-4 py-3.5 border-2 border-slate-200 rounded-2xl text-sm font-medium focus:border-amber-400 focus:ring-4 focus:ring-amber-400/10 focus:outline-none dark:bg-slate-800 dark:border-slate-700 transition-all placeholder:text-slate-300"
                                                placeholder="Khoảng 40 ký tự..."
                                                type="password"
                                                value={iamKeys.secret}
                                                onChange={e => setIamKeys(prev => ({ ...prev, secret: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="px-6 md:px-8 py-5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 rounded-b-[28px]">
                                <button className="px-6 py-2.5 text-xs font-black text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors tracking-wide" onClick={() => setShowIamModal(false)}>HỦY</button>
                                <Button className="px-8 py-2.5 text-xs h-11 bg-gradient-to-r from-[#2563eb] to-blue-600 hover:from-[#561dd0] hover:to-blue-700 shadow-lg shadow-[#2563eb]/20 text-white rounded-xl font-black tracking-widest border-none" isLoading={isSavingIam} onClick={handleSaveIam} icon={Save}>CẬP NHẬT KẾT NỐI</Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Sidebar mode (for Dashboard — vertical card on right side) ────────────
    return (
        <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-sm overflow-hidden ${className}`}>

            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/30">
                <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]} ${status !== 'good' ? 'animate-pulse' : ''}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                        Email Health
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {data.cache_age_min !== null && (
                        <span className="text-[9px] text-slate-400">{data.cache_age_min === 0 ? 'vừa cập nhật' : `${data.cache_age_min}p trước`}</span>
                    )}
                    <button
                        onClick={() => load(true)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <div className="p-4 space-y-3">

                {/* Overall status badge */}
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${STATUS_BG[status]}`}>
                    {status === 'good'
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                    <div>
                        <p className={`text-[10px] font-black uppercase tracking-wider ${STATUS_COLOR[status]}`}>
                            {STATUS_LABEL[status]}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium">
                            {data.is_ses ? `Amazon SES · ${data.region}` : data.smtp_host}
                        </p>
                    </div>
                </div>

                {/* Sending 24h */}
                <div className="space-y-1.5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Gửi 24 giờ qua</p>
                    <div className="flex items-end justify-between">
                        <span className="text-2xl font-black text-slate-800 dark:text-slate-200 tracking-tight">
                            {(data.aws && !data.aws.is_fallback ? data.aws.sent_24h : data.local.sent_24h).toLocaleString()}
                        </span>
                        <span className={`text-[10px] font-bold ${data.local.failed_24h > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                            {data.local.failed_24h > 0 ? `${data.local.failed_24h} fail` : '✓ Không lỗi'}
                        </span>
                    </div>
                </div>

                {/* Sending 30d (Local Cost) */}
                <div className="space-y-1.5 border-t border-dashed border-slate-100 dark:border-slate-800 pt-4 mt-2">
                    <div className="flex justify-between items-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Gửi 30 ngày qua</p>
                        <span className="text-[9px] font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-1.5 py-[3px] rounded leading-none">
                            Phí: {costFormatted}
                        </span>
                    </div>
                    <div className="flex items-end justify-between">
                        <span className="text-xl font-black text-slate-800 dark:text-slate-200 tracking-tight">
                            {data.local.sent_30d.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* AWS Quota bar */}
                {data.aws ? (
                    <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                                <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                                    {data.aws.is_fallback ? 'QUOTA HỆ THỐNG' : 'QUOTA AWS'}
                                </p>
                                {data.aws.max_rate > 0 && <span className="text-[8px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-[3px] rounded leading-none lowercase tracking-normal">{data.aws.max_rate}/s</span>}
                            </div>
                            <span className={`text-[10px] font-bold ${data.aws.usage_pct > 80 ? 'text-red-500' : data.aws.usage_pct > 60 ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                {data.aws.usage_pct}%
                            </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-700 ${data.aws.usage_pct > 80 ? 'bg-red-500' : data.aws.usage_pct > 60 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                style={{ width: `${Math.min(data.aws.usage_pct, 100)}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 font-medium">
                            <span>{data.aws.sent_24h.toLocaleString()} đã dùng</span>
                            <span>{data.aws.remaining.toLocaleString()} còn lại</span>
                        </div>
                        <p className="text-[9px] text-slate-400">
                            Max rate: <span className="font-bold text-slate-600 dark:text-slate-400">{data.aws.max_rate} email/giây</span>
                        </p>
                    </div>
                ) : (
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Gửi 30 ngày qua</p>
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{data.local.sent_30d.toLocaleString()} emails</p>
                    </div>
                )}

                {/* Bounce + Complaint */}
                <div className="grid grid-cols-2 gap-2">
                    <div className={`p-2.5 rounded-xl border ${STATUS_BG[data.local.bounce_status]}`}>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Bounce</p>
                        <p className={`text-sm font-black ${STATUS_COLOR[data.local.bounce_status]}`}>
                            {data.local.bounce_rate}%
                        </p>
                        <p className="text-[8px] text-slate-400">AWS limit: &lt;2%</p>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${STATUS_BG[data.local.complaint_status]}`}>
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Complaint</p>
                        <p className={`text-sm font-black ${STATUS_COLOR[data.local.complaint_status]}`}>
                            {data.local.complaint_rate}%
                        </p>
                        <p className="text-[8px] text-slate-400">AWS limit: &lt;0.1%</p>
                    </div>
                </div>

                {/* AWS setup hint */}
                {data.credential_hint && (
                    <div>
                        <button
                            onClick={() => setShowHint(v => !v)}
                            className="w-full flex items-center gap-1.5 text-[9px] text-amber-600 font-bold hover:text-amber-700 transition-colors"
                        >
                            <Info className="w-3 h-3" />
                            Cấu hình IAM để xem quota AWS real-time
                            <span className="ml-auto">{showHint ? '▲' : '▼'}</span>
                        </button>
                        {showHint && (
                            <div className="mt-2 p-2.5 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-100 dark:border-amber-900/30 text-[9px] text-amber-700 dark:text-amber-400 space-y-1.5">
                                <p className="font-bold">{data.credential_hint.issue}</p>
                                <p>Thêm vào system_settings:</p>
                                <code className="block bg-amber-100 dark:bg-amber-900/30 rounded p-1.5 font-mono text-[8px] break-all leading-relaxed">
                                    aws_access_key = AKIA...<br />
                                    aws_secret_key = [40-char IAM secret]
                                </code>
                                <p className="text-[8px] text-amber-600/80">
                                    ⚠ IAM Secret Key ≠ SES SMTP Password. Generate tại: AWS Console → IAM → Users → Security Credentials
                                </p>
                                <a
                                    href="/settings"
                                    className="inline-flex items-center gap-1 text-amber-600 hover:underline font-bold"
                                >
                                    Mở Settings <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                            </div>
                        )}
                    </div>
                )}

                {/* No SES detected */}
                {!data.is_ses && (
                    <p className="text-[9px] text-slate-400 text-center py-1">
                        <Shield className="w-3 h-3 inline mr-1 opacity-50" />
                        Không dùng Amazon SES
                    </p>
                )}

            </div>
        </div>
    );
};

export default SesQuotaWidget;
