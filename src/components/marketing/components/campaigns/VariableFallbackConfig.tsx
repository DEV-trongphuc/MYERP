import React, { useMemo, useRef, useState } from 'react';
import { Sliders, Image as ImageIcon, Link as LinkIcon, FileText, Upload, Check, RefreshCw } from 'lucide-react';
import { extractTemplateVariables, canonicalizeVarKey } from '../../utils/formatters';
import { BUILT_IN_BASIC_MERGE_TAG_KEYS, MYERP_MERGE_TAG_LABELS } from '../../constants/mergeTags';
import toast from 'react-hot-toast';

interface VariableFallbackConfigProps {
    htmlContent: string;
    fallbacks: Record<string, string>;
    onChange: (newFallbacks: Record<string, string>) => void;
    className?: string;
}

const BUILT_IN_BASIC_CANONICAL = new Set(
    Array.from(BUILT_IN_BASIC_MERGE_TAG_KEYS).map((k) => canonicalizeVarKey(k))
);

export const VariableFallbackConfig: React.FC<VariableFallbackConfigProps> = ({
    htmlContent,
    fallbacks = {},
    onChange,
    className = ''
}) => {
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const [uploadingTag, setUploadingTag] = useState<string | null>(null);

    const extracted = useMemo(() => {
        return extractTemplateVariables(htmlContent || '');
    }, [htmlContent]);

    // Filter down to meaningful dynamic / CRM / custom tags
    const relevantVars = useMemo(() => {
        const imageVars = extracted.imageVars;
        const linkVars = extracted.linkVars.filter(v => !imageVars.includes(v));
        const textVars = extracted.textVars.filter(v => {
            const canon = canonicalizeVarKey(v);
            return !BUILT_IN_BASIC_CANONICAL.has(canon) && !imageVars.includes(v) && !linkVars.includes(v);
        });

        return {
            imageVars,
            linkVars,
            textVars,
            totalCount: imageVars.length + linkVars.length + textVars.length
        };
    }, [extracted]);

    if (relevantVars.totalCount === 0) {
        return null;
    }

    const handleValueChange = (tag: string, value: string) => {
        onChange({
            ...fallbacks,
            [tag]: value
        });
    };

    const handleImageUpload = (tag: string, e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            toast.error('Vui lòng chọn tệp hình ảnh (.png, .jpg, .jpeg, .webp, .svg)');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error('Kích thước ảnh vượt quá 5MB. Vui lòng chọn ảnh nhẹ hơn.');
            return;
        }

        setUploadingTag(tag);
        const reader = new FileReader();
        reader.onload = (event) => {
            const base64Url = event.target?.result as string;
            handleValueChange(tag, base64Url);
            setUploadingTag(null);
            toast.success(`Đã tải ảnh dự phòng cho {{${tag}}}`);
        };
        reader.onerror = () => {
            toast.error('Lỗi khi đọc file ảnh');
            setUploadingTag(null);
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className={`bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 rounded-[18px] border border-slate-200 dark:border-slate-800 shadow-sm p-4 sm:p-5 space-y-4 ${className}`}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[14px] bg-rose-50 dark:bg-rose-950/60 text-[var(--color-primary)] flex items-center justify-center shadow-xs">
                        <Sliders className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-slate-200">
                                Cấu hình Giá trị Dự phòng & Fallback Biến động CRM
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-[var(--color-primary)] border border-rose-200">
                                {relevantVars.totalCount} biến phát hiện
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Tự động điền giá trị chuẩn khi liên hệ chưa có sẵn trường dữ liệu CRM tương ứng (chương trình, tư vấn viên, đặt cọc, chứng nhận...).
                        </p>
                    </div>
                </div>
            </div>

            {/* Variable Items Grid */}
            <div className="space-y-3.5">
                {/* 1. Image Variables */}
                {relevantVars.imageVars.map((tag) => {
                    const val = fallbacks[tag] || '';
                    const humanLabel = MYERP_MERGE_TAG_LABELS[tag] || MYERP_MERGE_TAG_LABELS[tag.toLowerCase()] || 'Ảnh trong src / banner';
                    return (
                        <div key={tag} className="bg-white dark:bg-slate-900/80 rounded-[14px] p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="p-1 rounded-md bg-rose-50 text-[var(--color-primary)] dark:bg-rose-950/50">
                                        <ImageIcon className="w-3.5 h-3.5" />
                                    </span>
                                    <code className="text-xs font-mono font-bold text-[var(--color-primary)] bg-rose-50/60 dark:bg-rose-950/30 px-2 py-0.5 rounded border border-rose-200/60">
                                        {`{{${tag}}}`}
                                    </code>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{humanLabel}</span>
                                </div>
                                {val && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                        <Check className="w-3 h-3" /> Đã đặt fallback
                                    </span>
                                )}
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                {/* Thumbnail preview */}
                                <div className="w-14 h-14 rounded-[14px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                                    {val ? (
                                        <img src={val} alt="Fallback Preview" className="w-full h-full object-cover" />
                                    ) : (
                                        <ImageIcon className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                                    )}
                                </div>

                                <div className="flex-1 space-y-1">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={val}
                                            onChange={(e) => handleValueChange(tag, e.target.value)}
                                            placeholder="Nhập URL ảnh dự phòng (https://...)"
                                            className="flex-1 px-3 py-2 text-xs rounded-[var(--radius-md)] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all"
                                        />
                                        <input
                                            ref={(el) => {
                                                if (el) {
                                                    fileInputRefs.current[tag] = el;
                                                }
                                            }}
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => handleImageUpload(tag, e)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => fileInputRefs.current[tag]?.click()}
                                            disabled={uploadingTag === tag}
                                            className="px-3 py-2 rounded-[var(--radius-md)] text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-[var(--color-primary)] hover:bg-rose-100 border border-rose-200 dark:border-rose-800 flex items-center gap-1.5 shrink-0 transition-colors shadow-xs"
                                        >
                                            {uploadingTag === tag ? (
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Upload className="w-3.5 h-3.5" />
                                            )}
                                            <span>Tải ảnh</span>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 italic">
                                        💡 Nếu liên hệ chưa có ảnh trong tệp dữ liệu, ảnh này sẽ tự động thay thế để không bị lỗi icon vỡ.
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* 2. Link / Button Variables */}
                {relevantVars.linkVars.map((tag) => {
                    const val = fallbacks[tag] || '';
                    const humanLabel = MYERP_MERGE_TAG_LABELS[tag] || MYERP_MERGE_TAG_LABELS[tag.toLowerCase()] || 'Link href / Nút bấm';
                    return (
                        <div key={tag} className="bg-white dark:bg-slate-900/80 rounded-[14px] p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="p-1 rounded-md bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                                        <LinkIcon className="w-3.5 h-3.5" />
                                    </span>
                                    <code className="text-xs font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50/60 dark:bg-blue-950/30 px-2 py-0.5 rounded border border-blue-200/60 dark:border-blue-900/40">
                                        {`{{${tag}}}`}
                                    </code>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{humanLabel}</span>
                                </div>
                                {val && (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                                        <Check className="w-3 h-3" /> Đã đặt link fallback
                                    </span>
                                )}
                            </div>

                            <div>
                                <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleValueChange(tag, e.target.value)}
                                    placeholder="VD: https://ideas.edu.vn/tra-cuu hoặc #"
                                    className="w-full px-3 py-2 text-xs rounded-[var(--radius-md)] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all"
                                />
                                <p className="text-[10px] text-slate-400 italic mt-1">
                                    💡 Nút bấm hoặc thẻ link gắn biến này sẽ chuyển hướng đến link trên nếu liên hệ chưa có URL riêng trong file.
                                </p>
                            </div>
                        </div>
                    );
                })}

                {/* 3. Custom & CRM Text Variables */}
                {relevantVars.textVars.map((tag) => {
                    const val = fallbacks[tag] || '';
                    const humanLabel = MYERP_MERGE_TAG_LABELS[tag] || MYERP_MERGE_TAG_LABELS[tag.toLowerCase()] || 'Trường dữ liệu CRM / Tùy biến';
                    return (
                        <div key={tag} className="bg-white dark:bg-slate-900/80 rounded-[14px] p-3.5 border border-slate-200/80 dark:border-slate-800 shadow-xs space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="p-1 rounded-md bg-rose-50 text-[var(--color-primary)]">
                                        <FileText className="w-3.5 h-3.5" />
                                    </span>
                                    <code className="text-xs font-mono font-bold text-[var(--color-primary)] bg-rose-50/60 px-2 py-0.5 rounded border border-rose-200/60">
                                        {`{{${tag}}}`}
                                    </code>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{humanLabel}</span>
                                </div>
                            </div>

                            <div>
                                <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleValueChange(tag, e.target.value)}
                                    placeholder={`Giá trị dự phòng cho ${humanLabel} (VD: Chương trình Quốc tế IDEAS...)`}
                                    className="w-full px-3 py-2 text-xs rounded-[var(--radius-md)] bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200 focus:outline-none focus:border-[var(--color-primary)] transition-all"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default VariableFallbackConfig;
