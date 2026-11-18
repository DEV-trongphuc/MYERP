import * as React from 'react';
import { useEffect, useState } from 'react';
import { X, Eye, Users, Clock, MousePointer2, TrendingDown, Globe, Activity, TrendingUp } from 'lucide-react';
import { api } from '../../services/storageAdapter';
import Modal from '../common/Modal';
import { ensureArray, extractArray } from '../../../../utils/safeArray';

interface PageDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    propertyId: string;
    pageUrl: string;
    urlHash?: string;
    pageTitle: string;
    startDate: string;
    endDate: string;
    formatDuration: (seconds: number) => string;
    renderEventIcon: (type: string) => React.ReactNode;
    initialDevice?: 'all' | 'mobile' | 'desktop' | 'tablet' | 'bot';
}

interface PageDetails {
    overview: {
        totalViews: number;
        uniqueVisitors: number;
        avgTimeOnPage: number;
        avgScrollDepth: number;
        avgLoadTime: number;
        entrances: number;
        bounces: number;
        bounceRate: number;
    };
    events: Array<{ type: string; target: string; count: number }>;
    sources: Array<{ source: string; medium: string; sessions: number }>;
}

const PageDetailsModal: React.FC<PageDetailsModalProps> = ({
    isOpen,
    onClose: _onClose,
    propertyId,
    pageUrl,
    urlHash,
    pageTitle,
    startDate,
    endDate,
    formatDuration,
    renderEventIcon,
    initialDevice
}) => {
    const [loading, setLoading] = useState(true);
    const [details, setDetails] = useState<PageDetails | null>(null);
    const [deviceFilter, setDeviceFilter] = useState<'all' | 'mobile' | 'desktop' | 'tablet' | 'bot'>(initialDevice || 'all');
    const [eventTab, setEventTab] = useState<'click' | 'canvas' | 'other'>('click');

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
            setDeviceFilter(initialDevice || 'all');
        }
    }, [isOpen, initialDevice]);

    const renderSourceLogo = (sourceName: string, medium: string) => {
        const s = sourceName.toLowerCase();
        if (s === 'direct' || s === '(direct)') return <Globe className="w-5 h-5 text-slate-400" />;
        if (s.includes('google')) return <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3c/Google_Favicon_2025.svg/250px-Google_Favicon_2025.svg.png" className="w-5 h-5 object-contain" alt="Google" />;
        if (s.includes('facebook') || s === 'fb') return <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/960px-2021_Facebook_icon.svg.png" className="w-5 h-5 object-contain" alt="Facebook" />;
        if (s.includes('zalo')) return <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/960px-Icon_of_Zalo.svg.png" className="w-5 h-5 object-contain" alt="Zalo" />;
        return <div className={`w-3 h-3 rounded-full ${medium === 'organic' ? 'bg-green-500' : medium === 'paid' ? 'bg-[var(--color-primary)]' : 'bg-blue-500'}`} />;
    };

    useEffect(() => {
        if (isOpen && propertyId && (pageUrl || urlHash)) {
            fetchPageDetails();
        }
    }, [isOpen, propertyId, pageUrl, urlHash, startDate, endDate, deviceFilter]);

    const fetchPageDetails = async () => {
        setLoading(true);
        try {
            const res = await api.get<PageDetails>(
                `web_tracking?action=page_details&id=${propertyId}&url=${encodeURIComponent(pageUrl)}&url_hash=${encodeURIComponent(urlHash || '')}&start_date=${startDate}&end_date=${endDate}&device=${deviceFilter}`
            );
            if (res.success) {
                setDetails(res.data);
            }
        } catch (error) {
            console.error('Error fetching page details:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isVisible) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="2xl"
            noHeader
            noPadding
        >
            <div className={`bg-white shadow-2xl w-full h-full flex flex-col overflow-hidden transform transition-all`}>
                {/* Header */}
                <div className="px-8 py-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white flex-shrink-0">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1 min-w-0 pr-4">
                            <h2 className="text-xl font-bold text-slate-800 mb-1 truncate" title={pageTitle}>
                                {pageTitle || pageUrl}
                            </h2>
                            <p className="text-sm text-slate-500 font-mono truncate" title={pageUrl}>
                                {pageUrl}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Device Filter */}
                    <div className="flex items-center gap-2">
                        {(['all', 'mobile', 'desktop', 'tablet', 'bot'] as const).map((device) => (
                            <button
                                key={device}
                                onClick={() => setDeviceFilter(device)}
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${deviceFilter === device
                                    ? 'bg-[#BD1D2D] text-white shadow-xs'
                                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                                    }`}
                            >
                                {device === 'all' ? 'Tất cả' : device === 'mobile' ? 'Mobile' : device === 'desktop' ? 'Desktop' : device === 'tablet' ? 'Tablet' : 'Bot'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content - Fixed height with scroll */}
                <div className="flex-1 overflow-y-auto p-8">
                    {loading ? (
                        /* Skeleton Loading */
                        <div className="space-y-6 animate-pulse">
                            {/* Stats Skeleton */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="bg-slate-100 p-4 rounded-[14px] h-24"></div>
                                ))}
                            </div>

                            {/* Events Skeleton */}
                            <div>
                                <div className="h-6 bg-slate-200 rounded w-48 mb-4"></div>
                                <div className="space-y-2">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="h-16 bg-slate-100 rounded-xl"></div>
                                    ))}
                                </div>
                            </div>

                            {/* Sources Skeleton */}
                            <div>
                                <div className="h-6 bg-slate-200 rounded w-48 mb-4"></div>
                                <div className="space-y-2">
                                    {[...Array(3)].map((_, i) => (
                                        <div key={i} className="h-14 bg-slate-100 rounded-xl"></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : details ? (
                        <div className="space-y-6">
                            {/* Overview Stats */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl hover:border-slate-300 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Eye className="w-4 h-4 text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lượt xem</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{details.overview.totalViews.toLocaleString()}</p>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl hover:border-slate-300 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Users className="w-4 h-4 text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Visitors</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{details.overview.uniqueVisitors.toLocaleString()}</p>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl hover:border-slate-300 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Clock className="w-4 h-4 text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thời gian</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{formatDuration(Math.round(details.overview.avgTimeOnPage || 0))}</p>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl hover:border-slate-300 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MousePointer2 className="w-4 h-4 text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Scroll</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{Math.round(details.overview.avgScrollDepth || 0)}%</p>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl hover:border-slate-300 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingDown className="w-4 h-4 text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bounce</span>
                                    </div>
                                    <p className="text-2xl font-bold text-slate-900 tabular-nums">{details.overview.bounceRate.toFixed(1)}%</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1 tabular-nums">
                                        {details.overview.bounces}/{details.overview.entrances} entrances
                                    </p>
                                </div>

                                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl hover:border-slate-300 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <TrendingUp className={`w-4 h-4 ${details.overview.avgLoadTime > 2500 ? 'text-[#BD1D2D]' : 'text-slate-400'}`} />
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Load</span>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <p className={`text-2xl font-bold tabular-nums ${details.overview.avgLoadTime > 2500 ? 'text-[#BD1D2D]' : 'text-slate-900'}`}>
                                            {details.overview.avgLoadTime > 0 ? (details.overview.avgLoadTime / 1000).toFixed(2) : '--'}
                                        </p>
                                        <span className="text-xs font-bold text-slate-400">s</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1 truncate">
                                        {details.overview.avgLoadTime > 2500 ? 'Tải chậm' : 'Tốc độ tốt'}
                                    </p>
                                </div>
                            </div>

                            {/* Events */}
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-[#BD1D2D]">
                                        <Activity className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-[15px] font-bold text-slate-900">Tương tác trên trang</h3>
                                        <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Hành động người dùng</p>
                                    </div>
                                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-[10px] border border-slate-200">
                                        {(['click', 'canvas', 'other'] as const).map((tab) => (
                                            <button
                                                key={tab}
                                                onClick={() => setEventTab(tab)}
                                                className={`px-3 py-1.5 text-[11px] font-bold rounded-[7px] transition-colors ${eventTab === tab
                                                    ? 'bg-white text-[#BD1D2D] shadow-xs'
                                                    : 'text-slate-500 hover:text-slate-700'
                                                    }`}
                                            >
                                                {tab === 'click' ? 'Button Click' : tab === 'canvas' ? 'Canvas Click' : 'Other'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2 min-h-[200px]">
                                    {(() => {
                                        const filteredEvents = ensureArray(details?.events).filter(e => {
                                            if (eventTab === 'click') return e.type === 'click';
                                            if (eventTab === 'canvas') return e.type === 'canvas_click';
                                            return e.type !== 'click' && e.type !== 'canvas_click';
                                        });

                                        return filteredEvents.length > 0 ? (
                                            filteredEvents.map((event, idx) => {
                                                const isScroll = event.type === 'scroll';
                                                const displayName = isScroll ? `Cuộn trang ${event.target}%` : (event.target || 'Không rõ');

                                                return (
                                                    <div key={idx} className="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-200/80 rounded-xl transition-colors group">
                                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                                            <div className="w-9 h-9 rounded-lg bg-slate-100 group-hover:bg-rose-50 flex items-center justify-center text-slate-500 group-hover:text-[#BD1D2D] transition-colors shrink-0">
                                                                {renderEventIcon(event.type)}
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-xs font-semibold text-slate-800 truncate mb-0.5">{displayName}</p>
                                                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                                                    {event.type.replace('_', ' ')}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <span className="text-[13px] font-bold text-slate-900 group-hover:text-[#BD1D2D] transition-colors tabular-nums">{event.count.toLocaleString('vi-VN')}</span>
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <div className="py-12 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                                                <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                                <p className="text-slate-500 text-xs font-medium">Không có dữ liệu {eventTab}</p>
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* Traffic Sources */}
                            <div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="w-10 h-10 rounded-[14px] flex items-center justify-center text-white shadow-lg bg-gradient-to-br from-[#BD1D2D] to-[#9A1523]">
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-[15px] font-black text-slate-800 tracking-tight">Nguồn truy cập</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Từ đâu đến trang này</p>
                                    </div>
                                </div>

                                <div className="space-y-2 min-h-[150px]">
                                    {details.sources.length > 0 ? (
                                        ensureArray(details?.sources).map((source, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 border border-slate-100 rounded-xl transition-all group">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center p-1.5 shrink-0 group-hover:scale-110 transition-transform">
                                                        {renderSourceLogo(source.source, source.medium)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-[11px] font-bold text-slate-700 capitalize mb-0.5">{source.source}</p>
                                                        <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${source.medium === 'paid' ? 'bg-orange-50 text-[var(--color-primary)]' :
                                                            source.medium === 'organic' ? 'bg-emerald-50 text-emerald-600' :
                                                                'bg-slate-100 text-slate-500'
                                                            }`}>
                                                            {source.medium}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[13px] font-black text-slate-800">{source.sessions} sessions</span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-center py-8 text-slate-400 text-sm italic">Không có dữ liệu nguồn</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 text-slate-400">
                            <p>Không thể tải dữ liệu</p>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};

export default PageDetailsModal;
