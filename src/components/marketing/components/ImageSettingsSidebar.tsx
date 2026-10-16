import * as React from 'react';
import { useState, useMemo, useCallback } from 'react';
import { X, ImageIcon, Check, MousePointer2, Plus, Layout, Wand2, Settings2, ArrowRight } from 'lucide-react';

interface ImageStyle {
    id: string;
    name: string;
    prompt: string;
    preview?: string;
}

interface ImageSettingsSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    isImageGenMode: boolean;
    setIsImageGenMode: (val: boolean) => void;
    imageProvider: string;
    setImageProvider: (provider: string) => void;
    imageStyle: string;
    setImageStyle: (style: string) => void;
    imageSize: string;
    setImageSize: (size: string) => void;
    setInput: (text: string) => void;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    IMAGE_PROVIDERS: Array<{ id: string; name: string; desc: string; version?: string }>;
    IMAGE_STYLES: ImageStyle[];
    IMAGE_SIZES: Array<{ id: string; name: string; width: number; height: number; ratio?: string }>;
    DIAGRAM_TEMPLATES: Array<{ id: string; name: string; icon: string; prompt: string }>;
    isDarkTheme?: boolean;
}

const StyleItem = React.memo(({ style, isSelected, onSelect, isDarkTheme }: { style: ImageStyle, isSelected: boolean, onSelect: (id: string) => void, isDarkTheme?: boolean }) => (
    <button
        onClick={() => onSelect(style.id)}
        className={`relative group h-32 rounded-2xl overflow-hidden border-2 transition-all ${isSelected
            ? 'border-brand scale-[1.02] shadow-xl shadow-brand'
            : `${isDarkTheme ? 'border-white/5 hover:border-white/20' : 'border-slate-100 hover:border-slate-300'} grayscale-[0.5] hover:grayscale-0`
            }`}
    >
        <img
            src={style.preview || `https://image.pollinations.ai/prompt/${encodeURIComponent(style.prompt)}?width=300&height=300&nologo=true`}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            alt={style.name}
            loading="eager"
        />
        <div className={`absolute inset-0 z-10 bg-gradient-to-t ${isSelected ? 'from-brand/80' : 'from-black/40'} to-transparent transition-colors duration-500`}></div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
            <span className="text-white text-[11px] font-bold uppercase tracking-widest drop-shadow-md">{style.name}</span>
            {isSelected && (
                <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center shadow-lg animate-in zoom-in duration-300">
                    <Check className="w-3 h-3 text-brand" strokeWidth={4} />
                </div>
            )}
        </div>
    </button>
));

const SizeItem = React.memo(({ size, isSelected, onSelect, isDarkTheme }: { size: any, isSelected: boolean, onSelect: (id: string) => void, isDarkTheme?: boolean }) => (
    <button
        onClick={() => onSelect(size.id)}
        className={`px-4 py-3 rounded-2xl text-left transition-all flex items-center justify-between border-2 ${isSelected
            ? 'bg-brand/5 border-brand shadow-md'
            : (isDarkTheme ? 'bg-slate-900 border-white/5 hover:border-white/10' : 'bg-slate-50 border-slate-50 hover:border-slate-200')
            }`}
    >
        <div className="flex flex-col">
            <div className="flex items-center gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-wide ${isSelected ? 'text-brand' : (isDarkTheme ? 'text-slate-300' : 'text-slate-600')}`}>
                    {size.name}
                </span>
                {size.ratio && (
                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] font-bold border uppercase ${isSelected ? 'bg-brand text-white border-brand' : (isDarkTheme ? 'bg-slate-800 text-slate-400 border-white/5' : 'bg-white text-slate-400 border-slate-100')}`}>
                        {size.ratio}
                    </span>
                )}
            </div>
            <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                {size.width === 0 || size.height === 0 ? 'Dynamic Size' : `${size.width} × ${size.height} px`}
            </span>
        </div>
        {isSelected && <Check className="w-4 h-4 text-brand" strokeWidth={3} />}
    </button>
));

const ImageSettingsSidebar: React.FC<ImageSettingsSidebarProps> = ({
    isOpen,
    onClose,
    isImageGenMode,
    setIsImageGenMode,
    imageProvider,
    setImageProvider,
    imageStyle,
    setImageStyle,
    imageSize,
    setImageSize,
    setInput,
    textareaRef,
    IMAGE_PROVIDERS,
    IMAGE_STYLES,
    IMAGE_SIZES,
    DIAGRAM_TEMPLATES,
    isDarkTheme = false
}) => {
    const [customWidth, setCustomWidth] = useState('1024');
    const [customHeight, setCustomHeight] = useState('1024');
    const [isCustomSize, setIsCustomSize] = useState(false);

    // Keep it in DOM always to prevent image reloads, just hide with CSS
    // However, to satisfy the requirement of not reloading on interaction, 
    // we must also ensure props are stable.

    const handleApply = useCallback(() => {
        if (isCustomSize) {
            setImageSize(`${customWidth}x${customHeight}`);
        }
        setIsImageGenMode(true);
        onClose();
    }, [isCustomSize, customWidth, customHeight, setImageSize, setIsImageGenMode, onClose]);

    // Rendered Styles to keep them stable
    const renderedStyles = useMemo(() => (
        IMAGE_STYLES.map(style => (
            <StyleItem
                key={style.id}
                style={style}
                isSelected={imageStyle === style.id}
                onSelect={setImageStyle}
                isDarkTheme={isDarkTheme}
            />
        ))
    ), [IMAGE_STYLES, imageStyle, setImageStyle, isDarkTheme]);

    return (
        <div
            className={`fixed inset-0 z-[9999] transition-all duration-500 ${isOpen ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'}`}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            />

            {/* Sidebar Panel */}
            <div className={`absolute top-0 right-0 h-full w-full md:w-[450px] shadow-[-20px_0_50px_rgba(0,0,0,0.1)] transform transition-transform duration-500 ease-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'} ${isDarkTheme ? 'bg-[#161B24] shadow-black/50' : 'bg-white shadow-slate-200/50'}`}>

                {/* Header */}
                <div className={`h-20 px-8 flex items-center justify-between border-b transition-colors ${isDarkTheme ? 'bg-slate-900/50 border-white/5' : 'bg-gradient-to-r from-white to-brand/5 border-slate-100'}`}>
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-brand flex items-center justify-center shadow-xl shadow-brand/20 rotate-3 group-hover:rotate-0 transition-transform">
                            <Wand2 className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h3 className={`text-lg font-bold uppercase tracking-tight ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>AI Studio</h3>
                            <p className="text-[10px] font-bold text-brand uppercase tracking-widest opacity-80">Image Configuration</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group border ${isDarkTheme ? 'bg-slate-800/50 hover:bg-slate-800 border-white/10' : 'bg-slate-50 hover:bg-slate-100 border-slate-100'}`}
                    >
                        <X className={`w-5 h-5 group-hover:rotate-90 transition-all duration-300 ${isDarkTheme ? 'text-slate-400 group-hover:text-white' : 'text-slate-400 group-hover:text-slate-900'}`} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-6 md:space-y-8 pb-80">

                    {/* Status Toggle - Modern iOS-style Switch */}
                    <div className={`border rounded-[28px] p-6 flex items-center justify-between shadow-sm transition-all ${isDarkTheme ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-gradient-to-br from-emerald-50 to-emerald-100/30 border-emerald-100'}`}>
                        <div className="flex items-center gap-4">
                            <div className={`w-3.5 h-3.5 rounded-full transition-all duration-500 ${isImageGenMode ? 'bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`}></div>
                            <div>
                                <div className={`text-[13px] font-bold uppercase tracking-wide ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>Image Generation Mode</div>
                                <div className="text-[10px] text-emerald-600 font-bold mt-0.5">{isImageGenMode ? 'Active - Images will be generated' : 'Inactive - Preview & Config only'}</div>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsImageGenMode(!isImageGenMode)}
                            className={`relative w-14 h-7 rounded-full transition-all duration-500 shadow-inner group ${isImageGenMode ? 'bg-emerald-500' : (isDarkTheme ? 'bg-slate-800' : 'bg-slate-200')}`}
                        >
                            {/* Inner Glow when ON */}
                            {isImageGenMode && <div className="absolute inset-0 rounded-full bg-white/20 blur-[2px]"></div>}

                            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-all duration-500 ${isImageGenMode ? 'left-8 translate-x-0' : 'left-1'}`}>
                                {isImageGenMode && (
                                    <div className="absolute inset-0 rounded-full bg-emerald-400/40 animate-ping opacity-75"></div>
                                )}
                            </div>
                        </button>
                    </div>

                    {/* Style Selection - VISUAL VERSION */}
                    <section>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 block flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand/60"></div>
                            Visual Style Preset
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {renderedStyles}
                        </div>
                    </section>

                    {/* Size Selection */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-brand/60"></div>
                                Resolution & Aspect
                            </label>
                            <button
                                onClick={() => setIsCustomSize(!isCustomSize)}
                                className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-lg border transition-all ${isCustomSize ? 'bg-brand text-white border-brand' : 'text-slate-400 border-slate-200 hover:border-slate-400'}`}
                            >
                                {isCustomSize ? 'Default Modes' : 'Custom Size'}
                            </button>
                        </div>

                        {isCustomSize ? (
                            <div className={`border rounded-[28px] p-5 space-y-4 ${isDarkTheme ? 'bg-slate-900/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Width (px)</span>
                                        <input
                                            type="number"
                                            value={customWidth}
                                            onChange={(e) => setCustomWidth(e.target.value)}
                                            className={`w-full border rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-colors ${isDarkTheme ? 'bg-slate-800 border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-700'}`}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Height (px)</span>
                                        <input
                                            type="number"
                                            value={customHeight}
                                            onChange={(e) => setCustomHeight(e.target.value)}
                                            className={`w-full border rounded-xl px-4 py-2.5 text-sm font-bold focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none transition-colors ${isDarkTheme ? 'bg-slate-800 border-white/10 text-slate-100' : 'bg-white border-slate-200 text-slate-700'}`}
                                        />
                                    </div>
                                </div>
                                <div className="text-[10px] text-slate-400 italic text-center">Recommended range: 256px to 4096px</div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2">
                                {IMAGE_SIZES.map(size => (
                                    <SizeItem
                                        key={size.id}
                                        size={size}
                                        isSelected={imageSize === size.id}
                                        onSelect={setImageSize}
                                        isDarkTheme={isDarkTheme}
                                    />
                                ))}
                            </div>
                        )}
                    </section>

                    {/* Provider Selection */}
                    <section>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 block flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand/60"></div>
                            AI Engine (Provider)
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                            {IMAGE_PROVIDERS.map(provider => (
                                <button
                                    key={provider.id}
                                    onClick={() => setImageProvider(provider.id)}
                                    className={`relative px-4 py-4 rounded-2xl text-left transition-all border-2 ${imageProvider === provider.id
                                        ? 'bg-brand/5 border-brand shadow-lg shadow-brand/10'
                                        : (isDarkTheme ? 'bg-slate-900/50 text-slate-400 border-white/5 hover:border-white/10' : 'bg-white text-slate-600 border-slate-100 hover:border-slate-200')
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className={`text-[11px] font-bold uppercase tracking-wider ${imageProvider === provider.id ? 'text-brand' : 'text-slate-700'}`}>{provider.name}</div>
                                            <div className={`text-[9px] mt-0.5 font-medium ${imageProvider === provider.id ? 'text-brand/60' : 'text-slate-400'}`}>{provider.version || provider.desc}</div>
                                        </div>
                                        {imageProvider === provider.id && <Check className="w-4 h-4 text-brand" strokeWidth={3} />}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Quick Templates */}
                    <section>
                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 block flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-brand"></div>
                            Logic & Layout Templates
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                            {DIAGRAM_TEMPLATES.map(template => (
                                <button
                                    key={template.id}
                                    onClick={() => {
                                        setInput(template.prompt);
                                        handleApply();
                                        setTimeout(() => textareaRef.current?.focus(), 500);
                                    }}
                                    className={`p-4 rounded-2xl text-center border transition-all group hover:shadow-xl hover:-translate-y-1 ${isDarkTheme ? 'bg-slate-900/50 border-white/5 hover:border-brand hover:bg-slate-800' : 'bg-slate-50 border-slate-100 hover:border-brand hover:bg-white'}`}
                                >
                                    <div className="text-2xl mb-2 group-hover:scale-125 transition-transform">{template.icon}</div>
                                    <div className={`text-[9px] font-black uppercase tracking-widest ${isDarkTheme ? 'text-slate-400' : 'text-slate-500'}`}>{template.name}</div>
                                </button>
                            ))}
                        </div>
                    </section>

                    {/* Extra Spacer to ensure scrolling above fixed footer button */}
                    <div className="h-96 w-full" aria-hidden="true" />
                </div>

                {/* Footer Apply Button */}
                <div className={`h-28 md:h-32 p-4 md:p-8 backdrop-blur-xl border-t absolute bottom-0 left-0 right-0 flex items-center justify-center z-20 ${isDarkTheme ? 'bg-slate-900/90 border-white/5' : 'bg-white/90 border-slate-100'}`}>
                    <button
                        onClick={handleApply}
                        className="w-full h-12 md:h-14 rounded-2xl bg-brand text-white flex items-center justify-center gap-3 font-bold uppercase tracking-[0.2em] text-[10px] md:text-[11px] shadow-xl shadow-brand/20 hover:shadow-brand/40 hover:-translate-y-1 active:translate-y-0 transition-all group border border-white/20"
                    >
                        {isImageGenMode ? 'Update & Save Config' : 'Activate & Start Generating'}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
                    </button>
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: ${isDarkTheme ? '#334155' : '#e2e8f0'}; border-radius: 20px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: ${isDarkTheme ? '#475569' : '#cbd5e1'}; }
            `}</style>
        </div>
    );
};

export default ImageSettingsSidebar;
