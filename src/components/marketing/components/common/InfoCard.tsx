
import React from 'react';
import { Info, X, Lightbulb } from 'lucide-react';

interface InfoCardProps {
    title: string;
    message: string;
    variant?: 'info' | 'tip' | 'warning';
    onClose?: () => void;
    className?: string;
}

const InfoCard: React.FC<InfoCardProps> = ({
    title,
    message,
    variant = 'info',
    onClose,
    className = ''
}) => {
    const variants = {
        info: {
            bg: 'bg-blue-50/50',
            border: 'border-blue-100',
            icon: <Info className="w-5 h-5 text-blue-600" />,
            titleColor: 'text-blue-900',
            messageColor: 'text-blue-700'
        },
        tip: {
            bg: 'bg-emerald-50/50',
            border: 'border-emerald-100',
            icon: <Lightbulb className="w-5 h-5 text-emerald-600" />,
            titleColor: 'text-emerald-900',
            messageColor: 'text-emerald-700'
        },
        warning: {
            bg: 'bg-amber-50/50',
            border: 'border-amber-100',
            icon: <Info className="w-5 h-5 text-amber-600" />,
            titleColor: 'text-amber-900',
            messageColor: 'text-amber-700'
        }
    };

    const style = variants[variant];

    return (
        <div className={`p-5 rounded-[24px] border ${style.bg} ${style.border} flex gap-4 relative group transition-all hover:shadow-sm ${className}`}>
            <div className="shrink-0 w-10 h-10 rounded-xl bg-white shadow-sm border border-inherit flex items-center justify-center">
                {style.icon}
            </div>
            <div className="flex-1">
                <h4 className={`text-sm font-extrabold ${style.titleColor} mb-1 tracking-tight`}>{title}</h4>
                <p className={`text-[13px] font-medium leading-relaxed ${style.messageColor} opacity-90`}>{message}</p>
            </div>
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/50 text-current opacity-40 hover:opacity-100 transition-all"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    );
};

export default InfoCard;
