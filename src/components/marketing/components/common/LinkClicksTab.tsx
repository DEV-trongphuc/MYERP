import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { ExternalLink, Search, MousePointer2, RefreshCw, Filter, User, Calendar, MousePointerClick, ChevronRight, BarChart3, Smartphone, Monitor, Globe, MapPin, ChevronDown, Check, LayoutGrid, Flame } from 'lucide-react';
import { api } from '../../services/storageAdapter';
import Badge from './Badge';
import ClickHeatmap from './ClickHeatmap';

interface LinkClicksTabProps {
    type: 'campaign' | 'flow';
    id: string;
    stepId?: string;
    initialHtml?: string;
    initialViewMode?: 'list' | 'heatmap';
}

const LinkClicksTab: React.FC<LinkClicksTabProps> = ({ type, id, stepId, initialHtml, initialViewMode }) => {
    const [links, setLinks] = useState<any[]>([]);
    const [clicks, setClicks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingDetails, setLoadingDetails] = useState(false);
    const [selectedLink, setSelectedLink] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalClicks, setTotalClicks] = useState(0);
    const [uniqueUserClicks, setUniqueUserClicks] = useState(0);

    // Heatmap State
    const [viewMode, setViewMode] = useState<'list' | 'heatmap'>(initialViewMode || 'list');
    const [html, setHtml] = useState(initialHtml || '');
    const [loadingHtml, setLoadingHtml] = useState(false);
    const [deviceFilter, setDeviceFilter] = useState<'all' | 'desktop' | 'mobile'>('all');

    // Dropdown state
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const cleanTrackedUrl = (raw: string): string => {
        if (!raw || typeof raw !== 'string') return '';
        let clean = raw.trim();
        clean = clean.replace(/^(?:Zalo\s+)?Click(?:ed)?\s+(?:link(?:\/button)?|button)(?:\s*\([^)]*\))*:\s*/i, '').trim();
        if (!/^https?:\/\//i.test(clean)) {
            const match = clean.match(/(https?:\/\/\S+)/i);
            if (match) {
                clean = match[1];
            } else if (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(clean)) {
                clean = 'https://' + clean;
            }
        }
        return clean;
    };

    const fetchSummary = async () => {
        setLoading(true);
        try {
            const resource = type === 'campaign' ? 'campaigns' : 'flows';
            const baseQuery = `id=${id}${stepId ? `&step_id=${stepId}` : ''}${deviceFilter !== 'all' ? `&device=${deviceFilter}` : ''}`;
            const summaryRes = await api.get<any>(`${resource}?route=click_summary&${baseQuery}`);
            if (summaryRes.success) {
                // Support both new object format and legacy array format (just in case)
                let linksData = [];
                let globalUnique = 0;

                if (Array.isArray(summaryRes.data)) {
                    linksData = summaryRes.data;
                    // Legacy fallback: sum unique clicks of all links (not accurate but fallback)
                    globalUnique = linksData.reduce((acc: number, curr: any) => acc + (parseInt(curr.unique_clicks) || 0), 0);
                } else {
                    linksData = summaryRes.data.links || [];
                    globalUnique = summaryRes.data.overall?.unique_clicks || 0;
                }

                const mergedMap = new Map<string, { url: string; total_clicks: number; unique_clicks: number }>();
                linksData.forEach((item: any) => {
                    const url = cleanTrackedUrl(item.url || item.details || '');
                    if (!url) return;
                    const total = parseInt(item.total_clicks) || 0;
                    const unique = parseInt(item.unique_clicks) || 0;
                    const existing = mergedMap.get(url);
                    if (existing) {
                        existing.total_clicks += total;
                        existing.unique_clicks += unique;
                    } else {
                        mergedMap.set(url, { url, total_clicks: total, unique_clicks: unique });
                    }
                });
                const mapped = Array.from(mergedMap.values()).sort((a, b) => b.total_clicks - a.total_clicks);
                setLinks(mapped);
                setUniqueUserClicks(globalUnique);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const fetchHtml = async () => {
        if (html) return;
        setLoadingHtml(true);
        try {
            const endpoint = type === 'campaign' ? 'campaign_preview' : 'flow_preview';
            const params = type === 'campaign' ? `campaign_id=${id}` : `flow_id=${id}&step_id=${stepId}`;
            const res = await api.get<any>(`${endpoint}?${params}`);
            if (res.success) {
                setHtml(res.data.html);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingHtml(false);
        }
    };

    const fetchDetails = async () => {
        if (viewMode === 'heatmap') return;
        setLoadingDetails(true);
        try {
            if (type === 'flow') {
                const baseQuery = `id=${id}${stepId ? `&step_id=${stepId}` : ''}`;
                // User requested to use 'participants' route for better tech stats
                const detailsRes = await api.get<any>(`flows?route=participants&type=clicks&${baseQuery}&page=${page}&limit=20&search=${searchTerm}&link=${encodeURIComponent(selectedLink)}`);
                if (detailsRes.success) {
                    // Map 'participants' format to 'clicks' format expected by UI
                    const mappedClicks = detailsRes.data.data.map((p: any) => ({
                        email: p.email,
                        first_name: p.name, // Map name to first_name for display
                        last_name: '',
                        url: cleanTrackedUrl(p.url || p.details || ''),
                        device_type: p.device, // Map device -> device_type
                        os: p.os,
                        location: p.location,
                        ip_address: p.ip, // Map ip -> ip_address
                        created_at: p.enteredAt // Map enteredAt -> created_at
                    }));
                    setClicks(mappedClicks);
                    setTotalPages(detailsRes.data.pagination.totalPages);
                    setTotalClicks(detailsRes.data.pagination.total);
                }
            } else {
                const resource = 'campaigns';
                const baseQuery = `id=${id}`;
                const detailsRes = await api.get<any>(`${resource}?route=click_details&${baseQuery}&page=${page}&search=${searchTerm}&link=${encodeURIComponent(selectedLink)}`);
                if (detailsRes.success) {
                    const mappedClicks = (detailsRes.data.clicks || []).map((c: any) => ({
                        ...c,
                        url: cleanTrackedUrl(c.url || c.details || '')
                    }));
                    setClicks(mappedClicks);
                    setTotalPages(detailsRes.data.pagination.totalPages);
                    setTotalClicks(detailsRes.data.pagination.total);
                }
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingDetails(false);
        }
    };

    useEffect(() => {
        fetchSummary();
        if (viewMode === 'heatmap') fetchHtml();
    }, [id, stepId, viewMode, deviceFilter]);

    // Consolidate fetchDetails into one effect to prevent duplicates
    useEffect(() => {
        // Debounce search
        const timer = setTimeout(() => {
            fetchDetails();
        }, searchTerm ? 500 : 0); // Immediate if no search term (mount/link change)

        return () => clearTimeout(timer);
    }, [id, stepId, selectedLink, page, searchTerm, viewMode]);

    // Click outside dropdown to close
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const formatTime = (iso: string) => {
        if (!iso) return '--';
        return new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    };

    const truncateUrl = (url: string, maxLength: number = 30) => {
        if (!url) return '';
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength) + '...';
    };

    const totalUniqueLinks = links.length;
    const totalAllClicks = links.reduce((acc, curr) => acc + (curr.total_clicks || 0), 0);

    const getSelectedLinkLabel = () => {
        if (!selectedLink) return `Tất cả Link (${totalAllClicks})`;
        const link = links.find(l => l.url === selectedLink);
        return link ? `${truncateUrl(link.url, 25)} (${link.total_clicks})` : 'Selected Link';
    };

    return (
        <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Top Stats Cards & View Toggle */}
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                <div className="grid grid-cols-2 gap-4 flex-1 w-full md:w-auto md:max-w-md">
                    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
                        <div className="w-12 h-12 bg-white text-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                            <MousePointerClick className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Tổng lượt Click</p>
                            <h4 className="text-2xl font-black text-slate-800 tracking-tight">{totalAllClicks.toLocaleString()}</h4>
                        </div>
                    </div>
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-100 p-4 rounded-2xl flex items-center gap-4 shadow-sm">
                        <div className="w-12 h-12 bg-white text-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                            <ExternalLink className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Unique User Click</p>
                            <h4 className="text-2xl font-black text-slate-800 tracking-tight">{uniqueUserClicks.toLocaleString()}</h4>
                        </div>
                    </div>
                </div>

                {/* View Mode Switcher */}
                <div className="bg-slate-100 p-1 rounded-2xl flex items-center shadow-inner">
                    <button
                        onClick={() => setViewMode('list')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <LayoutGrid className="w-4 h-4" /> Danh sách
                    </button>
                    <button
                        onClick={() => setViewMode('heatmap')}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${viewMode === 'heatmap' ? 'bg-blue-600 text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Flame className="w-4 h-4" /> Click Heatmap
                    </button>
                </div>
            </div>

            {viewMode === 'heatmap' ? (
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden animate-in zoom-in-95 fade-in duration-500">
                    {loadingHtml ? (
                        <div className="py-40 flex flex-col items-center justify-center gap-4 text-slate-400">
                            <RefreshCw className="w-10 h-10 animate-spin text-blue-500" />
                            <p className="text-xs font-black uppercase tracking-widest">Đang tải bản đồ nhiệt...</p>
                        </div>
                    ) : (
                        <ClickHeatmap
                            html={html}
                            clickData={links}
                            deviceFilter={deviceFilter}
                            onDeviceFilterChange={(filter) => setDeviceFilter(filter)}
                        />
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6 h-[600px] animate-in slide-in-from-bottom-4 duration-500">
                    {/* Full Width Log Table */}
                    <div className="flex flex-col gap-3 h-full">
                        <div className="flex items-center justify-between shrink-0 gap-4 flex-wrap">
                            <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                                <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 whitespace-nowrap">
                                    <User className="w-4 h-4 text-blue-500" />
                                    Chi tiết Click
                                </h4>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Custom Dropdown */}
                                <div className="relative" ref={dropdownRef}>
                                    <button
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className="flex items-center gap-2 pl-3 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm min-w-[200px] justify-between"
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span className="truncate max-w-[180px]">{getSelectedLinkLabel()}</span>
                                        </div>
                                        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isDropdownOpen && (
                                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1">
                                                <button
                                                    onClick={() => { setSelectedLink(''); setPage(1); setIsDropdownOpen(false); }}
                                                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between group transition-colors ${!selectedLink ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                                >
                                                    <span>Tất cả Link ({totalAllClicks})</span>
                                                    {!selectedLink && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                                </button>
                                                <div className="h-px bg-slate-100 my-1 mx-2" />
                                                {links.map((l, i) => (
                                                    <button
                                                        key={i}
                                                        onClick={() => { setSelectedLink(l.url); setPage(1); setIsDropdownOpen(false); }}
                                                        className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium flex items-center justify-between group transition-colors ${selectedLink === l.url ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                                    >
                                                        <span className="truncate pr-4" title={l.url}>{truncateUrl(l.url, 35)}</span>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[10px] font-bold group-hover:bg-white group-hover:shadow-sm transition-all">{l.total_clicks}</span>
                                                            {selectedLink === l.url && <Check className="w-3.5 h-3.5 text-blue-600" />}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="relative w-56">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Tìm kiếm Khách hàng..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-slate-50/80 sticky top-0 backdrop-blur-sm z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 w-48">User Info</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 w-32">Link</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 text-center w-20">Device</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 text-center w-20">OS</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 w-28">City</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100 text-right w-28">IP</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {loadingDetails ? (
                                            <tr><td colSpan={6} className="py-20 text-center"><RefreshCw className="w-6 h-6 text-blue-500 animate-spin mx-auto" /></td></tr>
                                        ) : clicks.length === 0 ? (
                                            <tr><td colSpan={6} className="py-20 text-center text-xs font-bold text-slate-400 uppercase">Không tìm thấy dữ liệu</td></tr>
                                        ) : (
                                            clicks.map((c, i) => (
                                                <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase shrink-0">
                                                                {c.email.substring(0, 2)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="text-xs font-bold text-slate-700 group-hover:text-blue-600 transition-colors truncate">
                                                                    {c.email}
                                                                </div>
                                                                <div className="text-[10px] font-medium text-slate-400 truncate">
                                                                    {(c.first_name || c.last_name) ? `${c.first_name} ${c.last_name}` : ''}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 align-middle">
                                                        <div className="flex items-center gap-2 max-w-full group/link relative">
                                                            <div className="shrink-0 text-slate-300">
                                                                <ExternalLink className="w-3 h-3" />
                                                            </div>
                                                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-slate-600 hover:text-blue-600 hover:underline truncate block max-w-[150px]" title={c.url}>
                                                                {truncateUrl(c.url, 20)}
                                                            </a>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-slate-500 border border-slate-100">
                                                            {c.device_type === 'mobile' ? <Smartphone className="w-4 h-4" /> :
                                                                c.device_type === 'tablet' ? <Monitor className="w-4 h-4" /> : // Tablet icon fallback
                                                                    <Monitor className="w-4 h-4" />}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="text-[10px] font-bold text-slate-600 px-2 py-1 bg-slate-50 rounded-md border border-slate-100 whitespace-nowrap">
                                                            {c.os || 'Unknown'}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <MapPin className="w-3 h-3 text-slate-300 shrink-0" />
                                                            <span className="text-[11px] font-medium text-slate-600 truncate" title={c.location}>{c.location || 'Unknown'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="text-[11px] font-mono font-bold text-slate-500">{c.ip_address || '--'}</div>
                                                        <div className="text-[9px] font-medium text-slate-400">{formatTime(c.created_at)}</div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Footer */}
                            {totalPages > 1 && (
                                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between shrink-0">
                                    <button
                                        disabled={page <= 1}
                                        onClick={() => setPage(page - 1)}
                                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
                                    >
                                        Prev
                                    </button>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                        Page {page} / {totalPages}
                                    </span>
                                    <button
                                        disabled={page >= totalPages}
                                        onClick={() => setPage(page + 1)}
                                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LinkClicksTab;
