// components/templates/EmailEditor/components/EmailValidationPanel.tsx
import React from 'react';
import { ShieldCheck, AlertTriangle, Image, MousePointer2, CheckCircle2, X, ChevronRight, Wand2, Link2, MailX } from 'lucide-react';

export interface ValidationIssue {
    blockId: string;
    type: 'spam_words' | 'button_no_link' | 'image_no_link' | 'image_no_alt' | 'duplicate_link' | 'missing_unsubscribe' | 'wrong_unsubscribe_url' | 'missing_fallback_url' | 'missing_fallback_image';
    label: string;
    preview?: string;
    // For duplicate_link: the group of blockIds sharing the same URL
    duplicateGroupIds?: string[];
    currentUrl?: string;
    // For wrong_unsubscribe_url: the href that was detected
    badHref?: string;
    // For spam_words: list of detected words
    spamWords?: string[];
}

interface EmailValidationPanelProps {
    issues: ValidationIssue[];
    onClose: () => void;
    onFocusBlock: (blockId: string) => void;
    onRerun: () => void;
    onAutoFixDuplicates?: (groupIds: string[], baseUrl: string) => void;
    onAutoFixUnsubscribe?: (blockId: string, badHref?: string) => void;
}

const ISSUE_META: Record<ValidationIssue['type'], { icon: React.ElementType; color: string; bg: string; border: string; title: string }> = {
    missing_fallback_url: {
        icon: AlertTriangle,
        color: 'text-rose-600',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        title: 'Thiếu link dự phòng (Bắt buộc)',
    },
    missing_fallback_image: {
        icon: Image,
        color: 'text-rose-600',
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        title: 'Thiếu ảnh dự phòng (Bắt buộc)',
    },
    // [NEW] Spam words detection
    spam_words: {
        icon: AlertTriangle,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        title: 'Từ khóa dễ vào Spam',
    },
    // [NEW] Critical: email has no unsubscribe link at all
    missing_unsubscribe: {
        icon: MailX,
        color: 'text-red-700',
        bg: 'bg-red-50',
        border: 'border-red-200',
        title: 'Thiếu link hủy đăng ký',
    },
    // [NEW] Warning: text says "Unsubscribe" but href is wrong
    wrong_unsubscribe_url: {
        icon: AlertTriangle,
        color: 'text-orange-700',
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        title: 'Link Unsubscribe gắn sai URL',
    },
    button_no_link: {
        icon: MousePointer2,
        color: 'text-rose-600',
        bg: 'bg-rose-50',
        border: 'border-rose-100',
        title: 'Nút chưa gắn link',
    },
    image_no_link: {
        icon: Image,
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        border: 'border-amber-100',
        title: 'Ảnh chưa gắn link',
    },
    image_no_alt: {
        icon: AlertTriangle,
        color: 'text-orange-600',
        bg: 'bg-orange-50',
        border: 'border-orange-100',
        title: 'Ảnh thiếu mô tả ALT',
    },
    duplicate_link: {
        icon: Link2,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        border: 'border-blue-100',
        title: 'Link trùng lặp',
    },
};

const EmailValidationPanel: React.FC<EmailValidationPanelProps> = ({
    issues, onClose, onFocusBlock, onRerun, onAutoFixDuplicates, onAutoFixUnsubscribe
}) => {
    // For duplicate_link: only show one issue per group (the "representative" one is the first in group)
    const deduplicatedIssues = React.useMemo(() => {
        const seenGroupUrls = new Set<string>();
        return issues.filter(issue => {
            // Exclude missing_unsubscribe from being grouped below since it has its own prominent red banner
            if (issue.type === 'missing_unsubscribe') return false;
            
            if (issue.type !== 'duplicate_link') return true;
            const key = issue.currentUrl || issue.blockId;
            if (seenGroupUrls.has(key)) return false;
            seenGroupUrls.add(key);
            return true;
        });
    }, [issues]);

    const grouped = (Object.keys(ISSUE_META) as ValidationIssue['type'][]).map(type => ({
        type,
        meta: ISSUE_META[type],
        items: deduplicatedIssues.filter(i => i.type === type),
    })).filter(g => g.items.length > 0);

    const totalDisplayed = deduplicatedIssues.length;

    return (
        <div className="w-80 shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-lg animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm shadow-amber-300">
                        <ShieldCheck className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-slate-800">Kiểm duyệt email</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                            {totalDisplayed === 0 ? 'Không có vấn đề' : `${totalDisplayed} vấn đề cần xem lại`}
                        </p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {totalDisplayed === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4 shadow-sm">
                            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                        </div>
                        <p className="text-sm font-bold text-slate-700 mb-1">Email đã sẵn sàng! 🎉</p>
                        <p className="text-xs text-slate-400 leading-relaxed">
                            Tất cả nút bấm, hình ảnh đã có link/mô tả đầy đủ và link hủy đăng ký hợp lệ.
                        </p>
                    </div>
                ) : (
                    <div className="p-4 space-y-4">
                        {/* [NEW] Critical: missing unsubscribe — shown prominently at top */}
                        {issues.some(i => i.type === 'missing_unsubscribe') && (
                            <div className="p-3 bg-red-100 border-2 border-red-300 rounded-xl flex items-start gap-3">
                                <MailX className="w-5 h-5 text-red-700 mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs text-red-800 font-bold leading-snug">
                                        Email chưa có link hủy đăng ký (Unsubscribe)! Bắt buộc phải có để tránh bị đánh dấu Spam.
                                        <br /><span className="font-normal opacity-80">Thêm Footer block hoặc dùng merge tag <code className="bg-red-200 px-1 rounded">{'{{'+'unsubscribe_url'+'}}' }</code> trong bất kỳ text block nào.</span>
                                    </p>
                                    {/* Quick-fix: nếu có block chứa chữ Unsubscribe chưa gắn href */}
                                    {onAutoFixUnsubscribe && (() => {
                                        const candidate = issues.find(i => i.type === 'wrong_unsubscribe_url');
                                        if (candidate) return null; // đã có wrong_url, sẽ hiện nút ở issue riêng
                                        const missingIssue = issues.find(i => i.type === 'missing_unsubscribe');
                                        if (!missingIssue) return null;
                                        return (
                                            <button
                                                onClick={() => onAutoFixUnsubscribe(missingIssue.blockId)}
                                                className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-800 text-white text-[10px] font-bold transition-colors shadow-sm"
                                            >
                                                <Wand2 className="w-3 h-3" /> Tự động gán link
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Summary banner */}
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-rose-700 font-medium leading-snug">
                                Tìm thấy <span className="font-black">{totalDisplayed} vấn đề</span>. Click vào từng mục để nhảy đến block cần sửa.
                                {issues.some(i => i.type === 'duplicate_link') && (
                                    <> Dùng nút <span className="font-black">Tự động fix</span> để sửa link trùng nhanh.</>
                                )}
                            </p>
                        </div>

                        {/* Grouped issues */}
                        {grouped.map(group => {
                            const Icon = group.meta.icon;
                            return (
                                <div key={group.type}>
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl mb-2 ${group.meta.bg} border ${group.meta.border}`}>
                                        <Icon className={`w-3.5 h-3.5 ${group.meta.color} shrink-0`} />
                                        <p className={`text-[11px] font-black uppercase tracking-wide ${group.meta.color} flex-1`}>
                                            {group.meta.title}
                                            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-white/70 text-[10px]">
                                                {group.items.length}
                                            </span>
                                        </p>
                                        {/* Auto-fix ALL button for duplicate_link group */}
                                        {group.type === 'duplicate_link' && onAutoFixDuplicates && group.items.length > 0 && (
                                            <button
                                                onClick={() => {
                                                    group.items.forEach(issue => {
                                                        if (issue.duplicateGroupIds && issue.currentUrl) {
                                                            onAutoFixDuplicates(issue.duplicateGroupIds, issue.currentUrl);
                                                        }
                                                    });
                                                }}
                                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-[9px] font-bold transition-colors shadow-sm shrink-0"
                                                title="Tự động gắn tracking cho tất cả link trùng"
                                            >
                                                <Wand2 className="w-3 h-3" />
                                                Fix all
                                            </button>
                                        )}
                                    </div>
                                    <div className="space-y-1.5 pl-1">
                                        {group.items.map((issue, idx) => (
                                            <div
                                                key={issue.blockId + idx}
                                                className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm"
                                            >
                                                <button
                                                    onClick={() => onFocusBlock(issue.blockId)}
                                                    className="w-full text-left flex items-center gap-3 group"
                                                >
                                                    <div className={`w-7 h-7 rounded-lg ${group.meta.bg} flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform`}>
                                                        <Icon className={`w-3.5 h-3.5 ${group.meta.color}`} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-semibold text-slate-700 truncate">{issue.label}</p>
                                                        {issue.preview && (
                                                            <p className="text-[10px] text-slate-400 truncate mt-0.5 font-medium">"{issue.preview}"</p>
                                                        )}
                                                        {issue.type === 'duplicate_link' && issue.currentUrl && (
                                                            <p className="text-[9px] text-blue-500 truncate mt-0.5 font-mono">{issue.currentUrl}</p>
                                                        )}
                                                    </div>
                                                    <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-amber-600 transition-colors shrink-0" />
                                                </button>

                                                {/* Auto-fix button for individual duplicate group */}
                                                {issue.type === 'duplicate_link' && issue.duplicateGroupIds && issue.currentUrl && onAutoFixDuplicates && (
                                                    <button
                                                        onClick={() => {
                                                            onAutoFixDuplicates(issue.duplicateGroupIds!, issue.currentUrl!);
                                                        }}
                                                        className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 text-[10px] font-bold transition-colors"
                                                    >
                                                        <Wand2 className="w-3 h-3" />
                                                        Gắn tracking tự động ({issue.duplicateGroupIds.length} link)
                                                    </button>
                                                )}

                                                {/* Quick-fix for wrong_unsubscribe_url */}
                                                {issue.type === 'wrong_unsubscribe_url' && onAutoFixUnsubscribe && (
                                                    <button
                                                        onClick={() => onAutoFixUnsubscribe(issue.blockId, issue.badHref)}
                                                        className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 text-[10px] font-bold transition-colors"
                                                    >
                                                        <Wand2 className="w-3 h-3" />
                                                        Fix nhanh — gắn {'{{unsubscribe_url}}'}
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-slate-100 shrink-0">
                <button
                    onClick={onRerun}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Kiểm tra lại
                </button>
            </div>
        </div>
    );
};

export default EmailValidationPanel;

// Dual value declarations for verbatimModuleSyntax compatibility
export const ValidationIssue: any = undefined;
