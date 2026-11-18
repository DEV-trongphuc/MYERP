import * as React from 'react';
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { MousePointerClick, Users, Clock, ArrowUpRight, Globe } from 'lucide-react';
import axios from 'axios';
import Select from '../common/Select';
import { API_BASE_URL } from '../../utils/config';



interface WebReportProps {
    dateRange: { start: string; end: string };
}

const WebJourneyReport: React.FC<WebReportProps> = ({ dateRange }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [propertyId, setPropertyId] = useState<string>(''); // Needs to be fetched or passed

    const [properties, setProperties] = useState<any[]>([]);

    // Auto-fetch first property ID for now (Assuming single property context or first one)
    useEffect(() => {
        const fetchProperties = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/web_tracking.php?action=list`);
                if (res.data.success && res.data.data.length > 0) {
                    setProperties(res.data.data);
                    setPropertyId(res.data.data[0].id);
                }
            } catch (e) { console.error(e); }
        };
        fetchProperties();
    }, []);

    useEffect(() => {
        fetchData();
    }, [propertyId, dateRange]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/web_tracking.php?action=stats&id=${propertyId}&start_date=${dateRange.start}&end_date=${dateRange.end}`);
            if (res.data.success) setData(res.data.data);
        } catch (error) {
            console.error("Failed to fetch Web report", error);
        } finally {
            setLoading(false);
        }
    };

    const overview = data?.overview || {};

    const stats = [
        { label: 'Người truy cập', value: overview.visitors || 0, icon: Users, color: 'text-[#BD1D2D]', bg: 'bg-[#fef2f2]' },
        { label: 'Phiên truy cập', value: overview.sessions || 0, icon: ArrowUpRight, color: 'text-[#BD1D2D]', bg: 'bg-[#fef2f2]' },
        { label: 'Lượt xem trang', value: overview.pageViews || 0, icon: MousePointerClick, color: 'text-slate-700', bg: 'bg-slate-100' },
        { label: 'Thời gian TB', value: overview.avgDuration ? `${Math.round(overview.avgDuration)}s` : '0s', icon: Clock, color: 'text-slate-700', bg: 'bg-slate-100' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Filters Row */}
            <div className="bg-slate-50/50 p-6 rounded-[18px] border border-slate-100 flex flex-wrap items-center gap-6">
                <div className="shrink-0 min-w-[250px]">
                    <Select
                        value={propertyId}
                        onChange={(val) => setPropertyId(val)}
                        options={[
                            { value: '', label: 'Tất cả Website' },
                            ...properties.map(p => ({
                                value: p.id,
                                label: (
                                    <div className="flex items-center gap-2">
                                        <Globe className="w-4 h-4 text-slate-400" />
                                        <span>{p.domain || p.name}</span>
                                    </div>
                                ),
                                searchLabel: p.domain || p.name
                            }))
                        ]}
                    />
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                        <div className="space-y-1.5 w-full">
                            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{stat.label}</h4>
                            {loading ? (
                                <div className="h-7 w-24 bg-slate-200 rounded animate-pulse mt-1"></div>
                            ) : (
                                <div className={`text-2xl font-bold tracking-tight tabular-nums ${idx === 1 ? 'text-[#BD1D2D]' : 'text-slate-900'}`}>{typeof stat.value === 'number' ? stat.value.toLocaleString('vi-VN') : stat.value}</div>
                            )}
                        </div>
                        <div className={`w-9 h-9 ${stat.bg} rounded-lg flex items-center justify-center shrink-0`}>
                            <stat.icon className={`w-4 h-4 ${stat.color}`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Traffic Trend */}
                <div className="lg:col-span-2 bg-white p-5 lg:p-6 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Lưu lượng truy cập</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Số phiên &amp; lượt xem trang theo ngày</p>
                        </div>
                    </div>
                    <div className="h-[250px] lg:h-[300px]">
                        {loading ? (
                            <div className="w-full h-full flex items-end gap-3 p-4 animate-pulse">
                                {[...Array(14)].map((_, i) => (
                                    <div key={i} className="flex-1 bg-slate-100 rounded-t-lg" style={{ height: `${((i * 19) % 60) + 20}%` }}></div>
                                ))}
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data?.chart || []} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#C6333D" stopOpacity={0.16} />
                                            <stop offset="95%" stopColor="#C6333D" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} dy={8} tickFormatter={(val) => val.split('-').slice(1).reverse().join('/')} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
                                    <Tooltip contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', padding: '10px 14px', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }} />
                                    <Area type="monotone" dataKey="sessions" name="Phiên" stroke="#C6333D" strokeWidth={2.25} fill="url(#colorSessions)" />
                                    <Area type="monotone" dataKey="pageViews" name="Xem trang" stroke="#334155" strokeWidth={2.25} fill="none" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Top Sources */}
                <div className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-200 shadow-xs">
                    <div className="mb-5">
                        <h3 className="text-base font-bold text-slate-900">Nguồn truy cập</h3>
                    </div>
                    <div className="space-y-4">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="flex items-center justify-between py-1 animate-pulse">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100"></div>
                                        <div className="space-y-2">
                                            <div className="h-3 w-16 bg-slate-100 rounded"></div>
                                            <div className="h-2 w-10 bg-slate-100 rounded"></div>
                                        </div>
                                    </div>
                                    <div className="h-4 w-8 bg-slate-100 rounded"></div>
                                </div>
                            ))
                        ) : (
                            data?.trafficSources?.slice(0, 5).map((source: any, i: number) => (
                                <div key={i} className="flex items-center justify-between py-1">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-500">#{i + 1}</div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-700">{source.source}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase">{source.medium}</div>
                                        </div>
                                    </div>
                                    <div className="text-xs font-bold text-slate-900 tabular-nums">{source.sessions.toLocaleString('vi-VN')}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Top Pages Table */}
            <div className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-200 shadow-xs">
                <h3 className="text-base font-bold text-slate-900 mb-5">Trang phổ biến nhất</h3>
                <div className="overflow-x-auto -mx-5 lg:-mx-0">
                    <div className="inline-block min-w-full align-middle px-5 lg:px-0">
                        <table className="w-full text-left tabular-nums">
                            <thead>
                                <tr className="border-b border-slate-200">
                                    <th className="pb-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider min-w-[200px]">Trang &amp; URL</th>
                                    <th className="pb-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Xem trang</th>
                                    <th className="pb-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">TG TB</th>
                                    <th className="pb-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-right">Bounce</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    [...Array(5)].map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td className="py-4 pr-4">
                                                <div className="h-4 w-32 bg-slate-100 rounded mb-2"></div>
                                                <div className="h-3 w-48 bg-slate-100 rounded"></div>
                                            </td>
                                            <td className="py-4 text-right"><div className="h-4 w-12 bg-slate-100 rounded ml-auto"></div></td>
                                            <td className="py-4 text-right"><div className="h-4 w-10 bg-slate-100 rounded ml-auto"></div></td>
                                            <td className="py-4 text-right"><div className="h-4 w-12 bg-slate-100 rounded ml-auto"></div></td>
                                        </tr>
                                    ))
                                ) : (
                                    data?.topPages?.slice(0, 10).map((page: any, i: number) => (
                                        <tr key={i} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 pr-4">
                                                <div className="font-bold text-[11px] lg:text-xs text-slate-700 truncate max-w-[180px] lg:max-w-[300px]">{page.title || 'Untitled'}</div>
                                                <div className="text-[9px] lg:text-[10px] text-slate-400 truncate max-w-[180px] lg:max-w-[300px]">{page.url}</div>
                                            </td>
                                            <td className="py-4 text-right text-[11px] lg:text-xs font-bold text-slate-700">{page.count.toLocaleString()}</td>
                                            <td className="py-4 text-right text-[11px] lg:text-xs font-bold text-slate-500">{Math.round(page.avgTime)}s</td>
                                            <td className="py-4 text-right">
                                                <span className={`px-2 py-0.5 lg:py-1 rounded-lg text-[9px] lg:text-[10px] font-bold ${Number(page.bounceRate) > 70 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                    {Number(page.bounceRate || 0).toFixed(1)}%
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WebJourneyReport;
