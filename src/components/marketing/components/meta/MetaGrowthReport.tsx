import * as React from 'react';
import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, MessageSquare, Zap, RefreshCw, Users, MessageSquareDashed } from 'lucide-react';
import axios from 'axios';
import Select from '../common/Select';
import StatCard from '../common/StatCard';
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
        { label: 'KÍCH HOẠT AUTOMATION', value: summary.automation || 0, icon: Zap, color: 'text-[var(--color-primary)]', bg: 'bg-[var(--color-primary)]/10', iconBg: 'bg-[var(--color-primary)]' },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Filters Row */}
            <div className="bg-[var(--color-surface)] p-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] flex flex-wrap items-center gap-3 shadow-xs">
                <div className="shrink-0 min-w-[220px]">
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

                <button onClick={fetchReport} className="h-9 px-3 bg-[var(--color-surface)] hover:bg-[var(--color-bg-subtle)] rounded-[var(--radius-md)] border border-[var(--color-border)] shadow-xs transition-all group ml-auto flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
                    <RefreshCw className={`w-3.5 h-3.5 text-slate-400 group-hover:text-[var(--color-primary)] ${loading ? 'animate-spin' : ''}`} />
                    <span>Làm mới</span>
                </button>
            </div>

            {/* 4 StatCards in ONE row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    loading={loading}
                    title="Tổng cuộc chat"
                    value={(summary.total_chat || 0).toLocaleString('vi-VN')}
                    icon={<MessageSquare />}
                    color="#6366f1"
                    breakdown={<span>Tất cả tin nhắn Messenger</span>}
                />
                <StatCard
                    loading={loading}
                    title="Có thông tin Lead"
                    value={(summary.has_lead || 0).toLocaleString('vi-VN')}
                    icon={<Users />}
                    color="#10b981"
                    breakdown={<span>Đã có SĐT hoặc Email</span>}
                />
                <StatCard
                    loading={loading}
                    title="Chưa có thông tin"
                    value={(summary.no_lead || 0).toLocaleString('vi-VN')}
                    icon={<MessageSquareDashed />}
                    color="#64748b"
                    breakdown={<span>Khách vãng lai tương tác</span>}
                />
                <StatCard
                    loading={loading}
                    title="Kích hoạt Automation"
                    value={(summary.automation || 0).toLocaleString('vi-VN')}
                    icon={<Zap />}
                    color="#BD1D2D"
                    breakdown={<span>Lượt chạy kịch bản tự động</span>}
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-[var(--color-surface)] p-5 rounded-[18px] border border-[var(--color-border)] shadow-xs">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-sm font-bold text-[var(--color-text)]">Tăng trưởng & Quan tâm</h3>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Số lượng người quan tâm tích lũy</p>
                        </div>
                        <TrendingUp className="w-5 h-5 text-blue-500 opacity-40" />
                    </div>
                    <div className="h-[260px]">
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
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                    <Area type="monotone" dataKey="new_followers" name="Mới" stroke="#3b82f6" strokeWidth={2.5} fill="url(#colorNew)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="bg-[var(--color-surface)] p-5 rounded-[18px] border border-[var(--color-border)] shadow-xs">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-sm font-bold text-[var(--color-text)]">Tương tác khách lạ</h3>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Khách chưa nhắn quan tâm nhưng có nhắn tin</p>
                        </div>
                        <MessageSquare className="w-5 h-5 text-emerald-500 opacity-40" />
                    </div>
                    <div className="h-[260px]">
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
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                                    <Bar dataKey="non_follower_interactions" name="Tương tác" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2 bg-[var(--color-surface)] p-5 rounded-[18px] border border-[var(--color-border)] shadow-xs">
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h3 className="text-sm font-bold text-[var(--color-text)]">Vận hành Automation</h3>
                            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Số lượt kích hoạt kịch bản tự động</p>
                        </div>
                        <Zap className="w-5 h-5 text-[var(--color-primary)] opacity-40" />
                    </div>
                    <div className="h-[280px]">
                        {loading ? (
                            <div className="w-full h-full flex items-end gap-3 p-4 animate-pulse">
                                {[...Array(14)].map((_, i) => (
                                    <div key={i} className="flex-1 bg-slate-100 rounded-t-lg" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
                                ))}
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--color-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }} />
                                    <Area type="monotone" dataKey="automation" name="Kích hoạt" stroke="var(--color-primary)" strokeWidth={2.5} fillOpacity={0.08} fill="var(--color-primary)" />
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
