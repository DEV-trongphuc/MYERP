
import React, { useState } from 'react';
import { Plus, AlertOctagon, Zap, Clock } from 'lucide-react';

interface AddBtnProps {
  onClick: () => void;
  onDrop?: (e: React.DragEvent) => void;
  onQuickWait?: () => void;
  isDropTarget?: boolean;
  branch?: string;
  isReportMode?: boolean;
}

export const AddBtn: React.FC<AddBtnProps> = ({ onClick, onDrop, onQuickWait, isDropTarget, isReportMode }) => {
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      className={`relative flex items-center justify-center z-30 flow-interactive py-4`}
      onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => { setIsOver(false); onDrop?.(e); }}
    >
      <div className="absolute inset-0 flex justify-center">
        <div className={`w-[2px] h-full transition-colors ${isOver ? 'bg-emerald-500' : (isDropTarget ? 'bg-emerald-200' : 'bg-slate-200')}`}></div>
      </div>

      <div className={`relative flex gap-1.5 scale-90 hover:scale-100 transition-transform ${isReportMode ? 'opacity-0 pointer-events-none' : ''}`}>
        <button
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); onClick(); }}
          className={`
               w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shadow-md
               ${isOver ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700/60 text-slate-400 hover:text-white hover:bg-emerald-500 hover:border-emerald-500'}
             `}
          title="Thêm bước mới"
        >
          <Plus className="w-5 h-5" />
        </button>

        {onQuickWait && (
          <button
            onClick={(e) => { e.stopPropagation(); onQuickWait(); }}
            className="w-8 h-8 rounded-full border-2 border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition-all shadow-md flex items-center justify-center"
            title="Chèn nhanh Chờ 1 ngày"
          >
            <Clock className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export const ErrorConnector = ({ parentId, branch, onQuickFix, isReportMode }: { parentId: string, branch?: any, onQuickFix?: (pid: string, b?: any) => void, isReportMode?: boolean }) => (
  <div className="relative flex flex-col items-center justify-center z-[60] py-6 flow-interactive w-full">
    <div className="absolute inset-0 flex justify-center">
      <div className="w-[2px] h-full border-l-2 border-dashed border-rose-400"></div>
    </div>

    <div className={`relative bg-white dark:bg-slate-900 border-2 border-rose-300 text-rose-600 px-4 py-2 rounded-2xl text-[10px] font-bold flex items-center gap-3 shadow-xl animate-in zoom-in-95 group ${isReportMode ? 'opacity-0 pointer-events-none' : ''}`}>
      <div className="p-1.5 bg-rose-100 rounded-lg shrink-0"><AlertOctagon className="w-4 h-4" /></div>
      <div className="flex flex-col overflow-hidden max-w-[150px]">
        <span className="uppercase tracking-widest leading-none truncate">Vi phạm Spam</span>
        <span className="text-[8px] opacity-60 mt-1 uppercase leading-tight">Yêu cầu bước Chờ sau Email</span>
      </div>
      {onQuickFix && (
        <button
          onClick={(e) => { e.stopPropagation(); onQuickFix?.(parentId, branch); }}
          className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-xl shadow-lg shadow-emerald-200 transition-all flex items-center gap-1.5 ml-1 active:scale-95 shrink-0"
        >
          <Clock className="w-3.5 h-3.5" /> Thêm Chờ
        </button>
      )}
    </div>
  </div>
);
