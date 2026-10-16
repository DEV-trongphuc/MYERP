// Survey Editor Top Bar Component
import React, { useState } from 'react';
import { Survey } from '../../types/survey';
import * as LucideIcons from 'lucide-react';
import { Monitor, Tablet, Smartphone, Save, Eye, Send, ChevronLeft, Globe } from 'lucide-react';
import SurveyPublishModal from './publish/SurveyPublishModal';

interface Props {
    survey: Survey;
    isSaving: boolean;
    isDirty: boolean;
    viewMode: 'desktop' | 'tablet' | 'mobile';
    onViewModeChange: (v: 'desktop' | 'tablet' | 'mobile') => void;
    onSave: () => void;
    onNameChange: (name: string) => void;
    onPublish: () => Promise<void>;
    onPreview: () => void;
    onBack?: () => void;
}

const SurveyTopBar: React.FC<Props> = ({
    survey, isSaving, isDirty, viewMode, onViewModeChange, onSave, onNameChange, onPublish, onPreview, onBack }) => {
    const [editingName, setEditingName] = useState(false);
    const [nameVal, setNameVal] = useState(survey.name);
    const [showPublish, setShowPublish] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);

    const statusColors: Record<string, string> = {
        draft:  'bg-slate-100 text-slate-500',
        active: 'bg-emerald-100 text-emerald-700',
        paused: 'bg-amber-100 text-amber-700',
        closed: 'bg-red-100 text-red-600',
    };
    const statusLabels: Record<string, string> = {
        draft: 'Nháp', active: 'Đang chạy', paused: 'Tạm dừng', closed: 'Đã đóng'
    };

    return (
        <>
        <div className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0 shadow-sm">
            {/* Back */}
            <button
                type="button"
                onClick={() => {
                    if (onBack) onBack();
                    else window.location.href = '/marketing/surveys';
                }}
                className="flex items-center gap-1.5 text-slate-500 hover:text-[var(--color-primary)] transition-colors text-sm font-medium"
            >
                <ChevronLeft className="w-4 h-4" />
                <span>Khảo sát</span>
            </button>
            <div className="w-px h-5 bg-slate-200" />

            {/* Survey Name */}
            {editingName ? (
                <input
                    autoFocus
                    className="font-semibold text-slate-800 bg-slate-50 border border-[var(--color-primary)] rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] min-w-[200px]"
                    value={nameVal}
                    onChange={e => setNameVal(e.target.value)}
                    onBlur={() => { setEditingName(false); onNameChange(nameVal); }}
                    onKeyDown={e => { if (e.key === 'Enter') { setEditingName(false); onNameChange(nameVal); } }}
                />
            ) : (
                <button
                    type="button"
                    onClick={() => { setEditingName(true); setNameVal(survey.name); }}
                    className="font-semibold text-slate-800 hover:text-[var(--color-primary)] transition-colors text-sm flex items-center gap-1.5 group"
                >
                    {survey.name}
                    <LucideIcons.Pencil className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                </button>
            )}

            {/* Status badge */}
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${statusColors[survey.status]}`}>
                {statusLabels[survey.status]}
            </span>

            <div className="flex-1" />

            {/* View mode toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                {([['desktop', Monitor], ['tablet', Tablet], ['mobile', Smartphone]] as const).map(([mode, Icon]) => (
                    <button
                        type="button"
                        key={mode}
                        onClick={() => onViewModeChange(mode)}
                        className={`p-1.5 rounded-md transition-all ${viewMode === mode ? 'bg-white shadow text-[var(--color-primary)]' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Icon className="w-4 h-4" />
                    </button>
                ))}
            </div>

            {/* Preview — opens inline modal */}
            <button
                type="button"
                onClick={onPreview}
                className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-[var(--color-primary)] transition-colors font-medium px-2 py-1.5 rounded-lg hover:bg-[var(--color-primary-light)]"
            >
                <Eye className="w-4 h-4" />
                <span>Xem thử</span>
            </button>

            {/* Save */}
            <button
                type="button"
                onClick={onSave}
                disabled={isSaving || !isDirty}
                className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg transition-all ${
                    isDirty ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'text-slate-400 cursor-default'
                }`}
            >
                {isSaving ? (
                    <div className="w-3.5 h-3.5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                    <Save className="w-3.5 h-3.5" />
                )}
                <span>{isSaving ? 'Đang lưu...' : isDirty ? 'Lưu' : 'Đã lưu'}</span>
            </button>

            {/* Publish / Distribute */}
            <button
                type="button"
                onClick={() => setShowPublish(true)}
                className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white transition-all shadow-sm"
            >
                {survey.status === 'active' ? <Globe className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                <span>{survey.status === 'active' ? 'Chia sẻ' : 'Xuất bản'}</span>
            </button>
        </div>

        {showPublish && (
            <SurveyPublishModal
                survey={survey}
                onClose={() => setShowPublish(false)}
                onPublish={async () => {
                    setIsPublishing(true);
                    await onPublish();
                    setIsPublishing(false);
                }}
            />
        )}
        </>
    );
};

export default SurveyTopBar;
