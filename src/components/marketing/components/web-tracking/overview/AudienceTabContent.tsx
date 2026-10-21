import React from 'react';
import { Smartphone, Terminal, Globe } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { WebStats } from '../types';

interface AudienceTabContentProps {
    stats: WebStats | null;
}

const COLORS = [
    '#C6333D', // Executive Red
    '#0f172a', // Deep Slate
    '#334155', // Body Slate
    '#64748b', // Muted Slate
    '#94a3b8', // Light Slate
    '#cbd5e1'  // Border Slate
];

const AudienceTabContent: React.FC<AudienceTabContentProps> = ({ stats }) => {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Device & OS Section - 5 cols */}
                <div className="lg:col-span-5 space-y-8">
                    {/* Device Stats Card */}
                    <div className="bg-white p-5 rounded-[14px] border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2.5 mb-6">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white bg-blue-500 border border-blue-500 shadow-lg shadow-blue-500/20">
                                <Smartphone className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Thiết Bị</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Phân bổ theo loại máy</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-6">
                            <div className="w-32 h-32 shrink-0 relative">
                                {stats?.deviceStats && stats.deviceStats.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width={128} height={128} minWidth={0}>
                                            <PieChart>
                                                <Pie
                                                    data={stats.deviceStats}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={45}
                                                    outerRadius={60}
                                                    paddingAngle={8}
                                                    dataKey="value"
                                                >
                                                    {stats.deviceStats.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            {(() => {
                                                const total = stats.deviceStats.reduce((acc, curr) => acc + curr.value, 0);
                                                const max = stats.deviceStats.reduce((prev, curr) => (prev.value > curr.value ? prev : curr), stats.deviceStats[0]);
                                                const percent = total > 0 ? Math.round((max.value / total) * 100) : 0;
                                                return (
                                                    <>
                                                        <span className="text-2xl font-black text-slate-800 leading-none">{percent}%</span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1 text-center max-w-[60px] truncate">{max.name}</span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-300 text-[10px] font-bold italic">No Data</div>
                                )}
                            </div>

                            <div className="flex-1 space-y-4">
                                {stats?.deviceStats?.map((entry, index) => {
                                    const total = stats.deviceStats.reduce((acc, curr) => acc + curr.value, 0);
                                    const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                                    return (
                                        <div key={entry.name} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                <span className="text-sm font-bold text-slate-600 capitalize truncate">{entry.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0">
                                                <span className="text-sm font-black text-slate-800">{entry.value}</span>
                                                <span className="text-xs font-bold text-slate-400 w-10 text-right">{percent}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* OS Stats Card */}
                    <div className="bg-white p-5 rounded-[14px] border border-slate-100 shadow-sm">
                        <div className="flex items-center gap-2.5 mb-6">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white bg-slate-700 border border-slate-700 shadow-lg shadow-slate-700/20">
                                <Terminal className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Hệ Điều Hành</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Phân bổ theo phần mềm</p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-6">
                            <div className="w-32 h-32 shrink-0 relative">
                                {stats?.osStats && stats.osStats.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width={128} height={128} minWidth={0}>
                                            <PieChart>
                                                <Pie
                                                    data={stats.osStats}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={45}
                                                    outerRadius={60}
                                                    paddingAngle={6}
                                                    dataKey="value"
                                                >
                                                    {stats.osStats.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            {(() => {
                                                const total = stats.osStats.reduce((acc, curr) => acc + curr.value, 0);
                                                const max = stats.osStats.reduce((prev, curr) => (prev.value > curr.value ? prev : curr), stats.osStats[0]);
                                                const percent = total > 0 ? Math.round((max.value / total) * 100) : 0;
                                                return (
                                                    <>
                                                        <span className="text-2xl font-black text-slate-800 leading-none">{percent}%</span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-1 text-center max-w-[60px] truncate">{max.name}</span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-300 text-[10px] font-bold italic">No Data</div>
                                )}
                            </div>

                            <div className="flex-1 space-y-4">
                                {stats?.osStats?.slice(0, 5).map((entry, index) => {
                                    const total = stats.osStats.reduce((acc, curr) => acc + curr.value, 0);
                                    const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                                    return (
                                        <div key={entry.name} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                <span className="text-sm font-bold text-slate-600 truncate">{entry.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0">
                                                <span className="text-sm font-black text-slate-800">{entry.value}</span>
                                                <span className="text-xs font-bold text-slate-400 w-10 text-right">{percent}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Location Ranking - 7 cols */}
                <div className="lg:col-span-7 bg-white rounded-[14px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white bg-indigo-500 border border-indigo-500 shadow-lg shadow-indigo-500/20">
                                <Globe className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-800">Vị Trí Hàng Đầu</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Phân bổ theo địa lý</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Top 10 Cities</span>
                        </div>
                    </div>

                    <div className="p-6 flex-1 overflow-auto max-h-[500px] space-y-4">
                        {stats?.locationStats && stats.locationStats.length > 0 ? (
                            stats.locationStats.map((loc, idx) => {
                                const maxVal = stats.locationStats[0]?.value || 1;
                                const percent = Math.round((loc.value / maxVal) * 100);
                                return (
                                    <div key={idx} className="group flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-[10px] font-black text-slate-300 group-hover:text-rose-500 transition-colors w-4">{idx + 1}</span>
                                                <p className="text-sm font-bold text-slate-700 truncate group-hover:text-slate-900 transition-colors">{loc.name}</p>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="text-sm font-black text-slate-800">{loc.value.toLocaleString()}</span>
                                                <span className="text-[10px] font-bold text-slate-400 tracking-tighter">Visitors</span>
                                            </div>
                                        </div>
                                        <div className="w-full h-2 bg-slate-50 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(37,99,235,0.4)]"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20 grayscale opacity-50">
                                <Globe className="w-12 h-12 mb-4" />
                                <p className="font-medium italic">Không có dữ liệu vị trí người dùng</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AudienceTabContent;
