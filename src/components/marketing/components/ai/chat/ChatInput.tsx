import * as React from 'react';
import { useRef, useState } from 'react';
import {
    Mic, Paperclip, Upload, ArrowRight, BookOpen, Sparkles, Loader2,
    Brain, ChevronDown, FileCode, ImageIcon, FileText,
    Database, Globe, Volume2, VolumeX, Minimize2, Maximize2, Download, Share2, Trash2, MoreHorizontal, Wand2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { api } from '../../../services/storageAdapter';
import { FileAttachment, ChatbotInfo } from '../../../types';
import { AI_MODELS, getModelDisplayName } from '../../../utils/ai-constants';
import { useChatPage } from '../../../contexts/ChatPageContext';

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    handleSend: () => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    loadingChat: boolean;
    activeBot: ChatbotInfo | null;
    isEnhancing: boolean;
    setIsEnhancing: (val: boolean) => void;
    isImageGenMode: boolean;
    isListening: boolean;
    toggleListening: () => void;
    isAttachDropdownOpen: boolean;
    setIsAttachDropdownOpen: (val: boolean) => void;
    fileInputRef: React.RefObject<HTMLInputElement>;
    setIsDocWorkspaceOpen: (val: boolean) => void;
    setActiveDoc: (doc: FileAttachment | null) => void;
    setExplorerSearchTerm: (term: string) => void;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    attachments: FileAttachment[];
    selectedContextDocs: FileAttachment[];
    setSelectedContextDocs: React.Dispatch<React.SetStateAction<FileAttachment[]>>;
    selectedModel: string;
    setSelectedModel: (modelId: string) => void;
    categoryName: string;
    isKbOnlyMode: boolean;
    setIsKbOnlyMode: (val: boolean) => void;
    isResearchMode: boolean;
    setIsResearchMode: (val: boolean) => void;
    isCodeMode: boolean;
    setIsCodeMode: (val: boolean) => void;
    setIsImageGenMode: (val: boolean) => void;
    setIsImageSettingsOpen: (val: boolean) => void;
    setSuggestedQuestions: (val: any[]) => void;
    autoTTS: boolean;
    setAutoTTS: (val: boolean) => void;
    isZenMode: boolean;
    setIsZenMode: (val: boolean) => void;
    handleExportChat: () => void;
    setIsShareModalOpen: (val: boolean) => void;
    setIsClearConfirmOpen: (val: boolean) => void;
    onShareConversation: () => void;
    isConvPublic?: boolean;
    isDarkTheme?: boolean;
    isMobile?: boolean;
    orgUser?: any;
}

const ToggleSwitch = ({ active, onClick, isDarkTheme }: { active: boolean, onClick: () => void, isDarkTheme?: boolean }) => (
    <div
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        className={`relative w-9 h-5 rounded-full transition-all duration-300 cursor-pointer shrink-0 ml-auto ${active ? 'bg-emerald-500' : (isDarkTheme ? 'bg-slate-700' : 'bg-slate-200')}`}
    >
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-300 transform ${active ? 'translate-x-4' : 'translate-x-0'}`} />
    </div>
);

const ChatInput: React.FC<ChatInputProps> = React.memo(({
    input, setInput, handleSend, handleKeyDown, loadingChat, activeBot,
    isEnhancing, setIsEnhancing, isImageGenMode, isListening, toggleListening,
    isAttachDropdownOpen, setIsAttachDropdownOpen, fileInputRef, setIsDocWorkspaceOpen,
    setActiveDoc, setExplorerSearchTerm, textareaRef, attachments,
    selectedModel, setSelectedModel, categoryName, isKbOnlyMode, setIsKbOnlyMode,
    isResearchMode, setIsResearchMode, isCodeMode, setIsCodeMode, setIsImageGenMode,
    setIsImageSettingsOpen, setSuggestedQuestions, autoTTS, setAutoTTS,
    isZenMode, setIsZenMode, handleExportChat, setIsShareModalOpen, setIsClearConfirmOpen,
    onShareConversation, isConvPublic,
    isDarkTheme,
    isMobile,
    orgUser
}) => {
    const [isModelModalOpen, setIsModelModalOpen] = useState(false);
    const [isAiModeModalOpen, setIsAiModeModalOpen] = useState(false);
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
    const {
        selectedPersona,
        setIsPersonaPickerOpen,
        isCiteMode,
        setIsCiteMode,
        hasPdfs
    } = useChatPage();
    const isNonDefaultPersona = selectedPersona?.id !== 'default';

    return (
        <div className="flex flex-col w-full">
            {/* Main Input Row */}
            <div className="flex items-center gap-2 px-1">
                <button
                    onClick={toggleListening}
                    className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : (isDarkTheme ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-[var(--color-primary)] hover:bg-slate-100')}`}
                    title="Voice Input"
                >
                    <Mic className="w-5 h-5" />
                </button>

                <div className="relative">
                    <button
                        onClick={() => setIsAttachDropdownOpen(!isAttachDropdownOpen)}
                        className={`p-2 rounded-xl transition-all ${isAttachDropdownOpen ? (isDarkTheme ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]' : 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]') : (isDarkTheme ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-600 hover:text-[var(--color-primary)] hover:bg-slate-100')}`}
                    >
                        <Paperclip className="w-5 h-5" />
                    </button>

                    {isAttachDropdownOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsAttachDropdownOpen(false)} />
                            <div className={`absolute bottom-full left-0 mb-3 w-72 backdrop-blur-xl border rounded-[18px] shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-bottom-2 duration-300 ${isDarkTheme ? 'bg-[#0D1117] border-slate-700' : 'bg-white border-slate-200'}`}>
                                <div className={`px-4 py-2 border-b mb-2 flex items-center justify-between ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Attachments</span>
                                </div>
                                <div className="space-y-1">
                                    <button
                                        onClick={() => { fileInputRef.current?.click(); setIsAttachDropdownOpen(false); }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isDarkTheme ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-[var(--color-primary)]'}`}
                                    >
                                        <Upload className="w-4 h-4" />
                                        <div className="text-left"><div className="text-xs font-bold">Computer</div></div>
                                    </button>
                                    <button
                                        onClick={() => { setIsDocWorkspaceOpen(true); setActiveDoc(null); setExplorerSearchTerm(""); setIsAttachDropdownOpen(false); }}
                                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isDarkTheme ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-[var(--color-primary)]'}`}
                                    >
                                        <BookOpen className="w-4 h-4" />
                                        <div className="text-left"><div className="text-xs font-bold">Workspace</div></div>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="flex-1 relative">
                    <textarea
                        ref={textareaRef}
                        rows={1}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            isImageGenMode
                                ? "Mô tả hình ảnh bạn muốn tạo..."
                                : isResearchMode
                                    ? "Nghiên cứu kiến thức bên ngoài (Research Mode)..."
                                    : isKbOnlyMode
                                        ? `Message ${activeBot?.name}...`
                                        : `Message ${activeBot?.name || 'AI Assistant'}...`
                        }
                        className={`w-full bg-transparent border-0 focus:ring-0 outline-none focus:outline-none py-2 px-2 text-[15px] leading-relaxed resize-none transition-all font-medium selection:bg-[var(--color-primary)] selection:text-white ${isDarkTheme ? 'text-white placeholder:text-slate-500/50' : 'text-slate-700 placeholder:text-slate-300'}`}
                        style={{ minHeight: '40px', maxHeight: '200px' }}
                    />
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={async () => {
                            if (!input.trim() || isEnhancing || !activeBot) return;
                            setIsEnhancing(true);
                            try {
                                const res = await api.post<any>('ai_org_chatbot', {
                                    action: 'chat',
                                    property_id: activeBot?.id,
                                    message: `Rewrite and enhance this prompt: "${input}"`,
                                    model_config: { model: 'gemini-3.5-flash-lite' }
                                });
                                if (res.success && res.data?.message) { setInput(res.data.message); toast.success('Enhanced!'); }
                            } catch (e) { toast.error('AI Error'); } finally { setIsEnhancing(false); }
                        }}
                        disabled={!input.trim() || isEnhancing || !activeBot}
                        className={`p-2 rounded-xl transition-all ${!input.trim() ? 'opacity-30' : ''} ${isDarkTheme ? 'text-slate-400 hover:text-[var(--color-primary)] hover:bg-slate-800' : 'text-slate-600 hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/5'}`}
                    >
                        <Wand2 className={`w-5 h-5 ${isEnhancing ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                        onClick={handleSend}
                        disabled={loadingChat || (!input.trim() && attachments.length === 0) || !activeBot}
                        className={`p-2 rounded-xl transition-all shadow-lg ${loadingChat || (!input.trim() && attachments.length === 0) || !activeBot
                            ? 'opacity-40 cursor-not-allowed bg-slate-200 text-slate-400'
                            : 'bg-[var(--color-primary)] text-white shadow-[var(--color-primary)]/20'}`}
                    >
                        {loadingChat ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRight className="w-5 h-5" strokeWidth={3} />}
                    </button>
                </div>
            </div>

            {/* AI Settings Toolbar */}
            <div className={`mt-2 p-1.5 rounded-[14px] border flex flex-wrap items-center justify-between gap-2 shadow-sm ${isDarkTheme ? 'bg-[#0D1117] border-slate-700/50' : 'bg-slate-50/80 border-slate-100'}`}>
                <div className="flex items-center gap-1">
                    {/* Model Selector */}
                    {!isImageGenMode && (
                        <>
                            <div className="relative">
                                <button
                                    onClick={() => setIsModelModalOpen(!isModelModalOpen)}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${isDarkTheme ? 'bg-[#0D1117] border border-slate-700 text-white hover:border-[var(--color-primary)] shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:border-[var(--color-primary)] shadow-sm'}`}
                                >
                                    <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)] flex items-center justify-center shrink-0"><Brain className="w-3.5 h-3.5 text-white" /></div>
                                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">
                                        {getModelDisplayName(AI_MODELS.find(m => m.id === selectedModel)?.name || '', categoryName).split(' ')[0]}
                                    </span>
                                    <ChevronDown className="w-3 h-3 opacity-50" />
                                </button>
                                {isModelModalOpen && (
                                    <>
                                        {/* [P18-C3] Click-outside dismiss */}
                                        <div className="fixed inset-0 z-40" onClick={() => setIsModelModalOpen(false)} />
                                        <div className={`absolute bottom-full left-0 mb-3 w-64 border rounded-[14px] shadow-2xl overflow-hidden z-50 ${isDarkTheme ? 'bg-[#0D1117] border-slate-700' : 'bg-white border-slate-200'}`}>
                                            {AI_MODELS.map(m => (
                                                <button key={m.id} onClick={() => {
                                                    setSelectedModel(m.id);
                                                    setIsModelModalOpen(false);
                                                    // Auto-reset to Expert Mode when model changes
                                                    setIsCodeMode(false);
                                                    setIsImageGenMode(false);
                                                    setIsKbOnlyMode(true);
                                                }} className={`w-full px-4 py-3 flex items-center gap-3 transition-colors ${selectedModel === m.id ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-l-2 border-[var(--color-primary)]' : (isDarkTheme ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50')}`}>
                                                    <m.icon className="w-4 h-4" />
                                                    <div className="text-left text-xs font-bold">{getModelDisplayName(m.name, categoryName)}</div>
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className={`w-px h-4 mx-1 ${isDarkTheme ? 'bg-slate-700' : 'bg-slate-200'}`} />
                        </>
                    )}

                    {/* Mode Selector */}
                    <div className="relative">
                        <button
                            onClick={() => setIsAiModeModalOpen(!isAiModeModalOpen)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${isDarkTheme ? 'bg-[#0D1117] border border-slate-700 text-white hover:border-[var(--color-primary)] shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:border-[var(--color-primary)] shadow-sm'}`}
                        >
                            <div className="w-6 h-6 rounded-lg bg-[var(--color-primary)] flex items-center justify-center shrink-0">{isCodeMode ? <FileCode className="w-3.5 h-3.5 text-white" /> : isImageGenMode ? <ImageIcon className="w-3.5 h-3.5 text-white" /> : <Sparkles className="w-3.5 h-3.5 text-white" />}</div>
                            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">
                                {isCodeMode ? 'Code' : isImageGenMode ? 'Image' : 'Expert'}
                            </span>
                            <ChevronDown className="w-3 h-3 opacity-50" />
                        </button>
                        {isAiModeModalOpen && (
                            <>
                                {/* [P18-C3] Click-outside dismiss for mode dropdown */}
                                <div className="fixed inset-0 z-40" onClick={() => setIsAiModeModalOpen(false)} />
                                <div className={`absolute bottom-full left-0 mb-3 w-56 border rounded-[14px] shadow-2xl overflow-hidden z-50 ${isDarkTheme ? 'bg-[#0D1117] border-slate-700' : 'bg-white border-slate-200'}`}>
                                    <div className="p-1.5 space-y-1">
                                        {[
                                            { id: 'expert', label: 'Expert Mode', icon: Sparkles, active: !isCodeMode && !isImageGenMode, onClick: () => { setIsCodeMode(false); setIsImageGenMode(false); setIsKbOnlyMode(true); } },
                                            { id: 'code', label: 'Code Mode', icon: FileCode, active: isCodeMode, onClick: () => { setIsCodeMode(true); setIsImageGenMode(false); setIsKbOnlyMode(false); } },
                                            { id: 'image', label: 'Image Mode', icon: ImageIcon, active: isImageGenMode, onClick: () => { setIsImageGenMode(true); setIsCodeMode(false); setIsKbOnlyMode(false); setIsImageSettingsOpen(true); } }
                                        ].filter(mode => {
                                            if (mode.id === 'expert') return true; // Expert mode always available
                                            if (!orgUser || orgUser.role === 'admin') return true;
                                            if (!orgUser.permissions?.modes) return true; // Default to allow if no specific rules
                                            return orgUser.permissions.modes.includes(mode.id);
                                        }).map(mode => (
                                            <button key={mode.id} onClick={() => { mode.onClick(); setIsAiModeModalOpen(false); setSuggestedQuestions([]); }} className={`w-full p-2.5 rounded-xl flex items-center gap-3 transition-all ${mode.active ? 'bg-[var(--color-primary)] text-white' : (isDarkTheme ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-[var(--color-primary)]')}`}>
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${mode.active ? 'bg-white/20' : 'bg-[var(--color-primary)] text-white'}`}>
                                                    <mode.icon className="w-4 h-4" />
                                                </div>
                                                <span className="text-xs font-bold">{mode.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {!isMobile && (
                        <>
                            <div className={`w-px h-4 mx-1 ${isDarkTheme ? 'bg-slate-700' : 'bg-slate-200'}`} />
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => { const newVal = !isKbOnlyMode; setIsKbOnlyMode(newVal); if (newVal) setIsResearchMode(false); }}
                                    className={`p-1.5 rounded-lg transition-all ${isKbOnlyMode ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : (isDarkTheme ? 'text-slate-400 hover:bg-slate-900 hover:text-white' : 'text-slate-400 hover:bg-slate-100')}`}
                                    title="Chế độ Kiến thức (Knowledge Only)"
                                >
                                    <Database className="w-3.5 h-3.5" />
                                </button>

                                {hasPdfs && (
                                    <button
                                        onClick={() => setIsCiteMode(!isCiteMode)}
                                        className={`p-1.5 rounded-lg transition-all ${isCiteMode ? 'bg-[var(--color-primary)] text-white shadow-lg shadow-[var(--color-primary)]/20' : (isDarkTheme ? 'text-slate-400 hover:bg-slate-900 hover:text-white' : 'text-slate-400 hover:bg-slate-100')}`}
                                        title="Trích dẫn tài liệu (Citation Mode)"
                                    >
                                        <FileText className="w-3.5 h-3.5" />
                                    </button>
                                )}

                                <button
                                    onClick={() => { const newVal = !isResearchMode; setIsResearchMode(newVal); if (newVal) setIsKbOnlyMode(false); }}
                                    className={`p-1.5 rounded-lg transition-all ${isResearchMode ? 'bg-sky-500 text-white shadow-lg shadow-sky-500/20' : (isDarkTheme ? 'text-slate-400 hover:bg-slate-900 hover:text-white' : 'text-slate-400 hover:bg-slate-100')}`}
                                    title="Chế độ Nghiên cứu (Research Mode)"
                                >
                                    <Globe className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </>
                    )}

                    {/* ── Persona Button ── */}
                    <div className={`w-px h-4 mx-1 ${isDarkTheme ? 'bg-slate-700' : 'bg-slate-200'}`} />
                    <button
                        onClick={() => setIsPersonaPickerOpen(true)}
                        title="AI Persona"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '4px 10px',
                            borderRadius: '10px',
                            border: isNonDefaultPersona
                                ? `1px solid ${selectedPersona.accentColor}50`
                                : `1px solid ${isDarkTheme ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                            background: isNonDefaultPersona
                                ? selectedPersona.accentColor + '14'
                                : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: isNonDefaultPersona
                                ? selectedPersona.accentColor
                                : (isDarkTheme ? '#94a3b8' : '#64748b'),
                        }}
                    >
                        <span style={{ fontSize: '14px', lineHeight: 1 }}>
                            {selectedPersona?.emoji || '🤖'}
                        </span>
                        {!isMobile && (
                            <span style={{ fontSize: '10px', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                                {isNonDefaultPersona ? selectedPersona.name : 'Persona'}
                            </span>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {/* Shift + Enter Hint */}
                    <span className={`text-[9px] font-black uppercase tracking-tighter opacity-70 hidden lg:block ${isDarkTheme ? 'text-white' : 'text-slate-900'}`}>Shift + Enter ⏎</span>

                    {!isMobile ? (
                        <div className={`flex items-center gap-0.5 p-0.5 rounded-xl ${isDarkTheme ? 'bg-slate-900/50' : 'bg-slate-100/50'}`}>
                            <button onClick={() => setAutoTTS(!autoTTS)} className={`p-1.5 rounded-lg transition-all ${autoTTS ? 'text-green-500' : (isDarkTheme ? 'text-slate-200 hover:text-white' : 'text-slate-600 hover:text-slate-900')}`} title="Auto TTS">{autoTTS ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}</button>
                            <button onClick={() => setIsZenMode(!isZenMode)} className={`p-1.5 rounded-lg transition-all ${isZenMode ? 'text-blue-500' : (isDarkTheme ? 'text-slate-200 hover:text-white' : 'text-slate-600 hover:text-slate-900')}`} title="Zen Mode"><Maximize2 className="w-3.5 h-3.5" /></button>
                            <button onClick={handleExportChat} className={`p-1.5 rounded-lg transition-all ${isDarkTheme ? 'text-slate-200 hover:text-emerald-400' : 'text-slate-600 hover:text-emerald-600'}`} title="Export"><Download className="w-3.5 h-3.5" /></button>
                            {/* Share button */}
                            <button
                                onClick={onShareConversation}
                                className={`p-1.5 rounded-lg transition-all relative group/share ${isConvPublic
                                    ? 'text-blue-500 bg-blue-500/10'
                                    : (isDarkTheme ? 'text-slate-200 hover:text-blue-400' : 'text-slate-600 hover:text-blue-600')
                                    }`}
                                title={isConvPublic ? 'Conversation is public — click to manage' : 'Share conversation'}
                            >
                                <Share2 className="w-3.5 h-3.5" />
                                {isConvPublic && (
                                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                                )}
                            </button>
                            <button onClick={() => setIsClearConfirmOpen(true)} className={`p-1.5 rounded-lg transition-all ${isDarkTheme ? 'text-slate-200 hover:text-rose-400' : 'text-slate-600 hover:text-rose-600'}`} title="Clear"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                    ) : (
                        <div className="relative">
                            <button
                                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                                className={`p-2 rounded-xl transition-all ${isMoreMenuOpen ? (isDarkTheme ? 'bg-slate-800 text-[var(--color-primary)]' : 'bg-slate-100 text-[var(--color-primary)]') : (isDarkTheme ? 'text-slate-400' : 'text-slate-600')}`}
                            >
                                <MoreHorizontal className="w-5 h-5" />
                            </button>
                            {isMoreMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsMoreMenuOpen(false)} />
                                    <div className={`absolute bottom-full right-0 mb-3 w-64 border rounded-[14px] shadow-2xl overflow-hidden z-50 p-1.5 space-y-1 animate-in fade-in slide-in-from-bottom-2 duration-300 ${isDarkTheme ? 'bg-[#0D1117] border-slate-700' : 'bg-white border-slate-200'}`}>
                                        <button onClick={() => { setIsKbOnlyMode(!isKbOnlyMode); if (!isKbOnlyMode) setIsResearchMode(false); }} className={`w-full px-4 py-3 rounded-xl flex items-center justify-between transition-colors ${isKbOnlyMode ? 'bg-[var(--color-primary)]/5' : (isDarkTheme ? 'hover:bg-slate-800' : 'hover:bg-slate-50')}`}>
                                            <div className="flex items-center gap-3">
                                                <Database className={`w-4 h-4 ${isKbOnlyMode ? 'text-emerald-500' : 'text-slate-400'}`} />
                                                <span className={`text-[13px] font-bold ${isKbOnlyMode ? (isDarkTheme ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`}>Chế độ Kiến thức (Knowledge Mode)</span>
                                            </div>
                                            <ToggleSwitch active={isKbOnlyMode} onClick={() => { setIsKbOnlyMode(!isKbOnlyMode); if (!isKbOnlyMode) setIsResearchMode(false); }} isDarkTheme={isDarkTheme} />
                                        </button>
                                        <button onClick={() => { setIsResearchMode(!isResearchMode); if (!isResearchMode) setIsKbOnlyMode(false); }} className={`w-full px-4 py-3 rounded-xl flex items-center justify-between transition-colors ${isResearchMode ? 'bg-[var(--color-primary)]/5' : (isDarkTheme ? 'hover:bg-slate-800' : 'hover:bg-slate-50')}`}>
                                            <div className="flex items-center gap-3">
                                                <Globe className={`w-4 h-4 ${isResearchMode ? 'text-sky-500' : 'text-slate-400'}`} />
                                                <span className={`text-[13px] font-bold ${isResearchMode ? (isDarkTheme ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`}>Chế độ Nghiên cứu (Research Mode)</span>
                                            </div>
                                            <ToggleSwitch active={isResearchMode} onClick={() => { setIsResearchMode(!isResearchMode); if (!isResearchMode) setIsKbOnlyMode(false); }} isDarkTheme={isDarkTheme} />
                                        </button>
                                        <button onClick={() => setAutoTTS(!autoTTS)} className={`w-full px-4 py-3 rounded-xl flex items-center justify-between transition-colors ${autoTTS ? 'bg-[var(--color-primary)]/5' : (isDarkTheme ? 'hover:bg-slate-800' : 'hover:bg-slate-50')}`}>
                                            <div className="flex items-center gap-3">
                                                {autoTTS ? <Volume2 className="w-4 h-4 text-[var(--color-primary)]" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                                                <span className={`text-[13px] font-bold ${autoTTS ? (isDarkTheme ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`}>Auto TTS</span>
                                            </div>
                                            <ToggleSwitch active={autoTTS} onClick={() => setAutoTTS(!autoTTS)} isDarkTheme={isDarkTheme} />
                                        </button>
                                        <div className={`h-px mx-2 ${isDarkTheme ? 'bg-slate-800' : 'bg-slate-100'}`} />
                                        <button onClick={() => { handleExportChat(); setIsMoreMenuOpen(false); }} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${isDarkTheme ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            <Download className="w-4 h-4 text-slate-400" />
                                            <span className="text-[13px] font-bold">Export Chat</span>
                                        </button>
                                        <button onClick={() => { onShareConversation(); setIsMoreMenuOpen(false); }} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors ${isConvPublic ? 'text-blue-500' : (isDarkTheme ? 'text-slate-300 hover:bg-slate-800' : 'text-slate-600 hover:bg-slate-50')}`}>
                                            <Share2 className="w-4 h-4 text-slate-400" />
                                            <span className="text-[13px] font-bold">{isConvPublic ? 'Share Settings' : 'Share Chat'}</span>
                                        </button>
                                        <button onClick={() => { setIsClearConfirmOpen(true); setIsMoreMenuOpen(false); }} className={`w-full px-4 py-3 rounded-xl flex items-center gap-3 transition-colors text-rose-500 ${isDarkTheme ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50'}`}>
                                            <Trash2 className="w-4 h-4 text-rose-400" />
                                            <span className="text-[13px] font-bold">Clear Chat</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

export default ChatInput;
