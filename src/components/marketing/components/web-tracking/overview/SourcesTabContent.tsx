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
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300 space-y-6">
            {/* Header Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 bg-[#BD1D2D] text-white rounded-xl flex items-center justify-center">
                        <Share2 className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-900">Nguồn truy cập</h3>
                        <p className="text-xs text-slate-500 mt-0.5">Phân tích lưu lượng theo nguồn gốc</p>
                    </div>
                </div>

                <div className="flex bg-slate-100 p-1 rounded-[10px] border border-slate-200">
                    <button
                        onClick={() => setMode('session')}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-[7px] text-xs font-bold transition-colors whitespace-nowrap ${mode === 'session' ? 'bg-white text-[#BD1D2D] shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Zap className={`w-3.5 h-3.5 ${mode === 'session' ? 'text-[#BD1D2D]' : ''}`} />
                        Theo phiên
                    </button>
                    <button
                        onClick={() => setMode('user')}
                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-[7px] text-xs font-bold transition-colors whitespace-nowrap ${mode === 'user' ? 'bg-white text-[#BD1D2D] shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Users className={`w-3.5 h-3.5 ${mode === 'user' ? 'text-[#BD1D2D]' : ''}`} />
                        Người dùng mới
                    </button>
                </div>
            </div>

            {/* Sources List */}
            <div className="grid grid-cols-1 gap-3">
                {groupedSources.map((source, idx) => {
                    const color = getSourceColor(source.source, source.medium);
                    const s = source.source.toLowerCase();
                    const isDirect = s === 'direct' || s === '(direct)';

                    const colorClasses: Record<string, string> = {
                        blue: 'bg-[#C6333D] bg-slate-100 text-slate-700',
                        emerald: 'bg-emerald-600 bg-emerald-50 text-emerald-700',
                        slate: 'bg-slate-700 bg-slate-100 text-slate-700',
                    };

                    return (
                        <div key={idx} className="group relative bg-white p-4 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors">
                            <div className="flex items-center justify-between gap-4">
                                {/* Left side: Source Info */}
                                <div className="flex items-center gap-3.5 flex-1 min-w-0">
                                    <div className="relative">
                                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center p-2 group-hover:bg-white border border-slate-200 transition-colors">
                                            {isDirect ? <Globe className="w-5 h-5 text-slate-500 group-hover:text-[#BD1D2D]" /> :
                                                s.includes('google') ? <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/24px-Google_%22G%22_logo.svg.png" className="w-5 h-5 object-contain" alt="Google" /> :
                                                    s.includes('facebook') || s === 'fb' ? <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/24px-2021_Facebook_icon.svg.png" className="w-5 h-5 object-contain" alt="Facebook" /> :
                                                        s.includes('zalo') ? <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/24px-Icon_of_Zalo.svg.png" className="w-5 h-5 object-contain" alt="Zalo" /> :
                                                            <div className="w-3 h-3 rounded-full bg-slate-600" />
                                            }
                                        </div>
                                        {idx === 0 && (
                                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#BD1D2D] text-white rounded-full flex items-center justify-center border-2 border-white">
                                                <TrendingUp className="w-2.5 h-2.5" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-bold text-slate-900 capitalize group-hover:text-[#BD1D2D] transition-colors">{source.source}</span>
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider ${(colorClasses[color] || colorClasses.slate).split(' ').slice(1).join(' ')}`}>
                                                {source.medium}
                                            </span>
                                        </div>

                                        {/* Progress Section */}
                                        <div className="flex items-center gap-3">
                                            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-[#C6333D] rounded-full transition-[width] duration-500 ease-out"
                                                    style={{ width: `${source.percentage}%` }}
                                                />
                                            </div>
                                            <span className="text-[11px] font-bold text-slate-600 tabular-nums">{source.percentage.toFixed(1)}%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right side: Metrics */}
                                <div className="flex items-center gap-4 sm:gap-8">
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                                            {mode === 'session' ? 'Sessions' : 'New Users'}
                                        </p>
                                        <div className="flex items-center justify-end gap-1.5">
                                            <span className="text-base font-bold text-slate-900 tabular-nums">
                                                {source.metric.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>

                                    {mode === 'session' && (
                                        <div className="hidden sm:block text-right">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Visitors</p>
                                            <span className="text-base font-bold text-slate-900 tabular-nums">
                                                {source.secondary?.toLocaleString()}
                                            </span>
                                        </div>
                                    )}

                                    <div className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:text-[#BD1D2D] hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {groupedSources.length === 0 && (
                    <div className="py-20 text-center bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-white rounded-2xl border border-slate-200 flex items-center justify-center mx-auto mb-5">
                            <Share2 className="w-8 h-8 text-slate-300" />
                        </div>
                        <h4 className="text-base font-bold text-slate-800 mb-1">Chưa có dữ liệu nguồn truy cập</h4>
                        <p className="text-xs font-medium text-slate-500 max-w-[280px] mx-auto leading-relaxed">
                            Trang web chưa ghi nhận lưu lượng truy cập từ các nguồn trong khoảng thời gian này.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SourcesTabContent;
