import React from 'react';

// ─── Base Shimmer Block ───────────────────────────────────────────────────────
const S = ({ className = '', style = {} }: { className?: string; style?: React.CSSProperties }) => (
    <div
        className={`bg-slate-200 relative overflow-hidden rounded ${className}`}
        style={style}
    >
        <div
            style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)',
                animation: 'sk-shimmer 1.4s ease-in-out infinite',
                transform: 'translateX(-100%)',
            }}
        />
    </div>
);

// ─── Global keyframe (injected once) ─────────────────────────────────────────
const KEYFRAME = `@keyframes sk-shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }`;
let _injected = false;
const injectKeyframe = () => {
    if (_injected || typeof document === 'undefined') return;
    const s = document.createElement('style');
    s.textContent = KEYFRAME;
    document.head.appendChild(s);
    _injected = true;
};

// ─── Stat Card Skeleton (3-column grid) ──────────────────────────────────────
export const StatCardsSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
    injectKeyframe();
    return (
        <div className={`grid grid-cols-1 md:grid-cols-${count} gap-4 lg:gap-6`}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white p-4 lg:p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div className="space-y-3 flex-1">
                        <S className="h-3 rounded-full" style={{ width: '50%' }} />
                        <S className="h-8 rounded-xl" style={{ width: '60%' }} />
                    </div>
                    <S className="w-12 h-12 lg:w-14 lg:h-14 rounded-2xl ml-4 shrink-0" />
                </div>
            ))}
        </div>
    );
};

// ─── Table Row Skeleton ───────────────────────────────────────────────────────
const TableRowSkeleton = () => (
    <tr>
        <td className="px-8 py-5">
            <div className="flex items-center gap-4">
                <S className="w-11 h-11 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2">
                    <S className="h-3.5 rounded-full" style={{ width: '55%' }} />
                    <S className="h-3 rounded-full" style={{ width: '35%' }} />
                </div>
            </div>
        </td>
        <td className="px-6 py-5 text-center">
            <S className="h-6 rounded-lg mx-auto" style={{ width: 72 }} />
        </td>
        <td className="px-6 py-5">
            <S className="h-3.5 rounded-full" style={{ width: '70%' }} />
        </td>
        <td className="px-6 py-5">
            <div className="space-y-2">
                <S className="h-3 rounded-full" style={{ width: '50%' }} />
                <S className="h-2 rounded-full" style={{ width: '80%' }} />
            </div>
        </td>
        <td className="px-8 py-5 text-right">
            <S className="w-8 h-8 rounded-xl ml-auto" />
        </td>
    </tr>
);

// ─── Table Skeleton (header + rows) ──────────────────────────────────────────
export const TableSkeleton: React.FC<{ rows?: number; columns?: string[] }> = ({
    rows = 5,
    columns = ['Item', 'Status', 'Date', 'Stats', ''],
}) => {
    injectKeyframe();
    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead className="bg-slate-50/50 border-b border-slate-100 text-left">
                    <tr>
                        {columns.map((col, i) => (
                            <th key={i} className="px-6 py-5 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                {col}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 bg-white">
                    {Array.from({ length: rows }).map((_, i) => <TableRowSkeleton key={i} />)}
                </tbody>
            </table>
        </div>
    );
};

// ─── Card Grid Skeleton ───────────────────────────────────────────────────────
export const CardGridSkeleton: React.FC<{ cols?: number; rows?: number; height?: number }> = ({
    cols = 4,
    rows = 2,
    height = 130,
}) => {
    injectKeyframe();
    const count = cols * rows;
    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-${Math.min(cols, 3)} xl:grid-cols-${cols} gap-6`}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="bg-white rounded-[28px] border border-slate-100 shadow-sm p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <S className="w-10 h-10 rounded-xl shrink-0" />
                        <div className="flex-1 space-y-2">
                            <S className="h-3.5 rounded-full" style={{ width: '65%' }} />
                            <S className="h-3 rounded-full" style={{ width: '40%' }} />
                        </div>
                    </div>
                    <S className="h-3 rounded-full" style={{ width: '80%', height }} />
                </div>
            ))}
        </div>
    );
};

// ─── List Row Skeleton (simpler, for lists/settings) ─────────────────────────
const ListRowSkeleton = () => (
    <div className="flex items-center gap-4 py-4 px-6 border-b border-slate-50 last:border-0">
        <S className="w-10 h-10 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2">
            <S className="h-3.5 rounded-full" style={{ width: '45%' }} />
            <S className="h-3 rounded-full" style={{ width: '30%' }} />
        </div>
        <S className="w-16 h-7 rounded-lg ml-auto" />
    </div>
);

export const ListSkeleton: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
    injectKeyframe();
    return (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {Array.from({ length: rows }).map((_, i) => <ListRowSkeleton key={i} />)}
        </div>
    );
};

// ─── Full Page Skeleton (header + stat cards + table) ────────────────────────
export const FullPageSkeleton: React.FC<{ showStats?: boolean; layout?: 'table' | 'cards' | 'list' }> = ({
    showStats = true,
    layout = 'table',
}) => {
    injectKeyframe();
    return (
        <div className="space-y-6 lg:space-y-8 pb-20">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div className="space-y-2">
                    <S className="h-7 rounded-xl" style={{ width: 200 }} />
                    <S className="h-4 rounded-full" style={{ width: 300 }} />
                </div>
                <S className="h-12 w-36 rounded-2xl" />
            </div>

            {showStats && <StatCardsSkeleton />}

            {/* Content */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Toolbar */}
                <div className="px-6 py-4 border-b border-slate-50 flex gap-4">
                    <S className="h-8 rounded-xl" style={{ width: 300 }} />
                    <S className="h-8 rounded-xl ml-auto" style={{ width: 180 }} />
                </div>
                {layout === 'table' && <TableSkeleton />}
                {layout === 'cards' && <div className="p-6"><CardGridSkeleton /></div>}
                {layout === 'list' && <ListSkeleton />}
            </div>
        </div>
    );
};

export default S;
