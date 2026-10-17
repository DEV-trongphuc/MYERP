import React, { useRef, useState } from 'react';
import { useDrag, useDrop } from '../../../shims/reactDnd';
import { Survey, SurveyBlock, SurveyTheme, QuestionType } from '../../../types/survey';
import * as LucideIcons from 'lucide-react';
import {
    GripVertical, Trash2, Copy, Star, ChevronDown, ExternalLink,
    ArrowUp, ArrowDown, Plus
} from 'lucide-react';

const BLOCK_DND = 'SURVEY_BLOCK';

interface Props {
    survey: Survey;
    block: SurveyBlock;
    index: number;
    theme: SurveyTheme;
    isSelected: boolean;
    onSelect: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onMove: (dragIdx: number, hoverIdx: number) => void;
    onAddAfter: (type: QuestionType) => void;
    onUpdate: (changes: Partial<SurveyBlock>) => void;
    totalBlocks: number;
}

const SurveyCanvasBlock: React.FC<Props> = ({
    survey, block, index, theme, isSelected, onSelect, onDelete, onDuplicate, onMove, onUpdate, totalBlocks
}) => {
    const ref = useRef<HTMLDivElement>(null);

    const [{ handlerId }, drop] = useDrop({
        accept: BLOCK_DND,
        collect: monitor => ({ handlerId: monitor.getHandlerId() }),
        hover(item: { index: number; lastSwap?: number }, monitor) {
            if (!ref.current || item.index === index) return;
            
            // Prevent rapid reordering swaps that cause layout flicker
            const now = Date.now();
            if (item.lastSwap && now - item.lastSwap < 200) {
                return;
            }

            const hoverBoundingRect = ref.current.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            if (!clientOffset) return;
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;
            if (item.index < index && hoverClientY < hoverMiddleY) return;
            if (item.index > index && hoverClientY > hoverMiddleY) return;
            
            onMove(item.index, index);
            item.index = index;
            item.lastSwap = now;
        },
        drop(item: { index: number }) {
            if (item && typeof item.index === 'number' && item.index !== index) {
                onMove(item.index, index);
                item.index = index;
            }
        },
    });

    const [{ isDragging }, drag, dragPreview] = useDrag({
        type: BLOCK_DND,
        item: () => ({ id: block.id, index }),
        collect: monitor => ({ isDragging: monitor.isDragging() }),
    });

    dragPreview(drop(ref));

    const accentColor = block.style?.accentColor || theme.primaryColor || '#BD1D2D';
    const bgColor = block.style?.backgroundColor || theme.cardBackground || '#ffffff';
    const textColor = block.style?.textColor || theme.textColor || '#1e293b';
    const textAlign = block.style?.textAlign || 'left';
    const boxShadow = block.style?.boxShadow && block.style.boxShadow !== 'none' 
        ? block.style.boxShadow 
        : (theme.cardShadow && theme.cardShadow !== 'none' ? theme.cardShadow : undefined);

    const NON_QUESTION_TYPES = ['section_header', 'image_block', 'divider', 'page_break', 'button_block', 'link_block', 'banner_block', 'video', 'text_block'];
    const isLayout = NON_QUESTION_TYPES.includes(block.type);
    const isQuestion = !isLayout;
    const questionNumber = isQuestion
        ? survey.blocks.slice(0, index + 1).filter(b => !NON_QUESTION_TYPES.includes(b.type)).length
        : null;

    return (
        <div
            ref={ref}
            id={`block-${block.id}`}
            data-handler-id={handlerId}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            className={`group relative rounded-2xl border-2 transition-all duration-150 cursor-pointer
                ${isDragging 
                    ? 'opacity-40 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)]/20 scale-[0.98]' 
                    : isSelected
                        ? 'border-[var(--color-primary)] ring-4 ring-[var(--color-primary)]/20 shadow-sm'
                        : 'border-transparent hover:border-slate-200'
                }`}
            style={{ background: block.type === 'page_break' ? 'transparent' : bgColor, boxShadow: block.type === 'page_break' ? 'none' : boxShadow }}
        >
            {/* ── Hover/selected action toolbar (top-right) ─────────────────── */}
            <div className={`absolute -top-3.5 right-3 flex items-center gap-0.5 bg-white border border-slate-200 rounded-xl shadow-md px-1 py-0.5 z-20 transition-all
                ${isSelected || isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>

                {/* Move up */}
                {index > 0 && (
                    <button
                        onClick={e => { e.stopPropagation(); onMove(index, index - 1); }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                        title="Di chuyển lên"
                    >
                        <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                )}
                {/* Move down */}
                {index < totalBlocks - 1 && (
                    <button
                        onClick={e => { e.stopPropagation(); onMove(index, index + 1); }}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                        title="Di chuyển xuống"
                    >
                        <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                )}

                {(index > 0 || index < totalBlocks - 1) && <div className="w-px h-3.5 bg-slate-100 mx-0.5" />}

                {/* Drag handle */}
                <div
                    ref={drag as any}
                    className="p-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors select-none"
                    title="Kéo để di chuyển"
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                >
                    <GripVertical className="w-3.5 h-3.5" />
                </div>

                <div className="w-px h-3.5 bg-slate-100 mx-0.5" />

                {/* Duplicate */}
                <button
                    onClick={e => { e.stopPropagation(); onDuplicate(); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors"
                    title="Nhân đôi"
                >
                    <Copy className="w-3.5 h-3.5" />
                </button>

                {/* Delete */}
                <button
                    onClick={e => { e.stopPropagation(); onDelete(); }}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Xoá"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* ── Logic Indicator (when not selected but has config) ── */}
            {(!isSelected && (block.logic ?? []).length > 0) && (
                <div className="absolute top-3 right-3 flex items-center gap-1 bg-amber-50 text-amber-500 border border-amber-200/50 shadow-sm px-1.5 py-1 rounded-lg z-10 transition-opacity group-hover:opacity-0 pointer-events-none" title="Câu hỏi này có logic rẽ nhánh">
                    <LucideIcons.GitMerge className="w-3.5 h-3.5" />
                </div>
            )}

            <div className="px-6 py-4" style={{ textAlign }}>
                {/* Question number */}
                {isQuestion && questionNumber !== null && (
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">Câu {questionNumber}</span>
                        {block.required && <span className="text-[9px] font-bold bg-red-50 text-red-400 px-1.5 py-0.5 rounded-full uppercase">Bắt buộc</span>}
                        {block.allowOther && <span className="text-[9px] font-bold bg-blue-50 text-blue-400 px-1.5 py-0.5 rounded-full">Khác</span>}
                    </div>
                )}

                {/* ── Block type renderers ─────────────────────────────────────── */}
                {block.type === 'section_header' ? (
                    <div className="font-bold text-lg leading-snug" style={{ color: textColor }}>{block.label}</div>

                ) : block.type === 'divider' ? (
                    <hr className="border-slate-200" />

                ) : block.type === 'page_break' ? (
                    <div className="flex items-center gap-3 py-1">
                        <div className="flex-1 h-px bg-amber-200" />
                        <span className="text-xs font-semibold text-amber-500 px-3 py-1 bg-amber-50 rounded-full border border-amber-200">Chuyển trang</span>
                        <div className="flex-1 h-px bg-amber-200" />
                    </div>

                ) : block.type === 'image_block' ? (
                    <div className="flex justify-center" style={{ justifyContent: block.imageAlign === 'right' ? 'flex-end' : block.imageAlign === 'left' ? 'flex-start' : 'center' }}>
                        {block.imageUrl ? (
                            <img src={block.imageUrl} alt={block.imageAlt} style={{ width: block.imageWidth ?? '100%' }} className="rounded-xl object-cover max-h-48" />
                        ) : (
                            <div className="w-full h-32 bg-slate-100 rounded-xl flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200">
                                <LucideIcons.Image className="w-8 h-8 text-slate-300" />
                                <span className="text-xs text-slate-400">Chưa có ảnh</span>
                            </div>
                        )}
                    </div>

                ) : block.type === 'button_block' ? (
                    <div className="py-1" style={{ textAlign: block.buttonAlign ?? 'center' }}>
                        <ButtonPreview block={block} accentColor={accentColor} />
                    </div>

                ) : block.type === 'link_block' ? (
                    <div className="py-1" style={{ textAlign: block.linkAlign ?? 'left' }}>
                        <a className="inline-flex items-center gap-1.5 text-sm font-semibold underline underline-offset-2" style={{ color: accentColor }}>
                            <ExternalLink className="w-3.5 h-3.5" />
                            {block.linkText || 'Xem thêm'}
                        </a>
                    </div>

                ) : block.type === 'banner_block' ? (
                    <BannerPreview block={block} />

                ) : (
                    <>
                        <p className="font-semibold text-sm mb-2.5" style={{ color: textColor }}>
                            {block.label}
                            {block.required && <span style={{ color: accentColor }} className="ml-1">*</span>}
                        </p>
                        {block.description && <p className="text-xs text-slate-400 mb-3">{block.description}</p>}
                        <BlockInputPreview block={block} theme={theme} accentColor={accentColor} />
                    </>
                )}

                {/* ── Logic Branching config inline ──────────────────────────── */}
                {isSelected && !isLayout && (
                    <div className="mt-8 pt-4 border-t border-slate-100 animate-in fade-in slide-in-from-top-2 duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Logic rẽ nhánh (Điều kiện & Hành động)</span>
                            <button
                                onClick={() => onUpdate({ logic: [...(block.logic ?? []), { condition: { question_id: block.id, operator: 'equals', value: '' }, action: 'skip_to', target: '' }] })}
                                className="flex items-center gap-1 text-[10px] text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-lg transition-colors font-bold"
                            >
                                <Plus className="w-3 h-3" /> Thêm luật logic
                            </button>
                        </div>
                        
                        <div className="space-y-2">
                            {(block.logic ?? []).map((rule, idx) => (
                                <div key={idx} className="bg-white border border-amber-200/60 shadow-sm p-3 rounded-xl flex flex-wrap gap-2 items-center relative group">
                                    <button
                                        onClick={() => onUpdate({ logic: block.logic?.filter((_, i) => i !== idx) })}
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-100 text-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                    
                                    <span className="text-[10px] font-bold text-slate-400">NẾU</span>
                                    
                                    <select
                                        className="text-[11px] font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[var(--color-primary)]"
                                        value={rule.condition.operator}
                                        onChange={e => {
                                            const newLogic = [...(block.logic ?? [])];
                                            newLogic[idx].condition.operator = e.target.value as any;
                                            onUpdate({ logic: newLogic });
                                        }}
                                    >
                                        {['single_choice', 'dropdown', 'yes_no'].includes(block.type) ? (
                                            <>
                                                <option value="equals">Là (Chọn)</option>
                                                <option value="not_equals">Không phải (Không chọn)</option>
                                                <option value="is_answered">Đã trả lời</option>
                                                <option value="is_empty">Bỏ trống</option>
                                            </>
                                        ) : block.type === 'multi_choice' ? (
                                            <>
                                                <option value="contains">Bao gồm lựa chọn</option>
                                                <option value="is_answered">Đã trả lời</option>
                                                <option value="is_empty">Bỏ trống</option>
                                            </>
                                        ) : ['number', 'slider', 'star_rating', 'nps', 'likert', 'emoji_rating'].includes(block.type) ? (
                                            <>
                                                <option value="equals">Bằng (==)</option>
                                                <option value="not_equals">Khác (!=)</option>
                                                <option value="greater_than">Lớn hơn (&gt;)</option>
                                                <option value="less_than">Nhỏ hơn (&lt;)</option>
                                                <option value="is_answered">Đã trả lời</option>
                                                <option value="is_empty">Bỏ trống</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="equals">Khớp hoàn toàn (==)</option>
                                                <option value="not_equals">Khác hoàn toàn (!=)</option>
                                                <option value="contains">Có chứa chuỗi</option>
                                                <option value="is_answered">Đã điền</option>
                                                <option value="is_empty">Bỏ trống</option>
                                            </>
                                        )}
                                    </select>
                                    
                                    {!['is_answered', 'is_empty'].includes(rule.condition.operator) && (
                                        ['single_choice', 'dropdown', 'multi_choice', 'yes_no'].includes(block.type) && block.options && block.options.length > 0 ? (
                                            <select
                                                className="text-[11px] font-medium bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[var(--color-primary)] min-w-[100px]"
                                                value={rule.condition.value as string ?? ''}
                                                onChange={e => {
                                                    const newLogic = [...(block.logic ?? [])];
                                                    newLogic[idx].condition.value = e.target.value;
                                                    onUpdate({ logic: newLogic });
                                                }}
                                            >
                                                <option value="">-- Chọn giá trị --</option>
                                                {block.options.map(o => (
                                                    <option key={o.id} value={o.value}>{o.label}</option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input 
                                                className="text-[11px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[var(--color-primary)] w-24"
                                                placeholder="Giá trị..."
                                                value={rule.condition.value as string ?? ''}
                                                onChange={e => {
                                                    const newLogic = [...(block.logic ?? [])];
                                                    newLogic[idx].condition.value = e.target.value;
                                                    onUpdate({ logic: newLogic });
                                                }}
                                            />
                                        )
                                    )}
                                    
                                    <span className="text-[10px] font-bold text-amber-600 ml-2">THÌ</span>
                                    
                                    <select
                                        className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-amber-300"
                                        value={rule.action}
                                        onChange={e => {
                                            const newLogic = [...(block.logic ?? [])];
                                            newLogic[idx].action = e.target.value as any;
                                            onUpdate({ logic: newLogic });
                                        }}
                                    >
                                        <option value="skip_to">Nhảy tới câu...</option>
                                        <option value="end_survey">Nộp bài (Cảm ơn mặc định)</option>
                                        <option value="end_survey_screen">Nộp bài (Trang cảm ơn khác)</option>
                                    </select>
                                    
                                    {rule.action === 'skip_to' && (
                                        <select
                                            className="text-[11px] font-medium bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[var(--color-primary)] flex-1 min-w-[150px]"
                                            value={rule.target ?? ''}
                                            onChange={e => {
                                                const newLogic = [...(block.logic ?? [])];
                                                newLogic[idx].target = e.target.value;
                                                onUpdate({ logic: newLogic });
                                            }}
                                        >
                                            <option value="">-- Chọn khối đích đến --</option>
                                            {survey.blocks.map((b, i) => (
                                                <option key={b.id} value={b.id}>{b.label ? `${i+1}. ${b.label.substring(0,25)}${b.label.length>25?'...':''}` : `Khối ${b.type}`}</option>
                                            ))}
                                        </select>
                                    )}
                                    
                                    {rule.action === 'end_survey_screen' && (
                                        <select
                                            className="text-[11px] font-medium bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[var(--color-primary)] flex-1 min-w-[150px]"
                                            value={rule.target ?? ''}
                                            onChange={e => {
                                                const newLogic = [...(block.logic ?? [])];
                                                newLogic[idx].target = e.target.value;
                                                onUpdate({ logic: newLogic });
                                            }}
                                        >
                                            <option value="">-- Chọn trang cảm ơn --</option>
                                            {(survey.thankYouPages ?? []).map((page, i) => (
                                                <option key={page.id ?? i} value={page.id ?? String(i)}>{page.title || `Trang cảm ơn ${i+1}`}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Button Preview ───────────────────────────────────────────────────────────
const ButtonPreview: React.FC<{ block: SurveyBlock; accentColor: string }> = ({ block, accentColor }) => {
    const style = block.buttonStyle ?? 'filled';
    const color = block.buttonColor ?? accentColor;
    const shadow = block.buttonShadow && block.buttonShadow !== 'none' ? block.buttonShadow : undefined;
    if (style === 'filled') return (
        <div className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold text-white select-none transition-all" style={{ background: color, boxShadow: shadow }}>
            {block.buttonText || 'Nhấn vào đây'}
        </div>
    );
    if (style === 'outline') return (
        <div className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold border-2 select-none transition-all" style={{ borderColor: color, color, boxShadow: shadow }}>
            {block.buttonText || 'Nhấn vào đây'}
        </div>
    );
    return (
        <div className="inline-block px-6 py-2.5 text-sm font-bold underline underline-offset-2 select-none transition-all" style={{ color, textShadow: shadow }}>
            {block.buttonText || 'Nhấn vào đây'}
        </div>
    );
};

// ─── Banner Preview ───────────────────────────────────────────────────────────
const BannerPreview: React.FC<{ block: SurveyBlock }> = ({ block }) => {
    const height = block.bannerHeight ?? 160;
    return (
        <div
            className="w-full rounded-xl overflow-hidden relative flex items-end"
            style={{
                height,
                backgroundImage: block.bannerImageUrl ? `url(${block.bannerImageUrl})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                background: block.bannerImageUrl ? undefined : 'linear-gradient(135deg, #64748b, #94a3b8)',
            }}
        >
            <div className="absolute inset-0" style={{ background: block.bannerOverlay ?? 'rgba(0,0,0,0.35)' }} />
            <div className="relative px-5 pb-5">
                <p className="font-bold text-base leading-snug" style={{ color: block.bannerTextColor ?? '#ffffff' }}>{block.label}</p>
                {block.description && <p className="text-xs mt-1" style={{ color: (block.bannerTextColor ?? '#ffffff') + 'bb' }}>{block.description}</p>}
            </div>
        </div>
    );
};

// ─── Input Preview by type ────────────────────────────────────────────────────
const BlockInputPreview: React.FC<{ block: SurveyBlock; theme: SurveyTheme; accentColor: string }> = ({ block, theme, accentColor }) => {
    switch (block.type) {
        case 'short_text': case 'email': case 'phone': case 'number':
            return <div className="w-full h-9 rounded-xl bg-slate-50 border border-slate-200 px-3 flex items-center">
                <span className="text-xs text-slate-300">{block.placeholder || 'Nhập câu trả lời...'}</span>
            </div>;

        case 'long_text':
            return <div className="w-full h-20 rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                <span className="text-xs text-slate-300">{block.placeholder || 'Nhập câu trả lời dài...'}</span>
            </div>;

        case 'date':
            const isDatetime = (block as any).dateMode === 'datetime';
            return <div className="w-full h-9 rounded-xl bg-slate-50 border border-slate-200 px-3 flex items-center justify-between">
                <span className="text-xs text-slate-300">{isDatetime ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY'}</span>
                {isDatetime ? <LucideIcons.Clock className="w-3.5 h-3.5 text-slate-300" /> : <LucideIcons.Calendar className="w-3.5 h-3.5 text-slate-300" />}
            </div>;

        case 'single_choice': case 'multi_choice':
            return <div className="flex flex-col gap-1.5">
                {(block.options ?? []).map(opt => (
                    <div key={opt.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-slate-100 bg-slate-50">
                        <div className={`w-4 h-4 flex-shrink-0 border-2 border-slate-300 ${block.type === 'single_choice' ? 'rounded-full' : 'rounded-md'}`} />
                        <span className="text-sm text-slate-600">{opt.label}</span>
                    </div>
                ))}
                {block.allowOther && (
                    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl border border-dashed border-slate-200">
                        <div className={`w-4 h-4 flex-shrink-0 border-2 border-slate-200 ${block.type === 'single_choice' ? 'rounded-full' : 'rounded-md'}`} />
                        <span className="text-xs text-slate-400 italic">Khác... (ô nhập tự do)</span>
                    </div>
                )}
            </div>;

        case 'dropdown':
            return <div className="w-full h-9 rounded-xl bg-slate-50 border border-slate-200 px-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">{block.options?.[0]?.label ?? 'Chọn một...'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>;

        case 'yes_no':
            return <div className="flex gap-3">
                {(block.options ?? [{ label: 'Có' }, { label: 'Không' }]).map((opt, i) => (
                    <div key={i} className="flex-1 py-2.5 px-4 rounded-xl border-2 border-slate-200 text-center text-sm font-semibold text-slate-500 bg-slate-50">{opt.label}</div>
                ))}
            </div>;

        case 'star_rating': {
            const max = block.maxValue ?? 5;
            return <div className="flex gap-1.5">
                {Array.from({ length: max }).map((_, i) => (
                    <Star key={i} className="w-6 h-6" fill={i < 3 ? accentColor : 'none'} stroke={i < 3 ? accentColor : '#cbd5e1'} />
                ))}
            </div>;
        }

        case 'nps':
            return <div className="space-y-2">
                <div className="flex gap-1 flex-wrap">
                    {Array.from({ length: 11 }).map((_, i) => {
                        const bg = i <= 6 ? '#fecaca' : i <= 8 ? '#fde68a' : '#bbf7d0';
                        return <div key={i} className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold grayscale" style={{ background: bg, color: '#475569' }}>{i}</div>;
                    })}
                </div>
                <div className="flex justify-between text-xs text-slate-400 px-1">
                    <span>{block.minLabel ?? 'Hoàn toàn không'}</span>
                    <span>{block.maxLabel ?? 'Chắc chắn có'}</span>
                </div>
            </div>;

        case 'likert': {
            const likertItems: Array<{ value: number; label: string }> =
                Array.isArray((block as any).likertPoints) && (block as any).likertPoints.length > 0
                    ? (block as any).likertPoints.map((pt: any, i: number) => ({
                          value: pt.value !== undefined && pt.value !== '' ? Number(pt.value) : i + 1,
                          label: pt.label ?? String(i + 1),
                      }))
                    : (block.likertLabels ?? ['1', '2', '3', '4', '5']).map((label, i) => ({
                          value: i + 1,
                          label,
                      }));
            return <div className="flex gap-2 flex-wrap">
                {likertItems.map((pt, i) => (
                    <div key={i} className="flex-1 min-w-[50px] flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full border-2 border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-400">{pt.value}</div>
                        <span className="text-[9px] text-slate-400 text-center leading-tight" style={{ maxWidth: '64px' }}>{pt.label}</span>
                    </div>
                ))}
            </div>;
        }

        case 'emoji_rating':
            return <div className="flex gap-3">
                {(block.emojis ?? ['😠', '😕', '😐', '🙂', '😁']).map((e, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                        <span className="text-2xl">{e}</span>
                        <div className="w-6 h-1.5 rounded-full bg-slate-100" />
                    </div>
                ))}
            </div>;

        case 'slider':
            return <div className="w-full">
                <input type="range" className="w-full" readOnly defaultValue={50} min={block.minValue ?? 0} max={block.maxValue ?? 100} style={{ accentColor }} />
                <div className="flex justify-between text-xs text-slate-400">
                    <span>{block.minLabel ?? block.minValue ?? 0}</span>
                    <span>{block.maxLabel ?? block.maxValue ?? 100}</span>
                </div>
            </div>;

        case 'ranking':
            return <div className="flex flex-col gap-2">
                {(block.options ?? []).map((opt, i) => (
                    <div key={opt.id} className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                        <GripVertical className="w-4 h-4 text-slate-300" />
                        <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold" style={{ background: accentColor + '20', color: accentColor }}>{i + 1}</span>
                        <span className="text-sm text-slate-600">{opt.label}</span>
                    </div>
                ))}
            </div>;

        case 'matrix_single': case 'matrix_multi':
            return (
                <div className="overflow-x-auto">
                    <table className="text-xs w-full border-collapse">
                        <thead><tr>
                            <th className="text-left py-1 pr-3 text-slate-400 font-medium" />
                            {(block.matrixCols ?? []).map(col => <th key={col.id} className="py-1 px-2 text-slate-500 font-semibold text-center">{col.label}</th>)}
                        </tr></thead>
                        <tbody>
                            {(block.matrixRows ?? []).map(row => (
                                <tr key={row.id}>
                                    <td className="py-1.5 pr-3 text-slate-600">{row.label}</td>
                                    {(block.matrixCols ?? []).map(col => (
                                        <td key={col.id} className="py-1.5 px-2 text-center">
                                            <div className={`w-4 h-4 border-2 border-slate-300 inline-block ${block.type === 'matrix_single' ? 'rounded-full' : 'rounded'}`} />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );

        case 'file_upload':
            return <div className="w-full h-20 rounded-xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1">
                <LucideIcons.Upload className="w-5 h-5 text-slate-400" />
                <span className="text-xs text-slate-400">Kéo thả tệp hoặc click để chọn</span>
            </div>;

        default: return null;
    }
};

export default SurveyCanvasBlock;
