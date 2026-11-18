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
        { label: 'Tổng hội thoại', value: summary?.total_conversations || 0, icon: MessageSquare, color: 'text-[#BD1D2D]', bg: 'bg-[#fef2f2]' },
        { label: 'AI trả lời', value: summary?.ai_replies || 0, icon: Bot, color: 'text-[#BD1D2D]', bg: 'bg-[#fef2f2]' },
        { label: 'Chuyển nhân sự', value: summary?.human_handovers || 0, icon: User, color: 'text-slate-700', bg: 'bg-slate-100' },
        { label: 'Tỷ lệ tự động hóa', value: summary ? ((summary.ai_replies / (summary.ai_replies + summary.human_handovers + 1)) * 100).toFixed(1) + '%' : '0%', icon: Zap, color: 'text-slate-700', bg: 'bg-slate-100' },
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
            <div className="bg-slate-50/50 p-6 rounded-[18px] border border-slate-100 flex flex-wrap items-center gap-6">
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

            {/* Main Chart */}
            <div className="bg-white p-5 lg:p-6 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Xu hướng tương tác AI Chat</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Tin nhắn theo ngày trong kỳ</p>
                    </div>
                    <Bot className="w-5 h-5 text-[#BD1D2D]" />
                </div>
                <div className="h-[250px] lg:h-[320px]">
                    {loading ? (
                        <div className="w-full h-full flex items-end gap-3 p-4 animate-pulse">
                            {[...Array(14)].map((_, i) => (
                                <div key={i} className="flex-1 bg-slate-100 rounded-t-lg" style={{ height: `${((i * 17) % 60) + 20}%` }}></div>
                            ))}
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={dataWithTotal} margin={{ top: 10, right: 10, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} dy={8} tickFormatter={(val) => val ? val.split('-').slice(1).reverse().join('/') : ''} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }} />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(15, 23, 42, 0.04)' }}
                                    contentStyle={{ border: '1px solid #e2e8f0', borderRadius: '10px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)', padding: '10px 14px', fontVariantNumeric: 'tabular-nums', fontSize: '12px' }}
                                    formatter={(val: number) => [`${val.toLocaleString('vi-VN')} tin nhắn`, 'Tổng tương tác']}
                                />
                                <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={36}>
                                    {dataWithTotal.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.total === maxTotal && maxTotal > 0 ? '#C6333D' : '#334155'} />
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
