import * as React from 'react';
import { useEffect, useState } from 'react';
import { api } from '../../services/storageAdapter';
import Card from '../common/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Smartphone, Monitor, Globe, Laptop, MapPin, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import TabTransition from '../common/TabTransition';

interface TechStatItem {
    name: string;
    value: number;
}

interface TechStatsData {
    device?: TechStatItem[];
    os?: TechStatItem[];
    location?: TechStatItem[];
}

interface TechStatsTabProps {
    type?: 'campaign' | 'flow';
    id: string; // campaignId or flowId
    stepId?: string;
    isZns?: boolean;
}

const COLORS = ['#3b82f6', '#10b981', '#BD1D2D', '#06b6d4', '#6366f1']; // Blue, Green, Amber, Cyan, Indigo

const TechStatsTab: React.FC<TechStatsTabProps> = ({ type = 'campaign', id, stepId, isZns = false }) => {
    const { can } = useAuth();
    const canView = can('view_analytics');
    const [stats, setStats] = useState<TechStatsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            if (!id) {
                console.error('TechStatsTab: id is required but was undefined');
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const resource = type === 'flow' ? 'flows' : 'campaigns';
                let url = `${resource}?route=tech_stats&id=${id}`;
                if (type === 'flow' && stepId) {
                    url += `&step_id=${stepId}`;
                }

                const res = await api.get<TechStatsData>(url);
                if (res.success && res.data) {
                    setStats(res.data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [id, type, stepId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-40">
                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
            </div>
        );
    }

    if (!canView) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400 bg-slate-50/50 rounded-[18px] border-2 border-dashed border-slate-100 italic">
                <div className="w-16 h-16 bg-white rounded-[14px] flex items-center justify-center shadow-sm mb-4">
                    <Lock className="w-8 h-8 text-rose-300" />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-500">Truy cập bị hạn chế</p>
                <p className="text-[10px] mt-1">Bạn cần quyền 'view_analytics' để xem các báo cáo này.</p>
            </div>
        );
    }

    if (!stats || (!stats.device?.length && !stats.location?.length)) {
        return (
            <div className="flex flex-col items-center justify-center py-32 text-slate-400 bg-slate-50/50 rounded-[18px] border-2 border-dashed border-slate-100 italic">
                <div className="w-16 h-16 bg-white rounded-[14px] flex items-center justify-center shadow-sm mb-4">
                    <Smartphone className="w-8 h-8 opacity-20" />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest opacity-50">Chưa có dữ liệu phân tích</p>
                <p className="text-[10px] mt-1">{isZns ? 'Dữ liệu sẽ xuất hiện khi có người xem tin nhắn Zalo của bạn' : 'Dữ liệu sẽ xuất hiện khi có người dùng mở email hoặc nhấp vào liên kết'}</p>
            </div>
        );
    }

    const deviceData = stats.device?.map((d: TechStatItem) => ({ name: d.name?.toUpperCase() || 'UNKNOWN', value: d.value })) || [];
    const osData = stats.os?.map((o: TechStatItem, idx: number) => ({ ...o, fill: COLORS[idx % COLORS.length] })) || [];
    const locationData = stats.location || [];

    return (
        <TabTransition className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Device Breakdown */}
            <Card title="Phân tích Thiết bị" icon={Smartphone} className="border-slate-100 shadow-xl shadow-slate-200/50 rounded-[18px] overflow-hidden">
                <div className="min-h-[280px] relative pt-2">
                    {deviceData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <PieChart>
                                <Pie
                                    data={deviceData}
                                    cx="50%"
                                    cy="45%"
                                    innerRadius={60}
                                    outerRadius={85}
                                    paddingAngle={6}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {deviceData.map((entry: { name: string, value: number }, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="focus:outline-none" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    formatter={(value) => <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">{value}</span>}
                                    iconType="circle"
                                    iconSize={6}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p className="text-center text-slate-400 py-10">Chưa có dữ liệu</p>}
                    <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none">
                        <Monitor className="w-8 h-8 text-slate-100" />
                        <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1">Platform</span>
                    </div>
                </div>
            </Card>

            {/* OS Breakdown */}
            <Card title="Hệ điều hành phổ biến" icon={Laptop} className="border-slate-100 shadow-xl shadow-slate-200/50 rounded-[18px]">
                <div className="min-h-[280px] pt-2">
                    {osData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={osData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                                    width={90}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
                                    {osData.map((entry: TechStatItem & { fill: string }, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 1) % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="text-center text-slate-400 py-10">Chưa có dữ liệu</p>}
                </div>
            </Card>

            {/* Location Map (List) */}
            <Card title="Vị trí địa lý hàng đầu" icon={MapPin} className="border-slate-100 shadow-xl shadow-slate-200/50 rounded-[18px] md:col-span-2">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {locationData.length > 0 ? locationData.map((loc: TechStatItem, idx: number) => {
                        const iconColor = COLORS[idx % COLORS.length];
                        return (
                            <div key={idx} className="group flex flex-col p-4 bg-white hover:bg-slate-50 transition-all rounded-[20px] border border-slate-100 hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5 cursor-default relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-3 opacity-10">
                                    <Globe className="w-12 h-12" style={{ color: iconColor }} />
                                </div>
                                <div className="relative z-10 flex items-center justify-between mb-3">
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm" style={{ backgroundColor: `${iconColor}20`, color: iconColor }}>
                                        <MapPin className="w-4 h-4" />
                                    </div>
                                    <span className="text-xl font-black text-slate-800">{loc.value.toLocaleString()}</span>
                                </div>

                                <div className="relative z-10">
                                    <p className="text-xs font-bold text-slate-700 truncate" title={loc.name || 'Unknown'}>{loc.name || 'Unknown'}</p>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{isZns ? 'Views' : 'Clicks'}</p>
                                </div>
                            </div>
                        );
                    }) : (
                        <div className="col-span-4 py-16 text-center bg-slate-50/50 rounded-[18px] border border-dashed border-slate-200">
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Không tìm thấy dữ liệu vị trí</p>
                        </div>
                    )}
                </div>
            </Card>
        </TabTransition>
    );
};

export default TechStatsTab;
