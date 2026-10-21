import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Survey, QuestionAnalytics } from '../../types/survey';
import {
    X, Users, CheckCircle, Clock, Smartphone, Globe, BarChart2,
    Mail, QrCode, Zap, Link2, Star,
    ChevronRight, ChevronDown, RefreshCw, User, Copy, Check,
    Search, MapPin, Phone, ExternalLink
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
    BarChart, Bar as RechartsBar, Cell, PieChart, Pie, Legend
} from 'recharts';
import { api } from '../../services/storageAdapter';
import { getMktPortalRoot } from '../../utils/portalRoot';
import { Avatar } from '../../../../components/ui/Avatar';
import { pushOverlay } from '../../../../utils/overlayStack';

interface Props {
    survey: Survey | null;
    isOpen: boolean;
    onClose: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatTime = (secs: number) => {
    if (!secs || secs <= 0) return '—';
    if (secs < 60) return `${Math.round(secs)}s`;
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}m ${s}s`;
};

const pct = (n: number, total: number) => total > 0 ? Math.round(n / total * 100) : 0;

const formatChoiceLabel = (raw: string, options?: any[]): string => {
    if (!raw) return '';
    let s = String(raw);

    // If options available from survey block, find matching option first
    if (options && Array.isArray(options)) {
        for (const opt of options) {
            const optVal = typeof opt === 'string' ? opt : (opt.value || '');
            const optLbl = typeof opt === 'string' ? opt : (opt.label || optVal);
            if (optVal === s || optLbl === s || String(optVal).toLowerCase() === s.toLowerCase()) {
                return optLbl;
            }
            if (String(optVal).replace(/_/g, ' ').toLowerCase() === s.replace(/_/g, ' ').toLowerCase()) {
                return optLbl;
            }
        }
    }

    // 1. Decode unicode escape sequences like \u00ed or \\u00ed
    if (s.includes('\\u')) {
        try {
            s = s.replace(/\\u([0-9a-fA-F]{4})/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
        } catch {}
    }

    // 2. Decode HTML entities (&amp;, &quot;, &#39;, &lt;, &gt;)
    if (s.includes('&')) {
        try {
            const txt = document.createElement('textarea');
            txt.innerHTML = s;
            s = txt.value;
        } catch {}
    }

    // 3. Yes / No standard mapping
    const lower = s.trim().toLowerCase();
    if (lower === 'yes' || lower === 'true') return 'Có';
    if (lower === 'no' || lower === 'false') return 'Không';

    // 4. If slug with underscores (e.g. bút_phá_quy_mô...), replace underscores with spaces and capitalize
    if (s.includes('_') && !s.includes(' ')) {
        s = s.replace(/_/g, ' ');
        s = s.charAt(0).toUpperCase() + s.slice(1);
    }

    return s;
};

// ─── Pill-style progress bar ──────────────────────────────────────────────────
const Bar: React.FC<{ value: number; color?: string; height?: string }> = ({
    value, color = 'var(--color-primary)', height = 'h-2'
}) => (
    <div className={`${height} bg-slate-100 rounded-full overflow-hidden`}>
        <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, value)}%`, background: color }}
        />
    </div>
);

// ─── NPS Gauge ────────────────────────────────────────────────────────────────
const NpsGauge: React.FC<{ score: number; promoters: number; passives: number; detractors: number }> = ({
    score, promoters, passives, detractors
}) => {
    const total = promoters + passives + detractors;
    const pP = pct(promoters, total);
    const pPa = pct(passives, total);
    const pD = pct(detractors, total);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">NPS Score</p>
                    <p className={`text-4xl font-black leading-none mt-1 ${score >= 50 ? 'text-emerald-500' : score >= 0 ? 'text-amber-500' : 'text-red-500'}`}>
                        {score > 0 ? '+' : ''}{score}
                    </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                        { label: 'Promoters', val: promoters, pct: pP, color: '#10b981', bg: '#ecfdf5' },
                        { label: 'Passives', val: passives, pct: pPa, color: '#f59e0b', bg: '#fffbeb' },
                        { label: 'Detractors', val: detractors, pct: pD, color: '#ef4444', bg: '#fef2f2' },
                    ].map(s => (
                        <div key={s.label} className="rounded-xl px-3 py-2" style={{ background: s.bg }}>
                            <p className="text-base font-black" style={{ color: s.color }}>{s.val}</p>
                            <p className="text-[9px] font-bold uppercase text-slate-400">{s.label}</p>
                        </div>
                    ))}
                </div>
            </div>
            {/* Segmented bar */}
            <div className="flex h-3 rounded-full overflow-hidden">
                <div className="bg-red-400 transition-all" style={{ width: `${pD}%` }} />
                <div className="bg-amber-400 transition-all" style={{ width: `${pPa}%` }} />
                <div className="bg-emerald-400 transition-all" style={{ width: `${pP}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400">
                <span className="text-red-400 font-bold">Detractors {pD}%</span>
                <span className="text-amber-400 font-bold">Passives {pPa}%</span>
                <span className="text-emerald-400 font-bold">Promoters {pP}%</span>
            </div>
        </div>
    );
};

// ─── Star rating widget ───────────────────────────────────────────────────────
const StarRating: React.FC<{ avg: number; dist?: Array<{ value: number; count: number }>; total: number }> = ({
    avg, dist, total
}) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-slate-800">{Number(avg).toFixed(1)}</span>
                <div>
                    <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className="w-4 h-4" fill={i < Math.round(avg) ? '#f59e0b' : 'none'} stroke={i < Math.round(avg) ? '#f59e0b' : '#cbd5e1'} />
                        ))}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{total} phản hồi</p>
                </div>
            </div>
            {dist && (
                <div className="space-y-1">
                    {[5, 4, 3, 2, 1].map(star => {
                        const entry = dist.find(d => d.value === star);
                        const cnt = entry?.count ?? 0;
                        return (
                            <div key={star} className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-400 w-4">{star}</span>
                                <Star className="w-3 h-3 text-amber-400 flex-shrink-0" fill="#f59e0b" stroke="#f59e0b" />
                                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct(cnt, Math.max(...dist.map(d => d.count), 1))}%`, minWidth: cnt > 0 ? '4px' : 0 }} />
                                </div>
                                <span className="text-[10px] font-bold text-slate-500 w-6 text-right">{cnt}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// ─── Choice bar chart ─────────────────────────────────────────────────────────
const ChoiceChart: React.FC<{ dist: Array<{ label: string; count: number; percentage: number }>; options?: any[] }> = ({ dist, options }) => {
    const COLORS = ['#BD1D2D', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f97316'];

    return (
        <div className="space-y-2.5">
            {dist.map((c, i) => {
                const labelFormatted = formatChoiceLabel(c.label, options);
                return (
                    <div key={c.label}>
                        <div className="flex justify-between text-xs mb-1">
                            <span className="text-slate-600 font-medium truncate max-w-[70%]" title={labelFormatted}>{labelFormatted}</span>
                            <span className="font-black text-slate-700 shrink-0 ml-2">{c.count} <span className="font-normal text-slate-400">({c.percentage}%)</span></span>
                        </div>
                        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${c.percentage}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// ─── Per-question card ────────────────────────────────────────────────────────
const QuestionCard: React.FC<{ q: QuestionAnalytics; idx: number; survey?: Survey | null }> = ({ q, idx, survey }) => {
    const typeIcons: Record<string, React.ReactNode> = {
        nps:           <div className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">NPS</div>,
        star_rating:   <Star className="w-3.5 h-3.5 text-amber-500" fill="#f59e0b" stroke="#f59e0b" />,
        single_choice: <div className="w-2 h-2 rounded-full border-2 border-slate-400" />,
        multi_choice:  <div className="w-2.5 h-2.5 rounded border-2 border-slate-400" />,
        likert:        <BarChart2 className="w-3.5 h-3.5 text-blue-500" />,
        slider:        <div className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">Range</div>,
        emoji_rating:  <span className="text-sm">😊</span>,
        short_text:    <div className="text-[9px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">Text</div>,
        long_text:     <div className="text-[9px] font-black text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">Text</div>,
        matrix_single: <div className="text-[9px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full">Matrix</div>,
    };

    const block = survey?.blocks?.find(b => b.id === q.question_id || (b as any).id === (q as any).id);
    const resolvedTitle = (q.label && q.label !== 'Untitled Question' && q.label.trim() !== '')
        ? q.label
        : (block?.label || (block as any)?.content || (block as any)?.title || (block as any)?.question || `Câu hỏi #${idx + 1}`);

    const displayTitle = formatChoiceLabel(resolvedTitle);
    const skipPct = Math.round((q.skip_rate ?? 0) * 100);

    return (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-start gap-3">
                <div className="w-7 h-7 rounded-xl bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[10px] font-black text-[var(--color-primary)]">#{idx + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 leading-snug">{displayTitle}</p>
                    <div className="flex items-center gap-2 mt-1">
                        {typeIcons[q.type] ?? <div className="text-[9px] text-slate-500">{q.type}</div>}
                        <span className="text-[10px] font-medium text-slate-600">{q.total_answered} phản hồi</span>
                        {skipPct > 0 && <span className="text-[10px] font-medium text-red-500">{skipPct}% bỏ qua</span>}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-5 py-4">
                {q.nps_score !== undefined && (
                    <NpsGauge
                        score={q.nps_score}
                        promoters={q.promoters ?? 0}
                        passives={q.passives ?? 0}
                        detractors={q.detractors ?? 0}
                    />
                )}
                {q.avg_rating !== undefined && q.nps_score === undefined && (
                    <StarRating avg={q.avg_rating} dist={q.rating_distribution} total={q.total_answered} />
                )}
                {q.choice_distribution && q.choice_distribution.length > 0 && (
                    <ChoiceChart dist={q.choice_distribution} options={block?.options} />
                )}
                {q.text_responses && q.text_responses.length > 0 && (
                    <div className="space-y-2">
                        {q.text_responses.slice(0, 5).map((t, i) => (
                            <div key={i} className="flex gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                                    <User className="w-3 h-3 text-slate-600" />
                                </div>
                                <p className="text-xs text-slate-700 italic leading-snug">
                                    {(() => {
                                        if ((q.type === 'matrix_single' || q.type === 'matrix_multi') && q.content) {
                                            try {
                                                const content = typeof q.content === 'string' ? JSON.parse(q.content) : q.content;
                                                const answer = JSON.parse(t);
                                                const rowMap = new Map(content.rows?.map((r: any) => [r.id, r.text]));
                                                const colMap = new Map(content.columns?.map((c: any) => [c.id, c.text]));
                                                
                                                const results: string[] = [];
                                                for (const [rowId, colIds] of Object.entries(answer)) {
                                                    const rowText = rowMap.get(rowId) || rowId;
                                                    const cols = Array.isArray(colIds) ? colIds.map((id: string) => colMap.get(id) || id) : [colMap.get(colIds as string) || colIds];
                                                    results.push(`${rowText}: ${cols.join(', ')}`);
                                                }
                                                return results.join(' | ');
                                            } catch (e) {
                                                return formatChoiceLabel(t, block?.options);
                                            }
                                        }
                                        if (q.type === 'ranking' && q.options) {
                                            try {
                                                const options = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
                                                const answer = JSON.parse(t);
                                                const optMap = new Map(options.map((o: any) => [o.id, o.label]));
                                                const results = (answer as string[]).map((id, index) => `${index + 1}. ${optMap.get(id) || id}`);
                                                return results.join(' ➔ ');
                                            } catch (e) {
                                                return formatChoiceLabel(t, block?.options);
                                            }
                                        }
                                        return formatChoiceLabel(t, block?.options);
                                    })()}
                                </p>
                            </div>
                        ))}
                        {q.text_responses.length > 5 && (
                            <p className="text-xs text-slate-500 text-center py-1">+{q.text_responses.length - 5} phản hồi khác</p>
                        )}
                    </div>
                )}
                {/* Skip rate micro bar */}
                {skipPct > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                        <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-slate-500">Tỷ lệ trả lời</span>
                            <span className="font-bold text-slate-700">{100 - skipPct}%</span>
                        </div>
                        <Bar value={100 - skipPct} color="var(--color-primary)" />
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Respondents list ─────────────────────────────────────────────────────────
const RespondentsList: React.FC<{ surveyId: string; survey?: Survey | null }> = ({ surveyId, survey }) => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        api.get<any>(`surveys/${surveyId}?action=respondents`)
            .then(r => { if (r.success) setData(r.data ?? []); })
            .finally(() => setLoading(false));
    }, [surveyId]);

    const filtered = data.filter(r => {
        const q = search.toLowerCase();
        return !search 
            || (r.subscriber_email ?? '').toLowerCase().includes(q)
            || (r.subscriber_name ?? '').toLowerCase().includes(q)
            || (r.subscriber_phone ?? '').toLowerCase().includes(q)
            || (r.geo_city ?? '').toLowerCase().includes(q);
    });

    const surveySlug = survey?.slug || surveyId;
    const basePublicUrl = `${window.location.origin}/s/${surveySlug}`;

    const copyLink = (email: string) => {
        const link = `${basePublicUrl}?src=email&email=${encodeURIComponent(email)}&uid=${encodeURIComponent(email)}`;
        navigator.clipboard.writeText(link);
        setCopiedId(email);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const openCustomerDrawer = (contactId: number | string) => {
        const idNum = Number(contactId);
        if (!Number.isFinite(idNum) || idNum <= 0) return;
        window.dispatchEvent(
            new CustomEvent('open-customer-drawer', {
                detail: { id: idNum, initialTab: 'journey360' }
            })
        );
    };

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                    value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Tìm theo họ tên, email hoặc số điện thoại..."
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-500 focus:outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary-light)]"
                />
            </div>

            {loading ? (
                <div className="space-y-2">
                    {[1, 2, 3].map(i => <div key={i} className="h-14 bg-slate-100 rounded-2xl animate-pulse" />)}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-slate-600 text-sm bg-white rounded-2xl border border-slate-200">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                    {search ? 'Không tìm thấy người tham gia phù hợp' : 'Chưa có phản hồi nào'}
                </div>
            ) : (
                <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1">
                    {filtered.map((r, i) => {
                        const isEmail = r.source_channel === 'email_embed' || r.source_channel === 'email';
                        const isQR = r.source_channel === 'qr_code';
                        const isWidget = r.source_channel === 'widget';
                        const isExpanded = expandedId === (r.id || String(i));
                        const hasContactId = Boolean(r.contact_id && Number(r.contact_id) > 0);
                        const displayName = r.subscriber_name || r.subscriber_email || '?';

                        return (
                            <div 
                                key={r.id ?? i} 
                                className={`bg-white rounded-2xl border transition-all ${isExpanded ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary-light)]' : 'border-slate-200 hover:border-slate-300'}`}
                            >
                                <div className="p-4 flex items-center gap-3.5">
                                    {/* Shared Avatar component (Contract §1) */}
                                    <Avatar name={displayName} size={32} />

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {hasContactId ? (
                                                <button
                                                    type="button"
                                                    onClick={() => openCustomerDrawer(r.contact_id)}
                                                    className="text-sm font-bold text-slate-900 hover:text-[var(--color-primary)] transition-colors truncate inline-flex items-center gap-1"
                                                    title="Mở hồ sơ CRM 360°"
                                                >
                                                    <span className="truncate">{r.subscriber_name || r.subscriber_email || 'Khách hàng'}</span>
                                                    <ExternalLink className="w-3 h-3 text-[var(--color-primary)] shrink-0" />
                                                </button>
                                            ) : (
                                                <p className="text-sm font-bold text-slate-900 truncate">
                                                    {r.subscriber_name || <span className="text-slate-500 font-normal italic">Khách chưa lưu tên</span>}
                                                </p>
                                            )}

                                            {/* Channel Badge */}
                                            {isEmail ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--color-primary-light)] text-[var(--color-primary)] border border-[var(--color-primary)]/20 flex items-center gap-1">
                                                    <Mail className="w-3 h-3 text-[var(--color-primary)]" /> Email
                                                </span>
                                            ) : isQR ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                                                    <QrCode className="w-3 h-3 text-purple-600" /> QR
                                                </span>
                                            ) : isWidget ? (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                                    <Zap className="w-3 h-3 text-emerald-600" /> Widget
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                                    <Globe className="w-3 h-3 text-blue-600" /> Link trực tiếp
                                                </span>
                                            )}

                                            {r.device_type && (
                                                <span className="text-[10px] text-slate-600 font-medium px-1.5 py-0.5 bg-slate-50 rounded border border-slate-200">
                                                    {r.device_type}
                                                </span>
                                            )}
                                        </div>

                                        {/* Contact row */}
                                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-600 flex-wrap">
                                            {r.subscriber_email && (
                                                <span className="flex items-center gap-1 font-medium text-slate-700">
                                                    <Mail className="w-3 h-3 text-slate-500" /> {r.subscriber_email}
                                                </span>
                                            )}
                                            {r.subscriber_phone && (
                                                <span className="flex items-center gap-1 font-mono font-bold text-[var(--color-primary)] bg-[var(--color-primary-light)] px-1.5 py-0.5 rounded">
                                                    <Phone className="w-3 h-3 text-[var(--color-primary)]" /> {r.subscriber_phone}
                                                </span>
                                            )}
                                            {r.submitted_at && (
                                                <span className="flex items-center gap-1 text-slate-500">
                                                    <Clock className="w-3 h-3 text-slate-400" /> {new Date(r.submitted_at).toLocaleString('vi-VN')}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right actions */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="text-right hidden sm:block">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                                (r.completion_rate ?? 0) >= 80
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                    : (r.completion_rate ?? 0) >= 50
                                                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                                    : 'bg-rose-50 text-rose-700 border border-rose-200'
                                            }`}>
                                                {Math.round(r.completion_rate ?? 0)}% xong
                                            </span>
                                            {r.time_spent_sec ? (
                                                <p className="text-[10px] text-slate-500 mt-0.5">{formatTime(r.time_spent_sec)}</p>
                                            ) : null}
                                        </div>

                                        {hasContactId && (
                                            <a
                                                href={`/crm/contacts?id=${r.contact_id}`}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    openCustomerDrawer(r.contact_id);
                                                }}
                                                className="px-2.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-[var(--color-primary)] text-xs font-bold flex items-center gap-1 transition-all"
                                                title="Mở hồ sơ CRM 360°"
                                            >
                                                <User className="w-3.5 h-3.5" />
                                                <span className="hidden md:inline">Mở hồ sơ CRM 360°</span>
                                            </a>
                                        )}

                                        {/* Expand answers button */}
                                        <button
                                            type="button"
                                            onClick={() => setExpandedId(isExpanded ? null : (r.id || String(i)))}
                                            className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 transition-all ${isExpanded ? 'bg-[var(--color-primary-light)] text-[var(--color-primary)]' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}`}
                                            title="Xem chi tiết các câu trả lời"
                                        >
                                            <span className="hidden sm:inline">{isExpanded ? 'Thu gọn' : 'Xem trả lời'}</span>
                                            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </button>

                                        {r.subscriber_email && (
                                            <button
                                                type="button"
                                                onClick={() => copyLink(r.subscriber_email)}
                                                className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition-all"
                                                title="Sao chép link khảo sát cho người này"
                                            >
                                                {copiedId === r.subscriber_email ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded Answers View */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-1 border-t border-slate-200 bg-slate-50/50 rounded-b-2xl space-y-2">
                                        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mt-2 mb-2">Câu trả lời đã gửi:</p>
                                        {Array.isArray(r.answers) && r.answers.length > 0 ? (
                                            r.answers.map((ans: any, aIdx: number) => {
                                                const block = survey?.blocks?.find(b => b.id === ans.block_id || b.id === ans.question_id);
                                                const qTitle = ans.question_title || block?.label || (block as any)?.content || (block as any)?.title || (block as any)?.question || `Câu hỏi #${aIdx + 1}`;
                                                const rawAnswer = ans.answer_text || (Array.isArray(ans.answer_json) ? ans.answer_json.join(', ') : (ans.answer_num != null ? String(ans.answer_num) : ''));
                                                const answerText = formatChoiceLabel(rawAnswer, block?.options);

                                                return (
                                                    <div key={aIdx} className="bg-white p-3 rounded-xl border border-slate-200">
                                                        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 mb-1">
                                                            <span className="w-4 h-4 rounded bg-[var(--color-primary-light)] text-[var(--color-primary)] text-[10px] font-black flex items-center justify-center">{aIdx + 1}</span>
                                                            <span>{formatChoiceLabel(qTitle)}</span>
                                                        </div>
                                                        <div className="text-xs text-slate-900 font-medium pl-5">
                                                            {answerText ? (
                                                                <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 inline-block">{answerText}</span>
                                                            ) : (
                                                                <span className="text-slate-500 italic">Không có phản hồi</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <p className="text-xs text-slate-500 italic py-2">Không có chi tiết câu trả lời được lưu trong phiên này.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Email tracking instruction */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/80 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-800 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-600" /> Cấu hình gửi qua Email Campaign
                    </p>
                    <span className="text-[10px] font-bold bg-blue-100/80 text-blue-700 px-2 py-0.5 rounded-full">Tự động nhận diện danh tính</span>
                </div>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                    Khi gửi khảo sát qua Mailflow/Email Automation, gắn link dưới đây vào nút bấm (Call-To-Action).
                    Hệ thống sẽ tự động bắt Email, Họ tên và SĐT người click:
                </p>
                <div className="bg-white/90 rounded-xl px-3.5 py-2.5 font-mono text-[10px] text-slate-600 break-all border border-blue-100 flex items-center justify-between gap-2">
                    <span className="select-all">
                        {basePublicUrl}?utm_source=mailflow&amp;utm_medium=email&amp;email=<span className="text-blue-600">{"{{email}}"}</span>&amp;name=<span className="text-[var(--color-primary)]">{"{{name}}"}</span>&amp;phone=<span className="text-emerald-600">{"{{phone}}"}</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            navigator.clipboard.writeText(`${basePublicUrl}?utm_source=mailflow&utm_medium=email&email={{email}}&name={{name}}&phone={{phone}}`);
                            setCopiedId('template-link');
                            setTimeout(() => setCopiedId(null), 2000);
                        }}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 shrink-0 font-sans text-xs font-bold flex items-center gap-1"
                        title="Copy mẫu link"
                    >
                        {copiedId === 'template-link' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId === 'template-link' ? 'Đã chép' : 'Chép link'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main SurveyReportModal ───────────────────────────────────────────────────
const SurveyReportModal: React.FC<Props> = ({ survey, isOpen, onClose: _onClose }) => {
    const [tab, setTab] = useState<'overview' | 'questions' | 'respondents'>('overview');
    const [analytics, setAnalytics] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);

    const onClose = React.useCallback(() => {
        setAnimateIn(false);
        setTimeout(() => {
            setIsVisible(false);
            _onClose();
        }, 220);
    }, [_onClose]);

    useEffect(() => {
        if (isOpen && survey) {
            setIsVisible(true);
            let raf2 = 0;
            const raf1 = requestAnimationFrame(() => {
                raf2 = requestAnimationFrame(() => setAnimateIn(true));
            });
            return () => {
                cancelAnimationFrame(raf1);
                cancelAnimationFrame(raf2);
            };
        } else {
            setAnimateIn(false);
            const timer = setTimeout(() => setIsVisible(false), 220);
            return () => clearTimeout(timer);
        }
    }, [isOpen, survey]);

    useEffect(() => {
        if (!isOpen) return;
        const release = pushOverlay('survey_report_drawer', onClose, 2000);
        return () => release();
    }, [isOpen, onClose]);

    useEffect(() => {
        if (!isOpen || !survey) return;
        setLoading(true);
        setAnalytics(null);
        api.get<any>(`surveys/${survey.id}?action=analytics`)
            .then(r => { if (r.success) setAnalytics(r.data); })
            .finally(() => setLoading(false));
    }, [isOpen, survey?.id]);

    if (!isVisible || !survey) return null;

    const ov = analytics?.overview;
    const questions: QuestionAnalytics[] = analytics?.questions ?? [];
    const byDate: Array<{ date: string; count: number }> = analytics?.by_date ?? [];
    const primaryColor = survey.theme?.primaryColor || '#BD1D2D';

    const CHANNEL_META: Record<string, { label: string; icon: React.ReactNode; color: string; key: string }> = {
        direct:  { label: 'Link trực tiếp', icon: <Globe className="w-3.5 h-3.5" />,       color: '#3b82f6', key: 'direct_count' },
        qr:      { label: 'QR Code',         icon: <QrCode className="w-3.5 h-3.5" />,      color: '#8b5cf6', key: 'qr_count' },
        email:   { label: 'Email',            icon: <Mail className="w-3.5 h-3.5" />,        color: '#BD1D2D', key: 'email_count' },
        widget:  { label: 'Widget',           icon: <Zap className="w-3.5 h-3.5" />,         color: '#10b981', key: 'widget_count' },
        api:     { label: 'API',              icon: <Link2 className="w-3.5 h-3.5" />,       color: '#ec4899', key: 'api_count' },
    };

    return createPortal(
        <div className="fixed inset-0 z-[2147483625] flex overflow-hidden" style={{ zIndex: 2147483625, pointerEvents: animateIn ? 'auto' : 'none' }}>
            {/* Backdrop */}
            <div
                className="drawer-backdrop"
                onClick={onClose}
                style={{
                    background: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)',
                    opacity: animateIn ? 1 : 0,
                    transition: 'opacity 0.22s cubic-bezier(0.25, 0.1, 0.25, 1)',
                    pointerEvents: animateIn ? 'auto' : 'none',
                    zIndex: 2147483620,
                    '--drawer-backdrop-z': 2147483620
                } as React.CSSProperties}
            />

            {/* Panel — full height, flush to top */}
            <div
                className="drawer-panel fixed top-0 right-0 bottom-0 z-[2147483625] w-full lg:w-[calc(100vw-var(--sidebar-width,220px))] max-w-none bg-white flex flex-col border-l border-slate-200"
                style={{
                    zIndex: 2147483625,
                    opacity: animateIn ? 1 : 0,
                    transform: animateIn ? 'translate3d(0, 0, 0)' : 'translate3d(48px, 0, 0)',
                    transition: 'transform 0.22s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.20s cubic-bezier(0.25, 0.1, 0.25, 1)',
                    pointerEvents: animateIn ? 'auto' : 'none'
                }}
            >

                {/* ── HEADER ────────────────────────────────────────────── */}
                <div className="px-8 pt-6 pb-0 flex-shrink-0 bg-white">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap text-[11px] font-bold">
                                {survey.status === 'active' ? (
                                    <span className="px-2 py-0.5 rounded text-emerald-700 bg-emerald-50 border border-emerald-200 uppercase tracking-widest flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> ĐANG CHẠY
                                    </span>
                                ) : survey.status === 'paused' ? (
                                    <span className="px-2 py-0.5 rounded text-amber-700 bg-amber-50 border border-amber-200 uppercase tracking-widest flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> TẠM DỪNG
                                    </span>
                                ) : (
                                    <span className="px-2 py-0.5 rounded text-slate-600 bg-slate-100 border border-slate-200 uppercase tracking-widest">BẢN NHÁP</span>
                                )}
                                {ov && <span className="text-slate-600 font-medium flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-slate-400" /> Tạo lúc: {new Date(survey.created_at || '').toLocaleDateString('vi-VN')}</span>}
                                <span className="text-slate-600 font-medium flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-50 border border-slate-200">
                                    ID: <span className="font-mono text-slate-800">{survey.id.split('-')[0]}</span>
                                </span>
                            </div>
                            <h2 className="text-slate-900 font-black text-2xl leading-tight truncate mt-1">{survey.name}</h2>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setLoading(true);
                                    api.get<any>(`surveys/${survey.id}?action=analytics`)
                                        .then(r => { if (r.success) setAnalytics(r.data); })
                                        .finally(() => setLoading(false));
                                }}
                                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold flex items-center gap-1.5 transition-all"
                            >
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Làm mới
                            </button>
                            <button type="button" onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 transition-all">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* ── TABS ─────────────────────────────────────────────────── */}
                    <div className="flex border-b border-slate-200 mt-5 pt-1">
                        <button type="button" onClick={() => setTab('overview')}
                            className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-all -mb-px ${tab === 'overview' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                        ><BarChart2 className="w-4 h-4" /> Báo cáo</button>
                        <button type="button" onClick={() => setTab('questions')}
                            className={`flex items-center gap-1.5 py-3 px-4 text-xs font-bold border-b-2 transition-all -mb-px ${tab === 'questions' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                        ><BarChart2 className="w-4 h-4" /> Nội dung <span className="ml-0.5 bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md text-[9px]">{questions.length}</span></button>
                        <button type="button" onClick={() => setTab('respondents')}
                            className={`flex items-center gap-1.5 py-3 px-4 text-xs font-bold border-b-2 transition-all -mb-px ${tab === 'respondents' ? 'border-[var(--color-primary)] text-[var(--color-primary)]' : 'border-transparent text-slate-600 hover:text-slate-900'}`}
                        ><Users className="w-4 h-4" /> Đối tượng</button>
                    </div>
                </div>

                {/* ── BODY ─────────────────────────────────────────────────── */}
                <div className="flex-1 overflow-y-auto bg-slate-50">
                    {loading ? (
                        <div className="p-6 grid grid-cols-2 gap-4">
                            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse border border-slate-200" />)}
                        </div>
                    ) : !ov && tab === 'overview' ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-3 py-20">
                            <BarChart2 className="w-12 h-12 text-slate-300" />
                            <p className="text-sm font-semibold">Chưa có dữ liệu phân tích</p>
                            <p className="text-xs">Khảo sát cần có ít nhất một phản hồi</p>
                        </div>
                    ) : tab === 'overview' && ov ? (
                        <div className="p-8 space-y-6">
                            {/* KPI strip */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[
                                    { label: 'TỔNG LƯỢT PHẢN HỒI', desc: 'Tổng lượt tham gia khảo sát', value: Number(ov.total_responses ?? 0).toLocaleString('vi-VN'), Icon: Users, isPrimary: true },
                                    { label: 'TỶ LỆ HOÀN THÀNH', desc: 'Hoàn tất toàn bộ câu hỏi', value: ov.avg_completion_rate ? `${Math.round(ov.avg_completion_rate)}%` : '0%', Icon: CheckCircle, isPrimary: false },
                                    { label: 'THỜI GIAN TB', desc: 'Thời gian làm bài trung bình', value: formatTime(+ov.avg_time_spent_sec), Icon: Clock, isPrimary: false },
                                    { label: 'TỶ LỆ DI ĐỘNG', desc: 'Truy cập trên thiết bị Mobile', value: (ov.mobile_count && ov.total_responses) ? `${pct(+ov.mobile_count, +ov.total_responses)}%` : '0%', Icon: Smartphone, isPrimary: false },
                                ].map((s, idx) => {
                                    const IconComp = s.Icon;
                                    const iconBg = s.isPrimary ? '#fef2f2' : '#f8fafc';
                                    const iconColor = s.isPrimary ? '#C6333D' : '#334155';
                                    const iconBorder = s.isPrimary ? '#fecdd3' : '#e2e8f0';
                                    return (
                                        <div
                                            key={idx}
                                            style={{
                                                minHeight: '136px',
                                                borderRadius: '16px',
                                                border: '1px solid #e2e8f0',
                                                background: '#ffffff',
                                                padding: '16px 18px',
                                                boxShadow: '0 1px 3px rgba(15,23,42,0.04)',
                                            }}
                                            className="w-full min-w-0 h-full flex flex-col justify-between transition-all duration-200 hover:shadow-md cursor-pointer"
                                        >
                                            <div className="relative z-10 flex flex-col justify-between h-full w-full min-w-0">
                                                <div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px' }}>
                                                        <div
                                                            className="stat-label truncate"
                                                            style={{
                                                                fontSize: '0.75rem',
                                                                fontWeight: 700,
                                                                textTransform: 'uppercase',
                                                                letterSpacing: '0.05em',
                                                                color: '#64748b',
                                                            }}
                                                        >
                                                            {s.label}
                                                        </div>
                                                        <div
                                                            className="stat-icon"
                                                            style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '8px',
                                                                background: iconBg,
                                                                border: `1px solid ${iconBorder}`,
                                                                color: iconColor,
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            <IconComp className="w-4 h-4" />
                                                        </div>
                                                    </div>
                                                    <div style={{ fontSize: '1.625rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }} className="stat-value tabular-nums truncate">{s.value}</div>
                                                    <div
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            color: '#64748b',
                                                            marginTop: '6px',
                                                            fontWeight: 500,
                                                        }}
                                                        className="truncate"
                                                    >
                                                        {s.desc}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Trend chart (Trả lời theo ngày) */}
                            {byDate.length > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-5">Lượt trả lời theo ngày</h4>
                                    <div className="w-full -ml-4" style={{ height: 260 }}>
                                        <ResponsiveContainer width="100%" height={260}>
                                            <LineChart data={byDate}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={v => String(v).slice(5)} />
                                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }} />
                                                <Line type="monotone" dataKey="count" name="Phản hồi" stroke={primaryColor} strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} activeDot={{ r: 6 }} />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* Channel + Device */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* Channel */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4">Nguồn kênh</h4>
                                    <div className="space-y-3">
                                        {Object.entries(CHANNEL_META).map(([k, ch]) => {
                                            const cnt = Number(ov[ch.key] ?? 0);
                                            const p = pct(cnt, Number(ov.total_responses ?? 1) || 1);
                                            return (
                                                <div key={k}>
                                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                                        <span className="flex items-center gap-1.5 font-medium text-slate-700" style={{ color: p > 0 ? ch.color : undefined }}>
                                                            <span style={{ color: ch.color }}>{ch.icon}</span>
                                                            {ch.label}
                                                        </span>
                                                        <span className="font-black text-slate-800">{cnt} <span className="font-normal text-slate-500">({p}%)</span></span>
                                                    </div>
                                                    <Bar value={p} color={ch.color} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Device Donut Chart */}
                                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Thiết bị</h4>
                                    <div className="w-full flex items-center justify-center" style={{ height: 260 }}>
                                        {(() => {
                                            const DEVICE_COLORS: Record<string, string> = { 'Desktop': '#3b82f6', 'Mobile': '#BD1D2D', 'Tablet': '#8b5cf6' };
                                            const deviceData = [
                                                { name: 'Desktop', value: Number(ov.desktop_count ?? 0) },
                                                { name: 'Mobile', value: Number(ov.mobile_count ?? 0) },
                                                { name: 'Tablet', value: Number(ov.tablet_count ?? 0) }
                                            ].filter(x => x.value > 0);
                                            
                                            if (deviceData.length === 0) return <span className="text-xs text-slate-500">Không có dữ liệu</span>;

                                            return (
                                                <ResponsiveContainer width="100%" height={260}>
                                                    <PieChart>
                                                        <Pie
                                                            data={deviceData}
                                                            innerRadius={55}
                                                            outerRadius={80}
                                                            paddingAngle={5}
                                                            dataKey="value"
                                                        >
                                                            {deviceData.map(e => <Cell key={e.name} fill={DEVICE_COLORS[e.name]} />)}
                                                        </Pie>
                                                        <RechartsTooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }} />
                                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            );
                                        })()}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Country Bar Chart */}
                            {ov.countries && ov.countries.length > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-5 flex items-center gap-1">
                                        <MapPin className="w-3.5 h-3.5" /> Vị trí (Quốc gia)
                                    </h4>
                                    <div className="w-full -ml-4" style={{ height: 260 }}>
                                        <ResponsiveContainer width="100%" height={260}>
                                            <BarChart data={ov.countries}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="country" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: 'none' }} />
                                                <RechartsBar dataKey="count" name="Lượt phản hồi" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                </div>
                            )}

                            {/* NPS global if applicable */}
                            {ov.nps_score !== undefined && (
                                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4">NPS tổng thể</h4>
                                    <NpsGauge
                                        score={ov.nps_score}
                                        promoters={ov.promoters ?? 0}
                                        passives={ov.passives ?? 0}
                                        detractors={ov.detractors ?? 0}
                                    />
                                </div>
                            )}

                            {/* Quick question summary (first 2 questions) */}
                            {questions.length > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Nổi bật từng câu</h4>
                                        <button type="button" onClick={() => setTab('questions')} className="text-xs font-bold text-[var(--color-primary)] hover:opacity-80 flex items-center gap-1">
                                            Xem tất cả <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="space-y-4">
                                        {questions.slice(0, 2).map((q, i) => (
                                            <QuestionCard key={q.question_id} q={q} idx={i} survey={survey} />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                    ) : tab === 'questions' ? (
                        <div className="p-6 space-y-4">
                            {questions.length === 0 ? (
                                <div className="text-center py-20 text-slate-400 text-sm">Chưa có dữ liệu phân tích câu hỏi</div>
                            ) : (
                                questions.map((q, i) => <QuestionCard key={q.question_id} q={q} idx={i} survey={survey} />)
                            )}
                        </div>

                    ) : tab === 'respondents' ? (
                        <div className="p-6">
                            <RespondentsList surveyId={survey.id} survey={survey} />
                        </div>
                      ) : null}
                </div>
            </div>
        </div>,
        getMktPortalRoot()
    );
};

export default SurveyReportModal;
