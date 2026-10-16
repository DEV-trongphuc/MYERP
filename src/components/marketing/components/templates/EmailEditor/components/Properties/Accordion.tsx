// components/templates/EmailEditor/components/Properties/Accordion.tsx
import React, { useState } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';

interface AccordionProps {
    title: string;
    icon?: LucideIcon;
    children: React.ReactNode;
    defaultOpen?: boolean;
}

const Accordion: React.FC<AccordionProps> = ({ title, icon: Icon, children, defaultOpen = false }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="border border-slate-100 rounded-xl mb-3 bg-white shadow-sm hover:shadow transition-all group" style={{ overflow: 'visible' }}>
            <button onClick={() => setIsOpen(!isOpen)} className={`w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors ${isOpen ? 'rounded-t-xl' : 'rounded-xl'}`}>
                <div className="flex items-center gap-2.5">
                    {Icon && <Icon className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#ca7900] transition-colors" />}
                    <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide group-hover:text-slate-900">{title}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="p-4 space-y-5 border-t border-slate-100 bg-white animate-in slide-in-from-top-1 duration-200 rounded-b-xl">{children}</div>}
        </div>
    );
};

export default Accordion;
