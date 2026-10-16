import * as React from 'react';
import { useMemo } from 'react';
import { Share2, Globe, TrendingUp, Users, Zap, ExternalLink } from 'lucide-react';
import { WebStats } from '../types';

interface SourcesTabContentProps {
    stats: WebStats | null;
}

const SourcesTabContent: React.FC<SourcesTabContentProps> = ({ stats }) => {
    const [mode, setMode] = React.useState<'session' | 'user'>('session');

    const groupedSources = useMemo(() => {
        const data = mode === 'session' ? stats?.trafficSources : stats?.userAcquisition;
        if (!data) return [];

        const groups: Record<string, { source: string; medium: string; metric: number; secondary?: number }> = {};
        let totalMetric = 0;

        data.forEach((item: any) => {
            const key = `${item.source.toLowerCase()}|${item.medium.toLowerCase()}`;
            const metricVal = mode === 'session' ? item.sessions : item.newUsers;
            const secondaryVal = mode === 'session' ? item.visitors : 0;

            if (!groups[key]) {
                groups[key] = {
                    source: item.source,
                    medium: item.medium,
                    metric: 0,
                    secondary: 0
                };
            }
            groups[key].metric += metricVal;
            groups[key].secondary! += secondaryVal;
            totalMetric += metricVal;
        });

        return Object.values(groups).map(group => ({
            ...group,
            percentage: totalMetric > 0 ? (group.metric / totalMetric) * 100 : 0
        })).sort((a, b) => b.metric - a.metric);
    }, [stats, mode]);

    const getSourceColor = (source: string, medium: string) => {
        return 'blue';
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            {/* Header Card */}
            <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg shadow-blue-500/20 flex items-center justify-center">
                        <Share2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-slate-800 tracking-tight">Nguồn Truy Cập</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Analysing traffic origins</p>
                    </div>
                </div>

                <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/50">
                    <button
                        onClick={() => setMode('session')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${mode === 'session' ? 'bg-white text-slate-800 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Zap className={`w-3 h-3 ${mode === 'session' ? 'fill-slate-600 text-slate-600' : ''}`} />
                        Theo Phiên
                    </button>
                    <button
                        onClick={() => setMode('user')}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${mode === 'user' ? 'bg-white text-slate-800 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Users className={`w-3 h-3 ${mode === 'user' ? 'fill-slate-600 text-slate-600' : ''}`} />
                        Người dùng mới
                    </button>
                </div>
            </div>

            {/* Sources List */}
            <div className="grid grid-cols-1 gap-4">
                {groupedSources.map((source, idx) => {
                    const color = getSourceColor(source.source, source.medium);
                    const s = source.source.toLowerCase();
                    const isDirect = s === 'direct' || s === '(direct)';

                    const colorClasses: Record<string, string> = {
                        blue: 'from-blue-500 to-blue-600 bg-blue-50 text-blue-600',
                        emerald: 'from-emerald-500 to-emerald-600 bg-emerald-50 text-emerald-600',
                        violet: 'from-blue-500 to-blue-600 bg-blue-50 text-blue-600',
                        cyan: 'from-cyan-500 to-cyan-600 bg-cyan-50 text-cyan-600',
                        slate: 'from-slate-500 to-slate-600 bg-slate-50 text-slate-600',
                    };

                    return (
                        <div key={idx} className="group relative bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
                            <div className="flex items-center justify-between gap-4">
                                {/* Left side: Source Info */}
                                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center p-2 group-hover:scale-105 group-hover:bg-white border border-slate-100 group-hover:border-blue-100 group-hover:shadow-md group-hover:shadow-blue-50 transition-all duration-300">
                                            {isDirect ? <Globe className="w-5 h-5 text-slate-400 group-hover:text-blue-500" /> :
                                                s.includes('google') ? <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/24px-Google_%22G%22_logo.svg.png" className="w-5 h-5 object-contain" alt="Google" /> :
                                                    s.includes('facebook') || s === 'fb' ? <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/24px-2021_Facebook_icon.svg.png" className="w-5 h-5 object-contain" alt="Facebook" /> :
                                                        s.includes('zalo') ? <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/24px-Icon_of_Zalo.svg.png" className="w-5 h-5 object-contain" alt="Zalo" /> :
                                                            <div className={`w-3 h-3 rounded-full bg-${color}-500 shadow-[0_0_8px_rgba(var(--color-${color}-500),0.4)]`} />
                                            }
                                        </div>
                                        {idx === 0 && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 text-white rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                                                <TrendingUp className="w-2.5 h-2.5" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-black text-slate-800 capitalize tracking-tight group-hover:text-blue-600 transition-colors">{source.source}</span>
                                            <span className={`text-[8px] px-1.5 py-0.5 rounded-md font-black uppercase tracking-widest ${colorClasses[color].split(' ').slice(2).join(' ')}`}>
                                                {source.medium}
                                            </span>
                                        </div>

                                        {/* Progress Section */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full bg-gradient-to-r ${colorClasses[color].split(' ').slice(0, 2).join(' ')} rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(59,130,246,0.3)]`}
                                                    style={{
                                                        width: `${source.percentage}%`,
                                                        backgroundColor: color === 'blue' ? '#3b82f6' : undefined
                                                    }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-black text-slate-500 tabular-nums">{source.percentage.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right side: Metrics */}
                                <div className="flex items-center gap-4 sm:gap-8">
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">
                                            {mode === 'session' ? 'Sessions' : 'New Users'}
                                        </p>
                                        <div className="flex items-center justify-end gap-1.5">
                                            <span className="text-base font-black text-slate-800 tabular-nums group-hover:scale-105 transition-transform origin-right">
                                                {source.metric.toLocaleString()}
                                            </span>
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                        </div>
                                    </div>

                                    {mode === 'session' && (
                                        <div className="hidden sm:block text-right">
                                            <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-0.5">Visitors</p>
                                            <span className="text-base font-black text-slate-800 tabular-nums">
                                                {source.secondary?.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    <div className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-slate-300 hover:text-blue-500 hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all cursor-pointer">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {groupedSources.length === 0 && (
                    <div className="py-24 text-center bg-slate-50/50 rounded-[40px] border border-dashed border-slate-200">
                        <div className="w-20 h-20 bg-white rounded-[32px] shadow-sm flex items-center justify-center mx-auto mb-6">
                            <Share2 className="w-10 h-10 text-slate-200" />
                        </div>
                        <h4 className="text-lg font-black text-slate-800 mb-1">No traffic data found</h4>
                        <p className="text-sm font-bold text-slate-400 max-w-[280px] mx-auto leading-relaxed">
                            Web property hasn't recorded any traffic sources yet.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SourcesTabContent;
