import * as React from 'react';
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, MessageSquare, Zap, Calendar, RefreshCw, ChevronDown, Users, Heart, MessageSquareDashed, Send } from 'lucide-react';
import { api } from '../../services/storageAdapter';
import Card from '../common/Card';
import Input from '../common/Input';
import Select from '../common/Select';
import TabTransition from '../common/TabTransition';
import StatCard from '../common/StatCard';

interface ReportData {
    date: string;
    label: string;
    new_followers: number;
    non_follower_interactions: number;
    total_followers: number;
    automation: number;
}

interface ZaloOA {
    id: string;
    name: string;
    avatar?: string;
}

interface ZaloReportProps {
    dateRange?: { start: string; end: string };
}

const ZaloReportTab: React.FC<ZaloReportProps> = ({ dateRange }) => {
    const [period, setPeriod] = useState<'month' | 'day'>('month');
    const [selectedOA, setSelectedOA] = useState<string>('');
    const [oas, setOas] = useState<ZaloOA[]>([]);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ReportData[]>([]);

    useEffect(() => { fetchOAs(); }, []);
    useEffect(() => { fetchReport(); }, [selectedOA, dateRange]);

    const fetchOAs = async () => {
        try {
            const res = await api.get<ZaloOA[]>('zalo_oa');
            if (res.success) setOas(res.data);
        } catch (error) { console.error("Failed to fetch OAs", error); }
    };

    const fetchReport = async () => {
        setLoading(true);
        // Fallback to month if dateRange is missing (e.g. standalone mode without UI)
        const activeStart = dateRange?.start || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
        const activeEnd = dateRange?.end || new Date().toISOString().split('T')[0];
        const activePeriod = dateRange ? 'day' : period;

        try {
            const res = await api.get<ReportData[]>(`zalo_report?period=${activePeriod}&oa_id=${selectedOA}&start_date=${activeStart}&end_date=${activeEnd}`);
            if (res.success) setData(res.data);
        } catch (error) { console.error("Failed to fetch Zalo report", error); }
        finally { setLoading(false); }
    };

    const totals = data.length > 0 ? {
        new_followers: data.reduce((acc, curr) => acc + curr.new_followers, 0),
        non_follower_interactions: data.reduce((acc, curr) => acc + curr.non_follower_interactions, 0),
        total_followers: data[data.length - 1].total_followers,
        automation: data.reduce((acc, curr) => acc + curr.automation, 0),
        sent_zns: data.reduce((acc, curr) => acc + (curr as any).sent_zns || 0, 0)
    } : { new_followers: 0, non_follower_interactions: 0, total_followers: 0, automation: 0, sent_zns: 0 };

    const stats = [
        { 
            label: 'THÀNH VIÊN MỚI', 
            value: totals.new_followers + totals.non_follower_interactions, 
            icon: <TrendingUp />, 
            color: '#6366f1',
            decor: (
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                    <circle cx="35" cy="45" r="15" fill="currentColor" fillOpacity="0.2" />
                    <circle cx="65" cy="45" r="15" fill="currentColor" fillOpacity="0.4" />
                    <circle cx="50" cy="70" r="18" fill="currentColor" fillOpacity="0.6" />
                </svg>
            )
        },
        { 
            label: 'QUAN TÂM', 
            value: totals.total_followers, 
            icon: <Heart />, 
            color: '#f43f5e',
            decor: (
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <circle cx="50" cy="50" r="38" stroke="currentColor" strokeWidth="2" />
                    <path d="M15 50 Q 35 15 50 50 T 85 50" stroke="currentColor" strokeWidth="2" strokeDasharray="6 6" />
                    <circle cx="50" cy="50" r="10" fill="currentColor" fillOpacity="0.3" />
                </svg>
            )
        },
        { 
            label: 'TIN NHẮN ZNS/ZBS', 
            value: totals.sent_zns, 
            icon: <Send />, 
            color: '#3b82f6',
            decor: (
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <rect x="15" y="15" width="70" height="70" rx="20" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" />
                    <circle cx="30" cy="30" r="12" fill="currentColor" fillOpacity="0.2" />
                    <circle cx="70" cy="70" r="16" fill="currentColor" fillOpacity="0.4" />
                </svg>
            )
        },
        { 
            label: 'KÍCH HOẠT AUTOMATION', 
            value: totals.automation, 
            icon: <Zap />, 
            color: '#8b5cf6',
            decor: (
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <path d="M50 10 L85 50 L50 90 L15 50 Z" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                    <circle cx="50" cy="30" r="10" fill="currentColor" fillOpacity="0.3" />
                    <circle cx="50" cy="70" r="10" fill="currentColor" fillOpacity="0.5" />
                </svg>
            )
        },
    ];

    return (

        <TabTransition className="space-y-8">
            {/* Filters Row */}
            <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 flex flex-wrap items-center gap-6">
                <div className="shrink-0 min-w-[250px]">
                    <Select
                        value={selectedOA}
                        onChange={(val) => setSelectedOA(val)}
                        options={[
                            { value: '', label: 'Tất cả Zalo OA' },
                            ...oas.map(oa => ({
                                value: oa.id,
                                label: (
                                    <div className="flex items-center gap-2">
                                        {oa.avatar && <img src={oa.avatar} className="w-4 h-4 rounded-full object-cover" />}
                                        <span>{oa.name}</span>
                                    </div>
                                ),
                                searchLabel: oa.name
                            }))
                        ]}
                    />
                </div>

                <button onClick={fetchReport} className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-100 shadow-sm transition-all group ml-auto">
                    <RefreshCw className={`w-5 h-5 text-slate-400 group-hover:text-indigo-600 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {/* Redesigned Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, idx) => (
                    <StatCard
                        key={idx}
                        title={stat.label}
                        value={stat.value}
                        icon={stat.icon}
                        color={stat.color}
                        decor={stat.decor}
                        loading={loading}
                    />
                ))}
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Tăng trưởng & Quan tâm</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Số lượng người quan tâm tích lũy</p>
                        </div>
                        <TrendingUp className="w-6 h-6 text-blue-500 opacity-20" />
                    </div>
                    <div className="h-[300px]">
                        {loading ? (
                            <div className="w-full h-full flex items-end gap-3 p-4 animate-pulse">
                                {[...Array(14)].map((_, i) => (
                                    <div key={i} className="flex-1 bg-slate-100 rounded-t-lg" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
                                ))}
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                                    <Tooltip contentStyle={{ border: 'none', borderRadius: '24px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '16px' }} />
                                    <Area type="monotone" dataKey="new_followers" name="Mới" stroke="#3b82f6" strokeWidth={4} fill="url(#colorNew)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Tương tác khách lạ</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Khách chưa nhấn quan tâm nhưng có nhắn tin</p>
                        </div>
                        <MessageSquare className="w-6 h-6 text-emerald-500 opacity-20" />
                    </div>
                    <div className="h-[300px]">
                        {loading ? (
                            <div className="w-full h-full flex items-end gap-3 p-4 animate-pulse">
                                {[...Array(14)].map((_, i) => (
                                    <div key={i} className="flex-1 bg-slate-100 rounded-t-lg" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
                                ))}
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                                    <Tooltip contentStyle={{ border: 'none', borderRadius: '24px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '16px' }} cursor={{ fill: '#f8fafc' }} />
                                    <Bar dataKey="non_follower_interactions" name="Tương tác" fill="#10b981" radius={[8, 8, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-tight">Vận hành Automation</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Số lượt kích hoạt kịch bản tự động</p>
                        </div>
                        <Zap className="w-6 h-6 text-orange-500 opacity-20" />
                    </div>
                    <div className="h-[350px]">
                        {loading ? (
                            <div className="w-full h-full flex items-end gap-3 p-4 animate-pulse">
                                {[...Array(14)].map((_, i) => (
                                    <div key={i} className="flex-1 bg-slate-100 rounded-t-lg" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
                                ))}
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                                    <Tooltip contentStyle={{ border: 'none', borderRadius: '24px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '16px' }} />
                                    <Area type="monotone" dataKey="automation" name="Kích hoạt" stroke="#7c3aed" strokeWidth={4} fill="none" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </TabTransition>
    );
};

export default ZaloReportTab;
