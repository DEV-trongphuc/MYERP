import React, { useRef, useState } from 'react';
import { useDrop } from '../../../shims/reactDnd';
import { Survey, SurveyBlock, QuestionType } from '../../../types/survey';
import { DND_TOOLBOX_TYPE, DragToolboxItem } from '../toolbox/SurveyToolbox';
import SurveyCanvasBlock from './SurveyCanvasBlock';
import { Plus, Check } from 'lucide-react';

interface Props {
    survey: Survey;
    selectedBlockId: string | null;
    viewMode: 'desktop' | 'tablet' | 'mobile';
    onSelectBlock: (id: string | null) => void;
    onAddBlock: (type: QuestionType, insertAfterIndex?: number) => void;
    onDeleteBlock: (id: string) => void;
    onDuplicateBlock: (id: string) => void;
    onMoveBlock: (dragIdx: number, hoverIdx: number) => void;
    onUpdateBlock: (id: string, updates: Partial<SurveyBlock>) => void;
}

const widthMap = { desktop: '680px', tablet: '520px', mobile: '375px' };

const BLOCK_DND = 'SURVEY_BLOCK';

// ─── InserterSlot — drop zone between blocks ──────────────────────────────────
const InserterSlot: React.FC<{
    insertIndex: number;
    onDrop: (type: QuestionType, idx: number) => void;
    onMoveBlock?: (dragIdx: number, hoverIdx: number) => void;
}> = ({ insertIndex, onDrop, onMoveBlock }) => {
    const [{ isOver, canDrop }, drop] = useDrop<any, void, { isOver: boolean; canDrop: boolean }>({
        accept: [DND_TOOLBOX_TYPE, BLOCK_DND],
        drop: (item) => {
            if (item && item.questionType) {
                onDrop(item.questionType, insertIndex);
            } else if (item && typeof item.index === 'number' && onMoveBlock) {
                const dragIdx = item.index;
                const targetIdx = dragIdx < insertIndex + 1 ? insertIndex : insertIndex + 1;
                if (dragIdx !== targetIdx && targetIdx >= 0) {
                    onMoveBlock(dragIdx, targetIdx);
                    item.index = targetIdx;
                }
            }
        },
        collect: monitor => ({ isOver: monitor.isOver(), canDrop: monitor.canDrop() }),
    });

    return (
        <div
            ref={drop as any}
            className={`relative w-full flex items-center transition-all duration-300 ease-in-out ${
                isOver ? 'h-12 my-1.5' : canDrop ? 'h-5 my-0.5' : 'h-2'
            }`}
        >
            {/* Permanent subtle line */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center transition-all duration-300 ease-in-out w-full">
                {isOver ? (
                    /* Active drop: full zone */
                    <div className="w-full h-10 rounded-xl border-2 border-dashed border-[var(--color-primary)] bg-[var(--color-primary-light)]/20 flex items-center justify-center gap-1.5 animate-in fade-in duration-200">
                        <Plus className="w-3.5 h-3.5 text-[var(--color-primary)] animate-pulse" />
                        <span className="text-xs font-bold text-[var(--color-primary)]">Thả vào đây</span>
                    </div>
                ) : canDrop ? (
                    /* Dragging but not over this slot: glowing thin line */
                    <div className="w-full h-1 bg-[var(--color-primary)]/40 rounded-full animate-pulse" />
                ) : (
                    /* Default: invisible fine line (hit target) */
                    <div className="w-full h-px bg-transparent" />
                )}
            </div>
        </div>
    );
};


// ─── Cover block ──────────────────────────────────────────────────────────────
const SurveyCover: React.FC<{
    survey: Survey;
    isSelected: boolean;
    onClick: () => void;
}> = ({ survey, isSelected, onClick }) => {
    const theme = survey.theme;
    const coverStyle = theme.coverStyle || 'minimal';
    const coverHeight = theme.coverHeight || 'md';
    const primaryColor = theme.primaryColor || '#BD1D2D';
    const heightMap = { sm: '80px', md: '120px', lg: '180px' };

    const getBg = () => {
        if (coverStyle === 'image' && theme.coverImageUrl) {
            return {
                backgroundImage: `url(${theme.coverImageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            };
        }
        if (coverStyle === 'gradient') {
            const from = (theme as any).gradientFrom ?? `${primaryColor}dd`;
            const to = (theme as any).gradientTo ?? `${primaryColor}66`;
            if (theme.coverImageUrl) {
                return {
                    backgroundImage: `linear-gradient(135deg, ${from}cc, ${to}cc), url(${theme.coverImageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                };
            }
            return { background: `linear-gradient(135deg, ${from}, ${to})` };
        }
        return { background: primaryColor };
    };

    const textColor = '#ffffff';

    return (
        <div
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`w-full rounded-2xl mb-1 overflow-hidden cursor-pointer transition-all ${isSelected ? 'ring-2 ring-[var(--color-primary)] ring-offset-2' : 'hover:ring-2 hover:ring-[var(--color-primary-light)] hover:ring-offset-2'}`}
            style={{ ...getBg(), minHeight: heightMap[coverHeight] }}
        >
            {(coverStyle === 'image') && (
                <div className="absolute inset-0 rounded-2xl" style={{ background: theme.coverOverlay ?? 'rgba(0,0,0,0.3)' }} />
            )}
            <div className="relative px-8 py-8 flex flex-col justify-end h-full" style={{ minHeight: heightMap[coverHeight] }}>
                {theme.coverCountdown && theme.coverCountdownPos === 'top_right' && (
                    <div className="absolute top-4 right-4 bg-black/40 backdrop-blur-md rounded-xl p-2 border border-white/20 flex items-center gap-2.5 z-20">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse ring-2 ring-[var(--color-primary)]/50" />
                        <div className="flex gap-1.5">
                            {['03', '12', '45'].map((v, i) => (
                                <div key={i} className="bg-white/10 border border-white/10 rounded flex items-center justify-center p-1 font-mono">
                                    <span className="text-[11px] font-black text-white">{v}</span>
                                    <span className="text-[7px] text-white/50 ml-0.5">{['h', 'm', 's'][i]}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="w-full relative z-10">
                    {theme.coverBadge && (
                        <span className="inline-block px-3 py-1 mb-4 rounded-full text-[10px] font-black tracking-widest text-white uppercase border border-white/20 relative" style={{ background: 'linear-gradient(90deg, #BD1D2D, #ea580c)' }}>
                            {theme.coverBadge}
                        </span>
                    )}

                    {theme.logoUrl && (
                        <img src={theme.logoUrl} alt="logo" className="h-10 mb-5 object-contain" />
                    )}

                    <h1 className="text-2xl md:text-3xl font-black leading-tight" style={{ color: textColor, fontFamily: theme.fontFamily }}>
                        {survey.name}
                    </h1>

                    {theme.coverDescription && (
                        <p className="mt-3 text-sm md:text-base leading-relaxed whitespace-pre-wrap" style={{ color: textColor, opacity: 0.9 }}>
                            {theme.coverDescription}
                        </p>
                    )}

                    {(theme.coverFeatures ?? []).length > 0 && (
                        <div className="mt-6 space-y-2.5">
                            {theme.coverFeatures!.map((feat, i) => (
                                theme.coverFeaturesStyle === 'dot' ? (
                                    <div key={i} className="flex items-start gap-2.5 max-w-2xl">
                                        <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0 bg-white/70" />
                                        <span className="text-sm font-medium leading-snug" style={{ color: textColor }}>{feat}</span>
                                    </div>
                                ) : (
                                    <div key={i} className="flex items-center gap-3 bg-white/5 w-fit pr-4 py-1.5 rounded-full border border-white/10 backdrop-blur-sm">
                                        <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 ml-1">
                                            <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                                        </div>
                                        <span className="text-sm font-semibold" style={{ color: textColor }}>{feat}</span>
                                    </div>
                                )
                            ))}
                        </div>
                    )}

                    {theme.coverCountdown && theme.coverCountdownPos !== 'top_right' && (
                        <div className="mt-8 bg-black/20 backdrop-blur-md rounded-2xl p-4 w-fit border border-white/10">
                            <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold mb-3 flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                Ưu đãi kết thúc sau
                            </p>
                            <div className="flex gap-2">
                                {/* Dummy layout cho Preview Editor */}
                                {['03', '12', '45', '59'].map((v, i) => (
                                    <div key={i} className="bg-white/10 border border-white/20 rounded-xl w-12 h-12 flex flex-col items-center justify-center relative overflow-hidden">
                                        <div className="absolute inset-x-0 top-1/2 h-px bg-black/10" />
                                        <span className="text-lg font-black text-white z-10">{v}</span>
                                        <span className="text-[7px] uppercase font-bold text-white/70 mt-0.5 z-10">{['Ng', 'Giờ', 'Ph', 'Gi'][i]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                {isSelected && (
                    <div className="absolute top-3 right-3 text-[10px] font-bold text-white bg-[var(--color-primary)] px-2 py-1 rounded-lg">
                        Nhấn chỉnh trong bảng phải →
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main Canvas ──────────────────────────────────────────────────────────────
const SurveyCanvas: React.FC<Props> = ({
    survey, selectedBlockId, viewMode,
    onSelectBlock, onAddBlock, onDeleteBlock, onDuplicateBlock, onMoveBlock, onUpdateBlock
}) => {
    const canvasWidth = widthMap[viewMode];
    const theme = survey.theme;

    // DropZone for empty canvas (when no blocks)
    const [{ isOverEmpty }, dropEmpty] = useDrop<DragToolboxItem, void, { isOverEmpty: boolean }>({
        accept: DND_TOOLBOX_TYPE,
        drop: (item) => onAddBlock(item.questionType, -1),
        collect: monitor => ({ isOverEmpty: monitor.isOver() }),
    });

    const ty = survey.thankYouPage;

    return (
        <div
            className="min-h-full py-8 px-4 flex flex-col items-center"
            style={{ 
                backgroundColor: survey.theme?.backgroundColor || '#f8fafc',
                backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)',
                backgroundSize: '24px 24px'
            }}
            onClick={() => onSelectBlock(null)}
        >
            {/* Cover */}
            <div id="block-__cover__" className="w-full relative" style={{ maxWidth: canvasWidth }}>
                <SurveyCover
                    survey={survey}
                    isSelected={selectedBlockId === '__cover__'}
                    onClick={() => onSelectBlock('__cover__')}
                />
            </div>

            {/* Blocks + InserterSlots */}
            <div className="w-full flex flex-col" style={{ maxWidth: canvasWidth, minHeight: '200px' }}>

                {survey.blocks.length === 0 ? (
                    <div
                        ref={dropEmpty as any}
                        className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 transition-all mt-1
                            ${isOverEmpty ? 'border-[var(--color-primary)] bg-[var(--color-primary-light)]/20' : 'border-slate-300 bg-white'}`}
                    >
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${isOverEmpty ? 'bg-[var(--color-primary-light)]' : 'bg-slate-100'}`}>
                            <Plus className={`w-6 h-6 ${isOverEmpty ? 'text-[var(--color-primary)]' : 'text-slate-600'}`} />
                        </div>
                        <p className={`font-bold text-sm ${isOverEmpty ? 'text-[var(--color-primary)]' : 'text-slate-600'}`}>
                            {isOverEmpty ? 'Thả vào đây!' : 'Kéo câu hỏi từ bên trái vào đây'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Slot before first block */}
                        <InserterSlot insertIndex={-1} onDrop={(type, afterIdx) => onAddBlock(type, afterIdx)} onMoveBlock={onMoveBlock} />

                        {survey.blocks.map((block, idx) => (
                            <React.Fragment key={block.id}>
                                <SurveyCanvasBlock
                                    survey={survey}
                                    block={block}
                                    index={idx}
                                    theme={survey.theme}
                                    isSelected={block.id === selectedBlockId}
                                    onSelect={() => onSelectBlock(block.id)}
                                    onDelete={() => onDeleteBlock(block.id)}
                                    onDuplicate={() => onDuplicateBlock(block.id)}
                                    onMove={onMoveBlock}
                                    onAddAfter={(type) => onAddBlock(type, idx)}
                                    onUpdate={(changes) => onUpdateBlock(block.id, changes)}
                                    totalBlocks={survey.blocks.length}
                                />
                                {/* InserterSlot after each block */}
                                <InserterSlot insertIndex={idx} onDrop={(type, afterIdx) => onAddBlock(type, afterIdx)} onMoveBlock={onMoveBlock} />
                            </React.Fragment>
                        ))}

                        {/* Add block button at bottom */}
                        <button
                            onClick={() => onAddBlock('short_text')}
                            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-700 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-light)]/20 transition-all text-sm font-bold mt-1 bg-white/70"
                        >
                            <Plus className="w-4 h-4" />
                            Thêm câu hỏi
                        </button>
                    </>
                )}
            </div>

            {/* Thank You preview (clickable) */}
            {survey.blocks.length > 0 && (
                <div
                    id="block-__thankyou__"
                    className={`w-full mt-3 rounded-2xl p-6 text-center bg-white transition-all cursor-pointer ${selectedBlockId === '__thankyou__' ? 'border-2 border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/15' : 'border border-slate-200 hover:border-slate-300'}`}
                    style={{ maxWidth: canvasWidth }}
                    onClick={(e) => { e.stopPropagation(); onSelectBlock('__thankyou__'); }}
                >
                    <div className="text-3xl mb-2">{ty.emoji ?? '🎉'}</div>
                    <h3 className="font-bold text-slate-900">{ty.title}</h3>
                    <p className="text-sm text-slate-600 mt-1">{ty.message}</p>
                    {ty.ctaText && (
                        <div className="mt-4 inline-block px-6 py-2 rounded-xl text-sm font-bold text-white" style={{ background: (ty as any)?.ctaColor || (survey as any).thank_you?.ctaColor || theme.primaryColor || '#BD1D2D' }}>
                            {ty.ctaText}
                        </div>
                    )}
                    <p className="text-[10px] font-semibold text-slate-500 mt-3 uppercase tracking-widest">Trang cảm ơn · Click để chỉnh</p>
                </div>
            )}

            {/* Extra Thank You Previews */
            survey.blocks.length > 0 && (survey.thankYouPages ?? []).map((page, i) => {
                const blockId = '__thankyou_' + i + '__';
                const isSelected = selectedBlockId === blockId;
                return (
                    <div
                        key={page.id ?? i}
                        id={`block-${blockId}`}
                        className={`w-full mt-3 rounded-2xl p-6 text-center bg-white transition-all cursor-pointer ${isSelected ? 'border-2 border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/15' : 'border border-slate-200 hover:border-slate-300'}`}
                        style={{ maxWidth: canvasWidth }}
                        onClick={(e) => { e.stopPropagation(); onSelectBlock(blockId); }}
                    >
                        <div className="text-3xl mb-2">{page.emoji ?? '🎉'}</div>
                        <h3 className="font-bold text-slate-900">{page.title || `Trang cảm ơn phụ ${i+1}`}</h3>
                        <p className="text-sm text-slate-600 mt-1">{page.message}</p>
                        {page.ctaText && (
                            <div className="mt-4 inline-block px-6 py-2 rounded-xl text-sm font-bold text-white" style={{ background: (page as any)?.ctaColor || theme.primaryColor || '#BD1D2D' }}>
                                {page.ctaText}
                            </div>
                        )}
                        <p className="text-[10px] font-semibold text-slate-500 mt-3 uppercase tracking-widest">Trang cảm ơn phụ · Click để chỉnh</p>
                    </div>
                );
            })}
        </div>
    );
};

export default SurveyCanvas;
