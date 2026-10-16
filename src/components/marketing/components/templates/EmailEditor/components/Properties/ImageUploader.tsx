// components/templates/EmailEditor/components/Properties/ImageUploader.tsx
import React, { useState } from 'react';
import { ImageIcon, Upload, Sparkles, X, ShieldCheck } from 'lucide-react';
import ImageLibraryModal from './ImageLibraryModal';

interface ImageUploaderProps {
    label: string;
    value: string;
    onChange: (val: string) => void;
    fallbackValue?: string;
    onFallbackChange?: (val: string) => void;
    compact?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ 
    label, 
    value, 
    onChange, 
    fallbackValue = '', 
    onFallbackChange, 
    compact 
}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalTarget, setModalTarget] = useState<'main' | 'fallback'>('main');
    const isVariable = /(?:{{\s*([^{}%]+?)\s*}}|%7B%7B\s*([^{}%]+?)\s*%7D%7D)/i.test(value || '');

    const handleOpenLibrary = (target: 'main' | 'fallback' = 'main') => {
        setModalTarget(target);
        setIsModalOpen(true);
    };

    return (
        <div className={compact ? "space-y-1" : "space-y-3"}>
            {!compact && (
                <div className="flex justify-between items-center">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</label>
                    <button
                        onClick={() => handleOpenLibrary('main')}
                        className="text-[9px] font-bold text-amber-500 hover:text-amber-600 uppercase flex items-center gap-1 transition-colors"
                    >
                        <ImageIcon className="w-3 h-3" /> Mở thư viện
                    </button>
                </div>
            )}
            <div className="flex gap-2 items-center">
                {value && compact && (
                    <div className="w-8 h-8 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center">
                        {isVariable ? (
                            fallbackValue ? (
                                <img src={fallbackValue} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            ) : (
                                <Sparkles className="w-4 h-4 text-amber-500" />
                            )
                        ) : (
                            <img src={value} alt="Preview" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                        )}
                    </div>
                )}
                <div className="flex-1 flex gap-2">
                    <input
                        type="text"
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        className={`flex-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-[10px] outline-none focus:border-amber-500 transition-all shadow-sm ${compact ? 'h-8' : ''}`}
                        placeholder={compact ? "Dán link ảnh hoặc {{biến_ảnh}}..." : "https://... hoặc {{cert_img}}"}
                    />
                    <button
                        onClick={() => handleOpenLibrary('main')}
                        className={`bg-slate-50 hover:bg-slate-100 rounded-xl text-slate-500 transition-all border border-slate-100 shadow-sm flex items-center justify-center shrink-0 ${compact ? 'w-8 h-8' : 'w-8 h-8 px-0'}`}
                        title="Upload / Chọn ảnh"
                    >
                        <Upload className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
                    </button>
                </div>
            </div>
            
            {value && !compact && (
                isVariable ? (
                    <div className="space-y-2.5">
                        {/* Dynamic Variable Info Card */}
                        <div className="w-full rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50/40 to-amber-50/20 border border-amber-200/80 p-2.5 relative group flex items-center justify-between shadow-xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-200 flex items-center justify-center shrink-0">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[11px] font-bold text-amber-900 truncate flex items-center gap-1.5">
                                        <span>Biến ảnh:</span>
                                        <code className="font-mono text-[10px] bg-amber-100/90 text-amber-800 px-1.5 py-0.5 rounded font-bold border border-amber-200">
                                            {value}
                                        </code>
                                    </div>
                                    <p className="text-[9px] text-amber-700 font-medium">Khi gửi thật sẽ tự điền link ảnh của từng liên hệ</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => onChange('')}
                                className="text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-white/80 transition-colors"
                                title="Xóa biến ảnh"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Fallback Image Input (serves as Preview & Fallback) */}
                        {onFallbackChange && (
                            <div className="p-3 bg-slate-50/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                        Ảnh dự phòng & Xem trước
                                    </label>
                                    <button
                                        onClick={() => handleOpenLibrary('fallback')}
                                        className="text-[9px] font-bold text-emerald-600 hover:text-emerald-700 uppercase flex items-center gap-1"
                                    >
                                        <ImageIcon className="w-3 h-3" /> Chọn ảnh mẫu
                                    </button>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <input
                                        type="text"
                                        value={fallbackValue}
                                        onChange={(e) => onFallbackChange(e.target.value)}
                                        className="flex-1 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-[10px] outline-none focus:border-emerald-500 transition-all shadow-sm"
                                        placeholder="Dán link ảnh mẫu / dự phòng (VD: https://...)"
                                    />
                                    <button
                                        onClick={() => handleOpenLibrary('fallback')}
                                        className="bg-white hover:bg-slate-50 rounded-xl text-slate-500 transition-all border border-slate-200 shadow-sm flex items-center justify-center shrink-0 w-8 h-8"
                                        title="Chọn ảnh mẫu"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Image Preview Area */}
                        {fallbackValue ? (
                            <div className="w-full rounded-2xl bg-slate-100 border border-slate-200 overflow-hidden relative group flex items-center justify-center min-h-[96px]">
                                <img 
                                    src={fallbackValue} 
                                    alt="Fallback Preview" 
                                    className="w-full max-h-48 object-contain" 
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                    }}
                                />
                                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-amber-300 font-mono text-[9px] font-bold border border-amber-500/30 flex items-center gap-1 shadow-sm">
                                    <Sparkles className="w-2.5 h-2.5" />
                                    <span>{value}</span>
                                    <span className="text-white/60 font-sans font-normal">(Xem trước)</span>
                                </div>
                                {onFallbackChange && (
                                    <button 
                                        onClick={() => onFallbackChange('')}
                                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold"
                                    >
                                        Đổi / Xóa ảnh mẫu
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div className="w-full rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                                <ImageIcon className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                                <p className="text-[10px] font-bold text-slate-500">Chưa có ảnh xem trước</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">Điền link ảnh dự phòng ở trên để xem trước giao diện trực tiếp trên mẫu</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-full rounded-xl bg-slate-100 border border-slate-200 overflow-hidden relative group flex items-center justify-center min-h-[96px]">
                        <img 
                            src={value} 
                            alt="Preview" 
                            className="w-full max-h-48 object-contain" 
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                            }}
                        />
                        <button 
                            onClick={() => onChange('')}
                            className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold"
                        >
                            Xóa ảnh
                        </button>
                    </div>
                )
            )}

            <ImageLibraryModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSelect={(url) => {
                    if (modalTarget === 'fallback' && onFallbackChange) {
                        onFallbackChange(url);
                    } else {
                        onChange(url);
                    }
                    setIsModalOpen(false);
                }}
            />
        </div>
    );
};

export default ImageUploader;
