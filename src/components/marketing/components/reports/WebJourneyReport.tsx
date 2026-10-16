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
        { label: 'NB. TRUY CẬP (USERS)', value: overview.visitors || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'PHIÊN (SESSIONS)', value: overview.sessions || 0, icon: ArrowUpRight, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'XEM TRANG (VIEWS)', value: overview.pageViews || 0, icon: MousePointerClick, color: 'text-orange-600', bg: 'bg-orange-50' },
        { label: 'Thời gian TB', value: overview.avgDuration ? `${Math.round(overview.avgDuration)}s` : '0s', icon: Clock, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Filters Row */}
            <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 flex flex-wrap items-center gap-6">
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                {stats.map((stat, idx) => (
                    <div key={idx} className="bg-white rounded-2xl lg:rounded-[32px] p-4 lg:p-6 border border-slate-100 shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 group hover:shadow-md transition-all">
                        <div className="space-y-1 w-full">
                            <h4 className="text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</h4>
                            {loading ? (
                                <div className="h-8 w-24 bg-slate-200 rounded animate-pulse mt-1"></div>
                            ) : (
                                <div className="text-xl lg:text-3xl font-black text-slate-800 tracking-tight">{stat.value.toLocaleString()}</div>
                            )}
                        </div>
                        <div className={`w-10 h-10 lg:w-14 lg:h-14 ${stat.bg} rounded-xl lg:rounded-2xl flex items-center justify-center shrink-0`}>
                            <stat.icon className={`w-5 h-5 lg:w-6 lg:h-6 ${stat.color}`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Traffic Trend */}
                <div className="lg:col-span-2 bg-white p-5 lg:p-8 rounded-2xl lg:rounded-[40px] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-sm lg:text-base font-black text-slate-800 uppercase tracking-tight">Lưu lượng truy cập</h3>
                            <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sessions & Views</p>
                        </div>
                    </div>
                    <div className="h-[250px] lg:h-[300px]">
                        {loading ? (
                            <div className="w-full h-full flex items-end gap-3 p-4 animate-pulse">
                                {[...Array(14)].map((_, i) => (
                                    <div key={i} className="flex-1 bg-slate-100 rounded-t-lg" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
                                ))}
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data?.chart || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorSessions" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} tickFormatter={(val) => val.split('-').slice(1).reverse().join('/')} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                                    <Tooltip contentStyle={{ border: 'none', borderRadius: '24px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '16px' }} />
                                    <Area type="monotone" dataKey="sessions" name="Phiên" stroke="#3b82f6" strokeWidth={3} fill="url(#colorSessions)" />
                                    <Area type="monotone" dataKey="pageViews" name="Xem trang" stroke="#7c3aed" strokeWidth={3} fill="none" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Top Sources */}
                <div className="bg-white p-5 lg:p-8 rounded-2xl lg:rounded-[40px] border border-slate-100 shadow-sm">
                    <div className="mb-6">
                        <h3 className="text-sm lg:text-base font-black text-slate-800 uppercase tracking-tight">Nguồn truy cập</h3>
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
                                    <div className="text-xs font-black text-slate-800">{source.sessions.toLocaleString()}</div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Top Pages Table */}
            <div className="bg-white p-5 lg:p-8 rounded-2xl lg:rounded-[40px] border border-slate-100 shadow-sm">
                <h3 className="text-sm lg:text-base font-black text-slate-800 uppercase tracking-tight mb-6">Trang phổ biến nhất</h3>
                <div className="overflow-x-auto -mx-5 lg:-mx-0">
                    <div className="inline-block min-w-full align-middle px-5 lg:px-0">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-slate-100">
                                    <th className="pb-4 text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest min-w-[200px]">Trang & URL</th>
                                    <th className="pb-4 text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Xem trang</th>
                                    <th className="pb-4 text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">TG TB</th>
                                    <th className="pb-4 text-[9px] lg:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Bounce</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
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
