// components/templates/EmailEditor/components/RichTextToolbar.tsx
import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bold, Italic, Underline, Strikethrough, Link, Palette, Eraser, AlignLeft, AlignCenter, AlignRight, AlignJustify, Heading1, Heading2, Heading3, Braces, Type, Tag, Highlighter, List, ListOrdered, Undo2, Redo2 } from 'lucide-react';
import InputModal from '../../../common/InputModal';
import { PREMIUM_COLORS } from '../constants/editorConstants';
import { getMktPortalRoot } from '../../../../utils/portalRoot';
import { MYERP_MERGE_TAG_GROUPS } from '../../../../constants/mergeTags';

interface RichTextToolbarProps {
    isVisible: boolean;
    position: { top: number; left: number };
    onApplyFontSize?: (size: string) => void;
    onApplyFontFamily?: (font: string) => void;
    onExecCommand?: (command: string, value?: string) => void;
    onModalToggle?: (isOpen: boolean) => void;
    onToolbarMouseEnter?: () => void;
    onToolbarMouseLeave?: () => void;
    elementRef?: React.RefObject<HTMLDivElement | null>;
    customMergeTags?: { label: string; key: string }[];
    usedColors?: string[];
}

const FONT_FAMILIES = [
    { label: 'Arial', val: 'Arial, sans-serif' },
    { label: 'Helvetica', val: 'Helvetica, sans-serif' },
    { label: 'Times New Roman', val: "'Times New Roman', Times, serif" },
    { label: 'Courier New', val: "'Courier New', Courier, monospace" },
    { label: 'Verdana', val: 'Verdana, Geneva, sans-serif' },
    { label: 'Inter', val: 'Inter, sans-serif' },
    { label: 'Georgia', val: 'Georgia, serif' },
];

const FONT_SIZES = ['11', '12', '13', '14', '15', '16', '18', '20', '22', '24', '28', '32', '36', '48'];

const SPECIAL_MERGE_TAGS = [
    { label: 'Ngày (yyyy-mm-dd)', val: '{{today_ymd}}', desc: 'yyyy-mm-dd' },
    { label: 'ID ngắn (10 số)', val: '{{random_id}}', desc: 'Random mỗi lần gửi' },
    { label: 'Mã 6 số', val: '{{random_6}}', desc: 'Random 6 chữ số' },
    { label: 'ID Khách hàng', val: '{{subscriber_id}}', desc: 'Full ID' },
    { label: 'ID ngắn', val: '{{subscriber_id_short}}', desc: '10 ký tự đầu' },
];

const Divider = () => <div className="w-[1px] h-4 bg-slate-700 mx-0.5 flex-shrink-0" />;

const ToolbarBtn: React.FC<{ onClick: () => void; title: string; active?: boolean; children: React.ReactNode }> = ({ onClick, title, active, children }) => (
    <button
        onMouseDown={(e) => { e.preventDefault(); onClick(); }}
        title={title}
        className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${active ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-slate-700 text-slate-300 hover:text-white'}`}
    >
        {children}
    </button>
);

const RichTextToolbar: React.FC<RichTextToolbarProps> = ({ isVisible, position, onApplyFontSize, onApplyFontFamily, onExecCommand, onModalToggle, onToolbarMouseEnter, onToolbarMouseLeave, elementRef, customMergeTags = [], usedColors = [] }) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [colorPickerMode, setColorPickerMode] = useState<'text' | 'highlight'>('text');
    const [hexInput, setHexInput] = useState('');
    const [previewColor, setPreviewColor] = useState('');
    const [showFontFamilyDropdown, setShowFontFamilyDropdown] = useState(false);
    const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false);
    const [showMergeTags, setShowMergeTags] = useState(false);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const savedRange = useRef<Range | null>(null);

    const closeAllDropdowns = () => {
        setShowColorPicker(false);
        setShowFontFamilyDropdown(false);
        setShowFontSizeDropdown(false);
        setShowMergeTags(false);
    };

    const saveSelection = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            savedRange.current = sel.getRangeAt(0).cloneRange();
        }
    };

    const restoreSelection = () => {
        const sel = window.getSelection();
        if (sel && savedRange.current) {
            sel.removeAllRanges();
            sel.addRange(savedRange.current);
        }
    };

    const execCommand = (cmd: string, val?: string) => {
        if (onExecCommand) { onExecCommand(cmd, val); }
        else { document.execCommand(cmd, false, val); }
        if (elementRef?.current) {
            elementRef.current.focus();
        }
    };

    const handleLinkClick = () => { saveSelection(); closeAllDropdowns(); setShowLinkModal(true); onModalToggle?.(true); };
    const handleLinkConfirm = (url: string) => { restoreSelection(); if (url) execCommand('createLink', url.startsWith('http') ? url : 'https://' + url); setShowLinkModal(false); onModalToggle?.(false); };

    const handleFontSizeApply = (size: string) => {
        if (onApplyFontSize) { onApplyFontSize(size + 'px'); }
        else { execCommand('fontSize', size); }
        setShowFontSizeDropdown(false);
    };

    const handleFontFamilyApply = (font: string) => {
        if (onApplyFontFamily) onApplyFontFamily(font);
        else execCommand('fontName', font);
        setShowFontFamilyDropdown(false);
    };

    const insertHeading = (level: number) => {
        if (onApplyFontSize) {
            const sizeMap: Record<number, string> = { 1: '32px', 2: '24px', 3: '18px' };
            onApplyFontSize(sizeMap[level] || '16px');
        } else {
            execCommand('formatBlock', `<h${level}>`);
        }
    };

    const insertMergeTag = (val: string) => {
        restoreSelection();
        execCommand('insertText', val);
        setShowMergeTags(false);
    };

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    if (!isVisible && !showLinkModal) return null;
    if (!mounted) return null;

    const isTopCutoff = position.top < 100;
    const effectiveTop = isTopCutoff ? position.top + 30 : position.top;
    const transform = isTopCutoff ? 'translate(-50%, 0)' : 'translate(-50%, -100%)';
    const marginTop = isTopCutoff ? '12px' : '-12px';

    return createPortal(
        <>
            <div
                className={`fixed z-[2147483642] flex flex-col bg-slate-900 text-white rounded-[14px] shadow-2xl px-1.5 py-1.5 gap-0.5 border border-slate-700/50 ${!isVisible ? 'invisible pointer-events-none' : 'animate-in fade-in zoom-in-95 duration-150'}`}
                style={{ top: effectiveTop, left: Math.max(180, Math.min(typeof window !== 'undefined' ? window.innerWidth - 180 : 800, position.left)), transform, width: 'max-content', marginTop, zIndex: 2147483642 }}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={onToolbarMouseEnter}
                onMouseLeave={onToolbarMouseLeave}
            >
                {/* ── Row 1: Headings + Font Family + Font Size + Undo/Redo ── */}
                <div className="flex items-center gap-0.5">
                    <ToolbarBtn onClick={() => insertHeading(1)} title="Heading 1"><Heading1 className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => insertHeading(2)} title="Heading 2"><Heading2 className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => insertHeading(3)} title="Heading 3"><Heading3 className="w-3.5 h-3.5" /></ToolbarBtn>

                    <Divider />

                    <div className="relative">
                        <ToolbarBtn onClick={() => { closeAllDropdowns(); saveSelection(); setShowFontFamilyDropdown(v => !v); }} title="Font Family">
                            <Type className="w-3.5 h-3.5" />
                        </ToolbarBtn>
                        {showFontFamilyDropdown && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-700 rounded-[14px] shadow-xl p-1 w-44 z-50 animate-in slide-in-from-bottom-2">
                                {FONT_FAMILIES.map(f => (
                                    <button key={f.val} onMouseDown={(e) => { e.preventDefault(); restoreSelection(); handleFontFamilyApply(f.val); }} className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 rounded-lg transition-colors" style={{ fontFamily: f.val }}>{f.label}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <button
                            onMouseDown={(e) => { e.preventDefault(); saveSelection(); closeAllDropdowns(); setShowFontSizeDropdown(v => !v); }}
                            title="Font Size"
                            className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-300 text-[10px] font-black h-7 min-w-[28px]"
                        >A<span className="text-[7px] ml-0.5 opacity-60">px</span></button>
                        {showFontSizeDropdown && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-700 rounded-[14px] shadow-xl p-1.5 z-50 animate-in slide-in-from-bottom-2 grid grid-cols-4 gap-1 w-max">
                                {FONT_SIZES.map(size => (
                                    <button key={size} onMouseDown={(e) => { e.preventDefault(); restoreSelection(); handleFontSizeApply(size); }} className="px-2 py-1.5 text-[10px] font-bold hover:bg-slate-800 rounded-lg text-center transition-colors text-slate-200">{size}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    <Divider />

                    <ToolbarBtn onClick={() => execCommand('undo')} title="Hoàn tác (Undo)"><Undo2 className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => execCommand('redo')} title="Làm lại (Redo)"><Redo2 className="w-3.5 h-3.5" /></ToolbarBtn>
                </div>

                {/* ── Row 2: Format + Lists + Align + Color + Link + Merge Tags ── */}
                <div className="flex items-center gap-0.5">
                    <ToolbarBtn onClick={() => execCommand('bold')} title="Bold"><Bold className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => execCommand('italic')} title="Italic"><Italic className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => execCommand('underline')} title="Underline"><Underline className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => execCommand('strikeThrough')} title="Strikethrough"><Strikethrough className="w-3.5 h-3.5" /></ToolbarBtn>

                    <Divider />

                    <ToolbarBtn onClick={() => execCommand('insertUnorderedList')} title="Danh sách dấu chấm"><List className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => execCommand('insertOrderedList')} title="Danh sách số"><ListOrdered className="w-3.5 h-3.5" /></ToolbarBtn>

                    <Divider />

                    <ToolbarBtn onClick={() => execCommand('justifyLeft')} title="Căn trái"><AlignLeft className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => execCommand('justifyCenter')} title="Căn giữa"><AlignCenter className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => execCommand('justifyRight')} title="Căn phải"><AlignRight className="w-3.5 h-3.5" /></ToolbarBtn>
                    <ToolbarBtn onClick={() => execCommand('justifyFull')} title="Căn đều 2 bên"><AlignJustify className="w-3.5 h-3.5" /></ToolbarBtn>

                    <Divider />

                    <div className="relative flex gap-0.5">
                        <ToolbarBtn onClick={() => { const target = !showColorPicker || colorPickerMode !== 'text'; closeAllDropdowns(); setColorPickerMode('text'); setShowColorPicker(target); }} active={showColorPicker && colorPickerMode === 'text'} title="Màu chữ">
                            <Palette className="w-3.5 h-3.5" />
                        </ToolbarBtn>
                        <ToolbarBtn onClick={() => { const target = !showColorPicker || colorPickerMode !== 'highlight'; closeAllDropdowns(); setColorPickerMode('highlight'); setShowColorPicker(target); }} active={showColorPicker && colorPickerMode === 'highlight'} title="Màu nền chữ (Highlight)">
                            <Highlighter className="w-3.5 h-3.5" />
                        </ToolbarBtn>
                        {showColorPicker && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 p-3 rounded-[14px] border border-slate-700 shadow-2xl z-50 animate-in slide-in-from-bottom-2 w-max">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Nhập màu {colorPickerMode === 'text' ? 'chữ' : 'nền'}</p>
                                <div className="flex gap-1.5 items-center mb-2">
                                    <div
                                        className="w-7 h-7 rounded-lg border-2 border-slate-600 flex-shrink-0"
                                        style={previewColor
                                            ? { backgroundColor: previewColor }
                                            : { background: 'repeating-conic-gradient(#555 0% 25%, #333 0% 50%) 0 0 / 6px 6px' }
                                        }
                                    />
                                    <div className="flex-1 bg-slate-800 rounded-lg px-2 py-1.5 flex items-center">
                                        <input
                                            type="text"
                                            placeholder="#ffffff"
                                            value={hexInput}
                                            onMouseDown={e => e.stopPropagation()}
                                            onChange={e => {
                                                const raw = e.target.value;
                                                const val = raw.startsWith('#') ? raw : `#${raw}`;
                                                setHexInput(raw);
                                                if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) setPreviewColor(val);
                                            }}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') {
                                                    const val = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
                                                    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
                                                        execCommand(colorPickerMode === 'text' ? 'foreColor' : 'backColor', val);
                                                        setShowColorPicker(false);
                                                        setHexInput('');
                                                        setPreviewColor('');
                                                    }
                                                }
                                            }}
                                            className="flex-1 bg-transparent text-xs font-mono font-bold text-slate-100 outline-none w-16"
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            const val = hexInput.startsWith('#') ? hexInput : '#' + hexInput;
                                            if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val)) {
                                                execCommand(colorPickerMode === 'text' ? 'foreColor' : 'backColor', val);
                                                setShowColorPicker(false);
                                                setHexInput('');
                                                setPreviewColor('');
                                            }
                                        }}
                                        className="bg-[var(--color-primary)] text-white rounded-lg px-2 py-1.5 text-[10px] font-bold hover:opacity-90 transition-colors flex-shrink-0"
                                    >OK</button>
                                </div>
                                <input
                                    type="color"
                                    className="w-full h-7 cursor-pointer rounded-lg border border-slate-700 mb-2.5"
                                    value={previewColor || '#000000'}
                                    onMouseDown={e => e.stopPropagation()}
                                    onChange={e => {
                                        setHexInput(e.target.value);
                                        setPreviewColor(e.target.value);
                                        execCommand(colorPickerMode === 'text' ? 'foreColor' : 'backColor', e.target.value);
                                    }}
                                />
                                {usedColors.filter(c => c && c !== 'transparent' && c !== 'none' && !c.includes('gradient')).length > 0 && (
                                    <div className="mb-2.5">
                                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Đang dùng</p>
                                        <div className="flex flex-wrap gap-1.5 max-w-[190px]">
                                            {usedColors.filter(c => c && c !== 'transparent' && c !== 'none' && !c.includes('gradient')).slice(0, 10).map((c, i) => (
                                                <button key={i} onClick={() => { execCommand(colorPickerMode === 'text' ? 'foreColor' : 'backColor', c); setShowColorPicker(false); }} className="w-5 h-5 rounded-full border border-white/10 hover:scale-125 transition-transform shadow-sm ring-offset-slate-900 hover:ring-2 hover:ring-rose-400" style={{ backgroundColor: c }} title={c} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Palette</p>
                                <div className="grid grid-cols-8 gap-1 max-w-[190px]">
                                    {PREMIUM_COLORS.slice(0, 48).map(c => (
                                        <button key={c} onClick={() => { execCommand(colorPickerMode === 'text' ? 'foreColor' : 'backColor', c); setShowColorPicker(false); }} className="w-5 h-5 rounded-full border border-white/10 hover:scale-125 transition-transform shadow-sm" style={{ backgroundColor: c }} title={c} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <ToolbarBtn onClick={handleLinkClick} title="Chèn link"><Link className="w-3.5 h-3.5" /></ToolbarBtn>

                    <div className="relative">
                        <button
                            onMouseDown={(e) => { e.preventDefault(); saveSelection(); closeAllDropdowns(); setShowMergeTags(v => !v); }}
                            title="Chèn biến MYERP CRM / Tuyển sinh"
                            className="px-2 py-1 rounded-lg transition-colors text-[9px] font-black text-rose-400 hover:bg-rose-600/20 border border-rose-600/30 hover:border-rose-500 flex-shrink-0"
                        >BIẾN</button>
                        {showMergeTags && (
                            <div
                                onMouseDown={(e) => e.preventDefault()}
                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 border border-slate-700 rounded-[14px] shadow-xl p-1.5 w-64 z-50 animate-in slide-in-from-bottom-2 max-h-80 overflow-y-auto custom-scrollbar"
                            >
                                {MYERP_MERGE_TAG_GROUPS.map((group, gIdx) => (
                                    <React.Fragment key={group.id}>
                                        {gIdx > 0 && <div className="border-t border-slate-700/80 my-1.5" />}
                                        <p className="text-[8px] font-black text-rose-400 uppercase tracking-widest px-3 pt-1.5 pb-1">
                                            {group.label}
                                        </p>
                                        {group.tags.map((item) => (
                                            <button
                                                key={item.key}
                                                onMouseDown={(e) => { e.preventDefault(); }}
                                                onClick={() => insertMergeTag(item.tag)}
                                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-slate-800 rounded-lg transition-colors flex justify-between items-center gap-2"
                                            >
                                                <span className="text-slate-300 truncate">{item.label}</span>
                                                <span className="text-rose-400 text-[9px] font-mono shrink-0">{item.tag}</span>
                                            </button>
                                        ))}
                                    </React.Fragment>
                                ))}

                                {/* Special Variables Section */}
                                <div className="border-t border-slate-700 my-1.5" />
                                <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest px-3 pb-1 flex items-center gap-1">
                                    <Braces className="w-2.5 h-2.5" /> Biến đặc biệt
                                </p>
                                {SPECIAL_MERGE_TAGS.map(tag => (
                                    <button
                                        key={tag.val}
                                        onMouseDown={(e) => { e.preventDefault(); }}
                                        onClick={() => insertMergeTag(tag.val)}
                                        className="w-full text-left px-3 py-1.5 text-xs hover:bg-emerald-900/30 rounded-lg transition-colors"
                                        title={tag.desc}
                                    >
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-300">{tag.label}</span>
                                            <span className="text-emerald-400 text-[9px] font-mono">{tag.val}</span>
                                        </div>
                                        <span className="text-slate-500 text-[9px]">{tag.desc}</span>
                                    </button>
                                ))}

                                {customMergeTags.length > 0 && (
                                    <>
                                        <div className="border-t border-slate-700 my-1.5" />
                                        <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest px-3 pb-1 flex items-center gap-1">
                                            <Tag className="w-2.5 h-2.5" /> Custom Fields
                                        </p>
                                        {customMergeTags.map(f => (
                                            <button
                                                key={f.key}
                                                onMouseDown={(e) => { e.preventDefault(); }}
                                                onClick={() => insertMergeTag(`{{${f.key}}}`)}
                                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-900/30 rounded-lg transition-colors flex justify-between items-center"
                                            >
                                                <span className="text-slate-300">{f.label}</span>
                                                <span className="text-blue-400 text-[9px] font-mono">{`{{${f.key}}}`}</span>
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Clear formatting */}
                    <ToolbarBtn onClick={() => execCommand('removeFormat')} title="Xóa định dạng"><Eraser className="w-3.5 h-3.5" /></ToolbarBtn>

                    {/* Tooltip arrow */}
                    {isTopCutoff ? (
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-b-slate-900" />
                    ) : (
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-900" />
                    )}
                </div>{/* end Row 2 */}

            </div>{/* end toolbar wrapper */}

            <InputModal
                isOpen={showLinkModal}
                onClose={() => { setShowLinkModal(false); onModalToggle?.(false); }}
                onConfirm={handleLinkConfirm}
                title="Chèn đường dẫn"
                placeholder="https://example.com"
                confirmLabel="Chèn"
                zIndex={2147483646}
                isDarkTheme={true}
            />
        </>,
        getMktPortalRoot()
    );
};

export default RichTextToolbar;
