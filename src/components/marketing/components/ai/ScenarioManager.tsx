/**
 * ScenarioManager.tsx
 * Quản lý danh sách kịch bản hội thoại.
 * - Click vào ScenarioCard → mở modal canvas giống Flow Designer
 * - Canvas của scenario dùng ScenarioCanvas (dot-grid, zoomable, branching)
 */
import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom';
import { api } from '../../services/storageAdapter';
import { toast } from 'react-hot-toast';
import {
    Plus, Trash2, Edit2, Save, X, ChevronUp, ChevronDown,
    MessageSquare, AlertCircle, CheckCircle2, BookOpen,
    ArrowUp, ArrowDown, Play, CircleDashed, Download, Upload,
    FileText, Copy, GripVertical, GitBranch, FormInput,
    Hash, Regex as RegexIcon, Zap, Settings2, Bot, PieChart
} from 'lucide-react';
import ScenarioCanvas, { ScenarioNode } from './ScenarioCanvas';
import { getMktPortalRoot } from '../../utils/portalRoot';

// ────────────────────────────────────────────────────────────────
//  Types
// ────────────────────────────────────────────────────────────────
export interface ScenarioButton { id: string; label: string; action?: string; }

export interface Scenario {
    id: string;
    property_id: string;
    title: string;
    trigger_keywords: string;
    match_mode: 'contains' | 'exact' | 'regex';
    reply_text: string;
    buttons: ScenarioButton[];
    flow_data?: { nodes: ScenarioNode[] } | string;
    is_active: number;
    priority: number;
    created_at?: string;
    updated_at?: string;
}

interface Props {
    propertyId: string;
    isDarkTheme?: boolean;
    brandColor?: string;
}

// ────────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 10);

function parseFlowNodes(scenario: Partial<Scenario>): ScenarioNode[] {
    try {
        const fd = typeof scenario.flow_data === 'string'
            ? JSON.parse(scenario.flow_data)
            : scenario.flow_data;
        if (fd?.nodes?.length) return fd.nodes;
    } catch {}
    // Build from legacy flat fields
    return [{
        id: 'root',
        text: scenario.reply_text || '',
        buttons: (scenario.buttons || []).map(b => ({ id: b.id, label: b.label, next_node: b.action || '' })),
        actions: [],
    }];
}

// ────────────────────────────────────────────────────────────────
//  Scenario Flow Modal — full-screen canvas editor
// ────────────────────────────────────────────────────────────────
const ScenarioFlowModal: React.FC<{
    initialScenario: Partial<Scenario>;
    propertyId: string;
    isDark?: boolean;
    loading?: boolean;
    onSave: (data: Omit<Scenario, 'id' | 'created_at' | 'updated_at'>) => void;
    onClose: () => void;
}> = ({ initialScenario, propertyId, isDark, loading, onSave, onClose }) => {

    const [animateIn, setAnimateIn] = useState(false);
    const [title, setTitle] = useState(initialScenario.title || '');
    const [keywords, setKeywords] = useState(initialScenario.trigger_keywords || '');
    const [matchMode, setMatchMode] = useState<'contains' | 'exact' | 'regex'>(initialScenario.match_mode || 'contains');
    const [isActive, setIsActive] = useState<number>(initialScenario.is_active ?? 1);
    const [nodes, setNodes] = useState<ScenarioNode[]>(() => parseFlowNodes(initialScenario));
    const [showMeta, setShowMeta] = useState(true);

    useEffect(() => { const t = setTimeout(() => setAnimateIn(true), 10); return () => clearTimeout(t); }, []);

    const handleClose = () => { setAnimateIn(false); setTimeout(onClose, 350); };

    const handleSave = () => {
        if (!title.trim()) { toast.error('Vui lòng nhập tên kịch bản'); return; }
        if (!keywords.trim()) { toast.error('Vui lòng nhập từ khóa kích hoạt'); return; }
        const root = nodes.find(n => n.id === 'root');
        if (!root?.text?.replace(/\|/g, '').trim()) { toast.error('Vui lòng nhập nội dung trả lời ở bước đầu tiên'); return; }

        onSave({
            property_id: propertyId,
            title,
            trigger_keywords: keywords,
            match_mode: matchMode,
            reply_text: root.text.split('|||')[0].trim(),
            buttons: (root.buttons || []).map(b => ({ id: b.id, label: b.label, action: b.next_node || '' })),
            flow_data: JSON.stringify({ nodes }),
            is_active: isActive,
            priority: initialScenario.priority || 0,
        });
    };

    const isEditing = !!initialScenario.id;

    return ReactDOM.createPortal(
        <div className={`fixed inset-0 z-[9999] flex flex-col ${animateIn ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            {/* Blur overlay – no backdrop click on fullscreen */}
            <div className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ${animateIn ? 'opacity-100' : 'opacity-0'}`} />

            {/* Main modal – true fullscreen */}
            <div className={`relative flex flex-col inset-0 overflow-hidden shadow-2xl transition-all duration-300
                ${isDark ? 'bg-slate-950' : 'bg-[#f4f6f9]'}
                ${animateIn ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.98]'}`}
                style={{ position: 'absolute', inset: 0 }}
            >

                {/* ── Topbar ────────────────────────────────────────── */}
                <div className={`flex items-center justify-between px-6 py-3.5 border-b shrink-0 z-10
                    ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>

                    {/* Left: Title bar */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shrink-0">
                            <GitBranch className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Tên kịch bản (VD: Tư vấn học phí EMBA)..."
                                className={`w-full max-w-md bg-transparent border-none outline-none text-base font-bold placeholder-slate-400
                                    ${isDark ? 'text-white' : 'text-slate-800'}`}
                            />
                            <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                {isEditing ? 'Chỉnh sửa kịch bản' : 'Kịch bản mới'} · Luồng hội thoại đa tầng
                            </p>
                        </div>
                    </div>

                    {/* Center toolbar: match mode */}
                    <div className="flex items-center gap-2 shrink-0">
                        {([
                            { v: 'contains' as const, label: 'Chứa từ', icon: Hash },
                            { v: 'exact'    as const, label: 'Chính xác', icon: CheckCircle2 },
                            { v: 'regex'    as const, label: 'Regex', icon: RegexIcon },
                        ]).map(opt => (
                            <button key={opt.v} onClick={() => setMatchMode(opt.v)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold border transition-all
                                    ${matchMode === opt.v
                                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                        : (isDark ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600' : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300')
                                    }`}
                            >
                                <opt.icon className="w-3 h-3" />
                                {opt.label}
                            </button>
                        ))}

                        {/* Active toggle */}
                        <button
                            onClick={() => setIsActive(v => v ? 0 : 1)}
                            className={`w-11 h-6 rounded-full transition-all duration-300 flex items-center px-1 shadow-inner ml-2
                                ${isActive ? 'bg-emerald-400 justify-end' : (isDark ? 'bg-slate-700 justify-start' : 'bg-slate-200 justify-start')}`}
                            title={isActive ? 'Đang bật' : 'Đang tắt'}
                        >
                            <div className="w-4 h-4 bg-white rounded-full shadow-md ring-1 ring-black/5" />
                        </button>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                        <button onClick={handleClose}
                            className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                            <X className="w-5 h-5" />
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading}
                            className="flex items-center gap-2 h-9 px-5 rounded-xl text-sm font-bold text-white bg-orange-500 hover:bg-orange-600 shadow-md shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 12 0 12 12h4z" />
                                </svg>
                            ) : <Save className="w-4 h-4" />}
                            {isEditing ? 'Lưu' : 'Tạo kịch bản'}
                        </button>
                    </div>
                </div>

                {/* ── Keywords bar ──────────────────────────────────── */}
                <div className={`flex items-center gap-3 px-6 py-2.5 border-b shrink-0 z-10
                    ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50/80 border-slate-100'}`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest shrink-0 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        Từ khóa kích hoạt:
                    </span>
                    <input
                        type="text"
                        value={keywords}
                        onChange={e => setKeywords(e.target.value)}
                        placeholder="học phí, giá, bao nhiêu tiền, chi phí... (cách nhau bằng dấu phẩy)"
                        className={`flex-1 bg-transparent border-none outline-none text-sm font-medium placeholder-slate-400
                            ${isDark ? 'text-slate-300' : 'text-slate-700'}`}
                    />
                    {/* Info pill */}
                    <div className={`flex items-center gap-1.5 shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full border
                        ${isDark ? 'border-blue-500/20 bg-blue-500/10 text-blue-400' : 'border-blue-100 bg-blue-50 text-blue-500'}`}>
                        <AlertCircle className="w-3 h-3" />
                        Click node để chỉnh sửa · Kéo thả để di chuyển canvas
                    </div>
                </div>

                {/* ── Canvas area ────────────────────────────────────── */}
                <div className="flex-1 min-h-0" style={{ display: 'flex', flexDirection: 'column' }}>
                    <ScenarioCanvas
                        nodes={nodes}
                        onChange={setNodes}
                        keywords={keywords}
                        onKeywordsChange={setKeywords}
                        isDark={isDark}
                        readOnly={false}
                    />
                </div>
            </div>
        </div>,
        getMktPortalRoot()
    );
};

// ────────────────────────────────────────────────────────────────
//  Scenario Card
// ────────────────────────────────────────────────────────────────
const ScenarioCard: React.FC<{
    scenario: Scenario;
    isDark?: boolean;
    onEdit: () => void;
    onDelete: () => void;
    onToggle: () => void;
    onClone: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
}> = ({ scenario, isDark, onEdit, onDelete, onToggle, onClone, onMoveUp, onMoveDown }) => {
    const keywords = scenario.trigger_keywords
        ? scenario.trigger_keywords.split(',').map(k => k.trim()).filter(Boolean)
        : [];

    let nodeCount = 0;
    try {
        const fd = typeof scenario.flow_data === 'string'
            ? JSON.parse(scenario.flow_data as string) : scenario.flow_data;
        if (fd?.nodes) nodeCount = fd.nodes.length;
    } catch {}

    const matchColor = {
        contains: isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600',
        exact:    isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600',
        regex:    isDark ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-600',
    }[scenario.match_mode] || '';

    return (
        <div
            className={`rounded-[20px] transition-all duration-300 group relative flex flex-col md:flex-row md:items-center p-5 gap-5 border cursor-pointer hover:-translate-y-0.5
                ${isDark ? 'bg-slate-800/60 border-slate-700 hover:border-blue-500/40 hover:shadow-[0_8px_30px_rgba(59,130,246,0.1)]' : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-[0_12px_30px_rgba(0,0,0,0.06)] shadow-sm'}
                ${!scenario.is_active ? 'opacity-60 saturate-50' : ''}`}
            onClick={onEdit}
        >
            {/* Grab handle */}
            <div className={`absolute left-2 top-1/2 -translate-y-1/2 shrink-0 cursor-grab flow-interactive opacity-0 group-hover:opacity-100 transition-opacity ${isDark ? 'text-slate-600 hover:text-slate-400' : 'text-slate-300 hover:text-slate-500'}`}
                onClick={e => e.stopPropagation()}>
                <GripVertical className="w-5 h-5" />
            </div>

            {/* Icon */}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ml-2 transition-all ${scenario.is_active ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-500/20' : (isDark ? 'bg-slate-700' : 'bg-slate-200')}`}>
                <PieChart className={`w-6 h-6 ${scenario.is_active ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`} />
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2.5 mb-1.5">
                    <h4 className={`text-[15px] font-bold truncate ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                        {scenario.title || 'Kịch bản chưa đặt tên'}
                    </h4>
                    <span className={`text-[9.5px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${matchColor}`}>
                        {scenario.match_mode}
                    </span>
                    {nodeCount > 1 && (
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${isDark ? 'bg-slate-700/50 border-slate-600 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                            <GitBranch className="w-3 h-3" /> {nodeCount} steps
                        </span>
                    )}
                    {!scenario.is_active && (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-rose-100 border border-rose-200 text-rose-500">ĐÃ TẮT</span>
                    )}
                </div>

                <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[11px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Từ khóa:</span>
                    <div className="flex flex-wrap gap-1.5">
                        {keywords.slice(0, 4).map((kw, i) => (
                            <span key={i} className={`text-[10px] font-bold px-2 py-0.5 rounded border inline-block max-w-[120px] truncate ${isDark ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
                                {kw}
                            </span>
                        ))}
                        {keywords.length > 4 && <span className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>+{keywords.length - 4}</span>}
                    </div>
                </div>

                <p className={`text-sm line-clamp-1 pr-4 leading-relaxed ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    {scenario.reply_text || <span className="italic opacity-50">Chưa thiết lập nội dung trả lời đầu tiên</span>}
                </p>
            </div>

            {/* Actions (Right) */}
            <div className="flex md:flex-col items-center justify-between gap-3 shrink-0 md:pl-5 md:border-l border-slate-100/10">
                <div className="flex items-center gap-1.5 w-full justify-end" onClick={e => e.stopPropagation()}>
                    <button onClick={onMoveUp} className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-slate-700 text-slate-500 hover:text-slate-300' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                        <ArrowUp className="w-4 h-4" />
                    </button>
                    <button onClick={onMoveDown} className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-slate-700 text-slate-500 hover:text-slate-300' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'}`}>
                        <ArrowDown className="w-4 h-4" />
                    </button>
                    
                    <div className="w-2" /> {/* Space */}
                    
                    <button onClick={onClone} title="Nhân bản" className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-700'}`}>
                        <Copy className="w-4 h-4" />
                    </button>
                    <button onClick={onEdit} title="Sửa Canvas" className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-slate-700 text-slate-400 hover:text-blue-400' : 'hover:bg-blue-50 text-slate-400 hover:text-blue-600'}`}>
                        <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Xóa"
                        className={`p-1.5 rounded-lg transition-all ${isDark ? 'hover:bg-rose-500/20 text-slate-500 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-500'}`}>
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
                
                <div className="w-full flex justify-end" onClick={e => e.stopPropagation()}>
                    <button onClick={onToggle}
                        className={`w-11 h-6 rounded-full p-1 transition-all duration-300 flex items-center shrink-0 shadow-inner ${scenario.is_active ? 'bg-emerald-500 justify-end' : (isDark ? 'bg-slate-700 justify-start' : 'bg-slate-200 justify-start')}`}>
                        <div className="w-4 h-4 bg-white rounded-full shadow border-black/5" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ────────────────────────────────────────────────────────────────
//  CSV helpers
// ────────────────────────────────────────────────────────────────
const CSV_HEADERS = ['title', 'trigger_keywords', 'match_mode', 'reply_text', 'buttons', 'is_active'];

function scenariosToCSV(scenarios: Scenario[]): string {
    const e = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [CSV_HEADERS.join(','), ...scenarios.map(s =>
        [e(s.title), e(s.trigger_keywords), e(s.match_mode), e(s.reply_text),
         e(s.buttons.map(b => b.label).join(' | ')), String(s.is_active)].join(',')
    )].join('\n');
}

function csvTemplateString(): string {
    return [CSV_HEADERS.join(','),
        ['"Hỏi học phí EMBA"', '"học phí, bao nhiêu tiền, giá emba"', 'contains', '"Dạ, học phí chương trình EMBA là 120 triệu."', '"Tư vấn ngay | Xem lịch học"', '1'].join(','),
        ['"Đăng ký xét tuyển"', '"đăng ký, xét tuyển, apply"', 'contains', '"Để đăng ký xét tuyển, Anh/chị điền form nhé!"', '"Điền form | Gọi tư vấn"', '1'].join(','),
    ].join('\n');
}

function parseCSVToScenarios(csv: string, propertyId: string) {
    const rows: string[][] = [];
    let row: string[] = []; let field = ''; let inQ = false;
    for (let i = 0; i < csv.length; i++) {
        const c = csv[i], nc = csv[i + 1];
        if (c === '"') { if (inQ && nc === '"') { field += '"'; i++; } else inQ = !inQ; }
        else if (c === ',' && !inQ) { row.push(field); field = ''; }
        else if ((c === '\r' || c === '\n') && !inQ) {
            if (c === '\r' && nc === '\n') i++;
            row.push(field); if (row.some(f => f.trim())) rows.push(row);
            row = []; field = '';
        } else field += c;
    }
    if (row.length > 0 || field) { row.push(field); rows.push(row); }
    if (rows.length < 2) throw new Error('File CSV không hợp lệ hoặc trống');

    return rows.slice(1).filter(cols => cols.length >= 4).map(cols => {
        const [title, trigger_keywords, mm, reply_text, buttons_raw, iar] = cols.map(c => c.trim());
        const match_mode = (['contains', 'exact', 'regex'] as const).includes(mm as any) ? mm as any : 'contains';
        const buttons = (buttons_raw || '').split('|').map(b => b.trim()).filter(Boolean).slice(0, 4)
            .map(label => ({ id: Math.random().toString(36).slice(2), label }));
        return { property_id: propertyId, title, trigger_keywords, match_mode, reply_text, buttons, is_active: iar === '0' ? 0 : 1, priority: 0 };
    });
}

// ────────────────────────────────────────────────────────────────
//  Main ScenarioManager
// ────────────────────────────────────────────────────────────────
const ScenarioManager: React.FC<Props> = ({ propertyId, isDarkTheme, brandColor }) => {
    const isDark = isDarkTheme;
    const accent = brandColor || '#2563eb';

    const [scenarios, setScenarios] = useState<Scenario[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [globalEnabled, setGlobalEnabled] = useState(true);
    const [globalLoading, setGlobalLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const csvInputRef = useRef<HTMLInputElement>(null);

    // Modal state
    const [modalScenario, setModalScenario] = useState<Partial<Scenario> | null>(null);

    const fetchScenarios = useCallback(async () => {
        if (!propertyId) return;
        setLoading(true);
        try {
            const res = await api.get<any>(`ai_scenarios?action=list&property_id=${propertyId}`);
            if (res.success) {
                setScenarios((res as any).data || []);
                setGlobalEnabled((res as any).scenarios_enabled !== false);
            }
        } catch { toast.error('Không thể tải kịch bản'); }
        finally { setLoading(false); }
    }, [propertyId]);

    useEffect(() => { fetchScenarios(); }, [fetchScenarios]);

    // ── Open modal ───────────────────────────────────────────────
    const openCreate = () => setModalScenario({});
    const openEdit = (s: Scenario) => setModalScenario(s);
    const closeModal = () => setModalScenario(null);

    // ── Save ─────────────────────────────────────────────────────
    const handleSave = async (data: Omit<Scenario, 'id' | 'created_at' | 'updated_at'>) => {
        setSaving(true);
        try {
            if (modalScenario?.id) {
                const res = await api.post<any>('ai_scenarios?action=update', {
                    id: modalScenario.id, ...data, property_id: propertyId,
                    buttons: JSON.stringify(data.buttons)
                });
                if (res.success) { toast.success('Đã cập nhật kịch bản'); closeModal(); fetchScenarios(); }
                else toast.error(res.message || 'Lỗi cập nhật');
            } else {
                const res = await api.post<any>('ai_scenarios?action=create', {
                    ...data, property_id: propertyId, buttons: JSON.stringify(data.buttons)
                });
                if (res.success) { toast.success('Đã tạo kịch bản mới 🎭'); closeModal(); fetchScenarios(); }
                else toast.error(res.message || 'Lỗi tạo kịch bản');
            }
        } catch { toast.error('Lỗi kết nối'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string) => {
        // [FIX P42-SC] Replaced window.confirm (thread-blocking) with toast confirmation
        toast((t) => (
            <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700">Xóa kịch bản vĩnh viễn?</span>
                <button
                    onClick={async () => {
                        toast.dismiss(t.id);
                        try {
                            const res = await api.post<any>('ai_scenarios?action=delete', { id, property_id: propertyId });
                            if (res.success) { toast.success('Đã xóa kịch bản'); fetchScenarios(); }
                        } catch { toast.error('Lỗi kết nối'); }
                    }}
                    className="px-3 py-1.5 text-xs font-bold bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-all"
                >Xóa ngay</button>
                <button onClick={() => toast.dismiss(t.id)} className="px-3 py-1.5 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all">Hủy</button>
            </div>
        ), { duration: 6000, position: 'top-center' });
    };

    const handleClone = async (id: string) => {
        try {
            const res = await api.post<any>('ai_scenarios?action=clone', { id, property_id: propertyId });
            if (res.success) { toast.success('Đã nhân bản'); fetchScenarios(); }
            else toast.error(res.message || 'Lỗi nhân bản');
        } catch { toast.error('Lỗi kết nối'); }
    };

    const handleToggle = async (s: Scenario) => {
        const nv = s.is_active ? 0 : 1;
        setScenarios(prev => prev.map(x => x.id === s.id ? { ...x, is_active: nv } : x));
        try {
            await api.post<any>('ai_scenarios?action=toggle', { id: s.id, property_id: propertyId, is_active: nv });
        } catch {
            setScenarios(prev => prev.map(x => x.id === s.id ? { ...x, is_active: s.is_active } : x));
            toast.error('Lỗi cập nhật');
        }
    };

    const handleToggleGlobal = async () => {
        const nv = !globalEnabled;
        setGlobalEnabled(nv);
        setGlobalLoading(true);
        try {
            await api.post<any>('ai_scenarios?action=toggle_global', { property_id: propertyId, enabled: nv ? 1 : 0 });
            toast.success(nv ? 'Đã bật Kịch Bản' : 'Đã tắt toàn bộ Kịch Bản');
        } catch { setGlobalEnabled(!nv); toast.error('Lỗi cập nhật'); }
        finally { setGlobalLoading(false); }
    };

    const handleMovePriority = async (idx: number, dir: 'up' | 'down') => {
        const si = dir === 'up' ? idx - 1 : idx + 1;
        if (si < 0 || si >= scenarios.length) return;
        const list = [...scenarios];
        [list[idx], list[si]] = [list[si], list[idx]];
        const updated = list.map((s, i) => ({ ...s, priority: list.length - i }));
        setScenarios(updated);
        try {
            await api.post<any>('ai_scenarios?action=reorder', { property_id: propertyId, order: updated.map(s => ({ id: s.id, priority: s.priority })) });
        } catch { toast.error('Lỗi cập nhật thứ tự'); fetchScenarios(); }
    };

    const handleExportCSV = () => {
        if (!scenarios.length) { toast.error('Không có kịch bản để xuất'); return; }
        const blob = new Blob(['\uFEFF' + scenariosToCSV(scenarios)], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `scenarios_${propertyId}.csv`; a.click();
        URL.revokeObjectURL(url); toast.success('Xuất CSV thành công');
    };

    const handleDownloadTemplate = () => {
        const blob = new Blob(['\uFEFF' + csvTemplateString()], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'scenarios_template.csv'; a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (csvInputRef.current) csvInputRef.current.value = '';
        if (!file) return;
        setImporting(true);
        const tid = toast.loading('Đang import...');
        try {
            const rows = parseCSVToScenarios(await file.text(), propertyId);
            if (!rows.length) { toast.error('Không đọc được dữ liệu', { id: tid }); return; }
            let ok = 0, fail = 0;
            for (const row of rows) {
                const res = await api.post<any>('ai_scenarios?action=create', { ...row, property_id: propertyId, buttons: JSON.stringify(row.buttons) });
                res.success ? ok++ : fail++;
            }
            toast.success(`Import: ${ok} thành công${fail ? `, ${fail} lỗi` : ''}`, { id: tid, duration: 5000 });
            fetchScenarios();
        } catch (err: any) { toast.error('Lỗi: ' + err.message, { id: tid }); }
        finally { setImporting(false); }
    };

    const activeCount = scenarios.filter(s => s.is_active).length;

    return (
        <div className="space-y-5">
            {/* Flow modal */}
            {modalScenario !== null && (
                <ScenarioFlowModal
                    initialScenario={modalScenario}
                    propertyId={propertyId}
                    isDark={isDark}
                    loading={saving}
                    onSave={handleSave}
                    onClose={closeModal}
                />
            )}

            {/* Header */}
            <div className={`flex flex-col md:flex-row md:items-start justify-between gap-5 p-6 rounded-[24px] ${isDark ? 'bg-slate-800' : 'bg-slate-50 border border-slate-100 shadow-sm'}`}>
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                        <Play className={`w-5 h-5 ml-0.5 ${isDark ? 'fill-amber-500 text-amber-500' : 'fill-amber-600 text-amber-600'}`} />
                    </div>
                    <div>
                        <h3 className={`text-lg font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>Kịch Bản Trả Lời Tự Động</h3>
                        <div className={`text-[12px] font-medium mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            Xây dựng luồng tin nhắn tư vấn tự động
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                    <div className="flex items-center p-1 rounded-[16px] bg-white border border-slate-200 shadow-sm">
                        <button onClick={handleDownloadTemplate} className={`flex items-center gap-1.5 h-10 px-4 rounded-xl text-[12px] font-bold transition-all ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
                            <FileText className="w-4 h-4" /> Mẫu CSV
                        </button>
                        <div className="w-px h-5 bg-slate-200 mx-1" />
                        <button onClick={() => csvInputRef.current?.click()} disabled={importing} className={`flex items-center gap-1.5 h-10 px-4 rounded-xl text-[12px] font-bold transition-all ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
                            <Upload className="w-4 h-4" /> {importing ? 'Đang import...' : 'Import CSV'}
                        </button>
                        {scenarios.length > 0 && (
                            <>
                                <div className="w-px h-5 bg-slate-200 mx-1" />
                                <button onClick={handleExportCSV} className={`flex items-center gap-1.5 h-10 px-4 rounded-xl text-[12px] font-bold transition-all ${isDark ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}>
                                    <Download className="w-4 h-4" /> Export
                                </button>
                            </>
                        )}
                    </div>

                    <div className="w-px h-6 bg-slate-200 mx-1 hidden md:block" />

                    <div className={`flex items-center gap-3 px-5 py-2.5 rounded-[16px] border cursor-pointer select-none transition-all ${isDark ? 'bg-slate-800 border-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}`} onClick={handleToggleGlobal}>
                        <span className={`text-[11px] font-black uppercase tracking-widest ${globalEnabled ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                            {globalEnabled ? 'Trạng thái Bật' : 'Đã tắt toàn bộ'}
                        </span>
                        <div className={`w-11 h-6 rounded-full p-1 transition-all duration-300 flex items-center shadow-inner ${globalEnabled ? 'bg-emerald-500 justify-end' : (isDark ? 'bg-slate-700 justify-start' : 'bg-slate-200 justify-start')}`}>
                            <div className="w-4 h-4 bg-white rounded-full shadow border border-black/5" />
                        </div>
                    </div>
                    
                    <button onClick={openCreate}
                        className="flex items-center gap-2 h-11 px-5 rounded-[16px] text-[13px] font-bold bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/30 active:scale-95 transition-all ml-1">
                        <Plus className="w-4 h-4" /> Tạo Kịch Bản
                    </button>
                </div>
            </div>

            {/* Global disabled banner */}
            {!globalEnabled && (
                <div className={`flex items-center gap-3 px-5 py-4 rounded-xl border ${isDark ? 'border-amber-600/20 bg-amber-600/5' : 'border-amber-200 bg-amber-50'}`}>
                    <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                    <p className={`text-sm font-medium ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>
                        Tính năng Kịch Bản đang <strong>tắt</strong>. Chatbot sẽ dùng AI hoàn toàn. Bật lại để áp dụng kịch bản.
                    </p>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => <div key={i} className={`h-24 rounded-2xl animate-pulse ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`} />)}
                </div>
            )}

            {/* Empty state */}
            {!loading && scenarios.length === 0 && (
                <div className={`flex flex-col items-center justify-center py-20 px-6 rounded-[24px] border border-dashed text-center ${isDark ? 'border-slate-700 bg-slate-800/10' : 'border-slate-200 bg-slate-50/50'}`}>
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 shadow-sm border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <Bot className={`w-10 h-10 ${isDark ? 'text-slate-600' : 'text-blue-300'}`} />
                    </div>
                    <h4 className={`text-lg font-black mb-2 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Chưa có kịch bản mẫu nào</h4>
                    <p className={`text-sm font-medium mb-8 max-w-sm leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                        Tạo luồng tư vấn với canvas thả-nối nhánh chuyên nghiệp, giúp chốt sales tự nhiên và dễ cấu hình.
                    </p>
                    <button onClick={openCreate} className="flex items-center gap-2 h-12 px-8 rounded-2xl text-[14px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 active:scale-95 transition-all">
                        <Plus className="w-5 h-5" /> Bắt đầu tạo ngay
                    </button>
                </div>
            )}

            {/* Scenario list */}
            {!loading && scenarios.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                        <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {scenarios.length} kịch bản · Click card để mở canvas chỉnh sửa
                        </p>
                        <div className={`flex items-center gap-1.5 text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            {activeCount} đang hoạt động
                        </div>
                    </div>
                    {scenarios.map((s, idx) => (
                        <ScenarioCard
                            key={s.id}
                            scenario={s}
                            isDark={isDark}
                            onEdit={() => openEdit(s)}
                            onDelete={() => handleDelete(s.id)}
                            onToggle={() => handleToggle(s)}
                            onClone={() => handleClone(s.id)}
                            onMoveUp={() => handleMovePriority(idx, 'up')}
                            onMoveDown={() => handleMovePriority(idx, 'down')}
                        />
                    ))}
                </div>
            )}

            {/* Tips */}
            {scenarios.length > 0 && (
                <div className={`flex items-start gap-3 p-4 rounded-xl border ${isDark ? 'border-blue-500/20 bg-blue-500/5' : 'border-blue-100 bg-blue-50/50'}`}>
                    <CircleDashed className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                    <div className={`text-[11px] font-medium leading-relaxed space-y-1 ${isDark ? 'text-blue-400/80' : 'text-blue-600'}`}>
                        <p><strong>Cách hoạt động:</strong> Khi user gửi tin nhắn, chatbot kiểm tra từ khóa theo thứ tự ưu tiên (từ trên xuống). Khớp → trả lời theo kịch bản. Không khớp → AI xử lý.</p>
                        <p><strong>Click vào card</strong> để mở canvas chỉnh sửa — thêm node, rẽ nhánh, và bước <code className="px-1 bg-black/10 rounded text-[10px] font-mono">[SHOW_LEAD_FORM]</code>.</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScenarioManager;

// Dual value declarations for verbatimModuleSyntax compatibility
export const ScenarioButton: any = undefined;
export const Scenario: any = undefined;
