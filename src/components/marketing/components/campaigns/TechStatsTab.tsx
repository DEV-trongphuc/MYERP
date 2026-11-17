import * as React from 'react';
import { useEffect, useState } from 'react';
import { api } from '../../services/storageAdapter';
import Card from '../common/Card';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LabelList } from 'recharts';
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

const PALETTE = [
    '#3b82f6', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#06b6d4', // Cyan
    '#6366f1', // Indigo
    '#ec4899', // Pink
    '#8b5cf6', // Violet
    '#14b8a6', // Teal
    '#f43f5e', // Rose
    '#84cc16'  // Lime
];

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
                <Loader2 className="w-10 h-10 text-[#BD1D2D] animate-spin" />
            </div>
        );
    }

    if (!canView) {
        return (
            <div
                className="flex flex-col items-center justify-center py-32 text-slate-400 bg-slate-50/50 italic"
                style={{ borderRadius: 16, border: '1px dashed #e2e8f0' }}
            >
                <div
                    className="w-16 h-16 bg-white flex items-center justify-center shadow-sm mb-4"
                    style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                >
                    <Lock className="w-8 h-8 text-[#C6333D]" />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Truy cập bị hạn chế</p>
                <p className="text-xs text-slate-500 mt-1">Bạn cần quyền 'view_analytics' để xem các báo cáo này.</p>
            </div>
        );
    }

    if (!stats || (!stats.device?.length && !stats.location?.length)) {
        return (
            <div
                className="flex flex-col items-center justify-center py-32 text-slate-400 bg-slate-50/50 italic"
                style={{ borderRadius: 16, border: '1px dashed #e2e8f0' }}
            >
                <div
                    className="w-16 h-16 bg-white flex items-center justify-center shadow-sm mb-4"
                    style={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
                >
                    <Smartphone className="w-8 h-8 text-slate-400 opacity-60" />
                </div>
                <p className="text-sm font-bold uppercase tracking-widest text-slate-700">Chưa có dữ liệu phân tích</p>
                <p className="text-xs text-slate-500 mt-1">
                    {isZns ? 'Dữ liệu sẽ xuất hiện khi có người xem tin nhắn Zalo của bạn' : 'Dữ liệu sẽ xuất hiện khi có người dùng mở email hoặc nhấp vào liên kết'}
                </p>
            </div>
        );
    }

    const deviceData = stats.device?.map((d: TechStatItem) => ({ name: d.name?.toUpperCase() || 'UNKNOWN', value: d.value })) || [];
    const osData = stats.os?.map((o: TechStatItem, idx: number) => ({ ...o, fill: PALETTE[idx % PALETTE.length] })) || [];
    const locationData = stats.location || [];

    return (
        <TabTransition className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Device Breakdown */}
            <Card
                title="Phân tích Thiết bị"
                icon={Smartphone}
                className="overflow-hidden"
                style={{ borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)', background: '#FFFFFF' }}
            >
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
                                    {deviceData.map((_entry: { name: string, value: number }, index: number) => (
                                        <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} className="focus:outline-none" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', padding: '10px 14px' }}
                                    itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    formatter={(value) => <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{value}</span>}
                                    iconType="circle"
                                    iconSize={8}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : <p className="text-center text-slate-400 py-10">Chưa có dữ liệu</p>}
                    <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center pointer-events-none">
                        <Monitor className="w-8 h-8 text-slate-300" />
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Platform</span>
                    </div>
                </div>
            </Card>

            {/* OS Breakdown */}
            <Card
                title="Hệ điều hành phổ biến"
                icon={Laptop}
                style={{ borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)', background: '#FFFFFF' }}
            >
                <div className="min-h-[280px] pt-2">
                    {osData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={280}>
                            <BarChart data={osData} layout="vertical" margin={{ top: 5, right: 35, left: 35, bottom: 20 }}>
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
                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                                />
                                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                                    {osData.map((_entry: TechStatItem & { fill: string }, index: number) => (
                                        <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                                    ))}
                                    <LabelList
                                        dataKey="value"
                                        position="right"
                                        formatter={(v: any) => (v != null ? Number(v).toLocaleString('vi-VN') : '')}
                                        style={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                                    />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : <p className="text-center text-slate-400 py-10">Chưa có dữ liệu</p>}
                </div>
            </Card>

            {/* Location Map (List) */}
            <Card
                title="Vị trí địa lý hàng đầu"
                icon={MapPin}
                className="md:col-span-2"
                style={{ borderRadius: 16, border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)', background: '#FFFFFF' }}
            >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {locationData.length > 0 ? locationData.map((loc: TechStatItem, idx: number) => {
                        const iconColor = PALETTE[idx % PALETTE.length];
                        const iconBg = `${iconColor}1A`;

                        return (
                            <div
                                key={idx}
                                className="group flex flex-col p-4 bg-white transition-all cursor-default relative overflow-hidden"
                                style={{ borderRadius: 16, border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)' }}
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-5 pointer-events-none">
                                    <Globe className="w-12 h-12 text-slate-800" />
                                </div>
                                <div className="relative z-10 flex items-center justify-between mb-3">
                                    <div
                                        style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            background: iconBg,
                                            color: iconColor,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}
                                    >
                                        <MapPin className="w-4 h-4" />
                                    </div>
                                    <span
                                        className="text-xl font-extrabold tabular-nums"
                                        style={{ color: '#0f172a' }}
                                    >
                                        {loc.value.toLocaleString('vi-VN')}
                                    </span>
                                </div>

                                <div className="relative z-10">
                                    <p className="text-xs font-bold text-slate-800 truncate" title={loc.name || 'Unknown'}>{loc.name || 'Unknown'}</p>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{isZns ? 'Views' : 'Clicks'}</p>
                                </div>
                            </div>
                        );
                    }) : (
                        <div
                            className="col-span-4 py-16 text-center bg-slate-50/50"
                            style={{ borderRadius: 16, border: '1px dashed #e2e8f0' }}
                        >
                            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Không tìm thấy dữ liệu vị trí</p>
                        </div>
                    )}
                </div>
            </Card>
        </TabTransition>
    );
};

export default TechStatsTab;
