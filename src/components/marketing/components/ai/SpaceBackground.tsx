import * as React from 'react';
import { useMemo } from 'react';

const SpaceBackground = React.memo(({ theme = 'deep-space', opacity = 1 }: { theme?: string, opacity?: number }) => {
    // Generate static stars once
    const starsSm = useMemo(() => Array.from({ length: 150 }, () => `${Math.random() * 100}vw ${Math.random() * 100}vh #FFF`).join(','), []);
    const starsMd = useMemo(() => Array.from({ length: 30 }, () => `${Math.random() * 100}vw ${Math.random() * 100}vh rgba(255,255,255,0.4)`).join(','), []);

    const themeColors = useMemo(() => {
        switch (theme) {
            case 'nebula': return { from: '#0f172a', via: '#0b1120', to: '#020617', accent1: 'bg-slate-800/30', accent2: 'bg-[#BD1D2D]/10' };
            case 'cyberpunk': return { from: '#0f172a', via: '#000000', to: '#1e293b', accent1: 'bg-cyan-900/20', accent2: 'bg-blue-900/10' };
            case 'ocean': return { from: '#000000', via: '#0c4a6e', to: '#082f49', accent1: 'bg-emerald-900/10', accent2: 'bg-sky-900/20' };
            case 'pure-black': return { from: '#000000', via: '#000000', to: '#050505', accent1: 'bg-white/5', accent2: 'bg-slate-900/10' };
            default: return { from: '#0f1115', via: '#000000', to: '#000000', accent1: 'bg-slate-900/20', accent2: 'bg-slate-800/10' };
        }
    }, [theme]);

    return (
        <div
            className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none bg-[#000000]"
            style={{ opacity }}
        >
            {/* Deep Space Gradient */}
            <div className="absolute inset-0 transition-colors duration-1000" style={{ background: `radial-gradient(circle at center, ${themeColors.from}, ${themeColors.via}, ${themeColors.to})` }} />

            {/* Subtle Surface Overlay */}
            <div className={`absolute inset-0 transition-colors duration-1000 opacity-30 ${themeColors.accent1} ${themeColors.accent2}`} />

            {/* Static Background Stars */}
            <div className="absolute inset-0 opacity-50">
                <div className="stars-sm" style={{ boxShadow: starsSm, width: '1px', height: '1px', background: 'transparent' }} />
                <div className="stars-md" style={{ boxShadow: starsMd, width: '2px', height: '2px', background: 'transparent', position: 'absolute', top: 0, left: 0 }} />
            </div>
        </div>
    );
});

export default SpaceBackground;
