
import React from 'react';
import {
    X, Lightbulb, ArrowRight, Send
} from 'lucide-react';
import Modal from './Modal';
import Button from './Button';

interface Tip {
    icon: React.ElementType;
    title: string;
    description: string;
    colorClass: string;
    highlight?: string;
}

interface TipsModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle: string;
    tips: Tip[];
    accentColor?: string; // e.g., 'amber', 'blue', 'indigo'
}

const TipCard = ({ icon: Icon, title, description, colorClass, highlight }: Tip) => (
    <div className="group bg-white hover:bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80 hover:border-slate-300 transition-colors duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] relative overflow-hidden">
        <div className="flex gap-4 relative z-10 items-start">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border border-black/5 ${colorClass} text-white`}>
                <Icon className="w-5 h-5" strokeWidth={2.25} />
            </div>
            <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[15px] font-bold text-slate-900">
                        {title}
                    </h4>
                    {highlight && (
                        <span className="shrink-0 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase rounded-md tracking-wider border border-slate-200 transition-colors duration-150 group-hover:bg-slate-800 group-hover:text-white group-hover:border-slate-800">
                            {highlight}
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    {description}
                </p>
            </div>
        </div>
    </div>
);

const TipsModal: React.FC<TipsModalProps> = ({
    isOpen,
    onClose,
    title,
    subtitle,
    tips,
    accentColor = 'amber'
}) => {
    const accentVariants: Record<string, string> = {
        amber: 'bg-amber-500',
        blue: 'bg-slate-800',
        emerald: 'bg-emerald-600',
        indigo: 'bg-[#BD1D2D]',
        crimson: 'bg-[#BD1D2D]',
    };

    const iconBgVariants: Record<string, string> = {
        amber: 'bg-amber-500 border-amber-400/30',
        blue: 'bg-slate-900 border-slate-700/40',
        emerald: 'bg-emerald-600 border-emerald-500/30',
        indigo: 'bg-[#BD1D2D] border-rose-500/30',
        crimson: 'bg-[#BD1D2D] border-rose-500/30',
    };

    const accentTextVariants: Record<string, string> = {
        amber: 'bg-amber-500',
        blue: 'bg-slate-700',
        emerald: 'bg-emerald-600',
        indigo: 'bg-[#BD1D2D]',
        crimson: 'bg-[#BD1D2D]',
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="lg"
            noHeader
            noPadding
        >
            <div className="relative bg-white">
                <div className={`sticky top-0 left-0 w-full h-1 ${accentVariants[accentColor] || accentVariants.amber} z-10`} />

                <div className="p-6 lg:p-8">
                    <div className="flex items-center justify-between mb-6 lg:mb-8">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl ${iconBgVariants[accentColor] || iconBgVariants.amber} text-white flex items-center justify-center border shrink-0`}>
                                <Lightbulb className="w-7 h-7" strokeWidth={2.25} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight uppercase">{title}</h1>
                                <div className="flex items-center gap-2 mt-1.5">
                                    <span className={`h-3 w-0.5 ${accentTextVariants[accentColor] || accentTextVariants.amber}`} />
                                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                        {subtitle}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors duration-150"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-3">
                        {(tips || []).map((tip, idx) => (
                            <TipCard key={idx} {...tip} />
                        ))}
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-200 flex items-center gap-3 text-xs font-medium text-slate-500">
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200 text-slate-500 shrink-0">
                            <Send className="w-4 h-4" />
                        </div>
                        <span>Sử dụng các mẹo này để tối ưu hóa hiệu quả làm việc của bạn</span>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default TipsModal;
