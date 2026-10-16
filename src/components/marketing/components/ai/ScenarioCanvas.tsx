/**
 * ScenarioCanvas.tsx — Visual canvas giống Flow Designer
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import {
    Plus, X, Save, ZoomIn, ZoomOut, Move, Maximize, Minimize,
    MessageSquare, Zap, Flag, GitBranch, FormInput, Trash2,
    AlertTriangle, MousePointerClick, Bot, MoreHorizontal,
    CheckCircle2, Keyboard
} from 'lucide-react';
import { getMktPortalRoot } from '../../utils/portalRoot';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ScenarioNode {
    id: string;
    text: string;
    buttons: ScenarioNodeBtn[];
    actions?: ScenarioNodeAction[];
}
export interface ScenarioNodeBtn {
    id: string;
    label: string;
    next_node?: string;
}
export interface ScenarioNodeAction {
    type: 'show_lead_form';
}

interface CanvasProps {
    nodes: ScenarioNode[];
    onChange: (nodes: ScenarioNode[]) => void;
    keywords?: string;
    onKeywordsChange?: (kw: string) => void;
    isDark?: boolean;
    readOnly?: boolean;
}

const uid = () => Math.random().toString(36).slice(2, 10);
const CONNECTOR_H = 40;

// ── Straight Connector ─────────────────────────────────────────────────────────
const StraightConnector: React.FC<{ height?: number }> = ({ height = 64 }) => (
    <div
        className="relative flex justify-center pointer-events-none z-0"
        style={{ height, width: 10, margin: '-1px auto' }}
    >
        <svg width="10" height="100%" className="overflow-visible" style={{ position: 'absolute', top: 0 }}>
            <line
                x1="5" y1="-2" x2="5" y2="102%"
                stroke="#cbd5e1" strokeWidth="2"
                strokeDasharray="6 6"
                className="animate-[dash_1s_linear_infinite]"
                strokeLinecap="round"
            />
            <circle r="2.5" fill="#2563eb">
                <animateMotion path={`M 5 -10 L 5 ${height + 10}`} dur="2s" repeatCount="indefinite" />
            </circle>
        </svg>
        <style>{`@keyframes dash { to { stroke-dashoffset: -12; } }`}</style>
    </div>
);

// ── Branch Connector — SVG lines ONLY, no text (labels done in HTML) ───────────
const BranchConnector: React.FC<{ count: number; height?: number }> = ({ count, height = CONNECTOR_H }) => {
    const branchColors = ['#2563eb', '#8b5cf6', '#10b981', '#f43f5e', '#3b82f6'];
    const midX = 50;
    const midY = height / 2;
    const endY = height + 4;
    const positions = Array.from({ length: count }, (_, i) =>
        count === 1 ? 50 : ((2 * i + 1) * 100) / (2 * count)
    );

    return (
        <div className="absolute top-0 left-0 w-full pointer-events-none z-0" style={{ height }}>
            <svg
                width="100%" height="100%"
                viewBox={`0 0 100 ${height}`}
                preserveAspectRatio="none"
                style={{ overflow: 'visible' }}
            >
                {positions.map((tx, i) => {
                    const color = branchColors[i % branchColors.length];
                    const path = `M ${midX} -2 L ${midX} ${midY} L ${tx} ${midY} L ${tx} ${endY}`;
                    return (
                        <React.Fragment key={i}>
                            <path d={path} stroke={color} strokeWidth="2"
                                vectorEffect="non-scaling-stroke" fill="none"
                                strokeDasharray="6 4" />
                            {/* SVG Hack to keep circle round when viewBox is stretched: tiny radius + thick non-scaling stroke */}
                            <circle r="0.001" fill="none" stroke={color} strokeWidth="5" vectorEffect="non-scaling-stroke">
                                <animateMotion path={path} dur={`${2.2 + i * 0.2}s`} repeatCount="indefinite" />
                            </circle>
                        </React.Fragment>
                    );
                })}
            </svg>
        </div>
    );
};

// ── Button Pill (WaitNode-style rounded pill) ──────────────────────────────────
const ButtonPill: React.FC<{ btn: ScenarioNodeBtn; colorIdx: number }> = ({ btn, colorIdx }) => {
    const isWild = btn.label === '*';

    // Label text
    const labelText = isWild ? 'Nhập tự do' : btn.label;

    // Color schemes
    const schemes = [
        { icon: 'text-amber-700', circle: 'bg-gradient-to-br from-amber-400 to-amber-600', border: 'border-amber-200', shadow: 'shadow-amber-100', text: 'text-amber-800' },
        { icon: 'text-blue-700', circle: 'bg-gradient-to-br from-blue-400 to-blue-600', border: 'border-blue-200', shadow: 'shadow-blue-100', text: 'text-blue-800' },
        { icon: 'text-pink-700', circle: 'bg-gradient-to-br from-rose-400 to-rose-500', border: 'border-rose-200', shadow: 'shadow-rose-100', text: 'text-rose-800' },
        { icon: 'text-blue-700', circle: 'bg-gradient-to-br from-blue-400 to-blue-600', border: 'border-blue-200', shadow: 'shadow-blue-100', text: 'text-blue-800' },
    ];

    const wildScheme = { circle: 'bg-gradient-to-br from-emerald-400 to-emerald-600', border: 'border-emerald-200', shadow: 'shadow-emerald-100', text: 'text-emerald-800' };
    const scheme = isWild ? wildScheme : schemes[colorIdx % schemes.length];

    return (
        <div className={`flex items-center gap-2 pl-1.5 pr-4 py-1.5 rounded-full bg-white border shadow-lg whitespace-nowrap ${scheme.border} ${scheme.shadow}`}>
            {/* Circular icon */}
            <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 shadow-md ${scheme.circle}`}>
                {isWild
                    ? <Keyboard className="w-3.5 h-3.5 text-white" />
                    : <MousePointerClick className="w-3.5 h-3.5 text-white" />
                }
            </div>
            <span className={`text-[11px] font-bold max-w-[140px] truncate ${scheme.text}`}>{labelText}</span>
        </div>
    );
};

// ── Add (+) Button ─────────────────────────────────────────────────────────────
const AddBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <div className="flex flex-col items-center z-30 relative" style={{ pointerEvents: 'all' }}>
        <StraightConnector height={36} />
        <button
            onClick={e => { e.stopPropagation(); onClick(); }}
            className="w-7 h-7 rounded-full bg-white border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all shadow-sm flow-interactive"
        >
            <Plus className="w-3.5 h-3.5" />
        </button>
        <StraightConnector height={36} />
    </div>
);

const EndFlag = () => (
    <div className="flex flex-col items-center opacity-20 mt-1">
        <Flag className="w-4 h-4 text-slate-400" />
        <span className="text-[9px] font-black text-slate-400 uppercase mt-0.5">End</span>
    </div>
);

// ── Delete Confirm Modal ───────────────────────────────────────────────────────
const DeleteConfirm: React.FC<{ label?: string; onConfirm: () => void; onCancel: () => void }> = ({ label, onConfirm, onCancel }) => {
    const [show, setShow] = useState(false);
    useEffect(() => { const t = setTimeout(() => setShow(true), 10); return () => clearTimeout(t); }, []);
    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999999] flex items-center justify-center">
            <div className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`} onClick={onCancel} />
            <div className={`relative bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-sm mx-4 transition-all duration-200 ${show ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-4'}`}>
                <div className="flex items-start gap-4 mb-5">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                        <Trash2 className="w-5 h-5 text-rose-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-800">Xóa node này?</h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {label ? `"${label.slice(0, 40)}${label.length > 40 ? '…' : ''}" sẽ bị xóa. Các nút đang nối vào đây sẽ bị hủy kết nối.` : 'Node sẽ bị xóa vĩnh viễn.'}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 justify-end">
                    <button onClick={onCancel} className="h-9 px-4 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">Hủy</button>
                    <button onClick={onConfirm} className="h-9 px-4 rounded-xl text-sm font-bold bg-rose-500 hover:bg-rose-600 text-white shadow-sm shadow-rose-200 transition-all flex items-center gap-2">
                        <Trash2 className="w-3.5 h-3.5" /> Xóa
                    </button>
                </div>
            </div>
        </div>,
        getMktPortalRoot()
    );
};

// ── Button Rename Popup ────────────────────────────────────────────────────────
const ButtonRenameModal: React.FC<{
    initLabel: string;
    onSave: (val: string) => void;
    onClose: () => void;
}> = ({ initLabel, onSave, onClose }) => {
    const [val, setVal] = useState(initLabel);
    const [show, setShow] = useState(false);
    useEffect(() => { const t = setTimeout(() => setShow(true), 10); return () => clearTimeout(t); }, []);
    
    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[99999999] flex items-center justify-center">
            <div className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${show ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
            <div className={`relative bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 w-full max-w-sm mx-4 transition-all duration-200 ${show ? 'scale-100 opacity-100 translate-y-0' : 'scale-90 opacity-0 translate-y-4'}`}>
                <h3 className="text-sm font-bold text-slate-800 mb-4">Mô tả/Tên nhánh</h3>
                <input 
                    type="text" 
                    value={val} 
                    onChange={e => setVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && onSave(val)}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-blue-400 focus:ring-2 focus:ring-blue-50 transition-all mb-5"
                    autoFocus
                />
                <div className="flex gap-2 justify-end">
                    <button onClick={onClose} className="h-9 px-4 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all">Hủy</button>
                    <button onClick={() => onSave(val)} className="h-9 px-5 rounded-xl text-sm font-bold bg-blue-500 hover:bg-blue-600 text-white shadow-sm shadow-blue-200 transition-all">Lưu nhánh</button>
                </div>
            </div>
        </div>,
        getMktPortalRoot()
    );
};

// ── Node Card ─────────────────────────────────────────────────────────────────
const NodeCard: React.FC<{
    node: ScenarioNode;
    isRoot: boolean;
    isDark?: boolean;
    keywords?: string;
    onClick: () => void;
    onAddLinear: () => void;
    nodes: ScenarioNode[];
    onAddBranch: (btnId: string) => void;
    onEditBranchLabel: (btnId: string, currentLabel: string) => void;
    renderChild: (nodeId: string) => React.ReactNode;
}> = ({ node, isRoot, keywords, onClick, onAddLinear, nodes, onAddBranch, onEditBranchLabel, renderChild }) => {
    const messages = node.text.split('|||').filter(t => t.trim());
    const buttons = node.buttons || [];
    const actions = node.actions || [];
    const hasLeadForm = actions.some(a => a.type === 'show_lead_form');
    const isBranching = buttons.length >= 1 && (buttons.length > 1 || buttons[0]?.next_node);

    const firstKeyword = (keywords || '').split(',')[0]?.trim();

    return (
        <div className="flex flex-col items-center w-max">
            {/* ── Node card ── */}
            <div
                id={`sc-node-${node.id}`}
                onClick={onClick}
                className="group relative w-[260px] bg-white rounded-[28px] border border-slate-100 z-20 cursor-pointer
                    shadow-[0_8px_30px_rgba(0,0,0,0.05)]
                    hover:shadow-[0_20px_40px_rgba(59,130,246,0.12)]
                    hover:-translate-y-1.5 hover:ring-2 hover:ring-blue-100
                    transition-all duration-300 flow-interactive"
            >
                <div className="p-5">
                    <div className="flex items-start gap-4">
                        {/* Icon */}
                        {isRoot ? (
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shrink-0 shadow-lg shadow-amber-200 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                                <Zap className="w-5 h-5 text-white" />
                            </div>
                        ) : (
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0 shadow-lg shadow-blue-200 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                                <MessageSquare className="w-5 h-5 text-white" />
                            </div>
                        )}

                        <div className="flex-1 overflow-hidden pt-0.5">
                            <div className="flex items-center gap-2 mb-1.5">
                                <p className={`text-[9px] font-bold uppercase tracking-widest leading-none ${isRoot ? 'text-amber-600' : 'text-blue-600'}`}>
                                    {isRoot ? 'Trigger · Bước 1' : 'Reply Node'}
                                </p>
                                {hasLeadForm && (
                                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center gap-0.5 shrink-0">
                                        <FormInput className="w-2.5 h-2.5" /> LEAD
                                    </span>
                                )}
                            </div>

                            {/* Message — single line */}
                            <p className="text-sm font-bold text-slate-800 truncate leading-tight">
                                {isRoot && !messages[0] && firstKeyword ? (
                                    <span className="text-amber-600">Từ khóa: {firstKeyword}</span>
                                ) : (
                                    <>{messages[0]?.slice(0, 36) || 'Chưa có nội dung...'}{(messages[0]?.length || 0) > 36 && '…'}</>
                                )}
                            </p>
                            {messages.length > 1 && (
                                <p className="text-[10px] text-slate-400 font-medium mt-0.5">+{messages.length - 1} tin nhắn nữa</p>
                            )}
                            {/* Note about branches — no button list */}
                            {buttons.length > 0 && (
                                <p className="text-[9px] text-slate-400 font-medium mt-1 flex items-center gap-1">
                                    <GitBranch className="w-3 h-3 text-indigo-400" />
                                    {buttons.length} nhánh
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Hover quick-edit */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 z-50">
                    <button
                        onClick={e => { e.stopPropagation(); onClick(); }}
                        className="p-1.5 bg-white/80 backdrop-blur-md border border-slate-100 rounded-full shadow-sm text-slate-400 hover:text-blue-600 hover:shadow-md transform hover:scale-110 transition-all"
                    >
                        <MoreHorizontal className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Children / branches ── */}
            {isBranching ? (
                /* Multi-branch: paddingTop for connector + HTML pill labels */
                <div className="relative flex flex-nowrap w-max" style={{ paddingTop: CONNECTOR_H }}>
                    <BranchConnector count={buttons.length} height={CONNECTOR_H} />

                    {buttons.map((btn, i) => {
                        const childNode = btn.next_node ? nodes.find(n => n.id === btn.next_node) : null;
                        return (
                            <div key={btn.id} className="flex-1 flex flex-col items-center px-4 md:px-6 relative min-w-[260px]">
                                {/* Branch down descension layout */}
                                <StraightConnector height={22} />
                                
                                <div 
                                    className="z-20 cursor-pointer flow-interactive hover:-translate-y-0.5 hover:scale-105 transition-all"
                                    onClick={(e) => { e.stopPropagation(); onEditBranchLabel(btn.id, btn.label); }}
                                    title="Chỉnh sửa nhanh tên nhánh"
                                >
                                    <ButtonPill btn={btn} colorIdx={i} />
                                </div>

                                <StraightConnector height={24} />

                                {/* Child or add button */}
                                {childNode
                                    ? renderChild(childNode.id)
                                    : (
                                        <div className="flex flex-col items-center mt-2">
                                            <button
                                                onClick={e => { e.stopPropagation(); onAddBranch(btn.id); }}
                                                className="w-7 h-7 rounded-full bg-white border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all shadow-sm flow-interactive"
                                            >
                                                <Plus className="w-3.5 h-3.5" />
                                            </button>
                                            <EndFlag />
                                        </div>
                                    )
                                }
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* Single chain */
                <div className="flex flex-col items-center">
                    <AddBtn onClick={onAddLinear} />
                    <EndFlag />
                </div>
            )}
        </div>
    );
};

// ── Node Edit Popup ────────────────────────────────────────────────────────────
const NodeEditPanel: React.FC<{
    node: ScenarioNode;
    nodes: ScenarioNode[];
    isRoot: boolean;
    isDark?: boolean;
    keywords?: string;
    onKeywordsChange?: (kw: string) => void;
    onSave: (updated: ScenarioNode) => void;
    onDelete: () => void;
    onClose: () => void;
}> = ({ node, nodes, isRoot, keywords, onKeywordsChange, onSave, onDelete, onClose }) => {
    const [animIn, setAnimIn] = useState(false);
    const [text, setText] = useState(node.text);
    const [buttons, setButtons] = useState<ScenarioNodeBtn[]>(node.buttons || []);
    const [actions, setActions] = useState<ScenarioNodeAction[]>(node.actions || []);
    const [newBtnLabel, setNewBtnLabel] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => { const t = setTimeout(() => setAnimIn(true), 10); return () => clearTimeout(t); }, []);
    const close = () => { setAnimIn(false); setTimeout(onClose, 220); };

    const messages = text.split('|||');
    const updateMsg = (i: number, v: string) => { const p = [...messages]; p[i] = v; setText(p.join('|||')); };
    const removeMsg = (i: number) => setText(messages.filter((_, j) => j !== i).join('|||'));
    const addMsg = () => setText(text + '|||');

    const addBtn = (label: string) => {
        if (!label.trim() || buttons.length >= 4) return;
        setButtons(prev => [...prev, { id: 'btn_' + uid(), label: label.trim() }]);
        setNewBtnLabel('');
    };
    const removeBtn = (id: string) => setButtons(prev => prev.filter(b => b.id !== id));
    const addWildcard = () => {
        if (buttons.some(b => b.label === '*') || buttons.length >= 4) return;
        setButtons(prev => [...prev, { id: 'btn_' + uid(), label: '*' }]);
    };
    const toggleLeadForm = () => {
        setActions(prev =>
            prev.some(a => a.type === 'show_lead_form') ? prev.filter(a => a.type !== 'show_lead_form') : [...prev, { type: 'show_lead_form' }]
        );
    };
    const hasLeadForm = actions.some(a => a.type === 'show_lead_form');
    const handleSave = () => { onSave({ ...node, text, buttons, actions }); close(); };
    const handleConfirmDelete = () => { onDelete(); setConfirmDelete(false); close(); };

    const presets = ['Tìm hiểu thêm', 'Liên hệ tư vấn', 'Xem học phí', 'Đăng ký ngay', 'Xem lịch học'];

    return ReactDOM.createPortal(
        <>
            {confirmDelete && (
                <DeleteConfirm label={messages[0]} onConfirm={handleConfirmDelete} onCancel={() => setConfirmDelete(false)} />
            )}
            <div className="fixed inset-0 z-[99998] flex items-center justify-center p-4" style={{ pointerEvents: animIn ? 'auto' : 'none' }}>
                <div className={`absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity duration-200 ${animIn ? 'opacity-100' : 'opacity-0'}`} onClick={close} />

                <div className={`relative flex flex-col bg-white rounded-[28px] shadow-2xl border border-slate-100 w-full transition-all duration-200 ${animIn ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-4'}`}
                    style={{ maxWidth: 520, maxHeight: '88vh' }}>

                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0 rounded-t-[28px] bg-slate-50/80">
                        <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-md ${isRoot ? 'bg-gradient-to-br from-amber-400 to-amber-600 shadow-amber-200' : 'bg-gradient-to-br from-blue-400 to-indigo-500 shadow-blue-200'}`}>
                                {isRoot ? <Zap className="w-4 h-4 text-white" /> : <MessageSquare className="w-4 h-4 text-white" />}
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">{isRoot ? 'Bước 1 — Trigger Node' : 'Reply Node'}</h3>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-0.5">ID: {node.id}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            {!isRoot && (
                                <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all" title="Xóa node">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                            <button onClick={close} className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"><X className="w-5 h-5" /></button>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">

                        {/* Keywords (only for root) */}
                        {isRoot && onKeywordsChange && (
                            <div className="space-y-3">
                                <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                    <Zap className="w-3 h-3 text-amber-500" /> Từ khóa kích hoạt (cách nhau bằng dấu phẩy)
                                </label>
                                <input
                                    type="text"
                                    value={keywords || ''}
                                    onChange={e => onKeywordsChange(e.target.value)}
                                    placeholder="Ví dụ: học phí, bao nhiêu tiền, giá..."
                                    className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-slate-50/80 text-sm font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-50 transition-all"
                                />
                            </div>
                        )}

                        {/* Messages */}
                        <div className="space-y-3">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                <MessageSquare className="w-3 h-3 text-blue-500" /> Nội dung chatbot trả lời <span className="text-rose-400">*</span>
                            </label>
                            {messages.map((msg, i) => (
                                <div key={i} className="relative">
                                    <textarea
                                        value={msg}
                                        onChange={e => updateMsg(i, e.target.value)}
                                        placeholder={i === 0 ? 'Nhập nội dung chatbot gửi...' : 'Tin nhắn tiếp theo (delay 1 giây)...'}
                                        rows={3}
                                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/80 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50 transition-all resize-y min-h-[80px]"
                                    />
                                    {messages.length > 1 && (
                                        <button onClick={() => removeMsg(i)} className="absolute top-2 right-2 p-1 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all"><X className="w-3.5 h-3.5" /></button>
                                    )}
                                    {i > 0 && <p className="text-[9px] text-slate-400 font-bold mt-1 pl-1">↪ Gửi sau 1 giây</p>}
                                </div>
                            ))}
                            <button onClick={addMsg} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all">
                                <Plus className="w-3 h-3" /> Thêm tin nhắn tiếp theo
                            </button>
                        </div>

                        {/* [SHOW_LEAD_FORM] */}
                        <div className="space-y-2">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                <FormInput className="w-3 h-3 text-emerald-500" /> Hành động đặc biệt
                            </label>
                            <button onClick={toggleLeadForm}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-left transition-all
                                    ${hasLeadForm ? 'bg-emerald-50 border-emerald-400 shadow-sm shadow-emerald-100' : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30'}`}>
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${hasLeadForm ? 'bg-emerald-500 shadow-md shadow-emerald-200' : 'bg-slate-100'}`}>
                                    <FormInput className={`w-4 h-4 ${hasLeadForm ? 'text-white' : 'text-slate-400'}`} />
                                </div>
                                <div className="flex-1">
                                    <p className={`text-[11px] font-black font-mono ${hasLeadForm ? 'text-emerald-700' : 'text-slate-700'}`}>[SHOW_LEAD_FORM]</p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Kiểm tra lead → nếu chưa có thì hiện form thu thập</p>
                                </div>
                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${hasLeadForm ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300'}`}>
                                    {hasLeadForm && <CheckCircle2 className="w-3 h-3 text-white" />}
                                </div>
                            </button>
                        </div>

                        {/* Buttons */}
                        <div className="space-y-3">
                            <label className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                                <GitBranch className="w-3 h-3 text-indigo-500" /> Nút nhanh / Rẽ nhánh
                                <span className="font-normal normal-case text-slate-400">(tối đa 4)</span>
                            </label>

                            {/* Presets */}
                            {buttons.length < 4 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {presets.filter(p => !buttons.some(b => b.label === p)).slice(0, 4 - buttons.length).map(p => (
                                        <button key={p} onClick={() => addBtn(p)} className="px-2.5 py-1 rounded-xl border border-dashed border-slate-200 text-[11px] font-bold text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 transition-all">+ {p}</button>
                                    ))}
                                </div>
                            )}

                            {/* Button list with pill preview */}
                            <div className="space-y-1.5">
                                {buttons.map((btn, i) => {
                                    const isWild = btn.label === '*';
                                    return (
                                        <div key={btn.id} className={`flex items-center gap-2 px-3 py-2 rounded-2xl border ${isWild ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200 shadow-sm'}`}>
                                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${isWild ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-gradient-to-br from-amber-400 to-amber-600'}`}>
                                                {isWild ? <Keyboard className="w-3 h-3 text-white" /> : <MousePointerClick className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="text-xs font-bold text-slate-700 flex-1 truncate">
                                                {isWild ? 'Nhập tự do (bắt mọi tin nhắn)' : btn.label}
                                            </span>
                                            <button onClick={() => removeBtn(btn.id)} className="text-slate-300 hover:text-rose-500 transition-colors shrink-0"><X className="w-3.5 h-3.5" /></button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Custom input */}
                            {buttons.length < 4 && !buttons.some(b => b.label === '*') && (
                                <div className="flex gap-2">
                                    <input type="text" value={newBtnLabel} onChange={e => setNewBtnLabel(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addBtn(newBtnLabel))}
                                        placeholder="Nhập tên nút tùy ý..."
                                        className="flex-1 h-10 px-4 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium outline-none focus:border-blue-400 focus:bg-white text-slate-800 placeholder-slate-400 transition-all" />
                                    <button onClick={() => addBtn(newBtnLabel)} className="h-10 px-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-200">
                                        <Plus className="w-3.5 h-3.5" /> Tạo
                                    </button>
                                </div>
                            )}

                            {/* Wildcard */}
                            {!buttons.some(b => b.label === '*') && buttons.length < 4 && (
                                <button onClick={addWildcard} className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl border border-dashed border-emerald-200 text-emerald-600 hover:bg-emerald-50 transition-all">
                                    <Keyboard className="w-3.5 h-3.5" /> + Nhập tự do (cũng là 1 nhánh)
                                </button>
                            )}

                            {buttons.length > 0 && (
                                <p className="text-[9px] text-slate-400 font-medium flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                    Mỗi nút tạo 1 nhánh trên canvas. Bấm &ldquo;+&rdquo; dưới nhánh để nối node tiếp theo.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between gap-3 px-5 py-4 border-t border-slate-100 shrink-0 rounded-b-[28px] bg-slate-50/60">
                        <button onClick={close} className="h-10 px-5 rounded-xl text-sm font-bold border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all">Hủy</button>
                        <button onClick={handleSave} className="h-10 px-6 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 shadow-md shadow-blue-200/60 hover:shadow-blue-300/60 active:scale-95 transition-all flex items-center gap-2">
                            <Save className="w-4 h-4" /> Lưu node
                        </button>
                    </div>
                </div>
            </div>
        </>,
        getMktPortalRoot()
    );
};

// ── Recursive Tree ─────────────────────────────────────────────────────────────
const NodeTree: React.FC<{
    nodeId: string;
    nodes: ScenarioNode[];
    isDark?: boolean;
    keywords?: string;
    visited: Set<string>;
    onEdit: (id: string) => void;
    onAddLinear: (afterId: string) => void;
    onAddBranch: (parentId: string, btnId: string) => void;
    onEditBranchLabel: (nodeId: string, btnId: string, label: string) => void;
}> = ({ nodeId, nodes, isDark, keywords, visited, onEdit, onAddLinear, onAddBranch, onEditBranchLabel }) => {
    if (visited.has(nodeId)) return null;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return null;
    const next = new Set(visited);
    next.add(nodeId);
    return (
        <NodeCard
            node={node}
            isRoot={nodeId === 'root'}
            isDark={isDark}
            keywords={nodeId === 'root' ? keywords : undefined}
            nodes={nodes}
            onClick={() => onEdit(nodeId)}
            onAddLinear={() => onAddLinear(nodeId)}
            onAddBranch={btnId => onAddBranch(nodeId, btnId)}
            onEditBranchLabel={(btnId, label) => onEditBranchLabel(nodeId, btnId, label)}
            renderChild={childId => (
                <NodeTree nodeId={childId} nodes={nodes} isDark={isDark} keywords={keywords} visited={next} onEdit={onEdit} onAddLinear={onAddLinear} onAddBranch={onAddBranch} onEditBranchLabel={onEditBranchLabel} />
            )}
        />
    );
};

// ── Main Canvas ────────────────────────────────────────────────────────────────
const ScenarioCanvas: React.FC<CanvasProps> = ({ nodes, onChange, keywords, onKeywordsChange, isDark }) => {
    const [scale, setScale] = useState(1.0);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingBtn, setEditingBtn] = useState<{nodeId: string, btnId: string, label: string} | null>(null);

    const transformRef = useRef({ scale: 1, x: 0, y: 0 });
    const wrapperRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const bgRef = useRef<HTMLDivElement>(null);

    const updateDOM = (x: number, y: number, s: number) => {
        transformRef.current = { scale: s, x, y };
        if (wrapperRef.current) wrapperRef.current.style.transform = `translate(${x}px,${y}px) scale(${s})`;
        if (bgRef.current) bgRef.current.style.transform = `translate(${x % 24}px,${y % 24}px)`;
    };

    const doZoom = (delta: number, cx: number, cy: number) => {
        const { scale: cs, x, y } = transformRef.current;
        const ns = Math.min(Math.max(0.2, cs + delta), 2.0);
        if (ns === cs) return;
        const r = ns / cs;
        updateDOM(cx - (cx - x) * r, cy - (cy - y) * r, ns);
        setScale(ns);
    };

    const centerView = useCallback(() => {
        const c = containerRef.current;
        const rootEl = document.getElementById('sc-node-root');
        if (!c || !rootEl) return;
        
        const cr = c.getBoundingClientRect();
        
        // Wait until react renders the DOM layout so offsetParent is accurate
        setTimeout(() => {
            if (!rootEl.parentElement) return;
            const nx = rootEl.offsetLeft;
            const nw = rootEl.offsetWidth;
            
            // targetX puts the center of the root element to the center of the container
            const targetX = (cr.width / 2) - (nx + nw / 2);
            const targetY = 80;
            
            updateDOM(targetX, targetY, 1.0);
            setScale(1.0);
        }, 10);
    }, []);

    useEffect(() => { centerView(); }, [centerView]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const r = el.getBoundingClientRect();
                doZoom(e.deltaY > 0 ? -0.08 : 0.08, e.clientX - r.left, e.clientY - r.top);
            } else {
                const { x, y, scale: s } = transformRef.current;
                updateDOM(e.shiftKey ? x - e.deltaY : x - e.deltaX, e.shiftKey ? y : y - e.deltaY, s);
            }
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.code === 'Space') {
                e.preventDefault();
                centerView();
            }
        };
        window.addEventListener('keydown', onKeyDown);

        return () => {
            el.removeEventListener('wheel', onWheel);
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [centerView]);

    const pan = useRef({ active: false, sx: 0, sy: 0 });
    const onMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('.flow-interactive')) return;
        pan.current = { active: true, sx: e.clientX - transformRef.current.x, sy: e.clientY - transformRef.current.y };
        if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!pan.current.active) return;
        updateDOM(e.clientX - pan.current.sx, e.clientY - pan.current.sy, transformRef.current.scale);
    };
    const onMouseUp = () => {
        pan.current.active = false;
        if (containerRef.current) containerRef.current.style.cursor = 'grab';
    };

    const handleSaveNode = (updated: ScenarioNode) => onChange(nodes.map(n => n.id === updated.id ? updated : n));
    const handleDeleteNode = (id: string) => {
        onChange(nodes.filter(n => n.id !== id).map(n => ({ ...n, buttons: n.buttons.map(b => b.next_node === id ? { ...b, next_node: '' } : b) })));
    };
    const handleAddLinear = (_afterId: string) => {
        const newId = 'node_' + uid();
        onChange([...nodes, { id: newId, text: '', buttons: [], actions: [] }]);
        setTimeout(() => setEditingId(newId), 120);
    };
    const handleAddBranch = (parentId: string, btnId: string) => {
        const newId = 'node_' + uid();
        const updated = nodes.map(n =>
            n.id === parentId ? { ...n, buttons: n.buttons.map(b => b.id === btnId ? { ...b, next_node: newId } : b) } : n
        );
        onChange([...updated, { id: newId, text: '', buttons: [], actions: [] }]);
        setTimeout(() => setEditingId(newId), 120);
    };

    const editingNode = editingId ? nodes.find(n => n.id === editingId) : null;
    const rootNode = nodes.find(n => n.id === 'root');
    const zoomStep = (d: number) => { const c = containerRef.current; if (!c) return; const r = c.getBoundingClientRect(); doZoom(d, r.width / 2, r.height / 2); };

    return (
        <div
            ref={containerRef}
            className="relative w-full select-none overflow-hidden"
            style={{ height: '100%', minHeight: 0, background: '#f4f6f9', cursor: 'grab' }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
        >
            {/* Dot grid */}
            <div ref={bgRef} className="absolute inset-0 pointer-events-none opacity-50"
                style={{ backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }} />

            {/* Toolbar */}
            <div className="absolute bottom-4 left-4 z-50 flex gap-2">
                <div className="bg-white p-1.5 rounded-xl border border-slate-200 shadow-xl flex items-center gap-0.5 flow-interactive">
                    <button onClick={() => zoomStep(-0.1)} className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg"><ZoomOut className="w-4 h-4" /></button>
                    <span className="text-[10px] font-bold text-slate-400 min-w-[2.5rem] text-center">{Math.round(scale * 100)}%</span>
                    <button onClick={() => zoomStep(0.1)} className="p-2 text-slate-500 hover:bg-slate-50 rounded-lg"><ZoomIn className="w-4 h-4" /></button>
                </div>
                <button onClick={centerView} className="bg-white p-3 rounded-xl border border-slate-200 shadow-xl text-slate-500 hover:text-slate-800 flow-interactive transition-all active:scale-95">
                    <Move className="w-4 h-4" />
                </button>
            </div>

            {/* Canvas */}
            <div ref={wrapperRef} className="absolute origin-top-left will-change-transform" style={{ transform: 'translate(0,0) scale(1)' }}>
                <div className="pt-12 px-40 pb-40">
                    {rootNode ? (
                        <NodeTree
                            nodeId="root"
                            nodes={nodes}
                            isDark={isDark}
                            keywords={keywords}
                            visited={new Set()}
                            onEdit={setEditingId}
                            onAddLinear={handleAddLinear}
                            onAddBranch={handleAddBranch}
                            onEditBranchLabel={(nodeId, btnId, label) => setEditingBtn({ nodeId, btnId, label })}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-4 flow-interactive" style={{ minHeight: 300 }}>
                            <Bot className="w-12 h-12 text-slate-200" />
                            <p className="text-sm font-bold text-slate-300">Canvas trống</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Edit panel */}
            {editingNode && (
                <NodeEditPanel
                    node={editingNode}
                    nodes={nodes}
                    isRoot={editingNode.id === 'root'}
                    isDark={isDark}
                    keywords={keywords}
                    onKeywordsChange={onKeywordsChange}
                    onSave={handleSaveNode}
                    onDelete={() => handleDeleteNode(editingNode.id)}
                    onClose={() => setEditingId(null)}
                />
            )}

            {/* Quick Rename Button modal */}
            {editingBtn && (
                <ButtonRenameModal 
                    initLabel={editingBtn.label}
                    onSave={(newLabel) => {
                        onChange(nodes.map(n => 
                            n.id === editingBtn.nodeId
                                ? { ...n, buttons: n.buttons.map(b => b.id === editingBtn.btnId ? { ...b, label: newLabel } : b) }
                                : n
                        ));
                        setEditingBtn(null);
                    }}
                    onClose={() => setEditingBtn(null)}
                />
            )}
        </div>
    );
};

export default ScenarioCanvas;

// Dual value declarations for verbatimModuleSyntax compatibility
export const ScenarioNode: any = undefined;
export const ScenarioNodeBtn: any = undefined;
export const ScenarioNodeAction: any = undefined;
