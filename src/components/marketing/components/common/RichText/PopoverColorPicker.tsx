import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Ban, Palette } from 'lucide-react';
import { PREMIUM_COLORS } from '../../templates/EmailEditor/constants/editorConstants';
import { getMktPortalRoot } from '../../../utils/portalRoot';

interface PopoverColorPickerProps {
    onSelect: (color: string) => void;
    onClose: () => void;
    position: { top: number; left: number };
    usedColors?: string[];
}

const CHECKER_BG = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Crect width='4' height='4' fill='%23ccc'/%3E%3Crect x='4' y='4' width='4' height='4' fill='%23ccc'/%3E%3C/svg%3E")`;

const PopoverColorPicker: React.FC<PopoverColorPickerProps> = ({ onSelect, onClose, position, usedColors = [] }) => {
    const presetColors = PREMIUM_COLORS.slice(0, 24);
    const [hexInput, setHexInput] = useState('');
    const [previewColor, setPreviewColor] = useState('');
    const [nativeColor, setNativeColor] = useState('#000000');
    const containerRef = useRef<HTMLDivElement>(null);

    const filteredUsedColors = Array.from(new Set(usedColors))
        .filter(c => c && c !== 'transparent' && c !== 'none' && !c.includes('gradient'))
        .slice(0, 12);

    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);

    const [style, setStyle] = useState<React.CSSProperties>({
        position: 'fixed',
        visibility: 'hidden', // Hide initially to wait for math
        zIndex: 100200,
    });
    const [arrowLeft, setArrowLeft] = useState<number | string>('1.25rem'); // 20px (left-5)

    useEffect(() => {
        if (!containerRef.current) return;
        const w = 240; 
        const h = 380; 
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let left = position.left - 10;
        let top = position.top + 38;
        let arrowPos: number | string = '1.25rem';

        // Nếu cái nút bấm nằm ở mảng bên phải của màn hình (vùng properties)
        // Ta sẽ tự động khóa lề phải của popover lại, để popup nở vểnh sang bên trái thay vì rớt mép phải.
        if (position.left > viewportWidth - 300) {
            // Popup được neo về bên phải, canh đuôi theo cái nút
            left = position.left - w + 30; // 30 là trừ hao khoảng cách tính từ viền phải vào nút
            // Lật mũi tên sang mép phải
            arrowPos = `calc(100% - 30px)`;
        } else {
            // Nếu không thì cứ tràn mép phải
            if (left + w > viewportWidth - 10) {
                const diff = (left + w) - (viewportWidth - 10);
                left -= diff;
                arrowPos = `calc(1.25rem + ${diff}px)`; 
            }
        }

        if (left < 10) left = 10;
        if (top + h > viewportHeight - 10) top = position.top - h - 8;

        setStyle({ position: 'fixed', top, left, visibility: 'visible', zIndex: 100200 });
        setArrowLeft(arrowPos);
    }, [position, mounted]); // trigger after mounted is true

    const isValidHex = (val: string) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(val);

    const handleHexChange = (val: string) => {
        // Accept with or without # prefix
        const normalized = val.startsWith('#') ? val : `#${val}`;
        setHexInput(val);
        if (isValidHex(normalized)) {
            setPreviewColor(normalized);
            setNativeColor(normalized);
        }
    };

    const handleApply = () => {
        const normalized = hexInput.startsWith('#') ? hexInput : `#${hexInput}`;
        if (isValidHex(normalized)) {
            onSelect(normalized);
            onClose();
        }
    };

    const handleNativeChange = (color: string) => {
        setNativeColor(color);
        setPreviewColor(color);
        setHexInput(color);
        // Don't close here - let user pick and then close on blur or OK
        onSelect(color);
    };

    if (!mounted) return null;

    return createPortal(
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-[99998]" onClick={onClose} />

            <div
                ref={containerRef}
                style={style}
                className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 w-56 animate-in fade-in zoom-in-95"
            >
                {/* Arrow */}
                <div 
                    className="absolute -top-1.5 w-3 h-3 bg-white border-t border-l border-slate-200 rotate-45 transform"
                    style={{ left: arrowLeft }}
                />

                {/* Hex input + preview */}
                <div className="mb-3">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Nhập màu</p>
                    <div className="flex gap-1.5 items-center">
                        {/* Color swatch - with border so white is visible */}
                        <div
                            className="w-8 h-8 rounded-xl border-2 border-slate-200 flex-shrink-0 shadow-inner"
                            style={
                                previewColor
                                    ? { backgroundColor: previewColor }
                                    : { backgroundImage: CHECKER_BG, backgroundSize: '8px 8px' }
                            }
                        />
                        {/* Hex text input on dark bg */}
                        <div className="flex-1 bg-slate-800 rounded-xl px-2 py-1.5 flex items-center">
                            <input
                                type="text"
                                placeholder="#ffffff"
                                value={hexInput}
                                onChange={e => handleHexChange(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleApply()}
                                className="flex-1 bg-transparent text-xs font-mono font-bold text-slate-100 outline-none w-0"
                                style={{ minWidth: 0 }}
                            />
                        </div>
                        <button
                            onClick={handleApply}
                            disabled={!isValidHex(hexInput.startsWith('#') ? hexInput : `#${hexInput}`)}
                            className="bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl px-2 py-1.5 text-[10px] font-black transition-all hover:bg-blue-700"
                        >
                            OK
                        </button>
                    </div>

                    {/* Native color picker */}
                    <div className="mt-2 relative">
                        <div className="w-full h-8 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl flex items-center justify-center gap-1.5 text-[10px] font-black text-slate-500 transition-colors pointer-events-none">
                            <Palette className="w-3.5 h-3.5 text-blue-600" />
                            <span>CHỌN MÀU TỪ BẢNG MÀU</span>
                        </div>
                        <input
                            type="color"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            value={nativeColor}
                            onChange={e => handleNativeChange(e.target.value)}
                        />
                    </div>
                </div>

                {/* Used colors */}
                {filteredUsedColors.length > 0 && (
                    <div className="mb-3 border-t border-slate-100 pt-2">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Đang dùng</p>
                        <div className="flex flex-wrap gap-1.5">
                            {filteredUsedColors.map((c, i) => (
                                <button
                                    key={i}
                                    onClick={() => { onSelect(c); onClose(); }}
                                    className="w-6 h-6 rounded-full border-2 border-white shadow-md hover:scale-110 transition-transform ring-1 ring-slate-200 hover:ring-blue-500"
                                    style={{ backgroundColor: c }}
                                    title={c}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Preset palette */}
                <div className="border-t border-slate-100 pt-2">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Premium Palette</p>
                    <div className="grid grid-cols-6 gap-1.5">
                        {presetColors.map(c => (
                            <button
                                key={c}
                                onClick={() => { onSelect(c); onClose(); }}
                                className="w-6 h-6 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform ring-1 ring-slate-200 hover:ring-blue-500"
                                style={{ backgroundColor: c }}
                                title={c}
                            />
                        ))}
                    </div>
                </div>

                {/* Close - no transparent needed for text color picker, just a subtle close */}
                <div className="mt-2 border-t border-slate-100 pt-2">
                    <button
                        onClick={onClose}
                        className="w-full text-center text-[9px] font-bold text-slate-400 hover:text-slate-600 transition-colors py-1"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </>,
        getMktPortalRoot()
    );
};

export default PopoverColorPicker;
