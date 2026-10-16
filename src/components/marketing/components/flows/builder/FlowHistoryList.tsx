
import React from 'react';
import { HistoryLog } from '../../../services/historyService';
import { History, Clock } from 'lucide-react';

export const FlowHistoryList: React.FC<{ logs: HistoryLog[] }> = ({ logs }) => {
  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      {logs.length === 0 ? (
        <div className="text-center py-10 opacity-40">
           <History className="w-8 h-8 mx-auto mb-2" />
           <p className="text-[10px] font-bold uppercase">Chưa có hoạt động</p>
        </div>
      ) : (
        logs.map((log, idx) => (
          <div key={log.id} className="flex gap-4 group relative">
            <div className="w-1.5 h-1.5 bg-[#2563eb] rounded-full mt-1.5 shrink-0 z-10 shadow-[0_0_8px_rgba(255,169,0,0.5)]" />
            {idx < logs.length - 1 && <div className="absolute left-[2.5px] top-4 bottom-[-24px] w-px bg-slate-100" />}
            <div>
              <p className="text-[11px] font-bold text-slate-800 leading-tight">
                {log.action}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                {log.details}
              </p>
              <span className="flex items-center gap-1 text-[9px] text-slate-300 font-black mt-2 uppercase tracking-tighter">
                <Clock className="w-2.5 h-2.5" /> {formatTime(log.timestamp)}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
