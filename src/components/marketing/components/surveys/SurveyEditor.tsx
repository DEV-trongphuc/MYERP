import React, { useState, useCallback, useEffect, useRef } from 'react';
import { DndProvider } from '../../shims/reactDnd';
import { HTML5Backend } from '../../shims/reactDnd';
import { useParams, useNavigate } from 'react-router-dom';
import { Survey, SurveyBlock, SurveyTheme } from '../../types/survey';
import { DEFAULT_THEME, DEFAULT_SETTINGS, DEFAULT_THANK_YOU, createDefaultBlock, QUESTION_TYPE_DEFINITIONS } from './constants/questionTypes';
import SurveyToolbox from './toolbox/SurveyToolbox';
import SurveyCanvas from './canvas/SurveyCanvas';
import SurveyProperties from './properties/SurveyProperties';
import SurveyTopBar from './SurveyTopBar.tsx';
import { toast } from 'react-hot-toast';
import { api } from '../../services/storageAdapter';
import { X, Monitor, Tablet, Smartphone } from 'lucide-react';
import { createPortal } from 'react-dom';
import { getMktPortalRoot } from '../../utils/portalRoot';


export interface SurveyEditorProps {
    surveyIdProp?: string;
    initialSurvey?: Survey | null;
    onBack?: () => void;
}

function normalizeClientBlocks(rawBlocks: any[]): SurveyBlock[] {
    if (!Array.isArray(rawBlocks)) return [];
    return rawBlocks.map((b: any, idx: number) => {
        if (!b || typeof b !== 'object') return createDefaultBlock('short_text');
        const label = b.label || b.title || b.question || b.content || `Câu hỏi ${idx + 1}`;
        let type = b.type || 'short_text';
        let extra: Partial<SurveyBlock> = {};

        if (type === 'rating') {
            const style = b.options?.style || b.style?.style || '';
            const scale = Number(b.options?.scale || b.scale || 5);
            if (style === 'nps' || scale === 10) {
                type = 'nps';
                extra = {
                    minValue: b.minValue ?? 0,
                    maxValue: b.maxValue ?? 10,
                    minLabel: b.minLabel ?? 'Rất không hài lòng',
                    maxLabel: b.maxLabel ?? 'Rất hài lòng',
                };
            } else {
                type = 'star_rating';
                extra = {
                    minValue: b.minValue ?? 1,
                    maxValue: b.maxValue ?? (scale > 0 ? scale : 5),
                    ratingIcon: b.ratingIcon ?? 'star',
                };
            }
        } else if (type === 'multiple_choice') {
            type = 'single_choice';
        }

        let normalizedOptions = b.options;
        if (b.options && typeof b.options === 'object') {
            const rawOpts = Array.isArray(b.options.choices)
                ? b.options.choices
                : (Array.isArray(b.options) ? b.options : null);
            if (rawOpts) {
                normalizedOptions = rawOpts.map((opt: any, optIdx: number) => {
                    if (opt && typeof opt === 'object') {
                        const optLabel = String(opt.label ?? opt.value ?? `Lựa chọn ${optIdx + 1}`);
                        return {
                            id: opt.id ? String(opt.id) : `opt-${idx + 1}-${optIdx + 1}`,
                            label: optLabel,
                            value: String(opt.value ?? optLabel),
                        };
                    }
                    const str = String(opt);
                    return {
                        id: `opt-${idx + 1}-${optIdx + 1}`,
                        label: str,
                        value: str,
                    };
                });
            } else if (type === 'nps' || type === 'star_rating') {
                normalizedOptions = undefined;
            }
        }

        return {
            ...b,
            ...extra,
            id: b.id || crypto.randomUUID(),
            type,
            label,
            options: normalizedOptions,
        } as SurveyBlock;
    });
}

function hydrateSurveyData(d: any): Survey {
    const rawBlocks = Array.isArray(d.blocks) && d.blocks.length > 0
        ? d.blocks
        : (Array.isArray(d.blocks_json) ? d.blocks_json : []);
    const cover = (d.cover_style && typeof d.cover_style === 'object')
        ? d.cover_style
        : (d.theme && typeof d.theme === 'object' ? d.theme : {});
    const settings = (d.settings_json && typeof d.settings_json === 'object')
        ? d.settings_json
        : (d.settings && typeof d.settings === 'object' ? d.settings : {});
    const thankYou = (d.thank_you_page && typeof d.thank_you_page === 'object')
        ? d.thank_you_page
        : (d.thankYouPage && typeof d.thankYouPage === 'object' ? d.thankYouPage : {});

    return {
        ...d,
        blocks: normalizeClientBlocks(rawBlocks),
        theme: { ...DEFAULT_THEME, ...cover, cardShadow: 'none' },
        settings: { ...DEFAULT_SETTINGS, ...settings },
        thankYouPage: { ...DEFAULT_THANK_YOU, ...thankYou },
        thankYouPages: thankYou?.extraScreens || d.thankYouPages || [],
    };
}

const SurveyEditor: React.FC<SurveyEditorProps> = ({ surveyIdProp, initialSurvey, onBack }) => {
    const params = useParams<{ id: string }>();
    const id = surveyIdProp || params.id;
    const navigate = useNavigate();
    const isNew = id === 'new';

    const [survey, setSurvey] = useState<Survey | null>(() => {
        if (initialSurvey) return hydrateSurveyData(initialSurvey);
        if (isNew) {
            return {
                id: '',
                workspace_id: 1,
                name: 'Khảo sát mới',
                slug: '',
                status: 'draft',
                blocks: [],
                theme: { ...DEFAULT_THEME, cardShadow: 'none' },
                settings: { ...DEFAULT_SETTINGS },
                thankYouPage: { ...DEFAULT_THANK_YOU },
                require_login: false,
                allow_anonymous: true,
                one_per_email: false,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
        }
        return null;
    });
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState<boolean>(() => !initialSurvey && !isNew);
    const [viewMode, setViewMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Load survey ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (isNew) {
            setIsLoading(false);
            return;
        }
        if (initialSurvey && initialSurvey.id === id) {
            setSurvey(prev => prev && prev.id === id ? prev : hydrateSurveyData(initialSurvey));
            setIsLoading(false);
        }
        let cancelled = false;
        api.get<any>(`surveys/${id}?action=get`)
            .then(res => {
                if (cancelled) return;
                if (res.success && (res as any).data) {
                    const hydrated = hydrateSurveyData((res as any).data);
                    setSurvey(prev => {
                        // Preserve optimistic blocks if user already started editing or if server row was still initializing
                        if (prev && prev.id === id && prev.blocks.length > 0 && hydrated.blocks.length === 0) {
                            return { ...hydrated, blocks: prev.blocks };
                        }
                        return hydrated;
                    });
                }
            })
            .catch(() => {
                // Keep optimistic survey if background fetch fails or is still creating
            })
            .finally(() => {
                if (!cancelled) setIsLoading(false);
            });
        return () => { cancelled = true; };
    }, [id, isNew]);

    // Scroll selected/added block into view smoothly
    useEffect(() => {
        if (!selectedBlockId) return;
        const timer = setTimeout(() => {
            const element = document.getElementById(`block-${selectedBlockId}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [selectedBlockId]);

    // ─── Auto-save ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isDirty || !survey?.id) return;
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
        autoSaveTimer.current = setTimeout(() => handleSave(true), 30000);
        return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
    }, [survey, isDirty]);

    const handleSave = useCallback(async (silent = false) => {
        if (!survey) return;
        setIsSaving(true);
        try {
            let savedId = survey.id;

            if (isNew || !survey.id) {
                const res = await api.post<any>('surveys?action=create', { name: survey.name, workspace_id: survey.workspace_id });
                if (!res.success) throw new Error((res as any).error);
                savedId = (res as any).data.id;
                setSurvey(prev => prev ? { ...prev, id: savedId, slug: (res as any).data.slug } : prev);
                navigate(`/marketing/surveys/${savedId}/edit`, { replace: true });
            }

            await api.put(`surveys/${savedId}?action=update`, {
                    name: survey.name,
                    blocks_json: survey.blocks,
                    settings_json: survey.settings,
                    thank_you_page: {
                        ...survey.thankYouPage,
                        extraScreens: survey.thankYouPages || []
                    },
                    cover_style: survey.theme,
                    target_list_id: survey.target_list_id,
                    flow_trigger_id: survey.flow_trigger_id,
                    response_limit: survey.response_limit,
                    close_at: survey.close_at,
                    require_login: survey.require_login ? 1 : 0,
                    allow_anonymous: survey.allow_anonymous ? 1 : 0,
                    one_per_email: survey.one_per_email ? 1 : 0,
                });

            setIsDirty(false);
            if (!silent) toast.success('Đã lưu khảo sát');
        } catch (e: any) {
            toast.error('Lỗi lưu: ' + e.message);
        } finally {
            setIsSaving(false);
        }
    }, [survey, isNew, navigate]);

    const updateSurvey = useCallback((changes: Partial<Survey>) => {
        setSurvey(prev => prev ? { ...prev, ...changes } : prev);
        setIsDirty(true);
    }, []);

    // ─── Block operations ────────────────────────────────────────────────────
    const addBlock = useCallback((type: SurveyBlock['type'], insertAfterIndex?: number) => {
        const newBlock = createDefaultBlock(type);
        setSurvey(prev => {
            if (!prev) return prev;
            const blocks = [...prev.blocks];
            const idx = insertAfterIndex !== undefined ? insertAfterIndex + 1 : blocks.length;
            blocks.splice(idx, 0, newBlock);
            return { ...prev, blocks };
        });
        setSelectedBlockId(newBlock.id);
        setIsDirty(true);
    }, []);

    const updateBlock = useCallback((blockId: string, changes: Partial<SurveyBlock>) => {
        setSurvey(prev => {
            if (!prev) return prev;
            return { ...prev, blocks: prev.blocks.map(b => b.id === blockId ? { ...b, ...changes } : b) };
        });
        setIsDirty(true);
    }, []);

    const deleteBlock = useCallback((blockId: string) => {
        setSurvey(prev => {
            if (!prev) return prev;
            return { ...prev, blocks: prev.blocks.filter(b => b.id !== blockId) };
        });
        if (selectedBlockId === blockId) setSelectedBlockId(null);
        setIsDirty(true);
    }, [selectedBlockId]);

    const duplicateBlock = useCallback((blockId: string) => {
        const newBlockId = crypto.randomUUID();
        setSurvey(prev => {
            if (!prev) return prev;
            const idx = prev.blocks.findIndex(b => b.id === blockId);
            if (idx < 0) return prev;
            const sourceBlock = prev.blocks[idx];
            const rawClone: SurveyBlock =
                typeof structuredClone === 'function'
                    ? structuredClone(sourceBlock)
                    : JSON.parse(JSON.stringify(sourceBlock));

            const clone: SurveyBlock = {
                ...rawClone,
                id: newBlockId,
                options: rawClone.options
                    ? rawClone.options.map(opt => ({ ...opt, id: crypto.randomUUID() }))
                    : undefined,
                matrixRows: rawClone.matrixRows
                    ? rawClone.matrixRows.map(row => ({ ...row, id: crypto.randomUUID() }))
                    : undefined,
                matrixCols: rawClone.matrixCols
                    ? rawClone.matrixCols.map(col => ({ ...col, id: crypto.randomUUID() }))
                    : undefined,
                logic: rawClone.logic
                    ? rawClone.logic.map(rule => ({
                          ...rule,
                          condition: rule.condition
                              ? {
                                    ...rule.condition,
                                    question_id:
                                        rule.condition.question_id === blockId
                                            ? newBlockId
                                            : rule.condition.question_id,
                                }
                              : rule.condition,
                      }))
                    : undefined,
            };

            if (Array.isArray((rawClone as any).likertPoints)) {
                (clone as any).likertPoints = (rawClone as any).likertPoints.map((pt: any) => ({
                    ...pt,
                    ...(pt.id ? { id: crypto.randomUUID() } : {}),
                }));
            }

            const blocks = [...prev.blocks];
            blocks.splice(idx + 1, 0, clone);
            return { ...prev, blocks };
        });
        setSelectedBlockId(newBlockId);
        setIsDirty(true);
    }, []);

    const moveBlock = useCallback((dragIndex: number, hoverIndex: number) => {
        setSurvey(prev => {
            if (!prev) return prev;
            const blocks = [...prev.blocks];
            const [removed] = blocks.splice(dragIndex, 1);
            blocks.splice(hoverIndex, 0, removed);
            return { ...prev, blocks };
        });
        setIsDirty(true);
    }, []);

    const selectedBlock = (['__cover__', '__thankyou__'].includes(selectedBlockId ?? '')) 
        ? null 
        : (survey?.blocks.find(b => b.id === selectedBlockId) ?? null);


    if (isLoading) {
        return createPortal(
            <div className="fixed inset-0 z-[2147483630] w-screen h-screen flex flex-col bg-slate-100 dark:bg-[#0B0F19] overflow-hidden font-sans" style={{ zIndex: 2147483630 }}>
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
            </div>,
            getMktPortalRoot()
        );
    }

    if (!survey) return null;

    return createPortal(
        <DndProvider backend={HTML5Backend}>
            <div className="fixed inset-0 z-[2147483630] w-screen h-screen flex flex-col bg-slate-100 dark:bg-[#0B0F19] overflow-hidden font-sans" style={{ zIndex: 2147483630 }}>
                {/* Top Bar */}
                <SurveyTopBar
                    survey={survey}
                    isSaving={isSaving}
                    isDirty={isDirty}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onBack={onBack}
                    onSave={() => handleSave(false)}
                    onNameChange={name => updateSurvey({ name })}
                    onPublish={async () => {
                        await handleSave(true);
                        if (!survey.id) return;
                        const r = await api.post(`surveys/${survey.id}?action=publish`, {});
                        if (r.success) { setSurvey(prev => prev ? { ...prev, status: 'active' } : prev); toast.success('Đã xuất bản khảo sát!'); }
                    }}
                    onPreview={async () => {
                        await handleSave(true);
                        setIsPreviewOpen(true);
                    }}
                />

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Toolbox */}
                    <SurveyToolbox onAddBlock={addBlock} />

                    {/* Center Canvas */}
                    <div className="flex-1 overflow-y-auto">
                        <SurveyCanvas
                            survey={survey}
                            selectedBlockId={selectedBlockId}
                            viewMode={viewMode}
                            onSelectBlock={setSelectedBlockId}
                            onAddBlock={addBlock}
                            onDeleteBlock={deleteBlock}
                            onDuplicateBlock={duplicateBlock}
                            onMoveBlock={moveBlock}
                            onUpdateBlock={updateBlock}
                        />
                    </div>

                    {/* Right Properties */}
                    <SurveyProperties
                        survey={survey}
                        selectedBlock={selectedBlock}
                        selectedBlockId={selectedBlockId}
                        onUpdateBlock={updateBlock}
                        onUpdateSurvey={updateSurvey}
                    />
                </div>
            </div>

            {/* ── Preview Overlay ─────────────────────────────────────────────── */}
            {isPreviewOpen && (
                <div className="fixed inset-0 z-[2147483646] bg-slate-900/80 backdrop-blur-sm flex flex-col items-center" style={{ zIndex: 2147483646 }}>
                    {/* Preview top bar */}
                    <div className="w-full h-12 bg-slate-900 flex items-center px-4 gap-4 shrink-0">
                        <span className="text-white/70 text-xs font-bold uppercase tracking-widest">Preview</span>
                        <div className="flex items-center bg-slate-800 rounded-lg p-0.5">
                            {([['desktop', 'Monitor', '1400px'], ['tablet', 'Tablet', '768px'], ['mobile', 'Phone', '390px']] as const).map(([mode, iconName, _]) => {
                                const icons: Record<string, React.ReactNode> = {
                                    Monitor: <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>,
                                    Tablet:  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>,
                                    Phone:   <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="18" r="1"/></svg>,
                                };
                                return (
                                    <button key={mode} onClick={() => setPreviewDevice(mode)}
                                        className={`p-1.5 rounded-md transition-all ${previewDevice === mode ? 'bg-[var(--color-primary)] text-white' : 'text-slate-400 hover:text-white'}`}
                                    >{icons[iconName]}</button>
                                );
                            })}
                        </div>
                        <div className="flex-1" />
                        <span className="text-slate-500 text-xs">Submit bị vô hiệu hoá trong chế độ preview</span>
                        <button onClick={() => setIsPreviewOpen(false)}
                            className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 hover:text-white transition-all"
                        >
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                    </div>

                    {/* iframe viewport */}
                    <div className="flex-1 flex items-start justify-center overflow-y-auto py-6 w-full">
                        <div
                            className="bg-white rounded-2xl overflow-hidden border border-slate-700 transition-all duration-300"
                            style={{
                                width: previewDevice === 'mobile' ? '390px' : previewDevice === 'tablet' ? '768px' : '100%',
                                maxWidth: previewDevice === 'desktop' ? '960px' : undefined,
                                minHeight: '80vh',
                            }}
                        >
                            {survey.slug ? (
                                <iframe
                                    src={`/s/${survey.slug}?preview=1`}
                                    className="w-full border-0"
                                    style={{ minHeight: '80vh', height: '100%' }}
                                    title="Survey Preview"
                                />
                            ) : (
                                <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
                                    <svg viewBox="0 0 24 24" className="w-12 h-12 text-slate-200" fill="none" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25"/><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 18.75a2.25 2.25 0 0 1 2.25-2.25H20.25"/></svg>
                                    <p className="text-sm font-medium">Lưu khảo sát trước để xem preview</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </DndProvider>,
        getMktPortalRoot()
    );
};

export default SurveyEditor;
