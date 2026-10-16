import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import QRCodeStyling, {
    DrawType,
    TypeNumber,
    Mode,
    ErrorCorrectionLevel,
    DotType,
    CornerSquareType,
    CornerDotType,
    Options
} from '../../shims/qrCodeStyling';
import { X, Check, ArrowRight, Download, Image as ImageIcon, Smile, Square, Circle, Heart, Sparkles, Smartphone, Info, Trash2, Edit3, ChevronDown, ChevronUp, Upload, FolderOpen, Loader2, Palette, Box, Grid, Type, Sliders, Layout, Layers, Wand2 } from 'lucide-react';
import Button from '../common/Button';
import Input from '../common/Input';
import FileLibraryModal from '../common/FileLibraryModal';
import { api } from '../../services/storageAdapter';
import toast from 'react-hot-toast';
import { getMktPortalRoot } from '../../utils/portalRoot';

interface GradientOptions {
    type: 'linear' | 'radial';
    rotation: number;
    colorStops: { offset: number; color: string }[];
}

interface QRConfig {
    value: string;
    width: number;
    height: number;
    margin: number;
    pattern: DotType;
    fgColor: string;
    fgGradientEnabled: boolean;
    fgGradient: GradientOptions;
    bgColor: string;
    bgGradientEnabled: boolean;
    bgGradient: GradientOptions;
    isTransparent: boolean;
    eyeFrame: CornerSquareType;
    eyeBall: CornerDotType;
    eyeFrameColor: string;
    eyeBallColor: string;
    logo?: string;
    logoSize: number;
    logoMargin: number;
    excavate: boolean;
    frameId: string;
    frameText: string;
    frameColor: string;
    logoRadius?: number;
    useDirectLink?: boolean;
}

const DEFAULT_CONFIG: QRConfig = {
    value: '', width: 320, height: 320, margin: 10, pattern: 'square',
    fgColor: '#000000', fgGradientEnabled: false,
    fgGradient: { type: 'linear', rotation: 0, colorStops: [{ offset: 0, color: '#f97316' }, { offset: 1, color: '#f59e0b' }] },
    bgColor: '#ffffff', bgGradientEnabled: false,
    bgGradient: { type: 'linear', rotation: 0, colorStops: [{ offset: 0, color: '#ffffff' }, { offset: 1, color: '#f8fafc' }] },
    isTransparent: false, eyeFrame: 'square', eyeBall: 'square',
    eyeFrameColor: '#000000', eyeBallColor: '#000000',
    logo: undefined, logoSize: 0.3, logoMargin: 5, excavate: true,
    frameId: 'none', frameText: 'SCAN ME!', frameColor: '#f97316',
    logoRadius: 0,
    useDirectLink: false
};

const getProxiedUrl = (url: string | undefined): string | undefined => {
    if (!url) return url;
    return url.replace(/^https?:\/\/automation\.ideas\.edu\.vn\/uploadss\//, '/uploadss/');
};

const getRoundedImage = (src: string, radiusPercent: number): Promise<string> => {
    return new Promise((resolve) => {
        if (!src) {
            resolve('');
            return;
        }
        if (radiusPercent <= 0) {
            resolve(src);
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const size = Math.max(img.width, img.height, 512);
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve('');
                return;
            }

            ctx.clearRect(0, 0, size, size);
            const r = (size * Math.min(radiusPercent, 50)) / 100;

            ctx.beginPath();
            ctx.moveTo(r, 0);
            ctx.lineTo(size - r, 0);
            ctx.quadraticCurveTo(size, 0, size, r);
            ctx.lineTo(size, size - r);
            ctx.quadraticCurveTo(size, size, size - r, size);
            ctx.lineTo(r, size);
            ctx.quadraticCurveTo(0, size, 0, size - r);
            ctx.lineTo(0, r);
            ctx.quadraticCurveTo(0, 0, r, 0);
            ctx.closePath();
            ctx.clip();
            
            const imgAspect = img.width / img.height;
            let drawWidth = size;
            let drawHeight = size;
            let xOffset = 0;
            let yOffset = 0;
            
            if (imgAspect > 1) {
                drawWidth = size * imgAspect;
                xOffset = -(drawWidth - size) / 2;
            } else if (imgAspect < 1) {
                drawHeight = size / imgAspect;
                yOffset = -(drawHeight - size) / 2;
            }
            
            ctx.drawImage(img, xOffset, yOffset, drawWidth, drawHeight);
            
            try {
                resolve(canvas.toDataURL('image/png'));
            } catch (err) {
                console.error('Canvas toDataURL failed', err);
                resolve('');
            }
        };
        img.onerror = () => {
            resolve('');
        };
        img.src = src;
    });
};

const QRDesignerModal: React.FC<any> = ({ isOpen, onClose, onSave, initialConfig, linkUrl, targetUrl, linkName }) => {
    const [config, setConfig] = useState<QRConfig>({ ...DEFAULT_CONFIG, value: linkUrl });
    const [isSaving, setIsSaving] = useState(false);
    const [expandedSections, setExpandedSections] = useState<string[]>(['pattern', 'eye', 'logo']);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [processedLogo, setProcessedLogo] = useState<string | undefined>(undefined);
    
    const qrRef = useRef<HTMLDivElement>(null);
    const qrCode = useRef<QRCodeStyling | null>(null);

    useEffect(() => {
        let isCurrent = true;
        if (!config.logo) {
            setProcessedLogo(undefined);
            return;
        }
        const proxiedUrl = getProxiedUrl(config.logo);
        if (!config.logoRadius || config.logoRadius <= 0) {
            setProcessedLogo(proxiedUrl);
            return;
        }
        getRoundedImage(proxiedUrl || '', config.logoRadius).then(res => {
            if (isCurrent) {
                setProcessedLogo(res || undefined);
            }
        });
        return () => {
            isCurrent = false;
        };
    }, [config.logo, config.logoRadius]);

    useEffect(() => {
        if (!isOpen) return;
        
        const qrValue = config.useDirectLink && targetUrl ? targetUrl : config.value;

        qrCode.current = new QRCodeStyling({
            width: 320,
            height: 320,
            type: 'canvas',
            data: qrValue,
            image: processedLogo,
            dotsOptions: {
                color: config.fgGradientEnabled ? undefined : config.fgColor,
                gradient: config.fgGradientEnabled ? {
                    type: config.fgGradient.type,
                    rotation: (config.fgGradient.rotation * Math.PI) / 180,
                    colorStops: config.fgGradient.colorStops
                } : undefined,
                type: config.pattern
            },
            backgroundOptions: {
                color: config.isTransparent ? 'transparent' : (config.bgGradientEnabled ? undefined : config.bgColor),
                gradient: (!config.isTransparent && config.bgGradientEnabled) ? {
                    type: config.bgGradient.type,
                    rotation: (config.bgGradient.rotation * Math.PI) / 180,
                    colorStops: config.bgGradient.colorStops
                } : undefined
            },
            imageOptions: {
                crossOrigin: 'anonymous',
                margin: config.logoMargin,
                imageSize: config.logoSize
            },
            cornersSquareOptions: { type: config.eyeFrame, color: config.eyeFrameColor },
            cornersDotOptions: { type: config.eyeBall, color: config.eyeBallColor },
            qrOptions: { errorCorrectionLevel: 'H' }
        });

        if (qrRef.current) {
            qrRef.current.innerHTML = '';
            qrCode.current.append(qrRef.current);
        }
    }, [config, isOpen, processedLogo]);

    useEffect(() => {
        if (initialConfig && isOpen) {
            try {
                const parsed = JSON.parse(initialConfig);
                setConfig(prev => ({ ...prev, ...parsed, value: linkUrl }));
            } catch (e) {}
        }
    }, [initialConfig, isOpen, linkUrl]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { toast.error('File quá lớn'); return; }
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await api.post<{ url: string }>('upload', formData);
            if (res.success && res.data?.url) { setConfig(prev => ({ ...prev, logo: res.data!.url })); toast.success('Đã tải ảnh'); }
        } catch { toast.error('Lỗi kết nối'); } finally { setIsUploading(false); }
    };

    const handleDownload = () => {
        const qrValue = config.useDirectLink && targetUrl ? targetUrl : config.value;
        const downloadQrCode = new QRCodeStyling({
            width: 1024,
            height: 1024,
            type: 'canvas',
            data: qrValue,
            image: processedLogo,
            dotsOptions: {
                color: config.fgGradientEnabled ? undefined : config.fgColor,
                gradient: config.fgGradientEnabled ? {
                    type: config.fgGradient.type,
                    rotation: (config.fgGradient.rotation * Math.PI) / 180,
                    colorStops: config.fgGradient.colorStops
                } : undefined,
                type: config.pattern
            },
            backgroundOptions: {
                color: config.isTransparent ? 'transparent' : (config.bgGradientEnabled ? undefined : config.bgColor),
                gradient: (!config.isTransparent && config.bgGradientEnabled) ? {
                    type: config.bgGradient.type,
                    rotation: (config.bgGradient.rotation * Math.PI) / 180,
                    colorStops: config.bgGradient.colorStops
                } : undefined
            },
            imageOptions: {
                crossOrigin: 'anonymous',
                margin: config.logoMargin,
                imageSize: config.logoSize
            },
            cornersSquareOptions: { type: config.eyeFrame, color: config.eyeFrameColor },
            cornersDotOptions: { type: config.eyeBall, color: config.eyeBallColor },
            qrOptions: { errorCorrectionLevel: 'H' }
        });
        downloadQrCode.download({ name: `QR_${linkName}`, extension: 'png' });
    };

    if (!isOpen) return null;

    const FRAMES = [
        { id: 'none', label: 'Không khung' },
        { id: 'classic', label: 'Scan Me!' },
        { id: 'modern', label: 'Hiện đại' },
        { id: 'focus', label: 'Tập trung' },
        { id: 'bubble', label: 'Bong bóng' },
        { id: 'label', label: 'Nhãn' },
        { id: 'envelope', label: 'Thư mời' },
        { id: 'motor', label: 'Giao hàng' },
        { id: 'laptop', label: 'Laptop' },
        { id: 'smartphone', label: 'Mobile' },
    ];

    const PATTERNS: { id: DotType; icon: any }[] = [
        { id: 'square', icon: Square }, { id: 'dots', icon: Circle },
        { id: 'rounded', icon: Smile }, { id: 'extra-rounded', icon: Layers },
        { id: 'classy', icon: Sparkles }, { id: 'classy-rounded', icon: Heart }
    ];

    const EYE_FRAMES: CornerSquareType[] = ['square', 'dot', 'extra-rounded'];
    const EYE_BALLS: CornerDotType[] = ['square', 'dot'];

    const ColorBlock = ({ label, color, isGradient, gradient, onColorChange, onGradientToggle, onGradientChange }: any) => (
        <div className="space-y-4 p-5 bg-slate-50/50 rounded-3xl border border-slate-100">
            <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 uppercase tracking-tighter">{label}</span>
                {onGradientToggle && (
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Gradient</span>
                        <button 
                            onClick={(e) => { e.preventDefault(); onGradientToggle(!isGradient); }}
                            className={`w-9 h-5 rounded-full p-0.5 transition-colors ${isGradient ? 'bg-emerald-500' : 'bg-slate-200'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isGradient ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                    </div>
                )}
            </div>

            {!isGradient ? (
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden shrink-0 relative flex items-center justify-center">
                        <input type="color" value={color} onChange={e => onColorChange(e.target.value)} className="absolute w-[200%] h-[200%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer border-0 p-0" />
                    </div>
                    <input 
                        type="text" value={color.toUpperCase()} onChange={e => onColorChange(e.target.value)}
                        className="flex-1 h-10 px-4 bg-white border border-slate-200 rounded-xl text-xs font-mono font-black text-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                </div>
            ) : (
                <div className="grid grid-cols-2 gap-3">
                    {gradient.colorStops.map((stop: any, idx: number) => (
                        <div key={idx} className="space-y-1.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Màu {idx + 1}</span>
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full border border-white shadow-sm overflow-hidden shrink-0 relative flex items-center justify-center">
                                    <input 
                                        type="color" value={stop.color} 
                                        onChange={e => {
                                            const newStops = [...gradient.colorStops];
                                            newStops[idx].color = e.target.value;
                                            onGradientChange({ ...gradient, colorStops: newStops });
                                        }}
                                        className="absolute w-[200%] h-[200%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 p-0 border-0 cursor-pointer"
                                    />
                                </div>
                                <input 
                                    type="text" value={stop.color.toUpperCase()}
                                    onChange={e => {
                                        const newStops = [...gradient.colorStops];
                                        newStops[idx].color = e.target.value;
                                        onGradientChange({ ...gradient, colorStops: newStops });
                                    }}
                                    className="w-full h-8 px-2 bg-white border border-slate-100 rounded-lg text-[10px] font-mono font-bold"
                                />
                            </div>
                        </div>
                    ))}
                    <div className="col-span-2 flex items-center gap-3 mt-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Góc xoay</span>
                        <input 
                            type="range" min="0" max="360" value={gradient.rotation}
                            onChange={e => onGradientChange({ ...gradient, rotation: parseInt(e.target.value) })}
                            style={{ 
                                background: `linear-gradient(to right, #34d399 0%, #34d399 ${(gradient.rotation/360)*100}%, #e2e8f0 ${(gradient.rotation/360)*100}%, #e2e8f0 100%)` 
                            }}
                            className="flex-1 h-3 rounded-full appearance-none cursor-pointer outline-none touch-none hover:shadow-sm [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                        />
                        <span className="text-[10px] font-black text-slate-600">{gradient.rotation}°</span>
                    </div>
                </div>
            )}
        </div>
    );

    return createPortal(
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-[40px] w-full max-w-7xl h-[92vh] shadow-2xl overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300">
                
                {/* Left Panel */}
                <div className="flex-1 flex flex-col border-r border-slate-100 overflow-hidden bg-slate-50/20">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-amber-600 flex items-center justify-center text-white shadow-md shadow-amber-200"><Wand2 className="w-5 h-5" /></div>
                            <div>
                                <h2 className="text-lg font-black text-slate-800">Thiết kế QR chuyên nghiệp</h2>
                                <p className="text-[11px] text-slate-500 font-medium">Tùy chỉnh phong cách độc đáo cho mã QR của bạn.</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-2xl hover:bg-slate-100 text-slate-400 transition-all"><X className="w-6 h-6" /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar relative">
                        
                        {/* Section: Khung removed as per user request */}

                        {/* Section: Mẫu hoa văn */}
                        <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                            <div onClick={() => setExpandedSections(prev => prev.includes('pattern') ? prev.filter(s => s !== 'pattern') : [...prev, 'pattern'])} className="p-5 flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><Grid className="w-5 h-5" /></div>
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">1. Mẫu mã QR</span>
                                </div>
                                {expandedSections.includes('pattern') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                            {expandedSections.includes('pattern') && (
                                <div className="p-5 pt-0 space-y-6">
                                    <div className="grid grid-cols-6 gap-2">
                                        {PATTERNS.map(p => (
                                            <button 
                                                key={p.id} onClick={() => setConfig(prev => ({ ...prev, pattern: p.id }))}
                                                className={`aspect-square rounded-xl border-2 flex items-center justify-center transition-all
                                                    ${config.pattern === p.id ? 'border-blue-600 bg-blue-50' : 'border-slate-50'}`}
                                            >
                                                <p.icon className={`w-5 h-5 ${config.pattern === p.id ? 'text-blue-600' : 'text-slate-400'}`} />
                                            </button>
                                        ))}
                                    </div>
                                    <ColorBlock 
                                        label="Màu hoa văn" color={config.fgColor} 
                                        isGradient={config.fgGradientEnabled} gradient={config.fgGradient}
                                        onColorChange={(v: any) => setConfig(prev => ({ ...prev, fgColor: v }))}
                                        onGradientToggle={(e: any) => setConfig(prev => ({ ...prev, fgGradientEnabled: e }))}
                                        onGradientChange={(g: any) => setConfig(prev => ({ ...prev, fgGradient: g }))}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Section: Góc mã QR */}
                        <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                            <div onClick={() => setExpandedSections(prev => prev.includes('eye') ? prev.filter(s => s !== 'eye') : [...prev, 'eye'])} className="p-5 flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center"><Sliders className="w-5 h-5" /></div>
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">2. Góc mã QR (Eyes)</span>
                                </div>
                                {expandedSections.includes('eye') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                            {expandedSections.includes('eye') && (
                                <div className="p-5 pt-0 space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="flex flex-col space-y-4 h-full">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">Khung xung quanh góc</span>
                                            <div className="grid grid-cols-3 gap-2">
                                                {EYE_FRAMES.map(f => (
                                                    <button 
                                                        key={f} onClick={() => setConfig(prev => ({ ...prev, eyeFrame: f as any }))}
                                                        className={`aspect-square rounded-xl border-2 flex items-center justify-center transition-all ${config.eyeFrame === f ? 'border-teal-600 bg-teal-50' : 'border-slate-50 hover:border-slate-200'}`}
                                                    >
                                                        <div className={`w-4 h-4 border-2 border-slate-800 ${f === 'dot' ? 'rounded-full' : f === 'extra-rounded' ? 'rounded-[4px]' : ''}`} />
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex-1" />
                                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">Màu khung góc</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full border border-white shadow-sm overflow-hidden shrink-0 relative flex items-center justify-center">
                                                        <input type="color" value={config.eyeFrameColor} onChange={e => setConfig(prev => ({ ...prev, eyeFrameColor: e.target.value }))} className="absolute w-[200%] h-[200%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer border-0 p-0" />
                                                    </div>
                                                    <input type="text" value={config.eyeFrameColor.toUpperCase()} onChange={e => setConfig(prev => ({ ...prev, eyeFrameColor: e.target.value }))} className="flex-1 h-8 px-3 bg-white border border-slate-200 rounded-xl text-[10px] font-mono font-black text-slate-600 focus:outline-none focus:border-indigo-500" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-col space-y-4 h-full">
                                            <span className="text-[10px] font-black text-slate-400 uppercase">Chấm bên trong góc</span>
                                            <div className="grid grid-cols-3 gap-2">
                                                {EYE_BALLS.map(b => (
                                                    <button 
                                                        key={b} onClick={() => setConfig(prev => ({ ...prev, eyeBall: b }))}
                                                        className={`aspect-square rounded-xl border-2 flex items-center justify-center ${config.eyeBall === b ? 'border-teal-600 bg-teal-50' : 'border-slate-50'}`}
                                                    >
                                                        <div className={`w-2.5 h-2.5 bg-slate-800 ${b === 'dot' ? 'rounded-full' : ''}`} />
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex-1" />
                                            <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-100 flex flex-col gap-3">
                                                <span className="text-[10px] font-black text-slate-800 uppercase tracking-tighter">Màu chấm góc</span>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full border border-white shadow-sm overflow-hidden shrink-0 relative flex items-center justify-center">
                                                        <input type="color" value={config.eyeBallColor} onChange={e => setConfig(prev => ({ ...prev, eyeBallColor: e.target.value }))} className="absolute w-[200%] h-[200%] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-pointer border-0 p-0" />
                                                    </div>
                                                    <input type="text" value={config.eyeBallColor.toUpperCase()} onChange={e => setConfig(prev => ({ ...prev, eyeBallColor: e.target.value }))} className="flex-1 h-8 px-3 bg-white border border-slate-200 rounded-xl text-[10px] font-mono font-black text-slate-600 focus:outline-none focus:border-indigo-500" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Section: Logo & Nền */}
                        <div className="bg-white rounded-[32px] border border-slate-100 overflow-hidden shadow-sm">
                            <div onClick={() => setExpandedSections(prev => prev.includes('logo') ? prev.filter(s => s !== 'logo') : [...prev, 'logo'])} className="p-5 flex items-center justify-between cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center"><ImageIcon className="w-5 h-5" /></div>
                                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">3. Thêm biểu tượng & Nền</span>
                                </div>
                                {expandedSections.includes('logo') ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                            </div>
                            {expandedSections.includes('logo') && (
                                <div className="p-5 pt-0 space-y-6">
                                    {targetUrl && (
                                        <div 
                                            className="flex items-center justify-between p-4 bg-amber-50/50 rounded-2xl border border-amber-100 cursor-pointer" 
                                            onClick={() => setConfig(prev => ({ ...prev, useDirectLink: !prev.useDirectLink }))}
                                        >
                                            <div>
                                                <span className="text-xs font-black text-amber-900 uppercase block">Hướng trực tiếp tới Web gốc</span>
                                                <span className="text-[9px] text-amber-700/80 font-medium block">Hiển thị tên web của bạn khi quét (Không thống kê click)</span>
                                            </div>
                                            <button 
                                                onClick={(e) => { e.preventDefault(); setConfig(prev => ({ ...prev, useDirectLink: !prev.useDirectLink })); }}
                                                className={`w-9 h-5 rounded-full p-0.5 transition-colors ${config.useDirectLink ? 'bg-amber-500' : 'bg-slate-200'}`}
                                            >
                                                <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${config.useDirectLink ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <div className="flex-1"><Input label="URL Logo" value={config.logo || ''} onChange={e => setConfig(prev => ({ ...prev, logo: e.target.value || undefined }))} /></div>
                                        <div className="flex items-end gap-2 pb-1">
                                            <button onClick={() => document.getElementById('logo-up')?.click()} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition-colors"><Upload className="w-4 h-4" /></button>
                                            <button onClick={() => setIsLibraryOpen(true)} className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200 transition-colors"><FolderOpen className="w-4 h-4" /></button>
                                            <input type="file" id="logo-up" hidden accept="image/*" onChange={handleFileUpload} />
                                        </div>
                                    </div>
                                    {config.logo && (
                                        <div className="space-y-4 p-5 bg-slate-50/50 rounded-3xl border border-slate-100">
                                            <span className="text-xs font-black text-slate-800 uppercase tracking-tighter block mb-2">Tùy chỉnh logo</span>
                                            
                                            {/* Slider: Logo Size */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                                                    <span>Kích thước logo</span>
                                                    <span className="font-mono text-slate-600">{(config.logoSize * 100).toFixed(0)}%</span>
                                                </div>
                                                <input 
                                                    type="range" min="10" max="50" value={config.logoSize * 100}
                                                    onChange={e => setConfig(prev => ({ ...prev, logoSize: parseInt(e.target.value) / 100 }))}
                                                    style={{ 
                                                        background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${((config.logoSize * 100 - 10) / 40) * 100}%, #e2e8f0 ${((config.logoSize * 100 - 10) / 40) * 100}%, #e2e8f0 100%)` 
                                                    }}
                                                    className="w-full h-2 rounded-full appearance-none cursor-pointer outline-none touch-none hover:shadow-sm [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                                                />
                                            </div>

                                            {/* Slider: Logo Margin */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                                                    <span>Khoảng lề logo</span>
                                                    <span className="font-mono text-slate-600">{config.logoMargin}px</span>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="20" value={config.logoMargin}
                                                    onChange={e => setConfig(prev => ({ ...prev, logoMargin: parseInt(e.target.value) }))}
                                                    style={{ 
                                                        background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${(config.logoMargin / 20) * 100}%, #e2e8f0 ${(config.logoMargin / 20) * 100}%, #e2e8f0 100%)` 
                                                    }}
                                                    className="w-full h-2 rounded-full appearance-none cursor-pointer outline-none touch-none hover:shadow-sm [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                                                />
                                            </div>

                                            {/* Slider: Logo Border Radius */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase">
                                                    <span>Bo góc logo</span>
                                                    <span className="font-mono text-slate-600">{config.logoRadius || 0}%</span>
                                                </div>
                                                <input 
                                                    type="range" min="0" max="50" value={config.logoRadius || 0}
                                                    onChange={e => setConfig(prev => ({ ...prev, logoRadius: parseInt(e.target.value) }))}
                                                    style={{ 
                                                        background: `linear-gradient(to right, #4f46e5 0%, #4f46e5 ${((config.logoRadius || 0) / 50) * 100}%, #e2e8f0 ${((config.logoRadius || 0) / 50) * 100}%, #e2e8f0 100%)` 
                                                    }}
                                                    className="w-full h-2 rounded-full appearance-none cursor-pointer outline-none touch-none hover:shadow-sm [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 active:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                                                />
                                            </div>
                                        </div>
                                    )}
                                    <ColorBlock 
                                        label="Màu nền mã QR" color={config.bgColor} 
                                        isGradient={config.bgGradientEnabled} gradient={config.bgGradient}
                                        onColorChange={(v: any) => setConfig(prev => ({ ...prev, bgColor: v, isTransparent: false }))}
                                        onGradientToggle={(e: any) => setConfig(prev => ({ ...prev, bgGradientEnabled: e }))}
                                        onGradientChange={(g: any) => setConfig(prev => ({ ...prev, bgGradient: g }))}
                                    />
                                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer" onClick={() => setConfig(prev => ({ ...prev, isTransparent: !prev.isTransparent }))}>
                                        <span className="text-xs font-black text-slate-700 uppercase cursor-pointer">Sử dụng nền trong suốt</span>
                                        <button 
                                            onClick={(e) => { e.preventDefault(); setConfig(prev => ({ ...prev, isTransparent: !prev.isTransparent })); }}
                                            className={`w-9 h-5 rounded-full p-0.5 transition-colors ${config.isTransparent ? 'bg-emerald-500' : 'bg-slate-200'}`}
                                        >
                                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${config.isTransparent ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>

                    <div className="p-8 bg-white border-t border-slate-100 flex gap-4 shrink-0">
                        <Button variant="ghost" className="flex-1 rounded-3xl h-14 text-sm font-black uppercase tracking-tighter" onClick={onClose}>Hủy bỏ</Button>
                        <Button 
                            className="flex-1 rounded-3xl h-14 text-sm font-black text-white uppercase tracking-tighter shadow-xl shadow-orange-100 bg-orange-500 hover:bg-orange-600" 
                            icon={Check} 
                            onClick={async () => {
                                setIsSaving(true);
                                await onSave(JSON.stringify(config));
                                setIsSaving(false);
                            }}
                            isLoading={isSaving}
                        >Lưu thiết kế</Button>
                    </div>
                </div>

                {/* Right Panel: Showcase - Clean Dot Grid Layout */}
                <div className="hidden md:flex flex-1 bg-slate-50 items-center justify-center p-12 relative overflow-hidden">
                    {/* Dot Grid Background */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #000 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                    
                    {/* Accent glowing orbs */}
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500/10 rounded-full blur-[100px] -mr-48 -mt-48 transition-all" />
                    <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-400/10 rounded-full blur-[100px] -ml-40 -mb-40 transition-all" />

                    <div className="relative z-10 w-full max-w-[360px] flex flex-col items-center">
                        <div className="mb-6 flex gap-3">
                            <div className="px-5 py-2 bg-white text-emerald-600 border border-emerald-100 text-[10px] font-black rounded-full uppercase tracking-widest shadow-sm shadow-emerald-100/50 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Preview
                            </div>
                            <button 
                                onClick={handleDownload} 
                                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-[10px] font-black rounded-full uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-slate-200"
                            >
                                <Download className="w-3.5 h-3.5" /> Tải về
                            </button>
                        </div>
                        
                        <div className="mb-8 text-center px-2">
                            <h5 className="font-black text-slate-800 text-2xl tracking-tight leading-loose truncate max-w-[360px]">{linkName}</h5>
                        </div>

                        {/* Clean QR Canvas Frame */}
                        <div 
                            className="bg-white p-4 rounded-[40px] shadow-xl shadow-slate-200/40 border border-slate-100 transition-all duration-700 w-full"
                        >
                            <div 
                                className="relative flex flex-col items-center justify-center transition-all duration-700 overflow-hidden w-full aspect-square max-w-[320px] mx-auto"
                                style={{
                                    border: config.frameId !== 'none' ? `16px solid ${config.frameColor}` : 'none',
                                    borderRadius: '32px',
                                    padding: config.frameId !== 'none' ? '28px 24px 56px' : '0',
                                    background: config.frameId !== 'none' ? config.frameColor : 'transparent',
                                }}
                            >
                                <div className="bg-white p-2 rounded-2xl relative z-10 w-full h-full flex flex-col items-center justify-center shadow-inner">
                                    <div ref={qrRef} className="w-full h-full [&>svg]:w-full [&>svg]:h-full [&>canvas]:w-full [&>canvas]:h-full" />
                                </div>
                                {config.frameId !== 'none' && (
                                    <div className="absolute bottom-5 left-0 right-0 text-center z-10 px-4">
                                        <span className="text-[11px] font-black text-white tracking-[0.4em] uppercase drop-shadow-md truncate block w-full">{config.frameText || 'SCAN ME!'}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-8 text-center px-6">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">{linkUrl}</p>
                        </div>
                    </div>
                </div>

            </div>

            <FileLibraryModal isOpen={isLibraryOpen} onClose={() => setIsLibraryOpen(false)} multi={false} onSelect={(f) => f.length && setConfig(p => ({ ...p, logo: f[0].url }))} zIndex={10000} />
        </div>,
        getMktPortalRoot()
    );
};

export default QRDesignerModal;
