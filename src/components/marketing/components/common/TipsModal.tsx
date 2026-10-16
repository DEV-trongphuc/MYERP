
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
    <div className="group bg-white hover:bg-slate-50/50 p-5 rounded-[24px] border border-slate-100 hover:border-slate-200 transition-all duration-300 hover:shadow-sm relative overflow-hidden">
        <div className={`absolute inset-0 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity duration-500 ${colorClass}`} />

        <div className="flex gap-5 relative z-10">
            <div className="relative shrink-0">
                <div className={`absolute inset-0 blur-sm opacity-20 group-hover:opacity-30 transition-opacity duration-300 rounded-full ${colorClass}`} />
                <div className={`relative w-12 h-12 rounded-[18px] flex items-center justify-center shadow-sm transition-transform group-hover:scale-105 ${colorClass} text-white`}>
                    <Icon className="w-5.5 h-5.5 md:w-6 md:h-6" strokeWidth={2.5} />
                </div>
            </div>
            <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-[15px] font-bold text-slate-800 tracking-tight">
                        {title}
                    </h4>
                    {highlight && (
                        <span className="shrink-0 px-2 py-0.5 bg-slate-50 text-slate-500 text-[9px] font-black uppercase rounded-lg tracking-wider border border-slate-100 transition-all group-hover:bg-slate-800 group-hover:text-white group-hover:border-slate-800">
                            {highlight}
                        </span>
                    )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
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
        amber: 'from-amber-400 via-orange-500 to-rose-500',
        blue: 'from-blue-400 via-indigo-500 to-purple-500',
        emerald: 'from-emerald-400 via-teal-500 to-teal-600',
        indigo: 'from-indigo-400 via-blue-500 to-blue-600',
    };

    const iconBgVariants: Record<string, string> = {
        amber: 'from-amber-400 to-amber-600 shadow-amber-600/20 border-amber-300/20',
        blue: 'from-blue-400 to-blue-600 shadow-blue-500/20 border-blue-300/20',
        emerald: 'from-emerald-400 to-emerald-600 shadow-emerald-500/20 border-emerald-300/20',
        indigo: 'from-indigo-400 to-indigo-600 shadow-indigo-500/20 border-indigo-300/20',
    };

    const accentTextVariants: Record<string, string> = {
        amber: 'bg-amber-400',
        blue: 'bg-blue-400',
        emerald: 'bg-emerald-400',
        indigo: 'bg-indigo-400',
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
                <div className={`sticky top-0 left-0 w-full h-1.5 bg-gradient-to-r ${accentVariants[accentColor]} z-10`} />

                <div className="p-8 lg:p-12">
                    <div className="flex items-center justify-between mb-8 lg:mb-10">
                        <div className="flex items-center gap-6">
                            <div className="relative">
                                <div className={`absolute inset-0 bg-${accentColor}-400 blur-lg opacity-10 animate-pulse`} />
                                <div className={`relative w-16 h-16 rounded-[24px] bg-gradient-to-br ${iconBgVariants[accentColor]} text-white flex items-center justify-center shadow-lg group transition-transform hover:rotate-3 border`}>
                                    <Lightbulb className="w-8 h-8 fill-white/20" strokeWidth={2.5} />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none uppercase">{title}</h1>
                                <div className="flex items-center gap-2 mt-2">
                                    <span className={`h-3.5 w-0.5 ${accentTextVariants[accentColor]} rotate-12`}></span>
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                                        {subtitle}
                                    </p>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 hover:bg-slate-50 rounded-full text-slate-300 hover:text-slate-500 transition-all active:scale-95 group"
                        >
                            <X className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
                        </button>
                    </div>

                    <div className="flex flex-col gap-4">
                        {(tips || []).map((tip, idx) => (
                            <TipCard key={idx} {...tip} />
                        ))}
                    </div>

                    <div className="mt-12 pt-10 border-t border-slate-100 flex items-center gap-4 text-[10px] font-black text-slate-300 uppercase tracking-[0.15em] italic">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-200">
                            <Send className="w-5 h-5" />
                        </div>
                        <span>Sử dụng các mẹo này để tối ưu hóa hiệu quả làm việc của bạn</span>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default TipsModal;
