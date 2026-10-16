import React from 'react';
import { X, Sparkles, Clipboard, Check, RefreshCw, AlertTriangle } from 'lucide-react';
import { renderMarkdown } from '../../utils/markdownRenderer';

interface ChatSummaryPanelProps {
    isOpen: boolean;
    onClose: () => void;
    summary: string | null;
    isLoading: boolean;
    onRegenerate: () => void;
    isDarkTheme?: boolean;
}

const ChatSummaryPanel: React.FC<ChatSummaryPanelProps> = ({
    isOpen,
    onClose,
    summary,
    isLoading,
    onRegenerate,
    isDarkTheme
}) => {
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        if (!summary) return;
        navigator.clipboard.writeText(summary);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <>
            {/* Backdrop */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[60] transition-opacity duration-300 lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Panel */}
            <div className={`fixed top-0 right-0 h-screen w-full sm:w-[400px] z-[70] shadow-2xl transition-transform duration-500 ease-in-out transform flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'} ${isDarkTheme ? 'bg-[#0B0F17] border-l border-slate-800' : 'bg-white border-l border-slate-200'}`}>

                {/* Header */}
                <div className={`p-4 border-b flex items-center justify-between shrink-0 ${isDarkTheme ? 'border-slate-800' : 'border-slate-100'}`}>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                            <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className={`text-sm font-black uppercase tracking-wider ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>Tóm tắt nội dung</h3>
                            <p className={`text-[10px] font-bold ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>KEY TAKEAWAYS & ACTIONS</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className={`p-2 rounded-lg transition-colors ${isDarkTheme ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-50 text-slate-500'}`}
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {isLoading ? (
                        <div className="h-full flex flex-col items-center justify-center gap-6 text-center">
                            <div className="relative">
                                <div className="w-20 h-20 border-4 border-brand/10 border-t-brand rounded-full animate-spin" />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Sparkles className="w-8 h-8 text-brand animate-pulse" />
                                </div>
                                <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand rounded-full animate-ping" />
                            </div>
                            <div className="space-y-3">
                                <h4 className={`text-base font-black uppercase tracking-wider ${isDarkTheme ? 'text-slate-100' : 'text-slate-800'}`}>Đang phân tích...</h4>
                                <div className="flex flex-col gap-2 max-w-[240px] opacity-60">
                                    <div className="h-2 bg-brand/20 rounded-full animate-[shimmer_2s_infinite] overflow-hidden relative">
                                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-brand/30 to-transparent animate-[shimmer_2s_infinite]" />
                                    </div>
                                    <div className="h-2 bg-brand/20 rounded-full w-[80%] mx-auto overflow-hidden relative">
                                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-brand/30 to-transparent animate-[shimmer_2.5s_infinite]" />
                                    </div>
                                    <div className="h-2 bg-brand/20 rounded-full w-[60%] mx-auto overflow-hidden relative">
                                        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-brand/30 to-transparent animate-[shimmer_3s_infinite]" />
                                    </div>
                                </div>
                                <p className={`text-xs font-medium animate-pulse ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>AI đang trích xuất các ý chính quan trọng</p>
                            </div>
                        </div>
                    ) : summary ? (
                        <div className={`prose prose-sm max-w-none anim-fade-in ${isDarkTheme ? 'prose-invert' : ''}`}>
                            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(summary) }} />
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center gap-4 text-center">
                            <div className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-2 ${isDarkTheme ? 'bg-slate-800/50' : 'bg-slate-50'}`}>
                                <AlertTriangle className="w-8 h-8 text-slate-400" />
                            </div>
                            <div className="max-w-[200px]">
                                <h4 className={`text-sm font-bold mb-1 ${isDarkTheme ? 'text-slate-200' : 'text-slate-700'}`}>Chưa có tóm tắt</h4>
                                <p className={`text-xs ${isDarkTheme ? 'text-slate-500' : 'text-slate-400'}`}>Hãy nhấn nút tóm tắt để AI tổng hợp nội dung cho bạn.</p>
                            </div>
                            <button
                                onClick={onRegenerate}
                                className="mt-4 px-6 py-2.5 bg-brand text-white rounded-xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-brand/20 hover:scale-105 active:scale-95 transition-all"
                            >
                                Tạo tóm tắt ngay
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {summary && !isLoading && (
                    <div className={`p-4 border-t flex items-center gap-2 shrink-0 ${isDarkTheme ? 'border-slate-800 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
                        <button
                            onClick={handleCopy}
                            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isDarkTheme ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-sm'}`}
                        >
                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Clipboard className="w-3.5 h-3.5" />}
                            {copied ? 'Đã sao chép' : 'Sao chép văn bản'}
                        </button>
                        <button
                            onClick={onRegenerate}
                            className={`p-2.5 rounded-xl transition-all ${isDarkTheme ? 'bg-slate-800 hover:bg-slate-700 text-slate-400' : 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-500 shadow-sm'}`}
                            title="Tóm tắt"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default ChatSummaryPanel;
