import * as React from 'react';
import { RefreshCcw } from 'lucide-react';

interface PremiumLoaderProps {
    title?: string;
    subtitle?: string;
    isOffline?: boolean;
    onRetry?: () => void;
}

const PremiumLoader: React.FC<PremiumLoaderProps> = ({
    isOffline = false,
    onRetry
}) => {
    return (
        <div className="w-full py-6 px-6 flex flex-col items-center justify-center select-none font-sans">
            <div className="w-full space-y-5">
                <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[20px] p-6 shadow-sm space-y-5">
                    <div className="flex items-center justify-between">
                        <div className="space-y-2.5">
                            <div className="h-5 w-48 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                            <div className="h-3.5 w-64 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[10px]" />
                        </div>
                        <div className="h-9 w-28 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[12px]" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                        <div className="h-24 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                        <div className="h-24 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                        <div className="h-24 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                    </div>
                    <div className="space-y-3 pt-2">
                        <div className="h-12 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                        <div className="h-12 w-full animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                        <div className="h-12 w-3/4 animate-pulse bg-slate-200/70 dark:bg-white/[0.06] rounded-[16px]" />
                    </div>
                    {isOffline && onRetry && (
                        <div className="pt-2 flex justify-center">
                            <button
                                onClick={onRetry}
                                className="h-9 px-4 bg-[var(--color-primary)] text-white rounded-[12px] font-semibold text-xs flex items-center justify-center gap-2 transition-all hover:opacity-95 active:scale-95"
                            >
                                <RefreshCcw className="w-3.5 h-3.5" />
                                <span>Thử lại</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PremiumLoader;

