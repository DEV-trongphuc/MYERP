import React from 'react';

// Base shimmer block — reusable primitive
export const Sk = ({ w, h, r = 8, className = '' }: { w?: number | string; h?: number | string; r?: number; className?: string }) => (
    <div style={{
        width: w, height: h, borderRadius: r,
        background: '#e2e8f0', position: 'relative', overflow: 'hidden',
        display: w ? 'inline-block' : 'block',
        flexShrink: 0
    }} className={className}>
        <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.6),transparent)',
            animation: 'sk-shimmer 1.4s ease-in-out infinite',
            transform: 'translateX(-100%)'
        }} />
    </div>
);

export const StatCardSkeleton: React.FC = () => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm h-28 space-y-3">
        <Sk w={80} h={12} r={6} />
        <Sk w="60%" h={24} r={8} />
        <Sk w={50} h={10} r={4} />
    </div>
);

export const ChartSkeleton: React.FC = () => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <Sk w={160} h={18} r={8} className="mb-6" />
        <Sk h={280} r={12} />
    </div>
);

export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 5 }) => (
    <div className="space-y-2">
        {[...Array(items)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-50">
                <Sk w={36} h={36} r={10} />
                <div className="flex-1 space-y-2">
                    <Sk h={12} r={6} />
                    <Sk w="60%" h={10} r={5} />
                </div>
            </div>
        ))}
    </div>
);

export const CardSkeleton: React.FC = () => (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
        <Sk w={160} h={16} r={8} />
        <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                    <Sk w="50%" h={11} r={4} />
                    <Sk w={60} h={11} r={4} />
                </div>
            ))}
        </div>
    </div>
);

// Website card skeleton — matches the actual card layout
export const WebsiteCardSkeleton: React.FC = () => (
    <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm flex flex-col justify-between gap-6 min-h-[180px]">
        <div className="flex items-center gap-4">
            <Sk w={48} h={48} r={16} />
            <div className="space-y-2 flex-1">
                <Sk w="70%" h={16} r={6} />
                <Sk w="50%" h={11} r={4} />
            </div>
        </div>
        <div className="space-y-3">
            <Sk h={52} r={20} />
            <div className="grid grid-cols-4 gap-2.5">
                <Sk h={44} r={12} />
                <div className="col-span-3"><Sk h={44} r={12} /></div>
            </div>
        </div>
    </div>
);

// Conversation list item skeleton
export const ConversationItemSkeleton: React.FC = () => (
    <div className="py-2.5 px-3.5 border-b border-slate-50">
        <div className="flex justify-between items-start mb-2">
            <Sk w={100} h={12} r={5} />
            <Sk w={40} h={10} r={4} />
        </div>
        <Sk w="80%" h={10} r={4} />
    </div>
);

// Message bubble skeleton
export const MessageSkeleton: React.FC = () => (
    <div className="space-y-4 p-6">
        {[...Array(4)].map((_, i) => (
            <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                <Sk w={i % 2 === 0 ? '55%' : '45%'} h={i % 3 === 0 ? 60 : 44} r={20} />
            </div>
        ))}
    </div>
);

export const FullPageSkeleton: React.FC = () => (
    <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[...Array(5)].map((_, i) => <StatCardSkeleton key={i} />)}
        </div>
        <ChartSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CardSkeleton />
            <CardSkeleton />
        </div>
    </div>
);
