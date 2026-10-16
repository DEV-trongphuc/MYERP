import * as React from 'react';
import { useState, useEffect } from 'react';
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Bot, MessageSquare, User, Zap } from 'lucide-react';
import axios from 'axios';
import Select from '../common/Select';
import { API_BASE_URL } from '../../utils/config';

interface AIReportProps {
    dateRange: { start: string; end: string };
}

const AIChatReport: React.FC<AIReportProps> = ({ dateRange }) => {
    const [summary, setSummary] = useState<any>(null);
    const [chartData, setChartData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [properties, setProperties] = useState<any[]>([]);
    const [propertyId, setPropertyId] = useState<string>('');

    useEffect(() => {
        const fetchProperties = async () => {
            try {
                // Fetch domains/properties from web_tracking (since AI widget uses property_id)
                const res = await axios.get(`${API_BASE_URL}/web_tracking.php?action=list`);
                if (res.data.success) {
                    setProperties(res.data.data);
                    if (res.data.data.length > 0) {
                        setPropertyId(res.data.data[0].id);
                    }
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
            const [summaryRes, chartRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/ai_report.php?action=summary&start_date=${dateRange.start}&end_date=${dateRange.end}&property_id=${propertyId}`),
                axios.get(`${API_BASE_URL}/ai_report.php?action=chart&period=day&start_date=${dateRange.start}&end_date=${dateRange.end}&property_id=${propertyId}`)
            ]);

            if (summaryRes.data.success) setSummary(summaryRes.data.data);
            if (chartRes.data.success) setChartData(chartRes.data.data);
        } catch (error) {
            console.error("Failed to fetch AI report", error);
        } finally {
            setLoading(false);
        }
    };

    const stats = [
        { label: 'TỔNG HỘI THOẠI', value: summary?.total_conversations || 0, icon: MessageSquare, color: 'text-indigo-600', bg: 'bg-indigo-50' },
        { label: 'AI TRẢ LỜI', value: summary?.ai_replies || 0, icon: Bot, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'CHUYỂN HUMAN', value: summary?.human_handovers || 0, icon: User, color: 'text-amber-600', bg: 'bg-amber-50' },
        { label: 'TỰ ĐỘNG HÓA', value: summary ? ((summary.ai_replies / (summary.ai_replies + summary.human_handovers + 1)) * 100).toFixed(1) + '%' : '0%', icon: Zap, color: 'text-rose-600', bg: 'bg-rose-50' },
    ];

    const generateDateRange = (start: string, end: string) => {
        const dates = [];
        let current = new Date(start);
        const last = new Date(end);
        while (current <= last) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }
        return dates;
    };

    const allDates = generateDateRange(dateRange.start, dateRange.end);
    const dataWithTotal = allDates.map(date => {
        const existing = chartData.find(d => d.date === date);
        return {
            date,
            total: existing ? Number(existing.ai_count || 0) + Number(existing.visitor_count || 0) : 0
        };
    });
    const maxTotal = dataWithTotal.length > 0 ? Math.max(...dataWithTotal.map(d => d.total)) : 0;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Filters Row */}
            <div className="bg-slate-50/50 p-6 rounded-[32px] border border-slate-100 flex flex-wrap items-center gap-6">
                <div className="shrink-0 min-w-[250px]">
                    <Select
                        value={propertyId}
                        onChange={(val) => setPropertyId(val)}
                        options={[
                            { value: '', label: 'Tất cả Chatbot / Kênh AI' },
                            ...properties.map(p => ({
                                value: p.id,
                                label: (
                                    <div className="flex items-center gap-2">
                                        <Bot className="w-4 h-4 text-slate-400" />
                                        <span>{p.domain || p.name || 'Chatbot ' + p.id}</span>
                                    </div>
                                ),
                                searchLabel: p.domain || p.name || `Chatbot ${p.id}`
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

            {/* Main Chart */}
            <div className="bg-white p-5 lg:p-8 rounded-2xl lg:rounded-[40px] border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h3 className="text-sm lg:text-base font-black text-slate-800 uppercase tracking-tight">Xu hướng Chat AI</h3>
                        <p className="text-[9px] lg:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Tin nhắn theo Thời gian</p>
                    </div>
                    <Bot className="w-5 h-5 lg:w-6 lg:h-6 text-emerald-500 opacity-20" />
                </div>
                <div className="h-[250px] lg:h-[350px]">
                    {loading ? (
                        <div className="w-full h-full flex items-end gap-3 p-4 animate-pulse">
                            {[...Array(14)].map((_, i) => (
                                <div key={i} className="flex-1 bg-slate-100 rounded-t-lg" style={{ height: `${Math.random() * 60 + 20}%` }}></div>
                            ))}
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dataWithTotal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorYellowAi" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                    </linearGradient>
                                    <linearGradient id="colorRedAi" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#ec4899" stopOpacity={0.9} />
                                        <stop offset="100%" stopColor="#ec4899" stopOpacity={0.3} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} dy={10} tickFormatter={(val) => val ? val.split('-').slice(1).reverse().join('/') : ''} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 700 }} />
                                <Tooltip 
                                    contentStyle={{ border: 'none', borderRadius: '24px', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.1)', padding: '16px' }}
                                    formatter={(val: number) => [`${val} tin nhắn`, 'Tổng tương tác']}
                                />
                                <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={40}>
                                    {dataWithTotal.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.total === maxTotal && maxTotal > 0 ? 'url(#colorRedAi)' : 'url(#colorYellowAi)'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AIChatReport;
