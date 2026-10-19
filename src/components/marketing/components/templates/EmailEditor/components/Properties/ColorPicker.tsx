// components/templates/EmailEditor/components/Properties/ColorPicker.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getMktPortalRoot } from '../../../../../utils/portalRoot';
import { Ban, Pipette, Palette } from 'lucide-react';
import { EmailBlock, EmailBlockStyle, EmailBodyStyle } from '../../../../../types';
import { PREMIUM_COLORS, SUGGESTED_GRADIENTS } from '../../constants/editorConstants';

interface ColorPickerProps {
    label: string;
    value: string | undefined;
    onChange: (colorVal: string, type: 'solid' | 'gradient') => void;
    blocks: EmailBlock[];
    bodyStyle: EmailBodyStyle;
    solidOnly?: boolean;
}

// Checkerboard pattern for transparent swatch
const CHECKER_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='4' height='4' fill='%23ccc'/%3E%3Crect x='4' y='4' width='4' height='4' fill='%23ccc'/%3E%3C/svg%3E")`;

const ColorPicker: React.FC<ColorPickerProps> = ({ label, value, onChange, blocks, bodyStyle, solidOnly = false }) => {
    const [mode, setMode] = useState<'solid' | 'gradient'>((value && value.includes('gradient') && !solidOnly) ? 'gradient' : 'solid');
    const [isOpen, setIsOpen] = useState(false);
    const [hexInput, setHexInput] = useState('');
    const triggerRef = useRef<HTMLDivElement>(null);
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

    // Sync hexInput with value when popover opens
    useEffect(() => {
        if (isOpen && value && !value.includes('gradient') && value !== 'transparent' && value !== 'none') {
            setHexInput(value);
        } else if (!isOpen) {
            setHexInput('');
        }
    }, [isOpen, value]);

    // Scan used colors from blocks
    const usedColors = useMemo(() => {
        const colors = new Set<string>();
        const traverse = (items: EmailBlock[]) => {
            items.forEach(b => {
                if (b.style.backgroundColor && !b.style.backgroundColor.includes('gradient')) colors.add(b.style.backgroundColor);
                if (b.style.color) colors.add(b.style.color);
                if (b.style.contentBackgroundColor) colors.add(b.style.contentBackgroundColor);
                if (b.style.borderColor) colors.add(b.style.borderColor);
                if (b.type === 'social' && b.socialLinks) {
                    b.socialLinks.forEach(link => {
                        if (link.customStyle?.backgroundColor) colors.add(link.customStyle.backgroundColor);
                        if (link.customStyle?.iconColor) colors.add(link.customStyle.iconColor);
                    });
                }
                if (b.children) traverse(b.children);
            });
        };
        traverse(blocks || []);
        if (bodyStyle.backgroundColor) colors.add(bodyStyle.backgroundColor);
        if (bodyStyle.contentBackgroundColor) colors.add(bodyStyle.contentBackgroundColor);
        if (bodyStyle.linkColor) colors.add(bodyStyle.linkColor);
        return Array.from(colors).filter(c => c !== 'transparent' && c !== 'none' && c !== '' && !c.includes('gradient')).slice(0, 14);
    }, [blocks, bodyStyle]);

    // Gradient builder state
    const [gradAngle, setGradAngle] = useState(135);
    const [gradColor1, setGradColor1] = useState('#ffffff');
    const [gradColor2, setGradColor2] = useState('#f3f4f6');

    useEffect(() => {
        if (value && value.includes('linear-gradient')) {
            setMode('gradient');
            try {
                const parts = value.match(/linear-gradient\((.*)\)/)?.[1]?.split(',')?.map((s: string) => s.trim());
                if (parts && parts.length >= 3) {
                    const angleMatch = parts[0].match(/(\d+)deg/);
                    let angle = angleMatch ? parseInt(angleMatch[1]) : 135;
                    if (parts[0].includes('to right')) angle = 90;
                    if (parts[0].includes('to bottom')) angle = 180;
                    setGradAngle(isNaN(angle) ? 135 : angle);
                    setGradColor1(parts[1].split(' ')[0]);
                    setGradColor2(parts[2].split(' ')[0]);
                } else if (parts && parts.length === 2) {
                    setGradAngle(180);
                    setGradColor1(parts[0].split(' ')[0]);
                    setGradColor2(parts[1].split(' ')[0]);
                }
            } catch (e) { }
        } else {
            setMode('solid');
        }
    }, [value]);

    const applyGradient = (angle: number, c1: string, c2: string) => {
        setGradAngle(angle); setGradColor1(c1); setGradColor2(c2);
        onChange(`linear-gradient(${angle}deg, ${c1}, ${c2})`, 'gradient');
    };

    const toggleOpen = () => {
        if (!isOpen && triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const screenHeight = window.innerHeight;
            const screenWidth = window.innerWidth;
            const spaceBelow = screenHeight - rect.bottom;
            const showAbove = spaceBelow < 400;
            const width = 288;
            let left = rect.left;
            if (left + width + 20 > screenWidth) left = screenWidth - width - 20;
            left = Math.max(10, left);
            setPopoverStyle({
                position: 'fixed',
                top: showAbove ? 'auto' : `${rect.bottom + 8}px`,
                bottom: showAbove ? `${screenHeight - rect.top + 8}px` : 'auto',
                left: `${left}px`,
                width: `${width}px`,
                zIndex: 2147483647,
                maxHeight: '450px',
                overflowY: 'auto'
            });
        }
        setIsOpen(!isOpen);
    };

    const isValidHex = (v: string) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(v);

    const handleHexInputChange = (raw: string) => {
        setHexInput(raw);
        const normalized = raw.startsWith('#') ? raw : `#${raw}`;
        if (isValidHex(normalized)) {
            onChange(normalized, 'solid');
        }
    };

    const handleHexApply = () => {
        const normalized = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
        if (isValidHex(normalized)) {
            onChange(normalized, 'solid');
            setIsOpen(false);
        }
    };

    // Swatch display: shows checkerboard for transparent/none, colored otherwise
    const isTransparent = !value || value === 'transparent' || value === 'none';
    const swatchStyle: React.CSSProperties = isTransparent
        ? { backgroundImage: CHECKER_BG, backgroundSize: '8px 8px' }
        : value?.includes('gradient')
            ? { background: value }
            : { backgroundColor: value };

    // Preview color from hex input (live sync)
    const hexPreviewColor = (() => {
        if (!hexInput) return value && !isTransparent && !value.includes('gradient') ? value : '';
        const n = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
        return isValidHex(n) ? n : '';
    })();

    return (
        <div className="space-y-2 w-full">
            <div className="flex justify-between items-center">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</label>
                {!solidOnly && (
                    <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg">
                        <button
                            onClick={() => { setMode('solid'); onChange('transparent', 'solid'); }}
                            className={`px-2 py-0.5 text-[8px] font-bold rounded-md transition-all ${mode === 'solid' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                        >Solid</button>
                        <button
                            onClick={() => { setMode('gradient'); onChange('linear-gradient(135deg, #ffffff, #f3f4f6)', 'gradient'); }}
                            className={`px-2 py-0.5 text-[8px] font-bold rounded-md transition-all ${mode === 'gradient' ? 'bg-white shadow text-slate-800' : 'text-slate-400'}`}
                        >Gradient</button>
                    </div>
                )}
            </div>

            <div
                ref={triggerRef}
                className={`relative flex items-center gap-2.5 px-3 py-2 bg-white border rounded-xl transition-all cursor-pointer ${
                    isOpen ? 'border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20 shadow-xs' : 'border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
                onClick={toggleOpen}
            >
                {/* Color swatch - always shows border so white is visible */}
                <div
                    className="w-6 h-6 rounded-lg border border-black/10 shrink-0 shadow-xs"
                    style={mode === 'solid' ? swatchStyle : { background: value }}
                />
                {mode === 'solid' ? (
                    <input
                        type="text"
                        value={value || ''}
                        onChange={(e) => onChange(e.target.value, 'solid')}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 bg-transparent text-xs font-mono font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none min-w-0"
                        style={{ border: 'none', outline: 'none', boxShadow: 'none' }}
                        placeholder="#ffffff"
                    />
                ) : (
                    <span className="flex-1 text-[11px] text-slate-600 font-semibold truncate">Linear Gradient</span>
                )}
            </div>

            {isOpen && createPortal(
                <>
                    <div className="fixed inset-0 z-[2147483646]" style={{ zIndex: 2147483646 }} onClick={() => setIsOpen(false)} />
                    <div
                        style={popoverStyle}
                        className="bg-white border border-slate-100 rounded-[18px] shadow-2xl p-4 animate-in fade-in zoom-in-95 custom-scrollbar"
                    >
                        {/* Clear / Transparent */}
                        <div className="mb-4">
                            <button
                                onClick={() => { onChange('transparent', mode); setIsOpen(false); }}
                                className="w-full flex items-center justify-center gap-2.5 py-3 border border-slate-100 rounded-[14px] hover:bg-rose-50 hover:border-rose-100 transition-all text-[11px] font-black uppercase text-slate-400 hover:text-rose-500 shadow-sm"
                            >
                                <Ban className="w-3.5 h-3.5 text-rose-400" /> Không màu (Transparent)
                            </button>
                        </div>

                        {mode === 'solid' && (
                            <div className="space-y-4">
                                {/* Hex input with live preview */}
                                <div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5 ml-1">Nhập màu hex</p>
                                    <div className="flex gap-2.5 items-center">
                                        {/* Preview swatch */}
                                        <div
                                            className="w-10 h-10 rounded-[14px] border-2 border-slate-100 flex-shrink-0 shadow-inner"
                                            style={
                                                hexPreviewColor
                                                    ? { backgroundColor: hexPreviewColor }
                                                    : isTransparent
                                                        ? { backgroundImage: CHECKER_BG, backgroundSize: '8px 8px' }
                                                        : { backgroundColor: value }
                                            }
                                        />
                                        <div className="flex-1 bg-white border border-slate-200 rounded-[14px] px-3 py-2 flex items-center shadow-sm">
                                            <input
                                                type="text"
                                                placeholder="#ffffff"
                                                value={hexInput}
                                                onChange={e => handleHexInputChange(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleHexApply()}
                                                onClick={e => e.stopPropagation()}
                                                className="flex-1 bg-transparent text-xs font-mono font-black text-slate-700 outline-none w-0"
                                                style={{ minWidth: 0, border: 'none', outline: 'none', boxShadow: 'none' }}
                                                autoFocus
                                            />
                                        </div>
                                            <button
                                                onClick={handleHexApply}
                                                className="bg-[#BD1D2D] hover:bg-[#a61927] text-white rounded-[14px] px-4 py-2 text-[11px] font-black transition-all shadow-md active:scale-95 shrink-0"
                                            >OK</button>
                                        </div>
                                        {/* Native color picker */}
                                        <div className="mt-2 relative">
                                            <div className="w-full h-8 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black text-slate-500 transition-colors pointer-events-none">
                                                <Pipette className="w-3.5 h-3.5 text-[#BD1D2D]" />
                                                <span>CHỌN MÀU TỪ BẢNG MÀU</span>
                                            </div>
                                            <input
                                                type="color"
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                value={value && !value.includes('gradient') && value !== 'transparent' && value !== 'none' ? value : '#ffffff'}
                                                onChange={(e) => { onChange(e.target.value, 'solid'); setHexInput(e.target.value); }}
                                            />
                                        </div>
                                    </div>

                                    {/* Used colors */}
                                    <div className="border-t border-slate-100 pt-2">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Đang dùng</p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {usedColors.map((c, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => { onChange(c, 'solid'); setIsOpen(false); }}
                                                    className="w-6 h-6 rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform ring-1 ring-slate-200 hover:ring-[#BD1D2D]"
                                                    style={{ backgroundColor: c }}
                                                    title={c}
                                                />
                                            ))}
                                            {usedColors.length === 0 && (
                                                <span className="text-[9px] text-slate-300 italic">Chưa có màu nào</span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Premium palette */}
                                    <div className="border-t border-slate-100 pt-2">
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Premium Palette</p>
                                        <div className="grid grid-cols-8 gap-1.5">
                                            {PREMIUM_COLORS.map(c => (
                                                <button
                                                    key={c}
                                                    onClick={() => { onChange(c, 'solid'); setIsOpen(false); }}
                                                    className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform ring-1 ring-slate-200 hover:ring-[#BD1D2D]"
                                                    style={{ backgroundColor: c }}
                                                    title={c}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {mode === 'gradient' && (
                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <div className="flex-1 space-y-1">
                                            <label className="text-[8px] font-bold uppercase text-slate-400">Start Color</label>
                                            <div className="flex items-center gap-1 border rounded-xl p-1.5 border-slate-200">
                                                <input type="color" className="w-7 h-7 rounded-full cursor-pointer border border-slate-200 p-0 overflow-hidden bg-transparent shrink-0" value={gradColor1} onChange={(e) => applyGradient(gradAngle, e.target.value, gradColor2)} />
                                                <span className="text-[9px] font-mono text-slate-500 truncate ml-1">{gradColor1}</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <label className="text-[8px] font-bold uppercase text-slate-400">End Color</label>
                                            <div className="flex items-center gap-1 border rounded-xl p-1.5 border-slate-200">
                                                <input type="color" className="w-7 h-7 rounded-full cursor-pointer border border-slate-200 p-0 overflow-hidden bg-transparent shrink-0" value={gradColor2} onChange={(e) => applyGradient(gradAngle, gradColor1, e.target.value)} />
                                                <span className="text-[9px] font-mono text-slate-500 truncate ml-1">{gradColor2}</span>
                                            </div>
                                        </div>
                                        <div className="w-16 space-y-1">
                                            <label className="text-[8px] font-bold uppercase text-slate-400">Góc</label>
                                            <input
                                                type="number"
                                                className="w-full text-xs border border-slate-200 rounded-xl px-1 py-2 text-center font-bold outline-none focus:border-[#BD1D2D]"
                                                value={gradAngle}
                                                onChange={(e) => applyGradient(parseInt(e.target.value) || 0, gradColor1, gradColor2)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Mẫu có sẵn</p>
                                        <div className="grid grid-cols-3 gap-2">
                                            {SUGGESTED_GRADIENTS.map((g, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => { onChange(g.value, 'gradient'); setMode('gradient'); setIsOpen(false); }}
                                                    className="h-8 rounded-xl shadow-sm hover:scale-105 transition-transform border border-slate-100"
                                                    style={{ background: g.value }}
                                                    title={g.name}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </>,
                    getMktPortalRoot()
                )}
        </div>
    );
};

export default ColorPicker;
