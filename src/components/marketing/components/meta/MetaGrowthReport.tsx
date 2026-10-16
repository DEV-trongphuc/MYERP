import * as React from 'react';
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, MessageSquare, Zap, RefreshCw, Users, MessageSquareDashed } from 'lucide-react';
import axios from 'axios';
import Select from '../common/Select';
import { API_BASE_URL } from '../../utils/config';

// Interfaces matching Zalo Report Data Structure
interface ReportData {
    date: string;
    label: string;
    new_followers: number;
    non_follower_interactions: number;
    total_followers: number;
    automation: number;
}

interface MetaConfig {
    id: string;
    page_name: string;
    avatar_url?: string;
}



interface MetaReportProps {
    dateRange?: { start: string; end: string };
}

const MetaGrowthReport: React.FC<MetaReportProps> = ({ dateRange }) => {
    const [period, setPeriod] = useState<'month' | 'day'>('month');
    const [selectedConfigId, setSelectedConfigId] = useState<string>('');
    const [configs, setConfigs] = useState<MetaConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<ReportData[]>([]);

    useEffect(() => {
        fetchConfigs();
    }, []);

    useEffect(() => {
        if (selectedConfigId) {
            fetchReport();
        }
    }, [selectedConfigId, dateRange]);

    const fetchConfigs = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/meta_config.php`);
            if (res.data.success && res.data.data.length > 0) {
                setConfigs(res.data.data);
                setSelectedConfigId(res.data.data[0].id);
            }
        } catch (error) {
            console.error("Failed to fetch Configs", error);
        }
    };

    const [summary, setSummary] = useState<any>({});

    const fetchReport = async () => {
        setLoading(true);
        const activeStart = dateRange?.start || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
        const activeEnd = dateRange?.end || new Date().toISOString().split('T')[0];
        const activePeriod = dateRange ? 'day' : period;

        try {
            // Using refined API endpoint that mirrors Zalo structure
            const res = await axios.get(`${API_BASE_URL}/meta_report.php?period=${activePeriod}&meta_config_id=${selectedConfigId}&start_date=${activeStart}&end_date=${activeEnd}`);
            if (res.data.success) {
                setData(res.data.data);
                setSummary(res.data.summary || {});
            }
        } catch (error) {
            console.error("Failed to fetch Meta report", error);
        } finally {
            setLoading(false);
        }
    };

    const stats = [
        { label: 'TỔNG CHAT', value: summary.total_chat || 0, icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-600/10', iconBg: 'bg-indigo-500' },
        { label: 'CÓ THÔNG TIN LEAD', value: summary.has_lead || 0, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-600/10', iconBg: 'bg-emerald-500' },
        { label: 'CHƯA CÓ THÔNG TIN', value: summary.no_lead || 0, icon: MessageSquareDashed, color: 'text-slate-600', bg: 'bg-slate-600/10', iconBg: 'bg-slate-500' },
        { label: 'KÍCH HOẠT AUTOMATION', value: summary.automation || 0, icon: Zap, color: 'text-orange-600', bg: 'bg-orange-600/10', iconBg: 'bg-orange-500' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Filters Row */}
            <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 flex flex-wrap items-center gap-6">

                <div className="shrink-0 min-w-[250px]">
                    <Select
                        value={selectedConfigId}
                        onChange={(val) => setSelectedConfigId(val)}
                        options={[
                            { value: '', label: 'Tất cả Meta Page' },
                            ...configs.map(c => ({
                                value: c.id,
                                label: (
                                    <div className="flex items-center gap-2">
                                        {c.avatar_url ? <img src={c.avatar_url} className="w-4 h-4 rounded-full object-cover" /> : <Users className="w-4 h-4 text-slate-400" />}
                                        <span>{c.page_name}</span>
                                    </div>
                                ),
                                searchLabel: c.page_name
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
                    <div key={idx} className="bg-white rounded-[32px] p-6 border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                        <div className="space-y-1 w-full">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</h4>
                            {loading ? (
                                <div className="h-8 w-24 bg-slate-200 rounded animate-pulse mt-1"></div>
                            ) : (
                                <div className="text-3xl font-black text-slate-800 tracking-tight">{stat.value.toLocaleString()}</div>
                            )}
                        </div>
                        <div className={`w-14 h-14 ${stat.iconBg} rounded-2xl flex items-center justify-center shadow-lg shadow-black/5 shrink-0`}>
                            <stat.icon className="w-6 h-6 text-white" />
                        </div>
                    </div>
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
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Khách chưa nhắn quan tâm nhưng có nhắn tin</p>
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
                                    <Area type="monotone" dataKey="automation" name="Kích hoạt" stroke="#f97316" strokeWidth={4} fill="none" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MetaGrowthReport;
