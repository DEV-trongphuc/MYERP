import * as React from 'react';
import { Bot, RefreshCcw } from 'lucide-react';

interface PremiumLoaderProps {
    title?: string;
    subtitle?: string;
    isOffline?: boolean;
    onRetry?: () => void;
}

const PremiumLoader: React.FC<PremiumLoaderProps> = ({
    title = "AI-SPACE",
    subtitle = "Đang tải ứng dụng...",
    isOffline = false,
    onRetry
}) => {
    return (
        <div className="fixed inset-0 z-[1000] bg-white flex flex-col items-center justify-center select-none font-sans overflow-hidden">
            <div className="relative flex flex-col items-center max-w-sm px-8">
                {/* Simplified Icon Section */}
                <div className="mb-8 flex flex-col items-center gap-4">
                    <div className={`w-20 h-20 rounded-3xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-200 transition-all duration-700 ${isOffline ? 'grayscale scale-90' : 'animate-pulse'}`}>
                        <Bot className="w-10 h-10 text-white" />
                    </div>
                    {!isOffline && (
                        <div className="w-5 h-5 border-2 border-slate-100 border-t-slate-900 rounded-full animate-spin" />
                    )}
                </div>

                {/* Simplified Text Section */}
                <div className="flex flex-col items-center gap-2 text-center">
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                        {title}
                    </h2>

                    <p className="text-slate-400 text-sm font-medium">
                        {subtitle}
                    </p>

                    {/* Simple Action Section */}
                    {isOffline && onRetry && (
                        <button
                            onClick={onRetry}
                            className="mt-6 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all hover:bg-slate-800 active:scale-95"
                        >
                            <RefreshCcw className="w-4 h-4" />
                            <span>Thử lại</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PremiumLoader;
