// components/common/RichText/RichText.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
    Bold, Italic, Underline, Link as LinkIcon, AlignLeft, AlignCenter, AlignRight, AlignJustify,
    RemoveFormatting, Check, X, Highlighter, Type, Strikethrough, Unlink,
    Heading, Lock
} from 'lucide-react';
import PopoverColorPicker from './PopoverColorPicker';
import { sanitizeHtmlLineHeight } from '../../templates/EmailEditor/utils/styleUtils';

interface RichTextProps {
    value: string;
    onChange: (val: string) => void;
    className?: string;
    bodyLinkColor?: string;
    minHeight?: string;
    customMergeTags?: { label: string; key: string }[];
    usedColors?: string[]; // Màu đang dùng trong email đã gửi ý trong tooltip
    fontSize?: string; // Font size từ block style panel để sync toolbar hiển thị
}

const RichText: React.FC<RichTextProps> = ({ value, onChange, className = "", bodyLinkColor = '#2563eb', minHeight = '120px', customMergeTags = [], usedColors = [], fontSize }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    const savedRangeRef = useRef<Range | null>(null);  // ✅ useRef tránh stale closure
    const [savedRange, setSavedRange] = useState<Range | null>(null);
    const [activeFormats, setActiveFormats] = useState<string[]>([]);
    const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);
    const [showFontFamilyDropdown, setShowFontFamilyDropdown] = useState(false);
    const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false);
    const [showColorPicker, setShowColorPicker] = useState<'fore' | 'hilite' | null>(null);
    const [pickerPosition, setPickerPosition] = useState({ top: 0, left: 0 });
    const [activeLinkNode, setActiveLinkNode] = useState<HTMLElement | null>(null);
    const [showVariablePicker, setShowVariablePicker] = useState(false);

    const FONT_FAMILIES = [
        { label: 'Roboto', val: "'Roboto', sans-serif" },
        { label: 'Arial', val: 'Arial, sans-serif' },
        { label: 'Helvetica', val: 'Helvetica, sans-serif' },
        { label: 'Times New Roman', val: "'Times New Roman', Times, serif" },
        { label: 'Courier New', val: "'Courier New', Courier, monospace" },
        { label: 'Verdana', val: 'Verdana, Geneva, sans-serif' },
        { label: 'Georgia', val: 'Georgia, serif' },
        { label: 'Inter', val: 'Inter, sans-serif' },
        { label: 'Outfit', val: 'Outfit, sans-serif' },
    ];

    const FONT_SIZES = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '48px', '64px'];

    useEffect(() => {
        if (editorRef.current) {
            const sanitized = sanitizeHtmlLineHeight(value);
            if (editorRef.current.innerHTML !== sanitized) {
                if (document.activeElement !== editorRef.current) {
                    editorRef.current.innerHTML = sanitized;
                }
            }
        }
    }, [value]);

    const handleChange = (htmlVal: string) => {
        onChange(sanitizeHtmlLineHeight(htmlVal));
    };

    const checkActiveFormats = () => {
        const formats: string[] = [];
        if (document.queryCommandState('bold')) formats.push('bold');
        if (document.queryCommandState('italic')) formats.push('italic');
        if (document.queryCommandState('underline')) formats.push('underline');
        if (document.queryCommandState('strikethrough')) formats.push('strikethrough');
        if (document.queryCommandState('justifyLeft')) formats.push('justifyLeft');
        if (document.queryCommandState('justifyCenter')) formats.push('justifyCenter');
        if (document.queryCommandState('justifyRight')) formats.push('justifyRight');
        setActiveFormats(formats);

        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            let node = sel.anchorNode;
            let foundLink = false;
            while (node && node !== editorRef.current) {
                if (node.nodeName === 'A') {
                    setActiveLinkNode(node as HTMLElement);
                    foundLink = true;
                    break;
                }
                node = node.parentNode;
            }
            if (!foundLink) setActiveLinkNode(null);
        }
    };

    const saveSelection = () => {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
                savedRangeRef.current = range.cloneRange(); // ✅ clone ngay lập tức, lưu vào ref
                setSavedRange(range.cloneRange());
            }
        }
        checkActiveFormats();
    };

    const restoreSelection = () => {
        const range = savedRangeRef.current || savedRange; // ✅ ưu tiên ref (không stale)
        const sel = window.getSelection();
        if (sel && range) {
            sel.removeAllRanges();
            sel.addRange(range);
        }
    };

    const exec = (command: string, val: string | undefined = undefined) => {
        const isInsertionCmd = ['insertText', 'insertHTML', 'createLink', 'insertImage'].includes(command);
        const sel = window.getSelection();
        if (!isInsertionCmd && ['justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull', 'formatBlock'].includes(command)) {
            if (sel && sel.isCollapsed && editorRef.current) {
                const range = document.createRange();
                range.selectNodeContents(editorRef.current);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }

        if (command === 'fontSize' || command === 'fontName' || command === 'foreColor' || command === 'hiliteColor') {
            document.execCommand('styleWithCSS', false, 'true');
        }
        document.execCommand(command, false, val);
        if (editorRef.current) handleChange(editorRef.current.innerHTML);
        checkActiveFormats();
    };

    const applyFontSize = (size: string) => {
        // ✅ Restore selection từ ref (không stale)
        const range = savedRangeRef.current || savedRange;
        const sel = window.getSelection();

        if (range && sel) {
            sel.removeAllRanges();
            sel.addRange(range);
        }

        // Nếu không có gì được bôi đen (collapsed) → select all
        if (!sel || sel.isCollapsed) {
            if (editorRef.current) {
                const r = document.createRange();
                r.selectNodeContents(editorRef.current);
                sel?.removeAllRanges();
                sel?.addRange(r);
            }
        }

        // Dùng font size 7 trick để wrap selection
        document.execCommand('styleWithCSS', false, 'false');
        document.execCommand('fontSize', false, '7');

        // Replace <font size="7"> với <span style="font-size: Xpx">
        const fontElements = editorRef.current?.querySelectorAll('font[size="7"]');
        fontElements?.forEach(el => {
            const span = document.createElement('span');
            span.style.fontSize = size;
            span.innerHTML = el.innerHTML;
            el.parentNode?.replaceChild(span, el);
        });

        if (editorRef.current) handleChange(editorRef.current.innerHTML);
        setShowFontSizeDropdown(false);
        setCustomFontSize(size.replace('px', ''));
    };

    const [customFontSize, setCustomFontSize] = useState(() => {
        // Khởi tạo từ prop fontSize nếu có (vd: '16px' → '16')
        if (fontSize) return fontSize.replace('px', '');
        return '16';
    });

    // ✅ Sync customFontSize khi block fontSize thay đổi từ Typography panel
    useEffect(() => {
        if (fontSize) {
            const numStr = fontSize.replace('px', '');
            setCustomFontSize(numStr);
        }
    }, [fontSize]);

    const handleLinkBtnClick = (e: React.MouseEvent) => {
        e.preventDefault();

        // Block editing if selection contains protected system link
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            const frag = range.cloneContents();
            const div = document.createElement('div');
            div.appendChild(frag);
            if (div.querySelector('a[href="{{unsubscribe_url}}"]')) {
                return;
            }
        }

        saveSelection();
        if (activeLinkNode) setLinkUrl(activeLinkNode.getAttribute('href') || '');
        else setLinkUrl('');
        setShowLinkInput(!showLinkInput);
    };

    const applyLink = () => {
        restoreSelection();
        if (linkUrl) {
            exec('createLink', linkUrl);
            const sel = window.getSelection();
            if (sel && sel.anchorNode) {
                let node: Node | null = sel.anchorNode;
                while (node && node.nodeName !== 'A' && node !== editorRef.current) {
                    node = node.parentNode;
                }
                if (node && node.nodeName === 'A') {
                    const el = node as HTMLElement;
                    el.setAttribute('target', '_blank');
                    el.style.color = bodyLinkColor;
                    el.style.textDecoration = 'underline';
                }
            }
            if (editorRef.current) handleChange(editorRef.current.innerHTML);
        }
        setShowLinkInput(false);
        setLinkUrl('');
        setActiveLinkNode(null);
    };

    const removeLink = () => {
        if (activeLinkNode) {
            restoreSelection();
            // Clear inline styles before unlinking
            activeLinkNode.style.color = '';
            activeLinkNode.style.textDecoration = '';
            exec('unlink');
            setActiveLinkNode(null);
            setShowLinkInput(false);
        }
    };

    const handleColorClick = (e: React.MouseEvent, type: 'fore' | 'hilite') => {
        e.preventDefault();
        saveSelection();
        const rect = e.currentTarget.getBoundingClientRect();
        setPickerPosition({ top: rect.top, left: rect.left });
        setShowColorPicker(showColorPicker === type ? null : type);
    };

    const ToolbarBtn = ({ icon: Icon, cmd, title, val }: any) => {
        const isActive = activeFormats.includes(cmd) ||
            (cmd === 'justifyLeft' && !activeFormats.some(f => ['justifyCenter', 'justifyRight'].includes(f)));
        return (
            <button
                onMouseDown={(e) => { e.preventDefault(); exec(cmd, val); }}
                className={`p-1.5 rounded-md transition-all duration-200 ${isActive ? 'bg-[#BD1D2D] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
                title={title}
            >
                <Icon className="w-4 h-4" />
            </button>
        );
    };

    return (
        <div className={`group border border-slate-200 rounded-xl overflow-visible bg-white focus-within:ring-2 focus-within:ring-[#BD1D2D]/20 focus-within:border-[#BD1D2D] transition-all shadow-sm ${className}`}>
            <div className="flex flex-wrap items-center gap-1 p-2 border-b border-slate-100 bg-slate-50/80 backdrop-blur-sm sticky top-0 z-20 select-none">
                {/* --- Group 1: Typography --- */}
                <div className="flex items-center gap-0.5 bg-white/50 p-0.5 rounded-lg border border-slate-200/50 mr-1">
                    {/* Heading */}
                    <div className="relative">
                        <button onMouseDown={(e) => { e.preventDefault(); setShowHeadingDropdown(!showHeadingDropdown); setShowFontFamilyDropdown(false); setShowFontSizeDropdown(false); }} className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-slate-100 text-slate-600 text-xs font-bold h-8 transition-colors" title="Tiêu đề"><Heading className="w-4 h-4" /></button>
                        {showHeadingDropdown && (
                            <div className="absolute top-10 left-0 bg-white border border-slate-200 rounded-xl shadow-lg p-1 w-32 z-50 animate-in zoom-in-95 shadow-xl shadow-slate-200/50">
                                {[{ tag: 'P', label: 'Paragraph' }, { tag: 'H1', label: 'H1' }, { tag: 'H2', label: 'H2' }, { tag: 'H3', label: 'H3' }].map((h) => (
                                    <button key={h.tag} onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', h.tag === 'P' ? '<p>' : `<${h.tag}>`); setShowHeadingDropdown(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 rounded-lg whitespace-nowrap">{h.label}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Font Family */}
                    <div className="relative">
                        <button onMouseDown={(e) => { e.preventDefault(); setShowFontFamilyDropdown(!showFontFamilyDropdown); setShowHeadingDropdown(false); setShowFontSizeDropdown(false); }} className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-slate-100 text-slate-600 text-[10px] font-bold uppercase tracking-wider h-8 transition-colors" title="Kiểu chữ">
                            Font <Type className="w-3 h-3" />
                        </button>
                        {showFontFamilyDropdown && (
                            <div className="absolute top-10 left-0 bg-white border border-slate-200 rounded-xl shadow-lg p-1 w-40 z-50 animate-in zoom-in-95 max-h-60 overflow-y-auto custom-scrollbar shadow-xl shadow-slate-200/50">
                                {FONT_FAMILIES.map((f) => (
                                    <button key={f.val} onMouseDown={(e) => { e.preventDefault(); restoreSelection(); exec('fontName', f.val); setShowFontFamilyDropdown(false); }} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 rounded-lg" style={{ fontFamily: f.val }}>{f.label}</button>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Font Size */}
                    <div className="relative flex items-center gap-1">
                        <button onMouseDown={(e) => { e.preventDefault(); saveSelection(); setShowFontSizeDropdown(!showFontSizeDropdown); setShowHeadingDropdown(false); setShowFontFamilyDropdown(false); }} className="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-slate-100 text-slate-600 text-[10px] font-bold h-8 transition-colors" title="Cỡ chữ">
                            Size <span className="text-[9px] opacity-60">px</span>
                        </button>
                        {/* ✅ Ô nhập px thủ công */}
                        <input
                            type="number"
                            min="8" max="120"
                            value={customFontSize}
                            onChange={e => setCustomFontSize(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyFontSize(customFontSize + 'px'); } }}
                            onBlur={e => { applyFontSize(customFontSize + 'px'); }}
                            onFocus={() => saveSelection()}
                            className="w-12 h-8 text-center text-xs border border-slate-200 rounded-md bg-white text-slate-700 font-bold focus:ring-1 focus:ring-[#BD1D2D] focus:border-[#BD1D2D] outline-none"
                            title="Nhập cỡ chữ (px) rồi Enter"
                        />
                        {showFontSizeDropdown && (
                            <div className="absolute top-10 left-0 bg-white border border-slate-200 rounded-xl shadow-lg p-1 w-24 z-50 animate-in zoom-in-95 grid grid-cols-2 gap-1 shadow-xl shadow-slate-200/50">
                                {FONT_SIZES.map((s) => (
                                    <button key={s} onMouseDown={(e) => { e.preventDefault(); applyFontSize(s); }} className="px-2 py-1.5 text-[10px] font-bold hover:bg-slate-50 rounded-md text-center">{s.replace('px', '')}</button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* --- Group 2: Basic Formatting --- */}
                <div className="flex items-center gap-0.5 bg-white/50 p-0.5 rounded-lg border border-slate-200/50 mr-1">
                    <ToolbarBtn icon={Bold} cmd="bold" title="In đậm" />
                    <ToolbarBtn icon={Italic} cmd="italic" title="In nghiêng" />
                    <ToolbarBtn icon={Underline} cmd="underline" title="Gạch chân" />
                    <ToolbarBtn icon={Strikethrough} cmd="strikeThrough" title="Gạch ngang" />
                </div>

                {/* --- Group 3: Colors --- */}
                <div className="flex items-center gap-0.5 bg-white/50 p-0.5 rounded-lg border border-slate-200/50 mr-1">
                    <div className="relative">
                        <button onMouseDown={(e) => handleColorClick(e, 'fore')} className={`p-1.5 rounded-md transition-all h-8 flex items-center justify-center ${showColorPicker === 'fore' ? 'bg-[#BD1D2D] text-white' : 'text-slate-500 hover:bg-slate-100'}`} title="Màu chữ"><Type className="w-4 h-4" /></button>
                        {showColorPicker === 'fore' && <PopoverColorPicker onSelect={(c) => { restoreSelection(); exec('foreColor', c); }} onClose={() => setShowColorPicker(null)} position={pickerPosition} usedColors={usedColors} />}
                    </div>
                    <div className="relative">
                        <button onMouseDown={(e) => handleColorClick(e, 'hilite')} className={`p-1.5 rounded-md transition-all h-8 flex items-center justify-center ${showColorPicker === 'hilite' ? 'bg-[#BD1D2D] text-white' : 'text-slate-500 hover:bg-slate-100'}`} title="Màu nền chữ"><Highlighter className="w-4 h-4" /></button>
                        {showColorPicker === 'hilite' && <PopoverColorPicker onSelect={(c) => { restoreSelection(); exec('hiliteColor', c); }} onClose={() => setShowColorPicker(null)} position={pickerPosition} usedColors={usedColors} />}
                    </div>
                </div>

                {/* --- Group 4: Alignment --- */}
                <div className="flex items-center gap-0.5 bg-white/50 p-0.5 rounded-lg border border-slate-200/50 mr-1">
                    <ToolbarBtn icon={AlignLeft} cmd="justifyLeft" title="Còn trái" />
                    <ToolbarBtn icon={AlignCenter} cmd="justifyCenter" title="Còn giữa" />
                    <ToolbarBtn icon={AlignRight} cmd="justifyRight" title="Còn phải" />
                    <ToolbarBtn icon={AlignJustify} cmd="justifyFull" title="Còn đều 2 bên" />
                </div>

                {/* --- Group 5: Actions --- */}
                <div className="flex items-center gap-0.5 bg-white/50 p-0.5 rounded-lg border border-slate-200/50">
                    <button onMouseDown={handleLinkBtnClick} className={`p-1.5 rounded-md transition-all h-8 flex items-center justify-center ${showLinkInput || activeLinkNode ? 'bg-[#BD1D2D] text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`} title="Chèn Link"><LinkIcon className="w-4 h-4" /></button>
                    <ToolbarBtn icon={RemoveFormatting} cmd="removeFormat" title="Xóa định dạng" />

                    {/* Variable Insertion */}
                    <div className="relative">
                        <button
                            onMouseDown={(e) => { e.preventDefault(); setShowVariablePicker(!showVariablePicker); setShowHeadingDropdown(false); setShowFontFamilyDropdown(false); setShowFontSizeDropdown(false); }}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md transition-all text-[10px] font-bold uppercase tracking-wider border h-8 ${showVariablePicker ? 'bg-slate-100 border-slate-200' : 'border-slate-200 hover:bg-slate-50 hover:border-slate-300'} text-slate-600 group/var`}
                            title="Chèn biến"
                        >
                            <span className="font-mono text-xs text-[#BD1D2D] font-black">{`{}`}</span>
                            <span className="hidden sm:inline">Biến</span>
                        </button>
                        {showVariablePicker && (
                            <>
                                <div className="fixed inset-0 z-40" onMouseDown={() => setShowVariablePicker(false)}></div>
                                <div className="absolute top-10 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl w-60 z-50 p-1 animate-in zoom-in-95 origin-top-right max-h-72 overflow-y-auto custom-scrollbar shadow-xl shadow-slate-200/50">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-3 pt-1.5 pb-1">Biến chuẩn</p>
                                    {[
                                        { label: 'Tên (First Name)', val: '{{firstName}}' },
                                        { label: 'Họ (Last Name)', val: '{{lastName}}' },
                                        { label: 'Email', val: '{{email}}' },
                                        { label: 'Số điện thoại', val: '{{phoneNumber}}' },
                                        { label: 'Tên công ty', val: '{{companyName}}' },
                                        { label: 'Link Hủy đăng ký', value: '{{unsubscribe_url}}' }
                                    ].map((v) => (
                                        <button
                                            key={v.val}
                                            onMouseDown={(e) => { e.preventDefault(); exec('insertText', v.val); setShowVariablePicker(false); }}
                                            className="w-full text-left px-3 py-2 text-[11px] font-medium hover:bg-slate-50 rounded-lg text-slate-700 hover:text-[#BD1D2D] flex justify-between items-center group/opt"
                                        >
                                            <span>{v.label}</span>
                                            <span className="font-mono text-[9px] text-slate-300 group-hover/opt:text-[#BD1D2D]/50">{v.val}</span>
                                        </button>
                                    ))}
                                    {customMergeTags.length > 0 && (
                                        <>
                                            <div className="border-t border-slate-100 my-1 mx-2" />
                                            <p className="text-[8px] font-black text-[#BD1D2D] uppercase tracking-widest px-3 pb-1">Custom Fields</p>
                                            {customMergeTags.map(f => (
                                                <button
                                                    key={f.key}
                                                    onMouseDown={(e) => { e.preventDefault(); exec('insertText', `{{${f.key}}}`); setShowVariablePicker(false); }}
                                                    className="w-full text-left px-3 py-2 text-[11px] font-medium hover:bg-[#BD1D2D]/5 rounded-lg text-slate-700 hover:text-[#BD1D2D] flex justify-between items-center group/opt"
                                                >
                                                    <span>{f.label}</span>
                                                    <span className="font-mono text-[9px] text-[#BD1D2D]/40 group-hover/opt:text-[#BD1D2D]">{`{{${f.key}}}`}</span>
                                                </button>
                                            ))}
                                        </>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {(showLinkInput || activeLinkNode) && (
                <div className="p-2 bg-[#BD1D2D]/5 border-b border-[#BD1D2D]/15 flex items-center gap-2 animate-in slide-in-from-top-1">
                    {showLinkInput ? (
                        <>
                            {linkUrl === '{{unsubscribe_url}}' ? (
                                <div className="flex-1 flex items-center gap-2 text-slate-500 italic bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                    <Lock className="w-3.5 h-3.5" />
                                    <span className="text-xs">Link hệ thống (System Variable) - Không cần chỉnh sửa</span>
                                </div>
                            ) : (
                                <input type="text" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyLink()} placeholder="https://..." className="flex-1 bg-white border border-slate-200 focus:border-[#BD1D2D] rounded-lg px-3 py-1.5 text-xs outline-none" autoFocus />
                            )}

                            <button onClick={applyLink} className="p-1.5 bg-[#BD1D2D] hover:bg-[#a61927] text-white rounded-lg"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setShowLinkInput(false)} className="p-1.5 text-slate-400"><X className="w-3.5 h-3.5" /></button>
                        </>
                    ) : (
                        <div className="flex items-center gap-2 w-full">
                            {activeLinkNode?.getAttribute('href') === '{{unsubscribe_url}}' ? (
                                <div className="flex-1 flex flex-col justify-center pl-2">
                                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                        <Lock className="w-3 h-3" /> Link Unsubscribe (Mặc định)
                                    </span>
                                    <span className="text-[10px] text-slate-400 italic">User click sẽ tự động Hủy đăng kýKhông cần sửa.</span>
                                </div>
                            ) : (
                                <span className="text-xs text-[#BD1D2D] font-medium truncate flex-1 pl-2">Link: {activeLinkNode?.getAttribute('href')}</span>
                            )}

                            {activeLinkNode?.getAttribute('href') !== '{{unsubscribe_url}}' && (
                                <button onClick={() => { setLinkUrl(activeLinkNode?.getAttribute('href') || ''); setShowLinkInput(true); }} className="px-2 py-1 bg-white border border-[#BD1D2D]/20 text-[#BD1D2D] rounded text-[10px] font-bold hover:bg-[#BD1D2D]/5">Sửa</button>
                            )}
                            {activeLinkNode?.getAttribute('href') !== '{{unsubscribe_url}}' && (
                                <button onClick={removeLink} className="px-2 py-1 bg-white border border-rose-200 text-rose-600 rounded text-[10px] font-bold flex items-center gap-1"><Unlink className="w-3 h-3" /></button>
                            )}
                        </div>
                    )}
                </div>
            )}

            <div
                ref={editorRef}
                contentEditable
                className="rich-text-editor p-4 outline-none text-sm text-slate-700 leading-relaxed custom-scrollbar prose prose-sm max-w-none empty:before:content-['Nhập_nội_dung_văn_bản...'] empty:before:text-slate-300 empty:before:italic cursor-text"
                style={{ minHeight }}
                onInput={() => handleChange(editorRef.current?.innerHTML || '')}
                onBlur={() => { handleChange(editorRef.current?.innerHTML || ''); checkActiveFormats(); }}
                onMouseUp={saveSelection}
                onKeyUp={saveSelection}
                onFocus={checkActiveFormats}
            />
            <style>{`
                .rich-text-editor a:not([style*="color"]) { color: ${bodyLinkColor}; text-decoration: underline; cursor: pointer; }
                .rich-text-editor strike { color: #ef4444; }
            `}</style>
        </div>
    );
};

export default RichText;