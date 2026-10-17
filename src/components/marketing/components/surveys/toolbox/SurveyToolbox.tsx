import React, { useState } from 'react';
import { QuestionType, QuestionGroup } from '../../../types/survey';
import { QUESTION_TYPE_DEFINITIONS, QUESTION_GROUPS } from '../constants/questionTypes';
import * as LucideIcons from 'lucide-react';
import { Search, GripVertical } from 'lucide-react';
import { useDrag } from '../../../shims/reactDnd';

export const DND_TOOLBOX_TYPE = 'SURVEY_TOOLBOX_ITEM';

export interface DragToolboxItem {
    type: typeof DND_TOOLBOX_TYPE;
    questionType: QuestionType;
}


const ToolboxItem: React.FC<{ qt: typeof QUESTION_TYPE_DEFINITIONS[0]; onAdd: (t: QuestionType) => void }> = ({ qt, onAdd }) => {
    const ref = React.useRef<HTMLDivElement>(null);
    const [{ isDragging }, drag] = useDrag<DragToolboxItem, void, { isDragging: boolean }>({
        type: DND_TOOLBOX_TYPE,
        item: { type: DND_TOOLBOX_TYPE, questionType: qt.type },
        collect: monitor => ({ isDragging: monitor.isDragging() }),
    });
    drag(ref);

    const Icon = (LucideIcons as any)[qt.icon] ?? LucideIcons.HelpCircle;

    return (
        <div
            ref={ref}
            onClick={() => onAdd(qt.type)}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-grab active:cursor-grabbing transition-colors group mb-1
                ${isDragging ? 'opacity-40 scale-95' : 'bg-white dark:bg-[#111827] hover:bg-[var(--color-primary-light)] hover:border-[var(--color-primary)]/30'}
                border border-slate-200/70 dark:border-white/[0.06]`}
            title={qt.description}
        >
            <GripVertical className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-[var(--color-primary)] flex-shrink-0" />
            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-white/10 group-hover:bg-[var(--color-primary-light)] group-hover:border-[var(--color-primary)]/20 flex items-center justify-center flex-shrink-0 transition-colors">
                <Icon className="w-3.5 h-3.5 text-slate-700 dark:text-slate-200 group-hover:text-[var(--color-primary)]" />
            </div>
            <div className="min-w-0">
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-[var(--color-primary)] truncate leading-tight">{qt.label}</div>
                <div className="text-[10px] font-medium text-slate-600 dark:text-slate-400 truncate leading-tight mt-0.5">{qt.description}</div>
            </div>
        </div>
    );
};


interface Props {
    onAddBlock: (type: QuestionType) => void;
}

const SurveyToolbox: React.FC<Props> = ({ onAddBlock }) => {
    const [search, setSearch] = useState('');
    const [openGroups, setOpenGroups] = useState<Set<QuestionGroup>>(new Set(QUESTION_GROUPS));

    const toggleGroup = (g: QuestionGroup) => {
        setOpenGroups(prev => {
            const next = new Set(prev);
            next.has(g) ? next.delete(g) : next.add(g);
            return next;
        });
    };

    const filtered = QUESTION_TYPE_DEFINITIONS.filter(q =>
        !search || q.label.toLowerCase().includes(search.toLowerCase()) || q.description.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="w-[320px] shrink-0 bg-white dark:bg-[#111827] border-r border-slate-200 dark:border-white/[0.08] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3.5 border-b border-slate-200 dark:border-white/[0.08]">
                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">Loại câu hỏi</p>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Tìm kiếm loại câu hỏi..."
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder:text-slate-500 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-white/15 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] focus:border-[var(--color-primary)]"
                    />
                </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto py-2 px-2">
                {search ? (
                    <div>
                        {filtered.map(qt => (
                            <ToolboxItem key={qt.type} qt={qt} onAdd={onAddBlock} />
                        ))}
                        {filtered.length === 0 && (
                            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 text-center py-6">Không tìm thấy loại câu hỏi</p>
                        )}
                    </div>
                ) : (
                    QUESTION_GROUPS.map(group => {
                        const items = QUESTION_TYPE_DEFINITIONS.filter(q => q.group === group);
                        const isOpen = openGroups.has(group);
                        return (
                            <div key={group} className="mb-2">
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(group)}
                                    className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider hover:text-[var(--color-primary)] transition-colors"
                                >
                                    {group}
                                    <LucideIcons.ChevronDown className={`w-3.5 h-3.5 text-slate-600 dark:text-slate-300 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                                </button>
                                {isOpen && (
                                    <div className="mt-1">
                                        {items.map(qt => (
                                            <ToolboxItem key={qt.type} qt={qt} onAdd={onAddBlock} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default SurveyToolbox;

// Dual value declarations for verbatimModuleSyntax compatibility
export const DragToolboxItem: any = undefined;
