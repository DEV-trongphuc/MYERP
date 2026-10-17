import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Survey } from '../../components/marketing/types/survey';
import {
    Plus, BarChart2, Globe, Trash2, FileText,
    LayoutGrid, Ticket, PenSquare, PenLine,
    Link2, Copy, Check, ExternalLink, QrCode, Lightbulb,
    Users, Star, List, PauseCircle, ClipboardList, Clock, HelpCircle
} from 'lucide-react';
import Modal from '../../components/marketing/components/common/Modal';
import ConfirmModal from '../../components/marketing/components/common/ConfirmModal';
import Input from '../../components/marketing/components/common/Input';
import Tabs from '../../components/marketing/components/common/Tabs';
import PageHero from '../../components/marketing/components/common/PageHero';
import StatCard from '../../components/marketing/components/common/StatCard';
import StatGrid from '../../components/marketing/components/common/StatGrid';
import Panel from '../../components/marketing/components/common/Panel';
import Toolbar from '../../components/marketing/components/common/Toolbar';
import SearchBox from '../../components/marketing/components/common/SearchBox';
import { api } from '../../components/marketing/services/storageAdapter';
import { toast } from 'react-hot-toast';
import { useTheme } from '../../components/marketing/contexts/ThemeContext';

// Lazy-load heavy editor & report drawer (Contract §2)
const SurveyEditor = React.lazy(() => import('../../components/marketing/components/surveys/SurveyEditor'));
const SurveyReportModal = React.lazy(() => import('../../components/marketing/components/surveys/SurveyReportModal'));
const SurveyGuideModal = React.lazy(() => import('../../components/marketing/components/surveys/SurveyGuideModal'));

// ─── Status config ───────────────────────────────────────────────────────────
const STATUS = {
    draft:  { label: 'Bản nháp',   dotClass: 'bg-amber-500',                 badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50', iconBg: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/40' },
    active: { label: 'Đang chạy',  dotClass: 'bg-emerald-500 animate-pulse', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50', iconBg: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/80 dark:border-emerald-800/40' },
    paused: { label: 'Tạm dừng',   dotClass: 'bg-rose-500',                  badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50', iconBg: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/80 dark:border-rose-800/40' },
    closed: { label: 'Đã đóng',    dotClass: 'bg-slate-400',                 badgeClass: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700', iconBg: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700' },
};

// ─── Confirm Delete Modal ────────────────────────────────────────────────────
const ConfirmDeleteModal: React.FC<{
    survey: Survey | null;
    onConfirm: () => void;
    onCancel: () => void;
    isDark?: boolean;
}> = ({ survey, onConfirm, onCancel, isDark }) => {
    if (!survey) return null;
    return (
        <ConfirmModal
            isOpen={!!survey}
            onClose={onCancel}
            onConfirm={onConfirm}
            title="Xoá khảo sát"
            message={
                <>
                    Bạn có chắc muốn xoá khảo sát <span className="font-bold text-slate-900 dark:text-slate-200">"{survey.name}"</span>?
                    <br />Toàn bộ phản hồi và dữ liệu sẽ bị xoá vĩnh viễn.
                </>
            }
            confirmText="Xoá khảo sát"
            variant="danger"
            isDarkTheme={isDark}
        />
    );
};

// ─── Share / Preview Modal (opens when slug link is clicked) ─────────────────
const SurveyPreviewModal: React.FC<{
    survey: Survey | null;
    onClose: () => void;
    onEdit: () => void;
    isDark?: boolean;
}> = ({ survey, onClose, onEdit, isDark }) => {
    const [copied, setCopied] = useState(false);
    if (!survey) return null;

    const publicUrl = survey.slug
        ? `${window.location.origin}/s/${survey.slug}`
        : null;

    const isPublic = survey.status === 'active';

    const copy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const emailTrackUrl = publicUrl
        ? `${publicUrl}?src=email&uid={{email}}`
        : null;

    return (
        <Modal
            isOpen={!!survey}
            onClose={onClose}
            size="md"
            title={
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--color-primary-light)] flex items-center justify-center flex-shrink-0">
                        <FileText className="w-5 h-5 text-[var(--color-primary)]" />
                    </div>
                    <div>
                        <p className="text-[var(--color-text-muted)] text-[10px] font-bold uppercase tracking-wider">Khảo sát</p>
                        <h3 className="text-[var(--color-text)] font-bold text-base leading-tight line-clamp-1">{survey.name}</h3>
                        <span className={`inline-flex items-center gap-1 mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            STATUS[survey.status as keyof typeof STATUS]?.badgeClass ?? STATUS.draft.badgeClass
                        }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${STATUS[survey.status as keyof typeof STATUS]?.dotClass ?? 'bg-slate-400'}`} />
                            {STATUS[survey.status as keyof typeof STATUS]?.label ?? survey.status}
                        </span>
                    </div>
                </div>
            }
            isDarkTheme={isDark}
        >
            <div className="space-y-4">
                {publicUrl ? (
                    <>
                        <div>
                            <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Link công khai</p>
                            <div className="flex items-center gap-2 p-3 bg-[var(--color-primary-light)] border border-[var(--color-primary)]/20 rounded-[var(--radius-md)]">
                                <Link2 className="w-3.5 h-3.5 text-[var(--color-primary)] flex-shrink-0" />
                                <span className="flex-1 text-xs font-medium text-[var(--color-primary)] truncate font-mono">{publicUrl}</span>
                                <button
                                    type="button"
                                    onClick={() => copy(publicUrl)}
                                    className="flex-shrink-0 p-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)] transition-colors border border-[var(--color-border)]"
                                    title="Sao chép đường dẫn"
                                >
                                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-[var(--color-primary)]" />}
                                </button>
                            </div>
                        </div>

                        {isPublic && (
                            <div className="grid grid-cols-3 gap-2">
                                <a
                                    href={publicUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-col items-center gap-1.5 p-3 bg-[var(--color-surface)] hover:bg-[var(--color-bg)] rounded-[var(--radius-md)] border border-[var(--color-border)] transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-primary-light)] flex items-center justify-center">
                                        <ExternalLink className="w-4 h-4 text-[var(--color-primary)]" />
                                    </div>
                                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Mở trang</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={onEdit}
                                    className="flex flex-col items-center gap-1.5 p-3 bg-[var(--color-surface)] hover:bg-[var(--color-bg)] rounded-[var(--radius-md)] border border-[var(--color-border)] transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-primary-light)] flex items-center justify-center">
                                        <PenLine className="w-4 h-4 text-[var(--color-primary)]" />
                                    </div>
                                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Thiết kế</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => copy(emailTrackUrl ?? '')}
                                    className="flex flex-col items-center gap-1.5 p-3 bg-[var(--color-surface)] hover:bg-[var(--color-bg)] rounded-[var(--radius-md)] border border-[var(--color-border)] transition-colors group"
                                >
                                    <div className="w-8 h-8 rounded-[var(--radius-sm)] bg-[var(--color-primary-light)] flex items-center justify-center">
                                        <QrCode className="w-4 h-4 text-[var(--color-primary)]" />
                                    </div>
                                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">Email link</span>
                                </button>
                            </div>
                        )}

                        {isPublic && emailTrackUrl && (
                            <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-[var(--radius-md)] p-3.5 space-y-1.5">
                                <p className="text-xs font-semibold text-[var(--color-primary)] flex items-center gap-1.5">
                                    <Link2 className="w-3.5 h-3.5" /> Đường dẫn theo dõi qua Email
                                </p>
                                <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                                    Thêm vào cuối URL khi gửi qua chiến dịch email:
                                </p>
                                <div className="flex items-center gap-2 bg-[var(--color-surface)] rounded-[var(--radius-sm)] px-3 py-2 border border-[var(--color-border)]">
                                    <code className="text-[11px] text-[var(--color-text-secondary)] flex-1 break-all font-mono">{emailTrackUrl}</code>
                                    <button type="button" onClick={() => copy(emailTrackUrl)} className="flex-shrink-0">
                                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-[var(--color-bg)] rounded-[var(--radius-md)] border border-[var(--color-border)] p-5 text-center">
                        <Globe className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2 opacity-60" />
                        <p className="text-sm font-semibold text-[var(--color-text)]">Chưa xuất bản</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Nhấn "Mở trình thiết kế" để cấu hình và xuất bản</p>
                    </div>
                )}

                <button
                    type="button"
                    onClick={onEdit}
                    className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-hover)] transition-colors"
                >
                    <PenLine className="w-4 h-4" />
                    Mở trình thiết kế
                </button>
            </div>
        </Modal>
    );
};

// ─── Create Modal ────────────────────────────────────────────────────────────
const CreateSurveyModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onCreate: (name: string) => Promise<void>;
    isDark?: boolean;
}> = ({ isOpen, onClose, onCreate, isDark }) => {
    const [name, setName] = useState('Khảo sát mới');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!name.trim() || isLoading) return;
        setIsLoading(true);
        await onCreate(name.trim());
        setIsLoading(false);
        setName('Khảo sát mới');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="sm" isDarkTheme={isDark} title="Tạo khảo sát mới">
            <div className="space-y-4">
                <Input
                    label="Tên khảo sát"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="VD: Khảo sát hài lòng sản phẩm Q2/2026"
                    onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                    autoFocus
                />

                <div>
                    <p className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2.5">Mẫu phổ biến</p>
                    <div className="grid grid-cols-2 gap-2.5">
                        {([
                            { label: 'Khảo sát NPS', desc: 'Đo điểm hài lòng khách hàng', color: '#BD1D2D', bg: '#fef2f2',
                              svg: (<svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" strokeLinejoin="round"/></svg>) },
                            { label: 'Phản hồi sản phẩm', desc: 'Thu thập ý kiến về sản phẩm', color: '#3b82f6', bg: '#eff6ff',
                              svg: (<svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>) },
                            { label: 'Đánh giá dịch vụ', desc: 'Chất lượng dịch vụ sau mua', color: '#10b981', bg: '#ecfdf5',
                              svg: (<svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>) },
                            { label: 'Khảo sát thị trường', desc: 'Nghiên cứu thói quen người dùng', color: '#8b5cf6', bg: '#f5f3ff',
                              svg: (<svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>) },
                            { label: 'Mẫu Quiz (Trắc nghiệm)', desc: 'Kiểm tra kiến thức, đánh giá', color: '#ec4899', bg: '#fdf2f8',
                              svg: (<svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>) },
                            { label: 'Mẫu Check-in Event', desc: 'Đăng ký tham gia sự kiện, quét QR', color: '#14b8a6', bg: '#f0fdfa',
                              svg: (<svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" stroke="currentColor" strokeWidth="1.8"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>) },
                        ] as const).map((t) => {
                            const isActive = name === t.label;
                            return (
                                <button
                                    key={t.label}
                                    type="button"
                                    onClick={() => setName(t.label)}
                                    className={`flex items-start gap-2.5 p-3 rounded-[var(--radius-md)] border text-left transition-all ${
                                        isActive
                                            ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)] shadow-xs'
                                            : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-bg)]'
                                    }`}
                                >
                                    <div
                                        className="w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center flex-shrink-0 bg-[var(--color-surface)] border border-[var(--color-border-light)]"
                                        style={{ color: t.color }}
                                    >
                                        {t.svg}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-[var(--color-text)] leading-tight mb-0.5 truncate">{t.label}</p>
                                        <p className="text-[11px] text-[var(--color-text-muted)] leading-snug line-clamp-2">{t.desc}</p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
                <div className="pt-3 flex items-center justify-end gap-2 border-t border-[var(--color-border-light)]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 px-3.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[13px] font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
                    >
                        Huỷ
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!name.trim() || isLoading}
                        className="h-9 px-4 inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white text-[13px] font-semibold hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        {isLoading ? 'Đang tạo...' : 'Tạo khảo sát'}
                    </button>
                </div>
            </div>
        </Modal>
    );
};

// ─── Survey Card (Grid card & Table row, NO .card class — Contract §1) ───────
const SurveyCard: React.FC<{
    survey: Survey;
    viewMode?: 'grid' | 'list';
    onEdit: () => void;
    onAnalytics: () => void;
    onDelete: () => void;
    onTogglePause: () => void;
    onSlugClick: () => void;
}> = React.memo(({ survey, viewMode = 'grid', onEdit, onAnalytics, onDelete, onTogglePause, onSlugClick }) => {
    const responses = survey.response_count ?? 0;
    const nps = survey.avg_nps;
    const statusCfg = STATUS[survey.status as keyof typeof STATUS] ?? STATUS.draft;
    const publicUrl = survey.slug ? `${window.location.origin}/s/${survey.slug}` : null;

    if (viewMode === 'list') {
        return (
            <tr
                onClick={onAnalytics}
                className="group border-b border-[var(--color-border-light)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer"
            >
                <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-[12px] flex items-center justify-center flex-shrink-0 ${statusCfg.iconBg}`}>
                            <ClipboardList className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors truncate max-w-[320px]">
                                {survey.name}
                            </p>
                            {(survey as any).description && (
                                <p className="text-xs text-[var(--color-text-muted)] truncate max-w-[320px] mt-0.5">
                                    {(survey as any).description}
                                </p>
                            )}
                        </div>
                    </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.badgeClass}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClass}`} />
                        {statusCfg.label}
                    </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    {survey.slug ? (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                if (publicUrl) {
                                    navigator.clipboard.writeText(publicUrl);
                                    toast.success('Đã sao chép link');
                                }
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] bg-[var(--color-bg)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] font-mono hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Sao chép link khảo sát"
                        >
                            <Link2 className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate max-w-[180px]">/s/{survey.slug}</span>
                            <Copy className="w-3 h-3 ml-1 opacity-60" />
                        </div>
                    ) : (
                        <span className="text-xs text-[var(--color-text-muted)] italic">Chưa xuất bản</span>
                    )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                    <span className="text-[13px] font-semibold text-[var(--color-text)] tabular-nums">
                        {responses.toLocaleString('vi-VN')}
                    </span>
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                    {nps !== undefined && nps !== null ? (
                        <span className={`text-xs font-bold tabular-nums ${nps >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {nps > 0 ? `+${nps}` : nps}
                        </span>
                    ) : (
                        <span className="text-xs text-[var(--color-text-muted)]">—</span>
                    )}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                    <div className="inline-flex items-center justify-end gap-1.5">
                        <label
                            className="relative inline-flex items-center cursor-pointer mr-1"
                            title={survey.status === 'active' ? 'Tạm dừng khảo sát' : 'Kích hoạt khảo sát'}
                        >
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={survey.status === 'active'}
                                onChange={onTogglePause}
                            />
                            <div className="w-8 h-4.5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500" />
                        </label>
                        <button
                            type="button"
                            onClick={onEdit}
                            className="h-8 px-2.5 inline-flex items-center gap-1 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
                            title="Thiết kế khảo sát"
                        >
                            <PenLine className="w-3.5 h-3.5" />
                            <span>Thiết kế</span>
                        </button>
                        <button
                            type="button"
                            onClick={onAnalytics}
                            className="h-8 px-2.5 inline-flex items-center gap-1 rounded-[12px] bg-[var(--color-primary)] text-white text-xs font-semibold hover:bg-[var(--color-primary-hover)] transition-colors shadow-xs"
                            title="Xem báo cáo"
                        >
                            <BarChart2 className="w-3.5 h-3.5" />
                            <span>Báo cáo</span>
                        </button>
                        <button
                            type="button"
                            onClick={onDelete}
                            className="p-1.5 rounded-[10px] text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Xoá khảo sát"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </td>
            </tr>
        );
    }

    return (
        <div className="hover-lift bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[18px] p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all duration-300 hover:border-[var(--color-primary-light)] flex flex-col justify-between group h-full">
            <div>
                {/* Top row: Status icon + Status badge + Toggle + Delete */}
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105 ${statusCfg.iconBg}`}>
                            <ClipboardList className="w-5 h-5" />
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotClass}`} />
                            {statusCfg.label}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <label
                            className="relative inline-flex items-center cursor-pointer"
                            title={survey.status === 'active' ? 'Tạm dừng khảo sát' : 'Kích hoạt khảo sát'}
                        >
                            <input
                                type="checkbox"
                                className="sr-only peer"
                                checked={survey.status === 'active'}
                                onChange={onTogglePause}
                            />
                            <div className="w-8 h-4.5 bg-slate-200 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-3.5 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-500" />
                        </label>
                        <button
                            type="button"
                            onClick={onDelete}
                            className="p-1.5 rounded-[10px] text-[var(--color-text-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                            title="Xoá khảo sát"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Title */}
                <h3
                    onClick={onAnalytics}
                    className="text-sm font-bold text-[var(--color-text)] group-hover:text-[var(--color-primary)] transition-colors line-clamp-2 mt-2 mb-2 cursor-pointer leading-snug"
                    title={survey.name}
                >
                    {survey.name}
                </h3>

                {/* URL Chip: subtle clean neutral chip */}
                <div className="mb-2">
                    {survey.slug ? (
                        <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] bg-[var(--color-bg)] border border-[var(--color-border)] text-xs text-[var(--color-text-muted)] font-mono hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group/chip max-w-full"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (publicUrl) {
                                    navigator.clipboard.writeText(publicUrl);
                                    toast.success('Đã sao chép link');
                                }
                            }}
                            title="Nhấn để sao chép liên kết"
                        >
                            <Link2 className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-muted)] group-hover/chip:text-[var(--color-primary)] transition-colors" />
                            <span className="truncate max-w-[200px]">/s/{survey.slug}</span>
                            <Copy className="w-3 h-3 ml-auto opacity-60 group-hover/chip:opacity-100 shrink-0" />
                        </div>
                    ) : (
                        <span className="inline-block text-xs text-[var(--color-text-muted)] italic py-1">
                            Chưa xuất bản
                        </span>
                    )}
                </div>
            </div>

            <div>
                {/* Metrics row: 2-column stats with subtle icons */}
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-[var(--color-bg)] rounded-[14px] border border-[var(--color-border-light)] my-3">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-[10px] bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="block text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider truncate">Lượt trả lời</span>
                            <span className="text-xs font-bold text-[var(--color-text)] tabular-nums">
                                {responses.toLocaleString('vi-VN')}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 border-l border-[var(--color-border-light)] pl-2">
                        <div className="w-8 h-8 rounded-[10px] bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                            <Star className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                            <span className="block text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider truncate">Điểm NPS</span>
                            <span className={`text-xs font-bold tabular-nums ${nps !== undefined && nps !== null ? (nps >= 0 ? 'text-emerald-600' : 'text-rose-600') : 'text-[var(--color-text-muted)]'}`}>
                                {nps !== undefined && nps !== null ? (nps > 0 ? `+${nps}` : nps) : '—'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bottom row CTA buttons */}
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                        type="button"
                        onClick={onEdit}
                        className="border border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-bg-subtle)] rounded-[12px] h-9 px-3.5 font-semibold text-xs flex-1 inline-flex items-center justify-center gap-1.5 transition-colors"
                    >
                        <PenLine className="w-3.5 h-3.5" />
                        Thiết kế
                    </button>
                    <button
                        type="button"
                        onClick={onAnalytics}
                        className="bg-[var(--color-primary)] text-white hover:brightness-95 rounded-[12px] h-9 px-3.5 font-semibold text-xs shadow-xs flex-[1.4] inline-flex items-center justify-center gap-1.5 transition-colors"
                    >
                        <BarChart2 className="w-3.5 h-3.5" />
                        Xem báo cáo
                    </button>
                </div>
            </div>
        </div>
    );
});
SurveyCard.displayName = 'SurveyCard';

// ─── Main Surveys Page ───────────────────────────────────────────────────────
const Surveys: React.FC = () => {
    const navigate = useNavigate();
    const routeParams = useParams<{ id: string }>();
    const [editingSurveyId, setEditingSurveyId] = useState<string | null>(routeParams.id || null);
    const { isDark } = useTheme();
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
        return (localStorage.getItem('surveys_view_mode') as 'grid' | 'list') || 'grid';
    });
    const [showCreate, setShowCreate] = useState(false);
    const [isGuideOpen, setIsGuideOpen] = useState(false);
    const [reportSurvey, setReportSurvey] = useState<Survey | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Survey | null>(null);
    const [previewSurvey, setPreviewSurvey] = useState<Survey | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    useEffect(() => {
        localStorage.setItem('surveys_view_mode', viewMode);
    }, [viewMode]);

    const fetchSurveys = useCallback(async () => {
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;
        setIsLoading(true);
        try {
            const res = await api.get<Survey[]>('surveys?action=list', { signal: controller.signal });
            if (controller.signal.aborted) return;
            if (res.success && Array.isArray(res.data)) {
                setSurveys(res.data);
            }
        } catch (err: any) {
            if (err?.name === 'AbortError' || controller.signal.aborted) return;
            toast.error('Không thể tải danh sách khảo sát');
        } finally {
            if (!controller.signal.aborted) {
                setIsLoading(false);
                setHasLoaded(true);
            }
        }
    }, []);

    useEffect(() => {
        fetchSurveys();
        return () => {
            abortRef.current?.abort();
        };
    }, [fetchSurveys]);

    const handleCreate = async (name: string) => {
        const res = await api.post<{ id: string; slug: string }>('surveys?action=create', { name });
        if (res.success) {
            setShowCreate(false);
            setEditingSurveyId((res.data as any).id);
        } else {
            toast.error('Tạo khảo sát thất bại');
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            await api.delete(`surveys/${deleteTarget.id}?action=delete`);
            setSurveys(prev => prev.filter(s => s.id !== deleteTarget.id));
            toast.success('Đã xoá khảo sát');
        } catch (err) {
            toast.error('Xoá thất bại, vui lòng thử lại');
        } finally {
            setDeleteTarget(null);
        }
    };

    const handleTogglePause = async (survey: Survey) => {
        const action = survey.status === 'active' ? 'pause' : 'publish';
        try {
            const res = await api.post(`surveys/${survey.id}?action=${action}`, {});
            if (res.success) {
                setSurveys(prev => prev.map(s =>
                    s.id === survey.id ? { ...s, status: survey.status === 'active' ? 'paused' : 'active' } : s
                ));
            }
        } catch (err) {
            toast.error('Cập nhật trạng thái thất bại');
        }
    };

    // Real DB-derived stats (Zero mock data — Contract §1 & §3)
    const surveyStats = useMemo(() => {
        const total = surveys.length;
        const active = surveys.filter(s => s.status === 'active').length;
        const paused = surveys.filter(s => s.status === 'paused').length;
        const draft = surveys.filter(s => s.status === 'draft').length;
        const closed = surveys.filter(s => s.status === 'closed').length;
        const totalResponses = surveys.reduce((sum, s) => sum + Number(s.response_count ?? 0), 0);

        const completionItems = surveys.filter(s => typeof s.completion_rate === 'number');
        const avgCompletion = completionItems.length > 0
            ? Math.round(completionItems.reduce((sum, s) => sum + Number(s.completion_rate ?? 0), 0) / completionItems.length)
            : 0;

        const npsItems = surveys.filter(s => typeof s.avg_nps === 'number' && !Number.isNaN(Number(s.avg_nps)));
        const avgNps = npsItems.length > 0
            ? Math.round(npsItems.reduce((sum, s) => sum + Number(s.avg_nps ?? 0), 0) / npsItems.length)
            : null;

        return { total, active, paused, draft, closed, totalResponses, avgCompletion, avgNps };
    }, [surveys]);

    const filtered = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        return surveys.filter(s => {
            const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.slug && s.slug.toLowerCase().includes(q));
            const matchTab = activeTab === 'all' || s.status === activeTab;
            return matchSearch && matchTab;
        });
    }, [surveys, debouncedSearch, activeTab]);

    const statusTabs = useMemo(() => [
        { id: 'all',    label: 'Tất cả',    icon: LayoutGrid,  count: surveyStats.total },
        { id: 'active', label: 'Đang chạy', icon: Ticket,      count: surveyStats.active },
        { id: 'draft',  label: 'Bản nháp',  icon: PenSquare,   count: surveyStats.draft },
        { id: 'paused', label: 'Tạm dừng',  icon: PauseCircle, count: surveyStats.paused },
    ], [surveyStats]);

    const isFiltering = Boolean(debouncedSearch.trim()) || activeTab !== 'all';

    if (editingSurveyId) {
        return (
            <React.Suspense
                fallback={
                    <div className="w-full h-[80vh] flex flex-col bg-slate-100 dark:bg-[#0B0F19] rounded-[20px] border border-[var(--color-border)] overflow-hidden">
                        {/* Top Bar Skeleton */}
                        <div className="h-14 shrink-0 bg-white dark:bg-[#111827] border-b border-slate-200 dark:border-white/[0.07] px-5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                                <div className="w-48 h-5 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[10px]" />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-28 h-8 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                                <div className="w-28 h-8 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                            </div>
                            <div className="flex items-center gap-2.5">
                                <div className="w-24 h-9 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                                <div className="w-28 h-9 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                            </div>
                        </div>
                        {/* 3-Column Editor Workspace Skeleton: 320px Left Toolbox + Center Canvas + 380px Right Properties */}
                        <div className="flex-1 flex overflow-hidden">
                            <div className="w-[320px] shrink-0 bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-white/[0.07] p-4 space-y-3">
                                <div className="w-36 h-4 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[8px]" />
                                <div className="grid grid-cols-2 gap-2.5 pt-1">
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                                        <div key={n} className="h-16 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                                    ))}
                                </div>
                            </div>
                            <div className="flex-1 p-8 overflow-y-auto flex justify-center">
                                <div className="w-full max-w-2xl space-y-4">
                                    <div className="h-44 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                                    <div className="h-32 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                                    <div className="h-32 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                                </div>
                            </div>
                            <div className="w-[380px] shrink-0 bg-white dark:bg-[#111827] border-l border-slate-200 dark:border-white/[0.07] p-5 space-y-4">
                                <div className="w-40 h-5 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[10px]" />
                                <div className="h-10 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                                <div className="h-24 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                                <div className="h-10 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                                <div className="h-32 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                            </div>
                        </div>
                    </div>
                }
            >
                <SurveyEditor
                    surveyIdProp={editingSurveyId}
                    onBack={() => {
                        setEditingSurveyId(null);
                        if (routeParams.id) navigate('/marketing/surveys');
                        fetchSurveys();
                    }}
                />
            </React.Suspense>
        );
    }

    return (
        <div className="w-full flex flex-col gap-5">
            {/* Hero (Contract §1) */}
            <PageHero
                title="Khảo sát & Bài test"
                subtitle="Thu thập phản hồi khách hàng, phân tích mức độ hài lòng và thiết lập dữ liệu (Zero-party Data) cho luồng Automation."
                actions={[
                    { label: 'Hướng dẫn chi tiết', icon: Lightbulb, onClick: () => setIsGuideOpen(true) },
                    { label: 'Tạo khảo sát', icon: Plus, primary: true, onClick: () => setShowCreate(true) },
                ]}
            />

            {/* StatGrid — 4 cards in ONE row on desktop (Contract §1) */}
            <StatGrid cols={4}>
                <StatCard
                    title="Tổng khảo sát"
                    value={surveyStats.total.toLocaleString('vi-VN')}
                    icon={<LayoutGrid />}
                    color="#6366f1"
                    loading={!hasLoaded}
                    breakdown={
                        <>
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Đang chạy: {surveyStats.active}</span>
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-slate-400" />Bản nháp: {surveyStats.draft}</span>
                        </>
                    }
                />
                <StatCard
                    title="Đang chạy"
                    value={surveyStats.active.toLocaleString('vi-VN')}
                    icon={<Ticket />}
                    color="#10b981"
                    loading={!hasLoaded}
                    breakdown={
                        <>
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Tạm dừng: {surveyStats.paused}</span>
                            <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />Đã đóng: {surveyStats.closed}</span>
                        </>
                    }
                />
                <StatCard
                    title="Lượt trả lời"
                    value={surveyStats.totalResponses.toLocaleString('vi-VN')}
                    icon={<Users />}
                    color="#3b82f6"
                    loading={!hasLoaded}
                    breakdown={
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Hoàn thành TB: {surveyStats.avgCompletion}%
                        </span>
                    }
                />
                <StatCard
                    title="Điểm NPS TB"
                    value={surveyStats.avgNps !== null ? (surveyStats.avgNps > 0 ? `+${surveyStats.avgNps}` : String(surveyStats.avgNps)) : '—'}
                    icon={<Star />}
                    color="#f59e0b"
                    loading={!hasLoaded}
                    breakdown={
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Trên khảo sát có NPS
                        </span>
                    }
                />
            </StatGrid>

            {/* Main Panel with 1-row Toolbar (Contract §1) */}
            <Panel
                header={
                    <Toolbar
                        left={
                            <Tabs
                                variant="segmented"
                                size="sm"
                                activeId={activeTab}
                                onChange={setActiveTab}
                                className="flex-nowrap overflow-x-auto scrollbar-hide"
                                items={statusTabs}
                            />
                        }
                        right={
                            <>
                                <SearchBox
                                    value={search}
                                    onChange={setSearch}
                                    onDebouncedChange={setDebouncedSearch}
                                    debounceMs={300}
                                    placeholder="Tìm khảo sát..."
                                    className="w-56"
                                />
                                <div className="h-9 flex items-center p-0.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]">
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('grid')}
                                        className={`h-full px-2 rounded-[var(--radius-sm)] transition-colors ${viewMode === 'grid' ? 'bg-[var(--color-surface)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                                        title="Chế độ lưới"
                                        aria-pressed={viewMode === 'grid'}
                                    >
                                        <LayoutGrid className="w-4 h-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setViewMode('list')}
                                        className={`h-full px-2 rounded-[var(--radius-sm)] transition-colors ${viewMode === 'list' ? 'bg-[var(--color-surface)] shadow-sm text-[var(--color-primary)]' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'}`}
                                        title="Chế độ danh sách"
                                        aria-pressed={viewMode === 'list'}
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                </div>
                            </>
                        }
                    />
                }
                footer={
                    hasLoaded && filtered.length > 0 ? (
                        <div className="text-xs text-[var(--color-text-muted)]">
                            Hiển thị {filtered.length.toLocaleString('vi-VN')} khảo sát
                        </div>
                    ) : undefined
                }
            >
                <div className="relative">
                    {isLoading && hasLoaded && (
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-[var(--color-primary-light)] overflow-hidden z-10">
                            <div className="h-full w-1/3 bg-[var(--color-primary)] animate-pulse" />
                        </div>
                    )}

                    {!hasLoaded ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div className="flex items-center gap-3">
                                            <div className="w-11 h-11 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[14px]" />
                                            <div className="space-y-2">
                                                <div className="w-40 h-4 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[8px]" />
                                                <div className="w-24 h-3 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[6px]" />
                                            </div>
                                        </div>
                                        <div className="w-16 h-6 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-full" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2.5 pt-1">
                                        <div className="h-14 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[14px]" />
                                        <div className="h-14 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[14px]" />
                                        <div className="h-14 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[14px]" />
                                    </div>
                                    <div className="flex items-center gap-2 pt-1">
                                        <div className="h-9 flex-1 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                                        <div className="h-9 flex-[1.4] animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                            <FileText className="w-10 h-10 text-[var(--color-text-muted)] opacity-60 mb-3" strokeWidth={1.5} />
                            <p className="text-sm font-semibold text-[var(--color-text)]">
                                {isFiltering ? 'Không tìm thấy khảo sát phù hợp' : 'Chưa có khảo sát nào'}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1 max-w-sm">
                                {isFiltering
                                    ? 'Thử thay đổi bộ lọc trạng thái hoặc từ khoá tìm kiếm.'
                                    : 'Tạo khảo sát hoặc bài test đầu tiên để thu thập phản hồi và làm giàu hồ sơ khách hàng.'}
                            </p>
                            {isFiltering ? (
                                <button
                                    type="button"
                                    onClick={() => { setActiveTab('all'); setSearch(''); setDebouncedSearch(''); }}
                                    className="mt-4 h-9 px-4 text-[13px] font-semibold rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90"
                                >
                                    Xoá bộ lọc
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => setShowCreate(true)}
                                    className="mt-4 h-9 px-4 inline-flex items-center gap-1.5 text-[13px] font-semibold rounded-[var(--radius-md)] bg-[var(--color-primary)] text-white hover:opacity-90"
                                >
                                    <Plus className="w-4 h-4" />
                                    Tạo khảo sát ngay
                                </button>
                            )}
                        </div>
                    ) : viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4 auto-rows-fr">
                            {filtered.map(survey => (
                                <SurveyCard
                                    key={survey.id}
                                    survey={survey}
                                    viewMode="grid"
                                    onEdit={() => setEditingSurveyId(survey.id)}
                                    onAnalytics={() => setReportSurvey(survey)}
                                    onDelete={() => setDeleteTarget(survey)}
                                    onTogglePause={() => handleTogglePause(survey)}
                                    onSlugClick={() => setPreviewSurvey(survey)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 z-[1] bg-[var(--color-bg)] text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                                    <tr className="border-b border-[var(--color-border)]">
                                        <th className="px-4 py-3 text-left">Khảo sát</th>
                                        <th className="px-4 py-3 text-left">Trạng thái</th>
                                        <th className="px-4 py-3 text-left">Đường dẫn</th>
                                        <th className="px-4 py-3 text-right">Lượt trả lời</th>
                                        <th className="px-4 py-3 text-right">NPS</th>
                                        <th className="px-4 py-3 text-right">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(survey => (
                                        <SurveyCard
                                            key={survey.id}
                                            survey={survey}
                                            viewMode="list"
                                            onEdit={() => setEditingSurveyId(survey.id)}
                                            onAnalytics={() => setReportSurvey(survey)}
                                            onDelete={() => setDeleteTarget(survey)}
                                            onTogglePause={() => handleTogglePause(survey)}
                                            onSlugClick={() => setPreviewSurvey(survey)}
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </Panel>

            {/* Modals gated so lazy chunks only load when opened */}
            <React.Suspense fallback={null}>
                {showCreate && (
                    <CreateSurveyModal
                        isOpen={showCreate}
                        onClose={() => setShowCreate(false)}
                        onCreate={handleCreate}
                        isDark={isDark}
                    />
                )}

                {reportSurvey && (
                    <SurveyReportModal
                        survey={reportSurvey}
                        isOpen={!!reportSurvey}
                        onClose={() => setReportSurvey(null)}
                    />
                )}

                {deleteTarget && (
                    <ConfirmDeleteModal
                        survey={deleteTarget}
                        onConfirm={handleDeleteConfirm}
                        onCancel={() => setDeleteTarget(null)}
                        isDark={isDark}
                    />
                )}

                {previewSurvey && (
                    <SurveyPreviewModal
                        survey={previewSurvey}
                        onClose={() => setPreviewSurvey(null)}
                        onEdit={() => { setEditingSurveyId(previewSurvey.id); setPreviewSurvey(null); }}
                        isDark={isDark}
                    />
                )}

                {isGuideOpen && (
                    <SurveyGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
                )}
            </React.Suspense>
        </div>
    );
};

export default Surveys;
