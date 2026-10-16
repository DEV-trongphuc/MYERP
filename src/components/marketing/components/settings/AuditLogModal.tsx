import React, { useState, useEffect } from 'react';
import { X, Loader2, AlertCircle, ShieldCheck } from 'lucide-react';
import { api } from '../../services/storageAdapter';

interface AuditLog {
    id: number;
    user_name: string;
    user_picture?: string;
    module: string;
    action: string;
    target_name: string;
    details: any;
    created_at: string;
}

interface AuditLogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const AuditLogModal: React.FC<AuditLogModalProps> = ({ isOpen, onClose }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        if (isOpen) {
            setLogs([]);
            setPage(1);
            setHasMore(true);
            fetchLogs(1);
        }
    }, [isOpen]);

    const fetchLogs = async (p: number) => {
        setLoading(true);
        try {
            const res = await api.get<any>(`system_audit_logs?page=${p}&limit=20`);
            if (res.success) {
                if (p === 1) {
                    setLogs(res.data.logs || []);
                } else {
                    setLogs(prev => [...prev, ...(res.data.logs || [])]);
                }
                setHasMore(res.data.hasMore);
                setPage(p);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
            {/* Backdrop — click outside to close */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
            
            {/* Panel — stop propagation so clicking inside doesn't close modal */}
            <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl flex flex-col h-[80vh] overflow-hidden animate-fade-in mx-4" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shadow-inner">
                            <ShieldCheck className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800">System Audit Logs</h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Lịch sử hoạt động</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-slate-50 p-6 relative">
                    {loading && logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-4" />
                            <p className="text-sm font-bold text-slate-400">Đang tải lịch sử...</p>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-50">
                            <AlertCircle className="w-12 h-12 text-slate-300 mb-4" />
                            <p className="text-sm font-bold text-slate-500">Chưa có bản ghi hoạt động nào</p>
                        </div>
                    ) : (
                        <div className="space-y-4 relative">
                            {/* Vertical Timeline Line */}
                            <div className="absolute left-[23px] top-4 bottom-4 w-0.5 bg-slate-200/60 rounded-full"></div>
                            
                            {logs.map((log, index) => {
                                const actionColor = 
                                    log.action === 'delete' ? 'text-rose-600 bg-rose-50 border-rose-100' :
                                    log.action === 'create' ? 'text-emerald-600 bg-emerald-50 border-emerald-100' :
                                    log.action === 'update' ? 'text-blue-600 bg-blue-50 border-blue-100' :
                                    'text-amber-600 bg-amber-50 border-amber-100';

                                let actionVerb = 'đã thao tác thay đổi';
                                if (log.action === 'create') actionVerb = 'đã tạo mới bản ghi';
                                else if (log.action === 'delete') actionVerb = 'đã xóa vĩnh viễn';
                                else if (log.action === 'update') {
                                    actionVerb = 'đã cập nhật cấu hình';
                                    if (log.details?.status) {
                                        const st = String(log.details.status).toLowerCase();
                                        if (st === 'paused' || st === 'pause') actionVerb = 'đã tạm dừng (pause) hoạt động của';
                                        else if (st === 'active') actionVerb = 'đã kích hoạt chạy lại (active)';
                                        else if (st === 'draft') actionVerb = 'đã chuyển về bản nháp (draft)';
                                        else actionVerb = `đã đổi trạng thái thành "${log.details.status}" đối với`;
                                    }
                                } else if (log.action === 'export') actionVerb = 'đã trích xuất dữ liệu từ';
                                else if (log.action === 'login') actionVerb = 'đã đăng nhập vào hệ thống';

                                return (
                                    <div key={log.id} className="relative pl-14 transition-all">
                                        {/* Avatar with Status indicator dot */}
                                        <div className="absolute left-[5px] top-1 z-10 w-9 h-9 rounded-full border-2 border-white bg-slate-100 shadow-md shrink-0">
                                            <img 
                                                src={log.user_picture || "/imgs/ICON.png"} 
                                                className="w-full h-full object-cover rounded-full" 
                                                alt="" 
                                                onError={(e) => { (e.target as HTMLImageElement).src = "/imgs/ICON.png"; }}
                                            />
                                            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${actionColor.split(' ')[1]}`}></div>
                                        </div>
                                        
                                        <div className="flex items-start justify-between bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${actionColor}`}>{log.action}</span>
                                                    <span className="text-xs font-bold text-slate-700 capitalize">{log.module}</span>
                                                </div>
                                                <p className="text-sm text-slate-600 mb-2">
                                                    <span className="font-bold text-slate-800">{log.user_name}</span> {actionVerb} <span className="font-bold text-slate-800 truncate block sm:inline max-w-xs">{log.target_name || log.module}</span>
                                                </p>
                                                {log.details && Object.keys(log.details).length > 0 && (
                                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                                                        {Object.entries(log.details).map(([k, v]) => (
                                                            <div key={k} className="flex items-center justify-between bg-slate-50 hover:bg-amber-50/30 border border-slate-100 hover:border-amber-100/50 rounded-lg py-2 px-3 transition-colors group/prop">
                                                                <span className="text-[10px] font-black tracking-wider uppercase text-slate-400 group-hover/prop:text-amber-600/70">{k}</span>
                                                                <span className="text-xs font-bold text-slate-700 font-mono truncate max-w-[65%]" title={typeof v === 'object' ? JSON.stringify(v) : String(v)}>
                                                                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-[10px] font-bold text-slate-400 whitespace-nowrap mt-1 group-hover:text-amber-600 transition-colors">
                                                {new Date(log.created_at).toLocaleString('vi-VN')}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {hasMore && (
                                <div className="pl-14 pt-4">
                                    <button 
                                        onClick={() => fetchLogs(page + 1)} 
                                        disabled={loading}
                                        className="w-full py-3 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-500 hover:text-amber-600 hover:border-amber-200 shadow-sm transition-all"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Tải thêm...'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AuditLogModal;
