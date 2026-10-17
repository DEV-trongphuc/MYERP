
import React from 'react';
import { ShieldCheck, History, AlertOctagon, CheckCircle2, ChevronRight, Clock, RotateCcw, Send } from 'lucide-react';
import { HistoryLog } from '../../../services/historyService';
import { ValidationError } from '../../../services/flowValidationService';

interface FlowSidebarProps {
    validationErrors: ValidationError[];
    logs: HistoryLog[];
    onSelectStep: (stepId: string) => void;
    durationInfo?: { min: string, max: string, breakdown?: any[] };
    mailZnsInfo?: { total: number, maxBranch: number };
    snapshotCount?: number;
    onOpenHistory?: () => void;
}

const FlowSidebar: React.FC<FlowSidebarProps> = ({
    validationErrors,
    logs,
    onSelectStep,
    durationInfo,
    mailZnsInfo,
    snapshotCount = 0,
    onOpenHistory
}) => {
    return (
        <div className="w-full lg:w-80 h-full border-l border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900 overflow-hidden flex flex-col shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.02)]">
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Kiểm duyệt Logic
                        </h4>
                        {validationErrors.length > 0 && (
                            <span className="bg-rose-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md">
                                {validationErrors.length}
                            </span>
                        )}
                    </div>

                    {validationErrors.length > 0 ? (
                        <div className="space-y-3">
                            {validationErrors.map((err, i) => (
                                <button
                                    key={i}
                                    onClick={() => err.stepId && onSelectStep(err.stepId)}
                                    className={`w-full text-left p-4 border rounded-xl transition-all group flex gap-3 items-start relative overflow-hidden ${err.type === 'critical'
                                        ? 'bg-rose-50/50 border-rose-100 hover:border-rose-300'
                                        : 'hover:border-amber-400 bg-amber-50/30'
                                        }`}
                                    style={err.type !== 'critical' ? { backgroundColor: 'rgba(254, 243, 199, 0.25)', borderColor: 'rgba(251, 191, 36, 0.35)' } : undefined}
                                >
                                    <div 
                                        className={`mt-0.5 p-1.5 rounded-lg shrink-0 ${err.type === 'critical' ? 'bg-rose-100 text-rose-600' : ''}`}
                                        style={err.type !== 'critical' ? { backgroundColor: '#fef3c7', color: '#BD1D2D' } : undefined}
                                    >
                                        <AlertOctagon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p 
                                            className={`text-[11px] font-bold leading-relaxed whitespace-normal break-words ${err.type === 'critical' ? 'text-rose-800' : ''}`}
                                            style={err.type !== 'critical' ? { color: '#92400e' } : undefined}
                                        >
                                            {err.msg}
                                        </p>
                                        {err.stepId && (
                                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-tighter text-slate-400 mt-2 group-hover:text-[var(--color-primary)] transition-colors">
                                                {err.msg.includes('tự sửa') ? 'Bấm để tự sửa' : 'Bấm để sửa'} <ChevronRight className="w-2.5 h-2.5" />
                                            </span>
                                        )}
                                    </div>
                                    <div 
                                        className={`absolute left-0 top-0 bottom-0 w-1 ${err.type === 'critical' ? 'bg-rose-500' : ''}`}
                                        style={err.type !== 'critical' ? { backgroundColor: '#BD1D2D' } : undefined}
                                    ></div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-emerald-50/50 dark:bg-emerald-950/20 p-5 rounded-xl border border-emerald-100 dark:border-emerald-800/40 flex flex-col items-center text-center group transition-all">
                            <div className="w-9 h-9 bg-white dark:bg-slate-900 rounded-full flex items-center justify-center shadow-md shadow-emerald-500/10 mb-2 group-hover:scale-110 transition-transform">
                                <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />
                            </div>
                            <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">Luồng an toàn</p>
                            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-semibold mt-0.5">Sẵn sàng kích hoạt</p>
                        </div>
                    )}
                </div>

                {/* DURATION PREDICTION BLOCK */}
                {durationInfo && (
                    <div className="px-1 space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800/80">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-indigo-500" /> Thời gian hoàn hành
                        </h4>
                        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5">
                            <div className="flex items-baseline justify-between mb-2">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Tổng quan:</span>
                                <span className="text-[11px] font-black text-slate-700 dark:text-slate-200">
                                    {durationInfo.min === durationInfo.max ? durationInfo.max : `${durationInfo.min} - ${durationInfo.max}`}
                                </span>
                            </div>
                            {durationInfo.breakdown && durationInfo.breakdown.length > 0 && (
                                <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700/60/50 mt-2">
                                    {durationInfo.breakdown.map((b, idx) => (
                                        <div key={idx} className="flex justify-between items-start text-[9px]">
                                            <span className="text-slate-500 dark:text-slate-400 font-bold max-w-[60%]">{b.label}</span>
                                            <span className="text-slate-700 dark:text-slate-200 font-bold">
                                                {Math.round(b.min / 60 * 10) / 10}h - {Math.round(b.max / 60 * 10) / 10}h
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {mailZnsInfo && (
                    <div className="px-1 space-y-3 pt-6 border-t border-slate-100 dark:border-slate-800/80">
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                            <Send className="w-3.5 h-3.5 text-sky-500" /> Thống kê Gửi tin
                        </h4>
                        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3.5">
                            <div className="flex items-baseline justify-between mb-2">
                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Tổng quan:</span>
                                <span className="text-[11px] font-black text-sky-600 dark:text-sky-400">
                                    {mailZnsInfo.total} tin
                                </span>
                            </div>
                            <div className="flex justify-between items-start text-[9px] pt-2 border-t border-slate-200 dark:border-slate-700/60/50 mt-2">
                                <span className="text-slate-500 dark:text-slate-400 font-bold max-w-[60%]">Nhánh nhận nhiều nhất:</span>
                                <span className="text-slate-700 dark:text-slate-200 font-bold">
                                    {mailZnsInfo.maxBranch} tin
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="pt-8 border-t border-slate-100 dark:border-slate-800 space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 px-1">
                        <History className="w-4 h-4 text-slate-500 dark:text-slate-400" /> Lịch sử chỉnh sửa
                    </h4>

                    <div className="relative pl-4 space-y-6 before:absolute before:left-[1.5px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-50 dark:bg-slate-950">
                        {logs.length === 0 ? (
                            <div className="text-center py-10 opacity-30">
                                <p className="text-[10px] font-bold uppercase tracking-widest">Chưa có nhật ký</p>
                            </div>
                        ) : logs.map((log) => (
                            <div key={log.id} className="relative group">
                                <div className="absolute -left-[18.5px] top-1.5 w-2 h-2 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700/60 group-hover:border-slate-400 z-10" />
                                <div className="bg-slate-50 dark:bg-slate-950/50 rounded-[14px] p-3 border border-transparent hover:border-slate-200 dark:border-slate-700/60 hover:bg-white dark:bg-slate-900 transition-all">
                                    <div className="flex justify-between items-start mb-1 gap-2">
                                        <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 leading-tight flex-1 whitespace-normal break-words">{log.action}</p>
                                        <span className="text-[9px] font-black text-slate-300 uppercase shrink-0 flex items-center gap-1">
                                            <Clock className="w-2.5 h-2.5" />
                                            {new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed whitespace-normal break-words">{log.details}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Version History Button */}
            {onOpenHistory && (
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 shrink-0">
                    <button
                        onClick={onOpenHistory}
                        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-950 hover:bg-blue-50/50 border border-slate-100 dark:border-slate-800 hover:border-blue-200 rounded-[14px] transition-all group"
                    >
                        <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <RotateCcw className="w-3.5 h-3.5" />
                            </div>
                            <div className="text-left">
                                <p className="text-[11px] font-black text-slate-700 dark:text-slate-200 group-hover:text-blue-600 leading-none">Lịch sử phiên bản</p>
                                <p className="text-[9px] text-slate-400 font-medium mt-0.5">Khôi phục bản chỉnh sửa trước</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            {snapshotCount > 0 && (
                                <span className="text-[9px] font-black text-white bg-blue-600 px-1.5 py-0.5 rounded-md">{snapshotCount}</span>
                            )}
                            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                    </button>
                </div>
            )}
        </div>
    );
};

export default FlowSidebar;
