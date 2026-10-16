import React, { useRef, useState, useEffect } from 'react';
import { Survey, SurveyBlock, MatrixRow, MatrixCol, ThankYouPage } from '../../../types/survey';
import {
    Settings, Plus, Trash2, GripVertical, Upload, Link, AlignLeft, AlignCenter, AlignRight,
    Image, Palette, Settings2, Heart, Calendar, Clock, Hash, Zap, GitMerge, ChevronDown
} from 'lucide-react';
import { API_BASE_URL } from '../../../utils/config';
import { api } from '../../../services/storageAdapter';
import FileLibraryModal from '../../common/FileLibraryModal';
import Select from '../../common/Select';
import VoucherConfigurator from './VoucherConfigurator';

interface Props {
    survey: Survey;
    selectedBlock: SurveyBlock | null;
    selectedBlockId: string | null;
    onUpdateBlock: (id: string, changes: Partial<SurveyBlock>) => void;
    onUpdateSurvey: (changes: Partial<Survey>) => void;
}

// ─── Flow Trigger Selector ───────────────────────────────────────────────
const FlowTriggerSelector: React.FC<{
    value: string | null;
    onChange: (flowId: string | null) => void;
}> = ({ value, onChange }) => {
    const [flows, setFlows] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setLoading(true);
        api.get<any>('flows').then(r => {
            if (r.success) {
                const surveyFlows = (r.data ?? []).filter((f: any) =>
                    f.status !== 'archived' &&
                    (f.trigger_type === 'survey' ||
                     (f.steps ?? []).some((s: any) => s.type === 'trigger' && s.config?.type === 'survey'))
                );
                setFlows(surveyFlows);
            }
        }).finally(() => setLoading(false));
    }, []);

    const selected = flows.find(f => f.id === value);

    return (
        <div className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-left hover:border-amber-300 transition-all"
            >
                <span className="flex items-center gap-2 flex-1 min-w-0">
                    <GitMerge className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                    <span className="truncate font-medium text-slate-700">
                        {loading ? 'Đang tải...' : selected ? selected.name : 'Chưa chọn flow'}
                    </span>
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400 flex-shrink-0" />
            </button>
            {open && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    <div className="max-h-48 overflow-y-auto">
                        <button
                            onClick={() => { onChange(null); setOpen(false); }}
                            className="w-full px-3 py-2 text-left text-xs text-slate-400 hover:bg-slate-50 transition-all"
                        >
                            Không kích hoạt flow
                        </button>
                        {flows.length === 0 && !loading && (
                            <div className="px-3 py-3 text-xs text-slate-400 text-center">
                                Chưa có flow nào có trigger “Survey Submit”
                            </div>
                        )}
                        {flows.map(f => (
                            <button
                                key={f.id}
                                onClick={() => { onChange(f.id); setOpen(false); }}
                                className={`w-full px-3 py-2.5 text-left flex items-center gap-2 text-xs transition-all ${
                                    f.id === value ? 'bg-amber-50 text-amber-700 font-bold' : 'text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                                <GitMerge className="w-3 h-3 flex-shrink-0" />
                                <span className="flex-1 truncate">{f.name}</span>
                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                    f.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'
                                }`}>{f.status}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Shared micro-components ─────────────────────────────────────────────────

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.12em] mb-1.5">{children}</label>
);

const FieldInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => {
    const [localVal, setLocalVal] = useState(props.value ?? '');
    useEffect(() => { setLocalVal(props.value ?? ''); }, [props.value]);
    
    // Auto-sync debounced
    const isTyping = useRef(false);
    useEffect(() => {
        if (!isTyping.current) return;
        const timer = setTimeout(() => {
            if (localVal !== props.value && props.onChange) {
                props.onChange({ target: { value: localVal } } as any);
            }
            isTyping.current = false;
        }, 300);
        return () => clearTimeout(timer);
    }, [localVal, props.onChange, props.value]);

    return (
        <input 
            {...props} 
            value={localVal}
            onChange={e => {
                isTyping.current = true;
                setLocalVal(e.target.value);
            }}
            onBlur={e => {
                if (isTyping.current) {
                    isTyping.current = false;
                    if (props.onChange) props.onChange({ target: { value: localVal } } as any);
                }
                if (props.onBlur) props.onBlur(e);
            }}
            className={`w-full px-3 py-2 text-xs bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-[3px] focus:ring-amber-500/20 transition-all shadow-sm ${props.className ?? ''}`} 
        />
    );
};

const FieldTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
    const [localVal, setLocalVal] = useState(props.value ?? '');
    useEffect(() => { setLocalVal(props.value ?? ''); }, [props.value]);
    
    const isTyping = useRef(false);
    useEffect(() => {
        if (!isTyping.current) return;
        const timer = setTimeout(() => {
            if (localVal !== props.value && props.onChange) {
                props.onChange({ target: { value: localVal } } as any);
            }
            isTyping.current = false;
        }, 300);
        return () => clearTimeout(timer);
    }, [localVal, props.onChange, props.value]);

    return (
        <textarea 
            {...props} 
            value={localVal}
            onChange={e => {
                isTyping.current = true;
                setLocalVal(e.target.value);
            }}
            onBlur={e => {
                if (isTyping.current) {
                    isTyping.current = false;
                    if (props.onChange) props.onChange({ target: { value: localVal } } as any);
                }
                if (props.onBlur) props.onBlur(e);
            }}
            className={`w-full px-3 py-2.5 text-xs bg-white border border-slate-200 hover:border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 focus:ring-[3px] focus:ring-amber-500/20 transition-all shadow-sm resize-none ${props.className ?? ''}`} 
        />
    );
};

const FieldSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => {
    const options = React.Children.toArray(props.children)
        .filter(React.isValidElement)
        .map((child: any) => ({
            value: child.props.value,
            label: child.props.children
        }));
    return (
        <div className={`relative ${props.className?.includes('w-fit') ? 'w-fit' : 'w-full'}`}>
            <Select 
                size="sm" 
                variant="outline" 
                options={options} 
                value={props.value as string} 
                onChange={(v) => props.onChange && props.onChange({ target: { value: v } } as any)}
                className={`!bg-white ${props.className}`}
            />
        </div>
    );
};

const Toggle: React.FC<{ value: boolean; onChange: () => void; label: string }> = ({ value, onChange, label }) => (
    <div className="flex items-center justify-between py-0.5">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <button onClick={onChange} className={`relative w-9 h-5 rounded-full transition-colors ${value ? 'bg-amber-500' : 'bg-slate-200'}`}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-4' : 'left-0.5'}`} />
        </button>
    </div>
);

const AlignButtons: React.FC<{ value?: string; onChange: (v: 'left' | 'center' | 'right') => void }> = ({ value = 'left', onChange }) => (
    <div className="flex gap-1">
        {(['left', 'center', 'right'] as const).map(a => {
            const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
            return (
                <button key={a} onClick={() => onChange(a)}
                    className={`flex-1 py-1.5 rounded-lg flex items-center justify-center transition-all ${value === a ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                >
                    <Icon className="w-3.5 h-3.5" />
                </button>
            );
        })}
    </div>
);

const ColorRow: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => {
    const isHex = /^#([0-9A-F]{3}){1,2}$/i.test(value ?? '');
    return (
        <div>
            <Label>{label}</Label>
            <div className="flex items-center gap-2">
                <label className="relative flex-shrink-0 cursor-pointer">
                    <div
                        className="w-8 h-8 rounded-full border-2 border-white shadow-md ring-1 ring-slate-200 transition-transform hover:scale-110"
                        style={{ background: value }}
                    />
                    <input type="color" value={isHex ? value : '#ffffff'} onChange={e => onChange(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-8 h-8" />
                </label>
                <FieldInput value={value} onChange={e => onChange(e.target.value)} className="font-mono" />
            </div>
        </div>
    );
};

const ShadowRow: React.FC<{ label: string; value: string; onChange: (v: string) => void }> = ({ label, value, onChange }) => {
    const presets = [
        { label: 'Không', value: 'none' },
        { label: 'Rất nhẹ', value: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
        { label: 'Nhẹ (sm)', value: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)' },
        { label: 'Vừa (md)', value: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' },
        { label: 'Đậm (lg)', value: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' },
        { label: 'Nổi 3D (2xl)', value: '0 25px 50px -12px rgb(0 0 0 / 0.25)' },
    ];
    return (
        <div>
            <Label>{label}</Label>
            <div className="flex flex-col gap-2">
                <Select 
                    size="sm"
                    variant="outline"
                    value={presets.find(p => p.value === value) ? value : 'custom'} 
                    onChange={v => { if (v !== 'custom') onChange(v); }}
                    options={[
                        ...presets,
                        ...(!presets.find(p => p.value === value) && value ? [{ value: 'custom', label: 'Tùy chỉnh CSS...' }] : [])
                    ]}
                    className="!bg-white"
                />
                <FieldInput value={value || 'none'} onChange={e => onChange(e.target.value)} className="font-mono text-[10px]" />
            </div>
        </div>
    );
};

const SectionDivider: React.FC<{ label: string }> = ({ label }) => (
    <div className="flex items-center gap-2 pt-1">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{label}</span>
        <div className="flex-1 h-px bg-slate-100" />
    </div>
);

// ─── Image uploader with Library ─────────────────────────────────────────────
const ImageUploader: React.FC<{
    value: string;
    onChange: (url: string) => void;
    label?: string;
}> = ({ value, onChange, label = 'Hình ảnh' }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [tab, setTab] = useState<'url' | 'upload'>('upload');
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const fd = new FormData();
        fd.append('file', file);
        fd.append('folder', 'surveys');
        try {
            const res = await fetch(`${API_BASE_URL}/upload.php`, { method: 'POST', body: fd, credentials: 'include' });
            const json = await res.json();
            if (json.success && json.url) { onChange(json.url); }
        } catch { /* ignore */ } finally {
            setUploading(false);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <Label>{label}</Label>
                <button
                    onClick={() => setIsLibraryOpen(true)}
                    className="text-[10px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md flex items-center gap-1 transition-colors"
                >
                    <Image className="w-3 h-3" /> Thư viện
                </button>
            </div>

            <div className="flex gap-0.5 mb-2 bg-slate-100 rounded-xl p-0.5">
                {([
                    { key: 'upload',  label: 'Tải lên' },
                    { key: 'url',     label: 'Nhập URL' },
                ] as const).map(t => (
                    <button key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                            tab === t.key ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >{t.label}</button>
                ))}
            </div>

            {tab === 'url' && (
                <FieldInput value={value} onChange={e => onChange(e.target.value)} placeholder="https://..." />
            )}

            {tab === 'upload' && (
                <div>
                    <button onClick={() => fileRef.current?.click()}
                        className="w-full py-3 rounded-xl border-2 border-dashed border-slate-200 text-xs text-slate-400 hover:border-amber-300 hover:text-amber-500 hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
                        disabled={uploading}
                    >
                        {uploading ? <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? 'Đang tải...' : 'Chọn ảnh từ máy'}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
                </div>
            )}

            {value && (
                <div className="relative mt-2 group">
                    <img src={value} alt="" className="w-full h-20 object-cover rounded-xl border border-slate-100" />
                    <button onClick={() => onChange('')}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs hover:bg-red-500"
                    >×</button>
                </div>
            )}

            <FileLibraryModal
                isOpen={isLibraryOpen}
                onClose={() => setIsLibraryOpen(false)}
                multi={false}
                onSelect={(files) => {
                    if (files[0]) onChange(files[0].url);
                }}
            />
        </div>
    );
};


// ─── Matrix editor ────────────────────────────────────────────────────────────
const MatrixEditor: React.FC<{
    rows: MatrixRow[];
    cols: MatrixCol[];
    onChangeRows: (rows: MatrixRow[]) => void;
    onChangeCols: (cols: MatrixCol[]) => void;
}> = ({ rows, cols, onChangeRows, onChangeCols }) => {
    const addRow = () => onChangeRows([...rows, { id: crypto.randomUUID(), label: `Tiêu chí ${rows.length + 1}` }]);
    const addCol = () => onChangeCols([...cols, { id: crypto.randomUUID(), label: `Cột ${cols.length + 1}` }]);
    const editRow = (id: string, label: string) => onChangeRows(rows.map(r => r.id === id ? { ...r, label } : r));
    const editCol = (id: string, label: string) => onChangeCols(cols.map(c => c.id === id ? { ...c, label } : c));
    const deleteRow = (id: string) => onChangeRows(rows.filter(r => r.id !== id));
    const deleteCol = (id: string) => onChangeCols(cols.filter(c => c.id !== id));

    return (
        <div className="space-y-3">
            {/* Rows */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <Label>Hàng (Tiêu chí)</Label>
                    <button onClick={addRow} className="flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-700 font-bold">
                        <Plus className="w-3 h-3" /> Thêm
                    </button>
                </div>
                <div className="space-y-1">
                    {rows.map(row => (
                        <div key={row.id} className="flex items-center gap-1.5">
                            <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0" />
                            <FieldInput
                                value={row.label}
                                onChange={e => editRow(row.id, e.target.value)}
                                className="!px-2 !py-1 !text-xs !bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300"
                            />
                            <button onClick={() => deleteRow(row.id)} className="p-1 text-slate-300 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
            {/* Cols */}
            <div>
                <div className="flex items-center justify-between mb-1.5">
                    <Label>Cột (Mức đánh giá)</Label>
                    <button onClick={addCol} className="flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-700 font-bold">
                        <Plus className="w-3 h-3" /> Thêm
                    </button>
                </div>
                <div className="space-y-1">
                    {cols.map(col => (
                        <div key={col.id} className="flex items-center gap-1.5">
                            <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0" />
                            <FieldInput
                                value={col.label}
                                onChange={e => editCol(col.id, e.target.value)}
                                className="!px-2 !py-1 !text-xs !bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300"
                            />
                            <button onClick={() => deleteCol(col.id)} className="p-1 text-slate-300 hover:text-red-400 transition-colors">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── Thank You Page Designer ─────────────────────────────────────────────
const ThankYouDesigner: React.FC<{
    survey: Survey;
    onUpdate: (changes: Partial<Survey>) => void;
    selectedBlockId: string | null;
}> = ({ survey, onUpdate, selectedBlockId }) => {
    const [activeIndex, setActiveIndex] = useState<number>(-1);
    const [deletingIndex, setDeletingIndex] = useState<number | null>(null);

    React.useEffect(() => {
        if (selectedBlockId === '__thankyou__') setActiveIndex(-1);
        else if (selectedBlockId?.startsWith('__thankyou_')) {
            const idx = parseInt(selectedBlockId.replace('__thankyou_', '').replace('__', ''), 10);
            if (!isNaN(idx)) setActiveIndex(idx);
        }
    }, [selectedBlockId]);

    const extraPages = survey.thankYouPages ?? [];
    const ty = (activeIndex === -1 ? survey.thankYouPage : extraPages[activeIndex]) as ThankYouPage || {} as ThankYouPage;

    const upd = (changes: Partial<typeof ty>) => {
        if (activeIndex === -1) {
            onUpdate({ thankYouPage: { ...ty, ...changes } as any });
        } else {
            const newPages = [...extraPages];
            newPages[activeIndex] = { ...ty, ...changes } as any;
            onUpdate({ thankYouPages: newPages });
        }
    };

    const EMOJIS = ['🎉', '🙏', '✅', '💎', '🚀', '❤️', '⭐', '🔥', '💐', '👏'];

    const addExtraPage = () => {
        const newId = crypto.randomUUID();
        onUpdate({ thankYouPages: [...extraPages, { id: newId, title: 'Trang phụ mới', message: '', emoji: '🎉', showSocialShare: false }] });
        setActiveIndex(extraPages.length);
    };

    const deleteExtraPage = (idx: number) => {
        const newPages = extraPages.filter((_, i) => i !== idx);
        onUpdate({ thankYouPages: newPages });
        setActiveIndex(-1);
    };

    return (
        <div className="space-y-3 relative">
            {deletingIndex !== null && (
                <div className="absolute top-0 inset-x-0 z-50 bg-white/95 backdrop-blur-sm border border-slate-200 p-4 rounded-xl shadow-lg border-l-4 border-l-red-500 animate-in fade-in zoom-in-95">
                    <h3 className="font-bold text-slate-800 text-sm mb-1">Xoá trang kết thúc này?</h3>
                    <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">Người xem đang nhảy đến trang này sẽ bị trả về màn hình cảm ơn mặc định.</p>
                    <div className="flex gap-2">
                        <button onClick={() => setDeletingIndex(null)} className="flex-1 py-1.5 bg-slate-100 font-semibold text-slate-600 rounded-lg text-xs hover:bg-slate-200">Huỷ bỏ</button>
                        <button onClick={() => { deleteExtraPage(deletingIndex); setDeletingIndex(null); }} className="flex-1 py-1.5 bg-red-500 font-semibold text-white rounded-lg text-xs hover:bg-red-600 shadow-sm">Xác nhận xoá</button>
                    </div>
                </div>
            )}
            {/* Screen Selector */}
            <div className="bg-slate-50 border border-slate-200 p-1.5 rounded-xl flex flex-wrap gap-1">
                <button
                    onClick={() => setActiveIndex(-1)}
                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                        activeIndex === -1 ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-200'
                    }`}
                >Mặc định</button>
                {extraPages.map((p, i) => (
                    <div key={p.id ?? i} className={`flex items-center rounded-lg transition-all ${
                        activeIndex === i ? 'bg-amber-500 text-white shadow-sm' : 'bg-transparent text-slate-500 hover:bg-slate-200'
                    }`}>
                        <button
                            onClick={() => setActiveIndex(i)}
                            className="px-3 py-1.5 text-[10px] font-bold truncate max-w-[80px]"
                            title={p.title || `Phụ ${i + 1}`}
                        >
                            {p.title || `Phụ ${i + 1}`}
                        </button>
                        {activeIndex === i && (
                            <button onClick={() => setDeletingIndex(i)} className="pr-2 pl-1 hover:text-amber-200 transition-colors">
                                <Trash2 className="w-3 h-3" />
                            </button>
                        )}
                    </div>
                ))}
                <button onClick={addExtraPage} className="px-2 py-1.5 text-amber-600 hover:bg-amber-100 rounded-lg">
                    <Plus className="w-3 h-3" />
                </button>
            </div>
            <div>
                <Label>Emoji</Label>
                <div className="flex flex-wrap gap-1.5 mb-1">
                    {EMOJIS.map(e => (
                        <button key={e} onClick={() => upd({ emoji: e, title: ty.title })}
                            className={`w-8 h-8 text-lg flex items-center justify-center rounded-lg transition-all ${ty.emoji === e || (!ty.emoji && e === '🎉') ? 'bg-amber-100 ring-2 ring-amber-400' : 'bg-slate-50 hover:bg-slate-100'}`}
                        >{e}</button>
                    ))}
                </div>
                <FieldInput value={ty.emoji ?? ''} onChange={e => upd({ emoji: e.target.value })} placeholder="Nhập emoji tuỳ chỉnh..." />
            </div>
            <div>
                <Label>Tiêu đề</Label>
                <FieldInput value={ty.title} onChange={e => upd({ title: e.target.value })} placeholder="Cảm ơn bạn! 🎉" />
            </div>
            <div>
                <Label>Nội dung</Label>
                <FieldTextarea value={ty.message} onChange={e => upd({ message: e.target.value })} rows={3} placeholder="Phản hồi của bạn đã được ghi nhận..." />
            </div>
            <ImageUploader value={ty.imageUrl ?? ''} onChange={v => upd({ imageUrl: v })} label="Ảnh minh hoạ (tuỳ chọn)" />
            <SectionDivider label="Nút CTA" />
            <div>
                <Label>Text nút</Label>
                <FieldInput value={ty.ctaText ?? ''} onChange={e => upd({ ctaText: e.target.value })} placeholder="VD: Xem kết quả ngay" />
            </div>
            <div>
                <Label>Link nút</Label>
                <FieldInput value={ty.ctaUrl ?? ''} onChange={e => upd({ ctaUrl: e.target.value })} placeholder="https://..." />
            </div>
            {/* Button color */}
            <ColorRow label="Màu nút CTA" value={(ty as any).ctaColor ?? '#f59e0b'} onChange={v => upd({ ...(ty as any), ctaColor: v })} />
            <SectionDivider label="Redirect" />
            <div>
                <Label>URL chuyển hướng</Label>
                <FieldInput value={ty.redirectUrl ?? ''} onChange={e => upd({ redirectUrl: e.target.value })} placeholder="https://..." />
            </div>
            <div>
                <Label>Thời gian chờ (giây)</Label>
                <FieldInput type="number" value={ty.redirectDelay ?? ''} onChange={e => upd({ redirectDelay: +e.target.value })} placeholder="3" />
            </div>
            <Toggle value={ty.showSocialShare} onChange={() => upd({ showSocialShare: !ty.showSocialShare })} label="Chia sẻ mạng xã hội" />
        </div>
    );
};

// ─── Main component ──────────────────────────────────────────────────
const SurveyProperties: React.FC<Props> = ({ survey, selectedBlock, selectedBlockId, onUpdateBlock, onUpdateSurvey }) => {
    const [settingsTab, setSettingsTab] = useState<'theme' | 'settings' | 'thankyou' | 'voucher'>('theme');

    // Auto-switch to thankyou tab when __thankyou__ block is clicked
    React.useEffect(() => {
        if (selectedBlockId?.startsWith('__thankyou')) setSettingsTab('thankyou');
        else if (selectedBlockId === '__cover__') setSettingsTab('theme');
    }, [selectedBlockId]);

    const TABS = [
        { key: 'theme',    label: 'Giao diện', icon: Palette },
        { key: 'settings', label: 'Cấu hình',  icon: Settings2 },
        { key: 'thankyou', label: 'Cảm ơn',    icon: Heart },
        { key: 'voucher',  label: 'Quà tặng',  icon: Zap },
    ] as const;

    // Survey-level settings (nothing selected OR special blocks)
    if (!selectedBlock) {
        return (
            <div className="w-80 bg-white border-l border-slate-100 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.12em] flex items-center gap-2">
                        <Settings className="w-3.5 h-3.5" /> Cài đặt khảo sát
                    </h3>
                </div>
                {/* Icon tabs */}
                <div className="flex border-b border-slate-100">
                    {TABS.map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setSettingsTab(key)}
                            className={`flex-1 py-2.5 flex flex-col items-center gap-0.5 text-[9px] font-bold transition-all ${
                                settingsTab === key
                                    ? 'text-amber-600 border-b-2 border-amber-500'
                                    : 'text-slate-400 hover:text-slate-600'
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">

                    {settingsTab === 'theme' && (
                        <>
                            <ColorRow label="Màu chủ đạo" value={survey.theme?.primaryColor || '#f59e0b'} onChange={v => onUpdateSurvey({ theme: { ...survey.theme, primaryColor: v } })} />
                            <ColorRow label="Màu nền trang" value={survey.theme?.backgroundColor || '#0f172a'} onChange={v => onUpdateSurvey({ theme: { ...survey.theme, backgroundColor: v } })} />
                            <ColorRow label="Màu card" value={survey.theme?.cardBackground || '#ffffff'} onChange={v => onUpdateSurvey({ theme: { ...survey.theme, cardBackground: v } })} />
                            <ShadowRow label="Đổ bóng Card" value={survey.theme?.cardShadow || 'none'} onChange={v => onUpdateSurvey({ theme: { ...survey.theme, cardShadow: v } as any })} />
                            <ColorRow label="Màu chữ" value={survey.theme?.textColor || '#1e293b'} onChange={v => onUpdateSurvey({ theme: { ...survey.theme, textColor: v } })} />
                            <SectionDivider label="Header / Cover" />

                            {/* Cover style toggle */}
                            <div>
                                <Label>Kiểu header</Label>
                                <div className="grid grid-cols-3 gap-1">
                                    {([['minimal', 'Minimal'], ['gradient', 'Gradient'], ['image', 'Ảnh']] as const).map(([s, lbl]) => (
                                        <button key={s} onClick={() => onUpdateSurvey({ theme: { ...survey.theme, coverStyle: s } })}
                                            className={`py-1.5 text-[10px] font-bold rounded-lg capitalize transition-all ${
                                                (survey.theme?.coverStyle ?? 'minimal') === s
                                                    ? 'bg-amber-500 text-white'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                            }`}
                                        >{lbl}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Gradient color pickers when gradient mode */}
                            {survey.theme?.coverStyle === 'gradient' && (
                                <>
                                    <ColorRow label="Màu gradient đầu" value={(survey.theme as any).gradientFrom ?? survey.theme?.primaryColor ?? '#b45309'} onChange={v => onUpdateSurvey({ theme: { ...survey.theme, gradientFrom: v } as any })} />
                                    <ColorRow label="Màu gradient cuối" value={(survey.theme as any).gradientTo ?? '#f59e0b'} onChange={v => onUpdateSurvey({ theme: { ...survey.theme, gradientTo: v } as any })} />
                                </>
                            )}

                            {/* Image uploader first when image mode */}
                            {survey.theme?.coverStyle === 'image' && (
                                <ImageUploader
                                    value={survey.theme?.coverImageUrl ?? ''}
                                    onChange={v => onUpdateSurvey({ theme: { ...survey.theme, coverImageUrl: v } })}
                                    label="Ảnh bên trên (header)"
                                />
                            )}

                            {/* Height selector */}
                            <div>
                                <Label>Chiều cao header</Label>
                                <div className="grid grid-cols-3 gap-1">
                                    {(['sm', 'md', 'lg'] as const).map(h => (
                                        <button key={h} onClick={() => onUpdateSurvey({ theme: { ...survey.theme, coverHeight: h } })}
                                            className={`py-1.5 text-[10px] font-bold rounded-lg uppercase transition-all ${
                                                (survey.theme?.coverHeight ?? 'md') === h
                                                    ? 'bg-amber-500 text-white'
                                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                            }`}
                                        >{h}</button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <Label>Logo URL</Label>
                                <FieldInput value={survey.theme?.logoUrl ?? ''} onChange={e => onUpdateSurvey({ theme: { ...survey.theme, logoUrl: e.target.value } })} placeholder="https://..." />
                            </div>

                            <SectionDivider label="Nội dung Hero / Marketing" />

                            <div>
                                <Label>Badge (Huy hiệu góc trái)</Label>
                                <FieldInput value={survey.theme?.coverBadge ?? ''} onChange={e => onUpdateSurvey({ theme: { ...survey.theme, coverBadge: e.target.value } as any })} placeholder="VD: SALE SỐC" />
                            </div>

                            <div>
                                <Label>Đoạn giới thiệu ngắn</Label>
                                <FieldTextarea 
                                    className="resize-y"
                                    rows={3}
                                    value={survey.theme?.coverDescription ?? ''}
                                    onChange={e => onUpdateSurvey({ theme: { ...survey.theme, coverDescription: e.target.value } as any })}
                                    placeholder="Nhập giới thiệu khảo sát..."
                                />
                            </div>

                            <div>
                                <Label>Đếm ngược tới hẹn</Label>
                                <div className="flex flex-col gap-2">
                                    <FieldInput type="datetime-local" value={survey.theme?.coverCountdown ?? ''} onChange={e => onUpdateSurvey({ theme: { ...survey.theme, coverCountdown: e.target.value } as any })} />
                                    {survey.theme?.coverCountdown && (
                                        <FieldSelect 
                                            value={survey.theme?.coverCountdownPos ?? 'bottom'}
                                            onChange={e => onUpdateSurvey({ theme: { ...survey.theme, coverCountdownPos: e.target.value } as any })}
                                        >
                                            <option value="bottom">Nguyên khối (Dưới cùng)</option>
                                            <option value="top_right">Huy hiệu nhỏ (Góc phải)</option>
                                        </FieldSelect>
                                    )}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <Label>Danh sách nổi bật</Label>
                                    <FieldSelect 
                                        className="!w-24 !py-1 !text-[10px]"
                                        value={survey.theme?.coverFeaturesStyle ?? 'check'}
                                        onChange={e => onUpdateSurvey({ theme: { ...survey.theme, coverFeaturesStyle: e.target.value } as any })}
                                    >
                                        <option value="check">Nút Check</option>
                                        <option value="dot">Dấu Chấm</option>
                                    </FieldSelect>
                                </div>
                                <FieldTextarea 
                                    className="font-mono resize-y"
                                    rows={4}
                                    value={(survey.theme?.coverFeatures ?? []).join('\n')}
                                    onChange={e => onUpdateSurvey({ theme: { ...survey.theme, coverFeatures: e.target.value.split('\n').filter(Boolean) } as any })}
                                    placeholder="Miễn phí 100%&#10;Quà tặng bí mật&#10;Không lộ danh tính"
                                />
                            </div>
                        </>
                    )}

                    {settingsTab === 'settings' && (
                        <>
                            <Toggle value={survey.settings?.showProgressBar} onChange={() => onUpdateSurvey({ settings: { ...survey.settings, showProgressBar: !survey.settings?.showProgressBar } })} label="Thanh tiến trình" />
                            <Toggle value={survey.settings?.allowPartialSubmit} onChange={() => onUpdateSurvey({ settings: { ...survey.settings, allowPartialSubmit: !survey.settings?.allowPartialSubmit } })} label="Cho phép nộp một phần" />
                            <Toggle value={survey.settings?.trackIp} onChange={() => onUpdateSurvey({ settings: { ...survey.settings, trackIp: !survey.settings?.trackIp } })} label="Ghi nhận IP" />
                            
                            <SectionDivider label="Tính năng Trắc nghiệm (Quiz)" />
                            <div>
                                <Toggle
                                    value={!!survey.settings?.quiz?.enabled}
                                    onChange={() => onUpdateSurvey({ settings: { ...survey.settings, quiz: { ...survey.settings?.quiz, enabled: !survey.settings?.quiz?.enabled, scoringType: survey.settings?.quiz?.scoringType || 'immediate', allowRetry: !!survey.settings?.quiz?.allowRetry } } })}
                                    label="Bật chế độ Trắc nghiệm"
                                />
                                <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed pl-9">
                                    Tính điểm cho từng câu hỏi và hiển thị kết quả đúng/sai.
                                </p>
                            </div>
                            
                            {survey.settings?.quiz?.enabled && (
                                <div className="pl-4 border-l-2 border-amber-200 ml-2 space-y-3 mt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <Label>Cơ chế chấm điểm</Label>
                                        <FieldSelect 
                                            value={survey.settings?.quiz?.scoringType || 'immediate'}
                                            onChange={e => onUpdateSurvey({ settings: { ...survey.settings, quiz: { ...survey.settings?.quiz!, scoringType: e.target.value as any } } })}
                                        >
                                            <option value="immediate">Chấm ngay (Hiển thị điểm)</option>
                                            <option value="backend">Ghi nhận (Ẩn điểm số)</option>
                                        </FieldSelect>
                                        {survey.settings?.quiz?.scoringType === 'backend' && (
                                            <p className="text-[9px] text-slate-400 mt-1">Sử dụng trong Automation để rẽ nhánh điểm số ngầm.</p>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <Label>Thời gian làm bài (Phút)</Label>
                                        <FieldInput 
                                            type="number" 
                                            placeholder="0 = Không giới hạn" 
                                            value={survey.settings?.quiz?.timeLimitMins || ''} 
                                            onChange={e => onUpdateSurvey({ settings: { ...survey.settings, quiz: { ...survey.settings?.quiz!, timeLimitMins: e.target.value ? Number(e.target.value) : undefined } } })} 
                                        />
                                    </div>
                                    
                                    <Toggle
                                        value={!!survey.settings?.quiz?.allowRetry}
                                        onChange={() => onUpdateSurvey({ settings: { ...survey.settings, quiz: { ...survey.settings?.quiz!, allowRetry: !survey.settings?.quiz?.allowRetry } } })}
                                        label="Cho phép làm lại bài"
                                    />
                                </div>
                            )}

                            <SectionDivider label="Nhận diện người dùng" />
                            <div>
                                <Toggle
                                    value={!!(survey.settings as any)?.allow_anonymous}
                                    onChange={() => onUpdateSurvey({ settings: { ...survey.settings, allow_anonymous: !(survey.settings as any)?.allow_anonymous } } as any)}
                                    label="Cho phép ẩn danh"
                                />
                                <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed pl-9">
                                    Không yêu cầu email — phản hồi không liên kết với người dùng nào.
                                </p>
                            </div>
                            <div>
                                <Toggle
                                    value={!!(survey.settings as any)?.email_tracking}
                                    onChange={() => onUpdateSurvey({ settings: { ...survey.settings, email_tracking: !(survey.settings as any)?.email_tracking } } as any)}
                                    label="Email tracking"
                                />
                                <p className="text-[9px] text-slate-400 mt-0.5 leading-relaxed pl-9">
                                    Tự nhận diện người dùng qua <code className="bg-slate-100 px-1 rounded text-[9px]">?uid={'{{email}}'}</code> trong link public.
                                </p>
                            </div>
                            <SectionDivider label="Automation Flow" />
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50/30 border border-amber-200/60 rounded-2xl p-4 shadow-sm relative">
                                <div className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/10 rounded-full blur-xl transform translate-x-1/2 -translate-y-1/2" />
                                </div>
                                <div className="flex items-center gap-2 mb-3 relative z-10">
                                    <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center text-amber-500">
                                        <Zap className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="text-[11px] font-black text-amber-900 tracking-tight leading-none uppercase">Kịch bản sau khảo sát</h4>
                                        <p className="text-[9px] text-amber-700/80 mt-0.5 leading-tight">Chăm sóc khách tự động</p>
                                    </div>
                                    {/* Toggle */}
                                    <button
                                        onClick={() => onUpdateSurvey({ flow_trigger_id: (survey as any).flow_trigger_id ? null : 'enable_intent' } as any)}
                                        className={`relative w-10 h-5 rounded-full transition-colors shadow-inner ${
                                            (survey as any).flow_trigger_id ? 'bg-amber-500' : 'bg-slate-300'
                                        }`}
                                    >
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                                            (survey as any).flow_trigger_id ? 'left-5.5 left-[22px]' : 'left-[2px]'
                                        }`} />
                                    </button>
                                </div>
                                
                                {/* Selector conditionally shown */}
                                {(survey as any).flow_trigger_id && (
                                    <div className="relative z-10 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <FlowTriggerSelector
                                            value={(survey as any).flow_trigger_id === 'enable_intent' ? null : (survey as any).flow_trigger_id}
                                            onChange={v => onUpdateSurvey({ flow_trigger_id: v } as any)}
                                        />
                                        <p className="text-[9px] text-amber-800/70 mt-1.5 leading-relaxed font-medium">
                                            Chọn kịch bản "Phản hồi Khảo sát" để gửi Email cảm ơn hoặc gắn Tag ngay khi khách nộp đơn.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {settingsTab === 'thankyou' && (
                        <ThankYouDesigner survey={survey} onUpdate={onUpdateSurvey} selectedBlockId={selectedBlockId} />
                    )}

                    {settingsTab === 'voucher' && (
                        <VoucherConfigurator survey={survey} onUpdateSurvey={onUpdateSurvey} />
                    )}
                </div>
            </div>
        );
    }

    // Block-level properties
    const block = selectedBlock;
    const update = (changes: Partial<SurveyBlock>) => onUpdateBlock(block.id, changes);
    const isLayout = ['section_header', 'image_block', 'divider', 'page_break', 'button_block', 'link_block', 'banner_block'].includes(block.type);

    const handleTypeChange = (newType: import('../../../types/survey').QuestionType) => {
        if (newType === block.type) return;
        
        const changes: Partial<SurveyBlock> = { type: newType };
        
        // 1. Choice types default options
        if (['single_choice', 'multi_choice', 'dropdown', 'ranking'].includes(newType) && (!block.options || block.options.length === 0)) {
            changes.options = [
                { id: crypto.randomUUID(), label: 'Lựa chọn 1', value: '1' },
                { id: crypto.randomUUID(), label: 'Lựa chọn 2', value: '2' },
                { id: crypto.randomUUID(), label: 'Lựa chọn 3', value: '3' },
            ];
        }
        
        // 2. Yes/No default options
        if (newType === 'yes_no' && (!block.options || block.options.length === 0)) {
            changes.options = [
                { id: crypto.randomUUID(), label: 'Có', value: 'yes' },
                { id: crypto.randomUUID(), label: 'Không', value: 'no' },
            ];
        }
        
        // 3. Matrix single/multi default options
        if (['matrix_single', 'matrix_multi'].includes(newType) && (!block.matrixRows || block.matrixRows.length === 0)) {
            changes.matrixRows = [
                { id: crypto.randomUUID(), label: 'Tiêu chí 1' },
                { id: crypto.randomUUID(), label: 'Tiêu chí 2' },
            ];
            changes.matrixCols = [
                { id: crypto.randomUUID(), label: 'Kém' },
                { id: crypto.randomUUID(), label: 'Bình thường' },
                { id: crypto.randomUUID(), label: 'Tốt' },
                { id: crypto.randomUUID(), label: 'Xuất sắc' },
            ];
        }

        // 4. Layout default settings
        if (newType === 'image_block') {
            changes.imageWidth = '100%';
            changes.imageAlign = 'center';
        }
        if (newType === 'button_block') {
            changes.buttonText = 'Nhấn vào đây';
            changes.buttonUrl = '';
            changes.buttonStyle = 'filled';
            changes.buttonAlign = 'center';
            changes.buttonColor = '#f59e0b';
        }
        if (newType === 'link_block') {
            changes.linkText = 'Xem thêm';
            changes.linkUrl = '';
            changes.linkAlign = 'left';
        }
        if (newType === 'banner_block') {
            changes.bannerHeight = 200;
            changes.bannerOverlay = 'rgba(0,0,0,0.35)';
            changes.bannerTextColor = '#ffffff';
        }
        
        update(changes);
    };

    return (
        <div className="w-80 bg-white border-l border-slate-100 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.12em] flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5" /> Cấu hình câu hỏi
                </h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">

                {/* Loại câu hỏi */}
                {!isLayout && (
                    <div>
                        <Label>Loại câu hỏi</Label>
                        <FieldSelect value={block.type} onChange={e => handleTypeChange(e.target.value as any)}>
                            <optgroup label="Cơ bản">
                                <option value="short_text">Văn bản ngắn</option>
                                <option value="long_text">Văn bản dài</option>
                                <option value="email">Email</option>
                                <option value="phone">Số điện thoại</option>
                                <option value="number">Số</option>
                                <option value="date">Ngày tháng</option>
                            </optgroup>
                            <optgroup label="Lựa chọn">
                                <option value="single_choice">Chọn 1 đáp án (Radio)</option>
                                <option value="multi_choice">Chọn nhiều (Checkbox)</option>
                                <option value="dropdown">Dropdown</option>
                                <option value="yes_no">Có / Không</option>
                            </optgroup>
                            <optgroup label="Đánh giá">
                                <option value="star_rating">Đánh giá sao</option>
                                <option value="nps">NPS Score</option>
                                <option value="likert">Thang Likert</option>
                                <option value="slider">Thanh kéo</option>
                                <option value="emoji_rating">Emoji cảm xúc</option>
                            </optgroup>
                            <optgroup label="Nâng cao">
                                <option value="ranking">Xếp hạng</option>
                                <option value="matrix_single">Ma trận (Chọn một)</option>
                                <option value="matrix_multi">Ma trận (Chọn nhiều)</option>
                                <option value="file_upload">Tải tệp lên</option>
                            </optgroup>
                        </FieldSelect>
                    </div>
                )}

                {/* Loại bố cục */}
                {isLayout && (
                    <div>
                        <Label>Loại bố cục</Label>
                        <FieldSelect value={block.type} onChange={e => handleTypeChange(e.target.value as any)}>
                            <option value="section_header">Tiêu đề phần</option>
                            <option value="image_block">Hình ảnh</option>
                            <option value="button_block">Nút bấm</option>
                            <option value="link_block">Đường dẫn</option>
                            <option value="banner_block">Banner</option>
                            <option value="divider">Đường kẻ</option>
                            <option value="page_break">Ngắt trang</option>
                        </FieldSelect>
                    </div>
                )}

                {/* Label */}
                {!['divider', 'page_break', 'button_block', 'link_block'].includes(block.type) && (
                    <div>
                        <Label>Câu hỏi / Tiêu đề</Label>
                        <FieldTextarea value={block.label} onChange={e => update({ label: e.target.value })} rows={2} />
                    </div>
                )}

                {/* Description */}
                {!['divider', 'page_break', 'button_block', 'link_block', 'banner_block'].includes(block.type) && (
                    <div>
                        <Label>Mô tả phụ (tuỳ chọn)</Label>
                        <FieldInput value={block.description ?? ''} onChange={e => update({ description: e.target.value })} placeholder="Gợi ý cho người điền..." />
                    </div>
                )}

                {/* Required */}
                {!isLayout && (
                    <Toggle value={block.required} onChange={() => update({ required: !block.required })} label="Bắt buộc trả lời" />
                )}

                {/* ─ Quiz config ─ */}
                {survey.settings?.quiz?.enabled && !isLayout && (
                    <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 space-y-2.5 mt-2">
                        <div className="flex items-center gap-1.5 mb-1">
                            <Zap className="w-3.5 h-3.5 text-amber-500" />
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Cấu hình Đáp án & Điểm</span>
                        </div>
                        <div>
                            <Label>Điểm số định mức</Label>
                            <FieldInput type="number" placeholder="Ví dụ: 10" value={block.quizPoints ?? ''} onChange={e => update({ quizPoints: Number(e.target.value) })} />
                        </div>
                        {['single_choice', 'dropdown', 'yes_no'].includes(block.type) && (
                            <div>
                                <Label>Đáp án đúng</Label>
                                <FieldSelect value={String(block.correctAnswer ?? '')} onChange={e => update({ correctAnswer: e.target.value })}>
                                    <option value="">-- Chọn đáp án đúng --</option>
                                    {(block.options ?? []).map(o => (
                                        <option key={o.id} value={o.value}>{o.label}</option>
                                    ))}
                                </FieldSelect>
                            </div>
                        )}
                        {block.type === 'multi_choice' && (
                            <div>
                                <Label>Đáp án đúng (Nhập Value, cách nhau bởi phẩy)</Label>
                                <FieldInput placeholder="Ví dụ: value_1, value_2" value={Array.isArray(block.correctAnswer) ? block.correctAnswer.join(', ') : block.correctAnswer ?? ''} onChange={e => update({ correctAnswer: e.target.value.split(',').map(s => s.trim()) })} />
                            </div>
                        )}
                        {['short_text', 'number'].includes(block.type) && (
                            <div className="space-y-2.5">
                                <div>
                                    <Label>Kiểu khớp đáp án</Label>
                                    <FieldSelect
                                        value={block.correctAnswerMatch || 'exact'}
                                        onChange={e => update({ correctAnswerMatch: e.target.value as any })}
                                    >
                                        <option value="exact">Khớp chính xác</option>
                                        <option value="contains">Bao hàm (Chứa từ khoá)</option>
                                    </FieldSelect>
                                </div>
                                <div>
                                    <Label>Đáp án đúng ({block.correctAnswerMatch === 'contains' ? 'chứa chuỗi' : 'khớp chính xác'})</Label>
                                    <FieldInput placeholder="Ví dụ: 100 hoặc Paris" value={String(block.correctAnswer ?? '')} onChange={e => update({ correctAnswer: e.target.value })} />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ─ Text input config ─ */}
                {['short_text', 'long_text', 'email', 'phone', 'number'].includes(block.type) && (
                    <div>
                        <Label>Placeholder</Label>
                        <FieldInput value={block.placeholder ?? ''} onChange={e => update({ placeholder: e.target.value })} placeholder="Ví dụ: Nhập tên của bạn..." />
                    </div>
                )}

                {/* ─ Choice options ─ */}
                {['single_choice', 'multi_choice', 'dropdown', 'yes_no', 'ranking'].includes(block.type) && (
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <Label>Lựa chọn</Label>
                            <button
                                onClick={() => update({ options: [...(block.options ?? []), { id: crypto.randomUUID(), label: `Lựa chọn ${(block.options?.length ?? 0) + 1}`, value: String((block.options?.length ?? 0) + 1) }] })}
                                className="flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-700 font-bold"
                            >
                                <Plus className="w-3 h-3" /> Thêm
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {(block.options ?? []).map(opt => (
                                <div key={opt.id} className="flex items-center gap-1.5">
                                    <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0" />
                                    <FieldInput
                                        value={opt.label}
                                        onChange={e => update({ options: block.options?.map(o => o.id === opt.id ? { ...o, label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '_') } : o) })}
                                        className="!px-2 !py-1 !text-xs !bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-300"
                                    />
                                    <button onClick={() => update({ options: block.options?.filter(o => o.id !== opt.id) })} className="p-1 text-slate-300 hover:text-red-400 transition-colors">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        {['single_choice', 'multi_choice'].includes(block.type) && (
                            <div className="mt-2">
                                <Toggle value={!!block.allowOther} onChange={() => update({ allowOther: !block.allowOther })} label='Thêm ô "Khác..."' />
                            </div>
                        )}
                    </div>
                )}

                {/* ─ Matrix editor ─ */}
                {['matrix_single', 'matrix_multi'].includes(block.type) && (
                    <MatrixEditor
                        rows={block.matrixRows ?? []}
                        cols={block.matrixCols ?? []}
                        onChangeRows={rows => update({ matrixRows: rows })}
                        onChangeCols={cols => update({ matrixCols: cols })}
                    />
                )}

                {/* ─ Date config ─ */}
                {block.type === 'date' && (
                    <>
                        <div>
                            <Label>Chế độ</Label>
                            <div className="grid grid-cols-2 gap-1">
                                <button
                                    onClick={() => update({ dateMode: 'date' } as any)}
                                    className={`py-1.5 flex items-center justify-center gap-1.5 text-[10px] font-bold rounded-lg transition-all ${

                                        (block as any).dateMode !== 'datetime' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                >
                                    <Calendar className="w-3 h-3" /> Chỉ ngày
                                </button>
                                <button
                                    onClick={() => update({ dateMode: 'datetime' } as any)}
                                    className={`py-1.5 flex items-center justify-center gap-1.5 text-[10px] font-bold rounded-lg transition-all ${
                                        (block as any).dateMode === 'datetime' ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                                >
                                    <Clock className="w-3 h-3" /> Ngày + giờ
                                </button>
                            </div>
                        </div>
                    </>
                )}

                {/* ─ Likert editor ─ */}
                {block.type === 'likert' && (
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <Label>Các mức đánh giá</Label>
                            <button
                                onClick={() => {
                                    const cur = (block as any).likertPoints ?? [
                                        { value: 1, label: (block.likertLabels ?? [])[0] ?? 'Rất không đồng ý' },
                                        { value: 2, label: (block.likertLabels ?? [])[1] ?? 'Không đồng ý' },
                                        { value: 3, label: (block.likertLabels ?? [])[2] ?? 'Bình thường' },
                                        { value: 4, label: (block.likertLabels ?? [])[3] ?? 'Đồng ý' },
                                        { value: 5, label: (block.likertLabels ?? [])[4] ?? 'Rất đồng ý' },
                                    ];
                                    const next = [...cur, { value: cur.length + 1, label: `Mức ${cur.length + 1}` }];
                                    update({ likertPoints: next, likertLabels: next.map((p: any) => p.label) } as any);
                                }}
                                className="flex items-center gap-1 text-[10px] text-amber-600 hover:text-amber-700 font-bold"
                            >
                                <Plus className="w-3 h-3" /> Thêm
                            </button>
                        </div>
                        <div className="space-y-1.5">
                            {((block as any).likertPoints ?? [
                                { value: 1, label: (block.likertLabels ?? [])[0] ?? 'Rất không đồng ý' },
                                { value: 2, label: (block.likertLabels ?? [])[1] ?? 'Không đồng ý' },
                                { value: 3, label: (block.likertLabels ?? [])[2] ?? 'Bình thường' },
                                { value: 4, label: (block.likertLabels ?? [])[3] ?? 'Đồng ý' },
                                { value: 5, label: (block.likertLabels ?? [])[4] ?? 'Rất đồng ý' },
                            ] as any[]).map((pt: any, i: number) => {
                                const pts: any[] = (block as any).likertPoints ?? [
                                    { value: 1, label: 'Rất không đồng ý' },
                                    { value: 2, label: 'Không đồng ý' },
                                    { value: 3, label: 'Bình thường' },
                                    { value: 4, label: 'Đồng ý' },
                                    { value: 5, label: 'Rất đồng ý' },
                                ];
                                return (
                                    <div key={i} className="flex items-center gap-1.5">
                                        <GripVertical className="w-3 h-3 text-slate-300 flex-shrink-0" />
                                        {/* Number */}
                                        <FieldInput
                                            type="number"
                                            value={pt.value}
                                            onChange={e => {
                                                const updated = pts.map((p: any, j: number) => j === i ? { ...p, value: +e.target.value } : p);
                                                update({ likertPoints: updated, likertLabels: updated.map((p: any) => p.label) } as any);
                                            }}
                                            className="w-14 !px-1.5 !py-1 !text-xs !bg-slate-50 border border-slate-200 rounded-lg text-center"
                                        />
                                        {/* Label */}
                                        <FieldInput
                                            value={pt.label}
                                            onChange={e => {
                                                const updated = pts.map((p: any, j: number) => j === i ? { ...p, label: e.target.value } : p);
                                                update({ likertPoints: updated, likertLabels: updated.map((p: any) => p.label) } as any);
                                            }}
                                            className="!px-2 !py-1 !text-xs !bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
                                        />
                                        <button
                                            onClick={() => {
                                                const updated = pts.filter((_: any, j: number) => j !== i);
                                                update({ likertPoints: updated, likertLabels: updated.map((p: any) => p.label) } as any);
                                            }}
                                            className="p-1 text-slate-300 hover:text-red-400 transition-colors"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ─ Rating config ─ */}
                {['star_rating', 'slider'].includes(block.type) && (
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label>Min</Label>
                            <FieldInput type="number" value={block.minValue ?? 0} onChange={e => update({ minValue: +e.target.value })} />
                        </div>
                        <div>
                            <Label>Max</Label>
                            <FieldInput type="number" value={block.maxValue ?? 5} onChange={e => update({ maxValue: +e.target.value })} />
                        </div>
                    </div>
                )}

                {['nps', 'slider'].includes(block.type) && (
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <Label>Nhãn min</Label>
                            <FieldInput value={block.minLabel ?? ''} onChange={e => update({ minLabel: e.target.value })} />
                        </div>
                        <div>
                            <Label>Nhãn max</Label>
                            <FieldInput value={block.maxLabel ?? ''} onChange={e => update({ maxLabel: e.target.value })} />
                        </div>
                    </div>
                )}

                {/* ─ Image block ─ */}
                {block.type === 'image_block' && (
                    <>
                        <ImageUploader value={block.imageUrl ?? ''} onChange={v => update({ imageUrl: v })} />
                        <div>
                            <Label>Căn chỉnh</Label>
                            <AlignButtons value={block.imageAlign ?? 'center'} onChange={v => update({ imageAlign: v })} />
                        </div>
                        <div>
                            <Label>Độ rộng</Label>
                            <div className="grid grid-cols-4 gap-1">
                                {(['25%', '50%', '75%', '100%'] as const).map(w => (
                                    <button key={w} onClick={() => update({ imageWidth: w })}
                                        className={`py-1 text-[10px] font-bold rounded-lg transition-all ${(block.imageWidth ?? '100%') === w ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >{w}</button>
                                ))}
                            </div>
                        </div>
                    </>
                )}

                {/* ─ Button block ─ */}
                {block.type === 'button_block' && (
                    <>
                        <div>
                            <Label>Text nút</Label>
                            <FieldInput value={block.buttonText ?? ''} onChange={e => update({ buttonText: e.target.value })} placeholder="Nhấn vào đây" />
                        </div>
                        <div>
                            <Label>Link</Label>
                            <FieldInput value={block.buttonUrl ?? ''} onChange={e => update({ buttonUrl: e.target.value })} placeholder="https://..." />
                        </div>
                        <div>
                            <Label>Kiểu nút</Label>
                            <div className="grid grid-cols-3 gap-1">
                                {(['filled', 'outline', 'ghost'] as const).map(s => (
                                    <button key={s} onClick={() => update({ buttonStyle: s })}
                                        className={`py-1.5 text-[10px] font-bold rounded-lg capitalize transition-all ${(block.buttonStyle ?? 'filled') === s ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                    >{s}</button>
                                ))}
                            </div>
                        </div>
                        <ColorRow label="Màu nút" value={block.buttonColor ?? '#f59e0b'} onChange={v => update({ buttonColor: v })} />
                        <ShadowRow label="Đổ bóng nút" value={block.buttonShadow ?? 'none'} onChange={v => update({ buttonShadow: v })} />
                        <div>
                            <Label>Căn chỉnh</Label>
                            <AlignButtons value={block.buttonAlign ?? 'center'} onChange={v => update({ buttonAlign: v })} />
                        </div>
                    </>
                )}

                {/* ─ Link block ─ */}
                {block.type === 'link_block' && (
                    <>
                        <div>
                            <Label>Text hiển thị</Label>
                            <FieldInput value={block.linkText ?? ''} onChange={e => update({ linkText: e.target.value })} placeholder="Xem thêm" />
                        </div>
                        <div>
                            <Label>URL</Label>
                            <FieldInput value={block.linkUrl ?? ''} onChange={e => update({ linkUrl: e.target.value })} placeholder="https://..." />
                        </div>
                        <div>
                            <Label>Căn chỉnh</Label>
                            <AlignButtons value={block.linkAlign ?? 'left'} onChange={v => update({ linkAlign: v })} />
                        </div>
                    </>
                )}

                {/* ─ Banner block ─ */}
                {block.type === 'banner_block' && (
                    <>
                        <div>
                            <Label>Tiêu đề banner</Label>
                            <FieldInput value={block.label} onChange={e => update({ label: e.target.value })} />
                        </div>
                        <div>
                            <Label>Mô tả</Label>
                            <FieldTextarea value={block.description ?? ''} onChange={e => update({ description: e.target.value })} rows={2} />
                        </div>
                        <ImageUploader value={block.bannerImageUrl ?? ''} onChange={v => update({ bannerImageUrl: v })} label="Ảnh nền banner" />
                        <div>
                            <Label>Chiều cao (px)</Label>
                            <FieldInput type="number" value={block.bannerHeight ?? 200} onChange={e => update({ bannerHeight: +e.target.value })} />
                        </div>
                        <ColorRow label="Màu overlay" value={block.bannerOverlay ?? 'rgba(0,0,0,0.35)'} onChange={v => update({ bannerOverlay: v })} />
                        <ColorRow label="Màu chữ" value={block.bannerTextColor ?? '#ffffff'} onChange={v => update({ bannerTextColor: v })} />
                    </>
                )}

                {/* ─ Block color override ─ */}
                {!['divider', 'page_break'].includes(block.type) && (
                    <>
                        <SectionDivider label="Màu sắc khối" />
                        <ColorRow label="Màu nền" value={block.style?.backgroundColor ?? '#ffffff'} onChange={v => update({ style: { ...block.style, backgroundColor: v } })} />
                        <ShadowRow label="Đổ bóng khối" value={block.style?.boxShadow ?? 'none'} onChange={v => update({ style: { ...block.style, boxShadow: v } })} />
                        <ColorRow label="Màu chữ" value={block.style?.textColor ?? '#1e293b'} onChange={v => update({ style: { ...block.style, textColor: v } })} />
                        <div>
                            <Label>Căn chỉnh nội dung</Label>
                            <AlignButtons value={block.style?.textAlign ?? 'left'} onChange={v => update({ style: { ...block.style, textAlign: v } })} />
                        </div>
                    </>
                )}


            </div>
        </div>
    );
};

export default SurveyProperties;
