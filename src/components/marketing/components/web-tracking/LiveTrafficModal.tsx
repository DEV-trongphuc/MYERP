import * as React from 'react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, User, Clock, Monitor, Smartphone, Tablet, Globe, ExternalLink, Activity, Bot } from 'lucide-react';
import { api } from '../../services/storageAdapter';
import Modal from '../common/Modal';

interface LiveVisitor {
    id: string;
    zalo_user_id?: string;
    subscriber_id?: string;
    email?: string;
    first_name?: string;
    phone?: string;
    avatar_url?: string;
    city?: string;
    country?: string;
    device_type: string;
    os?: string;
    browser?: string;
    page_title?: string;
    page_url?: string;
    page_loaded_at: string;
    last_visit_at: string;
    time_on_page: number; // calculated from loaded_at
}

interface LiveTrafficModalProps {
    isOpen: boolean;
    onClose: () => void;
    propertyId: string;
}

const LiveTrafficModal: React.FC<LiveTrafficModalProps> = ({ isOpen, onClose: _onClose, propertyId }) => {
    const [visitors, setVisitors] = useState<LiveVisitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [isVisible, setIsVisible] = useState(false);
    const [animateIn, setAnimateIn] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsVisible(true);
            const timer = setTimeout(() => setAnimateIn(true), 10);
            return () => clearTimeout(timer);
        } else {
            setAnimateIn(false);
            const timer = setTimeout(() => setIsVisible(false), 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const onClose = () => {
        setAnimateIn(false);
        setTimeout(_onClose, 300);
    };

    useEffect(() => {
        if (isOpen) {
            fetchLiveVisitors();
            const interval = setInterval(fetchLiveVisitors, 5000); // Poll every 5s
            return () => clearInterval(interval);
        }
    }, [isOpen, propertyId]);

    const fetchLiveVisitors = async () => {
        try {
            const res = await api.get<LiveVisitor[]>(`web_tracking?action=live_visitors&id=${propertyId}`);
            if (res.success) {
                setVisitors(res.data);
            }
        } catch (error) {
            console.error('Failed to fetch live visitors', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDuration = (seconds: number) => {
        if (seconds < 60) return `${seconds}s`;
        const m = Math.floor(seconds / 60);
        return `${m}m ${seconds % 60}s`;
    };

    if (!isVisible) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="xl"
            noHeader
            noPadding
        >
            <div className={`bg-white shadow-2xl w-full h-full flex flex-col overflow-hidden transform transition-all`}>
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 bg-white flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                Live Traffic
                            </h2>
                            <p className="text-xs font-medium text-slate-400">
                                {visitors.length} visitors active in the last 30 minutes
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 px-8 py-6">
                    {loading && visitors.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-3">
                            <Activity className="w-8 h-8 text-blue-500 animate-bounce" />
                            <p className="text-slate-400 text-sm font-medium">Scanning for live activity...</p>
                        </div>
                    ) : visitors.length > 0 ? (
                        <div className="grid gap-4">
                            {visitors.map((v) => (
                                <div key={v.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 hover:shadow-md transition-all group">
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Visitor Info */}
                                        <div className="flex items-center gap-4 min-w-[200px]">
                                            <div className="relative">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-sm overflow-hidden flex-shrink-0 ${(v.subscriber_id || v.zalo_user_id || v.email || v.phone) ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    {v.avatar_url ? (
                                                        <img src={v.avatar_url} alt="" className="w-full h-full object-cover" />
                                                    ) : (
                                                        (v.email || v.first_name) ? (
                                                            <span className="text-xs font-bold uppercase">
                                                                {(v.email?.[0] || v.first_name?.[0] || '?')}
                                                            </span>
                                                        ) : <User className="w-5 h-5" />
                                                    )}
                                                </div>
                                                {(v.subscriber_id || v.zalo_user_id || v.email || v.phone) && (
                                                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white" title="Identified Customer">
                                                        <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1">
                                                    <p className="text-sm font-bold text-slate-700 truncate max-w-[150px]">
                                                        {v.first_name && v.first_name !== 'Visitor' ? v.first_name : (v.email || (v.phone ? 'Phone Visitor' : 'Anonymous'))}
                                                    </p>
                                                    {(v.time_on_page > 300 || v.last_visit_at) && ( // Simple heuristic for live or returning
                                                        <span className="text-[8px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-lg font-bold uppercase tracking-wider">Quay lại</span>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-0.5 mt-0.5">
                                                    <p className="text-[10px] text-slate-500 truncate font-medium">
                                                        {v.email || v.phone || `ID: ${v.id.substring(0, 8)}...`}
                                                    </p>
                                                    <div className="flex items-center gap-1.5">
                                                        {v.device_type === 'bot' ? <Bot className="w-3 h-3 text-slate-400" /> :
                                                            v.device_type === 'mobile' ? <Smartphone className="w-3 h-3 text-slate-400" /> :
                                                                v.device_type === 'tablet' ? <Tablet className="w-3 h-3 text-slate-400" /> :
                                                                    <Monitor className="w-3 h-3 text-slate-400" />}
                                                        <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">
                                                            {v.city || v.country || 'Unknown Loc'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Current Page */}
                                        <div className="flex-1 min-w-0 max-w-[500px]">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 text-[9px] font-bold uppercase tracking-wider border border-emerald-100">
                                                    Viewing
                                                </span>
                                                <span className="text-xs text-slate-400 font-mono">
                                                    {formatDuration(v.time_on_page)} ago
                                                </span>
                                            </div>
                                            <a href={v.page_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 group/link">
                                                <Globe className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                                                <span className="text-sm font-semibold text-slate-800 truncate hover:text-blue-600 transition-colors">
                                                    {v.page_title || v.page_url || 'Home'}
                                                </span>
                                                <ExternalLink className="w-3 h-3 text-slate-300 opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                                            </a>
                                            <p className="text-xs text-slate-400 truncate mt-0.5 pl-5 opacity-70">
                                                {v.page_url}
                                            </p>
                                        </div>

                                        {/* Tech Stack */}
                                        <div className="flex flex-col items-end gap-1 min-w-[100px] text-right">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{v.os || 'OS'}</span>
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{v.browser || 'Browser'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-sm border border-slate-100">
                                <Clock className="w-8 h-8 text-slate-300" />
                            </div>
                            <p className="font-medium text-slate-600">No active visitors</p>
                            <p className="text-sm opacity-60">Right now, no one is viewing the site.</p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default LiveTrafficModal;
