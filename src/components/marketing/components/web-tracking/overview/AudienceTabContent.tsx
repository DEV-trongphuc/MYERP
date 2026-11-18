import React from 'react';
import { Smartphone, Terminal, Globe } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { WebStats } from '../types';
import { ensureArray, extractArray } from '../../../../../utils/safeArray';

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
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white bg-[#BD1D2D]">
                                <Smartphone className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Thiết bị</h3>
                                <p className="text-xs text-slate-500">Phân bổ theo loại máy</p>
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
                                                    {ensureArray(stats?.deviceStats).map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            {(() => {
                                                const total = ensureArray(stats?.deviceStats).reduce((acc, curr) => acc + curr.value, 0);
                                                const max = stats.deviceStats.reduce((prev, curr) => (prev.value > curr.value ? prev : curr), stats.deviceStats[0]);
                                                const percent = total > 0 ? Math.round((max.value / total) * 100) : 0;
                                                return (
                                                    <>
                                                        <span className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{percent}%</span>
                                                        <span className="text-[10px] font-semibold text-slate-500 uppercase mt-1 text-center max-w-[60px] truncate">{max.name}</span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-[11px] font-semibold">Không có dữ liệu</div>
                                )}
                            </div>

                            <div className="flex-1 space-y-4">
                                {stats?.deviceStats?.map((entry, index) => {
                                    const total = ensureArray(stats?.deviceStats).reduce((acc, curr) => acc + curr.value, 0);
                                    const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                                    return (
                                        <div key={entry.name} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                <span className="text-sm font-semibold text-slate-700 capitalize truncate">{entry.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0 tabular-nums">
                                                <span className="text-sm font-bold text-slate-900">{entry.value.toLocaleString('vi-VN')}</span>
                                                <span className="text-xs font-semibold text-slate-500 w-10 text-right">{percent}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* OS Stats Card */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white bg-slate-900">
                                <Terminal className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Hệ điều hành</h3>
                                <p className="text-xs text-slate-500">Phân bổ theo nền tảng</p>
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
                                                    {ensureArray(stats?.osStats).map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                                                    ))}
                                                </Pie>
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            {(() => {
                                                const total = ensureArray(stats?.osStats).reduce((acc, curr) => acc + curr.value, 0);
                                                const max = stats.osStats.reduce((prev, curr) => (prev.value > curr.value ? prev : curr), stats.osStats[0]);
                                                const percent = total > 0 ? Math.round((max.value / total) * 100) : 0;
                                                return (
                                                    <>
                                                        <span className="text-2xl font-bold text-slate-900 leading-none tabular-nums">{percent}%</span>
                                                        <span className="text-[10px] font-semibold text-slate-500 uppercase mt-1 text-center max-w-[60px] truncate">{max.name}</span>
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-slate-400 text-[11px] font-semibold">Không có dữ liệu</div>
                                )}
                            </div>

                            <div className="flex-1 space-y-4">
                                {stats?.osStats?.slice(0, 5).map((entry, index) => {
                                    const total = ensureArray(stats?.osStats).reduce((acc, curr) => acc + curr.value, 0);
                                    const percent = total > 0 ? Math.round((entry.value / total) * 100) : 0;
                                    return (
                                        <div key={entry.name} className="flex items-center justify-between group">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                                                <span className="text-sm font-semibold text-slate-700 truncate">{entry.name}</span>
                                            </div>
                                            <div className="flex items-center gap-4 shrink-0 tabular-nums">
                                                <span className="text-sm font-bold text-slate-900">{entry.value.toLocaleString('vi-VN')}</span>
                                                <span className="text-xs font-semibold text-slate-500 w-10 text-right">{percent}%</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Location Ranking - 7 cols */}
                <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white bg-slate-700">
                                <Globe className="w-4 h-4" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Vị trí hàng đầu</h3>
                                <p className="text-xs text-slate-500">Phân bổ theo địa lý</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top 10 Cities</span>
                        </div>
                    </div>

                    <div className="p-6 flex-1 overflow-auto max-h-[500px] space-y-4">
                        {stats?.locationStats && stats.locationStats.length > 0 ? (
                            ensureArray(stats?.locationStats).map((loc, idx) => {
                                const maxVal = stats.locationStats[0]?.value || 1;
                                const percent = Math.round((loc.value / maxVal) * 100);
                                return (
                                    <div key={idx} className="group flex flex-col gap-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <span className="text-xs font-bold text-slate-400 group-hover:text-[#BD1D2D] transition-colors w-4 tabular-nums">{idx + 1}</span>
                                                <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-slate-900 transition-colors">{loc.name}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 tabular-nums">
                                                <span className="text-sm font-bold text-slate-900">{loc.value.toLocaleString('vi-VN')}</span>
                                                <span className="text-[11px] font-medium text-slate-400">Visitors</span>
                                            </div>
                                        </div>
                                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-[#C6333D] rounded-full transition-[width] duration-500 ease-out"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-20">
                                <Globe className="w-12 h-12 mb-4 text-slate-200" />
                                <p className="font-medium">Không có dữ liệu vị trí người dùng</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AudienceTabContent;
