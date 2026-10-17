import * as React from 'react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, MousePointer, Clock, User, MessageCircle, Search } from 'lucide-react';
import axios from 'axios';
import Input from '../common/Input';
import { API_BASE_URL } from '../../utils/config';
import { getMktPortalRoot } from '../../utils/portalRoot';

interface AutomationStatsModalProps {
    scenario: any;
    onClose: () => void;
}

const AutomationStatsModal: React.FC<AutomationStatsModalProps> = ({ scenario, onClose: _onClose }) => {
    const [animateIn, setAnimateIn] = useState(false);
    useEffect(() => { setTimeout(() => setAnimateIn(true), 10); }, []);
    const onClose = () => { setAnimateIn(false); setTimeout(_onClose, 400); };

    const [summary, setSummary] = useState<{ sent: number; clicks: number; ctr: string; button_stats?: any[] }>({ sent: 0, clicks: 0, ctr: '0%', button_stats: [] });
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedBtn, setSelectedBtn] = useState('');

    useEffect(() => {
        fetchSummary();
        fetchLogs(1, true);
    }, [searchTerm, selectedBtn]);

    const fetchSummary = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/zalo_stats.php?route=summary&id=${scenario.id}`);
            if (res.data.success) {
                setSummary(res.data.data);
            }
        } catch (error) {
            console.error('Fetch summary error:', error);
        }
    };

    const fetchLogs = async (pageNum: number, reset = false) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/zalo_stats.php?route=logs&id=${scenario.id}&page=${pageNum}&q=${searchTerm}&btn=${selectedBtn}`);
            if (res.data.success) {
                const newLogs = res.data.data || [];
                if (newLogs.length < 20) setHasMore(false);
                else setHasMore(true);
                setLogs(prev => reset ? newLogs : [...prev, ...newLogs]);
            }
        } catch (error) {
            console.error('Fetch logs error:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchLogs(nextPage);
    };

    return createPortal(
        <div className="fixed inset-0 z-[2147483642] flex items-center justify-center p-4" style={{ zIndex: 2147483642 }}>
            <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-[1px] transition-opacity duration-300 ease-out ${animateIn ? 'opacity-100' : 'opacity-0'}`}
                onClick={onClose}
            />
            <div
                style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                className={`relative bg-white w-full max-w-4xl rounded-[18px] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col border border-slate-100 transform transition-all duration-500 ${animateIn ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-white relative z-10">
                    <div>
                        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                            <span className="text-[var(--color-primary)]">
                                Báo cáo hiệu quả
                            </span>
                        </h2>
                        <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-wider">Kịch bản: {scenario.title}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-full transition-all">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-white p-5 rounded-[14px] border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[14px] bg-blue-50 text-blue-600 flex items-center justify-center">
                                <Send className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Đã gửi</p>
                                <p className="text-2xl font-black text-slate-800">{summary.sent}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-[14px] border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[14px] bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
                                <MousePointer className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lượt Click</p>
                                <p className="text-2xl font-black text-slate-800">{summary.clicks}</p>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-[14px] border border-slate-100 shadow-sm flex items-center gap-4">
                            <div className="w-12 h-12 rounded-[14px] bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                <span className="text-lg font-black">%</span>
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tỷ lệ click (CTR)</p>
                                <p className="text-2xl font-black text-slate-800">{summary.ctr}</p>
                            </div>
                        </div>
                    </div>

                    {/* Button Stats Breakdown */}
                    {summary.button_stats && summary.button_stats.length > 0 && (
                        <div className="bg-white rounded-[14px] border border-slate-100 shadow-sm overflow-hidden mb-8">
                            <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                                    <MessageCircle className="w-4 h-4 text-slate-400" />
                                    Thống kê theo nút (Nhấn vào nút để lọc)
                                </h3>
                                {selectedBtn && (
                                    <button
                                        onClick={() => setSelectedBtn('')}
                                        className="text-[10px] font-black text-rose-500 uppercase hover:underline"
                                    >
                                        Xóa lọc nút
                                    </button>
                                )}
                            </div>
                            <div className="divide-y divide-slate-50">
                                {summary.button_stats.map((btn, idx) => (
                                    <div
                                        key={idx}
                                        className={`p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${selectedBtn === btn.details ? 'bg-blue-50/50' : ''}`}
                                        onClick={() => setSelectedBtn(selectedBtn === btn.details ? '' : btn.details)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${selectedBtn === btn.details ? 'bg-blue-500 text-white' : 'bg-blue-50 text-blue-600'}`}>
                                                {idx + 1}
                                            </div>
                                            <p className={`text-sm font-semibold ${selectedBtn === btn.details ? 'text-blue-600' : 'text-slate-700'}`}>
                                                {btn.details.replace('Click Button: ', '').replace('Click Link: ', '')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Lượt nhấn:</span>
                                            <span className="text-lg font-black text-slate-800">{btn.count}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Detailed Logs Control */}
                    <div className="bg-white rounded-[14px] border border-slate-100 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
                                <Clock className="w-4 h-4 text-slate-400" />
                                Nhật ký hoạt động chi tiết
                            </h3>
                            <div className="w-full md:w-64">
                                <Input
                                    placeholder="Tìm theo tên Khách hàng..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setPage(1);
                                    }}
                                    icon={Search}
                                />
                            </div>
                        </div>

                        <div className="divide-y divide-slate-50">
                            {loading && logs.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">Đang tải dữ liệu...</div>
                            ) : logs.length === 0 ? (
                                <div className="p-8 text-center text-slate-400 text-sm">Chưa có dữ liệu hoạt động nào.</div>
                            ) : (
                                logs.map((log, idx) => (
                                    <div key={idx} className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0">
                                                {log.avatar ? (
                                                    <img src={log.avatar} alt="avatar" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                                        <User className="w-5 h-5" />
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-slate-700">{log.display_name || 'Người dùng Zalo'}</p>
                                                <p className="text-xs text-slate-500 flex items-center gap-1">
                                                    {log.type === 'automation_trigger' ?
                                                        <span className="text-blue-500 font-medium">Đã nhận tin nhắn</span> :
                                                        <span className="text-[var(--color-primary)] font-medium">Đã click link</span>
                                                    }
                                                    <span className="text-slate-300">•</span>
                                                    <span>{log.details || '-'}</span>
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-xs font-medium text-slate-400 whitespace-nowrap">
                                            {formatDate(log.created_at)}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {hasMore && (
                            <div className="p-3 bg-slate-50 border-t border-slate-100 text-center">
                                <button
                                    onClick={loadMore}
                                    className="text-xs font-bold text-blue-500 hover:text-blue-600 hover:underline transition-all"
                                >
                                    Xem thêm cũ hơn
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        getMktPortalRoot()
    );
};

const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(date);
};

export default AutomationStatsModal;
